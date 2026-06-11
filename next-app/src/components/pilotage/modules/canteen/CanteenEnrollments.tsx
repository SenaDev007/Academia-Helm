import React from 'react';
import { 
  ClipboardCheck, Search, Filter, Download, 
  CheckCircle2, XCircle, Clock, AlertTriangle,
  User, Calendar, CreditCard, ChevronRight,
  Plus
} from 'lucide-react';

export default function CanteenEnrollments() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard 
          title="Demandes en attente" 
          value="24" 
          icon={Clock} 
          color="amber" 
        />
        <SummaryCard 
          title="Nouvelles Inscriptions (Mois)" 
          value="115" 
          icon={Plus} 
          color="blue" 
        />
        <SummaryCard 
          title="Taux d'Acceptation" 
          value="94%" 
          icon={CheckCircle2} 
          color="green" 
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <h3 className="font-black text-navy-900 text-xl tracking-tight">Gestion des Inscriptions</h3>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Validez les demandes d'accès à la restauration</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-navy-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Élève, parent, classe..." 
                className="pl-11 pr-4 py-2.5 bg-gray-50/50 border border-gray-100 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-navy-500/20 w-64 transition-all"
              />
            </div>
            <button className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-100 text-gray-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-navy-200 hover:text-navy-600 transition-all shadow-sm">
              <Filter className="w-4 h-4" />
              <span>Filtres</span>
            </button>
            <button className="flex items-center space-x-2 px-6 py-2.5 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
              <Plus className="w-4 h-4" />
              <span>Inscrire un élève</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Demande</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Élève & Parent</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Abonnement</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Régime / Allergies</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <EnrollmentRow 
                date="14 Mai 2026"
                student="Ismael Sylla"
                class="CM2-B"
                parent="M. Sylla"
                plan="Mensuel"
                diet="Standard"
                status="En attente"
              />
              <EnrollmentRow 
                date="13 Mai 2026"
                student="Mariam Konaté"
                class="6ème A"
                parent="Mme Konaté"
                plan="Trimestriel"
                diet="Végétarien"
                allergy="Arachides"
                status="En attente"
              />
              <EnrollmentRow 
                date="12 Mai 2026"
                student="Jean-Paul Gbe"
                class="CP1"
                parent="M. Gbe"
                plan="Hebdomadaire"
                diet="Sans Porc"
                status="Validé"
              />
              <EnrollmentRow 
                date="11 Mai 2026"
                student="Saliou Diop"
                class="Terminale S"
                parent="M. Diop"
                plan="Mensuel"
                diet="Standard"
                status="Rejeté"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-6">
      <div className={`p-4 rounded-2xl ${colors[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-navy-900 mt-1">{value}</p>
      </div>
    </div>
  );
}

function EnrollmentRow({ date, student, class: className, parent, plan, diet, allergy, status }: any) {
  const statusStyles: any = {
    'En attente': 'bg-amber-50 text-amber-600 border-amber-100',
    'Validé': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Rejeté': 'bg-red-50 text-red-600 border-red-100',
  };

  return (
    <tr className="group hover:bg-navy-50/30 transition-all duration-300">
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <p className="text-xs font-bold text-navy-900">{date}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-black text-xs group-hover:bg-white transition-colors">
            {student.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div>
            <p className="text-sm font-black text-navy-900">{student}</p>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-[10px] font-bold text-navy-500 uppercase tracking-tighter">{className}</span>
              <span className="text-[10px] font-medium text-gray-400">| {parent}</span>
            </div>
          </div>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="flex items-center space-x-2">
          <CreditCard className="w-3.5 h-3.5 text-navy-400" />
          <p className="text-xs font-black text-navy-900 uppercase tracking-wider">{plan}</p>
        </div>
      </td>
      <td className="px-8 py-6">
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-600">{diet}</p>
          {allergy && (
            <div className="flex items-center space-x-1 text-[9px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>{allergy}</span>
            </div>
          )}
        </div>
      </td>
      <td className="px-8 py-6">
        <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${statusStyles[status]}`}>
          {status}
        </div>
      </td>
      <td className="px-8 py-6 text-right">
        <div className="flex items-center justify-end space-x-2">
          {status === 'En attente' ? (
            <>
              <button className="px-4 py-1.5 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">Valider</button>
              <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100"><XCircle className="w-4 h-4" /></button>
            </>
          ) : (
            <button className="p-2 text-gray-400 hover:text-navy-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-gray-100">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
