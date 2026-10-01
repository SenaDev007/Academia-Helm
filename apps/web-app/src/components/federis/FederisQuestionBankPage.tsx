/**
 * FederisQuestionBankPage — Banque des Épreuves (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * Cahier des charges §7.7 : gestion centralisée et sécurisée des sujets
 * d'examens — accès restreint, verrouillage avant les épreuves, traçabilité.
 *
 * ⭐ VRAIES DONNÉES PERSISTÉES (2026-09-28) — remplace l'ancienne page de
 *    démonstration (mock) : CRUD complet via l'API Federis
 *    (table question_bank_resources) :
 *      GET    /federis/patronat/question-bank      — épreuves recensées
 *      POST   /federis/patronat/question-bank      — recenser une épreuve
 *      PATCH  /federis/patronat/question-bank/:id  — statut / accès
 *      DELETE /federis/patronat/question-bank/:id  — retirer une épreuve
 *
 * ⭐ 2026-09-29 (refonte) — le module accueille également le CATALOGUE des
 *    épreuves (déplacé depuis « Épreuves et documents ») : deux onglets —
 *      1. « RESSOURCES » : sujets recensés et sécurisés (existant) ;
 *      2. « CATALOGUE » : épreuves du patronat classées par année scolaire
 *         puis par examen (CEP / BEPC / Baccalauréat / CAP) — lien croisé
 *         vers l'éditeur (/documents?edit=<id>) + téléchargement PDF.
 *
 * Rôles : lecture pour tous les membres ; gestion réservée au
 * COORDONNATEUR et à l'ORGANISATEUR (garde API → canManage).
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { federisLink } from '@/lib/federis/useFederisPath';
import { FedPage } from '@/components/federis/federis-motion';
// ★ 2026-10-01 — AGRÉGATION NATIONALE : périmètre (lecture seule sauf délégation)
import { useFederisScope } from '@/lib/federis/scope-context';

interface BankResource {
  id: string;
  title: string;
  description: string | null;
  resourceType: string;
  resourceTypeLabel: string;
  subject: string | null;
  classLevel: string | null;
  examType: string | null;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  accessLevel: string;
  accessLevelLabel: string;
  status: string;
  downloadCount: number;
  uploadedAt: string;
}

interface Catalog {
  resourceTypes: Array<{ key: string; label: string }>;
  statuses: string[];
  accessLevels: Array<{ key: string; label: string }>;
}

// ── Catalogue des épreuves (déplacé du module « Épreuves et documents ») ────

interface CatalogueEpreuve {
  id: string;
  academicYearId: string;
  academicYearLabel: string | null;
  examCategory: string;
  examCategoryLabel: string;
  subject: string | null;
  title: string;
  sessionLabel: string | null;
  durationLabel: string | null;
  status: string;
  statusLabel: string;
}

interface CatalogueYear {
  academicYearId: string;
  label: string;
  isActive: boolean;
  total: number;
  categories: { code: string; label: string; count: number }[];
}

interface CatalogueResponse {
  categories: { code: string; label: string; fullLabel: string }[];
  years: CatalogueYear[];
  network: { patronatId: string; name: string; territory: string | null; totalEpreuves: number }[] | null;
  orgLevel: string;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-slate-100 text-slate-600' },
  VALIDATED: { label: 'Validé', className: 'bg-green-50 text-green-700' },
  LOCKED: { label: 'Verrouillé', className: 'bg-red-50 text-red-700' },
  ARCHIVED: { label: 'Archivé', className: 'bg-gray-100 text-gray-500' },
};

const EMPTY_FORM = {
  title: '',
  subject: '',
  classLevel: '',
  examType: '',
  resourceType: 'EXAM_PAPER',
  accessLevel: 'RESTRICTED',
  description: '',
  fileUrl: '',
};

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 Mo

export default function FederisQuestionBankPage() {
  // ── Onglet actif : Ressources (sujets recensés) | Catalogue (épreuves) ──
  const [tab, setTab] = useState<'ressources' | 'catalogue'>('ressources');

  const [resources, setResources] = useState<BankResource[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [canManage, setCanManage] = useState(false);
  // ★ 2026-10-01 — AGRÉGATION NATIONALE : lecture seule sauf délégation
  const { canWrite: scopeCanWrite } = useFederisScope();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── Catalogue (épreuves du patronat — année → examen → épreuves) ────────
  const [catalogue, setCatalogue] = useState<CatalogueResponse | null>(null);
  const [catalogueEpreuves, setCatalogueEpreuves] = useState<CatalogueEpreuve[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [openYear, setOpenYear] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Filtres (côté client — sujet, niveau, type)
  const [filterSubject, setFilterSubject] = useState('Tous les sujets');
  const [search, setSearch] = useState('');

  // Formulaire de recensement
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [fileReading, setFileReading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/federis/patronat/question-bank', { timeout: 20000 });
      setResources(res.data?.resources ?? []);
      setCatalog(res.data?.catalog ?? null);
      setCanManage(Boolean(res.data?.canManage));
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Impossible de charger la banque d\u2019épreuves. Veuillez réessayer.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Catalogue : chargement à la demande (onglet « Catalogue ») ──────────
  const loadCatalogue = useCallback(async () => {
    setCatalogueLoading(true);
    try {
      const [cat, list] = await Promise.all([
        apiClient.get('/federis/patronat/epreuves/catalogue', { timeout: 30000 }),
        apiClient.get('/federis/patronat/epreuves', { timeout: 30000 }),
      ]);
      setCatalogue(cat.data ?? null);
      setCatalogueEpreuves(list.data?.epreuves ?? []);
      // Ouvre par défaut la première année (l'active ou la plus récente)
      const years: CatalogueYear[] = cat.data?.years ?? [];
      if (years.length > 0) {
        setOpenYear(
          (prev) => prev ?? (years.find((y) => y.isActive)?.academicYearId ?? years[0].academicYearId),
        );
      }
    } catch {
      setCatalogue(null);
      setCatalogueEpreuves([]);
    } finally {
      setCatalogueLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'catalogue' && !catalogue && !catalogueLoading) void loadCatalogue();
  }, [tab, catalogue, catalogueLoading, loadCatalogue]);

  // ── Catalogue : téléchargement PDF d'une épreuve (génération backend) ────
  const downloadEpreuvePdf = async (epreuve: CatalogueEpreuve) => {
    setDownloadingPdf(epreuve.id);
    setNotice(null);
    setError(null);
    try {
      const res = await apiClient.get(`/federis/patronat/epreuves/${epreuve.id}/pdf`, {
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `epreuve-${epreuve.subject || epreuve.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotice(`Téléchargement de « ${epreuve.title} » lancé.`);
    } catch (err: any) {
      let text: string | null = null;
      if (err?.response?.data instanceof Blob) {
        try {
          text = (await err.response.data.text()).slice(0, 300);
          const parsed = JSON.parse(text);
          text = parsed?.message ?? text;
        } catch {
          /* garde le brut */
        }
      }
      setError(text ?? 'Génération du PDF impossible.');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const subjects = useMemo(() => {
    const set = new Set<string>();
    resources.forEach((r) => {
      if (r.subject) set.add(r.subject);
    });
    return ['Tous les sujets', ...Array.from(set).sort()];
  }, [resources]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (filterSubject !== 'Tous les sujets' && r.subject !== filterSubject) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = `${r.title} ${r.subject ?? ''} ${r.classLevel ?? ''} ${r.examType ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [resources, filterSubject, search]);

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setFormErrors((e) => ({ ...e, fileUrl: 'Fichier trop lourd (8 Mo maximum).' }));
      return;
    }
    setFileReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Lecture impossible'));
        reader.readAsDataURL(file);
      });
      setForm((f) => ({ ...f, fileUrl: dataUrl }));
      setFormErrors((e) => ({ ...e, fileUrl: '' }));
    } catch {
      setFormErrors((e) => ({ ...e, fileUrl: 'Lecture du fichier impossible.' }));
    } finally {
      setFileReading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim() || form.title.trim().length < 3)
      errs.title = 'Le titre est requis (3 caractères minimum)';
    if (!form.fileUrl) errs.fileUrl = 'Le document est requis (fichier ou URL https)';
    setFormErrors(errs);
    if (Object.keys(errs).some((k) => errs[k])) return;

    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(
        '/federis/patronat/question-bank',
        {
          title: form.title.trim(),
          resourceType: form.resourceType,
          fileUrl: form.fileUrl,
          accessLevel: form.accessLevel,
          ...(form.subject.trim() ? { subject: form.subject.trim() } : {}),
          ...(form.classLevel.trim() ? { classLevel: form.classLevel.trim() } : {}),
          ...(form.examType.trim() ? { examType: form.examType.trim() } : {}),
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
        },
        { timeout: 60000 },
      );
      setNotice(`« ${form.title.trim()} » recensé dans la banque d'épreuves.`);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Recensement impossible.';
      setFormErrors({ submit: Array.isArray(msg) ? msg.join(' ') : String(msg) });
    } finally {
      setCreating(false);
    }
  };

  const changeStatus = async (resource: BankResource, status: string) => {
    setError(null);
    setNotice(null);
    try {
      await apiClient.patch(
        `/federis/patronat/question-bank/${resource.id}`,
        { status },
        { timeout: 20000 },
      );
      setNotice(
        status === 'LOCKED'
          ? `« ${resource.title} » verrouillé — accès bloqué jusqu'à délibération.`
          : status === 'VALIDATED'
            ? `« ${resource.title} » validé.`
            : `« ${resource.title} » remis en brouillon.`,
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Modification impossible.');
    }
  };

  const handleDelete = async (resource: BankResource) => {
    if (!window.confirm(`Retirer « ${resource.title} » de la banque d'épreuves ?`)) return;
    setError(null);
    setNotice(null);
    try {
      await apiClient.delete(`/federis/patronat/question-bank/${resource.id}`, { timeout: 20000 });
      setNotice(`« ${resource.title} » retiré de la banque.`);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Suppression impossible.');
    }
  };

  // ★ Droit effectif : garde API ET périmètre (national = lecture seule sauf délégation)
  const canManageNow = canManage && scopeCanWrite;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-72 bg-blue-100 rounded-full" />
        <div className="fed-card h-40" />
        <div className="fed-card h-72" />
      </div>
    );
  }

  return (
    <FedPage className="space-y-8">
      {/* Header — style Helm : titre + description + action, sans panneau sombre */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Banque des Épreuves
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl leading-relaxed">
            Sujets d&apos;examens et épreuves officielles du patronat.
          </p>
        </div>

        {canManageNow && tab === 'ressources' && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="fed-btn-gold px-4 py-2.5 text-sm flex-shrink-0"
          >
            <AppIcon name={showCreate ? 'close' : 'add'} size="submenu" />
            {showCreate ? 'Annuler' : 'Proposer un Sujet'}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-6 py-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {/* ⭐ Onglets segmentés (pattern Helm) : Ressources | Catalogue */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('ressources')}
          className={cn(
            'px-5 py-2 rounded-lg text-xs transition-all',
            tab === 'ressources'
              ? 'bg-white shadow-sm text-blue-900 font-bold'
              : 'text-slate-500 font-semibold hover:text-blue-900',
          )}
        >
          Ressources
        </button>
        <button
          type="button"
          onClick={() => setTab('catalogue')}
          className={cn(
            'px-5 py-2 rounded-lg text-xs transition-all',
            tab === 'catalogue'
              ? 'bg-white shadow-sm text-blue-900 font-bold'
              : 'text-slate-500 font-semibold hover:text-blue-900',
          )}
        >
          Catalogue
        </button>
      </div>

      {/* Formulaire de recensement (coordonnateur / organisateur) */}
      {tab === 'ressources' && showCreate && canManageNow && (
        <form onSubmit={handleCreate} className="fed-card p-8 space-y-6">
          <h3 className="text-sm font-bold text-blue-900 uppercase">
            Recenser une épreuve
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={cn(
                  'fed-input-light px-4 py-3 font-semibold',
                  formErrors.title && '!border-red-400',
                )}
                placeholder="Ex : Mathématiques — BAC D 2027 (session principale)"
              />
              {formErrors.title && <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Type de ressource <span className="text-red-500">*</span>
              </label>
              <select
                value={form.resourceType}
                onChange={(e) => setForm({ ...form, resourceType: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              >
                {(catalog?.resourceTypes ?? [{ key: 'EXAM_PAPER', label: "Sujet d'examen" }]).map(
                  (t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Matière
              </label>
              <input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="Ex : Mathématiques"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Classe / niveau
              </label>
              <input
                value={form.classLevel}
                onChange={(e) => setForm({ ...form, classLevel: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="Ex : BAC D, BEPC, CEP"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Session / type d&apos;examen
              </label>
              <input
                value={form.examType}
                onChange={(e) => setForm({ ...form, examType: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
                placeholder="Ex : Session 2027"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Niveau d&apos;accès
              </label>
              <select
                value={form.accessLevel}
                onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold"
              >
                {(catalog?.accessLevels ?? [{ key: 'RESTRICTED', label: 'Accès restreint' }]).map(
                  (l) => (
                    <option key={l.key} value={l.key}>
                      {l.label}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Document (PDF, image…) — ou URL https <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <input
                  value={form.fileUrl.startsWith('data:') ? '' : form.fileUrl}
                  onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                  className={cn(
                    'fed-input-light px-4 py-3 font-semibold',
                    formErrors.fileUrl && '!border-red-400',
                  )}
                  placeholder="https://… (si le document est hébergé)"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleFile(file);
                      e.target.value = '';
                    }}
                    className="text-sm text-slate-500 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-800 file:text-xs file:font-semibold"
                  />
                  {fileReading && <span className="text-xs text-slate-400">Lecture…</span>}
                  {form.fileUrl.startsWith('data:') && (
                    <span className="text-xs font-bold text-green-700">✓ Fichier chargé</span>
                  )}
                </div>
                {formErrors.fileUrl && (
                  <p className="text-sm text-red-600">{formErrors.fileUrl}</p>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">
                Description (optionnel)
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="fed-input-light px-4 py-3 font-semibold min-h-20"
                placeholder="Consignes, chapitres couverts…"
              />
            </div>
          </div>

          {formErrors.submit && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{formErrors.submit}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating || fileReading}
              className="fed-btn-gold px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Recensement…' : 'Recenser dans la banque'}
            </button>
          </div>
        </form>
      )}

      {/* Explorateur des ressources recensées (onglet « Ressources ») */}
      {tab === 'ressources' && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filtres */}
        <div className="lg:col-span-1 space-y-6">
          <div className="fed-card p-8">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-6">
              Explorateur
            </h3>
            <div className="space-y-2">
              {subjects.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterSubject(f)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all',
                    filterSubject === f
                      ? 'bg-blue-900 text-white shadow-lg'
                      : 'text-slate-500 hover:bg-blue-50',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Liste des épreuves */}
        <div className="lg:col-span-3 fed-card overflow-hidden">
          <div className="p-8 border-b border-blue-50 flex items-center justify-between gap-4 flex-wrap">
            <h3 className="text-sm font-bold text-blue-900 uppercase">
              Sujets Recensés ({filtered.length})
            </h3>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="fed-input-light pl-10 pr-4 py-2 text-xs font-bold !w-auto"
                />
                <AppIcon
                  name="search"
                  size="submenu"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          </div>

          <div className="divide-y divide-blue-50">
            {filtered.length === 0 ? (
              <div className="p-12 text-center">
                <AppIcon name="library" size="dashboard" className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">
                  Aucune épreuve recensée pour ce filtre.{' '}
                  {canManageNow
                    ? 'Recensez vos premiers sujets pour alimenter la banque.'
                    : 'Le coordonnateur ou l\u2019organisateur recensera les sujets.'}
                </p>
              </div>
            ) : (
              filtered.map((resource) => {
                const badge =
                  STATUS_BADGES[resource.status] ?? {
                    label: resource.status,
                    className: 'bg-gray-100 text-gray-600',
                  };
                return (
                  <div
                    key={resource.id}
                    className="p-8 flex items-center justify-between hover:bg-[#f7f9fc] transition-all group gap-4 flex-wrap"
                  >
                    <div className="flex items-center space-x-6 min-w-0">
                      <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-all flex-shrink-0">
                        <AppIcon name="document" size="dashboard" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-bold text-blue-900 truncate">
                          {resource.title}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                          {resource.resourceTypeLabel}
                          {resource.subject ? ` • ${resource.subject}` : ''}
                          {resource.classLevel ? ` • ${resource.classLevel}` : ''}
                          {resource.examType ? ` • ${resource.examType}` : ''}
                          {' • '}
                          {new Date(resource.uploadedAt).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {resource.accessLevelLabel} • {resource.downloadCount} consultation(s)
                          {resource.fileSize
                            ? ` • ${(resource.fileSize / 1024).toFixed(0)} Ko`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 flex-shrink-0">
                      <div
                        className={cn(
                          'px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2',
                          badge.className,
                        )}
                      >
                        {resource.status === 'LOCKED' && (
                          <AppIcon name="warning" size="submenu" className="w-3 h-3" />
                        )}
                        {badge.label}
                      </div>
                      <a
                        href={resource.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-4 bg-blue-50 rounded-xl text-blue-800 hover:bg-blue-900 hover:text-white transition-all"
                        title="Consulter le document"
                      >
                        <AppIcon name="view" size="submenu" />
                      </a>
                      {canManageNow && (
                        <div className="flex items-center gap-1">
                          {resource.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => changeStatus(resource, 'VALIDATED')}
                              className="p-2 text-slate-400 hover:text-green-700 transition-colors"
                              title="Valider"
                            >
                              <AppIcon name="check" size="submenu" />
                            </button>
                          )}
                          {resource.status === 'VALIDATED' && (
                            <button
                              type="button"
                              onClick={() => changeStatus(resource, 'LOCKED')}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                              title="Verrouiller (bloque l'accès)"
                            >
                              <AppIcon name="lock" size="submenu" />
                            </button>
                          )}
                          {resource.status === 'LOCKED' && (
                            <button
                              type="button"
                              onClick={() => changeStatus(resource, 'VALIDATED')}
                              className="p-2 text-slate-400 hover:text-amber-600 transition-colors"
                              title="Déverrouiller"
                            >
                              <AppIcon name="edit" size="submenu" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(resource)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                            title="Retirer de la banque"
                          >
                            <AppIcon name="delete" size="submenu" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          ONGLET « CATALOGUE » (année scolaire → examen → épreuves)
          Déplacé depuis le module « Épreuves et documents » (2026-09-29).
         ════════════════════════════════════════════════════════════════════ */}
      {tab === 'catalogue' && (
        <div className="space-y-5">
          {/* Vue réseau — patronat national uniquement */}
          {catalogue?.orgLevel === 'NATIONAL' && (catalogue.network ?? []).length > 0 && (
            <div className="fed-card p-6">
              <h2 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                <AppIcon name="network" size="submenu" className="text-blue-900" />
                Vue d&apos;ensemble du réseau (patronat national)
              </h2>
              <p className="text-xs text-slate-500 mt-1 mb-4">
                Volumes d&apos;épreuves des patronats territoriaux rattachés — vous
                consultez vos propres épreuves ci-dessous.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(catalogue.network ?? []).map((n) => (
                  <div
                    key={n.patronatId}
                    className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-blue-900 truncate">{n.name}</div>
                      <div className="text-[10px] text-slate-400">{n.territory ?? '—'}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 text-xs font-bold flex-shrink-0 ml-3">
                      {n.totalEpreuves}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {catalogueLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="fed-card p-6 space-y-3">
                  <div className="h-5 w-56 rounded bg-slate-100 animate-pulse" />
                  <div className="h-16 w-full rounded bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (catalogue?.years ?? []).length === 0 ? (
            <div className="fed-card p-10 text-center">
              <AppIcon name="library" size="submenu" className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 mt-2">Catalogue vide</p>
              <p className="text-sm text-slate-500 max-w-lg mx-auto mt-1">
                Les épreuves créées dans le module « Épreuves et documents » sont
                automatiquement classées ici par année scolaire puis par examen
                (CEP, BEPC, Baccalauréat, CAP).
              </p>
            </div>
          ) : (
            (catalogue?.years ?? []).map((year) => (
              <div key={year.academicYearId} className="fed-card overflow-hidden">
                {/* Dossier année scolaire */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenYear(openYear === year.academicYearId ? null : year.academicYearId)
                  }
                  className="w-full flex items-center justify-between px-6 py-4 bg-[#f7f9fc] border-b border-slate-200 hover:bg-blue-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AppIcon name="library" size="submenu" className="text-blue-900" />
                    <span className="text-sm font-bold text-blue-900">
                      Année scolaire {year.label}
                    </span>
                    {year.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-100 text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 text-xs font-bold">
                    {year.total} épreuve{year.total > 1 ? 's' : ''}
                  </span>
                </button>

                {openYear === year.academicYearId && (
                  <div className="p-6 space-y-4">
                    {/* Dossiers examens */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {year.categories.map((cat) => {
                        const active = openCategory === cat.code;
                        return (
                          <button
                            key={cat.code}
                            type="button"
                            onClick={() => setOpenCategory(active ? null : cat.code)}
                            className={cn(
                              'flex items-center justify-between rounded-xl border px-4 py-3 transition-colors text-left',
                              active
                                ? 'border-blue-800 bg-blue-900 text-white'
                                : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50',
                            )}
                          >
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  'text-xs font-bold truncate',
                                  active ? 'text-white' : 'text-blue-900',
                                )}
                              >
                                {cat.label}
                              </div>
                              <div
                                className={cn(
                                  'text-[10px]',
                                  active ? 'text-blue-200' : 'text-slate-400',
                                )}
                              >
                                dossier
                              </div>
                            </div>
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-lg text-[11px] font-bold flex-shrink-0 ml-2',
                                active ? 'bg-white/15 text-white' : 'bg-blue-50 text-blue-900',
                              )}
                            >
                              {cat.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Épreuves du dossier sélectionné */}
                    {openCategory && (
                      <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                        {catalogueEpreuves
                          .filter(
                            (e) =>
                              e.academicYearId === year.academicYearId &&
                              e.examCategory === openCategory,
                          )
                          .map((e) => (
                            <div
                              key={e.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 hover:bg-[#f7f9fc]"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-blue-900 truncate">
                                  {e.title}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {[e.subject, e.sessionLabel, e.durationLabel]
                                    .filter(Boolean)
                                    .join(' · ') || '—'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                                    STATUS_BADGES[e.status]?.className ??
                                      'bg-slate-100 text-slate-600',
                                  )}
                                >
                                  {e.statusLabel}
                                </span>
                                {/* Lien croisé vers l'éditeur du module
                                    « Épreuves et documents » (/documents?edit=) */}
                                <a
                                  href={federisLink(`/documents?edit=${e.id}`)}
                                  className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors"
                                >
                                  Ouvrir
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void downloadEpreuvePdf(e)}
                                  disabled={downloadingPdf !== null}
                                  className="px-3 py-1.5 bg-blue-50 rounded-lg text-[11px] font-semibold text-blue-800 hover:bg-blue-800 hover:text-white transition-colors disabled:opacity-50"
                                >
                                  {downloadingPdf === e.id ? '…' : 'PDF'}
                                </button>
                              </div>
                            </div>
                          ))}
                        {catalogueEpreuves.filter(
                          (e) =>
                            e.academicYearId === year.academicYearId &&
                            e.examCategory === openCategory,
                        ).length === 0 && (
                          <p className="px-4 py-6 text-center text-xs text-slate-400">
                            Aucune épreuve dans ce dossier.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </FedPage>
  );
}
