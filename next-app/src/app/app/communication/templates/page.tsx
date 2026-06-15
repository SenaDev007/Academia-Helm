'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FileText, 
  Edit, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  Layout, 
  ChevronRight,
  Loader2,
  Mail,
  Smartphone,
  MessageSquare,
  Zap
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';

export default function TemplatesPage() {
  const { academicYear } = useModuleContext();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/communication/v2/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data);
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [academicYear]);

  const filteredTemplates = templates.filter(t => 
    (t.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (t.code?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL': return <Mail size={16} className="text-blue-500" />;
      case 'SMS': return <Smartphone size={16} className="text-emerald-500" />;
      case 'WHATSAPP': return <MessageSquare size={16} className="text-green-500" />;
      case 'PUSH': return <Zap size={16} className="text-amber-500" />;
      default: return <FileText size={16} className="text-slate-500" />;
    }
  };

  return (
    <ModuleContentArea>
      <div className="p-6 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Rechercher un template..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95">
            <Plus size={18} />
            Créer un Template
          </button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-white rounded-3xl animate-pulse border border-slate-100" />
            ))
          ) : filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => (
              <div key={template.id} className="group bg-white rounded-3xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all relative overflow-hidden flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all`}>
                    {getChannelIcon(template.channel)}
                  </div>
                  <div className="flex gap-1">
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors">
                      <Edit size={16} />
                    </button>
                    <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">{template.name}</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{template.code}</p>
                </div>

                <p className="text-sm text-slate-500 line-clamp-3 mb-6 font-medium flex-1">
                  {template.bodyFr || template.bodyEn}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-full uppercase tracking-tighter">
                    {template.category}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 size={12} /> Prêt
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-white rounded-3xl py-20 text-center border border-dashed border-slate-200">
              <Layout size={48} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-900">Aucun template trouvé</h3>
              <p className="text-slate-500 mt-1 max-w-sm mx-auto">Gagnez du temps en créant des templates réutilisables pour vos messages récurrents.</p>
              <button className="mt-8 text-blue-600 font-bold flex items-center gap-2 mx-auto hover:gap-3 transition-all">
                Créer mon premier template <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </ModuleContentArea>
  );
}
