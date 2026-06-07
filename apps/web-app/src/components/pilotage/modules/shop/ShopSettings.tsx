/**
 * ============================================================================
 * SHOP SETTINGS - ACADEMIA HELM
 * ============================================================================
 */

'use client';

import React from 'react';
import { 
  Settings, Save, Shield, Bell, CreditCard, 
  Wallet, Truck, Receipt, Tag, Lock,
  Zap, MessageSquare, Info
} from 'lucide-react';

export default function ShopSettings() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-navy-900 uppercase tracking-tight">Configuration Boutique</h3>
          <p className="text-sm text-gray-400 font-medium">Personnalisez le fonctionnement de l'économat et du point de vente</p>
        </div>
        <button className="flex items-center space-x-2 px-8 py-3 bg-navy-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20 active:scale-95">
          <Save className="w-4 h-4" />
          <span>Enregistrer les modifications</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-2">
           <SettingsTab active icon={Settings} label="Général" />
           <SettingsTab icon={Wallet} label="Paiements & Wallet" />
           <SettingsTab icon={Truck} label="Logistique & Livraison" />
           <SettingsTab icon={Receipt} label="Facturation & Recus" />
           <SettingsTab icon={Bell} label="Alertes & Stocks" />
           <SettingsTab icon={Lock} label="Sécurité & Accès" />
        </div>

        {/* Settings Content */}
        <div className="md:col-span-2 space-y-8">
           <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 shadow-sm space-y-8">
              {/* Stock Alerts */}
              <div className="space-y-6">
                 <div className="flex items-center space-x-3 pb-4 border-b border-gray-50">
                    <Bell className="w-5 h-5 text-navy-600" />
                    <h4 className="font-black text-navy-900 uppercase tracking-tight">Alertes de Stock</h4>
                 </div>
                 <div className="space-y-4">
                    <ToggleField 
                      label="Notifications de stock bas" 
                      description="Envoyer une alerte quand un produit atteint son seuil critique" 
                      defaultChecked 
                    />
                    <ToggleField 
                      label="Rapport hebdomadaire d'inventaire" 
                      description="Recevoir un résumé des mouvements de stock par email" 
                    />
                    <div className="pt-4">
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seuil d'alerte par défaut</label>
                       <div className="flex items-center space-x-4">
                          <input type="number" defaultValue={10} className="w-24 px-4 py-3 bg-gray-50 border-none rounded-xl text-sm font-black text-navy-900 outline-none focus:ring-2 focus:ring-navy-500/20" />
                          <span className="text-xs font-bold text-gray-500">Unités</span>
                       </div>
                    </div>
                 </div>
              </div>

              {/* POS Settings */}
              <div className="space-y-6">
                 <div className="flex items-center space-x-3 pb-4 border-b border-gray-50">
                    <CreditCard className="w-5 h-5 text-navy-600" />
                    <h4 className="font-black text-navy-900 uppercase tracking-tight">Options Point de Vente (POS)</h4>
                 </div>
                 <div className="space-y-4">
                    <ToggleField 
                      label="Autoriser le crédit client" 
                      description="Permettre aux élèves d'acheter sans solde suffisant (selon limite)" 
                    />
                    <ToggleField 
                      label="Impression automatique du reçu" 
                      description="Lancer l'impression dès la validation de l'encaissement" 
                      defaultChecked
                    />
                    <ToggleField 
                      label="Scanner code-barres activé" 
                      description="Support natif pour les douchettes de lecture" 
                      defaultChecked
                    />
                 </div>
              </div>

              {/* Receipt Customization */}
              <div className="space-y-6">
                 <div className="flex items-center space-x-3 pb-4 border-b border-gray-50">
                    <Receipt className="w-5 h-5 text-navy-600" />
                    <h4 className="font-black text-navy-900 uppercase tracking-tight">Entête & Pied de Reçu</h4>
                 </div>
                 <div className="space-y-4">
                    <div>
                       <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Message d'accueil</label>
                       <textarea className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl text-sm font-medium text-navy-900 outline-none focus:ring-2 focus:ring-navy-500/20 h-24" defaultValue="Merci de votre confiance ! Bonne rentrée scolaire." />
                    </div>
                 </div>
              </div>
           </div>

           {/* ORION Intelligence Toggle */}
           <div className="bg-navy-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="flex items-start justify-between">
                 <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                       <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                       <h4 className="font-black uppercase tracking-tight">ORION Predictive Inventory</h4>
                    </div>
                    <p className="text-xs text-navy-200 font-medium leading-relaxed pr-12">
                       Activez l'IA pour prédire les besoins de stock en fonction de l'année scolaire et des tendances d'achat.
                    </p>
                 </div>
                 <div className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" value="" className="sr-only peer" defaultChecked />
                    <div className="w-14 h-8 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ icon: Icon, label, active }: any) {
  return (
    <button className={`w-full flex items-center space-x-4 p-4 rounded-2xl transition-all border ${
      active 
        ? 'bg-navy-900 text-white border-navy-900 shadow-lg shadow-navy-900/20' 
        : 'bg-white text-gray-400 border-gray-50 hover:bg-gray-50 hover:text-navy-900 hover:border-gray-100'
    }`}>
      <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-300'}`} />
      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function ToggleField({ label, description, defaultChecked }: any) {
  return (
    <div className="flex items-center justify-between group">
       <div className="space-y-1">
          <p className="text-sm font-black text-navy-900 group-hover:text-navy-600 transition-colors">{label}</p>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">{description}</p>
       </div>
       <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" value="" className="sr-only peer" defaultChecked={defaultChecked} />
          <div className="w-12 h-7 bg-gray-100 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-navy-900"></div>
       </label>
    </div>
  );
}
