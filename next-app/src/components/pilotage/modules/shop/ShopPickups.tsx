/**
 * ============================================================================
 * SHOP PICKUPS & DELIVERIES - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  Truck, CheckCircle2, Clock, MapPin, User,
  Calendar, Search, Filter, MoreVertical, Eye,
  Navigation, Smartphone, Bell, Package
} from 'lucide-react';

export default function ShopPickups() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Livraisons & Retraits</h3>
          <p className="text-sm text-gray-400 font-medium">Gérez la remise des commandes aux parents et les livraisons à domicile</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-6 py-3 bg-gray-50 text-navy-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all border border-gray-100">
            <Navigation className="w-4 h-4" />
            <span>Planifier Tournée</span>
          </button>
          <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmer Retrait</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatusCard label="À Retirer (Sur place)" count={18} icon={Package} color="amber" />
        <StatusCard label="Livraisons en cours" count={5} icon={Truck} color="blue" />
        <StatusCard label="Livrés Aujourd'hui" count={42} icon={CheckCircle2} color="emerald" />
      </div>

      {/* Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm flex items-center gap-4">
             <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Rechercher par N° commande, Parent ou Code de retrait..." 
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-navy-500/20 transition-all font-medium"
                />
             </div>
             <button className="p-3 bg-gray-100 text-gray-400 rounded-xl hover:text-navy-900">
                <Filter className="w-4 h-4" />
             </button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                   <thead>
                      <tr className="bg-gray-50/50">
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Code</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client / Parent</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rendez-vous</th>
                         <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      <PickupRow 
                        id="PKP-8824" 
                        name="Ibrahim Dieng" 
                        type="Sur place" 
                        status="Prêt" 
                        date="Aujourd'hui, 14:00" 
                      />
                      <PickupRow 
                        id="DLV-4412" 
                        name="Sana Fall" 
                        type="Domicile" 
                        status="En Route" 
                        date="Aujourd'hui, 15:30" 
                      />
                      <PickupRow 
                        id="PKP-8823" 
                        name="Fatou Gning" 
                        type="Sur place" 
                        status="En attente" 
                        date="Demain, 09:00" 
                      />
                      <PickupRow 
                        id="DLV-4411" 
                        name="Amadou Ba" 
                        type="Domicile" 
                        status="Planifié" 
                        date="19 Mai, 11:00" 
                      />
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="relative z-10">
                 <div className="flex items-center space-x-3 mb-8">
                    <div className="p-3 bg-white/10 rounded-2xl">
                       <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-black uppercase tracking-tight">Vérification SMS</h3>
                 </div>
                 <p className="text-xs text-navy-200 font-medium leading-relaxed mb-8">
                    Saisissez le code de vérification reçu par le parent pour valider le retrait sécurisé de la commande.
                 </p>
                 <div className="flex gap-2 mb-8">
                    {[1, 2, 3, 4].map((i) => (
                      <input key={i} type="text" maxLength={1} className="w-full h-14 bg-white/10 border border-white/20 rounded-xl text-center text-xl font-black focus:bg-white/20 focus:border-white outline-none transition-all" />
                    ))}
                 </div>
                 <button className="w-full py-4 bg-white text-navy-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-navy-50 transition-all active:scale-95">
                    Valider le Code
                 </button>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                 <h3 className="text-lg font-black text-navy-900 uppercase tracking-tight">Notifications</h3>
                 <Bell className="w-5 h-5 text-gray-300" />
              </div>
              <div className="space-y-4">
                 <NotificationItem text="SMS envoyé à M. Dieng pour sa commande #8824" time="2 min" />
                 <NotificationItem text="Livreur #02 a démarré la tournée SUD" time="15 min" />
                 <NotificationItem text="Commande #4409 livrée avec succès" time="1h" />
              </div>
           </div>
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
    <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
       <div className={`p-4 rounded-2xl w-fit border ${colors[color]} mb-6 group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6" />
       </div>
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
       <h4 className="text-3xl font-black text-navy-900">{count}</h4>
    </div>
  );
}

function PickupRow({ id, name, type, status, date }: any) {
  const statusStyles: any = {
    'Prêt': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En Route': 'bg-blue-50 text-blue-600 border-blue-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Planifié': 'bg-gray-50 text-gray-400 border-gray-100',
  };

  return (
    <tr className="hover:bg-gray-50 transition-all group">
       <td className="px-8 py-6 text-xs font-black text-navy-900 group-hover:text-navy-600">{id}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-3">
             <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
             </div>
             <span className="text-xs font-bold text-gray-600">{name}</span>
          </div>
       </td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-2 text-gray-400">
             {type === 'Sur place' ? <MapPin className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
             <span className="text-[10px] font-black uppercase tracking-tight">{type}</span>
          </div>
       </td>
       <td className="px-8 py-6">
          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border ${statusStyles[status]}`}>
             {status}
          </span>
       </td>
       <td className="px-8 py-6 text-[10px] font-bold text-gray-400 uppercase tracking-tight">{date}</td>
       <td className="px-8 py-6">
          <div className="flex items-center space-x-2">
             <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-navy-50 hover:text-navy-600 transition-all">
                <Eye className="w-4 h-4" />
             </button>
             <button className="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition-all">
                <MoreVertical className="w-4 h-4" />
             </button>
          </div>
       </td>
    </tr>
  );
}

function NotificationItem({ text, time }: any) {
   return (
      <div className="flex items-start space-x-3 p-3 rounded-2xl hover:bg-gray-50 transition-all group">
         <div className="w-1.5 h-1.5 rounded-full bg-navy-500 mt-1.5 flex-shrink-0 group-hover:scale-125 transition-transform"></div>
         <div className="flex-1">
            <p className="text-[11px] font-medium text-gray-600 leading-tight">{text}</p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{time} ago</p>
         </div>
      </div>
   );
}
