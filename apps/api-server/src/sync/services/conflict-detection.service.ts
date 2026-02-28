import { Injectable, Logger } from '@nestjs/common';

/**
 * Résultat de détection de conflit
 */
export interface ConflictDetectionResult {
  hasConflict: boolean;
  reason?: string;
  serverVersion?: number; // Version côté serveur (si versioning implémenté)
  clientVersion?: number; // Version côté client (si versioning implémenté)
}

/**
 * Service de détection de conflits
 *
 * RÈGLE GÉNÉRALE : PostgreSQL gagne toujours (source de vérité).
 * FINANCE : Aucun merge automatique — si conflit → blocage, intervention requise.
 *
 * CAS DE CONFLIT :
 * - Enregistrement modifié côté serveur (updatedAt ou version)
 * - Enregistrement supprimé côté serveur
 * - Règle métier violée (ex: reçu émis, élève supprimé)
 */
@Injectable()
export class ConflictDetectionService {
  private readonly logger = new Logger(ConflictDetectionService.name);

  /**
   * Détecte un conflit entre données serveur et données client
   * 
   * @param serverRecord Enregistrement actuel côté serveur (PostgreSQL)
   * @param clientPayload Payload envoyé depuis SQLite (client)
   * @returns Résultat de détection avec raison si conflit
   */
  async detectConflict(serverRecord: any, clientPayload: any): Promise<ConflictDetectionResult> {
    if (!serverRecord) {
      return {
        hasConflict: true,
        reason: 'Enregistrement supprimé côté serveur',
      };
    }

    // MÉTHODE 1: Comparaison updated_at (si disponible)
    if (serverRecord.updatedAt && clientPayload.local_updated_at) {
      const serverUpdated = new Date(serverRecord.updatedAt).getTime();
      const clientUpdated = new Date(clientPayload.local_updated_at).getTime();

      // Si serveur a été modifié APRÈS la dernière modification client
      if (serverUpdated > clientUpdated) {
        this.logger.debug(
          `Conflit détecté: serveur modifié après client (serveur: ${serverRecord.updatedAt}, client: ${clientPayload.local_updated_at})`,
        );
        return {
          hasConflict: true,
          reason: `Enregistrement modifié côté serveur le ${serverRecord.updatedAt}`,
        };
      }
    }

    // MÉTHODE 2: Comparaison version (si versioning implémenté)
    if (serverRecord.version !== undefined && clientPayload.version !== undefined) {
      if (serverRecord.version > clientPayload.version) {
        return {
          hasConflict: true,
          reason: `Version serveur (${serverRecord.version}) supérieure à version client (${clientPayload.version})`,
          serverVersion: serverRecord.version,
          clientVersion: clientPayload.version,
        };
      }
    }

    // MÉTHODE 3: Vérification règles métier spécifiques par table
    const businessRuleConflict = await this.checkBusinessRules(serverRecord, clientPayload);
    if (businessRuleConflict) {
      return businessRuleConflict;
    }

    // Aucun conflit détecté
    return {
      hasConflict: false,
    };
  }

  /**
   * Vérifie les règles métier spécifiques par table
   * 
   * Exemples :
   * - Un paiement ne peut pas être supprimé s'il a des allocations
   * - Un élève doit avoir un profil tarifaire avant de créer des frais
   * - etc.
   */
  private async checkBusinessRules(serverRecord: any, clientPayload: any): Promise<ConflictDetectionResult | null> {
    // Exemple pour table payments
    if (serverRecord.receiptNumber && !clientPayload.receiptNumber) {
      // Conflit : reçu émis côté serveur après sync client
      return {
        hasConflict: true,
        reason: 'Un reçu a été émis pour ce paiement côté serveur',
      };
    }

    // Exemple pour table students
    if (serverRecord.status === 'DELETED' && clientPayload.status !== 'DELETED') {
      return {
        hasConflict: true,
        reason: 'Élève supprimé côté serveur',
      };
    }

    // Ajouter d'autres règles métier selon les besoins
    // TODO: Implémenter règles métier spécifiques par table

    return null; // Pas de conflit de règle métier
  }

  /**
   * Détecte si un enregistrement a été supprimé côté serveur
   */
  async detectDeletionConflict(serverRecord: any): Promise<ConflictDetectionResult> {
    if (!serverRecord) {
      return {
        hasConflict: true,
        reason: 'Enregistrement supprimé côté serveur',
      };
    }

    if (serverRecord.status === 'DELETED') {
      return {
        hasConflict: true,
        reason: 'Enregistrement marqué comme supprimé côté serveur',
      };
    }

    return {
      hasConflict: false,
    };
  }
}
