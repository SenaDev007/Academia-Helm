/**
 * ============================================================================
 * QHSE ACTION PLANS (Standardisé)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, MoreVertical, Plus, Filter, Loader2 } from 'lucide-react';
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

interface ActionPlanItem {
  id: string | number;
  title?: string;
  name?: string;
  origin?: string;
  source?: string;
  responsible?: string;
  assignee?: string;
  priority?: string;
  deadline?: string;
  dueDate?: string;
  progress?: number;
  status?: string;
}

const EMPTY_FORM = { planId: '', description: '', responsible: '', dueDate: '' };

export default function QHSEActionPlans() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: plans, loading, error, refetch } = useModulesList<ActionPlanItem>('qhse', 'action-plans', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddAction = async () => {
    if (!formData.planId || !formData.description) {
      toast({ title: 'Champs requis', description: "L'ID du plan et la description sont requis", variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `qhse/action-plans/${formData.planId}/items`,
        {
          description: formData.description,
          responsible: formData.responsible,
          dueDate: formData.dueDate,
        },
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
      toast({ title: 'Action ajoutée', description: "L'action corrective a été ajoutée au plan." });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'ajout de l\'action', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des plans d'action...</span>
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
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" /> Plans d'Action QHSE
          </h3>
          <p className="text-slate-500 text-sm">Suivi des actions correctives et préventives.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Filter className="w-5 h-5" />
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Action
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucun plan d'action pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, i) => {
            const title = plan.title || plan.name || 'Action';
            const origin = plan.origin || plan.source || '—';
            const responsible = plan.responsible || plan.assignee || '—';
            const priority = plan.priority || 'MOYENNE';
            const deadline = plan.deadline || plan.dueDate || '—';
            const progress = plan.progress ?? 0;
            return (
              <Card key={plan.id ?? i} className="p-6 shadow-sm flex flex-col hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="outline" className={
                    priority === 'CRITIQUE' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                    priority === 'HAUTE' || priority === 'HIGH' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                  }>
                    {priority}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="w-4 h-4 text-slate-300" />
                  </Button>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 line-clamp-2">{title}</h4>
                    <p className="text-xs text-slate-400 mt-1">Origine : {origin}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 italic">Progression</span>
                      <span className="text-slate-900 font-semibold">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-1000 ${
                        progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                      }`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-400">
                        {responsible[0]}
                      </div>
                      <span className="text-xs font-medium text-slate-600">{responsible}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs">{deadline}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Ajouter une action */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une action</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ap-plan">ID du plan d'action</Label>
              <Input
                id="ap-plan"
                type="text"
                value={formData.planId}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                placeholder="Ex: 123 ou uuid"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-desc">Description</Label>
              <textarea
                id="ap-desc"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                placeholder="Décrivez l'action..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-resp">Responsable</Label>
              <Input
                id="ap-resp"
                type="text"
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                placeholder="Ex: M. Dupont"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-due">Date d'échéance</Label>
              <Input
                id="ap-due"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddAction} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
