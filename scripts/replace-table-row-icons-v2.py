"""Replace table row with icon buttons — robust version using regex"""
import re

FILE = "/home/z/my-project/apps/web-app/src/components/pedagogy/subjects/SubjectsWorkspace.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add whitespace-nowrap to Classe cell
content = content.replace(
    '<td className="px-4 py-3 font-semibold text-slate-900">\n                              {c.name}',
    '<td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">\n                              {c.name}',
)

# 2. Add whitespace-nowrap to Série cell and fix the '—' to a span
content = content.replace(
    '<td className="px-4 py-3 text-slate-600">\n                              {c.series ?',
    '<td className="px-4 py-3 text-slate-600 whitespace-nowrap">\n                              {c.series ?',
)
content = content.replace(
    """                              ) : (
                                '—'
                              )}
                            </td>""",
    """                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>""",
)

# 3. Add whitespace-nowrap to "Aucune matière affectée" span
content = content.replace(
    '<span className="text-xs text-slate-400 font-medium">Aucune',
    '<span className="text-xs text-slate-400 font-medium whitespace-nowrap">Aucune',
)

# 4. Add whitespace-nowrap to each subject chip
content = content.replace(
    'className="inline-flex items-center gap-1 rounded bg-slate-100 pl-2 pr-1.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200"',
    'className="inline-flex items-center gap-1 rounded bg-slate-100 pl-2 pr-1.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200 whitespace-nowrap"',
)

# 5. Add whitespace-nowrap to Volume Hebdo Total cell
content = content.replace(
    '<td className="px-4 py-3 text-center font-bold text-slate-700">\n                              {weeklyHoursTotal',
    '<td className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">\n                              {weeklyHoursTotal',
)
content = content.replace(
    '{weeklyHoursTotal > 0 ? `${weeklyHoursTotal}h` : "—"}',
    '{weeklyHoursTotal > 0 ? `${weeklyHoursTotal}h` : <span className="text-slate-400">—</span>}',
)

# 6. Add whitespace-nowrap to Actions cell
content = content.replace(
    '<td className="px-4 py-3 text-right">\n                              <div className="flex items-center justify-end gap-3">',
    '<td className="px-4 py-3 text-right whitespace-nowrap">\n                              <div className="flex items-center justify-end gap-1">',
)

# 7. Replace "Affecter" text button with UserPlus icon button
old_affecter = """<button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClasses([c.id]);
                                    setSelectedSubjects([]);
                                    setModalLevelId('');
                                    setModalSeriesId('');
                                    setModal('mass-assignment');
                                  }}
                                  className="text-sm font-medium hover:underline"
                                  style={{ color: PRIMARY }}
                                >
                                  Affecter
                                </button>"""
new_affecter = """<button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClasses([c.id]);
                                    setSelectedSubjects([]);
                                    setModalLevelId('');
                                    setModalSeriesId('');
                                    setModal('mass-assignment');
                                  }}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
                                  style={{ color: PRIMARY }}
                                  title="Affecter des matières"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>"""
content = content.replace(old_affecter, new_affecter)

# 8. Replace "Modifier" text button with Pencil icon button
old_modifier = """<button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClasses([c.id]);
                                    setSelectedSubjects(classSubjects.map((cs: any) => cs.subjectId).filter(Boolean));
                                    setModalLevelId('');
                                    setModalSeriesId('');
                                    setModal('mass-assignment');
                                  }}
                                  disabled={classSubjects.length === 0}
                                  className="text-sm font-medium text-amber-700 hover:underline disabled:opacity-40 disabled:no-underline"
                                  title={classSubjects.length === 0 ? 'Aucune matiere a modifier' : 'Modifier les affectations'}
                                >
                                  Modifier
                                </button>"""
new_modifier = """<button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClasses([c.id]);
                                    setSelectedSubjects(classSubjects.map((cs: any) => cs.subjectId).filter(Boolean));
                                    setModalLevelId('');
                                    setModalSeriesId('');
                                    setModal('mass-assignment');
                                  }}
                                  disabled={classSubjects.length === 0}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={classSubjects.length === 0 ? 'Aucune matière à modifier' : 'Modifier les affectations'}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>"""
content = content.replace(old_modifier, new_modifier)

# 9. Replace "Supprimer" text button with Trash2 icon button
old_supprimer = """<button
                                  type="button"
                                  onClick={() => {
                                    if (classSubjects.length === 0) return;
                                    if (confirm(`Supprimer toutes les affectations de ${c.name} (${classSubjects.length} matiere(s)) ?`)) {
                                      Promise.all(
                                        classSubjects.map((cs: any) =>
                                          pedagogyFetch(`/api/pedagogy/class-subjects/${cs.id}`, { method: 'DELETE' }).catch(() => {})
                                        )
                                      ).then(() => {
                                        loadClassSubjects();
                                        toast({
                                          title: "Succes",
                                          description: `${classSubjects.length} affectation(s) supprimee(s) pour ${c.name}.`,
                                        });
                                      });
                                    }
                                  }}
                                  disabled={classSubjects.length === 0}
                                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                                  title={classSubjects.length === 0 ? 'Aucune affectation a supprimer' : 'Supprimer toutes les affectations'}
                                >
                                  Supprimer
                                </button>"""
new_supprimer = """<button
                                  type="button"
                                  onClick={() => {
                                    if (classSubjects.length === 0) return;
                                    if (confirm(`Supprimer toutes les affectations de ${c.name} (${classSubjects.length} matière(s)) ?`)) {
                                      Promise.all(
                                        classSubjects.map((cs: any) =>
                                          pedagogyFetch(`/api/pedagogy/class-subjects/${cs.id}`, { method: 'DELETE' }).catch(() => {})
                                        )
                                      ).then(() => {
                                        loadClassSubjects();
                                        toast({
                                          title: "Succès",
                                          description: `${classSubjects.length} affectation(s) supprimée(s) pour ${c.name}.`,
                                        });
                                      });
                                    }
                                  }}
                                  disabled={classSubjects.length === 0}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={classSubjects.length === 0 ? 'Aucune affectation à supprimer' : 'Supprimer toutes les affectations'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>"""
content = content.replace(old_supprimer, new_supprimer)

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print("OK — toutes les substitutions effectuées")
