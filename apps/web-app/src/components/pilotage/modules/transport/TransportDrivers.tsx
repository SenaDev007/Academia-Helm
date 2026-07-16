'use client';

import { useState } from 'react';
import { Users, Plus, Search, Phone, ShieldCheck, Loader2 } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface DriverItem {
  id: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  phoneNumber?: string;
  license?: string;
  licenseTypes?: string;
  role?: string;
  expiry?: string;
  licenseExpiry?: string;
  status?: string;
  [key: string]: any;
}

const EMPTY_FORM = { name: '', phone: '', license: '' };

export default function TransportDrivers() {
  const { academicYear } = useModuleContext();
  const { data, loading, error, refetch } = useModulesList<DriverItem>('transport', 'drivers', academicYear?.id);
  const { toast } = useToast();

  const drivers = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<{ name: string; phone: string; license: string }>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post('transport/drivers', formData, buildModulesApiOptions(academicYear?.id));
      toast({ title: 'Personnel créé', description: `${formData.name || 'Chauffeur'} ajouté.` });
      setModalOpen(false);
      setFormData(EMPTY_FORM);
      await refetch();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message || e?.message || 'Erreur lors de la création',
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
        <span className="ml-2 text-gray-600">Chargement...</span>
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Rechercher un chauffeur ou accompagnateur..."
            className="pl-10"
          />
        </div>
        <Button onClick={() => { setFormData(EMPTY_FORM); setModalOpen(true); }}>
          <Plus className="w-4 h-4" /> Nouveau Personnel
        </Button>
      </div>

      {drivers.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          Aucune donnée disponible pour cette année scolaire.
        </div>
      ) : (
        <Card className="shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-4 py-3">Personnel</TableHead>
                  <TableHead className="px-4 py-3">Contact</TableHead>
                  <TableHead className="px-4 py-3">Permis / Rôle</TableHead>
                  <TableHead className="px-4 py-3">Expiration</TableHead>
                  <TableHead className="px-4 py-3">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((person) => {
                  const name = person.name || person.fullName || [person.firstName, person.lastName].filter(Boolean).join(' ') || `Personnel ${person.id}`;
                  const phone = person.phone || person.phoneNumber || '—';
                  const licenseOrRole = person.license || person.licenseTypes || person.role || '—';
                  const expiry = person.expiry || person.licenseExpiry;
                  const status = person.status || 'ACTIVE';
                  return (
                    <TableRow key={person.id} className="hover:bg-slate-50">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-semibold text-xs">
                            {name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{name}</p>
                            <p className="text-xs text-gray-500">ID: DRV-{String(person.id).padStart(3, '0')}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Phone className="w-3 h-3 text-gray-400" /> {phone}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-gray-700">{licenseOrRole}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-700">{expiry ? new Date(expiry).toLocaleDateString() : '—'}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline" className="border-emerald-200 text-emerald-700 bg-emerald-50">
                          {status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau chauffeur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="drv-name">Nom complet</Label>
              <Input
                id="drv-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drv-phone">Téléphone</Label>
              <Input
                id="drv-phone"
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+229 00 00 00 00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drv-license">Permis</Label>
              <Input
                id="drv-license"
                type="text"
                value={formData.license}
                onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                placeholder="Permis B"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
