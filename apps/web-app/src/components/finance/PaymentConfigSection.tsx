'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function PaymentConfigSection({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    provider: 'feexpay',
    isActive: false,
    feexpayApiKey: '',
    feexpayShopId: '',
    feexpaySecretKey: '',
    fedapayPublicKey: '',
    fedapaySecretKey: '',
    webhookSecret: '',
  });

  useEffect(() => {
    fetch('/api/finance/payment-config', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.message) {
          setConfig({
            provider: data.provider || 'feexpay',
            isActive: data.isActive || false,
            feexpayApiKey: data.feexpayApiKey || '',
            feexpayShopId: data.feexpayShopId || '',
            feexpaySecretKey: data.feexpaySecretKey || '',
            fedapayPublicKey: data.fedapayPublicKey || '',
            fedapaySecretKey: data.fedapaySecretKey || '',
            webhookSecret: data.webhookSecret || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/finance/payment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '✅ Configuration enregistrée', description: data.message || 'Les paramètres ont été sauvegardés.' });
      } else {
        toast({ title: 'Erreur', description: data.message || 'Échec de l\'enregistrement', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800">Paiements en ligne</h3>
            <p className="text-xs text-slate-500">Configurez FeexPay ou Fedapay pour accepter les paiements Mobile Money des parents</p>
          </div>
        </div>
        {config.isActive ? (
          <Badge className="bg-emerald-100 text-emerald-700">✅ Activé</Badge>
        ) : (
          <Badge className="bg-slate-100 text-slate-600">Désactivé</Badge>
        )}
      </div>

      {/* Alerte d'information */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Comment ça marche ?</p>
            <p>Chaque école configure son PROPRE compte FeexPay ou Fedapay. L'argent des paiements va <strong>directement sur le compte de l'école</strong>, jamais sur le nôtre. Academia Helm est l'orchestrateur (SaaS), pas l'intermédiaire financier.</p>
          </div>
        </div>
      </div>

      {/* Provider */}
      <div>
        <Label className="text-xs font-semibold">Fournisseur de paiement</Label>
        <Select value={config.provider} onValueChange={(v) => setConfig({ ...config, provider: v })}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="feexpay">FeexPay (MTN, Moov, Celtiis)</SelectItem>
            <SelectItem value="fedapay">Fedapay (MTN, Moov, Celtiis)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activer/désactiver */}
      <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
        <input
          type="checkbox"
          checked={config.isActive}
          onChange={(e) => setConfig({ ...config, isActive: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <div>
          <span className="text-sm font-semibold text-slate-700 block">Activer les paiements en ligne</span>
          <span className="text-xs text-slate-500 block">Permet aux parents de payer la scolarité depuis leur espace</span>
        </div>
      </label>

      {/* Champs FeexPay — uniquement API Key + Shop ID */}
      {config.provider === 'feexpay' && (
        <div className="space-y-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-orange-800">🔑 Clés API FeexPay</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">API Key</Label>
              <Input
                type="password"
                value={config.feexpayApiKey}
                onChange={(e) => setConfig({ ...config, feexpayApiKey: e.target.value })}
                placeholder="sk_xxxxxxxxxxxx"
              />
              <p className="text-[10px] text-slate-500 mt-1">La clé secrète d'authentification API.</p>
            </div>
            <div>
              <Label className="text-xs">Shop ID</Label>
              <Input
                value={config.feexpayShopId}
                onChange={(e) => setConfig({ ...config, feexpayShopId: e.target.value })}
                placeholder="ex: 123456"
              />
              <p className="text-[10px] text-slate-500 mt-1">Identifiant de votre boutique FeexPay.</p>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Webhook Secret (optionnel)</Label>
              <Input
                type="password"
                value={config.webhookSecret}
                onChange={(e) => setConfig({ ...config, webhookSecret: e.target.value })}
                placeholder="Pour vérifier l'authenticité des webhooks FeexPay"
              />
            </div>
          </div>
          {/* URL Webhook FeexPay */}
          <div className="mt-3 p-3 bg-orange-100/50 border border-orange-200 rounded-lg">
            <Label className="text-xs font-semibold text-orange-800 mb-1 block">
              🔗 URL Webhook à configurer chez FeexPay
            </Label>
            <p className="text-[11px] text-orange-700 mb-2">
              Copiez cette URL dans votre dashboard FeexPay → Paramètres → Webhook.
              Remplacez <code className="bg-white px-1 rounded">VOTRE_TENANT_ID</code> par l'identifiant
              de votre école (fourni par Academia Helm). FeexPay notifiera cette URL quand un paiement
              est confirmé, ce qui met à jour automatiquement le compte de l'élève.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white rounded border border-orange-200 text-xs font-mono text-orange-900 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/finance/payments/feexpay/webhook?tenantId=VOTRE_TENANT_ID` : '/api/finance/payments/feexpay/webhook?tenantId=VOTRE_TENANT_ID'}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/api/finance/payments/feexpay/webhook?tenantId=VOTRE_TENANT_ID`;
                  navigator.clipboard.writeText(url);
                  toast({ title: '✅ URL copiée', description: 'Collez-la dans votre dashboard FeexPay.' });
                }}
              >
                Copier
              </Button>
            </div>
          </div>
          <p className="text-xs text-orange-700 mt-3">
            Récupérez ces clés sur <a href="https://feexpay.me" target="_blank" className="underline">feexpay.me</a> → Dashboard → API.
            Créez un compte marchand (gratuit), complétez le KYC (RCCM, IFU, compte bancaire).
            <br />
            <strong>Note :</strong> FeexPay ne nécessite que 2 clés (API Key + Shop ID). Pas de Secret Key.
          </p>
        </div>
      )}

      {/* Champs Fedapay */}
      {config.provider === 'fedapay' && (
        <div className="space-y-4 p-4 bg-violet-50 border border-violet-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-violet-800">🔑 Clés API Fedapay</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Public Key</Label>
              <Input
                type="password"
                value={config.fedapayPublicKey}
                onChange={(e) => setConfig({ ...config, fedapayPublicKey: e.target.value })}
                placeholder="pk_live_xxxxxxxx"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Utilisée côté client pour le checkout widget. Masquée pour des raisons de sécurité.
              </p>
            </div>
            <div>
              <Label className="text-xs">Secret Key</Label>
              <Input
                type="password"
                value={config.fedapaySecretKey}
                onChange={(e) => setConfig({ ...config, fedapaySecretKey: e.target.value })}
                placeholder="sk_live_xxxxxxxx"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Utilisée côté serveur pour vérifier les transactions. Ne jamais exposer côté client.
              </p>
            </div>
          </div>
          {/* URL Webhook Fedapay */}
          <div className="mt-3 p-3 bg-violet-100/50 border border-violet-200 rounded-lg">
            <Label className="text-xs font-semibold text-violet-800 mb-1 block">
              🔗 URL Webhook à configurer chez Fedapay
            </Label>
            <p className="text-[11px] text-violet-700 mb-2">
              Copiez cette URL dans votre dashboard Fedapay → Settings → Webhooks.
              Remplacez <code className="bg-white px-1 rounded">VOTRE_TENANT_ID</code> par l'identifiant
              de votre école (fourni par Academia Helm). Fedapay notifiera cette URL quand un paiement
              est confirmé, ce qui met à jour automatiquement le compte de l'élève.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-white rounded border border-violet-200 text-xs font-mono text-violet-900 break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/finance/payments/fedapay/webhook?tenantId=VOTRE_TENANT_ID` : '/api/finance/payments/fedapay/webhook?tenantId=VOTRE_TENANT_ID'}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `${window.location.origin}/api/finance/payments/fedapay/webhook?tenantId=VOTRE_TENANT_ID`;
                  navigator.clipboard.writeText(url);
                  toast({ title: '✅ URL copiée', description: 'Collez-la dans votre dashboard Fedapay.' });
                }}
              >
                Copier
              </Button>
            </div>
          </div>
          <p className="text-xs text-violet-700 mt-3">
            Récupérez vos clés sur <a href="https://fedapay.com" target="_blank" className="underline">fedapay.com</a> → Dashboard → Settings → API Keys.
          </p>
        </div>
      )}

      {/* Bouton sauvegarder */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Enregistrer la configuration</>
          )}
        </Button>
      </div>
    </div>
  );
}
