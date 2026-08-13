'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download, FileText, Loader2, Filter,
  ChevronLeft, ChevronRight, MoreHorizontal, Upload, Crown,
} from 'lucide-react';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { getAcademicYears } from '@/services/settings.service';
import { financeService } from '@/services/finance.service';
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
  const [academicYearId, setAcademicYearId] = useState<string>('');
  // ⭐ Toggle : exclure les paiements reçus sur la caisse FONDE (caisse promoteur)
  //    du bilan des encaissements. Permet d'isoler les stats caissiers.
  const [excludePromoterCaisse, setExcludePromoterCaisse] = useState<boolean>(false);

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

  // ─── Load school levels + classes + academic year ──────────────────────────
  useEffect(() => {
    const authHeaders = getClientAuthorizationHeader();

    // School levels
    fetch('/api/school-levels', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));

    // Classes physiques
    fetch('/api/all-classes', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => {
        const cls = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(cls);
      })
      .catch(() => setClasses([]));

    // Academic year
    getAcademicYears()
      .then((d) => {
        const years = Array.isArray(d) ? d : (d.data ?? []);
        const active = years.find((y: any) => y.isActive) || years[0];
        if (active?.id) setAcademicYearId(active.id);
      })
      .catch(() => {});
  }, []);

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
    loadData();
  }, [loadData]);

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
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    const selectedLevel = schoolLevels.find((l) => l.id === selectedLevelId);
    if (!selectedLevel) return classes;
    const code = (selectedLevel.code || '').toLowerCase();
    return classes.filter((c: any) => {
      const levelCode = (c.schoolLevel?.code || '').toLowerCase();
      return levelCode === code;
    });
  }, [classes, selectedLevelId, schoolLevels]);

  // ─── Export Excel ───────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    console.log('Export Excel — à implémenter');
  };

  // ─── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    console.log('Export PDF — à implémenter');
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setModalImport(true)} disabled={!academicYearId}>
            <Upload className="w-4 h-4 mr-2" /> Importer
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" /> PDF
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
              <option key={level.id} value={level.id}>
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
          <DetailTable
            studentRows={studentRows}
            installments={installments}
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
}: {
  studentRows: StudentPaymentRow[];
  installments: FeeInstallment[];
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
          {studentRows.map((row) => (
            <TableRow key={row.studentId} className="hover:bg-slate-50">
              <TableCell className="font-medium sticky left-0 bg-white z-10 whitespace-nowrap">
                {row.studentName}
              </TableCell>
              <TableCell className="text-sm whitespace-nowrap">{row.className}</TableCell>
              <TableCell className="text-sm text-right whitespace-nowrap">
                {row.arrearPaid > 0 ? formatCurrency(row.arrearPaid) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right whitespace-nowrap">
                {row.inscriptionPaid > 0 ? formatCurrency(row.inscriptionPaid) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right whitespace-nowrap">
                {row.reinscriptionPaid > 0 ? formatCurrency(row.reinscriptionPaid) : '—'}
              </TableCell>
              {/* ⭐ Scolarité = totalTuitionExpected (montant attendu, pas payé) */}
              <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                {row.scolarite || row.totalTuitionExpected ? formatCurrency(row.scolarite ?? row.totalTuitionExpected) : '—'}
              </TableCell>
              {/* ⭐ Personnalisation : badge Oui/Non + montant réduction */}
              <TableCell className="text-sm text-center whitespace-nowrap">
                {row.hasPersonalization ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold" title={`Réduction: ${formatCurrency(row.personalizationReduction || 0)}`}>
                    Oui ({formatCurrency(row.personalizationReduction || 0)})
                  </span>
                ) : (
                  <span className="text-slate-400 text-xs">—</span>
                )}
              </TableCell>
              {installments.map((inst) => {
                const paid = row.tuitionInstallments[inst.label] || 0;
                return (
                  <TableCell key={inst.id} className="text-sm text-right whitespace-nowrap">
                    {paid > 0 ? formatCurrency(paid) : '—'}
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Recap Table (Récapitulatif) ─────────────────────────────────────────────

function RecapTable({
  recapRows,
  installments,
}: {
  recapRows: RecapRow[];
  installments: FeeInstallment[];
}) {
  if (recapRows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-600 bg-white rounded-xl border border-gray-200">
        Aucune donnée disponible pour le récapitulatif.
      </div>
    );
  }

  // Calculer les totaux — cohérents avec la nouvelle semantique :
  //   - Colonnes Arriérés / Inscription / Réinscription / Tranches = montants PAYÉS
  //   - Total dû = somme des montants attendus (Inscription + Réinscription + Scolarité + Arriérés - Personnalisation)
  //   - Total payé = somme de tous les paiements
  //   - Reste à payer = Total dû - Total payé
  //   - Solde par classe = Total payé - Total dû
  const totals = recapRows.reduce(
    (acc, row) => {
      acc.effectif += row.effectif;
      // Payé
      acc.arrieres += row.arrieresPaid;
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
                {row.arrieresPaid > 0 ? formatCurrency(row.arrieresPaid) : '—'}
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
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        <span className="ml-3 text-sm text-gray-600">Chargement...</span>
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
        <Crown className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <p className="text-sm text-amber-800 font-medium mb-1">
          Aucun élève marqué "paiement fondateur"
        </p>
        <p className="text-xs text-amber-600">
          Activez le toggle "Fondateur" sur la ligne d'un élève dans Comptes élèves
          pour le faire apparaître ici.
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
            {list.length} élève(s)
          </Badge>
        </div>
      </div>
      <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-50">
              <TableHead>Élève</TableHead>
              <TableHead>Classe</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead className="text-center">Échéance prévue</TableHead>
              <TableHead className="text-center">Marqué par</TableHead>
              <TableHead className="text-center">Date marquage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((row) => (
              <TableRow key={row.id} className="hover:bg-amber-50/50">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div>
                      <div className="font-semibold">{row.studentName}</div>
                      <div className="text-xs text-gray-500">{row.studentMatricule || '—'}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{row.className}</TableCell>
                <TableCell className="text-sm text-gray-700 max-w-xs">
                  <div className="truncate" title={row.motif}>{row.motif}</div>
                </TableCell>
                <TableCell className="text-center text-sm">
                  {row.expectedDate
                    ? new Date(row.expectedDate).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })
                    : <span className="text-gray-400">—</span>}
                </TableCell>
                <TableCell className="text-center text-sm text-gray-600">
                  {row.createdByName || '—'}
                </TableCell>
                <TableCell className="text-center text-sm text-gray-500">
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                      })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
