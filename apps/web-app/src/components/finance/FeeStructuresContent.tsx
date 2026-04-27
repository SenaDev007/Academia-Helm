'use client';

import { useState, useEffect } from 'react';
import { Plus, Copy, UserCog, Pencil, Trash2 } from 'lucide-react';
import {
  ModuleHeader,
  SubModuleNavigation,
  ModuleContentArea,
} from '@/components/modules/blueprint';
import { FINANCE_SUBMODULE_TABS } from '@/components/finance/finance-tabs';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import FeeStructureModal from './FeeStructureModal';
import FeeOverrideModal from './FeeOverrideModal';

const FEE_TYPES = [
  { value: 'INSCRIPTION', label: 'Inscription' },
  { value: 'REINSCRIPTION', label: 'Réinscription' },
  { value: 'TUITION', label: 'Scolarité' },
  { value: 'ANNEX', label: 'Annexe' },
  { value: 'EXCEPTIONAL', label: 'Exceptionnel' },
];

export default function FeeStructuresContent() {
  const { academicYear } = useModuleContext();
  const [structures, setStructures] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [modalNewFee, setModalNewFee] = useState(false);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [modalOverride, setModalOverride] = useState(false);
  const [copyYearModal, setCopyYearModal] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');

  const loadStructures = async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id });
      if (filterLevelId) params.set('levelId', filterLevelId);
      if (filterClassId) params.set('classId', filterClassId);
      const res = await fetch(`/api/finance/fee-structures?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStructures(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStructures();
  }, [academicYear?.id, filterLevelId, filterClassId]);

  useEffect(() => {
    fetch('/api/classes', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setClasses(Array.isArray(d) ? d : []));
    fetch('/api/school-levels', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setLevels(Array.isArray(d) ? d : []));
    fetch('/api/academic-years', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setAcademicYears(Array.isArray(d) ? d : []));
  }, []);

  const handleCreate = async (body: any) => {
    if (!academicYear?.id) return;
    try {
      const res = await fetch('/api/finance/fee-structures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...body, academicYearId: academicYear.id }),
      });
      if (res.ok) {
        setModalNewFee(false);
        loadStructures();
      } else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  };

  const handleUpdate = async (body: any) => {
    if (!editingFee?.id) return;
    try {
      const res = await fetch(`/api/finance/fee-structures/${editingFee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditingFee(null);
        loadStructures();
      } else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer ce frais ? Cette action est irréversible.')) return;
    try {
      const res = await fetch(`/api/finance/fee-structures/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok || res.status === 204) {
        loadStructures();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err?.message || err?.error || 'Erreur suppression');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  };

  const handleCopyToYear = async () => {
    if (!copyFrom || !copyTo) return;
    try {
      const res = await fetch('/api/finance/fee-structures/copy-to-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fromAcademicYearId: copyFrom, toAcademicYearId: copyTo }),
      });
      if (res.ok) {
        setCopyYearModal(false);
        setCopyFrom('');
        setCopyTo('');
        loadStructures();
      } else {
        const err = await res.json();
        alert(err?.message || err?.error || 'Erreur');
      }
    } catch (e) {
      alert('Erreur réseau');
    }
  };

  const subModuleTabs = FINANCE_SUBMODULE_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    path: t.path,
    icon: <t.icon className="w-4 h-4" />,
  }));

  const formatXOF = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n);
  const feeTypeLabel = (t: string) => FEE_TYPES.find((f) => f.value === t)?.label ?? t;

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Configuration des frais"
        description="Définissez les frais par niveau et classe. Priorité : Classe > Niveau > Override élève."
        icon="finance"
        actions={
          <>
            <Button onClick={() => setModalNewFee(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau frais
            </Button>
            <Button variant="outline" onClick={() => setCopyYearModal(true)}>
              <Copy className="w-4 h-4 mr-2" />
              Copier année précédente
            </Button>
            <Button variant="outline" onClick={() => setModalOverride(true)}>
              <UserCog className="w-4 h-4 mr-2" />
              Personnalisation élève
            </Button>
          </>
        }
      />
      <SubModuleNavigation tabs={subModuleTabs} currentPath="/app/finance/fees" />

      <ModuleContentArea layout="custom">
        <div className="mb-4 flex flex-wrap gap-4 items-center">
          <span className="text-sm text-gray-600">Année scolaire : {academicYear?.label ?? '—'}</span>
          <Select value={filterLevelId || 'ALL'} onValueChange={(v) => setFilterLevelId(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtre Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous niveaux</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.label ?? l.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterClassId || 'ALL'} onValueChange={(v) => setFilterClassId(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtre Classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom du frais</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Tranches</TableHead>
              <TableHead>Oblig.</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Chargement...</TableCell></TableRow>
            ) : structures.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Aucun frais configuré.</TableCell></TableRow>
            ) : (
              structures.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{feeTypeLabel(s.feeType)}</TableCell>
                  <TableCell>{formatXOF(Number(s.totalAmount))}</TableCell>
                  <TableCell>{s.isInstallment ? 'Oui' : 'Non'}</TableCell>
                  <TableCell><Badge variant={s.isMandatory ? 'default' : 'outline'}>{s.isMandatory ? 'Oui' : 'Non'}</Badge></TableCell>
                  <TableCell><Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Actif' : 'Inactif'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditingFee(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ModuleContentArea>

      {modalNewFee && (
        <FeeStructureModal
          academicYearId={academicYear?.id ?? ''}
          levels={levels}
          classes={classes}
          onClose={() => setModalNewFee(false)}
          onSubmit={handleCreate}
        />
      )}
      {editingFee && (
        <FeeStructureModal
          academicYearId={academicYear?.id ?? ''}
          levels={levels}
          classes={classes}
          feeId={editingFee.id}
          initialData={editingFee}
          onClose={() => setEditingFee(null)}
          onSubmit={handleUpdate}
        />
      )}
      {modalOverride && (
        <FeeOverrideModal
          structures={structures}
          onClose={() => setModalOverride(false)}
        />
      )}
      {copyYearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Copier vers nouvelle année</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">Année source</label>
              <Select value={copyFrom || 'NONE'} onValueChange={(v) => setCopyFrom(v === 'NONE' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'année source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— Choisir —</SelectItem>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Année cible</label>
              <Select value={copyTo || 'NONE'} onValueChange={(v) => setCopyTo(v === 'NONE' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'année cible" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— Choisir —</SelectItem>
                  {academicYears.map((y) => (
                    <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setCopyYearModal(false); setCopyFrom(''); setCopyTo(''); }}>Annuler</Button>
              <Button onClick={handleCopyToYear} disabled={!copyFrom || !copyTo || copyFrom === copyTo}>Copier</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
