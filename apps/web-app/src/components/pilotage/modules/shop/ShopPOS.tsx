/**
 * ============================================================================
 * SHOP POS (POINT OF SALE) - ACADEMIA HELM
 * ============================================================================
 *
 * Refonte juillet 2026 : alignement sur le pattern Finance/Students.
 *  - Boutons : <Button> shadcn
 *  - Inputs/Labels : <Input>/<Label> shadcn
 *  - Modals : <Dialog> shadcn
 *  - Notifications : useToast() (au lieu de alert())
 *  - Cards : rounded-xl border-gray-200
 *  - Typo : font-semibold (au lieu de font-black uppercase tracking-widest)
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useModuleContext } from '@/hooks/useModuleContext';
import { useModulesList } from '@/lib/modules-complementaires/hooks';
import { modulesApi, buildModulesApiOptions } from '@/lib/modules-complementaires/client';
import {
  Loader2, Search, Plus, Minus, CreditCard,
  Wallet, Banknote, QrCode, User, ShoppingCart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface ProductItem {
  id?: string;
  name?: string;
  sku?: string;
  price?: number;
  unitPrice?: number;
  stock?: number;
  quantity?: number;
  category?: string;
  imageUrl?: string;
  image?: string;
  emoji?: string;
}

export default function ShopPOS() {
  const { academicYear } = useModuleContext();
  const { toast } = useToast();
  const { data: products, loading, error, refetch } = useModulesList<ProductItem>(
    'shop',
    'products',
    academicYear?.id,
  );

  const [cart, setCart] = useState<any[]>([]);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'wallet' | 'card'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAmount, setWalletAmount] = useState(0);

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.id === product.id);
      if (existing) {
        return prev.map((it) => (it.id === product.id ? { ...it, qty: it.qty + 1 } : it));
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product?.name ?? 'Article',
          price: product?.price ?? product?.unitPrice ?? 0,
          qty: 1,
          image: product?.emoji ?? product?.image ?? '📦',
        },
      ];
    });
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.18; // 18% TVA
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: 'Panier vide', description: 'Ajoutez au moins un article avant d\'encaisser.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      await modulesApi.post(
        'shop/sales',
        {
          items: cart.map((it) => ({ productId: it.id, quantity: it.qty, price: it.price })),
          paymentMethod: paymentMode,
          total,
        },
        buildModulesApiOptions(academicYear?.id),
      );
      setCart([]);
      await refetch();
      toast({ title: 'Vente encaissée', description: 'La transaction a été enregistrée avec succès.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'encaissement',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleWalletRecharge = async () => {
    try {
      setSubmitting(true);
      await modulesApi.post(
        'shop/wallet/recharge',
        { amount: walletAmount },
        buildModulesApiOptions(academicYear?.id),
      );
      setWalletModalOpen(false);
      setWalletAmount(0);
      await refetch();
      toast({ title: 'Recharge effectuée', description: 'Le portefeuille a été rechargé.' });
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la recharge',
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
        <span className="ml-2 text-gray-600">Chargement des articles...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-250px)] min-h-[600px] animate-in fade-in duration-700">
      {/* Products Selection Area */}
      <div className="flex-1 flex flex-col space-y-6">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            ⚠ Impossible de charger les articles. {error}
          </div>
        )}

        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Scanner un code-barres ou rechercher un article..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10">
              <QrCode className="w-5 h-5" />
            </Button>
          </div>
        </Card>

        <div className="flex-1 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6 overflow-y-auto">
          {(products ?? []).length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Aucun article disponible pour le point de vente.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {(products ?? []).map((product, i) => (
                <POSProductCard
                  key={product?.id ?? `pos-${i}`}
                  product={product}
                  index={i + 1}
                  onAdd={() => addToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Area */}
      <div className="w-full lg:w-[380px] flex flex-col space-y-4">
        <Card className="shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/10 rounded-md">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm">Panier Actuel</h3>
            </div>
            <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/20">{cart.length} Articles</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs text-center">
                Panier vide. Cliquez sur un article pour l'ajouter.
              </div>
            ) : (
              cart.map((item) => (
                <CartItem key={item.id} item={item} />
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>TVA (18%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <span className="text-sm font-semibold text-navy-900">Total à payer</span>
              <span className="text-xl font-semibold text-navy-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </Card>

        {/* Customer & Payment Mode */}
        <Card className="shadow-sm p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Client / Élève</p>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-300 transition-all cursor-pointer">
              <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-navy-900">Associer un élève</p>
                <p className="text-xs text-gray-400">Optionnel</p>
              </div>
              <Plus className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <PaymentModeBtn icon={Banknote} label="Cash" active={paymentMode === 'cash'} onClick={() => setPaymentMode('cash')} />
            <PaymentModeBtn icon={Wallet} label="Wallet" active={paymentMode === 'wallet'} onClick={() => setPaymentMode('wallet')} />
            <PaymentModeBtn icon={CreditCard} label="Carte" active={paymentMode === 'card'} onClick={() => setPaymentMode('card')} />
          </div>

          <Button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            className="w-full"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitting ? 'En cours...' : 'Valider l\'Encaissement'}
          </Button>
        </Card>
      </div>

      {/* Wallet Recharge Modal */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recharger le Portefeuille</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Montant</Label>
              <Input
                type="number"
                value={walletAmount}
                onChange={(e) => setWalletAmount(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletModalOpen(false)}>Annuler</Button>
            <Button onClick={handleWalletRecharge} disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? 'Envoi...' : 'Recharger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function POSProductCard({ product, index, onAdd }: any) {
  const name = product?.name ?? `Article #${index}`;
  const price = product?.price ?? product?.unitPrice ?? 0;
  const stock = product?.stock ?? product?.quantity ?? 0;
  const sku = product?.sku ?? `SKU-${index}`;
  const emoji = product?.emoji ?? '📦';

  return (
    <Button
      variant="outline"
      onClick={onAdd}
      className="bg-white rounded-xl border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 h-auto flex-col items-stretch"
    >
      <div className="h-20 bg-slate-50 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
        <span className="text-2xl">{emoji}</span>
        <div className="absolute top-1.5 right-1.5">
          <div className="w-5 h-5 bg-white/90 rounded-md flex items-center justify-center text-indigo-600 border border-slate-100 shadow-sm">
            <Plus className="w-3 h-3" />
          </div>
        </div>
      </div>
      <h4 className="text-xs font-medium text-navy-900 line-clamp-1 mb-1 text-left">{name}</h4>
      <p className="text-xs font-semibold text-indigo-600 mb-2 text-left">{formatCurrency(price)}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">Stock: {stock}</span>
        <div className="px-1.5 py-0.5 bg-slate-50 rounded text-xs text-gray-400 border border-slate-100 font-mono">{sku}</div>
      </div>
    </Button>
  );
}

function CartItem({ item }: any) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-lg border border-slate-100">
      <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center text-lg shadow-sm">
        {item.image}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-navy-900 line-clamp-1">{item.name}</p>
        <p className="text-xs text-indigo-600">{formatCurrency(item.price)}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="icon" className="h-6 w-6">
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-xs font-medium text-navy-900 w-5 text-center">{item.qty}</span>
        <Button size="icon" className="h-6 w-6">
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

function PaymentModeBtn({ icon: Icon, label, active, onClick }: any) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-lg h-auto gap-1 ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-600 hover:text-white shadow-sm'
          : 'bg-white text-gray-500 border-slate-200 hover:border-indigo-300 hover:text-navy-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </Button>
  );
}
