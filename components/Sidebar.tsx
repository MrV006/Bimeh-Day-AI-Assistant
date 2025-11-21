
import React, { useState, DragEvent, useRef, useMemo } from 'react';
import { KnowledgeSource, Task, ChatSession, ModelId } from '../types';
import { AVAILABLE_MODELS } from '../services/geminiService';
import { Plus, FileText, Trash2, CheckCircle, Database, XCircle, ShieldCheck, UploadCloud, Loader, MessageSquarePlus, X, Search, ListTodo, Calendar, Clock, Square, CheckSquare, ArrowUpDown, History, ArchiveRestore, Eraser, MessageSquare, Globe, Link, Github, Phone, Key, Cpu, Check, ChevronDown, Zap, Brain, Activity, FlaskConical, Sparkles, BarChart3 } from './Icons';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  sources: KnowledgeSource[];
  tasks: Task[];
  chatHistory: ChatSession[];
  selectedModel: ModelId;
  onSelectModel: (model: ModelId) => void;
  onAddSource: (source: KnowledgeSource) => void;
  onToggleSource: (id: string) => void;
  onDeleteSource: (id: string) => void;
  onAddTask: (task: Task) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onNewChat: () => void;
  onLoadChat: (session: ChatSession) => void;
  onDeleteChat: (id: string) => void;
  onClearHistory: () => void;
  onClearCache: () => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
}

type Tab = 'sources' | 'tasks' | 'history';
type SortOption = 'newest' | 'oldest' | 'alpha';
type AddMode = 'file' | 'link';

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  sources,
  tasks,
  chatHistory,
  selectedModel,
  onSelectModel,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onNewChat,
  onLoadChat,
  onDeleteChat,
  onClearHistory,
  onClearCache,
  onOpenSettings,
  onOpenDashboard
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('sources');
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  
  // Source State
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('file');
  const [urlInput, setUrlInput] = useState('');
  
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  
  // Task State
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter and Sort sources
  const processedSources = useMemo(() => {
    // First filter
    const filtered = sources.filter(source => 
      source.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      source.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Then sort
    return filtered.sort((a, b) => {
      if (sortOption === 'newest') {
        return parseInt(b.id) - parseInt(a.id);
      } else if (sortOption === 'oldest') {
        return parseInt(a.id) - parseInt(b.id);
      } else if (sortOption === 'alpha') {
        return a.title.localeCompare(b.title, 'fa');
      }
      return 0;
    });
  }, [sources, searchQuery, sortOption]);

  // Helper function to highlight matching text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-200 text-black font-semibold rounded-[2px] px-0.5 box-decoration-clone">{part}</span>
      ) : (
        part
      )
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleAdd = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    
    const newSource: KnowledgeSource = {
      id: Date.now().toString(),
      title: newTitle,
      content: newContent,
      type: addMode === 'link' ? 'link' : 'text',
      isActive: true // Always active by default
    };
    
    onAddSource(newSource);
    setNewTitle('');
    setNewContent('');
    setUrlInput('');
    setIsAdding(false);
  };

  const handleCreateTask = () => {
    if (!newTaskText.trim()) return;

    const safeDate = newTaskDate ? `${newTaskDate}T12:00:00` : '';

    const newTask: Task = {
        id: Date.now().toString(),
        text: newTaskText,
        dueDate: safeDate,
        isCompleted: false,
        createdAt: Date.now()
    };
    
    onAddTask(newTask);
    setNewTaskText('');
    setNewTaskDate('');
    setIsAddingTask(false);
  };

  const getTaskStatusColor = (dueDate: string, isCompleted: boolean) => {
    if (isCompleted) return 'text-gray-400';
    if (!dueDate) return 'text-gray-600';
    
    const today = new Date().toISOString().split('T')[0];
    const taskDate = dueDate.split('T')[0];
    
    if (taskDate < today) return 'text-day-accent'; // Overdue
    if (taskDate === today) return 'text-amber-500'; // Due today
    return 'text-day-teal'; // Future
  };

  // --- File Parsing Logic ---

  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const totalPages = pdf.numPages;
    
    for (let i = 1; i <= totalPages; i++) {
      setUploadProgress(`در حال پردازش صفحه ${i} از ${totalPages}...`);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    return fullText;
  };

  const extractTextFromDocx = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    setUploadProgress('در حال استخراج متن از فایل Word...');
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value;
  };

  const processFile = async (file: File) => {
    setIsProcessingFile(true);
    setUploadProgress('در حال بارگذاری فایل...');
    
    try {
      let text = '';
      const arrayBuffer = await file.arrayBuffer();

      if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(arrayBuffer);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        file.name.endsWith('.docx')
      ) {
        text = await extractTextFromDocx(arrayBuffer);
      } else {
        setUploadProgress('در حال خواندن فایل متنی...');
        text = await file.text();
      }

      if (text.trim()) {
        setNewTitle(file.name);
        setNewContent(text);
        setAddMode('file');
      } else {
        alert('متن قابل خواندن در این فایل یافت نشد.');
      }
    } catch (error) {
      console.error('File processing error:', error);
      alert('خطا در پردازش فایل. لطفا از فایل دیگری استفاده کنید.');
    } finally {
      setIsProcessingFile(false);
      setUploadProgress('');
    }
  };

  // --- URL Fetch Logic ---
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    
    setIsProcessingFile(true);
    setUploadProgress('در حال دریافت محتوای وبسایت...');

    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (data.contents) {
            setUploadProgress('در حال استخراج متن...');
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');

            doc.querySelectorAll('script, style, iframe, nav, footer, header, aside, noscript').forEach(el => el.remove());

            const title = doc.title || urlInput;
            const text = doc.body.innerText || doc.body.textContent || '';
            
            const cleanText = text.replace(/\s+/g, ' ').trim();

            if (cleanText.length < 50) {
                throw new Error('محتوای متنی کافی در این صفحه یافت نشد.');
            }

            setNewTitle(title);
            setNewContent(cleanText);
        } else {
            throw new Error('امکان دریافت محتوا از این آدرس وجود ندارد.');
        }
    } catch (error) {
        console.error('URL fetch error:', error);
        alert('خطا در خواندن آدرس وب. ممکن است سایت محدودیت دسترسی داشته باشد.');
    } finally {
        setIsProcessingFile(false);
        setUploadProgress('');
    }
  };

  // --- Drag and Drop Handlers ---

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const getActiveModelName = () => {
    const model = AVAILABLE_MODELS.find(m => m.id === selectedModel);
    return model ? model.name : 'انتخاب مدل';
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed md:relative right-0 z-50 h-full bg-white border-l border-gray-200 shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out flex flex-col
        w-[85vw] md:w-80 max-w-[350px] md:max-w-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-br from-day-dark to-day-teal text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <ShieldCheck size={32} className="text-white drop-shadow-sm" />
              <div>
                <h1 className="text-xl font-bold tracking-tight">هوش مصنوعی بیمه دی</h1>
                <p className="text-xs text-cyan-100 opacity-90 font-light">دستیار هوشمند تحلیل بیمه‌نامه</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Dashboard Button */}
              <button 
                onClick={onOpenDashboard} 
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                title="وضعیت سیستم"
              >
                <BarChart3 size={20} />
              </button>

              {/* API Settings Button */}
              <button 
                onClick={onOpenSettings} 
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                title="تنظیمات API"
              >
                <Key size={20} />
              </button>

              {/* Mobile Close Button */}
              <button 
                onClick={toggleSidebar} 
                className="md:hidden p-1 hover:bg-white/20 rounded-full transition-colors"
              >
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          {/* Model Selection Dropdown */}
          <div className="relative">
             <button 
               onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
               className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs text-white transition-colors border border-white/10"
             >
               <div className="flex items-center gap-2">
                 <Cpu size={14} className="text-cyan-200" />
                 <span className="truncate max-w-[180px]">{getActiveModelName()}</span>
               </div>
               <ChevronDown size={12} className={`transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`} />
             </button>

             {isModelMenuOpen && (
               <div className="absolute top-full right-0 w-full mt-1 bg-white rounded-lg shadow-xl border border-gray-100 py-1 text-gray-700 z-50 overflow-hidden animate-fade-in max-h-[350px] overflow-y-auto custom-scrollbar">
                 <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-500">انتخاب مدل (نرخ استفاده رایگان)</span>
                 </div>
                 {AVAILABLE_MODELS.map((model) => (
                   <button 
                     key={model.id}
                     onClick={() => { onSelectModel(model.id); setIsModelMenuOpen(false); }}
                     className="w-full px-3 py-2 text-right hover:bg-cyan-50 flex flex-col gap-1 border-b border-gray-50 last:border-0 transition-colors"
                   >
                     <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-bold ${selectedModel === model.id ? 'text-day-teal' : 'text-gray-800'}`}>
                            {model.name}
                        </span>
                        {selectedModel === model.id && <Check size={12} className="text-day-teal" />}
                     </div>
                     <span className="text-[10px] text-gray-500">{model.description}</span>
                     <div className="flex flex-wrap gap-1 mt-0.5">
                        {model.isNew && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 rounded flex items-center gap-0.5"><Zap size={8} /> جدید</span>}
                        {model.isStable && <span className="text-[9px] bg-green-100 text-green-600 px-1.5 rounded flex items-center gap-0.5"><CheckCircle size={8} /> پایدار</span>}
                        {model.isPro && <span className="text-[9px] bg-purple-100 text-purple-600 px-1.5 rounded flex items-center gap-0.5"><Brain size={8} /> هوشمند</span>}
                        {model.isExperimental && <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 rounded flex items-center gap-0.5"><FlaskConical size={8} /> آزمایشی</span>}
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 rounded flex items-center gap-0.5"><Activity size={8} /> {model.rpm} RPM</span>
                     </div>
                   </button>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* ... (Rest of the component remains largely same, just updated imports/icons) ... */}
        {/* New Chat Button */}
        <div className="p-4 pb-2">
          <button 
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) toggleSidebar();
            }}
            className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl hover:border-day-teal hover:text-day-teal transition-all shadow-sm group"
          >
            <MessageSquarePlus size={18} className="text-gray-400 group-hover:text-day-teal transition-colors" />
            <span className="font-medium text-sm">گفتگوی جدید</span>
          </button>
        </div>

        {/* TABS */}
        <div className="px-4 pt-2">
            <div className="flex bg-gray-100 rounded-xl p-1">
                <button 
                    onClick={() => setActiveTab('sources')}
                    className={`flex-1 py-2 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'sources' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Database size={14} />
                    منابع
                </button>
                <button 
                    onClick={() => setActiveTab('tasks')}
                    className={`flex-1 py-2 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'tasks' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <ListTodo size={14} />
                    وظایف
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2 text-[11px] md:text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${activeTab === 'history' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <History size={14} />
                    تاریخچه
                </button>
            </div>
        </div>

        {/* ... Tab Contents ... */}
        {/* === SOURCES TAB === */}
        {activeTab === 'sources' && (
            /* ... Existing Source Logic ... */
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {/* Search and List Logic copied from previous but using updated imports */}
              {sources.length > 0 && (
              <div className="px-4 mt-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-gray-400 group-focus-within:text-day-teal transition-colors" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pr-10 pl-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:border-day-teal transition-all"
                    placeholder="جستجو در منابع..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sources List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider">
                  <Database size={14} />
                  کتابخانه منابع
                </h2>
                
                <div className="flex items-center gap-2">
                    <div className="relative flex items-center bg-gray-50 border border-gray-200 rounded-lg px-2 py-0.5">
                         <ArrowUpDown size={10} className="text-gray-400 ml-1" />
                        <select 
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="text-[10px] bg-transparent text-gray-600 focus:outline-none cursor-pointer appearance-none font-medium"
                        >
                            <option value="newest">جدیدترین</option>
                            <option value="oldest">قدیمی‌ترین</option>
                            <option value="alpha">الفبا</option>
                        </select>
                    </div>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium border border-gray-200">
                    {processedSources.length} سند
                    </span>
                </div>
              </div>

              {/* ... Empty States ... */}
              {sources.length === 0 && !isAdding && (
                <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                  <p className="text-sm font-medium">هنوز سندی اضافه نشده است</p>
                  <p className="text-xs mt-2 opacity-70">برای پاسخگویی دقیق، اسناد خود را آپلود کنید</p>
                </div>
              )}

              <div className="space-y-3">
                {processedSources.map(source => {
                  const isExpanded = expandedItems.has(source.id);
                  const shouldTruncate = source.content.length > 100;
                  const contentToShow = isExpanded 
                    ? source.content 
                    : (shouldTruncate ? source.content.substring(0, 100) + '...' : source.content);

                  return (
                    <div 
                      key={source.id} 
                      className={`p-3 rounded-xl border transition-all duration-200 ${source.isActive ? 'border-day-light/50 bg-cyan-50/50 shadow-sm ring-1 ring-cyan-100' : 'border-gray-100 bg-gray-50 opacity-60 hover:opacity-100'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                         {/* Icon and Title */}
                        <div className="flex items-start gap-2 overflow-hidden flex-1">
                          <div className={`p-1.5 rounded-lg mt-0.5 ${source.isActive ? 'bg-white text-day-teal' : 'bg-gray-200 text-gray-500'}`}>
                            {source.type === 'link' ? <Globe size={16} className="shrink-0" /> : <FileText size={16} className="shrink-0" />}
                          </div>
                          <div className="flex flex-col min-w-0">
                              <span className={`text-sm font-bold break-words ${source.isActive ? 'text-day-dark' : 'text-gray-600'}`}>
                                {highlightText(source.title, searchQuery)}
                              </span>
                              
                              {/* Active Indicator - Text Based */}
                              {source.isActive && (
                                <span className="text-[10px] text-green-600 font-medium mt-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                    فعال در پاسخ‌دهی
                                </span>
                              )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button 
                          onClick={() => onDeleteSource(source.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-lg shrink-0"
                          title="حذف سند"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Content Snippet */}
                      <div className="mt-3 pl-1 pr-1">
                        <div className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap font-light text-justify break-words bg-white/50 p-2 rounded-lg border border-gray-100/50">
                          {highlightText(contentToShow, searchQuery)}
                        </div>
                      </div>
                      
                      {/* Footer Actions */}
                      <div className="flex items-center justify-between mt-3 border-t border-black/5 pt-2">
                            {/* Read More */}
                            {shouldTruncate ? (
                              <button 
                                onClick={() => toggleExpand(source.id)}
                                className="text-[10px] text-day-teal font-bold hover:underline cursor-pointer flex items-center gap-1 px-1"
                              >
                                {isExpanded ? 'بستن' : 'مشاهده متن کامل'}
                              </button>
                            ) : <span />}
                            
                            {/* Clearly Visible Toggle Switch */}
                            <button 
                              onClick={() => onToggleSource(source.id)}
                              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  source.isActive 
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                                }`}
                            >
                              <div className={`w-3 h-3 rounded-full transition-colors ${source.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                              <span>{source.isActive ? 'وضعیت: فعال' : 'وضعیت: غیرفعال'}</span>
                            </button>
                        </div>
                    </div>
                  );
                })}
              </div>
            </div>
             <div className="p-4 border-t border-gray-100 bg-gray-50">
              {!isAdding ? (
                <button 
                  onClick={() => setIsAdding(true)}
                  className="w-full py-3.5 flex items-center justify-center gap-2 bg-day-teal text-white rounded-xl hover:bg-day-dark transition-all shadow-lg shadow-cyan-100 hover:shadow-cyan-200"
                >
                  <Plus size={20} />
                  <span className="font-bold text-sm">افزودن سند جدید</span>
                </button>
              ) : (
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg animate-fade-in flex flex-col max-h-[450px] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                    <span className="text-sm font-bold text-day-dark">بارگذاری سند</span>
                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-day-accent">
                      <XCircle size={20} />
                    </button>
                  </div>

                  <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                      <button onClick={() => setAddMode('file')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md transition-all ${addMode === 'file' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          <UploadCloud size={14} /> آپلود فایل
                      </button>
                      <button onClick={() => setAddMode('link')} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-md transition-all ${addMode === 'link' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                          <Link size={14} /> لینک وبسایت
                      </button>
                  </div>

                  {addMode === 'file' ? (
                      <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => !isProcessingFile && fileInputRef.current?.click()} className={`mb-4 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 min-h-[140px] group ${isDragging ? 'border-day-teal bg-cyan-50' : 'border-gray-200 hover:border-day-teal hover:bg-gray-50'} ${isProcessingFile ? 'cursor-default hover:bg-white' : ''}`}>
                        <input type="file" ref={fileInputRef} onChange={onFileInputChange} className="hidden" accept=".txt,.md,.json,.csv,.pdf,.docx" disabled={isProcessingFile} />
                        {isProcessingFile ? (
                          <div className="flex flex-col items-center gap-3 animate-pulse"><Loader size={32} className="animate-spin text-day-teal" /><span className="text-xs text-day-dark font-bold">{uploadProgress || 'در حال پردازش...'}</span></div>
                        ) : (
                          <><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-cyan-100 transition-colors"><UploadCloud size={24} className="text-gray-400 group-hover:text-day-teal" /></div><div className="flex flex-col gap-1"><span className="text-xs text-gray-700 font-bold">کلیک کنید یا فایل را اینجا رها کنید</span><span className="text-[10px] text-gray-400">PDF, DOCX, TXT</span></div></>
                        )}
                      </div>
                  ) : (
                      <div className="mb-4"><div className="flex gap-2"><input type="url" placeholder="https://example.com" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1 text-sm p-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-day-teal outline-none dir-ltr text-left" /><button onClick={handleFetchUrl} disabled={!urlInput || isProcessingFile} className="bg-day-dark text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-day-teal disabled:opacity-50 transition-colors">{isProcessingFile ? <Loader size={14} className="animate-spin" /> : 'دریافت'}</button></div>{isProcessingFile && <div className="mt-2 flex items-center gap-2 text-xs text-day-teal"><Loader size={12} className="animate-spin" /><span>{uploadProgress}</span></div>}<p className="text-[10px] text-gray-400 mt-2">محتوای متنی صفحه به صورت خودکار استخراج و تمیز می‌شود.</p></div>
                  )}
                  
                  <div className="space-y-3">
                    <input type="text" placeholder="عنوان سند" className="w-full p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-day-teal focus:ring-2 focus:ring-cyan-100 outline-none transition-all" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} disabled={isProcessingFile} />
                    <textarea placeholder="متن استخراج شده..." className="w-full p-3 text-sm border border-gray-200 rounded-xl h-24 bg-gray-50 focus:bg-white focus:border-day-teal focus:ring-2 focus:ring-cyan-100 outline-none resize-none transition-all custom-scrollbar leading-relaxed" value={newContent} onChange={(e) => setNewContent(e.target.value)} disabled={isProcessingFile} />
                    <button onClick={handleAdd} disabled={!newTitle || !newContent || isProcessingFile} className={`w-full text-white py-3 rounded-xl text-sm font-bold transition-all shadow-md ${(!newTitle || !newContent || isProcessingFile) ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-day-accent hover:bg-pink-700 hover:shadow-lg transform hover:-translate-y-0.5'}`}>ثبت در پایگاه دانش</button>
                  </div>
                </div>
              )}
            </div>
            </div>
        )}

        {/* === TASKS TAB === */}
        {activeTab === 'tasks' && (
             /* ... Existing Task Logic ... */
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                   <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><ListTodo size={14} /> لیست وظایف</h2>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium border border-gray-200">{tasks.filter(t => !t.isCompleted).length} فعال</span>
                   </div>
                   {tasks.length === 0 && !isAddingTask && (<div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50"><p className="text-sm font-medium">هنوز وظیفه‌ای ثبت نشده</p><p className="text-xs mt-2 opacity-70">کارهای مربوط به بیمه خود را اینجا مدیریت کنید</p></div>)}
                   <div className="space-y-3">
                        {tasks.map(task => {
                            const statusColor = getTaskStatusColor(task.dueDate, task.isCompleted);
                            return (
                                <div key={task.id} className={`p-3 rounded-xl border transition-all ${task.isCompleted ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-200 shadow-sm'}`}>
                                    <div className="flex items-start gap-3">
                                        <button onClick={() => onToggleTask(task.id)} className={`mt-0.5 transition-colors ${task.isCompleted ? 'text-day-teal' : 'text-gray-300 hover:text-day-teal'}`}>{task.isCompleted ? <CheckSquare size={20} /> : <Square size={20} />}</button>
                                        <div className="flex-1 min-w-0"><p className={`text-sm font-medium leading-relaxed break-words ${task.isCompleted ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-800'}`}>{task.text}</p>{task.dueDate && (<div className={`flex items-center gap-1 mt-1.5 text-xs ${statusColor}`}><Clock size={12} /><span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('fa-IR') : ''}</span>{!task.isCompleted && (<span className="mr-1 font-bold">{task.dueDate.split('T')[0] < new Date().toISOString().split('T')[0] ? '(مهلت گذشته)' : task.dueDate.split('T')[0] === new Date().toISOString().split('T')[0] ? '(امروز)' : ''}</span>)}</div>)}</div>
                                        <button onClick={() => onDeleteTask(task.id)} className="text-gray-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                        <button onClick={() => onDeleteTask(task.id)} className="md:hidden text-gray-300 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            );
                        })}
                   </div>
            </div>
        )}
        {/* Add Task Section */}
        {activeTab === 'tasks' && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
            {!isAddingTask ? (<button onClick={() => setIsAddingTask(true)} className="w-full py-3.5 flex items-center justify-center gap-2 bg-white text-day-teal border border-day-teal rounded-xl hover:bg-day-teal hover:text-white transition-all shadow-sm"><Plus size={20} /><span className="font-bold text-sm">افزودن وظیفه جدید</span></button>) : (
                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-lg animate-fade-in"><div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2"><span className="text-sm font-bold text-day-dark">وظیفه جدید</span><button onClick={() => setIsAddingTask(false)} className="text-gray-400 hover:text-day-accent"><XCircle size={20} /></button></div><div className="space-y-3"><input type="text" placeholder="عنوان کار (مثلا: تمدید بیمه شخص ثالث)" className="w-full p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-day-teal outline-none transition-all" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} autoFocus /><div className="relative"><input type="date" className="w-full p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-day-teal outline-none transition-all appearance-none" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} />{!newTaskDate && (<span className="absolute right-3 top-3.5 text-gray-400 text-sm pointer-events-none flex items-center gap-2 bg-gray-50 pr-1"><Calendar size={16} /> تاریخ سررسید</span>)}</div><button onClick={handleCreateTask} disabled={!newTaskText.trim()} className={`w-full text-white py-3 rounded-xl text-sm font-bold transition-all shadow-md ${!newTaskText.trim() ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-day-teal hover:bg-day-dark hover:shadow-lg'}`}>افزودن به لیست</button></div></div>
            )}
        </div>
        )}


        {/* === HISTORY TAB === */}
        {activeTab === 'history' && (
             /* ... Existing History Logic ... */
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                   <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2 tracking-wider"><History size={14} /> آرشیو گفتگوها</h2>
                        <div className="flex items-center gap-2"><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClearHistory(); }} className="relative z-10 text-[10px] bg-red-50 text-red-500 px-3 py-1.5 rounded-full font-medium border border-red-100 hover:bg-red-100 transition-colors flex items-center gap-1 active:scale-95" title="حذف تمام تاریخچه" disabled={chatHistory.length === 0}><Trash2 size={12} /> حذف همه</button><span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium border border-gray-200">{chatHistory.length} مورد</span></div>
                   </div>
                   {chatHistory.length === 0 && (<div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50"><p className="text-sm font-medium">آرشیو خالی است</p><p className="text-xs mt-2 opacity-70">گفتگوهای قبلی شما اینجا ذخیره می‌شوند</p></div>)}
                   <div className="space-y-3 pb-20">
                        {chatHistory.map(session => (
                            <div key={session.id} className="p-3 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-day-teal/50 transition-all group relative">
                                <div className="flex items-center justify-between"><div className="flex items-center gap-3 overflow-hidden"><div className="p-2 bg-gray-100 text-gray-500 rounded-lg group-hover:bg-cyan-50 group-hover:text-day-teal transition-colors shrink-0"><MessageSquare size={16} /></div><div className="flex flex-col overflow-hidden"><span className="text-sm font-bold text-gray-700 truncate group-hover:text-day-dark transition-colors">{session.title}</span><span className="text-[10px] text-gray-400">{new Date(session.createdAt).toLocaleDateString('fa-IR')} • {session.messages.length} پیام</span></div></div></div>
                                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100"><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLoadChat(session); }} className="relative z-10 flex-1 flex items-center justify-center gap-1 text-xs font-medium text-day-teal bg-cyan-50 py-2 rounded-lg hover:bg-day-teal hover:text-white transition-colors active:scale-95"><ArchiveRestore size={14} /> بازخوانی</button><button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(window.confirm('آیا از حذف این گفتگو اطمینان دارید؟')) onDeleteChat(session.id); }} className="relative z-10 flex items-center justify-center gap-1 text-xs font-medium text-gray-400 bg-gray-50 py-2 px-4 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors active:scale-95" title="حذف"><Trash2 size={14} /></button></div>
                            </div>
                        ))}
                   </div>
            </div>
        )}
        {activeTab === 'history' && (
            <div className="p-4 border-t border-gray-100 bg-gray-50"><button type="button" onClick={onClearCache} className="w-full py-3 flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-500 rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all shadow-sm active:scale-[0.99]"><Eraser size={18} /><span className="font-medium text-sm">پاک‌سازی کامل حافظه</span></button></div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-500 mt-auto">
            <p className="text-[10px] font-medium mb-2 tracking-wide">طراحی و توسعه توسط <span className="text-day-teal font-bold">Mr.V</span></p>
            <div className="flex items-center gap-4"><a href="https://github.com/MrV006" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors"><Github size={16} /></a><a href="tel:09902076468" className="hover:text-green-600 transition-colors"><Phone size={16} /></a></div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
