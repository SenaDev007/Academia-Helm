'use client';

/**
 * ============================================================================
 * FAMILLES & RESPONSABLES LÉGAUX — CRUD guardian
 * ============================================================================
 * Selon MODULE ELEVES.md — Onglet 5
 * Enrichissements : add/edit/delete guardian, marquer principal, 
 * recherche par élève ou parent, stats réelles.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Mail, Phone, Star, Heart, Loader2, User,
  Edit2, Trash2, X, Check, Shield,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { apiFetch } from '@/lib/api/client';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Guardian {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  relationship: string;
}

interface StudentGuardian {
  id: string;
  relationship: string;
  isPrimary: boolean;
  guardian: Guardian;
}

interface StudentWithGuardians {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  studentGuardians: StudentGuardian[];
}

interface GuardianForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  relationship: string;
  isPrimary: boolean;
}

const RELATIONSHIPS = ['PÈRE', 'MÈRE', 'TUTEUR', 'ONCLE', 'TANTE', 'GRAND_PARENT', 'FRÈRE', 'SŒUR', 'AUTRE'];

export default function StudentFamiliesContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentWithGuardians[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentWithGuardians | null>(null);
  const [guardianForm, setGuardianForm] = useState<GuardianForm | null>(null);
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (academicYear && schoolLevel) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await studentsService.getAll({
        academicYearId: academicYear?.id || '',
        schoolLevelId: schoolLevel?.id || '',
        includeGuardians: 'true',
      });
      setStudents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentGuardians.some(sg =>
      `${sg.guardian.firstName} ${sg.guardian.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sg.guardian.phone || '').includes(searchTerm)
    )
  );

  const totalGuardians = students.reduce((sum, s) => sum + s.studentGuardians.length, 0);
  const studentsWithPrimary = students.filter(s => s.studentGuardians.some(sg => sg.isPrimary)).length;
  const studentsWithoutGuardian = students.filter(s => s.studentGuardians.length === 0).length;

  const openAddGuardian = (student: StudentWithGuardians) => {
    setEditingStudent(student);
    setEditingGuardianId(null);
    setGuardianForm({ firstName: '', lastName: '', phone: '', email: '', relationship: 'PÈRE', isPrimary: false });
  };

  const openEditGuardian = (student: StudentWithGuardians, sg: StudentGuardian) => {
    setEditingStudent(student);
    setEditingGuardianId(sg.id);
    setGuardianForm({
      firstName: sg.guardian.firstName,
      lastName: sg.guardian.lastName,
      phone: sg.guardian.phone || '',
      email: sg.guardian.email || '',
      relationship: sg.relationship,
      isPrimary: sg.isPrimary,
    });
  };

  const saveGuardian = async () => {
    if (!editingStudent || !guardianForm) return;
    if (!guardianForm.firstName.trim() || !guardianForm.lastName.trim()) {
      toast({ title: 'Champs requis', description: 'Prénom et nom du responsable sont obligatoires', variant: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      if (editingGuardianId) {
        // Update
        await apiFetch(`/students/${editingStudent.id}/guardians/${editingGuardianId}`, {
          method: 'PUT',
          body: JSON.stringify(guardianForm),
        });
        toast({ title: '✅ Responsable modifié', variant: 'success' });
      } else {
        // Create
        await studentsService.addGuardians(editingStudent.id, {
          guardians: [guardianForm],
        });
        toast({ title: '✅ Responsable ajouté', variant: 'success' });
      }
      setGuardianForm(null);
      setEditingStudent(null);
      setEditingGuardianId(null);
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteGuardian = async (studentId: string, guardianId: string) => {
    if (!confirm('Supprimer ce responsable ?')) return;
    try {
      await apiFetch(`/students/${studentId}/guardians/${guardianId}`, { method: 'DELETE' });
      toast({ title: '✅ Responsable supprimé', variant: 'success' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-50"><Users className="w-4 h-4 text-blue-600" /></div>
          <div><p className="text-[10px] font-medium text-slate-500 uppercase">Familles</p><p className="text-base font-bold text-slate-900">{students.length}</p></div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50"><Shield className="w-4 h-4 text-emerald-600" /></div>
          <div><p className="text-[10px] font-medium text-slate-500 uppercase">Responsables</p><p className="text-base font-bold text-slate-900">{totalGuardians}</p></div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-50"><Star className="w-4 h-4 text-amber-600" /></div>
          <div><p className="text-[10px] font-medium text-slate-500 uppercase">Principaux</p><p className="text-base font-bold text-slate-900">{studentsWithPrimary}</p></div>
        </div>
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-50"><Heart className="w-4 h-4 text-rose-600" /></div>
          <div><p className="text-[10px] font-medium text-slate-500 uppercase">Sans parent</p><p className="text-base font-bold text-slate-900">{studentsWithoutGuardian}</p></div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" placeholder="Rechercher par élève ou parent..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <Users className="w-12 h-12 mb-3 opacity-20" /><p className="text-sm">Aucune famille trouvée</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => (
            <div key={student.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="w-4 h-4 text-blue-600" /></div>
                  <span className="text-xs font-bold text-slate-500 uppercase">Famille {student.lastName}</span>
                </div>
                <button onClick={() => openAddGuardian(student)} className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition" title="Ajouter un responsable">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 flex-1 space-y-2">
                {/* Enfant */}
                <div className="flex items-center gap-2 p-2 rounded-lg border border-blue-50 bg-blue-50/30">
                  <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center text-blue-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-900 truncate">{student.firstName} {student.lastName}</p>
                    <p className="text-[9px] text-blue-400">{student.matricule || 'Sans matricule'}</p>
                  </div>
                </div>
                {/* Guardians */}
                {student.studentGuardians.map(sg => (
                  <div key={sg.id} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50/50 border border-slate-100 group">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                      {sg.guardian.firstName?.[0]}{sg.guardian.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{sg.guardian.firstName} {sg.guardian.lastName}</p>
                        {sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">PRINCIPAL</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {sg.guardian.phone && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{sg.guardian.phone}</span>}
                        {sg.guardian.email && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{sg.guardian.email}</span>}
                      </div>
                      <p className="text-[8px] text-slate-300 uppercase mt-0.5">{sg.relationship}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button onClick={() => openEditGuardian(student, sg)} className="p-1 hover:bg-blue-100 rounded text-blue-600" title="Modifier"><Edit2 className="w-3 h-3" /></button>
                      <button onClick={() => deleteGuardian(student.id, sg.id)} className="p-1 hover:bg-rose-100 rounded text-rose-600" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {student.studentGuardians.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-2">Aucun responsable — cliquez sur +</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Add/Edit Guardian */}
      <AnimatePresence>
        {guardianForm && editingStudent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setGuardianForm(null); setEditingStudent(null); }}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-800">
                  {editingGuardianId ? 'Modifier le responsable' : 'Ajouter un responsable'}
                </h3>
                <button onClick={() => { setGuardianForm(null); setEditingStudent(null); }} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-xs text-slate-500">Pour : <strong>{editingStudent.firstName} {editingStudent.lastName}</strong></p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
                    <input type="text" value={guardianForm.firstName} onChange={e => setGuardianForm({ ...guardianForm, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                    <input type="text" value={guardianForm.lastName} onChange={e => setGuardianForm({ ...guardianForm, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone</label>
                    <input type="tel" value={guardianForm.phone} onChange={e => setGuardianForm({ ...guardianForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                    <input type="email" value={guardianForm.email} onChange={e => setGuardianForm({ ...guardianForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lien</label>
                    <select value={guardianForm.relationship} onChange={e => setGuardianForm({ ...guardianForm, relationship: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={guardianForm.isPrimary} onChange={e => setGuardianForm({ ...guardianForm, isPrimary: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span className="text-xs font-semibold text-slate-700">Responsable principal</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 bg-slate-50 flex justify-end gap-2">
                <button onClick={() => { setGuardianForm(null); setEditingStudent(null); }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition">Annuler</button>
                <button onClick={saveGuardian} disabled={isSaving}
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                  {isSaving ? 'Enregistrement...' : <span className="flex items-center gap-1.5"><Check className="w-4 h-4" /> Enregistrer</span>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
