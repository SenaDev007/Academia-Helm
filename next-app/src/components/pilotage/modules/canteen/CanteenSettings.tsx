import React from 'react';
import { 
  Settings, Bell, Shield, CreditCard, 
  Utensils, Clock, Users, Database,
  CheckCircle2, ChevronRight, Save,
  AlertTriangle, Info
} from 'lucide-react';

export default function CanteenSettings() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto pb-12">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="p-8 border-b border-gray-50 bg-gradient-to-r from-gray-50/50 to-white flex items-center justify-between">
          <div>
            <h3 className="font-black text-navy-900 text-2xl tracking-tight">Configuration Cantine</h3>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mt-1">Personnalisez les règles et le fonctionnement du module</p>
          </div>
          <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95">
            <Save className="w-4 h-4" />
            <span>Enregistrer</span>
          </button>
        </div>

        <div className="p-8 space-y-12">
          {/* Section: Service Times */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3 text-navy-900">
              <Clock className="w-6 h-6 text-navy-400" />
              <h4 className="font-black text-lg tracking-tight uppercase tracking-widest text-xs">Horaires de Service</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <TimeInput label="Petit Déjeuner" value="07:30" />
              <TimeInput label="Déjeuner" value="12:00" />
              <TimeInput label="Goûter" value="15:30" />
              <TimeInput label="Dîner (Internat)" value="19:00" />
            </div>
          </section>

          {/* Section: Subscription Plans */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3 text-navy-900">
              <CreditCard className="w-6 h-6 text-navy-400" />
              <h4 className="font-black text-lg tracking-tight uppercase tracking-widest text-xs">Abonnements & Tarifs</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ToggleOption 
                title="Paiement à l'avance obligatoire" 
                desc="L'élève ne peut badger que si son solde ou abonnement est à jour." 
                defaultChecked={true} 
              />
              <ToggleOption 
                title="Autoriser les repas occasionnels" 
                desc="Permet aux élèves non-inscrits de déjeuner via paiement unique." 
                defaultChecked={true} 
              />
            </div>
          </section>

          {/* Section: Notifications */}
          <section className="space-y-6">
            <div className="flex items-center space-x-3 text-navy-900">
              <Bell className="w-6 h-6 text-navy-400" />
              <h4 className="font-black text-lg tracking-tight uppercase tracking-widest text-xs">Notifications & Alertes</h4>
            </div>
            <div className="space-y-4 max-w-2xl">
              <NotificationToggle 
                label="Menu publié" 
                desc="Envoyer une notification in-app et email aux parents lors de la publication du menu hebdomadaire." 
                channels={['App', 'Email']} 
              />
              <NotificationToggle 
                label="Alerte Allergie" 
                desc="Notifier immédiatement le responsable cuisine et QHSE si un menu contient un allergène critique pour un élève inscrit." 
                channels={['App', 'SMS']} 
                isCritical={true}
              />
              <NotificationToggle 
                label="Stock faible" 
                desc="Alerter l'économe lorsque le stock d'un produit descend sous le seuil critique." 
                channels={['App']} 
              />
            </div>
          </section>

          {/* Section: Advanced */}
          <section className="p-6 bg-navy-50 rounded-3xl border border-navy-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white rounded-2xl shadow-sm text-navy-600">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-navy-900 text-sm uppercase tracking-widest">Maintenance des Données</h4>
                <p className="text-xs text-navy-500 font-medium mt-1">Archivage des historiques de présence et de paiements des années précédentes.</p>
              </div>
            </div>
            <button className="px-6 py-2.5 bg-white text-navy-900 rounded-xl text-[10px] font-black uppercase tracking-widest border border-navy-200 hover:bg-navy-100 transition-all">
              Gérer l'archivage
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function TimeInput({ label, value }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</label>
      <input 
        type="time" 
        defaultValue={value}
        className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 px-4 text-sm font-black text-navy-900 outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500/50 transition-all" 
      />
    </div>
  );
}

function ToggleOption({ title, desc, defaultChecked }: any) {
  return (
    <div className="p-6 rounded-3xl border border-gray-100 bg-gray-50/30 flex items-start justify-between hover:border-navy-200 transition-all group">
      <div className="pr-4">
        <h5 className="font-black text-navy-900 text-sm mb-1">{title}</h5>
        <p className="text-xs text-gray-400 font-medium leading-relaxed">{desc}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy-900"></div>
      </label>
    </div>
  );
}

function NotificationToggle({ label, desc, channels, isCritical }: any) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-all group">
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-black text-navy-900">{label}</p>
          {isCritical && <span className="p-1 bg-red-100 text-red-600 rounded-lg"><AlertTriangle className="w-3 h-3" /></span>}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center space-x-2">
        {channels.map((c: string) => (
          <span key={c} className="px-2 py-1 bg-white border border-gray-100 rounded-lg text-[9px] font-black text-navy-400 uppercase tracking-tighter group-hover:border-navy-200 transition-all">{c}</span>
        ))}
        <div className="ml-4">
           <label className="relative inline-flex items-center cursor-pointer scale-90">
            <input type="checkbox" defaultChecked className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-navy-900"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
