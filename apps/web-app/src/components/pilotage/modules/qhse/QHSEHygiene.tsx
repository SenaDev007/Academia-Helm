/**
 * ============================================================================
 * QHSE HYGIENE & SALUBRITE (Standardisé)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Droplets, CheckCircle2, Trash2, Wind, Utensils, Home, MapPin, Plus, ListChecks, Loader2, X } from 'lucide-react';
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

interface HygieneItem {
  id: string | number;
  zone?: string;
  name?: string;
  title?: string;
  status?: string;
  score?: number;
  lastAudit?: string;
  auditDate?: string;
  inspector?: string;
  auditedBy?: string;
  icon?: any;
  color?: string;
  bg?: string;
}

const ZONE_ICONS: Record<string, any> = {
  Cantine: Utensils,
  Sanitaires: Droplets,
  Dortoirs: Home,
  Salles: ListChecks,
};

function pickZoneIcon(zone?: string) {
  if (!zone) return ListChecks;
  const key = Object.keys(ZONE_ICONS).find((k) => zone.includes(k));
  return key ? ZONE_ICONS[key] : ListChecks;
}

const EMPTY_FORM = { checklistId: '', label: '', status: 'CONFORME' };

export default function QHSEHygiene() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: inspections, loading, error, refetch } = useModulesList<HygieneItem>('qhse', 'hygiene', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddItem = async () => {
    if (!formData.checklistId || !formData.label) {
      toast({ title: 'Champs requis', description: "L'ID checklist et le libellé sont requis", variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `qhse/hygiene/${formData.checklistId}/items`,
        { label: formData.label, status: formData.status },
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
      toast({ title: 'Item ajouté', description: "L'item d'hygiène a été ajouté à la checklist." });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'ajout de l\'item', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des inspections...</span>
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

      {/* Hygiene Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Score Global</p>
            <p className="text-2xl font-semibold text-slate-900">
              {inspections.length > 0
                ? `${Math.round(inspections.reduce((acc, x) => acc + (x.score ?? 0), 0) / inspections.length)}%`
                : '—'}
            </p>
          </div>
        </Card>
        <Card className="p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Non-conformités</p>
            <p className="text-2xl font-semibold text-slate-900">
              {String(inspections.filter((x) => x.status && x.status !== 'CONFORME').length).padStart(2, '0')}
            </p>
          </div>
        </Card>
        <Card className="p-6 shadow-sm flex items-center gap-4">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
            <Wind className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Inspections ce mois</p>
            <p className="text-2xl font-semibold text-slate-900">{inspections.length}</p>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un Item
        </Button>
      </div>

      {inspections.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucune inspection d'hygiène pour cette année scolaire.
        </Card>
      ) : (
        /* Zone Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {inspections.map((inspection, i) => {
            const Icon = inspection.icon || pickZoneIcon(inspection.zone);
            const color = inspection.color || 'text-slate-600';
            const bg = inspection.bg || 'bg-slate-50';
            const zone = inspection.zone || inspection.name || inspection.title || 'Zone';
            const status = inspection.status || 'CONFORME';
            const score = inspection.score ?? 0;
            const lastAudit = inspection.lastAudit || inspection.auditDate || '—';
            const inspector = inspection.inspector || inspection.auditedBy || '—';
            return (
              <Card key={inspection.id ?? i} className="p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${bg} ${color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{zone}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {lastAudit}
                        </p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 border-l border-slate-100 pl-3">
                          Par {inspector}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xl font-semibold mb-1 ${
                      score >= 90 ? 'text-emerald-600' : score >= 70 ? 'text-amber-600' : 'text-rose-600'
                    }`}>
                      {score}%
                    </div>
                    <Badge variant="outline" className={
                      status === 'CONFORME' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                    }>
                      {status === 'CONFORME' ? 'Conforme' : 'Alerte'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button variant="outline" className="flex-1">
                    Détails du contrôle
                  </Button>
                  <Button variant="outline" size="icon" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white">
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Ajouter un item d'hygiène */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un item d'hygiène</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="hyg-checklist">ID de la checklist</Label>
              <Input
                id="hyg-checklist"
                type="text"
                value={formData.checklistId}
                onChange={(e) => setFormData({ ...formData, checklistId: e.target.value })}
                placeholder="Ex: 123 ou uuid"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hyg-label">Libellé</Label>
              <Input
                id="hyg-label"
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Ex: Nettoyage des sanitaires"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hyg-status">Statut</Label>
              <select
                id="hyg-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="CONFORME">Conforme</option>
                <option value="NON_CONFORME">Non conforme</option>
                <option value="A_VERIFIER">À vérifier</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddItem} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
