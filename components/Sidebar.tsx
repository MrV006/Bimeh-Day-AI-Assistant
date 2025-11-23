
import React, { useState, DragEvent, useRef, useMemo } from 'react';
import { KnowledgeSource, ChatSession } from '../types';
import { Plus, FileText, Trash2, Database, ShieldCheck, UploadCloud, Loader, MessageSquarePlus, X, Search, ArrowUpDown, History, Eraser, MessageSquare, Globe, Link, Check, BarChart3, Info, Wifi, Phone, Github, Key } from './Icons';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  sources: KnowledgeSource[];
  chatHistory: ChatSession[];
  appVersion: string;
  onAddSource: (source: KnowledgeSource) => void;
  onToggleSource: (id: string) => void;
  onDeleteSource: (id: string) => void;
  onNewChat: () => void;
  onLoadChat: (session: ChatSession) => void;
  onDeleteChat: (id: string) => void;
  onClearHistory: () => void;
  onClearCache: () => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
  onOpenHelp: () => void;
  isOnline: boolean;
  ping: number | null;
}

type Tab = 'sources' | 'history';
type SortOption = 'newest' | 'oldest' | 'alpha';
type AddMode = 'file' | 'link';

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  sources,
  chatHistory,
  appVersion,
  onAddSource,
  onToggleSource,
  onDeleteSource,
  onNewChat,
  onLoadChat,
  onDeleteChat,
  onClearHistory,
  onClearCache,
  onOpenSettings,
  onOpenDashboard,
  onOpenHelp,
  isOnline,
  ping
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('sources');
  
  // Source State
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('file');
  const [urlInput, setUrlInput] = useState('');
  
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  
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
      isActive: true
    };
    
    onAddSource(newSource);
    setNewTitle('');
    setNewContent('');
    setUrlInput('');
    setIsAdding(false);
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
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
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
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
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
        fixed md:relative right-0 z-50 h-full bg-gray-50 border-l border-gray-200 shadow-2xl md:shadow-none transition-transform duration-300 ease-in-out flex flex-col
        w-[85vw] md:w-80 max-w-[350px] md:max-w-none
        ${isOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        
        {/* === HEADER === */}
        <div className="px-5 py-4 bg-white border-b border-gray-200 shadow-sm z-20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 text-day-dark">
              <div className="bg-day-teal text-white p-1.5 rounded-lg shadow-sm">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none">هوش مصنوعی بیمه دی</h1>
              </div>
            </div>
            <button onClick={toggleSidebar} className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-1">
             <button onClick={() => { onNewChat(); if(window.innerWidth < 768) toggleSidebar(); }} className="flex-1 bg-day-dark text-white py-2 px-3 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95">
                <MessageSquarePlus size={16} />
                گفتگوی جدید
             </button>
             <div className="flex gap-1">
               <button onClick={onOpenDashboard} className="p-2 bg-gray-100 hover:bg-day-teal hover:text-white rounded-lg transition-colors text-gray-500" title="وضعیت سیستم"><BarChart3 size={18} /></button>
               <button onClick={onOpenSettings} className="p-2 bg-gray-100 hover:bg-day-teal hover:text-white rounded-lg transition-colors text-gray-500" title="تنظیمات API"><Key size={18} /></button>
               <button onClick={onOpenHelp} className="p-2 bg-gray-100 hover:bg-day-teal hover:text-white rounded-lg transition-colors text-gray-500" title="راهنما"><Info size={18} /></button>
             </div>
          </div>
        </div>

        {/* === TABS === */}
        <div className="px-4 pt-3 bg-gray-50">
            <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                <button onClick={() => setActiveTab('sources')} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'sources' ? 'bg-day-teal text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><Database size={14} /> منابع</button>
                <button onClick={() => setActiveTab('history')} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history' ? 'bg-day-teal text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}><History size={14} /> آرشیو</button>
            </div>
        </div>

        {/* === CONTENT AREA === */}
        <div className="flex-1 overflow-hidden relative bg-gray-50">
            
            {/* --- SOURCES TAB --- */}
            {activeTab === 'sources' && (
                <>
                  {/* Add Source OVERLAY */}
                  {isAdding ? (
                      <div className="absolute inset-0 bg-white z-30 flex flex-col animate-fade-in">
                          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm z-10">
                              <span className="text-sm font-bold text-day-dark flex items-center gap-2"><Plus size={16} /> افزودن سند جدید</span>
                              <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-1.5 rounded-lg transition-all"><X size={18} /></button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                              <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
                                  <button onClick={() => setAddMode('file')} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-lg transition-all ${addMode === 'file' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500'}`}><UploadCloud size={16} /> آپلود فایل</button>
                                  <button onClick={() => setAddMode('link')} className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-lg transition-all ${addMode === 'link' ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500'}`}><Link size={16} /> لینک وبسایت</button>
                              </div>

                              {addMode === 'file' ? (
                                  <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={() => !isProcessingFile && fileInputRef.current?.click()} className={`mb-5 border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 group ${isDragging ? 'border-day-teal bg-cyan-50' : 'border-gray-200 hover:border-day-teal hover:bg-gray-50'}`}>
                                    <input type="file" ref={fileInputRef} onChange={onFileInputChange} className="hidden" accept=".txt,.md,.json,.csv,.pdf,.docx" disabled={isProcessingFile} />
                                    {isProcessingFile ? (
                                      <div className="flex flex-col items-center gap-3"><Loader size={32} className="animate-spin text-day-teal" /><span className="text-xs font-bold text-day-dark">{uploadProgress}</span></div>
                                    ) : (
                                      <><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-cyan-100 transition-colors"><UploadCloud size={24} className="text-gray-400 group-hover:text-day-teal" /></div><div className="flex flex-col gap-1"><span className="text-sm font-bold text-gray-700">فایل را انتخاب یا رها کنید</span><span className="text-[10px] text-gray-400 font-mono">PDF, DOCX, TXT</span></div></>
                                    )}
                                  </div>
                              ) : (
                                  <div className="mb-5"><div className="flex gap-2"><input type="url" placeholder="https://example.com" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="flex-1 text-sm p-3 border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-day-teal outline-none dir-ltr text-left transition-all" /><button onClick={handleFetchUrl} disabled={!urlInput || isProcessingFile} className="bg-day-dark text-white px-4 rounded-xl text-sm font-bold hover:bg-day-teal disabled:opacity-50 transition-colors">{isProcessingFile ? <Loader size={16} className="animate-spin" /> : 'دریافت'}</button></div>{isProcessingFile && <div className="mt-3 flex items-center gap-2 text-xs text-day-teal bg-cyan-50 p-2 rounded-lg"><Loader size={14} className="animate-spin" /><span>{uploadProgress}</span></div>}</div>
                              )}

                              <div className="space-y-4">
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 mr-1">عنوان سند</label><input type="text" className="w-full p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-day-teal outline-none transition-all" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} disabled={isProcessingFile} /></div>
                                <div className="space-y-1"><label className="text-xs font-bold text-gray-500 mr-1">محتوای متنی</label><textarea className="w-full p-3 text-sm border border-gray-200 rounded-xl h-40 bg-gray-50 focus:bg-white focus:border-day-teal outline-none resize-none transition-all custom-scrollbar leading-relaxed" value={newContent} onChange={(e) => setNewContent(e.target.value)} disabled={isProcessingFile} /></div>
                              </div>
                          </div>
                          <div className="p-4 border-t border-gray-100 bg-gray-50">
                              <button onClick={handleAdd} disabled={!newTitle || !newContent || isProcessingFile} className={`w-full text-white py-3.5 rounded-xl text-sm font-bold transition-all shadow-lg ${(!newTitle || !newContent || isProcessingFile) ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-day-accent hover:bg-pink-700 hover:shadow-pink-200 hover:-translate-y-0.5'}`}>ثبت در پایگاه دانش</button>
                          </div>
                      </div>
                  ) : (
                      <div className="flex flex-col h-full">
                          {/* Search & Filter */}
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200/50 space-y-3">
                            <div className="relative">
                              <input type="text" className="w-full pl-3 pr-9 py-2 bg-white border border-gray-200 rounded-lg text-xs focus:border-day-teal focus:ring-1 focus:ring-day-teal outline-none transition-all placeholder-gray-400" placeholder="جستجو..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                              <Search size={14} className="absolute right-3 top-2.5 text-gray-400" />
                              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute left-3 top-2.5 text-gray-400 hover:text-red-500"><X size={14} /></button>}
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-400 font-bold">مرتب‌سازی:</span>
                                    <div className="relative"><select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)} className="bg-transparent text-[10px] font-bold text-gray-600 focus:outline-none cursor-pointer appearance-none pr-3"><option value="newest">جدیدترین</option><option value="oldest">قدیمی‌ترین</option><option value="alpha">الفبا</option></select><ArrowUpDown size={10} className="absolute left-[-15px] top-0.5 text-gray-400 pointer-events-none" /></div>
                                </div>
                                <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{processedSources.length} سند</span>
                            </div>
                          </div>
                          
                          {/* List */}
                          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-20">
                            {sources.length === 0 ? (
                                <div className="text-center py-10 px-4"><div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"><Database size={24} className="text-gray-300" /></div><p className="text-xs text-gray-500 font-medium">پایگاه دانش خالی است</p></div>
                            ) : (
                                <div className="space-y-4">
                                    {processedSources.map(source => {
                                        const isExpanded = expandedItems.has(source.id);
                                        const shouldTruncate = source.content.length > 100;
                                        return (
                                            <div key={source.id} className={`p-3 rounded-xl border transition-all bg-white ${source.isActive ? 'border-day-light shadow-sm ring-1 ring-cyan-50' : 'border-gray-100 opacity-80 grayscale-[0.5] hover:grayscale-0'}`}>
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className={`p-1.5 rounded-md shrink-0 ${source.isActive ? 'bg-cyan-50 text-day-teal' : 'bg-gray-100 text-gray-400'}`}>{source.type === 'link' ? <Globe size={14} /> : <FileText size={14} />}</div>
                                                        <span className="text-xs font-bold text-gray-700 truncate">{highlightText(source.title, searchQuery)}</span>
                                                    </div>
                                                    <button onClick={() => onDeleteSource(source.id)} className="text-gray-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-2 mb-2 border border-gray-100 text-[10px] text-gray-600 leading-relaxed text-justify break-words">
                                                    {highlightText(isExpanded ? source.content : (shouldTruncate ? source.content.substring(0, 100) + '...' : source.content), searchQuery)}
                                                </div>
                                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                                     {shouldTruncate ? (<button onClick={() => toggleExpand(source.id)} className="text-[10px] text-blue-500 font-bold hover:underline">{isExpanded ? 'بستن' : 'بیشتر...'}</button>) : <span></span>}
                                                     <button onClick={() => onToggleSource(source.id)} className="flex items-center gap-2 group cursor-pointer ml-auto" title={source.isActive ? "کلیک برای غیرفعال کردن" : "کلیک برای فعال کردن"}>
                                                          <span className={`text-[10px] font-bold w-24 text-left transition-colors ${source.isActive ? 'text-green-600' : 'text-gray-400'}`}>{source.isActive ? 'وضعیت: فعال' : 'وضعیت: غیرفعال'}</span>
                                                          <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-300 flex items-center ${source.isActive ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-300 ${source.isActive ? '-translate-x-4' : 'translate-x-0'}`}></div></div>
                                                     </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                          </div>

                          {/* Floating Add Button */}
                          <div className="absolute bottom-4 left-4 right-4">
                             <button onClick={() => setIsAdding(true)} className="w-full py-3 bg-day-teal text-white rounded-xl shadow-lg shadow-cyan-100 hover:shadow-cyan-200 hover:bg-day-dark transition-all flex items-center justify-center gap-2 font-bold text-sm transform active:scale-[0.98]">
                                <Plus size={18} /> افزودن سند جدید
                             </button>
                          </div>
                      </div>
                  )}
                </>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'history' && (
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-20 flex flex-col">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                         <span className="text-sm font-bold text-day-dark flex items-center gap-2"><History size={18}/> آرشیو گفتگوها</span>
                         {chatHistory.length > 0 ? (
                            <button type="button" onClick={onClearHistory} className="flex items-center gap-1 text-[11px] bg-red-50 text-red-500 px-3 py-1.5 rounded-full hover:bg-red-100 transition-colors border border-red-100 font-bold">
                                <span>حذف همه</span>
                                <Trash2 size={12} />
                            </button>
                         ) : (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">0 مورد</span>
                         )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        {chatHistory.length === 0 ? (
                            <div className="border-2 border-dashed border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center h-[200px] bg-gray-50/50">
                                <h4 className="text-gray-400 font-bold text-lg mb-2">آرشیو خالی است</h4>
                                <p className="text-gray-400 text-xs">گفتگوهای قبلی شما اینجا ذخیره می‌شوند</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {chatHistory.map(session => (
                                    <div key={session.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:border-day-teal/50 transition-all group">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-gray-100 rounded-lg text-gray-500"><MessageSquare size={16} /></div>
                                            <div className="overflow-hidden"><h4 className="text-xs font-bold text-gray-700 truncate">{session.title}</h4><span className="text-[10px] text-gray-400">{new Date(session.createdAt).toLocaleDateString('fa-IR')}</span></div>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button type="button" onClick={(e) => {e.preventDefault(); e.stopPropagation(); onLoadChat(session);}} className="flex-1 bg-cyan-50 text-day-teal text-[10px] font-bold py-1.5 rounded hover:bg-day-teal hover:text-white transition-colors relative z-10">بازخوانی</button>
                                            <button type="button" onClick={(e) => {e.preventDefault(); e.stopPropagation(); onDeleteChat(session.id);}} className="bg-gray-50 text-gray-400 px-3 rounded hover:bg-red-50 hover:text-red-500 transition-colors relative z-10"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Bottom Button */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <button type="button" onClick={onClearCache} className="w-full py-4 border border-gray-200 text-gray-600 text-sm font-bold rounded-2xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm bg-white group">
                             <span>پاک‌سازی کامل حافظه</span>
                             <Eraser size={18} className="text-gray-400 group-hover:text-gray-600" />
                        </button>
                    </div>
                </div>
            )}

        </div>

        {/* === FOOTER === */}
        <div className="bg-white border-t border-gray-200 p-4 z-40">
            {/* Connection Status */}
            <div className={`mb-3 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold border transition-all duration-500 ${isOnline ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                <div className="flex items-center gap-2">
                   <div className={`p-1 rounded-full ${isOnline ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-600'}`}>
                       <Wifi size={14} />
                   </div>
                   <span>{isOnline ? 'سیستم آنلاین' : 'قطع ارتباط'}</span>
                </div>
                <span className="font-mono dir-ltr">{ping ? `${ping}ms` : '--'}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex flex-col">
                    <span className="text-[10px] text-day-teal font-bold mb-1">طراحی و توسعه توسط Mr.V</span>
                    <div className="flex gap-3">
                        <a href="tel:09902076468" className="text-gray-400 hover:text-day-teal transition-colors p-1 hover:bg-gray-100 rounded-md">
                            <Phone size={16} />
                        </a>
                        <a href="https://github.com/MrV006" target="_blank" className="text-gray-400 hover:text-day-dark transition-colors p-1 hover:bg-gray-100 rounded-md">
                            <Github size={16} />
                        </a>
                    </div>
                </div>
                <div className="h-8 w-px bg-gray-200 mx-2"></div>
                <div className="flex flex-col items-end">
                     <span className="text-[10px] text-gray-400">نسخه</span>
                     <span className="text-xs font-mono text-gray-500">{appVersion}</span>
                </div>
            </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
