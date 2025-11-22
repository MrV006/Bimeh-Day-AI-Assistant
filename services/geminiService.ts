
import { GoogleGenAI } from "@google/genai";
import { KnowledgeSource, Role, Message, ModelId, ModelConfig } from '../types';

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'سریع‌ترین و جدیدترین مدل گوگل (پیشنهادی)',
    rpm: 15,
    rpd: 1500,
    tpm: '1M',
    isNew: true,
    isStable: true
  },
  {
    id: 'gemini-2.0-flash-lite-preview-02-05',
    name: 'Gemini 2.0 Flash Lite',
    description: 'نسخه سبک و فوق‌سریع',
    rpm: 30,
    rpd: 1500,
    tpm: '1M',
    isNew: true
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'پایدار و مقرون به صرفه',
    rpm: 15,
    rpd: 1500,
    tpm: '1M',
    isStable: true
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'هوشمندترین مدل (کندتر)',
    rpm: 2,
    rpd: 50,
    tpm: '32K',
    isPro: true
  }
];

// Hardcoded keys in plain text.
// We include both variations of the user key (last 4 chars FaA0 vs FAa0) to be sure.
const FALLBACK_KEYS = [
    'AIzaSyC5t9rKXeopGCQGqf5TxWoRmlp0VLOFaA0', // From your text prompt
    'AIzaSyC5t9rKXeopGCQGqf5TxWoRmlp0VLOFAa0'  // From your screenshot (Capital F)
];

export const generateInsuranceResponse = async (
  history: Message[],
  currentMessage: string,
  sources: KnowledgeSource[],
  userApiKey: string | null,
  modelId: ModelId
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

  // 3. Determine Keys to Try
  // If user provided a key, use that. Otherwise use our fallback list.
  let keysToTry = userApiKey ? [userApiKey] : FALLBACK_KEYS;
  
  let lastError: any = null;

  // 4. Iterate through keys (Failover)
  for (const apiKey of keysToTry) {
      try {
          const ai = new GoogleGenAI({ apiKey });
          
          const response = await ai.models.generateContent({
              model: modelId,
              contents: contents,
              config: {
                  systemInstruction: systemInstruction,
                  temperature: 0.4,
                  maxOutputTokens: 1500,
              }
          });

          if (response.text) {
              return response.text;
          }
          
      } catch (error: any) {
          console.warn(`API Call Failed with key ending in ...${apiKey.slice(-4)}`, error.message);
          lastError = error;
          
          // If user provided a custom key and it failed, we DO NOT fallback to system keys 
          // to respect their choice and show the error.
      }
  }

  // 5. Handle Errors if all attempts failed
  if (lastError) {
      const msg = (lastError.message || JSON.stringify(lastError)).toLowerCase();
      
      // Map Google API errors to our internal error codes
      if (msg.includes("403") || msg.includes("api key") || msg.includes("invalid")) {
          throw new Error("API_KEY_INVALID");
      }
      if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")) {
          throw new Error("RATE_LIMIT_EXCEEDED");
      }
      // Pass network errors through so App.tsx can show the network badge
      throw lastError;
  }
  
  throw new Error("Unable to generate response. Please try again.");
};
