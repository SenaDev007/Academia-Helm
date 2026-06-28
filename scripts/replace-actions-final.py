"""Final replacement — read exact content from file and replace"""
FILE = "/home/z/my-project/apps/web-app/src/components/pedagogy/subjects/SubjectsWorkspace.tsx"

with open(FILE, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the Actions cell (line containing 'px-4 py-3 text-right">' followed by gap-3 div)
# and replace everything from there to the closing </td>
new_output = []
i = 0
while i < len(lines):
    line = lines[i]
    # Detect the Actions cell: <td className="px-4 py-3 text-right"> followed by <div className="flex items-center justify-end gap-3">
    if 'px-4 py-3 text-right">' in line and i + 1 < len(lines) and 'flex items-center justify-end gap-3' in lines[i + 1]:
        # Check that this is the mass-assignment table (look for Affecter nearby)
        # Find the closing </td> for this cell
        j = i + 1
        found_close = False
        while j < len(lines):
            if '</td>' in lines[j]:
                found_close = True
                break
            j += 1
        if found_close:
            # Check if Affecter/Modifier/Supprimer are in this block
            block = ''.join(lines[i:j + 1])
            if 'Affecter' in block and 'Modifier' in block and 'Supprimer' in block:
                # Replace the entire block
                replacement = '''                             <td className="px-4 py-3 text-right whitespace-nowrap">
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
                                   className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white hover:bg-slate-100 transition-colors"
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
                                   className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                                   className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-slate-200 bg-white text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                   title={classSubjects.length === 0 ? 'Aucune affectation à supprimer' : 'Supprimer toutes les affectations'}
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </div>
                             </td>
'''
                new_output.append(replacement)
                i = j + 1
                continue
    new_output.append(line)
    i += 1

with open(FILE, 'w', encoding='utf-8') as f:
    f.writelines(new_output)

print("OK — Actions cell replaced with icon buttons")
