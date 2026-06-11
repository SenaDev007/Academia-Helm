/**
 * ReportCardsManagement Component
 * 
 * Gestion automatisée des bulletins et des moyennes.
 * Wired to /api/honor-rolls BFF routes.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  Award, 
  Download, 
  FileCheck, 
  AlertCircle, 
  Filter, 
  Search,
  ChevronRight,
  Printer,
  Loader2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useToast } from '@/components/ui/use-toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HonorRollRow {
  id: string;
  student?: string;
  studentName?: string;
  className?: string;
  class?: string;
  average?: number;
  gpa?: number;
  status?: string;
  rank?: string | number;
  [key: string]: unknown;
}

interface GeneratePayload {
  academicYearId: string;
  termId?: string;
  classId?: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReportCardsManagement() {
  const { academicYear } = useModuleContext();
  const yearId = academicYear?.id ?? '';
  const { toast } = useToast();

  const [reportCards, setReportCards] = useState<HonorRollRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    termId: '',
    classId: '',
  });

  /* ---------------------------------------------------------------- */
  /*  Fetch honor rolls                                                */
  /* ---------------------------------------------------------------- */

  const loadReportCards = useCallback(async () => {
    if (!yearId) return;
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ academicYearId: yearId });
      const data = await pedagogyFetch<HonorRollRow[]>(
        `/api/honor-rolls?${qs.toString()}`,
      );
      setReportCards(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setReportCards([]);
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de charger les bulletins.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [yearId, toast]);

  useEffect(() => {
    loadReportCards();
  }, [loadReportCards]);

  /* ---------------------------------------------------------------- */
  /*  Generate honor rolls                                             */
  /* ---------------------------------------------------------------- */

  const generateReportCards = async () => {
    if (!yearId) return;
    setGenerating(true);
    try {
      const body: GeneratePayload = { academicYearId: yearId };
      if (generateForm.termId.trim()) body.termId = generateForm.termId.trim();
      if (generateForm.classId.trim()) body.classId = generateForm.classId.trim();

      await pedagogyFetch('/api/honor-rolls/generate', {
        method: 'POST',
        body,
      });
      toast({ title: 'Succès', description: 'Bulletins générés avec succès.' });
      setGenerateModalOpen(false);
      await loadReportCards();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de générer les bulletins.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const studentName = (rc: HonorRollRow) =>
    rc.studentName ?? rc.student ?? '—';

  const studentClass = (rc: HonorRollRow) =>
    rc.className ?? rc.class ?? '—';

  const studentAverage = (rc: HonorRollRow) =>
    rc.average ?? rc.gpa ?? 0;

  const studentRank = (rc: HonorRollRow) => {
    if (rc.rank == null) return '—';
    if (typeof rc.rank === 'number') {
      const suffix = rc.rank === 1 ? 'er' : 'ème';
      return `${rc.rank}${suffix}`;
    }
    return rc.rank;
  };

  const statusLabel = (s?: string) => {
    switch (s) {
      case 'VALIDATED': return 'VALIDÉ';
      case 'GENERATED': return 'GÉNÉRÉ';
      case 'PENDING': return 'EN ATTENTE';
      default: return s ?? '—';
    }
  };

  const filteredCards = reportCards.filter((rc) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      studentName(rc).toLowerCase().includes(s) ||
      studentClass(rc).toLowerCase().includes(s)
    );
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Automation Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-indigo-600 rounded-[2rem] p-8 text-white shadow-xl flex items-center justify-between group overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-2xl font-black tracking-tighter">Générateur de Bulletins</h3>
            <p className="text-indigo-100 text-xs mt-1">Calcul automatique des moyennes et rangs du 2ème Trimestre.</p>
            <button 
              onClick={() => setGenerateModalOpen(true)}
              disabled={generating}
              className="mt-6 px-6 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm shadow-xl shadow-indigo-900/20 hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…
                </>
              ) : (
                'Lancer la génération'
              )}
            </button>
          </div>
          <Award className="w-32 h-32 text-white/10 absolute -right-4 -bottom-4 group-hover:rotate-12 transition-transform" />
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black tracking-tighter text-slate-900">Validation & Impression</h3>
            <p className="text-slate-400 text-xs mt-1">Générez des fichiers PDF certifiés avec QR Code pour les parents.</p>
            <div className="flex gap-2 mt-6">
              <button className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition-all">
                <Printer className="w-3 h-3" /> Imprimer tout
              </button>
              <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">
                Archiver
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* List Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Liste des Bulletins</h3>
            <div className="h-4 w-px bg-slate-200" />
            <p className="text-xs font-medium text-slate-400">Période : 2ème Trimestre 2025-2026</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input 
                placeholder="Filtrer..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] outline-none w-40" 
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span className="ml-3 text-sm text-slate-500">Chargement des bulletins…</span>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <FileCheck className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-medium">Aucun bulletin disponible.</p>
              <p className="text-xs mt-1">Lancez la génération pour créer les bulletins.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Élève</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Moyenne</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Rang</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCards.map((rc) => (
                  <tr key={rc.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{studentName(rc)}</p>
                      <p className="text-[10px] text-slate-400">{studentClass(rc)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm font-black",
                        studentAverage(rc) < 10 ? "text-rose-600" : "text-slate-900"
                      )}>
                        {studentAverage(rc).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500">{studentRank(rc)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold",
                        rc.status === 'VALIDATED' ? "bg-emerald-50 text-emerald-600" :
                        rc.status === 'GENERATED' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {statusLabel(rc.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all shadow-none hover:shadow-sm">
                        <Download className="w-4 h-4 text-slate-400 hover:text-indigo-600" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generate Modal */}
      {generateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              onClick={() => setGenerateModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            <h2 className="text-xl font-black text-slate-900 mb-6">Générer les bulletins</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trimestre (optionnel)</label>
                <input
                  value={generateForm.termId}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, termId: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ID du trimestre"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Classe (optionnel)</label>
                <input
                  value={generateForm.classId}
                  onChange={(e) => setGenerateForm((f) => ({ ...f, classId: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ID de la classe (vide = toutes)"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setGenerateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={generateReportCards}
                disabled={generating}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {generating && <Loader2 className="w-4 h-4 animate-spin" />}
                Générer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
