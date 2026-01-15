import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors'
import { generateBPMN } from './agent.js';
import { analyzeProcessDocument } from './agent2.js';
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

        console.log('Generating BPMN for process description...');
        const result = await generateBPMN(processDescription);

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
        console.log(`Analyzing PDF: ${req.file.originalname}`);

        const result = await analyzeProcessDocument(pdfPath);

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
        console.log(`Processing PDF to BPMN: ${req.file.originalname}`);

        // Step 1: Extract process logic from PDF
        console.log('Step 1: Extracting process logic...');
        const analysisResult = await analyzeProcessDocument(pdfPath);

        // Step 2: Generate BPMN from extracted logic
        console.log('Step 2: Generating BPMN...');
        const bpmnResult = await generateBPMN(analysisResult.explanation);

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
});

export default app;