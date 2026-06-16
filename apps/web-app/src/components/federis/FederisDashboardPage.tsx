/**
 * FederisDashboardPage Component
 * 
 * Le Dashboard Central Academia Federis
 * Affiche les 23 modules organisés par pôles stratégiques.
 */

'use client';

import { useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const MODULES = [
  { category: 'GOUVERNANCE', items: [
    { name: 'Bureau & Membres', icon: 'building', desc: 'Gestion du patronat', href: '/federis/bureau' },
    { name: 'Réseau d\'Écoles', icon: 'building', desc: 'Établissements membres', href: '/federis/schools' },
    { name: 'Classes d\'Examen', icon: 'classes', desc: 'Recensement national', href: '/federis/exam-classes' },
    { name: 'Federis Connect', icon: 'bell', desc: 'Réseau institutionnel', href: '/federis/connect' },
  ]},
  { category: 'EXAMENS', items: [
    { name: 'Session d\'Examens', icon: 'exams', desc: 'Calendrier & Organisation', href: '/federis/exams' },
    { name: 'Centres d\'Examen', icon: 'classes', desc: 'Cartographie des centres', href: '/federis/centers' },
    { name: 'Candidats', icon: 'scolarite', desc: 'Fichiers nationaux', href: '/federis/candidates' },
    { name: 'Épreuves & Sujets', icon: 'document', desc: 'Banque de données', href: '/federis/question-bank' },
    { name: 'Surveillance', icon: 'warning', desc: 'Sécurisation & Alertes', href: '/federis/surveillance' },
  ]},
  { category: 'DÉROULEMENT', items: [
    { name: 'Composition', icon: 'exams', desc: 'Suivi en temps réel', href: '/federis/compositions' },
    { name: 'Correction', icon: 'document', desc: 'Anonymat & Dispatching', href: '/federis/correction' },
    { name: 'Saisie des Notes', icon: 'document', desc: 'Plateforme centralisée', href: '/federis/grading' },
    { name: 'Délibérations', icon: 'dashboard', desc: 'Seuils & Rachat', href: '/federis/deliberations' },
    { name: 'Résultats', icon: 'bell', desc: 'Publication officielle', href: '/federis/results' },
  ]},
  { category: 'PILOTAGE & FINANCE', items: [
    { name: 'Statistiques', icon: 'finance', desc: 'Analyses transverses', href: '/federis/stats' },
    { name: 'Rapports', icon: 'document', desc: 'Bilans de sessions', href: '/federis/reports' },
    { name: 'Finances', icon: 'finance', desc: 'Bilan réseau & Billing', href: '/federis/billing' },
    { name: 'Archives & Diplômes', icon: 'document', desc: 'Registres historiques', href: '/federis/archives' },
  ]},
  { category: 'SYSTÈME', items: [
    { name: 'Sarah AI', icon: 'sparkles', desc: 'Assistance intelligente', href: '/federis/sara' },
    { name: 'ORION', icon: 'sparkles', desc: 'Vigilance & Audit', href: '/federis/orion' },
    { name: 'Paramètres', icon: 'settings', desc: 'Config plateforme', href: '/federis/settings' },
  ]}
];

export default function FederisDashboardPage() {
  return (
    <div className="space-y-12">
      {/* Hero Welcome */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-[2.5rem] p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl font-black mb-4">Portail Academia Federis</h1>
            <p className="text-blue-100/70 text-lg max-w-xl font-medium leading-relaxed">
              Supervision nationale, coordination des examens et pilotage stratégique de votre réseau d'établissements.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl font-black">23</p>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Modules Actifs</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
              <p className="text-2xl font-black">1.2M</p>
              <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">Candidats Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modules Grid Section */}
      {MODULES.map((pote) => (
        <div key={pote.category} className="space-y-6">
          <div className="flex items-center space-x-4">
             <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">{pote.category}</h2>
             <div className="flex-1 h-px bg-gray-100" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pote.items.map((item) => (
              <Link 
                key={item.name} 
                href={item.href}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <AppIcon name={item.icon as any} size="large" className="text-blue-900" />
                </div>
                
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-900 transition-colors">
                  <AppIcon name={item.icon as any} size="dashboard" className="text-blue-900 group-hover:text-white transition-colors" />
                </div>
                
                <h3 className="text-base font-black text-gray-900 mb-1 group-hover:text-blue-900">{item.name}</h3>
                <p className="text-xs text-gray-500 font-medium">{item.desc}</p>
                
                <div className="mt-6 flex items-center text-[10px] font-black text-blue-600 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                  Accéder au module
                  <AppIcon name="arrowRight" size="submenu" className="ml-2 w-3 h-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
