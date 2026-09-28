/**
 * FederisDocumentsPage — Épreuves et documents officiels (Academia Federis)
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ VRAIES DONNÉES (2026-09-28) — remplace le placeholder « en cours de
 *    développement ». Par examen (année scolaire active, API /federis/exams) :
 *      - Bordereaux d'émargement (PDF officiel — backend Puppeteer)
 *      - Palmarès officiel (résultats publiés)
 *
 * Téléchargements via GET /federis/exams/:examId/pdf/bordereaux|palmares
 * (JWT — blob + déclenchement du téléchargement navigateur).
 */

'use client';

import { useCallback, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { useFederisExams, EXAM_STATUS_LABELS } from '@/hooks/useFederisExams';
import { FedPage } from '@/components/federis/federis-motion';

interface FederisDocumentsPageProps {
  /** User.role de la session (gardes UI — la garde finale est côté API) */
  userRole?: string | null;
}

export default function FederisDocumentsPage({ userRole }: FederisDocumentsPageProps) {
  const { exams, academicYear, loading, error } = useFederisExams();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  const download = useCallback(async (examId: string, kind: 'bordereaux' | 'palmares', label: string) => {
    const key = `${examId}:${kind}`;
    setDownloading(key);
    setDocError(null);
    setNotice(null);
    try {
      const res = await apiClient.get(`/federis/exams/${examId}/pdf/${kind}`, {
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}-${label}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotice(`Téléchargement de « ${label} » lancé.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      // Les erreurs blob arrivent en texte — parsing best effort
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
      setDocError(
        text ??
          (Array.isArray(msg) ? msg.join(' ') : msg) ??
          'Génération impossible — vérifiez que les données de l\u2019examen sont complètes (centres, salles, candidats, résultats).',
      );
    } finally {
      setDownloading(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-72 bg-blue-100 rounded-full" />
        <div className="fed-card h-48" />
        <div className="fed-card h-48" />
      </div>
    );
  }

  return (
    <FedPage className="space-y-8">
      {/* En-tête */}
      <div className="fed-card p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16" />
        <div className="relative z-10">
          <div className="fed-badge mb-4">Module ressources</div>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#1e3a8a] to-[#0b1d3a] rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <AppIcon name="document" size="dashboard" className="text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#0b1d3a] tracking-tight">
              Épreuves et documents
            </h1>
          </div>
          <p className="text-slate-500 font-medium max-w-xl text-sm">
            Documents officiels par examen{academicYear ? ` — session ${academicYear.name}` : ''} :
            bordereaux d&apos;émargement et palmarès générés par le backend (PDF signés,
            archivage officiel).
          </p>
        </div>
      </div>

      {(error || docError) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-800">
          {docError ?? error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-4 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {/* Documents par examen */}
      {exams.length === 0 ? (
        <div className="fed-card px-6 py-14 text-center">
          <AppIcon name="document" size="dashboard" className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Aucun examen enregistré pour la session en cours. Créez vos campagnes d&apos;examen
            depuis le module Examens nationaux — les documents officiels seront générés ici.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {exams.map((exam: any) => {
            const statusLabel =
              EXAM_STATUS_LABELS?.[exam.status] ?? exam.status;
            return (
              <div key={exam.id} className="fed-card overflow-hidden">
                <div className="bg-[#f7f9fc] px-6 py-4 border-b border-blue-50 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-[#eff6ff] rounded-xl flex items-center justify-center text-[#1e3a8a] flex-shrink-0">
                      <AppIcon name="exams" size="menu" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black text-[#0b1d3a] truncate">{exam.name}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {exam.code} · {typeof statusLabel === 'string' ? statusLabel : exam.status}{' '}
                        · {exam.totalCandidates} candidat(s) · {exam.totalCenters} centre(s)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 grid sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => download(exam.id, 'bordereaux', `bordereaux-${exam.code}`)}
                    disabled={downloading !== null}
                    className={cn(
                      'p-5 rounded-2xl border text-left transition-all flex items-start gap-4',
                      'border-blue-100 bg-[#f7f9fc] hover:border-[#1e3a8a]/40 hover:shadow-md',
                      downloading !== null && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <AppIcon name="document" size="menu" className="text-[#1e3a8a] mt-0.5" />
                    <div>
                      <p className="font-bold text-[#0b1d3a] text-sm">Bordereaux d&apos;émargement</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Listes officielles par salle, numéros de table et signatures.
                      </p>
                      {downloading === `${exam.id}:bordereaux` && (
                        <p className="text-xs text-[#1e3a8a] font-bold mt-2">Génération…</p>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => download(exam.id, 'palmares', `palmares-${exam.code}`)}
                    disabled={downloading !== null}
                    className={cn(
                      'p-5 rounded-2xl border text-left transition-all flex items-start gap-4',
                      'border-amber-200 bg-amber-50/40 hover:border-amber-500/50 hover:shadow-md',
                      downloading !== null && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <AppIcon name="grades" size="menu" className="text-amber-700 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#0b1d3a] text-sm">Palmarès officiel</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Résultats publiés après délibération — classement et mentions.
                      </p>
                      {downloading === `${exam.id}:palmares` && (
                        <p className="text-xs text-amber-700 font-bold mt-2">Génération…</p>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rôle informatif */}
      <p className="text-xs text-slate-400">
        {userRole
          ? 'Les documents sont générés côté serveur et horodatés — chaque téléchargement est journalisé.'
          : ''}
      </p>
    </FedPage>
  );
}
