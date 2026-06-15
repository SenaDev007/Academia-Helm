'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Send, 
  Archive, 
  MessageSquare, 
  MoreHorizontal, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Mail,
  Smartphone,
  Zap,
  Users,
  ChevronRight,
  Eye,
  Trash2
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function MessagesPage() {
  const { academicYear } = useModuleContext();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/communication/v2/announcements');
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [academicYear]);

  const filteredMessages = messages.filter(m => {
    const matchesSearch = (m.subject?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                         (m.body?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'ALL' || m.type === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"><CheckCircle2 size={10} /> Publié</span>;
      case 'SCHEDULED': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"><Clock size={10} /> Programmé</span>;
      case 'DRAFT': return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"><MoreHorizontal size={10} /> Brouillon</span>;
      default: return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{status}</span>;
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'EMAIL': return <Mail size={16} className="text-blue-500" />;
      case 'SMS': return <Smartphone size={16} className="text-emerald-500" />;
      case 'ANNOUNCEMENT': return <Users size={16} className="text-violet-500" />;
      default: return <Zap size={16} className="text-amber-500" />;
    }
  };

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Rechercher une communication..." 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              className="bg-slate-50 border-none rounded-2xl text-sm px-4 py-2 focus:ring-2 focus:ring-blue-500"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">Tous les types</option>
              <option value="ANNOUNCEMENT">Annonces</option>
              <option value="ADMINISTRATIVE">Administratif</option>
              <option value="PEDAGOGICAL">Pédagogique</option>
              <option value="EMERGENCY">Urgence</option>
            </select>
          </div>
          
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95">
            <Plus size={18} />
            Nouvelle Communication
          </button>
        </div>

        {/* Message List */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-3xl animate-pulse border border-slate-100" />
            ))
          ) : filteredMessages.length > 0 ? (
            filteredMessages.map((msg) => (
              <div key={msg.id} className="group bg-white rounded-3xl p-5 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors`}>
                    {getChannelIcon(msg.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-slate-900 truncate">{msg.title}</h4>
                      {getStatusBadge(msg.status)}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1 mb-2 font-medium">{msg.content.substring(0, 100)}...</p>
                    <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center gap-1"><Users size={12} /> {msg.targetAudience || 'Tous'}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(msg.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-colors" title="Voir les détails">
                    <Eye size={20} />
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-amber-600 transition-colors" title="Archiver">
                    <Archive size={20} />
                  </button>
                  <button className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-600 transition-colors" title="Supprimer">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl py-20 text-center border border-dashed border-slate-200">
              <MessageSquare size={48} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-900">Aucun message trouvé</h3>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto">Commencez par créer une nouvelle communication pour vos parents ou votre personnel.</p>
              <button className="mt-8 text-blue-600 font-bold flex items-center gap-2 mx-auto hover:gap-3 transition-all">
                Créer une communication <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </ModuleContentArea>
  );
}

