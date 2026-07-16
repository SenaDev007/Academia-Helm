/**
 * ============================================================================
 * PARENTAL AUTHORIZATIONS TAB
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
  ClipboardCheck,
  UserCheck,
  XCircle,
  Clock,
  FileText,
  Search,
  Download,
  Mail,
  Plus,
  CheckCircle2,
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

interface AuthorizationItem {
  id: string;
  student?: string;
  studentName?: string;
  parent?: string;
  parentName?: string;
  type?: string;
  authorizationType?: string;
  status?: string;
  authorizationStatus?: string;
  date?: string;
  period?: string;
  validityPeriod?: string;
  [key: string]: any;
}

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  VALIDATED: { label: 'Validée', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: UserCheck },
  PENDING: { label: 'En attente', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Clock },
  REFUSED: { label: 'Refusée', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: XCircle },
};

export default function Authorizations() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<AuthorizationItem>('infirmary', 'authorizations', academicYear?.id);
  const { toast } = useToast();

  const authorizations = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ studentId: '', type: 'MEDICATION', medication: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('infirmary/authorizations', formData, buildModulesApiOptions(academicYear?.id));
      setModalOpen(false);
      setFormData({ studentId: '', type: 'MEDICATION', medication: '' });
      await refetch();
      toast({
        title: 'Autorisation créée',
        description: 'L\'autorisation parentale a été enregistrée et mise en attente de validation.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur lors de la création',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création de l\'autorisation',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`infirmary/authorizations/${id}/validate`, {}, buildModulesApiOptions(academicYear?.id));
      await refetch();
      toast({
        title: 'Autorisation validée',
        description: 'L\'autorisation est désormais active.',
      });
    } catch (e: any) {
      toast({
        title: 'Erreur de validation',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la validation',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  // Statistiques calculées à partir des données réelles
  const total = authorizations.length;
  const validated = authorizations.filter((a) => (a.status || a.authorizationStatus || '').toUpperCase() === 'VALIDATED').length;
  const pending = authorizations.filter((a) => (a.status || a.authorizationStatus || '').toUpperCase() === 'PENDING').length;
  const validationRate = total > 0 ? Math.round((validated / total) * 100) : 0;

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

      {/* Overview */}
      <Card className="bg-slate-900 border-slate-900 p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
        <div className="max-w-md">
          <h2 className="text-xl font-semibold mb-3 flex items-center">
            <ClipboardCheck className="w-7 h-7 mr-3 text-emerald-400" />
            Autorisations de Soins
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Gérez les permissions parentales pour l'administration de médicaments, les premiers soins et les transferts d'urgence.
          </p>
        </div>
        <div className="flex items-center space-x-6 flex-wrap gap-4 justify-center">
          <div className="text-center">
            <p className="text-3xl font-bold text-emerald-400">{validationRate}%</p>
            <p className="text-xs font-medium text-slate-400">Taux de Validation</p>
          </div>
          <div className="w-px h-12 bg-slate-700" />
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-400">{pending}</p>
            <p className="text-xs font-medium text-slate-400">En attente</p>
          </div>
          <Button
            onClick={() => { setFormData({ studentId: '', type: 'MEDICATION', medication: '' }); setModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Autorisation
          </Button>
          <Button variant="secondary" className="bg-white text-slate-900 hover:bg-slate-100">
            <Mail className="w-4 h-4 mr-2" />
            Relancer Parents
          </Button>
        </div>
      </Card>

      {/* Main List */}
      <Card className="shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 gap-4 flex-wrap">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Chercher une autorisation..."
              className="pl-10"
            />
          </div>
          <div className="flex items-center space-x-2">
            {['Toutes', 'Validées', 'En attente', 'Refusées'].map((f, i) => (
              <Button
                key={i}
                variant={i === 0 ? 'default' : 'outline'}
                size="sm"
                className={i === 0 ? 'bg-slate-900 hover:bg-slate-800' : ''}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {authorizations.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              Aucune donnée disponible pour cette année scolaire.
            </div>
          ) : authorizations.map((auth, i) => {
            const student = auth.student || auth.studentName || `Élève ${auth.id}`;
            const parent = auth.parent || auth.parentName || '—';
            const type = auth.type || auth.authorizationType || '—';
            const date = auth.date || auth.period || auth.validityPeriod || '—';
            const rawStatus = (auth.status || auth.authorizationStatus || 'PENDING').toUpperCase();
            const meta = STATUS_META[rawStatus] ?? STATUS_META.PENDING;
            const StatusIcon = meta.icon;
            return (
              <motion.div
                key={auth.id ?? i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="p-6 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center space-x-4 w-full md:w-1/3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-semibold text-slate-400">
                    {student.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-navy-900">{student}</h4>
                    <p className="text-xs text-slate-500 font-medium">{parent}</p>
                  </div>
                </div>

                <div className="w-full md:w-1/3">
                  <p className="text-sm font-semibold text-slate-700">{type}</p>
                  <p className="text-xs text-slate-400 font-medium">Période: {date}</p>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-1/3">
                  <div className="flex items-center space-x-2">
                    <StatusIcon className={`w-4 h-4 ${meta.color.split(' ')[0]}`} />
                    <Badge variant="outline" className={meta.color}>
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    {rawStatus === 'PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => handleValidate(auth.id)}
                        disabled={actionLoading === auth.id}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {actionLoading === auth.id ? 'Envoi...' : 'Valider'}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="hover:bg-slate-100 hover:text-blue-600">
                      <FileText className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hover:bg-slate-100 hover:text-blue-600">
                      <Download className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle autorisation</DialogTitle>
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
              <Label htmlFor="authType">Type d'autorisation</Label>
              <select
                id="authType"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="MEDICATION">Administration de médicaments</option>
                <option value="FIRST_AID">Premiers soins</option>
                <option value="EMERGENCY_TRANSFER">Transfert d'urgence</option>
                <option value="EXCURSION">Sortie scolaire</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="medication">Médicament / Détails</Label>
              <textarea
                id="medication"
                value={formData.medication}
                onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                rows={3}
                placeholder="Nom du médicament, posologie, etc."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
