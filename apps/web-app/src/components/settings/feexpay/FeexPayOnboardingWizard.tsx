'use client';

/**
 * ============================================================================
 * FEEXPAY ONBOARDING WIZARD — Wizard de configuration FeexPay pour les écoles
 * ============================================================================
 *
 * Wizard en 5 étapes guidant l'école (non technique) pour :
 *   1. Comprendre pourquoi configurer FeexPay
 *   2. Créer un compte FeexPay (lien externe + documents requis)
 *   3. Récupérer le Shop ID dans le dashboard FeexPay
 *   4. Générer + coller la clé API
 *   5. Tester la connexion
 *
 * L'API Key est chiffrée côté backend (AES-256-GCM) — jamais stockée en clair.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Smartphone,
  Building2,
  Key,
  TestTube,
  ChevronRight,
  ChevronLeft,
  X,
  RefreshCw,
  Trash2,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { feexPayService, type FeexPayConfig, type FeexPayTestResult } from '@/services/feexpay.service';

interface FeexPayOnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigured?: () => void;
}

const STEPS = [
  { id: 0, label: 'Bienvenue', icon: Wallet },
  { id: 1, label: 'Créer le compte', icon: Building2 },
  { id: 2, label: 'Shop ID', icon: Key },
  { id: 3, label: 'Clé API', icon: Shield },
  { id: 4, label: 'Test', icon: TestTube },
];

export function FeexPayOnboardingWizard({ isOpen, onClose, onConfigured }: FeexPayOnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<FeexPayConfig | null>(null);
  const [shopId, setShopId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<FeexPayTestResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setStep(0);
      setTestResult(null);
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      const cfg = await feexPayService.getConfig();
      setConfig(cfg);
      if (cfg.shopId) setShopId(cfg.shopId);
    } catch (err: any) {
      // Config not yet created — normal
    }
  };

  const handleSaveAndTest = async () => {
    if (!shopId.trim()) {
      toast({ variant: 'error', title: 'Shop ID requis' });
      return;
    }
    setLoading(true);
    setTesting(true);
    setTestResult(null);
    try {
      // 1. Save config
      await feexPayService.saveConfig(shopId.trim(), apiKey.trim() || undefined);
      toast({ variant: 'success', title: 'Configuration enregistrée' });

      // 2. Test connection
      const result = await feexPayService.testConnection();
      setTestResult(result);

      if (result.ok) {
        toast({
          variant: 'success',
          title: 'Connexion réussie',
          description: 'FeexPay est configuré et fonctionne.',
        });
        onConfigured?.();
      } else {
        toast({
          variant: 'error',
          title: 'Échec du test',
          description: result.error || 'Vérifiez votre Shop ID et clé API.',
        });
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message });
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    } finally {
      setLoading(false);
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer la configuration FeexPay ? Les paiements Mobile Money seront désactivés.')) return;
    try {
      await feexPayService.deleteConfig();
      toast({ variant: 'success', title: 'Configuration supprimée' });
      setShopId('');
      setApiKey('');
      setTestResult(null);
      setConfig(null);
      setStep(0);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    }
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const isAlreadyConfigured = config?.configured && config?.hasApiKey;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-blue-100 overflow-hidden max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 text-white relative" style={{ background: 'linear-gradient(135deg, #0D1F6E 0%, #1A2BA6 100%)' }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Configuration FeexPay</h3>
              <p className="text-white/70 text-xs mt-0.5">
                Acceptez les paiements Mobile Money et payez vos salaires électroniquement
              </p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isActive ? 'bg-blue-600 text-white' :
                      isDone ? 'bg-emerald-500 text-white' :
                      'bg-slate-200 text-slate-400'
                    }`}>
                      {isDone ? <CheckCircle2 size={16} /> : <Icon size={15} />}
                    </div>
                    <span className={`text-[10px] font-medium ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step === 0 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800">Pourquoi configurer FeexPay ?</h4>
                  <p className="text-sm text-gray-600">
                    FeexPay permet à votre école d'accepter les paiements Mobile Money (MTN, Moov, Celtiis, Coris)
                    et de payer vos salaires électroniquement, sans contrat individuel avec chaque opérateur telecom.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                      <Smartphone className="h-5 w-5 text-blue-600 mb-2" />
                      <p className="text-xs font-bold text-blue-900">Frais scolaires en ligne</p>
                      <p className="text-[11px] text-blue-700 mt-1">Parents paient par Mobile Money</p>
                    </div>
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <Wallet className="h-5 w-5 text-emerald-600 mb-2" />
                      <p className="text-xs font-bold text-emerald-900">Salaires électroniques</p>
                      <p className="text-[11px] text-emerald-700 mt-1">Payez vos profs sur leur téléphone</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <Shield className="h-5 w-5 text-amber-600 mb-2" />
                      <p className="text-xs font-bold text-amber-900">Conforme BCEAO</p>
                      <p className="text-[11px] text-amber-700 mt-1">Sécurisé et réglementé</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs text-blue-800">
                      <strong>Bon à savoir :</strong> L'argent va directement sur le compte de règlement
                      Mobile Money de votre école (configuré dans FeexPay). Academia Helm ne touche jamais vos fonds.
                    </p>
                  </div>
                  {isAlreadyConfigured && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-900">FeexPay déjà configuré</p>
                        <p className="text-xs text-emerald-700">
                          Shop ID : {config?.shopId} • Clé API : {config?.maskedApiKey}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleDelete}>
                        <Trash2 size={14} className="mr-1" /> Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800">Étape 1 — Créez votre compte FeexPay</h4>
                  <p className="text-sm text-gray-600">
                    Rendez-vous sur le site de FeexPay et créez un compte marchand pour votre école.
                    C'est gratuit et ça prend environ 15 minutes.
                  </p>
                  <a
                    href="https://feexpay.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-bold text-sm shadow-lg"
                  >
                    <ExternalLink size={18} />
                    Aller sur feexpay.me
                  </a>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-amber-900 mb-2">📋 Documents à préparer :</p>
                    <ul className="text-xs text-amber-800 space-y-1 ml-4 list-disc">
                      <li>RCCM ou autorisation d'ouverture du Ministère</li>
                      <li>Pièce d'identité du gérant ou directeur</li>
                      <li>Numéro Mobile Money de l'école (compte de règlement)</li>
                      <li>Adresse physique de l'établissement</li>
                    </ul>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-700">
                      ⏱️ <strong>Temps estimé :</strong> 15 minutes • Validez votre compte par SMS avant de continuer.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800">Étape 2 — Récupérez votre Shop ID</h4>
                  <p className="text-sm text-gray-600">
                    Une fois connecté à votre dashboard FeexPay, votre Shop ID est visible sur la page d'accueil
                    ou dans <strong>Paramètres → Boutique</strong>. C'est un identifiant de 15 caractères
                    (ex: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">nGLq7rMBFBVbpuc</code>).
                  </p>
                  <div>
                    <Label>Shop ID</Label>
                    <Input
                      value={shopId}
                      onChange={(e) => setShopId(e.target.value)}
                      placeholder="nGLq7rMBFBVbpuc"
                      className="font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      Collez ici l'identifiant public de votre boutique FeexPay.
                    </p>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800">Étape 3 — Générez votre clé API</h4>
                  <p className="text-sm text-gray-600">
                    Dans le dashboard FeexPay, allez dans <strong>Paramètres → API</strong> et générez une clé API.
                    Copiez-la et collez-la ci-dessous. Elle sera <strong>chiffrée</strong> (AES-256-GCM) en base.
                  </p>
                  <div>
                    <Label>Clé API FeexPay</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="••••••••••••••••••••••••••••••••"
                      className="font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      🔒 La clé est chiffrée avant stockage. Elle ne sera jamais affichée en clair.
                    </p>
                  </div>
                  {config?.hasApiKey && !apiKey && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-600 shrink-0" />
                      <p className="text-xs text-blue-800">
                        Une clé API est déjà enregistrée ({config.maskedApiKey}). Laissez vide pour la conserver.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <h4 className="text-base font-bold text-gray-800">Étape 4 — Testez la connexion</h4>
                  <p className="text-sm text-gray-600">
                    Vérifions que votre Shop ID et clé API fonctionnent correctement.
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Shop ID :</span>
                      <span className="font-mono font-bold text-slate-900">{shopId || '—'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Clé API :</span>
                      <span className="font-mono font-bold text-slate-900">
                        {apiKey ? `${apiKey.substring(0, 4)}••••••••` : (config?.maskedApiKey || '—')}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveAndTest}
                    disabled={loading || !shopId.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {testing ? (
                      <><Loader2 size={18} className="animate-spin mr-2" /> Test en cours...</>
                    ) : (
                      <><TestTube size={18} className="mr-2" /> Enregistrer et tester</>
                    )}
                  </Button>
                  {testResult && (
                    <div className={`rounded-xl p-4 border ${
                      testResult.ok
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-start gap-3">
                        {testResult.ok ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm font-bold ${testResult.ok ? 'text-emerald-900' : 'text-red-900'}`}>
                            {testResult.ok ? 'Connexion réussie !' : 'Échec du test'}
                          </p>
                          {testResult.ok ? (
                            <p className="text-xs text-emerald-700 mt-1">
                              Votre compte FeexPay est correctement configuré. Vous pouvez maintenant accepter
                              les paiements Mobile Money et payer vos salaires électroniquement.
                            </p>
                          ) : (
                            <p className="text-xs text-red-700 mt-1">{testResult.error}</p>
                          )}
                          {testResult.ok && testResult.balance && (
                            <p className="text-xs text-emerald-600 mt-2 font-mono">
                              Solde : {JSON.stringify(testResult.balance)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 0}
            size="sm"
          >
            <ChevronLeft size={16} className="mr-1" /> Précédent
          </Button>
          <span className="text-xs text-slate-400">Étape {step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <Button onClick={nextStep} size="sm">
              Suivant <ChevronRight size={16} className="ml-1" />
            </Button>
          ) : (
            <Button onClick={onClose} variant="outline" size="sm">
              Fermer
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Compact status card for the settings page — shows current FeexPay config
 * and a button to open the wizard.
 */
export function FeexPayStatusCard({ onConfigure }: { onConfigure: () => void }) {
  const [config, setConfig] = useState<FeexPayConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
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
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
        <div className="h-8 bg-slate-100 rounded" />
      </div>
    );
  }

  const configured = config?.configured && config?.hasApiKey;

  return (
    <div className={`rounded-xl border p-4 ${
      configured ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            configured ? 'bg-emerald-100' : 'bg-amber-100'
          }`}>
            {configured ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${configured ? 'text-emerald-900' : 'text-amber-900'}`}>
              {configured ? 'FeexPay configuré' : 'FeexPay non configuré'}
            </p>
            {configured ? (
              <div className="space-y-0.5 mt-1">
                <p className="text-xs text-emerald-700">
                  Shop ID : <span className="font-mono font-bold">{config?.shopId}</span>
                </p>
                <p className="text-xs text-emerald-700">
                  Clé API : <span className="font-mono">{config?.maskedApiKey}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-amber-700 mt-1">
                Configurez FeexPay pour accepter les paiements Mobile Money et payer les salaires électroniquement.
              </p>
            )}
          </div>
        </div>
        <Button onClick={onConfigure} size="sm" variant={configured ? 'outline' : 'default'}>
          <RefreshCw size={14} className="mr-1" />
          {configured ? 'Reconfigurer' : 'Configurer'}
        </Button>
      </div>
    </div>
  );
}
