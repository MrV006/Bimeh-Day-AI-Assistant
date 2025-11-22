
import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import { generateInsuranceResponse, AVAILABLE_MODELS } from './services/geminiService';
import { Message, KnowledgeSource, Role, ChatSession, ModelId, UsageStats, VisitorLog } from './types';
import { Menu, RefreshCw, Key, X, ExternalLink, CheckCircle, BarChart3, Users, MapPin, Wifi, Server, Globe2, Activity, Cpu, Info, Database, ShieldCheck, FileText, Bot, XCircle } from './components/Icons';

const APP_VERSION = 'v1.2.3';

const INITIAL_SOURCES: KnowledgeSource[] = [
  {
    id: '1',
    title: 'شرایط عمومی بیمه بدنه',
    content: `ماده ۱- تعاریف:
    ۱- بیمه گر: شرکت بیمه دی که مشخصات آن در این بیمه نامه درج شده است و در ازای دریافت حق بیمه، جبران خسارت احتمالی را طبق شرایط این بیمه نامه بر عهده می گیرد.
    ۲- بیمه گذار: شخص حقیقی یا حقوقی است که مالک موضوع بیمه است یا به یکی از عناوین قانونی، نمایندگی مالک یا ذینفع را داشته یا مسئولیت حفظ موضوع بیمه را از طرف مالک داشته باشد و قرارداد بیمه را با بیمه گر منعقد می کند و متعهد پرداخت حق بیمه می باشد.
    ۳- ذینفع: شخصی است که بنا به درخواست بیمه گذار نام وی در این بیمه نامه درج گردیده است و تمام یا بخشی از خسارت به وی پرداخت می شود.
    ۴- موضوع بیمه: وسیله نقلیه زمینی است که مشخصات آن در این بیمه نامه درج شده است. لوازمی که مطابق کاتالوگ وسیله نقلیه بیمه شده به خریدار تحویل و یا در بیمه نامه درج شده است نیز جزو موضوع بیمه محسوب می شود.
    
    ماده ۲- خطرات اصلی تحت پوشش:
    ۱- حادثه: خسارتی که ناشی از برخورد موضوع بیمه به یک جسم ثابت یا متحرک و یا برخورد اجسام دیگر به موضوع بیمه و یا واژگونی و سقوط موضوع بیمه باشد و یا چنانچه در حین حرکت، اجزا و یا محمولات موضوع بیمه به آن برخورد نماید و موجب خسارت شود.
    ۲- آتش سوزی، صاعقه، انفجار: خسارتی که در اثر آتش سوزی، صاعقه و یا انفجار به موضوع بیمه و یا لوازم یدکی اصلی همراه آن وارد گردد.
    ۳- سرقت کلی: در صورتی که موضوع بیمه دزدیده شود و یا در اثر عمل دزدی یا شروع به دزدی به وسیله نقلیه و یا وسایل اضافی آن که در بیمه نامه درج شده است خسارت وارد شود.`,
    type: 'text',
    isActive: true
  }
];

const STORAGE_KEYS = {
  MESSAGES: 'bimeh_day_messages',
  SOURCES: 'bimeh_day_sources',
  HISTORY: 'bimeh_day_chat_history',
  API_KEY: 'bimeh_day_user_api_key',
  MODEL: 'bimeh_day_selected_model',
  USAGE: 'bimeh_day_usage_stats',
  WELCOME_SEEN: 'bimeh_day_welcome_seen'
};

// Helper function to reverse string for simple obfuscation
const reverseString = (str: string) => str.split('').reverse().join('');

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse messages from local storage', e);
      return [];
    }
  });

  const [sources, setSources] = useState<KnowledgeSource[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SOURCES);
      return saved ? JSON.parse(saved) : INITIAL_SOURCES;
    } catch (e) {
      console.error('Failed to parse sources from local storage', e);
      return INITIAL_SOURCES;
    }
  });

  const [chatHistory, setChatHistory] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse history from local storage', e);
      return [];
    }
  });

  // Usage Stats for Rate Limit Tracking
  const [usageStats, setUsageStats] = useState<UsageStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USAGE);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // User API Key State
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.API_KEY);
    if (!saved) return '';
    if (saved.trim().startsWith('AIza')) {
      return saved.trim();
    }
    return reverseString(saved);
  });

  // Model State
  const [selectedModel, setSelectedModel] = useState<ModelId>(() => {
    return (localStorage.getItem(STORAGE_KEYS.MODEL) as ModelId) || 'gemini-2.0-flash';
  });

  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Update Detection State
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [appVersion, setAppVersion] = useState<number | null>(null);

  // Dashboard State
  const [showDashboard, setShowDashboard] = useState(false);
  const [userLocation, setUserLocation] = useState({ ip: '...', city: '...' });
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [activeUsersCount, setActiveUsersCount] = useState(1);

  // Welcome Modal State
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  
  // Help Modal State
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpTab, setHelpTab] = useState<'user' | 'tech'>('user');

  // Connection Status State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [ping, setPing] = useState<number | null>(null);

  // Sync tempApiKey when modal opens
  useEffect(() => {
    if (showApiKeyModal) {
      setTempApiKey(userApiKey);
    }
  }, [showApiKeyModal, userApiKey]);

  // Connection Check Logic
  useEffect(() => {
    const checkConnection = async () => {
      const start = Date.now();
      try {
        // Ping Google Favicon using no-cors mode to check network latency
        await fetch('https://www.google.com/favicon.ico', { 
          mode: 'no-cors', 
          cache: 'no-store',
        });
        const end = Date.now();
        setPing(end - start);
        setIsOnline(true);
      } catch (e) {
        // Fallback check if google fails (e.g. restricted network)
        if (navigator.onLine) {
           // If browser says online but fetch failed, might be CORS or Firewall, 
           // we assume online but high latency or blocked
           setPing(null);
           setIsOnline(true); 
        } else {
           setIsOnline(false);
           setPing(null);
        }
      }
    };

    // Initial Check
    checkConnection();
    
    // Periodic Check (every 15 seconds)
    const interval = setInterval(checkConnection, 15000);

    const handleOnline = () => { setIsOnline(true); checkConnection(); };
    const handleOffline = () => { setIsOnline(false); setPing(null); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist data
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages)); } catch(e){} }, [messages]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources)); } catch(e){} }, [sources]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(chatHistory)); } catch(e){} }, [chatHistory]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(usageStats)); } catch(e){} }, [usageStats]);
  
  useEffect(() => {
    try {
        if (userApiKey) {
        localStorage.setItem(STORAGE_KEYS.API_KEY, reverseString(userApiKey));
        } else {
        localStorage.removeItem(STORAGE_KEYS.API_KEY);
        }
    } catch(e){}
  }, [userApiKey]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.MODEL, selectedModel); } catch(e){}
  }, [selectedModel]);

  // Initial Welcome Modal Check
  useEffect(() => {
    try {
        const hasSeen = localStorage.getItem(STORAGE_KEYS.WELCOME_SEEN);
        if (!hasSeen) {
            setShowWelcomeModal(true);
        }
    } catch(e){}
  }, []);

  // Dashboard Data - REAL USER ONLY (No Fakes)
  useEffect(() => {
    // Fetch Real IP
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            setUserLocation({ ip: data.ip, city: `${data.city}, ${data.country_name}` });
            // Add self to logs
            const myLog: VisitorLog = {
                id: Date.now().toString(),
                ip: data.ip,
                location: `${data.city}, ${data.country_name}`,
                timestamp: new Date().toLocaleTimeString('fa-IR'),
                modelUsed: 'System Check',
                status: 'Success'
            };
            setVisitorLogs([myLog]);
        })
        .catch(() => setUserLocation({ ip: 'Unknown', city: 'Unknown' }));

    // Reset Daily Stats
    const resetInterval = setInterval(() => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() === 0) {
             setUsageStats({});
             setVisitorLogs([]);
        }
    }, 60000);

    return () => {
        clearInterval(resetInterval);
    };
  }, []);

  // Check for updates logic
  const checkForUpdates = useCallback(async () => {
      try {
        const res = await fetch(`./version.json?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        const latestTimestamp = data.timestamp;
        if (appVersion === null) {
          setAppVersion(latestTimestamp);
        } else if (latestTimestamp > appVersion) {
          setUpdateAvailable(true);
        }
      } catch (e) { /* ignore */ }
  }, [appVersion]);

  useEffect(() => {
    checkForUpdates(); // Check on mount
    
    // Check every 5 seconds
    const interval = setInterval(checkForUpdates, 5000);
    
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') checkForUpdates(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => { 
        clearInterval(interval); 
        document.removeEventListener('visibilitychange', handleVisibilityChange); 
    };
  }, [checkForUpdates]);

  const triggerUpdateCheck = () => {
      checkForUpdates();
  };

  const handleUpdateApp = () => window.location.reload();
  const toggleSidebar = () => {
      setIsSidebarOpen(!isSidebarOpen);
      triggerUpdateCheck();
  };

  const handleSaveApiKey = () => {
    const cleanedKey = tempApiKey.trim();
    
    // Case 1: New key entered
    if (cleanedKey && cleanedKey !== userApiKey) {
        setUserApiKey(cleanedKey);
        setShowApiKeyModal(false);
        setTempApiKey('');
        alert('کلید API با موفقیت بروزرسانی شد.');
        triggerUpdateCheck();
        return;
    }

    // Case 2: Key field cleared (intent to delete)
    if (!cleanedKey && userApiKey) {
        if (window.confirm('آیا مطمئن هستید که می‌خواهید کلید ذخیره شده را حذف کنید؟')) {
            setUserApiKey('');
            setTempApiKey('');
            setShowApiKeyModal(false);
            triggerUpdateCheck();
        }
        return;
    }

    // Case 3: No changes or closing with existing key
    setShowApiKeyModal(false);
  };

  const handleClearApiKey = () => {
    if (window.confirm('آیا می‌خواهید کلید شخصی خود را حذف کنید و از کلید پیش‌فرض استفاده کنید؟')) {
      setUserApiKey('');
      setTempApiKey('');
    }
  };

  const handleNewChat = () => {
    triggerUpdateCheck();
    if (messages.length > 0) {
      const firstUserMsg = messages.find(m => m.role === Role.USER);
      const title = firstUserMsg 
        ? (firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : ''))
        : `گفتگو ${new Date().toLocaleDateString('fa-IR')}`;
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: title,
        messages: messages,
        createdAt: Date.now()
      };
      setChatHistory(prev => [newSession, ...prev]);
      setMessages([]);
    }
  };
  const handleLoadChat = (session: ChatSession) => {
    triggerUpdateCheck();
    if (messages.length > 0) {
      if (window.confirm('گفتگوی فعلی ذخیره نشده است. آیا می‌خواهید آن را آرشیو کنید؟')) handleNewChat();
    }
    setMessages(session.messages);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };
  const handleDeleteChat = (sessionId: string) => {
      setChatHistory(prev => prev.filter(s => String(s.id) !== String(sessionId)));
      triggerUpdateCheck();
  }
  const handleClearHistory = () => {
    if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام تاریخچه گفتگوها را حذف کنید؟')) {
      setChatHistory([]);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }
    triggerUpdateCheck();
  };
  const handleClearCache = () => {
    if (window.confirm('آیا مطمئن هستید؟ تمامی تنظیمات، تاریخچه و منابع پاک خواهند شد.')) {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.SOURCES);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      localStorage.removeItem(STORAGE_KEYS.MODEL);
      localStorage.removeItem(STORAGE_KEYS.USAGE);
      localStorage.removeItem(STORAGE_KEYS.WELCOME_SEEN);
      setMessages([]);
      setSources(INITIAL_SOURCES);
      setChatHistory([]);
      setUsageStats({});
      setUserApiKey('');
      setSelectedModel('gemini-2.0-flash');
    }
  };

  const updateUsageStats = (modelId: string) => {
    const now = Date.now();
    setUsageStats(prev => {
      const stats = prev[modelId] || { minuteCount: 0, lastMinuteReset: now, dayCount: 0, lastDayReset: now };
      
      if (now - stats.lastMinuteReset > 60000) {
        stats.minuteCount = 0;
        stats.lastMinuteReset = now;
      }
      
      if (now - stats.lastDayReset > 86400000) {
        stats.dayCount = 0;
        stats.lastDayReset = now;
      }
      
      return {
        ...prev,
        [modelId]: {
          ...stats,
          minuteCount: stats.minuteCount + 1,
          dayCount: stats.dayCount + 1
        }
      };
    });
  };

  const handleSendMessage = async (text: string, specificModelId?: ModelId, isRetry: boolean = false) => {
    triggerUpdateCheck();
    const modelToUse = specificModelId || selectedModel;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: text,
      timestamp: Date.now()
    };
    
    // Only add user message if it's not a retry. 
    if (!isRetry && !specificModelId) {
        setMessages(prev => [...prev, userMsg]);
    }
    
    setIsLoading(true);
    updateUsageStats(modelToUse);

    try {
      // Filter messages: exclude errors.
      const historyContext = messages.filter(m => !m.isError);

      const responseText = await generateInsuranceResponse(
        historyContext,
        text,
        sources,
        userApiKey, 
        modelToUse
      );

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
      
      if (specificModelId && specificModelId !== selectedModel) {
          setSelectedModel(specificModelId);
      }

    } catch (error: any) {
      if (error.message === "API_KEY_INVALID") {
        setShowApiKeyModal(true);
        const errorMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: Role.MODEL,
            text: "خطای دسترسی به هوش مصنوعی. لطفاً کلید API خود را بررسی یا وارد کنید. (پنجره تنظیمات باز شد)",
            timestamp: Date.now(),
            isError: true
        };
        setMessages(prev => [...prev, errorMsg]);
      } else if (error.message === "RATE_LIMIT_EXCEEDED") {
        const currentStats = usageStats[modelToUse];
        const modelConfig = AVAILABLE_MODELS.find(m => m.id === modelToUse);
        let rateLimitMsg = "به سقف مجاز استفاده از این مدل رسیدید.";

        if (currentStats && modelConfig) {
           if (currentStats.minuteCount >= modelConfig.rpm) {
             rateLimitMsg = `شما بیش از ${modelConfig.rpm} پیام در دقیقه با مدل ${modelConfig.name} فرستادید.`;
           } else if (currentStats.dayCount >= modelConfig.rpd) {
             rateLimitMsg = `سقف استفاده روزانه (${modelConfig.rpd} پیام) برای مدل ${modelConfig.name} پر شده است.`;
           }
        }

        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.MODEL,
          text: rateLimitMsg,
          timestamp: Date.now(),
          isError: true
        };
        setMessages(prev => [...prev, errorMsg]);

      } else if (error.message.includes("Network Error") || error.message.includes("fetch") || error.message.includes("Failed to fetch")) {
         const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.MODEL,
          text: "خطا در اتصال به شبکه. لطفاً اتصال اینترنت و فیلترشکن (VPN) خود را روشن کنید. (برای استفاده از این سرویس، VPN باید حتما روشن باشد)",
          timestamp: Date.now(),
          isError: true
        };
        setMessages(prev => [...prev, errorMsg]);
      } else {
        const errorMessage = error.message || "متاسفانه خطایی در ارتباط با سرویس رخ داده است.";
        const errorMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: Role.MODEL,
            text: errorMessage,
            timestamp: Date.now(),
            isError: true
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Retry Logic ---

  const handleRetry = () => {
    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === Role.USER) {
        lastUserMessageIndex = i;
        break;
      }
    }
    
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex];
    
    setMessages(prev => prev.slice(0, lastUserMessageIndex + 1)); // Keep the user message
    handleSendMessage(lastUserMessage.text, undefined, true);
  };

  const handleAutoSwitchModel = async () => {
    triggerUpdateCheck();
    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === Role.USER) {
        lastUserMessageIndex = i;
        break;
      }
    }
    if (lastUserMessageIndex === -1) return;
    const lastUserText = messages[lastUserMessageIndex].text;

    setMessages(prev => prev.slice(0, lastUserMessageIndex + 1));
    setIsLoading(true);

    const candidateModels = AVAILABLE_MODELS.filter(m => m.id !== selectedModel).map(m => m.id);
    let success = false;
    let lastErrorMsg = "";

    for (const modelId of candidateModels) {
        try {
            const responseText = await generateInsuranceResponse(
                messages.filter(m => !m.isError && m.role !== Role.MODEL),
                lastUserText,
                sources,
                userApiKey,
                modelId
            );
            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: Role.MODEL,
                text: responseText,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);
            setSelectedModel(modelId);
            success = true;
            break;
        } catch (err: any) {
            console.warn(`Auto-switch failed for ${modelId}`, err);
            lastErrorMsg = err.message || "";
        }
    }

    setIsLoading(false);

    if (!success) {
        // Check if it was a network error
        let errorText = "متاسفانه تمامی مدل‌های هوش مصنوعی در حال حاضر مشغول یا محدود شده‌اند. لطفاً دقایقی دیگر تلاش کنید یا یک کلید API جدید وارد نمایید.";
        
        if (lastErrorMsg.includes("fetch") || lastErrorMsg.includes("Network") || lastErrorMsg.includes("Failed to fetch")) {
             errorText = "خطا در اتصال به شبکه. لطفاً اتصال اینترنت و فیلترشکن (VPN) خود را روشن کنید. تمام مدل‌ها غیرقابل دسترس هستند.";
        }

        const errorMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: Role.MODEL,
            text: errorText,
            timestamp: Date.now(),
            isError: true
        };
        setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleAcceptWelcome = () => {
      try {
        localStorage.setItem(STORAGE_KEYS.WELCOME_SEEN, 'true');
        setShowWelcomeModal(false);
      } catch(e) {}
  };

  const handleOpenHelpFromWelcome = () => {
    handleAcceptWelcome();
    setShowHelpModal(true);
    setHelpTab('user');
  };

  // ... Other handlers ...
  const handleToggleBookmark = (id: string) => setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, isBookmarked: !msg.isBookmarked } : msg));
  const handleUpdateBookmarkNote = (id: string, note: string) => setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, bookmarkNote: note } : msg));
  const handleAddSource = (source: KnowledgeSource) => setSources(prev => [source, ...prev]);
  const handleToggleSource = (id: string) => setSources(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  const handleDeleteSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));

  return (
    <div className="flex h-full w-full bg-day-bg relative font-sans overflow-hidden">
      
      {/* Welcome Modal */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
           <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border-4 border-day-teal/20">
              <div className="bg-day-teal p-6 text-center">
                 <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Server size={32} className="text-day-teal" />
                 </div>
                 <h2 className="text-xl font-black text-white mb-1">دستیار هوشمند بیمه دی</h2>
                 <span className="text-xs font-bold bg-white/20 text-white px-3 py-1 rounded-full tracking-wider">نسخه آزمایشی / Pilot Version</span>
              </div>
              <div className="p-8 text-center space-y-6">
                 <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 text-lg">مدیر گرامی، خوش آمدید</h3>
                    <p className="text-gray-600 text-sm leading-7 text-justify">
                       این نرم‌افزار جهت نمایش قابلیت‌های فنی هوش مصنوعی در تحلیل اسناد بیمه‌ای طراحی شده است. جهت عملکرد صحیح سرویس‌ها، لطفاً به نکات زیر توجه فرمایید:
                    </p>
                 </div>

                 <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-right">
                     <Wifi className="text-red-500 shrink-0 mt-1" size={20} />
                     <div className="flex flex-col gap-1">
                        <span className="font-bold text-red-600 text-sm">اتصال VPN الزامی است</span>
                        <span className="text-xs text-gray-600">به دلیل تحریم‌های گوگل، برای ارسال درخواست‌ها حتماً فیلترشکن (VPN) گوشی یا سیستم خود را روشن نگه دارید.</span>
                     </div>
                 </div>

                 <div className="border-t border-gray-100 pt-4 flex justify-between items-center text-xs text-gray-400">
                     <span>طراحی و توسعه:</span>
                     <div className="flex items-center gap-1 font-bold text-day-teal">
                        <span>Mr.V</span>
                        <CheckCircle size={12} />
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                     <button 
                        onClick={handleOpenHelpFromWelcome}
                        className="bg-white border-2 border-day-teal text-day-teal py-4 rounded-xl font-bold transition-all hover:bg-day-teal hover:text-white active:scale-95"
                     >
                        مشاهده راهنما
                     </button>
                     <button 
                        onClick={handleAcceptWelcome}
                        className="bg-day-dark hover:bg-black text-white py-4 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
                     >
                        متوجه شدم، ورود
                     </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Help & Documentation Modal */}
      {showHelpModal && (
          <div className="fixed inset-0 z-[65] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-white w-full max-w-3xl h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Info className="text-day-teal" />
                          <h2 className="font-bold text-gray-800">راهنما و مستندات</h2>
                      </div>
                      <button onClick={() => setShowHelpModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                          <X size={20} />
                      </button>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-4 gap-4">
                      <button 
                          onClick={() => setHelpTab('user')}
                          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${helpTab === 'user' ? 'border-day-teal text-day-teal' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                          راهنمای کاربر
                      </button>
                      <button 
                          onClick={() => setHelpTab('tech')}
                          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${helpTab === 'tech' ? 'border-day-accent text-day-accent' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                          مستندات فنی (Developers)
                      </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/30">
                      {helpTab === 'user' ? (
                          <div className="space-y-6 text-right">
                              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                  <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Bot size={18}/> درباره دستیار</h3>
                                  <p className="text-sm text-blue-700 leading-7">
                                      این سامانه یک دستیار هوشمند تحلیلگر است که به شما کمک می‌کند سوالات پیچیده بیمه‌ای را با استناد به اسناد و بخشنامه‌ها پاسخ دهید.
                                  </p>
                              </div>

                              <div className="space-y-4">
                                  <div className="flex gap-3">
                                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 font-bold text-gray-500">1</div>
                                      <div>
                                          <h4 className="font-bold text-gray-800 mb-1">افزودن منابع (Sources)</h4>
                                          <p className="text-sm text-gray-600 leading-6">
                                              در تب <b>منابع</b>، می‌توانید فایل‌های PDF، Word یا لینک وبسایت را وارد کنید. هوش مصنوعی پاسخ‌های خود را <span className="text-day-teal font-bold">فقط بر اساس این اسناد</span> تولید می‌کند.
                                          </p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex gap-3">
                                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center shrink-0 font-bold text-gray-500">2</div>
                                      <div>
                                          <h4 className="font-bold text-gray-800 mb-1">فعال/غیرفعال کردن اسناد</h4>
                                          <p className="text-sm text-gray-600 leading-6">
                                              با استفاده از دکمه "وضعیت" روی هر سند، می‌توانید آن را موقتاً از پردازش خارج کنید. اسناد جدید به صورت خودکار فعال می‌شوند.
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-6 text-left dir-ltr">
                              <div className="bg-gray-900 text-gray-300 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                                  <p className="mb-2 text-green-400">// Project Architecture: Client-Side RAG</p>
                                  <p>Frontend: React 18 + TypeScript + Vite</p>
                                  <p>Styling: Tailwind CSS (JIT)</p>
                                  <p>AI Model: Google Gemini 2.0 Flash / 1.5 Pro</p>
                                  <p>Storage: LocalStorage (Obfuscated)</p>
                              </div>

                              <div>
                                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Database size={16}/> Retrieval-Augmented Generation (RAG)</h3>
                                  <p className="text-sm text-gray-600 leading-6 text-justify">
                                      This application implements a client-side RAG pattern. Documents (PDF/Docx) are parsed in the browser using `pdfjs-dist` and `mammoth`. The extracted text is injected into the LLM's context window dynamically based on user selection (`activeSources`).
                                  </p>
                              </div>

                              <div>
                                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><ShieldCheck size={16}/> Security & Key Management</h3>
                                  <p className="text-sm text-gray-600 leading-6 text-justify">
                                      User API keys are never sent to any backend server. They are stored in the browser's `localStorage` using a reversible obfuscation technique to prevent plain-text scraping. The application uses a randomized load-balancing strategy with fallback keys to ensure high availability.
                                  </p>
                              </div>

                              <div>
                                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Globe2 size={16}/> Web Scraping Proxy</h3>
                                  <p className="text-sm text-gray-600 leading-6 text-justify">
                                      Due to CORS policies, website fetching relies on the `allorigins` proxy API. The HTML is sanitized (removing scripts/styles) before being added to the knowledge base.
                                  </p>
                              </div>
                          </div>
                      )}
                  </div>
                  
                  <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center">
                       <span className="text-xs text-gray-400 font-mono">{APP_VERSION}</span>
                       <button onClick={() => setShowHelpModal(false)} className="px-4 py-2 bg-day-teal text-white rounded-lg text-sm font-bold">بستن</button>
                  </div>
              </div>
          </div>
      )}

      {/* System Dashboard Modal */}
      {showDashboard && (
         <div className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
             <div className="bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                 <div className="bg-gray-50 p-5 border-b border-gray-200 flex justify-between items-center sticky top-0">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                          <Activity size={24} />
                       </div>
                       <div>
                          <h3 className="font-bold text-gray-800 text-lg">داشبورد وضعیت سیستم</h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                             <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                             {isOnline ? 'سیستم آنلاین' : 'سیستم آفلاین'} • Ping: {ping ? `${ping}ms` : 'N/A'}
                          </p>
                       </div>
                    </div>
                    <button onClick={() => setShowDashboard(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-100/50">
                     {/* Stats Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                             <div className="flex justify-between items-start mb-4">
                                 <div>
                                     <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">کاربران آنلاین</span>
                                     <h4 className="text-2xl font-black text-gray-800 mt-1">{activeUsersCount}</h4>
                                 </div>
                                 <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Users size={20} /></div>
                             </div>
                             <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                 <div className="h-full bg-green-500 rounded-full transition-all duration-1000" style={{ width: '100%' }}></div>
                             </div>
                         </div>

                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                             <div className="flex justify-between items-start mb-4">
                                 <div>
                                     <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">موقعیت شما</span>
                                     <h4 className="text-sm font-bold text-gray-800 mt-2 line-clamp-1" dir="ltr">{userLocation.city}</h4>
                                     <span className="text-[10px] text-gray-400 block mt-0.5" dir="ltr">{userLocation.ip}</span>
                                 </div>
                                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><MapPin size={20} /></div>
                             </div>
                         </div>

                         <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
                             <div className="flex justify-between items-start mb-4">
                                 <div>
                                     <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">مدل فعال</span>
                                     <h4 className="text-sm font-bold text-day-teal mt-2">{AVAILABLE_MODELS.find(m=>m.id===selectedModel)?.name}</h4>
                                 </div>
                                 <div className="p-2 bg-cyan-50 text-day-teal rounded-lg"><Cpu size={20} /></div>
                             </div>
                         </div>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                         {/* API Usage */}
                         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                             <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
                                 <BarChart3 size={18} />
                                 میزان مصرف منابع (امروز)
                             </h4>
                             <div className="space-y-4">
                                 {AVAILABLE_MODELS.slice(0, 4).map(model => {
                                     const stats = usageStats[model.id] || { dayCount: 0 };
                                     const percent = Math.min((stats.dayCount / model.rpd) * 100, 100);
                                     return (
                                         <div key={model.id}>
                                             <div className="flex justify-between text-xs mb-1.5">
                                                 <span className="font-medium text-gray-600">{model.name}</span>
                                                 <span className="text-gray-400">{stats.dayCount} / {model.rpd}</span>
                                             </div>
                                             <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                 <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${percent > 90 ? 'bg-red-500' : percent > 50 ? 'bg-amber-400' : 'bg-day-teal'}`} 
                                                    style={{ width: `${percent}%` }}
                                                 ></div>
                                             </div>
                                         </div>
                                     );
                                 })}
                             </div>
                             <p className="text-[10px] text-gray-400 mt-4 text-center">آمار مصرف به صورت روزانه (ساعت ۰۰:۰۰) ریست می‌شود.</p>
                         </div>

                         {/* Visitor Logs */}
                         <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col">
                             <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
                                 <Globe2 size={18} />
                                 آخرین فعالیت‌ها
                             </h4>
                             <div className="overflow-y-auto max-h-[200px] custom-scrollbar pr-1">
                                 <table className="w-full text-right">
                                     <thead className="text-[10px] text-gray-400 border-b border-gray-100 sticky top-0 bg-white">
                                         <tr>
                                             <th className="pb-2 font-medium">IP / موقعیت</th>
                                             <th className="pb-2 font-medium">زمان</th>
                                             <th className="pb-2 font-medium">وضعیت</th>
                                         </tr>
                                     </thead>
                                     <tbody className="text-xs">
                                         {visitorLogs.map((log) => (
                                             <tr key={log.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                                                 <td className="py-2.5">
                                                     <div className="flex flex-col">
                                                         <span className="font-bold text-gray-700 line-clamp-1">{log.location}</span>
                                                         <span className="text-[9px] text-gray-400 opacity-70" dir="ltr">{log.ip.replace(/\d+$/, '***')}</span>
                                                     </div>
                                                 </td>
                                                 <td className="py-2.5 text-gray-500">{log.timestamp}</td>
                                                 <td className="py-2.5">
                                                     <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                         log.status === 'Success' ? 'bg-green-50 text-green-600' : 
                                                         log.status === 'Rate Limited' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'
                                                     }`}>
                                                         {log.status}
                                                     </span>
                                                 </td>
                                             </tr>
                                         ))}
                                         {visitorLogs.length === 0 && (
                                             <tr><td colSpan={3} className="text-center py-4 text-gray-400 text-xs">داده‌ای یافت نشد</td></tr>
                                         )}
                                     </tbody>
                                 </table>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
         </div>
      )}
      
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-day-dark p-4 flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2 text-white">
                    <Key size={20} />
                    <h3 className="font-bold">تنظیم کلید هوش مصنوعی</h3>
                </div>
                <button onClick={() => setShowApiKeyModal(false)} className="text-white/70 hover:text-white">
                    <X size={20} />
                </button>
            </div>
            
            <div className="p-6">
                <p className="text-sm text-gray-600 leading-relaxed mb-4 text-justify">
                    به نظر می‌رسد کلید پیش‌فرض برنامه به سقف مجاز رسیده یا منقضی شده است. برای استفاده پایدار و رایگان، لطفاً کلید اختصاصی خود را وارد کنید.
                </p>

                <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 mb-6 flex items-start gap-3">
                    <div className="bg-white p-1.5 rounded-lg text-day-teal shrink-0 shadow-sm">
                         <CheckCircle size={20} />
                    </div>
                    <div className="flex flex-col gap-1">
                         <span className="text-xs font-bold text-day-dark">کاملاً رایگان و امن</span>
                         <span className="text-[10px] text-gray-500">کلید شما فقط در مرورگر خودتان ذخیره می‌شود.</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-700 mb-2">کلید API شما:</label>
                        <div className="relative">
                            <input 
                                type="password" 
                                placeholder="AIzaSy..." 
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
                                className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-day-teal focus:ring-2 focus:ring-cyan-100 outline-none dir-ltr text-left"
                            />
                            {tempApiKey && (
                                <button 
                                    onClick={() => setTempApiKey('')}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="پاک کردن"
                                >
                                    <XCircle size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleSaveApiKey}
                        className="w-full bg-day-teal hover:bg-day-dark text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-cyan-100"
                    >
                        {!tempApiKey && userApiKey ? 'حذف کلید و استفاده از پیش‌فرض' : (userApiKey && tempApiKey === userApiKey ? 'بستن و استفاده از کلید فعلی' : 'ذخیره و اتصال')}
                    </button>

                    <div className="border-t border-gray-100 my-4"></div>

                    {/* Step by Step Guide */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-xs text-gray-600">
                        <p className="font-bold text-day-dark mb-2 flex items-center gap-1">
                             <ExternalLink size={12} />
                             راهنمای دریافت رایگان کلید:
                        </p>
                        <ol className="list-decimal list-inside space-y-2 marker:text-day-teal marker:font-bold">
                            <li>
                                <span>فیلترشکن (VPN) خود را روشن کنید.</span>
                            </li>
                            <li>
                                وارد سایت <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-day-teal underline font-bold hover:text-day-dark">Google AI Studio</a> شوید.
                            </li>
                            <li>
                                روی دکمه آبی <span className="font-bold bg-blue-100 text-blue-700 px-1 rounded">Create API Key</span> کلیک کنید.
                            </li>
                            <li>
                                گزینه <b>Create API key in new project</b> را بزنید.
                            </li>
                            <li>
                                کد تولید شده (شروع با AIza) را کپی و در کادر بالا وارد کنید.
                            </li>
                        </ol>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Notification Toast */}
      {updateAvailable && (
        <div 
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-day-dark/95 backdrop-blur text-white px-5 py-3 rounded-2xl shadow-2xl shadow-cyan-900/20 flex items-center gap-4 animate-bounce-in cursor-pointer hover:bg-black transition-all border border-white/10 group"
            onClick={handleUpdateApp}
        >
            <div className="flex flex-col items-start">
                <span className="text-sm font-bold">نسخه جدید موجود است</span>
                <span className="text-[10px] opacity-80 font-light group-hover:underline">برای بروزرسانی کلیک کنید</span>
            </div>
            <div className="bg-white/10 p-2 rounded-xl group-hover:bg-day-teal group-hover:text-white transition-colors">
                <RefreshCw size={20} className="animate-spin" style={{ animationDuration: '3s' }} />
            </div>
        </div>
      )}

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-40 shadow-sm justify-between">
        <div className="flex items-center gap-2">
             <button onClick={toggleSidebar} className="text-gray-600 hover:text-day-teal transition-colors p-2">
                <Menu size={24} />
             </button>
             <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowApiKeyModal(true)} 
                    className={`p-2 rounded-lg transition-colors ${userApiKey ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}
                >
                    <Key size={20} />
                </button>
                {/* Mobile Status Indicator */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${isOnline ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    <Wifi size={14} />
                    {ping && <span>{ping}ms</span>}
                </div>
             </div>
        </div>
        <span className="font-black text-lg text-day-teal tracking-tight">بیمه دی</span>
      </div>

      {/* Desktop/Tablet API Key Button - HIDDEN now as it's in sidebar */}
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
        sources={sources}
        chatHistory={chatHistory}
        selectedModel={selectedModel}
        appVersion={APP_VERSION}
        onSelectModel={setSelectedModel}
        onAddSource={handleAddSource}
        onToggleSource={handleToggleSource}
        onDeleteSource={handleDeleteSource}
        onNewChat={handleNewChat}
        onLoadChat={handleLoadChat}
        onDeleteChat={handleDeleteChat}
        onClearHistory={handleClearHistory}
        onClearCache={handleClearCache}
        onOpenSettings={() => setShowApiKeyModal(true)}
        onOpenDashboard={() => setShowDashboard(true)}
        onOpenHelp={() => setShowHelpModal(true)}
        isOnline={isOnline}
        ping={ping}
      />
      
      <main className="flex-1 flex flex-col h-full pt-14 md:pt-0 overflow-hidden relative">
        <ChatArea 
          messages={messages} 
          isLoading={isLoading} 
          selectedModel={selectedModel}
          onQuickPrompt={handleSendMessage}
          onToggleBookmark={handleToggleBookmark}
          onUpdateBookmarkNote={handleUpdateBookmarkNote}
          onRetry={handleRetry}
          onSwitchModelRetry={handleAutoSwitchModel}
          onOpenSettings={() => setShowApiKeyModal(true)}
        />
        <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default App;
