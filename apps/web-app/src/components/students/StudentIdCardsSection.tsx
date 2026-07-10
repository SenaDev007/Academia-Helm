/**
 * ============================================================================
 * STUDENT ID CARDS SECTION - Module Élèves > Onglet Cartes Scolaires
 * ============================================================================
 *
 * Layout aéré : Niveau scolaire → Classe → Cartes (sans conteneurs imbriqués)
 * Chaque carte est rendue en React (pas d'iframe) avec switcher recto/verso.
 * Pagination par classe pour éviter une page trop longue.
 *
 * Backend endpoints :
 *   GET  /students/id-cards/stats
 *   GET  /students/id-cards/grouped-by-class?academicYearId=...
 *   GET  /students/id-cards/class/:classId/bundle-pdf?academicYearId=...
 *   GET  /students/id-cards/:cardId/download
 *   POST /students/id-cards/generate-bulk
 *   PUT  /students/id-cards/:cardId/revoke
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, CheckCircle, XCircle, AlertCircle, Users, RefreshCw,
  FileDown, Loader2, ChevronDown, ChevronRight, Search, Ban, Download,
  Layers, BookOpen, RotateCw, Calendar, Phone, MapPin, Hash, User,
} from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { cn } from '@/lib/utils';

// ─── Types ───

interface IdCardStats { total: number; active: number; revoked: number; expired: number; expiredRate: number; }

interface GroupedCard {
  id: string; cardNumber: string; isActive: boolean; isRevoked: boolean;
  generatedAt: string; validUntil?: string; pdfPath?: string;
  student: {
    id: string; firstName: string; lastName: string; matricule?: string;
    photoUrl?: string; dateOfBirth?: string; gender?: string;
  };
  className: string; levelName: string;
}

interface GroupedClass { class: { id: string; name: string }; cardsCount: number; activeCount: number; cards: GroupedCard[]; }
interface GroupedLevel { level: { id: string; name: string; code: string }; classes: GroupedClass[]; }
interface GroupedResult { academicYearId: string; levels: GroupedLevel[]; totalCards: number; }

const NAVY = '#0D1F6E';

// ─── Composant carte visuelle (recto/verso) rendu en React ───

function CardVisual({ card, face, academicYearName }: { card: GroupedCard; face: 'recto' | 'verso'; academicYearName?: string }) {
  const s = card.student;
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-lg overflow-hidden shadow-md border border-slate-200" style={{ aspectRatio: '85.6 / 53.98' }}>
        {/* En-tête bleu marine */}
        <div className="flex items-center justify-between px-2 py-1.5" style={{ background: NAVY, color: '#fff' }}>
          <div className="w-7 h-7 bg-white rounded flex items-center justify-center font-bold text-[10px]" style={{ color: NAVY }}>AH</div>
          <div className="flex-1 text-center px-1">
            <div className="font-bold text-[8px] uppercase tracking-wide leading-tight truncate">Établissement Scolaire</div>
            <div className="text-[5px] italic opacity-80 leading-tight">Excellence • Discipline • Travail</div>
          </div>
          <div className="text-[5px] uppercase px-1.5 py-0.5 rounded bg-white/15">Carte</div>
        </div>
        {/* Corps : photo + infos */}
        <div className="flex p-2 gap-2" style={{ height: 'calc(100% - 56px)' }}>
          {/* Photo */}
          <div className="w-16 h-20 rounded border-2 overflow-hidden flex items-center justify-center shrink-0" style={{ borderColor: NAVY, background: '#f3f4f6' }}>
            {s.photoUrl ? <img src={s.photoUrl} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" /> : <span className="text-[7px] text-slate-400">PHOTO</span>}
          </div>
          {/* Infos */}
          <div className="flex-1 flex flex-col justify-center gap-0.5">
            <div className="flex items-baseline"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY, minWidth: '28px' }}>Nom</span><span className="text-[6px] text-slate-800 truncate">{s.lastName}</span></div>
            <div className="flex items-baseline"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY, minWidth: '28px' }}>Prénom</span><span className="text-[6px] text-slate-800 truncate">{s.firstName}</span></div>
            <div className="flex items-baseline"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY, minWidth: '28px' }}>Né(e)</span><span className="text-[6px] text-slate-800 truncate">{formatDate(s.dateOfBirth)}</span></div>
            <div className="flex items-baseline"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY, minWidth: '28px' }}>Sexe</span><span className="text-[6px] text-slate-800">{s.gender === 'M' ? 'Masculin' : s.gender === 'F' ? 'Féminin' : 'N/A'}</span></div>
            <div className="flex items-baseline"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY, minWidth: '28px' }}>Classe</span><span className="text-[6px] text-slate-800">{card.className}</span></div>
            <div className="flex items-baseline"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY, minWidth: '28px' }}>Niv.</span><span className="text-[6px] text-slate-800">{card.levelName}</span></div>
            <div className="mt-1 py-0.5 px-1 rounded text-center text-[6px] font-bold text-white" style={{ background: NAVY }}>{s.matricule || card.cardNumber}</div>
          </div>
        </div>
        {/* Pied bleu marine */}
        <div className="flex items-center justify-between px-2 py-1 text-[5px]" style={{ background: NAVY, color: '#fff' }}>
          <span className="opacity-90">Cotonou, Bénin</span>
          <span className="font-bold opacity-90">+229 01 00 00 00 00</span>
        </div>
      </div>
    );
  }

  // VERSO
  return (
    <div className="w-full bg-white rounded-lg overflow-hidden shadow-md border border-slate-200" style={{ aspectRatio: '85.6 / 53.98' }}>
      <div className="flex items-center justify-between px-2 py-1.5" style={{ background: NAVY, color: '#fff' }}>
        <div className="text-[5px] uppercase px-1.5 py-0.5">Informations</div>
        <div className="font-bold text-[7px]">Année {academicYearName || ''}</div>
        <div className="w-6 h-6 bg-white rounded flex items-center justify-center font-bold text-[8px]" style={{ color: NAVY }}>AH</div>
      </div>
      <div className="flex p-2 gap-2" style={{ height: 'calc(100% - 40px)' }}>
        {/* Gauche : conditions + contact */}
        <div className="flex-1 flex flex-col">
          <div className="text-[5px] font-bold mb-1" style={{ color: NAVY }}>Conditions d'utilisation</div>
          <ul className="text-[4px] text-slate-500 space-y-0.5 list-disc pl-2">
            <li>Cette carte est strictement personnelle.</li>
            <li>À présenter à toute demande du personnel.</li>
            <li>Signaler toute perte ou vol à l'administration.</li>
            <li>Valable pour l'année scolaire en cours.</li>
          </ul>
          <div className="mt-auto pt-1 border-t border-dashed border-slate-200 text-[4px] space-y-0.5">
            <div><span className="font-bold" style={{ color: NAVY }}>Tél : </span>+229 01 00 00 00 00</div>
            <div><span className="font-bold" style={{ color: NAVY }}>Email : </span>contact@ecole.bj</div>
          </div>
        </div>
        {/* Droite : QR + signature + barcode + dates */}
        <div className="flex flex-col items-center justify-between gap-1" style={{ width: '60px' }}>
          {/* QR placeholder */}
          <div className="w-12 h-12 border border-slate-200 rounded bg-white flex items-center justify-center">
            <div className="grid grid-cols-5 grid-rows-5 gap-px w-8 h-8">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className={cn(Math.random() > 0.5 ? 'bg-black' : 'bg-white')} />
              ))}
            </div>
          </div>
          {/* Signature */}
          <div className="text-center">
            <div className="text-[7px] italic" style={{ color: NAVY, fontFamily: 'Brush Script MT, cursive' }}>Le Directeur</div>
            <div className="text-[3px] text-slate-400">Signature</div>
          </div>
          {/* Barcode */}
          <div className="flex items-center h-3 gap-px">
            {Array.from(card.cardNumber).map((c, i) => (
              <div key={i} className={cn(i % 2 === 0 ? 'bg-black' : 'bg-white')} style={{ width: `${1 + (c.charCodeAt(0) % 3)}px`, height: '100%' }} />
            ))}
          </div>
          {/* Dates */}
          <div className="text-center text-[3px] text-slate-500 leading-tight">
            <div><span className="font-bold" style={{ color: NAVY }}>Émise :</span> {formatDate(card.generatedAt)}</div>
            <div><span className="font-bold" style={{ color: NAVY }}>Expire :</span> {formatDate(card.validUntil)}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-1 text-[5px]" style={{ background: NAVY, color: '#fff' }}>
        <span className="opacity-90">Academia Helm · Document officiel</span>
        <span className="opacity-90">Vérifiable via QR</span>
      </div>
    </div>
  );
}

// ─── Composant carte avec switcher recto/verso ───

function CardWithFlip({ card, academicYearName, onDownload, onRevoke, downloading }: {
  card: GroupedCard; academicYearName?: string;
  onDownload: (card: GroupedCard) => void; onRevoke: (card: GroupedCard) => void; downloading: boolean;
}) {
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const s = card.student;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition">
      {/* En-tête : avatar + nom + statut */}
      <div className="p-2.5 flex items-center gap-2 border-b border-slate-100">
        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
          {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-full h-full object-cover" /> : <>{s.lastName?.[0]}{s.firstName?.[0]}</>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate">{s.lastName.toUpperCase()} {s.firstName}</p>
          <p className="text-[9px] text-slate-400 font-mono truncate">{card.cardNumber}</p>
        </div>
        <span className={cn('px-1.5 py-0.5 text-[8px] font-bold rounded border shrink-0',
          card.isRevoked ? 'bg-rose-50 text-rose-700 border-rose-200'
          : card.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-50 text-slate-600 border-slate-200')}>
          {card.isRevoked ? 'Révoquée' : card.isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Carte visuelle + bouton switcher */}
      <div className="p-3 bg-slate-50 relative">
        <CardVisual card={card} face={face} academicYearName={academicYearName} />
        {/* Bouton switcher recto/verso */}
        <button
          onClick={() => setFace(face === 'recto' ? 'verso' : 'recto')}
          className="absolute top-1 right-1 inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg shadow-sm transition"
          title={face === 'recto' ? 'Voir le verso' : 'Voir le recto'}
        >
          <RotateCw className="w-2.5 h-2.5" />
          {face === 'recto' ? 'Verso' : 'Recto'}
        </button>
      </div>

      {/* Actions */}
      <div className="p-2 flex items-center justify-end gap-1.5 border-t border-slate-100">
        <button onClick={() => onDownload(card)} disabled={downloading}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition disabled:opacity-50">
          {downloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
        </button>
        {card.isActive && !card.isRevoked && (
          <button onClick={() => onRevoke(card)}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition">
            <Ban className="w-3 h-3" /> Révoquer
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Composant principal ───

export default function StudentIdCardsSection() {
  const confirmDialog = useConfirmDialog();
  const { academicYear, schoolLevel } = useModuleContext();
  const [stats, setStats] = useState<IdCardStats | null>(null);
  const [grouped, setGrouped] = useState<GroupedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingCardId, setDownloadingCardId] = useState<string | null>(null);
  const [downloadingClassId, setDownloadingClassId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<GroupedCard | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [genScope, setGenScope] = useState<'all' | 'level' | 'class'>('all');
  const [genLevelId, setGenLevelId] = useState('');
  const [genClassId, setGenClassId] = useState('');
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : []).then(data => setAllClasses(Array.isArray(data) ? data : [])).catch(() => setAllClasses([]));
  }, []);

  useEffect(() => {
    if (academicYear?.id) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  const loadAll = async () => {
    const ayId = academicYear?.id || '';
    if (!ayId) return;
    setIsLoading(true);
    try {
      const [statsData, groupedData] = await Promise.all([
        studentsService.getIdCardStats(ayId).catch(() => null),
        studentsService.getCardsGroupedByClass(ayId).catch(() => null),
      ]);
      setStats(statsData);
      setGrouped(groupedData);
      if (groupedData?.levels?.length > 0 && expandedLevels.size === 0) {
        setExpandedLevels(new Set(groupedData.levels.map((l: GroupedLevel) => l.level.id)));
      }
    } catch { } finally { setIsLoading(false); }
  };

  const handleGenerateBulk = () => {
    if (!academicYear?.id) { toast({ title: 'Attention', description: 'Aucune année scolaire.', variant: 'error' }); return; }
    setGenScope('all'); setGenLevelId(''); setGenClassId(''); setIsGenerateModalOpen(true);
  };

  const handleConfirmGenerate = async () => {
    const ayId = academicYear?.id || '';
    if (!ayId) return;
    if (genScope === 'level' && !genLevelId) { toast({ title: 'Attention', description: 'Sélectionnez un niveau.', variant: 'error' }); return; }
    if (genScope === 'class' && !genClassId) { toast({ title: 'Attention', description: 'Sélectionnez une classe.', variant: 'error' }); return; }
    const payload: any = { academicYearId: ayId };
    let scopeLabel = 'tous les niveaux';
    if (genScope === 'level') { payload.schoolLevelId = genLevelId; scopeLabel = `le niveau ${allClasses.find(c => c.schoolLevelId === genLevelId)?.schoolLevel?.name || ''}`; }
    else if (genScope === 'class') { payload.classId = genClassId; const cls = allClasses.find(c => c.id === genClassId); payload.schoolLevelId = cls?.schoolLevelId; scopeLabel = `la classe ${cls?.name || ''}`; }
    const ok = await confirmDialog.info(`Générer les cartes pour ${scopeLabel} ? Cela peut prendre plusieurs minutes.`, 'Générer');
    if (!ok) return;
    setIsGenerateModalOpen(false); setIsGenerating(true);
    try {
      const data = await studentsService.generateBulkIdCards(payload);
      if (data.total === 0) toast({ title: 'ℹ️ Aucune carte à générer', description: `Tous les élèves de ${scopeLabel} ont déjà une carte.`, variant: 'success' });
      else if (data.failed > 0) toast({ title: '⚠️ Génération partielle', description: `${data.succeeded} succès, ${data.failed} échec(s) sur ${data.total}.`, variant: 'success' });
      else toast({ title: '✅ Génération terminée', description: `${data.succeeded} carte(s) générée(s) sur ${data.total}.`, variant: 'success' });
      loadAll();
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'error' }); }
    finally { setIsGenerating(false); }
  };

  const handleDownloadCardPdf = async (card: GroupedCard) => {
    setDownloadingCardId(card.id);
    try {
      const blob = await studentsService.downloadIdCardPdf(card.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `carte-${card.student.lastName}-${card.student.firstName}-${card.cardNumber}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) { toast({ title: 'Erreur', description: e.message || 'Téléchargement échoué', variant: 'error' }); }
    finally { setDownloadingCardId(null); }
  };

  const handleDownloadClassBundle = async (classId: string, className: string) => {
    const ayId = academicYear?.id || '';
    if (!ayId) return;
    setDownloadingClassId(classId);
    try {
      const blob = await studentsService.downloadClassBundlePdf(classId, ayId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `cartes-${className.replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ PDF téléchargé', description: `Cartes de ${className}`, variant: 'success' });
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'error' }); }
    finally { setDownloadingClassId(null); }
  };

  const handleRevokeCard = async () => {
    if (!selectedCard || !revokeReason.trim()) return;
    setIsLoading(true);
    try {
      await studentsService.revokeIdCard(selectedCard.id, revokeReason);
      toast({ title: '✅ Carte révoquée', variant: 'success' });
      setIsRevokeModalOpen(false); setSelectedCard(null); setRevokeReason('');
      loadAll();
    } catch (e: any) { toast({ title: 'Erreur', description: e.message, variant: 'error' }); }
    finally { setIsLoading(false); }
  };

  const toggleLevel = (id: string) => setExpandedLevels(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Filtrage par recherche
  const filteredLevels = useMemo(() => {
    if (!grouped || !searchQuery.trim()) return grouped?.levels || [];
    const q = searchQuery.toLowerCase();
    return grouped.levels.map(l => ({
      ...l,
      classes: l.classes.map(c => ({ ...c, cards: c.cards.filter(card => `${card.student.firstName} ${card.student.lastName}`.toLowerCase().includes(q) || (card.student.matricule || '').toLowerCase().includes(q) || card.cardNumber.toLowerCase().includes(q)) })).filter(c => c.cards.length > 0),
    })).filter(l => l.classes.length > 0);
  }, [grouped, searchQuery]);

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        {/* En-tête + bouton générer compact */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /> Cartes Scolaires</h2>
          <button onClick={handleGenerateBulk} disabled={isGenerating || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition">
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            {isGenerating ? 'Génération...' : 'Générer les cartes'}
          </button>
        </div>

        {/* Stats compactes */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Total', value: stats.total, icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
              { label: 'Actives', value: stats.active, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Révoquées', value: stats.revoked, icon: XCircle, color: 'text-rose-600 bg-rose-50' },
              { label: 'Expirées', value: stats.expired, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
                <div className={cn('p-1.5 rounded-md', s.color)}><s.icon className="w-3.5 h-3.5" /></div>
                <div><p className="text-[9px] font-medium text-slate-500 uppercase">{s.label}</p><p className="text-base font-bold text-slate-900 leading-tight">{s.value}</p></div>
              </div>
            ))}
          </div>
        )}

        {/* Recherche */}
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un élève, matricule, numéro de carte..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        {/* ⭐ Layout aéré : niveau → classe → cartes (sans conteneurs imbriqués) */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
        ) : !grouped || grouped.totalCards === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 mb-1">Aucune carte scolaire générée</p>
            <p className="text-xs text-slate-400">Cliquez sur "Générer les cartes" pour commencer.</p>
          </div>
        ) : filteredLevels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12"><Search className="w-10 h-10 text-slate-300 mb-2" /><p className="text-sm text-slate-500">Aucune carte ne correspond.</p></div>
        ) : (
          <div className="space-y-6">
            {filteredLevels.map(level => {
              const isExpanded = expandedLevels.has(level.level.id);
              const totalCards = level.classes.reduce((s, c) => s + c.cardsCount, 0);
              return (
                <div key={level.level.id}>
                  {/* Niveau scolaire — titre aéré, pas dans un conteneur */}
                  <button onClick={() => toggleLevel(level.level.id)} className="flex items-center gap-2 mb-3 group">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <h3 className="text-base font-bold text-slate-800">{level.level.name}</h3>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">{totalCards} carte(s)</span>
                  </button>

                  {isExpanded && (
                    <div className="space-y-5 ml-6">
                      {level.classes.map(cls => (
                        <div key={cls.class.id}>
                          {/* Classe — titre + bouton PDF groupé */}
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-blue-500" />
                            <h4 className="text-sm font-bold text-slate-700">{cls.class.name}</h4>
                            <span className="text-[10px] text-slate-400">{cls.cardsCount} carte(s) · {cls.activeCount} active(s)</span>
                            <button onClick={() => handleDownloadClassBundle(cls.class.id, cls.class.name)} disabled={downloadingClassId === cls.class.id}
                              className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition disabled:opacity-50">
                              {downloadingClassId === cls.class.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />} PDF classe
                            </button>
                          </div>
                          {/* Cartes — grille aérée */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ml-2">
                            {cls.cards.map(card => (
                              <CardWithFlip key={card.id} card={card} academicYearName={academicYear?.name}
                                onDownload={handleDownloadCardPdf} onRevoke={(c) => { setSelectedCard(c); setIsRevokeModalOpen(true); }}
                                downloading={downloadingCardId === card.id} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isLoading && <div className="flex justify-center py-4"><RefreshCw className="h-5 w-5 animate-spin text-blue-600" /></div>}
      </div>

      {/* Modal de génération (sélection portée) */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsGenerateModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><Users className="w-4 h-4 text-green-600" /> Générer les cartes scolaires</h3>
              <p className="text-xs text-slate-500 mt-1">Sélectionnez la portée de la génération.</p>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { setGenScope('all'); setGenLevelId(''); setGenClassId(''); }} className={cn('p-3 rounded-lg border text-xs font-bold transition text-center', genScope === 'all' ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200' : 'border-slate-200 bg-white text-slate-600')}><Users className="w-4 h-4 mx-auto mb-1" />Tous les niveaux</button>
                <button onClick={() => { setGenScope('level'); setGenClassId(''); }} className={cn('p-3 rounded-lg border text-xs font-bold transition text-center', genScope === 'level' ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200' : 'border-slate-200 bg-white text-slate-600')}><Layers className="w-4 h-4 mx-auto mb-1" />Par niveau</button>
                <button onClick={() => setGenScope('class')} className={cn('p-3 rounded-lg border text-xs font-bold transition text-center', genScope === 'class' ? 'border-green-500 bg-green-50 text-green-700 ring-2 ring-green-200' : 'border-slate-200 bg-white text-slate-600')}><BookOpen className="w-4 h-4 mx-auto mb-1" />Par classe</button>
              </div>
              {genScope !== 'all' && (
                <div><label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Niveau scolaire</label>
                  <select value={genLevelId} onChange={(e) => { setGenLevelId(e.target.value); setGenClassId(''); }} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">— Sélectionner —</option>
                    {Array.from(new Map(allClasses.map(c => [c.schoolLevelId, c.schoolLevel])).values()).filter(Boolean).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((level: any) => <option key={level.id} value={level.id}>{level.name}</option>)}
                  </select>
                </div>
              )}
              {genScope === 'class' && genLevelId && (
                <div><label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Classe</label>
                  <select value={genClassId} onChange={(e) => setGenClassId(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">— Sélectionner —</option>
                    {allClasses.filter(c => c.schoolLevelId === genLevelId).sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  {genScope === 'all' && '🌍 Génération pour TOUS les élèves actifs sans carte.'}
                  {genScope === 'level' && (genLevelId ? '📚 Génération pour le niveau sélectionné.' : '⚠️ Sélectionnez un niveau.')}
                  {genScope === 'class' && (genClassId ? '🏫 Génération pour la classe sélectionnée.' : genLevelId ? '⚠️ Sélectionnez une classe.' : '⚠️ Sélectionnez un niveau puis une classe.')}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setIsGenerateModalOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg">Annuler</button>
              <button onClick={handleConfirmGenerate} disabled={isGenerating || (genScope === 'level' && !genLevelId) || (genScope === 'class' && (!genLevelId || !genClassId))} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />} {isGenerating ? 'Génération...' : 'Générer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de révocation */}
      {isRevokeModalOpen && selectedCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsRevokeModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 mb-1">Révoquer la carte {selectedCard.cardNumber}</h3>
            <p className="text-sm text-slate-500 mb-4">Élève : <strong>{selectedCard.student.firstName} {selectedCard.student.lastName}</strong></p>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Motif de révocation (obligatoire)</label>
            <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} placeholder="Ex: Carte perdue, volée..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none" rows={3} />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setIsRevokeModalOpen(false); setSelectedCard(null); setRevokeReason(''); }} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
              <button onClick={handleRevokeCard} disabled={isLoading || !revokeReason.trim()} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg">Révoquer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
