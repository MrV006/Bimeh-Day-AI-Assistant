import React, { useState, KeyboardEvent, useRef, useEffect } from 'react';
import { Send } from './Icons';

interface InputAreaProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize logic
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height momentarily to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Set new height, capped at 200px
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput('');
    // Reset height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Fix: Check isComposing to avoid sending when selecting words in Persian IME
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white p-4 border-t border-gray-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.02)] relative z-10">
      <div className="max-w-5xl mx-auto relative">
        <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl p-2 focus-within:border-day-teal focus-within:ring-2 focus-within:ring-cyan-50 focus-within:shadow-lg transition-all duration-300">
          
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="از هوش مصنوعی بیمه دی بپرسید..."
            className="w-full max-h-[200px] bg-transparent border-none focus:ring-0 resize-none py-3 px-3 text-gray-700 text-sm md:text-base leading-relaxed placeholder-gray-400 custom-scrollbar"
            rows={1}
            style={{ minHeight: '48px', overflowY: 'auto' }}
            disabled={isLoading}
          />
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`
              p-3 rounded-xl mb-1 transition-all duration-200 flex items-center justify-center shrink-0
              ${!input.trim() || isLoading 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-day-teal text-white hover:bg-day-dark shadow-md hover:shadow-xl transform hover:-translate-y-0.5'}
            `}
          >
            <Send size={20} className={isLoading ? 'opacity-0' : 'opacity-100'} />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-3 font-medium hidden md:block leading-relaxed">
          این هوش مصنوعی ممکن است اشتباه کند. همیشه <span className="text-day-teal">شرایط عمومی بیمه‌نامه‌ها</span> را بررسی کنید.
        </p>
      </div>
    </div>
  );
};

export default InputArea;