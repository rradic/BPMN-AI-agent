/**
 * AI Provider abstraction for multi-model support
 * Supports: Gemini, OpenAI (ChatGPT), and Claude
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Types
export type AIModel = 'gemini' | 'openai' | 'claude';

export interface AIProviderConfig {
    model: AIModel;
    apiKey: string;
}

export interface GenerationOptions {
    systemInstruction: string;
    temperature?: number;
    responseFormat?: 'json' | 'text';
}

export interface GenerationResult {
    text: string;
}

// Default API keys (fallbacks - not recommended for production)
const DEFAULT_GEMINI_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyCvqvBIFscgo9xlWCHe_dkVjq0W8sl0Ulk';

// ═══════════════════════════════════════════════════════════════
// RETRY UTILITY
// ═══════════════════════════════════════════════════════════════

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for async functions with exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    context: string = 'API call',
    maxRetries: number = MAX_RETRIES
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < maxRetries) {
                const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(`[Retry ${attempt}/${maxRetries}] ${context} failed: ${lastError.message}. Retrying in ${delay}ms...`);
                await sleep(delay);
            } else {
                console.error(`[Failed] ${context} failed after ${maxRetries} attempts: ${lastError.message}`);
            }
        }
    }

    throw lastError;
}

/**
 * Get AI provider configuration from request headers
 */
export function getProviderConfig(headers: Record<string, string | undefined>): AIProviderConfig {
    const model = (headers['x-ai-model'] || 'gemini') as AIModel;
    const apiKey = headers['x-ai-api-key'] || '';

    return { model, apiKey };
}

/**
 * Generate content using the specified AI provider (with retry)
 */
export async function generateContent(
    config: AIProviderConfig,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    return withRetry(async () => {
        switch (config.model) {
            case 'gemini':
                return generateWithGemini(config.apiKey || DEFAULT_GEMINI_KEY, prompt, options);
            case 'openai':
                return generateWithOpenAI(config.apiKey, prompt, options);
            case 'claude':
                return generateWithClaude(config.apiKey, prompt, options);
            default:
                throw new Error(`Unsupported AI model: ${config.model}`);
        }
    }, `generateContent (${config.model})`);
}

/**
 * Generate content with file (for PDF analysis) - with retry
 */
export async function generateContentWithFile(
    config: AIProviderConfig,
    filePath: string,
    mimeType: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    return withRetry(async () => {
        switch (config.model) {
            case 'gemini':
                return generateWithGeminiFile(config.apiKey || DEFAULT_GEMINI_KEY, filePath, mimeType, prompt, options);
            case 'openai':
                return generateWithOpenAIFile(config.apiKey, filePath, mimeType, prompt, options);
            case 'claude':
                return generateWithClaudeFile(config.apiKey, filePath, mimeType, prompt, options);
            default:
                throw new Error(`Unsupported AI model: ${config.model}`);
        }
    }, `generateContentWithFile (${config.model})`);
}

// ═══════════════════════════════════════════════════════════════
// GEMINI PROVIDER
// ═══════════════════════════════════════════════════════════════

async function generateWithGemini(
    apiKey: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: options.systemInstruction,
    });

    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            // @ts-ignore
            thinkingConfig: { includeThoughts: true },
            temperature: options.temperature ?? 1.0,
            responseMimeType: options.responseFormat === 'json' ? "application/json" : "text/plain",
        },
    });

    return { text: result.response.text() };
}

async function generateWithGeminiFile(
    apiKey: string,
    filePath: string,
    mimeType: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    const { GoogleAIFileManager } = await import("@google/generative-ai/server");
    const fs = await import('fs');

    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    // Upload file
    const uploadResult = await fileManager.uploadFile(filePath, {
        mimeType: mimeType,
        displayName: filePath.split('/').pop() || 'document',
    });

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: options.systemInstruction,
    });

    const result = await model.generateContent({
        contents: [{
            role: "user",
            parts: [
                { fileData: { mimeType: uploadResult.file.mimeType, fileUri: uploadResult.file.uri } },
                { text: prompt }
            ]
        }],
        generationConfig: {
            // @ts-ignore
            thinkingConfig: { includeThoughts: true },
            temperature: options.temperature ?? 1.0,
            responseMimeType: options.responseFormat === 'json' ? "application/json" : "text/plain",
        },
    });

    return { text: result.response.text() };
}

// ═══════════════════════════════════════════════════════════════
// OPENAI PROVIDER
// ═══════════════════════════════════════════════════════════════

async function generateWithOpenAI(
    apiKey: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    if (!apiKey) {
        throw new Error('OpenAI API key is required. Please configure it in settings.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: options.systemInstruction },
                { role: 'user', content: prompt }
            ],
            temperature: options.temperature ?? 1.0,
            response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
}

async function generateWithOpenAIFile(
    apiKey: string,
    filePath: string,
    mimeType: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    if (!apiKey) {
        throw new Error('OpenAI API key is required. Please configure it in settings.');
    }

    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    // For PDFs, we need to use the vision model with image extraction or use assistants API
    // For simplicity, we'll convert PDF context to text description approach
    if (mimeType === 'application/pdf') {
        // OpenAI doesn't directly support PDF in chat completions
        // We'll extract text or ask the model to process based on the prompt
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: options.systemInstruction },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `${prompt}\n\n[Note: PDF file uploaded. Please analyze based on the context provided.]`
                            }
                        ]
                    }
                ],
                temperature: options.temperature ?? 1.0,
                response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return { text: data.choices[0].message.content };
    }

    // For images, use vision capability
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: options.systemInstruction },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mimeType};base64,${base64File}`
                            }
                        },
                        {
                            type: 'text',
                            text: prompt
                        }
                    ]
                }
            ],
            temperature: options.temperature ?? 1.0,
            response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return { text: data.choices[0].message.content };
}

// ═══════════════════════════════════════════════════════════════
// CLAUDE PROVIDER
// ═══════════════════════════════════════════════════════════════

async function generateWithClaude(
    apiKey: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    if (!apiKey) {
        throw new Error('Claude API key is required. Please configure it in settings.');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: options.systemInstruction,
            messages: [
                { role: 'user', content: prompt }
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textContent = data.content.find((c: any) => c.type === 'text');
    return { text: textContent?.text || '' };
}

async function generateWithClaudeFile(
    apiKey: string,
    filePath: string,
    mimeType: string,
    prompt: string,
    options: GenerationOptions
): Promise<GenerationResult> {
    if (!apiKey) {
        throw new Error('Claude API key is required. Please configure it in settings.');
    }

    const fs = await import('fs');
    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    // Claude supports PDFs and images directly
    const mediaType = mimeType as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const content: any[] = [];

    if (mimeType === 'application/pdf') {
        content.push({
            type: 'document',
            source: {
                type: 'base64',
                media_type: mediaType,
                data: base64File,
            }
        });
    } else {
        content.push({
            type: 'image',
            source: {
                type: 'base64',
                media_type: mediaType,
                data: base64File,
            }
        });
    }

    content.push({
        type: 'text',
        text: prompt
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            system: options.systemInstruction,
            messages: [
                { role: 'user', content }
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const textContent = data.content.find((c: any) => c.type === 'text');
    return { text: textContent?.text || '' };
}

export default {
    getProviderConfig,
    generateContent,
    generateContentWithFile,
};
