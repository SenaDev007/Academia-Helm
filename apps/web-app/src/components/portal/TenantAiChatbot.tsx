'use client';

/**
 * ============================================================================
 * TENANT AI CHATBOT — Assistant IA propre à chaque école
 * ============================================================================
 *
 * Widget flottant affiché sur le site institutionnel public.
 * Répond aux questions des visiteurs en utilisant les données
 * configurées par l'établissement (FAQ, présentation, admissions, etc.).
 *
 * Utilise l'API ORION existante pour le traitement du langage naturel.
 * ============================================================================
 */

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TenantAiChatbotProps {
  tenantSlug: string;
  welcomeMessage?: string;
  faqItems?: any[];
}

export default function TenantAiChatbot({ tenantSlug, welcomeMessage, faqItems = [] }: TenantAiChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: welcomeMessage || `Bonjour ! Je suis l'assistant virtuel de l'établissement. Comment puis-je vous aider ? Vous pouvez me poser des questions sur les admissions, les frais de scolarité, les niveaux disponibles, etc.`,
        },
      ]);
    }
  }, [isOpen, welcomeMessage, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Construire le contexte à partir des FAQ
      const faqContext = faqItems.length > 0
        ? '\n\nFAQ de l\'établissement :\n' + faqItems.map(f => `Q: ${f.question}\nR: ${f.answer}`).join('\n\n')
        : '';

      const response = await fetch('/api/tenant-website/public/' + tenantSlug + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          context: faqContext,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response || data.message || 'Je suis désolé, je n\'ai pas pu traiter votre demande. N\'hésitez pas à contacter l\'établissement directement.',
        }]);
      } else {
        // Fallback : essayer de répondre depuis les FAQ
        const faqMatch = faqItems.find(f =>
          userMessage.content.toLowerCase().includes(f.question.toLowerCase().split(' ')[0]) ||
          f.question.toLowerCase().includes(userMessage.content.toLowerCase().split(' ')[0])
        );

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: faqMatch
            ? faqMatch.answer
            : 'Je suis désolé, je n\'ai pas pu traiter votre demande pour le moment. Pour toute question spécifique, n\'hésitez pas à contacter l\'établissement directement via le formulaire de contact.',
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Une erreur est survenue. Veuillez réessayer ou contacter l\'établissement directement.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #0b2f73, #1d4fa5)' }}
        aria-label="Assistant IA"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 text-white flex items-center gap-3" style={{ background: 'linear-gradient(135deg, #0b2f73, #1d4fa5)' }}>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-sm font-bold">Assistant IA</p>
                <p className="text-[10px] text-white/70">Posez vos questions</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user' ? 'bg-blue-100' : 'bg-slate-200'
                    }`}>
                      {msg.role === 'user' ? <User size={14} className="text-blue-600" /> : <Bot size={14} className="text-slate-600" />}
                    </div>
                    <div className={`rounded-xl px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-400">
                    <span className="animate-pulse">...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Votre question..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 transition hover:bg-blue-700"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
