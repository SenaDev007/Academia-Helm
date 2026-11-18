'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download, Loader2, Filter,
  ChevronLeft, ChevronRight, MoreHorizontal, Upload, Crown, Search, X, CheckCircle2,
  Pencil, Save, XCircle, AlertTriangle,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { financeService } from '@/services/finance.service';
// ⭐ FIX 2026-09-09 « switch année sans effet » : le bilan suit l'année du
//    sélecteur GLOBAL (header/sidebar) via le contexte partagé.
import { useAcademicYear } from '@/hooks/useAcademicYear';
import { formatCurrency, cn } from '@/lib/utils';
import ImportBilanModal from './ImportBilanModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeeInstallment {
  id: string;       // ⭐ conservé pour key React, mais la clé de tuitionInstallments est le label
  label: string;     // ⭐ utilisée comme clé de tuitionInstallments (voir fix ci-dessous)
  amount: number;
  orderIndex: number;
}

interface StudentPaymentRow {
  studentId: string;
  studentName: string;
  className: string;
  classCode: string;
  // Montants attendus (Total dû)
  inscriptionExpected: number;
  reinscriptionExpected: number;
  arrearExpected: number;
  // ⭐ Arriéré RESTANT DÛ (non payé) — ce que l'élève doit encore,
  //    même définition que le compte élève et l'onglet Recouvrement
  arrearRemaining?: number;
  totalTuitionExpected: number;
  // ⭐ Scolarité = totalTuitionExpected (colonne explicite demandée par l'utilisateur)
  scolarite?: number;
  // ⭐ Personnalisation : indique si l'élève a un FeeOverride + montant de la réduction
  hasPersonalization?: boolean;
  personalizationAmount?: number;
  personalizationReduction?: number;
  // Montants payés
  inscriptionPaid: number;
  reinscriptionPaid: number;
  arrearPaid: number;
  tuitionInstallments: { [installmentLabel: string]: number };
  totalTuitionPaid: number;
  // Totaux cohérents
  totalDue: number;
  totalPaid: number;
  reste: number;
}

interface RecapRow {
  effectif: number;
  className: string;
  // Attendu
  arrieres: number;
  inscription: number;
  reinscription: number;
  totalTuition: number;
  // ⭐ Scolarité + Personnalisation (colonnes demandées)
  scolarite?: number;
  personalizationCount?: number;
  personalizationReduction?: number;
  totalDue: number;
  // Payé
  arrieresPaid: number;
  inscriptionPaid: number;
  reinscriptionPaid: number;
  totalTuitionPaid: number;
  totalPaid: number;
  tuitionInstallments: { [installmentLabel: string]: number };
  // Reste
  reste: number;
  soldeParClasse: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CollectionSummaryContent() {
  const [activeSubTab, setActiveSubTab] = useState<'detail' | 'recap' | 'promoter'>('detail');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  // ⭐ FIX 2026-09-09 « switch année sans effet » (incident Mon Avenir Plus) :
  //    Avant : le composant résolvait SA PROPRE année au montage
  //    (years.find(isActive)) et IGNORAIT le sélecteur d'année du header.
  //    L'école ayant activé 2026-2027 (données vides) alors que tout le
  //    bilan importé était en 2025-2026, le switch header ne changeait
  //    RIEN → « je ne vois ni frais, ni tranches, rien ».
  //    Maintenant : academicYearId = année du contexte global (header).
  const { currentYear, isLoading: academicYearLoading } = useAcademicYear();
  const academicYearId = currentYear?.id || '';
  // ⭐ Toggle : exclure les paiements reçus sur la caisse FONDE (caisse promoteur)
  //    du bilan des encaissements. Permet d'isoler les stats caissiers.
  const [excludePromoterCaisse, setExcludePromoterCaisse] = useState<boolean>(false);

  // ⭐ Recherche par numéro de reçu ou nom d'élève (filtre côté client)
  const [searchQuery, setSearchQuery] = useState('');

  // ⭐ Liste des élèves marqués "paiement fondateur" (sous-onglet dédié)
  const [promoterEligibleList, setPromoterEligibleList] = useState<any[]>([]);
  const [promoterLoading, setPromoterLoading] = useState(false);

  // Données
  const [installments, setInstallments] = useState<FeeInstallment[]>([]);
  const [studentRows, setStudentRows] = useState<StudentPaymentRow[]>([]);
  const [recapRows, setRecapRows] = useState<RecapRow[]>([]);

  // ⭐ Pagination serveur — uniquement sur le sous-onglet « Bilan détaillé » (liste élèves).
  // Le sous-onglet « Récapitulatif » reste non paginé (faible cardinalité).
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);

  // Modal d'import en masse du bilan des encaissements
  const [modalImport, setModalImport] = useState(false);

  // ⭐ MODE ÉDITION — permet de modifier directement les montants payés par élève
  //    pour réaligner les données de l'année scolaire écoulée avant le basculement
  //    vers l'année prochaine. Bouton "Modifier" activé → champs éditables →
  //    boutons "Enregistrer" / "Annuler" → persistance en DB via endpoint dédié.
  const [editMode, setEditMode] = useState(false);
  // Map: studentId → { inscriptionPaid, reinscriptionPaid, arrearPaid, tuitionInstallments: {label: amount} }
  const [editBuffer, setEditBuffer] = useState<Map<string, any>>(new Map());
  const [savingStudent, setSavingStudent] = useState<string | null>(null);

  // Initialise le buffer d'édition quand on entre en mode édition
  const enterEditMode = () => {
    const buffer = new Map<string, any>();
    for (const row of studentRows) {
      buffer.set(row.studentId, {
        inscriptionPaid: row.inscriptionPaid,
        reinscriptionPaid: row.reinscriptionPaid,
        arrearPaid: row.arrearPaid,
        tuitionInstallments: { ...(row.tuitionInstallments || {}) },
      });
    }
    setEditBuffer(buffer);
    setEditMode(true);
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setEditBuffer(new Map());
  };

  // Met à jour une valeur dans le buffer d'édition
  const updateEditValue = (studentId: string, field: string, value: number) => {
    setEditBuffer(prev => {
      const newBuffer = new Map(prev);
      const current = newBuffer.get(studentId) || {};
      newBuffer.set(studentId, { ...current, [field]: value });
      return newBuffer;
    });
  };

  const updateEditInstallment = (studentId: string, label: string, value: number) => {
    setEditBuffer(prev => {
      const newBuffer = new Map(prev);
      const current = newBuffer.get(studentId) || { tuitionInstallments: {} };
      newBuffer.set(studentId, {
        ...current,
        tuitionInstallments: { ...(current.tuitionInstallments || {}), [label]: value },
      });
      return newBuffer;
    });
  };

  // Sauvegarde les modifications d'un élève vers le backend
  const saveStudentEdit = async (studentId: string) => {
    const edits = editBuffer.get(studentId);
    if (!edits || !academicYearId) return;

    setSavingStudent(studentId);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const response = await fetch('/api/finance/collection-summary/update-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
        body: JSON.stringify({
          studentId,
          academicYearId,
          inscriptionPaid: Number(edits.inscriptionPaid) || 0,
          reinscriptionPaid: Number(edits.reinscriptionPaid) || 0,
          arrearPaid: Number(edits.arrearPaid) || 0,
          tuitionInstallments: edits.tuitionInstallments,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || `HTTP ${response.status}`);
      }

      // Recharger les données pour refléter les changements
      await loadData();
      // Le buffer sera réinitialisé par loadData() car editBuffer est conservé
      // mais les valeurs ont été sauvegardées → on marque l'élève comme "saved"
      setEditBuffer(prev => {
        const newBuffer = new Map(prev);
        newBuffer.delete(studentId); // Plus de modifications en attente pour cet élève
        return newBuffer;
      });
    } catch (err: any) {
      alert(`Erreur lors de la sauvegarde: ${err.message}`);
    } finally {
      setSavingStudent(null);
    }
  };

  // ─── Load school levels (une seule fois) ──────────────────────────────────
  useEffect(() => {
    const authHeaders = getClientAuthorizationHeader();

    // School levels
    fetch('/api/school-levels', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // ─── Classes physiques DE L'ANNÉE SÉLECTIONNÉE (rechargées au switch) ─────
  // ⭐ FIX 2026-09-09 : la requête porte academicYearId (sinon le BFF retombe
  //    sur l'année ACTIVE — 22 classes 2026-2027 pendant que le bilan affiche
  //    2025-2026 → un classId hors année filtre à 0 ligne). On reset aussi la
  //    sélection de classe : les IDs de classes appartiennent à une année.
  useEffect(() => {
    if (!academicYearId) {
      setClasses([]);
      return;
    }
    const authHeaders = getClientAuthorizationHeader();
    setSelectedClassId('');
    setCurrentPage(1);
    fetch(`/api/all-classes?academicYearId=${encodeURIComponent(academicYearId)}`, {
      headers: { ...authHeaders },
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((d) => {
        const cls = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(cls);
      })
      .catch(() => setClasses([]));
  }, [academicYearId]);

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!academicYearId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const params = new URLSearchParams({ academicYearId });
      if (selectedLevelId) params.set('levelId', selectedLevelId);
      if (selectedClassId) params.set('classId', selectedClassId);
      // ⭐ Exclure la caisse FONDE si demandé (filtre caissiers vs promoteur)
      if (excludePromoterCaisse) params.set('excludePromoterCaisse', 'true');
      // ⭐ Pagination uniquement sur la liste `students` (pas sur `recap` qui reste global)
      params.set('page', String(currentPage));
      params.set('limit', String(PAGE_SIZE));

      const response = await fetch(`/api/finance/collection-summary?${params.toString()}`, {
        headers: { ...authHeaders },
        credentials: 'include',
        cache: 'no-store',
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.message || errData?.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setInstallments(data.installments || []);
      setStudentRows(data.students || []);
      setRecapRows(data.recap || []);
      // ⭐ Gérer la réponse paginée (studentsTotal présent) ou non paginée (rétro-compat)
      setTotalStudents(data.studentsTotal ?? (data.students?.length ?? 0));
      setTotalPages(data.studentsTotalPages ?? 1);
    } catch (err: any) {
      console.error('[CollectionSummary] Error:', err);
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedLevelId, selectedClassId, currentPage, excludePromoterCaisse]);

  useEffect(() => {
    // ⭐ Attendre la résolution de l'année globale (contexte) avant de charger
    //    — évite le flash « Aucune donnée » pendant le chargement des années.
    if (!academicYearId && academicYearLoading) return;
    loadData();
  }, [loadData, academicYearId, academicYearLoading]);

  // ⭐ Reset page à 1 quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [academicYearId, selectedLevelId, selectedClassId]);

  // ⭐ Charger la liste des élèves "paiement fondateur" quand le sous-onglet est actif
  useEffect(() => {
    if (activeSubTab !== 'promoter' || !academicYearId) return;
    setPromoterLoading(true);
    financeService.listPromoterEligible(academicYearId)
      .then((list) => setPromoterEligibleList(list))
      .catch((err) => {
        console.error('[PromoterEligible] Load failed:', err);
        setPromoterEligibleList([]);
      })
      .finally(() => setPromoterLoading(false));
  }, [activeSubTab, academicYearId]);

  // ─── Filtered classes based on selected level ──────────────────────────────
  // ⭐ FIX 2026-09-07 « miroir bilingue » : les niveaux EN (Nursery/Primary) du
  //    sélecteur partagent le schoolLevelId de leur miroir FR, mais leur CODE
  //    ('primary') ne matche JAMAIS le code des classes physiques ('primaire')
  //    → 0 classes affichées côté anglophone alors que ce sont les MÊMES
  //    classes/élèves. On mappe le code EN vers le code FR jumelé.
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = schoolLevels.find((l) => l.id === selectedLevelId);
    if (!selectedLevel) return classes;
    const EN_TO_FR: Record<string, string> = {
      nursery: 'maternelle',
      primary: 'primaire',
      secondary: 'secondaire',
    };
    const rawCode = (selectedLevel.code || '').toLowerCase();
    const code = EN_TO_FR[rawCode] || rawCode;
    return classes.filter((c: any) => {
      const levelCode = (c.schoolLevel?.code || '').toLowerCase();
      return levelCode === code;
    });
  }, [classes, selectedLevelId, schoolLevels]);

  // ⭐ Filtrage par recherche (nom d'élève) — côté client sur studentRows
  const filteredStudentRows = useMemo(() => {
    if (!searchQuery.trim()) return studentRows;
    const q = searchQuery.toLowerCase().trim();
    return studentRows.filter((row) =>
      row.studentName.toLowerCase().includes(q) ||
      row.studentId.toLowerCase().includes(q) ||
      row.className.toLowerCase().includes(q) ||
      row.classCode.toLowerCase().includes(q)
    );
  }, [studentRows, searchQuery]);

  // ─── Export Excel ───────────────────────────────────────────────────────────
  // ⭐ Génère un fichier Excel (.xlsx) avec 2 feuilles :
  //    1. "Bilan détaillé" — un élève par ligne avec toutes les colonnes
  //    2. "Récapitulatif" — une classe par ligne avec totaux
  //    Utilise la lib xlsx (déjà présente dans les dépendances web-app).
  // ⭐ PERF (chantier GTMetrix) : SheetJS (~120 Ko gz) chargé à la demande
  //    au clic Export — retiré du chunk de la vue Finance.
  // ⭐ Totaux de synthèse du pied de tableau — calculés sur TOUTES les
  //    classes (recapRows global, non paginé) :
  //    1 ligne inscription/réinscription + 1 ligne scolarité
  //    (chaque ligne : montant attendu, payé, restant).
  const summaryTotals = useMemo(() => {
    const inscDue = recapRows.reduce(
      (s, r) => s + Number(r.inscription || 0) + Number(r.reinscription || 0), 0);
    const inscPaid = recapRows.reduce(
      (s, r) => s + Number(r.inscriptionPaid || 0) + Number(r.reinscriptionPaid || 0), 0);
    const scolDue = recapRows.reduce(
      (s, r) => s + Number(r.scolarite ?? r.totalTuition ?? 0), 0);
    const scolPaid = recapRows.reduce(
      (s, r) => s + Number(r.totalTuitionPaid || 0), 0);
    return {
      inscDue,
      inscPaid,
      inscReste: inscDue - inscPaid,
      scolDue,
      scolPaid,
      scolReste: scolDue - scolPaid,
    };
  }, [recapRows]);

  const handleExportExcel = async () => {
    if (studentRows.length === 0 && recapRows.length === 0) {
      alert('Aucune donnée à exporter. Veuillez sélectionner une année scolaire et une classe.');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const instLabels = installments.map((i) => i.label);

      // ── Feuille 1 : Bilan détaillé (un élève par ligne) ──
      // ⭐ Sémantique 2026-11 : « Arriéré » = restant DÛ (non payé — même
      //    définition que le compte élève), « Total payé » = inscription +
      //    réinscription + tranches uniquement (jamais les arriérés).
      const detailData = studentRows.map((row) => {
        const instData: Record<string, number> = {};
        for (const label of instLabels) {
          instData[label] = row.tuitionInstallments?.[label] || 0;
        }
        return {
          'Noms et Prénoms': row.studentName,
          'Classe': row.className,
          'Arriéré (restant dû)': row.arrearRemaining ?? 0,
          'Inscription payée': row.inscriptionPaid || 0,
          'Réinscription payée': row.reinscriptionPaid || 0,
          'Scolarité (attendu)': row.scolarite ?? row.totalTuitionExpected ?? 0,
          'Personnalisation': row.hasPersonalization ? `Oui (${formatCurrency(row.personalizationReduction || 0)})` : 'Non',
          ...instData,
          'Total dû': row.totalDue || 0,
          'Total payé': row.totalPaid || 0,
          'Reste à payer': row.reste || 0,
        };
      });
      const wsDetail = XLSX.utils.json_to_sheet(detailData);
      wsDetail['!cols'] = [
        { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 16 },
        { wch: 16 }, { wch: 18 },
        ...instLabels.map(() => ({ wch: 12 })),
        { wch: 12 }, { wch: 12 }, { wch: 14 },
      ];

      // ⭐ 2 lignes de synthèse exigées par le promoteur (mêmes lignes que le
      //    pied du tableau à l'écran) : INSCRIPTION/RÉINSCRIPTION puis
      //    SCOLARITÉ — chacune avec montant attendu / payé / restant,
      //    alignées sous les colonnes Total dû / Total payé / Reste à payer.
      if (detailData.length > 0) {
        const blank = Array(instLabels.length).fill('');
        XLSX.utils.sheet_add_aoa(wsDetail, [
          ['INSCRIPTION / RÉINSCRIPTION — TOTAL', '', '', '', '', '', '', ...blank,
            summaryTotals.inscDue, summaryTotals.inscPaid, summaryTotals.inscReste],
          ['SCOLARITÉ — TOTAL (toutes tranches)', '', '', '', '', '', '', ...blank,
            summaryTotals.scolDue, summaryTotals.scolPaid, summaryTotals.scolReste],
        ], { origin: detailData.length + 2 });
      }
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Bilan détaillé');

      // ── Feuille 2 : Récapitulatif (une classe par ligne) ──
      if (recapRows.length > 0) {
        const recapData = recapRows.map((row) => {
          const instData: Record<string, number> = {};
          for (const label of instLabels) {
            instData[label] = row.tuitionInstallments?.[label] || 0;
          }
          return {
            'Effectif': row.effectif,
            'Classe': row.className,
            'Arriérés (restant dû)': row.arrieres || 0,
            'Inscription payée': row.inscriptionPaid || 0,
            'Réinscription payée': row.reinscriptionPaid || 0,
            'Scolarité (attendu)': row.scolarite ?? row.totalTuition ?? 0,
            'Personnalisations': row.personalizationCount || 0,
            'Réduction totale': row.personalizationReduction || 0,
            ...instData,
            'Total dû': row.totalDue || 0,
            'Total payé': row.totalPaid || 0,
            'Reste à payer': row.reste || 0,
            'Solde par classe': row.soldeParClasse || 0,
          };
        });
        const wsRecap = XLSX.utils.json_to_sheet(recapData);
        wsRecap['!cols'] = [
          { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
          { wch: 18 }, { wch: 14 }, { wch: 16 },
          ...instLabels.map(() => ({ wch: 12 })),
          { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
        ];

        // ⭐ Mêmes 2 lignes de synthèse que le pied du tableau récapitulatif :
        //    inscription/réinscription puis scolarité (attendu / payé / restant).
        const blankR = Array(instLabels.length).fill('');
        XLSX.utils.sheet_add_aoa(wsRecap, [
          ['', 'INSCRIPTION / RÉINSCRIPTION — TOTAL', '', '', '', '', '', '', ...blankR,
            summaryTotals.inscDue, summaryTotals.inscPaid, summaryTotals.inscReste, ''],
          ['', 'SCOLARITÉ — TOTAL (toutes tranches)', '', '', '', '', '', '', ...blankR,
            summaryTotals.scolDue, summaryTotals.scolPaid, summaryTotals.scolReste, ''],
        ], { origin: recapData.length + 2 });
        XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');
      }

      // ── Générer le fichier et déclencher le téléchargement ──
      const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const fileName = `bilan-encaissements-${dateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err: any) {
      console.error('Export Excel error:', err);
      alert(`Erreur lors de l'export Excel: ${err.message}`);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <ModuleContentArea>
      {/* En-tête + actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Bilan des encaissements</h1>
          <p className="text-sm text-gray-600 mt-1">
            Suivi détaillé des encaissements par élève et récapitulatif par classe
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* ⭐ Bouton Modifier — active le mode édition des lignes élèves */}
          {activeSubTab === 'detail' && !editMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={enterEditMode}
              disabled={!academicYearId || studentRows.length === 0}
              className="border-amber-400 text-amber-700 hover:bg-amber-50"
              title="Modifier les montants payés par élève pour réaligner les données de l'année écoulée"
            >
              <Pencil className="w-4 h-4 mr-2" /> Modifier
            </Button>
          )}
          {editMode && (
            <>
              <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-md px-3 py-1.5 mr-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Mode édition actif
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEditMode}
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <XCircle className="w-4 h-4 mr-2" /> Quitter édition
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setModalImport(true)}
            disabled={!academicYearId}
            className="hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4 mr-2" /> Importer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={loading || (studentRows.length === 0 && recapRows.length === 0)}
            className="hover:bg-green-50 hover:border-green-400 hover:text-green-700 transition-colors"
            title="Exporter le bilan des encaissements en Excel"
          >
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveSubTab('detail')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'detail'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Bilan des encaissements
        </button>
        <button
          onClick={() => setActiveSubTab('recap')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeSubTab === 'recap'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Récapitulatif
        </button>
        {/* ⭐ Sous-onglet "Reçu par le fondateur" — élèves marqués paiement direct fondateur */}
        <button
          onClick={() => setActiveSubTab('promoter')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeSubTab === 'promoter'
              ? 'border-amber-600 text-amber-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="w-4 h-4" />
          Reçu par le fondateur
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-4 items-end mb-6">
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-gray-600 mb-1">Niveau scolaire</label>
          <select
            value={selectedLevelId}
            onChange={(e) => {
              setSelectedLevelId(e.target.value);
              setSelectedClassId('');
            }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les niveaux</option>
            {schoolLevels.map((level) => (
              <option key={level.id} value={level.schoolLevelId || level.id}>
                {level.label || level.code || level.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 max-w-xs">
          <label className="block text-xs font-medium text-gray-600 mb-1">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les classes</option>
            {filteredClasses.map((cls: any) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        {/* ⭐ Toggle : exclure la caisse FONDE (caisse promoteur) du bilan.
            Permet d'isoler les encaissements des caissiers (exclut les paiements
            reçus directement par le promoteur/fondateur). */}
        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={excludePromoterCaisse}
            onChange={(e) => setExcludePromoterCaisse(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          Exclure caisse promoteur
        </label>
        {/* ⭐ Recherche par nom d'élève — filtre côté client sur studentRows */}
        {activeSubTab === 'detail' && (
          <div className="flex-1 max-w-xs ml-auto">
            <label className="block text-xs font-medium text-gray-600 mb-1">Rechercher un élève</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, prénom, classe..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tableaux */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-gray-600">Chargement...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : activeSubTab === 'detail' ? (
        <div className="space-y-3">
          {editMode && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <strong>Mode édition actif.</strong> Vous pouvez modifier directement les montants payés par élève
                (inscription, réinscription, arriéré, tranches P1-P6). Cliquez sur « Enregistrer » à côté du nom
                de l'élève pour persister les modifications en base de données. Les colonnes « Total payé » et
                « Reste à payer » se recalculent en temps réel. Une fois les modifications terminées, cliquez sur
                « Quitter édition » pour désactiver ce mode.
              </div>
            </div>
          )}
          <DetailTable
            studentRows={filteredStudentRows}
            installments={installments}
            summaryTotals={summaryTotals}
            editMode={editMode}
            editBuffer={editBuffer}
            savingStudent={savingStudent}
            onUpdateValue={updateEditValue}
            onUpdateInstallment={updateEditInstallment}
            onSaveStudent={saveStudentEdit}
          />
          {/* ⭐ Pagination serveur — uniquement sur le sous-onglet « Bilan détaillé ».
              Pattern identique à StudentMovementsContent.tsx. */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Affichage <strong className="text-slate-700">
                  {totalStudents > 0 ? `${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, totalStudents)}` : '0'}
                </strong> sur <strong className="text-slate-700">{totalStudents}</strong> élève(s)
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || loading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Précédent
                </button>
                <div className="flex items-center gap-0.5">
                  {(() => {
                    const pages: (number | 'ellipsis')[] = [];
                    const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
                    add(1);
                    if (currentPage - 1 > 2) pages.push('ellipsis');
                    for (let p = Math.max(2, currentPage - 1); p <= Math.min(totalPages - 1, currentPage + 1); p++) add(p);
                    if (currentPage + 1 < totalPages - 1) pages.push('ellipsis');
                    if (totalPages > 1) add(totalPages);
                    return pages.map((p, i) => {
                      if (p === 'ellipsis') {
                        return (
                          <span key={`e-${i}`} className="px-2 text-slate-400">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </span>
                        );
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          disabled={loading}
                          className={cn(
                            'min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition disabled:opacity-50',
                            p === currentPage
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-600 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                          )}
                        >
                          {p}
                        </button>
                      );
                    });
                  })()}
                </div>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || loading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Suivant
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : activeSubTab === 'promoter' ? (
        <PromoterEligibleList
          list={promoterEligibleList}
          loading={promoterLoading}
          academicYearId={academicYearId}
        />
      ) : (
        <RecapTable
          recapRows={recapRows}
          installments={installments}
          summaryTotals={summaryTotals}
        />
      )}

      {/* Modal d'import en masse du bilan des encaissements */}
      <ImportBilanModal
        open={modalImport}
        onClose={() => setModalImport(false)}
        academicYearId={academicYearId}
        onSuccess={() => loadData()}
      />
    </ModuleContentArea>
  );
}

// ─── Detail Table (Bilan des encaissements) ──────────────────────────────────

function DetailTable({
  studentRows,
  installments,
  summaryTotals,
  editMode = false,
  editBuffer,
  savingStudent,
  onUpdateValue,
  onUpdateInstallment,
  onSaveStudent,
}: {
  studentRows: StudentPaymentRow[];
  installments: FeeInstallment[];
  // ⭐ Totaux de synthèse du pied de tableau (inscription/réinscription + scolarité)
  summaryTotals: { inscDue: number; inscPaid: number; inscReste: number; scolDue: number; scolPaid: number; scolReste: number };
  editMode?: boolean;
  editBuffer: Map<string, any>;
  savingStudent: string | null;
  onUpdateValue: (studentId: string, field: string, value: number) => void;
  onUpdateInstallment: (studentId: string, label: string, value: number) => void;
  onSaveStudent: (studentId: string) => void;
}) {
  if (studentRows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-600 bg-white rounded-xl border border-gray-200">
        Aucune donnée disponible. Veuillez sélectionner une année scolaire et une classe.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="sticky left-0 bg-gray-50 z-10 whitespace-nowrap">Noms et Prénoms</TableHead>
            <TableHead className="whitespace-nowrap">Classe</TableHead>
            <TableHead className="whitespace-nowrap text-right">Arriéré</TableHead>
            <TableHead className="whitespace-nowrap text-right">Inscription</TableHead>
            <TableHead className="whitespace-nowrap text-right">Réinscription</TableHead>
            {/* ⭐ Scolarité (totalTuitionExpected) — colonne demandée avant Total dû */}
            <TableHead className="whitespace-nowrap text-right font-bold">Scolarité</TableHead>
            {/* ⭐ Personnalisation — colonne demandée après Scolarité */}
            <TableHead className="whitespace-nowrap text-center font-bold">Personnalisation</TableHead>
            {installments.map((inst) => (
              <TableHead key={inst.id} className="text-center whitespace-nowrap">
                {inst.label}
              </TableHead>
            ))}
            <TableHead className="font-bold whitespace-nowrap text-right">Total dû</TableHead>
            <TableHead className="font-bold whitespace-nowrap text-right">Total payé</TableHead>
            <TableHead className="font-bold whitespace-nowrap text-right">Reste à payer</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {studentRows.map((row) => {
            const edits = editBuffer.get(row.studentId);
            const isSaving = savingStudent === row.studentId;
            const hasEdits = !!edits;

            // Calculer les montants affichés (édités ou originaux)
            const displayInscriptionPaid = editMode && edits ? Number(edits.inscriptionPaid) || 0 : row.inscriptionPaid;
            const displayReinscriptionPaid = editMode && edits ? Number(edits.reinscriptionPaid) || 0 : row.reinscriptionPaid;
            const displayArrearPaid = editMode && edits ? Number(edits.arrearPaid) || 0 : row.arrearPaid;
            // Total tuition payé = somme des tranches éditées
            const displayTotalTuitionPaid = editMode && edits
              ? Object.values(edits.tuitionInstallments || {}).reduce((s: number, n: any) => s + Number(n || 0), 0)
              : row.totalTuitionPaid;
            // ⭐ Sémantique promoteur 2026-11 : Total payé = inscription +
            //    réinscription + tranches UNIQUEMENT (l'arriéré est une dette
            //    restante, jamais un montant payé — cf. compte élève).
            const displayTotalPaid = displayInscriptionPaid + displayReinscriptionPaid + displayTotalTuitionPaid;
            const displayReste = row.totalDue - displayTotalPaid;

            return (
            <TableRow key={row.studentId} className={cn('hover:bg-slate-50', editMode && 'bg-amber-50/30')}>
              <TableCell className="font-medium sticky left-0 bg-white z-10 whitespace-nowrap">
                <div className="flex flex-col">
                  <span>{row.studentName}</span>
                  {editMode && (
                    <button
                      onClick={() => onSaveStudent(row.studentId)}
                      disabled={isSaving || !hasEdits}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Enregistrer les modifications de cet élève"
                    >
                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
                    </button>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">{row.className}</TableCell>

              {/* Arriéré — RESTANT DÛ (non payé) ; éditable en mode édition
                  (outil de réalignement des données de l'année écoulée) */}
              <TableCell className="text-sm text-right whitespace-nowrap">
                {editMode ? (
                  <input
                    type="number"
                    value={displayArrearPaid}
                    onChange={(e) => onUpdateValue(row.studentId, 'arrearPaid', Number(e.target.value) || 0)}
                    className="w-20 px-1 py-0.5 text-xs text-right border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                ) : (
                  <span title="Restant dû sur les arriérés (non payé) — même valeur que le compte élève">
                    {(row.arrearRemaining ?? 0) > 0 ? formatCurrency(row.arrearRemaining ?? 0) : '—'}
                  </span>
                )}
              </TableCell>

              {/* Inscription — éditable */}
              <TableCell className="text-sm text-right whitespace-nowrap">
                {editMode ? (
                  <input
                    type="number"
                    value={displayInscriptionPaid}
                    onChange={(e) => onUpdateValue(row.studentId, 'inscriptionPaid', Number(e.target.value) || 0)}
                    className="w-20 px-1 py-0.5 text-xs text-right border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                ) : (
                  row.inscriptionPaid > 0 ? formatCurrency(row.inscriptionPaid) : '—'
                )}
              </TableCell>

              {/* Réinscription — éditable */}
              <TableCell className="text-sm text-right whitespace-nowrap">
                {editMode ? (
                  <input
                    type="number"
                    value={displayReinscriptionPaid}
                    onChange={(e) => onUpdateValue(row.studentId, 'reinscriptionPaid', Number(e.target.value) || 0)}
                    className="w-20 px-1 py-0.5 text-xs text-right border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                ) : (
                  row.reinscriptionPaid > 0 ? formatCurrency(row.reinscriptionPaid) : '—'
                )}
              </TableCell>

              {/* ⭐ Scolarité = totalTuitionExpected (montant attendu, pas payé) — non éditable */}
              <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                {row.scolarite || row.totalTuitionExpected ? formatCurrency(row.scolarite ?? row.totalTuitionExpected) : '—'}
              </TableCell>

              {/* ⭐ Personnalisation */}
              <TableCell className="text-sm text-center whitespace-nowrap">
                {row.hasPersonalization ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold" title={`Réduction: ${formatCurrency(row.personalizationReduction || 0)}`}>
                    Oui ({formatCurrency(row.personalizationReduction || 0)})
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )}
              </TableCell>

              {/* Tranches de scolarité (P1-P6) — éditables */}
              {installments.map((inst) => {
                const paid = editMode && edits
                  ? Number(edits.tuitionInstallments?.[inst.label]) || 0
                  : row.tuitionInstallments[inst.label] || 0;
                return (
                  <TableCell key={inst.id} className="text-sm text-right whitespace-nowrap">
                    {editMode ? (
                      <input
                        type="number"
                        value={paid}
                        onChange={(e) => onUpdateInstallment(row.studentId, inst.label, Number(e.target.value) || 0)}
                        className="w-20 px-1 py-0.5 text-xs text-right border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    ) : (
                      paid > 0 ? formatCurrency(paid) : '—'
                    )}
                  </TableCell>
                );
              })}

              {/* Total dû — non éditable (calculé depuis les fee structures) */}
              <TableCell className="text-sm font-bold text-right whitespace-nowrap">
                {formatCurrency(row.totalDue)}
              </TableCell>

              {/* Total payé — recalculé en temps réel en mode édition */}
              <TableCell className="text-sm font-bold text-right whitespace-nowrap">
                {formatCurrency(displayTotalPaid)}
              </TableCell>

              {/* Reste à payer — recalculé en temps réel */}
              <TableCell className="text-sm font-bold text-right whitespace-nowrap">
                <span className={displayReste > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(displayReste)}
                </span>
              </TableCell>
            </TableRow>
            );
          })}
          {/* ⭐ Ligne TOTAUX en rouge — frappe l'œil */}
          {studentRows.length > 0 && (
            <TableRow className="bg-red-50 border-t-2 border-red-300 font-bold">
              <TableCell colSpan={2} className="text-right text-red-700 py-3">
                TOTAUX ({studentRows.length} élève(s))
              </TableCell>
              {/* ⭐ Arriéré = RESTANT DÛ (non payé) — cohérent compte élève */}
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.arrearRemaining ?? 0), 0))}
              </TableCell>
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.inscriptionPaid ?? 0), 0))}
              </TableCell>
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.reinscriptionPaid ?? 0), 0))}
              </TableCell>
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.totalTuitionExpected ?? 0), 0))}
              </TableCell>
              <TableCell className="py-3"></TableCell>
              {installments.map((inst) => (
                <TableCell key={inst.id} className="text-right text-red-700 whitespace-nowrap py-3">
                  {formatCurrency(studentRows.reduce((s, r) => s + Number(r.tuitionInstallments?.[inst.label] ?? 0), 0))}
                </TableCell>
              ))}
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.totalDue ?? 0), 0))}
              </TableCell>
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.totalPaid ?? 0), 0))}
              </TableCell>
              <TableCell className="text-right text-red-700 whitespace-nowrap py-3">
                {formatCurrency(studentRows.reduce((s, r) => s + Number(r.reste ?? 0), 0))}
              </TableCell>
            </TableRow>
          )}
          {/* ⭐ 2 lignes de synthèse (retour promoteur) — totaux GLOBAUX
              (toutes classes de l'année, non limités à la page affichée) :
                1. INSCRIPTION / RÉINSCRIPTION : attendu / payé / restant
                2. SCOLARITÉ : total / payé / restant
              Montants alignés sous les colonnes Total dû / Total payé /
              Reste à payer. Ces lignes figurent AUSSI dans l'export Excel. */}
          <TableRow className="bg-blue-50/80 border-t border-blue-200 font-semibold">
            <TableCell colSpan={6 + installments.length} className="py-2.5 text-blue-900 whitespace-nowrap">
              INSCRIPTION / RÉINSCRIPTION — TOTAL (toutes classes)
            </TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.inscDue)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.inscPaid)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">
              <span className={summaryTotals.inscReste > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(summaryTotals.inscReste)}
              </span>
            </TableCell>
          </TableRow>
          <TableRow className="bg-blue-50/80 border-t border-blue-200 font-semibold">
            <TableCell colSpan={6 + installments.length} className="py-2.5 text-blue-900 whitespace-nowrap">
              SCOLARITÉ — TOTAL (toutes tranches, toutes classes)
            </TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.scolDue)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.scolPaid)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">
              <span className={summaryTotals.scolReste > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(summaryTotals.scolReste)}
              </span>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Recap Table (Récapitulatif) ─────────────────────────────────────────────

function RecapTable({
  recapRows,
  installments,
  summaryTotals,
}: {
  recapRows: RecapRow[];
  installments: FeeInstallment[];
  // ⭐ Totaux de synthèse du pied de tableau (inscription/réinscription + scolarité)
  summaryTotals: { inscDue: number; inscPaid: number; inscReste: number; scolDue: number; scolPaid: number; scolReste: number };
}) {
  if (recapRows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-600 bg-white rounded-xl border border-gray-200">
        Aucune donnée disponible pour le récapitulatif.
      </div>
    );
  }

  // Calculer les totaux — cohérents avec la sémantique 2026-11 :
  //   - Colonnes Arriérés = RESTANT DÛ (non payé, même valeur que la colonne
  //     « Arriérés » du compte élève et l'onglet Recouvrement)
  //   - Inscription / Réinscription = montants PAYÉS (même sémantique que le
  //     tableau détaillé)
  //   - Scolarité = montant attendu (totalTuition)
  //   - Total dû = Inscription attendue + Réinscription attendue + Scolarité + Arriérés restants
  //   - Total payé = inscription + réinscription + tranches payées
  //   - Reste à payer = Total dû − Total payé
  //   - Solde par classe = Total dû − Total payé (restant à recouvrir,
  //     positif quand la classe doit encore de l'argent)
  const totals = recapRows.reduce(
    (acc, row) => {
      acc.effectif += row.effectif;
      // Restant dû (non payé)
      acc.arrieres += row.arrieres;
      // Payé
      acc.inscription += row.inscriptionPaid;
      acc.reinscription += row.reinscriptionPaid;
      acc.totalPaid += row.totalPaid;
      // Attendu
      acc.totalDue += row.totalDue;
      acc.totalTuition += row.totalTuition;
      acc.scolarite += row.scolarite || row.totalTuition || 0;
      acc.personalizationCount += row.personalizationCount || 0;
      acc.personalizationReduction += row.personalizationReduction || 0;
      // Reste
      acc.reste += row.reste;
      acc.soldeParClasse += row.soldeParClasse;
      for (const inst of installments) {
        acc.installments[inst.label] = (acc.installments[inst.label] || 0) + (row.tuitionInstallments[inst.label] || 0);
      }
      return acc;
    },
    {
      effectif: 0, arrieres: 0, inscription: 0, reinscription: 0,
      totalTuition: 0, scolarite: 0, personalizationCount: 0, personalizationReduction: 0,
      totalDue: 0, totalPaid: 0,
      reste: 0, soldeParClasse: 0,
      installments: {} as { [id: string]: number },
    },
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="whitespace-nowrap text-center">Effectif</TableHead>
            <TableHead className="whitespace-nowrap">Classe</TableHead>
            <TableHead className="whitespace-nowrap text-right">Arriérés</TableHead>
            <TableHead className="whitespace-nowrap text-right">Inscription</TableHead>
            <TableHead className="whitespace-nowrap text-right">Réinscription</TableHead>
            {/* ⭐ Scolarité (totalTuition) — colonne demandée avant Personnalisation */}
            <TableHead className="whitespace-nowrap text-right font-bold">Scolarité</TableHead>
            {/* ⭐ Personnalisation — colonne demandée après Scolarité */}
            <TableHead className="whitespace-nowrap text-center font-bold">Personnalisation</TableHead>
            {installments.map((inst) => (
              <TableHead key={inst.id} className="text-center whitespace-nowrap">
                {inst.label}
              </TableHead>
            ))}
            <TableHead className="font-bold whitespace-nowrap text-right">Total dû</TableHead>
            <TableHead className="font-bold whitespace-nowrap text-right">Total payé</TableHead>
            <TableHead className="font-bold whitespace-nowrap text-right">Reste à payer</TableHead>
            <TableHead className="font-bold whitespace-nowrap text-right">Solde par classe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recapRows.map((row, idx) => (
            <TableRow key={idx} className="hover:bg-slate-50">
              <TableCell className="text-sm text-center whitespace-nowrap">{row.effectif}</TableCell>
              <TableCell className="font-medium whitespace-nowrap">{row.className}</TableCell>
              <TableCell className="text-sm text-right whitespace-nowrap">
                {row.arrieres > 0 ? formatCurrency(row.arrieres) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right whitespace-nowrap">
                {row.inscriptionPaid > 0 ? formatCurrency(row.inscriptionPaid) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right whitespace-nowrap">
                {row.reinscriptionPaid > 0 ? formatCurrency(row.reinscriptionPaid) : '—'}
              </TableCell>
              {/* ⭐ Scolarité = totalTuition (attendu) */}
              <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                {row.scolarite || row.totalTuition ? formatCurrency(row.scolarite ?? row.totalTuition) : '—'}
              </TableCell>
              {/* ⭐ Personnalisation : nb d'élèves avec FeeOverride + montant total réduction */}
              <TableCell className="text-sm text-center whitespace-nowrap">
                {(row.personalizationCount || 0) > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold" title={`Réduction totale: ${formatCurrency(row.personalizationReduction || 0)}`}>
                    {row.personalizationCount} élève(s) ({formatCurrency(row.personalizationReduction || 0)})
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )}
              </TableCell>
              {installments.map((inst) => {
                const amount = row.tuitionInstallments[inst.label] || 0;
                return (
                  <TableCell key={inst.id} className="text-sm text-right whitespace-nowrap">
                    {amount > 0 ? formatCurrency(amount) : '—'}
                  </TableCell>
                );
              })}
              <TableCell className="text-sm font-bold text-right whitespace-nowrap">
                {formatCurrency(row.totalDue)}
              </TableCell>
              <TableCell className="text-sm font-bold text-right whitespace-nowrap">
                {formatCurrency(row.totalPaid)}
              </TableCell>
              <TableCell className="text-sm font-bold text-right whitespace-nowrap">
                <span className={row.reste > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(row.reste)}
                </span>
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                {formatCurrency(row.soldeParClasse)}
              </TableCell>
            </TableRow>
          ))}
          {/* Ligne TOTAL */}
          <TableRow className="bg-blue-50 font-bold">
            <TableCell className="text-center whitespace-nowrap">{totals.effectif}</TableCell>
            <TableCell className="whitespace-nowrap">TOTAL</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.arrieres)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.inscription)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.reinscription)}</TableCell>
            {/* ⭐ Scolarité total */}
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.scolarite)}</TableCell>
            {/* ⭐ Personnalisation total */}
            <TableCell className="text-center whitespace-nowrap">
              {totals.personalizationCount > 0 ? (
                <span className="text-amber-700">{totals.personalizationCount} ({formatCurrency(totals.personalizationReduction)})</span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            {installments.map((inst) => (
              <TableCell key={inst.id} className="text-right whitespace-nowrap">
                {formatCurrency(totals.installments[inst.label] || 0)}
              </TableCell>
            ))}
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.totalDue)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.totalPaid)}</TableCell>
            <TableCell className="text-right text-red-600 whitespace-nowrap">{formatCurrency(totals.reste)}</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatCurrency(totals.soldeParClasse)}</TableCell>
          </TableRow>
          {/* ⭐ 2 lignes de synthèse (retour promoteur) — mêmes lignes que le
              tableau détaillé et l'export Excel :
              inscription/réinscription puis scolarité (attendu / payé / restant). */}
          <TableRow className="bg-blue-50/80 border-t border-blue-200 font-semibold">
            <TableCell colSpan={7 + installments.length} className="py-2.5 text-blue-900 whitespace-nowrap">
              INSCRIPTION / RÉINSCRIPTION — TOTAL
            </TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.inscDue)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.inscPaid)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">
              <span className={summaryTotals.inscReste > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(summaryTotals.inscReste)}
              </span>
            </TableCell>
            <TableCell className="text-right py-2.5"></TableCell>
          </TableRow>
          <TableRow className="bg-blue-50/80 border-t border-blue-200 font-semibold">
            <TableCell colSpan={7 + installments.length} className="py-2.5 text-blue-900 whitespace-nowrap">
              SCOLARITÉ — TOTAL (toutes tranches)
            </TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.scolDue)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">{formatCurrency(summaryTotals.scolPaid)}</TableCell>
            <TableCell className="text-right py-2.5 whitespace-nowrap">
              <span className={summaryTotals.scolReste > 0 ? 'text-red-600' : 'text-green-600'}>
                {formatCurrency(summaryTotals.scolReste)}
              </span>
            </TableCell>
            <TableCell className="text-right py-2.5"></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Sous-onglet "Reçu par le fondateur" ─────────────────────────────────────
// Liste des élèves marqués "paiement direct au fondateur" avec leur motif
// et leur date d'échéance prévue.

function PromoterEligibleList({
  list,
  loading,
  academicYearId,
}: {
  list: any[];
  loading: boolean;
  academicYearId: string;
}) {
  const [filterLevel, setFilterLevel] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [internalList, setInternalList] = useState<any[]>(list);

  // Sync quand la liste parent change
  useEffect(() => {
    setInternalList(list);
  }, [list]);

  // ⭐ Marquer comme soldé
  const handleSettle = async (eligibilityId: string) => {
    try {
      const authHeaders = getClientAuthorizationHeader();
      const response = await fetch('/api/finance/promoter-eligibility/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'settle', eligibilityId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      // Mettre à jour la liste localement
      setInternalList(prev => prev.map(r => r.id === eligibilityId ? { ...r, isSettled: true, remainingAmount: 0 } : r));
    } catch (err) {
      console.error('Settle failed:', err);
    }
  };

  // Filtrer par niveau/classe
  const filteredList = useMemo(() => {
    if (!filterLevel && !filterClass) return internalList;
    return internalList.filter((row) => {
      const levelMatch = !filterLevel || row.className?.toLowerCase().includes(filterLevel.toLowerCase());
      const classMatch = !filterClass || row.className?.toLowerCase().includes(filterClass.toLowerCase());
      return levelMatch && classMatch;
    });
  }, [internalList, filterLevel, filterClass]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-3 text-sm text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (filteredList.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
        <Crown className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-amber-800 font-medium mb-1">
          Aucun encaissement réel du fondateur pour cette année
        </p>
        <p className="text-xs text-amber-600">
          Seuls les élèves avec un montant réellement reçu par le fondateur (avance
          saisie ou paiement sur sa caisse) apparaissent ici — aucune ligne vide.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 text-white">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5" />
          <h3 className="font-bold">Élèves — Paiement direct au fondateur</h3>
          <Badge className="ml-auto bg-white/20 text-white border-white/30">
            {filteredList.length} élève(s)
          </Badge>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-50">
              <TableHead className="whitespace-nowrap">Élève</TableHead>
              <TableHead className="whitespace-nowrap">Classe</TableHead>
              <TableHead className="whitespace-nowrap">Motif</TableHead>
              <TableHead className="text-right whitespace-nowrap">Total dû</TableHead>
              <TableHead className="text-right whitespace-nowrap">Avance reçue</TableHead>
              <TableHead className="text-right whitespace-nowrap">Reste à payer</TableHead>
              <TableHead className="text-center whitespace-nowrap">Échéance</TableHead>
              <TableHead className="text-center whitespace-nowrap">Marqué par</TableHead>
              <TableHead className="text-center whitespace-nowrap">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.map((row) => (
              <TableRow key={row.id} className={`hover:bg-amber-50/50 ${row.isSettled ? 'opacity-50' : ''}`}>
                <TableCell className="font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div className="whitespace-nowrap">
                      <div className="font-semibold whitespace-nowrap">{row.studentName}</div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">{row.studentMatricule || '—'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">{row.className}</TableCell>
                <TableCell className="text-sm text-gray-700">
                  {/* ⭐ Motif sur une seule ligne avec truncate + tooltip */}
                  <div className="truncate max-w-[200px] whitespace-nowrap" title={row.motif}>
                    {row.motif}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-bold text-red-700 whitespace-nowrap">
                  {row.totalDue > 0 ? formatCurrency(row.totalDue) : '—'}
                </TableCell>
                <TableCell className="text-right text-sm font-semibold text-green-700 whitespace-nowrap">
                  {row.advanceAmount > 0 ? formatCurrency(row.advanceAmount) : <span className="text-gray-400">—</span>}
                </TableCell>
                <TableCell className="text-right text-sm font-bold whitespace-nowrap">
                  {row.remainingAmount > 0 ? (
                    <span className="text-red-600">{formatCurrency(row.remainingAmount)}</span>
                  ) : row.isSettled ? (
                    <span className="text-green-600">Soldé</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center text-sm whitespace-nowrap">
                  {row.expectedDate
                    ? new Date(row.expectedDate).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : <span className="text-gray-400">—</span>}
                </TableCell>
                <TableCell className="text-center text-sm text-gray-600 whitespace-nowrap">
                  {row.createdByName || '—'}
                </TableCell>
                <TableCell className="text-center whitespace-nowrap">
                  {row.isSettled ? (
                    <Badge className="bg-green-100 text-green-700 border border-green-200 text-[10px] whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Soldé
                    </Badge>
                  ) : (
                    <button
                      onClick={() => handleSettle(row.id)}
                      className="px-2 py-1 text-[10px] font-bold bg-green-600 text-white rounded hover:bg-green-700 transition-colors whitespace-nowrap"
                      title="Marquer comme soldé (l'élève a payé la totalité au fondateur)"
                    >
                      Marquer soldé
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
