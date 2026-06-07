'use client';

import { useState } from 'react';
import { Settings, Sliders, Tags, Hash, ClipboardList, Save, RefreshCcw, Shield } from 'lucide-react';
import { useModuleContext } from '@/hooks/useModuleContext';
import { motion } from 'framer-motion';

export default function StudentSettingsContent() {
  const { academicYear, schoolLevel } = useModuleContext();
  
  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 rounded-xl">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Paramétrage Élèves & Scolarité</h2>
            <p className="text-sm text-slate-500">Configurez les règles de gestion, les formats de matricule et les types de documents.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold transition-all">
          <Save className="w-4 h-4" />
          Enregistrer les modifications
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation latérale des réglages */}
        <div className="space-y-2">
          {[
            { id: 'general', label: 'Configuration Générale', icon: <Sliders className="w-4 h-4" />, active: true },
            { id: 'matricules', label: 'Formats de Matricules', icon: <Hash className="w-4 h-4" />, active: false },
            { id: 'documents', label: 'Types de Documents', icon: <ClipboardList className="w-4 h-4" />, active: false },
            { id: 'admissions', label: 'Workflow Admissions', icon: <RefreshCcw className="w-4 h-4" />, active: false },
            { id: 'security', label: 'Sécurité & Droits', icon: <Shield className="w-4 h-4" />, active: false },
          ].map((item) => (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                item.active 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* Panneau de configuration principal */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-8">
          <section className="space-y-6">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">Règles de Gestion Automatisées</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">Génération automatique du matricule</p>
                  <p className="text-xs text-slate-500">Générer le matricule dès la conversion de l'admission</p>
                </div>
                <div className="w-12 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">Blocage financier automatique</p>
                  <p className="text-xs text-slate-500">Bloquer l'accès aux documents en cas d'arriérés critiques</p>
                </div>
                <div className="w-12 h-6 bg-slate-300 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800">Validation EDUCMASTER requise</p>
                  <p className="text-xs text-slate-500">Forcer la conformité des champs NPI avant validation</p>
                </div>
                <div className="w-12 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
