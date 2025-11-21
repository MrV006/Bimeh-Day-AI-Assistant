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

const getClient = (userApiKey?: string) => {
  // If user has provided their own key, use it.
  if (userApiKey && userApiKey.trim() !== "") {
      return new GoogleGenAI({ apiKey: userApiKey.trim() });
  }

  // Fallback to the hardcoded (obfuscated) key
  // Original Key: AIzaSyCyOXy27ctu-0H9pxwwFe8BDou9dVuuc68
  const reversedKey = '86cuuVd9uoDB8eFwwxp9H0-utc72yXOyCySazIA';
  
  // Re-assemble the key at runtime
  const apiKey = reversedKey.split('').reverse().join('');
  
  if (!apiKey) {
    throw new Error("کلید API تنظیم نشده است.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateInsuranceResponse = async (
  history: Message[],
  currentQuery: string,
  knowledgeBase: KnowledgeSource[],
  userApiKey?: string,
  modelId: string = 'gemini-2.0-flash'
): Promise<string> => {
  try {
    const ai = getClient(userApiKey);
    
    // Explicitly filter for active sources only.
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
    
    const chat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      }
    });

    const recentHistory = history.slice(-10);
    
    let promptHistory = "";
    if (recentHistory.length > 0) {
      promptHistory = "تاریخچه مکالمه اخیر:\n" + recentHistory.map(m => `${m.role === Role.USER ? 'کاربر' : 'دستیار'}: ${m.text}`).join('\n') + "\n\n";
    }

    const finalPrompt = `${promptHistory}سوال کاربر: ${currentQuery}`;

    const response: GenerateContentResponse = await chat.sendMessage({
      message: finalPrompt
    });

    return response.text || "متاسفم، نمی‌توانم پاسخی تولید کنم.";

  } catch (error: any) {
    console.error("Gemini API Error Details:", error);

    let customMessage = "خطایی نامشخص در پردازش درخواست رخ داده است.";
    const msg = (error.message || "").toLowerCase();
    const errorName = (error.name || "").toLowerCase();

    // Explicitly catch fetch/network errors (common with VPNs)
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("failed to fetch") || errorName === "typeerror") {
      customMessage = "خطا در اتصال به اینترنت. لطفاً اتصال خود یا VPN را بررسی کنید.";
    } else if (msg.includes("api key") || msg.includes("400") || msg.includes("401") || msg.includes("403") || msg.includes("invalid_argument")) {
      throw new Error("API_KEY_INVALID");
    } else if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted") || msg.includes("too many requests")) {
      // Rate Limit Error
      throw new Error("RATE_LIMIT_EXCEEDED");
    } else if (msg.includes("503") || msg.includes("500") || msg.includes("overloaded")) {
      customMessage = "سرویس هوش مصنوعی موقتاً در دسترس نیست. لطفاً دقایقی دیگر تلاش کنید.";
    } else if (msg.includes("safety") || msg.includes("blocked")) {
      customMessage = "پاسخ مدل به دلایل ایمنی فیلتر شد.";
    } else if (msg.includes("404")) {
       // Treat 404 as a potential model unavailability or API key issue for that specific model
       throw new Error("MODEL_NOT_FOUND");
    }

    throw new Error(customMessage);
  }
};