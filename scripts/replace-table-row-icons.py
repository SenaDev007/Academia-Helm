"""Replace the table body row with nowrap + icon buttons"""
FILE = "/home/z/my-project/apps/web-app/src/components/pedagogy/subjects/SubjectsWorkspace.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

OLD = '''                          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-semibold text-slate-900">
                              {c.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {c.series ? (
                                <span className="inline-flex items-center rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                  {c.series.name}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {classSubjects.length === 0 ? (
                                <span className="text-xs text-slate-400 font-medium">Aucune matière affectée</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 py-1">
                                  {classSubjects.map((cs: any) => (
                                    <span
                                      key={cs.id}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 pl-2 pr-1.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200"
                                    >
                                      <span>
                                        {cs.subject?.name} <span className="text-[10px] text-slate-500 font-normal">(Coeff. {cs.coefficient})</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setAssignmentToRemove({ id: cs.id, name: cs.subject?.name })}
                                        className="rounded-full hover:bg-slate-200 p-0.5 text-slate-500 hover:text-slate-900 transition-colors"
                                      >
                                        <Plus className="h-3 w-3 rotate-45 shrink-0" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700">
                              {weeklyHoursTotal > 0 ? `${weeklyHoursTotal}h` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button
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
                                </button>
                                <button
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
                                </button>
                                <button
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
                                </button>
                              </div>
                            </td>
                          </tr>'''

NEW = '''                          <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                            <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                              {c.name}
                            </td>
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                              {c.series ? (
                                <span className="inline-flex items-center rounded bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                  {c.series.name}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {classSubjects.length === 0 ? (
                                <span className="text-xs text-slate-400 font-medium whitespace-nowrap">Aucune matière affectée</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 py-1">
                                  {classSubjects.map((cs: any) => (
                                    <span
                                      key={cs.id}
                                      className="inline-flex items-center gap-1 rounded bg-slate-100 pl-2 pr-1.5 py-0.5 text-xs font-semibold text-slate-800 border border-slate-200 whitespace-nowrap"
                                    >
                                      <span>
                                        {cs.subject?.name} <span className="text-[10px] text-slate-500 font-normal">(Coeff. {cs.coefficient})</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setAssignmentToRemove({ id: cs.id, name: cs.subject?.name })}
                                        className="rounded-full hover:bg-slate-200 p-0.5 text-slate-500 hover:text-slate-900 transition-colors"
                                      >
                                        <Plus className="h-3 w-3 rotate-45 shrink-0" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                              {weeklyHoursTotal > 0 ? `${weeklyHoursTotal}h` : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClasses([c.id]);
                                    setSelectedSubjects([]);
                                    setModalLevelId('');
                                    setModalSeriesId('');
                                    setModal('mass-assignment');
                                  }}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                  style={{ color: PRIMARY }}
                                  title="Affecter des matières"
                                >
                                  <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClasses([c.id]);
                                    setSelectedSubjects(classSubjects.map((cs: any) => cs.subjectId).filter(Boolean));
                                    setModalLevelId('');
                                    setModalSeriesId('');
                                    setModal('mass-assignment');
                                  }}
                                  disabled={classSubjects.length === 0}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-amber-700 hover:bg-amber-50 hover:text-amber-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={classSubjects.length === 0 ? 'Aucune matière à modifier' : 'Modifier les affectations'}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
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
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={classSubjects.length === 0 ? 'Aucune affectation à supprimer' : 'Supprimer toutes les affectations'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>'''

if OLD in content:
    content = content.replace(OLD, NEW, 1)
    with open(FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK — remplacement effectué")
else:
    print("ERREUR — old string non trouvée")
