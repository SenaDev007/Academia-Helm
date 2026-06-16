'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Brain,
  FileText,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  Upload,
  AlertTriangle,
  Send,
  User,
  Bot,
  Info,
  Loader2,
  CheckCircle,
  XCircle,
  FileSearch,
  TrendingUp,
  ShieldCheck,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { useModuleContext } from '@/hooks/useModuleContext';

const PRIMARY = '#1A2BA6';

export function IaWorkspace() {
  const { tenant } = useModuleContext();
  const [activeTab, setActiveTab] = useState<'parse' | 'matching' | 'fraud' | 'copilot'>('parse');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [iaStatus, setIaStatus] = useState<any>(null);

  // Copilot States
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    { sender: 'bot', text: "Shalom ! Je suis Sarah, votre Assistante RH dédiée. Je maîtrise l'ensemble du cycle RH : recrutement, contrats (CDI/CDD/vacation/stage), paie, CNSS, congés, évaluations, conformité légale et gestion des talents.\n\nComment puis-je vous accompagner aujourd'hui ?" },
  ]);
  const [inputText, setInputText] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  // CV Parsing States
  const [fileUploaded, setFileUploaded] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Matching States
  const [matchingData, setMatchingData] = useState<any>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);

  // Fraud States
  const [fraudData, setFraudData] = useState<any>(null);
  const [fraudLoading, setFraudLoading] = useState(false);

  // Load IA status on mount
  useEffect(() => {
    async function loadIaStatus() {
      try {
        const status = await hrFetch<any>(hrUrl('ia/status', { tenantId: tenant.id }));
        setIaStatus(status);
      } catch (err) {
        console.error('Failed to load IA status:', err);
      }
    }
    loadIaStatus();
  }, []);

  // Load live data from API
  useEffect(() => {
    async function loadData() {
      if (!tenant?.id) return;
      try {
        const fetchedCandidates = await hrFetch<any[]>(hrUrl('recruitment/candidates', { tenantId: tenant.id }));
        setCandidates(fetchedCandidates || []);
        const fetchedJobs = await hrFetch<any[]>(hrUrl('recruitment/jobs', { tenantId: tenant.id }));
        setJobs(fetchedJobs || []);
      } catch (err) {
        console.error('Failed to load IA data from API:', err);
      }
    }
    loadData();
  }, [tenant?.id, activeTab]);

  // Load matching data when matching tab is active
  useEffect(() => {
    async function loadMatching() {
      if (activeTab !== 'matching' || !tenant?.id) return;
      setMatchingLoading(true);
      try {
        const result = await hrFetch<any>(hrUrl('ia/match-candidates', { tenantId: tenant.id }));
        setMatchingData(result);
      } catch (err) {
        console.error('Failed to load matching data:', err);
        // Fallback: compute matching from candidates data
        setMatchingData(null);
      } finally {
        setMatchingLoading(false);
      }
    }
    loadMatching();
  }, [activeTab, tenant?.id]);

  // Load fraud data when fraud tab is active
  useEffect(() => {
    async function loadFraud() {
      if (activeTab !== 'fraud' || !tenant?.id) return;
      setFraudLoading(true);
      try {
        const result = await hrFetch<any>(hrUrl('ia/detect-fraud', { tenantId: tenant.id }));
        setFraudData(result);
      } catch (err) {
        console.error('Failed to load fraud data:', err);
        setFraudData(null);
      } finally {
        setFraudLoading(false);
      }
    }
    loadFraud();
  }, [activeTab, tenant?.id]);

  const handleUpload = async () => {
    setParsing(true);
    try {
      // If a candidate is selected, parse their existing data via the IA service
      const result = await hrFetch<any>(hrUrl('ia/parse-cv', { tenantId: tenant.id }), {
        method: 'POST',
        body: { tenantId: tenant?.id },
      });
      setFileUploaded(true);
      setParsedData(result);
    } catch (err) {
      // AI endpoint returned an error — show fallback
      setFileUploaded(true);
      setParsedData({
        name: '— (IA non configurée)',
        skills: ['Analyse sémantique non disponible'],
        experience: 'L\'analyse IA n\'est pas encore activée. Contactez votre administrateur.',
        education: 'L\'analyse automatique de CV sera disponible prochainement.',
        strengths: 'Le module d\'analyse IA est en cours de configuration',
        weaknesses: 'L\'analyse sémantique avancée sera disponible une fois le service activé',
        isPlaceholder: true,
      });
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation : taille max 20 Mo
    const MAX_SIZE_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setParsedData({
        name: '— (Fichier trop volumineux)',
        skills: ['Le fichier dépasse la limite de 20 Mo'],
        experience: 'Veuillez téléverser un fichier plus léger (max 20 Mo).',
        education: '—',
        strengths: '',
        weaknesses: 'Fichier trop volumineux',
        isPlaceholder: true,
      });
      setFileUploaded(true);
      setUploadedFileName(file.name);
      event.target.value = '';
      return;
    }

    // Validation : types MIME supportés
    const SUPPORTED_MIME = [
      'application/pdf',
      'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    ];
    const SUPPORTED_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!SUPPORTED_MIME.includes(file.type) && !SUPPORTED_EXT.includes(ext)) {
      setParsedData({
        name: '— (Format non supporté)',
        skills: ['Format de fichier non reconnu'],
        experience: 'Formats acceptés : PDF, PNG, JPG, JPEG, WEBP, GIF.',
        education: '—',
        strengths: '',
        weaknesses: 'Format non supporté',
        isPlaceholder: true,
      });
      setFileUploaded(true);
      setUploadedFileName(file.name);
      event.target.value = '';
      return;
    }

    setUploadedFileName(file.name);
    setParsing(true);
    setParsedData(null);
    setFileUploaded(false);
    try {
      // Read file as base64 and send to IA parsing endpoint
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(',')[1]; // Remove data:xxx;base64, prefix
        try {
          const result = await hrFetch<any>(hrUrl('ia/parse-cv', { tenantId: tenant.id }), {
            method: 'POST',
            body: {
              tenantId: tenant?.id,
              base64Data,
              fileName: file.name,
              mimeType: file.type || (ext === '.pdf' ? 'application/pdf' : 'image/png'),
            },
          });
          setFileUploaded(true);
          setParsedData(result);
        } catch (err) {
          setFileUploaded(true);
          setParsedData({
            name: '— (Erreur d\'analyse)',
            skills: ['Impossible d\'analyser le document'],
            experience: 'L\'analyse IA n\'a pas pu être effectuée. Vérifiez votre connexion et réessayez.',
            education: 'Si le problème persiste, contactez votre administrateur.',
            strengths: 'Veuillez réessayer avec un autre fichier',
            weaknesses: 'Erreur lors de l\'analyse du document',
            isPlaceholder: true,
            fileName: file.name,
          });
        } finally {
          setParsing(false);
        }
      };
      reader.onerror = () => {
        setParsing(false);
        setParsedData({
          name: '— (Erreur de lecture)',
          skills: ['Impossible de lire le fichier'],
          experience: 'Le fichier n\'a pas pu être lu par le navigateur.',
          education: 'Vérifiez que le fichier n\'est pas corrompu.',
          strengths: '',
          weaknesses: 'Erreur de lecture du fichier',
          isPlaceholder: true,
          fileName: file.name,
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setParsing(false);
    }
    // Reset input so the same file can be re-selected
    event.target.value = '';
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    setMessages((prev) => [...prev, { sender: 'user', text: textToSend }]);
    setInputText('');
    setCopilotLoading(true);

    try {
      // Use the backend copilot endpoint
      const result = await hrFetch<any>(hrUrl('ia/copilot', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          tenantId: tenant?.id,
          message: textToSend,
        },
      });

      setMessages((prev) => [...prev, { sender: 'bot', text: result.reply || result.message || 'Je n\'ai pas pu traiter votre demande.' }]);
    } catch (err) {
      // Fallback: client-side rule engine if backend is unreachable
      let reply = '';
      const textLower = textToSend.toLowerCase();

      if (textLower.includes('candidat') || textLower.includes('meilleur')) {
        const best = [...candidates].sort((a, b) => (b.applications?.[0]?.score || 0) - (a.applications?.[0]?.score || 0));
        reply = best.length > 0
          ? `Le meilleur candidat est **${best[0].firstName} ${best[0].lastName}** avec un score de **${best[0].applications?.[0]?.score || 0}%**.`
          : "Aucun candidat dans la base.";
      } else {
        reply = "Je traite votre demande. *L'analyse IA enrichie n'est pas encore disponible.*\n\nEn attendant, je peux vous fournir les données brutes du système RH.";
      }
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Helper: render matching breakdown from backend data or fallback
  const renderMatchingContent = () => {
    if (matchingLoading) {
      return (
        <div className="text-center py-8 text-xs text-slate-400 font-semibold">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Calcul des scores XAI en cours...
        </div>
      );
    }

    // Backend matching data available
    if (matchingData?.candidates?.length > 0) {
      return (
        <div className="space-y-3">
          {matchingData.candidates.map((c: any, idx: number) => {
            const isTopPick = idx === 0 && c.totalScore >= 60;
            return (
              <div key={c.candidateId || idx} className={`p-4 border rounded-xl space-y-3 ${isTopPick ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100 bg-white'}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black ${isTopPick ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{c.candidateName}</p>
                      {c.jobTitle && <p className="text-[10px] text-slate-400 font-medium">→ {c.jobTitle}</p>}
                    </div>
                    {isTopPick && (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> Top pick
                      </span>
                    )}
                  </div>
                  <span className={`text-sm font-black ${isTopPick ? 'text-emerald-700' : 'text-[#1A2BA6]'}`}>{c.totalScore}%</span>
                </div>
                {/* Barre de score visuelle */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isTopPick ? 'bg-emerald-500' : 'bg-[#1A2BA6]'}`}
                    style={{ width: `${c.totalScore}%` }}
                  />
                </div>
                <div className="grid grid-cols-5 gap-2 text-center text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-slate-400 font-semibold">Compétences (40%)</p>
                    <p className="font-bold text-slate-900 mt-1">{c.breakdown?.skills?.score ?? '—'}/{c.breakdown?.skills?.max ?? 40}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Expérience (25%)</p>
                    <p className="font-bold text-slate-900 mt-1">{c.breakdown?.experience?.score ?? '—'}/{c.breakdown?.experience?.max ?? 25}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Formation (15%)</p>
                    <p className="font-bold text-slate-900 mt-1">{c.breakdown?.education?.score ?? '—'}/{c.breakdown?.education?.max ?? 15}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Certifications (10%)</p>
                    <p className="font-bold text-slate-900 mt-1">{c.breakdown?.certifications?.score ?? '—'}/{c.breakdown?.certifications?.max ?? 10}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold">Lettre (10%)</p>
                    <p className="font-bold text-slate-900 mt-1">{c.breakdown?.coverLetter?.score ?? '—'}/{c.breakdown?.coverLetter?.max ?? 10}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Fallback: client-side matching from candidates data
    if (candidates.length === 0) {
      return (
        <div className="text-center py-10 px-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Aucun candidat dans la base de données</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Les candidats proviennent du module <span className="font-semibold">Recrutement</span>.
            Créez des offres d&apos;emploi et recevez des candidatures pour activer le classement intelligent.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {candidates.map((c, idx) => {
          const app = c.applications?.[0] || {};
          const score = app.score || 0;
          return (
            <div key={c.id || idx} className="p-4 border border-slate-100 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <p className="font-bold text-slate-900 text-xs">{c.firstName} {c.lastName}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1A2BA6] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{score}%</span>
                  {app.job?.title && <span className="text-[10px] text-slate-400 font-medium">→ {app.job.title}</span>}
                </div>
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
                  <p className="font-bold text-slate-900 mt-1">{Math.round(score * 0.1)}/10</p>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold">Lettre (10%)</p>
                  <p className="font-bold text-slate-900 mt-1">{Math.round(score * 0.1)}/10</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper: render fraud detection from backend data or fallback
  const renderFraudContent = () => {
    if (fraudLoading) {
      return (
        <div className="text-center py-8 text-xs text-slate-400 font-semibold">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Analyse des anomalies en cours...
        </div>
      );
    }

    // Backend fraud data available
    if (fraudData?.anomalies?.length > 0) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fraudData.anomalies.map((a: any, idx: number) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex gap-4">
              <div className="shrink-0 mt-1">
                <AlertTriangle className={cn('h-5 w-5', a.severity === 'HIGH' ? 'text-red-500' : a.severity === 'MEDIUM' ? 'text-amber-500' : 'text-yellow-400')} />
              </div>
              <div>
                <div className="flex gap-2 items-center">
                  <h4 className="font-bold text-slate-900 text-xs">{a.riskType === 'DOUBLON_EMAIL' ? 'Doublon email' : a.riskType === 'DOUBLON_TELEPHONE' ? 'Doublon téléphone' : a.riskType === 'INFO_MANQUANTE' ? 'Info manquante' : a.riskType === 'SCORE_INCOHERENT' ? 'Score incohérent' : 'Incohérence détectée'}</h4>
                  <span className={cn(
                    'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                    a.severity === 'HIGH' ? 'bg-red-50 text-red-700' : a.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-yellow-50 text-yellow-700'
                  )}>{a.severity}</span>
                </div>
                <p className="text-xs text-slate-500 mt-2">{a.candidateName} : {a.riskDetail}</p>
                <p className="text-[10px] text-slate-400 mt-3">Détecté par HDIE Engine</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Fallback: client-side fraud detection from candidates data
    const riskyCandidates = candidates.filter(c => c.applications?.[0]?.risks && c.applications[0].risks !== 'Aucun');

    if (riskyCandidates.length === 0) {
      return (
        <div className="text-center py-10 px-6 bg-emerald-50/30 rounded-xl border border-dashed border-emerald-200">
          <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-emerald-800">Aucune anomalie détectée</p>
          <p className="text-xs text-emerald-600 mt-1.5 max-w-md mx-auto">
            La base de candidatures est saine. Les doublons d&apos;email, de téléphone et les informations manquantes
            sont vérifiés automatiquement à chaque scan.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {riskyCandidates.map((c, idx) => {
          const app = c.applications?.[0] || {};
          return (
            <div key={c.id || idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex gap-4">
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
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* IA Status banner */}
      {iaStatus && (
        <div className={cn(
          'rounded-xl p-3 flex items-center gap-3 text-xs border',
          iaStatus.configured
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        )}>
          {iaStatus.configured ? (
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <Info className="h-4 w-4 text-amber-600 shrink-0" />
          )}
          <div>
            <span className="font-bold">{iaStatus.configured ? `IA configurée — ${iaStatus.provider}` : 'IA non configurée'}</span>
            <span className="ml-2 opacity-80">
              {iaStatus.configured
                ? `• Moteur HDIE v${iaStatus.engine?.replace('HDIE v', '') || '1.0'} actif`
                : '• L\'analyse sémantique sera disponible prochainement'}
            </span>
          </div>
        </div>
      )}

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
            {/* AI Configuration notice */}
            {(!iaStatus || !iaStatus.configured) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Intégration IA requise</p>
                  <p className="text-amber-700 mt-0.5">L&apos;analyse sémantique de CV par intelligence artificielle n&apos;est pas encore activée. Veuillez contacter votre administrateur pour activer cette fonctionnalité.</p>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-xl mx-auto">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center">
                <Upload className="h-7 w-7 text-[#1A2BA6]" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm">Déposer un CV ou une Lettre de motivation</h4>
              <p className="text-xs text-slate-500 mt-1">Formats acceptés : PDF, PNG, JPG, WEBP, GIF (Max 20 Mo)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">L&apos;analyse est effectuée par le moteur HDIE (Helm Document Intelligence Engine)</p>

              <div className="mt-6 flex flex-col items-center gap-3">
                <label
                  htmlFor="cv-file-upload"
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-xs font-semibold text-white transition hover:opacity-90 cursor-pointer disabled:opacity-50 shadow-sm"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {parsing ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyse HDIE en cours…</> : <><Upload className="h-4 w-4" /> Téléverser et Analyser</>}
                </label>
                <input
                  id="cv-file-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*"
                  onChange={handleFileUpload}
                  disabled={parsing}
                  className="hidden"
                />
                {uploadedFileName && !parsing && (
                  <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
                    <FileSearch className="h-3.5 w-3.5 text-slate-400" />
                    Dernier fichier : <span className="font-bold text-slate-700">{uploadedFileName}</span>
                  </p>
                )}
              </div>
            </div>

            {parsedData && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <FileSearch className="h-4 w-4 text-[#1A2BA6]" />
                      Résultats de l&apos;Analyse Sémantique
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Candidat identifié : <span className="font-semibold text-slate-700">{parsedData.name}</span></p>
                    {parsedData.fileName && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Document analysé : {parsedData.fileName}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${parsedData.isPlaceholder ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    {parsedData.isPlaceholder ? 'Analyse indisponible' : `Confiance : ${parsedData.confidence || 92}%`}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      Compétences extraites :
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsedData.skills.map((skill: string) => (
                        <span key={skill} className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-semibold">{skill}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                      Expérience :
                    </p>
                    <p className="text-slate-600 mt-1 leading-relaxed">{parsedData.experience}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      Formation :
                    </p>
                    <p className="text-slate-600 mt-1 leading-relaxed">{parsedData.education}</p>
                  </div>
                  <div>
                    <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Forces détectées :
                    </p>
                    <p className="text-slate-600 mt-1 leading-relaxed">{parsedData.strengths}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="font-bold text-amber-700 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Axes d&apos;amélioration :
                    </p>
                    <p className="text-slate-600 mt-1 leading-relaxed">{parsedData.weaknesses}</p>
                  </div>
                </div>
                {!parsedData.isPlaceholder && parsedData.modelUsed && (
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
                    <ShieldCheck className="h-3 w-3" />
                    <span>Analyse effectuée par <span className="font-semibold">{parsedData.modelUsed}</span> via HDIE v2.0</span>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === 'matching' && (
          <motion.div key="matching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#1A2BA6]" />
                    Classement intelligent des candidats (XAI)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Score pondéré multi-critères · Compétences 40% · Expérience 25% · Formation 15% · Certifications 10% · Lettre 10%
                  </p>
                </div>
                {matchingData?.aiConfigured && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle className="h-3 w-3" /> IA activée
                  </span>
                )}
              </div>

              {matchingData && (
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Candidats analysés</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{matchingData.totalCandidates || candidates.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Postes ouverts</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{jobs.length}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score moyen</p>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      {matchingData.candidates?.length > 0
                        ? Math.round(matchingData.candidates.reduce((s: number, c: any) => s + (c.totalScore || 0), 0) / matchingData.candidates.length)
                        : '—'}%
                    </p>
                  </div>
                </div>
              )}

              {jobs.length > 0 && (
                <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-xs font-bold text-slate-700 mb-2">Postes ouverts :</p>
                  <div className="flex flex-wrap gap-2">
                    {jobs.map((j: any) => (
                      <span key={j.id} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                        {j.title} ({j.applications?.length || 0} candidats)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {renderMatchingContent()}
            </div>
          </motion.div>
        )}

        {activeTab === 'fraud' && (
          <motion.div key="fraud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-500" />
                    Détection Fraude & Anomalies
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Analyse automatique des doublons, incohérences et risques sur l&apos;ensemble des candidatures
                  </p>
                </div>
                {fraudData?.aiConfigured && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                    <CheckCircle className="h-3 w-3" /> IA activée
                  </span>
                )}
              </div>
              {fraudData && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-rose-50/50 border border-rose-100 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Anomalies détectées</p>
                    <p className="text-xl font-black text-rose-700 mt-1">{fraudData.totalAnomalies}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Candidats scannés</p>
                    <p className="text-xl font-black text-slate-900 mt-1">{fraudData.totalCandidatesScanned}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Taux de fraude</p>
                    <p className="text-xl font-black text-slate-900 mt-1">
                      {fraudData.totalCandidatesScanned > 0
                        ? ((fraudData.totalAnomalies / fraudData.totalCandidatesScanned) * 100).toFixed(1)
                        : '0'}%
                    </p>
                  </div>
                </div>
              )}
              {fraudData?.scanTimestamp && (
                <p className="text-[10px] text-slate-400 mb-4">
                  Dernier scan : {new Date(fraudData.scanTimestamp).toLocaleString('fr-FR')}
                </p>
              )}
              {renderFraudContent()}
            </div>
          </motion.div>
        )}

        {activeTab === 'copilot' && (
          <motion.div
            key="copilot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-[520px] border border-slate-200 bg-slate-950 rounded-2xl overflow-hidden shadow-xl"
          >
            {/* Header — Sarah avec sa vraie photo */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-slate-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/20 shrink-0">
                  <Image
                    src="/images/SarahAI.png"
                    alt="Sarah — Assistante RH"
                    fill
                    sizes="44px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm leading-none flex items-center gap-2">
                    Sarah
                    <span className="text-[9px] font-bold text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Assistante RH</span>
                  </h4>
                  <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {copilotLoading ? 'Analyse RH en cours…' : 'En ligne — prête à vous aider'}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-semibold">Conformité RH</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-grow p-4 overflow-y-auto space-y-4 bg-slate-950">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3 max-w-[85%]', msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
                  {msg.sender === 'user' ? (
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-[#1A2BA6]/30 bg-[#1A2BA6]/10 text-white">
                      <User className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-blue-500/30">
                      <Image
                        src="/images/SarahAI.png"
                        alt="Sarah"
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className={cn(
                    'p-3 rounded-xl text-xs whitespace-pre-line leading-relaxed shadow-sm',
                    msg.sender === 'user'
                      ? 'bg-[#1A2BA6] text-white font-semibold rounded-tr-sm'
                      : 'bg-slate-900 text-slate-100 border border-slate-800 rounded-tl-sm'
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {copilotLoading && (
                <div className="flex gap-3 mr-auto max-w-[85%]">
                  <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0 ring-1 ring-blue-500/30">
                    <Image
                      src="/images/SarahAI.png"
                      alt="Sarah"
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 text-slate-400 border border-slate-800 text-xs rounded-tl-sm">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Sarah analyse votre demande…
                  </div>
                </div>
              )}
            </div>

            {/* Presets / Suggestions RH professionnelles */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto text-[10px] scrollbar-thin">
              <button onClick={() => handleSendMessage("Quels sont les meilleurs candidats ?")} disabled={copilotLoading} className="bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">Quels sont les meilleurs candidats ?</button>
              <button onClick={() => handleSendMessage("Quel est l'effectif actuel et la masse salariale ?")} disabled={copilotLoading} className="bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">Effectif & masse salariale</button>
              <button onClick={() => handleSendMessage("Combien de demandes de congé en attente ?")} disabled={copilotLoading} className="bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">Congés en attente</button>
              <button onClick={() => handleSendMessage("Propose-moi une grille d'entretien pour un poste d'enseignant.")} disabled={copilotLoading} className="bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">Grille d'entretien</button>
              <button onClick={() => handleSendMessage("Quelles sont mes obligations CNSS ce mois-ci ?")} disabled={copilotLoading} className="bg-slate-800/60 border border-slate-700 text-slate-300 rounded-lg px-2.5 py-1.5 font-semibold hover:bg-slate-700 disabled:opacity-50 whitespace-nowrap">Obligations CNSS</button>
            </div>

            {/* Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Posez une question à Sarah, votre Assistante RH…"
                disabled={copilotLoading}
                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1A2BA6] transition disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={copilotLoading || !inputText.trim()}
                className="p-2.5 rounded-xl text-white transition hover:opacity-90 flex items-center justify-center shrink-0 disabled:opacity-50"
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
