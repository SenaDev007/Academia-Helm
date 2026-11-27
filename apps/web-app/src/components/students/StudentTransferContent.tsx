/**
 * ============================================================================
 * TRANSFERTS & MOBILITÉ — Mobilité scolaire inter-écoles
 * ============================================================================
 *
 * Gestion des transferts d'élèves ENTRE établissements du réseau Academia Helm.
 * Distinct de « Sorties & Abandons » qui gère les sorties internes (archivage,
 * retrait, réintégration).
 *
 * 7 sous-onglets :
 *   1. Sortants       — transferts initiés par CETTE école vers d'autres
 *   2. Entrants       — transferts reçus d'autres écoles (à traiter)
 *   3. Demandes reçues — demandes en attente de validation
 *   4. Dossiers transférés — transferts complétés
 *   5. Historique     — tous les transferts (sortants + entrants)
 *   6. Paramètres     — politiques de transfert + règles offline-first
 *
 * Backend : /students/transfers/*
 * BFF : /api/students/transfers/*
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRightLeft, Send, Inbox, History as HistoryIcon,
  CheckCircle2, XCircle, Clock, Search, FileText, User,
  Loader2, AlertCircle, ArrowRight, Settings as SettingsIcon,
  RefreshCw, Eye, Check, X, Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import TransferWizard from './TransferWizard';
import FicheTransfertModal from './FicheTransfertModal';

type SubTab = 'OUTGOING' | 'INCOMING' | 'REQUESTS' | 'DOSSIERS' | 'HISTORY' | 'SETTINGS';

interface TransferStudent {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  matricule?: string | null;
  studentCode?: string | null;
  globalStudentId?: string | null;
}

interface TransferSchool {
  id: string;
  name: string;
  city?: string | null;
}

interface TransferRecord {
  id: string;
  student: TransferStudent;
  studentId: string;
  sourceSchoolId: string;
  sourceSchool?: TransferSchool;
  targetSchoolId: string;
  targetSchool?: TransferSchool;
  status: string;
  motif?: string | null;
  message?: string | null;
  createdAt: string;
  updatedAt: string;
  requestedAt?: string | null;
  executedAt?: string | null;
  decisionDate?: string | null;
  academicYearId: string;
  // ⭐ 2026-11-27 — Classe souhaitée (choisie pendant l'initiation) + matricules
  requestedLevelId?: string | null;
  requestedClassId?: string | null;
  requestedLevelName?: string | null;
  requestedClassName?: string | null;
  destinationLocalMatricule?: string | null;
  sourceLocalMatricule?: string | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Brouillon', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  REQUESTED: { label: 'Demandé', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  SENT_TO_DESTINATION: { label: 'Envoyé', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ACCEPTED_BY_DESTINATION: { label: 'Accepté par destination', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  REJECTED_BY_DESTINATION: { label: 'Rejeté par destination', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  APPROVED_BY_SOURCE: { label: 'Approuvé par source', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  COMPLETED: { label: 'Complété', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Annulé', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function StudentTransferContent() {
  const [activeTab, setActiveTab] = useState<SubTab>('OUTGOING');
  const [outgoing, setOutgoing] = useState<TransferRecord[]>([]);
  const [incoming, setIncoming] = useState<TransferRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [ficheModalLevel, setFicheModalLevel] = useState<'primaire' | 'secondaire' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionTransfer, setActionTransfer] = useState<TransferRecord | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'confirm-exit' | 'execute' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dossierTransfer, setDossierTransfer] = useState<TransferRecord | null>(null);
  const [dossierData, setDossierData] = useState<any>(null);
  const [isLoadingDossier, setIsLoadingDossier] = useState(false);

  // ⭐ 2026-11-27 — Finalisation côté destination : choix de la classe
  //    PHYSIQUE (section), comme le processus d'inscription.
  const [physicalClassId, setPhysicalClassId] = useState('');
  const [myClasses, setMyClasses] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  // Charger les classes physiques de MON école quand la modale « Inscrire » s'ouvre
  useEffect(() => {
    if (actionType !== 'execute' || !actionTransfer) return;
    let cancelled = false;
    setIsLoadingClasses(true);
    setPhysicalClassId('');
    fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setMyClasses(list);
        // ⭐ Pré-sélection : si une seule section correspond à la classe
        //    officielle demandée, la pré-remplir (même règle que l'inscription)
        const sections = list.filter((c: any) => actionTransfer.requestedClassId && c.officialClassId === actionTransfer.requestedClassId);
        if (sections.length === 1) setPhysicalClassId(sections[0].id);
      })
      .catch(() => { if (!cancelled) setMyClasses([]); })
      .finally(() => { if (!cancelled) setIsLoadingClasses(false); });
    return () => { cancelled = true; };
  }, [actionType, actionTransfer]);

  // Sections physiques proposées : celles de la classe officielle demandée en
  // priorité ; l'option « toutes les classes » reste accessible via un select complet
  const sectionOptions = useMemo(() => {
    if (!actionTransfer?.requestedClassId) return myClasses;
    const matching = myClasses.filter((c: any) => c.officialClassId === actionTransfer.requestedClassId);
    return matching.length > 0 ? matching : myClasses;
  }, [myClasses, actionTransfer?.requestedClassId]);

  // ─── Chargement des données ───
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [outData, inData] = await Promise.all([
        studentsService.getOutgoingTransfers().catch(() => []),
        studentsService.getIncomingTransfers().catch(() => []),
      ]);
      setOutgoing(Array.isArray(outData) ? outData : []);
      setIncoming(Array.isArray(inData) ? inData : []);
    } catch (e: any) {
      console.error('Failed to load transfers:', e);
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger les transferts', variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Filtrage par recherche ───
  const filterBySearch = (list: TransferRecord[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(t =>
      `${t.student.firstName} ${t.student.lastName}`.toLowerCase().includes(q) ||
      (t.student.matricule || '').toLowerCase().includes(q) ||
      (t.student.globalStudentId || '').toLowerCase().includes(q)
    );
  };

  // ─── Listes filtrées par sous-onglet ───
  const outgoingFiltered = useMemo(() => filterBySearch(outgoing), [outgoing, searchQuery]);
  const incomingFiltered = useMemo(() => filterBySearch(incoming), [incoming, searchQuery]);

  // Demandes reçues = entrants avec statut SENT_TO_DESTINATION (à traiter)
  const requestsFiltered = useMemo(
    () => incoming.filter(t => t.status === 'SENT_TO_DESTINATION' || t.status === 'REQUESTED'),
    [incoming]
  );

  // Dossiers transférés = tous les transferts complétés
  const dossiersFiltered = useMemo(
    () => [...outgoing, ...incoming].filter(t => t.status === 'COMPLETED'),
    [outgoing, incoming]
  );

  // Historique = tous les transferts
  const historyFiltered = useMemo(
    () => filterBySearch([...outgoing, ...incoming].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )),
    [outgoing, incoming, searchQuery]
  );

  // ─── Actions ───
  const handleAction = async () => {
    if (!actionTransfer || !actionType) return;
    setIsProcessing(true);
    try {
      if (actionType === 'approve') {
        await studentsService.approveTransfer(actionTransfer.id);
        toast({ title: '✅ Transfert approuvé', description: 'L\'élève peut maintenant être inscrit.', variant: 'success' });
      } else if (actionType === 'reject') {
        if (!rejectReason.trim()) {
          toast({ title: 'Motif requis', description: 'Veuillez indiquer un motif de rejet.', variant: 'error' });
          setIsProcessing(false);
          return;
        }
        await studentsService.rejectTransfer(actionTransfer.id, rejectReason);
        toast({ title: '✅ Transfert rejeté', description: 'L\'école source a été notifiée.', variant: 'success' });
      } else if (actionType === 'confirm-exit') {
        await studentsService.confirmTransferExit(actionTransfer.id);
        toast({ title: '✅ Sortie confirmée', description: 'L\'élève est officiellement sorti de votre établissement.', variant: 'success' });
      } else if (actionType === 'execute') {
        await studentsService.executeTransfer(actionTransfer.id, physicalClassId || null);
        toast({
          title: '✅ Élève inscrit',
          description: physicalClassId
            ? 'L\'élève est inscrit dans votre établissement et affecté à la classe choisie. Un matricule local vient d\'être généré automatiquement, et son compte financier a été initialisé selon votre grille tarifaire.'
            : 'L\'élève est inscrit dans votre établissement (matricule local généré, compte financier initialisé selon votre grille tarifaire). S\'il n\'a pas été affecté automatiquement à une classe physique, retrouvez-le dans l\'onglet « Affectations & Mouvements ».',
          variant: 'success',
        });
      }
      setActionTransfer(null);
      setActionType(null);
      setRejectReason('');
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec de l\'action', variant: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDossier = async (transfer: TransferRecord) => {
    setDossierTransfer(transfer);
    setDossierData(null);
    setIsLoadingDossier(true);
    try {
      const data = await studentsService.getTransferDossier(transfer.id, 'FULL');
      setDossierData(data);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Impossible de charger le dossier', variant: 'error' });
    } finally {
      setIsLoadingDossier(false);
    }
  };

  // ─── Stats ───
  const stats = useMemo(() => ({
    outgoing: outgoing.length,
    incoming: incoming.length,
    pending: requestsFiltered.length,
    completed: dossiersFiltered.length,
  }), [outgoing, incoming, requestsFiltered, dossiersFiltered]);

  // ─── Rendu d'une carte de transfert ───
  const renderTransferCard = (t: TransferRecord, isIncoming: boolean) => {
    const statusMeta = STATUS_META[t.status] || { label: t.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
    const otherSchool = isIncoming ? t.sourceSchool : t.targetSchool;
    const otherSchoolName = otherSchool?.name || (isIncoming ? 'École source' : 'École destination');

    return (
      <div key={t.id} className="p-4 hover:bg-slate-50/50 transition-all flex items-center justify-between group border-b border-slate-50">
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="w-11 h-11 bg-blue-50 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            {t.student.photoUrl ? (
              <img src={t.student.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-blue-900" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              {t.student.lastName} {t.student.firstName}
            </h4>
            <div className="flex items-center space-x-2 mt-1 flex-wrap gap-y-1">
              {t.student.globalStudentId && (
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">
                  {t.student.globalStudentId}
                </span>
              )}
              {t.student.matricule && (
                <>
                  <span className="text-slate-200">•</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Mat : {t.student.matricule}
                  </span>
                </>
              )}
              {(t.requestedLevelName || t.requestedClassName) && (
                <>
                  <span className="text-slate-200">•</span>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                    {isIncoming ? 'Accueil souhaité : ' : 'Souhaité : '}
                    {t.requestedLevelName || '—'}{t.requestedClassName ? ` / ${t.requestedClassName}` : ''}
                  </span>
                </>
              )}
              {t.status === 'COMPLETED' && t.destinationLocalMatricule && (
                <>
                  <span className="text-slate-200">•</span>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    Nouveau mat : {t.destinationLocalMatricule}
                  </span>
                </>
              )}
              <span className="text-slate-200">•</span>
              <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                {isIncoming ? `De : ${otherSchoolName}` : `Vers : ${otherSchoolName}`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Statut</p>
            <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border', statusMeta.color)}>
              {statusMeta.label}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleViewDossier(t)}
              className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-200 transition"
              title="Voir le dossier complet"
            >
              <Eye className="w-3.5 h-3.5 inline mr-1" />
              Dossier
            </button>

            {/* Actions contextuelles selon le statut */}
            {isIncoming && t.status === 'SENT_TO_DESTINATION' && (
              <>
                <button
                  onClick={() => { setActionTransfer(t); setActionType('approve'); }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition"
                >
                  <Check className="w-3.5 h-3.5 inline mr-1" />
                  Approuver
                </button>
                <button
                  onClick={() => { setActionTransfer(t); setActionType('reject'); }}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-700 transition"
                >
                  <X className="w-3.5 h-3.5 inline mr-1" />
                  Rejeter
                </button>
              </>
            )}

            {isIncoming && t.status === 'ACCEPTED_BY_DESTINATION' && (
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                Attente confirmation origine
              </span>
            )}

            {isIncoming && t.status === 'APPROVED_BY_SOURCE' && (
              <button
                onClick={() => { setActionTransfer(t); setActionType('execute'); }}
                className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-blue-800 transition"
              >
                Inscrire l'élève
              </button>
            )}

            {!isIncoming && t.status === 'ACCEPTED_BY_DESTINATION' && !t.executedAt && (
              <button
                onClick={() => { setActionTransfer(t); setActionType('confirm-exit'); }}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-amber-700 transition"
              >
                Confirmer sortie
              </button>
            )}

            {!isIncoming && t.status === 'APPROVED_BY_SOURCE' && !t.executedAt && (
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                Attente inscription destination
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Rendu liste vide ───
  const renderEmpty = (message: string, icon: any) => (
    <div className="p-16 text-center">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p className="text-slate-400 font-bold text-sm">{message}</p>
    </div>
  );

  // ─── Liste actuelle selon l'onglet ───
  const currentList = activeTab === 'OUTGOING' ? outgoingFiltered
    : activeTab === 'INCOMING' ? incomingFiltered
    : activeTab === 'REQUESTS' ? requestsFiltered
    : activeTab === 'DOSSIERS' ? dossiersFiltered
    : activeTab === 'HISTORY' ? historyFiltered
    : [];

  const isIncomingContext = activeTab === 'INCOMING' || activeTab === 'REQUESTS';

  return (
    <div className="space-y-4">
      {/* ⭐ Header — style white card cohérent avec les autres onglets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Transferts & Mobilité</h2>
              <p className="text-xs text-slate-500">Transferts inter-écoles — réseau Academia Helm</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFicheModalLevel('primaire')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              title="Fiche de transfert Educmaster (Primaire)"
            >
              <Download className="w-3.5 h-3.5" />
              Fiche Primaire
            </button>
            <button
              onClick={() => setFicheModalLevel('secondaire')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              title="Demande de transfert (Secondaire)"
            >
              <Download className="w-3.5 h-3.5" />
              Fiche Secondaire
            </button>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              Initier un transfert
            </button>
          </div>
        </div>

        {/* Stats rapides — style cohérent avec Sorties & Abandons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3 border-t border-slate-100">
          {[
            { label: 'Sortants', value: stats.outgoing, color: 'text-blue-600 bg-blue-50' },
            { label: 'Entrants', value: stats.incoming, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'À traiter', value: stats.pending, color: 'text-amber-600 bg-amber-50' },
            { label: 'Complétés', value: stats.completed, color: 'text-indigo-600 bg-indigo-50' },
          ].map((stat, i) => (
            <div key={i} className={cn('p-2.5 rounded-lg flex items-center gap-2', stat.color)}>
              <div className="flex-1">
                <p className="text-[10px] font-medium uppercase opacity-80">{stat.label}</p>
                <p className="text-lg font-bold">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sous-onglets — style cohérent avec les autres onglets */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        {([
          { id: 'OUTGOING', label: 'Sortants', icon: ArrowRight },
          { id: 'INCOMING', label: 'Entrants', icon: Inbox },
          { id: 'REQUESTS', label: 'Demandes reçues', icon: Clock },
          { id: 'DOSSIERS', label: 'Dossiers transférés', icon: FileText },
          { id: 'HISTORY', label: 'Historique', icon: HistoryIcon },
          { id: 'SETTINGS', label: 'Paramètres', icon: SettingsIcon },
        ] as { id: SubTab; label: string; icon: any }[]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Barre de recherche + refresh */}
      {activeTab !== 'SETTINGS' && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, matricule ou ID global..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            title="Rafraîchir"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
            Rafraîchir
          </button>
        </div>
      )}

      {/* Contenu selon l'onglet */}
      {activeTab === 'SETTINGS' ? (
        <TransferSettingsPanel />
      ) : isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <Loader2 className="w-8 h-8 text-blue-900 mx-auto mb-3 animate-spin" />
          <p className="text-slate-500 font-bold text-sm">Synchronisation des demandes...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          {activeTab === 'OUTGOING' && renderEmpty('Aucun transfert sortant', <ArrowRight className="w-7 h-7 text-slate-300" />)}
          {activeTab === 'INCOMING' && renderEmpty('Aucun transfert entrant', <Inbox className="w-7 h-7 text-slate-300" />)}
          {activeTab === 'REQUESTS' && renderEmpty('Aucune demande en attente', <Clock className="w-7 h-7 text-slate-300" />)}
          {activeTab === 'DOSSIERS' && renderEmpty('Aucun dossier transféré', <FileText className="w-7 h-7 text-slate-300" />)}
          {activeTab === 'HISTORY' && renderEmpty('Aucun transfert dans l\'historique', <HistoryIcon className="w-7 h-7 text-slate-300" />)}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {currentList.length} résultat(s)
            </p>
          </div>
          {currentList.map(t => renderTransferCard(t, isIncomingContext))}
        </div>
      )}

      {/* Modal d'action (approbation, rejet, etc.) */}
      {actionTransfer && actionType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setActionTransfer(null); setActionType(null); setRejectReason(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">
                {actionType === 'approve' && 'Approuver le transfert'}
                {actionType === 'reject' && 'Rejeter le transfert'}
                {actionType === 'confirm-exit' && 'Confirmer la sortie'}
                {actionType === 'execute' && 'Inscrire l\'élève'}
              </h3>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-50 rounded-lg overflow-hidden flex items-center justify-center">
                  {actionTransfer.student.photoUrl ? (
                    <img src={actionTransfer.student.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : <User className="w-5 h-5 text-blue-900" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{actionTransfer.student.lastName} {actionTransfer.student.firstName}</p>
                  <p className="text-xs text-slate-500">
                    {actionType === 'approve' || actionType === 'execute'
                      ? `De : ${actionTransfer.sourceSchool?.name || '—'}`
                      : `Vers : ${actionTransfer.targetSchool?.name || '—'}`}
                  </p>
                </div>
              </div>

              {actionType === 'reject' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motif du rejet</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex : Dossier incomplet, niveau non disponible..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}

              {actionType === 'approve' && (
                <p className="text-xs text-slate-600">
                  En approuvant ce transfert, vous confirmez que l'élève peut être inscrit dans votre établissement.
                  Vous pourrez ensuite finaliser l'inscription.
                </p>
              )}
              {actionType === 'confirm-exit' && (
                <p className="text-xs text-slate-600">
                  Cette action confirme officiellement la sortie de l'élève de votre établissement.
                  Le dossier sera transféré définitivement vers l'école destination. L'élève sera marqué
                  comme « transféré » et archivé dans votre établissement — il ne sera plus compté
                  parmi vos effectifs actifs.
                </p>
              )}
              {actionType === 'execute' && (
                <div className="space-y-3">
                  {/* Niveau/classe souhaités (définis pendant l'initiation) */}
                  {(actionTransfer.requestedLevelName || actionTransfer.requestedClassName) && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Accueil souhaité (défini par l'école d'origine)</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {actionTransfer.requestedLevelName || '—'}
                        {actionTransfer.requestedClassName ? ` — classe ${actionTransfer.requestedClassName}` : ''}
                      </p>
                    </div>
                  )}

                  {/* ⭐ Classe physique — même étape que le processus d'inscription */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      Classe physique (section) — votre établissement
                    </label>
                    {isLoadingClasses ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Chargement de vos classes…
                      </div>
                    ) : sectionOptions.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        Aucune classe physique configurée dans votre établissement. L'inscription se fera sans
                        classe — l'élève sera affecté plus tard via « Affectations & Mouvements ».
                      </p>
                    ) : (
                      <select
                        value={physicalClassId}
                        onChange={(e) => setPhysicalClassId(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Passer cette étape (affecter plus tard) —</option>
                        {sectionOptions.map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.schoolLevel?.name ? ` (${c.schoolLevel.name})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Si vous passez cette étape : le système affecte automatiquement la classe physique si une seule
                      section correspond à la classe officielle demandée ; sinon l'élève restera à affecter dans
                      l'onglet « Affectations & Mouvements », exactement comme le processus d'inscription.
                    </p>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800">
                    <p className="font-bold">À la confirmation :</p>
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      <li>L'élève est intégré à votre base de données avec son dossier complet</li>
                      <li>Un <strong>matricule local</strong> de votre établissement est généré automatiquement</li>
                      <li>Son <strong>matricule global Academia Helm</strong> est conservé</li>
                      <li>Son <strong>compte financier</strong> est initialisé selon <strong>votre grille tarifaire</strong> (classe, niveau et frais de réinscription de votre établissement)</li>
                      <li>L'école d'origine est notifiée ; l'élève y est archivé comme « transféré »</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => { setActionTransfer(null); setActionType(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={handleAction}
                disabled={isProcessing}
                className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50',
                  actionType === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
                )}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {actionType === 'approve' && 'Approuver'}
                {actionType === 'reject' && 'Rejeter'}
                {actionType === 'confirm-exit' && 'Confirmer'}
                {actionType === 'execute' && 'Inscrire'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal dossier complet */}
      {dossierTransfer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => { setDossierTransfer(null); setDossierData(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Dossier de transfert
              </h3>
              <button onClick={() => { setDossierTransfer(null); setDossierData(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {isLoadingDossier ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
              ) : dossierData ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Élève</p>
                      <p className="font-semibold text-slate-800">{dossierTransfer.student.lastName} {dossierTransfer.student.firstName}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Matricule</p>
                      <p className="font-mono text-slate-700">{dossierTransfer.student.matricule || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">ID Global</p>
                      <p className="font-mono text-xs text-indigo-600">{dossierTransfer.student.globalStudentId || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Statut</p>
                      <span className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border', (STATUS_META[dossierTransfer.status] || STATUS_META.DRAFT).color)}>
                        {(STATUS_META[dossierTransfer.status] || STATUS_META.DRAFT).label}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">École source</p>
                      <p className="text-slate-700">{dossierTransfer.sourceSchool?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">École destination</p>
                      <p className="text-slate-700">{dossierTransfer.targetSchool?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Date demande</p>
                      <p className="text-slate-700">{formatDate(dossierTransfer.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase">Date exécution</p>
                      <p className="text-slate-700">{formatDate(dossierTransfer.executedAt)}</p>
                    </div>
                  </div>
                  {dossierTransfer.motif && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Motif</p>
                      <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{dossierTransfer.motif}</p>
                    </div>
                  )}
                  {dossierTransfer.message && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Message</p>
                      <p className="text-slate-700 bg-slate-50 p-3 rounded-lg">{dossierTransfer.message}</p>
                    </div>
                  )}
                  {dossierData?.documents && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Documents transférés</p>
                      <div className="space-y-1">
                        {Array.isArray(dossierData.documents) && dossierData.documents.map((doc: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded text-xs">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-700">{doc.name || doc.type || `Document ${i + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-8">Aucune donnée disponible</p>
              )}
            </div>
          </div>
        </div>
      )}

      <TransferWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />

      {/* ⭐ Fiche de Transfert modals */}
      <FicheTransfertModal
        isOpen={ficheModalLevel !== null}
        onClose={() => setFicheModalLevel(null)}
        level={ficheModalLevel || 'primaire'}
      />
    </div>
  );
}

// ─── Sous-composant : Paramètres de transfert ───
function TransferSettingsPanel() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-slate-600" />
          Paramètres de mobilité scolaire
        </h3>
      </div>
      <div className="px-6 py-6 space-y-6">
        {/* Politiques de transfert */}
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Politiques de transfert</h4>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200">
              <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 mt-0.5" defaultChecked />
              <div>
                <div className="text-sm font-semibold text-slate-700">Exiger le consentement parental avant exécution</div>
                <div className="text-xs text-slate-500 mt-0.5">Le parent doit confirmer le transfert avant qu'il soit finalisé.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200">
              <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 mt-0.5" defaultChecked />
              <div>
                <div className="text-sm font-semibold text-slate-700">Bloquer les transferts sortants pour impayés</div>
                <div className="text-xs text-slate-500 mt-0.5">Empêche les transferts si l'élève a des arriérés non réglés.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 cursor-pointer border border-slate-200">
              <input type="checkbox" className="rounded text-blue-600 focus:ring-blue-500 mt-0.5" defaultChecked />
              <div>
                <div className="text-sm font-semibold text-slate-700">Notifier le parent à chaque changement de statut</div>
                <div className="text-xs text-slate-500 mt-0.5">Email/SMS automatique au parent lors de chaque étape du transfert.</div>
              </div>
            </label>
          </div>
        </div>

        {/* Règles Offline-First */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5">
          <h4 className="text-xs font-bold text-slate-900 uppercase mb-3 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            Règles Offline-First
          </h4>
          <div className="space-y-2">
            {[
              { rule: 'Préparation brouillon (DRAFT)', offline: true },
              { rule: 'Sélection des documents à transférer', offline: true },
              { rule: 'Prévisualisation du certificat', offline: true },
              { rule: 'Envoi officiel de la demande', offline: false },
              { rule: 'Notification école destination', offline: false },
              { rule: 'Acceptation / Rejet du transfert', offline: false },
              { rule: 'Création inscription école destination', offline: false },
              { rule: 'Attribution définitive du matricule local', offline: false },
              { rule: 'Synchronisation dossier complet', offline: false },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">{item.rule}</span>
                <span className={cn(
                  'text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-widest',
                  item.offline ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                )}>
                  {item.offline ? 'Hors ligne OK' : 'Connexion requise'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Double identification */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          <h4 className="text-xs font-bold text-indigo-900 uppercase mb-3">Double Identification — Règle système</h4>
          <div className="space-y-2 text-xs font-medium text-indigo-700">
            <p>• <strong>global_student_id</strong> : identité permanente dans tout Academia Helm (ex. AH-STU-2026-000000123)</p>
            <p>• <strong>local_student_matricule</strong> : identifiant administratif attribué par chaque école selon ses standards</p>
            <p>• Un transfert conserve toujours le <strong>global_student_id</strong></p>
            <p>• L'école destination attribue son propre <strong>local_student_matricule</strong></p>
            <p>• Academia Federis utilise le <strong>global_student_id</strong> pour éviter les doublons candidats aux examens</p>
          </div>
        </div>

        {/* Distinction avec Sorties & Abandons */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 inline mr-1" />
          <strong>Distinction importante :</strong> Cet onglet gère les transferts <strong>inter-écoles</strong>
          (vers une autre école du réseau Academia Helm). Pour les sorties internes (abandons, archivage,
          réintégrations), utilisez l'onglet <strong>« Sorties & Abandons »</strong>.
        </div>
      </div>
    </div>
  );
}
