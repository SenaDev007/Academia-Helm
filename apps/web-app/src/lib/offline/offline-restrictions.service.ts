/**
 * Offline Restrictions Service
 * 
 * Service pour vérifier si une opération est autorisée en mode offline
 * 
 * RÈGLES :
 * - Paiements Fedapay : INTERDIT
 * - Validation paiements : INTERDIT
 * - Suppression physique : INTERDIT
 * - Actions Super Admin : INTERDIT
 * - Génération documents officiels finaux : INTERDIT
 */

export type OfflineOperationType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface OfflineRestrictionResult {
  allowed: boolean;
  reason?: string;
  message?: string;
}

class OfflineRestrictionsService {
  /**
   * Vérifie si une opération est autorisée en mode offline
   */
  isOperationAllowedOffline(
    tableName: string,
    operationType: OfflineOperationType,
    payload: any,
    userRole?: string,
  ): OfflineRestrictionResult {
    // 1. Suppression physique interdite (soft delete autorisé)
    if (operationType === 'DELETE' && payload.status !== 'DELETED') {
      return {
        allowed: false,
        reason: 'PERMANENT_DELETE_FORBIDDEN',
        message:
          'La suppression définitive nécessite une connexion serveur pour traçabilité. Utilisez la désactivation en mode offline.',
      };
    }

    // 2. Paiements Fedapay interdits
    if (tableName === 'payments' && payload.paymentMethod === 'FEDAPAY') {
      return {
        allowed: false,
        reason: 'FEDAPAY_PAYMENT_FORBIDDEN',
        message:
          'Les paiements Fedapay nécessitent une connexion internet active. Veuillez vous connecter pour procéder au paiement.',
      };
    }

    // 3. Validation paiements interdite
    if (tableName === 'payments' && payload.status === 'validated') {
      return {
        allowed: false,
        reason: 'PAYMENT_VALIDATION_FORBIDDEN',
        message:
          'La validation des paiements nécessite une connexion serveur. Veuillez vous connecter pour valider ce paiement.',
      };
    }

    // 4. Génération documents officiels interdite
    if (
      (tableName === 'payment_receipts' || tableName === 'report_cards') &&
      payload.status === 'FINAL'
    ) {
      return {
        allowed: false,
        reason: 'OFFICIAL_DOCUMENT_GENERATION_FORBIDDEN',
        message:
          'La génération du document officiel final nécessite une signature serveur. La prévisualisation est disponible en mode offline.',
      };
    }

    // 5. Actions Super Admin interdites
    if (tableName === 'tenants' || tableName === 'users') {
      if (userRole === 'SUPER_ADMIN' && (operationType === 'INSERT' || operationType === 'UPDATE')) {
        return {
          allowed: false,
          reason: 'SUPER_ADMIN_ACTION_FORBIDDEN',
          message:
            'Cette action d\'administration système nécessite une connexion serveur sécurisée.',
        };
      }
    }

    // 6. Publication officielle des résultats interdite
    if (tableName === 'exam_results' && payload.status === 'PUBLISHED') {
      return {
        allowed: false,
        reason: 'OFFICIAL_PUBLICATION_FORBIDDEN',
        message: 'La publication officielle des résultats nécessite une connexion serveur pour notification massive et archivage légal.',
      };
    }

    // 7. Verrouillage final de délibération interdit
    if (tableName === 'exam_deliberations' && payload.status === 'LOCKED') {
      return {
        allowed: false,
        reason: 'DELIBERATION_LOCK_FORBIDDEN',
        message: 'Le verrouillage définitif d\'une délibération nécessite une validation serveur immuable.',
      };
    }

    // 8. Envoi réel de notifications massives interdit
    if (tableName === 'messages' && payload.type === 'MASSIVE_BROADCAST' && operationType === 'INSERT') {
      return {
        allowed: false,
        reason: 'MASSIVE_BROADCAST_FORBIDDEN',
        message: 'L\'envoi de notifications massives nécessite une connexion serveur pour le routage SMS/Email.',
      };
    }

    // Opération autorisée
    return { allowed: true };
  }

  /**
   * Vérifie si une action UI est autorisée en mode offline
   */
  isUIActionAllowedOffline(action: string, context?: any): OfflineRestrictionResult {
    // Actions interdites par identifiant
    const forbiddenActions = [
      'fedapay-payment',
      'validate-payment',
      'delete-permanent',
      'generate-official-document',
      'super-admin-action',
      'publish-official-results',
      'lock-deliberation',
      'send-massive-broadcast',
    ];

    if (forbiddenActions.includes(action)) {
      const messages: Record<string, string> = {
        'fedapay-payment':
          'Les paiements Fedapay nécessitent une connexion internet active.',
        'validate-payment':
          'La validation des paiements nécessite une connexion serveur.',
        'delete-permanent':
          'La suppression définitive nécessite une connexion serveur.',
        'generate-official-document':
          'La génération du document officiel final nécessite une signature serveur.',
        'super-admin-action':
          'Cette action d\'administration nécessite une connexion serveur sécurisée.',
        'publish-official-results':
          'La publication officielle nécessite une connexion serveur.',
        'lock-deliberation':
          'Le verrouillage définitif nécessite une connexion serveur.',
        'send-massive-broadcast':
          'L\'envoi massif nécessite une connexion serveur.',
      };

      return {
        allowed: false,
        reason: action.toUpperCase().replace(/-/g, '_') + '_FORBIDDEN',
        message: messages[action] || 'Cette action nécessite une connexion internet.',
      };
    }

    // Action autorisée
    return { allowed: true };
  }
}

// Instance singleton
export const offlineRestrictionsService = new OfflineRestrictionsService();
