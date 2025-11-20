import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { KnowledgeSource, Role, Message } from '../types';

const getClient = () => {
  // Hardcoded API Key for Demo Deployment
  const apiKey = 'AIzaSyD9YiNy9aXFqDlri-V2VRsnTHqwYZxDto8';
  
  if (!apiKey) {
    throw new Error("کلید API یافت نشد.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateInsuranceResponse = async (
  history: Message[],
  currentQuery: string,
  knowledgeBase: KnowledgeSource[]
): Promise<string> => {
  try {
    const ai = getClient();
    const modelId = 'gemini-2.5-flash';

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

    if (msg.includes("api key") || msg.includes("401") || msg.includes("403")) {
      customMessage = "خطای دسترسی: کلید API نامعتبر است یا دسترسی لازم را ندارد.";
    } else if (msg.includes("429") || msg.includes("quota") || msg.includes("exhausted")) {
      customMessage = "تعداد درخواست‌ها بیش از حد مجاز است (Rate Limit). لطفاً چند لحظه صبر کنید و دوباره تلاش کنید.";
    } else if (msg.includes("503") || msg.includes("500") || msg.includes("overloaded") || msg.includes("internal error")) {
      customMessage = "سرویس هوش مصنوعی در حال حاضر شلوغ است یا در دسترس نیست. لطفاً دقایقی دیگر تلاش کنید.";
    } else if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("connection") || msg.includes("xhr error") || msg.includes("rpc failed")) {
      customMessage = "خطا در اتصال به اینترنت یا فایروال. لطفاً ارتباط شبکه یا فیلترشکن خود را بررسی کنید.";
    } else if (msg.includes("safety") || msg.includes("blocked")) {
      customMessage = "پاسخ مدل به دلایل ایمنی یا محتوایی فیلتر شد.";
    } else if (msg.includes("found") && msg.includes("404")) {
      customMessage = "مدل مورد نظر یافت نشد یا آدرس درخواست اشتباه است.";
    }

    throw new Error(customMessage);
  }
};