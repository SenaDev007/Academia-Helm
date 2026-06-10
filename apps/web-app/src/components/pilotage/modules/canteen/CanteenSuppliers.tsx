import React from 'react';
import { 
  Truck, Search, Filter, Plus, 
  Phone, Mail, MapPin, Star,
  ClipboardList, ShoppingBag, History,
  ChevronRight, MoreHorizontal, Download
} from 'lucide-react';

export default function CanteenSuppliers() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Supplier Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="font-black text-navy-900 text-xl tracking-tight">Partenaires & Fournisseurs</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Gérez votre chaîne d'approvisionnement</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Nom du fournisseur..." 
                  className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-56 transition-all"
                />
              </div>
              <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
                <Plus className="w-4 h-4" />
                <span>Nouveau</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            <SupplierRow 
              name="Grossiste Alimentaire CI"
              contact="M. Koffi"
              phone="+225 07 07 07 07 07"
              category="Denrées Sèches"
              rating={5}
              orders={124}
              status="Actif"
            />
            <SupplierRow 
              name="Boucherie Moderne"
              contact="Mme Traoré"
              phone="+225 05 05 05 05 05"
              category="Viandes & Poissons"
              rating={4}
              orders={82}
              status="Actif"
            />
            <SupplierRow 
              name="Agro-Légumes Express"
              contact="M. Soro"
              phone="+225 01 01 01 01 01"
              category="Fruits & Légumes"
              rating={5}
              orders={215}
              status="Actif"
            />
          </div>
        </div>

        {/* Purchase Orders Sidebar */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-8">
            <h4 className="font-black text-navy-900 flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-navy-400" />
              <span>Dernières Commandes</span>
            </h4>
            <button className="text-[10px] font-black text-navy-600 uppercase hover:underline">Tout voir</button>
          </div>
          <div className="space-y-6">
            <OrderItem 
              id="BC-2026-105"
              supplier="Grossiste CI"
              date="14 Mai"
              amount="450 000 F"
              status="Reçu"
            />
            <OrderItem 
              id="BC-2026-106"
              supplier="Boucherie Moderne"
              date="15 Mai"
              amount="120 000 F"
              status="En cours"
            />
            <OrderItem 
              id="BC-2026-107"
              supplier="Agro-Légumes"
              date="15 Mai"
              amount="85 000 F"
              status="Brouillon"
            />
          </div>
          <button className="w-full mt-10 py-4 bg-gray-50 text-navy-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">
            Nouveau Bon de Commande
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierRow({ name, contact, phone, category, rating, orders, status }: any) {
  return (
    <div className="p-8 group hover:bg-navy-50/30 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy-50 to-white border border-navy-100 flex items-center justify-center text-navy-600 font-black text-lg shadow-sm group-hover:scale-110 transition-all">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-black text-navy-900 text-lg tracking-tight">{name}</h4>
            <div className="flex items-center space-x-3 mt-1">
              <p className="text-[10px] font-black text-navy-400 uppercase tracking-widest bg-navy-50 px-2 py-0.5 rounded border border-navy-100">{category}</p>
              <div className="flex items-center text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < rating ? 'fill-current' : 'text-gray-200'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-8">
          <div className="text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Commandes</p>
            <p className="text-sm font-black text-navy-900">{orders}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-navy-700">
              <Phone className="w-3 h-3" />
              <span>{phone}</span>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold text-gray-400">
              <Mail className="w-3 h-3" />
              <span>{contact.toLowerCase()}@partner.com</span>
            </div>
          </div>
          <button className="p-2.5 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100 shadow-sm">
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderItem({ id, supplier, date, amount, status }: any) {
  const statusStyles: any = {
    'Reçu': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En cours': 'bg-blue-50 text-blue-600 border-blue-100',
    'Brouillon': 'bg-gray-50 text-gray-400 border-gray-100',
  };
  return (
    <div className="p-4 rounded-2xl bg-gray-50/50 border border-gray-50 hover:bg-white hover:border-gray-100 transition-all group/order">
      <div className="flex justify-between items-start mb-2">
        <p className="text-[10px] font-black text-navy-900 uppercase tracking-widest">{id}</p>
        <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${statusStyles[status]}`}>
          {status}
        </div>
      </div>
      <p className="text-xs font-black text-navy-900 group-hover/order:text-navy-600 transition-colors">{supplier}</p>
      <div className="flex justify-between items-center mt-3">
        <p className="text-[10px] font-bold text-gray-400 italic">{date}</p>
        <p className="text-xs font-black text-navy-900">{amount}</p>
      </div>
    </div>
  );
}
