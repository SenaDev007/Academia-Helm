import React from 'react';
import { 
  DollarSign, Search, Filter, Download, 
  CreditCard, Wallet, Smartphone, History,
  CheckCircle2, AlertCircle, Clock, ChevronRight,
  TrendingUp, ArrowUpRight, Plus
} from 'lucide-react';

export default function CanteenPayments() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceCard 
          title="Recettes (Mois)" 
          value="4,850,000 F" 
          change="+8.2%" 
          trend="up" 
          icon={TrendingUp} 
          color="emerald" 
        />
        <FinanceCard 
          title="Paiements en attente" 
          value="620,000 F" 
          change="15 élèves" 
          trend="neutral" 
          icon={Clock} 
          color="amber" 
        />
        <FinanceCard 
          title="Taux de recouvrement" 
          value="92.4%" 
          change="+1.5%" 
          trend="up" 
          icon={CheckCircle2} 
          color="blue" 
        />
        <FinanceCard 
          title="Impayés Critiques" 
          value="185,000 F" 
          change="3 élèves" 
          trend="down" 
          icon={AlertCircle} 
          color="red" 
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Suivi des Paiements</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Gestion financière de la restauration scolaire</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Élève, parent, reçu..." 
                className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-navy-600 rounded-2xl transition-all shadow-sm">
              <Filter className="w-4 h-4" />
            </button>
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
              <Plus className="w-4 h-4" />
              <span>Nouveau Paiement</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Élève & Période</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Abonnement</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Montant</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Mode</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <PaymentRow 
                student="Jean-Paul Gbe"
                class="CP1"
                period="Mai 2026"
                plan="Mensuel"
                amount="25 000 F"
                mode="Mobile Money"
                status="Payé"
              />
              <PaymentRow 
                student="Ismael Sylla"
                class="CM2-B"
                period="Mai 2026"
                plan="Mensuel"
                amount="25 000 F"
                mode="Espèces"
                status="En attente"
              />
              <PaymentRow 
                student="Mariam Konaté"
                class="6ème A"
                period="Trimestre 3"
                plan="Trimestriel"
                amount="65 000 F"
                mode="Virement"
                status="Partiel"
                paid="40 000 F"
              />
              <PaymentRow 
                student="Saliou Diop"
                class="Terminale S"
                period="Mai 2026"
                plan="Mensuel"
                amount="25 000 F"
                mode="Carte"
                status="Retard"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ title, value, change, trend, icon: Icon, color }: any) {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    red: 'text-red-600 bg-red-50',
  };
  return (
    <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center space-x-1 text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
          trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 
          trend === 'down' ? 'bg-red-50 text-red-600' : 
          'bg-gray-50 text-gray-400'
        }`}>
          <span>{change}</span>
        </div>
      </div>
      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
    </div>
  );
}

function PaymentRow({ student, class: className, period, plan, amount, mode, status, paid }: any) {
  const statusStyles: any = {
    'Payé': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Partiel': 'bg-blue-50 text-blue-600 border-blue-100',
    'Retard': 'bg-red-50 text-red-600 border-red-100',
  };

  const modeIcon = (m: string) => {
    if (m === 'Mobile Money') return <Smartphone className="w-3.5 h-3.5" />;
    if (m === 'Espèces') return <Wallet className="w-3.5 h-3.5" />;
    if (m === 'Carte' || m === 'Virement') return <CreditCard className="w-3.5 h-3.5" />;
    return <DollarSign className="w-3.5 h-3.5" />;
  };

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-black text-xs group-hover:bg-white transition-colors">
            {student.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{student}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-[10px] font-bold text-navy-500 uppercase tracking-tighter">{className}</span>
              <span className="text-gray-300">|</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{period}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <p className="text-xs font-black text-navy-900 uppercase tracking-wider bg-navy-50 px-3 py-1 rounded-lg w-fit border border-navy-100">{plan}</p>
      </td>
      <td className="px-8 py-6">
        <p className="text-sm font-black text-navy-900">{amount}</p>
        {paid && <p className="text-[10px] text-blue-600 font-bold mt-0.5 italic">Payé: {paid}</p>}
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2 text-gray-500">
          {modeIcon(mode)}
          <p className="text-xs font-medium">{mode}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${statusStyles[status]}`}>
          {status}
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-2">
          <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><ArrowUpRight className="w-4 h-4" /></button>
          <button className="p-2 text-gray-400 hover:text-navy-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><Download className="w-4 h-4" /></button>
        </div>
      </td>
    </tr>
  );
}
