'use client';

import { useState, useRef, useEffect } from 'react';
import { saraApi } from '@/lib/api/sara';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

/**
 * ============================================================================
 * SARA WIDGET — Landing Page Closer Senior #1 Chat Widget
 * ============================================================================
 *
 * Widget flottant sur la landing page qui permet aux visiteurs de discuter
 * avec SARA, la Closer Senior #1 d'Academia Helm.
 *
 * Fonctionnalités :
 *   - Chat conversationnel avec historique
 *   - Suggestions de questions rapides
 *   - Animation de typing
 *   - CTA de conversion intégrés
 *   - Responsive mobile
 */
export default function SaraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: "Bonjour ! 👋 Je suis SARA, votre assistante Academia Helm. Je suis là pour vous aider à découvrir comment notre solution peut transformer la gestion de votre école. Que souhaitez-vous savoir ?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const quickSuggestions = [
    "Quels sont les tarifs ?",
    "Quels modules sont inclus ?",
    "Comment fonctionne l'IA ?",
    "Je veux une démo",
    "Est-ce offline ?",
    "Comment s'inscrire ?",
  ];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const userMsg = text || input.trim();
    if (!userMsg || isTyping) return;

    setInput('');
    setShowSuggestions(false);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);

    try {
      const response = await saraApi.query(userMsg, undefined, messages);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.reply,
        },
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Désolée, j'ai rencontré une petite erreur. Souhaitez-vous qu'un conseiller vous contacte directement ? C'est gratuit et sans engagement ! 📞",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000]">
      {isOpen ? (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[380px] max-h-[550px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <AppIcon name="cpu" size="submenu" className="text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm">SARA</h4>
                <p className="text-[10px] opacity-90">Closer Senior #1 — Academia Helm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="En ligne" />
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                aria-label="Fermer"
              >
                <AppIcon name="x" size="submenu" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-[300px]">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] p-3 rounded-2xl text-[13px] leading-relaxed',
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm shadow-sm',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm p-3 shadow-sm flex gap-1.5 items-center">
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-4 pb-2 bg-gray-50 shrink-0">
              <p className="text-[10px] text-gray-500 mb-2 font-medium uppercase tracking-wide">Questions fréquentes</p>
              <div className="flex flex-wrap gap-1.5">
                {quickSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-[11px] px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 shadow-sm"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-gray-200 bg-white shrink-0"
          >
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                className="w-full bg-gray-100 border-none rounded-full py-2.5 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className={cn(
                  'absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200',
                  input.trim() && !isTyping
                    ? 'bg-blue-600 text-white hover:bg-blue-700 scale-100'
                    : 'bg-gray-300 text-gray-500 scale-95 cursor-not-allowed',
                )}
              >
                <AppIcon name="arrowRight" size="submenu" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-xl hover:shadow-2xl flex items-center justify-center hover:scale-110 transition-all duration-300"
          aria-label="Ouvrir le chat SARA"
        >
          <AppIcon name="messageSquare" size="dashboard" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          {/* Tooltip */}
          <div className="absolute right-full mr-3 bg-white text-gray-800 text-xs font-bold py-2 px-3 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none border border-gray-100">
            💬 Discutez avec SARA
          </div>
          {/* Badge "Nouveau" */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-white whitespace-nowrap">
            IA
          </div>
        </button>
      )}
    </div>
  );
}
