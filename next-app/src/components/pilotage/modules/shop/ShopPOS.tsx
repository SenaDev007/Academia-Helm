/**
 * ============================================================================
 * SHOP POS (POINT OF SALE) - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { 
  Search, Plus, Minus, Trash2, CreditCard, 
  Wallet, Banknote, QrCode, User, Package,
  Zap, ShoppingCart, Tag, CheckCircle2
} from 'lucide-react';

export default function ShopPOS() {
  const [cart, setCart] = useState<any[]>([
    { id: 1, name: 'Cahier Academia 200p', price: 1200, qty: 2, image: '📔' },
    { id: 2, name: 'Uniforme Polo Sport (L)', price: 8500, qty: 1, image: '👕' },
  ]);

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const tax = subtotal * 0.18; // 18% TVA
  const total = subtotal + tax;

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-250px)] min-h-[600px] animate-in fade-in duration-700">
      {/* Products Selection Area */}
      <div className="flex-1 flex flex-col space-y-6">
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <POSProductCard key={i} index={i} />
            ))}
          </div>
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
            {cart.map((item) => (
              <CartItem key={item.id} item={item} />
            ))}
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
            <PaymentModeBtn icon={Banknote} label="Cash" active />
            <PaymentModeBtn icon={Wallet} label="Wallet" />
            <PaymentModeBtn icon={CreditCard} label="Carte" />
          </div>

          <button className="w-full py-4 bg-navy-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/40 active:scale-[0.98]">
            Valider l'Encaissement
          </button>
        </div>
      </div>
    </div>
  );
}

function POSProductCard({ index }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-xl hover:border-navy-200 transition-all duration-300 group cursor-pointer active:scale-95">
      <div className="h-24 bg-gray-50 rounded-xl mb-4 flex items-center justify-center relative overflow-hidden">
         <Package className="w-10 h-10 text-gray-200 group-hover:scale-110 transition-transform duration-500" />
         <div className="absolute top-2 right-2">
            <div className="w-6 h-6 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-navy-600 border border-gray-100 shadow-sm">
              <Plus className="w-4 h-4" />
            </div>
         </div>
      </div>
      <h4 className="text-xs font-black text-navy-900 line-clamp-1 mb-1">Cahier Academia #{index}</h4>
      <p className="text-[10px] font-black text-navy-500 mb-2">{formatCurrency(1200 + (index * 100))}</p>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Stock: 45</span>
        <div className="px-2 py-0.5 bg-gray-50 rounded-md text-[9px] font-black text-gray-400 border border-gray-100">PAP-0{index}</div>
      </div>
    </div>
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

function PaymentModeBtn({ icon: Icon, label, active }: any) {
  return (
    <button className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all space-y-1 ${
      active 
        ? 'bg-navy-900 text-white border-navy-900 shadow-lg shadow-navy-900/20' 
        : 'bg-white text-gray-400 border-gray-100 hover:border-navy-500 hover:text-navy-900'
    }`}>
      <Icon className="w-5 h-5" />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
