/**
 * ExamSaraAssistant Component
 * 
 * Assistant IA (SARA) pour la gestion des examens.
 * Analyse des performances, prévisions de réussite et détection des biais de notation.
 */

'use client';

import { useState } from 'react';
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
  BarChart3,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ExamSaraAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Bonjour ! Je suis Sarah. J'ai analysé les résultats provisoires du Bac Blanc. Le taux de réussite prévisionnel est de 74%. J'ai identifié 15 élèves 'à risque' dont la moyenne est entre 9 et 9.5. Voulez-vous voir la liste pour les commissions de délibération ?" 
    }
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
        content: "Analyse des biais terminée. J'ai remarqué une sévérité de notation accrue de 12% sur l'épreuve de Philosophie cette année par rapport à l'historique de l'institution. Voulez-vous que je simule l'impact d'un coefficient de péréquation ?" 
      }]);
    }, 1200);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group border border-white/20"
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
            className="fixed bottom-28 right-8 w-[420px] h-[720px] bg-slate-950 text-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-slate-800 flex flex-col z-50 overflow-hidden"
          >
            {/* Premium Header */}
            <div className="p-8 bg-gradient-to-br from-slate-800 to-slate-950 relative overflow-hidden border-b border-slate-800">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
               <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-white/10">
                        <Bot className="w-7 h-7 text-emerald-400" />
                     </div>
                     <div>
                        <h3 className="text-xl font-black italic tracking-tighter">Sarah AI Examen</h3>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intelligence Analytique</span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-all">
                     <X className="w-5 h-5 text-slate-400" />
                  </button>
               </div>
            </div>

            {/* AI Action Tabs */}
            <div className="px-8 py-4 bg-slate-900/50 border-b border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
              {[
                { icon: Award, label: 'Prévision Réussite', color: 'text-emerald-400' },
                { icon: BarChart3, label: 'Analyse Biais', color: 'text-blue-400' },
                { icon: TrendingUp, label: 'Élèves à risque', color: 'text-rose-400' },
              ].map((item, i) => (
                <button key={i} className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-slate-800 hover:bg-slate-800 transition-all whitespace-nowrap">
                  <item.icon className={cn("w-3 h-3", item.color)} />
                  <span className="text-[10px] font-bold text-slate-400">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-5 rounded-[1.5rem] text-sm leading-relaxed shadow-lg",
                    msg.role === 'user' 
                      ? "bg-emerald-600 text-white rounded-tr-none" 
                      : "bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Premium Input Area */}
            <div className="p-6 bg-slate-950 border-t border-slate-800">
               <div className="flex items-center gap-3 bg-slate-900 rounded-2xl p-3 border border-slate-800 focus-within:border-emerald-500/50 transition-all">
                  <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Posez une question sur les résultats..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-slate-200 placeholder:text-slate-600 font-medium"
                  />
                  <button 
                    onClick={handleSend}
                    className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/20"
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
