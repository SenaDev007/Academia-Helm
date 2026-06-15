'use client';

import { useState, useEffect, useRef } from 'react';
import { atlasApi } from '@/lib/api/atlas';
import { AtlasMessage } from '@/types';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

/**
 * AtlasChatContainer — ATLAS AI Chat Interface
 * 
 * ATLAS is the Execution Agent of Academia Helm.
 * He assists with daily tasks, prepares documents, automates workflows,
 * and guides users through the application.
 * Always asks for human confirmation before critical actions.
 */

const ATLAS_SUGGESTIONS = [
  "Quelles sont les alertes du jour ?",
  "Aide-moi à générer un bulletin",
  "Comment relancer les impayés ?",
  "Où trouver le rapport financier ?",
];

export default function AtlasChatContainer() {
  const [messages, setMessages] = useState<AtlasMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await atlasApi.getHistory();
        setMessages(history);
      } catch (error) {
        console.error('Failed to fetch history:', error);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const tempUserMsg: AtlasMessage = {
        id: Date.now().toString(),
        content: userMessage,
        role: 'user',
        tenantId: '',
        userId: '',
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, tempUserMsg]);

      const response = await atlasApi.sendMessage(userMessage);
      setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, response]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString() + '_err',
        content: "Désolé, une erreur s'est produite. Je reste à votre disposition. Que puis-je faire pour vous ?",
        role: 'assistant',
        tenantId: '',
        userId: '',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Welcome & Suggestions when no messages */}
      {messages.length === 0 && !isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-50 to-white">
          <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-violet-200">
            <AppIcon name="cpu" size="dashboard" className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Bonjour, je suis ATLAS</h3>
          <p className="text-gray-500 max-w-md mt-3 leading-relaxed">
            Je suis votre agent IA d'exécution. Je peux vous aider à gérer votre école au quotidien, préparer des documents, automatiser des tâches et répondre à vos questions sur Academia Helm.
          </p>
          <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
            {ATLAS_SUGGESTIONS.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => { setInputValue(suggestion); }}
                className="text-xs px-4 py-2 bg-white rounded-full border border-violet-200 hover:bg-violet-50 hover:border-violet-300 transition-all text-violet-700 font-medium shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4",
          messages.length > 0 ? "bg-gray-50/50" : "hidden"
        )}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div className={cn(
              "max-w-[80%] rounded-2xl p-4 shadow-sm",
              msg.role === 'user'
                ? "bg-violet-600 text-white rounded-tr-none"
                : "bg-white border border-gray-100 rounded-tl-none text-gray-800"
            )}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <span className={cn(
                "text-[10px] mt-2 block opacity-70",
                msg.role === 'user' ? "text-right" : "text-left"
              )}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
              </div>
              <span className="text-xs text-gray-500 font-medium">ATLAS réfléchit...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Demandez à ATLAS d'exécuter une tâche..."
            className="w-full bg-gray-100 border-none rounded-full py-3 pl-5 pr-12 text-sm focus:ring-2 focus:ring-violet-500 transition-all outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-violet-600 text-white rounded-full hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <AppIcon name="arrowRight" size="submenu" />
          </button>
        </form>
        <p className="text-[10px] text-center text-gray-400 mt-2">
          ATLAS — Agent d'exécution · Toute action critique nécessite votre confirmation
        </p>
      </div>
    </div>
  );
}
