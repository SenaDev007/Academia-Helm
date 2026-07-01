'use client';

/**
 * ============================================================================
 * DOSSIERS ÉLÈVES — Fiche complète (identité, statut, guardian, documents)
 * ============================================================================
 * Selon MODULE ELEVES.md — Onglet 4
 * Enrichissements : avatar avec initiales, statut, NPI, guardians, 
 * bouton dossier PDF, recherche, grille de cartes responsive.
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import {
  User, Shield, Users, Mail, Phone, FileCheck, AlertCircle,
  Search, Loader2, Download, Eye, X,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StudentIdentity {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  globalMatricule?: string;
  npi?: string;
  gender?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  address?: string;
  status: string;
  isActive: boolean;
  photoUrl?: string;
  studentGuardians?: Array<{
    id: string;
    relationship: string;
    isPrimary: boolean;
    guardian: {
      id: string;
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      address?: string;
    };
  }>;
  studentEnrollments?: Array<{
    id: string;
    status: string;
    class?: { id: string; name: string };
    academicYear?: { id: string; name: string };
  }>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PRE_REGISTERED: { label: 'Pré-inscrit', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  ADMITTED: { label: 'Admis', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  ARCHIVED: { label: 'Archivé', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  WITHDRAWN: { label: 'Retiré', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function StudentIdentityContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [students, setStudents] = useState<StudentIdentity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentIdentity | null>(null);

  useEffect(() => {
    if (academicYear && schoolLevel) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = {
        academicYearId: academicYear?.id || '',
        schoolLevelId: schoolLevel?.id || '',
        includeGuardians: 'true',
      };
      const data = await studentsService.getAll(params);
      setStudents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.matricule || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.npi || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (s: StudentIdentity) => `${s.lastName?.[0] || ''}${s.firstName?.[0] || ''}`.toUpperCase();
  const getAge = (dob?: string) => {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Shield className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h3 className="font-semibold text-slate-900">Dossiers Élèves</h3>
            <p className="text-xs text-slate-500">{filteredStudents.length} élève(s) · {students.filter(s => s.npi).length} avec NPI</p>
          </div>
        </div>
        <div className="relative w-48 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <User className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">Aucun élève trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const statusInfo = STATUS_LABELS[student.status] || STATUS_LABELS.ACTIVE;
            const age = getAge(student.dateOfBirth);
            return (
              <div key={student.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                {/* Header carte */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
                    {getInitials(student)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{student.lastName.toUpperCase()} {student.firstName}</p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">{student.matricule || student.globalMatricule || 'Sans matricule'}</p>
                  </div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0', statusInfo.color)}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Body carte */}
                <div className="p-3 space-y-2.5">
                  {/* Infos identité */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {student.dateOfBirth && (
                      <div>
                        <p className="text-slate-400">Naissance</p>
                        <p className="font-medium text-slate-700">{new Date(student.dateOfBirth).toLocaleDateString('fr-FR')}{age ? ` (${age} ans)` : ''}</p>
                      </div>
                    )}
                    {student.gender && (
                      <div>
                        <p className="text-slate-400">Sexe</p>
                        <p className="font-medium text-slate-700">{student.gender === 'M' ? 'Masculin' : 'Féminin'}</p>
                      </div>
                    )}
                    {student.nationality && (
                      <div>
                        <p className="text-slate-400">Nationalité</p>
                        <p className="font-medium text-slate-700">{student.nationality}</p>
                      </div>
                    )}
                  </div>

                  {/* NPI */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1"><FileCheck className="w-3 h-3" /> NPI</span>
                    {student.npi ? (
                      <span className="font-mono font-medium text-emerald-600">{student.npi}</span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Non renseigné</span>
                    )}
                  </div>

                  {/* Classe actuelle */}
                  {student.studentEnrollments?.[0]?.class && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Classe</span>
                      <span className="font-medium text-slate-700">{student.studentEnrollments[0].class.name}</span>
                    </div>
                  )}

                  {/* Guardians */}
                  {student.studentGuardians && student.studentGuardians.length > 0 && (
                    <div className="pt-1 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Responsable(s)</p>
                      <div className="space-y-1">
                        {student.studentGuardians.slice(0, 2).map(sg => (
                          <div key={sg.id} className="flex items-center gap-2 text-xs">
                            <div className={cn('w-1.5 h-1.5 rounded-full', sg.isPrimary ? 'bg-blue-500' : 'bg-slate-300')} />
                            <span className="font-medium text-slate-700 truncate">{sg.guardian.firstName} {sg.guardian.lastName}</span>
                            {sg.guardian.phone && <span className="text-slate-400 text-[10px]">{sg.guardian.phone}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions footer */}
                <div className="p-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-1.5">
                  <button
                    onClick={() => setSelectedStudent(student)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Détails
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        if (!academicYear?.id) return;
                        await studentsService.downloadAcademicDossier(student.id, academicYear.id);
                      } catch {
                        toast({ title: 'Erreur', description: 'Téléchargement échoué', variant: 'error' });
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                  >
                    <Download className="w-3.5 h-3.5" /> Dossier PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal détail élève */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedStudent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-slate-200 flex items-center justify-center text-lg font-bold text-blue-600">
                    {getInitials(selectedStudent)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedStudent.lastName.toUpperCase()} {selectedStudent.firstName}</h3>
                    <p className="text-xs font-mono text-slate-400">{selectedStudent.matricule || selectedStudent.globalMatricule || 'Sans matricule'}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Identité */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Identité</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedStudent.dateOfBirth && (
                      <div><p className="text-slate-400 text-xs">Date de naissance</p><p className="font-medium text-slate-700">{new Date(selectedStudent.dateOfBirth).toLocaleDateString('fr-FR')}</p></div>
                    )}
                    {selectedStudent.placeOfBirth && (
                      <div><p className="text-slate-400 text-xs">Lieu de naissance</p><p className="font-medium text-slate-700">{selectedStudent.placeOfBirth}</p></div>
                    )}
                    {selectedStudent.gender && (
                      <div><p className="text-slate-400 text-xs">Sexe</p><p className="font-medium text-slate-700">{selectedStudent.gender === 'M' ? 'Masculin' : 'Féminin'}</p></div>
                    )}
                    {selectedStudent.nationality && (
                      <div><p className="text-slate-400 text-xs">Nationalité</p><p className="font-medium text-slate-700">{selectedStudent.nationality}</p></div>
                    )}
                    {selectedStudent.address && (
                      <div className="col-span-2"><p className="text-slate-400 text-xs">Adresse</p><p className="font-medium text-slate-700">{selectedStudent.address}</p></div>
                    )}
                    {selectedStudent.npi && (
                      <div><p className="text-slate-400 text-xs">NPI</p><p className="font-mono font-medium text-emerald-600">{selectedStudent.npi}</p></div>
                    )}
                  </div>
                </div>

                {/* Classe */}
                {selectedStudent.studentEnrollments?.[0]?.class && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Scolarité</h4>
                    <div className="bg-blue-50 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-blue-900">{selectedStudent.studentEnrollments[0].class.name}</p>
                      <p className="text-xs text-blue-600">{selectedStudent.studentEnrollments[0].academicYear?.name || academicYear?.name}</p>
                    </div>
                  </div>
                )}

                {/* Responsables */}
                {selectedStudent.studentGuardians && selectedStudent.studentGuardians.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Responsables légaux</h4>
                    <div className="space-y-2">
                      {selectedStudent.studentGuardians.map(sg => (
                        <div key={sg.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                            {sg.guardian.firstName?.[0]}{sg.guardian.lastName?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">{sg.guardian.firstName} {sg.guardian.lastName}</p>
                              {sg.isPrimary && <span className="text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">PRINCIPAL</span>}
                            </div>
                            <p className="text-[10px] text-slate-400 uppercase">{sg.relationship}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                              {sg.guardian.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {sg.guardian.phone}</span>}
                              {sg.guardian.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {sg.guardian.email}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
