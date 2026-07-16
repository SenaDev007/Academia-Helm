/**
 * ============================================================================
 * SHOP PICKUPS & DELIVERIES - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Table : <Table> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Cards : rounded-xl (au lieu de rounded-[2.5rem])
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Truck, CheckCircle2, Package, MapPin, User, Search, Filter, MoreVertical, Eye, Smartphone, Bell } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

interface DeliveryItem {
  id?: string;
  refNo?: string;
  reference?: string;
  code?: string;
  customerName?: string;
  parentName?: string;
  clientName?: string;
  type?: string;
  deliveryType?: string;
  status?: string;
  date?: string;
  scheduledAt?: string;
  appointment?: string;
  rendezVous?: string;
}

export default function ShopPickups() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: deliveries, loading, error, refetch } = useModulesList<DeliveryItem>(
    'shop',
    'deliveries',
    academicYear?.id,
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      setActionLoading(id);
      await modulesApi.post(`shop/deliveries/${id}/status`, { status: newStatus }, buildModulesApiOptions(academicYear?.id));
      await refetch();
      toast({ title: 'Statut mis à jour', description: `Livraison passée en "${newStatus}".` });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors du changement de statut',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const safeDeliveries = deliveries ?? [];

  const toPickupCount = safeDeliveries.filter((d: any) => {
    const t = (d?.type ?? d?.deliveryType ?? '').toString().toLowerCase();
    const s = (d?.status ?? '').toString().toLowerCase();
    return (t.includes('sur place') || t.includes('pickup')) && (s.includes('prêt') || s.includes('ready') || s.includes('attente') || s.includes('pending'));
  }).length;
  const inProgressCount = safeDeliveries.filter((d: any) => {
    const s = (d?.status ?? '').toString().toLowerCase();
    return s.includes('route') || s.includes('transit') || s.includes('progress');
  }).length;
  const deliveredCount = safeDeliveries.filter((d: any) => {
    const s = (d?.status ?? '').toString().toLowerCase();
    return s.includes('livré') || s.includes('delivered') || s.includes('done');
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Chargement des livraisons...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les livraisons. {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">Livraisons & Retraits</h3>
          <p className="text-sm text-gray-500">Gérez la remise des commandes aux parents et les livraisons à domicile</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline">
            <Truck className="w-4 h-4 mr-2" />
            Planifier Tournée
          </Button>
          <Button
            onClick={() => toast({ title: 'Information', description: 'Sélectionnez une livraison dans le tableau pour confirmer le retrait.' })}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Confirmer Retrait
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard label="À Retirer (Sur place)" count={toPickupCount} icon={Package} color="amber" />
        <StatusCard label="Livraisons en cours" count={inProgressCount} icon={Truck} color="blue" />
        <StatusCard label="Livrés Aujourd'hui" count={deliveredCount} icon={CheckCircle2} color="emerald" />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Rechercher par N° commande, Parent ou Code de retrait..."
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <Card className="shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>N° Code</TableHead>
                    <TableHead>Client / Parent</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Rendez-vous</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {safeDeliveries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-12">
                        Aucune livraison ou retrait enregistré pour cette année scolaire.
                      </TableCell>
                    </TableRow>
                  ) : (
                    safeDeliveries.map((d: any, i: number) => (
                      <PickupRow
                        key={d?.id ?? `dlv-${i}`}
                        id={d?.refNo ?? d?.reference ?? d?.code ?? d?.id ?? `PKP-${i}`}
                        deliveryId={d?.id ?? ''}
                        name={d?.customerName ?? d?.parentName ?? d?.clientName ?? 'Client'}
                        type={d?.type ?? d?.deliveryType ?? 'Sur place'}
                        status={d?.status ?? 'pending'}
                        date={d?.date ?? d?.appointment ?? d?.rendezVous ?? (d?.scheduledAt ? new Date(d.scheduledAt).toLocaleDateString('fr-FR') : '—')}
                        actionLoading={actionLoading}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-slate-900 text-white shadow-md border-0">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-white/10 rounded-md">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold">Vérification SMS</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Saisissez le code de vérification reçu par le parent pour valider le retrait sécurisé de la commande.
            </p>
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <Input
                  key={i}
                  type="text"
                  maxLength={1}
                  className="w-full h-12 bg-white/10 border-white/20 text-center text-lg font-semibold text-white focus:bg-white/20 focus:border-white"
                />
              ))}
            </div>
            <Button variant="outline" className="w-full bg-white text-slate-900 border-white hover:bg-slate-100">
              Valider le Code
            </Button>
          </Card>

          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-navy-900">Notifications</h3>
              <Bell className="w-5 h-5 text-gray-300" />
            </div>
            <div className="space-y-3">
              {safeDeliveries.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Aucune notification récente.</p>
              ) : (
                safeDeliveries.slice(0, 3).map((d: any, i: number) => (
                  <NotificationItem
                    key={`notif-${i}`}
                    text={`Mise à jour : ${d?.refNo ?? d?.reference ?? d?.code ?? 'Commande'} — ${d?.status ?? 'En attente'}`}
                    time="récemment"
                  />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, count, icon: Icon, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <Card className="p-5 shadow-sm">
      <div className={`p-2.5 rounded-lg w-fit border ${colors[color]} mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <h4 className="text-2xl font-semibold text-navy-900">{count}</h4>
    </Card>
  );
}

function PickupRow({ id, deliveryId, name, type, status, date, actionLoading, onStatusChange }: any) {
  const statusStyles: any = {
    'Prêt': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'En Route': 'bg-blue-50 text-blue-700 border-blue-200',
    'En attente': 'bg-amber-50 text-amber-700 border-amber-200',
    'Planifié': 'bg-gray-50 text-gray-500 border-gray-100',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    picked_up: 'bg-blue-50 text-blue-700 border-blue-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  const statusLabel: any = {
    pending: 'En attente',
    ready: 'Prêt',
    picked_up: 'Récupéré',
    delivered: 'Livré',
  };
  const displayStatus = statusLabel[status] ?? status;
  const statusValue = ['pending', 'ready', 'picked_up', 'delivered'].includes(status) ? status : 'pending';

  return (
    <TableRow className="hover:bg-slate-50">
      <TableCell className="text-xs font-medium text-navy-900">{id}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <User className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <span className="text-xs text-gray-600">{name}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-gray-500">
          {type === 'Sur place' ? <MapPin className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
          <span className="text-xs">{type}</span>
        </div>
      </TableCell>
      <TableCell>
        {deliveryId ? (
          <select
            value={statusValue}
            onChange={(e) => onStatusChange(deliveryId, e.target.value)}
            disabled={actionLoading === deliveryId}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${statusStyles[statusValue] ?? 'bg-gray-50 text-gray-500 border-gray-100'} outline-none disabled:opacity-50`}
          >
            <option value="pending">En attente</option>
            <option value="ready">Prêt</option>
            <option value="picked_up">Récupéré</option>
            <option value="delivered">Livré</option>
          </select>
        ) : (
          <Badge variant="outline" className={`text-xs ${statusStyles[status] ?? 'bg-gray-50 text-gray-500 border-gray-100'}`}>
            {displayStatus}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-xs text-gray-500">{date}</TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Visualiser">
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Plus d'actions">
            <MoreVertical className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function NotificationItem({ text, time }: any) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg hover:bg-slate-50 transition-all">
      <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0"></div>
      <div className="flex-1">
        <p className="text-xs text-gray-600 leading-tight">{text}</p>
        <p className="text-xs text-gray-400 mt-1">{time}</p>
      </div>
    </div>
  );
}
