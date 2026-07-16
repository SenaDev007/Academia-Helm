/**
 * ============================================================================
 * QHSE RISKS & PREVENTION (Standardisé)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ShieldAlert, Droplets, Zap, Flame, Lock, MoreVertical, Loader2, Plus, X } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface RiskItem {
  id: string | number;
  title?: string;
  name?: string;
  category?: string;
  criticite?: string;
  criticality?: string;
  probability?: number;
  impact?: number;
  icon?: any;
  color?: string;
  bg?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  SECURITE: Lock,
  HYGIENE: Droplets,
  INFRA: Zap,
  ENVIRONNEMENT: Flame,
};

const EMPTY_FORM = { title: '', category: 'SECURITE', probability: 3, impact: 3 };

export default function QHSERisks() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: risks, loading, error, refetch } = useModulesList<RiskItem>('qhse', 'risks', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!formData.title) {
      toast({ title: 'Champ requis', description: 'Le titre est requis', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('qhse/risks', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
      toast({ title: 'Risque créé', description: 'Le risque a été ajouté au registre.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de la création du risque', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des risques...</span>
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

      <div className="flex justify-end">
        <Button variant="destructive" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Risque
        </Button>
      </div>

      {/* Risk Matrix Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-6 shadow-sm space-y-4">
            <h4 className="text-sm font-semibold text-slate-900">Matrice de Criticité</h4>
            <div className="aspect-square grid grid-cols-5 grid-rows-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => {
                const x = i % 5;
                const y = Math.floor(i / 5);
                const isCritical = x + (4 - y) >= 6;
                const isHigh = x + (4 - y) >= 4 && !isCritical;
                return (
                  <div key={i} className={`rounded-sm transition-all hover:scale-110 cursor-help ${
                    isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-400' : 'bg-emerald-400'
                  } opacity-40 hover:opacity-100`} title={`Impact: ${x + 1}, Proba: ${5 - y}`} />
                );
              })}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-rose-500" /> Critique
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-amber-400" /> Élevé
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-400" /> Modéré
              </div>
            </div>
          </Card>
        </div>

        {/* Risk Cards */}
        <div className="lg:col-span-3">
          {risks.length === 0 ? (
            <Card className="text-center py-16 text-slate-500 shadow-sm">
              Aucun risque enregistré pour cette année scolaire.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {risks.map((risk, i) => {
                const Icon = risk.icon || CATEGORY_ICONS[risk.category || ''] || ShieldAlert;
                const color = risk.color || 'text-slate-600';
                const bg = risk.bg || 'bg-slate-50';
                const criticite = risk.criticite || risk.criticality || 'MOYEN';
                return (
                  <Card key={risk.id ?? i} className="p-6 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-6">
                      <div className={`p-4 rounded-xl ${bg} ${color}`}>
                        <Icon className="w-8 h-8" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-5 h-5 text-slate-300" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xl font-semibold text-slate-900 leading-tight">{risk.title || risk.name}</h4>
                        <p className="text-xs text-slate-400 mt-1">{risk.category}</p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-xs text-slate-400">Proba</p>
                            <p className="text-sm font-semibold text-slate-900">{risk.probability ?? '—'}/5</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-slate-400">Impact</p>
                            <p className="text-sm font-semibold text-slate-900">{risk.impact ?? '—'}/5</p>
                          </div>
                        </div>
                        <Badge variant={criticite === 'CRITIQUE' ? 'destructive' : 'outline'} className={
                          criticite === 'ELEVE' || criticite === 'HIGH' ? 'bg-amber-100 text-amber-600 border-amber-100' : ''
                        }>
                          {criticite}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nouveau risque */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau risque</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="risk-title">Titre</Label>
              <Input
                id="risk-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Risque de chute"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risk-category">Catégorie</Label>
              <select
                id="risk-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="SECURITE">Sécurité</option>
                <option value="HYGIENE">Hygiène</option>
                <option value="INFRA">Infrastructure</option>
                <option value="ENVIRONNEMENT">Environnement</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="risk-proba">Probabilité (1-5)</Label>
                <Input
                  id="risk-proba"
                  type="number"
                  min={1}
                  max={5}
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk-impact">Impact (1-5)</Label>
                <Input
                  id="risk-impact"
                  type="number"
                  min={1}
                  max={5}
                  value={formData.impact}
                  onChange={(e) => setFormData({ ...formData, impact: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
