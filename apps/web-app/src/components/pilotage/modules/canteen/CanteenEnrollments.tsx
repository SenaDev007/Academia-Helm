/**
 * ============================================================================
 * CANTEEN ENROLLMENTS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/canteen/enrollments
 * Endpoint (création)  : POST /modules-complementaires/canteen/enrollments
 * Endpoint (validation): PUT  /modules-complementaires/canteen/enrollments/:id/validate
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - alert() → toast() via useToast()
 *  - fixed inset-0 modal → <Dialog> shadcn
 *  - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 *  - <table> HTML → <Table> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 *  - FIX : le payload de validation envoyait `{}` au PUT
 *    canteen/enrollments/:id/validate — corrigé pour envoyer
 *    `{ status: 'VALIDATED' }` (ou `REJECTED`).
 * ============================================================================
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter,
  CheckCircle2, XCircle, Clock,
  Calendar, CreditCard, ChevronRight,
  Plus, AlertTriangle, Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
// ⭐ 2026-10-15 — Pattern Finance : sélection classe → liste élèves → sélection élève
import { useAppSession } from '@/contexts/AppSessionContext';

interface EnrollmentItem {
  id: string;
  date?: string;
  requestDate?: string;
  createdAt?: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  parent?: string;
  parentName?: string;
  plan?: string;
  subscriptionPlan?: string;
  diet?: string;
  dietType?: string;
  allergy?: string;
  allergies?: string;
  status?: string;
  [key: string]: any;
}

interface NewEnrollmentFormData {
  studentId: string;
  regime: string;
}

const emptyEnrollmentForm: NewEnrollmentFormData = { studentId: '', regime: 'STANDARD' };

export default function CanteenEnrollments() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { user } = useAppSession();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewEnrollmentFormData>(emptyEnrollmentForm);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ⭐ 2026-10-15 — Pattern Finance : sélection classe → liste élèves
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  const { data: enrollments, loading, error, refetch } = useModulesList<EnrollmentItem>(
    'canteen',
    'enrollments',
    academicYear?.id,
    search ? { search } : undefined,
  );

  // ⭐ Charger les classes (pattern Finance)
  useEffect(() => {
    if (!academicYear?.id || !user) return;
    fetch(`/api/all-classes?academicYearId=${academicYear.id}`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setClasses(Array.isArray(data) ? data : []);
      })
      .catch(() => setClasses([]));
  }, [academicYear?.id, user]);

  // ⭐ Charger les élèves de la classe sélectionnée
  useEffect(() => {
    if (!selectedClassId || !academicYear?.id) {
      setStudents([]);
      return;
    }
    setStudentsLoading(true);
    fetch(`/api/students?classId=${selectedClassId}&academicYearId=${academicYear.id}&limit=200`, {
      credentials: 'include',
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.students || data?.data || []);
        setStudents(list);
      })
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  }, [selectedClassId, academicYear?.id]);

  // ⭐ Filtrer les élèves par recherche
  const filteredStudents = students.filter((s: any) => {
    if (!studentSearch) return true;
    const name = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    const matricule = (s.matricule || '').toLowerCase();
    const q = studentSearch.toLowerCase();
    return name.includes(q) || matricule.includes(q);
  });

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/enrollments',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptyEnrollmentForm);
      await refetch();
      toast({ title: 'Inscription créée', description: 'L’élève a été inscrit à la cantine.' });
    } catch (e: any) {
      console.error('Erreur création inscription :', e?.message || e);
      toast({
        title: 'Erreur création',
        description: e?.message || 'Erreur lors de la création de l’inscription',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (enrollmentId: string) => {
    try {
      setActionLoading(enrollmentId);
      // FIX (Task 7-d) : envoyer { status: 'VALIDATED' } au lieu de {} vide
      await modulesApi.put(
        `canteen/enrollments/${enrollmentId}/validate`,
        { status: 'VALIDATED' },
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Inscription validée', description: 'L’élève est désormais inscrit à la cantine.' });
    } catch (e: any) {
      console.error('Erreur validation inscription :', e?.message || e);
      toast({
        title: 'Erreur validation',
        description: e?.message || 'Erreur lors de la validation de l’inscription',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (enrollmentId: string) => {
    try {
      setActionLoading(enrollmentId);
      // FIX (Task 7-d) : envoyer { status: 'REJECTED' } au lieu de {} vide
      await modulesApi.put(
        `canteen/enrollments/${enrollmentId}/validate`,
        { status: 'REJECTED' },
        buildModulesApiOptions(academicYear?.id),
      );
      await refetch();
      toast({ title: 'Inscription rejetée', description: 'La demande a été rejetée.' });
    } catch (e: any) {
      console.error('Erreur rejet inscription :', e?.message || e);
      toast({
        title: 'Erreur',
        description: e?.message || 'Erreur lors du rejet de l’inscription',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = (enrollments ?? []).filter((e) => (e.status ?? '').toLowerCase().includes('attente') || (e.status ?? '').toLowerCase().includes('pending')).length;
  const acceptedCount = (enrollments ?? []).filter((e) => (e.status ?? '').toLowerCase().includes('valid') || (e.status ?? '').toLowerCase().includes('accept')).length;
  const acceptanceRate = (enrollments ?? []).length > 0 ? Math.round((acceptedCount / enrollments.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des inscriptions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Demandes en attente"
          value={String(pendingCount)}
          icon={Clock}
          color="amber"
        />
        <SummaryCard
          title="Inscriptions (Total)"
          value={String(enrollments.length)}
          icon={Plus}
          color="blue"
        />
        <SummaryCard
          title="Taux d’Acceptation"
          value={`${acceptanceRate}%`}
          icon={CheckCircle2}
          color="green"
        />
      </div>

      <Card className="p-0 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-navy-900 text-lg">Gestion des Inscriptions</h3>
            <p className="text-gray-500 text-sm mt-1">Validez les demandes d’accès à la restauration</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Élève, parent, classe..."
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Inscrire un élève
            </Button>
          </div>
        </div>

        {(enrollments ?? []).length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            Aucune inscription pour cette année scolaire.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Date Demande</TableHead>
                <TableHead>Élève & Parent</TableHead>
                <TableHead>Abonnement</TableHead>
                <TableHead>Régime / Allergies</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(enrollments ?? []).map((enr) => (
                <EnrollmentRow
                  key={enr.id}
                  enrollmentId={enr.id}
                  date={enr.date ?? enr.requestDate ?? enr.createdAt ?? '—'}
                  student={enr.student ?? enr.studentName ?? '—'}
                  class={enr.class ?? enr.className ?? '—'}
                  parent={enr.parent ?? enr.parentName ?? '—'}
                  plan={enr.plan ?? enr.subscriptionPlan ?? '—'}
                  diet={enr.diet ?? enr.dietType ?? 'Standard'}
                  allergy={enr.allergy ?? enr.allergies}
                  status={enr.status ?? 'En attente'}
                  onValidate={() => handleValidate(enr.id)}
                  onReject={() => handleReject(enr.id)}
                  actionLoading={actionLoading}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal Inscrire un élève — Pattern Finance (sélection classe → liste élèves) */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inscrire un élève à la cantine</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Étape 1 : Sélection de la classe */}
            <div className="space-y-1.5">
              <Label htmlFor="enr-class">Classe</Label>
              <select
                id="enr-class"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setFormData({ ...formData, studentId: '' });
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">— Sélectionner une classe —</option>
                {classes.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name || cls.className || `Classe ${cls.id.substring(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Étape 2 : Recherche + liste des élèves */}
            {selectedClassId && (
              <div className="space-y-2">
                <Label>Élève</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Rechercher par nom ou matricule..."
                    className="pl-10 w-full"
                  />
                </div>

                {studentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="ml-2 text-sm text-gray-600">Chargement des élèves...</span>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500">
                    Aucun élève trouvé dans cette classe.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                    {filteredStudents.map((s: any) => {
                      const isSelected = formData.studentId === s.id;
                      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
                      return (
                        <button
                          key={s.id}
                          onClick={() => setFormData({ ...formData, studentId: s.id })}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition border-b border-slate-100 last:border-b-0 ${
                            isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isSelected ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>
                              {fullName}
                            </p>
                            <p className="text-xs text-slate-500">{s.matricule || '—'}</p>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Étape 3 : Régime alimentaire */}
            {formData.studentId && (
              <div className="space-y-1.5">
                <Label htmlFor="enr-regime">Régime alimentaire</Label>
                <select
                  id="enr-regime"
                  value={formData.regime}
                  onChange={(e) => setFormData({ ...formData, regime: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="VEGETARIEN">Végétarien</option>
                  <option value="SANS_PORC">Sans porc</option>
                  <option value="SANS_GLUTEN">Sans gluten</option>
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setModalOpen(false);
              setSelectedClassId('');
              setFormData(emptyEnrollmentForm);
            }} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !formData.studentId}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Inscrire'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <Card className="p-6 shadow-sm flex items-center space-x-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-gray-500 text-xs font-medium">{title}</p>
        <p className="text-2xl font-semibold text-navy-900 mt-1">{value}</p>
      </div>
    </Card>
  );
}

function EnrollmentRow({ enrollmentId, date, student, class: className, parent, plan, diet, allergy, status, onValidate, onReject, actionLoading }: any) {
  const statusStyles: any = {
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Validé': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Rejeté': 'bg-red-50 text-red-600 border-red-100',
  };
  const statusStyle = statusStyles[status] ?? statusStyles['En attente'];
  const isLoading = actionLoading === enrollmentId;

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell>
        <div className="flex items-center space-x-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-medium text-navy-900">{date}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
            {typeof student === 'string' ? student.split(' ').map((n: string) => n[0]).join('') : '—'}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{student}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-xs text-blue-500">{className}</span>
              <span className="text-xs text-gray-400">| {parent}</span>
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          <CreditCard className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-semibold text-navy-900">{plan}</p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">{diet}</p>
          {allergy && (
            <Badge variant="outline" className="text-red-600 bg-red-50 border-red-100">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {allergy}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusStyle}>
          {status}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end space-x-2">
          {status === 'En attente' ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={onValidate}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                {isLoading ? '…' : 'Valider'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={onReject}
                disabled={isLoading}
                title="Rejeter"
              >
                <XCircle className="w-4 h-4 text-red-500" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
