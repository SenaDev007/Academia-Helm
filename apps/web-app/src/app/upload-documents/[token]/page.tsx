'use client';

/**
 * ============================================================================
 * PAGE PUBLIQUE — UPLOAD DE DOCUMENTS — /upload-documents/[token]
 * ============================================================================
 *
 * Le candidat accède à cette page via le lien envoyé par email.
 *
 * Flow :
 *   1. GET /api/documents-public/:token → infos (requiredDocs, uploadedDocs)
 *   2. Pour chaque document requis → upload (base64) via POST .../upload
 *   3. Soumission finale → POST .../submit
 *
 * Identité visuelle Helm : header bleu (NAVY→BLUE), body blanc, accents GOLD.
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, AlertCircle, CheckCircle2, FileText, Upload, Send,
  FileCheck2, Trash2, Building2, Calendar,
} from 'lucide-react';
import { PublicShell, PublicCard, HELM_NAVY, HELM_BLUE, HELM_GOLD } from '@/components/public/PublicShell';

type PageState = 'loading' | 'valid' | 'submitting' | 'success' | 'expired' | 'submitted' | 'error';

interface RequiredDoc {
  type: string;
  label: string;
  required: boolean;
  category: string;
}
interface UploadedDoc {
  docType: string;
  fileName: string;
  url: string;
  uploadedAt: string;
}
interface UploadInfo {
  token: string;
  candidateName: string;
  requiredDocs: RequiredDoc[];
  uploadedDocs: UploadedDoc[];
  expiresAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  IDENTITE: 'Pièces d\'identité',
  DIPLOMES: 'Diplômes & Certifications',
  EXPERIENCE: 'Expérience professionnelle',
  ADMINISTRATIF: 'Documents administratifs',
  MEDICAL: 'Documents médicaux',
  GENERAL: 'Autres documents',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

export default function UploadDocumentsPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([]);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ─── Fetch info ──────────────────────────────────────────────────────────
  const fetchInfo = useCallback(async () => {
    try {
      setState('loading');
      const res = await fetch(`/api/documents-public/${token}`);
      const data = await res.json();
      if (!res.ok) {
        const msg = (data.message || data.error || '').toLowerCase();
        if (msg.includes('expiré') || msg.includes('expir')) setState('expired');
        else if (msg.includes('déjà') || msg.includes('soumis') || msg.includes('completed')) setState('submitted');
        else { setErrorMsg(data.message || data.error || 'Erreur'); setState('error'); }
        return;
      }
      setInfo(data);
      setUploaded(data.uploadedDocs || []);
      setState('valid');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau');
      setState('error');
    }
  }, [token]);

  useEffect(() => { fetchInfo(); }, [fetchInfo]);

  // ─── Upload one file ─────────────────────────────────────────────────────
  async function handleFileChange(doc: RequiredDoc, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Le fichier dépasse 10 Mo.');
      return;
    }
    setUploadingType(doc.type);
    setErrorMsg('');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const res = await fetch(`/api/documents-public/${token}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              docType: doc.type,
              fileName: file.name,
              fileContent: base64,
              contentType: file.type,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setErrorMsg(data.message || data.error || 'Erreur upload');
            setUploadingType(null);
            return;
          }
          setUploaded(prev => [...prev, { docType: doc.type, fileName: file.name, url: data.url, uploadedAt: new Date().toISOString() }]);
          setUploadingType(null);
          // reset input
          if (fileInputRefs.current[doc.type]) fileInputRefs.current[doc.type]!.value = '';
        } catch (err: any) {
          setErrorMsg(err.message || 'Erreur upload');
          setUploadingType(null);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setErrorMsg(err.message);
      setUploadingType(null);
    }
  }

  function removeUploaded(docType: string) {
    // Note: backend doesn't expose delete; just remove from local view (will be re-synced on reload)
    setUploaded(prev => prev.filter(d => d.docType !== docType));
  }

  // ─── Submit final ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setState('submitting');
    try {
      const res = await fetch(`/api/documents-public/${token}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || data.error || 'Erreur soumission');
        setState('valid');
        return;
      }
      setState('success');
    } catch (err: any) {
      setErrorMsg(err.message);
      setState('valid');
    }
  }

  // Group docs by category
  const groupedDocs = (info?.requiredDocs || []).reduce<Record<string, RequiredDoc[]>>((acc, d) => {
    (acc[d.category] = acc[d.category] || []).push(d);
    return acc;
  }, {});

  const requiredCount = (info?.requiredDocs || []).filter(d => d.required).length;
  const requiredUploaded = (info?.requiredDocs || []).filter(d => d.required && uploaded.some(u => u.docType === d.type)).length;
  const allRequiredUploaded = requiredCount > 0 && requiredUploaded >= requiredCount;

  // ─── Render ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Envoi de documents">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: HELM_BLUE }} />
          <p className="text-sm text-slate-500">Vérification du lien...</p>
        </div>
      </PublicShell>
    );
  }

  if (state === 'error') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Envoi de documents">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">Une erreur est survenue</h1>
          <p className="text-sm text-slate-500 mb-4">{errorMsg}</p>
          <p className="text-xs text-slate-400">Vérifiez que vous avez bien copié l&apos;URL complète depuis votre email.</p>
        </div>
      </PublicShell>
    );
  }

  if (state === 'expired') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Envoi de documents">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: HELM_GOLD }} />
          <h1 className="text-lg font-bold text-slate-900 mb-2">Lien expiré</h1>
          <p className="text-sm text-slate-500">Ce lien d&apos;envoi de documents a expiré. Veuillez contacter l&apos;établissement pour obtenir un nouveau lien.</p>
        </div>
      </PublicShell>
    );
  }

  if (state === 'submitted' || state === 'success') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Envoi de documents">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden">
          <div className="p-8 text-center" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)' }}>
            <div className="w-20 h-20 mx-auto bg-white rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-600" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Documents envoyés !</h1>
            <p className="text-emerald-100">Vos documents ont bien été reçus par l&apos;établissement.</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-sm text-slate-600">Le recruteur va les examiner et reviendra vers vous très prochainement.</p>
          </div>
        </div>
      </PublicShell>
    );
  }

  if (state === 'submitting') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Envoi de documents">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: HELM_BLUE }} />
          <p className="text-sm text-slate-500">Finalisation de l&apos;envoi...</p>
        </div>
      </PublicShell>
    );
  }

  if (!info) return null;

  return (
    <PublicShell
      schoolName="Academia Helm"
      subtitle={`Envoi de documents — ${info.candidateName}`}
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-6">
        {/* Intro card */}
        <PublicCard title="Documents à fournir" icon={<FileText className="w-5 h-5" />} accentColor={HELM_NAVY}>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Bonjour <strong>{info.candidateName}</strong>, veuillez téléverser les documents listés ci-dessous.
              Les documents marqués <span className="font-bold text-rose-500">obligatoires</span> doivent être fournis avant la soumission.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: `${HELM_NAVY}0a`, color: HELM_NAVY }}>
                <Building2 className="h-3.5 w-3.5" /> Candidat : {info.candidateName}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: `${HELM_GOLD}15`, color: HELM_NAVY }}>
                <Calendar className="h-3.5 w-3.5" /> Expire le {formatDate(info.expiresAt)}
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{
                background: allRequiredUploaded ? '#10b98115' : `${HELM_GOLD}15`,
                color: allRequiredUploaded ? '#059669' : HELM_NAVY,
              }}>
                <FileCheck2 className="h-3.5 w-3.5" /> {requiredUploaded}/{requiredCount} obligatoires
              </div>
            </div>
          </div>
        </PublicCard>

        {/* Documents par catégorie */}
        {Object.entries(groupedDocs).map(([cat, docs]) => (
          <PublicCard key={cat} title={CATEGORY_LABELS[cat] || cat} accentColor={HELM_BLUE}>
            <div className="space-y-3">
              {docs.map(doc => {
                const isUploaded = uploaded.some(u => u.docType === doc.type);
                const uploadedDoc = uploaded.find(u => u.docType === doc.type);
                return (
                  <div key={doc.type} className={`rounded-xl border-2 p-4 transition ${isUploaded ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-900">{doc.label}</p>
                          {doc.required ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">Obligatoire</span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Optionnel</span>
                          )}
                        </div>
                        {isUploaded && uploadedDoc && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            <span className="truncate">{uploadedDoc.fileName}</span>
                            <button onClick={() => removeUploaded(doc.type)} className="ml-1 text-slate-400 hover:text-rose-500">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${isUploaded ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'text-white'}`} style={isUploaded ? undefined : { background: HELM_BLUE }}>
                        {uploadingType === doc.type ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Upload...</>
                        ) : isUploaded ? (
                          <><Upload className="h-3.5 w-3.5" /> Remplacer</>
                        ) : (
                          <><Upload className="h-3.5 w-3.5" /> Téléverser</>
                        )}
                        <input
                          ref={el => { fileInputRefs.current[doc.type] = el; }}
                          type="file"
                          className="hidden"
                          onChange={e => handleFileChange(doc, e)}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </PublicCard>
        ))}

        {errorMsg && (
          <div className="rounded-xl p-4 border border-rose-200 bg-rose-50 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700">{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <button
            onClick={handleSubmit}
            disabled={!allRequiredUploaded}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
            style={{ background: `linear-gradient(135deg, ${HELM_BLUE}, ${HELM_NAVY})` }}
          >
            <Send className="h-4 w-4" /> Soumettre les documents
          </button>
          {!allRequiredUploaded && (
            <p className="text-center text-xs text-slate-400 mt-2">
              Tous les documents obligatoires doivent être téléversés avant la soumission.
            </p>
          )}
          <p className="text-center text-[10px] text-slate-400 mt-2">
            Formats acceptés : PDF, JPG, PNG, DOC, DOCX. Taille max : 10 Mo par fichier.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
