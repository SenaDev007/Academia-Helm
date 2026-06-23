'use client';

import { useState, useEffect } from 'react';
import { Loader2, Download, Search, IdCard, CreditCard, BadgeCheck } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

type GalleryMode = 'ALL' | 'PROFESSIONAL' | 'BADGE';

export function CardGallery() {
  const { tenant } = useModuleContext();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<GalleryMode>('ALL');

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

  const filteredByMode = mode === 'ALL' ? cards : cards.filter(c => c.cardType === mode);

  const filtered = filteredByMode.filter(c =>
    `${c.staffName} ${c.staffPosition || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  // Separate cards and badges for display
  const professionalCards = filtered.filter(c => c.cardType !== 'BADGE');
  const badges = filtered.filter(c => c.cardType === 'BADGE');

  function downloadCard(cardId: string) {
    window.open(hrUrl(`staff/cards/${cardId}/download`, { tenantId: tenant?.id }), '_blank');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">Trombinoscope — Cartes & Badges</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {professionalCards.length} carte(s) professionnelle(s) · {badges.length} badge(s) d'accès
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setMode('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'ALL' ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Tous ({cards.length})
            </button>
            <button
              onClick={() => setMode('PROFESSIONAL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'PROFESSIONAL' ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <CreditCard className="h-3 w-3" /> Cartes ({cards.filter(c => c.cardType !== 'BADGE').length})
            </button>
            <button
              onClick={() => setMode('BADGE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'BADGE' ? 'bg-white text-[#1A2BA6] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <BadgeCheck className="h-3 w-3" /> Badges ({cards.filter(c => c.cardType === 'BADGE').length})
            </button>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..." className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <IdCard className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Aucune carte active. Générez des cartes dans l'onglet « Carte professionnelle ».</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Professional Cards section (landscape) */}
          {(mode === 'ALL' || mode === 'PROFESSIONAL') && professionalCards.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 text-[#1A2BA6]" />
                <h4 className="text-sm font-bold text-slate-700">Cartes professionnelles</h4>
                <span className="text-xs text-slate-400">({professionalCards.length})</span>
                <span className="text-[10px] text-slate-400 ml-2">· Format paysage (recto-verso)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {professionalCards.map((card) => {
                  const initials = card.staffName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
                  return (
                    <div key={card.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
                      {/* Recto carte (landscape) */}
                      <div className="relative p-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)', aspectRatio: '340/214' }}>
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
                        <button onClick={() => downloadCard(card.id)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition whitespace-nowrap">
                          <Download className="h-3 w-3" /> PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Badges section (portrait) */}
          {(mode === 'ALL' || mode === 'BADGE') && badges.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BadgeCheck className="h-4 w-4 text-[#1A2BA6]" />
                <h4 className="text-sm font-bold text-slate-700">Badges d'accès</h4>
                <span className="text-xs text-slate-400">({badges.length})</span>
                <span className="text-[10px] text-slate-400 ml-2">· Format portrait (vertical)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {badges.map((card) => {
                  const initials = card.staffName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
                  return (
                    <div key={card.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition">
                      {/* Badge (portrait) */}
                      <div className="relative flex flex-col" style={{ aspectRatio: '240/360', background: '#fff' }}>
                        {/* Lanyard slot */}
                        <div className="w-8 h-2 bg-slate-200 mx-auto rounded-b-lg" />
                        {/* Header */}
                        <div className="px-2 py-1.5 text-white text-center" style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}>
                          <div className="font-bold text-[8px] truncate">{card.schoolName || 'École'}</div>
                          <div className="text-[7px] font-bold" style={{ color: '#f5b335' }}>BADGE D'ACCÈS</div>
                        </div>
                        {/* Body */}
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
                          {card.staffPhotoUrl && card.staffPhotoUrl !== 'data:' ? (
                            <img src={card.staffPhotoUrl} alt={card.staffName} className="w-12 h-12 rounded-full border-2 object-cover" style={{ borderColor: '#f5b335' }} />
                          ) : (
                            <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-bold text-slate-500" style={{ borderColor: '#f5b335', background: '#f1f5f9' }}>{initials}</div>
                          )}
                          <p className="font-bold text-[10px] text-slate-900 text-center px-1 leading-tight">{card.staffName}</p>
                          <p className="text-[8px] text-blue-600 text-center">{card.staffPosition}</p>
                          <p className="text-[7px] text-slate-500 font-mono">N° {card.staffMatricule}</p>
                        </div>
                        {/* Footer */}
                        <div className="h-6 flex items-center justify-between px-2" style={{ background: 'linear-gradient(135deg, #0b2f73 0%, #1d4fa5 100%)' }}>
                          <div className="w-4 h-4 bg-white rounded-sm" />
                          <span className="text-[7px] font-bold" style={{ color: '#f5b335' }}>AH</span>
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="p-2 flex items-center justify-between gap-1">
                        <a href={card.cardLink} target="_blank" rel="noopener noreferrer" className="text-[9px] text-[#1A2BA6] font-bold hover:underline truncate">Profil →</a>
                        <button onClick={() => downloadCard(card.id)} className="flex items-center gap-0.5 px-1.5 py-1 text-[9px] font-bold text-rose-600 bg-rose-50 rounded hover:bg-rose-100 transition whitespace-nowrap">
                          <Download className="h-2.5 w-2.5" /> PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
