/**
 * MODULE 2 — Structure académique (Niveaux → Cycles → Classes)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit2,
  Layers,
  BookOpen,
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { PEDAGOGY_SUBMODULE_TABS } from '@/components/pedagogy/pedagogy-tabs';

interface AcademicLevel {
  id: string;
  name: string;
  orderIndex: number;
  isActive: boolean;
  cycles?: AcademicCycle[];
}

interface AcademicCycle {
  id: string;
  name: string;
  orderIndex: number;
  isActive: boolean;
  level?: { name: string };
  classes?: AcademicClass[];
}

interface AcademicClass {
  id: string;
  name: string;
  code: string;
  capacity?: number;
  isActive: boolean;
  level?: { name: string };
  cycle?: { name: string };
  room?: { roomCode: string; roomName: string } | null;
  mainTeacher?: { firstName: string; lastName: string } | null;
  languageTrack?: string | null;
}

async function api(
  path: string,
  options?: { method?: string; body?: object }
): Promise<unknown> {
  const url = `/api/pedagogy/academic-structure/${path}`;
  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.error || res.statusText);
  }
  return res.json();
}

export default function AcademicStructurePage() {
  const { academicYear } = useModuleContext();
  const [levels, setLevels] = useState<AcademicLevel[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

  const loadLevels = useCallback(async () => {
    if (!academicYear?.id) return;
    setLoading(true);
    try {
      const data = (await api(`levels?academicYearId=${academicYear.id}`)) as AcademicLevel[];
      setLevels(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLevels([]);
    } finally {
      setLoading(false);
    }
  }, [academicYear?.id]);

  const loadClasses = useCallback(
    async (cycleId?: string) => {
      if (!academicYear?.id || !cycleId) return;
      const params = new URLSearchParams({ academicYearId: academicYear.id, cycleId });
      const data = (await api(`classes?${params}`)) as AcademicClass[];
      setClasses(Array.isArray(data) ? data : []);
    },
    [academicYear?.id]
  );

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  useEffect(() => {
    if (expandedCycle) loadClasses(expandedCycle);
    else setClasses([]);
  }, [expandedCycle, loadClasses]);

  const handleCreateLevel = async (name: string, orderIndex: number) => {
    if (!academicYear?.id) return;
    await api('levels', {
      method: 'POST',
      body: { academicYearId: academicYear.id, name, orderIndex },
    });
    setModal(null);
    loadLevels();
  };

  const handleCreateCycle = async (levelId: string, name: string, orderIndex: number) => {
    if (!academicYear?.id) return;
    await api('cycles', {
      method: 'POST',
      body: { academicYearId: academicYear.id, levelId, name, orderIndex },
    });
    setModal(null);
    loadLevels();
  };

  const handleCreateClass = async (payload: {
    levelId: string;
    cycleId: string;
    name: string;
    code: string;
    capacity?: number;
    roomId?: string;
    mainTeacherId?: string;
    languageTrack?: string;
  }) => {
    if (!academicYear?.id) return;
    await api('classes', {
      method: 'POST',
      body: { ...payload, academicYearId: academicYear.id },
    });
    setModal(null);
    if (expandedCycle) loadClasses(expandedCycle);
    loadLevels();
  };

  const handleUpdateLevel = async (id: string, data: { name?: string; orderIndex?: number; isActive?: boolean }) => {
    await api(`levels/${id}`, { method: 'PUT', body: data });
    setModal(null);
    loadLevels();
  };

  const handleUpdateCycle = async (id: string, data: { name?: string; orderIndex?: number; isActive?: boolean }) => {
    await api(`cycles/${id}`, { method: 'PUT', body: data });
    setModal(null);
    loadLevels();
  };

  const handleUpdateClass = async (
    id: string,
    data: Partial<{ name: string; code: string; capacity: number; roomId: string | null; mainTeacherId: string | null; languageTrack: string | null; isActive: boolean }>
  ) => {
    await api(`classes/${id}`, { method: 'PUT', body: data });
    setModal(null);
    if (expandedCycle) loadClasses(expandedCycle);
    loadLevels();
  };

  const handleDeactivateClass = async (id: string) => {
    await api(`classes/${id}/deactivate`, { method: 'PUT' });
    if (expandedCycle) loadClasses(expandedCycle);
    loadLevels();
  };

  if (!academicYear) {
    return (
      <ModuleContainer
        header={{ title: 'Structure académique', description: 'Niveaux, cycles et classes', icon: 'bookOpen' }}
        subModules={{
          modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
            const Icon = tab.icon;
            return {
              id: tab.id,
              label: tab.label,
              href: tab.path,
              icon: <Icon className="w-4 h-4" />,
            };
          }),
        }}
        content={{ layout: 'custom', children: <p className="text-gray-500">Veuillez sélectionner une année scolaire.</p> }}
      />
    );
  }

  return (
    <ModuleContainer
      header={{
        title: 'Structure académique',
        description: `Niveaux → Cycles → Classes — Année ${academicYear.label}`,
        icon: 'bookOpen',
      }}
      subModules={{
        modules: PEDAGOGY_SUBMODULE_TABS.map((tab) => {
          const Icon = tab.icon;
          return {
            id: tab.id,
            label: tab.label,
            href: tab.path,
            icon: <Icon className="w-4 h-4" />,
          };
        }),
      }}
      content={{
        layout: 'custom',
        children: (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Hiérarchie</h2>
              <button
                type="button"
                onClick={async () => {
                  const name = window.prompt('Nom du niveau (ex. Maternelle, Primaire, Secondaire)');
                  if (name?.trim()) {
                    try {
                      await handleCreateLevel(name.trim(), levels.length);
                    } catch (e) {
                      window.alert((e as Error).message);
                    }
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un niveau
              </button>
            </div>

            {loading ? (
              <p className="text-gray-500">Chargement…</p>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white">
                {levels.length === 0 ? (
                  <p className="p-6 text-center text-gray-500">Aucun niveau. Ajoutez un niveau (Maternelle, Primaire, Secondaire).</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {levels.map((level) => (
                      <li key={level.id}>
                        <div
                          className="flex cursor-pointer items-center gap-2 px-4 py-3 hover:bg-gray-50"
                          onClick={() => setExpandedLevel(expandedLevel === level.id ? null : level.id)}
                        >
                          {expandedLevel === level.id ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                          <Layers className="h-5 w-5 text-blue-600" />
                          <span className="font-medium">{level.name}</span>
                          <span className="text-sm text-gray-500">(ordre {level.orderIndex})</span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const name = window.prompt('Nouveau nom', level.name);
                              if (name != null && name.trim()) {
                                try {
                                  await handleUpdateLevel(level.id, { name: name.trim() });
                                } catch (err) {
                                  window.alert((err as Error).message);
                                }
                              }
                            }}
                            className="ml-auto rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                        {expandedLevel === level.id && (
                          <div className="border-t border-gray-100 bg-gray-50/50 pl-8 pr-4 pb-4">
                            <div className="flex items-center justify-between py-2">
                              <span className="text-sm font-medium text-gray-700">Cycles</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const name = window.prompt('Nom du cycle (ex. PS, MS, GS, CI, CP, 6ème)');
                                  if (name?.trim()) {
                                    try {
                                      await handleCreateCycle(level.id, name.trim(), (level.cycles?.length ?? 0));
                                    } catch (e) {
                                      window.alert((e as Error).message);
                                    }
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                              >
                                <Plus className="h-3 w-3" /> Ajouter un cycle
                              </button>
                            </div>
                            <ul className="space-y-1">
                              {(!level.cycles || level.cycles.length === 0) ? (
                                <li className="text-sm text-gray-500">Aucun cycle. Ajoutez PS, MS, GS ou CI, CP…</li>
                              ) : (
                                level.cycles!.map((cycle) => (
                                  <li key={cycle.id} className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-100"
                                      onClick={() =>
                                        setExpandedCycle(expandedCycle === cycle.id ? null : cycle.id)
                                      }
                                    >
                                      {expandedCycle === cycle.id ? (
                                        <ChevronDown className="h-3 w-3" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3" />
                                      )}
                                      <BookOpen className="h-4 w-4 text-gray-500" />
                                      <span>{cycle.name}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const name = window.prompt('Nouveau nom du cycle', cycle.name);
                                        if (name != null && name.trim()) {
                                          try {
                                            await handleUpdateCycle(cycle.id, { name: name.trim() });
                                          } catch (err) {
                                            window.alert((err as Error).message);
                                          }
                                        }
                                      }}
                                      className="rounded p-1 text-gray-400 hover:bg-gray-200"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const name = window.prompt('Nom de la classe (ex. CM2 A)');
                                        const code = window.prompt('Code (ex. CM2A)', name?.replace(/\s/g, '') ?? '');
                                        if (name?.trim() && code?.trim()) {
                                          try {
                                            await handleCreateClass({
                                              levelId: level.id,
                                              cycleId: cycle.id,
                                              name: name.trim(),
                                              code: code.trim().toUpperCase().replace(/\s/g, ''),
                                            });
                                          } catch (err) {
                                            window.alert((err as Error).message);
                                          }
                                        }
                                      }}
                                      className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-200"
                                    >
                                      + Classe
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                            {expandedCycle && (
                              <div className="mt-4 border-t border-gray-200 pt-4">
                                <p className="mb-2 text-sm font-medium text-gray-700">Classes</p>
                                {classes.length === 0 ? (
                                  <p className="text-sm text-gray-500">Aucune classe.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded border border-gray-200">
                                    <table className="min-w-full text-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-medium">Classe</th>
                                          <th className="px-3 py-2 text-left font-medium">Code</th>
                                          <th className="px-3 py-2 text-left font-medium">Capacité</th>
                                          <th className="px-3 py-2 text-left font-medium">Salle</th>
                                          <th className="px-3 py-2 text-left font-medium">Responsable</th>
                                          <th className="px-3 py-2 text-left font-medium">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {classes.map((cls) => (
                                          <tr key={cls.id} className="border-t border-gray-100">
                                            <td className="px-3 py-2">{cls.name}</td>
                                            <td className="px-3 py-2">{cls.code}</td>
                                            <td className="px-3 py-2">{cls.capacity ?? '—'}</td>
                                            <td className="px-3 py-2">
                                              {cls.room ? `${cls.room.roomCode} ${cls.room.roomName}` : '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                              {cls.mainTeacher
                                                ? `${cls.mainTeacher.firstName} ${cls.mainTeacher.lastName}`
                                                : '—'}
                                            </td>
                                            <td className="px-3 py-2">
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  const name = window.prompt('Nom de la classe', cls.name);
                                                  if (name != null && name.trim()) {
                                                    try {
                                                      await handleUpdateClass(cls.id, { name: name.trim() });
                                                    } catch (err) {
                                                      window.alert((err as Error).message);
                                                    }
                                                  }
                                                }}
                                                className="text-blue-600 hover:underline"
                                              >
                                                Modifier
                                              </button>
                                              {cls.isActive && (
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeactivateClass(cls.id)}
                                                  className="ml-2 text-amber-600 hover:underline"
                                                >
                                                  Désactiver
                                                </button>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}
