/**
 * ============================================================================
 * EDUCAST TEACHER STUDIO
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { MonitorPlay, Plus, Settings as SettingsIcon, Camera, Edit3, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface TeacherChannel {
  id?: string | number;
  name?: string;
  title?: string;
  slogan?: string;
  tagline?: string;
  subs?: number;
  subscribers?: number;
  subscriberCount?: number;
  status?: string;
  isMonetized?: boolean;
  monetizationEnabled?: boolean;
  avatar?: string | null;
  avatarUrl?: string | null;
  banner?: string | null;
  bannerUrl?: string | null;
  balance?: string | number;
  availableBalance?: string | number;
}

export default function EduCastTeacherStudio() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [channel, setChannel] = useState<TeacherChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [channelSlogan, setChannelSlogan] = useState('');
  const [channelDesc, setChannelDesc] = useState('');

  const refresh = async () => {
    if (!academicYear?.id) return;
    try {
      const result = await modulesApi.get<TeacherChannel>('educast/teacher-channel', buildModulesApiOptions(academicYear.id));
      const resolved: TeacherChannel = Array.isArray(result)
        ? result[0] ?? {}
        : ((result as any)?.data ?? result ?? {});
      setChannel(resolved);
      setChannelName(resolved.name || resolved.title || '');
      setChannelSlogan(resolved.slogan || resolved.tagline || '');
      setChannelDesc('');
    } catch (e: any) {
      setError(e?.message || 'Erreur de chargement');
    }
  };

  useEffect(() => {
    if (!academicYear?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await modulesApi.get<TeacherChannel>('educast/teacher-channel', buildModulesApiOptions(academicYear.id));
        const resolved: TeacherChannel = Array.isArray(result)
          ? result[0] ?? {}
          : ((result as any)?.data ?? result ?? {});
        if (!cancelled) {
          setChannel(resolved);
          setChannelName(resolved.name || resolved.title || '');
          setChannelSlogan(resolved.slogan || resolved.tagline || '');
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYear?.id]);

  const handleSaveChannel = async () => {
    try {
      setSaving(true);
      const payload = { name: channelName, slogan: channelSlogan, description: channelDesc };
      if (channel?.id) {
        await modulesApi.patch(`educast/teacher-channel/${channel.id}`, payload, buildModulesApiOptions(academicYear?.id));
      } else {
        await modulesApi.post('educast/teacher-channel', payload, buildModulesApiOptions(academicYear?.id));
      }
      toast({ title: 'Chaîne enregistrée', description: 'Les informations de votre chaîne ont été mises à jour.' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePayoutRequest = async () => {
    const amountStr = prompt('Montant du paiement (F CFA) :');
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      toast({ title: 'Montant invalide', description: 'Veuillez saisir un montant supérieur à 0.', variant: 'destructive' });
      return;
    }
    try {
      await modulesApi.post('educast/payout-requests', { amount }, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Demande envoyée', description: 'Votre demande de paiement a bien été transmise.' });
      await refresh();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la demande de paiement', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement de votre chaîne enseignant...</span>
      </div>
    );
  }

  const name = channel?.name || channel?.title || 'Ma Chaîne Enseignant';
  const slogan = channel?.slogan || channel?.tagline || '';
  const subs = channel?.subs ?? channel?.subscribers ?? channel?.subscriberCount ?? 0;
  const status = channel?.status || 'ACTIVE';
  const isMonetized = channel?.isMonetized ?? channel?.monetizationEnabled ?? false;
  const balance = channel?.balance ?? channel?.availableBalance ?? '0';

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger votre chaîne enseignant. {error}
        </div>
      )}

      {/* Banner Preview */}
      <div className="relative h-48 md:h-64 bg-slate-900 rounded-xl overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/40 to-transparent z-10" />
        <div className="absolute inset-0 flex items-center px-6 md:px-12 z-20">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-200 rounded-full border-4 border-white overflow-hidden flex items-center justify-center text-slate-400">
                {channel?.avatar || channel?.avatarUrl ? (
                  <img src={channel.avatar || channel.avatarUrl || ''} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8" />
                )}
              </div>
              <Button size="icon" className="absolute bottom-0 right-0 h-8 w-8 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg border-2 border-white">
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>
            <div className="text-white space-y-2">
              <h2 className="text-xl md:text-3xl font-semibold">{name}</h2>
              {slogan && <p className="text-white/70 italic">&ldquo;{slogan}&rdquo;</p>}
              <div className="flex items-center gap-3 pt-1">
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 backdrop-blur">{subs} Abonnés</Badge>
                <Badge variant="outline" className={`backdrop-blur flex items-center gap-1 ${status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border-amber-400/30'}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {status === 'ACTIVE' ? 'Chaîne Active' : status}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <Button variant="secondary" className="absolute top-4 right-4 md:top-6 md:right-12 z-20 bg-white/10 backdrop-blur text-white hover:bg-white/20">
          <ImageIcon className="w-4 h-4 mr-2" />
          Modifier Bannière
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Management */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-navy-900">Gestion de ma Chaîne</h3>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Vidéo
            </Button>
          </div>

          <Card className="p-6 shadow-sm space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Nom de la Chaîne</Label>
                <Input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="Nom de votre chaîne" />
              </div>
              <div className="space-y-2">
                <Label>Slogan</Label>
                <Input type="text" value={channelSlogan} onChange={(e) => setChannelSlogan(e.target.value)} placeholder="Slogan court" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description Longue</Label>
              <textarea
                rows={4}
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                placeholder="Décrivez votre vision pédagogique..."
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveChannel} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enregistrer les modifications
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Monetization Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-navy-900">Monétisation</h3>

          <div className={`rounded-xl p-6 space-y-4 shadow-sm ${isMonetized ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl ${isMonetized ? 'bg-amber-500 text-slate-900' : 'bg-slate-200 text-slate-400'}`}>
                <Zap className="w-6 h-6" />
              </div>
              {isMonetized && <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-400/30">Activé</Badge>}
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-semibold">Programme Partenaire</h4>
              <p className={`text-xs leading-relaxed ${isMonetized ? 'text-white/70' : 'text-slate-500'}`}>
                Vendez vos cours et générez des revenus basés sur votre impact pédagogique.
              </p>
            </div>

            {isMonetized ? (
              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-white/60">Solde Disponible</p>
                    <p className="text-2xl font-semibold text-amber-400">{balance} <span className="text-xs">F CFA</span></p>
                  </div>
                  <Button variant="link" size="sm" className="text-white">Détails</Button>
                </div>
                <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white" onClick={handlePayoutRequest}>
                  Demander un paiement
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={() => toast({ title: 'Bientôt disponible', description: 'Cette fonctionnalité sera bientôt activée.' })}>
                Demander l&apos;éligibilité
              </Button>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Conseil Sarah AI</p>
              <p className="text-xs text-amber-800/80 leading-relaxed">Vos capsules sur les &ldquo;Fonctions Dérivées&rdquo; génèrent 40% plus d&apos;intérêt que la moyenne. Pensez à créer un pack premium.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
