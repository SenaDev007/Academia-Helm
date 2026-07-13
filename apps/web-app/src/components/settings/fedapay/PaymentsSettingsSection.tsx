/**
 * ============================================================================
 * PaymentsSettingsSection — Paramètres de paiement FedaPay
 * ============================================================================
 *
 * Section des paramètres pour configurer les clés API FedaPay du tenant.
 * Remplace l'ancienne section FeexPay (supprimée).
 */

'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Save, Loader2, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/toast';

export function PaymentsSettingsSection() {
  const [config, setConfig] = useState({
    fedapayPublicKey: '',
    fedapaySecretKey: '',
    fedapayEnvironment: 'sandbox',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/payment-config', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setConfig({
          fedapayPublicKey: data.fedapayPublicKey || '',
          fedapaySecretKey: data.fedapaySecretKey || '',
          fedapayEnvironment: data.fedapayEnvironment || 'sandbox',
        });
      }
    } catch (e) {
      console.error('Failed to load payment config:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/payment-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      toast({ title: '✅ Paramètres enregistrés', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Paiements en ligne</h2>
          <p className="text-sm text-slate-500">Configurez votre compte FedaPay pour accepter les paiements en ligne</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {/* Environnement */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Environnement</label>
          <select
            value={config.fedapayEnvironment}
            onChange={(e) => setConfig({ ...config, fedapayEnvironment: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="sandbox">Sandbox (test)</option>
            <option value="live">Live (production)</option>
          </select>
          <p className="text-xs text-slate-400 mt-1">Utilisez sandbox pour tester, live pour les vrais paiements.</p>
        </div>

        {/* Clé publique */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Clé publique FedaPay</label>
          <input
            type="text"
            value={config.fedapayPublicKey}
            onChange={(e) => setConfig({ ...config, fedapayPublicKey: e.target.value })}
            placeholder="pk_sandbox_..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Clé secrète */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Clé secrète FedaPay</label>
          <input
            type="password"
            value={config.fedapaySecretKey}
            onChange={(e) => setConfig({ ...config, fedapaySecretKey: e.target.value })}
            placeholder="sk_sandbox_..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-slate-400 mt-1">La clé secrète est chiffrée et non affichée pour des raisons de sécurité.</p>
        </div>

        {/* Bouton sauvegarder */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">FedaPay — Paiement sécurisé</p>
          <p className="text-xs text-blue-700 mt-1">
            FedaPay est notre partenaire de paiement. Créez un compte sur{' '}
            <a href="https://fedapay.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">fedapay.com</a>{' '}
            pour obtenir vos clés API. En mode sandbox, vous pouvez tester sans réel débit.
          </p>
        </div>
      </div>
    </div>
  );
}
