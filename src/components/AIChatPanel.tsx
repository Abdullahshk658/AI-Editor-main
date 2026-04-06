import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Sparkles, Loader2, ArrowRight, Bot, User, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Message {
  role: 'user' | 'ai';
  text: string;
  type?: 'status' | 'suggestion' | 'error';
  timestamp: number;
}

export const AIChatPanel = ({ onCommand, isProcessing }: { onCommand: (cmd: string) => void, isProcessing: boolean }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'ai', 
      text: "Hello! I'm your AI editing assistant. I can handle complex requests like 'Cut the first 10 seconds and make it cinematic'.",
      timestamp: Date.now()
    }
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const suggestions = [
    "Trim first 5 seconds",
    "Apply cinematic filter",
    "Enhance audio quality",
    "Make it 2x faster",
    "Auto-generate subtitles",
    "Add noir filter",
    "Color correct for vivid look"
  ];

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', text: userMsg, timestamp: Date.now() }]);
    setInput('');
    onCommand(userMsg);
  };

  return (
    <div className="flex flex-col h-full bg-[#141414] border-l border-[#222] w-85 shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-[#222] flex items-center justify-between bg-gradient-to-r from-purple-900/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-600/20 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm tracking-tight">AI Assistant</h2>
            <p className="text-[10px] text-gray-500 font-medium">Powered by Gemini</p>
          </div>
        </div>
        {isProcessing && (
          <div className="flex items-center gap-2 px-2 py-1 bg-purple-500/10 rounded-full border border-purple-500/20">
            <Loader2 className="w-3 h-3 text-purple-500 animate-spin" />
            <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Thinking</span>
          </div>
        )}
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth scrollbar-hide">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              key={msg.timestamp + i} 
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                msg.role === 'user' 
                  ? "bg-purple-600 border-purple-500" 
                  : "bg-[#222] border-[#333]"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-purple-400" />}
              </div>
              <div className={cn(
                "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                msg.role === 'user' 
                  ? "bg-purple-600 text-white rounded-tr-none" 
                  : "bg-[#222] text-gray-300 rounded-tl-none border border-[#333]"
              )}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-[#222] border border-[#333] flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-purple-400 animate-pulse" />
            </div>
            <div className="bg-[#222] border border-[#333] p-3 rounded-2xl rounded-tl-none flex gap-1 items-center">
              <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-1 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </div>

      <div className="px-4 pb-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase mb-2 tracking-widest flex items-center gap-1">
          <Wand2 className="w-3 h-3" /> Quick Actions
        </p>
        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-hide">
          {suggestions.map(s => (
            <button 
              key={s}
              onClick={() => { setInput(s); }}
              className="text-[10px] bg-[#1a1a1a] hover:bg-purple-600/20 border border-[#333] hover:border-purple-500/50 px-3 py-1.5 rounded-full text-gray-400 hover:text-white transition-all whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-[#1a1a1a] border-t border-[#222]">
        <div className="relative group">
          <input
            type="text"
            value={input}
            disabled={isProcessing}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isProcessing ? "AI is processing..." : "Command your edit..."}
            className="w-full bg-[#0f0f0f] border border-[#333] text-white text-sm rounded-xl py-3 px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all placeholder:text-gray-600"
          />
          <button 
            type="submit" 
            disabled={isProcessing || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:bg-gray-700 transition-all"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[9px] text-gray-600 mt-2 text-center">Press Enter to send</p>
      </form>
    </div>
  );
};
