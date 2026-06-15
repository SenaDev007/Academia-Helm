/**
 * Loading Messages - Messages Centralisés
 * 
 * Messages professionnels et institutionnels pour tous les états de chargement
 */

export type LoadingStep = 
  | 'INIT_SECURE_CONTEXT'
  | 'VERIFY_ACADEMIC_YEAR'
  | 'LOAD_ROLES_PERMISSIONS'
  | 'CHECK_OFFLINE_STATUS'
  | 'INIT_ORION'
  | 'PRELOAD_UI';

export type LoadingContext = 
  | 'POST_LOGIN'
  | 'MODULE_SWITCH'
  | 'OFFLINE_SYNC'
  | 'ORION_ANALYSIS';

export interface LoadingMessage {
  title: string;
  subtitle?: string;
  duration?: number; // Durée minimale en ms
}

/**
 * Messages pour le flow post-login
 */
export const POST_LOGIN_MESSAGES: Record<LoadingStep, LoadingMessage> = {
  INIT_SECURE_CONTEXT: {
    title: 'Initialisation de votre environnement sécurisé…',
    subtitle: 'Vérification du tenant et du contexte',
    duration: 300,
  },
  VERIFY_ACADEMIC_YEAR: {
    title: 'Vérification de l\'année scolaire active…',
    subtitle: 'Chargement des périodes académiques',
    duration: 200,
  },
  LOAD_ROLES_PERMISSIONS: {
    title: 'Chargement des rôles et permissions…',
    subtitle: 'Application du contrôle d\'accès',
    duration: 200,
  },
  CHECK_OFFLINE_STATUS: {
    title: 'Vérification du mode hors connexion…',
    subtitle: 'Préparation des données locales',
    duration: 300,
  },
  INIT_ORION: {
    title: 'Préparation du tableau de pilotage…',
    subtitle: 'Analyse des indicateurs clés',
    duration: 500,
  },
  PRELOAD_UI: {
    title: 'Finalisation de l\'interface…',
    subtitle: 'Chargement des composants',
    duration: 200,
  },
};

/**
 * Messages contextuels selon l'état
 */
export const CONTEXTUAL_MESSAGES: Record<LoadingContext, LoadingMessage> = {
  POST_LOGIN: {
    title: 'Connexion sécurisée à votre établissement…',
    duration: 300,
  },
  MODULE_SWITCH: {
    title: 'Chargement du module…',
    duration: 200,
  },
  OFFLINE_SYNC: {
    title: 'Synchronisation des données en cours…',
    subtitle: 'Veuillez patienter',
    duration: 500,
  },
  ORION_ANALYSIS: {
    title: 'Analyse des indicateurs clés…',
    subtitle: 'ORION prépare votre tableau de bord',
    duration: 400,
  },
};

/**
 * Messages par module
 */
export const MODULE_MESSAGES: Record<string, LoadingMessage> = {
  finance: {
    title: 'Chargement des données financières…',
    subtitle: 'Préparation des tableaux de bord',
    duration: 300,
  },
  examens: {
    title: 'Préparation des évaluations et résultats…',
    subtitle: 'Chargement des données académiques',
    duration: 300,
  },
  pedagogie: {
    title: 'Chargement de l\'espace pédagogique…',
    subtitle: 'Préparation des contenus',
    duration: 300,
  },
  orion: {
    title: 'Analyse des indicateurs clés…',
    subtitle: 'ORION prépare votre analyse',
    duration: 400,
  },
  eleves: {
    title: 'Chargement des données élèves…',
    subtitle: 'Préparation des dossiers',
    duration: 300,
  },
  paiements: {
    title: 'Chargement des données de paiement…',
    subtitle: 'Préparation des transactions',
    duration: 300,
  },
};

/**
 * Messages d'erreur professionnels
 */
export const ERROR_MESSAGES = {
  TIMEOUT: {
    title: 'Chargement prolongé',
    subtitle: 'Veuillez patienter ou rafraîchir la page',
  },
  NETWORK_ERROR: {
    title: 'Problème de connexion',
    subtitle: 'Vérifiez votre connexion internet',
  },
  AUTH_ERROR: {
    title: 'Erreur d\'authentification',
    subtitle: 'Veuillez vous reconnecter',
  },
  TENANT_ERROR: {
    title: 'Établissement introuvable',
    subtitle: 'Veuillez contacter le support',
  },
  ACADEMIC_YEAR_ERROR: {
    title: 'Aucune année scolaire active',
    subtitle: 'Veuillez configurer une année scolaire',
  },
};

/**
 * Obtient le message pour une étape donnée
 */
export function getLoadingMessage(
  step: LoadingStep,
  context?: LoadingContext
): LoadingMessage {
  if (context && CONTEXTUAL_MESSAGES[context]) {
    return CONTEXTUAL_MESSAGES[context];
  }
  return POST_LOGIN_MESSAGES[step] || POST_LOGIN_MESSAGES.INIT_SECURE_CONTEXT;
}

/**
 * Obtient le message pour un module
 */
export function getModuleMessage(moduleName: string): LoadingMessage {
  const normalized = moduleName.toLowerCase();
  return MODULE_MESSAGES[normalized] || {
    title: 'Chargement du module…',
    duration: 300,
  };
}
