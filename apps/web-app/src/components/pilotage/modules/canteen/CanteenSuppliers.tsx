/**
 * ============================================================================
 * CANTEEN SUPPLIERS — Branché sur backend réel
 * ============================================================================
 *
 * Endpoint (lecture)   : GET  /modules-complementaires/canteen/suppliers
 * Endpoint (création)  : POST /modules-complementaires/canteen/suppliers
 *
 * Refonte juillet 2026 (Task 7-d) :
 *  - alert() → toast() via useToast()
 *  - fixed inset-0 modal → <Dialog> shadcn
 *  - <input>/<label>/<button> HTML → <Input>/<Label>/<Button> shadcn
 *  - rounded-3xl → rounded-xl, font-black uppercase tracking-widest → font-semibold
 *  - SUPPRESSION DES MOCKS HARDCODED : ORDERS_MOCK (3 lignes) supprimé.
 *    Aucun endpoint liste des commandes disponible — la sidebar affiche
 *    un message "Aucune commande" à la place des mocks.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import {
  Search, Plus,
  Phone, Mail, Star,
  ShoppingBag,
  MoreHorizontal, Loader2, Truck,
} from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

interface SupplierItem {
  id: string;
  name?: string;
  companyName?: string;
  contact?: string;
  contactName?: string;
  phone?: string;
  phoneNumber?: string;
  category?: string;
  specialty?: string;
  rating?: number;
  score?: number;
  orders?: number;
  orderCount?: number;
  status?: string;
  email?: string;
  [key: string]: any;
}

interface NewSupplierFormData {
  name: string;
  contact: string;
  phone: string;
}

const emptySupplierForm: NewSupplierFormData = { name: '', contact: '', phone: '' };

export default function CanteenSuppliers() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState<NewSupplierFormData>(emptySupplierForm);
  const [submitting, setSubmitting] = useState(false);
  const { data: suppliers, loading, error, refetch } = useModulesList<SupplierItem>(
    'canteen',
    'suppliers',
    academicYear?.id,
  );

  const handleCreate = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'canteen/suppliers',
        formData,
        buildModulesApiOptions(academicYear?.id),
      );
      setModalOpen(false);
      setFormData(emptySupplierForm);
      await refetch();
      toast({ title: 'Fournisseur créé', description: 'Le fournisseur a été ajouté avec succès.' });
    } catch (e: any) {
      console.error('Erreur création fournisseur :', e?.message || e);
      toast({
        title: 'Erreur création',
        description: e?.message || 'Erreur lors de la création du fournisseur',
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
        <span className="ml-2 text-gray-600">Chargement des fournisseurs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠ Impossible de charger les données. {error}
        </div>
      )}

      {/* Supplier Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-0 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-navy-900 text-lg">Partenaires & Fournisseurs</h3>
              <p className="text-gray-500 text-sm mt-1">Gérez votre chaîne d’approvisionnement</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Nom du fournisseur..."
                  className="pl-10 w-56"
                />
              </div>
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouveau
              </Button>
            </div>
          </div>

          {suppliers.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              Aucun fournisseur enregistré pour cette année scolaire.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {suppliers.map((sup) => (
                <SupplierRow
                  key={sup.id}
                  name={sup.name ?? sup.companyName ?? '—'}
                  contact={sup.contact ?? sup.contactName ?? '—'}
                  phone={sup.phone ?? sup.phoneNumber ?? '—'}
                  email={sup.email}
                  category={sup.category ?? sup.specialty ?? '—'}
                  rating={sup.rating ?? sup.score ?? 0}
                  orders={sup.orders ?? sup.orderCount ?? 0}
                  status={sup.status ?? 'Actif'}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Purchase Orders Sidebar */}
        <Card className="p-6 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-navy-900 flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-gray-500" />
              <span>Dernières Commandes</span>
            </h4>
            <Button variant="link" size="sm">Tout voir</Button>
          </div>
          {/* ORDERS_MOCK supprimé (Task 7-d) : aucun endpoint de liste des
              commandes disponible — message "Aucune commande" à la place. */}
          <div className="text-center py-10 text-sm text-gray-500">
            Aucune commande
          </div>
          <Button variant="outline" className="w-full mt-4">
            Nouveau Bon de Commande
          </Button>
        </Card>
      </div>

      {/* Modal Nouveau Fournisseur */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau Fournisseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="sup-name">Nom / Raison sociale</Label>
              <Input
                id="sup-name"
                type="text"
                placeholder="ex : Grossiste CI"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-contact">Contact</Label>
              <Input
                id="sup-contact"
                type="text"
                placeholder="Nom du contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">Téléphone</Label>
              <Input
                id="sup-phone"
                type="tel"
                placeholder="ex : +225 07 00 00 00"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierRow({ name, contact, phone, email, category, rating, orders, status }: any) {
  const ratingNum = typeof rating === 'number' ? Math.min(Math.max(rating, 0), 5) : 0;
  return (
    <div className="p-6 hover:bg-slate-50 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-semibold text-navy-900 text-lg">{name}</h4>
            <div className="flex items-center space-x-3 mt-1">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100">{category}</Badge>
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < ratingNum ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center">
            <p className="text-xs font-medium text-gray-500 mb-1">Commandes</p>
            <p className="text-sm font-semibold text-navy-900">{orders}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-medium text-navy-700">
              <Phone className="w-3 h-3" />
              <span>{phone}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-medium text-gray-400">
              <Mail className="w-3 h-3" />
              <span>{email ?? `${String(contact).toLowerCase()}@partner.com`}</span>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
