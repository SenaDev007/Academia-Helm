/**
 * ============================================================================
 * GUARDIANS PRISMA SERVICE - SOUS-MODULE RESPONSABLES LÉGAUX
 * ============================================================================
 * 
 * Service pour la gestion des responsables légaux (guardians)
 * 
 * ⭐ 2026-09-19 (demande promoteur) : à CHAQUE création/lien d'un responsable
 *    lors d'une inscription, le COMPTE PARENT (User role=PARENT) est créé en
 *    même temps via ParentUserProvisioningService — avant, les parents
 *    restaient sans compte utilisateur (connexion portail impossible, chat
 *    impossible). Provisionnement idempotent + non bloquant : une erreur
 *    d'account provisioning n'interrompt JAMAIS l'inscription de l'élève.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ParentUserProvisioningService } from './services/parent-user-provisioning.service';
import { ParentAccountNotificationService } from './services/parent-account-notification.service';

@Injectable()
export class GuardiansPrismaService {
  private readonly logger = new Logger(GuardiansPrismaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parentProvisioningService: ParentUserProvisioningService,
    private readonly parentAccountNotificationService: ParentAccountNotificationService,
  ) {}

  /**
   * Crée un responsable légal et l'associe à un élève
   */
  async createGuardianForStudent(data: {
    tenantId: string;
    studentId: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
    relationship: string; // MOTHER, FATHER, GUARDIAN, etc.
    address?: string;
    isPrimary?: boolean;
    /** ⭐ nov. 2026 — false = ne PAS créer le User parent (étape skippée au wizard). Défaut true. */
    createAccount?: boolean;
    /** ⭐ nov. 2026 — true = envoyer les identifiants de connexion au parent (email + Helm Connect). Défaut false. */
    sendCredentials?: boolean;
    /** ⭐ nov. 2026 — expéditeur du message Helm Connect (défaut : directeur du tenant). */
    senderUserId?: string;
  }) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: data.studentId, tenantId: data.tenantId },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${data.studentId} not found`);
    }

    // Si c'est le responsable principal, désactiver les autres
    if (data.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: {
          studentId: data.studentId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Créer ou trouver le guardian
    let guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId: data.tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || undefined,
      },
    });

    if (!guardian) {
      guardian = await this.prisma.guardian.create({
        data: {
          tenantId: data.tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          email: data.email,
          relationship: data.relationship,
          address: data.address,
        },
      });
    }

    // ⭐ 2026-09-19 — COMPTE PARENT en même temps que l'inscription : le
    //    responsable vient d'être créé/lié → on garantit son User (role=PARENT)
    //    TOUT DE SUITE (connexion portail parent par téléphone/email).
    //    Idempotent (déjà lié → no-op) et NON BLOQUANT pour l'inscription.
    // ⭐ nov. 2026 (demande promoteur) : le wizard Onglet Inscriptions DEMANDE
    //    désormais à l'utilisateur s'il faut créer le compte en même temps.
    //    createAccount=false → étape skippée (rattrapable dans l'onglet Famille
    //    → sous-onglet « Création de compte »).
    let parentAccount: { userId?: string; created?: boolean } | null = null;
    if (data.createAccount !== false) {
      try {
        const provisioned = await this.parentProvisioningService.ensureUserForGuardian(guardian.id);
        parentAccount = { userId: provisioned.userId, created: provisioned.created };
      } catch (provisioningErr: any) {
        this.logger.warn(
          `Compte parent non provisionné pour le guardian ${guardian.id} (non bloquant): ${provisioningErr?.message || provisioningErr}`,
        );
      }

      // ⭐ nov. 2026 (demande promoteur « envoyer les identifiants ») : envoi
      //    des informations de connexion (portail + identifiant + MOT DE PASSE
      //    SIMPLE — obligatoire depuis nov. 2026).
      //    Canaux « SMS + email » (le SMS via Termii est le premier canal : le
      //    parent sans email ne peut rien recevoir par email ; Helm Connect
      //    suppose déjà un compte connecté — inutile AVANT la 1re connexion).
      //    Si le service SMS n'est pas configuré, le canal est « skipped » avec
      //    un message explicite (jamais de faux succès).
      if (data.sendCredentials === true && parentAccount) {
        try {
          // ⭐ Mot de passe simple (régénéré à chaque envoi — auto-porteur)
          const passwordResult = await this.parentProvisioningService
            .regeneratePasswordForGuardian(guardian.id)
            .catch((pwErr: any) => {
              this.logger.warn(
                `Mot de passe parent non régénéré pour le guardian ${guardian.id} (non bloquant): ${pwErr?.message || pwErr}`,
              );
              return null;
            });
          const notification = await this.parentAccountNotificationService.sendAccountCredentials({
            tenantId: data.tenantId,
            guardianId: guardian.id,
            studentId: data.studentId,
            channels: ['sms', 'email'],
            senderUserId: data.senderUserId,
            password: passwordResult?.password ?? null,
          });
          // ⭐ Rapport par canal renvoyé au wizard (toast « envoyés par … »
          //    exact) — conservé sur parentAccount.notification
          parentAccount = { ...parentAccount, notification } as any;
        } catch (notifErr: any) {
          this.logger.warn(
            `Identifiants du compte parent non envoyés pour le guardian ${guardian.id} (non bloquant): ${notifErr?.message || notifErr}`,
          );
        }
      }
    }

    // Créer la relation
    const studentGuardian = await this.prisma.studentGuardian.create({
      data: {
        tenantId: data.tenantId,
        studentId: data.studentId,
        guardianId: guardian.id,
        relationship: data.relationship,
        isPrimary: data.isPrimary || false,
      },
      include: {
        guardian: true,
        student: true,
      },
    });

    // ⭐ nov. 2026 — infos additives (rétro-compatibles) sur le compte parent :
    //    le wizard affiche un retour explicite (« identifiants envoyés »).
    return {
      ...studentGuardian,
      parentAccount,
    };
  }

  /**
   * ⭐ nov. 2026 (demande promoteur) — Onglet Famille → sous-onglet
   * « Création de compte » : crée (ou garantit) le compte parent pour un
   * responsable qui n'en avait pas (wizard avec étape skippée), et envoie
   * les informations de connexion au parent par les canaux demandés
   * (défaut SMS + email + Helm Connect — pattern modal d'encaissement).
   *
   * ⭐ nov. 2026 — MOT DE PASSE : les identifiants incluent un mot de passe
   * SIMPLE régénéré à chaque envoi (le portail parent exige désormais un mot
   * de passe : téléphone/email + mot de passe).
   *
   * Idempotent : si le guardian a déjà un User, aucun nouveau compte n'est
   * créé (created=false) mais les identifiants peuvent être renvoyés.
   */
  async provisionParentAccount(params: {
    tenantId: string;
    studentId: string;
    guardianId: string;
    createAccount?: boolean; // défaut true
    sendCredentials?: boolean; // défaut true
    channels?: ('email' | 'whatsapp' | 'sms' | 'helm_connect')[];
    senderUserId?: string; // expéditeur du message Helm Connect
  }) {
    // 1. Vérifier que le guardian est bien lié à cet élève dans ce tenant
    const link = await this.prisma.studentGuardian.findFirst({
      where: {
        studentId: params.studentId,
        guardianId: params.guardianId,
        tenantId: params.tenantId,
      },
      include: {
        guardian: true,
        student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
    });
    if (!link) {
      throw new NotFoundException(
        `Guardian ${params.guardianId} n'est pas lié à l'élève ${params.studentId}`,
      );
    }

    // 2. Créer / garantir le compte (sauf refus explicite)
    let account: { userId?: string; created?: boolean } | null = null;
    if (params.createAccount !== false) {
      const provisioned = await this.parentProvisioningService.ensureUserForGuardian(params.guardianId);
      account = { userId: provisioned.userId, created: provisioned.created };
    } else if (link.guardian.userId) {
      account = { userId: link.guardian.userId, created: false };
    }

    // 3. Informations de connexion (URL portail + identifiant)
    const credentials: any = await this.parentAccountNotificationService.buildCredentials(
      params.tenantId,
      link.guardian,
    );

    // 4. Envoyer les identifiants (défaut true — « on lui envoie les
    //    informations de connexion » ; renvoyables à volonté).
    //    ⭐ nov. 2026 — le MOT DE PASSE est OBLIGATOIRE : régénéré à CHAQUE
    //    envoi (les identifiants transmis sont toujours auto-porteurs).
    let notification: Record<string, any> = {};
    if (params.sendCredentials !== false) {
      let password: string | null = null;
      try {
        const passwordResult = await this.parentProvisioningService
          .regeneratePasswordForGuardian(params.guardianId);
        password = passwordResult?.password ?? null;
        account = account ?? { userId: passwordResult.userId, created: false };
      } catch (pwErr: any) {
        this.logger.warn(
          `Mot de passe non régénéré pour le guardian ${params.guardianId} (envoi sans mot de passe): ${pwErr?.message || pwErr}`,
        );
      }
      credentials.password = password;
      notification = await this.parentAccountNotificationService.sendAccountCredentials({
        tenantId: params.tenantId,
        guardianId: params.guardianId,
        studentId: params.studentId,
        channels: params.channels?.length ? params.channels : ['sms', 'email', 'helm_connect'],
        senderUserId: params.senderUserId,
        password,
      });
    }

    return {
      guardian: link.guardian,
      student: link.student,
      account,
      credentials,
      notification,
    };
  }

  /**
   * ⭐ nov. 2026 (demande promoteur — « une vingtaine de parents sans compte,
   * il faut pouvoir tout faire d'un coup au lieu d'un par un ») — GÉNÉRATION
   * MULTIPLE des comptes parents :
   *   - action='create'  : crée les comptes des responsables SANS compte et
   *                        leur envoie les identifiants (SMS + email +
   *                        Helm Connect) — les responsables déjà dotés d'un
   *                        compte sont ignorés (skipped).
   *   - action='resend'  : renvoie les identifiants (mot de passe régénéré)
   *                        aux responsables AVEC compte — les sans-compte
   *                        sont ignorés (skipped).
   *
   * Traitement en petit pool de concurrence (3) pour ne pas sérialiser 20
   * envois multi-canaux ; rapport détaillé par responsable + synthèse.
   */
  async bulkProvisionParentAccounts(params: {
    tenantId: string;
    guardianIds: string[];
    action: 'create' | 'resend';
    senderUserId?: string;
  }) {
    const uniqueIds = [...new Set((params.guardianIds || []).filter(Boolean))].slice(0, 100); // garde-fou
    if (uniqueIds.length === 0) {
      return { results: [], summary: { total: 0, created: 0, sent: 0, failed: 0, skipped: 0 } };
    }

    const results: any[] = [];
    const queue = [...uniqueIds];

    const processOne = async (guardianId: string) => {
      // Contexte du responsable (nom + un élève lié pour l'appel unitaire)
      const guardian = await this.prisma.guardian.findFirst({
        where: { id: guardianId, tenantId: params.tenantId },
        include: {
          studentGuardians: {
            take: 1,
            orderBy: [{ isPrimary: 'desc' }],
            include: { student: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      });
      const guardianName = guardian
        ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim()
        : guardianId;
      const studentName = guardian?.studentGuardians?.[0]?.student
        ? `${guardian.studentGuardians[0].student.firstName} ${guardian.studentGuardians[0].student.lastName}`
        : undefined;

      if (!guardian) {
        return { guardianId, guardianName, studentName, status: 'skipped', message: 'Responsable introuvable' };
      }
      if (params.action === 'create' && guardian.userId) {
        return { guardianId, guardianName, studentName, status: 'skipped', message: 'Compte déjà existant' };
      }
      if (params.action === 'resend' && !guardian.userId) {
        return { guardianId, guardianName, studentName, status: 'skipped', message: 'Aucun compte — à créer d\u2019abord' };
      }
      const studentId = guardian.studentGuardians?.[0]?.studentId;
      if (!studentId) {
        return { guardianId, guardianName, studentName: undefined, status: 'skipped', message: 'Aucun élève lié à ce responsable' };
      }

      const r = await this.provisionParentAccount({
        tenantId: params.tenantId,
        studentId,
        guardianId,
        createAccount: params.action === 'create',
        sendCredentials: true,
        senderUserId: params.senderUserId,
      });

      const notif: Record<string, any> = r?.notification ?? {};
      const sentChannels = Object.entries(notif)
        .filter(([ch, rr]) => ch !== 'error' && (rr as any)?.status === 'sent')
        .map(([ch]) => ch);
      const failedChannels = Object.entries(notif)
        .filter(([ch, rr]) => ch !== 'error' && (rr as any)?.status === 'failed')
        .map(([ch]) => ch);
      const status = sentChannels.length > 0
        ? 'sent'
        : failedChannels.length > 0
          ? 'failed'
          : 'skipped';
      const message = sentChannels.length > 0
        ? `Identifiants envoyés (${sentChannels.join(', ')})`
        : failedChannels.length > 0
          ? `Échec d\u2019envoi (${failedChannels.join(', ')})`
          : 'Aucun canal disponible (contacts manquants)';

      return {
        guardianId,
        guardianName,
        studentName,
        status,
        message,
        created: r?.account?.created === true,
        credentials: r?.credentials,
        channels: notif,
      };
    };

    // Petit pool de concurrence (3) — 20 parents ≈ quelques dizaines de secondes
    const worker = async () => {
      while (queue.length > 0) {
        const guardianId = queue.shift()!;
        try {
          results.push(await processOne(guardianId));
        } catch (err: any) {
          results.push({
            guardianId,
            guardianName: guardianId,
            status: 'failed',
            message: err?.message || String(err),
          });
        }
      }
    };
    const concurrency = Math.min(3, uniqueIds.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    const summary = {
      total: uniqueIds.length,
      created: results.filter(r => r.created === true).length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
    };
    this.logger.log(
      `Bulk comptes parents (${params.action}) — ${summary.total} demandé(s) : ${summary.created} créé(s), ${summary.sent} envoyé(s), ${summary.failed} échec(s), ${summary.skipped} ignoré(s)`,
    );

    return { results, summary };
  }

  /**
   * Récupère tous les responsables d'un élève
   */
  async getStudentGuardians(studentId: string, tenantId: string) {
    return this.prisma.studentGuardian.findMany({
      where: {
        studentId,
        tenantId,
      },
      include: {
        guardian: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentCode: true,
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }

  /**
   * Met à jour un responsable légal
   */
  async updateGuardian(
    guardianId: string,
    tenantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      email?: string;
      address?: string;
    }
  ) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: guardianId, tenantId },
    });

    if (!guardian) {
      throw new NotFoundException(`Guardian with ID ${guardianId} not found`);
    }

    return this.prisma.guardian.update({
      where: { id: guardianId },
      data,
      include: {
        studentGuardians: {
          include: {
            student: true,
          },
        },
      },
    });
  }

  /**
   * Met à jour la relation élève-responsable
   */
  async updateStudentGuardian(
    studentGuardianId: string,
    tenantId: string,
    data: {
      relationship?: string;
      isPrimary?: boolean;
    }
  ) {
    const studentGuardian = await this.prisma.studentGuardian.findFirst({
      where: { id: studentGuardianId, tenantId },
    });

    if (!studentGuardian) {
      throw new NotFoundException(`StudentGuardian with ID ${studentGuardianId} not found`);
    }

    // Si on définit comme principal, désactiver les autres
    if (data.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: {
          studentId: studentGuardian.studentId,
          id: { not: studentGuardianId },
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    return this.prisma.studentGuardian.update({
      where: { id: studentGuardianId },
      data,
      include: {
        guardian: true,
        student: true,
      },
    });
  }

  /**
   * Supprime la relation élève-responsable (pas de suppression du guardian)
   */
  async removeStudentGuardian(studentGuardianId: string, tenantId: string) {
    const studentGuardian = await this.prisma.studentGuardian.findFirst({
      where: { id: studentGuardianId, tenantId },
    });

    if (!studentGuardian) {
      throw new NotFoundException(`StudentGuardian with ID ${studentGuardianId} not found`);
    }

    await this.prisma.studentGuardian.delete({
      where: { id: studentGuardianId },
    });

    return { success: true };
  }
}

