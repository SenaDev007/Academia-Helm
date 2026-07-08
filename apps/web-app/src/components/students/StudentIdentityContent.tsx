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

import { useState, useEffect, useMemo } from 'react';
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
  const [allClasses, setAllClasses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentIdentity | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');

  useEffect(() => {
    if (academicYear && schoolLevel) loadData();
  }, [academicYear, schoolLevel]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [studentsData, classesData] = await Promise.all([
        studentsService.getAll({
          academicYearId: academicYear?.id || '',
          schoolLevelId: schoolLevel?.id || '',
          includeGuardians: 'true',
        }),
        fetch('/api/all-classes', { credentials: 'include' }).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setAllClasses(Array.isArray(classesData) ? classesData : []);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Construire un map classId → { name, schoolLevelId, schoolLevelName }
  const classMap = useMemo(() => {
    const m = new Map<string, { name: string; schoolLevelId: string; schoolLevelName: string }>();
    for (const c of allClasses) {
      m.set(c.id, {
        name: c.name,
        schoolLevelId: c.schoolLevelId || '',
        schoolLevelName: c.schoolLevel?.name || '',
      });
    }
    return m;
  }, [allClasses]);

  // Récupérer le niveau scolaire d'un élève depuis son enrollment
  const getStudentLevel = (s: StudentIdentity): string => {
    const enr = s.studentEnrollments?.find(e => e.class?.id);
    if (enr?.class?.id) {
      return classMap.get(enr.class.id)?.schoolLevelName || '';
    }
    return '';
  };

  // Récupérer le nom de la classe d'un élève
  const getStudentClassName = (s: StudentIdentity): string => {
    const enr = s.studentEnrollments?.find(e => e.class?.id);
    return enr?.class?.name || '';
  };

  // Récupérer le classId d'un élève
  const getStudentClassId = (s: StudentIdentity): string => {
    const enr = s.studentEnrollments?.find(e => e.class?.id);
    return enr?.class?.id || '';
  };

  // Filtrer par recherche + niveau + classe, puis trier par ordre alphabétique
  const filteredStudents = students.filter(s => {
    // Filtre recherche
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      if (!`${s.lastName} ${s.firstName}`.toLowerCase().includes(q) &&
          !(s.matricule || '').toLowerCase().includes(q) &&
          !(s.npi || '').toLowerCase().includes(q)) return false;
    }
    // Filtre niveau
    if (filterLevel !== 'ALL') {
      const level = getStudentLevel(s);
      if (!level.toUpperCase().includes(filterLevel)) return false;
    }
    // Filtre classe
    if (filterClass !== 'ALL') {
      if (getStudentClassId(s) !== filterClass) return false;
    }
    return true;
  }).sort((a, b) => {
    // Tri alphabétique par lastName puis firstName
    const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
    const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
    return nameA.localeCompare(nameB, 'fr');
  });

  // Grouper par niveau puis par classe
  const groupedStudents = useMemo(() => {
    const levelOrder = (name: string) => {
      const n = (name || '').toUpperCase();
      if (n.includes('MATERNELLE')) return 0;
      if (n.includes('PRIMAIRE')) return 1;
      if (n.includes('SECONDAIRE')) return 2;
      return 3;
    };
    const classOrder = (name: string): number => {
      const n = (name || '').trim().toUpperCase();
      if (n === 'MATERNELLE 1' || n === 'M1') return 0;
      if (n === 'MATERNELLE 2' || n === 'M2') return 1;
      if (n === 'CI') return 10;
      if (n === 'CP') return 11;
      if (n === 'CE1') return 12;
      if (n === 'CE2') return 13;
      if (n === 'CM1') return 14;
      if (n === 'CM2') return 15;
      if (n.startsWith('6')) return 20;
      if (n.startsWith('5')) return 21;
      if (n.startsWith('4')) return 22;
      if (n.startsWith('3')) return 23;
      if (n.startsWith('2NDE')) return 24;
      if (n.startsWith('1ER')) return 25;
      if (n.startsWith('TERM')) return 26;
      return 100 + (name || '').charCodeAt(0);
    };

    const groups = new Map<string, { levelName: string; classes: Map<string, { className: string; students: StudentIdentity[] }> }>();
    for (const s of filteredStudents) {
      const levelName = getStudentLevel(s) || 'Non affecté';
      const className = getStudentClassName(s) || 'Sans classe';
      const levelKey = levelName;
      if (!groups.has(levelKey)) groups.set(levelKey, { levelName, classes: new Map() });
      const levelGroup = groups.get(levelKey)!;
      if (!levelGroup.classes.has(className)) levelGroup.classes.set(className, { className, students: [] });
      levelGroup.classes.get(className)!.students.push(s);
    }

    return Array.from(groups.values())
      .sort((a, b) => levelOrder(a.levelName) - levelOrder(b.levelName))
      .map(g => ({
        ...g,
        classes: Array.from(g.classes.values()).sort((a, b) => classOrder(a.className) - classOrder(b.className)),
      }));
  }, [filteredStudents, classMap]);

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

      {/* Filtres par niveau et classe */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterLevel}
          onChange={(e) => { setFilterLevel(e.target.value); setFilterClass('ALL'); }}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Tous les niveaux</option>
          <option value="MATERNELLE">Maternelle</option>
          <option value="PRIMAIRE">Primaire</option>
          <option value="SECONDAIRE">Secondaire</option>
        </select>
        {filterLevel !== 'ALL' && (
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Toutes les classes</option>
            {allClasses
              .filter(c => {
                const levelName = (c.schoolLevel?.name || '').toUpperCase();
                return levelName.includes(filterLevel);
              })
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <User className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">Aucun élève trouvé</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedStudents.map((levelGroup) => (
            <div key={levelGroup.levelName}>
              {/* En-tête niveau */}
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{levelGroup.levelName}</h3>
                <span className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600">
                  {levelGroup.classes.reduce((acc, c) => acc + c.students.length, 0)} élève(s)
                </span>
              </div>
              {/* Classes dans ce niveau */}
              <div className="space-y-4">
                {levelGroup.classes.map((classGroup) => (
                  <div key={classGroup.className}>
                    <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                      <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                      {classGroup.className} · {classGroup.students.length} élève(s)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {classGroup.students.map((student) => {
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
                  </div>
                ))}
              </div>
            </div>
          ))}
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
