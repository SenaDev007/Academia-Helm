/**
 * ============================================================================
 * QHSE MODULE SETTINGS
 * ============================================================================
 */

'use client';

import { motion } from 'framer-motion';
import { Settings, Shield, Bell, Lock, Database, Trash2, Save, Globe, Eye } from 'lucide-react';

export default function QHSESettings() {
  const sections = [
    { title: 'Configuration Générale', icon: Settings, desc: 'Paramètres du module et seuils de criticité.' },
    { title: 'Notifications & Alertes', icon: Bell, desc: 'Canaux de diffusion et destinataires des urgences.' },
    { title: 'Accès & Permissions', icon: Lock, desc: 'Rôles spécifiques pour les auditeurs et inspecteurs.' },
    { title: 'Archivage & Données', icon: Database, desc: 'Conservation des registres et exportations légales.' },
  ];

  return (
    <div className="max-w-5xl space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1 space-y-2">
          {sections.map((section, i) => (
            <button
              key={i}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all ${
                i === 0 ? 'bg-navy-900 text-white shadow-lg' : 'hover:bg-white text-slate-400 hover:text-slate-900'
              }`}
            >
              <section.icon className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{section.title}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-10">
            <div className="space-y-2 border-b border-slate-50 pb-8">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Configuration Générale</h3>
              <p className="text-slate-500 font-medium">Définissez les règles métier du module QHSE.</p>
            </div>

            <div className="space-y-8">
              {/* Setting Item */}
              <div className="flex items-center justify-between group">
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Signalement Mobile</p>
                  <p className="text-xs text-slate-400 font-medium">Autoriser les enseignants à signaler des incidents via l'application mobile.</p>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer shadow-inner">
                   <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between group">
                <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Anonymat des Risques</p>
                  <p className="text-xs text-slate-400 font-medium">Permettre le signalement anonyme des risques par le personnel.</p>
                </div>
                <div className="w-12 h-6 bg-slate-200 rounded-full relative cursor-pointer shadow-inner">
                   <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-slate-50">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seuil d'Alerte Critique (Score)</p>
                 <div className="flex items-center gap-6">
                    <input type="range" className="flex-1 accent-emerald-600 h-1 bg-slate-100 rounded-full appearance-none" />
                    <span className="text-xl font-black text-emerald-600 tracking-tighter">75%</span>
                 </div>
              </div>
            </div>

            <div className="pt-10 flex items-center justify-between">
               <button className="flex items-center gap-2 text-rose-600 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 px-4 py-2 rounded-xl transition-all">
                  <Trash2 className="w-4 h-4" /> Réinitialiser
               </button>
               <button className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all">
                  <Save className="w-4 h-4" /> Enregistrer les Modifications
               </button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-start gap-4">
            <Shield className="w-8 h-8 text-amber-600 shrink-0" />
            <div className="space-y-2">
               <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Protection des Données QHSE</h4>
               <p className="text-xs text-amber-800/70 font-medium leading-relaxed">
                  Certaines données de santé (infirmerie) et de sécurité sont soumises à des restrictions de confidentialité strictes. Assurez-vous que vos paramètres respectent la réglementation en vigueur.
               </p>
               <button className="text-[10px] font-black text-amber-900 uppercase tracking-widest underline hover:no-underline">Consulter la Politique RGPD</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
