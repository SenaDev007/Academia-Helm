/**
 * ============================================================================
 * MEDICAL CHECKUPS TAB
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance — <Input>/<Button>
 * shadcn, <Dialog> shadcn, Cards rounded-xl, alert() → toast(),
 * plus de font-black uppercase tracking-widest, plus de rounded-3xl,
 * plus de text-[10px]. Logique useModulesList + modulesApi conservée.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  Calendar,
  Plus,
  Filter,
  Search,
  Users,
  CheckCircle2,
  ChevronRight,
  MoreVertical,
  Stethoscope,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface CheckupItem {
  id: string;
  title?: string;
  name?: string;
  date?: string;
  checkupDate?: string;
  time?: string;
  timeSlot?: string;
  location?: string;
  checkupLocation?: string;
  target?: string;
  targetAudience?: string;
  provider?: string;
  healthProvider?: string;
  status?: string;
  checkupStatus?: string;
  [key: string]: any;
}

export default function MedicalCheckups() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<CheckupItem>('infirmary', 'checkups', academicYear?.id);
  const { toast } = useToast();

  const checkups = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', type: 'GENERAL', results: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/checkups', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', type: 'GENERAL', results: '' });
      await refetch();
      toast({
        title: 'Bilan créé',
        description: 'Le bilan de santé a été ajouté au registre.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur lors de la création',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création du bilan',
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
        <span className="ml-2 text-slate-600">Chargement...</span>
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

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 flex-wrap">
          <Button
            onClick={() => { setFormData({ studentId: '', type: 'GENERAL', results: '' }); setModalOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Bilan
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher une campagne..."
              className="pl-10 w-64"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Checkups List */}
      {checkups.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune donnée disponible pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {checkups.map((checkup, i) => {
            const title = checkup.title || checkup.name || `Campagne ${checkup.id}`;
            const date = checkup.date || checkup.checkupDate || '—';
            const time = checkup.time || checkup.timeSlot || '';
            const target = checkup.target || checkup.targetAudience || '—';
            const provider = checkup.provider || checkup.healthProvider || '—';
            const status = (checkup.status || checkup.checkupStatus || 'PLANNED').toUpperCase();
            const isCompleted = status === 'COMPLETED';
            return (
              <motion.div
                key={checkup.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="p-6 shadow-sm hover:shadow-md transition-all group h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-3 rounded-xl ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className={
                        isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        'bg-blue-100 text-blue-700 border-blue-200'
                      }>
                        {isCompleted ? 'Terminé' : 'À venir'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-navy-900 mb-2 group-hover:text-blue-600 transition-colors">{title}</h3>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-400">Date & Heure</p>
                      <div className="flex items-center text-sm font-semibold text-slate-700">
                        <Calendar className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        {date}
                      </div>
                      {time && (
                        <div className="flex items-center text-xs font-medium text-slate-500 pl-5">
                          {time}
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-400">Cible</p>
                      <div className="flex items-center text-sm font-semibold text-slate-700">
                        <Users className="w-3.5 h-3.5 mr-2 text-slate-400" />
                        {target}
                      </div>
                      <p className="text-xs text-slate-400 pl-5">{provider}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center text-xs font-medium text-slate-500">
                      <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                      {isCompleted ? 'Rapport validé' : '0% élèves examinés'}
                    </div>
                    <Button variant="link" size="sm" className="text-blue-600 flex items-center">
                      {isCompleted ? 'Voir Résultats' : 'Gérer la Visite'}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau bilan de santé</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                type="text"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                placeholder="student-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkupType">Type de bilan</Label>
              <select
                id="checkupType"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="GENERAL">Bilan général</option>
                <option value="VISION">Vision</option>
                <option value="HEARING">Audition</option>
                <option value="DENTAL">Bilan dentaire</option>
                <option value="SCOLIOSIS">Dépistage scoliose</option>
                <option value="BMI">IMC / Croissance</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="results">Résultats</Label>
              <textarea
                id="results"
                value={formData.results}
                onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                rows={3}
                placeholder="Détails des résultats du bilan"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
