/**
 * Secure Logout Flow Service
 * 
 * Service pour orchestrer le flow de logout sécurisé en 5 étapes strictes
 * 
 * ORDRE STRICT :
 * 1. Confirmation utilisateur
 * 2. Désactivation session serveur
 * 3. Gestion offline-first (conservation SQLite)
 * 4. Nettoyage contexte applicatif
 * 5. Redirection contrôlée
 */

import { logout as apiLogout } from '@/services/auth.service';
import { clearServerSession } from '@/lib/auth/session';
import { getMessageText } from '@/lib/messages/system-messages';

export type LogoutStep = 
  | 'CONFIRMATION'
  | 'SERVER_SESSION'
  | 'OFFLINE_CLEANUP'
  | 'APP_CONTEXT'
  | 'REDIRECT';

export interface LogoutFlowProgress {
  step: LogoutStep;
  progress: number; // 0-100
  message: string;
}

export interface LogoutFlowResult {
  success: boolean;
  error?: {
    step: LogoutStep;
    message: string;
    code: string;
  };
}

type ProgressCallback = (progress: LogoutFlowProgress) => void;

/**
 * Exécute le flow de logout sécurisé complet
 */
export async function executeSecureLogoutFlow(
  onProgress?: ProgressCallback
): Promise<LogoutFlowResult> {
  try {
    // Étape 1 : Confirmation utilisateur (déjà gérée par le composant)
    // Cette étape est gérée côté UI avant d'appeler ce service

    // Étape 2 : Désactivation session serveur
    const step2Message = getMessageText('logout.in_progress');
    onProgress?.({
      step: 'SERVER_SESSION',
      progress: 30,
      message: step2Message,
    });

    try {
      // Invalider le JWT / session token côté serveur
      await apiLogout();
      
      // Suppression de la session côté serveur
      await clearServerSession();
      
      // Journalisation (audit log) - à implémenter côté backend
      // await logLogout(userId, tenantId, timestamp);
    } catch (error: any) {
      // Ne pas bloquer le flow si l'API échoue (offline)
      console.warn('Server logout failed (may be offline):', error);
    }

    await waitMinimum(200);

    // Étape 3 : Gestion offline-first
    onProgress?.({
      step: 'OFFLINE_CLEANUP',
      progress: 50,
      message: 'Conservation des données locales…',
    });

    // SQLite locale CONSERVÉE
    // Aucune suppression de données locales
    // Les données restent chiffrées et liées au tenant
    // Rien à faire ici, les données restent en place

    await waitMinimum(200);

    // Étape 4 : Nettoyage contexte applicatif
    onProgress?.({
      step: 'APP_CONTEXT',
      progress: 70,
      message: 'Nettoyage du contexte applicatif…',
    });

    // Suppression du contexte utilisateur
    if (typeof window !== 'undefined') {
      // Supprimer les données sensibles du localStorage
      const sensitiveKeys = ['session', 'user', 'tenant', 'token'];
      sensitiveKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove ${key} from localStorage:`, error);
        }
      });

      // Supprimer les données sensibles de sessionStorage
      sensitiveKeys.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (error) {
          console.warn(`Failed to remove ${key} from sessionStorage:`, error);
        }
      });

      // Réinitialisation ORION
      // Dispatch événement pour réinitialiser ORION
      window.dispatchEvent(new CustomEvent('orion-reset'));

      // Réinitialisation du contexte de permissions
      window.dispatchEvent(new CustomEvent('permissions-reset'));

      // Réinitialisation du contexte utilisateur
      window.dispatchEvent(new CustomEvent('user-context-reset'));
    }

    await waitMinimum(200);

    // Étape 5 : Redirection contrôlée
    onProgress?.({
      step: 'REDIRECT',
      progress: 100,
      message: getMessageText('logout.success'),
    });

    await waitMinimum(300);

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        step: 'SERVER_SESSION',
        message: error.message || getMessageText('logout.error'),
        code: 'LOGOUT_ERROR',
      },
    };
  }
}

/**
 * Attend un délai minimum
 */
function waitMinimum(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
