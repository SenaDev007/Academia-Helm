'use client';

/**
 * ============================================================================
 * PAYMENTS SETTINGS SECTION — Section Paiements de la page Paramètres
 * ============================================================================
 *
 * Affiche :
 *   - La configuration FeexPay (statut + wizard d'onboarding)
 *   - Les modes de paiement acceptés (espèces toujours, Mobile Money si FeexPay)
 *   - Informations sur les flux (frais scolaires, salaires)
 */

import { useState, useEffect } from 'react';
import { Wallet, Smartphone, Banknote, Shield, Info, ArrowRight } from 'lucide-react';
import { FeexPayOnboardingWizard, FeexPayStatusCard } from './FeexPayOnboardingWizard';
import { feexPayService, type FeexPayConfig } from '@/services/feexpay.service';

export function PaymentsSettingsSection() {
  const [showWizard, setShowWizard] = useState(false);
  const [config, setConfig] = useState<FeexPayConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const cfg = await feexPayService.getConfig();
      setConfig(cfg);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const feexPayConfigured = config?.configured && config?.hasApiKey;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="h-6 w-6" />
          <h3 className="text-lg font-bold">Paiements</h3>
        </div>
        <p className="text-blue-100 text-sm">
          Configurez les modes de paiement acceptés par votre école : espèces et Mobile Money (FeexPay).
          Les salaires peuvent aussi être payés électroniquement via FeexPay.
        </p>
      </div>

      {/* FeexPay configuration card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h4 className="text-base font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-blue-600" />
          Mobile Money (FeexPay)
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          FeexPay est l'agrégateur de paiement qui permet à votre école d'accepter les paiements
          Mobile Money (MTN, Moov, Celtiis, Coris) sans contrat individuel avec chaque opérateur.
          L'argent est versé directement sur le compte de règlement de votre école.
        </p>

        <FeexPayStatusCard onConfigure={() => setShowWizard(true)} />

        {feexPayConfigured && (
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p className="text-xs text-blue-800 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                FeexPay est actif. Vous pouvez maintenant accepter les paiements Mobile Money pour les frais
                scolaires (module Finance) et payer les salaires électroniquement (module RH → Paie).
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Payment methods accepted */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h4 className="text-base font-semibold text-gray-800 mb-3">Modes de paiement acceptés</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cash */}
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-900">Espèces</p>
              <p className="text-xs text-emerald-700">Toujours disponible</p>
            </div>
            <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Activé</span>
          </div>

          {/* Mobile Money */}
          <div className={`flex items-center gap-3 p-3 border rounded-xl ${
            feexPayConfigured
              ? 'bg-blue-50 border-blue-200'
              : 'bg-gray-50 border-gray-200 opacity-60'
          }`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              feexPayConfigured ? 'bg-blue-100' : 'bg-gray-200'
            }`}>
              <Smartphone className={`h-5 w-5 ${feexPayConfigured ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className={`text-sm font-bold ${feexPayConfigured ? 'text-blue-900' : 'text-gray-600'}`}>
                Mobile Money
              </p>
              <p className="text-xs text-gray-500">MTN, Moov, Celtiis, Coris</p>
            </div>
            <span className={`ml-auto text-xs font-bold px-2 py-1 rounded ${
              feexPayConfigured
                ? 'text-blue-600 bg-blue-100'
                : 'text-gray-400 bg-gray-100'
            }`}>
              {feexPayConfigured ? 'Activé' : 'Désactivé'}
            </span>
          </div>
        </div>
      </div>

      {/* Payment flows info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h4 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-blue-600" />
          Flux de paiement
        </h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-xs font-bold text-blue-600">1</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Frais de scolarité (Parent → École)</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Les parents paient par Mobile Money ou en espèces. L'argent va directement
                sur le compte FeexPay de votre école (Mobile Money) ou est reçu en cash (espèces).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 text-xs font-bold text-emerald-600">2</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Salaires (École → Personnel)</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Payez vos enseignants et staff électroniquement via FeexPay (payout Mobile Money),
                ou validez manuellement un paiement en espèces si le paiement électronique échoue.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-xs font-bold text-amber-600">3</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Abonnement Academia Helm</p>
              <p className="text-xs text-gray-600 mt-0.5">
                Votre abonnement mensuel à Academia Helm est collecté séparément via le compte
                FeexPay d'Academia Helm (page Facturation).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security info */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Sécurité de vos données</p>
            <p className="text-xs text-amber-800 mt-1">
              Votre clé API FeexPay est chiffrée (AES-256-GCM) avant d'être stockée en base.
              Elle n'est jamais affichée en clair ni transmise en clair. Seul votre établissement
              peut initier des paiements depuis son compte FeexPay.
            </p>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <FeexPayOnboardingWizard
        isOpen={showWizard}
        onClose={() => {
          setShowWizard(false);
          loadConfig(); // refresh status after wizard closes
        }}
      />
    </div>
  );
}
