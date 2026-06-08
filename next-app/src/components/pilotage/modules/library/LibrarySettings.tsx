/**
 * ============================================================================
 * LIBRARY SETTINGS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Settings, Bell, ShieldCheck, Clock, CreditCard, Save, RefreshCw, Trash2, Library } from 'lucide-react';

export default function LibrarySettings() {
  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center">
            <Settings className="w-6 h-6 mr-3 text-slate-400" />
            Paramètres de la Bibliothèque
          </h3>
          <p className="text-slate-500 text-sm font-medium">Configurez les règles de circulation et de gestion.</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20">
          <Save className="w-4 h-4" />
          <span>Enregistrer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Loan Rules */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Règles d'Emprunt</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Définissez les limites standards</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée maximale d'emprunt (Jours)</label>
              <input type="number" defaultValue={14} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre maximal de livres / lecteur</label>
              <input type="number" defaultValue={3} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Durée de réservation (Heures)</label>
              <input type="number" defaultValue={48} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nombre d'extensions autorisées</label>
              <input type="number" defaultValue={1} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
            </div>
          </div>
        </motion.div>

        {/* Finance Rules */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-8"
        >
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Pénalités & Amendes</h4>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuration financière</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Amende par jour de retard (FCFA)</label>
              <input type="number" defaultValue={500} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Seuil blocage automatique (FCFA)</label>
              <input type="number" defaultValue={5000} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-black outline-none focus:ring-2 focus:ring-amber-500/20 transition-all" />
            </div>
          </div>
        </motion.div>

        {/* Automation & Security */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-4">
                <Bell className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-black text-slate-900">Notifications de Rappel</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Envoyer SMS/Email 2 jours avant l'échéance</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-blue-600 rounded-full p-1 flex justify-end cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-4">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-black text-slate-900">Validation Parentale</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Requis pour les ressources payantes</p>
                </div>
              </div>
              <div className="w-12 h-6 bg-slate-200 rounded-full p-1 flex justify-start cursor-pointer">
                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
