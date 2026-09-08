"use client";

/**
 * ============================================================================
 * FICHE DE TRANSFERT — Modal de génération PDF
 * ============================================================================
 *
 * Deux modèles :
 *   1. Primaire : « FICHE DE TRANSFERT EDUCMASTER DES APPRENTIS »
 *      - Tableau 2 sections (Ancienne École | Nouvelle École)
 *      - 8 lignes pour les élèves
 *      - Motif valable de transfert
 *      - Signature du Directeur
 *
 *   2. Secondaire : « DEMANDE DE TRANSFERT »
 *      - Informations élève (matricule, nom, classe suivie, classe à suivre)
 *      - 2 colonnes : Établissement d'origine | Établissement d'accueil
 *      - Signatures : élève, parent, censeur, directeur
 *
 * Les données sont récupérées dynamiquement : sélection d'élèves →
 * remplissage automatique du tableau.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  X, Loader2, Search, FileText, Download, UserPlus, Trash2,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import { loadPdfLibs } from "@/lib/exports/pdf-loader";
import { drawOfficialHeader, drawFooter, type SchoolHeader } from "@/lib/exports/finance-exports";

interface FicheTransfertModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: "primaire" | "secondaire";
}

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  matricule?: string;
  studentCode?: string;
  className?: string;
  gender?: string;
}

const MONTH_NAMES_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

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

  // ─── Search students ───
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        academicYearId: academicYear?.id || '',
        search: query,
        status: 'ACTIVE',
      });
      const res = await fetch(`/api/students?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.data || []);
      // Filter out already selected
      const selectedIds = new Set(selectedStudents.map(s => s.id));
      setSearchResults(list.filter((s: StudentItem) => !selectedIds.has(s.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [academicYear?.id, selectedStudents]);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search, handleSearch]);

  const addStudent = (student: StudentItem) => {
    setSelectedStudents(prev => [...prev, student]);
    setSearch("");
    setSearchResults([]);
  };

  const removeStudent = (id: string) => {
    setSelectedStudents(prev => prev.filter(s => s.id !== id));
  };

  // ─── Generate PDF ───
  const handleGenerate = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Sélectionnez au moins un élève");
      return;
    }
    setGenerating(true);
    try {
      const { jsPDF } = await loadPdfLibs();

      let schoolInfo: any = {};
      try {
        const idRes = await fetch('/api/settings/identity', { credentials: 'include' });
        if (idRes.ok) schoolInfo = await idRes.json();
      } catch {}

      const header: SchoolHeader = {
        schoolName: schoolInfo.schoolName || schoolInfo.name || tenant?.name || 'Établissement',
        schoolLogoUrl: schoolInfo.logoUrl || schoolInfo.logo || (tenant?.id ? `/api/tenants/${tenant.id}/logo` : null),
        schoolAddress: schoolInfo.address || schoolInfo.schoolAddress || null,
        schoolPhone: schoolInfo.phone || schoolInfo.schoolPhone || null,
        schoolEmail: schoolInfo.email || schoolInfo.schoolEmail || null,
        schoolLevel: schoolLevel?.code || (level === 'secondaire' ? 'SECONDAIRE' : 'PRIMAIRE'),
      };

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;

      if (level === 'primaire') {
        generatePrimairePDF(doc, header, selectedStudents, motif, targetSchool, pageWidth, pageHeight, margin);
      } else {
        generateSecondairePDF(doc, header, selectedStudents, motif, targetSchool, pageWidth, pageHeight, margin);
      }

      const fileName = level === 'primaire'
        ? `fiche_transfert_educmaster_primaire.pdf`
        : `demande_transfert_secondaire.pdf`;
      doc.save(fileName);
      toast.success(`✅ ${level === 'primaire' ? 'Fiche de transfert' : 'Demande de transfert'} générée`);
    } catch (e: any) {
      console.error('PDF generation error:', e);
      toast.error("Erreur de génération", { description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {level === 'primaire' ? 'Fiche de Transfert (Primaire)' : 'Demande de Transfert (Secondaire)'}
              </h3>
              <p className="text-xs text-slate-500">Génération PDF conforme au modèle officiel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Target school + motif */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Nouvelle école (accueil)</label>
              <input
                type="text"
                value={targetSchool}
                onChange={(e) => setTargetSchool(e.target.value)}
                placeholder="Nom de l'école d'accueil..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Motif de transfert</label>
              <input
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex: Déménagement familial..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Student search */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Rechercher et ajouter des élèves</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tapez le nom ou matricule de l'élève..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((student) => (
                  <button
                    key={student.id}
                    onClick={() => addStudent(student)}
                    className="w-full flex items-center justify-between p-2 hover:bg-blue-50 border-b border-slate-100 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-slate-700">
                        {student.lastName} {student.firstName}
                      </span>
                      <span className="text-xs text-slate-400">· {student.matricule || student.studentCode || '—'}</span>
                      {student.className && <span className="text-xs text-slate-400">· {student.className}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected students list */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Élèves sélectionnés ({selectedStudents.length})
            </label>
            {selectedStudents.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                Aucun élève sélectionné. Recherchez ci-dessus pour ajouter.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">N°</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Nom et Prénom</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Matricule</th>
                      <th className="text-left px-3 py-2 font-semibold text-slate-700">Classe</th>
                      <th className="text-center px-3 py-2 font-semibold text-slate-700">Retirer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudents.map((student, idx) => (
                      <tr key={student.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{student.lastName} {student.firstName}</td>
                        <td className="px-3 py-2 text-slate-600">{student.matricule || student.studentCode || '—'}</td>
                        <td className="px-3 py-2 text-slate-600">{student.className || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => removeStudent(student.id)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg">
            Annuler
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || selectedStudents.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Générer le PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PDF Generators ───

function generatePrimairePDF(
  doc: any, header: SchoolHeader, students: StudentItem[],
  motif: string, targetSchool: string,
  pageWidth: number, pageHeight: number, margin: number,
) {
  drawOfficialHeader(doc, header, pageWidth);

  // Title
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text('FICHE DE TRANSFERT EDUCMASTER DES APPRENTIS', pageWidth / 2, 52, { align: 'center' });

  // Header fields
  doc.setFontSize(9);
  doc.setFont('times', 'normal');
  const schoolName = header.schoolName || '';
  const target = targetSchool || '................................';
  let y = 60;
  doc.text(`ANCIENNE ECOLE : ${schoolName}`, margin, y);
  doc.text(`NOUVELLE ECOLE : ${target}`, pageWidth / 2 + 10, y);
  y += 8;

  // Table headers
  const cols = [
    { label: 'N°', x: margin, w: 8 },
    { label: 'ANNEE SCOLAIRE', x: margin + 8, w: 22 },
    { label: 'CLASSE', x: margin + 30, w: 18 },
    { label: 'N° MATRICULE', x: margin + 48, w: 25 },
    { label: 'NOM ET PRENOMS', x: margin + 73, w: 50 },
    { label: 'ANNEE SCOL.', x: margin + 123, w: 22 },
    { label: 'CLASSE', x: margin + 145, w: 18 },
    { label: 'ECOLE D\'ACCUEIL', x: margin + 163, w: 60 },
  ];

  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont('times', 'bold');
  cols.forEach(col => {
    doc.text(col.label, col.x + 1, y, { maxWidth: col.w - 2 });
  });
  // Vertical divider between old/new school
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(margin + 123, y - 4, margin + 123, y + 4 + students.length * 7);
  y += 6;

  // Rows
  doc.setTextColor(20, 20, 20);
  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  const maxRows = Math.max(8, students.length);
  for (let i = 0; i < maxRows; i++) {
    const s = students[i];
    const rowY = y + i * 7;
    if (i < students.length) {
      const year = new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);
      doc.text(String(i + 1), cols[0].x + 1, rowY);
      doc.text(year, cols[1].x + 1, rowY);
      doc.text(s.className || '', cols[2].x + 1, rowY);
      doc.text(s.matricule || s.studentCode || '', cols[3].x + 1, rowY);
      doc.text(`${s.lastName} ${s.firstName}`, cols[4].x + 1, rowY, { maxWidth: cols[4].w - 2 });
      doc.text(year, cols[5].x + 1, rowY);
      doc.text(s.className || '', cols[6].x + 1, rowY);
      doc.text(targetSchool, cols[7].x + 1, rowY, { maxWidth: cols[7].w - 2 });
    }
    // Row border
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(margin, rowY + 3, pageWidth - margin, rowY + 3);
  }

  y += maxRows * 7 + 5;

  // Motif box
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.text('MOTIF VALABLE DE TRANSFERT', margin, y);
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.rect(margin, y + 2, pageWidth - 2 * margin, 20);
  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  if (motif) {
    const lines = doc.splitTextToSize(motif, pageWidth - 2 * margin - 4);
    lines.forEach((line: string, i: number) => {
      doc.text(line, margin + 2, y + 8 + i * 4);
    });
  }
  y += 28;

  // Date & signature
  doc.setFontSize(9);
  doc.text(`Fait à ..........................................., le ......... / .......... /20.......`, margin, y);
  doc.text(`Le Directeur..........`, pageWidth - margin - 40, y);

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text('FICHE DE TRANSFERT-POINT FOCAL/EDUCMASTER', margin, pageHeight - 5);

  drawFooter(doc, pageWidth, pageHeight, 1);
}

function generateSecondairePDF(
  doc: any, header: SchoolHeader, students: StudentItem[],
  motif: string, targetSchool: string,
  pageWidth: number, pageHeight: number, margin: number,
) {
  // Generate one page per student
  students.forEach((student, idx) => {
    if (idx > 0) doc.addPage();
    drawOfficialHeader(doc, header, pageWidth);

    // Title
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 20);
    doc.text('DEMANDE DE TRANSFERT', pageWidth / 2, 52, { align: 'center' });

    let y = 62;
    doc.setFontSize(10);
    doc.setFont('times', 'normal');

    // Student info
    doc.text(`N° Educmaster de l'élève : ${student.matricule || student.studentCode || '...........'}`, margin, y);
    doc.text(`ANNÉE SCOLAIRE : ${new Date().getFullYear()}-${new Date().getFullYear() + 1}`, pageWidth - margin - 60, y);
    y += 8;
    doc.text(`Nom et Prénom : ${student.lastName} ${student.firstName}`, margin, y);
    y += 6;
    doc.text(`Classe suivie : ${student.className || '...........'}`, margin, y);
    y += 6;
    doc.text(`Classe à suivre : ........................................`, margin, y);
    y += 6;
    doc.text(`Motif de la demande : ${motif || '........................................'}`, margin, y, { maxWidth: pageWidth - 2 * margin });
    y += 10;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Two columns
    const colW = (pageWidth - 2 * margin - 10) / 2;
    const leftX = margin;
    const rightX = margin + colW + 10;

    // Left column (Origin)
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text('ÉTABLISSEMENT D\'ORIGINE', leftX, y);
    y += 8;
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text(`Signature de l'élève :`, leftX, y);
    y += 5;
    doc.text(`Etablissement d'origine : ${header.schoolName || '...........'}`, leftX, y);
    y += 5;
    doc.text(`Nom et Prénom du Censeur : ................................`, leftX, y);
    y += 5;
    doc.text(`Avis : Favorable ☐  Défavorable ☐`, leftX, y);
    y += 8;
    doc.text(`Signature : ................................`, leftX, y);
    y += 5;
    doc.text(`Cachet : ................................`, leftX, y);
    y += 10;
    doc.text(`Parakou, le ....... / ....... / 20......`, leftX, y);

    // Right column (Accueil)
    let yr = y - 31;
    doc.setFont('times', 'bold');
    doc.setFontSize(9);
    doc.text('ÉTABLISSEMENT D\'ACCUEIL', rightX, yr);
    yr += 8;
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text(`Nom et signature du père ou tuteur :`, rightX, yr);
    yr += 5;
    doc.text(`Etablissement d'accueil : ${targetSchool || '...........'}`, rightX, yr);
    yr += 5;
    doc.text(`Nom et Prénom du Directeur : ................................`, rightX, yr);
    yr += 5;
    doc.text(`Avis : ................................`, rightX, yr);
    yr += 8;
    doc.text(`Signature : ................................`, rightX, yr);
    yr += 5;
    doc.text(`Cachet : ................................`, rightX, yr);
    yr += 10;
    doc.text(`Date : ................................`, rightX, yr);

    // Vertical divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin + colW + 5, y - 31, margin + colW + 5, y + 5);

    drawFooter(doc, pageWidth, pageHeight, idx + 1);
  });
}
