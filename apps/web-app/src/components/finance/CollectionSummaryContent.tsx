'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Download, FileText, Loader2, Filter, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getClientAuthorizationHeader } from '@/lib/api/client-auth';
import { formatCurrency } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FeeInstallment {
  id: string;
  label: string;
  amount: number;
  orderIndex: number;
}

interface FeeStructureWithInstallments {
  id: string;
  feeType: string;
  name: string;
  totalAmount: number;
  isInstallment: boolean;
  structureInstallments: FeeInstallment[];
  academicClassId?: string | null;
  classId?: string | null;
  levelId?: string | null;
  academicClass?: { id: string; name: string; code: string } | null;
  class?: { id: string; name: string; code: string } | null;
  level?: { id: string; name: string; code: string } | null;
}

interface StudentPaymentRow {
  studentId: string;
  studentName: string;
  className: string;
  classCode: string;
  inscriptionPaid: number;
  reinscriptionPaid: number;
  arrearPaid: number;
  tuitionInstallments: { [installmentId: string]: number };
  totalTuitionExpected: number;
  totalTuitionPaid: number;
  reste: number;
  totalPaid: number;
}

interface RecapRow {
  effectif: number;
  className: string;
  arrieres: number;
  inscription: number;
  reinscription: number;
  tuitionInstallments: { [installmentId: string]: number };
  totalTuition: number;
  reste: number;
  totalPaid: number;
  soldeParClasse: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CollectionSummaryContent() {
  const [activeSubTab, setActiveSubTab] = useState<'detail' | 'recap'>('detail');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtres
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [academicYearId, setAcademicYearId] = useState<string>('');

  // Données
  const [feeStructures, setFeeStructures] = useState<FeeStructureWithInstallments[]>([]);
  const [studentRows, setStudentRows] = useState<StudentPaymentRow[]>([]);
  const [recapRows, setRecapRows] = useState<RecapRow[]>([]);

  // ─── Load school levels + classes + academic year ──────────────────────────
  useEffect(() => {
    const authHeaders = getClientAuthorizationHeader();
    fetch('/api/school-levels', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => setSchoolLevels(Array.isArray(d) ? d.filter((l: any) => l.id !== 'ALL') : []))
      .catch(() => setSchoolLevels([]));

    // Fetch classes physiques
    fetch('/api/all-classes', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => {
        const cls = Array.isArray(d) ? d : (d.data ?? []);
        setClasses(cls);
      })
      .catch(() => setClasses([]));

    // Fetch active academic year
    fetch('/api/academic-years', { headers: { ...authHeaders }, credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((d) => {
        const years = Array.isArray(d) ? d : (d.data ?? []);
        const active = years.find((y: any) => y.isActive) || years[0];
        if (active?.id) setAcademicYearId(active.id);
      })
      .catch(() => {});
  }, []);

  // ─── Load data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!academicYearId) return;
    setLoading(true);
    setError(null);
    try {
      const authHeaders = getClientAuthorizationHeader();
      const params = new URLSearchParams({ academicYearId });
      if (selectedLevelId) params.set('levelId', selectedLevelId);
      if (selectedClassId) params.set('classId', selectedClassId);

      // Fetch fee structures
      const feesRes = await fetch(`/api/finance/fee-structures?${params.toString()}`, {
        headers: { ...authHeaders },
        credentials: 'include',
        cache: 'no-store',
      });
      const feesData = await feesRes.json();
      const structures: FeeStructureWithInstallments[] = Array.isArray(feesData) ? feesData : [];
      setFeeStructures(structures);

      // Fetch student payment data
      const paymentRes = await fetch(`/api/finance/collection-summary?${params.toString()}`, {
        headers: { ...authHeaders },
        credentials: 'include',
        cache: 'no-store',
      });
      if (!paymentRes.ok) {
        throw new Error('Erreur lors du chargement des données');
      }
      const paymentData = await paymentRes.json();
      setStudentRows(paymentData.students || []);
      setRecapRows(paymentData.recap || []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedLevelId, selectedClassId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Compute tuition installments columns ──────────────────────────────────
  const tuitionInstallments = useMemo(() => {
    // Trouver toutes les structures de frais de type TUITION qui ont des tranches
    const tuitionStructures = feeStructures.filter(
      (f) => f.feeType === 'TUITION' && f.isInstallment && f.structureInstallments?.length > 0,
    );
    // Collecter tous les installments uniques
    const installmentsMap = new Map<string, FeeInstallment>();
    for (const struct of tuitionStructures) {
      for (const inst of struct.structureInstallments) {
        if (!installmentsMap.has(inst.id)) {
          installmentsMap.set(inst.id, inst);
        }
      }
    }
    return Array.from(installmentsMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [feeStructures]);

  // ─── Filtered classes based on selected level ──────────────────────────────
  const filteredClasses = useMemo(() => {
    if (!selectedLevelId) return classes;
    return classes.filter((c: any) => {
      const levelCode = (c.schoolLevel?.code || '').toLowerCase();
      const selectedLevel = schoolLevels.find((l) => l.id === selectedLevelId);
      return selectedLevel && levelCode === (selectedLevel.code || '').toLowerCase();
    });
  }, [classes, selectedLevelId, schoolLevels]);

  // ─── Export Excel ───────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    // TODO: Implement Excel export
    console.log('Export Excel — à implémenter');
  };

  // ─── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    // TODO: Implement PDF export
    console.log('Export PDF — à implémenter');
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">Bilan des encaissements</h1>
          <p className="text-sm text-graphite-700 mt-1">
            Suivi détaillé des encaissements par élève et récapitulatif par classe
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 border-b border-gray-200">
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
      </div>

      {/* Filtres */}
      <div className="flex gap-4 items-end">
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
      </div>

      {/* Tableaux */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-sm text-graphite-700">Chargement...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : activeSubTab === 'detail' ? (
        <DetailTable
          studentRows={studentRows}
          tuitionInstallments={tuitionInstallments}
        />
      ) : (
        <RecapTable
          recapRows={recapRows}
          tuitionInstallments={tuitionInstallments}
        />
      )}
    </div>
  );
}

// ─── Detail Table (Bilan des encaissements) ──────────────────────────────────

function DetailTable({
  studentRows,
  tuitionInstallments,
}: {
  studentRows: StudentPaymentRow[];
  tuitionInstallments: FeeInstallment[];
}) {
  if (studentRows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-graphite-600 bg-white rounded-xl border border-gray-200">
        Aucune donnée disponible. Veuillez sélectionner une année scolaire et une classe.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="sticky left-0 bg-gray-50 z-10">Noms et Prénoms</TableHead>
            <TableHead>Classe</TableHead>
            <TableHead>Arriéré</TableHead>
            <TableHead>Inscription</TableHead>
            <TableHead>Réinscription</TableHead>
            {/* Tranches de scolarité dynamiques */}
            {tuitionInstallments.map((inst) => (
              <TableHead key={inst.id} className="text-center">
                {inst.label}
              </TableHead>
            ))}
            <TableHead className="font-bold">Total Scolarité</TableHead>
            <TableHead className="font-bold">Reste</TableHead>
            <TableHead className="font-bold">Total des paiements</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {studentRows.map((row) => (
            <TableRow key={row.studentId} className="hover:bg-slate-50">
              <TableCell className="font-medium sticky left-0 bg-white z-10">
                {row.studentName}
              </TableCell>
              <TableCell className="text-sm">{row.className}</TableCell>
              <TableCell className="text-sm text-right">
                {row.arrearPaid > 0 ? formatCurrency(row.arrearPaid) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right">
                {row.inscriptionPaid > 0 ? formatCurrency(row.inscriptionPaid) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right">
                {row.reinscriptionPaid > 0 ? formatCurrency(row.reinscriptionPaid) : '—'}
              </TableCell>
              {tuitionInstallments.map((inst) => {
                const paid = row.tuitionInstallments[inst.id] || 0;
                return (
                  <TableCell key={inst.id} className="text-sm text-right">
                    {paid > 0 ? formatCurrency(paid) : '—'}
                  </TableCell>
                );
              })}
              <TableCell className="text-sm font-bold text-right">
                {formatCurrency(row.totalTuitionExpected)}
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                <span className={row.reste > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(row.reste)}
                </span>
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                {formatCurrency(row.totalPaid)}
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
  tuitionInstallments,
}: {
  recapRows: RecapRow[];
  tuitionInstallments: FeeInstallment[];
}) {
  if (recapRows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-graphite-600 bg-white rounded-xl border border-gray-200">
        Aucune donnée disponible pour le récapitulatif.
      </div>
    );
  }

  // Calculer les totaux
  const totals = recapRows.reduce(
    (acc, row) => {
      acc.effectif += row.effectif;
      acc.arrieres += row.arrieres;
      acc.inscription += row.inscription;
      acc.reinscription += row.reinscription;
      acc.totalTuition += row.totalTuition;
      acc.reste += row.reste;
      acc.totalPaid += row.totalPaid;
      acc.soldeParClasse += row.soldeParClasse;
      for (const inst of tuitionInstallments) {
        acc.installments[inst.id] = (acc.installments[inst.id] || 0) + (row.tuitionInstallments[inst.id] || 0);
      }
      return acc;
    },
    {
      effectif: 0, arrieres: 0, inscription: 0, reinscription: 0,
      totalTuition: 0, reste: 0, totalPaid: 0, soldeParClasse: 0,
      installments: {} as { [id: string]: number },
    },
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Effectif</TableHead>
            <TableHead>Classe</TableHead>
            <TableHead>Arriérés</TableHead>
            <TableHead>Inscription</TableHead>
            <TableHead>Réinscription</TableHead>
            {/* Tranches de scolarité dynamiques */}
            {tuitionInstallments.map((inst) => (
              <TableHead key={inst.id} className="text-center">
                {inst.label}
              </TableHead>
            ))}
            <TableHead className="font-bold">Total Scolarité</TableHead>
            <TableHead className="font-bold">Reste</TableHead>
            <TableHead className="font-bold">Total des payements</TableHead>
            <TableHead className="font-bold">Solde par classe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recapRows.map((row, idx) => (
            <TableRow key={idx} className="hover:bg-slate-50">
              <TableCell className="text-sm text-center">{row.effectif}</TableCell>
              <TableCell className="font-medium">{row.className}</TableCell>
              <TableCell className="text-sm text-right">
                {row.arrieres > 0 ? formatCurrency(row.arrieres) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right">
                {row.inscription > 0 ? formatCurrency(row.inscription) : '—'}
              </TableCell>
              <TableCell className="text-sm text-right">
                {row.reinscription > 0 ? formatCurrency(row.reinscription) : '—'}
              </TableCell>
              {tuitionInstallments.map((inst) => {
                const amount = row.tuitionInstallments[inst.id] || 0;
                return (
                  <TableCell key={inst.id} className="text-sm text-right">
                    {amount > 0 ? formatCurrency(amount) : '—'}
                  </TableCell>
                );
              })}
              <TableCell className="text-sm font-bold text-right">
                {formatCurrency(row.totalTuition)}
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                <span className={row.reste > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(row.reste)}
                </span>
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                {formatCurrency(row.totalPaid)}
              </TableCell>
              <TableCell className="text-sm font-bold text-right">
                {formatCurrency(row.soldeParClasse)}
              </TableCell>
            </TableRow>
          ))}
          {/* Ligne TOTAL */}
          <TableRow className="bg-blue-50 font-bold">
            <TableCell className="text-center">{totals.effectif}</TableCell>
            <TableCell>TOTAL</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.arrieres)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.inscription)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.reinscription)}</TableCell>
            {tuitionInstallments.map((inst) => (
              <TableCell key={inst.id} className="text-right">
                {formatCurrency(totals.installments[inst.id] || 0)}
              </TableCell>
            ))}
            <TableCell className="text-right">{formatCurrency(totals.totalTuition)}</TableCell>
            <TableCell className="text-right text-red-600">{formatCurrency(totals.reste)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.totalPaid)}</TableCell>
            <TableCell className="text-right">{formatCurrency(totals.soldeParClasse)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
