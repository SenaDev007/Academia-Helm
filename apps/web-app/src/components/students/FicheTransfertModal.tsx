"use client";

/**
 * ============================================================================
 * FICHE DE TRANSFERT — Modal de génération PDF (Primaire + Secondaire)
 * ============================================================================
 * Corrigé (2026-09-20) :
 *  - Tableau accumulateur dans l'interface : affiche TOUS les élèves
 *    sélectionnés (pas seulement 1) avec N°, nom, matricule, classe suivie
 *    (ancienne école) ET classe à suivre (nouvelle école) — éditables pour
 *    Primaire ET Secondaire.
 *  - Colonne CLASSE dans le PDF Primaire : côté gauche = classe suivie dans
 *    l'ancienne école, côté droit = classe à suivre dans la nouvelle école
 *    (au lieu de dupliquer s.className des deux côtés qui restait vide si
 *    l'API ne renvoyait pas className).
 *  - Nom du directeur : placé EN BAS (zone de signature), pas sur la même
 *    ligne que l'étiquette « Le Directeur ».
 *  - Bouton « Générer » : génère le PDF global pour TOUS les élèves du
 *    tableau (le bouton indique explicitement le nombre d'élèves).
 * ============================================================================
 */
import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Search, FileText, Download, UserPlus, Trash2, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import { loadPdfLibs } from "@/lib/exports/pdf-loader";
import { drawOfficialHeader, drawFooter, type SchoolHeader } from "@/lib/exports/finance-exports";

interface FicheTransfertModalProps { isOpen: boolean; onClose: () => void; level: "primaire" | "secondaire"; }

interface StudentItem {
  id: string; firstName: string; lastName: string; matricule?: string;
  studentCode?: string; className?: string; gender?: string;
  dateOfBirth?: string; placeOfBirth?: string;
  schoolLevelCode?: string; enrollmentDate?: string;
  // Editable fields per student
  classeSuivie?: string; classeASuivre?: string;
}

export default function FicheTransfertModal({ isOpen, onClose, level }: FicheTransfertModalProps) {
  const { tenant, academicYear, schoolLevel } = useModuleContext();
  const { user } = useAppSession();
  const [selectedStudents, setSelectedStudents] = useState<StudentItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<StudentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [motif, setMotif] = useState("");
  const [targetSchool, setTargetSchool] = useState("");
  const [directorName, setDirectorName] = useState("");
  const [censeurName, setCenseurName] = useState("");

  // Filter students by level
  const isSecondary = level === 'secondaire';
  const levelFilter = isSecondary ? 'SECONDAIRE' : null; // null = both maternelle + primaire

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear?.id || '', search: query, status: 'ACTIVE' });
      const res = await fetch(`/api/students?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      let list: StudentItem[] = Array.isArray(data) ? data : (data?.data || []);
      // Filter by level if needed
      if (levelFilter) {
        list = list.filter(s => {
          const sl = (s as any).schoolLevelCode || (s as any).schoolLevel?.code || '';
          return String(sl).toUpperCase().includes('SECOND');
        });
      } else {
        // Exclude secondary for primaire
        list = list.filter(s => {
          const sl = (s as any).schoolLevelCode || (s as any).schoolLevel?.code || '';
          return !String(sl).toUpperCase().includes('SECOND');
        });
      }
      const selectedIds = new Set(selectedStudents.map(s => s.id));
      setSearchResults(list.filter(s => !selectedIds.has(s.id)));
    } catch { setSearchResults([]); } finally { setSearching(false); }
  }, [academicYear?.id, selectedStudents, levelFilter]);

  useEffect(() => { const t = setTimeout(() => handleSearch(search), 300); return () => clearTimeout(t); }, [search, handleSearch]);

  const addStudent = (s: StudentItem) => {
    setSelectedStudents(prev => [...prev, {
      ...s,
      // ⭐ Pré-remplir classeSuivie avec la classe actuelle de l'élève
      // (classe qu'il a suivie dans l'ancienne école). classeASuivre reste
      // vide — l'utilisateur doit renseigner la classe que l'élève va faire
      // dans la nouvelle école.
      classeSuivie: s.className || '',
      classeASuivre: '',
    }]);
    setSearch(""); setSearchResults([]);
  };
  const removeStudent = (id: string) => setSelectedStudents(prev => prev.filter(s => s.id !== id));
  const updateStudentField = (id: string, field: string, value: string) =>
    setSelectedStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/identity', { credentials: "include" });
        if (res.ok) { const d = await res.json(); setDirectorName(d.directorName || d.director_name || ''); }
      } catch {}
    })();
  }, []);

  // ─── Fetch school logo as base64 ───
  const fetchLogoBase64 = async (logoUrl: string): Promise<string | null> => {
    try {
      const res = await fetch(logoUrl, { credentials: "include" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const handleGenerate = async () => {
    if (selectedStudents.length === 0) { toast.error("Sélectionnez au moins un élève"); return; }
    setGenerating(true);
    try {
      const { jsPDF } = await loadPdfLibs();
      let schoolInfo: any = {};
      try { const r = await fetch('/api/settings/identity', { credentials: 'include' }); if (r.ok) schoolInfo = await r.json(); } catch {}

      const logoUrl = schoolInfo.logoUrl || schoolInfo.logo || (tenant?.id ? `/api/tenants/${tenant.id}/logo` : null);
      let logoBase64: string | null = null;
      if (logoUrl) logoBase64 = await fetchLogoBase64(logoUrl);

      const header: SchoolHeader = {
        schoolName: schoolInfo.schoolName || schoolInfo.name || tenant?.name || 'Établissement',
        schoolLogoUrl: logoBase64,
        schoolAddress: schoolInfo.address || schoolInfo.schoolAddress || null,
        schoolPhone: schoolInfo.phone || schoolInfo.schoolPhone || null,
        schoolEmail: schoolInfo.email || schoolInfo.schoolEmail || null,
        schoolLevel: schoolLevel?.code || (isSecondary ? 'SECONDAIRE' : 'PRIMAIRE'),
      };

      if (level === 'primaire') {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        generatePrimairePDF(doc, header, selectedStudents, motif, targetSchool, directorName);
        doc.save('fiche_transfert_educmaster_primaire.pdf');
      } else {
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        generateSecondairePDF(doc, header, selectedStudents, motif, targetSchool, directorName, censeurName);
        doc.save('demande_transfert_secondaire.pdf');
      }
      toast.success(`✅ ${level === 'primaire' ? 'Fiche de transfert' : 'Demande de transfert'} générée pour ${selectedStudents.length} élève${selectedStudents.length > 1 ? 's' : ''}`);
    } catch (e: any) { console.error('PDF error:', e); toast.error("Erreur", { description: e.message }); }
    finally { setGenerating(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">{level === 'primaire' ? 'Fiche de Transfert (Primaire)' : 'Demande de Transfert (Secondaire)'}</h3>
              <p className="text-xs text-slate-500">{level === 'primaire' ? 'Modèle Educmaster' : 'Modèle Secondaire'} — {level === 'secondaire' ? 'Format Portrait' : 'Format Paysage'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Info banner : explique le fonctionnement */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Fonctionnement</p>
              <ol className="list-decimal ml-4 space-y-0.5 text-blue-800">
                <li>Recherchez et ajoutez les élèves à transférer (plusieurs possibles).</li>
                <li>Renseignez pour chaque élève la <b>classe suivie</b> dans l'ancienne école et la <b>classe à suivre</b> dans la nouvelle école.</li>
                <li>Le tableau accumule tous les élèves au fur et à mesure.</li>
                <li>Cliquez sur « Générer le PDF » pour produire <b>un document global</b> pour tous les élèves du tableau.</li>
              </ol>
            </div>
          </div>

          {/* School + motif fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nouvelle école (accueil)</label>
              <input type="text" value={targetSchool} onChange={e => setTargetSchool(e.target.value)} placeholder="Nom de l'école d'accueil..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Motif de transfert</label>
              <input type="text" value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: Déménagement familial..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          {/* Director + Censeur (for secondaire) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nom du Directeur</label>
              <input type="text" value={directorName} onChange={e => setDirectorName(e.target.value)} placeholder="Nom du directeur..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            {isSecondary && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nom du Censeur</label>
                <input type="text" value={censeurName} onChange={e => setCenseurName(e.target.value)} placeholder="Nom du censeur..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
            )}
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Rechercher et ajouter des élèves {levelFilter ? '(Secondaire uniquement)' : '(Maternelle/Primaire uniquement)'}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Tapez le nom ou matricule..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm" />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map(s => (
                  <button key={s.id} onClick={() => addStudent(s)} className="w-full flex items-center gap-2 p-2 hover:bg-blue-50 border-b border-slate-100 text-left">
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">{s.lastName} {s.firstName}</span>
                    <span className="text-xs text-slate-400">· {s.matricule || s.studentCode || '—'}</span>
                    {s.className && <span className="text-xs text-slate-400">· {s.className}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected students — TABLEAU ACCUMULATEUR */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-slate-700">
                Élèves sélectionnés ({selectedStudents.length})
              </label>
              {selectedStudents.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Vider le tableau de tous les élèves ?')) {
                      setSelectedStudents([]);
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Vider le tableau
                </button>
              )}
            </div>
            {selectedStudents.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                Aucun élève sélectionné. Recherchez et ajoutez des élèves ci-dessus — le tableau se remplit au fur et à mesure.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">N°</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Nom et prénom</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Matricule</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700" style={{ minWidth: 140 }}>
                        Classe suivie <span className="text-slate-400 font-normal">(ancienne école)</span>
                      </th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700" style={{ minWidth: 140 }}>
                        Classe à suivre <span className="text-slate-400 font-normal">(nouvelle école)</span>
                      </th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-700">✕</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudents.map((s, idx) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{s.lastName} {s.firstName}</td>
                        <td className="px-3 py-2 text-slate-600">{s.matricule || s.studentCode || '—'}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={s.classeSuivie || ''}
                            onChange={e => updateStudentField(s.id, 'classeSuivie', e.target.value)}
                            placeholder="Ex: CE2, CM1..."
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={s.classeASuivre || ''}
                            onChange={e => updateStudentField(s.id, 'classeASuivre', e.target.value)}
                            placeholder="Ex: CM1, CM2..."
                            className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeStudent(s.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer du tableau">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {selectedStudents.length > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                💡 Le PDF généréré contiendra <b>{selectedStudents.length} élève{selectedStudents.length > 1 ? 's' : ''}</b> dans un seul document.
                {level === 'secondaire' && ' (une page par élève pour le modèle secondaire)'}
              </p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">Annuler</button>
          <button
            onClick={handleGenerate}
            disabled={generating || selectedStudents.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating
              ? 'Génération...'
              : `Générer le PDF${selectedStudents.length > 0 ? ` (${selectedStudents.length} élève${selectedStudents.length > 1 ? 's' : ''})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Primaire PDF (landscape) ───
function generatePrimairePDF(doc: any, header: SchoolHeader, students: StudentItem[], motif: string, targetSchool: string, directorName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  drawOfficialHeader(doc, header, pageWidth, header.schoolLogoUrl || undefined);

  doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20);
  doc.text('FICHE DE TRANSFERT EDUCMASTER DES APPRENTIS', pageWidth / 2, 52, { align: 'center' });

  let y = 60;
  doc.setFontSize(9); doc.setFont('times', 'normal');
  doc.text(`ANCIENNE ECOLE : ${header.schoolName || ''}`, margin, y);
  doc.text(`NOUVELLE ECOLE : ${targetSchool || '................................'}`, pageWidth / 2 + 10, y);
  y += 10;

  // Table — 8 colonnes :
  // N° | ANNEE | CLASSE (suivie) | MATRICULE | NOM ET PRENOMS | ANNEE | CLASSE (à suivre) | ECOLE D'ACCUEIL
  const cols = [
    { l: 'N°', x: margin, w: 8 }, { l: 'ANNEE', x: margin + 8, w: 20 },
    { l: 'CLASSE', x: margin + 28, w: 18 }, { l: 'MATRICULE', x: margin + 46, w: 25 },
    { l: 'NOM ET PRENOMS', x: margin + 71, w: 52 },
    { l: 'ANNEE', x: margin + 123, w: 20 }, { l: 'CLASSE', x: margin + 143, w: 18 },
    { l: 'ECOLE D\'ACCUEIL', x: margin + 161, w: 62 },
  ];
  doc.setFillColor(30, 41, 59); doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(6); doc.setFont('times', 'bold');
  cols.forEach(c => doc.text(c.l, c.x + 1, y, { maxWidth: c.w - 2 }));
  doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
  doc.line(margin + 123, y - 4, margin + 123, y + 4 + Math.max(8, students.length) * 7);
  y += 6;
  doc.setTextColor(20, 20, 20); doc.setFont('times', 'normal'); doc.setFontSize(7);
  for (let i = 0; i < Math.max(8, students.length); i++) {
    const s = students[i]; const ry = y + i * 7;
    if (s) {
      const yr = new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
      doc.text(String(i + 1), cols[0].x + 1, ry);
      doc.text(yr, cols[1].x + 1, ry);
      // ⭐ Colonne CLASSE (gauche) = classe suivie dans l'ancienne école
      // (classeSuivie pré-remplie avec s.className, éditable par l'utilisateur)
      doc.text(s.classeSuivie || s.className || '', cols[2].x + 1, ry);
      doc.text(s.matricule || s.studentCode || '', cols[3].x + 1, ry);
      doc.text(`${s.lastName} ${s.firstName}`, cols[4].x + 1, ry, { maxWidth: cols[4].w - 2 });
      doc.text(yr, cols[5].x + 1, ry);
      // ⭐ Colonne CLASSE (droite) = classe à suivre dans la nouvelle école
      doc.text(s.classeASuivre || '', cols[6].x + 1, ry);
      doc.text(targetSchool, cols[7].x + 1, ry, { maxWidth: cols[7].w - 2 });
    }
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
    doc.line(margin, ry + 3, pageWidth - margin, ry + 3);
  }
  y += Math.max(8, students.length) * 7 + 5;

  doc.setFont('times', 'bold'); doc.setFontSize(9);
  doc.text('MOTIF VALABLE DE TRANSFERT', margin, y);
  doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.3);
  doc.rect(margin, y + 2, pageWidth - 2 * margin, 20);
  doc.setFont('times', 'normal'); doc.setFontSize(8);
  if (motif) { doc.splitTextToSize(motif, pageWidth - 2 * margin - 4).forEach((l: string, i: number) => doc.text(l, margin + 2, y + 8 + i * 4)); }
  y += 28;

  doc.setFontSize(9);
  doc.text(`Fait à ..........................................., le ......... / .......... /20.......`, margin, y);

  // ⭐ Zone de signature du Directeur : étiquette « Le Directeur » au-dessus,
  // nom en dessous (zone de signature) — pas sur la même ligne.
  const signatureX = pageWidth - margin - 50;
  const signatureY = y;
  doc.text('Le Directeur', signatureX, signatureY);
  // Laisser de l'espace pour la signature manuscrite
  doc.setFont('times', 'bold'); doc.setFontSize(10);
  doc.text(directorName || '...................................', signatureX, signatureY + 12);
  // Revenir à la police normale pour la suite éventuelle
  doc.setFont('times', 'normal'); doc.setFontSize(9);

  doc.setFontSize(6); doc.setTextColor(150, 150, 150);
  doc.text('FICHE DE TRANSFERT-POINT FOCAL/EDUCMASTER', margin, pageHeight - 5);
  drawFooter(doc, pageWidth, pageHeight, 1);
}

// ─── Secondaire PDF (PORTRAIT) ───
function generateSecondairePDF(doc: any, header: SchoolHeader, students: StudentItem[], motif: string, targetSchool: string, directorName: string, censeurName: string) {
  const pageWidth = doc.internal.pageSize.getWidth(); // ~210mm portrait
  const pageHeight = doc.internal.pageSize.getHeight(); // ~297mm portrait
  const margin = 15;

  students.forEach((student, idx) => {
    if (idx > 0) doc.addPage();
    drawOfficialHeader(doc, header, pageWidth, header.schoolLogoUrl || undefined);

    doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 20);
    doc.text('DEMANDE DE TRANSFERT', pageWidth / 2, 52, { align: 'center' });

    let y = 62;
    doc.setFontSize(9); doc.setFont('times', 'normal');
    doc.text(`N° Educmaster de l'élève : ${student.matricule || student.studentCode || '...........'}`, margin, y);
    doc.text(`ANNÉE SCOLAIRE : ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, pageWidth - margin - 55, y);
    y += 7;
    doc.text(`Nom et Prénom : ${student.lastName} ${student.firstName}`, margin, y);
    y += 6;
    doc.text(`Classe suivie : ${student.classeSuivie || student.className || '........................................'}`, margin, y);
    y += 6;
    doc.text(`Classe à suivre : ${student.classeASuivre || '........................................'}`, margin, y);
    y += 6;
    doc.text(`Motif de la demande : ${motif || '........................................'}`, margin, y, { maxWidth: pageWidth - 2 * margin });
    y += 10;

    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    const colW = (pageWidth - 2 * margin - 10) / 2;
    const leftX = margin, rightX = margin + colW + 10;

    // Left column
    doc.setFont('times', 'bold'); doc.setFontSize(9);
    doc.text('ÉTABLISSEMENT D\'ORIGINE', leftX, y);
    y += 8;
    doc.setFont('times', 'normal'); doc.setFontSize(8);
    doc.text('Signature de l\'élève :', leftX, y);
    y += 5;
    doc.text(`Etablissement d'origine : ${header.schoolName || '...........'}`, leftX, y);
    y += 5;
    doc.text(`Nom et Prénom du Censeur : ${censeurName || '................................'}`, leftX, y);
    y += 5;
    doc.text('Avis : Favorable ☐   Défavorable ☐', leftX, y);
    y += 8;
    doc.text('Signature : ................................', leftX, y);
    y += 5;
    doc.text('Cachet : ................................', leftX, y);
    y += 10;
    doc.text(`Fait à ................., le ....... / ....... / 20......`, leftX, y);

    // Right column — ÉTABLISSEMENT D'ACCUEIL
    let yr = y - 31;
    doc.setFont('times', 'bold'); doc.setFontSize(9);
    doc.text('ÉTABLISSEMENT D\'ACCUEIL', rightX, yr);
    yr += 8;
    doc.setFont('times', 'normal'); doc.setFontSize(8);
    doc.text('Nom et signature du père ou tuteur :', rightX, yr);
    yr += 5;
    doc.text(`Etablissement d'accueil : ${targetSchool || '...........'}`, rightX, yr);
    yr += 5;
    // ⭐ Nom du directeur : étiquette au-dessus, nom en dessous (zone de signature)
    doc.text('Nom et Prénom du Directeur :', rightX, yr);
    yr += 6;
    doc.setFont('times', 'bold');
    doc.text(directorName || '................................', rightX, yr);
    doc.setFont('times', 'normal');
    yr += 6;
    doc.text('Avis : ................................', rightX, yr);
    yr += 8;
    doc.text('Signature : ................................', rightX, yr);
    yr += 5;
    doc.text('Cachet : ................................', rightX, yr);
    yr += 10;
    doc.text('Date : ................................', rightX, yr);

    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3);
    doc.line(margin + colW + 5, y - 31, margin + colW + 5, y + 5);
    drawFooter(doc, pageWidth, pageHeight, idx + 1);
  });
}
