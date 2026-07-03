'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Lock, Unlock, Archive, Edit, Trash2, BarChart3, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { ModuleContentArea } from '@/components/modules/blueprint';
import { useModuleContext } from '@/hooks/useModuleContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { financeService } from '@/services/finance.service';
import { formatCurrency } from '@/lib/utils';

interface CashRegister {
  id: string;
  code: string;
  name: string;
  description?: string;
  location?: string;
  openingBalance: string | number;
  currentBalance: string | number;
  isOpen: boolean;
  isActive: boolean;
  openedAt?: string;
  closedAt?: string;
  responsibleUser?: { id: string; firstName: string; lastName: string; email: string };
  openedBy?: { id: string; firstName: string; lastName: string };
  closedBy?: { id: string; firstName: string; lastName: string };
  _count?: { transactions: number };
}

export default function CashRegistersContent() {
  const { toast } = useToast();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<CashRegister | null>(null);
  const [closeModal, setCloseModal] = useState<CashRegister | null>(null);
  const [statsModal, setStatsModal] = useState<CashRegister | null>(null);
  const [stats, setStats] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    location: '',
    openingBalance: '0',
    responsibleUserId: '',
  });

  const [closeForm, setCloseForm] = useState({
    countedBalance: '',
    note: '',
  });

  const loadRegisters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeService.getCashRegisters();
      setRegisters(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e.message || 'Impossible de charger les caisses',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadRegisters();
  }, [loadRegisters]);

  const handleCreate = async () => {
    if (!formData.code || !formData.name) {
      toast({ title: 'Erreur', description: 'Code et nom sont requis', variant: 'destructive' });
      return;
    }
    try {
      await financeService.createCashRegister({
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        location: formData.location || undefined,
        openingBalance: Number(formData.openingBalance) || 0,
        responsibleUserId: formData.responsibleUserId || undefined,
      });
      toast({ title: '✅ Caisse créée', description: `${formData.code} - ${formData.name}` });
      setCreateModal(false);
      setFormData({ code: '', name: '', description: '', location: '', openingBalance: '0', responsibleUserId: '' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!editModal) return;
    try {
      await financeService.updateCashRegister(editModal.id, {
        name: editModal.name,
        description: editModal.description,
        location: editModal.location,
      });
      toast({ title: '✅ Caisse mise à jour' });
      setEditModal(null);
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleOpen = async (reg: CashRegister) => {
    try {
      await financeService.openCashRegister(reg.id, {});
      toast({ title: '🔓 Caisse ouverte', description: `${reg.code} - ${reg.name}` });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleClose = async () => {
    if (!closeModal) return;
    try {
      const result = await financeService.closeCashRegister(closeModal.id, {
        countedBalance: closeForm.countedBalance ? Number(closeForm.countedBalance) : undefined,
      });
      if (result.closure?.hasDiscrepancy) {
        toast({
          title: '⚠️ Écart détecté',
          description: `Écart de ${formatCurrency(result.closure.discrepancy)} XOF`,
          variant: 'destructive',
        });
      } else {
        toast({ title: '🔒 Caisse fermée' });
      }
      setCloseModal(null);
      setCloseForm({ countedBalance: '', note: '' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleArchive = async (reg: CashRegister) => {
    if (!confirm(`Archiver la caisse "${reg.code} - ${reg.name}" ? Elle ne pourra plus être utilisée.`)) return;
    try {
      await financeService.archiveCashRegister(reg.id);
      toast({ title: '📦 Caisse archivée' });
      loadRegisters();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  const handleStats = async (reg: CashRegister) => {
    try {
      const data = await financeService.getCashRegisterStats(reg.id);
      setStats(data);
      setStatsModal(reg);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <ModuleContentArea
        toolbar={
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Gestion des caisses de l'établissement — ouverture/fermeture, suivi des soldes, rapprochement.
            </p>
            <Button onClick={() => setCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle caisse
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : registers.length === 0 ? (
          <div className="text-center py-12">
            <Wallet className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 mb-4">Aucune caisse configurée</p>
            <Button onClick={() => setCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Créer la première caisse
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-right">Solde courant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Transactions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registers.map((reg) => (
                  <TableRow key={reg.id} className={!reg.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-semibold">{reg.code}</TableCell>
                    <TableCell>{reg.name}</TableCell>
                    <TableCell className="text-slate-500">{reg.location || '-'}</TableCell>
                    <TableCell className="text-slate-500">
                      {reg.responsibleUser
                        ? `${reg.responsibleUser.firstName} ${reg.responsibleUser.lastName}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(Number(reg.currentBalance))}
                    </TableCell>
                    <TableCell>
                      {reg.isOpen ? (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          <Unlock className="h-3 w-3 mr-1" />
                          Ouverte
                        </Badge>
                      ) : reg.isActive ? (
                        <Badge variant="secondary">
                          <Lock className="h-3 w-3 mr-1" />
                          Fermée
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Archive className="h-3 w-3 mr-1" />
                          Archivée
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-slate-500">
                      {reg._count?.transactions || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {reg.isActive && !reg.isOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpen(reg)}
                            title="Ouvrir la caisse"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {reg.isOpen && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCloseModal(reg);
                              setCloseForm({
                                countedBalance: String(reg.currentBalance),
                                note: '',
                              });
                            }}
                            title="Fermer la caisse"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStats(reg)}
                          title="Statistiques"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditModal(reg)}
                          title="Modifier"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {reg.isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(reg)}
                            title="Archiver"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ModuleContentArea>

      {/* === Modal Création === */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle caisse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="ex: CAISSE-01"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="openingBalance">Solde d'ouverture (XOF)</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                placeholder="ex: Caisse principale"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location">Emplacement</Label>
              <Input
                id="location"
                placeholder="ex: Bureau d'accueil"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Description optionnelle"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModal(false)}>Annuler</Button>
            <Button onClick={handleCreate}>Créer la caisse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Édition === */}
      <Dialog open={!!editModal} onOpenChange={(v) => !v && setEditModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la caisse {editModal?.code}</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="edit-name">Nom</Label>
                <Input
                  id="edit-name"
                  value={editModal.name}
                  onChange={(e) => setEditModal({ ...editModal, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-location">Emplacement</Label>
                <Input
                  id="edit-location"
                  value={editModal.location || ''}
                  onChange={(e) => setEditModal({ ...editModal, location: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editModal.description || ''}
                  onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModal(null)}>Annuler</Button>
            <Button onClick={handleUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Fermeture === */}
      <Dialog open={!!closeModal} onOpenChange={(v) => !v && setCloseModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fermer la caisse {closeModal?.code}</DialogTitle>
          </DialogHeader>
          {closeModal && (
            <div className="space-y-4 py-2">
              <div className="bg-slate-50 p-3 rounded-md text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-500">Solde théorique :</span>
                  <span className="font-semibold">{formatCurrency(Number(closeModal.currentBalance))} XOF</span>
                </div>
                <div className="text-xs text-slate-400">
                  Dernière ouverture : {closeModal.openedAt ? new Date(closeModal.openedAt).toLocaleString('fr-FR') : '-'}
                </div>
              </div>
              <div>
                <Label htmlFor="countedBalance">Solde physique compté (XOF)</Label>
                <Input
                  id="countedBalance"
                  type="number"
                  value={closeForm.countedBalance}
                  onChange={(e) => setCloseForm({ ...closeForm, countedBalance: e.target.value })}
                  placeholder="Saisir le montant compté en caisse"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Un écart sera signalé si le montant ne correspond pas au solde théorique.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModal(null)}>Annuler</Button>
            <Button onClick={handleClose}>Fermer la caisse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Modal Statistiques === */}
      <Dialog open={!!statsModal} onOpenChange={(v) => !v && setStatsModal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Statistiques — {statsModal?.code} {statsModal?.name}</DialogTitle>
          </DialogHeader>
          {stats && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-xs text-emerald-600">Volume total</p>
                  <p className="text-lg font-bold text-emerald-900">{formatCurrency(stats.totalVolume)} XOF</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg">
                  <p className="text-xs text-rose-600">Annulations</p>
                  <p className="text-lg font-bold text-rose-900">{formatCurrency(stats.reversalVolume)} XOF</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-blue-600">Volume net</p>
                  <p className="text-lg font-bold text-blue-900">{formatCurrency(stats.netVolume)} XOF</p>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-xs text-slate-500 mb-1">Transactions totales</p>
                <p className="text-2xl font-bold">{stats.totalTransactions}</p>
              </div>
              {stats.byMethod && stats.byMethod.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Par méthode de paiement</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Méthode</TableHead>
                        <TableHead className="text-right">Nb transactions</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.byMethod.map((m: any) => (
                        <TableRow key={m.method}>
                          <TableCell className="font-medium">{m.method}</TableCell>
                          <TableCell className="text-right">{m.count}</TableCell>
                          <TableCell className="text-right">{formatCurrency(m.total)} XOF</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatsModal(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
