'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  CheckCircle2,
  Lock,
  Search,
  Filter,
  ArrowRight,
  Shield,
  Users,
  Building,
  CreditCard,
  MessageSquare,
  BookOpen,
  Plus,
} from 'lucide-react';

const GLOBAL_MODULES = [
  { id: 'STUDENTS', name: 'Élèves & Scolarité', icon: Users, status: 'ACTIVE', category: 'CORE', description: 'Gestion admissions, dossiers et vie scolaire.' },
  { id: 'FINANCE', name: 'Finance & Économat', icon: CreditCard, status: 'ACTIVE', category: 'CORE', description: 'Facturation, paiements et comptabilité école.' },
  { id: 'EXAMS', name: 'Examens & Notes', icon: BookOpen, status: 'ACTIVE', category: 'PEDAGOGY', description: 'Gestion des évaluations et des bulletins.' },
  { id: 'COMMUNICATION', name: 'Communication', icon: MessageSquare, status: 'ACTIVE', category: 'SYSTEM', description: 'SMS, Emails et Notifications multi-canal.' },
  { id: 'ORION', name: 'ORION AI', icon: Zap, status: 'PREMIUM', category: 'AI', description: 'Vigilance institutionnelle et aide à la décision.' },
  { id: 'SARA', name: 'Sara AI Assistant', icon: Zap, status: 'PREMIUM', category: 'AI', description: 'Assistant pédagogique et administratif.' },
];

export default function ModulesWorkspace() {
  const [selectedModule, setSelectedModule] = useState(GLOBAL_MODULES[0]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modules & Fonctionnalités</h1>
          <p className="text-slate-500">Catalogue global et activation par établissement</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 rounded-xl text-sm font-semibold text-white hover:bg-indigo-700 transition-all shadow-md">
          <Plus className="w-4 h-4" />
          Ajouter un Module
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un module..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          
          {GLOBAL_MODULES.map((module) => {
            const Icon = module.icon;
            const isSelected = selectedModule.id === module.id;
            return (
              <button
                key={module.id}
                onClick={() => setSelectedModule(module)}
                className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${
                  isSelected 
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                    : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-xl ${isSelected ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 text-sm">{module.name}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{module.category}</div>
                </div>
                {module.status === 'PREMIUM' && <Lock className="w-4 h-4 text-amber-500" />}
              </button>
            );
          })}
        </div>

        {/* Module Detail */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <selectedModule.icon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedModule.name}</h2>
                  <p className="text-slate-500">{selectedModule.description}</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                selectedModule.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {selectedModule.status}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Configuration Globale</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">Activé par défaut (Basic)</span>
                    <div className="w-10 h-6 bg-slate-200 rounded-full relative cursor-not-allowed">
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">Audit-Trail activé</span>
                    <div className="w-10 h-6 bg-emerald-500 rounded-full relative">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Statistiques d'Usage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl text-center">
                    <div className="text-lg font-bold text-slate-900">112</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Tenants actifs</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl text-center">
                    <div className="text-lg font-bold text-slate-900">92%</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Taux d'usage</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <button className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:translate-x-1 transition-all">
                Gérer les permissions du module
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 bg-indigo-900 rounded-3xl shadow-xl text-white">
            <h3 className="font-bold mb-4">Actions de maintenance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all text-left">
                Mettre à jour le module (v1.2.4)
              </button>
              <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all text-left">
                Purger les logs temporaires
              </button>
              <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-all text-left">
                Vérifier les dépendances
              </button>
              <button className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-xl text-sm font-medium transition-all text-left">
                Désactivation critique
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
