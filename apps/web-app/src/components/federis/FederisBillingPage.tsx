/**
 * FederisBillingPage Component
 * 
 * Gestion de la Facturation et des Cotisations Réseau
 * Module 19 de l'infrastructure Academia Federis
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn, formatCurrency } from '@/lib/utils';

interface Invoice {
  id: string;
  schoolName: string;
  amount: number;
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  dueDate: string;
}

export default function FederisBillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([
    { id: '1', schoolName: 'Lycée Technique de Cotonou', amount: 450000, status: 'PAID', dueDate: '2024-03-01' },
    { id: '2', schoolName: 'Collège Notre Dame', amount: 320000, status: 'PENDING', dueDate: '2024-05-15' },
    { id: '3', schoolName: 'Groupe Scolaire Les Pépites', amount: 150000, status: 'OVERDUE', dueDate: '2024-04-10' },
  ]);

  return (
    <div className="space-y-8">
      {/* Header Premium Finance */}
      <div className="bg-gradient-to-br from-gold-500 to-amber-700 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
           <div>
              <div className="flex items-center space-x-3 mb-4">
                 <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
                    <AppIcon name="finance" size="dashboard" className="text-white" />
                 </div>
                 <h1 className="text-4xl font-black tracking-tight italic">Finance & Facturation</h1>
              </div>
              <p className="text-amber-100/70 text-lg max-w-xl font-medium leading-relaxed">
                Consolidez les revenus du réseau, gérez les cotisations annuelles et suivez les règlements des établissements affiliés.
              </p>
           </div>
           
           <div className="flex gap-4">
              <div className="bg-black/20 backdrop-blur-md px-8 py-5 rounded-2xl border border-white/10 text-center">
                 <p className="text-2xl font-black">12.5M</p>
                 <p className="text-[10px] font-bold text-amber-200 uppercase tracking-widest">Revenu Global (XOF)</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Liste des factures */}
         <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Registre des Cotisations</h3>
               <button className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Générer le Batch</button>
            </div>
            
            <div className="divide-y divide-gray-50">
               {invoices.map(invoice => (
                 <div key={invoice.id} className="p-8 flex items-center justify-between hover:bg-gray-50 transition-all group">
                    <div className="flex items-center space-x-6">
                       <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center font-black text-amber-900 text-lg group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                          {invoice.schoolName[0]}
                       </div>
                       <div>
                          <h4 className="text-lg font-black text-gray-900">{invoice.schoolName}</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                             Échéance : {new Date(invoice.dueDate).toLocaleDateString()}
                          </p>
                       </div>
                    </div>

                    <div className="flex items-center space-x-8">
                       <div className="text-right">
                          <p className="text-lg font-black text-gray-900">{formatCurrency(invoice.amount)}</p>
                          <div className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded inline-block mt-1",
                            invoice.status === 'PAID' ? "bg-green-100 text-green-700" : 
                            invoice.status === 'OVERDUE' ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                          )}>
                             {invoice.status === 'PAID' ? 'Réglé' : invoice.status === 'OVERDUE' ? 'En Retard' : 'En Attente'}
                          </div>
                       </div>
                       <button className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-all">
                          <AppIcon name="document" size="submenu" />
                       </button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* ORION Financial Insights */}
         <div className="lg:col-span-4 space-y-6">
            <div className="bg-indigo-950 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                     <AppIcon name="sparkles" size="dashboard" className="text-amber-300" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">ORION Finance</span>
                  </div>
                  <h4 className="text-lg font-black mb-4">Analyse de Recouvrement</h4>
                  <p className="text-xs text-indigo-100/70 leading-relaxed font-medium">
                     "Le taux de recouvrement actuel est de **72%**. ORION prévoit une clôture à 95% avant le début de la session d'examen du BAC."
                  </p>
                  <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                     <span className="text-[10px] font-bold text-indigo-300 uppercase">Indice de Solvabilité</span>
                     <span className="text-xs font-black text-green-400">92/100</span>
                  </div>
               </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2.5rem] text-center">
               <AppIcon name="finance" size="dashboard" className="text-amber-600 mx-auto mb-4" />
               <h4 className="text-xs font-black text-amber-900 uppercase tracking-widest mb-2">Relance Automatique</h4>
               <p className="text-[11px] text-amber-800 leading-relaxed font-medium mb-6">
                  Envoyez instantanément une relance SMS/Email à tous les établissements en retard de paiement.
               </p>
               <button className="w-full py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-600/20">Activer la Relance</button>
            </div>
         </div>
      </div>
    </div>
  );
}
