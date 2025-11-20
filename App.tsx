import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import { generateInsuranceResponse, AVAILABLE_MODELS } from './services/geminiService';
import { Message, KnowledgeSource, Role, Task, ChatSession, ModelId, UsageStats } from './types';
import { Menu, RefreshCw, Key, X, ExternalLink, CheckCircle } from './components/Icons';

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
  TASKS: 'bimeh_day_tasks',
  HISTORY: 'bimeh_day_chat_history',
  API_KEY: 'bimeh_day_user_api_key',
  MODEL: 'bimeh_day_selected_model',
  USAGE: 'bimeh_day_usage_stats'
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

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse tasks from local storage', e);
      return [];
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
    
    // Robust Migration Check:
    // If the stored key starts with 'AIza', it is in the old plain-text format.
    // We return it as is. The useEffect hook will detect this plain text value in state,
    // and immediately re-save it to localStorage in the new reversed format.
    // This ensures seamless migration without user intervention.
    if (saved.trim().startsWith('AIza')) {
      return saved.trim();
    }

    // Otherwise, assume it is stored in reverse (obfuscated), so we reverse it back to normal
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

  // Persist data
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources)); }, [sources]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(chatHistory)); }, [chatHistory]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.USAGE, JSON.stringify(usageStats)); }, [usageStats]);
  
  // Persist API Key (Obfuscated)
  useEffect(() => {
    if (userApiKey) {
      // Store in reverse to prevent plain-text scraping from local storage
      localStorage.setItem(STORAGE_KEYS.API_KEY, reverseString(userApiKey));
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }
  }, [userApiKey]);

  // Persist Model
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MODEL, selectedModel);
  }, [selectedModel]);

  // Check for updates logic
  useEffect(() => {
    const checkVersion = async () => {
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
    };
    checkVersion();
    const interval = setInterval(checkVersion, 60 * 1000);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibilityChange); };
  }, [appVersion]);

  const handleUpdateApp = () => window.location.reload();
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleSaveApiKey = () => {
    const cleanedKey = tempApiKey.trim();
    if (cleanedKey) {
        setUserApiKey(cleanedKey);
        setShowApiKeyModal(false);
        setTempApiKey('');
        alert('کلید API با موفقیت ذخیره شد. لطفاً مجدداً پیام خود را ارسال کنید.');
    }
  };

  const handleClearApiKey = () => {
    if (window.confirm('آیا می‌خواهید کلید شخصی خود را حذف کنید و از کلید پیش‌فرض استفاده کنید؟')) {
      setUserApiKey('');
      setTempApiKey('');
    }
  };

  // --- Chat & History Logic (Same as before) ---
  const handleNewChat = () => {
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
    if (messages.length > 0) {
      if (window.confirm('گفتگوی فعلی ذخیره نشده است. آیا می‌خواهید آن را آرشیو کنید؟')) handleNewChat();
    }
    setMessages(session.messages);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };
  const handleDeleteChat = (sessionId: string) => setChatHistory(prev => prev.filter(s => String(s.id) !== String(sessionId)));
  const handleClearHistory = () => {
    if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام تاریخچه گفتگوها را حذف کنید؟')) {
      setChatHistory([]);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }
  };
  const handleClearCache = () => {
    if (window.confirm('آیا مطمئن هستید؟ تمامی تنظیمات، تاریخچه و منابع پاک خواهند شد.')) {
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.SOURCES);
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
      localStorage.removeItem(STORAGE_KEYS.MODEL);
      localStorage.removeItem(STORAGE_KEYS.USAGE);
      setMessages([]);
      setSources(INITIAL_SOURCES);
      setTasks([]);
      setChatHistory([]);
      setUsageStats({});
      setUserApiKey('');
      setSelectedModel('gemini-2.0-flash');
    }
  };

  // --- Usage Tracking Helper ---
  const updateUsageStats = (modelId: string) => {
    const now = Date.now();
    setUsageStats(prev => {
      const stats = prev[modelId] || { minuteCount: 0, lastMinuteReset: now, dayCount: 0, lastDayReset: now };
      
      // Reset Minute Count if 60s passed
      if (now - stats.lastMinuteReset > 60000) {
        stats.minuteCount = 0;
        stats.lastMinuteReset = now;
      }
      
      // Reset Day Count if 24h passed
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

  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: text,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // Track usage before sending (optimistic)
    updateUsageStats(selectedModel);

    try {
      const responseText = await generateInsuranceResponse(
        [...messages, userMsg],
        text,
        sources,
        userApiKey, // Pass the user API key
        selectedModel // Pass selected model
      );

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      // Check for the specific flag thrown by the service
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
        // Handle Rate Limit specifically based on usage tracking
        const currentStats = usageStats[selectedModel];
        const modelConfig = AVAILABLE_MODELS.find(m => m.id === selectedModel);
        let rateLimitMsg = "به سقف مجاز استفاده از این مدل رسیدید.";

        if (currentStats && modelConfig) {
           if (currentStats.minuteCount >= modelConfig.rpm) {
             rateLimitMsg = `شما بیش از ${modelConfig.rpm} پیام در دقیقه با مدل ${modelConfig.name} فرستادید. لطفاً ۱ دقیقه صبر کنید یا از مدل "Flash Lite" استفاده کنید.`;
           } else if (currentStats.dayCount >= modelConfig.rpd) {
             rateLimitMsg = `سقف استفاده روزانه (${modelConfig.rpd} پیام) برای مدل ${modelConfig.name} پر شده است. لطفاً مدل دیگری انتخاب کنید.`;
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
    // Find last user message
    // Polyfill for findLastIndex to support older environments
    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === Role.USER) {
        lastUserMessageIndex = i;
        break;
      }
    }
    
    if (lastUserMessageIndex === -1) return;

    const lastUserMessage = messages[lastUserMessageIndex];
    
    // Remove the error message (usually the last one) and any messages after the last user message
    setMessages(prev => prev.slice(0, lastUserMessageIndex));
    
    // Resend
    handleSendMessage(lastUserMessage.text);
  };

  const handleSwitchModelAndRetry = () => {
    // Smart switching: If on Pro/Standard, switch to Lite for speed/limits. If on Lite, switch to Standard.
    if (selectedModel === 'gemini-2.0-flash-lite-preview-02-05') {
        setSelectedModel('gemini-2.0-flash');
    } else {
        setSelectedModel('gemini-2.0-flash-lite-preview-02-05'); // Switch to the highest limit model
    }
    
    // Use setTimeout to ensure state update processes before retry logic triggers
    setTimeout(() => handleRetry(), 100);
  };


  // ... Bookmark & Task handlers (Same as before) ...
  const handleToggleBookmark = (id: string) => setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, isBookmarked: !msg.isBookmarked } : msg));
  const handleUpdateBookmarkNote = (id: string, note: string) => setMessages(prev => prev.map(msg => msg.id === id ? { ...msg, bookmarkNote: note } : msg));
  const handleAddSource = (source: KnowledgeSource) => setSources(prev => [source, ...prev]);
  const handleToggleSource = (id: string) => setSources(prev => prev.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  const handleDeleteSource = (id: string) => setSources(prev => prev.filter(s => s.id !== id));
  const handleAddTask = (task: Task) => setTasks(prev => [task, ...prev]);
  const handleToggleTask = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t));
  const handleDeleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  return (
    <div className="flex h-full w-full bg-day-bg relative font-sans overflow-hidden">
      
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
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">کلید API شما:</label>
                        <input 
                            type="password" 
                            placeholder="AIzaSy..." 
                            value={tempApiKey || userApiKey}
                            onChange={(e) => setTempApiKey(e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-day-teal focus:ring-2 focus:ring-cyan-100 outline-none dir-ltr text-left"
                        />
                    </div>
                    
                    <button 
                        onClick={handleSaveApiKey}
                        disabled={!tempApiKey && !userApiKey}
                        className="w-full bg-day-teal hover:bg-day-dark text-white py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-cyan-100 disabled:bg-gray-300 disabled:shadow-none"
                    >
                        {userApiKey && !tempApiKey ? 'بستن و استفاده از کلید فعلی' : 'ذخیره و اتصال'}
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

                    {userApiKey && (
                         <div className="text-center pt-2">
                            <button onClick={handleClearApiKey} className="text-[11px] text-red-500 hover:text-red-700 underline">
                                حذف کلید ذخیره شده
                            </button>
                         </div>
                    )}
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
             <button 
                onClick={() => setShowApiKeyModal(true)} 
                className={`p-2 rounded-lg transition-colors ${userApiKey ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}
             >
                <Key size={20} />
             </button>
        </div>
        <span className="font-black text-lg text-day-teal tracking-tight">بیمه دی</span>
      </div>

      {/* Desktop/Tablet API Key Button (Overlay on Sidebar or absolute) */}
      {!isSidebarOpen && (
         <button 
            onClick={() => setShowApiKeyModal(true)}
            className={`fixed top-4 left-4 z-30 p-2 rounded-xl shadow-sm transition-all hidden md:flex items-center gap-2 ${userApiKey ? 'bg-white text-green-600 border border-green-200' : 'bg-white text-gray-400 border border-gray-200 hover:border-day-teal hover:text-day-teal'}`}
            title="تنظیمات API Key"
         >
            <Key size={20} />
            {userApiKey && <span className="text-xs font-bold">متصل</span>}
         </button>
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
        sources={sources}
        tasks={tasks}
        chatHistory={chatHistory}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        onAddSource={handleAddSource}
        onToggleSource={handleToggleSource}
        onDeleteSource={handleDeleteSource}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
        onNewChat={handleNewChat}
        onLoadChat={handleLoadChat}
        onDeleteChat={handleDeleteChat}
        onClearHistory={handleClearHistory}
        onClearCache={handleClearCache}
        onOpenSettings={() => setShowApiKeyModal(true)}
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
          onSwitchModelRetry={handleSwitchModelAndRetry}
          onOpenSettings={() => setShowApiKeyModal(true)}
        />
        <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default App;