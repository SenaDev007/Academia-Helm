'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  FilePlus,
  FileText,
  Library,
  Zap,
  ShieldCheck,
  Share2,
  Download,
  Plus,
  Settings,
  Upload,
  Brain,
  Wand2,
  ChevronRight,
  Eye,
  Save,
  Printer,
  MoreVertical,
  History,
} from 'lucide-react';

const SARA_TABS = [
  { id: 'new', label: 'Nouveau document', icon: FilePlus },
  { id: 'drafts', label: 'Mes brouillons', icon: FileText },
  { id: 'generated', label: 'Documents générés', icon: Wand2 },
  { id: 'library', label: 'Bibliothèque', icon: Library },
  { id: 'skills', label: 'Skills IA', icon: Zap },
  { id: 'validations', label: 'Validations', icon: ShieldCheck },
  { id: 'shares', label: 'Partages', icon: Share2 },
  { id: 'exports', label: 'Exports', icon: Download },
];

export default function SaraComposeWorkspace() {
  const [activeTab, setActiveTab] = useState('new');

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
              Sara Compose — Studio IA Pédagogique
            </h1>
            <p className="text-slate-500 mt-1">Générez vos épreuves, devoirs et exercices avec l'IA Sara</p>
          </div>
          <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all">
               <History className="w-4 h-4" />
               Historique
             </button>
             <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-100">
               <Settings className="w-4 h-4" />
               Configuration
             </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="px-8 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {SARA_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-xs font-bold transition-all border-b-2 whitespace-nowrap uppercase tracking-widest ${
                  isActive 
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto"
          >
            {activeTab === 'new' && <NewDocumentWizard />}
            {activeTab === 'skills' && <SkillsManagement />}
            {activeTab !== 'new' && activeTab !== 'skills' && (
               <div className="p-20 text-center bg-white rounded-[40px] border border-slate-100 shadow-sm">
                 <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <Library className="w-10 h-10 text-indigo-400" />
                 </div>
                 <h2 className="text-2xl font-bold text-slate-900">Espace {SARA_TABS.find(t => t.id === activeTab)?.label}</h2>
                 <p className="text-slate-500 mt-2 max-w-md mx-auto">Ce module est prêt à accueillir vos documents générés et validés.</p>
               </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function NewDocumentWizard() {
  const [step, setStep] = useState(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Panel: Configuration */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" />
              1. Type & Structure
            </h3>
            <div className="grid grid-cols-1 gap-4">
               <select className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700">
                  <option>Épreuve de composition</option>
                  <option>Devoir surveillé</option>
                  <option>Interrogation rapide</option>
                  <option>Fiche d'activité</option>
               </select>
               <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Questions</span>
                    <input type="number" defaultValue={5} className="w-full bg-transparent border-none p-0 text-sm font-bold" />
                  </div>
                  <select className="p-3 bg-slate-50 border-none rounded-xl text-xs font-bold">
                    <option>Difficulté : Mixte</option>
                    <option>Facile</option>
                    <option>Moyen</option>
                    <option>Difficile</option>
                  </select>
               </div>
               <select className="w-full p-3 bg-indigo-50 border-indigo-100 rounded-xl text-xs font-bold text-indigo-700">
                  <option>Style : Situation-Problème</option>
                  <option>Approche Classique</option>
                  <option>Format Examen Officiel</option>
                  <option>Ludique & Interactif</option>
               </select>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-500" />
              2. Sources & Notions
            </h3>
            <div className="space-y-3">
               <button className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-indigo-50/50 hover:border-indigo-200 transition-all group">
                  <Upload className="w-6 h-6 text-slate-300 group-hover:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-400 group-hover:text-indigo-600">Téléverser des captures d'écran</span>
               </button>
               <textarea 
                 placeholder="Ou saisissez les titres des leçons, notions et compétences..."
                 className="w-full h-32 p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
               />
               <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                 <Brain className="w-4 h-4" />
                 Importer depuis le Cahier Journal
               </button>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-500" />
              3. Sélectionner un Skill IA
            </h3>
            <div className="space-y-2">
               {[
                 { id: 1, label: 'Primaire Standard', desc: 'Consignes simples, progressif' },
                 { id: 2, label: 'Examen Officiel', desc: 'Présentation stricte, barème rigoureux' },
               ].map((skill) => (
                 <button key={skill.id} className="w-full p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 text-left transition-all group">
                    <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700">{skill.label}</h4>
                    <p className="text-[10px] text-slate-400">{skill.desc}</p>
                 </button>
               ))}
            </div>
          </div>

          <button className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95 transition-all">
             <Sparkles className="w-5 h-5" />
             LANCER LA GÉNÉRATION SARA
          </button>
        </div>
      </div>

      {/* Right Panel: Editor / Preview */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          {/* Editor Toolbar */}
          <div className="px-8 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest">Sara Compose</span>
              </div>
              <div className="flex items-center bg-white/10 rounded-lg p-1">
                 <button className="px-3 py-1 bg-white/20 rounded-md text-[10px] font-bold uppercase">Version Enseignant</button>
                 <button className="px-3 py-1 hover:bg-white/5 rounded-md text-[10px] font-bold text-white/40 uppercase">Version Élève</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <button className="p-2 hover:bg-white/10 rounded-lg transition-all" title="Sauvegarder"><Save className="w-4 h-4" /></button>
               <button className="p-2 hover:bg-white/10 rounded-lg transition-all" title="Imprimer"><Printer className="w-4 h-4" /></button>
               <button className="p-2 hover:bg-white/10 rounded-lg transition-all" title="Exporter PDF"><Download className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Editor Content (Mock) */}
          <div className="flex-1 p-12 overflow-y-auto bg-slate-50/50">
            <div className="max-w-[21cm] mx-auto bg-white shadow-2xl min-h-[29.7cm] p-16 rounded-sm border border-slate-200 relative">
               {/* Document Header */}
               <div className="border-2 border-slate-900 p-4 mb-8 flex items-center justify-between">
                 <div className="text-center font-bold text-xs uppercase space-y-1">
                    <p>ACADÉMIA HELM - ÉCOLE PILOTE</p>
                    <p>DÉPARTEMENT PÉDAGOGIQUE</p>
                 </div>
                 <div className="text-right text-[10px] font-bold space-y-1">
                    <p>CLASSE : CM2</p>
                    <p>MATIÈRE : MATHÉMATIQUES</p>
                    <p>DURÉE : 1H30</p>
                 </div>
               </div>

               <h2 className="text-center text-xl font-black underline mb-12">COMPOSITION DU 2ÈME TRIMESTRE</h2>

               <div className="space-y-8">
                 <div>
                    <h3 className="font-bold mb-4">Exercice 1 : Calcul sur les fractions (5 pts)</h3>
                    <p className="text-sm text-slate-700 leading-relaxed italic mb-4">Sara Insight: &quot;Basé sur vos notions de la semaine 12.&quot;</p>
                    <div className="space-y-4 pl-4">
                       <p className="text-sm">1. Simplifie les fractions suivantes : 12/24 ; 15/45 ; 100/250.</p>
                       <p className="text-sm">2. Effectue les opérations ci-dessous : 1/2 + 3/4 ; 5/6 - 1/3.</p>
                    </div>
                 </div>

                 <div>
                    <h3 className="font-bold mb-4">Exercice 2 : Problème (10 pts)</h3>
                    <p className="text-sm text-slate-700 leading-relaxed mb-4">
                      Un agriculteur possède un champ de 5 hectares. Il décide d'en vendre les 2/5 pour construire un centre de santé...
                    </p>
                    <p className="text-sm font-bold mt-4 text-indigo-600">Question générée : Calcule la surface restante en m².</p>
                 </div>
               </div>

               {/* AI Action Overlay */}
               <div className="absolute bottom-8 right-8 flex items-center gap-2">
                 <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-all">
                    <Wand2 className="w-4 h-4" />
                    Améliorer ce document
                 </button>
               </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-8 py-6 border-t border-slate-100 bg-white flex items-center justify-between">
             <div className="flex items-center gap-4">
                <button className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Prévisualiser (Élève)
                </button>
             </div>
             <div className="flex items-center gap-3">
                <button className="px-6 py-2.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all">
                  Soumettre à Validation
                </button>
                <button className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 transition-all">
                  Valider & Sauvegarder
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillsManagement() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vos Skills Pédagogiques</h2>
          <p className="text-slate-500 mt-1">Configurez les profils de génération pour vos épreuves</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-100 hover:scale-105 transition-all">
           <Plus className="w-5 h-5" /> Nouveau Skill
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Épreuve Primaire Standard', type: 'Primaire', status: 'DEFAULT', icon: Zap },
          { title: 'Composition Secondaire Scientifique', type: 'Secondaire', status: 'ACTIVE', icon: Zap },
          { title: 'Maternelle Qualitative', type: 'Maternelle', status: 'ACTIVE', icon: Zap },
          { title: 'Bilingue Français-Anglais', type: 'Mixte', status: 'ACTIVE', icon: Share2 },
        ].map((skill, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
             <div className="flex items-start justify-between mb-6">
                <div className={`p-3 rounded-2xl ${i === 0 ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                   <skill.icon className="w-6 h-6" />
                </div>
                <button className="p-2 text-slate-300 hover:text-slate-600"><MoreVertical className="w-4 h-4" /></button>
             </div>
             <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{skill.title}</h3>
             <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{skill.type}</span>
                {skill.status === 'DEFAULT' && (
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-600 text-white rounded-full font-bold uppercase">Par défaut</span>
                )}
             </div>
             <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                <button className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                   Modifier le skill <ChevronRight className="w-3 h-3" />
                </button>
                <div className="flex -space-x-2">
                   {[1, 2].map((u) => (
                     <div key={u} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200" />
                   ))}
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
