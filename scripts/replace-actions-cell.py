"""Replace the Actions cell in SubjectsWorkspace.tsx"""
import re

FILE = "/home/z/my-project/apps/web-app/src/components/pedagogy/subjects/SubjectsWorkspace.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

OLD = '''                             <td className="px-4 py-3 text-right">
                               <button
                                 type="button"
                                 onClick={() => {
                                   setSelectedClasses([c.id]);
                                   setSelectedSubjects([]);
                                   setModal('mass-assignment');
                                 }}
                                 className="text-sm font-medium hover:underline"
                                 style={{ color: PRIMARY }}
                               >
                                 Affecter
                               </button>
                             </td>'''

NEW = '''                             <td className="px-4 py-3 text-right">
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
                             </td>'''

if OLD in content:
    content = content.replace(OLD, NEW, 1)
    with open(FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK — remplacement effectue")
else:
    print("ERREUR — old string non trouvee")
