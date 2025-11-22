
import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role, ModelId } from '../types';
import { Bot, User, Copy, Check, Car, HeartPulse, FileCheck, Briefcase, Search, ChevronUp, ChevronDown, X, Eye, Download, Printer, FileText, ClipboardList, Bookmark, Pen, Share, ArrowUp, RefreshCcw, Cpu, Key, Sparkles, Loader } from './Icons';
import * as docx from 'docx';
import saveAs from 'file-saver';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  selectedModel: ModelId;
  onQuickPrompt?: (text: string) => void;
  onToggleBookmark: (id: string) => void;
  onUpdateBookmarkNote: (id: string, note: string) => void;
  onRetry: () => void;
  onSwitchModelRetry: () => void;
  onOpenSettings: () => void;
}

// Define Quick Prompts Data
const QUICK_PROMPTS = [
  {
    icon: <Car size={24} />,
    title: 'بیمه خودرو',
    question: 'شرایط دریافت خسارت بدون کروکی در بیمه شخص ثالث چیست؟'
  },
  {
    icon: <HeartPulse size={24} />,
    title: 'درمان تکمیلی',
    question: 'لیست مدارک لازم برای دریافت هزینه‌های دندانپزشکی و عینک چیست؟'
  },
  {
    icon: <FileCheck size={24} />,
    title: 'بیمه عمر و زندگی',
    question: 'تفاوت‌های اصلی طرح‌های مختلف بیمه عمر و سرمایه‌گذاری بیمه دی چیست؟'
  },
  {
    icon: <Briefcase size={24} />,
    title: 'امور نمایندگان',
    question: 'شرایط و مدارک مورد نیاز برای اخذ کد نمایندگی بیمه دی چیست؟'
  }
];

// Helper to escape regex characters
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

interface BookmarkNoteProps {
  msg: Message;
  editingNoteId: string | null;
  noteContent: string;
  onNoteContentChange: (text: string) => void;
  onStartEdit: (msg: Message) => void;
  onCancelEdit: () => void;
  onSaveNote: (id: string) => void;
}

const BookmarkNote: React.FC<BookmarkNoteProps> = ({
  msg,
  editingNoteId,
  noteContent,
  onNoteContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveNote
}) => {
  const isEditing = editingNoteId === msg.id;

  if (isEditing) {
    return (
      <div className={`mt-3 p-3 rounded-lg border ${msg.role === Role.USER ? 'bg-white/10 border-white/20' : 'bg-yellow-50 border-yellow-200'} animate-fade-in`}>
        <textarea
          autoFocus
          dir="rtl"
          value={noteContent}
          onChange={(e) => onNoteContentChange(e.target.value)}
          placeholder="یادداشت خود را اینجا بنویسید..."
          className={`w-full text-sm p-2 rounded bg-transparent border-b focus:outline-none resize-none text-right ${msg.role === Role.USER ? 'text-white placeholder-white/60 border-white/30 focus:border-white' : 'text-gray-700 placeholder-gray-400 border-yellow-300 focus:border-yellow-500'}`}
          rows={2}
        />
        <div className="flex justify-end gap-2 mt-2">
          <button onClick={onCancelEdit} className={`text-xs px-2 py-1 rounded transition-colors ${msg.role === Role.USER ? 'text-white/80 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-200'}`}>
            انصراف
          </button>
          <button onClick={() => onSaveNote(msg.id)} className="text-xs px-3 py-1 bg-day-accent text-white rounded hover:bg-pink-700 transition-colors shadow-sm">
            ذخیره یادداشت
          </button>
        </div>
      </div>
    );
  }

  if (msg.bookmarkNote) {
    return (
      <div className={`mt-3 p-2.5 rounded-lg border text-sm relative group/note ${msg.role === Role.USER ? 'bg-white/10 border-white/20 text-white' : 'bg-yellow-50 border-yellow-100 text-gray-700'}`}>
        <div className="flex items-start gap-2">
          <Bookmark size={14} className={`mt-1 shrink-0 ${msg.role === Role.USER ? 'text-white/70' : 'text-yellow-500'}`} />
          <p className="whitespace-pre-wrap leading-relaxed text-xs md:text-sm opacity-90">{msg.bookmarkNote}</p>
        </div>
        <button 
          onClick={() => onStartEdit(msg)}
          className={`absolute top-2 left-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === Role.USER ? 'hover:bg-white/20 text-white' : 'hover:bg-yellow-200 text-gray-500'}`}
          title="ویرایش یادداشت"
        >
          <Pen size={12} />
        </button>
      </div>
    );
  }

  return (
     <div className="mt-2 flex justify-end">
       <button 
          onClick={() => onStartEdit(msg)}
          className={`text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity ${msg.role === Role.USER ? 'text-white' : 'text-gray-400 hover:text-day-teal'}`}
       >
         <Pen size={10} />
         <span>افزودن یادداشت</span>
       </button>
     </div>
  );
};

const ChatArea: React.FC<ChatAreaProps> = ({ 
  messages, 
  isLoading, 
  selectedModel,
  onQuickPrompt, 
  onToggleBookmark, 
  onUpdateBookmarkNote,
  onRetry,
  onSwitchModelRetry,
  onOpenSettings
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  // Export/Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState('');

  // Bookmark State
  const [showBookmarks, setShowBookmarks] = useState(false);
  
  // Bookmark Note Editing State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState('');

  // Scroll To Top State
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Auto-switch loading state
  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitchClick = () => {
    setIsSwitching(true);
    onSwitchModelRetry();
    setTimeout(() => setIsSwitching(false), 3000);
  };

  // Filter messages for display
  const displayMessages = useMemo(() => {
    return showBookmarks ? messages.filter(m => m.isBookmarked) : messages;
  }, [messages, showBookmarks]);

  // Calculate matches
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return displayMessages
      .filter(m => m.text.toLowerCase().includes(lowerQuery))
      .map(m => m.id);
  }, [displayMessages, searchQuery]);

  // Reset index when query changes
  useEffect(() => {
    if (matches.length > 0) {
      setCurrentMatchIndex(matches.length - 1);
    } else {
      setCurrentMatchIndex(-1);
    }
  }, [matches.length, searchQuery]);

  // Scroll to match logic
  useEffect(() => {
    if (currentMatchIndex >= 0 && currentMatchIndex < matches.length) {
      const msgId = matches[currentMatchIndex];
      const element = document.getElementById(`msg-${msgId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentMatchIndex, matches]);

  // Auto-scroll to bottom on new message ONLY if not searching or viewing bookmarks
  useEffect(() => {
    if (!isSearchOpen && !isPreviewOpen && !showBookmarks) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isSearchOpen, isPreviewOpen, showBookmarks]);

  // Scroll Listener for Scroll-to-Top Button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard Shortcuts for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 10);
      }
      if (e.key === 'Escape') {
        if (isSearchOpen) closeSearch();
        if (isPreviewOpen) setIsPreviewOpen(false);
        if (editingNoteId) handleCancelEdit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, isPreviewOpen, editingNoteId]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShare = async (msg: Message) => {
    let origin = 'https://dayins.com';
    if (window.location.origin && window.location.origin !== 'null' && window.location.origin !== 'about:blank') {
      origin = window.location.origin;
    }

    const textToShare = `پاسخ هوش مصنوعی بیمه دی:\n\n${msg.text}\n\n----------------\n`;
    
    const performClipboardFallback = async () => {
      try {
        await navigator.clipboard.writeText(textToShare + `لینک: ${origin}`);
        setSharedId(msg.id);
        setTimeout(() => setSharedId(null), 2000);
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    };

    if (navigator.share) {
      try {
        const shareData: ShareData = {
          title: 'دستیار هوشمند بیمه دی',
          text: textToShare,
        };
        if (origin.startsWith('http')) {
            shareData.url = origin;
        }
        await navigator.share(shareData);
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        await performClipboardFallback();
      }
    } else {
      await performClipboardFallback();
    }
  };

  // --- NOTE EDITING HANDLERS ---
  
  const handleStartEditNote = (msg: Message) => {
    setEditingNoteId(msg.id);
    setNoteContent(msg.bookmarkNote || '');
  };

  const handleSaveNote = (id: string) => {
    onUpdateBookmarkNote(id, noteContent);
    setEditingNoteId(null);
    setNoteContent('');
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setNoteContent('');
  };

  // --- EXPORT HANDLERS ---

  const handleCopyAll = async () => {
    const fullText = displayMessages.map(m => 
      `${m.role === Role.USER ? 'کاربر' : 'هوش مصنوعی بیمه دی'}:\n${m.text}\n${m.bookmarkNote ? `[یادداشت: ${m.bookmarkNote}]\n` : ''}-------------------\n`
    ).join('\n');
    
    try {
      await navigator.clipboard.writeText(fullText);
      setExportSuccess('کپی شد!');
      setTimeout(() => setExportSuccess(''), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWordExport = async () => {
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: [
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: "گزارش گفتگوی هوشمند - بیمه دی",
                bold: true,
                size: 32,
                font: "Vazirmatn"
              }),
            ],
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 400 },
            bidirectional: true
          }),
          ...displayMessages.flatMap(m => [
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: m.role === Role.USER ? "کاربر:" : "هوش مصنوعی بیمه دی:",
                  bold: true,
                  color: m.role === Role.USER ? "008C95" : "D81B60",
                  size: 24,
                }),
              ],
              spacing: { before: 200 },
              bidirectional: true
            }),
            new docx.Paragraph({
              children: [
                new docx.TextRun({
                  text: m.text,
                  size: 22,
                }),
              ],
              spacing: { after: 200 },
              bidirectional: true
            }),
            ...(m.bookmarkNote ? [
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: `یادداشت: ${m.bookmarkNote}`,
                            italics: true,
                            size: 20,
                            color: "666666"
                        })
                    ],
                    spacing: { after: 100 },
                    bidirectional: true
                })
            ] : []),
            new docx.Paragraph({
              children: [],
              border: { bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "CCCCCC" } }
            })
          ])
        ],
      }],
    });

    const blob = await docx.Packer.toBlob(doc);
    saveAs(blob, `BimehDay_Chat_${new Date().toISOString().slice(0,10)}.docx`);
    setExportSuccess('فایل Word دانلود شد');
    setTimeout(() => setExportSuccess(''), 3000);
  };

  // --- NAVIGATION HANDLERS ---

  const handleNext = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex(prev => (prev + 1) % matches.length);
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    setCurrentMatchIndex(prev => (prev - 1 + matches.length) % matches.length);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // --- RENDER HELPERS ---

  const HighlightText = ({ text }: { text: string }) => {
    if (!searchQuery.trim()) return <>{text}</>;
    const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="bg-yellow-300 text-black rounded px-0.5 shadow-sm font-bold animate-pulse">
              {part}
            </span>
          ) : part
        )}
      </>
    );
  };

  const renderWithHighlight = (children: React.ReactNode) => {
    return React.Children.map(children, child => {
      if (typeof child === 'string') {
        return <HighlightText text={child} />;
      }
      return child;
    });
  };

  const markdownComponents = {
    p: ({ children, ...props }: any) => (
      <p className="mb-3 last:mb-0 break-words" {...props}>
        {renderWithHighlight(children)}
      </p>
    ),
    li: ({ children, ...props }: any) => (
      <li {...props}>
         {renderWithHighlight(children)}
      </li>
    ),
    h1: ({ node, children, ...props }: any) => (
      <h1 className="text-xl font-bold my-3 text-day-dark pb-2 border-b border-gray-100" {...props}>
        {renderWithHighlight(children)}
      </h1>
    ),
    h2: ({ node, children, ...props }: any) => (
      <h2 className="text-lg font-bold my-3 text-day-teal" {...props}>
        {renderWithHighlight(children)}
      </h2>
    ),
    strong: ({ node, children, ...props }: any) => (
      <strong className="font-bold text-day-dark" {...props}>
        {renderWithHighlight(children)}
      </strong>
    ),
    ul: ({node, ...props}: any) => <ul className="list-disc list-inside my-2 space-y-2 marker:text-day-teal" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal list-inside my-2 space-y-2 marker:text-day-teal" {...props} />,
    a: ({node, ...props}: any) => <a className="text-day-teal hover:text-day-dark hover:underline underline-offset-4 decoration-1 break-all transition-colors" {...props} />,
    code: ({node, ...props}: any) => <code className="bg-gray-100 px-1 rounded text-sm font-mono text-red-500" {...props} />,
    table: ({node, ...props}: any) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm" {...props} />
      </div>
    ),
    thead: ({node, ...props}: any) => <thead className="bg-gray-50" {...props} />,
    tbody: ({node, ...props}: any) => <tbody className="bg-white divide-y divide-gray-200" {...props} />,
    tr: ({node, ...props}: any) => <tr className="hover:bg-gray-50 transition-colors" {...props} />,
    th: ({node, ...props}: any) => <th className="px-4 py-3 text-right font-bold text-gray-500 uppercase tracking-wider" {...props} />,
    td: ({node, ...props}: any) => <td className="px-4 py-3 whitespace-nowrap text-gray-700 border-l border-gray-100 last:border-0" {...props} />,
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-day-bg relative overflow-hidden">
      
      {/* Sticky Header Toolbar */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-2">
            {/* Action Buttons */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setShowBookmarks(!showBookmarks)} 
                  className={`p-2 rounded-md transition-all ${showBookmarks ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  title={showBookmarks ? "نمایش همه پیام‌ها" : "فقط نمایش نشان‌شده‌ها"}
                >
                  <Bookmark size={18} className={showBookmarks ? "fill-current" : ""} />
                </button>
                <button 
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`p-2 rounded-md transition-all ${isSearchOpen ? 'bg-white text-day-teal shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  title="جستجو در چت"
                >
                   <Search size={18} />
                </button>
                <button 
                   onClick={() => setIsPreviewOpen(true)}
                   className="p-2 rounded-md text-gray-500 hover:text-gray-700 transition-all hover:bg-white hover:shadow-sm"
                   title="خروجی / پیش‌نمایش"
                >
                   <Download size={18} />
                </button>
            </div>
         </div>

         {isSearchOpen && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4 flex items-center gap-2 animate-fade-in">
                <div className="flex-1 relative">
                    <input 
                        ref={searchInputRef}
                        type="text" 
                        className="w-full bg-white border border-day-teal rounded-lg pl-10 pr-4 py-2 text-sm shadow-lg focus:outline-none"
                        placeholder="جستجو در مکالمه..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-gray-400">
                        {matches.length > 0 ? `${currentMatchIndex + 1} از ${matches.length}` : '0'}
                    </span>
                </div>
                <button onClick={handleNext} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><ChevronUp size={16} /></button>
                <button onClick={handlePrev} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><ChevronDown size={16} /></button>
                <button onClick={closeSearch} className="p-2 text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
         )}
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-day-dark flex items-center gap-2">
                <Eye size={20} />
                پیش‌نمایش و خروجی
              </h3>
              <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 bg-gray-100 overflow-y-auto p-8 custom-scrollbar">
               <div id="print-area" className="bg-white shadow-lg mx-auto max-w-[210mm] min-h-[297mm] p-[20mm] text-black">
                  <div className="text-center border-b-2 border-gray-800 pb-4 mb-8">
                      <h1 className="text-3xl font-black mb-2">گزارش گفتگوی هوشمند</h1>
                      <p className="text-sm text-gray-600">بیمه دی - دستیار تحلیل بیمه‌نامه</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleDateString('fa-IR', {dateStyle: 'full'})}</p>
                  </div>
                  <div className="space-y-6">
                      {displayMessages.map(msg => (
                          <div key={msg.id} className="break-inside-avoid">
                              <p className="font-bold text-sm mb-1 flex items-center gap-2">
                                  {msg.role === Role.USER ? <span className="text-day-teal">● کاربر:</span> : <span className="text-day-accent">● هوش مصنوعی:</span>}
                              </p>
                              <div className="text-justify text-sm leading-7 whitespace-pre-wrap border-l-2 border-gray-100 pr-3">
                                  {msg.text}
                              </div>
                              {msg.bookmarkNote && (
                                  <div className="mt-1 text-xs text-gray-500 italic pr-3">
                                      یادداشت: {msg.bookmarkNote}
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
                  <div className="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                      این گزارش توسط دستیار هوشمند بیمه دی تولید شده است.
                  </div>
               </div>
            </div>

            <div className="bg-white p-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
               <span className="text-sm font-bold text-green-600 animate-fade-in">{exportSuccess}</span>
               <div className="flex items-center gap-2">
                  <button onClick={handleCopyAll} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold transition-all">
                      <ClipboardList size={18} /> کپی متن
                  </button>
                  <button onClick={handleWordExport} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-sm font-bold transition-all">
                      <FileText size={18} /> دانلود Word
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-day-dark text-white hover:bg-gray-800 text-sm font-bold transition-all shadow-md">
                      <Printer size={18} /> چاپ / PDF
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="absolute bottom-6 right-6 z-30 p-3 bg-white/90 backdrop-blur text-day-teal shadow-lg rounded-full hover:bg-day-teal hover:text-white transition-all duration-300 animate-fade-in border border-gray-100 active:scale-95 hidden md:flex items-center justify-center"
          title="بازگشت به بالا"
        >
          <ArrowUp size={20} />
        </button>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar no-print scroll-smooth">
        <div className="max-w-5xl mx-auto space-y-8 pb-4">
          {messages.length === 0 && (
            /* Welcome Screen */
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-gray-400 opacity-90">
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-cyan-100/50 border border-gray-100 rotate-3 hover:rotate-0 transition-transform duration-500">
                <Bot size={40} className="text-day-teal" />
              </div>
              <h2 className="text-2xl font-black text-day-dark mb-3 tracking-tight text-center">دستیار هوشمند بیمه دی</h2>
              <p className="text-center max-w-md text-gray-500 leading-7 mb-10 px-4 font-medium">
                برای شروع، اسناد خود را بارگذاری کنید یا یکی از موضوعات زیر را انتخاب نمایید:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl px-2">
                {QUICK_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => onQuickPrompt && onQuickPrompt(prompt.question)}
                    className="flex items-start gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-day-teal/40 hover:bg-cyan-50/30 transition-all duration-200 text-right group w-full"
                  >
                    <div className="p-3 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-white group-hover:text-day-teal transition-colors shrink-0">
                      {prompt.icon}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-day-dark text-sm">{prompt.title}</span>
                      <span className="text-xs text-gray-500 leading-5 group-hover:text-gray-700 text-right">{prompt.question}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {displayMessages.map((msg) => {
             const isCurrentMatch = matches[currentMatchIndex] === msg.id;
             
             return (
              <div 
                key={msg.id} 
                id={`msg-${msg.id}`}
                className={`flex w-full transition-colors duration-500 ${isCurrentMatch ? 'bg-yellow-50/50 -mx-4 px-4 py-2 rounded-lg' : ''} ${msg.role === Role.USER ? 'justify-start' : 'justify-end'}`}
              >
                <div className={`flex max-w-[90%] md:max-w-[80%] lg:max-w-[75%] xl:max-w-[70%] gap-3 md:gap-4 group relative ${msg.role === Role.MODEL ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {msg.role === Role.USER && (
                    <button 
                      onClick={() => onToggleBookmark(msg.id)}
                      className={`absolute top-1/2 -translate-y-1/2 -left-8 p-1.5 rounded-full transition-opacity duration-200 ${msg.isBookmarked ? 'opacity-100 text-yellow-500' : 'opacity-0 group-hover:opacity-100 text-gray-300 hover:text-yellow-500'}`}
                    >
                      <Bookmark size={18} className={msg.isBookmarked ? "fill-current" : ""} />
                    </button>
                  )}

                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md
                    ${msg.role === Role.USER ? 'bg-day-dark text-white' : 'bg-white text-day-teal border border-gray-100'}
                  `}>
                    {msg.role === Role.USER ? <User size={18} className="md:w-5 md:h-5" /> : <Bot size={20} className="md:w-6 md:h-6" />}
                  </div>

                  <div className={`
                    p-4 md:p-5 text-sm md:text-base shadow-sm overflow-hidden relative
                    ${msg.role === Role.USER 
                      ? 'bg-day-teal text-white rounded-2xl rounded-tr-sm leading-7' 
                      : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100'}
                    ${msg.isError ? 'border-day-accent/30 bg-red-50 text-day-accent' : ''}
                  `}>
                    {msg.role === Role.MODEL && msg.isBookmarked && (
                      <div className="absolute -left-6 top-3 bg-yellow-400 w-16 h-4 -rotate-45 flex justify-center items-center shadow-sm z-10"></div>
                    )}

                    {msg.role === Role.MODEL ? (
                      <div className="markdown-body text-right w-full break-words text-justify leading-loose" dir="rtl">
                        <ReactMarkdown components={markdownComponents}>
                          {msg.text}
                        </ReactMarkdown>
                        
                        {/* Error Action Buttons */}
                        {msg.isError && (
                          <div className="mt-4 flex flex-wrap gap-2 pt-2 border-t border-red-100">
                             <button 
                               onClick={onRetry}
                               className="flex items-center gap-1 text-xs bg-white text-day-dark border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm font-medium"
                             >
                               <RefreshCcw size={14} />
                               تلاش مجدد
                             </button>
                             
                             <button 
                               onClick={handleSwitchClick}
                               disabled={isSwitching}
                               className="flex items-center gap-1 text-xs bg-day-teal text-white border border-transparent px-3 py-1.5 rounded-lg hover:bg-day-dark transition-colors shadow-sm font-medium disabled:opacity-70 disabled:cursor-not-allowed"
                             >
                               {isSwitching ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                               تلاش با مدل جایگزین
                             </button>

                             <button 
                               onClick={onOpenSettings}
                               className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 border border-transparent px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                             >
                               <Key size={14} />
                               تنظیمات API
                             </button>
                          </div>
                        )}

                        {msg.isBookmarked && (
                          <BookmarkNote 
                            msg={msg}
                            editingNoteId={editingNoteId}
                            noteContent={noteContent}
                            onNoteContentChange={setNoteContent}
                            onStartEdit={handleStartEditNote}
                            onCancelEdit={handleCancelEdit}
                            onSaveNote={handleSaveNote}
                          />
                        )}

                        {!msg.isError && (
                           /* ... Share/Copy actions ... */
                          <div className="flex justify-end mt-4 pt-3 border-t border-dashed border-gray-200 no-print gap-2">
                            
                            <button
                              onClick={() => onToggleBookmark(msg.id)}
                              className={`flex items-center gap-1.5 transition-colors px-2 py-1 rounded ${msg.isBookmarked ? 'text-yellow-600 bg-yellow-50' : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'}`}
                              title={msg.isBookmarked ? "حذف نشان" : "نشان کردن"}
                            >
                              <Bookmark size={16} className={msg.isBookmarked ? "fill-current" : ""} />
                            </button>
                            
                            <div className="w-px h-4 bg-gray-300 self-center mx-1"></div>

                            <button
                              onClick={() => handleShare(msg)}
                              className="flex items-center gap-1.5 text-gray-400 hover:text-blue-500 transition-colors px-2 py-1 rounded hover:bg-blue-50"
                              title="اشتراک‌گذاری"
                            >
                              {sharedId === msg.id ? (
                                <>
                                  <Check size={16} className="text-blue-500" />
                                  <span className="text-xs text-blue-600 font-medium">کپی شد</span>
                                </>
                              ) : (
                                <>
                                  <Share size={16} />
                                  <span className="text-xs font-medium hidden md:inline">اشتراک</span>
                                </>
                              )}
                            </button>

                            <div className="w-px h-4 bg-gray-300 self-center mx-1"></div>

                            <button
                              onClick={() => handleCopy(msg.id, msg.text)}
                              className="flex items-center gap-1.5 text-gray-400 hover:text-day-teal transition-colors px-2 py-1 rounded hover:bg-cyan-50"
                              title="کپی متن"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check size={16} className="text-green-500" />
                                  <span className="text-xs text-green-600 font-medium">کپی شد</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={16} />
                                  <span className="text-xs font-medium hidden md:inline">کپی</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap break-words">
                        <HighlightText text={msg.text} />
                        {msg.isBookmarked && (
                          <BookmarkNote 
                            msg={msg}
                            editingNoteId={editingNoteId}
                            noteContent={noteContent}
                            onNoteContentChange={setNoteContent}
                            onStartEdit={handleStartEditNote}
                            onCancelEdit={handleCancelEdit}
                            onSaveNote={handleSaveNote}
                          />
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex w-full justify-end animate-fade-in">
              <div className="flex gap-4 max-w-[90%] md:max-w-[80%] flex-row-reverse">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-2xl bg-white text-day-teal border border-gray-100 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div className="bg-white p-4 md:p-5 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 ml-2">در حال نوشتن</span>
                    <div className="w-2 h-2 bg-day-teal/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-day-teal/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-day-teal rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
