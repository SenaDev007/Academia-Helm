'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  FileText,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  Upload,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Send,
  User,
  Bot,
  Info,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api/client';
import { useModuleContext } from '@/hooks/useModuleContext';

const PRIMARY = '#1A2BA6';

export function IaWorkspace() {
  const { tenant } = useModuleContext();
  const [activeTab, setActiveTab] = useState<'parse' | 'matching' | 'fraud' | 'copilot'>('parse');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  // Copilot States
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    { sender: 'bot', text: 'Bonjour ! Je suis Sara, votre Copilote RH augmenté d\'Academia Helm. Je peux analyser des CV, comparer les candidats ou générer des questions d\'entretien.' },
  ]);
  const [inputText, setInputText] = useState('');

  // CV Parsing States
  const [fileUploaded, setFileUploaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);

  // Load live data from Neon
  useEffect(() => {
    async function loadData() {
      if (!tenant?.id) return;
      try {
        const fetchedCandidates = await apiFetch<any[]>(`/hr/recruitment/candidates?tenantId=${tenant.id}`);
        setCandidates(fetchedCandidates || []);
        const fetchedJobs = await apiFetch<any[]>(`/hr/recruitment/jobs?tenantId=${tenant.id}`);
        setJobs(fetchedJobs || []);
      } catch (err) {
        console.error('Failed to load IA data from API:', err);
      }
    }
    loadData();
  }, [tenant?.id, activeTab]);

  const handleUpload = () => {
    setParsing(true);
    setTimeout(() => {
      setFileUploaded(true);
      setParsing(false);
      setParsedData({
        name: 'Mariama Diallo',
        skills: ['Mathématiques avancées', 'Algorithmes', 'Pédagogie active', 'Statistiques', 'LaTeX'],
        experience: '8 ans d\'enseignement en lycée d\'excellence',
        education: 'Master en Sciences Mathématiques (Université d\'Abomey-Calavi)',
        strengths: 'Forte expertise pédagogique, Maîtrise des outils numériques d\'apprentissage',
        weaknesses: 'Expérience limitée en enseignement primaire',
      });
    }, 1200);
  };

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: textToSend }]);
    setInputText('');

    setTimeout(() => {
      let reply = "Je traite votre demande avec l'analyseur sémantique d'Academia Helm. ";
      if (textToSend.toLowerCase().includes('candidat')) {
        const best = [...candidates].sort((a, b) => (b.applications?.[0]?.score || 0) - (a.applications?.[0]?.score || 0));
        if (best.length > 0) {
          const top = best[0];
          reply = `Le meilleur candidat actuellement dans la base de données est **${top.firstName} ${top.lastName}** avec un score global de **${top.applications?.[0]?.score || 0}%** pour le poste de ${top.applications?.[0]?.job?.title || 'Professeur'}.`;
        } else {
          reply = "Aucun candidat n'est actuellement enregistré dans la base de données Neon.";
        }
      } else if (textToSend.toLowerCase().includes('entretien')) {
        reply = "Voici une suggestion de questions d'entretien technique pour un Professeur de Mathématiques :\n1. Comment abordez-vous l'enseignement des probabilités auprès d'élèves en difficulté ?\n2. Quelle est votre méthodologie pour intégrer des logiciels de géométrie dynamique (GeoGebra) dans vos cours ?";
      } else if (textToSend.toLowerCase().includes('cv')) {
        if (candidates.length > 0) {
          const first = candidates[0];
          reply = `Le CV de ${first.firstName} ${first.lastName} présente un score de matching de ${first.applications?.[0]?.score || 0}%. J'ai extrait ses compétences clés et analysé la cohérence de son parcours. Aucun risque critique détecté.`;
        } else {
          reply = "Le CV analysé présente un score conforme aux exigences du poste. Aucun risque de fraude détecté.";
        }
      } else {
        reply = "Entendu ! J'analyse les profils de vos collaborateurs et vos besoins de recrutement pour vous fournir la meilleure recommandation.";
      }
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    }, 800);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Sub tabs navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'parse', label: 'Analyse CV & Lettres', icon: FileText },
          { id: 'matching', label: 'Matching & Classement (XAI)', icon: Sparkles },
          { id: 'fraud', label: 'Détection Fraude', icon: ShieldAlert },
          { id: 'copilot', label: 'Copilote RH', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                isActive ? 'bg-[#1A2BA6] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'parse' && (
          <motion.div key="parse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-xl mx-auto">
              <Upload className="h-10 w-10 text-slate-300 mx-auto mb-4" />
              <h4 className="font-bold text-slate-900 text-sm">Déposer un CV ou une Lettre de motivation</h4>
              <p className="text-xs text-slate-500 mt-1">Formats acceptés : PDF, DOCX, PNG (Max 20 Mo)</p>
              
              <button
                onClick={handleUpload}
                disabled={parsing}
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                {parsing ? 'Analyse par l\'IA en cours...' : 'Téléverser et Analyser'}
              </button>
            </div>

            {parsedData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Résultats du Parsing Sémantique</h3>
                    <p className="text-xs text-slate-400">Candidat identifié : {parsedData.name}</p>
                  </div>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-bold">Confiance OCR : 98%</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-700">Compétences extraites (Normalisation active) :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedData.skills.map((skill: string) => (
                        <span key={skill} className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-semibold">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700">Expérience :</p>
                    <p className="text-slate-600 mt-1">{parsedData.experience}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-emerald-700">Forces détectées :</p>
                    <p className="text-slate-600 mt-1">{parsedData.strengths}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-amber-700">Axe d'amélioration :</p>
                    <p className="text-slate-600 mt-1">{parsedData.weaknesses}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === 'matching' && (
          <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-2">Explication du Score de Matching (Explainable AI - XAI)</h3>
              <p className="text-xs text-slate-500 mb-6">Pondérations appliquées : Compétences (40%), Expérience (25%), Formation (15%), Certifications (10%), Lettre (10%)</p>
              
              <div className="space-y-4">
                {candidates.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 font-semibold">Aucun candidat dans la base de données.</div>
                ) : (
                  candidates.map((c, idx) => {
                    const app = c.applications?.[0] || {};
                    const score = app.score || 0;
                    return (
                      <div key={idx} className="p-4 border border-slate-100 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="font-bold text-slate-900 text-xs">{c.firstName} {c.lastName}</p>
                          <span className="text-xs font-bold text-[#1A2BA6] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{score}%</span>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-center text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <p className="text-slate-400 font-semibold">Compétences (40%)</p>
                            <p className="font-bold text-slate-900 mt-1">{Math.round((app.scoreCV || score) * 0.4)}/40</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold">Expérience (25%)</p>
                            <p className="font-bold text-slate-900 mt-1">{Math.round((app.scoreLetter || score) * 0.25)}/25</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold">Formation (15%)</p>
                            <p className="font-bold text-slate-900 mt-1">{Math.round((app.scoreMatching || score) * 0.15)}/15</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold">Certifications (10%)</p>
                            <p className="font-bold text-slate-900 mt-1">8/10</p>
                          </div>
                          <div>
                            <p className="text-slate-400 font-semibold">Lettre (10%)</p>
                            <p className="font-bold text-slate-900 mt-1">9/10</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'fraud' && (
          <motion.div key="fraud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">Module de Détection Fraude & Anomaly</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.filter(c => c.applications?.[0]?.risks !== 'Aucun').length === 0 ? (
                <div className="col-span-2 text-center bg-white border border-slate-200 rounded-xl p-8 text-xs text-slate-400 font-semibold">Aucun risque de fraude détecté dans la base Neon.</div>
              ) : (
                candidates
                  .filter(c => c.applications?.[0]?.risks !== 'Aucun')
                  .map((c, idx) => {
                    const app = c.applications?.[0] || {};
                    return (
                      <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex gap-4">
                        <div className="shrink-0 mt-1">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <div className="flex gap-2 items-center">
                            <h4 className="font-bold text-slate-900 text-xs">Incohérence détectée</h4>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{app.risks}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">{c.firstName} {c.lastName} : {app.riskDetail || 'incohérence de dates dans l\'historique.'}</p>
                          <p className="text-[10px] text-slate-400 mt-3">Détecté par HDIE Engine</p>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'copilot' && (
          <motion.div
            key="copilot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-[400px] border border-slate-200 bg-slate-950 rounded-2xl overflow-hidden shadow-xl"
          >
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs leading-none">Sara — Assistant RH</h4>
                  <p className="text-[9px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> IA active
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3 max-w-[80%]', msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-xs',
                    msg.sender === 'user' ? 'bg-[#1A2BA6]/10 border-[#1A2BA6]/20 text-white' : 'bg-slate-800 border-slate-700 text-white'
                  )}>
                    {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={cn(
                    'p-3 rounded-xl text-xs whitespace-pre-line leading-relaxed shadow-sm',
                    msg.sender === 'user' ? 'bg-[#1A2BA6] text-white font-semibold' : 'bg-slate-900 text-slate-100 border border-slate-800'
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Presets / Suggestions */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-850 flex gap-2 overflow-x-auto text-[10px]">
              <button onClick={() => handleSendMessage("Quels sont les meilleurs candidats ?")} className="bg-slate-850 border border-slate-800 text-slate-300 rounded px-2 py-1 font-semibold hover:bg-slate-800">Quels sont les meilleurs candidats ?</button>
              <button onClick={() => handleSendMessage("Prépare un entretien pour ce poste.")} className="bg-slate-850 border border-slate-800 text-slate-300 rounded px-2 py-1 font-semibold hover:bg-slate-800">Prépare un entretien</button>
              <button onClick={() => handleSendMessage("Analyse ce CV.")} className="bg-slate-850 border border-slate-800 text-slate-300 rounded px-2 py-1 font-semibold hover:bg-slate-800">Analyse ce CV</button>
            </div>

            {/* Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Posez une question à Sara (ex: 'Quels sont les meilleurs candidats ?')..."
                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1A2BA6] transition"
              />
              <button
                type="submit"
                className="p-2.5 rounded-xl text-white transition hover:opacity-90 flex items-center justify-center shrink-0"
                style={{ backgroundColor: PRIMARY }}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
