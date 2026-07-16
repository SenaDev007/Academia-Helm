/**
 * ============================================================================
 * INFIRMARY VISITS TAB
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance — <Input>/<Button>
 * shadcn, <Dialog> shadcn (au lieu de fixed inset-0), Cards rounded-xl,
 * alert() → toast(), plus de font-black uppercase tracking-widest.
 * Logique useModulesList + modulesApi conservée.
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  Plus,
  Search,
  Calendar as CalendarIcon,
  Filter,
  Clock,
  ExternalLink,
  UserCheck,
  Home,
  AlertTriangle,
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

interface VisitItem {
  id: string;
  student?: string;
  studentName?: string;
  class?: string;
  className?: string;
  time?: string;
  visitTime?: string;
  reason?: string;
  visitReason?: string;
  action?: string;
  actionTaken?: string;
  status?: string;
  visitStatus?: string;
  [key: string]: any;
}

const STATUS_META: Record<string, { icon: any; color: string; statusLabel: string }> = {
  IN_PROGRESS: { icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100', statusLabel: 'En observation' },
  COMPLETED: { icon: UserCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', statusLabel: 'Retour en classe' },
  TRANSFERRED: { icon: Home, color: 'text-rose-600 bg-rose-50 border-rose-100', statusLabel: 'Transféré / Foyer' },
  EMERGENCY: { icon: AlertTriangle, color: 'text-red-700 bg-red-50 border-red-200', statusLabel: 'Urgence Vitale' },
};

export default function InfirmaryVisits() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<VisitItem>('infirmary', 'visits', academicYear?.id);
  const { toast } = useToast();

  const visits = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', reason: '', symptoms: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/visits', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', reason: '', symptoms: '' });
      await refetch();
      toast({
        title: 'Passage enregistré',
        description: 'La visite a été ajoutée au registre infirmerie.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur lors de la création',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création de la visite',
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
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => { setFormData({ studentId: '', reason: '', symptoms: '' }); setModalOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Passage
          </Button>
          <Button variant="outline">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Aujourd'hui
          </Button>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher une visite..."
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4 text-slate-600" />
          </Button>
        </div>
      </div>

      {/* Visits Log */}
      {visits.length === 0 ? (
        <Card className="p-12 text-center text-slate-500 shadow-sm">
          Aucune donnée disponible pour cette année scolaire.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {visits.map((visit, i) => {
            const status = visit.status || visit.visitStatus || 'IN_PROGRESS';
            const meta = STATUS_META[status] ?? STATUS_META.IN_PROGRESS;
            const Icon = meta.icon;
            const student = visit.student || visit.studentName || `Élève ${visit.id}`;
            const className = visit.class || visit.className || '';
            const time = visit.time || visit.visitTime || '—';
            const reason = visit.reason || visit.visitReason || '—';
            const action = visit.action || visit.actionTaken || '—';
            return (
              <motion.div
                key={visit.id ?? i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`p-5 rounded-xl border bg-white shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${meta.color.split(' ')[2]}`}
              >
                <div className="flex items-start space-x-4">
                  <div className={`mt-1 p-2 rounded-xl ${meta.color.split(' ')[0]} ${meta.color.split(' ')[1]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-semibold text-navy-900">{student}</h4>
                      <span className="text-xs font-medium text-slate-400">• {time}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-2">{className}</p>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm text-slate-700"><span className="font-semibold">Motif:</span> {reason}</p>
                      <p className="text-sm text-slate-600 italic"><span className="font-semibold not-italic">Action:</span> {action}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-right">
                    <Badge variant="outline" className={meta.color}>
                      {meta.statusLabel}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" className="hover:bg-slate-100 hover:text-blue-600">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      Détails
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <Button variant="outline" className="w-full py-4 border-dashed border-2">
        Afficher les visites des jours précédents
      </Button>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle visite</DialogTitle>
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
              <Label htmlFor="reason">Motif de visite</Label>
              <Input
                id="reason"
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Maux de tête"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symptoms">Symptômes</Label>
              <textarea
                id="symptoms"
                value={formData.symptoms}
                onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
                rows={3}
                placeholder="Description des symptômes"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
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
