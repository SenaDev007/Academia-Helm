/**
 * ParentSaraAssistant Component
 * 
 * Assistant IA personnalisé pour les parents (SARA)
 * Fournit des conseils pédagogiques basés sur le suivi de l'enfant.
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  X,
  Lightbulb,
  Target,
  Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ParentSaraAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Bonjour ! Je suis Sarah, votre assistante pédagogique. Sur la base des récents devoirs de votre enfant, j'ai remarqué un excellent engagement en Mathématiques. Souhaitez-vous des conseils pour maintenir cette dynamique ?" }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setInput('');
    
    // Simulation réponse Sara
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "C'est noté. Pour accompagner votre enfant sur les fractions (sujet du prochain devoir), je vous suggère de pratiquer des exercices visuels 15 minutes par soir." 
      }]);
    }, 1000);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
      >
        <Sparkles className="w-7 h-7 group-hover:rotate-12 transition-transform" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-28 right-8 w-96 h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold">Sarah AI</h3>
                  <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Conseillère Pédagogique</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Insights (Top Cards) */}
            <div className="px-6 py-4 bg-indigo-50/50 flex gap-2 overflow-x-auto no-scrollbar border-b border-indigo-100/50">
              {[
                { icon: Lightbulb, label: 'Conseil', color: 'text-amber-600' },
                { icon: Target, label: 'Objectif', color: 'text-blue-600' },
                { icon: Trophy, label: 'Succès', color: 'text-emerald-600' },
              ].map((item, i) => (
                <button key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-indigo-100 shadow-sm whitespace-nowrap">
                  <item.icon className={cn("w-3 h-3", item.color)} />
                  <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white text-slate-700 border border-slate-100 shadow-sm rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-50">
              <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-100">
                <input 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Posez une question à Sara..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs px-2 font-medium"
                />
                <button 
                  onClick={handleSend}
                  className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
