/**
 * ============================================================================
 * LABORATORIES LIST
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Infirmerie.
 * - alert() → useToast()
 * - modal fixed inset-0 → <Dialog> shadcn
 * - <input>/<label> HTML → <Input>/<Label> shadcn
 * - <button> bg-navy-900 → <Button> shadcn
 * - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { Loader2, Beaker, MapPin, Users, User, ShieldCheck, ChevronRight, Plus } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface LabItem {
  id?: string;
  name?: string;
  type?: string;
  labType?: string;
  building?: string;
  floor?: string;
  location?: string;
  capacity?: number;
  manager?: string;
  responsible?: string;
  status?: string;
}

export default function LabsList() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: labs, loading, error, refetch } = useModulesList<LabItem>(
    'labs',
    '',
    academicYear?.id,
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [labForm, setLabForm] = useState({ name: '', location: '', capacity: 0, type: '' });

  const handleCreateLab = async () => {
    if (!labForm.name?.trim()) {
      toast({
        title: 'Champ requis',
        description: 'Veuillez saisir un nom de laboratoire.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post('labs', labForm, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setLabForm({ name: '', location: '', capacity: 0, type: '' });
      await refetch();
      toast({
        title: 'Laboratoire créé',
        description: `${labForm.name} a été ajouté avec succès.`,
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de création',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la création du laboratoire',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des laboratoires...</span>
      </div>
    );
  }

  const safeLabs = labs ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les laboratoires. {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-900">Nos Espaces Laboratoires</h3>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouveau Laboratoire
        </Button>
      </div>

      {safeLabs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucun laboratoire enregistré pour cette année scolaire.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {safeLabs.map((lab: any, i: number) => {
            const id = lab?.id ?? `LAB-${i}`;
            const name = lab?.name ?? `Laboratoire #${i + 1}`;
            const type = lab?.type ?? lab?.labType ?? 'Général';
            const building = lab?.building ?? '—';
            const floor = lab?.floor ?? lab?.location ?? '';
            const capacity = lab?.capacity ?? 0;
            const manager = lab?.manager ?? lab?.responsible ?? '—';
            const status = (lab?.status ?? 'ACTIVE').toString().toUpperCase();
            return (
              <Card key={id} className="p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex items-start gap-6">
                  <div className="p-4 bg-slate-50 rounded-xl text-slate-400">
                    <Beaker className="w-8 h-8" />
                  </div>
                  <div className="space-y-4 flex-1">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-lg font-semibold text-slate-900">{name}</h4>
                        <Badge variant={status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {status}
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-slate-400">{id} • {type}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center text-slate-500 text-sm">
                        <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                        <span>{building}{floor ? `, ${floor}` : ''}</span>
                      </div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <Users className="w-4 h-4 mr-2 text-slate-400" />
                        <span>Capacité : {capacity}</span>
                      </div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <User className="w-4 h-4 mr-2 text-slate-400" />
                        <span>Resp : {manager}</span>
                      </div>
                      <div className="flex items-center text-slate-500 text-sm">
                        <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                        <span>QHSE Certifié</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {[1, 2, 3].map((_, j) => (
                          <div key={j} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white" />
                        ))}
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-xs font-medium text-slate-500">
                          +12
                        </div>
                      </div>
                      <Button variant="link" className="text-blue-600">
                        Détails & Équipements
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lab Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Laboratoire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="lab-name">Nom</Label>
              <Input
                id="lab-name"
                value={labForm.name}
                onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
                placeholder="ex : Laboratoire de Physique"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lab-location">Emplacement</Label>
              <Input
                id="lab-location"
                value={labForm.location}
                onChange={(e) => setLabForm({ ...labForm, location: e.target.value })}
                placeholder="ex : Bâtiment A, 1er étage"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="lab-capacity">Capacité</Label>
                <Input
                  id="lab-capacity"
                  type="number"
                  value={labForm.capacity}
                  onChange={(e) => setLabForm({ ...labForm, capacity: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lab-type">Type</Label>
                <Input
                  id="lab-type"
                  value={labForm.type}
                  onChange={(e) => setLabForm({ ...labForm, type: e.target.value })}
                  placeholder="ex : Physique"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateLab} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
