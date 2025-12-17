import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import * as fs from 'fs';

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const fileManager = new GoogleAIFileManager(API_KEY);

async function analyzeProcessDocument(pdfPath: string) {
    // 1. Upload the PDF to the File API
    console.log("📤 Reading process document...");
    const uploadResult = await fileManager.uploadFile(pdfPath, {
        mimeType: "application/pdf",
        displayName: "Process Manual",
    });

    // 2. Setup the Analyst Model
    const model = genAI.getGenerativeModel({ 
        model: 'gemini-3-pro-preview',
        systemInstruction: `You are a Senior Process Analyst. 
        Your task is to identify every step in a process from the provided document.
        
        For every action found, you MUST identify:
        1. The Actor (Lane)
        2. The Action Type (Service Task, User Task, or Gateway)
        3. The Flow (Where does it go next?)
        4. Need to be sematically correct for BPMN 2.0 standards.
        Format the output as a chronological list of steps with technical annotations in parentheses.`
    });

    // 3. Extract the logic
    console.log("🧐 Analyzing document structure...");
    const result = await model.generateContentStream([
        {
            fileData: {
                mimeType: uploadResult.file.mimeType,
                fileUri: uploadResult.file.uri,
            },
        },
        { text: "Extract the complete end-to-end process from this PDF." },
    ]);

    for await (const chunk of result.stream) {
        console.log(chunk.text());
     }
    const extractedLogic = (await result.response).text();
    console.log("✅ Analysis Complete.");
    
    return extractedLogic;
}

// --- Usage ---
const processLogic = await analyzeProcessDocument("./ZAKON.pdf");
fs.writeFileSync('processLogic2.txt', processLogic);
console.log(processLogic);