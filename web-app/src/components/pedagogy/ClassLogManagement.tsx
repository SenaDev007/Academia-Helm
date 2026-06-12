/**
 * ClassLogManagement Component
 * 
 * Cahier de textes digital. Gestion des séances, leçons et devoirs.
 * Wired to /api/class-diaries BFF routes.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { 
  BookOpen, 
  Plus, 
  CheckCircle2, 
  Clock, 
  FileText,
  Calendar,
  Search,
  Filter,
  Loader2,
  Trash2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pedagogyFetch } from '@/lib/pedagogy/academic-structure-client';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useToast } from '@/components/ui/use-toast';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClassDiaryRow {
  id: string;
  subject?: string;
  className?: string;
  topic?: string;
  date?: string;
  status?: string;
  homework?: string;
  [key: string]: unknown;
}

interface WeeklyOverviewItem {
  day: string;
  count: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ClassLogManagement() {
  const { academicYear } = useModuleContext();
  const yearId = academicYear?.id ?? '';
  const { toast } = useToast();

  const [logs, setLogs] = useState<ClassDiaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  /* Create / Edit modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ClassDiaryRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    className: '',
    topic: '',
    date: '',
    status: 'IN_PROGRESS',
    homework: '',
  });

  /* Weekly overview (derived from logs or separate endpoint) */
  const [weeklyOverview] = useState<WeeklyOverviewItem[]>([
    { day: 'Lundi', count: 0 },
    { day: 'Mardi', count: 0 },
    { day: 'Mercredi', count: 0 },
    { day: 'Jeudi', count: 0 },
    { day: 'Vendredi', count: 0 },
  ]);

  /* ---------------------------------------------------------------- */
  /*  Fetch class diaries                                              */
  /* ---------------------------------------------------------------- */

  const loadLogs = useCallback(async () => {
    if (!yearId) return;
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ academicYearId: yearId });
      const data = await pedagogyFetch<ClassDiaryRow[]>(
        `/api/class-diaries?${qs.toString()}`,
      );
      setLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLogs([]);
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de charger les cahiers de textes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [yearId, toast]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  /* ---------------------------------------------------------------- */
  /*  Create / Update                                                  */
  /* ---------------------------------------------------------------- */

  const openCreateModal = () => {
    setEditingLog(null);
    setForm({
      subject: '',
      className: '',
      topic: '',
      date: new Date().toISOString().slice(0, 10),
      status: 'IN_PROGRESS',
      homework: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (log: ClassDiaryRow) => {
    setEditingLog(log);
    setForm({
      subject: log.subject ?? '',
      className: log.className ?? '',
      topic: log.topic ?? '',
      date: log.date ?? '',
      status: log.status ?? 'IN_PROGRESS',
      homework: log.homework ?? '',
    });
    setModalOpen(true);
  };

  const saveLog = async () => {
    if (!yearId) return;
    if (!form.topic.trim()) {
      toast({ title: 'Erreur', description: 'Le sujet de la séance est requis.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        academicYearId: yearId,
        subject: form.subject.trim(),
        className: form.className.trim(),
        topic: form.topic.trim(),
        date: form.date || undefined,
        status: form.status,
        homework: form.homework.trim() || undefined,
      };

      if (editingLog) {
        await pedagogyFetch(`/api/class-diaries/${editingLog.id}`, {
          method: 'PUT',
          body,
        });
        toast({ title: 'Succès', description: 'Cahier de textes mis à jour.' });
      } else {
        await pedagogyFetch('/api/class-diaries', {
          method: 'POST',
          body,
        });
        toast({ title: 'Succès', description: 'Cahier de textes créé.' });
      }
      setModalOpen(false);
      await loadLogs();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible d\'enregistrer.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Delete                                                           */
  /* ---------------------------------------------------------------- */

  const deleteLog = async (id: string) => {
    try {
      await pedagogyFetch(`/api/class-diaries/${id}`, { method: 'DELETE' });
      toast({ title: 'Succès', description: 'Cahier de textes supprimé.' });
      await loadLogs();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: (e as Error).message || 'Impossible de supprimer.',
        variant: 'destructive',
      });
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const displayDate = (d?: string) => {
    if (!d) return '';
    try {
      const dt = new Date(d);
      const today = new Date();
      if (dt.toDateString() === today.toDateString()) return "Aujourd'hui";
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (dt.toDateString() === yesterday.toDateString()) return 'Hier';
      return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return d;
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      (log.topic ?? '').toLowerCase().includes(s) ||
      (log.subject ?? '').toLowerCase().includes(s) ||
      (log.className ?? '').toLowerCase().includes(s) ||
      (log.homework ?? '').toLowerCase().includes(s)
    );
  });

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Rechercher une séance ou une leçon..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all">
            <Filter className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/10"
        >
          <Plus className="w-4 h-4" /> Remplir Cahier de Textes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Timeline of Sessions */}
        <div className="lg:col-span-3 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <span className="ml-3 text-sm text-slate-500">Chargement des cahiers de textes…</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <BookOpen className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-sm font-medium">Aucun cahier de textes trouvé.</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-start gap-6 group">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-2 transition-transform group-hover:scale-110",
                    log.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                  )}>
                    {log.status === 'COMPLETED' ? <CheckCircle2 className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div className="w-0.5 h-full bg-slate-100 group-last:hidden" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-lg font-black text-slate-900">{log.topic || 'Sans titre'}</h4>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{displayDate(log.date)}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    {log.subject && <span className="text-xs font-bold text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-md uppercase">{log.subject}</span>}
                    {log.className && <span className="text-xs font-medium text-slate-400">{log.className}</span>}
                  </div>
                  {log.homework && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Travail à faire (Devoirs)
                      </p>
                      <p className="text-sm font-medium text-slate-700">{log.homework}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => openEditModal(log)}
                    className="p-2 hover:bg-slate-50 rounded-xl transition-colors" 
                    title="Modifier"
                  >
                    <Clock className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                  </button>
                  <button 
                    onClick={() => deleteLog(log.id)}
                    className="p-2 hover:bg-rose-50 rounded-xl transition-colors" 
                    title="Supprimer"
                  >
                    <Trash2 className="w-5 h-5 text-slate-300 hover:text-rose-500" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right: Quick Stats & Calendar */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" /> Aperçu Hebdomadaire
              </h3>
              <div className="space-y-4">
                {weeklyOverview.map((d, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-16">{d.day}</span>
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(d.count / 8) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-bold">{d.count}h</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
            <h2 className="text-xl font-black text-slate-900 mb-6">
              {editingLog ? 'Modifier la séance' : 'Nouvelle séance'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Matière</label>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ex: Mathématiques"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Classe</label>
                <input
                  value={form.className}
                  onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ex: Terminale C"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sujet de la séance *</label>
                <input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="ex: Intégrales définies"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statut</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                >
                  <option value="IN_PROGRESS">En cours</option>
                  <option value="COMPLETED">Terminé</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Devoirs</label>
                <textarea
                  value={form.homework}
                  onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  placeholder="ex: Ex. 4, 5 p. 112"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={saveLog}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingLog ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
