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
    studentCode?: string; photoUrl?: string; dateOfBirth?: string; gender?: string;
  };
  guardian?: {
    firstName: string; lastName: string; phone: string; address: string;
  } | null;
  className: string; levelName: string; levelCode?: string;
}

interface GroupedClass { class: { id: string; name: string }; cardsCount: number; activeCount: number; cards: GroupedCard[]; }
interface GroupedLevel { level: { id: string; name: string; code: string }; classes: GroupedClass[]; }
interface GroupedResult { academicYearId: string; levels: GroupedLevel[]; totalCards: number; }

const NAVY = '#0D1F6E';

// ─── Hook : récupère l'identité du tenant (logo, nom école, slogan, adresse, etc.) ───
interface TenantIdentity {
  schoolName: string;
  slogan?: string;
  address?: string;
  city?: string;
  phonePrimary?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  maternellePickupMorning?: string;
  maternellePickupAfternoon?: string;
}

function useTenantIdentity() {
  const [identity, setIdentity] = useState<TenantIdentity | null>(null);
  useEffect(() => {
    fetch('/api/settings/identity', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data === 'object') {
          const profile = Array.isArray(data) ? data[0] : data;
          setIdentity({
            schoolName: profile?.schoolName || profile?.name || 'Établissement Scolaire',
            slogan: profile?.slogan || 'Excellence • Discipline • Travail',
            address: profile?.address || '',
            city: profile?.city || '',
            phonePrimary: profile?.phonePrimary || profile?.phone || '',
            email: profile?.email || '',
            website: profile?.website || '',
            logoUrl: profile?.logoUrl || '',
            maternellePickupMorning: profile?.maternellePickupMorning || '12:00',
            maternellePickupAfternoon: profile?.maternellePickupAfternoon || '16:30',
          });
        }
      })
      .catch(() => setIdentity(null));
  }, []);
  return identity;
}

// ─── Composant carte visuelle (recto/verso) rendu en React ───

function CardVisual({ card, face, academicYearName, identity }: {
  card: GroupedCard; face: 'recto' | 'verso'; academicYearName?: string; identity: TenantIdentity | null;
}) {
  const s = card.student;
  const g = card.guardian;
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

  const schoolName = identity?.schoolName || 'Établissement Scolaire';
  const slogan = identity?.slogan || 'Excellence • Discipline • Travail';
  const schoolPhone = identity?.phonePrimary || '';
  const schoolEmail = identity?.email || '';
  const schoolWebsite = identity?.website || '';
  const logoUrl = identity?.logoUrl || '';

  // Infos parent/tuteur
  const guardianName = g ? `${g.firstName} ${g.lastName}`.trim() : '—';
  const guardianPhone = g?.phone || '—';
  const guardianAddress = g?.address || '—';

  // Heures de sortie maternelle
  const isMaternelle = (card.levelCode || '').toUpperCase() === 'MATERNELLE' || (card.levelCode || '').toUpperCase() === 'MAT';
  const pickupMorning = identity?.maternellePickupMorning || '12:00';
  const pickupAfternoon = identity?.maternellePickupAfternoon || '16:30';

  const LogoBox = ({ size = 'normal' }: { size?: 'normal' | 'small' }) => {
    const cls = size === 'small' ? 'w-6 h-6' : 'w-8 h-8';
    if (logoUrl) return <img src={logoUrl} alt="Logo" className={cn(cls, 'rounded object-contain bg-white p-0.5')} />;
    return <div className={cn(cls, 'rounded bg-white flex items-center justify-center font-bold')} style={{ color: NAVY, fontSize: size === 'small' ? '8px' : '10px' }}>AH</div>;
  };

  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-lg overflow-hidden shadow-md border border-slate-200 flex flex-col" style={{ aspectRatio: '85.6 / 53.98' }}>
        {/* En-tête bleu : LOGO + NOM ÉCOLE + SLOGAN */}
        <div className="flex items-center px-2 py-1.5 shrink-0" style={{ background: NAVY, color: '#fff' }}>
          <div className="flex flex-col items-start gap-0.5 shrink-0"><LogoBox size="normal" /></div>
          <div className="flex-1 text-center px-2 min-w-0">
            <div className="font-bold text-[8px] uppercase tracking-wide leading-tight truncate">{schoolName}</div>
            <div className="text-[5px] italic opacity-80 leading-tight truncate">{slogan}</div>
          </div>
          <div className="w-8 shrink-0" />
        </div>

        {/* Corps : photo (gauche) + champs (droite) */}
        <div className="flex flex-1 p-2 gap-2 min-h-0">
          <div className="flex flex-col items-center justify-center gap-1 shrink-0">
            <div className="w-16 h-16 rounded border-2 overflow-hidden flex items-center justify-center" style={{ borderColor: NAVY, background: '#f3f4f6' }}>
              {s.photoUrl ? <img src={s.photoUrl} alt={s.firstName + ' ' + s.lastName} className="w-full h-full object-cover" /> : <span className="text-[7px] text-slate-400">PHOTO</span>}
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
            {/* Labels en français */}
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Matricule</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.matricule || s.studentCode || '—'}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>N° Carte</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{card.cardNumber}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Nom Élève</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{s.firstName} {s.lastName}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Parent/Tuteur</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{guardianName}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Classe</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{card.className}</span></div>
            <div className="flex items-baseline gap-1"><span className="font-bold text-[5px] uppercase shrink-0" style={{ color: NAVY }}>Urgence</span><span className="text-[5px] text-slate-400">:</span><span className="text-[6px] text-slate-800 truncate">{guardianPhone}</span></div>
          </div>
        </div>

        {/* Pied bleu : adresse parent (pas école) */}
        <div className="flex items-center justify-between px-2 py-1 shrink-0" style={{ background: NAVY, color: '#fff' }}>
          <span className="text-[5px] opacity-90 truncate">Adresse : {guardianAddress}</span>
        </div>
      </div>
    );
  }

  // VERSO
  return (
    <div className="w-full bg-white rounded-lg overflow-hidden shadow-md border border-slate-200 flex flex-col" style={{ aspectRatio: '85.6 / 53.98' }}>
      {/* En-tête bleu : "Conditions" + dates */}
      <div className="flex items-center justify-between px-2 py-1.5 shrink-0" style={{ background: NAVY, color: '#fff' }}>
        <span className="text-[7px] font-bold uppercase tracking-wide">Conditions</span>
        <div className="text-right text-[5px] leading-tight">
          <div>Émise le : {formatDate(card.generatedAt)}</div>
          <div>Expire le : {formatDate(card.validUntil)}</div>
        </div>
      </div>

      <div className="flex flex-1 p-2 gap-2 min-h-0">
        {/* Gauche : conditions + contact école */}
        <div className="flex-1 flex flex-col min-w-0">
          <ul className="text-[4px] text-slate-500 space-y-0.5 list-disc pl-2 mb-1">
            <li>Cette carte est strictement personnelle et incessible.</li>
            <li>À présenter à toute demande du personnel autorisé.</li>
            <li>Signaler toute perte ou vol à l'administration.</li>
          </ul>
          {/* ⭐ Heures de sortie maternelle */}
          {isMaternelle && (
            <div className="my-1 px-1.5 py-1 rounded bg-amber-50 border border-amber-200">
              <div className="text-[4px] font-bold text-amber-700 uppercase mb-0.5">🕐 Heures de sortie</div>
              <div className="text-[4px] text-amber-800">Matin : {pickupMorning}</div>
              <div className="text-[4px] text-amber-800">Après-midi : {pickupAfternoon}</div>
            </div>
          )}
          <div className="mt-auto pt-1 border-t border-dashed border-slate-200 text-[4px] space-y-0.5">
            <div><span className="font-bold" style={{ color: NAVY }}>Tél : </span>{schoolPhone || '—'}</div>
            <div><span className="font-bold" style={{ color: NAVY }}>Email : </span>{schoolEmail || '—'}</div>
            {schoolWebsite && <div><span className="font-bold" style={{ color: NAVY }}>Site : </span>{schoolWebsite}</div>}
          </div>
        </div>
        {/* Droite : QR code + signature */}
        <div className="flex flex-col items-center justify-between gap-1 shrink-0" style={{ width: '52px' }}>
          <div className="w-10 h-10 border border-slate-300 rounded bg-white flex items-center justify-center p-0.5">
            <div className="grid grid-cols-6 grid-rows-6 gap-px w-full h-full">
              {Array.from({ length: 36 }).map((_, i) => (<div key={i} className={cn(((i * 7 + 3) % 5 < 3) ? 'bg-black' : 'bg-white')} />))}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[6px] italic" style={{ color: NAVY, fontFamily: 'Brush Script MT, cursive' }}>Le Directeur</div>
            <div className="text-[3px] text-slate-400">Signature</div>
          </div>
        </div>
      </div>

      {/* Pied bleu : logo + nom école */}
      <div className="flex items-center justify-between px-2 py-1 shrink-0" style={{ background: NAVY, color: '#fff' }}>
        <div className="flex items-center gap-1"><LogoBox size="small" /><span className="text-[5px] font-bold truncate">{schoolName}</span></div>
        <span className="text-[5px] opacity-90 shrink-0">Academia Helm</span>
      </div>
    </div>
  );
}

// ─── Composant carte avec switcher recto/verso ───

function CardWithFlip({ card, academicYearName, identity, onDownload, onRevoke, downloading }: {
  card: GroupedCard; academicYearName?: string; identity: TenantIdentity | null;
  onDownload: (card: GroupedCard) => void; onRevoke: (card: GroupedCard) => void; downloading: boolean;
}) {
  const [face, setFace] = useState<'recto' | 'verso'>('recto');
  const s = card.student;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition">
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
      <div className="p-3 bg-slate-50 relative">
        <CardVisual card={card} face={face} academicYearName={academicYearName} identity={identity} />
        <button onClick={() => setFace(face === 'recto' ? 'verso' : 'recto')}
          className="absolute top-1 right-1 inline-flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-white bg-slate-700 hover:bg-slate-800 rounded-lg shadow-sm transition"
          title={face === 'recto' ? 'Voir le verso' : 'Voir le recto'}>
          <RotateCw className="w-2.5 h-2.5" />{face === 'recto' ? 'Verso' : 'Recto'}
        </button>
      </div>
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
  const identity = useTenantIdentity();
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
                              <CardWithFlip key={card.id} card={card} academicYearName={academicYear?.name} identity={identity}
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
