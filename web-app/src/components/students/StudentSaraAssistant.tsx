/**
 * StudentSaraAssistant Component
 * 
 * Assistant IA (SARA) pour la gestion des élèves.
 * Fournit des analyses prédictives, un support aux gestionnaires
 * et un guide de navigation dans le module Élèves.
 * Connecté au backend via /api/public/sara/chat
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  X,
  Lightbulb,
  Target,
  Zap,
  TrendingUp,
  BrainCircuit,
  Loader2,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAiEnhanced?: boolean;
}

const MODULE_SUGGESTIONS = [
  "Comment inscrire un nouvel élève ?",
  "Où exporter vers Educmaster ?",
  "Comment voir les élèves en retard de dossier ?",
  "Où gérer les transferts ?",
];

export default function StudentSaraAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bonjour ! Je suis Sara, votre assistante pour le module Élèves & Inscriptions. 👨‍🎓 Je peux vous aider à naviguer, gérer les dossiers, les admissions, les transferts ou exporter vers Educmaster. Que puis-je faire pour vous ?",
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/public/sara/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: text }],
          mode: 'inapp',
          userRole: 'director',
          currentModule: 'students',
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.text || data.reply || "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        isAiEnhanced: !data.isPlaceholder,
      }]);
    } catch (error) {
      console.error('Sara assistant error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Une erreur est survenue. Je reste disponible pour vous aider. Que souhaitez-vous faire dans le module Élèves ?",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group border border-white/20"
      >
        <div className="relative">
          <Compass className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </div>
        <div className="absolute right-full mr-3 bg-white text-gray-800 text-xs font-bold py-2 px-3 rounded-lg shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Guide Élèves 🧭
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-28 right-8 w-[400px] h-[650px] bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-br from-blue-600 to-blue-800 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/20">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Sara AI</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-[10px] font-medium text-blue-200 uppercase tracking-widest">Élèves & Inscriptions</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Suggestions */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {MODULE_SUGGESTIONS.slice(0, 3).map((s, i) => (
                  <button key={i} onClick={() => handleSend(s)} className="text-[10px] px-3 py-1.5 bg-white rounded-full border border-slate-200 hover:border-blue-300 transition-all whitespace-nowrap shadow-sm text-slate-600 font-medium">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.role === 'user'
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                  )}>
                    {msg.content}
                    {msg.isAiEnhanced && msg.role === 'assistant' && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400">
                        <Zap className="w-3 h-3" />
                        <span>Amélioré par IA</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white text-slate-700 border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span className="text-sm text-slate-500">Sara réfléchit...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-50">
              <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Question sur le module Élèves ?"
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-slate-900 placeholder:text-slate-400 font-medium disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
