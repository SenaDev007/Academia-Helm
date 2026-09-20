"use client";

/**
 * ============================================================================
 * CERTIFICAT DE SCOLARITÉ — Génération PDF conforme au modèle officiel
 * ============================================================================
 * Corrigé : récupération classes, dates, lieu naissance, caractères propres.
 * ============================================================================
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Search, FileText, Download, Award, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";
import { loadPdfLibs } from "@/lib/exports/pdf-loader";
import { drawOfficialHeader, drawFooter, type SchoolHeader } from "@/lib/exports/finance-exports";

interface StudentRow {
  id: string; firstName: string; lastName: string;
  matricule?: string; studentCode?: string;
  gender?: string; dateOfBirth?: string; placeOfBirth?: string;
  className?: string; classLevel?: string;
  enrollmentDate?: string; status: string;
  schoolLevelCode?: string;
  studentEnrollments?: Array<{ class?: { name?: string }; enrolledAt?: string }>;
}

const MONTH_FR = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
function formatDateFR(d?: string | null): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTH_FR[date.getMonth() + 1]} ${date.getFullYear()}`;
}

export default function CertificateScolariteContent() {
  const { tenant, academicYear, schoolLevel } = useModuleContext();
  const { user } = useAppSession();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [directorName, setDirectorName] = useState("");

  // Load classes from /api/pedagogy/academic-structure/classes
  useEffect(() => {
    fetch(`/api/pedagogy/academic-structure/classes?academicYearId=${academicYear?.id || ''}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setClasses(Array.isArray(data) ? data : (data?.data || [])); })
      .catch(() => setClasses([]));
  }, [academicYear?.id]);

  const loadStudents = useCallback(async () => {
    if (!academicYear?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: academicYear.id, status: 'ACTIVE' });
      const res = await fetch(`/api/students?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load students");
      const data = await res.json();
      let list: StudentRow[] = Array.isArray(data) ? data : (data?.data || []);
      // Resolve className + enrollmentDate from studentEnrollments
      list = list.map(s => {
        const enrollment = s.studentEnrollments?.find(e => e.class?.name);
        return {
          ...s,
          className: s.className || enrollment?.class?.name || s.classLevel || '',
          enrollmentDate: s.enrollmentDate || enrollment?.enrolledAt || '',
        };
      });
      setStudents(list);
    } catch { setStudents([]); } finally { setLoading(false); }
  }, [academicYear?.id]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  useEffect(() => {
    (async () => {
      try { const r = await fetch('/api/settings/identity', { credentials: "include" }); if (r.ok) { const d = await r.json(); setDirectorName(d.directorName || d.director_name || ''); } } catch {}
    })();
  }, []);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (filterClass) result = result.filter(s => s.className === filterClass || (s as any).classId === filterClass);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s => `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) || (s.matricule || '').toLowerCase().includes(q));
    }
    return result;
  }, [students, search, filterClass]);

  const fetchLogoBase64 = async (url: string): Promise<string | null> => {
    try { const r = await fetch(url, { credentials: "include" }); if (!r.ok) return null; const b = await r.blob(); return new Promise(res => { const rd = new FileReader(); rd.onloadend = () => res(rd.result as string); rd.onerror = () => res(null); rd.readAsDataURL(b); }); } catch { return null; }
  };

  const handleGenerate = async (student: StudentRow) => {
    setGenerating(student.id);
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
        schoolLevel: schoolLevel?.code || 'PRIMAIRE',
      };

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      drawOfficialHeader(doc, header, pageWidth, logoBase64 || undefined);

      let y = 55;
      doc.setLineWidth(0.5);
      doc.rect(pageWidth / 2 - 45, y, 90, 10);
      doc.setFont('times', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 20, 20);
      doc.text('CERTIFICAT DE SCOLARITE', pageWidth / 2, y + 7, { align: 'center' });
      y += 20;

      doc.setFont('times', 'normal'); doc.setFontSize(11); doc.setTextColor(30, 30, 30);

      const studentName = `${student.lastName || ''} ${student.firstName || ''}`.trim();
      const birthPlace = student.placeOfBirth || '........................................';
      const birthDate = student.dateOfBirth ? formatDateFR(student.dateOfBirth) : '........................................';
      const matricule = student.matricule || student.studentCode || '........................................';
      const className = student.className || student.classLevel || '........................................';
      const enrollmentStart = student.enrollmentDate ? formatDateFR(student.enrollmentDate) : '........................................';
      const today = formatDateFR(new Date().toISOString());

      const lines = [
        `Le Directeur de l'École ${header.schoolName || ''}`,
        '',
        `Atteste que l'élève : ${studentName}`,
        '',
        `Né(e) à : ${birthPlace}`,
        `Le : ${birthDate}`,
        '',
        `Inscrit sous le N° Matricule : ${matricule}`,
        `a fréquenté l'École`,
        `du : ${enrollmentStart}    au : ${today}`,
        '',
        `Élève du cours : ${className}    depuis le : ${enrollmentStart}`,
        '',
        `et mérite les notes suivantes :`,
      ];
      lines.forEach(line => { doc.text(line, margin, y); y += 6; });

      y += 2;
      // Grades — use clean bullet character
      const grades = ['Assiduité', 'Conduite', 'Travail'];
      grades.forEach(g => {
        const label = `${g} : `;
        const labelW = doc.getTextWidth(label);
        const dotsStart = margin + 10 + labelW;
        const dotsEnd = pageWidth - margin - 10;
        doc.text(label, margin + 10, y);
        // Draw dotted line
        doc.setLineDashPattern([0.5, 0.5], 0);
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.2);
        doc.line(dotsStart, y - 1, dotsEnd, y - 1);
        doc.setLineDashPattern([], 0);
        y += 6;
      });

      y += 8;

      // Observations box
      doc.setFont('times', 'bold'); doc.setFontSize(11);
      doc.setLineWidth(0.5);
      doc.rect(pageWidth / 2 - 50, y, 100, 8);
      doc.text('OBSERVATIONS PARTICULIERES', pageWidth / 2, y + 5.5, { align: 'center' });
      y += 14;
      doc.setFont('times', 'normal'); doc.setFontSize(10);
      for (let i = 0; i < 3; i++) {
        doc.setLineDashPattern([0.5, 0.5], 0);
        doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.2);
        doc.line(margin, y - 1, pageWidth - margin, y - 1);
        doc.setLineDashPattern([], 0);
        y += 6;
      }
      y += 15;

      // Date & signature
      doc.setFontSize(11);
      doc.text(`${schoolInfo.city || ''}, le ....... / ....... / 20......`, pageWidth - margin - 70, y);
      y += 10;
      doc.setFont('times', 'bold');
      doc.text(`Le Directeur${directorName ? '\n' + directorName : ''}`, pageWidth - margin - 35, y);

      drawFooter(doc, pageWidth, pageHeight, 1);

      doc.save(`certificat_scolarite_${student.lastName}_${student.firstName}.pdf`);
      toast.success('Certificat de scolarité généré');
    } catch (e: any) { console.error('Certificate error:', e); toast.error("Erreur", { description: e.message }); }
    finally { setGenerating(null); }
  };

  const handleBatchGenerate = async () => {
    if (filteredStudents.length === 0) return;
    toast.info(`Génération de ${filteredStudents.length} certificats...`);
    for (const s of filteredStudents) { await handleGenerate(s); await new Promise(r => setTimeout(r, 500)); }
    toast.success(`${filteredStudents.length} certificats générés`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg"><Award className="h-5 w-5 text-blue-600" /></div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Certificat de Scolarité</h2>
            <p className="text-xs text-slate-500">{filteredStudents.length} élève(s) — Génération PDF conforme au modèle officiel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleBatchGenerate} disabled={filteredStudents.length === 0 || generating !== null} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold"><Download className="w-4 h-4" /> Tout générer</button>
          <button onClick={loadStudents} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100" title="Rafraîchir"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 p-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Rechercher par nom ou matricule..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        {classes.length > 0 && (
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium bg-white">
            <option value="">Toutes les classes</option>
            {classes.map((c: any) => <option key={c.id} value={c.name || c.className}>{c.name || c.className}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /><span className="ml-2 text-sm text-slate-500">Chargement…</span></div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center"><AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" /><p className="font-medium text-slate-600">Aucun élève trouvé</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-700">N°</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Nom et Prénom</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-700">Matricule</th>
              <th className="text-center px-4 py-3 font-semibold text-slate-700">Action</th>
            </tr></thead>
            <tbody>
              {filteredStudents.map((s, idx) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.lastName} {s.firstName}</td>
                  <td className="px-4 py-3 text-slate-600">{s.matricule || s.studentCode || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleGenerate(s)} disabled={generating === s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold">
                      {generating === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} Certificat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
