/**
 * ============================================================================
 * QHSE AUDITS & INSPECTIONS (Standardisé)
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { ClipboardList, CheckCircle2, ChevronRight, Plus, Loader2, Flag } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface AuditItem {
  id: string;
  title?: string;
  name?: string;
  type?: string;
  category?: string;
  date?: string;
  auditDate?: string;
  auditor?: string;
  auditedBy?: string;
  score?: number | null;
  status?: string;
}

const EMPTY_FORM = { auditId: '', description: '', severity: 'MOYEN' };

export default function QHSEAudits() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: audits, loading, error, refetch } = useModulesList<AuditItem>('qhse', 'audits', academicYear?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleAddFinding = async () => {
    if (!formData.auditId || !formData.description) {
      toast({ title: 'Champs requis', description: "L'ID audit et la description sont requis", variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        `qhse/audits/${formData.auditId}/findings`,
        { description: formData.description, severity: formData.severity },
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
      toast({ title: 'Constat ajouté', description: 'Le constat a été ajouté à l\'audit.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur lors de l\'ajout du constat', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Chargement des audits...</span>
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
            <ClipboardList className="w-5 h-5 mr-2 text-blue-600" /> Registre des Audits
          </h3>
          <p className="text-slate-500 text-sm">Planification et suivi des inspections réglementaires et internes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Flag className="w-4 h-4 mr-2" />
            Ajouter un Constat
          </Button>
          <Button
            onClick={() => toast({ title: 'Information', description: 'Planification audit — fonctionnalité à venir.' })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Planifier un Audit
          </Button>
        </div>
      </div>

      {audits.length === 0 ? (
        <Card className="text-center py-16 text-slate-500 shadow-sm">
          Aucun audit planifié pour cette année scolaire.
        </Card>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-6 py-4">Audit / ID</TableHead>
                <TableHead className="px-6 py-4">Auditeur</TableHead>
                <TableHead className="px-6 py-4">Date</TableHead>
                <TableHead className="px-6 py-4">Score</TableHead>
                <TableHead className="px-6 py-4 text-right">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audits.map((audit, i) => {
                const title = audit.title || audit.name || 'Audit';
                const type = audit.type || audit.category || 'AUDIT';
                const auditor = audit.auditor || audit.auditedBy || '—';
                const date = audit.date || audit.auditDate || '—';
                const score = audit.score;
                const status = audit.status || 'PLANIFIE';
                return (
                  <TableRow key={audit.id ?? i} className="hover:bg-slate-50 cursor-pointer">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <ClipboardList className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{title}</p>
                          <p className="text-xs text-slate-400">{type} • {audit.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-xs font-semibold text-slate-700">{auditor}</TableCell>
                    <TableCell className="px-6 py-4 text-xs font-medium text-slate-500">{date}</TableCell>
                    <TableCell className="px-6 py-4">
                      {score ? (
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-slate-900">{score}%</div>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      ) : <span className="text-xs text-slate-300 italic">En attente</span>}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Badge variant="outline" className={
                          status === 'TERMINE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          status === 'EN_COURS' ? 'bg-blue-50 text-blue-600 border-blue-100' : ''
                        }>
                          {status.replace(/_/g, ' ')}
                        </Badge>
                        <ChevronRight className="w-5 h-5 text-slate-300" />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal: Ajouter un constat d'audit */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un constat</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="audit-id">ID de l'audit</Label>
              <Input
                id="audit-id"
                type="text"
                value={formData.auditId}
                onChange={(e) => setFormData({ ...formData, auditId: e.target.value })}
                placeholder="Ex: 123 ou uuid"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-desc">Description</Label>
              <textarea
                id="audit-desc"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                placeholder="Décrivez le constat..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-sev">Gravité</Label>
              <select
                id="audit-sev"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="FAIBLE">Faible</option>
                <option value="MOYEN">Moyen</option>
                <option value="IMPORTANT">Important</option>
                <option value="CRITIQUE">Critique</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddFinding} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
