'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { saraApi } from '@/lib/api/sara';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

/**
 * SaraWidget — SARA Closer Senior & Guide Widget for Landing Page
 * 
 * Features:
 * - Streaming responses for real-time feel
 * - Quick reply suggestions for common questions
 * - Closing technique integration (assumptive, urgency, alternative)
 * - Objection handling
 * - Enterprise quote form
 * - Disappears when user is authenticated
 */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

const QUICK_REPLIES = [
  { id: 'pricing', label: 'Plans & tarifs', icon: '📌' },
  { id: 'modules', label: 'Les 9 modules', icon: '📊' },
  { id: 'trial', label: 'Essai gratuit', icon: '🧪' },
  { id: 'demo', label: 'Demander une démo', icon: '🎯' },
  { id: 'ai', label: 'IA (ORION, ATLAS)', icon: '🤖' },
  { id: 'payment', label: 'Paiement', icon: '💳' },
];

const CLOSING_REPLIES = [
  { id: 'start_now', label: 'Je veux commencer', icon: '🚀' },
  { id: 'choose_plan', label: 'Quel plan me convient ?', icon: '💡' },
  { id: 'contact', label: 'Parler à un conseiller', icon: '📞' },
];

export default function SaraWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Bonjour ! Je suis SARA, votre assistante Academia Helm. 🎯 Je peux vous présenter nos plans (à partir de 14 900 FCFA/mois, 9 modules inclus), organiser une démo ou répondre à toutes vos questions. Que puis-je faire pour vous ?",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showClosingReplies, setShowClosingReplies] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check authentication - hide widget when user is logged in
  useEffect(() => {
    const checkAuth = () => {
      const authToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      const user = localStorage.getItem('user') || sessionStorage.getItem('user');
      setIsAuthenticated(!!(authToken && user));
    };
    checkAuth();
    const interval = setInterval(checkAuth, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Don't render if authenticated
  if (isAuthenticated) return null;

  const addMessage = useCallback((role: 'user' | 'assistant', content: string, isStreaming = false) => {
    const msg: ChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      role,
      content,
      timestamp: new Date(),
      isStreaming,
    };
    setMessages(prev => [...prev, msg]);
    return msg.id;
  }, []);

  const updateMessage = useCallback((id: string, content: string, isStreaming = false) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, content, isStreaming } : m));
  }, []);

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isTyping) return;

    setInput('');
    setShowQuickReplies(false);
    setShowClosingReplies(false);
    addMessage('user', text);
    setIsTyping(true);

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Build conversation history for context
      const history = messages
        .filter(m => !m.isStreaming)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      // Try streaming first
      const streamSuccess = await tryStreamResponse(text, history);
      
      if (!streamSuccess) {
        // Fallback to non-streaming
        await tryNonStreamResponse(text, history);
      }

      // Show closing replies after each assistant response
      setShowClosingReplies(true);
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        addMessage('assistant', "Je suis désolée, une erreur technique s'est produite. Souhaitez-vous que je vous mette en contact avec un conseiller ? 📞");
      }
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, messages, addMessage]);

  const tryStreamResponse = async (text: string, history: Array<{role: string; content: string}>) => {
    try {
      const res = await fetch('/api/public/sara/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: text }] }),
        signal: abortControllerRef.current?.signal,
      });

      if (!res.ok || !res.body) return false;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      const msgId = addMessage('assistant', '', true);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk.split('\n').map(l => l.trim()).find(l => l.startsWith('data:'));
          if (!line) continue;
          const jsonStr = line.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const evt = JSON.parse(jsonStr);
            if (evt?.type === 'delta' && typeof evt.text === 'string') {
              accumulated += evt.text;
              updateMessage(msgId, accumulated, true);
            }
            if (evt?.type === 'final' && typeof evt.text === 'string') {
              updateMessage(msgId, evt.text, false);
              return true;
            }
          } catch { /* ignore */ }
        }
      }

      if (accumulated) {
        updateMessage(msgId, accumulated, false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const tryNonStreamResponse = async (text: string, history: Array<{role: string; content: string}>) => {
    try {
      const response = await saraApi.query(text, undefined, [...history, { role: 'user', content: text }]);
      addMessage('assistant', response.reply);
    } catch {
      addMessage('assistant', "Désolée, je rencontre une difficulté technique. Souhaitez-vous être mis en contact avec un conseiller ? 📞");
    }
  };

  const handleQuickReply = (replyId: string) => {
    const replyTexts: Record<string, string> = {
      pricing: "Quels sont vos plans et tarifs ?",
      modules: "Quels sont les 9 modules inclus ?",
      trial: "Comment fonctionne l'essai gratuit ?",
      demo: "Je veux une démonstration d'Academia Helm",
      ai: "Comment fonctionnent ORION et ATLAS ?",
      payment: "Comment payer avec Fedapay ?",
      start_now: "Je veux commencer immédiatement avec Academia Helm",
      choose_plan: "Quel plan me convient le mieux pour mon école ?",
      contact: "Je veux parler à un conseiller",
    };
    handleSend(replyTexts[replyId] || replyId);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000]">
      {isOpen ? (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[380px] max-h-[560px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex items-center justify-between text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/20">
                <AppIcon name="cpu" size="submenu" className="text-white" />
              </div>
              <div>
                <h4 className="font-bold text-sm tracking-tight">SARA</h4>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <p className="text-[10px] opacity-90 font-medium">Closer Senior · Academia Helm</p>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors relative z-10">
              <AppIcon name="x" size="submenu" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-[300px]">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] p-3 rounded-xl text-xs shadow-sm leading-relaxed",
                  m.role === 'user'
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                )}>
                  {m.content}
                  {m.isStreaming && (
                    <span className="inline-block w-1 h-3 bg-blue-400 ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            ))}
            {isTyping && !messages.some(m => m.isStreaming) && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 rounded-xl rounded-tl-none p-3 shadow-sm flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                  <span className="text-[10px] text-gray-400 ml-1">SARA réfléchit...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies / Closing Replies */}
          {(showQuickReplies || showClosingReplies) && !isTyping && (
            <div className="px-3 pb-2 bg-white">
              {showClosingReplies && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {CLOSING_REPLIES.map(reply => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReply(reply.id)}
                      className="text-[10px] px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors font-medium flex items-center gap-1"
                    >
                      <span>{reply.icon}</span>
                      {reply.label}
                    </button>
                  ))}
                </div>
              )}
              {showQuickReplies && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REPLIES.map(reply => (
                    <button
                      key={reply.id}
                      onClick={() => handleQuickReply(reply.id)}
                      className="text-[10px] px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200 hover:bg-gray-200 transition-colors font-medium flex items-center gap-1"
                    >
                      <span>{reply.icon}</span>
                      {reply.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 border-t border-gray-200 bg-white">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Posez votre question à SARA..."
                className="w-full bg-gray-100 border-none rounded-full py-2.5 pl-4 pr-10 text-xs focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                <AppIcon name="arrowRight" size="submenu" />
              </button>
            </div>
            <p className="text-[9px] text-center text-gray-400 mt-1.5">
              SARA peut faire des erreurs. Vérifiez les informations importantes.
            </p>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center hover:scale-105 transition-all duration-300"
        >
          <AppIcon name="messageSquare" size="dashboard" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          <div className="absolute right-full mr-3 bg-white text-gray-800 text-xs font-bold py-2 px-3 rounded-lg shadow-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-100">
            Besoin d'aide ? Discutez avec SARA 🎯
          </div>
        </button>
      )}
    </div>
  );
}
