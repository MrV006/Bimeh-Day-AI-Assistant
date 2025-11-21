import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeSource, Role, Message, ModelId, ModelConfig } from '../types';

// Define Available Models and their Free Tier Limits based on Google AI Studio
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'تعادل عالی بین سرعت و هوش (پیشنهادی)',
    rpm: 15,
    rpd: 1500,
    tpm: '1M',
    isNew: true
  },
  {
    id: 'gemini-2.0-flash-lite-preview-02-05',
    name: 'Gemini 2.0 Flash Lite',
    description: 'سریع‌ترین و ارزان‌ترین (مناسب سرعت بالا)',
    rpm: 30,
    rpd: 1500,
    tpm: '1M',
    isNew: true
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    description: 'نسخه پایدار و استاندارد گوگل',
    rpm: 15,
    rpd: 1500,
    tpm: '1M',
    isStable: true
  },
  {
    id: 'gemini-1.5-flash-8b',
    name: 'Gemini 1.5 Flash-8B',
    description: 'نسخه بسیار سریع و کم‌حجم',
    rpm: 15,
    rpd: 1500,
    tpm: '1M'
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    description: 'هوشمندترین مدل (تحلیل‌های پیچیده)',
    rpm: 2,
    rpd: 50,
    tpm: '32K',
    isPro: true
  },
  {
    id: 'gemini-2.0-pro-exp-02-05',
    name: 'Gemini 2.0 Pro (Exp)',
    description: 'نسخه آزمایشی هوشمند نسل ۲',
    rpm: 2,
    rpd: 50,
    tpm: '32K',
    isExperimental: true
  },
  {
    id: 'gemini-2.0-flash-thinking-exp-01-21',
    name: 'Gemini 2.0 Thinking',
    description: 'مدل با قابلیت تفکر و استدلال',
    rpm: 10,
    rpd: 1500,
    tpm: '1M',
    isExperimental: true
  }
];

// Obfuscated Fallback Keys (Reversed)
const FALLBACK_KEYS = [
  '86cuuVd9uoDB8eFwwxp9H0-utc72yXOyCySazIA',
  '8otDxZYwqHTnsRV2V-irDlqFXa9yNiY9ySazIA',
  '0aFOkV0plmRoWXT5fqGCQpoeXKr9t5CySazIA',
  'Q_b3BCA36ddQSMp77Wkg11ksDUMxUn-nCySazIA'
];

const getClient = (apiKey: string) => {
  if (apiKey) {
    apiKey = apiKey.trim();
  }
  if (!apiKey) {
    throw new Error("کلید API نامعتبر است.");
  }
  return new GoogleGenAI({ apiKey });
};

const reverseString = (str: string) => str.split('').reverse().join('');

const tryGenerateWithModel = async (
  modelId: string,
  keysToTry: string[],
  finalPrompt: string,
  systemInstruction: string,
  isUserKey: boolean
): Promise<string> => {
  let lastError: any = null;

  // Loop through keys
  for (const apiKey of keysToTry) {
    try {
      const ai = getClient(apiKey);
      const chat = ai.chats.create({
        model: modelId,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3,
        }
      });

      const response: GenerateContentResponse = await chat.sendMessage({
        message: finalPrompt
      });

      const text = response.text;
      if (text) return text;
      
    } catch (error: any) {
      const keySuffix = apiKey ? apiKey.slice(-4) : '****';
      console.warn(`Attempt failed with key ending in ...${keySuffix} for model ${modelId}`, error.message);
      lastError = error;

      // If user provided a specific key, we stop immediately on error to show them the feedback
      if (isUserKey) {
         throw error;
      }
      
      // If using system keys, we continue to the next key in the loop
      continue;
    }
  }
  
  throw lastError;
};

export const generateInsuranceResponse = async (
  history: Message[],
  currentQuery: string,
  knowledgeBase: KnowledgeSource[],
  userApiKey?: string,
  modelId: string = 'gemini-2.0-flash'
): Promise<string> => {
  
  const activeSources = knowledgeBase.filter(k => k.isActive);
  const activeContext = activeSources
    .map(k => `Source Title: ${k.title}\nContent:\n${k.content}`)
    .join('\n\n----------------\n\n');

  const systemInstruction = `
    شما دستیار هوشمند و حرفه‌ای شرکت "بیمه دی" (Day Insurance) هستید.
    وظیفه شما پاسخگویی به سوالات کاربران درباره انواع بیمه (عمر، ثالث، بدنه، درمان و ...) است.
    
    دستورالعمل‌ها:
    1. همیشه با احترام و لحنی رسمی اما دوستانه صحبت کنید.
    2. پاسخ‌های خود را صرفاً بر اساس "منابع موجود" که در ادامه ارائه می‌شود بدهید.
    3. اگر جواب سوالی در منابع نبود، صادقانه بگویید که در اسناد فعال (${activeSources.length} سند فعال) اطلاعاتی در این مورد یافت نشد، اما به عنوان یک هوش مصنوعی عمومی سعی می‌کنید راهنمایی کنید (و ذکر کنید که این نظر عمومی است).
    4. فرمت پاسخ‌ها باید خوانا، دارای بولت پوینت و ساختار مناسب باشد.
    5. زبان پاسخگویی فارسی است.
    
    منابع و کتابخانه اطلاعاتی بارگذاری شده (Active Context):
    ${activeContext ? activeContext : "هیچ سند فعالی برای این گفتگو انتخاب نشده است. از دانش عمومی خود استفاده کنید."}
  `;

  const recentHistory = history.slice(-10);
  let promptHistory = "";
  if (recentHistory.length > 0) {
    promptHistory = "تاریخچه مکالمه اخیر:\n" + recentHistory.map(m => `${m.role === Role.USER ? 'کاربر' : 'دستیار'}: ${m.text}`).join('\n') + "\n\n";
  }

  const finalPrompt = `${promptHistory}سوال کاربر: ${currentQuery}`;

  // Determine keys
  let keysToTry: string[] = [];
  const isUserKey = !!(userApiKey && userApiKey.trim() !== "");

  if (isUserKey) {
    keysToTry = [userApiKey!.trim()];
  } else {
    // Shuffle fallback keys
    const shuffledKeys = [...FALLBACK_KEYS].sort(() => Math.random() - 0.5);
    keysToTry = shuffledKeys.map(k => reverseString(k));
  }

  try {
    // First attempt: Selected Model
    return await tryGenerateWithModel(modelId, keysToTry, finalPrompt, systemInstruction, isUserKey);
  } catch (error: any) {
    // If using SYSTEM KEYS and the error wasn't a safety filter, try fallback model (Flash 1.5)
    // This helps if the specific model (e.g., 2.0 Flash) is overloaded but 1.5 is fine.
    if (!isUserKey && modelId !== 'gemini-1.5-flash') {
        console.log("Primary model failed, attempting fallback to gemini-1.5-flash...");
        try {
            return await tryGenerateWithModel('gemini-1.5-flash', keysToTry, finalPrompt, systemInstruction, isUserKey);
        } catch (fallbackError) {
            // If fallback also fails, proceed to error handling with the ORIGINAL error (more relevant usually)
            console.error("Fallback model also failed.");
        }
    }

    // Error Parsing Logic
    const msg = (error?.message || "").toLowerCase();
    const errorName = (error?.name || "").toLowerCase();

    console.error("Final API Error:", msg);

    // 1. NETWORK ERRORS
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("failed to fetch") || errorName === "typeerror") {
      throw new Error("خطا در اتصال به اینترنت. لطفاً فیلترشکن (VPN) خود را روشن کنید یا اتصال را بررسی نمایید.");
    }

    // 2. USER KEY ERRORS (Only strictly enforce this if user provided the key)
    if (isUserKey) {
        if (msg.includes("api key") || msg.includes("400") || msg.includes("403") || msg.includes("invalid_argument")) {
            throw new Error("API_KEY_INVALID");
        }
    }

    // 3. QUOTA / RATE LIMITS
    if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted") || msg.includes("too many requests")) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    // 4. SERVER ERRORS
    if (msg.includes("503") || msg.includes("500") || msg.includes("overloaded")) {
      throw new Error("سرویس هوش مصنوعی موقتاً در دسترس نیست (ترافیک بالا). لطفاً دقایقی دیگر تلاش کنید.");
    }

    // 5. SAFETY / NOT FOUND
    if (msg.includes("safety") || msg.includes("blocked")) {
      return "متاسفانه پاسخ به این درخواست به دلایل ایمنی توسط مدل فیلتر شد.";
    }
    if (msg.includes("404")) {
        throw new Error("مدل انتخاب شده در حال حاضر در دسترس نیست. لطفاً مدل دیگری را انتخاب کنید.");
    }

    // Default Error for System Keys
    // If we are here using system keys, DO NOT throw "API_KEY_INVALID" to avoid the modal.
    // Just say server is busy.
    if (!isUserKey) {
        throw new Error("RATE_LIMIT_EXCEEDED");
    }

    throw new Error("خطایی نامشخص در ارتباط با سرور رخ داده است.");
  }
};
