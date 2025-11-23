
import { GoogleGenAI } from "@google/genai";
import { KnowledgeSource, Role, Message, ModelId } from '../types';

// Hardcoded Default Key (Security ignored as per request)
const DEFAULT_API_KEY = 'AIzaSyD9YiNy9aXFqDlri-V2VRsnTHqwYZxDto8';

// Priority list of models to try automatically
const MODEL_PRIORITY_LIST: string[] = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

export const generateInsuranceResponse = async (
  history: Message[],
  currentMessage: string,
  sources: KnowledgeSource[],
  userApiKey: string | null
): Promise<string> => {
  
  // 1. Construct Context from Knowledge Base (RAG)
  const activeSources = sources.filter(s => s.isActive);
  let contextText = "";
  if (activeSources.length > 0) {
      contextText = "CONTEXT FROM KNOWLEDGE BASE (Use this to answer):\n" + 
                    activeSources.map(s => `--- ${s.title} ---\n${s.content}\n`).join("\n");
  }

  const systemInstruction = `
You are an expert insurance assistant for "Day Insurance" (Bimeh Day).
Your goal is to answer questions accurately based ONLY on the provided context if available.
If the answer is not in the context, use your general knowledge but mention that it might not be in the specific documents provided.
Always answer in Persian (Farsi).
Format your response using Markdown (bold, lists, etc.) for readability.
Be polite, professional, and concise.
Current Date: ${new Date().toLocaleDateString('fa-IR')}
  `;

  // 2. Prepare Contents for API
  const contents = [];
  
  for (const msg of history) {
      contents.push({
          role: msg.role === Role.USER ? 'user' : 'model',
          parts: [{ text: msg.text }]
      });
  }

  // Append the current user prompt with RAG context
  const finalPrompt = contextText 
    ? `${currentMessage}\n\n${contextText}` 
    : currentMessage;

  contents.push({
      role: 'user',
      parts: [{ text: finalPrompt }]
  });

  // 3. Select API Key (User's key takes priority, otherwise Default)
  const apiKey = userApiKey || DEFAULT_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  let lastError: any = null;

  // 4. Iterate through models to find one that works
  for (const model of MODEL_PRIORITY_LIST) {
      try {
          // console.log(`Attempting with model: ${model}`); // Debug
          const response = await ai.models.generateContent({
              model: model,
              contents: contents,
              config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.4,
                  // Remove maxOutputTokens to let the model decide or use default
              }
          });

          if (response.text) {
              return response.text;
          }
      } catch (error: any) {
          const msg = (error.message || JSON.stringify(error)).toLowerCase();
          lastError = error;

          // If the error is related to the API Key (Invalid/Permission), stop trying other models
          // because they will all fail with the same key.
          if (msg.includes("403") || msg.includes("api key") || msg.includes("invalid") || msg.includes("permission")) {
             throw new Error("API_KEY_INVALID");
          }

          // If it's a 429 (Rate Limit) or 503 (Overloaded), we continue to the next model loop.
          console.warn(`Model ${model} failed:`, msg);
      }
  }

  // 5. Handle Errors if all attempts failed
  if (lastError) {
      const msg = (lastError.message || JSON.stringify(lastError)).toLowerCase();
      
      if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")) {
          throw new Error("RATE_LIMIT_EXCEEDED");
      }
      
      // Pass other errors (network etc)
      throw lastError;
  }
  
  throw new Error("Unable to generate response. Please try again later.");
};

// Simplified export for UI display if needed, though selection is disabled
export const AVAILABLE_MODELS = []; 
