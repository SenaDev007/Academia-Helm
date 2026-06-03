/**
 * PedagogySaraAssistant Component
 * 
 * Assistant IA (SARA) pour la pédagogie.
 * Support aux enseignants pour la planification des cours, conseils pédagogiques et analyse des résultats.
 * Connecté au backend Sara Compose Engine via /api/pedagogy/ia/copilot
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Send, 
  Bot, 
  X,
  Target,
  Zap,
  TrendingUp,
  BrainCircuit,
  BookOpen,
  Lightbulb,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAiEnhanced?: boolean;
  timestamp?: string;
}

export default function PedagogySaraAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Bonjour ! Je suis Sara, votre assistante pédagogique. Je peux vous aider avec la génération d'épreuves, l'analyse de vos documents, le suivi des cahiers journal et bien plus. Que puis-je faire pour vous ?",
      isAiEnhanced: false,
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/pedagogy/ia/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.reply || "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        isAiEnhanced: data.isAiEnhanced,
        timestamp: data.timestamp,
      }]);
    } catch (error) {
      console.error('Sara copilot error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Une erreur est survenue lors de la communication avec le serveur. Veuillez vérifier que le backend est en cours d'exécution et réessayer.",
        isAiEnhanced: false,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group border border-white/20"
      >
        <div className="relative">
           <BrainCircuit className="w-8 h-8 group-hover:rotate-12 transition-transform" />
           <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-28 right-8 w-[400px] h-[720px] bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-50 overflow-hidden"
          >
            {/* Premium Header */}
            <div className="p-8 bg-indigo-900 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-2xl" />
               <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                        <Bot className="w-7 h-7 text-white" />
                     </div>
                     <div>
                        <h3 className="text-xl font-black italic tracking-tighter">Sara AI</h3>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                           <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Conseil Pédagogique</span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                     <X className="w-5 h-5 text-slate-400" />
                  </button>
               </div>
            </div>

            {/* AI Insights Tabs */}
            <div className="px-8 py-4 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
              {[
                { icon: Lightbulb, label: 'Conseils', color: 'text-amber-500' },
                { icon: BookOpen, label: 'Ressources', color: 'text-indigo-500' },
                { icon: TrendingUp, label: 'Analyse', color: 'text-emerald-500' },
              ].map((item, i) => (
                <button key={i} className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 hover:border-indigo-200 transition-all whitespace-nowrap shadow-sm">
                  <item.icon className={cn("w-3 h-3", item.color)} />
                  <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/30">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-5 rounded-[1.5rem] text-sm leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-200" 
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                  )}>
                    {msg.content}
                    {msg.isAiEnhanced && msg.role === 'assistant' && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-400">
                        <Sparkles className="w-3 h-3" />
                        <span>Amélioré par IA</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-slate-700 border border-slate-100 p-5 rounded-[1.5rem] rounded-tl-none shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="text-sm text-slate-500">Sara réfléchit...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Premium Input Area */}
            <div className="p-6 bg-white border-t border-slate-50">
               <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                  <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="Une idée ou une question pédagogique ?"
                    disabled={isLoading}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-slate-900 placeholder:text-slate-400 font-medium disabled:opacity-50"
                  />
                  <button 
                    onClick={handleSend}
                    disabled={isLoading || !input.trim()}
                    className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
