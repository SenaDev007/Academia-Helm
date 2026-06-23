'use client';

import { useState, useEffect } from 'react';
import { Loader2, Download, Search, IdCard, FileText } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

export function CardGallery() {
  const { tenant } = useModuleContext();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      try {
        setLoading(true);
        const res = await hrFetch<any[]>(hrUrl('staff/cards/all', { tenantId: tenant.id }));
        setCards(Array.isArray(res) ? res : []);
      } catch (e: any) {
        toast({ variant: 'error', title: 'Erreur', description: e.message });
      } finally { setLoading(false); }
    })();
  }, [tenant?.id]);

  const filtered = cards.filter(c =>
    `${c.staffName} ${c.staffPosition || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  function downloadCard(cardId: string, name: string) {
    window.open(hrUrl(`staff/cards/${cardId}/download`, { tenantId: tenant?.id }), '_blank');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Trombinoscope — Cartes & Badges</h3>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} carte(s) professionnelle(s) active(s)</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <IdCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune carte active. Générez des cartes dans l'onglet « Carte professionnelle ».</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((card) => {
            const initials = card.staffName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
            return (
              <div key={card.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
                {/* Recto carte */}
                <div className="relative p-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}>
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: 'linear-gradient(135deg, #f5b335, #fff, #f5b335)', color: '#0b2f73' }}>AH</div>
                  {card.staffPhotoUrl && card.staffPhotoUrl !== 'data:' ? (
                    <img src={card.staffPhotoUrl} alt={card.staffName} className="w-16 h-16 rounded-full border-2 mx-auto mb-2 object-cover" style={{ borderColor: '#f5b335' }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 mx-auto mb-2 flex items-center justify-center text-xl font-bold" style={{ borderColor: '#f5b335', background: 'rgba(255,255,255,0.1)' }}>{initials}</div>
                  )}
                  <h4 className="text-sm font-bold">{card.staffName}</h4>
                  <p className="text-xs" style={{ color: '#f5b335' }}>{card.staffPosition}</p>
                  <p className="text-[10px] font-mono mt-1">N° {card.staffMatricule}</p>
                </div>
                {/* Actions */}
                <div className="p-3 flex items-center justify-between gap-2">
                  <a href={card.cardLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#1A2BA6] font-bold hover:underline truncate">Voir profil →</a>
                  <button onClick={() => downloadCard(card.id, card.staffName)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition whitespace-nowrap">
                    <Download className="h-3 w-3" /> PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
