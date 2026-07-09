/**
 * ============================================================================
 * STUDENT ID CARDS SECTION - Module Élèves > Onglet Cartes Scolaires
 * ============================================================================
 *
 * Fonctionnalités :
 *   - Stats : total, actives, révoquées, expirées
 *   - Bouton "Générer" (compact, dans la barre d'actions)
 *   - Liste des cartes groupées par niveau scolaire → classe (arborescence pliable)
 *   - Pour chaque classe : bouton "PDF groupé" (toutes les cartes de la classe dans 1 PDF)
 *   - Pour chaque carte : bouton "PDF" (téléchargement individuel) + bouton "Révoquer"
 *   - Modal de révocation avec motif obligatoire
 *
 * Backend :
 *   - GET  /students/id-cards/stats
 *   - GET  /students/id-cards/grouped-by-class?academicYearId=...
 *   - GET  /students/id-cards/class/:classId/bundle-pdf?academicYearId=...
 *   - GET  /students/id-cards/:cardId/download
 *   - POST /students/id-cards/generate-bulk
 *   - PUT  /students/id-cards/:cardId/revoke
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, CheckCircle, XCircle, AlertCircle, Users, RefreshCw,
  FileDown, Loader2, ChevronDown, ChevronRight, Search, Ban, Download,
} from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { cn } from '@/lib/utils';

interface IdCardStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
  expiredRate: number;
}

interface GroupedCard {
  id: string;
  cardNumber: string;
  isActive: boolean;
  isRevoked: boolean;
  generatedAt: string;
  validUntil?: string;
  pdfPath?: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    matricule?: string;
    photoUrl?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  className: string;
  levelName: string;
}

interface GroupedClass {
  class: { id: string; name: string };
  cardsCount: number;
  activeCount: number;
  cards: GroupedCard[];
}

interface GroupedLevel {
  level: { id: string; name: string; code: string };
  classes: GroupedClass[];
}

interface GroupedResult {
  academicYearId: string;
  levels: GroupedLevel[];
  totalCards: number;
}

// Avatar réutilisable
function StudentAvatar({ photoUrl, firstName, lastName, size = 'sm' }: {
  photoUrl?: string; firstName: string; lastName: string; size?: 'sm' | 'md';
}) {
  const cls = size === 'md' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-[10px]';
  if (photoUrl) {
    return <img src={photoUrl} alt={`${firstName} ${lastName}`} className={cn(cls, 'rounded-full object-cover shrink-0 border border-slate-200')} />;
  }
  return (
    <div className={cn(cls, 'rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0')}>
      {lastName?.[0] || '?'}{firstName?.[0] || ''}
    </div>
  );
}

export default function StudentIdCardsSection() {
  const confirmDialog = useConfirmDialog();
  const { academicYear, schoolLevel } = useModuleContext();
  const [stats, setStats] = useState<IdCardStats | null>(null);
  const [grouped, setGrouped] = useState<GroupedResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadingCardId, setDownloadingCardId] = useState<string | null>(null);
  const [downloadingClassId, setDownloadingClassId] = useState<string | null>(null);

  // États pour la révocation
  const [selectedCard, setSelectedCard] = useState<GroupedCard | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  // États pour l'arborescence
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Charger stats + cartes groupées
  useEffect(() => {
    if (academicYear?.id) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear?.id]);

  const loadAll = async () => {
    const academicYearId = academicYear?.id || '';
    if (!academicYearId) return;
    setIsLoading(true);
    try {
      const [statsData, groupedData] = await Promise.all([
        studentsService.getIdCardStats(academicYearId).catch(() => null),
        studentsService.getCardsGroupedByClass(academicYearId).catch(() => null),
      ]);
      setStats(statsData);
      setGrouped(groupedData);
      // Déplier le premier niveau par défaut
      if (groupedData?.levels?.length > 0 && expandedLevels.size === 0) {
        setExpandedLevels(new Set([groupedData.levels[0].level.id]));
      }
    } catch (e: any) {
      console.error('Load error:', e);
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Génération en lot (TOUS les élèves sans carte, tous niveaux confondus)
  // ⭐ On ne passe PAS schoolLevelId pour générer sur tous les niveaux.
  // Si l'utilisateur veut filtrer par niveau, il utilise le bouton par classe
  // dans l'arborescence (handleGenerateForClass).
  const handleGenerateBulk = async () => {
    const ok = await confirmDialog.info(
      'Des cartes seront générées pour TOUS les élèves actifs sans carte (tous niveaux confondus). Voulez-vous continuer ?',
      'Générer les cartes',
    );
    if (!ok) return;
    const academicYearId = academicYear?.id || '';
    if (!academicYearId) {
      toast({ title: 'Attention', description: 'Aucune année scolaire sélectionnée.', variant: 'error' });
      return;
    }
    setIsGenerating(true);
    try {
      // ⭐ Pas de schoolLevelId → génère pour TOUS les niveaux
      const data = await studentsService.generateBulkIdCards({ academicYearId });
      toast({
        title: '✅ Génération terminée',
        description: `${data.succeeded} carte(s) générée(s) sur ${data.total} élève(s).`,
        variant: 'success',
      });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec génération', variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Génération pour une classe spécifique
  const handleGenerateForClass = async (classId: string, schoolLevelId: string) => {
    const academicYearId = academicYear?.id || '';
    if (!academicYearId || !schoolLevelId) return;
    setIsGenerating(true);
    try {
      const data = await studentsService.generateBulkIdCards({ academicYearId, schoolLevelId, classId });
      toast({
        title: '✅ Génération classe',
        description: `${data.succeeded} carte(s) générée(s) sur ${data.total} élève(s).`,
        variant: 'success',
      });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Téléchargement PDF individuel
  const handleDownloadCardPdf = async (card: GroupedCard) => {
    setDownloadingCardId(card.id);
    try {
      const blob = await studentsService.downloadIdCardPdf(card.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `carte-${card.student.lastName}-${card.student.firstName}-${card.cardNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Téléchargement échoué', variant: 'error' });
    } finally {
      setDownloadingCardId(null);
    }
  };

  // Téléchargement PDF groupé par classe
  const handleDownloadClassBundle = async (classId: string, className: string) => {
    const academicYearId = academicYear?.id || '';
    if (!academicYearId) return;
    setDownloadingClassId(classId);
    try {
      const blob = await studentsService.downloadClassBundlePdf(classId, academicYearId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = className.replace(/[^a-zA-Z0-9-_]/g, '_');
      a.download = `cartes-scolaires-${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: '✅ PDF téléchargé', description: `Cartes de la classe ${className}`, variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Téléchargement échoué', variant: 'error' });
    } finally {
      setDownloadingClassId(null);
    }
  };

  // Révocation
  const handleRevokeCard = async () => {
    if (!selectedCard || !revokeReason.trim()) return;
    setIsLoading(true);
    try {
      await studentsService.revokeIdCard(selectedCard.id, revokeReason);
      toast({ title: '✅ Carte révoquée', variant: 'success' });
      setIsRevokeModalOpen(false);
      setSelectedCard(null);
      setRevokeReason('');
      loadAll();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle arborescence
  const toggleLevel = (levelId: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(levelId)) next.delete(levelId);
      else next.add(levelId);
      return next;
    });
  };
  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  // Filtrage par recherche
  const filteredLevels = useMemo(() => {
    if (!grouped) return [];
    if (!searchQuery.trim()) return grouped.levels;
    const q = searchQuery.toLowerCase();
    return grouped.levels.map(l => ({
      ...l,
      classes: l.classes.map(c => ({
        ...c,
        cards: c.cards.filter(card =>
          `${card.student.firstName} ${card.student.lastName}`.toLowerCase().includes(q) ||
          (card.student.matricule || '').toLowerCase().includes(q) ||
          card.cardNumber.toLowerCase().includes(q)
        ),
      })).filter(c => c.cards.length > 0),
    })).filter(l => l.classes.length > 0);
  }, [grouped, searchQuery]);

  return (
    <>
      {confirmDialog.dialog}
      <div className="space-y-4">
        {/* ─── En-tête : Stats + Bouton Générer compact ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Cartes Scolaires
          </h2>
          {/* ⭐ Bouton "Générer" COMPACT (plus petit qu'avant) */}
          <button
            onClick={handleGenerateBulk}
            disabled={isGenerating || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            title="Générer les cartes pour tous les élèves actifs sans carte"
          >
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
                <div>
                  <p className="text-[9px] font-medium text-slate-500 uppercase">{s.label}</p>
                  <p className="text-base font-bold text-slate-900 leading-tight">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recherche */}
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un élève, matricule, numéro de carte..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ─── Liste arborescente par niveau → classe ─── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !grouped || grouped.totalCards === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 mb-1">Aucune carte scolaire générée</p>
              <p className="text-xs text-slate-400">Cliquez sur "Générer les cartes" pour commencer.</p>
            </div>
          ) : filteredLevels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm text-slate-500">Aucune carte ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredLevels.map(level => {
                const isLevelExpanded = expandedLevels.has(level.level.id);
                const totalCardsInLevel = level.classes.reduce((sum, c) => sum + c.cardsCount, 0);
                const totalActiveInLevel = level.classes.reduce((sum, c) => sum + c.activeCount, 0);
                return (
                  <div key={level.level.id}>
                    {/* Niveau */}
                    <button
                      onClick={() => toggleLevel(level.level.id)}
                      className="w-full flex items-center gap-2 p-3 hover:bg-slate-50 transition text-left"
                    >
                      {isLevelExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <span className="text-sm font-bold text-slate-800">{level.level.name}</span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{level.level.code}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">
                          {totalCardsInLevel} carte(s)
                        </span>
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">
                          {totalActiveInLevel} active(s)
                        </span>
                      </span>
                    </button>
                    {/* Classes du niveau */}
                    {isLevelExpanded && (
                      <div className="bg-slate-50/50">
                        {level.classes.map(cls => {
                          const isClassExpanded = expandedClasses.has(cls.class.id);
                          return (
                            <div key={cls.class.id} className="border-l-2 border-blue-200 ml-4">
                              {/* Classe header */}
                              <div className="flex items-center gap-2 p-2 hover:bg-blue-50/50 transition">
                                <button
                                  onClick={() => toggleClass(cls.class.id)}
                                  className="flex items-center gap-2 flex-1 text-left"
                                >
                                  {isClassExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                  <Users className="w-3.5 h-3.5 text-blue-500" />
                                  <span className="text-xs font-bold text-slate-700">{cls.class.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {cls.cardsCount} carte(s) · {cls.activeCount} active(s)
                                  </span>
                                </button>
                                {/* ⭐ Bouton PDF groupé par classe */}
                                <button
                                  onClick={() => handleDownloadClassBundle(cls.class.id, cls.class.name)}
                                  disabled={downloadingClassId === cls.class.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition disabled:opacity-50"
                                  title="Télécharger un PDF avec toutes les cartes de cette classe"
                                >
                                  {downloadingClassId === cls.class.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <FileDown className="w-3 h-3" />
                                  )}
                                  PDF classe
                                </button>
                              </div>
                              {/* Cartes de la classe */}
                              {isClassExpanded && (
                                <div className="bg-white">
                                  {cls.cards.map(card => (
                                    <div
                                      key={card.id}
                                      className="flex items-center gap-2 p-2 border-t border-slate-100 hover:bg-slate-50/80 transition"
                                    >
                                      <StudentAvatar
                                        photoUrl={card.student.photoUrl}
                                        firstName={card.student.firstName}
                                        lastName={card.student.lastName}
                                        size="sm"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">
                                          {card.student.lastName.toUpperCase()} {card.student.firstName}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                          {card.cardNumber} · {card.student.matricule || '—'}
                                        </p>
                                      </div>
                                      {/* Statut */}
                                      <span className={cn(
                                        'px-1.5 py-0.5 text-[9px] font-bold rounded border',
                                        card.isRevoked
                                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                                          : card.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-slate-50 text-slate-600 border-slate-200'
                                      )}>
                                        {card.isRevoked ? 'Révoquée' : card.isActive ? 'Active' : 'Inactive'}
                                      </span>
                                      {/* ⭐ Bouton PDF individuel */}
                                      <button
                                        onClick={() => handleDownloadCardPdf(card)}
                                        disabled={downloadingCardId === card.id}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition disabled:opacity-50"
                                        title="Télécharger le PDF de cette carte"
                                      >
                                        {downloadingCardId === card.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Download className="w-3 h-3" />
                                        )}
                                      </button>
                                      {/* Bouton Révoquer (si active) */}
                                      {card.isActive && !card.isRevoked && (
                                        <button
                                          onClick={() => {
                                            setSelectedCard(card);
                                            setIsRevokeModalOpen(true);
                                          }}
                                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded border border-rose-200 transition"
                                          title="Révoquer cette carte"
                                        >
                                          <Ban className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        )}
      </div>

      {/* Modal de révocation */}
      {isRevokeModalOpen && selectedCard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setIsRevokeModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Révoquer la carte {selectedCard.cardNumber}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Élève : <strong>{selectedCard.student.firstName} {selectedCard.student.lastName}</strong>
            </p>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Motif de révocation (obligatoire)
            </label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Ex: Carte perdue, carte volée, carte endommagée..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              rows={3}
            />
            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => { setIsRevokeModalOpen(false); setSelectedCard(null); setRevokeReason(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleRevokeCard}
                disabled={isLoading || !revokeReason.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition"
              >
                Révoquer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
