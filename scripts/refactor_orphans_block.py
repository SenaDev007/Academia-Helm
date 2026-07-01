#!/usr/bin/env python3
"""Refactor the orphans block in EnrollmentsContent.tsx to group by school level."""

import re
from pathlib import Path

FILE = Path('/home/z/my-project/apps/web-app/src/components/students/EnrollmentsContent.tsx')
content = FILE.read_text()

# Find the block starting at "SECTION : Élèves non affectés" and ending at the closing ")}" before "ARBORESCENCE NIVEAU"
start_marker = '              {/* ─── SECTION : Élèves non affectés (orphelins) ───'
end_marker = '              {/* ─── ARBORESCENCE NIVEAU → CLASSE → ÉLÈVES ───'

start_idx = content.index(start_marker)
end_idx = content.index(end_marker)

old_block = content[start_idx:end_idx]
print(f"Old block size: {len(old_block)} chars, {old_block.count(chr(10))} lines")

new_block = '''              {/* ─── SECTION : Élèves non affectés (orphelins) groupés par niveau ───
                  Affichée en premier pour que l'admin voie immédiatement les élèves
                  qui ont besoin d'une affectation manuelle. Groupés par niveau scolaire
                  (Maternelle / Primaire / Secondaire) pour faciliter l'affectation. */}
              {unassignedEnrollments.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleLevel('__unassigned__')}
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-amber-50/50 transition-colors text-left group"
                  >
                    <div className="shrink-0">
                      {expandedLevels.has('__unassigned__') ? <ChevronDown className="w-5 h-5 text-amber-500 group-hover:text-amber-600" /> : <ChevronRight className="w-5 h-5 text-amber-500 group-hover:text-amber-600" />}
                    </div>
                    <div className="p-2.5 rounded-lg shrink-0 bg-amber-50"><AlertCircle className="w-5 h-5 text-amber-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-amber-800">Élèves non affectés</p>
                      <p className="text-xs text-amber-600">
                        {unassignedEnrollments.length} élève(s) sans classe — groupés par niveau scolaire · à affecter via l'onglet Affectations
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 rounded-full text-sm font-bold text-amber-700 shrink-0">{unassignedEnrollments.length}</span>
                  </button>
                  <AnimatePresence>
                    {expandedLevels.has('__unassigned__') && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        {/* Sous-groupes par niveau scolaire */}
                        {unassignedByLevel.map((group) => {
                          const groupKey = `__unassigned__${group.levelId}`;
                          const isGroupExpanded = expandedLevels.has(groupKey);
                          return (
                            <div key={group.levelId} className="border-t border-amber-100/50 first:border-t-0">
                              <button
                                onClick={() => toggleLevel(groupKey)}
                                className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-amber-50/30 transition-colors text-left group"
                              >
                                <div className="shrink-0 pl-6">
                                  {isGroupExpanded ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-amber-500" />}
                                </div>
                                <div className={cn('p-1.5 rounded-lg shrink-0', getLevelBgColor(group.levelName))}>
                                  {getLevelIcon(group.levelName)}
                                </div>
                                <span className="flex-1 text-sm font-semibold text-amber-800">{getLevelDisplayName(group.levelName)}</span>
                                <span className="px-2 py-0.5 bg-amber-100 rounded-full text-[10px] font-bold text-amber-700 shrink-0">
                                  {group.students.length} élève{group.students.length > 1 ? 's' : ''}
                                </span>
                              </button>
                              <AnimatePresence>
                                {isGroupExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                                    <div className="pl-14 pr-5 py-1">
                                      {group.students.map((enr, idx) => {
                                        const statusInfo = STATUS_META[enr.status] || { label: enr.status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
                                        const typeInfo = TYPE_META[enr.enrollmentType] || { label: enr.enrollmentType, color: 'bg-slate-50 text-slate-600' };
                                        return (
                                          <div key={enr.id} className="flex items-center gap-3 py-2 px-3 hover:bg-amber-50/40 rounded-lg transition-colors group">
                                            <span className="text-[10px] font-mono text-slate-400 w-6 text-right shrink-0">{idx + 1}</span>
                                            <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-bold text-amber-600 group-hover:bg-amber-200 group-hover:text-amber-700 transition-colors shrink-0">
                                              {enr.student.lastName[0]}{enr.student.firstName[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-slate-800">{enr.student.lastName.toUpperCase()} {enr.student.firstName}</p>
                                              <p className="text-[10px] font-mono text-slate-400">
                                                {enr.student.matricule || enr.student.studentCode || '— matricule non généré —'}
                                              </p>
                                            </div>
                                            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0', typeInfo.color)}>{typeInfo.label}</span>
                                            <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0', statusInfo.color)}>{statusInfo.label}</span>
                                            <span className="text-[9px] text-slate-400 shrink-0 hidden sm:inline">{new Date(enr.enrollmentDate).toLocaleDateString('fr-FR')}</span>
                                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
                                              {enr.status === 'PENDING' || enr.status === 'PRE_REGISTERED' || enr.status === 'ADMITTED' ? (
                                                <button onClick={() => handleValidate(enr.student.id)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600" title="Valider"><CheckCircle className="w-3.5 h-3.5" /></button>
                                              ) : null}
                                              {/* Générer le matricule si manquant (élève converti sans classe avant le fix) */}
                                              {(!enr.student.matricule && !enr.student.studentCode) && (
                                                <button
                                                  onClick={async () => {
                                                    try {
                                                      await studentsService.generateMatricule(enr.student.id);
                                                      toast({ title: '✅ Matricule généré', variant: 'success' });
                                                      loadData();
                                                    } catch (e: any) {
                                                      toast({ title: 'Erreur génération matricule', description: e.message, variant: 'error' });
                                                    }
                                                  }}
                                                  className="p-1 hover:bg-blue-100 rounded text-blue-600"
                                                  title="Générer le matricule"
                                                ><FileText className="w-3.5 h-3.5" /></button>
                                              )}
                                              <button onClick={() => handleReEnroll(enr)} className="p-1 hover:bg-indigo-100 rounded text-indigo-600" title="Réinscrire"><RotateCcw className="w-3.5 h-3.5" /></button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

'''

new_content = content[:start_idx] + new_block + content[end_idx:]
FILE.write_text(new_content)
print(f"New file size: {len(new_content)} chars (was {len(content)})")
print("Done.")
