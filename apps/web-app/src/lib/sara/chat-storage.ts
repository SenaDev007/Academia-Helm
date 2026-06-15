/**
 * Chat Storage — Persistance des conversations SARA avec expiration automatique
 *
 * Les messages sont sauvegardés dans localStorage pour persister entre les
 * rechargements de page. Une expiration automatique supprime les conversations
 * plus anciennes que le délai configuré (30 jours par défaut).
 *
 * Fonctionnement :
 *   - Chaque widget (sara-widget, support-chat, inapp-guide) a sa propre clé
 *   - Les messages sont stockés avec un horodatage de dernière mise à jour
 *   - Au chargement, on vérifie l'âge des données ; si >30j, on les efface
 *   - À chaque modification des messages, on sauvegarde automatiquement
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Message format pour le SaraWidget (streaming) */
export interface SaraWidgetMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Message format pour le SupportChatWidget */
export interface SupportChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string; // ISO string for serialization
}

/** Message format pour le InAppSaraGuide */
export interface InAppGuideMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isAiEnhanced?: boolean;
  timestamp?: string;
}

/** Structure stockée dans localStorage */
interface ChatStorageData<T> {
  /** Horodatage de la dernière mise à jour (epoch ms) */
  updatedAt: number;
  /** Messages sérialisés */
  messages: T[];
}

/** Identifiant du widget pour la clé de stockage */
export type ChatWidgetId = 'sara-widget' | 'support-chat' | 'inapp-guide';

// ─── Configuration ──────────────────────────────────────────────────────────

/** Durée de rétention par défaut : 30 jours en millisecondes */
const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// ─── Fonctions utilitaires ──────────────────────────────────────────────────

/**
 * Génère la clé localStorage pour un widget donné.
 * Format : `sara_chat:{widgetId}`
 */
function storageKey(widgetId: ChatWidgetId): string {
  return `sara_chat:${widgetId}`;
}

/**
 * Vérifie si localStorage est disponible.
 * En SSR ou en mode incognito, localStorage peut être inaccessible.
 */
function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__sara_chat_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Charge les messages sauvegardés pour un widget.
 *
 * Si les données sont plus anciennes que le délai de rétention,
 * elles sont automatiquement supprimées et un tableau vide est retourné.
 *
 * @param widgetId Identifiant du widget
 * @param retentionMs Durée de rétention en ms (défaut : 30 jours)
 * @returns Les messages sauvegardés, ou un tableau vide si aucun/expiré
 */
export function loadChatMessages<T>(
  widgetId: ChatWidgetId,
  retentionMs: number = DEFAULT_RETENTION_MS,
): T[] {
  if (!isLocalStorageAvailable()) return [];

  try {
    const raw = localStorage.getItem(storageKey(widgetId));
    if (!raw) return [];

    const data: ChatStorageData<T> = JSON.parse(raw);
    const age = Date.now() - data.updatedAt;

    // Suppression automatique si les données sont trop anciennes
    if (age > retentionMs) {
      localStorage.removeItem(storageKey(widgetId));
      return [];
    }

    return data.messages;
  } catch (error) {
    console.warn(`[ChatStorage] Erreur de lecture pour ${widgetId}:`, error);
    // Données corrompues — on nettoie
    try { localStorage.removeItem(storageKey(widgetId)); } catch { /* ignore */ }
    return [];
  }
}

/**
 * Sauvegarde les messages d'un widget dans localStorage.
 *
 * @param widgetId Identifiant du widget
 * @param messages Messages à sauvegarder
 */
export function saveChatMessages<T>(
  widgetId: ChatWidgetId,
  messages: T[],
): void {
  if (!isLocalStorageAvailable()) return;

  try {
    const data: ChatStorageData<T> = {
      updatedAt: Date.now(),
      messages,
    };
    localStorage.setItem(storageKey(widgetId), JSON.stringify(data));
  } catch (error) {
    // localStorage peut être plein — on essaie de nettoyer les anciens chats
    console.warn(`[ChatStorage] Erreur de sauvegarde pour ${widgetId}:`, error);
    try {
      // Supprimer les autres chats pour faire de la place
      clearAllChatData();
      // Réessayer une fois
      const data: ChatStorageData<T> = {
        updatedAt: Date.now(),
        messages,
      };
      localStorage.setItem(storageKey(widgetId), JSON.stringify(data));
    } catch {
      // Échec silencieux — la persistance n'est pas critique
    }
  }
}

/**
 * Supprime les messages sauvegardés pour un widget spécifique.
 */
export function clearChatMessages(widgetId: ChatWidgetId): void {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.removeItem(storageKey(widgetId));
  } catch { /* ignore */ }
}

/**
 * Supprime toutes les données de chat SARA de localStorage.
 * Utile quand localStorage est plein pour faire de la place.
 */
export function clearAllChatData(): void {
  if (!isLocalStorageAvailable()) return;
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sara_chat:'));
    keys.forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * Nettoie les conversations expirées pour tous les widgets.
 * À appeler au démarrage de l'application pour garantir que les
 * données trop anciennes sont purgées même si l'utilisateur ne
 * visite pas un widget en particulier.
 *
 * @param retentionMs Durée de rétention en ms (défaut : 30 jours)
 */
export function purgeExpiredChats(retentionMs: number = DEFAULT_RETENTION_MS): void {
  if (!isLocalStorageAvailable()) return;

  try {
    const widgetIds: ChatWidgetId[] = ['sara-widget', 'support-chat', 'inapp-guide'];
    for (const widgetId of widgetIds) {
      const raw = localStorage.getItem(storageKey(widgetId));
      if (!raw) continue;

      try {
        const data = JSON.parse(raw);
        if (Date.now() - data.updatedAt > retentionMs) {
          localStorage.removeItem(storageKey(widgetId));
        }
      } catch {
        // Données corrompues — on supprime
        localStorage.removeItem(storageKey(widgetId));
      }
    }
  } catch { /* ignore */ }
}

/**
 * Retourne l'âge en millisecondes des données sauvegardées pour un widget.
 * Retourne null si aucune donnée n'existe.
 */
export function getChatAge(widgetId: ChatWidgetId): number | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const raw = localStorage.getItem(storageKey(widgetId));
    if (!raw) return null;

    const data = JSON.parse(raw);
    return Date.now() - data.updatedAt;
  } catch {
    return null;
  }
}

/**
 * Retourne le nombre de jours restants avant expiration des données.
 * Retourne null si aucune donnée n'existe.
 */
export function getDaysUntilExpiry(
  widgetId: ChatWidgetId,
  retentionMs: number = DEFAULT_RETENTION_MS,
): number | null {
  const age = getChatAge(widgetId);
  if (age === null) return null;

  const remainingMs = retentionMs - age;
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

// ─── Helpers de conversion ──────────────────────────────────────────────────

/**
 * Convertit les messages du SupportChatWidget pour la sérialisation.
 * Les objets Date sont convertis en ISO strings.
 */
export function serializeSupportMessages(
  messages: Array<{ id: string; type: 'user' | 'bot'; content: string; timestamp: Date }>,
): SupportChatMessage[] {
  return messages.map(m => ({
    ...m,
    timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
  }));
}

/**
 * Reconstruit les messages du SupportChatWidget depuis localStorage.
 * Les ISO strings sont reconverties en objets Date.
 */
export function deserializeSupportMessages(
  messages: SupportChatMessage[],
): Array<{ id: string; type: 'user' | 'bot'; content: string; timestamp: Date }> {
  return messages.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}
