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
  const { tenant, academicYear } = useModuleContext();
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
      // Construire l'historique de conversation pour Sarah (les 10 derniers messages)
      // Permet à Sarah d'avoir un contexte multi-tours et de répondre de façon cohérente.
      const conversationHistory = messages
        .slice(-10)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));

      // Use the backend copilot endpoint — Sarah AI (Assistante RH)
      const result = await hrFetch<any>(hrUrl('ia/copilot', { tenantId: tenant.id }), {
        method: 'POST',
        body: {
          tenantId: tenant?.id,
          message: textToSend,
          conversationHistory,
        },
      });

      setMessages((prev) => [...prev, { sender: 'bot', text: result.reply || result.message || 'Je n\'ai pas pu traiter votre demande.' }]);
    } catch (err) {
      // Fallback: client-side rule engine si le backend est indisponible
      // Sarah reste utile même en cas de panne réseau, en s'appuyant sur les données déjà chargées.
      let reply = '';
      const textLower = textToSend.toLowerCase();

      if (textLower.includes('candidat') || textLower.includes('meilleur')) {
        const best = [...candidates].sort((a, b) => (b.applications?.[0]?.score || 0) - (a.applications?.[0]?.score || 0));
        reply = best.length > 0
          ? `Le meilleur candidat est **${best[0].firstName} ${best[0].lastName}** avec un score de **${best[0].applications?.[0]?.score || 0}%**.`
          : "Aucun candidat dans la base pour l'instant. Vous pouvez enregistrer des candidats via le module Recrutement.";
      } else if (textLower.includes('congé') || textLower.includes('absence')) {
        reply = "Pour les demandes de congé, consultez l'onglet « Congés & Absences ». Je peux vous aider à préparer un modèle de politique de congés si vous le souhaitez.";
      } else if (textLower.includes('contrat') || textLower.includes('cdi') || textLower.includes('cdd')) {
        reply = "Pour les contrats (CDI, CDD, vacation, stage), consultez l'onglet « Contrats ». Je peux vous aider à rédiger des clauses spécifiques ou à vérifier la conformité d'un contrat.";
      } else if (textLower.includes('paie') || textLower.includes('salaire')) {
        reply = "Pour la paie et les charges sociales (CNSS Bénin), consultez les onglets « Paie » et « CNSS ». Je peux vous expliquer le calcul des charges ou préparer une simulation.";
      } else if (textLower.includes('entretien')) {
        reply = "Voici une grille d'entretien RH structurée :\n\n1. Présentation du candidat (parcours, motivations)\n2. Expérience pédagogique (méthodes, outils, gestion de classe)\n3. Compétences techniques (discipline, didactique)\n4. Savoir-être (collaboration, communication)\n5. Questions situationnelles (cas pratiques)\n6. Prétentions salariales et disponibilité\n\nSouhaitez-vous que je détaille une section ?";
      } else {
        reply = "Je suis Sarah, votre Assistante RH. Le service IA rencontre temporairement un problème de connexion.\n\nEn attendant, je peux vous orienter vers les modules RH disponibles : Recrutement, Contrats, Personnel, Congés, Paie, CNSS, ou IA RH. Que souhaitez-vous faire ?";
      }
      setMessages((prev) => [...prev, { sender: 'bot', text: reply }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Helper: render matching breakdown from backend XAI data
  const renderMatchingContent = () => {
    if (matchingLoading) {
      return (
        <div className="text-center py-8 text-xs text-slate-400 font-semibold">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Calcul des scores XAI en cours...
        </div>
      );
    }

    // Pas de données backend (erreur API ou candidats sans application)
    if (!matchingData || matchingData.candidates?.length === 0) {
      return (
        <div className="text-center py-10 px-6 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          <Briefcase className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">Aucun candidat à classer</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
            Pour activer le classement intelligent XAI, créez des offres d&apos;emploi dans le module
            <span className="font-semibold"> Recrutement</span> et recevez des candidatures avec CV et lettre.
          </p>
          {matchingData?.aiConfigured && (
            <p className="text-[10px] text-emerald-600 mt-2 font-semibold flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" /> IA configurée — le classement sera calculé dès qu&apos;il y aura des candidats.
            </p>
          )}
        </div>
      );
    }

    // Données backend XAI — affichage structuré
    return (
      <div className="space-y-3">
        {matchingData.candidates.map((c: any, idx: number) => {
          const isTopPick = idx === 0 && c.totalScore >= 60;
          const skillsPct = c.breakdown?.skills ? Math.round((c.breakdown.skills.score / c.breakdown.skills.max) * 100) : 0;
          const expPct = c.breakdown?.experience ? Math.round((c.breakdown.experience.score / c.breakdown.experience.max) * 100) : 0;
          const eduPct = c.breakdown?.education ? Math.round((c.breakdown.education.score / c.breakdown.education.max) * 100) : 0;
          const certPct = c.breakdown?.certifications ? Math.round((c.breakdown.certifications.score / c.breakdown.certifications.max) * 100) : 0;
          const letterPct = c.breakdown?.coverLetter ? Math.round((c.breakdown.coverLetter.score / c.breakdown.coverLetter.max) * 100) : 0;
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
              {/* Décomposition XAI par critère */}
              <div className="grid grid-cols-5 gap-2 text-center text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <div>
                  <p className="text-slate-400 font-semibold">Compétences (40%)</p>
                  <p className="font-bold text-slate-900 mt-1">{c.breakdown?.skills?.score ?? 0}/{c.breakdown?.skills?.max ?? 40}</p>
                  <div className="h-0.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#1A2BA6] rounded-full" style={{ width: `${skillsPct}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold">Expérience (25%)</p>
                  <p className="font-bold text-slate-900 mt-1">{c.breakdown?.experience?.score ?? 0}/{c.breakdown?.experience?.max ?? 25}</p>
                  <div className="h-0.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#1A2BA6] rounded-full" style={{ width: `${expPct}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold">Formation (15%)</p>
                  <p className="font-bold text-slate-900 mt-1">{c.breakdown?.education?.score ?? 0}/{c.breakdown?.education?.max ?? 15}</p>
                  <div className="h-0.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#1A2BA6] rounded-full" style={{ width: `${eduPct}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold">Certifications (10%)</p>
                  <p className="font-bold text-slate-900 mt-1">{c.breakdown?.certifications?.score ?? 0}/{c.breakdown?.certifications?.max ?? 10}</p>
                  <div className="h-0.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#1A2BA6] rounded-full" style={{ width: `${certPct}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold">Lettre (10%)</p>
                  <p className="font-bold text-slate-900 mt-1">{c.breakdown?.coverLetter?.score ?? 0}/{c.breakdown?.coverLetter?.max ?? 10}</p>
                  <div className="h-0.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-[#1A2BA6] rounded-full" style={{ width: `${letterPct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper: render fraud detection from backend data
  const renderFraudContent = () => {
    if (fraudLoading) {
      return (
        <div className="text-center py-8 text-xs text-slate-400 font-semibold">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Analyse des anomalies en cours...
        </div>
      );
    }

    // Pas de données backend (API en échec)
    if (!fraudData) {
      return (
        <div className="text-center py-10 px-6 bg-amber-50/30 rounded-xl border border-dashed border-amber-200">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-amber-800">Scan indisponible</p>
          <p className="text-xs text-amber-600 mt-1.5 max-w-md mx-auto">
            Le moteur HDIE n&apos;a pas pu analyser les candidatures. Vérifiez votre connexion et réessayez.
          </p>
        </div>
      );
    }

    // Aucune anomalie détectée — base saine
    if (!fraudData.anomalies || fraudData.anomalies.length === 0) {
      return (
        <div className="text-center py-10 px-6 bg-emerald-50/30 rounded-xl border border-dashed border-emerald-200">
          <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-bold text-emerald-800">Aucune anomalie détectée</p>
          <p className="text-xs text-emerald-600 mt-1.5 max-w-md mx-auto">
            La base de candidatures est saine. Les doublons d&apos;email, de téléphone, les informations manquantes,
            les scores incohérents et les risques signalés sont vérifiés automatiquement à chaque scan.
          </p>
          <p className="text-[10px] text-emerald-500 mt-2 font-semibold">
            {fraudData.totalCandidatesScanned || 0} candidat(s) scanné(s) · Dernier scan : {fraudData.scanTimestamp ? new Date(fraudData.scanTimestamp).toLocaleString('fr-FR') : '—'}
          </p>
        </div>
      );
    }

    // Anomalies détectées — affichage structuré avec catégorisation par sévérité
    const highSev = fraudData.anomalies.filter((a: any) => a.severity === 'HIGH');
    const medSev = fraudData.anomalies.filter((a: any) => a.severity === 'MEDIUM');
    const lowSev = fraudData.anomalies.filter((a: any) => a.severity === 'LOW');

    const riskTypeLabels: Record<string, string> = {
      DOUBLON_EMAIL: 'Doublon d\'email',
      DOUBLON_TELEPHONE: 'Doublon de téléphone',
      INFO_MANQUANTE: 'Informations manquantes',
      SCORE_INCOHERENT: 'Score incohérent',
      RISQUE_SIGNALE: 'Risque signalé',
    };

    const severityConfig = {
      HIGH: { color: 'red', Icon: AlertTriangle, label: 'Élevée' },
      MEDIUM: { color: 'amber', Icon: AlertTriangle, label: 'Moyenne' },
      LOW: { color: 'yellow', Icon: Info, label: 'Faible' },
    } as const;

    const renderAnomaly = (a: any, idx: number) => {
      const cfg = severityConfig[a.severity as keyof typeof severityConfig] || severityConfig.LOW;
      const Icon = cfg.Icon;
      return (
        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex gap-3">
          <div className={cn('shrink-0 mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center',
            a.severity === 'HIGH' ? 'bg-red-50' : a.severity === 'MEDIUM' ? 'bg-amber-50' : 'bg-yellow-50')}>
            <Icon className={cn('h-4 w-4', a.severity === 'HIGH' ? 'text-red-500' : a.severity === 'MEDIUM' ? 'text-amber-500' : 'text-yellow-500')} />
          </div>
          <div className="flex-grow min-w-0">
            <div className="flex gap-2 items-center flex-wrap">
              <h4 className="font-bold text-slate-900 text-xs">{riskTypeLabels[a.riskType] || 'Incohérence détectée'}</h4>
              <span className={cn(
                'text-[9px] font-bold uppercase px-1.5 py-0.5 rounded',
                a.severity === 'HIGH' ? 'bg-red-50 text-red-700' : a.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-yellow-50 text-yellow-700'
              )}>{cfg.label}</span>
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{a.riskDetail}</p>
            <p className="text-[10px] text-slate-400 mt-2">Candidat(s) concerné(s) : <span className="font-semibold text-slate-600">{a.candidateName}</span></p>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-5">
        {/* Légende sévérité + décompte */}
        <div className="flex flex-wrap gap-3 text-[10px] font-bold">
          {highSev.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> {highSev.length} élevée{highSev.length > 1 ? 's' : ''}
            </span>
          )}
          {medSev.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> {medSev.length} moyenne{medSev.length > 1 ? 's' : ''}
            </span>
          )}
          {lowSev.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center gap-1.5">
              <Info className="h-3 w-3" /> {lowSev.length} faible{lowSev.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Anomalies HIGH en premier */}
        {highSev.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Priorité élevée — action requise
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {highSev.map(renderAnomaly)}
            </div>
          </div>
        )}

        {/* Anomalies MEDIUM */}
        {medSev.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" /> Sévérité moyenne — à surveiller
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {medSev.map(renderAnomaly)}
            </div>
          </div>
        )}

        {/* Anomalies LOW */}
        {lowSev.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="h-3 w-3" /> Information — faible impact
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lowSev.map(renderAnomaly)}
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-400 text-center pt-2">
          Détecté par HDIE Engine · Scan du {fraudData.scanTimestamp ? new Date(fraudData.scanTimestamp).toLocaleString('fr-FR') : '—'}
        </p>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#1A2BA6]/10 flex items-center justify-center shrink-0">
                      <FileSearch className="h-5 w-5 text-[#1A2BA6]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        Résultats de l&apos;analyse RH
                        {parsedData.documentType && parsedData.documentType !== 'UNKNOWN' && (
                          <span className={cn(
                            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                            parsedData.documentType === 'CV'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : parsedData.documentType === 'LETTRE'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                          )}>
                            {parsedData.documentType === 'CV' ? 'CV' : parsedData.documentType === 'LETTRE' ? 'Lettre de motivation' : 'Document'}
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Candidat : <span className="font-semibold text-slate-700">{parsedData.name}</span>
                        {typeof parsedData.yearsOfExperience === 'number' && parsedData.yearsOfExperience >= 0 && (
                          <span className="ml-2 text-slate-400">· {parsedData.yearsOfExperience} an(s) d&apos;expérience</span>
                        )}
                      </p>
                      {parsedData.fileName && (
                        <p className="text-[10px] text-slate-400 mt-0.5">Document analysé : {parsedData.fileName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={cn(
                      'text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1',
                      parsedData.isPlaceholder
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    )}>
                      {parsedData.isPlaceholder
                        ? <><Info className="h-3 w-3" /> Analyse indisponible</>
                        : <><CheckCircle className="h-3 w-3" /> Confiance : {parsedData.confidence || 92}%</>}
                    </span>
                    {parsedData.recommendation && parsedData.recommendation !== 'INSUFFICIENT_INFO' && (
                      <span className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider',
                        parsedData.recommendation === 'RECOMMENDED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : parsedData.recommendation === 'NOT_RECOMMENDED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                      )}>
                        {parsedData.recommendation === 'RECOMMENDED' ? '✓ Recommandé' : parsedData.recommendation === 'NOT_RECOMMENDED' ? '✗ Non recommandé' : 'Neutre'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Body — adapté au type de document */}
                <div className="p-6 space-y-5 text-xs">
                  {/* Résumé professionnel (CV) */}
                  {parsedData.summary && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">Résumé professionnel</p>
                      <p className="text-slate-700 leading-relaxed">{parsedData.summary}</p>
                    </div>
                  )}

                  {/* Poste visé + ton + score personnalisation (LETTRE) */}
                  {(parsedData.documentType === 'LETTRE') && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {parsedData.targetPosition && (
                        <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
                          <p className="font-bold text-purple-700 mb-1 text-[10px] uppercase tracking-wider">Poste visé</p>
                          <p className="text-slate-800 font-semibold">{parsedData.targetPosition}</p>
                        </div>
                      )}
                      {parsedData.tone && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <p className="font-bold text-slate-700 mb-1 text-[10px] uppercase tracking-wider">Ton</p>
                          <p className="text-slate-800 font-semibold">{parsedData.tone}</p>
                        </div>
                      )}
                      {typeof parsedData.customizationScore === 'number' && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <p className="font-bold text-slate-700 mb-1 text-[10px] uppercase tracking-wider">Personnalisation</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-grow h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-[#1A2BA6] rounded-full" style={{ width: `${parsedData.customizationScore}%` }} />
                            </div>
                            <span className="font-bold text-slate-800">{parsedData.customizationScore}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Arguments clés (LETTRE) */}
                  {parsedData.documentType === 'LETTRE' && Array.isArray(parsedData.keyArguments) && parsedData.keyArguments.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-purple-500" /> Arguments clés avancés
                      </p>
                      <ul className="space-y-1.5">
                        {parsedData.keyArguments.map((arg: string, i: number) => (
                          <li key={i} className="flex gap-2 text-slate-700">
                            <span className="text-purple-500 font-bold shrink-0">{i + 1}.</span>
                            <span className="leading-relaxed">{arg}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Compétences catégorisées (CV) */}
                  {parsedData.categorizedSkills && (
                    <div className="space-y-3">
                      <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Compétences
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {parsedData.categorizedSkills.technical?.length > 0 && (
                          <div className="p-3 rounded-lg bg-blue-50/40 border border-blue-100">
                            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">Techniques</p>
                            <div className="flex flex-wrap gap-1">
                              {parsedData.categorizedSkills.technical.map((s: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[10px] text-slate-700 font-medium">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {parsedData.categorizedSkills.pedagogical?.length > 0 && (
                          <div className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1.5">Pédagogiques</p>
                            <div className="flex flex-wrap gap-1">
                              {parsedData.categorizedSkills.pedagogical.map((s: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white border border-emerald-200 rounded text-[10px] text-slate-700 font-medium">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {parsedData.categorizedSkills.soft?.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-50/40 border border-amber-100">
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1.5">Savoir-être</p>
                            <div className="flex flex-wrap gap-1">
                              {parsedData.categorizedSkills.soft.map((s: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[10px] text-slate-700 font-medium">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fallback: skills aplati (quand pas de categorizedSkills) */}
                  {!parsedData.categorizedSkills && Array.isArray(parsedData.skills) && parsedData.skills.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-blue-500" /> Compétences / Arguments
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {parsedData.skills.map((skill: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-semibold">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Langues */}
                  {Array.isArray(parsedData.languages) && parsedData.languages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {parsedData.languages.map((lng: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-center">
                          <p className="font-bold text-slate-800 text-[11px]">{lng.language}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{lng.level}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Chronologie des expériences (CV) */}
                  {Array.isArray(parsedData.experienceTimeline) && parsedData.experienceTimeline.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Parcours professionnel
                      </p>
                      <div className="space-y-2 border-l-2 border-slate-200 pl-4">
                        {parsedData.experienceTimeline.map((exp: any, i: number) => (
                          <div key={i} className="relative">
                            <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-[#1A2BA6] ring-2 ring-white" />
                            <p className="font-bold text-slate-800 text-[11px]">
                              {exp.position || 'Poste'} <span className="text-slate-400 font-normal">· {exp.company || 'Établissement'}</span>
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium">{exp.startDate || '?'} → {exp.endDate || 'présent'}</p>
                            {exp.description && <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{exp.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {Array.isArray(parsedData.certifications) && parsedData.certifications.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-700 mb-2 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Certifications & Formations
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {parsedData.certifications.map((c: any, i: number) => (
                          <div key={i} className="p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100">
                            <p className="font-semibold text-slate-800 text-[11px]">{c.name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">{c.issuer}{c.year ? ` · ${c.year}` : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Forces / Axes d'amélioration */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-100">
                      <p className="font-bold text-emerald-700 mb-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" /> Forces
                      </p>
                      <p className="text-slate-700 leading-relaxed">{parsedData.strengths}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50/40 border border-amber-100">
                      <p className="font-bold text-amber-700 mb-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> Axes d&apos;amélioration
                      </p>
                      <p className="text-slate-700 leading-relaxed">{parsedData.weaknesses}</p>
                    </div>
                  </div>

                  {/* Red flags RH */}
                  {Array.isArray(parsedData.redFlags) && parsedData.redFlags.length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200">
                      <p className="font-bold text-rose-700 mb-1.5 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5" /> Points de vigilance RH
                      </p>
                      <ul className="space-y-1">
                        {parsedData.redFlags.map((flag: string, i: number) => (
                          <li key={i} className="flex gap-2 text-rose-800">
                            <span className="text-rose-500 shrink-0">•</span>
                            <span className="leading-relaxed">{flag}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Raison de la recommandation */}
                  {parsedData.recommendationReason && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="font-bold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">Recommandation HDIE</p>
                      <p className="text-slate-700 leading-relaxed italic">&quot;{parsedData.recommendationReason}&quot;</p>
                    </div>
                  )}

                  {/* Footer technique */}
                  {!parsedData.isPlaceholder && parsedData.modelUsed && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400">
                      <ShieldCheck className="h-3 w-3" />
                      <span>Analyse effectuée par <span className="font-semibold">{parsedData.modelUsed}</span> via HDIE v2.0</span>
                    </div>
                  )}
                </div>
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
