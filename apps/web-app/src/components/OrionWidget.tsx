'use client';

/**
 * ============================================================================
 * ORION WIDGET — Assistant IA flottant propulsé par GLM-5.2
 * ============================================================================
 *
 * Widget flottant disponible dans TOUTE l'application.
 * Permet de discuter avec ORION en langage naturel.
 *
 * Usage : placer <OrionWidget /> dans le layout racine (app/layout.tsx)
 * ============================================================================
 */

import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'orion';
  content: string;
  timestamp: string;
}

export default function OrionWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'orion',
      content: 'Bonjour ! Je suis ORION, votre assistant IA. Comment puis-je vous aider aujourd\'hui ?',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/orion/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json().catch(() => ({}));

      const orionMessage: Message = {
        role: 'orion',
        content: data.response || data.message || 'Désolé, je n\'ai pas pu traiter votre demande.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, orionMessage]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'orion',
        content: 'Connexion au serveur impossible. Veuillez réessayer.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    'Combien d\'élèves actifs ?',
    'Y a-t-il des alertes ?',
    'Analyse la situation de l\'école',
  ];

  return (
    <>
      {/* Bouton flottant */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          title="Discuter avec ORION"
        >
          <Sparkles className="w-6 h-6" />
          <span className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20" />
        </button>
      )}

      {/* Modal de chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden" style={{ height: '500px' }}>
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold">ORION</h3>
                <p className="text-[10px] text-blue-100">Assistant IA · GLM-5.2</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex flex-col gap-1',
                  msg.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] px-3 py-2 rounded-xl text-sm',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                  )}
                >
                  {msg.content}
                </div>
                <span className="text-[9px] text-slate-400 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-400 px-3">
                <Loader2 className="w-3 h-3 animate-spin" />
                ORION réfléchit...
              </div>
            )}
          </div>

          {/* Suggestions rapides */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="px-2.5 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Posez votre question..."
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
