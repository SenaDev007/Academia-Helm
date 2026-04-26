'use client';

import { useState, useEffect, useCallback } from 'react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';
import {
  Package,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  FileText,
  Users,
  TrendingUp,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PedagogicalMaterial {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  isActive: boolean;
  schoolLevel?: { name: string };
  subject?: { name: string };
}

interface MaterialStock {
  id: string;
  quantityTotal: number;
  quantityAvailable: number;
  material?: { name: string; code: string };
  schoolLevel?: { name: string };
  class?: { name: string };
  academicYear?: { name: string };
}

interface TeacherMaterialAssignment {
  id: string;
  quantity: number;
  conditionAtIssue: string;
  signed: boolean;
  notes?: string;
  teacher?: { firstName: string; lastName: string };
  material?: { name: string; code: string };
  class?: { name: string };
}

interface MaterialMovement {
  id: string;
  movementType: string;
  quantity: number;
  createdAt: string;
  notes?: string;
  material?: { name: string };
  performedBy?: { firstName: string; lastName: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MATERIAL_CATEGORIES = [
  { value: 'BOOK', label: 'Manuel' },
  { value: 'TEACHER_GUIDE', label: 'Guide enseignant' },
  { value: 'OFFICIAL_DOCUMENT', label: 'Document officiel' },
  { value: 'DIDACTIC_SUPPORT', label: 'Support didactique' },
  { value: 'LAB_MATERIAL', label: 'Matériel de labo' },
  { value: 'OTHER', label: 'Autre' },
];

const MATERIAL_CONDITIONS = [
  { value: 'NEW', label: 'Neuf' },
  { value: 'GOOD', label: 'Bon état' },
  { value: 'USED', label: 'Usagé' },
  { value: 'DAMAGED', label: 'Endommagé' },
];

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  TRANSFER: 'Transfert',
  LOSS: 'Perte',
  RETURN: 'Retour',
};

// ─── Create Material Modal ────────────────────────────────────────────────────

function CreateMaterialModal({
  schoolLevelId,
  onClose,
  onCreated,
}: {
  schoolLevelId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: 'BOOK',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await pedagogyFetch('/api/pedagogy/pedagogical-materials', {
        method: 'POST',
        body: {
          code: form.code.trim(),
          name: form.name.trim(),
          category: form.category,
          description: form.description.trim() || undefined,
          schoolLevelId,
          isActive: true,
        },
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Nouveau matériel</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="Ex: MAT-001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie *</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {MATERIAL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nom du matériel"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description optionnelle…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !form.code.trim() || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Créer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Create Assignment Modal ──────────────────────────────────────────────────

function CreateAssignmentModal({
  materials,
  academicYearId,
  schoolLevelId,
  onClose,
  onCreated,
}: {
  materials: PedagogicalMaterial[];
  academicYearId: string;
  schoolLevelId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [teachers, setTeachers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [form, setForm] = useState({
    teacherId: '',
    materialId: '',
    quantity: '1',
    conditionAtIssue: 'NEW',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedagogyFetch<Array<{ id: string; teacher: { firstName: string; lastName: string } }>>(
      `/api/pedagogy/teacher-profiles?academicYearId=${encodeURIComponent(academicYearId)}&schoolLevelId=${encodeURIComponent(schoolLevelId)}`
    )
      .then((data) => {
        if (Array.isArray(data)) {
          setTeachers(
            data.map((p) => ({
              id: p.id,
              firstName: p.teacher?.firstName ?? '',
              lastName: p.teacher?.lastName ?? '',
            }))
          );
        }
      })
      .catch(() => {});
  }, [academicYearId, schoolLevelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherId || !form.materialId) return;
    setSaving(true);
    setError(null);
    try {
      await pedagogyFetch('/api/pedagogy/teacher-material-assignments', {
        method: 'POST',
        body: {
          teacherId: form.teacherId,
          materialId: form.materialId,
          academicYearId,
          schoolLevelId,
          quantity: parseInt(form.quantity, 10),
          conditionAtIssue: form.conditionAtIssue,
          notes: form.notes.trim() || undefined,
          signed: false,
        },
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Nouvelle attribution</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enseignant *</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              required
            >
              <option value="">— Sélectionner —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Matériel *</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.materialId}
              onChange={(e) => setForm({ ...form, materialId: e.target.value })}
              required
            >
              <option value="">— Sélectionner —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.code}] {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">État *</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.conditionAtIssue}
                onChange={(e) => setForm({ ...form, conditionAtIssue: e.target.value })}
              >
                {MATERIAL_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-16 resize-none"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes optionnelles…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !form.teacherId || !form.materialId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Attribuer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PedagogicalMaterialsPage() {
  const { academicYear, schoolLevel } = useModuleContext();

  const [materials, setMaterials] = useState<PedagogicalMaterial[]>([]);
  const [stocks, setStocks] = useState<MaterialStock[]>([]);
  const [assignments, setAssignments] = useState<TeacherMaterialAssignment[]>([]);
  const [movements, setMovements] = useState<MaterialMovement[]>([]);

  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [stocksLoading, setStocksLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [stocksError, setStocksError] = useState<string | null>(null);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [movementsError, setMovementsError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadMaterials = useCallback(async () => {
    if (!schoolLevel?.id) { setMaterials([]); return; }
    setMaterialsLoading(true);
    setMaterialsError(null);
    try {
      const params = new URLSearchParams({ schoolLevelId: schoolLevel.id, isActive: 'true' });
      if (searchTerm) params.set('search', searchTerm);
      const data = await pedagogyFetch<{ data: PedagogicalMaterial[] } | PedagogicalMaterial[]>(
        `/api/pedagogy/pedagogical-materials?${params}`
      );
      setMaterials(Array.isArray(data) ? data : (data as { data: PedagogicalMaterial[] }).data ?? []);
    } catch (e) {
      setMaterialsError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setMaterialsLoading(false);
    }
  }, [schoolLevel?.id, searchTerm]);

  const loadStocks = useCallback(async () => {
    if (!academicYear?.id) { setStocks([]); return; }
    setStocksLoading(true);
    setStocksError(null);
    try {
      const data = await pedagogyFetch<{ data: MaterialStock[] } | MaterialStock[]>(
        `/api/pedagogy/material-stocks?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setStocks(Array.isArray(data) ? data : (data as { data: MaterialStock[] }).data ?? []);
    } catch (e) {
      setStocksError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setStocksLoading(false);
    }
  }, [academicYear?.id]);

  const loadAssignments = useCallback(async () => {
    if (!academicYear?.id) { setAssignments([]); return; }
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    try {
      const data = await pedagogyFetch<{ data: TeacherMaterialAssignment[] } | TeacherMaterialAssignment[]>(
        `/api/pedagogy/teacher-material-assignments?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setAssignments(Array.isArray(data) ? data : (data as { data: TeacherMaterialAssignment[] }).data ?? []);
    } catch (e) {
      setAssignmentsError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setAssignmentsLoading(false);
    }
  }, [academicYear?.id]);

  const loadMovements = useCallback(async () => {
    if (!academicYear?.id) { setMovements([]); return; }
    setMovementsLoading(true);
    setMovementsError(null);
    try {
      const data = await pedagogyFetch<{ data: MaterialMovement[] } | MaterialMovement[]>(
        `/api/pedagogy/material-movements?academicYearId=${encodeURIComponent(academicYear.id)}`
      );
      setMovements(Array.isArray(data) ? data : (data as { data: MaterialMovement[] }).data ?? []);
    } catch (e) {
      setMovementsError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setMovementsLoading(false);
    }
  }, [academicYear?.id]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);
  useEffect(() => { loadStocks(); }, [loadStocks]);
  useEffect(() => { loadAssignments(); }, [loadAssignments]);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  // ── Computed stats ────────────────────────────────────────────────────────────

  const totalStock = stocks.reduce((sum, s) => sum + (s.quantityTotal ?? 0), 0);
  const totalAvailable = stocks.reduce((sum, s) => sum + (s.quantityAvailable ?? 0), 0);

  const filteredMaterials = materials.filter(
    (m) =>
      !searchTerm ||
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const CONDITION_LABELS: Record<string, string> = {
    NEW: 'Neuf',
    GOOD: 'Bon état',
    USED: 'Usagé',
    DAMAGED: 'Endommagé',
  };

  return (
    <>
      {showCreateMaterial && schoolLevel?.id && (
        <CreateMaterialModal
          schoolLevelId={schoolLevel.id}
          onClose={() => setShowCreateMaterial(false)}
          onCreated={loadMaterials}
        />
      )}

      {showCreateAssignment && academicYear?.id && schoolLevel?.id && (
        <CreateAssignmentModal
          materials={materials}
          academicYearId={academicYear.id}
          schoolLevelId={schoolLevel.id}
          onClose={() => setShowCreateAssignment(false)}
          onCreated={loadAssignments}
        />
      )}

      <ModuleContainer
        header={{
          title: 'Matériel & Fournitures pédagogiques',
          description: 'Référentiel, stocks, attributions enseignants et mouvements',
          icon: 'bookOpen',
        }}
        subModules={{
          modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            return { id: tab.id, label: tab.label, href: tab.path, icon: <Icon className="w-4 h-4" /> };
          }),
        }}
        content={{
          layout: 'custom',
          children: (
            <div className="space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Matériels</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{materials.length}</div>
                    <p className="text-xs text-muted-foreground">Référentiel complet</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stock total</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalStock}</div>
                    <p className="text-xs text-muted-foreground">Unités en stock</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Attributions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{assignments.length}</div>
                    <p className="text-xs text-muted-foreground">Enseignants dotés</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Disponible</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalAvailable}</div>
                    <p className="text-xs text-muted-foreground">Unités disponibles</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="materials" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="materials">Référentiel</TabsTrigger>
                  <TabsTrigger value="stocks">Stocks</TabsTrigger>
                  <TabsTrigger value="assignments">Attributions</TabsTrigger>
                  <TabsTrigger value="movements">Mouvements</TabsTrigger>
                </TabsList>

                {/* ── Référentiel ──────────────────────────────────────── */}
                <TabsContent value="materials">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Référentiel du matériel</CardTitle>
                          <CardDescription>Liste des matériels pédagogiques du niveau sélectionné</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Rechercher…"
                              className="pl-8 w-56"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                          <Button onClick={() => setShowCreateMaterial(true)} disabled={!schoolLevel?.id}>
                            <Plus className="w-4 h-4 mr-2" />
                            Nouveau
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {materialsError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {materialsError}
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Code</TableHead>
                            <TableHead>Nom</TableHead>
                            <TableHead>Catégorie</TableHead>
                            <TableHead>Niveau</TableHead>
                            <TableHead>Matière</TableHead>
                            <TableHead>Statut</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {materialsLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Chargement…
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : !schoolLevel?.id ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Sélectionnez un niveau scolaire pour afficher les matériels.
                              </TableCell>
                            </TableRow>
                          ) : filteredMaterials.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Aucun matériel trouvé
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredMaterials.map((material) => (
                              <TableRow key={material.id}>
                                <TableCell className="font-mono text-sm">{material.code}</TableCell>
                                <TableCell className="font-medium">{material.name}</TableCell>
                                <TableCell>
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                    {MATERIAL_CATEGORIES.find(c => c.value === material.category)?.label ?? material.category}
                                  </span>
                                </TableCell>
                                <TableCell className="text-gray-600">{material.schoolLevel?.name ?? '—'}</TableCell>
                                <TableCell className="text-gray-600">{material.subject?.name ?? '—'}</TableCell>
                                <TableCell>
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${material.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {material.isActive ? 'Actif' : 'Inactif'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Stocks ──────────────────────────────────────────── */}
                <TabsContent value="stocks">
                  <Card>
                    <CardHeader>
                      <CardTitle>Stocks par année scolaire</CardTitle>
                      <CardDescription>
                        Vue consolidée des stocks pour l'année {academicYear?.name ?? '—'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {stocksError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {stocksError}
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Matériel</TableHead>
                            <TableHead>Niveau</TableHead>
                            <TableHead>Classe</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Disponible</TableHead>
                            <TableHead className="text-right">Attribué</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stocksLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Chargement…
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : !academicYear?.id ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Sélectionnez une année scolaire.
                              </TableCell>
                            </TableRow>
                          ) : stocks.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Aucun stock enregistré
                              </TableCell>
                            </TableRow>
                          ) : (
                            stocks.map((stock) => (
                              <TableRow key={stock.id}>
                                <TableCell className="font-medium">
                                  {stock.material?.name ?? '—'}
                                  {stock.material?.code && (
                                    <span className="ml-1 text-xs text-gray-400 font-mono">({stock.material.code})</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-gray-600">{stock.schoolLevel?.name ?? '—'}</TableCell>
                                <TableCell className="text-gray-600">{stock.class?.name ?? 'Tous'}</TableCell>
                                <TableCell className="text-right font-medium">{stock.quantityTotal}</TableCell>
                                <TableCell className="text-right text-green-600 font-medium">{stock.quantityAvailable}</TableCell>
                                <TableCell className="text-right text-orange-600">
                                  {stock.quantityTotal - stock.quantityAvailable}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Attributions ─────────────────────────────────────── */}
                <TabsContent value="assignments">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Attributions aux enseignants</CardTitle>
                          <CardDescription>
                            Matériel attribué pour l'année {academicYear?.name ?? '—'}
                          </CardDescription>
                        </div>
                        <Button
                          onClick={() => setShowCreateAssignment(true)}
                          disabled={!academicYear?.id || !schoolLevel?.id}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Nouvelle attribution
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {assignmentsError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {assignmentsError}
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Enseignant</TableHead>
                            <TableHead>Matériel</TableHead>
                            <TableHead>Quantité</TableHead>
                            <TableHead>État</TableHead>
                            <TableHead>Signature</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignmentsLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Chargement…
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : !academicYear?.id ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Sélectionnez une année scolaire.
                              </TableCell>
                            </TableRow>
                          ) : assignments.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Aucune attribution enregistrée
                              </TableCell>
                            </TableRow>
                          ) : (
                            assignments.map((assignment) => (
                              <TableRow key={assignment.id}>
                                <TableCell className="font-medium">
                                  {assignment.teacher
                                    ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  {assignment.material?.name ?? '—'}
                                  {assignment.material?.code && (
                                    <span className="ml-1 text-xs text-gray-400 font-mono">({assignment.material.code})</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{assignment.quantity}</TableCell>
                                <TableCell>
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                    {CONDITION_LABELS[assignment.conditionAtIssue] ?? assignment.conditionAtIssue}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {assignment.signed ? (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Signé</span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">En attente</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">{assignment.notes ?? '—'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── Mouvements ───────────────────────────────────────── */}
                <TabsContent value="movements">
                  <Card>
                    <CardHeader>
                      <CardTitle>Historique des mouvements</CardTitle>
                      <CardDescription>
                        Traçabilité complète des entrées, sorties et mouvements de stock
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {movementsError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          {movementsError}
                        </div>
                      )}
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Matériel</TableHead>
                            <TableHead className="text-right">Quantité</TableHead>
                            <TableHead>Par</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {movementsLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8">
                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Chargement…
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : !academicYear?.id ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Sélectionnez une année scolaire.
                              </TableCell>
                            </TableRow>
                          ) : movements.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                Aucun mouvement enregistré
                              </TableCell>
                            </TableRow>
                          ) : (
                            movements.map((mv) => (
                              <TableRow key={mv.id}>
                                <TableCell className="text-gray-600">
                                  {new Date(mv.createdAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })}
                                </TableCell>
                                <TableCell>
                                  <span
                                    className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                      mv.movementType === 'IN'
                                        ? 'bg-green-100 text-green-800'
                                        : mv.movementType === 'OUT'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    {MOVEMENT_TYPE_LABELS[mv.movementType] ?? mv.movementType}
                                  </span>
                                </TableCell>
                                <TableCell className="font-medium">{mv.material?.name ?? '—'}</TableCell>
                                <TableCell className="text-right font-medium">{mv.quantity}</TableCell>
                                <TableCell className="text-gray-600">
                                  {mv.performedBy
                                    ? `${mv.performedBy.firstName} ${mv.performedBy.lastName}`
                                    : '—'}
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">{mv.notes ?? '—'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          ),
        }}
      />
    </>
  );
}
