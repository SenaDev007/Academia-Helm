'use client';

import { useState, useCallback } from 'react';
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
  Loader2,
  AlertCircle,
  CheckCircle2,
  BookOpen,
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

interface GeneratedDocument {
  type: string;
  header: any;
  style: any;
  skill: any;
  exercises: any[];
  notions: string[];
  barème: any;
  metadata: any;
}

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iaStatus, setIaStatus] = useState<any>(null);

  // Form state
  const [docType, setDocType] = useState('composition');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('mixte');
  const [style, setStyle] = useState('situation-probleme');
  const [notions, setNotions] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');

  // Load IA status on mount
  useState(() => {
    fetch('/api/pedagogy/ia/status')
      .then(res => res.json())
      .then(data => setIaStatus(data))
      .catch(() => {});
  });

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setGeneratedDoc(null);

    try {
      const notionsList = notions
        .split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

      const res = await fetch('/api/pedagogy/ia/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: docType,
          subjectId: subjectId || undefined,
          classId: classId || undefined,
          questions: numQuestions,
          difficulty,
          style,
          notions: notionsList.length > 0 ? notionsList : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Erreur lors de la génération');
      }

      setGeneratedDoc(data);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Une erreur est survenue lors de la génération');
    } finally {
      setIsGenerating(false);
    }
  }, [docType, subjectId, classId, numQuestions, difficulty, style, notions]);

  const handleImportJournal = useCallback(async () => {
    try {
      const res = await fetch('/api/pedagogy/ia/import-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: 'current', // Will be resolved by backend via tenant
        }),
      });

      const data = await res.json();

      if (data.extractedNotions && data.extractedNotions.length > 0) {
        setNotions(prev => {
          const existing = prev.split('\n').filter(n => n.trim());
          const combined = [...new Set([...existing, ...data.extractedNotions])];
          return combined.join('\n');
        });
      }
    } catch (err) {
      console.error('Journal import error:', err);
    }
  }, []);

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
               <select 
                 value={docType}
                 onChange={(e) => setDocType(e.target.value)}
                 className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700"
               >
                  <option value="composition">Épreuve de composition</option>
                  <option value="devoir">Devoir surveillé</option>
                  <option value="interrogation">Interrogation rapide</option>
                  <option value="fiche-activite">Fiche d'activité</option>
               </select>
               <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Questions</span>
                    <input 
                      type="number" 
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(parseInt(e.target.value) || 5)}
                      min={1} 
                      max={20}
                      className="w-full bg-transparent border-none p-0 text-sm font-bold" 
                    />
                  </div>
                  <select 
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="p-3 bg-slate-50 border-none rounded-xl text-xs font-bold"
                  >
                    <option value="mixte">Difficulté : Mixte</option>
                    <option value="facile">Facile</option>
                    <option value="moyen">Moyen</option>
                    <option value="difficile">Difficile</option>
                  </select>
               </div>
               <select 
                 value={style}
                 onChange={(e) => setStyle(e.target.value)}
                 className="w-full p-3 bg-indigo-50 border-indigo-100 rounded-xl text-xs font-bold text-indigo-700"
               >
                  <option value="situation-probleme">Style : Situation-Problème</option>
                  <option value="classique">Approche Classique</option>
                  <option value="examen-officiel">Format Examen Officiel</option>
                  <option value="ludique">Ludique & Interactif</option>
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
                 value={notions}
                 onChange={(e) => setNotions(e.target.value)}
                 placeholder="Saisissez les titres des leçons, notions et compétences (une par ligne)..."
                 className="w-full h-32 p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
               />
               <button 
                 onClick={handleImportJournal}
                 className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
               >
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

          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {isGenerating ? (
               <>
                 <Loader2 className="w-5 h-5 animate-spin" />
                 GÉNÉRATION EN COURS...
               </>
             ) : (
               <>
                 <Sparkles className="w-5 h-5" />
                 LANCER LA GÉNÉRATION SARA
               </>
             )}
          </button>

          {error && (
            <div className="flex items-start gap-2 p-4 bg-red-50 rounded-xl border border-red-100">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-700">Erreur de génération</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {iaStatus && iaStatus.configured === false && (
            <div className="flex items-start gap-2 p-4 bg-amber-50 rounded-xl border border-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700">Mode Template</p>
                <p className="text-xs text-amber-600 mt-1">IA non configurée. Les documents sont générés à partir de templates. Configurez une clé API pour activer la génération IA avancée.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Editor / Preview */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-xl overflow-hidden min-h-[600px] flex flex-col">
          {/* Editor Toolbar */}
          <div className="px-8 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full animate-pulse ${generatedDoc ? 'bg-emerald-400' : isGenerating ? 'bg-amber-400' : 'bg-slate-400'}`} />
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

          {/* Editor Content */}
          <div className="flex-1 p-12 overflow-y-auto bg-slate-50/50">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-200 rounded-full animate-spin border-t-indigo-600" />
                  <Sparkles className="w-8 h-8 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-900">Sara génère votre document...</h3>
                  <p className="text-sm text-slate-500 mt-2">Analyse des notions et construction des questions</p>
                </div>
              </div>
            ) : generatedDoc ? (
              <GeneratedDocumentPreview doc={generatedDoc} />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
                <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-indigo-300" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-bold text-slate-900">Votre document apparaîtra ici</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-sm">Configurez les paramètres à gauche et cliquez sur "Lancer la génération Sara" pour créer votre épreuve.</p>
                </div>
              </div>
            )}
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

function GeneratedDocumentPreview({ doc }: { doc: GeneratedDocument }) {
  return (
    <div className="max-w-[21cm] mx-auto bg-white shadow-2xl min-h-[29.7cm] p-16 rounded-sm border border-slate-200 relative">
      {/* Document Header */}
      <div className="border-2 border-slate-900 p-4 mb-8 flex items-center justify-between">
        <div className="text-center font-bold text-xs uppercase space-y-1">
          <p>{doc.header?.institution || 'ACADÉMIA HELM'}</p>
          <p>{doc.header?.department || 'DÉPARTEMENT PÉDAGOGIQUE'}</p>
        </div>
        <div className="text-right text-[10px] font-bold space-y-1">
          <p>CLASSE : {doc.header?.class || 'À définir'}</p>
          <p>MATIÈRE : {doc.header?.subject || 'À définir'}</p>
          <p>DURÉE : {doc.header?.duration || '1H30'}</p>
        </div>
      </div>

      <h2 className="text-center text-xl font-black underline mb-12">
        {doc.type === 'composition' ? 'COMPOSITION' : doc.type === 'devoir' ? 'DEVOIR SURVEILLÉ' : doc.type === 'interrogation' ? 'INTERROGATION' : 'FICHE D\'ACTIVITÉ'}
      </h2>

      {/* Exercises */}
      <div className="space-y-8">
        {doc.exercises?.map((exercise: any, i: number) => (
          <div key={i}>
            <h3 className="font-bold mb-4">{exercise.titre} ({exercise.points} pts)</h3>
            {exercise.questions?.map((q: any, j: number) => (
              <div key={j} className="space-y-2 pl-4 mb-4">
                <p className="text-sm text-slate-700 leading-relaxed">{q.text}</p>
                {q.saraInsight && (
                  <p className="text-sm text-slate-500 italic">
                    Sara Insight: "{q.saraInsight}"
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}

        {(!doc.exercises || doc.exercises.length === 0) && (
          <div className="text-center py-8">
            <p className="text-slate-400 italic">Aucun exercice généré</p>
          </div>
        )}
      </div>

      {/* Barème */}
      {doc.bareme && (
        <div className="mt-12 pt-8 border-t border-slate-200">
          <h3 className="font-bold text-sm mb-4">Barème</h3>
          <div className="grid grid-cols-2 gap-2">
            {doc.bareme.distribution?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between text-xs text-slate-600">
                <span>Exercice {item.exercice}</span>
                <span>{item.points} pts</span>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold text-slate-900 border-t pt-2 mt-2">
              <span>Total</span>
              <span>{doc.bareme.total} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Footer */}
      {doc.metadata?.isPlaceholder && (
        <div className="mt-8 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-[10px] text-amber-600 font-bold">
            Document généré en mode template (IA non configurée). Configurez une clé API Claude ou OpenAI pour activer la génération IA avancée.
          </p>
        </div>
      )}

      {/* AI Action Overlay */}
      <div className="absolute bottom-8 right-8 flex items-center gap-2">
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-all">
          <Wand2 className="w-4 h-4" />
          Améliorer ce document
        </button>
      </div>
    </div>
  );
}

function SkillsManagement() {
  const [skills, setSkills] = useState([
    { id: 'skill-primaire-standard', title: 'Épreuve Primaire Standard', type: 'Primaire', status: 'DEFAULT', desc: 'Consignes simples, progressif', icon: Zap },
    { id: 'skill-examen-officiel', title: 'Composition Secondaire Scientifique', type: 'Secondaire', status: 'ACTIVE', desc: 'Présentation stricte, barème rigoureux', icon: Zap },
    { id: 'skill-maternelle-qualitatif', title: 'Maternelle Qualitative', type: 'Maternelle', status: 'ACTIVE', desc: 'Activités ludiques, évaluation qualitative', icon: Zap },
    { id: 'skill-bilingue-fr-en', title: 'Bilingue Français-Anglais', type: 'Mixte', status: 'ACTIVE', desc: 'Questions bilingues', icon: Share2 },
  ]);

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
        {skills.map((skill, i) => (
          <div key={skill.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
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
             <p className="text-xs text-slate-400 mt-2">{skill.desc}</p>
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
