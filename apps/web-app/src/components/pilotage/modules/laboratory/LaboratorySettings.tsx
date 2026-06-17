/**
 * ============================================================================
 * LABORATORY SETTINGS (CONFIGURATION)
 * ============================================================================
 */

'use client';

// TODO: endpoint non disponible — GET labs/settings n'est pas exposé par le backend.
// Les sections de configuration ci-dessous restent en mock UI tant que l'endpoint n'existe pas.
// Une fois l'endpoint disponible, brancher via modulesApi.get('labs/settings', opts).

import { motion } from 'framer-motion';
import {
  Settings,
  Shield,
  Beaker,
  Save,
  Lock,
  Workflow
} from 'lucide-react';

export default function LaboratorySettings() {
  // MOCK UI — Backend endpoint GET labs/settings non disponible.
  const sections = [
    {
      title: 'Gestion des Laboratoires',
      icon: Beaker,
      items: [
        { label: 'Types de laboratoires', desc: 'Physique, Chimie, Biologie, Robotique...' },
        { label: 'Horaires d\'ouverture', desc: 'Définir les plages réservables par jour' },
      ]
    },
    {
      title: 'Sécurité & QHSE',
      icon: Shield,
      items: [
        { label: 'Règles de sécurité standards', desc: 'Éditer les consignes affichées par défaut' },
        { label: 'Niveaux de gravité', desc: 'Configurer les paliers d\'incidents' },
      ]
    },
    {
      title: 'Stocks & Inventaire',
      icon: Settings,
      items: [
        { label: 'Seuils d\'alerte critiques', desc: 'Définir les % de stock pour alertes' },
        { label: 'Catégories d\'équipement', desc: 'Mesure, Optique, Électronique...' },
      ]
    },
    {
      title: 'Réservations & Workflows',
      icon: Workflow,
      items: [
        { label: 'Validation automatique', desc: 'Activer pour les enseignants certifiés' },
        { label: 'Délais de réservation', desc: 'Anticipation minimale (ex: 48h)' },
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Bannière d'information : données mock */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500">
        ℹ️ Données de démonstration — l'endpoint backend <code className="px-1 py-0.5 bg-slate-200 rounded">GET labs/settings</code> n'est pas encore disponible.
      </div>

      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Configuration du Module</h3>
          <p className="text-slate-500 text-sm font-medium">Personnalisez les règles métier de vos espaces pratiques.</p>
        </div>
        <button className="flex items-center space-x-2 px-6 py-3 bg-navy-900 text-white rounded-2xl font-black text-sm hover:bg-navy-800 transition-all shadow-xl shadow-navy-900/20">
          <Save className="w-4 h-4 text-[#C9A84C]" />
          <span>Enregistrer</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl group-hover:text-blue-600 transition-all">
                <section.icon className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{section.title}</h4>
            </div>

            <div className="space-y-6">
              {section.items.map((item, j) => (
                <div key={j} className="flex items-center justify-between group cursor-pointer hover:bg-slate-50 p-4 rounded-2xl transition-all -mx-4">
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">{item.label}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.desc}</p>
                  </div>
                  <div className="w-10 h-6 bg-slate-200 rounded-full relative p-1 transition-colors group-hover:bg-blue-100">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Advanced Settings Placeholder */}
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
        <Lock className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h4 className="text-lg font-black text-slate-400 uppercase tracking-tighter">Paramètres Avancés</h4>
        <p className="text-slate-400 text-xs font-medium max-w-xs mx-auto">
          L'accès aux API et aux journaux d'audit nécessite une autorisation de la direction technique.
        </p>
      </div>
    </div>
  );
}
