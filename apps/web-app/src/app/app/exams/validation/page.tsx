/**
 * ============================================================================
 * MODULE 3 : VALIDATIONS ACADÉMIQUES
 * ============================================================================
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Search, 
  MessageSquare,
  AlertCircle,
  FileText,
  User,
  ArrowRight
} from 'lucide-react';
import { ModuleContainer } from '@/components/modules/blueprint';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useModuleContext } from '@/hooks/useModuleContext';
import { institutionalExamsService } from '@/services/institutional-exams.service';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/components/ui/toast';
import { EXAMS_SUB_MODULES } from '../sub-modules';

export default function ValidationPage() {
  const { academicYear, schoolLevel } = useModuleContext();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!schoolLevel?.id || !academicYear?.id) return;
      try {
        setLoading(true);
        const res = await institutionalExamsService.getPendingValidations(schoolLevel.id, academicYear.id);
        setBatches(res);
      } catch (error) {
        console.error('Error loading validations', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [schoolLevel, academicYear]);

  const handleApprove = async () => {
    try {
      await institutionalExamsService.approveBatch(selectedBatch.id, reviewComment);
      toast({ title: "Approuvé", description: "Les notes ont été verrouillées avec succès." });
      setBatches(prev => prev.filter(b => b.id !== selectedBatch.id));
      setIsApproveOpen(false);
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la validation", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!reviewComment) {
      toast({ title: "Commentaire requis", description: "Veuillez expliquer la raison du rejet.", variant: "destructive" });
      return;
    }
    try {
      await institutionalExamsService.rejectBatch(selectedBatch.id, reviewComment);
      toast({ title: "Rejeté", description: "L'évaluation a été renvoyée pour correction." });
      setBatches(prev => prev.filter(b => b.id !== selectedBatch.id));
      setIsRejectOpen(false);
    } catch (error) {
      toast({ title: "Erreur", description: "Échec du rejet", variant: "destructive" });
    }
  };

  return (
    <ModuleContainer
      header={{
        title: 'Validations Académiques',
        description: 'Vérification et verrouillage officiel des résultats.',
        icon: 'shieldCheck',
      }}
      subModules={{ 
        modules: EXAMS_SUB_MODULES,
        activeModuleId: 'validation'
      }}
      content={{
        layout: 'full',
        children: (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3">
              <ShieldCheck className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-900">Processus de Verrouillage</h4>
                <p className="text-xs text-blue-700">Une fois validée, une évaluation ne peut plus être modifiée par l'enseignant sans une demande de déverrouillage formelle.</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead>Évaluation</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Soumis par</TableHead>
                    <TableHead>Date Soumission</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-gray-900">{batch.evaluation.title}</div>
                        <div className="text-xs text-gray-500">{batch.evaluation.subject.name}</div>
                      </TableCell>
                      <TableCell>{batch.evaluation.class.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center text-sm">
                          <User className="w-3 h-3 mr-1 text-gray-400" />
                          {batch.submittedById}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(batch.submittedAt), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-100 text-amber-700 border-none">En attente</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 border-blue-100 hover:bg-blue-50"
                            onClick={() => {
                                // Rediriger vers la vue des notes pour vérification
                                window.location.href = `/app/exams/grades?evaluationId=${batch.evaluationId}`;
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Vérifier
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                                setSelectedBatch(batch);
                                setIsApproveOpen(true);
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => {
                                setSelectedBatch(batch);
                                setIsRejectOpen(true);
                            }}
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {batches.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-gray-500 italic">
                        Aucun lot en attente de validation.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Approval Dialog */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Valider les résultats</DialogTitle>
                  <DialogDescription>
                    Vous êtes sur le point de valider officiellement l'évaluation <strong>{selectedBatch?.evaluation?.title}</strong>. 
                    Cela verrouillera les notes de manière permanente.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Commentaire (optionnel)</label>
                    <Input 
                      placeholder="Félicitations pour la tenue des délais..." 
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsApproveOpen(false)}>Annuler</Button>
                  <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">Confirmer la Validation</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Rejection Dialog */}
            <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-red-600">Rejeter l'évaluation</DialogTitle>
                  <DialogDescription>
                    Veuillez indiquer le motif du rejet. L'enseignant recevra une notification et pourra corriger les notes.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Motif du rejet (obligatoire)</label>
                    <Input 
                      placeholder="Notes incohérentes, barème non respecté..." 
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="border-red-200 focus:ring-red-500"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsRejectOpen(false)}>Annuler</Button>
                  <Button onClick={handleReject} variant="destructive">Confirmer le Rejet</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )
      }}
    />
  );
}
