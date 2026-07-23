/**
 * ============================================================================
 * MODULE EXAMEN — ONGLET ÉVALUATIONS (CRUD complet)
 * ============================================================================
 *
 * Conforme au Module Examen.md — Section Onglet 3 :
 *   "Créer et gérer les évaluations : devoirs, interrogations, compositions,
 *    examens blancs, épreuves pratiques, oraux"
 *
 * Cycle de vie :
 *   DRAFT → PLANNED → OPEN_FOR_GRADING → SUBMITTED → VALIDATED → LOCKED
 *                                                ↘ CANCELLED
 *
 * Design system : aligné sur /students/classes (bouton bleu + FormModal)
 * ============================================================================
 */

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, Calendar, Eye, Send, Trash2, Pencil, Lock, XCircle,
  Play, CheckCircle, MoreVertical, Loader2, Settings,
} from 'lucide-react';
import { ModuleContainer, FormModal } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { classesService } from '@/services/classes.service';
import { pedagogyService } from '@/services/pedagogy.service';
import { getAcademicYearPeriods } from '@/services/settings.service';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { EXAMS_SUB_MODULES } from '../sub-modules';
import { useExamSubModules, useExamScope } from '../layout';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Evaluation {
  id: string;
  title: string | null;
  description?: string | null;
  evaluationDate: string;
  maxScore: number;
  coefficient: number;
  status: 'DRAFT' | 'PLANNED' | 'OPEN_FOR_GRADING' | 'SUBMITTED' | 'VALIDATED' | 'LOCKED' | 'CANCELLED';
  class?: { id: string; name: string };
  subject?: { id: string; name: string };
  evaluationType?: { id: string; name: string; code?: string };
  period?: { id: string; name: string };
  _count?: { grades: number };
}

interface ClassItem { id: string; name: string; }
interface SubjectItem { id: string; name: string; }
interface PeriodItem { id: string; name: string; type: string; isClosed: boolean; }
interface EvaluationTypeItem {
  id: string; name: string; code?: string;
  defaultMaxScore: number; defaultCoefficient: number;
  schoolLevelId?: string | null;
  isSystem?: boolean;
}

interface EvaluationForm {
  title: string;
  description: string;
  classId: string;
  subjectId: string;
  periodId: string;
  evaluationTypeId: string;
  evaluationDate: string;
  maxScore: string;
  coefficient: string;
}

interface EvaluationTypeForm {
  name: string;
  code: string;
  schoolLevelId: string;
  defaultMaxScore: string;
  defaultCoefficient: string;
}

const EMPTY_TYPE_FORM: EvaluationTypeForm = {
  name: '',
  code: '',
  schoolLevelId: '',
  defaultMaxScore: '20',
  defaultCoefficient: '1',
};

const EMPTY_FORM: EvaluationForm = {
  title: '',
  description: '',
  classId: '',
  subjectId: '',
  periodId: '',
  evaluationTypeId: '',
  evaluationDate: new Date().toISOString().slice(0, 10),
  maxScore: '20',
  coefficient: '1',
};

// ─── Status Badge ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  PLANNED: { label: 'Planifiée', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  OPEN_FOR_GRADING: { label: 'En saisie', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  SUBMITTED: { label: 'Soumise', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  VALIDATED: { label: 'Validée', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  LOCKED: { label: 'Verrouillée', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  CANCELLED: { label: 'Annulée', className: 'bg-red-100 text-red-700 border-red-200 line-through' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-700' };
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

// ─── Page Principale ────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const scopedSubModules = useExamSubModules(EXAMS_SUB_MODULES);
  const { academicYear, schoolLevel } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal state — Évaluation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EvaluationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Modal state — Type d'évaluation (CRUD)
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState<EvaluationTypeForm>(EMPTY_TYPE_FORM);
  const [savingType, setSavingType] = useState(false);

  // Référence data
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [evaluationTypes, setEvaluationTypes] = useState<EvaluationTypeItem[]>([]);

  // ─── Chargement initial : évaluations + données de référence ──────────────
  const loadData = useCallback(async () => {
    if (!schoolLevel?.id || !academicYear?.id) return;
    setLoading(true);
    try {
      const params: any = {
        schoolLevelId: schoolLevel.id,
        academicYearId: academicYear.id,
      };
      if (scopeLang) params.language = scopeLang;
      const [evals, classesData, periodsData, typesData, subjectsData] = await Promise.all([
        institutionalExamsService.getEvaluations(params),
        classesService.getAll({ schoolLevelId: schoolLevel.id, academicYearId: academicYear.id }).catch(() => []),
        getAcademicYearPeriods(academicYear.id).catch(() => []),
        institutionalExamsService.getEvaluationTypes(schoolLevel.id).catch(() => []),
        pedagogyService.getSubjects(academicYear.id).catch(() => []),
      ]);
      setEvaluations(Array.isArray(evals) ? evals : []);
      setClasses(Array.isArray(classesData) ? classesData : (classesData?.data ?? []));
      setPeriods(Array.isArray(periodsData) ? periodsData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : (subjectsData?.data ?? []));
      setEvaluationTypes(Array.isArray(typesData) ? typesData : []);
    } catch (error) {
      console.error('Error loading evaluations', error);
      toast.error('Erreur lors du chargement des évaluations');
    } finally {
      setLoading(false);
    }
  }, [schoolLevel?.id, academicYear?.id, scopeLang]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtrage des évaluations (search + status) ──────────────────────────
  const filteredEvaluations = useMemo(() => {
    let result = evaluations;
    if (statusFilter !== 'ALL') {
      result = result.filter(e => e.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(e =>
        (e.title?.toLowerCase().includes(q)) ||
        (e.class?.name?.toLowerCase().includes(q)) ||
        (e.subject?.name?.toLowerCase().includes(q)) ||
        (e.evaluationType?.name?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [evaluations, statusFilter, searchQuery]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (evaluation: Evaluation) => {
    setForm({
      title: evaluation.title || '',
      description: evaluation.description || '',
      classId: evaluation.class?.id || '',
      subjectId: evaluation.subject?.id || '',
      periodId: evaluation.period?.id || '',
      evaluationTypeId: evaluation.evaluationType?.id || '',
      evaluationDate: evaluation.evaluationDate ? new Date(evaluation.evaluationDate).toISOString().slice(0, 10) : '',
      maxScore: String(evaluation.maxScore || 20),
      coefficient: String(evaluation.coefficient || 1),
    });
    setEditingId(evaluation.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    // Validation
    if (!form.classId || !form.subjectId || !form.periodId || !form.evaluationTypeId || !form.evaluationDate) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title || null,
        description: form.description || null,
        classId: form.classId,
        subjectId: form.subjectId,
        periodId: form.periodId,
        evaluationTypeId: form.evaluationTypeId,
        evaluationDate: new Date(form.evaluationDate).toISOString(),
        maxScore: parseFloat(form.maxScore) || 20,
        coefficient: parseFloat(form.coefficient) || 1,
      };
      if (editingId) {
        await institutionalExamsService.updateEvaluation(editingId, payload);
        toast.success('✅ Évaluation modifiée');
      } else {
        await institutionalExamsService.createEvaluation(payload);
        toast.success('✅ Évaluation créée');
      }
      handleCloseModal();
      await loadData();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (evaluation: Evaluation) => {
    if (!confirm(`Supprimer l'évaluation "${evaluation.title || 'sans titre'}" ?`)) return;
    try {
      await institutionalExamsService.deleteEvaluation(evaluation.id);
      toast.success('✅ Évaluation supprimée');
      await loadData();
    } catch (err: any) {
      toast.error('Erreur lors de la suppression', { description: err.message });
    }
  };

  const handleOpen = async (evaluation: Evaluation) => {
    try {
      await institutionalExamsService.openEvaluation(evaluation.id);
      toast.success('✅ Évaluation ouverte pour la saisie');
      await loadData();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    }
  };

  const handleSubmit = async (evaluation: Evaluation) => {
    if (!confirm('Soumettre cette évaluation pour validation ?')) return;
    try {
      await institutionalExamsService.submitEvaluation(evaluation.id);
      toast.success('✅ Évaluation soumise');
      await loadData();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    }
  };

  const handleValidate = async (evaluation: Evaluation) => {
    if (!confirm('Valider définitivement cette évaluation ? Les notes seront verrouillées.')) return;
    try {
      await institutionalExamsService.validateEvaluation(evaluation.id);
      toast.success('✅ Évaluation validée');
      await loadData();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    }
  };

  const handleCancel = async (evaluation: Evaluation) => {
    const reason = prompt('Raison de l\'annulation (optionnel) :') || '';
    try {
      await institutionalExamsService.cancelEvaluation(evaluation.id, reason || undefined);
      toast.success('✅ Évaluation annulée');
      await loadData();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    }
  };

  // ─── Handlers : CRUD des types d'évaluation ──────────────────────────────
  const handleOpenTypeModal = () => {
    // Pré-remplir avec le niveau scolaire actuellement sélectionné (s'il est valide)
    const currentLevel = (availableLevels || []).find(
      (l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL'
    );
    setTypeForm({
      ...EMPTY_TYPE_FORM,
      schoolLevelId: currentLevel?.id || '',
    });
    setEditingTypeId(null);
    setIsTypeModalOpen(true);
  };

  const handleEditType = (type: EvaluationTypeItem) => {
    setTypeForm({
      name: type.name,
      code: type.code || '',
      schoolLevelId: type.schoolLevelId || '',
      defaultMaxScore: String(type.defaultMaxScore),
      defaultCoefficient: String(type.defaultCoefficient),
    });
    setEditingTypeId(type.id);
    setIsTypeModalOpen(true);
  };

  const handleCloseTypeModal = () => {
    setIsTypeModalOpen(false);
    setEditingTypeId(null);
    setTypeForm(EMPTY_TYPE_FORM);
  };

  const handleSaveType = async () => {
    if (!typeForm.name || !typeForm.schoolLevelId) {
      toast.error('Le nom et le niveau scolaire sont obligatoires');
      return;
    }
    setSavingType(true);
    try {
      const payload = {
        name: typeForm.name,
        code: typeForm.code || null,
        schoolLevelId: typeForm.schoolLevelId,
        defaultMaxScore: parseFloat(typeForm.defaultMaxScore) || 20,
        defaultCoefficient: parseFloat(typeForm.defaultCoefficient) || 1,
      };
      if (editingTypeId) {
        await institutionalExamsService.updateEvaluationType(editingTypeId, payload);
        toast.success('✅ Type modifié');
      } else {
        await institutionalExamsService.createEvaluationType(payload);
        toast.success('✅ Type créé');
      }
      handleCloseTypeModal();
      await loadData();
    } catch (err: any) {
      toast.error('Erreur lors de la sauvegarde du type', { description: err.message });
    } finally {
      setSavingType(false);
    }
  };

  const handleDeleteType = async (type: EvaluationTypeItem) => {
    if (type.isSystem) {
      toast.error('Les types système ne peuvent pas être supprimés');
      return;
    }
    if (!confirm(`Supprimer le type "${type.name}" ?`)) return;
    try {
      await institutionalExamsService.deleteEvaluationType(type.id);
      toast.success('✅ Type supprimé');
      await loadData();
    } catch (err: any) {
      toast.error('Erreur lors de la suppression', { description: err.message });
    }
  };

  // ─── Available actions based on status ───────────────────────────────────
  const getAvailableActions = (evaluation: Evaluation) => {
    const actions: Array<{ label: string; icon: any; onClick: () => void; color?: string; disabled?: boolean }> = [];
    const status = evaluation.status;

    if (status === 'PLANNED' || status === 'DRAFT') {
      actions.push({ label: 'Ouvrir pour saisie', icon: Play, onClick: () => handleOpen(evaluation), color: 'text-amber-600' });
    }
    if (status === 'OPEN_FOR_GRADING') {
      actions.push({ label: 'Soumettre pour validation', icon: Send, onClick: () => handleSubmit(evaluation), color: 'text-purple-600' });
    }
    if (status === 'SUBMITTED') {
      actions.push({ label: 'Valider', icon: CheckCircle, onClick: () => handleValidate(evaluation), color: 'text-emerald-600' });
    }

    // Edit est possible tant que non validée/verrouillée/annulée
    if (!['VALIDATED', 'LOCKED', 'CANCELLED'].includes(status)) {
      actions.push({ label: 'Modifier', icon: Pencil, onClick: () => handleOpenEdit(evaluation) });
    }

    // Annuler — possible tant que non validée/verrouillée
    if (!['VALIDATED', 'LOCKED', 'CANCELLED'].includes(status)) {
      actions.push({ label: 'Annuler', icon: XCircle, onClick: () => handleCancel(evaluation), color: 'text-orange-600' });
    }

    // Supprimer — possible seulement si pas validée/verrouillée
    if (!['VALIDATED', 'LOCKED'].includes(status)) {
      actions.push({ label: 'Supprimer', icon: Trash2, onClick: () => handleDelete(evaluation), color: 'text-red-600' });
    }

    return actions;
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
    <ModuleContainer
      header={{
        title: 'Évaluations',
        description: 'Créer et gérer les évaluations : devoirs, interrogations, compositions, examens blancs, épreuves pratiques, oraux.',
        icon: 'fileText',
        actions: (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenTypeModal}
              className="flex items-center space-x-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
              title="Gérer les types d'évaluation (devoir, interrogation, composition...)"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Types d'évaluation</span>
            </button>
            <button
              onClick={handleOpenCreate}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle évaluation</span>
            </button>
          </div>
        ),
      }}
      subModules={{
        modules: scopedSubModules,
        activeModuleId: 'evaluations',
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            {/* Barre de recherche + filtres */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-wrap gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 min-w-[240px] max-w-md">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par titre, classe, matière..."
                  className="bg-transparent border-none focus:outline-none text-sm w-full"
                />
              </div>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Tous les statuts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les statuts</SelectItem>
                    <SelectItem value="DRAFT">Brouillon</SelectItem>
                    <SelectItem value="PLANNED">Planifiée</SelectItem>
                    <SelectItem value="OPEN_FOR_GRADING">En saisie</SelectItem>
                    <SelectItem value="SUBMITTED">Soumise</SelectItem>
                    <SelectItem value="VALIDATED">Validée</SelectItem>
                    <SelectItem value="LOCKED">Verrouillée</SelectItem>
                    <SelectItem value="CANCELLED">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tableau des évaluations */}
            <Card className="border-none shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead>Titre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Matière</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Barème</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredEvaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-gray-500">
                        {searchQuery || statusFilter !== 'ALL'
                          ? 'Aucune évaluation ne correspond aux filtres.'
                          : 'Aucune évaluation. Cliquez sur "Nouvelle évaluation" pour commencer.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvaluations.map((ev) => (
                      <TableRow key={ev.id} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="font-medium">
                          {ev.title || <span className="text-gray-400 italic">Sans titre</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">
                            {ev.evaluationType?.name || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell>{ev.class?.name || '—'}</TableCell>
                        <TableCell>{ev.subject?.name || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center text-gray-600">
                            <Calendar className="w-3 h-3 mr-1" />
                            {format(new Date(ev.evaluationDate), 'dd MMM yyyy', { locale: fr })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            /{ev.maxScore} <span className="text-gray-400">(coef {ev.coefficient})</span>
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={ev.status} /></TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{ev._count?.grades ?? 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {getAvailableActions(ev).map((action, idx) => (
                                <DropdownMenuItem
                                  key={idx}
                                  onClick={action.onClick}
                                  className={`cursor-pointer ${action.color || ''}`}
                                  disabled={action.disabled}
                                >
                                  <action.icon className="w-4 h-4 mr-2" />
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                              {getAvailableActions(ev).length === 0 && (
                                <DropdownMenuItem disabled className="text-gray-400">
                                  Aucune action disponible
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        )
      }}
    />

    {/* ─── Modal Création / Édition ────────────────────────────────────────── */}
    <FormModal
      title={editingId ? 'Modifier l\'évaluation' : 'Créer une évaluation'}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      size="lg"
      actions={
        <>
          <button
            onClick={handleCloseModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.classId || !form.subjectId || !form.periodId || !form.evaluationTypeId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {/* Titre */}
        <div>
          <Label htmlFor="title">Titre <span className="text-gray-400 font-normal">(optionnel)</span></Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Devoir n°1 — Trimestre 1"
          />
        </div>

        {/* Type d'évaluation */}
        <div>
          <Label htmlFor="evaluationTypeId">Type d'évaluation <span className="text-red-500">*</span></Label>
          <Select value={form.evaluationTypeId} onValueChange={(v) => {
            const selectedType = evaluationTypes.find(t => t.id === v);
            setForm({
              ...form,
              evaluationTypeId: v,
              maxScore: selectedType ? String(selectedType.defaultMaxScore) : form.maxScore,
              coefficient: selectedType ? String(selectedType.defaultCoefficient) : form.coefficient,
            });
          }}>
            <SelectTrigger id="evaluationTypeId">
              <SelectValue placeholder="Sélectionner un type..." />
            </SelectTrigger>
            <SelectContent>
              {evaluationTypes.length === 0 ? (
                <SelectItem value="_none" disabled>Aucun type disponible</SelectItem>
              ) : (
                evaluationTypes.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.code ? `[${t.code}] ` : ''}{t.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Classe + Matière */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="classId">Classe <span className="text-red-500">*</span></Label>
            <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
              <SelectTrigger id="classId">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="_none" disabled>Aucune classe</SelectItem>
                ) : (
                  classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="subjectId">Matière <span className="text-red-500">*</span></Label>
            <Select value={form.subjectId} onValueChange={(v) => setForm({ ...form, subjectId: v })}>
              <SelectTrigger id="subjectId">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {subjects.length === 0 ? (
                  <SelectItem value="_none" disabled>Aucune matière</SelectItem>
                ) : (
                  subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Période + Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="periodId">Période <span className="text-red-500">*</span></Label>
            <Select value={form.periodId} onValueChange={(v) => setForm({ ...form, periodId: v })}>
              <SelectTrigger id="periodId">
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {periods.length === 0 ? (
                  <SelectItem value="_none" disabled>Aucune période</SelectItem>
                ) : (
                  periods.map(p => (
                    <SelectItem key={p.id} value={p.id} disabled={p.isClosed}>
                      {p.name} {p.isClosed && '(clôturée)'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="evaluationDate">Date <span className="text-red-500">*</span></Label>
            <Input
              id="evaluationDate"
              type="date"
              value={form.evaluationDate}
              onChange={(e) => setForm({ ...form, evaluationDate: e.target.value })}
            />
          </div>
        </div>

        {/* Barème + Coefficient */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxScore">Barème (note maximale)</Label>
            <Input
              id="maxScore"
              type="number"
              step="0.5"
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="coefficient">Coefficient</Label>
            <Input
              id="coefficient"
              type="number"
              step="0.5"
              value={form.coefficient}
              onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">Description <span className="text-gray-400 font-normal">(optionnel)</span></Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Chapitres abordés, consignes particulières..."
            rows={3}
          />
        </div>
      </div>
    </FormModal>

    {/* ─── Modal Gestion des Types d'Évaluation (CRUD) ──────────────────────── */}
    <FormModal
      title={editingTypeId ? 'Modifier le type d\'évaluation' : 'Gérer les types d\'évaluation'}
      isOpen={isTypeModalOpen}
      onClose={handleCloseTypeModal}
      size="lg"
      actions={
        <>
          <button
            onClick={handleCloseTypeModal}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Fermer
          </button>
          <button
            onClick={handleSaveType}
            disabled={savingType || !typeForm.name || !typeForm.schoolLevelId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {savingType ? 'Enregistrement...' : editingTypeId ? 'Modifier' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        {/* Liste des types existants */}
        {!editingTypeId && (
          <div>
            <Label className="text-sm font-semibold text-gray-700">
              Types existants {evaluationTypes.length > 0 && `(${evaluationTypes.length})`}
            </Label>
            <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
              {evaluationTypes.length === 0 ? (
                <p className="text-sm text-gray-500 italic text-center py-4">
                  Aucun type d'évaluation pour ce niveau scolaire.
                  Créez-en un ci-dessous.
                </p>
              ) : (
                evaluationTypes.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-white rounded-md p-2 border border-gray-100">
                    <div className="flex items-center gap-2">
                      {t.code && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-xs">
                          {t.code}
                        </Badge>
                      )}
                      <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      <span className="text-xs text-gray-500">
                        /{t.defaultMaxScore} · coef {t.defaultCoefficient}
                      </span>
                      {t.isSystem && (
                        <Badge variant="outline" className="bg-gray-100 text-gray-600 text-[10px]">Système</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditType(t)}
                        disabled={t.isSystem}
                        title={t.isSystem ? 'Type système non modifiable' : 'Modifier'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600"
                        onClick={() => handleDeleteType(t)}
                        disabled={t.isSystem}
                        title={t.isSystem ? 'Type système non supprimable' : 'Supprimer'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-600 font-medium">
                ➕ Créer un nouveau type :
              </p>
            </div>
          </div>
        )}

        {/* Formulaire de création/édition */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="typeName">Nom <span className="text-red-500">*</span></Label>
            <Input
              id="typeName"
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              placeholder="Ex: Devoir surveillé"
            />
          </div>
          <div>
            <Label htmlFor="typeCode">Code <span className="text-gray-400 font-normal">(optionnel)</span></Label>
            <Input
              id="typeCode"
              value={typeForm.code}
              onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
              placeholder="Ex: DS"
              maxLength={10}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="typeLevel">Niveau scolaire <span className="text-red-500">*</span></Label>
          <Select
            value={typeForm.schoolLevelId}
            onValueChange={(v) => setTypeForm({ ...typeForm, schoolLevelId: v })}
            disabled={!!editingTypeId}
          >
            <SelectTrigger id="typeLevel">
              <SelectValue placeholder="Sélectionner un niveau..." />
            </SelectTrigger>
            <SelectContent>
              {(availableLevels || [])
                .filter((l: any) => l.id !== 'ALL' && l.isActive)
                .map((level: any) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            {editingTypeId
              ? '⚠️ Le niveau scolaire ne peut pas être modifié après création.'
              : 'Le type sera disponible uniquement pour ce niveau scolaire.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="typeMaxScore">Barème par défaut</Label>
            <Input
              id="typeMaxScore"
              type="number"
              step="0.5"
              value={typeForm.defaultMaxScore}
              onChange={(e) => setTypeForm({ ...typeForm, defaultMaxScore: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="typeCoef">Coefficient par défaut</Label>
            <Input
              id="typeCoef"
              type="number"
              step="0.5"
              value={typeForm.defaultCoefficient}
              onChange={(e) => setTypeForm({ ...typeForm, defaultCoefficient: e.target.value })}
            />
          </div>
        </div>

        {/* Aide : exemples par niveau */}
        {!editingTypeId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-900 mb-1">💡 Aide — Types d'évaluation par niveau :</p>
            <ul className="text-xs text-blue-800 space-y-0.5">
              <li>• <strong>Maternelle / Primaire</strong> : Évaluation mensuelle, Évaluation certificative, Évaluation formative, Évaluation sommative</li>
              <li>• <strong>Secondaire</strong> : Devoir, Interrogation, Interrogation écrite, Devoir surveillé, Épreuve pratique (TP)</li>
            </ul>
          </div>
        )}
      </div>
    </FormModal>
    </>
  );
}
