/**
 * ============================================================================
 * EDUCAST CHANNELS
 * ============================================================================
 *
 * Refonte juillet 2026 : le backend GET /educast/teacher-channel peut renvoyer
 * soit un tableau, soit un objet unique (findFirst). On gère les deux cas en
 * wrappant l'objet dans un tableau si nécessaire (pour compatibilité avec
 * useModulesList qui attend un tableau).
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { MonitorPlay, Settings as SettingsIcon, Plus, ChevronRight, Star, Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';

interface ChannelItem {
  id: string | number;
  name?: string;
  title?: string;
  owner?: string;
  ownerName?: string;
  contents?: number;
  contentCount?: number;
  subs?: number;
  subscribers?: number;
  subscriberCount?: number;
  status?: string;
  color?: string;
  description?: string;
  subject?: string;
}

const PALETTE = ['bg-slate-900', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-600', 'bg-amber-600'];

const EMPTY_FORM = { name: '', description: '', subject: '' };

export default function EduCastChannels() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: rawData, loading, error, refetch } = useModulesList<ChannelItem>('educast', 'teacher-channel', academicYear?.id);

  // ⭐ Gestion du cas où le backend renvoie un objet unique (findFirst) au lieu d'un tableau.
  // On le wrap dans un tableau pour que la suite du composant puisse itérer normalement.
  const channels: ChannelItem[] = Array.isArray(rawData)
    ? rawData
    : rawData
      ? [rawData]
      : [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChannelItem | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | number | null>(null);

  const openCreate = () => {
    setEditTarget(null);
    setFormData(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (channel: ChannelItem) => {
    setEditTarget(channel);
    setFormData({
      name: channel.name || channel.title || '',
      description: channel.description || '',
      subject: channel.subject || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: 'Champ manquant', description: 'Le nom est requis.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      if (editTarget) {
        await modulesApi.patch(`educast/teacher-channel/${editTarget.id}`, formData, buildModulesApiOptions(academicYear?.id));
        toast({ title: 'Chaîne modifiée', description: 'Les informations ont été mises à jour.' });
      } else {
        await modulesApi.post('educast/teacher-channel', formData, buildModulesApiOptions(academicYear?.id));
        toast({ title: 'Chaîne créée', description: 'La chaîne a été ajoutée avec succès.' });
      }
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      setEditTarget(null);
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'enregistrement', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubscribe = async (channelId: string | number) => {
    try {
      setActionLoading(channelId);
      await modulesApi.post(`educast/channels/${channelId}/subscribe`, {}, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Abonnement réussi', description: 'Vous êtes maintenant abonné à cette chaîne.' });
      await refetch();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'abonnement', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des chaînes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-navy-900">Chaînes EduCast</h3>
          <p className="text-slate-500 text-sm">Organisez vos contenus par thématiques ou services.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Créer une Chaîne
        </Button>
      </div>

      {channels.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune chaîne EduCast pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel, i) => {
            const name = channel.name || channel.title || 'Chaîne';
            const owner = channel.owner || channel.ownerName || '—';
            const contents = channel.contents ?? channel.contentCount ?? 0;
            const subs = channel.subs ?? channel.subscribers ?? channel.subscriberCount ?? 0;
            const status = channel.status || 'ACTIVE';
            const color = channel.color || PALETTE[i % PALETTE.length];
            return (
              <Card key={channel.id ?? i} className="p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${color}`} />

                <div className="space-y-4 pl-2">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-blue-50 transition-colors">
                      <MonitorPlay className={`w-7 h-7 ${color.replace('bg-', 'text-')}`} />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(channel)} title="Modifier">
                      <SettingsIcon className="w-4 h-4 text-slate-400" />
                    </Button>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">{name}</h4>
                    <p className="text-xs text-slate-500 mt-1">Responsable: {owner}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Contenus</p>
                      <p className="text-base font-semibold text-slate-900">{contents}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Abonnés</p>
                      <p className="text-base font-semibold text-slate-900">{subs}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="outline" className={status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      {status}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="link"
                        size="sm"
                        className="text-emerald-600 h-8"
                        onClick={() => handleSubscribe(channel.id)}
                        disabled={actionLoading === channel.id}
                      >
                        {actionLoading === channel.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <UserPlus className="w-3.5 h-3.5 mr-1" />}
                        S&apos;abonner
                      </Button>
                      <Button variant="link" size="sm" className="text-blue-600 h-8">
                        Ouvrir
                        <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Créer / Modifier une chaîne */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Modifier la chaîne' : 'Créer une chaîne'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Chaîne Maths M. Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>Sujet / Matière</Label>
              <Input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Ex: Mathématiques"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                placeholder="Décrivez votre chaîne..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editTarget ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
