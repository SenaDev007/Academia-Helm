'use client';

/**
 * ============================================================================
 * DISTINCTION / TABLEAU D'HONNEUR — Module Examen
 * ============================================================================
 *
 * Boutons par élève : générer certificat individuel + envoyer par email
 * Bouton global : générer le tableau collectif
 * Bouton envoyer global : envoyer tous les certificats par email aux parents
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Award, Loader2, Download, Users, Trophy, Medal, Mail, Send,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import apiClient from '@/lib/api/client';
import { EXAMS_SUB_MODULES } from '@/app/app/exams/sub-modules';
import { useExamSubModules, useExamScope } from '@/app/app/exams/layout';
import { filterClassesForLevel } from '@/app/app/exams/level-isolation';
import { cn } from '@/lib/utils';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const PEDAGOGICAL_ORDER = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2', '6E', '5E', '4E', '3E', '2NDE', '1ERE', 'TERM'];
const pedagogicalSortIndex = (name: string): number => {
  const upper = (name || '').toUpperCase().trim();
  for (let i = 0; i < PEDAGOGICAL_ORDER.length; i++) {
    if (upper.startsWith(PEDAGOGICAL_ORDER[i])) return i;
  }
  return PEDAGOGICAL_ORDER.length;
};

interface DistinctionStudent {
  id: string;
  name: string;
  matricule: string;
  average: number | null;
  rank: number | null;
  distinction: string | null;
  distinctionLabel: string | null;
  distinctionCode: string | null;
}

export default function DistinctionWorkspace() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const { language: scopeLang, levelCode: scopeLevel } = useExamScope();
  const isMaternelle = scopeLevel === 'MATERNELLE';
  const isSecondaire = scopeLevel === 'SECONDAIRE';

  const activeLevel = useMemo(() => {
    if (!scopeLevel) return null;
    return (availableLevels || []).find((l: any) => (l.code || '').toUpperCase() === scopeLevel && l.id !== 'ALL');
  }, [availableLevels, scopeLevel]);
  const schoolLevelUuid = activeLevel?.schoolLevelId || activeLevel?.id;

  const [classes, setClasses] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [students, setStudents] = useState<DistinctionStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingBoard, setGeneratingBoard] = useState(false);
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const subModules = useExamSubModules(EXAMS_SUB_MODULES);

  useEffect(() => {
    if (!academicYear?.id || !schoolLevelUuid) return;
    (async () => {
      try {
        const res = await fetch(`/api/all-classes?academicYearId=${academicYear.id}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const all = Array.isArray(data) ? data : [];
          const filtered = filterClassesForLevel(all, schoolLevelUuid, scopeLang);
          filtered.sort((a: any, b: any) => {
            const idxA = pedagogicalSortIndex(a.name);
            const idxB = pedagogicalSortIndex(b.name);
            return idxA !== idxB ? idxA - idxB : (a.name || '').localeCompare(b.name || '', 'fr');
          });
          setClasses(filtered);
          if (filtered.length > 0 && !selectedClassId) setSelectedClassId(filtered[0].id);
        }
      } catch { setClasses([]); }
    })();
  }, [academicYear?.id, schoolLevelUuid, scopeLang]);

  useEffect(() => {
    if (!academicYear?.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/settings/academic-years/${academicYear.id}/periods`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : (data?.items || []);
          setPeriods(list);
          if (list.length > 0) setSelectedPeriodId(list[0].id);
        }
      } catch { setPeriods([]); }
    })();
  }, [academicYear?.id]);

  const loadData = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || !academicYear?.id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(`/exams/promotion/class/${encodeURIComponent(selectedClassId)}`, {
        params: { academicYearId: academicYear.id },
      });
      const data = response.data;
      const base = isMaternelle ? 3 : 20;
      const list: DistinctionStudent[] = Array.isArray(data) ? data.map((s: any) => {
        let distinctionLabel: string | null = null;
        let distinctionCode: string | null = null;
        if (s.generalAverage !== null) {
          const pct = (s.generalAverage / base) * 100;
          if (isMaternelle) {
            if (pct >= 90) { distinctionLabel = "Étoile d'Or"; distinctionCode = 'MAT_OR'; }
            else if (pct >= 75) { distinctionLabel = "Étoile d'Argent"; distinctionCode = 'MAT_ARGENT'; }
            else if (pct >= 60) { distinctionLabel = 'Étoile de Bronze'; distinctionCode = 'MAT_BRONZE'; }
            else { distinctionLabel = 'Petit Explorateur'; distinctionCode = 'MAT_EXPLO'; }
          } else if (isSecondaire) {
            if (pct >= 80) { distinctionLabel = 'Félicitations'; distinctionCode = 'SEC_FELIC'; }
            else if (pct >= 70) { distinctionLabel = 'Encouragements'; distinctionCode = 'SEC_ENCOU'; }
            else if (pct >= 60) { distinctionLabel = 'Honneur'; distinctionCode = 'SEC_HONNEUR'; }
          } else {
            if (pct >= 80) { distinctionLabel = 'Félicitations'; distinctionCode = 'PRI_FELIC'; }
            else if (pct >= 70) { distinctionLabel = 'Encouragements'; distinctionCode = 'PRI_ENCOU'; }
            else if (pct >= 60) { distinctionLabel = 'Honneur'; distinctionCode = 'PRI_HONNEUR'; }
            else if (pct >= 50) { distinctionLabel = 'Courage'; distinctionCode = 'PRI_COURAGE'; }
          }
        }
        return {
          id: s.id,
          name: s.name,
          matricule: s.matricule || '',
          average: s.generalAverage,
          rank: null,
          distinction: distinctionLabel ? 'AWARDED' : null,
          distinctionLabel,
          distinctionCode,
        };
      }) : [];

      const sorted = [...list].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
      sorted.forEach((s, i) => { s.rank = i + 1; });
      setStudents(sorted);
    } catch (err) {
      console.error('Distinction load error:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, academicYear?.id, isMaternelle, isSecondaire]);

  useEffect(() => { loadData(); }, [loadData]);

  const awardedStudents = useMemo(() => students.filter(s => s.distinctionLabel !== null), [students]);
  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';

  // Générer le tableau collectif
  const handleGenerateBoard = async () => {
    if (!selectedClassId || !selectedPeriodId) return;
    setGeneratingBoard(true);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/generate-board', {
        classId: selectedClassId,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
      }, { responseType: 'blob', timeout: 120000 });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeClass = selectedClassName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `tableau_honneur_${safeClass}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingBoard(false);
    }
  };

  // Générer un certificat individuel
  const handleGenerateCertificate = async (student: DistinctionStudent) => {
    if (!student.distinctionCode) return;
    setGeneratingCert(student.id);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/generate-certificate', {
        studentId: student.id,
        studentName: student.name,
        classId: selectedClassId,
        className: selectedClassName,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
        code: student.distinctionCode,
        average: student.average,
        rank: student.rank,
        classSize: students.length,
      }, { responseType: 'blob', timeout: 120000 });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = student.name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `certificat_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Erreur: ' + (err.response?.data?.message || err.message));
    } finally {
      setGeneratingCert(null);
    }
  };

  // Envoyer le certificat par email au parent
  const handleSendCertificate = async (student: DistinctionStudent) => {
    if (!student.distinctionCode) return;
    setSending(student.id);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/send-certificate', {
        studentId: student.id,
        studentName: student.name,
        classId: selectedClassId,
        className: selectedClassName,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
        code: student.distinctionCode,
        average: student.average,
        rank: student.rank,
        classSize: students.length,
        distinctionLabel: student.distinctionLabel,
      }, { timeout: 120000 });
      const results = response.data?.results || {};
      const parts = [];
      if (results.email === 'sent') parts.push('✅ Email envoyé');
      else if (results.email) parts.push(`❌ Email: ${results.email}`);
      else parts.push('⚠️ Pas d\'email parent');
      if (results.helmConnect === 'sent') parts.push('✅ Helm Connect');
      else if (results.helmConnect) parts.push(`❌ Helm Connect: ${results.helmConnect}`);
      if (results.bellIcon === 'sent') parts.push('✅ Notification parent');
      else if (results.bellIcon) parts.push(`❌ Notification: ${results.bellIcon}`);
      alert(`Certificat de ${student.name} envoyé !\n\n${parts.join('\n')}`);
    } catch (err: any) {
      alert('Erreur envoi: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(null);
    }
  };

  // Envoyer tous les certificats
  const handleSendAll = async () => {
    if (awardedStudents.length === 0) return;
    if (!confirm(`Envoyer ${awardedStudents.length} certificats par email aux parents ?`)) return;
    setSending('ALL');
    try {
      let sent = 0;
      let failed = 0;
      for (const student of awardedStudents) {
        try {
          await apiClient.post('/institutional-exams/distinctions/send-certificate', {
            studentId: student.id,
            studentName: student.name,
            classId: selectedClassId,
            className: selectedClassName,
            periodId: selectedPeriodId,
            academicYearId: academicYear?.id,
            level: scopeLevel || 'PRIMAIRE',
            code: student.distinctionCode,
            average: student.average,
            rank: student.rank,
            classSize: students.length,
            distinctionLabel: student.distinctionLabel,
          }, { timeout: 120000 });
          sent++;
        } catch {
          failed++;
        }
      }
      alert(`Envoi terminé !\n\n✅ Envoyés : ${sent}\n❌ Échoués : ${failed}`);
    } catch (err: any) {
      alert('Erreur envoi: ' + err.message);
    } finally {
      setSending(null);
    }
  };

  const levelLabel = isMaternelle ? 'Maternelle' : isSecondaire ? 'Secondaire' : 'Primaire';

  return (
    <ModuleContainer
      header={{ title: 'Distinction — Tableau d\'honneur', description: `Distinctions et certificats — Niveau ${levelLabel}`, icon: 'award' }}
      subModules={{ modules: subModules, activeModuleId: 'distinction' }}
      content={{
        layout: 'full',
        children: (
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Classe</label>
              <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[200px]">
                <option value="">— Sélectionner une classe —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Période</label>
              <select value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg min-w-[200px]">
                <option value="">— Sélectionner —</option>
                {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex-1" />
            <Button onClick={handleGenerateBoard} disabled={generatingBoard || awardedStudents.length === 0} className="bg-amber-600 hover:bg-amber-700 text-white">
              {generatingBoard ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {generatingBoard ? 'Génération…' : 'Générer tableau d\'honneur'}
            </Button>
            <Button onClick={handleSendAll} disabled={sending === 'ALL' || awardedStudents.length === 0} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
              {sending === 'ALL' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Envoyer tous ({awardedStudents.length})
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
            Aucune donnée disponible. Les évaluations doivent être validées pour calculer les moyennes.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <Trophy className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{awardedStudents.length}</p>
                <p className="text-xs text-amber-600 font-medium">Distinctions</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                <Users className="w-5 h-5 text-slate-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-slate-700">{students.length}</p>
                <p className="text-xs text-slate-600 font-medium">Élèves</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                <Medal className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-blue-700">{students.filter(s => s.average !== null).length}</p>
                <p className="text-xs text-blue-600 font-medium">Avec notes</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-amber-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Tableau d'honneur — {selectedClassName}
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="text-xs">Rang</TableHead>
                    <TableHead className="text-xs">Matricule</TableHead>
                    <TableHead className="text-xs">Nom</TableHead>
                    <TableHead className="text-xs text-center">Moyenne</TableHead>
                    <TableHead className="text-xs text-center">Distinction</TableHead>
                    <TableHead className="text-xs text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((st, idx) => (
                    <TableRow key={st.id} className={cn(
                      idx % 2 === 1 && 'bg-slate-50/60',
                      st.distinctionLabel && 'bg-amber-50/50',
                    )}>
                      <TableCell className="text-xs font-bold">
                        {st.rank === 1 ? <Trophy className="w-4 h-4 text-amber-500" /> :
                         st.rank === 2 ? <Medal className="w-4 h-4 text-slate-400" /> :
                         st.rank === 3 ? <Award className="w-4 h-4 text-amber-700" /> :
                         st.rank || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                      <TableCell className="text-xs font-medium">{st.name}</TableCell>
                      <TableCell className={cn('text-xs text-center font-bold', st.average !== null && st.average >= (isMaternelle ? 2 : 10) ? 'text-emerald-700' : 'text-red-600')}>
                        {st.average !== null ? st.average.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {st.distinctionLabel ? (
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                            st.distinctionLabel.includes('Or') ? 'bg-yellow-100 text-yellow-800' :
                            st.distinctionLabel.includes('Argent') ? 'bg-gray-100 text-gray-700' :
                            st.distinctionLabel.includes('Bronze') ? 'bg-orange-100 text-orange-700' :
                            st.distinctionLabel.includes('Félicitations') ? 'bg-emerald-100 text-emerald-700' :
                            st.distinctionLabel.includes('Encouragements') ? 'bg-blue-100 text-blue-700' :
                            st.distinctionLabel.includes('Honneur') ? 'bg-purple-100 text-purple-700' :
                            st.distinctionLabel.includes('Courage') ? 'bg-orange-100 text-orange-700' :
                            'bg-teal-100 text-teal-700')}>
                            {st.distinctionLabel}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <div className="flex items-center justify-center gap-1">
                          {st.distinctionCode && (
                            <>
                              <button
                                onClick={() => handleGenerateCertificate(st)}
                                disabled={generatingCert === st.id}
                                title="Générer le certificat PDF"
                                className="p-1.5 rounded hover:bg-amber-100 disabled:opacity-50"
                              >
                                {generatingCert === st.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <Download className="w-3.5 h-3.5 text-amber-600" />}
                              </button>
                              <button
                                onClick={() => handleSendCertificate(st)}
                                disabled={sending === st.id}
                                title="Envoyer par email au parent"
                                className="p-1.5 rounded hover:bg-blue-100 disabled:opacity-50"
                              >
                                {sending === st.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Mail className="w-3.5 h-3.5 text-blue-600" />}
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
        ),
      }}
    />
  );
}
