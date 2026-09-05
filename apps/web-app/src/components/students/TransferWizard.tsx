/**
 * ============================================================================
 * TRANSFER WIZARD — Assistant de création de transfert inter-écoles
 * ============================================================================
 *
 * 4 étapes : Sélection élève → École destination → Motif → Confirmation
 * Connecté au backend /api/students/transfers (createTransferRequest)
 * Design cohérent avec les autres modales de l'application.
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X, Search, User, Building2, CheckCircle2, Loader2,
  ChevronRight, ChevronLeft, Send, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { studentsService } from '@/services/students.service';
import { useModuleContext } from '@/hooks/useModuleContext';
import { toast } from '@/components/ui/toast';

interface TransferWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  globalStudentId?: string | null;
  photoUrl?: string | null;
  status: string;
  schoolLevel?: { name: string; code?: string };
}

interface SchoolItem {
  id: string;
  name: string;
  city?: string | null;
  slug?: string;
  logo?: string | null;
  schools?: Array<{ city?: string | null; address?: string | null }>;
}

export default function TransferWizard({ isOpen, onClose }: TransferWizardProps) {
  const { academicYear } = useModuleContext();
  const [step, setStep] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolItem | null>(null);
  const [transferMotif, setTransferMotif] = useState('');
  const [transferMessage, setTransferMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recherche élèves
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  // ⭐ Filtres niveau + classe (comme dans AdmissionsContent/EnrollmentsContent)
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [schoolLevels, setSchoolLevels] = useState<any[]>([]);
  const [allClasses, setAllClasses] = useState<any[]>([]);

  // Recherche écoles
  const [schoolSearch, setSchoolSearch] = useState('');
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);

  // ⭐ Charger les niveaux scolaires depuis /api/school-levels (comme AdmissionsContent)
  useEffect(() => {
    fetch('/api/school-levels', { credentials: 'include' })
      .then(res => res.ok ? res.json() : [])
      .then(data => setSchoolLevels(Array.isArray(data) ? data : []))
      .catch(() => setSchoolLevels([]));
  }, []);

  // ⭐ Charger les classes physiques depuis /api/all-classes (comme les autres onglets)
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setAllClasses(Array.isArray(data) ? data : []))
      .catch(() => setAllClasses([]));
  }, []);

  // Charger les élèves actifs
  const loadStudents = useCallback(async (query: string, levelId?: string, classId?: string) => {
    if (!academicYear?.id) return;
    setIsLoadingStudents(true);
    try {
      const params: Record<string, string> = {
        academicYearId: academicYear.id,
        limit: '200',
      };
      if (query) params.search = query;

      // ⭐ Récupérer le schoolLevelId (UUID de school_levels) pour filtrer côté backend.
      // /api/school-levels retourne { id: education_levels UUID, schoolLevelId: school_levels UUID }
      // Si schoolLevelId est null (classes non chargées), on utilise l'id directement.
      if (levelId) {
        const level = schoolLevels.find(l => l.id === levelId);
        const effectiveSchoolLevelId = level?.schoolLevelId || levelId;
        params.schoolLevelId = effectiveSchoolLevelId;
      }

      const data = await studentsService.getAll(params);
      let list = Array.isArray(data) ? data : (data?.data || []);

      // Filtrer uniquement les élèves actifs (transférables)
      list = list.filter((s: any) => s.status === 'ACTIVE' && s.isActive !== false);

      // ⭐ Si le filtre backend n'a pas marché (schoolLevelId null),
      // filtrer côté client par le code du niveau
      if (levelId && list.length === 0) {
        // Récupérer le code du niveau sélectionné
        const level = schoolLevels.find(l => l.id === levelId);
        const levelCode = level?.code?.toUpperCase() || '';
        if (levelCode) {
          // Refaire la requête sans schoolLevelId et filtrer côté client
          const params2: Record<string, string> = {
            academicYearId: academicYear.id,
            limit: '200',
          };
          if (query) params2.search = query;
          const data2 = await studentsService.getAll(params2);
          let list2 = Array.isArray(data2) ? data2 : (data2?.data || []);
          list2 = list2.filter((s: any) => {
            if (s.status !== 'ACTIVE' || s.isActive === false) return false;
            // Filtrer par le code du schoolLevel
            const studentLevelCode = (s.schoolLevel?.code || '').toUpperCase();
            return studentLevelCode === levelCode;
          });
          list = list2;
        }
      }

      // ⭐ Filtrer par classe si sélectionnée (côté client)
      if (classId) {
        list = list.filter((s: any) => {
          return s.studentEnrollments?.some((e: any) => e.classId === classId)
            || s.classId === classId;
        });
      }
      setStudents(list);
    } catch (e: any) {
      console.error('Failed to load students:', e);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [academicYear?.id, schoolLevels]);

  // Charger les écoles destinataires
  const loadSchools = useCallback(async (query: string) => {
    setIsLoadingSchools(true);
    try {
      const data = await studentsService.searchSchoolsForTransfer(query || '');
      let schoolsList = Array.isArray(data) ? data : [];
      // ⭐ Exclure l'école tenante (celle qui initie le transfert) de la liste
      const currentTenantId = localStorage.getItem('tenantId') || '';
      if (currentTenantId) {
        schoolsList = schoolsList.filter((s: any) => s.id !== currentTenantId);
      }
      setSchools(schoolsList);
    } catch (e: any) {
      console.error('Failed to load schools:', e);
      setSchools([]);
    } finally {
      setIsLoadingSchools(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && step === 1) {
      loadStudents(studentSearch, filterLevelId, filterClassId);
    }
  }, [isOpen, step, studentSearch, filterLevelId, filterClassId, loadStudents]);

  useEffect(() => {
    if (isOpen && step === 2) {
      loadSchools(schoolSearch);
    }
  }, [isOpen, step, schoolSearch, loadSchools]);

  // Reset quand on ferme
  const handleClose = () => {
    setStep(1);
    setSelectedStudent(null);
    setSelectedSchool(null);
    setTransferMotif('');
    setTransferMessage('');
    setStudentSearch('');
    setSchoolSearch('');
    setFilterLevelId('');
    setFilterClassId('');
    onClose();
  };

  // Soumettre le transfert
  const handleSubmit = async () => {
    if (!selectedStudent || !selectedSchool || !academicYear?.id) return;
    setIsSubmitting(true);
    try {
      await studentsService.createTransferRequest({
        studentId: selectedStudent.id,
        targetSchoolId: selectedSchool.id,
        academicYearId: academicYear.id,
        motif: transferMotif || undefined,
        message: transferMessage || undefined,
      });
      toast({
        title: '✅ Demande de transfert envoyée',
        description: `${selectedStudent.firstName} ${selectedStudent.lastName} → ${selectedSchool.name}. L'école destination a été notifiée.`,
        variant: 'success',
      });
      handleClose();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e.message || 'Échec de la demande de transfert',
        variant: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const canNext = step === 1 ? !!selectedStudent
    : step === 2 ? !!selectedSchool
    : step === 3 ? true
    : false;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Initier un transfert inter-écoles</h3>
            <p className="text-xs text-slate-500 mt-0.5">Étape {step} sur 4</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 bg-white">
          {[
            { n: 1, label: 'Élève' },
            { n: 2, label: 'École' },
            { n: 3, label: 'Motif' },
            { n: 4, label: 'Confirmation' },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition',
                step === s.n ? 'border-blue-600 bg-blue-600 text-white'
                : step > s.n ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-200 text-slate-400'
              )}>
                {step > s.n ? <CheckCircle2 className="w-4 h-4" /> : s.n}
              </div>
              <span className={cn('text-xs font-semibold', step === s.n ? 'text-blue-700' : 'text-slate-400')}>
                {s.label}
              </span>
              {i < 3 && <div className={cn('flex-1 h-0.5 rounded-full', step > s.n ? 'bg-emerald-400' : 'bg-slate-100')} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Étape 1 : Sélection élève */}
          {step === 1 && (
            <div className="space-y-3">
              {/* ⭐ Filtres niveau + classe + recherche (comme dans AdmissionsContent) */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-2">
                <select
                  value={filterLevelId}
                  onChange={(e) => { setFilterLevelId(e.target.value); setFilterClassId(''); }}
                  className="border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les niveaux</option>
                  {schoolLevels.map(l => (
                    <option key={l.id} value={l.id}>{l.label || l.name || l.code}</option>
                  ))}
                </select>
                <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  disabled={!filterLevelId}
                  className="border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Toutes les classes</option>
                  {(() => {
                    // ⭐ Filtrer les classes par niveau (comme AdmissionsContent)
                    const selectedLevel = schoolLevels.find(l => l.id === filterLevelId);
                    const levelCode = selectedLevel?.code?.toUpperCase() || '';
                    const levelName = selectedLevel?.name?.toUpperCase() || '';
                    return allClasses
                      .filter(c => {
                        if (!filterLevelId) return true;
                        const classLevelName = (c.schoolLevel?.name || '').toUpperCase();
                        const classLevelCode = (c.schoolLevel?.code || '').toUpperCase();
                        return classLevelName === levelName ||
                               classLevelCode === levelCode ||
                               classLevelName.includes(levelCode) ||
                               levelCode.includes(classLevelName);
                      })
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ));
                  })()}
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Rechercher par nom..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {isLoadingStudents ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
              ) : students.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Aucun élève actif trouvé</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {students.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudent(s)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition',
                        selectedStudent?.id === s.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-blue-200'
                      )}
                    >
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                        {s.photoUrl ? <img src={s.photoUrl} alt="" className="w-full h-full object-cover" /> : `${s.lastName?.[0] || ''}${s.firstName?.[0] || ''}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{s.lastName} {s.firstName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{s.matricule || s.globalStudentId || '—'}</p>
                      </div>
                      {s.schoolLevel && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{s.schoolLevel.name}</span>
                      )}
                      {selectedStudent?.id === s.id && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Étape 2 : Sélection école destination */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  placeholder="Rechercher une école dans le réseau..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {isLoadingSchools ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin" /></div>
              ) : schools.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Aucune école trouvée. Essayez une autre recherche.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {schools.map(sc => {
                    // ⭐ Récupérer le logo et la ville depuis la relation schools
                    const schoolInfo = sc.schools?.[0] || {};
                    const city = schoolInfo.city || '—';
                    const logo = schoolInfo.logo || null;
                    return (
                    <button
                      key={sc.id}
                      onClick={() => setSelectedSchool(sc)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition',
                        selectedSchool?.id === sc.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-slate-200 hover:border-blue-200'
                      )}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-indigo-50 flex items-center justify-center shrink-0">
                        {logo ? (
                          <img src={logo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{sc.name}</p>
                        {city !== '—' && <p className="text-[10px] text-slate-400">{city}</p>}
                      </div>
                      {selectedSchool?.id === sc.id && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Étape 3 : Motif et message */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motif du transfert</label>
                <input
                  type="text"
                  value={transferMotif}
                  onChange={(e) => setTransferMotif(e.target.value)}
                  placeholder="Ex : Déménagement, changement de spécialité..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message à l'école destination (optionnel)</label>
                <textarea
                  value={transferMessage}
                  onChange={(e) => setTransferMessage(e.target.value)}
                  placeholder="Informations complémentaires..."
                  rows={4}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Étape 4 : Confirmation */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-800">
                  <p className="font-bold">Récapitulatif du transfert</p>
                  <p className="mt-1">Une fois validé, l'école destination recevra une notification et pourra accepter ou rejeter la demande.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Élève</p>
                  <p className="font-semibold text-slate-800">{selectedStudent?.lastName} {selectedStudent?.firstName}</p>
                  {/* ⭐ Afficher le matricule seulement s'il est lisible (pas un UUID/globalStudentId) */}
                  {selectedStudent?.matricule && !selectedStudent.matricule.startsWith('AH-') && (
                    <p className="text-[10px] text-slate-400 font-mono">{selectedStudent.matricule}</p>
                  )}
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">École destination</p>
                  <p className="font-semibold text-slate-800">{selectedSchool?.name}</p>
                  {selectedSchool?.city && selectedSchool.city !== '—' && (
                    <p className="text-[10px] text-slate-400">{selectedSchool.city}</p>
                  )}
                </div>
                {transferMotif && (
                  <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Motif</p>
                    <p className="text-sm text-slate-700">{transferMotif}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            <ChevronLeft className="w-4 h-4" />
            {step > 1 ? 'Précédent' : 'Annuler'}
          </button>
          {step < 4 ? (
            <button
              onClick={() => canNext && setStep(step + 1)}
              disabled={!canNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSubmitting ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
