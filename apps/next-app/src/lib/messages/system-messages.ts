/**
 * System Messages - Messages Système Centralisés
 * 
 * Tous les messages de l'application sont centralisés ici
 * Prêt pour l'internationalisation (i18n)
 * 
 * RÈGLES :
 * - Ton neutre, rassurant, professionnel
 * - Aucune phrase technique
 * - Pas de jargon développeur
 * - Messages courts et clairs
 */

export type MessageCategory = 
  | 'AUTH'
  | 'LOGOUT'
  | 'OFFLINE'
  | 'SYNC'
  | 'ERROR'
  | 'LOADING'
  | 'SUCCESS';

export interface SystemMessage {
  id: string;
  category: MessageCategory;
  message: string;
  description?: string;
}

/**
 * Messages d'authentification
 */
export const AUTH_MESSAGES: Record<string, SystemMessage> = {
  LOGIN_IN_PROGRESS: {
    id: 'auth.login.in_progress',
    category: 'AUTH',
    message: 'Connexion sécurisée en cours…',
    description: 'Message affiché pendant la connexion',
  },
  LOGIN_SUCCESS: {
    id: 'auth.login.success',
    category: 'AUTH',
    message: 'Accès autorisé à votre établissement',
    description: 'Message après connexion réussie',
  },
  LOGIN_ERROR: {
    id: 'auth.login.error',
    category: 'AUTH',
    message: 'Accès refusé. Veuillez vérifier vos informations.',
    description: 'Message d\'erreur de connexion',
  },
  SESSION_EXPIRED: {
    id: 'auth.session.expired',
    category: 'AUTH',
    message: 'Votre session a expiré. Veuillez vous reconnecter.',
    description: 'Message lorsque la session expire',
  },
  UNAUTHORIZED: {
    id: 'auth.unauthorized',
    category: 'AUTH',
    message: 'Accès non autorisé à cette ressource.',
    description: 'Message d\'accès refusé',
  },
};

/**
 * Messages de déconnexion
 */
export const LOGOUT_MESSAGES: Record<string, SystemMessage> = {
  CONFIRMATION_TITLE: {
    id: 'logout.confirmation.title',
    category: 'LOGOUT',
    message: 'Souhaitez-vous vous déconnecter de votre espace sécurisé ?',
    description: 'Titre de la confirmation de déconnexion',
  },
  CONFIRMATION_DESCRIPTION: {
    id: 'logout.confirmation.description',
    category: 'LOGOUT',
    message: 'Vos données locales seront conservées et resteront sécurisées.',
    description: 'Description de la confirmation',
  },
  IN_PROGRESS: {
    id: 'logout.in_progress',
    category: 'LOGOUT',
    message: 'Déconnexion sécurisée en cours…',
    description: 'Message pendant la déconnexion',
  },
  SUCCESS: {
    id: 'logout.success',
    category: 'LOGOUT',
    message: 'Vous êtes désormais déconnecté.',
    description: 'Message après déconnexion réussie',
  },
  ERROR: {
    id: 'logout.error',
    category: 'LOGOUT',
    message: 'Une erreur est survenue lors de la déconnexion.',
    description: 'Message d\'erreur de déconnexion',
  },
};

/**
 * Messages offline
 */
export const OFFLINE_MESSAGES: Record<string, SystemMessage> = {
  MODE_ACTIVATED: {
    id: 'offline.mode.activated',
    category: 'OFFLINE',
    message: 'Mode hors connexion activé',
    description: 'Message lorsque le mode offline est activé',
  },
  SYNC_PENDING: {
    id: 'offline.sync.pending',
    category: 'OFFLINE',
    message: 'Les données seront synchronisées dès le retour de la connexion.',
    description: 'Message indiquant que la sync est en attente',
  },
  DATA_SAVED: {
    id: 'offline.data.saved',
    category: 'OFFLINE',
    message: 'Vos données ont été enregistrées localement.',
    description: 'Confirmation de sauvegarde locale',
  },
};

/**
 * Messages de synchronisation
 */
export const SYNC_MESSAGES: Record<string, SystemMessage> = {
  IN_PROGRESS: {
    id: 'sync.in_progress',
    category: 'SYNC',
    message: 'Synchronisation des données en cours…',
    description: 'Message pendant la synchronisation',
  },
  SUCCESS: {
    id: 'sync.success',
    category: 'SYNC',
    message: 'Synchronisation terminée avec succès',
    description: 'Message après synchronisation réussie',
  },
  CONFLICTS: {
    id: 'sync.conflicts',
    category: 'SYNC',
    message: 'Certaines données nécessitent une vérification',
    description: 'Message lorsqu\'il y a des conflits',
  },
  ERROR: {
    id: 'sync.error',
    category: 'SYNC',
    message: 'Erreur lors de la synchronisation. Veuillez réessayer.',
    description: 'Message d\'erreur de synchronisation',
  },
};

/**
 * Messages d'erreur généraux
 */
export const ERROR_MESSAGES: Record<string, SystemMessage> = {
  GENERIC: {
    id: 'error.generic',
    category: 'ERROR',
    message: 'Une action est temporairement indisponible.',
    description: 'Message d\'erreur générique',
  },
  RETRY: {
    id: 'error.retry',
    category: 'ERROR',
    message: 'Veuillez réessayer ultérieurement.',
    description: 'Message invitant à réessayer',
  },
  NETWORK: {
    id: 'error.network',
    category: 'ERROR',
    message: 'Problème de connexion. Vérifiez votre connexion internet.',
    description: 'Message d\'erreur réseau',
  },
  TIMEOUT: {
    id: 'error.timeout',
    category: 'ERROR',
    message: 'Le chargement prend plus de temps que prévu.',
    description: 'Message de timeout',
  },
};

/**
 * Messages de chargement
 */
export const LOADING_MESSAGES: Record<string, SystemMessage> = {
  PREPARING_APP: {
    id: 'loading.preparing_app',
    category: 'LOADING',
    message: 'Préparation de l\'application…',
    description: 'Message au lancement de l\'app PWA',
  },
  INITIALIZING: {
    id: 'loading.initializing',
    category: 'LOADING',
    message: 'Initialisation en cours…',
    description: 'Message d\'initialisation générique',
  },
};

/**
 * Messages de succès
 */
export const SUCCESS_MESSAGES: Record<string, SystemMessage> = {
  SAVED: {
    id: 'success.saved',
    category: 'SUCCESS',
    message: 'Les modifications ont été enregistrées.',
    description: 'Message de sauvegarde réussie',
  },
  UPDATED: {
    id: 'success.updated',
    category: 'SUCCESS',
    message: 'Mise à jour effectuée avec succès.',
    description: 'Message de mise à jour réussie',
  },
  DELETED: {
    id: 'success.deleted',
    category: 'SUCCESS',
    message: 'Suppression effectuée avec succès.',
    description: 'Message de suppression réussie',
  },
};

/**
 * Tous les messages regroupés
 */
export const ALL_SYSTEM_MESSAGES: Record<MessageCategory, Record<string, SystemMessage>> = {
  AUTH: AUTH_MESSAGES,
  LOGOUT: LOGOUT_MESSAGES,
  OFFLINE: OFFLINE_MESSAGES,
  SYNC: SYNC_MESSAGES,
  ERROR: ERROR_MESSAGES,
  LOADING: LOADING_MESSAGES,
  SUCCESS: SUCCESS_MESSAGES,
};

/**
 * Obtient un message par son ID
 */
export function getMessage(messageId: string): SystemMessage | null {
  for (const category of Object.values(ALL_SYSTEM_MESSAGES)) {
    for (const message of Object.values(category)) {
      if (message.id === messageId) {
        return message;
      }
    }
  }
  return null;
}

/**
 * Obtient un message par catégorie et clé
 */
export function getMessageByCategory(
  category: MessageCategory,
  key: string
): SystemMessage | null {
  const categoryMessages = ALL_SYSTEM_MESSAGES[category];
  return categoryMessages[key] || null;
}

/**
 * Obtient le texte d'un message
 */
export function getMessageText(messageId: string): string {
  const message = getMessage(messageId);
  return message?.message || messageId;
}
