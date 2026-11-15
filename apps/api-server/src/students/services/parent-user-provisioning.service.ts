/**
 * ============================================================================
 * PARENT USER PROVISIONING SERVICE
 * ============================================================================
 *
 * ⭐ Why this service exists:
 * The chat system (chat_conversations, chat_participants, chat_messages) is
 * built around User IDs. A parent (Guardian) cannot be a chat participant
 * unless they have a User account.
 *
 * Previously, guardians were created during student enrollment WITHOUT a
 * linked User account. This meant:
 *   - Teachers couldn't chat with parents (no User ID to add as participant)
 *   - Parents couldn't login to the portal (loginParentByPhone throws
 *     "Compte parent non configuré" if no User exists with matching email)
 *
 * This service fixes that by auto-creating a User account (role=PARENT,
 * passwordHash = mot de passe SIMPLE généré — cf. generateSimplePassword) for
 * any guardian that doesn't have one yet, and back-filling guardian.userId.
 *
 * ⭐ nov. 2026 (demande promoteur) — MOT DE PASSE OBLIGATOIRE au portail
 *    parent : la connexion se fait désormais par (téléphone OU email) + mot
 *    de passe. Les mots de passe générés sont simples à garder pour les
 *    parents : un petit mot courant + 2 ou 3 chiffres (ex : « soleil42 »,
 *    « fleur205 »). Ils sont communiqués au parent par SMS/email lors de
 *    l'envoi des identifiants (ParentAccountNotificationService) — régénérés
 *    à chaque envoi (jamais stockés en clair : bcrypt uniquement).
 *
 * ⭐ When it's called:
 *   - Lazily: when a teacher wants to start a chat with a guardian
 *     (POST /api/chat/conversations/guardian-direct)
 *   - Lazily: when the finance module wants to send a Helm Connect message
 *     to a parent (ReceiptNotificationFinanceService)
 *   - Eagerly (⭐ 2026-09-19, demande promoteur « compte parent en même temps
 *     que l'inscription de l'élève ») : dès qu'un guardian est créé/lié :
 *       - GuardiansPrismaService.createGuardianForStudent (wizard d'inscription,
 *         onglet Parents — chemin principal)
 *       - AdmissionService (conversion admission → inscription)
 *       - StudentsImportService (import Excel des élèves)
 *       - StudentTransferService (copie des responsables côté école destination)
 *   - Backfill: a one-time admin script to provision existing guardians
 *
 * ⭐ Email handling:
 * The User.email column is @unique. If a guardian has no email, we use a
 * deterministic fallback: "guardian-{guardianId}@no-email.local".
 * This ensures we can always create a User, but the parent will need to
 * login via their phone (not email) in that case.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';

/**
 * ⭐ nov. 2026 (demande promoteur) — mots de passe parents SIMPLES :
 * « un petit mot avec quelques chiffres, deux ou trois chiffres au plus ».
 * Mots courants sans accent (compatibles GSM-7 pour l'envoi par SMS).
 */
const SIMPLE_PASSWORD_WORDS = [
  'soleil', 'fleur', 'etoile', 'maison', 'citron', 'mangue', 'banane',
  'orange', 'cerise', 'raisin', 'melon', 'girafe', 'dauphin', 'tortue',
  'hibou', 'pigeon', 'colibri', 'cascade', 'riviere', 'montagne', 'plage',
  'sable', 'vague', 'nuage', 'pluie', 'clair', 'doux', 'paix', 'joie',
  'famille', 'ecole', 'livre', 'crayon', 'couleur', 'musique', 'chanson',
  'danse', 'fete', 'cadeau', 'bonbon', 'gateau', 'miel', 'lait', 'riz',
];

@Injectable()
export class ParentUserProvisioningService {
  private readonly logger = new Logger(ParentUserProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ⭐ nov. 2026 — Génère un mot de passe parent simple : petit mot courant
   * (5-8 lettres, sans accent) + 2 ou 3 chiffres. Exemples : soleil42,
   * fleur205, maison718.
   */
  static generateSimplePassword(): string {
    const word = SIMPLE_PASSWORD_WORDS[Math.floor(Math.random() * SIMPLE_PASSWORD_WORDS.length)];
    const digitCount = Math.floor(Math.random() * 2) + 2; // 2 ou 3 chiffres — pas plus
    const min = digitCount === 2 ? 10 : 100;
    const max = digitCount === 2 ? 100 : 1000;
    const digits = Math.floor(Math.random() * (max - min)) + min;
    return `${word}${digits}`;
  }

  /**
   * Ensures a User account exists for the given guardian. If the guardian
   * already has a linked userId, returns it. Otherwise:
   *   1. Looks up an existing User by email (in case a User was created
   *      out-of-band with the same email)
   *   2. If none, creates a new User with role=PARENT and a SIMPLE generated
   *      password (bcrypt-hashed) — ⭐ nov. 2026 : le portail parent exige
   *      désormais un mot de passe (téléphone/email + mot de passe).
   *   3. Back-fills guardian.userId
   *
   * @returns { userId, created, password? } where created=true if a new User
   * was created (password = mot de passe en clair SEULEMENT à la création —
   * pour les autres chemins d'appel qui n'envoient pas d'identifiants, il
   * sera communiqué plus tard via regeneratePasswordForGuardian).
   */
  async ensureUserForGuardian(guardianId: string): Promise<{ userId: string; created: boolean; password?: string }> {
    if (!guardianId) {
      throw new NotFoundException('guardianId is required');
    }

    // 1. Find the guardian
    const guardian = await this.prisma.guardian.findUnique({ where: { id: guardianId } });
    if (!guardian) {
      throw new NotFoundException(`Guardian not found: ${guardianId}`);
    }

    // 2. If already linked, return early (no work to do)
    if (guardian.userId) {
      return { userId: guardian.userId, created: false };
    }

    // ⭐ 2026-09-19 : normalisation de l'email (minuscules) — le login parent
    //    par email normalise en minuscules ; on crée donc le compte avec la
    //    même convention (et la recherche insensible ci-dessous rattrape les
    //    comptes historiques créés avec des majuscules).
    const normalizedEmail = guardian.email?.trim().toLowerCase() || null;

    // 3. Look up existing User by email (in case it was created out-of-band)
    let user: any = null;
    if (normalizedEmail) {
      user = await this.prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          tenantId: guardian.tenantId,
        },
      });
    }

    // 4. If no User found, create one — ⭐ nov. 2026 : AVEC un mot de passe
    //    simple généré (le portail parent exige désormais un mot de passe).
    let created = false;
    let createdPassword: string | undefined;
    if (!user) {
      const email = normalizedEmail || `guardian-${guardian.id}@no-email.local`;
      createdPassword = ParentUserProvisioningService.generateSimplePassword();
      try {
        user = await this.prisma.user.create({
          data: {
            id: randomUUID(),
            tenantId: guardian.tenantId,
            email,
            firstName: guardian.firstName,
            lastName: guardian.lastName,
            role: 'PARENT',
            status: 'active',
            passwordHash: await bcrypt.hash(createdPassword, 10), // ⭐ mot de passe simple obligatoire
          },
        });
        created = true;
        this.logger.log(`Created PARENT User ${user.id} for guardian ${guardian.id} (tenant ${guardian.tenantId}) — with simple password`);
      } catch (err: any) {
        // Handle race condition: another request created the User in parallel
        if (err.code === 'P2002' && normalizedEmail) {
          // Unique constraint violation on email — another User with this email
          // exists. D'ABORD dans le même tenant (course classique)…
          user = await this.prisma.user.findFirst({
            where: {
              email: { equals: normalizedEmail, mode: 'insensitive' },
              tenantId: guardian.tenantId,
            },
          });
          if (user) {
            this.logger.warn(`Race condition: User with email ${normalizedEmail} was created concurrently. Reusing it.`);
          } else {
            // …SINON dans un AUTRE tenant (⭐ 2026-09-19 : même parent inscrit dans
            // deux écoles du groupe — users.email est GLOBALEMENT unique). Le User
            // existant est réutilisé et lié via guardian.userId : c'est l'architecture
            // multi-écoles prévue (un user peut gérer plusieurs écoles).
            user = await this.prisma.user.findFirst({
              where: {
                email: { equals: normalizedEmail, mode: 'insensitive' },
              },
            });
            if (user) {
              this.logger.warn(
                `User with email ${normalizedEmail} exists in another tenant (${user.tenantId}) — reused for guardian ${guardian.id} of tenant ${guardian.tenantId} (multi-école)`,
              );
            }
          }
          if (!user) {
            throw err; // unexpected — rethrow
          }
        } else {
          throw err;
        }
      }
    }

    // 5. Back-fill guardian.userId (idempotent — safe to call multiple times)
    await this.prisma.guardian.update({
      where: { id: guardianId },
      data: { userId: user.id },
    });

    return { userId: user.id, created, ...(created && createdPassword ? { password: createdPassword } : {}) };
  }

  /**
   * ⭐ nov. 2026 (demande promoteur — mots de passe OBLIGATOIRES au portail
   * parent) : (re)génère le mot de passe SIMPLE du compte parent d'un
   * responsable, à destination de l'envoi des identifiants.
   *
   * Règles :
   *   - Compte inexistant  → créé AVEC un mot de passe simple (retourné).
   *   - Compte PARENT      → mot de passe RÉGÉNÉRÉ (les identifiants envoyés
   *                          sont toujours auto-porteurs : mot de passe valide).
   *   - Compte staff partagé (role ≠ PARENT — ex. enseignant également parent
   *     d'un élève) → mot de passe JAMAIS écrasé (il connaît déjà le sien) :
   *                          password=null → « utilisez votre mot de passe
   *                          habituel » dans les messages.
   *
   * @returns { userId, password } — password en clair UNIQUEMENT pour l'envoi
   * immédiat au parent (jamais stocké en clair en base : bcrypt uniquement).
   */
  async regeneratePasswordForGuardian(guardianId: string): Promise<{ userId: string; password: string | null }> {
    if (!guardianId) {
      throw new NotFoundException('guardianId is required');
    }

    // 1. Garantir que le compte existe (créé avec mot de passe si besoin)
    const ensured = await this.ensureUserForGuardian(guardianId);
    if (ensured.password) {
      return { userId: ensured.userId, password: ensured.password };
    }

    // 2. Compte déjà existant : ne JAMAIS écraser le mot de passe d'un compte
    //    staff partagé (enseignant/directeur également parent d'un élève).
    const user = await this.prisma.user.findUnique({
      where: { id: ensured.userId },
      select: { id: true, role: true },
    });
    if (user && user.role !== 'PARENT') {
      this.logger.warn(
        `User ${user.id} (role=${user.role}) lié au guardian ${guardianId} — mot de passe NON régénéré (compte staff partagé, il utilise son mot de passe habituel)`,
      );
      return { userId: user.id, password: null };
    }

    // 3. Compte PARENT → régénérer un mot de passe simple (les identifiants
    //    renvoyés sont toujours auto-porteurs : ce mot de passe est VALIDE).
    const password = ParentUserProvisioningService.generateSimplePassword();
    await this.prisma.user.update({
      where: { id: ensured.userId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    this.logger.log(`Mot de passe parent régénéré pour le guardian ${guardianId} (user ${ensured.userId})`);
    return { userId: ensured.userId, password };
  }

  /**
   * Variant: ensure User exists for a guardian identified by phone number.
   * Useful for the finance module which only knows the parent's phone.
   */
  async ensureUserForGuardianByPhone(
    tenantId: string,
    phone: string,
  ): Promise<{ userId: string; guardianId: string; created: boolean } | null> {
    if (!tenantId || !phone) return null;

    const guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId,
        phone: phone,
      },
    });
    if (!guardian) {
      this.logger.warn(`No guardian found for tenant=${tenantId}, phone=${phone}`);
      return null;
    }

    const { userId, created } = await this.ensureUserForGuardian(guardian.id);
    return { userId, guardianId: guardian.id, created };
  }

  /**
   * Variant: ensure User exists for a guardian identified by student ID.
   * Useful for the finance module which knows the student but not the guardian.
   * Uses the isPrimary=true guardian (or falls back to any guardian).
   */
  async ensureUserForPrimaryGuardianOfStudent(
    tenantId: string,
    studentId: string,
  ): Promise<{ userId: string; guardianId: string; created: boolean } | null> {
    if (!tenantId || !studentId) return null;

    // Find the primary guardian for this student
    const studentGuardian = await this.prisma.studentGuardian.findFirst({
      where: {
        studentId,
        guardian: { tenantId },
      },
      orderBy: [{ isPrimary: 'desc' }],
      include: { guardian: true },
    });
    if (!studentGuardian) {
      this.logger.warn(`No guardian found for tenant=${tenantId}, student=${studentId}`);
      return null;
    }

    const { userId, created } = await this.ensureUserForGuardian(studentGuardian.guardianId);
    return { userId, guardianId: studentGuardian.guardianId, created };
  }
}
