import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import InputArea from './components/InputArea';
import { generateInsuranceResponse } from './services/geminiService';
import { Message, KnowledgeSource, Role, Task, ChatSession } from './types';
import { Menu, RefreshCw } from './components/Icons';

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
  HISTORY: 'bimeh_day_chat_history'
};

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

  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Update Detection State
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [appVersion, setAppVersion] = useState<number | null>(null);

  // Persist messages
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  }, [messages]);

  // Persist sources
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SOURCES, JSON.stringify(sources));
  }, [sources]);

  // Persist tasks
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  // Persist history
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(chatHistory));
  }, [chatHistory]);

  // Check for updates logic
  useEffect(() => {
    const checkVersion = async () => {
      try {
        // Use a relative path. The ?t= timestamp ensures we bypass browser cache for this file
        const res = await fetch(`./version.json?t=${Date.now()}`);
        if (!res.ok) return;
        
        const data = await res.json();
        const latestTimestamp = data.timestamp;

        if (appVersion === null) {
          // First load, set current version
          setAppVersion(latestTimestamp);
        } else if (latestTimestamp > appVersion) {
          // Server has newer version
          setUpdateAvailable(true);
        }
      } catch (e) {
        console.error("Version check failed (dev mode maybe?)", e);
      }
    };

    // Check immediately on mount
    checkVersion();

    // Check every 60 seconds
    const interval = setInterval(checkVersion, 60 * 1000);

    // Also check when tab becomes visible (user returns to app)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            checkVersion();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appVersion]);

  const handleUpdateApp = () => {
      // Reloading the page will fetch the new index.html (due to no-cache headers) and new assets
      window.location.reload();
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleNewChat = () => {
    if (messages.length > 0) {
      // Create a title from the first user message or generic date
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
      if (window.confirm('گفتگوی فعلی ذخیره نشده است. آیا می‌خواهید آن را آرشیو کنید؟')) {
         handleNewChat();
      }
    }
    setMessages(session.messages);
    // Close sidebar on mobile after loading
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleDeleteChat = (sessionId: string) => {
    // Robust comparison: Convert both to string to handle potential number/string mismatches from storage
    setChatHistory(prev => prev.filter(s => String(s.id) !== String(sessionId)));
  };

  const handleClearHistory = () => {
    if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام تاریخچه گفتگوها را حذف کنید؟')) {
      setChatHistory([]);
      // Effect hook will update localStorage automatically, but we remove explicit key for safety
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }
  };

  const handleClearCache = () => {
    if (window.confirm('آیا مطمئن هستید؟ تمامی تنظیمات، تاریخچه و منابع پاک خواهند شد.')) {
      // 1. Remove all items from localStorage
      localStorage.removeItem(STORAGE_KEYS.MESSAGES);
      localStorage.removeItem(STORAGE_KEYS.SOURCES);
      localStorage.removeItem(STORAGE_KEYS.TASKS);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      
      // 2. Reset all states to initial values to update UI immediately
      setMessages([]);
      setSources(INITIAL_SOURCES);
      setTasks([]);
      setChatHistory([]);
    }
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

    try {
      const responseText = await generateInsuranceResponse(
        [...messages, userMsg],
        text,
        sources
      );

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      const errorMessage = error.message || "متاسفانه خطایی در ارتباط با سرویس رخ داده است. لطفا دوباره تلاش کنید.";
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: errorMessage,
        timestamp: Date.now(),
        isError: true
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBookmark = (id: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, isBookmarked: !msg.isBookmarked } : msg
    ));
  };

  const handleUpdateBookmarkNote = (id: string, note: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, bookmarkNote: note } : msg
    ));
  };

  // Source Management Handlers
  const handleAddSource = (source: KnowledgeSource) => {
    setSources(prev => [source, ...prev]);
  };

  const handleToggleSource = (id: string) => {
    setSources(prev => prev.map(s => 
      s.id === id ? { ...s, isActive: !s.isActive } : s
    ));
  };

  const handleDeleteSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  // Task Management Handlers
  const handleAddTask = (task: Task) => {
    setTasks(prev => [task, ...prev]);
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, isCompleted: !t.isCompleted } : t
    ));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="flex h-full w-full bg-day-bg relative font-sans overflow-hidden">
      
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
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 z-20 shadow-sm justify-between">
        {/* Swap order: Menu on Right (Sidebar side), Logo on Left */}
        <button onClick={toggleSidebar} className="text-gray-600 hover:text-day-teal transition-colors p-2">
          <Menu size={24} />
        </button>
        <span className="font-black text-lg text-day-teal tracking-tight">بیمه دی</span>
      </div>

      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
        sources={sources}
        tasks={tasks}
        chatHistory={chatHistory}
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
      />
      
      <main className="flex-1 flex flex-col h-full pt-14 md:pt-0 overflow-hidden relative">
        <ChatArea 
          messages={messages} 
          isLoading={isLoading} 
          onQuickPrompt={handleSendMessage}
          onToggleBookmark={handleToggleBookmark}
          onUpdateBookmarkNote={handleUpdateBookmarkNote}
        />
        <InputArea onSendMessage={handleSendMessage} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default App;