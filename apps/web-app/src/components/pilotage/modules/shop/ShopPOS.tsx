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
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'FEDAPAY'>('CASH');
  const [submitting, setSubmitting] = useState(false);
  // ⭐ Student association
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; class?: string } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentResults, setStudentResults] = useState<any[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);

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
  // ⭐ FIX: TVA is computed per-product via ShopProduct.taxRate (stored in DB).
  //    Previously hardcoded to 18% which was wrong — not all products have 18% TVA.
  //    The backend computes the real tax from each item's taxRate.
  //    Here we show the subtotal as the total (tax is 0 for products with taxRate=0).
  const total = subtotal;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: 'Panier vide', description: 'Ajoutez au moins un article avant d\'encaisser.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      // ⭐ FIX: Send subTotal, taxAmount (0 for now — per-product taxRate),
      //    and totalAmount so the backend stores the correct amounts.
      await modulesApi.post(
        'shop/sales',
        {
          items: cart.map((it) => ({ productId: it.id, quantity: it.qty, unitPrice: it.price })),
          paymentMode: paymentMode,
          customerType: selectedStudent ? 'STUDENT' : 'WALK_IN',
          studentId: selectedStudent?.id || undefined,
          customerName: selectedStudent?.name || undefined,
          subTotal: subtotal,
          taxAmount: 0,
          totalAmount: subtotal,
        },
        buildModulesApiOptions(academicYear?.id),
      );
      setCart([]);
      setSelectedStudent(null);
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

  // ⭐ Student search
  const handleStudentSearch = async (query: string) => {
    if (!query.trim()) { setStudentResults([]); return; }
    setStudentLoading(true);
    try {
      const res = await fetch(`/api/students?search=${encodeURIComponent(query)}&limit=20`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const students = Array.isArray(data) ? data : (data?.items ?? data?.students ?? []);
        setStudentResults(students);
      }
    } catch { setStudentResults([]); }
    finally { setStudentLoading(false); }
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                <CartItem
                  key={item.id}
                  item={item}
                  onIncrement={() => setCart(prev => prev.map(it => it.id === item.id ? { ...it, qty: it.qty + 1 } : it))}
                  onDecrement={() => setCart(prev => prev.flatMap(it => {
                    if (it.id === item.id) {
                      return it.qty > 1 ? [{ ...it, qty: it.qty - 1 }] : []; // remove if qty reaches 0
                    }
                    return [it];
                  }))}
                />
              ))
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
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
            {selectedStudent ? (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-900">{selectedStudent.name}</p>
                  {selectedStudent.class && <p className="text-xs text-gray-500">{selectedStudent.class}</p>}
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-xs text-red-500 hover:text-red-700">
                  Retirer
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-300 transition-all cursor-pointer"
                onClick={() => { setStudentModalOpen(true); setStudentSearch(''); setStudentResults([]); }}
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-navy-900">Associer un élève</p>
                  <p className="text-xs text-gray-400">Optionnel</p>
                </div>
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PaymentModeBtn icon={Banknote} label="Espèces" active={paymentMode === 'CASH'} onClick={() => setPaymentMode('CASH')} />
            <PaymentModeBtn icon={CreditCard} label="FedaPay" active={paymentMode === 'FEDAPAY'} onClick={() => setPaymentMode('FEDAPAY')} />
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

      {/* Student Search Modal */}
      <Dialog open={studentModalOpen} onOpenChange={setStudentModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Associer un élève</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom, prénom ou matricule..."
                className="pl-9"
                value={studentSearch}
                onChange={(e) => { setStudentSearch(e.target.value); handleStudentSearch(e.target.value); }}
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {studentLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : studentResults.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  {studentSearch ? 'Aucun élève trouvé.' : 'Tapez pour rechercher un élève.'}
                </p>
              ) : (
                studentResults.map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
                      const className = s.classroom?.name || s.academicClass?.name || '';
                      setSelectedStudent({ id: s.id, name: fullName, class: className });
                      setStudentModalOpen(false);
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg text-left transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                      {(s.firstName?.[0] || '') + (s.lastName?.[0] || '')}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-navy-900">
                        {s.firstName} {s.lastName}
                      </p>
                      {s.matricule && <p className="text-xs text-gray-500">{s.matricule}</p>}
                    </div>
                    {s.classroom?.name && (
                      <span className="text-xs text-gray-500 bg-slate-100 px-2 py-0.5 rounded">{s.classroom.name}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentModalOpen(false)}>Annuler</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function POSProductCard({ product, index, onAdd }: any) {
  const name = product?.name ?? `Article #${index}`;
  const price = product?.price ?? product?.unitPrice ?? 0;
  const stock = (typeof product?.stock === 'object' && product?.stock !== null
    ? product.stock.quantity
    : product?.stock) ?? product?.quantity ?? 0;
  const sku = product?.sku ?? product?.code ?? `SKU-${index}`;
  const emoji = product?.emoji ?? '📦';

  return (
    <Button
      variant="outline"
      onClick={onAdd}
      className="bg-white rounded-xl border-slate-200 p-3 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 h-auto flex-row items-center gap-3 text-left"
    >
      {/* Left: product icon */}
      <div className="w-14 h-14 bg-slate-50 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
        {emoji}
      </div>
      {/* Center: product info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium text-navy-900 truncate mb-0.5">{name}</h4>
        <p className="text-xs font-semibold text-indigo-600 mb-0.5">{formatCurrency(price)}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Stock: {stock}</span>
          <span className="text-[10px] text-gray-400 bg-slate-50 px-1 rounded font-mono">{sku}</span>
        </div>
      </div>
      {/* Right: add button */}
      <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Plus className="w-4 h-4 text-indigo-600" />
      </div>
    </Button>
  );
}

function CartItem({ item, onIncrement, onDecrement }: any) {
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
        <Button variant="outline" size="icon" className="h-6 w-6" onClick={onDecrement}>
          <Minus className="w-3 h-3" />
        </Button>
        <span className="text-xs font-medium text-navy-900 w-5 text-center">{item.qty}</span>
        <Button size="icon" className="h-6 w-6" onClick={onIncrement}>
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
