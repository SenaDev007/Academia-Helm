'use client';

/**
 * ============================================================================
 * DISTINCTION / TABLEAU D'HONNEUR — Module Examen
 * ============================================================================
 *
 * Architecture :
 *   - GET /institutional-exams/distinctions/class/:classId?periodId&academicYearId&level
 *     → backend résout pour chaque élève : moyenne, rang, distinction principale
 *       (rules.ts → resolveDistinction), et prix spéciaux secondaire
 *       (rules.ts → resolveSpecialAwards : SEC_PROGRES, SEC_ASSIDUITE, SEC_COMPORTEMENT)
 *   - GET /institutional-exams/distinctions/types
 *     → catalogue des distinctions disponibles par niveau (5+1 = 6 par niveau
 *       pour maternel/primaire ; 7+1 = 8 pour secondaire avec les 3 prix spéciaux)
 *
 * Affichage :
 *   - Carte récap des types disponibles pour le niveau courant
 *   - Tableau des élèves avec : rang, moyenne, distinction principale + prix spéciaux
 *   - Pour chaque élève distingué : bouton générer PDF + bouton envoyer email
 *     • Si l'élève a des prix spéciaux (secondaire), un menu déroulant permet de
 *       choisir le certificat à générer (distinction principale OU prix spécial).
 *
 * Six documents par niveau :
 *   Maternel  : MAT_OR, MAT_ARGENT, MAT_BRONZE, MAT_EXPLO, MAT_GRAD + Board
 *   Primaire : PRI_FELIC, PRI_ENCOU, PRI_HONNEUR, PRI_COURAGE, PRI_GRAD + Board
 *   Secondaire : SEC_FELIC, SEC_ENCOU, SEC_HONNEUR + SEC_PROGRES, SEC_ASSIDUITE,
 *                SEC_COMPORTEMENT + SEC_GRAD + Board (3 mentions + 3 prix + grad + board)
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Award, Loader2, Download, Users, Trophy, Medal, Mail, Send,
  ChevronDown, GraduationCap, Star, HeartHandshake, TrendingUp, CalendarCheck, Crown, Flame,
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

// ─── Catalogue des types de distinction ──────────────────────────────────
interface DistinctionType {
  code: string;
  label: string;
  title: string;
  subtitle?: string;
  icon: string;
  kicker?: string;
  category: 'mention' | 'graduation' | 'special';
  minPct: number | null;
  palette: { primary: string; accent: string; tint: string; ink: string; soft: string };
}

// ─── Élève avec distinctions résolues côté backend ────────────────────────
interface DistinctionStudent {
  id: string;
  name: string;
  matricule: string;
  average: number;
  base: number;
  rank: number;
  classSize: number;
  distinctionCode: string | null;
  distinctionLabel: string | null;
  specialAwards: string[]; // codes (SEC_PROGRES, SEC_ASSIDUITE, SEC_COMPORTEMENT)
  specialAwardLabels: string[];
}

// ─── Mapping icône lucide par nom (les icônes sont des strings côté backend) ─
const ICON_MAP: Record<string, any> = {
  Star, Crown, Trophy, Medal, Award, GraduationCap, Flame, TrendingUp, CalendarCheck, HeartHandshake,
};

function iconFor(name: string) {
  return ICON_MAP[name] || Award;
}

// ─── Couleurs pastille pour les distinctions ─────────────────────────────
function distinctionBadgeClass(code: string): string {
  if (code.startsWith('MAT_OR')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (code.startsWith('MAT_ARGENT')) return 'bg-gray-100 text-gray-700 border-gray-300';
  if (code.startsWith('MAT_BRONZE')) return 'bg-orange-100 text-orange-700 border-orange-300';
  if (code.startsWith('MAT_EXPLO')) return 'bg-teal-100 text-teal-700 border-teal-300';
  if (code.startsWith('MAT_GRAD')) return 'bg-purple-100 text-purple-700 border-purple-300';
  if (code.startsWith('PRI_FELIC')) return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (code.startsWith('PRI_ENCOU')) return 'bg-blue-100 text-blue-700 border-blue-300';
  if (code.startsWith('PRI_HONNEUR')) return 'bg-purple-100 text-purple-700 border-purple-300';
  if (code.startsWith('PRI_COURAGE')) return 'bg-orange-100 text-orange-700 border-orange-300';
  if (code.startsWith('PRI_GRAD')) return 'bg-indigo-100 text-indigo-700 border-indigo-300';
  if (code.startsWith('SEC_FELIC')) return 'bg-rose-100 text-rose-700 border-rose-300';
  if (code.startsWith('SEC_ENCOU')) return 'bg-blue-100 text-blue-700 border-blue-300';
  if (code.startsWith('SEC_HONNEUR')) return 'bg-slate-100 text-slate-700 border-slate-300';
  if (code.startsWith('SEC_PROGRES')) return 'bg-teal-100 text-teal-700 border-teal-300';
  if (code.startsWith('SEC_ASSIDUITE')) return 'bg-indigo-100 text-indigo-700 border-indigo-300';
  if (code.startsWith('SEC_COMPORTEMENT')) return 'bg-green-100 text-green-700 border-green-300';
  if (code.startsWith('SEC_GRAD')) return 'bg-violet-100 text-violet-700 border-violet-300';
  return 'bg-amber-100 text-amber-700 border-amber-300';
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
  const [distinctionTypes, setDistinctionTypes] = useState<Record<string, DistinctionType[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingBoard, setGeneratingBoard] = useState(false);
  const [generatingCert, setGeneratingCert] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  // Pour le menu déroulant des certificats (par élève)
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);

  const subModules = useExamSubModules(EXAMS_SUB_MODULES);

  // Chargement du catalogue des types de distinction (une fois au montage)
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/institutional-exams/distinctions/types');
        if (res.data) setDistinctionTypes(res.data);
      } catch (err) {
        console.warn('Impossible de charger le catalogue des distinctions:', err);
      }
    })();
  }, []);

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

  // ─── Chargement des distinctions résolues côté backend ──────────────────
  // Le backend calcule pour chaque élève :
  //   - moyenne (période), rang (classe)
  //   - distinction principale via resolveDistinction(rules.ts → DEFAULT_RULES)
  //   - prix spéciaux secondaire via resolveSpecialAwards (progrès, assiduité, comportement)
  const loadData = useCallback(async () => {
    if (!selectedClassId || !selectedPeriodId || !academicYear?.id) return;
    setLoading(true);
    try {
      const response = await apiClient.get(
        `/institutional-exams/distinctions/class/${encodeURIComponent(selectedClassId)}`,
        { params: { periodId: selectedPeriodId, academicYearId: academicYear.id, level: scopeLevel || 'PRIMAIRE' } },
      );
      const data = response.data;
      const list: DistinctionStudent[] = Array.isArray(data) ? data.map((s: any) => ({
        id: s.id,
        name: s.name,
        matricule: s.matricule || '',
        average: s.average,
        base: s.base || (isMaternelle ? 3 : 20),
        rank: s.rank,
        classSize: s.classSize,
        distinctionCode: s.distinctionCode,
        distinctionLabel: s.distinctionLabel,
        specialAwards: Array.isArray(s.specialAwards) ? s.specialAwards : [],
        specialAwardLabels: Array.isArray(s.specialAwardLabels) ? s.specialAwardLabels : [],
      })) : [];
      setStudents(list);
    } catch (err) {
      console.error('Distinction load error:', err);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedPeriodId, academicYear?.id, scopeLevel, isMaternelle]);

  useEffect(() => { loadData(); }, [loadData]);

  const awardedStudents = useMemo(() => students.filter(s => s.distinctionCode !== null), [students]);
  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '';

  // Catalogue filtré pour le niveau courant
  const levelKey = isMaternelle ? 'maternel' : isSecondaire ? 'secondaire' : 'primaire';
  const currentLevelTypes = distinctionTypes?.[levelKey] || [];

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

  // Générer un certificat individuel (code = distinction principale OU prix spécial OU graduation)
  const handleGenerateCertificate = async (student: DistinctionStudent, code: string) => {
    setGeneratingCert(`${student.id}:${code}`);
    setOpenMenuFor(null);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/generate-certificate', {
        studentId: student.id,
        studentName: student.name,
        classId: selectedClassId,
        className: selectedClassName,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
        code,
        average: student.average,
        rank: student.rank,
        classSize: students.length,
      }, { responseType: 'blob', timeout: 120000 });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = student.name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `certificat_${safeName}_${code}.pdf`;
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
  const handleSendCertificate = async (student: DistinctionStudent, code: string, label: string) => {
    setSending(`${student.id}:${code}`);
    setOpenMenuFor(null);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/send-certificate', {
        studentId: student.id,
        studentName: student.name,
        classId: selectedClassId,
        className: selectedClassName,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
        code,
        average: student.average,
        rank: student.rank,
        classSize: students.length,
        distinctionLabel: label,
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

  // Envoyer tous les certificats (distinction principale uniquement)
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

  // Générer un certificat de fin de cycle (graduation) — non lié à une période
  const handleGenerateGraduation = async (student: DistinctionStudent) => {
    const gradCode = isMaternelle ? 'MAT_GRAD' : isSecondaire ? 'SEC_GRAD' : 'PRI_GRAD';
    setGeneratingCert(`${student.id}:${gradCode}`);
    try {
      const response = await apiClient.post('/institutional-exams/distinctions/generate-certificate', {
        studentId: student.id,
        studentName: student.name,
        classId: selectedClassId,
        className: selectedClassName,
        periodId: selectedPeriodId,
        academicYearId: academicYear?.id,
        level: scopeLevel || 'PRIMAIRE',
        code: gradCode,
        average: student.average,
        rank: student.rank,
        classSize: students.length,
      }, { responseType: 'blob', timeout: 120000 });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = student.name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
      link.download = `diplome_fin_cycle_${safeName}.pdf`;
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

  const levelLabel = isMaternelle ? 'Maternelle' : isSecondaire ? 'Secondaire' : 'Primaire';

  // Tous les codes disponibles pour un élève (distinction principale + prix spéciaux)
  const getAllStudentCertificates = (student: DistinctionStudent): { code: string; label: string; category: string }[] => {
    const certs: { code: string; label: string; category: string }[] = [];
    if (student.distinctionCode) {
      certs.push({ code: student.distinctionCode, label: student.distinctionLabel || 'Mention', category: 'mention' });
    }
    for (let i = 0; i < student.specialAwards.length; i++) {
      certs.push({
        code: student.specialAwards[i],
        label: student.specialAwardLabels[i] || student.specialAwards[i],
        category: 'special',
      });
    }
    return certs;
  };

  return (
    <ModuleContainer
      header={{ title: 'Distinction — Tableau d\'honneur', description: `Distinctions et certificats — Niveau ${levelLabel}`, icon: 'award' }}
      subModules={{ modules: subModules, activeModuleId: 'distinction' }}
      content={{
        layout: 'full',
        children: (
      <div className="space-y-4">
        {/* ─── Barre de contrôles ─── */}
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

        {/* ─── Catalogue des types de distinction pour le niveau ─── */}
        {currentLevelTypes.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" />
              Types de distinction disponibles — Niveau {levelLabel}
              <span className="ml-2 text-xs font-normal text-slate-500">
                ({currentLevelTypes.filter(t => t.category === 'mention').length} mentions
                {currentLevelTypes.some(t => t.category === 'special') && ` + ${currentLevelTypes.filter(t => t.category === 'special').length} prix spéciaux`}
                {currentLevelTypes.some(t => t.category === 'graduation') && ` + diplôme de fin de cycle`}
                )
              </span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {currentLevelTypes.map(t => {
                const Icon = iconFor(t.icon);
                return (
                  <div
                    key={t.code}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
                      distinctionBadgeClass(t.code),
                      t.category === 'graduation' && 'border-dashed',
                      t.category === 'special' && 'border-dashed',
                    )}
                    style={{ borderColor: t.palette.primary + '55' }}
                    title={`${t.title}${t.subtitle ? ' — ' + t.subtitle : ''}${t.minPct !== null ? ` (seuil: ${t.minPct}%)` : ''}`}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: t.palette.primary }} />
                    <span className="font-semibold">{t.label}</span>
                    {t.minPct !== null && (
                      <span className="text-[10px] opacity-70">≥ {t.minPct}%</span>
                    )}
                    {t.category === 'graduation' && (
                      <span className="text-[10px] opacity-70">fin de cycle</span>
                    )}
                    {t.category === 'special' && (
                      <span className="text-[10px] opacity-70">prix spécial</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Contenu principal ─── */}
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-slate-500">
            Aucune donnée disponible. Les évaluations doivent être validées pour calculer les moyennes.
          </div>
        ) : (
          <>
            {/* ─── Statistiques ─── */}
            <div className="grid grid-cols-4 gap-3">
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
                <p className="text-2xl font-bold text-blue-700">
                  {students.reduce((acc, s) => acc + s.specialAwards.length, 0)}
                </p>
                <p className="text-xs text-blue-600 font-medium">Prix spéciaux{isSecondaire ? '' : ' (sec.)'}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                <GraduationCap className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-emerald-700">{students.length}</p>
                <p className="text-xs text-emerald-600 font-medium">Diplômes fin de cycle</p>
              </div>
            </div>

            {/* ─── Tableau des élèves ─── */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2 bg-amber-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <Award className="w-4 h-4" /> Tableau d'honneur — {selectedClassName}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    (Période: {periods.find(p => p.id === selectedPeriodId)?.name || '—'})
                  </span>
                </h3>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="text-xs">Rang</TableHead>
                    <TableHead className="text-xs">Matricule</TableHead>
                    <TableHead className="text-xs">Nom</TableHead>
                    <TableHead className="text-xs text-center">Moyenne</TableHead>
                    <TableHead className="text-xs text-center">Distinction principale</TableHead>
                    <TableHead className="text-xs text-center">Prix spéciaux</TableHead>
                    <TableHead className="text-xs text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((st, idx) => {
                    const allCerts = getAllStudentCertificates(st);
                    const hasMultipleCerts = allCerts.length > 1;
                    return (
                      <TableRow key={st.id} className={cn(
                        idx % 2 === 1 && 'bg-slate-50/60',
                        st.distinctionCode && 'bg-amber-50/50',
                      )}>
                        <TableCell className="text-xs font-bold">
                          {st.rank === 1 ? <Trophy className="w-4 h-4 text-amber-500" /> :
                           st.rank === 2 ? <Medal className="w-4 h-4 text-slate-400" /> :
                           st.rank === 3 ? <Award className="w-4 h-4 text-amber-700" /> :
                           st.rank || '—'}
                        </TableCell>
                        <TableCell className="text-xs">{st.matricule || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">{st.name}</TableCell>
                        <TableCell className={cn('text-xs text-center font-bold',
                          st.average >= (isMaternelle ? 2 : 10) ? 'text-emerald-700' : 'text-red-600')}>
                          {st.average.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">/ {st.base}</span>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {st.distinctionCode ? (
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                              distinctionBadgeClass(st.distinctionCode))}>
                              {st.distinctionLabel}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {st.specialAwards.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {st.specialAwards.map((code, i) => (
                                <span key={code} className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border',
                                  distinctionBadgeClass(code))}>
                                  {st.specialAwardLabels[i]}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          <div className="flex items-center justify-center gap-1 relative">
                            {/* Bouton direct (distinction principale ou unique) */}
                            {allCerts.length === 1 && (
                              <>
                                <button
                                  onClick={() => handleGenerateCertificate(st, allCerts[0].code)}
                                  disabled={generatingCert === `${st.id}:${allCerts[0].code}`}
                                  title="Générer le certificat PDF"
                                  className="p-1.5 rounded hover:bg-amber-100 disabled:opacity-50"
                                >
                                  {generatingCert === `${st.id}:${allCerts[0].code}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> : <Download className="w-3.5 h-3.5 text-amber-600" />}
                                </button>
                                <button
                                  onClick={() => handleSendCertificate(st, allCerts[0].code, allCerts[0].label)}
                                  disabled={sending === `${st.id}:${allCerts[0].code}`}
                                  title="Envoyer par email au parent"
                                  className="p-1.5 rounded hover:bg-blue-100 disabled:opacity-50"
                                >
                                  {sending === `${st.id}:${allCerts[0].code}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <Mail className="w-3.5 h-3.5 text-blue-600" />}
                                </button>
                              </>
                            )}
                            {/* Bouton déroulant si plusieurs certificats (distinction + prix spéciaux) */}
                            {hasMultipleCerts && (
                              <>
                                <button
                                  onClick={() => setOpenMenuFor(openMenuFor === st.id ? null : st.id)}
                                  className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold flex items-center gap-1"
                                  title="Choisir le certificat à générer"
                                >
                                  <Award className="w-3 h-3" />
                                  {allCerts.length} cert.
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                {openMenuFor === st.id && (
                                  <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[280px]">
                                    {allCerts.map(cert => (
                                      <div key={cert.code} className="px-3 py-2 border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border',
                                            distinctionBadgeClass(cert.code))}>
                                            {cert.label}
                                          </span>
                                          {cert.category === 'special' && (
                                            <span className="text-[9px] text-slate-500">prix spécial</span>
                                          )}
                                        </div>
                                        <div className="flex gap-1">
                                          <button
                                            onClick={() => handleGenerateCertificate(st, cert.code)}
                                            disabled={generatingCert === `${st.id}:${cert.code}`}
                                            className="flex-1 px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-semibold flex items-center justify-center gap-1"
                                          >
                                            {generatingCert === `${st.id}:${cert.code}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                            PDF
                                          </button>
                                          <button
                                            onClick={() => handleSendCertificate(st, cert.code, cert.label)}
                                            disabled={sending === `${st.id}:${cert.code}`}
                                            className="flex-1 px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-semibold flex items-center justify-center gap-1"
                                          >
                                            {sending === `${st.id}:${cert.code}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                                            Email
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                            {/* Bouton diplôme de fin de cycle (tous les élèves peuvent y prétendre) */}
                            <button
                              onClick={() => handleGenerateGraduation(st)}
                              disabled={generatingCert === `${st.id}:${isMaternelle ? 'MAT_GRAD' : isSecondaire ? 'SEC_GRAD' : 'PRI_GRAD'}`}
                              title="Générer le diplôme de fin de cycle"
                              className="p-1.5 rounded hover:bg-purple-100 disabled:opacity-50"
                            >
                              {generatingCert === `${st.id}:${isMaternelle ? 'MAT_GRAD' : isSecondaire ? 'SEC_GRAD' : 'PRI_GRAD'}` ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" /> : <GraduationCap className="w-3.5 h-3.5 text-purple-600" />}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Légende des distinctions */}
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs text-slate-600">
              <p className="font-semibold mb-1">ℹ️ Comment sont déterminées les distinctions ?</p>
              <p className="leading-relaxed">
                La <strong>distinction principale</strong> est calculée à partir de la moyenne de l'élève selon les règles :
                {isMaternelle && ' Étoile d\'Or (≥90%), Étoile d\'Argent (≥75%), Étoile de Bronze (≥60%), Petit Explorateur (autres).'}
                {!isMaternelle && !isSecondaire && ' Félicitations (≥80%), Encouragements (≥70%), Mention Honneur (≥60%), Mention Courage (≥50%).'}
                {isSecondaire && ' Félicitations (≥80%), Encouragements (≥70%), Mention Honneur (≥60%). En dessous de 60%, aucune mention.'}
                {isSecondaire && ' Les <strong>prix spéciaux</strong> du secondaire sont indépendants : Prix du Progrès (gain ≥ 10% vs période précédente), Prix d\'Assiduité (0 absence injustifiée et 0 retard), Prix de Comportement (conduite ≥ 90%).'}
                {' Le <strong>diplôme de fin de cycle</strong> peut être généré pour chaque élève en fin d\'année.'}
              </p>
            </div>
          </>
        )}
      </div>
        ),
      }}
    />
  );
}
