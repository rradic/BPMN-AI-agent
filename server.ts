import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors'
import { generateBPMN } from './agent.js';
import { analyzeProcessDocument } from './agent2.js';
import {
    analyzeProcessStructure,
    generateProcessScenarios,
    simulateProcess,
    optimizeProcess,
    fullProcessAnalysis,
    type ProcessStructure,
    type Scenario,
    type SimulationResult
} from './agent3.js';
import { getProviderConfig, type AIProviderConfig } from './aiProvider.js';

// Helper to extract AI provider config from request headers
function extractProviderConfig(req: Request): AIProviderConfig {
    return getProviderConfig({
        'x-ai-model': req.headers['x-ai-model'] as string | undefined,
        'x-ai-api-key': req.headers['x-ai-api-key'] as string | undefined
    });
}
const app = express();
const PORT = process.env.PORT || 3000;

// Timeout configuration (5 minutes for AI operations)
const AI_TIMEOUT = 5 * 60 * 1000;

// Middleware
app.use(express.json());
app.use(express.text());
app.use(cors())
// Increase timeout for all routes (default is 2 minutes)
app.use((_req: Request, res: Response, next: express.NextFunction) => {
    res.setTimeout(AI_TIMEOUT);
    next();
});

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Agent 1: Generate BPMN from process description
 * POST /api/agent1/generate-bpmn
 * Body: { "processDescription": "..." }
 * Returns: { decision, explanation, bpmnXml }
 */
app.post('/api/agent1/generate-bpmn', async (req: Request, res: Response) => {
    try {
        const { processDescription } = req.body;

        if (!processDescription || typeof processDescription !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid processDescription in request body'
            });
            return;
        }

        const providerConfig = extractProviderConfig(req);
        console.log(`Generating BPMN using ${providerConfig.model}...`);
        const result = await generateBPMN(processDescription, undefined, providerConfig);

        // Return structured response with decision, explanation, and bpmnXml
        res.json({
            decision: result.decision,
            explanation: result.explanation,
            bpmnXml: result.bpmnXml
        });
    } catch (error) {
        console.error('Error generating BPMN:', error);
        res.status(500).json({
            error: 'Failed to generate BPMN',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Agent 2: Analyze PDF document to extract process logic
 * POST /api/agent2/analyze-pdf
 * Body: multipart/form-data with 'pdf' file
 * Returns: { filename, decision, explanation }
 */
app.post('/api/agent2/analyze-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No PDF file uploaded' });
            return;
        }

        const pdfPath = req.file.path;
        const providerConfig = extractProviderConfig(req);
        console.log(`Analyzing PDF: ${req.file.originalname} using ${providerConfig.model}...`);

        const result = await analyzeProcessDocument(pdfPath, providerConfig);

        // Clean up uploaded file
        fs.unlinkSync(pdfPath);

        // Return structured response with decision and explanation
        res.json({
            filename: req.file.originalname,
            decision: result.decision,
            explanation: result.explanation
        });
    } catch (error) {
        console.error('Error analyzing PDF:', error);

        // Clean up uploaded file on error
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Failed to analyze PDF',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Combined: Upload PDF, extract process, generate BPMN
 * POST /api/pipeline/pdf-to-bpmn
 * Body: multipart/form-data with 'pdf' file
 * Returns: { steps: [{ agent, decision, explanation }], bpmnXml }
 */
app.post('/api/pipeline/pdf-to-bpmn', upload.single('pdf'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No PDF file uploaded' });
            return;
        }

        const pdfPath = req.file.path;
        const providerConfig = extractProviderConfig(req);
        console.log(`Processing PDF to BPMN: ${req.file.originalname} using ${providerConfig.model}...`);

        // Step 1: Extract process logic from PDF
        console.log('Step 1: Extracting process logic...');
        const analysisResult = await analyzeProcessDocument(pdfPath, providerConfig);

        // Step 2: Generate BPMN from extracted logic
        console.log('Step 2: Generating BPMN...');
        const bpmnResult = await generateBPMN(analysisResult.explanation, undefined, providerConfig);

        // Clean up uploaded file
        fs.unlinkSync(pdfPath);

        // Return structured response with explanations from both steps
        res.json({
            filename: req.file.originalname,
            steps: [
                {
                    agent: 'Document Analyzer',
                    decision: analysisResult.decision,
                    explanation: analysisResult.explanation
                },
                {
                    agent: 'BPMN Generator',
                    decision: bpmnResult.decision,
                    explanation: bpmnResult.explanation
                }
            ],
            bpmnXml: bpmnResult.bpmnXml
        });
    } catch (error) {
        console.error('Error in PDF to BPMN pipeline:', error);

        // Clean up uploaded file on error
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Failed to process PDF to BPMN',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// ═══════════════════════════════════════════════════════════════
// AGENT 3: Process Optimization Endpoints
// ═══════════════════════════════════════════════════════════════

/**
 * Agent 3: Analyze process structure from description
 * POST /api/agent3/analyze
 * Body: { "processDescription": "...", "bpmnXml": "..." (optional) }
 * Returns: { decision, explanation, processStructure }
 */
app.post('/api/agent3/analyze', async (req: Request, res: Response) => {
    try {
        const { processDescription, bpmnXml } = req.body;

        if (!processDescription || typeof processDescription !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid processDescription in request body'
            });
            return;
        }

        const providerConfig = extractProviderConfig(req);
        console.log(`Agent3: Analyzing process structure using ${providerConfig.model}...`);
        const result = await analyzeProcessStructure(processDescription, bpmnXml, providerConfig);

        res.json(result);
    } catch (error) {
        console.error('Error analyzing process:', error);
        res.status(500).json({
            error: 'Failed to analyze process structure',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Agent 3: Generate simulation scenarios
 * POST /api/agent3/scenarios
 * Body: { "processStructure": {...} }
 * Returns: { decision, explanation, scenarios }
 */
app.post('/api/agent3/scenarios', async (req: Request, res: Response) => {
    try {
        const { processStructure } = req.body;

        if (!processStructure) {
            res.status(400).json({
                error: 'Missing processStructure in request body'
            });
            return;
        }

        const providerConfig = extractProviderConfig(req);
        console.log(`Agent3: Generating scenarios using ${providerConfig.model}...`);
        const result = await generateProcessScenarios(processStructure as ProcessStructure, providerConfig);

        res.json(result);
    } catch (error) {
        console.error('Error generating scenarios:', error);
        res.status(500).json({
            error: 'Failed to generate scenarios',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Agent 3: Run process simulation
 * POST /api/agent3/simulate
 * Body: { "processStructure": {...}, "scenarios": [...], "numInstances": 100 }
 * Returns: { decision, explanation, simulationResults }
 */
app.post('/api/agent3/simulate', async (req: Request, res: Response) => {
    try {
        const { processStructure, scenarios, numInstances = 100 } = req.body;

        if (!processStructure || !scenarios) {
            res.status(400).json({
                error: 'Missing processStructure or scenarios in request body'
            });
            return;
        }

        const providerConfig = extractProviderConfig(req);
        console.log(`Agent3: Running simulation using ${providerConfig.model}...`);
        const result = await simulateProcess(
            processStructure as ProcessStructure,
            scenarios as Scenario[],
            numInstances,
            providerConfig
        );

        res.json(result);
    } catch (error) {
        console.error('Error running simulation:', error);
        res.status(500).json({
            error: 'Failed to run simulation',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Agent 3: Optimize process (bottleneck detection + recommendations)
 * POST /api/agent3/optimize
 * Body: { "processStructure": {...}, "simulationResults": [...] }
 * Returns: { decision, explanation, bottleneckAnalysis, improvements, tradeoffAnalysis }
 */
app.post('/api/agent3/optimize', async (req: Request, res: Response) => {
    try {
        const { processStructure, simulationResults } = req.body;

        if (!processStructure || !simulationResults) {
            res.status(400).json({
                error: 'Missing processStructure or simulationResults in request body'
            });
            return;
        }

        const providerConfig = extractProviderConfig(req);
        console.log(`Agent3: Optimizing process using ${providerConfig.model}...`);
        const result = await optimizeProcess(
            processStructure as ProcessStructure,
            simulationResults as SimulationResult[],
            providerConfig
        );

        res.json(result);
    } catch (error) {
        console.error('Error optimizing process:', error);
        res.status(500).json({
            error: 'Failed to optimize process',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Agent 3: Full analysis pipeline
 * POST /api/agent3/full-analysis
 * Body: { "processDescription": "...", "bpmnXml": "..." (optional), "numInstances": 50 }
 * Returns: { decision, explanation, results, report }
 */
app.post('/api/agent3/full-analysis', async (req: Request, res: Response) => {
    try {
        const { processDescription, bpmnXml, numInstances = 50 } = req.body;

        if (!processDescription || typeof processDescription !== 'string') {
            res.status(400).json({
                error: 'Missing or invalid processDescription in request body'
            });
            return;
        }

        const providerConfig = extractProviderConfig(req);
        console.log(`Agent3: Running full analysis pipeline using ${providerConfig.model}...`);
        const result = await fullProcessAnalysis(processDescription, bpmnXml, numInstances, providerConfig);

        res.json(result);
    } catch (error) {
        console.error('Error in full analysis:', error);
        res.status(500).json({
            error: 'Failed to complete full analysis',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        details: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('\nAvailable endpoints:');
    console.log('  GET  /health                    - Health check');
    console.log('  POST /api/agent1/generate-bpmn  - Generate BPMN from text');
    console.log('  POST /api/agent2/analyze-pdf    - Extract process from PDF');
    console.log('  POST /api/pipeline/pdf-to-bpmn  - PDF to BPMN pipeline');
    console.log('  POST /api/agent3/analyze        - Analyze process structure');
    console.log('  POST /api/agent3/scenarios      - Generate what-if scenarios');
    console.log('  POST /api/agent3/simulate       - Run process simulation');
    console.log('  POST /api/agent3/optimize       - Optimize process (bottlenecks + recommendations)');
    console.log('  POST /api/agent3/full-analysis  - Full optimization pipeline');
});

export default app;