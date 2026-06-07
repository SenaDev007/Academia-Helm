/**
 * InternalMessaging Component
 * 
 * Messagerie interne sécurisée entre direction, enseignants et personnel.
 */

'use client';

import { useState } from 'react';
import { 
  Search, 
  Send, 
  Paperclip, 
  MoreVertical,
  User,
  CheckCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InternalMessaging() {
  const [activeChat, setActiveChat] = useState(0);

  const chats = [
    { id: 1, name: 'Dir. Konaté', role: 'Direction', lastMsg: 'Veuillez préparer le PV du conseil.', time: '09:45', unread: 2, online: true },
    { id: 2, name: 'Mme. Traoré', role: 'Enseignante', lastMsg: 'Les notes de Physique sont validées.', time: 'Hier', unread: 0, online: false },
    { id: 3, name: 'Groupe Terminale C', role: 'Conseil de Classe', lastMsg: 'Amadou : Je confirme pour demain.', time: 'Hier', unread: 0, online: true },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r border-slate-100 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Rechercher..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat, i) => (
            <button 
              key={chat.id}
              onClick={() => setActiveChat(i)}
              className={cn(
                "w-full p-6 flex items-start gap-4 hover:bg-slate-50 transition-all text-left",
                activeChat === i && "bg-violet-50"
              )}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-500" />
                </div>
                {chat.online && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 truncate">{chat.name}</p>
                  <span className="text-[10px] text-slate-400 font-medium">{chat.time}</span>
                </div>
                <p className="text-[10px] text-violet-600 font-bold uppercase">{chat.role}</p>
                <p className="text-xs text-slate-500 mt-1 truncate">{chat.lastMsg}</p>
              </div>
              {chat.unread > 0 && (
                <div className="w-5 h-5 bg-violet-600 rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                  {chat.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        {/* Header */}
        <div className="p-6 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
              {chats[activeChat].name.substring(0, 2)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{chats[activeChat].name}</p>
              <p className="text-[10px] text-emerald-500 font-bold uppercase">En ligne</p>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-50 rounded-xl transition-all">
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 p-8 overflow-y-auto space-y-6">
          <div className="flex justify-start">
            <div className="max-w-[70%] p-4 bg-white border border-slate-100 rounded-2xl rounded-tl-none shadow-sm">
              <p className="text-sm text-slate-700 leading-relaxed">
                Bonjour ! Veuillez préparer le PV du conseil de classe pour la Terminale C demain matin.
              </p>
              <p className="text-[10px] text-slate-400 mt-2 text-right uppercase font-bold">09:42</p>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[70%] p-4 bg-violet-600 text-white rounded-2xl rounded-tr-none shadow-lg">
              <p className="text-sm leading-relaxed">
                C'est entendu, Monsieur le Directeur. J'ai déjà exporté les moyennes provisoires via ORION.
              </p>
              <div className="flex items-center justify-end gap-1 mt-2">
                <p className="text-[10px] text-violet-200 uppercase font-bold">09:45</p>
                <CheckCheck className="w-3 h-3 text-violet-200" />
              </div>
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="p-6 bg-white border-t border-slate-100">
          <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-2 border border-slate-200 focus-within:border-violet-500/50 transition-all">
            <button className="p-2 hover:bg-slate-200 rounded-xl transition-all">
              <Paperclip className="w-5 h-5 text-slate-400" />
            </button>
            <input 
              placeholder="Écrivez votre message..." 
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 text-slate-900 placeholder:text-slate-400 font-medium"
            />
            <button className="p-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-900/20">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
