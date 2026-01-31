import { generateContentWithFile, type AIProviderConfig } from './aiProvider.js';

export interface ProcessAnalysisResponse {
    decision: string;
    explanation: string;
}

const SYSTEM_INSTRUCTION = `You are a Senior Process Analyst with explainable AI capabilities.
Your task is to identify every step in a process from the provided document.
For every action found, you MUST identify:
1. The Actor (Lane)
2. The Action Type: Events (Start Event, End Event) Activities(User Task) and  Gateways (Possible gateways: Exclusive (XOR), Inclusive (OR), Parallel (AND), Event-Based, Complex)
3. The Flow and connections (Where does it go next?) (Sequence or Message Flow, Association(for comments) (optional))
4. The analysis must be semantically correct for BPMN 2.0 standards.

You can use all BPMN 2.0 elements: as needed. (Events: Timer Message Error Escalation Conditional Signal Multiple Parallel Multiple Cancel Compensation Link Terminate Tasks User Manual Service Script Business Rule Send Receive Sub-process markers Loop Multi-Instance (Parallel, Sequential) Ad-Hoc Transaction Event Sub-Process, Data Object Data Input Data Output Data Store Data Association)
You MUST return a JSON response with the following structure:
{
  "decision": "A brief, one-sentence summary of the analyzed process.",
  "explanation": "A detailed, chronological list of all identified process steps with technical annotations in parentheses. Each step should be on a new line."
}`;

export async function analyzeProcessDocument(
    pdfPath: string,
    providerConfig?: AIProviderConfig
): Promise<ProcessAnalysisResponse> {
    const config = providerConfig || { model: 'gemini', apiKey: '' };

    const result = await generateContentWithFile(
        config,
        pdfPath,
        'application/pdf',
        'Extract the complete end-to-end process from this PDF and provide the analysis in the specified JSON format.',
        {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 1.0,
            responseFormat: 'json',
        }
    );

    const responseText = result.text;
    let parsedResponse: ProcessAnalysisResponse;

    try {
        parsedResponse = JSON.parse(responseText.replace(/```json\n?|\n?```/g, ''));
        console.log(parsedResponse)
    } catch (e) {
        console.error("Failed to parse JSON response:", responseText);
        // Fallback if JSON parsing fails
        parsedResponse = {
            decision: "Failed to analyze document.",
            explanation: `Could not parse the response from the AI model. Raw response: ${responseText}`
        };
    }

    return parsedResponse;
}
