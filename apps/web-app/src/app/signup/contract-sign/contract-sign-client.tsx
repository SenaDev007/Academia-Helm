'use client';

/**
 * Client de la page /signup/contract-sign — signature différée du contrat.
 * Voir la docstring de page.tsx.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Loader2,
  PenTool,
  AlertCircle,
  FileText,
  Building2,
  User,
  Banknote,
  ArrowLeft,
} from 'lucide-react';
import { SignatureCanvas } from '@/app/app/hr/_components/onboarding/components/SignatureCanvas';
import ResponsiveTableWrapper from '@/components/ui/tables/ResponsiveTableWrapper';
import { formatCurrency } from '@/lib/utils';
import { HELM_PLANS, getGroupActivationTiers, ANNEX_ACTIVATION_DISCOUNTS } from '@/lib/services/HelmPricingService';

interface DraftData {
  id: string;
  schoolName: string;
  city?: string;
  country?: string;
  bilingual: boolean;
  promoterFirstName?: string;
  promoterLastName?: string;
  promoterEmail?: string;
  email?: string;
  promoterPhone?: string;
  preferredSubdomain?: string;
  selectedPlanId?: string;
  status: string;
  // ⭐ MULTI-ÉCOLES : nombre d'établissements souscrits (signup multi-annexes)
  schoolsCount?: number;
  priceSnapshot?: any;
}

interface SignResult {
  success: boolean;
  subdomain?: string;
  hostname?: string;
  portalUrl?: string;
  contractUrl?: string;
  message?: string;
  // ⭐ État réel du sous-domaine (created / partial / failed / not_configured)
  domainStatus?: string;
}

export function ContractSignClient({ draftId }: { draftId: string }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);

  useEffect(() => {
    if (!draftId) {
      setLoadError('Lien de signature incomplet : identifiant de dossier manquant.');
      setLoading(false);
      return;
    }
    fetch(`/api/onboarding/draft?draftId=${encodeURIComponent(draftId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            err.message ||
              (res.status === 404
                ? "Ce dossier de signature n'existe plus ou a expiré. Contactez l'équipe YEHI OR Tech."
                : 'Erreur lors du chargement du dossier.'),
          );
        }
        return res.json();
      })
      .then((data) => setDraft(data))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [draftId]);

  const handleSign = async () => {
    if (!signature || !draft) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // ⭐ Pas de contractData : le backend le reconstruit depuis le draft
      //    (buildContractDataFromDraft), y compris le marquage de paiement en
      //    espèces persisté dans priceSnapshot.paymentMarked.
      const response = await fetch('/api/onboarding/contract/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draft.id,
          promoterSignature: signature,
          signLater: false,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erreur lors de la signature du contrat.');
      }
      setResult(data);
    } catch (err: any) {
      setSubmitError(err.message || 'Erreur lors de la signature.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── États : chargement / erreur / succès / signature ───
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-900 animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-600">Chargement du contrat…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Impossible d'afficher le contrat</h1>
          <p className="text-sm text-slate-600 mt-2">{loadError}</p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    // Écran de succès après signature
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-blue-900">Contrat signé</h1>
            <p className="text-sm text-slate-600 mt-2">
              <strong>{draft?.schoolName}</strong> est désormais créée et active sur Academia Helm.
            </p>
          </div>

          <div className="space-y-3 text-sm">
            {result.hostname && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                <span className="text-slate-600">Adresse de l'école</span>
                <span className="font-semibold text-blue-900">{result.hostname}</span>
              </div>
            )}
            {result.portalUrl && (
              <a
                href={result.portalUrl}
                className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 hover:border-green-400 transition-colors"
              >
                <span className="text-slate-600">Se connecter à la plateforme</span>
                <span className="font-semibold text-green-700">→ {result.subdomain}.academiahelm.com/login</span>
              </a>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-4 text-center">
            Deux emails vous ont été envoyés : le contrat signé en pièce jointe, et le
            message de bienvenue « Vos accès sont prêts » avec vos identifiants de connexion
            (identique au processus de création en ligne).
          </p>

          {/* ⭐ Sous-domaine non activé : avertissement visible (même règle que
              le wizard — l'école fonctionne, {subdomain}.academiahelm.com non) */}
          {result.domainStatus && result.domainStatus !== 'created' && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Sous-domaine en attente d&apos;activation</strong> — votre école est créée et vos
              identifiants vous ont été envoyés, mais
              {result.subdomain ? ` ${result.subdomain}.academiahelm.com` : ' le sous-domaine'} n&apos;a pas
              pu être activé automatiquement. L&apos;équipe technique va finaliser son activation ; en
              attendant, la plateforme reste accessible via le domaine principal.
            </div>
          )}

          {result.contractUrl && (
            <a
              href={result.contractUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors"
            >
              <FileText className="w-4 h-4" /> Voir le contrat signé
            </a>
          )}
        </div>
      </div>
    );
  }

  // ─── Résumé du contrat + signature ───
  const snapshot = (draft?.priceSnapshot as any) || {};
  const marked = snapshot.paymentMarked || {};
  const planCode = ['SEED', 'GROW', 'LEAD', 'NETWORK'].includes(snapshot.planCode)
    ? snapshot.planCode
    : 'SEED';
  const plan = HELM_PLANS[planCode as keyof typeof HELM_PLANS];
  const activationFee = Number(snapshot.initialPayment ?? snapshot.initialFee ?? 500000) || 500000;
  const annualFee = Number(snapshot.yearlyPrice ?? plan?.annualPrice ?? 50000) || 50000;
  // ⭐ Option bilingue : 100 000 FCFA/an (révision tarifaire) — snapshot
  //    serveur (source de vérité), fallback tarif officiel courant.
  const bilingualFee = draft?.bilingual ? Number(snapshot.bilingualFee ?? 100000) || 100000 : 0;
  // ⭐ Barème progressif du coût d'activation (annexes) : l'annexe créée depuis
  //    les paramètres porte DÉJÀ son tarif remisé (snapshot.initialFee) + les
  //    métadonnées du rang ; le multi-écoles du signup porte le total du groupe
  //    (Σ remises par rang : 2e −15 %, 3e −20 %, 4e −25 %).
  const signSchoolsCount = Math.max(1, Number(draft?.schoolsCount ?? 1) || 1);
  const activationBaseFee = snapshot.activationBaseFee != null ? Number(snapshot.activationBaseFee) : undefined;
  const activationDiscountPercent = Number(snapshot.activationDiscountPercent ?? 0) || 0;
  const annexRank = snapshot.annexRank != null ? Number(snapshot.annexRank) : undefined;
  const activationTotal = Number(snapshot.activationTotal ?? 0) > 0
    ? Number(snapshot.activationTotal)
    : activationFee * signSchoolsCount;
  const totalYearOne = activationTotal + (annualFee + bilingualFee) * signSchoolsCount;
  const promoterName = `${draft?.promoterFirstName || ''} ${draft?.promoterLastName || ''}`.trim();
  const alreadyCompleted = draft?.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
        </Link>

        <div className="bg-white rounded-xl shadow-lg border border-slate-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-blue-900">Contrat d'abonnement Academia Helm</h1>
              <p className="text-sm text-slate-500">Signature électronique — {draft?.schoolName}</p>
            </div>
          </div>

          {alreadyCompleted && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                Ce contrat a déjà été signé et l'école a été créée. Vous pouvez consulter le récapitulatif ci-dessous.
              </p>
            </div>
          )}

          {/* Résumé de la fiche de souscription */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">École</div>
                  <div className="text-sm font-semibold text-slate-900">{draft?.schoolName}</div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-700 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500">Promoteur</div>
                  <div className="text-sm font-semibold text-slate-900">{promoterName || '—'}</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Plan souscrit</span>
                <span className="font-semibold text-blue-900">{plan?.name || snapshot.planName || planCode}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-600">
                  Frais d'activation{signSchoolsCount > 1 ? ` (${signSchoolsCount} écoles — barème progressif)` : ''}
                </span>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(activationTotal)}
                  {signSchoolsCount === 1 && activationDiscountPercent > 0 && (
                    <span className="ml-1 text-emerald-700 text-xs">(−{activationDiscountPercent} % — barème annexe)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-slate-600">Frais annuels{signSchoolsCount > 1 ? ` (${signSchoolsCount} écoles)` : ''}</span>
                <span className="font-semibold text-slate-900">{formatCurrency(annualFee * signSchoolsCount)}</span>
              </div>
              {draft?.bilingual && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-slate-600">Option bilingue FR/EN (annuelle)</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(bilingualFee)} / an</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm mt-3 pt-3 border-t border-blue-200">
                <span className="font-semibold text-blue-900">Total Année 1</span>
                <span className="font-bold text-green-700">{formatCurrency(totalYearOne)}</span>
              </div>
              {(signSchoolsCount > 1 || activationDiscountPercent > 0) && (
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Barème progressif du coût d'activation : 1re école {formatCurrency(activationBaseFee ?? activationFee)}
                  {signSchoolsCount > 1
                    ? getGroupActivationTiers(signSchoolsCount, activationBaseFee ?? activationFee).tiers
                        .map((t) => ` ; ${t.rank}e école ${formatCurrency(t.fee)}${ANNEX_ACTIVATION_DISCOUNTS[t.rank] ? ` (−${ANNEX_ACTIVATION_DISCOUNTS[t.rank]} %)` : ''}`)
                        .join('')
                    : annexRank != null
                      ? ` ; annexe souscrite : ${annexRank}e école → ${formatCurrency(activationFee)} (−${activationDiscountPercent} %)`
                      : ''}.
                </p>
              )}
            </div>

            {/* Paiement en espèces — intégral OU échéancier de tranches */}
            {(() => {
              const insts: { label?: string; amount?: number; dueDate?: string }[] =
                Array.isArray(marked.installments) ? marked.installments : [];
              if (marked.paymentPlan === 'installments' && insts.length > 0) {
                const total = insts.reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const downPayment = Number(insts[0]?.amount) || 0;
                const received = marked.downPaymentReceived !== false;
                const remaining = Math.max(0, total - (received ? downPayment : 0));
                return (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-3">
                      <Banknote className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-900 w-full">
                        <strong>Paiement en espèces — par tranches ({insts.length})</strong>
                        <ResponsiveTableWrapper>
                        <table className="w-full text-xs mt-2 border-collapse">
                          <thead>
                            <tr className="text-left text-slate-500">
                              <th className="py-1 pr-2 font-medium">N°</th>
                              <th className="py-1 pr-2 font-medium">Libellé</th>
                              <th className="py-1 pr-2 font-medium">Échéance</th>
                              <th className="py-1 text-right font-medium">Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {insts.map((t, i) => (
                              <tr key={i} className={i === 0 && received ? 'bg-green-100 font-semibold' : ''}>
                                <td className="py-1 pr-2">{i + 1}</td>
                                <td className="py-1 pr-2">{t.label || (i === 0 ? 'Acompte' : `Tranche ${i + 1}`)}</td>
                                <td className="py-1 pr-2">
                                  {i === 0 && !t.dueDate
                                    ? 'À la signature'
                                    : t.dueDate
                                      ? new Date(t.dueDate).toLocaleDateString('fr-FR')
                                      : '—'}
                                </td>
                                <td className="py-1 text-right">{(Number(t.amount) || 0).toLocaleString('fr-FR')} FCFA</td>
                              </tr>
                            ))}
                            <tr className="border-t border-green-300 font-bold">
                              <td className="py-1 pr-2" colSpan={3}>Total Année 1</td>
                              <td className="py-1 text-right">{total.toLocaleString('fr-FR')} FCFA</td>
                            </tr>
                          </tbody>
                        </table>
                        </ResponsiveTableWrapper>
                        <p className="mt-2">
                          Acompte : <strong>{received ? 'encaissé à la signature' : 'à encaisser'}</strong>
                          {marked.receivedBy ? `, par ${marked.receivedBy} (YEHI OR Tech)` : ''} — solde restant{' '}
                          <strong>{remaining.toLocaleString('fr-FR')} FCFA</strong> selon l'échéancier.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200 flex items-start gap-3">
                  <Banknote className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-900">
                    <strong>Paiement en espèces</strong> — souscription{' '}
                    {marked.subscriptionPaid !== false ? 'réglée en espèces' : 'à régler'}
                    {draft?.bilingual && (
                      <>
                        , option bilingue (facturation annuelle){' '}
                        {marked.bilingualPaid !== false ? 'réglée' : 'à régler'}
                      </>
                    )}
                    .
                  </div>
                </div>
              );
            })()}

            {/* Signature */}
            {!alreadyCompleted && (
              <div className="border-t pt-6">
                <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-blue-700" /> Votre signature
                  <span className="text-red-600">*</span>
                </label>
                <SignatureCanvas
                  width={520}
                  height={110}
                  onSignatureChange={setSignature}
                  placeholder="Signez dans ce cadre (souris ou doigt)"
                />
              </div>
            )}

            {submitError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{submitError}</p>
              </div>
            )}

            {!alreadyCompleted && (
              <button
                onClick={handleSign}
                disabled={submitting || !signature}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Signature en cours…</>
                ) : (
                  <><CheckCircle2 className="w-5 h-5" /> Signer et activer mon école</>
                )}
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 text-center">
            En signant, vous acceptez les 14 articles du contrat d'abonnement Academia Helm.
            Le contrat complet signé vous sera envoyé par email.
          </p>
        </div>
      </div>
    </div>
  );
}
