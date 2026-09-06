'use client';

import { useState, useEffect, useRef } from 'react';
import { atlasApi } from '@/lib/api/atlas';
import { AtlasMessage } from '@/types';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Optimistic update
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50"
      >
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <AppIcon name="cpu" size="dashboard" className="text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Bonjour, je suis ATLAS</h3>
            <p className="text-gray-600 max-w-md mt-2">
              Je suis votre assistant d'intelligence artificielle. Je peux vous aider à analyser les performances de votre école, gérer vos ressources ou répondre à vos questions sur Academia Helm.
            </p>
          </div>
        )}

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
                ? "bg-blue-600 text-white rounded-tr-none" 
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
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
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
            placeholder="Posez une question à ATLAS..."
            className="w-full bg-gray-100 border-none rounded-full py-3 pl-5 pr-12 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            <AppIcon name="arrowRight" size="submenu" />
          </button>
        </form>
        <p className="text-[10px] text-center text-gray-400 mt-2">
          ATLAS peut faire des erreurs. Vérifiez les informations importantes.
        </p>
      </div>
    </div>
  );
}
