'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Library,
  BookOpen,
  Search,
  BookMarked,
  ArrowRightLeft,
  CalendarClock,
  Users,
  ClipboardCheck,
  AlertTriangle,
  MonitorPlay,
  Lightbulb,
  BarChart3,
  Settings,
  Plus,
  Filter,
  Download,
  MoreVertical,
  CheckCircle2,
  Clock,
  XCircle,
  FileText
} from 'lucide-react';

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
  { id: 'catalog', label: 'Catalogue', icon: Search },
  { id: 'resources', label: 'Livres & ressources', icon: Library },
  { id: 'borrowings', label: 'Emprunts', icon: ArrowRightLeft },
  { id: 'returns', label: 'Retours', icon: CheckCircle2 },
  { id: 'reservations', label: 'Réservations', icon: CalendarClock },
  { id: 'readers', label: 'Lecteurs', icon: Users },
  { id: 'inventory', label: 'Inventaire', icon: ClipboardCheck },
  { id: 'penalties', label: 'Pénalités & pertes', icon: AlertTriangle },
  { id: 'digital', label: 'Ressources num.', icon: MonitorPlay },
  { id: 'recommendations', label: 'Recommandations', icon: Lightbulb },
  { id: 'reports', label: 'Rapports', icon: FileText },
  { id: 'settings', label: 'Paramètres', icon: Settings },
];

export default function LibraryWorkspace() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Library className="w-8 h-8 text-indigo-600" />
              Centre de Ressources & Bibliothèque
            </h1>
            <p className="text-slate-500 mt-1">Gestion du patrimoine documentaire, emprunts et ressources numériques</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all">
              <Filter className="w-4 h-4" />
              Filtres
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-100">
              <Plus className="w-4 h-4" />
              Nouvel Emprunt
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-8 flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'catalog' && <CatalogTab />}
            {activeTab === 'resources' && <ResourcesTab />}
            {activeTab === 'borrowings' && <BorrowingsTab />}
            {activeTab === 'returns' && <ReturnsTab />}
            {activeTab === 'reservations' && <ReservationsTab />}
            {activeTab === 'readers' && <ReadersTab />}
            {activeTab === 'inventory' && <InventoryTab />}
            {activeTab === 'penalties' && <PenaltiesTab />}
            {activeTab === 'digital' && <DigitalResourcesTab />}
            {activeTab === 'recommendations' && <RecommendationsTab />}
            {activeTab === 'reports' && <ReportsTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DashboardTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Fonds documentaire', value: '4,250', sub: '+12 ce mois', color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Emprunts actifs', value: '184', sub: '24 en retard', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Lecteurs actifs', value: '856', sub: '72% des élèves', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Réservations', value: '45', sub: '12 prêtes', color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
             <h3 className="text-3xl font-black text-slate-900 mt-2">{stat.value}</h3>
             <p className={`text-xs font-bold mt-2 ${stat.color}`}>{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-6">Emprunts Récents</h3>
            <div className="space-y-4">
               {[1,2,3].map(i => (
                  <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                     <div className="flex gap-4 items-center">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                           <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                           <p className="text-sm font-bold text-slate-900">Les Misérables - Tome 1</p>
                           <p className="text-[10px] text-slate-500">Emprunté par : DOSSOU Paul (3ème A)</p>
                        </div>
                     </div>
                     <span className="text-xs font-bold text-amber-600">Retour le 28 Mai</span>
                  </div>
               ))}
            </div>
         </div>
         <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-6">Alertes & Pénalités</h3>
            <div className="space-y-4">
               {[1,2].map(i => (
                  <div key={i} className="flex justify-between items-center p-4 bg-rose-50 rounded-2xl border border-rose-100">
                     <div className="flex gap-4 items-center">
                        <AlertTriangle className="w-5 h-5 text-rose-500" />
                        <div>
                           <p className="text-sm font-bold text-rose-900">Retard de 14 jours</p>
                           <p className="text-[10px] text-rose-700">Livre: Géométrie CM2 (KOFFI Jean)</p>
                        </div>
                     </div>
                     <button className="text-[10px] font-bold text-rose-600 underline">Relancer</button>
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

function CatalogTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
         <h3 className="font-bold text-slate-900 text-lg">Catalogue Documentaire</h3>
         <div className="flex items-center gap-3">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
               <input type="text" placeholder="Rechercher titre, auteur, ISBN..." className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm w-72" />
            </div>
         </div>
      </div>
      <table className="w-full text-left">
         <thead>
            <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
               <th className="px-6 py-4">Titre / Auteur</th>
               <th className="px-6 py-4">Catégorie</th>
               <th className="px-6 py-4">Niveau / Matière</th>
               <th className="px-6 py-4">Disponibilité</th>
               <th className="px-6 py-4 text-right">Actions</th>
            </tr>
         </thead>
         <tbody className="divide-y divide-slate-50">
            {[1,2,3,4,5].map(i => (
               <tr key={i} className="hover:bg-slate-50/30">
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-3">
                        <BookMarked className="w-5 h-5 text-indigo-400" />
                        <div>
                           <p className="text-sm font-bold text-slate-900">Le Petit Prince</p>
                           <p className="text-[10px] text-slate-500">Antoine de Saint-Exupéry</p>
                        </div>
                     </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">Littérature</td>
                  <td className="px-6 py-4 text-sm text-slate-600">6ème • Français</td>
                  <td className="px-6 py-4">
                     <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase rounded">4 dispo / 5</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <button className="text-indigo-600 hover:underline text-xs font-bold">Réserver</button>
                  </td>
               </tr>
            ))}
         </tbody>
      </table>
    </div>
  );
}

function BorrowingsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-900 text-lg">Gestion des Emprunts</h3>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">Scanner Code-barres</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2].map(i => (
             <div key={i} className="p-4 border border-slate-100 rounded-2xl bg-slate-50">
                <div className="flex justify-between mb-2">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Emprunt Actif</span>
                   <span className="text-xs font-bold text-amber-600">Reste 3 jours</span>
                </div>
                <h4 className="font-bold text-slate-900">Manuel de Physique 1ère</h4>
                <p className="text-xs text-slate-500 mt-1">Lecteur : M. DIALLO (Enseignant)</p>
                <div className="mt-4 flex gap-2">
                   <button className="px-3 py-1.5 bg-white border border-slate-200 text-xs font-bold rounded-lg shadow-sm">Prolonger</button>
                   <button className="px-3 py-1.5 bg-emerald-600 text-white border border-emerald-600 text-xs font-bold rounded-lg shadow-sm">Restituer</button>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}

function ReturnsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6 text-center">
       <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
       <h3 className="font-bold text-slate-900 text-lg mb-2">Centre de Retours</h3>
       <p className="text-slate-500 text-sm mb-6">Scannez le livre pour valider son retour et vérifier son état.</p>
       <div className="max-w-md mx-auto">
          <input type="text" placeholder="Scanner le code ISBN ou l'ID de l'emprunt..." className="w-full text-center py-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl" />
       </div>
    </div>
  );
}

function ReservationsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6">File d'attente des Réservations</h3>
       <div className="space-y-3">
          {[
             { title: 'SVT Terminale D', reader: 'TOURE Amina', status: 'En attente de retour', color: 'bg-amber-50 text-amber-600' },
             { title: 'Dictionnaire Anglais', reader: 'SOSSOU Marc', status: 'Disponible au retrait', color: 'bg-emerald-50 text-emerald-600' },
          ].map((r, i) => (
             <div key={i} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl">
                <div>
                   <p className="font-bold text-slate-900 text-sm">{r.title}</p>
                   <p className="text-xs text-slate-500">Lecteur : {r.reader}</p>
                </div>
                <div className="flex items-center gap-3">
                   <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${r.color}`}>{r.status}</span>
                   <button className="text-slate-400 hover:text-indigo-600"><ChevronRight className="w-5 h-5" /></button>
                </div>
             </div>
          ))}
       </div>
    </div>
  );
}

function ReadersTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6">Base des Lecteurs</h3>
       <table className="w-full text-left">
          <thead>
             <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="pb-4">Nom / Profil</th>
                <th className="pb-4">Classe / Fonction</th>
                <th className="pb-4">Emprunts actifs</th>
                <th className="pb-4">Pénalités</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
             <tr className="hover:bg-slate-50/50">
                <td className="py-4 font-bold text-slate-900">ADJOVI Luc</td>
                <td className="py-4 text-sm text-slate-600">3ème A (Élève)</td>
                <td className="py-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded">2</span></td>
                <td className="py-4"><span className="text-slate-400">-</span></td>
             </tr>
             <tr className="hover:bg-slate-50/50">
                <td className="py-4 font-bold text-slate-900">M. KOFFI</td>
                <td className="py-4 text-sm text-slate-600">Prof. Maths</td>
                <td className="py-4"><span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded">5</span></td>
                <td className="py-4"><span className="text-rose-600 text-xs font-bold">500 FCFA</span></td>
             </tr>
          </tbody>
       </table>
    </div>
  );
}

function PenaltiesTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500" /> Gestion des Pénalités & Pertes
       </h3>
       <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex justify-between items-center">
             <div>
                <p className="font-bold text-rose-900">Livre Perdu : Manuel SVT</p>
                <p className="text-xs text-rose-700">Lecteur: TOURE Amina • 15,000 FCFA</p>
             </div>
             <button className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl shadow-sm">Transférer Comptabilité</button>
          </div>
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex justify-between items-center">
             <div>
                <p className="font-bold text-slate-900">Retard (10 jours)</p>
                <p className="text-xs text-slate-500">Lecteur: SOSSOU Marc • 1,000 FCFA</p>
             </div>
             <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg uppercase">Réglé</span>
          </div>
       </div>
    </div>
  );
}

function DigitalResourcesTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-900 text-lg">Médiathèque & Ressources Numériques</h3>
          <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold">+ Uploader</button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
             { type: 'PDF', title: 'Cours complet d\'Histoire', size: '2.4 MB' },
             { type: 'VIDEO', title: 'Expérience Chimie', size: '45 MB' },
             { type: 'LINK', title: 'Encyclopédie Universalis', size: 'Externe' },
          ].map((r, i) => (
             <div key={i} className="p-4 border border-slate-100 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
                <MonitorPlay className="w-8 h-8 text-indigo-400 mb-3" />
                <h4 className="font-bold text-sm text-slate-900 truncate">{r.title}</h4>
                <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase">{r.type} • {r.size}</p>
             </div>
          ))}
       </div>
    </div>
  );
}

function ResourcesTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
      <div className="flex items-center justify-between mb-6">
         <h3 className="font-bold text-slate-900 text-lg">Livres & Ressources Physiques</h3>
         <button className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold">+ Ajouter Livre</button>
      </div>
      <table className="w-full text-left">
         <thead>
            <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
               <th className="px-6 py-4">Code Interne</th>
               <th className="px-6 py-4">Titre</th>
               <th className="px-6 py-4">Rayon / Emplacement</th>
               <th className="px-6 py-4">État</th>
               <th className="px-6 py-4 text-right">Actions</th>
            </tr>
         </thead>
         <tbody className="divide-y divide-slate-50">
            {[1,2,3].map(i => (
               <tr key={i} className="hover:bg-slate-50/30">
                  <td className="px-6 py-4 font-mono text-xs">LIB-{1000+i}</td>
                  <td className="px-6 py-4 font-bold text-slate-900 text-sm">Mathématiques 3ème</td>
                  <td className="px-6 py-4 text-slate-600 text-sm">Rayon B - Étagère 2</td>
                  <td className="px-6 py-4"><span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded uppercase">Bon État</span></td>
                  <td className="px-6 py-4 text-right">
                     <button className="text-indigo-600 hover:underline text-xs font-bold">Modifier</button>
                  </td>
               </tr>
            ))}
         </tbody>
      </table>
    </div>
  );
}

function InventoryTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-900 text-lg">Inventaire & Récolement</h3>
          <button className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-xs font-bold">Lancer une campagne</button>
       </div>
       <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-2xl">
          <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h4 className="font-bold text-slate-900 mb-2">Campagne d'inventaire 2025-2026</h4>
          <p className="text-sm text-slate-500 mb-6">Suivez et scannez l'ensemble du fonds documentaire pour détecter les pertes et dégradations.</p>
          <div className="flex justify-center gap-4">
             <div className="text-center p-4 bg-white rounded-xl shadow-sm w-32">
                <p className="text-2xl font-black text-slate-900">3,450</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Livres scannés</p>
             </div>
             <div className="text-center p-4 bg-white rounded-xl shadow-sm w-32 border-rose-100 border">
                <p className="text-2xl font-black text-rose-600">12</p>
                <p className="text-[10px] font-bold text-rose-400 uppercase">Manquants</p>
             </div>
          </div>
       </div>
    </div>
  );
}

function RecommendationsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2">
         <Lightbulb className="w-5 h-5 text-amber-500" /> Recommandations Pédagogiques
       </h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-slate-100 rounded-2xl bg-indigo-50/30">
             <span className="text-[10px] font-bold text-indigo-600 uppercase">Classe de 3ème A</span>
             <h4 className="font-bold text-slate-900 mt-1 mb-2">Lectures pour l'exposé d'Histoire</h4>
             <ul className="text-sm text-slate-600 space-y-1 mb-4 list-disc pl-4">
                <li>La Seconde Guerre Mondiale (Tome 1)</li>
                <li>Archive numérique : Le débarquement</li>
             </ul>
             <p className="text-xs text-slate-500 italic">Recommandé par : M. KOFFI</p>
          </div>
       </div>
    </div>
  );
}

function ReportsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6">Rapports & Statistiques</h3>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            'Rapport des Emprunts (Mensuel)',
            'Bilan des Pertes & Pénalités',
            'Taux de lecture par Classe'
          ].map((r, i) => (
             <div key={i} className="p-4 border border-slate-100 rounded-xl hover:shadow-md cursor-pointer group flex items-center gap-3">
                <FileText className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                <span className="font-bold text-sm text-slate-700">{r}</span>
             </div>
          ))}
       </div>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden p-6">
       <h3 className="font-bold text-slate-900 text-lg mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" /> Paramètres Bibliothèque
       </h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Durée max. d'emprunt (Élèves)</span>
                <span className="text-xs font-bold bg-white px-3 py-1 rounded shadow-sm">14 jours</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Pénalité par jour de retard</span>
                <span className="text-xs font-bold bg-white px-3 py-1 rounded shadow-sm text-rose-600">100 FCFA</span>
             </div>
          </div>
          <div className="space-y-4">
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Nombre max. d'emprunts</span>
                <span className="text-xs font-bold bg-white px-3 py-1 rounded shadow-sm">3 livres</span>
             </div>
             <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="text-sm font-bold text-slate-700">Catégories & Rayons</span>
                <button className="text-xs font-bold text-indigo-600 hover:underline">Gérer</button>
             </div>
          </div>
       </div>
    </div>
  );
}

function ChevronRight(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6"/></svg>
}
