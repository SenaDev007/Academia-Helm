'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { saraApi } from '@/lib/api/sara';
import { useAuth } from '@/hooks/useAuth';
import {
  loadChatMessages,
  saveChatMessages,
  clearChatMessages,
  type SaraWidgetMessage,
} from '@/lib/sara/chat-storage';

/**
 * ============================================================================
 * IN-APP SARA GUIDE WIDGET — Academia Helm Navigation Assistant
 * ============================================================================
 *
 * Sarah Guide In-App est l'assistante de navigation et de prise en main de
 * l'application Academia Helm. Elle est GLOBALE (pas multi-tenant strict)
 * et n'accède à AUCUNE donnée de l'école.
 *
 * Sa mission unique : guider l'utilisateur dans l'interface, expliquer les
 * modules, accompagner l'onboarding, et rediriger vers ORION (données) ou
 * ATLAS (actions) quand nécessaire.
 *
 * Design :
 *   - Palette Academia Helm (Royal Blue + Living Gold) — cohérent avec SaraWidget
 *   - Style compact Messenger/WhatsApp (360×540)
 *   - Avatar Sarah à côté de chaque message assistant
 *   - Détection automatique du rôle et du module courant
 *   - Suggestions contextuelles par rôle et module
 *
 * Backend : POST /sara/guide/stream (SSE streaming via saraApi.guideStream)
 * Modèle : GLM 5.2 via NVIDIA
 */

// ─── ACADEMIA HELM BRAND PALETTE ─────────────────────────────────────────
const AH = {
  // Royal Blue (primary)
  navy900: '#0A2A5E',
  navy800: '#0D3B85',
  navy700: '#114FC4',
  navy600: '#1C6FE8',
  // Living Gold (accent)
  gold600: '#CFA63A',
  gold500: '#F2C94C',
  gold400: '#FFE08A',
  // Neutrals
  cloud: '#F7F9FC',
  mist: '#EEF2F8',
  graphite900: '#0F172A',
  graphite700: '#334155',
  graphite500: '#64748B',
  graphite300: '#CBD5E1',
  white: '#FFFFFF',
  // Semantic
  online: '#22C55E',
  onlineGlow: 'rgba(34,197,94,0.4)',
} as const;

// ─── MODULES CATALOG (for context detection + suggestions) ───────────────

interface ModuleInfo {
  label: string;
  icon: string;
  suggestions: string[];
}

// ─── ROLE-BASED ONBOARDING SUGGESTIONS ────────────────────────────────────

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  director: [
    "Comment voir les alertes ORION ?",
    "Où trouver les impayés ?",
    "Comment générer un rapport mensuel ?",
    "Comment configurer l'année scolaire ?",
  ],
  teacher: [
    "Comment saisir les notes ?",
    "Où trouver mon emploi du temps ?",
    "Comment contacter les parents ?",
    "Comment générer des exercices ?",
  ],
  accountant: [
    "Comment enregistrer un paiement ?",
    "Où voir les impayés ?",
    "Comment générer un reçu ?",
    "Où trouver le rapport financier ?",
  ],
  parent: [
    "Comment voir les notes de mon enfant ?",
    "Où trouver les factures ?",
    "Comment payer en ligne ?",
    "Comment contacter l'école ?",
  ],
  secretary: [
    "Comment inscrire un nouvel élève ?",
    "Comment exporter vers Educmaster ?",
    "Comment générer une attestation ?",
    "Comment transférer un élève ?",
  ],
  surveillant: [
    "Comment faire l'appel ?",
    "Comment signaler une absence ?",
    "Comment gérer un incident ?",
  ],
};

// ─── ROLE LABELS ──────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  director: 'Direction',
  SCHOOL_ADMIN: 'Direction',
  SUPER_DIRECTEUR: 'Direction',
  DIRECTEUR: 'Direction',
  teacher: 'Enseignant',
  ENSEIGNANT: 'Enseignant',
  accountant: 'Comptable',
  COMPTABLE: 'Comptable',
  CAISSIER: 'Caissier',
  parent: 'Parent',
  PARENT: 'Parent',
  secretary: 'Secrétariat',
  SCOLARITE: 'Secrétariat',
  SURVEILLANT: 'Surveillance',
  PROMOTEUR: 'Promoteur',
};

function getRoleLabel(role?: string): string {
  if (!role) return 'Utilisateur';
  return ROLE_LABELS[role] || ROLE_LABELS[role.toLowerCase()] || 'Utilisateur';
}

// ─── UI TYPE DETECTION (admin vs teacher vs parent vs promoter) ──────────

/**
 * Détecte le type d'UI à partir du pathname.
 *
 * Academia Helm a 5 UI distinctes avec des modules différents :
 *   - admin    : /app/* (sauf /app/teacher et /app/parent) — direction, comptable, secrétaire, surveillant
 *   - teacher  : /app/teacher/* ou /portal/teacher/* — enseignants
 *   - parent   : /app/parent/* ou /portal/parent/* — parents d'élèves
 *   - promoter : /patronat/* — promoteur multi-campus
 *   - platform : /platform/* — super-admin YEHI OR Tech
 *
 * Sarah Guide adapte son discours et ses suggestions selon l'UI.
 */
type UIType = 'admin' | 'teacher' | 'parent' | 'promoter' | 'platform';

function detectUIFromPath(pathname: string): UIType {
  if (!pathname) return 'admin';
  const lower = pathname.toLowerCase();

  // Platform admin (YEHI OR Tech super-admin)
  if (lower.startsWith('/platform')) return 'platform';
  // Promoter multi-campus
  if (lower.startsWith('/patronat')) return 'promoter';
  // Teacher portal
  if (lower.includes('/teacher') || lower.startsWith('/portal/teacher')) return 'teacher';
  // Parent portal
  if (lower.includes('/parent') || lower.startsWith('/portal/parent')) return 'parent';
  // Default: admin UI (/app/* sans /teacher ni /parent)
  return 'admin';
}

// ─── UI-SPECIFIC MODULE CATALOGS ─────────────────────────────────────────
// Chaque UI a ses propres modules et fonctionnalités.

const UI_LABELS: Record<UIType, string> = {
  admin: 'Administration école',
  teacher: 'Espace enseignant',
  parent: 'Espace parent',
  promoter: 'Multi-campus',
  platform: 'Platform Admin',
};

const UI_MODULE_CATALOGS: Record<UIType, Record<string, ModuleInfo>> = {
  // ─── UI ADMIN (Direction, Comptable, Secrétaire, Surveillant) ────────
  admin: {
    students: {
      label: 'Élèves & Inscriptions',
      icon: '👨‍🎓',
      suggestions: [
        "Comment inscrire un nouvel élève ?",
        "Où exporter vers Educmaster ?",
        "Comment gérer les transferts ?",
        "Comment voir les dossiers incomplets ?",
      ],
    },
    pedagogy: {
      label: 'Pédagogie',
      icon: '📚',
      suggestions: [
        "Comment créer un emploi du temps ?",
        "Où gérer les affectations ?",
        "Comment créer une matière ?",
        "Comment utiliser la bibliothèque pédagogique ?",
      ],
    },
    exams: {
      label: 'Examens & Bulletins',
      icon: '📝',
      suggestions: [
        "Comment configurer les examens ?",
        "Comment publier les bulletins ?",
        "Comment configurer le calcul des moyennes ?",
        "Où voir les statistiques ?",
      ],
    },
    finance: {
      label: 'Finance & Économat',
      icon: '💰',
      suggestions: [
        "Comment voir les impayés ?",
        "Comment configurer les frais de scolarité ?",
        "Où voir le rapport financier ?",
        "Comment lancer une campagne de relance ?",
      ],
    },
    hr: {
      label: 'RH & Paie',
      icon: '👥',
      suggestions: [
        "Comment ajouter un enseignant ?",
        "Comment calculer la paie ?",
        "Où gérer les congés ?",
        "Comment générer une attestation de travail ?",
      ],
    },
    communication: {
      label: 'Communication',
      icon: '📱',
      suggestions: [
        "Comment envoyer un SMS ?",
        "Comment configurer WhatsApp ?",
        "Comment créer une campagne ?",
        "Où voir l'historique ?",
      ],
    },
    qhse: {
      label: 'QHSE & Incidents',
      icon: '🛡️',
      suggestions: [
        "Comment signaler un incident ?",
        "Où voir les traçabilités ?",
        "Comment gérer les contrôles ?",
      ],
    },
    orion: {
      label: 'ORION (IA Analytique)',
      icon: '🧠',
      suggestions: [
        "Comment lire les alertes ORION ?",
        "Où voir les KPIs ?",
        "Comment interpréter les recommandations ?",
        "Quel est mon score ORION ?",
      ],
    },
    atlas: {
      label: 'ATLAS (IA Exécution)',
      icon: '🤖',
      suggestions: [
        "Comment demander un document à ATLAS ?",
        "Comment automatiser une tâche ?",
        "Quelles actions ATLAS peut-il faire ?",
        "Comment déclencher un workflow ?",
      ],
    },
    settings: {
      label: 'Paramètres',
      icon: '⚙️',
      suggestions: [
        "Comment configurer mon école ?",
        "Où gérer les rôles ?",
        "Comment activer les modules ?",
        "Comment configurer la facturation ?",
      ],
    },
    dashboard: {
      label: 'Tableau de bord',
      icon: '🏠',
      suggestions: [
        "Que peux-tu faire pour moi ?",
        "Présente les modules d'Academia Helm",
        "Comment démarrer avec l'application ?",
        "Où trouver l'aide ?",
      ],
    },
  },

  // ─── UI ENSEIGNANT (Portal Teacher) ──────────────────────────────────
  teacher: {
    dashboard: {
      label: 'Mon tableau de bord',
      icon: '🏠',
      suggestions: [
        "Où trouver mon emploi du temps ?",
        "Comment voir mes classes ?",
        "Comment saisir les notes ?",
        "Comment contacter les parents ?",
      ],
    },
    grades: {
      label: 'Notes & Évaluations',
      icon: '📝',
      suggestions: [
        "Comment saisir les notes ?",
        "Comment créer une évaluation ?",
        "Où voir les statistiques de ma classe ?",
        "Comment modifier une note ?",
      ],
    },
    timetable: {
      label: 'Emploi du temps',
      icon: '📅',
      suggestions: [
        "Où voir mon EDT ?",
        "Comment signaler un conflit ?",
        "Comment voir mes salles ?",
      ],
    },
    library: {
      label: 'Bibliothèque pédagogique',
      icon: '📖',
      suggestions: [
        "Comment trouver une ressource ?",
        "Comment partager un exercice ?",
        "Comment créer un exercice ?",
      ],
    },
    communication: {
      label: 'Communication parents',
      icon: '📱',
      suggestions: [
        "Comment contacter un parent ?",
        "Comment envoyer un message à toute la classe ?",
        "Où voir l'historique ?",
      ],
    },
    attendance: {
      label: 'Absences & Présences',
      icon: '✅',
      suggestions: [
        "Comment faire l'appel ?",
        "Comment signaler une absence ?",
        "Où voir l'historique des absences ?",
      ],
    },
    sara_compose: {
      label: 'Sara Compose (IA pédagogique)',
      icon: '✨',
      suggestions: [
        "Comment générer un exercice avec Sara ?",
        "Comment créer une évaluation personnalisée ?",
        "Que peut générer Sara Compose ?",
      ],
    },
  },

  // ─── UI PARENT-ÉLÈVE (Portal Parent) ─────────────────────────────────
  parent: {
    dashboard: {
      label: 'Mon tableau de bord',
      icon: '🏠',
      suggestions: [
        "Comment voir les notes de mon enfant ?",
        "Où trouver les factures ?",
        "Comment payer en ligne ?",
        "Comment contacter l'école ?",
      ],
    },
    grades: {
      label: 'Notes & Bulletins',
      icon: '📝',
      suggestions: [
        "Comment voir les notes de mon enfant ?",
        "Où télécharger le bulletin ?",
        "Comment interpréter les moyennes ?",
      ],
    },
    attendance: {
      label: 'Absences',
      icon: '✅',
      suggestions: [
        "Comment voir les absences de mon enfant ?",
        "Comment justifier une absence ?",
        "Où voir l'historique ?",
      ],
    },
    payments: {
      label: 'Factures & Paiements',
      icon: '💰',
      suggestions: [
        "Comment payer en ligne ?",
        "Quels moyens de paiement sont acceptés ?",
        "Où voir l'historique des paiements ?",
        "Comment télécharger un reçu ?",
      ],
    },
    messages: {
      label: 'Messages école',
      icon: '📱',
      suggestions: [
        "Comment contacter l'école ?",
        "Où voir les messages reçus ?",
        "Comment envoyer un message à l'enseignant ?",
      ],
    },
    calendar: {
      label: 'Calendrier',
      icon: '📅',
      suggestions: [
        "Où voir le calendrier scolaire ?",
        "Comment être notifié des événements ?",
      ],
    },
  },

  // ─── UI PROMOTEUR (Multi-campus) ─────────────────────────────────────
  promoter: {
    dashboard: {
      label: 'Vue multi-campus',
      icon: '🏠',
      suggestions: [
        "Comment voir tous mes établissements ?",
        "Où comparer les performances ?",
        "Comment ajouter une nouvelle école ?",
        "Où voir le billing consolidé ?",
      ],
    },
    schools: {
      label: 'Gestion des écoles',
      icon: '🏫',
      suggestions: [
        "Comment ajouter une école ?",
        "Comment configurer un campus ?",
        "Où voir les stats par école ?",
      ],
    },
    billing: {
      label: 'Billing & Facturation',
      icon: '💰',
      suggestions: [
        "Où voir mes factures ?",
        "Comment changer de plan ?",
        "Comment ajouter un add-on ?",
      ],
    },
    analytics: {
      label: 'Analytics groupe',
      icon: '📊',
      suggestions: [
        "Comment comparer mes écoles ?",
        "Où voir le ROI global ?",
        "Comment exporter un rapport groupe ?",
      ],
    },
    orion: {
      label: 'ORION multi-campus',
      icon: '🧠',
      suggestions: [
        "Comment voir les alertes de toutes mes écoles ?",
        "Où voir les KPIs consolidés ?",
        "Comment identifier les écoles à risque ?",
      ],
    },
  },

  // ─── UI PLATFORM ADMIN (Super-Admin YEHI OR Tech) ────────────────────
  platform: {
    dashboard: {
      label: 'Platform Dashboard',
      icon: '🏠',
      suggestions: [
        "Combien d'écoles sont actives ?",
        "Où voir les métriques globales ?",
        "Comment monitorer le système ?",
      ],
    },
    tenants: {
      label: 'Gestion tenants',
      icon: '🏫',
      suggestions: [
        "Comment créer un nouveau tenant ?",
        "Comment suspendre une école ?",
        "Où voir les tenants inactifs ?",
      ],
    },
    users: {
      label: 'Utilisateurs globaux',
      icon: '👥',
      suggestions: [
        "Comment chercher un utilisateur ?",
        "Comment réinitialiser un compte ?",
        "Où voir les connexions récentes ?",
      ],
    },
    monitoring: {
      label: 'Monitoring système',
      icon: '📊',
      suggestions: [
        "Où voir la santé du système ?",
        "Comment voir les erreurs API ?",
        "Où voir les performances ?",
      ],
    },
    features: {
      label: 'Feature flags',
      icon: '🚩',
      suggestions: [
        "Comment activer une feature pour une école ?",
        "Où voir les flags actifs ?",
        "Comment créer un nouveau flag ?",
      ],
    },
    rbac: {
      label: 'RBAC global',
      icon: '🔐',
      suggestions: [
        "Comment créer un rôle ?",
        "Comment assigner une permission ?",
        "Où voir les rôles par tenant ?",
      ],
    },
  },
};

// ─── PATH → MODULE DETECTION (adapts to current UI) ──────────────────────

function detectModuleFromPath(pathname: string, uiType: UIType = 'admin'): string {
  if (!pathname) return 'dashboard';
  const lower = pathname.toLowerCase();

  // UI-specific detection
  if (uiType === 'teacher') {
    if (lower.includes('/grades') || lower.includes('/notes')) return 'grades';
    if (lower.includes('/timetable') || lower.includes('/edt')) return 'timetable';
    if (lower.includes('/library') || lower.includes('/bibliotheque')) return 'library';
    if (lower.includes('/communication') || lower.includes('/messages')) return 'communication';
    if (lower.includes('/attendance') || lower.includes('/absences') || lower.includes('/appel')) return 'attendance';
    if (lower.includes('/sara-compose') || lower.includes('/compose')) return 'sara_compose';
    return 'dashboard';
  }

  if (uiType === 'parent') {
    if (lower.includes('/grades') || lower.includes('/notes') || lower.includes('/bulletins')) return 'grades';
    if (lower.includes('/attendance') || lower.includes('/absences')) return 'attendance';
    if (lower.includes('/payments') || lower.includes('/paiements') || lower.includes('/factures')) return 'payments';
    if (lower.includes('/messages') || lower.includes('/communication')) return 'messages';
    if (lower.includes('/calendar') || lower.includes('/calendrier')) return 'calendar';
    return 'dashboard';
  }

  if (uiType === 'promoter') {
    if (lower.includes('/schools') || lower.includes('/ecoles')) return 'schools';
    if (lower.includes('/billing') || lower.includes('/facturation')) return 'billing';
    if (lower.includes('/analytics') || lower.includes('/statistiques')) return 'analytics';
    if (lower.includes('/orion')) return 'orion';
    return 'dashboard';
  }

  if (uiType === 'platform') {
    if (lower.includes('/tenants') || lower.includes('/schools')) return 'tenants';
    if (lower.includes('/users') || lower.includes('/utilisateurs')) return 'users';
    if (lower.includes('/monitoring')) return 'monitoring';
    if (lower.includes('/features') || lower.includes('/flags')) return 'features';
    if (lower.includes('/rbac') || lower.includes('/roles')) return 'rbac';
    return 'dashboard';
  }

  // Default: admin UI
  if (lower.includes('/students')) return 'students';
  if (lower.includes('/pedagogy')) return 'pedagogy';
  if (lower.includes('/exams')) return 'exams';
  if (lower.includes('/finance')) return 'finance';
  if (lower.includes('/hr')) return 'hr';
  if (lower.includes('/communication')) return 'communication';
  if (lower.includes('/qhse')) return 'qhse';
  if (lower.includes('/orion')) return 'orion';
  if (lower.includes('/atlas')) return 'atlas';
  if (lower.includes('/settings')) return 'settings';
  if (lower.includes('/canteen')) return 'canteen';
  if (lower.includes('/transport')) return 'transport';
  if (lower.includes('/infirmary')) return 'infirmary';
  if (lower.includes('/library')) return 'library';
  if (lower.includes('/shop')) return 'shop';
  if (lower.includes('/educast')) return 'educast';
  return 'dashboard';
}

// ─── FULL MARKDOWN RENDERER ──────────────────────────────────────────────

let _mdKey = 0;
const nextKey = () => ++_mdKey;

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <strong key={nextKey()} className="font-bold" style={{ color: AH.navy900 }}>
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      parts.push(
        <em key={nextKey()} className="italic" style={{ color: AH.graphite700 }}>
          {match[4]}
        </em>,
      );
    } else if (match[5]) {
      parts.push(
        <code
          key={nextKey()}
          className="px-1 py-0.5 rounded text-[10.5px] font-mono"
          style={{ background: 'rgba(10,42,94,0.08)', color: AH.navy700 }}
        >
          {match[6]}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

type BlockType = 'paragraph' | 'bullet' | 'numbered';
interface ParsedBlock {
  type: BlockType;
  items: string[];
}

function parseBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];
  let currentBlock: ParsedBlock | null = null;

  const bulletRegex = /^\s*[-*•]\s+(.*)$/;
  const numberedRegex = /^\s*(\d+)[.)]\s+(.*)$/;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const bulletMatch = trimmed.match(bulletRegex);
    const numberedMatch = trimmed.match(numberedRegex);

    if (bulletMatch) {
      if (currentBlock && currentBlock.type !== 'bullet') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) currentBlock = { type: 'bullet', items: [] };
      currentBlock.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (currentBlock && currentBlock.type !== 'numbered') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) currentBlock = { type: 'numbered', items: [] };
      currentBlock.items.push(numberedMatch[2]);
    } else if (trimmed === '') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
    } else {
      if (currentBlock && currentBlock.type !== 'paragraph') {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      if (!currentBlock) {
        currentBlock = { type: 'paragraph', items: [trimmed] };
      } else {
        currentBlock.items[0] += ' ' + trimmed;
      }
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

function renderBlocks(blocks: ParsedBlock[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];

  for (const block of blocks) {
    if (block.type === 'paragraph') {
      elements.push(
        <p key={nextKey()} className="mb-1.5 last:mb-0">
          {renderInline(block.items[0])}
        </p>,
      );
    } else if (block.type === 'bullet') {
      elements.push(
        <ul key={nextKey()} className="mb-1.5 last:mb-0 space-y-0.5">
          {block.items.map((item) => (
            <li key={nextKey()} className="flex items-start gap-1.5">
              <span
                className="mt-[6px] w-1 h-1 rounded-full shrink-0"
                style={{ backgroundColor: AH.gold600 }}
              />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
    } else if (block.type === 'numbered') {
      elements.push(
        <ol key={nextKey()} className="mb-1.5 last:mb-0 space-y-0.5">
          {block.items.map((item, idx) => (
            <li key={nextKey()} className="flex items-start gap-1.5">
              <span
                className="shrink-0 w-4 text-right font-semibold text-[11px]"
                style={{ color: AH.navy700 }}
              >
                {idx + 1}.
              </span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
    }
  }

  return elements;
}

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [text];
  _mdKey = 0;
  const blocks = parseBlocks(text);
  const rendered = renderBlocks(blocks);
  return rendered.length > 0 ? rendered : [text];
}

// ─── COMPONENT ────────────────────────────────────────────────────────────

export default function InAppSaraGuideWidget() {
  const { user } = useAuth();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [streamingText, setStreamingText] = useState('');

  // Version du chat — purge les anciens messages si on change de version
  const SARA_GUIDE_VERSION = 'v2-2025-08';

  // ⭐ Détection automatique du type d'UI (admin, teacher, parent, promoter, platform)
  const uiType = detectUIFromPath(pathname || '');

  // Détection automatique du rôle et du module courant (adapté à l'UI)
  const userRole = user?.role || 'director';
  const currentModule = detectModuleFromPath(pathname || '', uiType);
  const uiCatalog = UI_MODULE_CATALOGS[uiType] || UI_MODULE_CATALOGS.admin;
  const moduleInfo = uiCatalog[currentModule] || uiCatalog.dashboard || UI_MODULE_CATALOGS.admin.dashboard;
  const roleLabel = getRoleLabel(userRole);
  const uiLabel = UI_LABELS[uiType];

  // Construire les suggestions : priorité au module courant, puis au rôle
  const activeSuggestions = [
    ...moduleInfo.suggestions,
    ...(ROLE_SUGGESTIONS[userRole.toLowerCase()] || ROLE_SUGGESTIONS.director),
  ].slice(0, 5);

  // Message d'accueil contextuel — adapté à l'UI
  const welcomeMessage = `Shalom ! Je suis **Sarah**, votre guide dans Academia Helm. 👋

Je vois que vous êtes dans l'**${uiLabel}** — module **${moduleInfo.label}** ${moduleInfo.icon}.
En tant que **${roleLabel}**, je peux vous aider à naviguer, comprendre une fonctionnalité, ou accomplir une tâche étape par étape.
Que souhaitez-vous faire ?`;

  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const storedVersion = localStorage.getItem('sara_guide_version');
      if (storedVersion !== SARA_GUIDE_VERSION) {
        clearChatMessages('sara-guide-inapp');
        localStorage.setItem('sara_guide_version', SARA_GUIDE_VERSION);
      }
    } catch {
      // ignore
    }
    const saved = loadChatMessages<SaraWidgetMessage>('sara-guide-inapp');
    return saved.length > 0 ? saved : [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persistance
  useEffect(() => {
    if (messages.length > 0) {
      saveChatMessages('sara-guide-inapp', messages);
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingText]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // Inject welcome message if empty
  useEffect(() => {
    if (messages.length === 0 && typeof window !== 'undefined') {
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── STREAMING SEND via saraApi.guideStream() ─────────────────────────

  const handleSend = useCallback(
    async (text?: string) => {
      const userMsg = text || input.trim();
      if (!userMsg || isTyping) return;

      setInput('');
      setShowSuggestions(false);
      setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
      setIsTyping(true);
      setStreamingText('');

      let fullText = '';

      try {
        // ⭐ Utilisation de saraApi.guideStream() — le nouvel endpoint Sarah Guide
        // Passe le type d'UI pour que le backend adapte le prompt (admin/teacher/parent/promoter/platform)
        const stream = saraApi.guideStream(userMsg, userRole, currentModule, messages, uiType);

        for await (const chunk of stream) {
          if (chunk.type === 'delta' && chunk.text) {
            fullText += chunk.text;
            setStreamingText(fullText);
          } else if (chunk.type === 'final' && chunk.text) {
            if (!fullText) {
              fullText = chunk.text;
              setStreamingText(fullText);
            }
          } else if (chunk.type === 'error') {
            if (!fullText) {
              fullText =
                "Je suis désolée, je n'ai pas pu traiter votre demande. Pouvez-vous reformuler votre question ? Je suis là pour vous guider dans Academia Helm.";
            }
            break;
          }
        }

        if (fullText) {
          setMessages((prev) => [...prev, { role: 'assistant', content: fullText }]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                "Je suis temporairement indisponible. Pouvez-vous reformuler votre question ? Je reste à votre disposition pour vous guider.",
            },
          ]);
        }
      } catch (error: any) {
        console.error('[InAppSaraGuideWidget] Error:', error?.message);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "Je suis désolée, une erreur de connexion s'est produite. Pouvez-vous réessayer ? Je reste à votre disposition pour vous guider dans Academia Helm.",
          },
        ]);
      } finally {
        setIsTyping(false);
        setStreamingText('');
      }
    },
    [input, isTyping, messages, userRole, currentModule],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    clearChatMessages('sara-guide-inapp');
    setMessages([{ role: 'assistant', content: welcomeMessage }]);
    setShowSuggestions(true);
  };

  // ─── RENDER ──────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-4 right-4 z-[999] font-sans">
      {isOpen ? (
        // ─── OPEN STATE — Compact Branded Chat Panel ──
        <div
          className={cn(
            'w-[360px] h-[540px] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden',
            'animate-in slide-in-from-bottom-3 duration-300',
            'rounded-2xl shadow-2xl',
            'sara-guide-scroll',
          )}
          style={{
            background: AH.white,
            border: `1px solid ${AH.graphite300}`,
            boxShadow: `0 12px 40px rgba(10,42,94,0.18), 0 2px 8px rgba(10,42,94,0.08)`,
          }}
        >
          {/* ─── HEADER — Royal Blue with Gold accent ─────────────────── */}
          <div
            className="relative px-3.5 py-2.5 flex items-center justify-between shrink-0"
            style={{
              background: `linear-gradient(135deg, ${AH.navy900} 0%, ${AH.navy800} 100%)`,
            }}
          >
            {/* Thin gold accent line at top */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, ${AH.gold600}, ${AH.gold500}, ${AH.gold600})`,
              }}
            />

            <div className="flex items-center gap-2.5">
              {/* Photo de Sarah */}
              <div className="relative flex items-center justify-center">
                <div
                  className="relative w-8 h-8 rounded-full overflow-hidden ring-2"
                  style={{ '--tw-ring-color': AH.gold500 } as React.CSSProperties}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={32}
                    height={32}
                    className="object-cover w-full h-full"
                    priority
                  />
                </div>
                {/* Online indicator */}
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    backgroundColor: AH.online,
                    borderColor: AH.navy900,
                    boxShadow: `0 0 4px ${AH.onlineGlow}`,
                  }}
                />
              </div>

              <div className="flex flex-col leading-tight">
                <h4 className="font-semibold text-[13px] text-white flex items-center gap-1.5">
                  Sarah Guide
                  <span
                    className="text-[9px] px-1 py-0.5 rounded-sm font-medium tracking-wider uppercase"
                    style={{ background: AH.gold600, color: AH.navy900 }}
                  >
                    Navigation
                  </span>
                </h4>
                <p className="text-[10px] text-white/70 flex items-center gap-1">
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: AH.online }}
                  />
                  {uiLabel} · {moduleInfo.icon} {moduleInfo.label}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Clear chat button */}
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-md transition-colors text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Nouvelle conversation"
                title="Nouvelle conversation"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-md transition-colors text-white/60 hover:text-white hover:bg-white/10"
                aria-label="Fermer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* ─── MESSAGES ─────────────────────────────────────────────── */}
          <div
            className="relative flex-1 overflow-y-auto px-3 py-3 space-y-2 sara-guide-scroll"
            style={{ background: AH.cloud }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  m.role === 'user' ? 'justify-end' : 'justify-start',
                )}
              >
                {m.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-1.5 mt-0.5 self-end"
                    style={{ border: `1.5px solid ${AH.gold500}` }}
                  >
                    <Image
                      src="/images/SarahAI.webp"
                      alt="Sarah"
                      width={24}
                      height={24}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[78%] px-2.5 py-1.5 rounded-2xl text-[12px] leading-snug',
                    m.role === 'user'
                      ? 'rounded-br-sm text-white'
                      : 'rounded-bl-sm text-graphite-900',
                  )}
                  style={
                    m.role === 'user'
                      ? {
                          background: `linear-gradient(135deg, ${AH.navy700}, ${AH.navy600})`,
                          color: AH.white,
                        }
                      : {
                          background: AH.white,
                          border: `1px solid ${AH.graphite300}`,
                          color: AH.graphite900,
                        }
                  }
                >
                  {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
                </div>
              </div>
            ))}

            {/* Streaming text */}
            {isTyping && streamingText && (
              <div className="flex justify-start">
                <div
                  className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-1.5 mt-0.5 self-end"
                  style={{ border: `1.5px solid ${AH.gold500}` }}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={24}
                    height={24}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div
                  className="max-w-[78%] px-2.5 py-1.5 rounded-2xl rounded-bl-sm text-[12px] leading-snug"
                  style={{
                    background: AH.white,
                    border: `1px solid ${AH.graphite300}`,
                    color: AH.graphite900,
                  }}
                >
                  {renderMarkdown(streamingText)}
                  <span
                    className="inline-block w-[1.5px] h-3 ml-0.5 animate-pulse align-middle"
                    style={{ backgroundColor: AH.navy700 }}
                  />
                </div>
              </div>
            )}

            {/* Typing indicator (3 dots) */}
            {isTyping && !streamingText && (
              <div className="flex justify-start">
                <div
                  className="w-6 h-6 rounded-full overflow-hidden shrink-0 mr-1.5 mt-0.5 self-end"
                  style={{ border: `1.5px solid ${AH.gold500}` }}
                >
                  <Image
                    src="/images/SarahAI.webp"
                    alt="Sarah"
                    width={24}
                    height={24}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div
                  className="px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center"
                  style={{
                    background: AH.white,
                    border: `1px solid ${AH.graphite300}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]"
                    style={{ backgroundColor: AH.navy600 }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]"
                    style={{ backgroundColor: AH.gold600 }}
                  />
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: AH.navy600 }}
                  />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ─── QUICK SUGGESTIONS ────────────────────────────────────── */}
          {showSuggestions && messages.length <= 1 && (
            <div className="px-3 pt-2 pb-1.5 shrink-0" style={{ background: AH.cloud }}>
              <p
                className="text-[9.5px] mb-1.5 font-semibold uppercase tracking-wider"
                style={{ color: AH.graphite500 }}
              >
                Suggestions · {moduleInfo.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {activeSuggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion)}
                    className="text-[10.5px] px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer font-medium"
                    style={{
                      background: AH.white,
                      border: `1px solid ${AH.navy600}40`,
                      color: AH.navy700,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = AH.navy700;
                      e.currentTarget.style.borderColor = AH.navy700;
                      e.currentTarget.style.color = AH.white;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = AH.white;
                      e.currentTarget.style.borderColor = `${AH.navy600}40`;
                      e.currentTarget.style.color = AH.navy700;
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── INPUT ── Compact pill bar ── */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="px-3 py-2.5 shrink-0 border-t"
            style={{
              background: AH.white,
              borderColor: AH.graphite300,
            }}
          >
            <div
              className="flex items-center gap-1.5 rounded-full pl-3 pr-1 py-0.5"
              style={{
                background: AH.cloud,
                border: `1px solid ${AH.graphite300}`,
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Comment puis-je vous aider à naviguer ?"
                className="flex-1 bg-transparent border-none outline-none text-[12px] py-1.5"
                style={{ color: AH.graphite900 }}
                disabled={isTyping}
              />
              <style>{`
                input::placeholder {
                  color: ${AH.graphite500} !important;
                }
              `}</style>

              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: input.trim()
                    ? `linear-gradient(135deg, ${AH.navy700}, ${AH.navy600})`
                    : AH.mist,
                  color: input.trim() ? AH.white : AH.graphite500,
                }}
                aria-label="Envoyer"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Footer branding + redirect notice */}
            <div className="flex items-center justify-center gap-1 mt-1.5">
              <span className="text-[8.5px] tracking-wider font-medium" style={{ color: AH.graphite500 }}>
                Sarah Guide · Navigation uniquement
              </span>
              <span className="text-[8.5px]" style={{ color: AH.gold600 }}>
                ●
              </span>
              <span className="text-[8.5px] tracking-wider font-bold" style={{ color: AH.navy800 }}>
                ACADEMIA HELM
              </span>
            </div>
          </form>
        </div>
      ) : (
        // ─── CLOSED STATE — Floating branded button ──
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center justify-center transition-all duration-300 hover:scale-105 cursor-pointer"
          style={{ width: '56px', height: '56px' }}
          aria-label="Ouvrir le guide Sarah"
        >
          {/* Soft glow background — subtle on mobile */}
          <div
            className="absolute inset-0 rounded-full sara-guide-glow-bg"
            style={{
              background: `radial-gradient(circle, ${AH.navy600}20 0%, ${AH.gold500}10 40%, transparent 65%)`,
              filter: 'blur(4px)',
              animation: 'sarahGuidePulse 3s ease-in-out infinite',
            }}
          />

          {/* Gold ring — thin, low opacity */}
          <div
            className="absolute inset-[-1.5px] rounded-full sara-guide-gold-ring"
            style={{
              background: `conic-gradient(from 0deg, ${AH.gold500}, ${AH.navy600}, ${AH.gold500}, ${AH.navy600}, ${AH.gold500})`,
              animation: 'sarahGuideRingSpin 6s linear infinite',
              opacity: 0.55,
            }}
          />

          {/* Compass icon (navigation theme) */}
          <div
            className="relative w-11 h-11 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${AH.navy800}, ${AH.navy900})`,
              border: `2px solid ${AH.gold500}`,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={AH.gold500}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Compass icon for navigation */}
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>

          {/* Notification badge */}
          <div
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2"
            style={{
              background: AH.gold600,
              borderColor: AH.white,
              color: AH.navy900,
            }}
          >
            ?
          </div>

          {/* Hover tooltip */}
          <div
            className="absolute right-full mr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none px-2.5 py-1.5 rounded-md text-[11px] font-medium"
            style={{
              background: AH.navy900,
              color: AH.white,
              boxShadow: '0 4px 12px rgba(10,42,94,0.25)',
            }}
          >
            Besoin d'aide pour naviguer ?
            <span
              className="absolute left-full top-1/2 -translate-y-1/2 border-4"
              style={{
                borderColor: `transparent transparent transparent ${AH.navy900}`,
              }}
            />
          </div>
        </button>
      )}

      {/* ─── ANIMATIONS ──────────────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes sarahGuidePulse {
          0%,
          100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.04);
          }
        }

        /* Mobile : halo encore plus subtil pour éviter l'effet épais */
        @media (max-width: 768px) {
          .sara-guide-glow-bg {
            filter: blur(2px) !important;
            opacity: 0.6 !important;
          }
          .sara-guide-gold-ring {
            opacity: 0.4 !important;
          }
        }

        @keyframes sarahGuideRingSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        /* Custom scrollbar — minimal, branded */
        .sara-guide-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .sara-guide-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sara-guide-scroll::-webkit-scrollbar-thumb {
          background: ${AH.navy600}40;
          border-radius: 4px;
        }
        .sara-guide-scroll::-webkit-scrollbar-thumb:hover {
          background: ${AH.navy600}80;
        }
      `}</style>
    </div>
  );
}
