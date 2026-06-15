/**
 * InAppSaraGuide — SARA Guide Utilisateur In-App
 *
 * SARA guides users through the Academia Helm interface.
 * Contextual help based on current module, user role, and page.
 * Connected to the SARA in-app API for real AI responses.
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  X,
  Compass,
  Lightbulb,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isAiEnhanced?: boolean;
  timestamp?: string;
}

interface InAppSaraGuideProps {
  /** Current user role for contextual responses */
  userRole?: string;
  /** Current module being viewed */
  currentModule?: string;
  /** Current page/section path */
  currentPath?: string;
  /** Color theme variant */
  variant?: 'blue' | 'indigo' | 'emerald' | 'orange';
}

const MODULE_GUIDES: Record<string, { label: string; icon: string }> = {
  students: { label: 'Élèves & Inscriptions', icon: '👨‍🎓' },
  pedagogy: { label: 'Pédagogie', icon: '📚' },
  exams: { label: 'Examens & Bulletins', icon: '📝' },
  finance: { label: 'Finance & Économat', icon: '💰' },
  hr: { label: 'RH & Paie', icon: '👥' },
  communication: { label: 'Communication', icon: '📱' },
  qhse: { label: 'QHSE & Incidents', icon: '🛡️' },
  orion: { label: 'ORION (IA)', icon: '🧠' },
  atlas: { label: 'ATLAS (IA)', icon: '🤖' },
  settings: { label: 'Paramètres', icon: '⚙️' },
};

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  director: [
    "Comment voir les alertes ORION ?",
    "Où trouver les impayés ?",
    "Comment générer un rapport mensuel ?",
    "Comment configurer l'année scolaire ?",
  ],
  teacher: [
    "Comment saisir les notes ?",
    "Où trouver mon emploi du temps ?",
    "Comment générer des exercices ?",
    "Comment contacter les parents ?",
  ],
  accountant: [
    "Comment voir les impayés ?",
    "Comment enregistrer un paiement ?",
    "Où trouver le rapport financier ?",
    "Comment configurer les frais de scolarité ?",
  ],
  parent: [
    "Comment voir les notes de mon enfant ?",
    "Où trouver les factures ?",
    "Comment contacter l'école ?",
    "Comment voir les absences ?",
  ],
  secretary: [
    "Comment inscrire un nouvel élève ?",
    "Comment exporter vers Educmaster ?",
    "Où gérer les dossiers élèves ?",
    "Comment générer une attestation ?",
  ],
};

const VARIANT_STYLES = {
  blue: { bg: 'bg-blue-600', gradient: 'from-blue-600 to-blue-800', hover: 'hover:bg-blue-700' },
  indigo: { bg: 'bg-indigo-600', gradient: 'from-indigo-600 to-indigo-800', hover: 'hover:bg-indigo-700' },
  emerald: { bg: 'bg-emerald-600', gradient: 'from-emerald-600 to-emerald-800', hover: 'hover:bg-emerald-700' },
  orange: { bg: 'bg-orange-600', gradient: 'from-orange-600 to-orange-800', hover: 'hover:bg-orange-700' },
};

export default function InAppSaraGuide({
  userRole = 'director',
  currentModule = 'students',
  currentPath,
  variant = 'blue',
}: InAppSaraGuideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const moduleInfo = MODULE_GUIDES[currentModule] || MODULE_GUIDES.students;
  const suggestions = ROLE_SUGGESTIONS[userRole] || ROLE_SUGGESTIONS.director;
  const styles = VARIANT_STYLES[variant];

  // Initialize with contextual welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMsg = buildWelcomeMessage(userRole, currentModule);
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcomeMsg,
        isAiEnhanced: false,
      }]);
    }
  }, [userRole, currentModule]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const buildWelcomeMessage = (role: string, module: string): string => {
    const moduleName = MODULE_GUIDES[module]?.label || 'Academia Helm';
    const roleWelcome: Record<string, string> = {
      director: `Bonjour ! Je suis SARA, votre guide dans Academia Helm. 🧭 Vous êtes dans le module **${moduleName}**. Je peux vous aider à naviguer, comprendre une fonctionnalité ou répondre à vos questions. Que puis-je faire pour vous ?`,
      teacher: `Bonjour ! Je suis SARA, votre assistante pédagogique. 📚 Vous êtes dans **${moduleName}**. Je peux vous guider dans la saisie des notes, la consultation de votre EDT, la génération d'exercices et plus. Comment puis-je vous aider ?`,
      accountant: `Bonjour ! Je suis SARA, votre assistante financière. 💰 Vous êtes dans **${moduleName}**. Je peux vous guider dans le recouvrement, les paiements, les rapports financiers. Que voulez-vous faire ?`,
      parent: `Bonjour ! Je suis SARA, votre assistante. 👋 Vous êtes dans **${moduleName}**. Je peux vous aider à consulter les notes, absences, factures de votre enfant. Que souhaitez-vous savoir ?`,
      secretary: `Bonjour ! Je suis SARA, votre assistante scolarité. 📋 Vous êtes dans **${moduleName}**. Je peux vous guider pour les inscriptions, les dossiers, l'export Educmaster. Comment puis-je vous aider ?`,
    };
    return roleWelcome[role] || roleWelcome.director;
  };

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    const userMessage = text;
    setInput('');
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    }]);
    setIsLoading(true);

    try {
      // Build conversation history
      const history = messages
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/public/sara/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...history, { role: 'user', content: userMessage }],
          mode: 'inapp',
          userRole,
          currentModule,
        }),
      });

      const data = await res.json();

      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_resp',
        role: 'assistant',
        content: data.text || data.reply || "Désolé, je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        isAiEnhanced: !data.isPlaceholder,
        timestamp: new Date().toISOString(),
      }]);
    } catch (error) {
      console.error('Sara guide error:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: "Une erreur est survenue. Je suis toujours disponible pour vous guider. Que souhaitez-vous faire ?",
        isAiEnhanced: false,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, userRole, currentModule]);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-8 right-8 w-14 h-14 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group border border-white/20",
          styles.bg
        )}
      >
        <div className="relative">
          <Compass className="w-7 h-7 group-hover:rotate-12 transition-transform" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white animate-pulse" />
        </div>
        <div className="absolute right-full mr-3 bg-white text-gray-800 text-xs font-bold py-2 px-3 rounded-lg shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Guide SARA 🧭
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-28 right-8 w-[400px] h-[640px] bg-white rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
            <div className={cn("p-6 bg-gradient-to-r text-white relative overflow-hidden", styles.gradient)}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/20">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">SARA Guide</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                      <span className="text-[10px] font-medium text-white/80">
                        {moduleInfo.icon} {moduleInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Suggestion Chips */}
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 3).map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-[10px] px-3 py-1.5 bg-white rounded-full border border-slate-200 hover:border-blue-300 transition-all whitespace-nowrap shadow-sm text-slate-600 font-medium"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'user'
                      ? cn("text-white rounded-tr-none shadow-sm", styles.bg)
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none shadow-sm"
                  )}>
                    {msg.content}
                    {msg.isAiEnhanced && msg.role === 'assistant' && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400">
                        <Sparkles className="w-3 h-3" />
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
                      <span className="text-sm text-slate-500">SARA réfléchit...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Comment puis-je vous aider ?"
                  disabled={isLoading}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-slate-900 placeholder:text-slate-400 font-medium disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "p-2.5 text-white rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed",
                    styles.bg
                  )}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[9px] text-center text-slate-400 mt-1.5">
                SARA vous guide dans Academia Helm · {moduleInfo.icon} {moduleInfo.label}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
