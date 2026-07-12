/**
 * ============================================================================
 * SOUS-MODULE — HISTORIQUE SCOLAIRE
 * ============================================================================
 * Affiche, pour chaque élève du niveau scolaire et de l'année active, son parcours
 * sur les 3 dernières années (classe officielle fréquentée + décision du conseil
 * de classe : PROMOTED / REPEATED / EN COURS, avec la moyenne éventuelle).
 *
 * Filtres : Niveau scolaire + Classe (pattern identique au TransferWizard)
 *           + recherche texte libre (nom / matricule).
 *
 * Le bouton « Dossier Complet » bascule vers l'onglet « Dossiers Élèves » du module
 * et préselectionne la carte de l'élève. Le passage se fait via la query string
 * ?tab=dossiers&studentId=xxx que StudentsModulePage lit au montage, et que
 * StudentIdentityContent lit pour précharger l'élève sélectionné.
 * ============================================================================
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  History,
  Milestone,
  AlertTriangle,
  Lock,
  Unlock,
  FileText,
  ExternalLink,
  Search,
  Loader2,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useSchoolLevel } from '@/hooks/useSchoolLevel';
import { LoadingState } from '@/components/ui/feedback/LoadingState';
import { studentsService } from '@/services/students.service';
import { toast } from '@/components/ui/toast';

interface HistoryRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  matricule?: string;
  photoUrl?: string;
  student?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    matricule?: string;
    photoUrl?: string;
  };
  academicRecords?: Array<{
    id: string;
    academicYear?: { label?: string; name?: string };
    class?: { name?: string };
    className?: string;
    enrollmentYear?: string;
    averageScore?: number;
    decision?: string;
    isLocked: boolean;
  }>;
  studentEnrollments?: Array<{
    id: string;
    academicYear?: { label?: string; name?: string };
    class?: { name?: string };
    className?: string;
    enrollmentYear?: string;
    averageScore?: number;
    decision?: string;
    isLocked: boolean;
  }>;
}

interface ClassInfo {
  id: string;
  name: string;
  schoolLevelId?: string;
  schoolLevel?: { id: string; name: string; code?: string };
}

export default function StudentHistoryContent() {
  const { academicYear } = useModuleContext();
  const { availableLevels } = useSchoolLevel();
  const [data, setData] = useState<HistoryRecord[]>([]);
  const [allClasses, setAllClasses] = useState<ClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filtres (pattern TransferWizard)
  const [filterLevelId, setFilterLevelId] = useState<string>('');
  const [filterClassId, setFilterClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (academicYear) loadHistory();
  }, [academicYear]);

  // Charger les classes physiques (pour le filtre classe)
  useEffect(() => {
    fetch('/api/all-classes', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllClasses(Array.isArray(data) ? data : []))
      .catch(() => setAllClasses([]));
  }, []);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const params = {
        academicYearId: academicYear?.id || '',
        includeHistory: 'true',
      };
      const result = await studentsService.getAll(params);
      // Gérer la réponse paginée { data, total, ... } ou l'ancien format array
      const list = Array.isArray(result) ? result : (result?.data || []);
      setData(list);
    } catch (e: any) {
      console.error(e);
      toast({
        title: 'Erreur',
        description: e.message || "Impossible de charger l'historique",
        variant: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ⭐ Ouvrir le dossier complet : bascule vers l'onglet Dossiers Élèves avec
  // présélection de l'élève. StudentsModulePage lit ?tab=dossiers&studentId=xxx
  // au montage pour activer l'onglet, et StudentIdentityContent lit studentId
  // pour précharger la carte de l'élève.
  const handleOpenDossier = (studentId: string) => {
    if (!studentId) {
      toast({
        title: 'Erreur',
        description: "Identifiant élève manquant — impossible d'ouvrir le dossier.",
        variant: 'error',
      });
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'dossiers');
    url.searchParams.set('studentId', studentId);
    window.location.href = url.toString();
  };

  // ⭐ Filtre classes par niveau (comme TransferWizard)
  const filteredClasses = useMemo(() => {
    if (!filterLevelId) return allClasses;
    const selectedLevel = availableLevels.find((l) => l.id === filterLevelId);
    const levelCode = (selectedLevel?.code || '').toUpperCase();
    const levelName = (selectedLevel?.label || selectedLevel?.code || '').toUpperCase();
    return allClasses.filter((c) => {
      const classLevelName = (c.schoolLevel?.name || '').toUpperCase();
      const classLevelCode = (c.schoolLevel?.code || '').toUpperCase();
      return (
        classLevelName === levelName ||
        classLevelCode === levelCode ||
        classLevelName.includes(levelCode) ||
        levelCode.includes(classLevelName)
      );
    });
  }, [allClasses, filterLevelId, availableLevels]);

  // ⭐ Filtrage des élèves par niveau + classe + recherche texte
  const filteredData = useMemo(() => {
    let result = data;
    // Filtre par classe (si sélectionnée)
    if (filterClassId) {
      // On ne garde que les élèves dont au moins un enrollment a cette classe
      result = result.filter((item: any) => {
        const records = item.academicRecords || item.studentEnrollments || [];
        return records.some((r: any) => r.class?.id === filterClassId || r.classId === filterClassId);
      });
    } else if (filterLevelId) {
      // Filtre par niveau uniquement (si pas de classe sélectionnée)
      const selectedLevel = availableLevels.find((l) => l.id === filterLevelId);
      const levelCode = (selectedLevel?.code || '').toUpperCase();
      const levelName = (selectedLevel?.label || selectedLevel?.code || '').toUpperCase();
      result = result.filter((item: any) => {
        const records = item.academicRecords || item.studentEnrollments || [];
        return records.some((r: any) => {
          const classLevelName = (r.class?.schoolLevel?.name || r.schoolLevel?.name || '').toUpperCase();
          const classLevelCode = (r.class?.schoolLevel?.code || r.schoolLevel?.code || '').toUpperCase();
          return (
            classLevelName === levelName ||
            classLevelCode === levelCode ||
            classLevelName.includes(levelCode) ||
            levelCode.includes(classLevelName)
          );
        });
      });
    }
    // Recherche texte (nom ou matricule)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => {
        const student = item.student || item;
        const fullName = `${student.lastName || ''} ${student.firstName || ''}`.toLowerCase();
        const matricule = (student.matricule || '').toLowerCase();
        return fullName.includes(q) || matricule.includes(q);
      });
    }
    return result;
  }, [data, filterLevelId, filterClassId, searchQuery, availableLevels]);

  if (isLoading) return <LoadingState message="Reconstitution des parcours..." />;

  return (
    <div className="space-y-4">
      {/* Header — white card cohérent avec les autres onglets */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Historique Scolaire</h2>
              <p className="text-xs text-slate-500">
                Traçabilité des promotions, redoublements et décisions de conseils de classe.
                Filtrez par niveau ou classe, puis cliquez sur « Dossier Complet » pour ouvrir le dossier de l'élève.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Légende */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-4 text-[11px] text-slate-600 flex-wrap">
        <span className="font-bold text-slate-700 uppercase tracking-wider">Légende :</span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">PROMOTED</span>
          <span>Passant en classe supérieure</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">REPEATED</span>
          <span>Redouble l'année</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-bold">EN COURS</span>
          <span>Année en cours (non clôturée)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Lock className="w-3 h-3 text-gray-400" />
          <span>Verrouillée</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Unlock className="w-3 h-3 text-green-500" />
          <span>Ouverte</span>
        </span>
      </div>

      {/* Barre de filtres (pattern TransferWizard) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-2">
          {/* Filtre niveau scolaire */}
          <select
            value={filterLevelId}
            onChange={(e) => {
              setFilterLevelId(e.target.value);
              setFilterClassId('');
            }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les niveaux</option>
            {availableLevels
              .filter((l) => l.id !== 'ALL')
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label || l.code}
                </option>
              ))}
          </select>
          {/* Filtre classe */}
          <select
            value={filterClassId}
            onChange={(e) => setFilterClassId(e.target.value)}
            disabled={!filterLevelId}
            className="border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">Toutes les classes</option>
            {filteredClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {/* Recherche texte */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom ou matricule..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Élève</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Parcours (3 dernières années)</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredData.map((item: any) => {
              const student = item.student || item;
              const academicRecords = item.academicRecords || item.studentEnrollments || [];
              const studentId = item.id || student?.id;
              return (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center font-bold text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-all">
                        {student.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <>{student.lastName?.[0] || '?'}</>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{student.lastName} {student.firstName}</div>
                        <div className="text-[10px] font-mono text-gray-400 uppercase tracking-tighter">{student.matricule || 'Sans matricule'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      {(academicRecords || []).slice(0, 3).map((record: any, idx: number) => (
                        <div key={record.id || idx} className="relative flex items-center">
                          <div className={`flex flex-col p-2 rounded-lg border min-w-[120px] ${
                            record.isLocked ? 'bg-gray-50 border-gray-200 shadow-inner' : 'bg-white border-blue-100 shadow-sm'
                          }`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-bold text-gray-400 uppercase">
                                {record.academicYear?.label || record.academicYear?.name || record.enrollmentYear || '—'}
                              </span>
                              {record.isLocked ? <Lock className="w-2.5 h-2.5 text-gray-400" /> : <Unlock className="w-2.5 h-2.5 text-green-500" />}
                            </div>
                            <div className="text-xs font-bold text-gray-800 truncate">{record.class?.name || record.className || 'Inconnu'}</div>
                            <div className="flex items-center justify-between mt-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                record.decision === 'PROMOTED' ? 'bg-green-100 text-green-700' :
                                record.decision === 'REPEATED' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {record.decision || 'EN COURS'}
                              </span>
                              {record.averageScore && (
                                <span className="text-[10px] font-mono font-bold text-blue-600">{record.averageScore}/20</span>
                              )}
                            </div>
                          </div>
                          {idx < Math.min((academicRecords || []).length, 3) - 1 && (
                            <Milestone className="w-4 h-4 text-gray-300 mx-1 flex-shrink-0" />
                          )}
                        </div>
                      ))}
                      {(academicRecords || []).length === 0 && (
                        <span className="text-xs text-gray-400 italic">Aucun historique</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleOpenDossier(studentId)}
                      title="Ouvrir le dossier scolaire complet"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Dossier Complet
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && (
          <div className="py-20 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Aucun élève ne correspond aux filtres sélectionnés.</p>
          </div>
        )}
      </div>
    </div>
  );
}
