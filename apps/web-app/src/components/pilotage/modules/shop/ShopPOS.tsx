/**
 * ============================================================================
 * SHOP POS (POINT OF SALE) - ACADEMIA HELM
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
  Wallet, Banknote, QrCode, User, Package,
  ShoppingCart, X
} from 'lucide-react';

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
      alert('Le panier est vide');
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
      alert('Vente encaissée avec succès');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de l\'encaissement');
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
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? 'Erreur lors de la recharge');
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
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-250px)] min-h-[600px] animate-in fade-in duration-700">
      {/* Products Selection Area */}
      <div className="flex-1 flex flex-col space-y-6">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            ⚠ Impossible de charger les articles. {error}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Scanner un code-barres ou rechercher un article..."
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
            />
          </div>
          <button className="p-3.5 bg-navy-900 text-white rounded-2xl hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/20">
            <QrCode className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200 p-8 overflow-y-auto no-scrollbar">
          {(products ?? []).length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
              Aucun article disponible pour le point de vente.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
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
      <div className="w-full lg:w-[400px] flex flex-col space-y-6">
        <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 bg-navy-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/10 rounded-xl">
                <ShoppingCart className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-black uppercase tracking-tight">Panier Actuel</h3>
            </div>
            <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded-lg uppercase tracking-widest">{cart.length} Articles</span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
            {cart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs font-medium text-center">
                Panier vide. Cliquez sur un article pour l'ajouter.
              </div>
            ) : (
              cart.map((item) => (
                <CartItem key={item.id} item={item} />
              ))
            )}
          </div>

          <div className="p-6 bg-gray-50/80 border-t border-gray-100 space-y-3">
            <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
              <span>Sous-total</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-widest">
              <span>TVA (18%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="text-sm font-black text-navy-900 uppercase tracking-tight">Total à payer</span>
              <span className="text-2xl font-black text-navy-900">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Customer & Payment Mode */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Élève</p>
            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100 group cursor-pointer hover:border-navy-500 transition-all">
              <div className="w-10 h-10 rounded-xl bg-navy-100 flex items-center justify-center">
                <User className="w-5 h-5 text-navy-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-navy-900">Associer un élève</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Optionnel</p>
              </div>
              <Plus className="w-4 h-4 text-gray-300" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <PaymentModeBtn icon={Banknote} label="Cash" active={paymentMode === 'cash'} onClick={() => setPaymentMode('cash')} />
            <PaymentModeBtn icon={Wallet} label="Wallet" active={paymentMode === 'wallet'} onClick={() => setPaymentMode('wallet')} />
            <PaymentModeBtn icon={CreditCard} label="Carte" active={paymentMode === 'card'} onClick={() => setPaymentMode('card')} />
          </div>

          <button
            onClick={handleCheckout}
            disabled={submitting || cart.length === 0}
            className="w-full py-4 bg-navy-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/40 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? 'En cours...' : 'Valider l\'Encaissement'}
          </button>
        </div>
      </div>

      {/* Wallet Recharge Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-900">Recharger le Portefeuille</h3>
              <button onClick={() => setWalletModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Montant</label>
              <input type="number" value={walletAmount} onChange={(e) => setWalletAmount(Number(e.target.value))} className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20" />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setWalletModalOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold">Annuler</button>
              <button onClick={handleWalletRecharge} disabled={submitting} className="px-4 py-2 bg-navy-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {submitting ? 'Envoi...' : 'Recharger'}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <button
      type="button"
      onClick={onAdd}
      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-xl hover:border-navy-200 transition-all duration-300 group cursor-pointer active:scale-95 text-left"
    >
      <div className="h-24 bg-gray-50 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
        <span className="text-3xl">{emoji}</span>
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-navy-600 border border-gray-100 shadow-sm">
            <Plus className="w-4 h-4" />
          </div>
        </div>
      </div>
      <h4 className="text-xs font-black text-navy-900 line-clamp-1 mb-1">{name}</h4>
      <p className="text-[10px] font-black text-navy-500 mb-2">{formatCurrency(price)}</p>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Stock: {stock}</span>
        <div className="px-2 py-0.5 bg-gray-50 rounded-md text-[9px] font-black text-gray-400 border border-gray-100">{sku}</div>
      </div>
    </button>
  );
}

function CartItem({ item }: any) {
  return (
    <div className="flex items-center space-x-4 p-3 bg-gray-50/50 rounded-2xl border border-gray-100 group">
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
        {item.image}
      </div>
      <div className="flex-1">
        <p className="text-xs font-black text-navy-900 line-clamp-1">{item.name}</p>
        <p className="text-[10px] font-bold text-navy-500">{formatCurrency(item.price)}</p>
      </div>
      <div className="flex items-center space-x-2">
        <button className="w-6 h-6 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-navy-900 transition-colors">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-black text-navy-900">{item.qty}</span>
        <button className="w-6 h-6 rounded-lg bg-navy-900 flex items-center justify-center text-white hover:bg-navy-800 transition-colors">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function PaymentModeBtn({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all space-y-1 ${
        active
          ? 'bg-navy-900 text-white border-navy-900 shadow-lg shadow-navy-900/20'
          : 'bg-white text-gray-400 border-gray-100 hover:border-navy-500 hover:text-navy-900'
      }`}>
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
