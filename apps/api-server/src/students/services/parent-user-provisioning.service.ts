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
 * ⭐ 16/11/2026 (fix 1.0.8, retour promoteur) — COMPTE PARENT DÉDIÉ : un
 *    guardian n'est PLUS lié à un User non-PARENT (collision d'email avec un
 *    compte staff — ex. l'enseignant d'une autre école du groupe qui est
 *    aussi parent). La réutilisation d'un User existant par email ne se fait
 *    QUE pour un User role=PARENT (architecture multi-écoles) ; sinon un
 *    compte PARENT dédié est créé (email de repli guardian-{id}@no-email.local
 *    si l'email réel est déjà pris) — le compte staff n'est jamais modifié.
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

    // 3. Look up existing User by email (in case it was created out-of-band).
    //    ⭐ 16/11/2026 (fix 1.0.8) : réutilisation UNIQUEMENT d'un compte
    //    PARENT — un compte staff partageant l'email ne doit JAMAIS être lié
    //    à un guardian (sinon le parent ne peut pas recevoir de mot de passe :
    //    bug « votre mot de passe habituel »).
    let user: any = null;
    if (normalizedEmail) {
      user = await this.prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          tenantId: guardian.tenantId,
          role: 'PARENT',
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
          // exists. D'ABORD un PARENT dans le même tenant (course classique)…
          user = await this.prisma.user.findFirst({
            where: {
              email: { equals: normalizedEmail, mode: 'insensitive' },
              tenantId: guardian.tenantId,
              role: 'PARENT',
            },
          });
          if (user) {
            this.logger.warn(`Race condition: User with email ${normalizedEmail} was created concurrently. Reusing it.`);
          } else {
            // …SINON un PARENT dans un AUTRE tenant (⭐ 2026-09-19 : même parent
            // inscrit dans deux écoles du groupe — users.email est GLOBALEMENT
            // unique). Le User existant est réutilisé et lié via guardian.userId :
            // c'est l'architecture multi-écoles prévue (un user peut gérer
            // plusieurs écoles).
            // ⭐ 16/11/2026 (fix 1.0.8) : PARENT uniquement — un compte STAFF
            // (enseignant/directeur…) partageant cet email n'est PAS réutilisé.
            user = await this.prisma.user.findFirst({
              where: {
                email: { equals: normalizedEmail, mode: 'insensitive' },
                role: 'PARENT',
              },
            });
            if (user) {
              this.logger.warn(
                `User with email ${normalizedEmail} exists in another tenant (${user.tenantId}) — reused for guardian ${guardian.id} of tenant ${guardian.tenantId} (multi-école)`,
              );
            }
          }
          if (!user) {
            // ⭐ 16/11/2026 (fix 1.0.8) : l'email est pris par un compte STAFF
            // (même tenant ou autre) — on crée un compte PARENT DÉDIÉ avec
            // l'email de repli déterministe. Le compte staff reste intact.
            const fallbackEmail = `guardian-${guardian.id}@no-email.local`;
            this.logger.warn(
              `Email ${normalizedEmail} déjà pris par un compte non-PARENT — création d'un compte PARENT dédié avec l'email de repli ${fallbackEmail}`,
            );
            createdPassword = ParentUserProvisioningService.generateSimplePassword();
            user = await this.prisma.user.create({
              data: {
                id: randomUUID(),
                tenantId: guardian.tenantId,
                email: fallbackEmail,
                firstName: guardian.firstName,
                lastName: guardian.lastName,
                role: 'PARENT',
                status: 'active',
                passwordHash: await bcrypt.hash(createdPassword, 10),
              },
            });
            created = true;
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
   *   - ⭐ 16/11/2026 (fix 1.0.8) — compte staff lié par erreur (role ≠ PARENT,
   *     collision d'email historique — ex. enseignant d'une autre école du
   *     groupe également parent) : un compte PARENT DÉDIÉ est créé (email de
   *     repli guardian-{id}@no-email.local si l'email réel est pris), le
   *     guardian est RE-LIÉ vers ce nouveau compte et un mot de passe SIMPLE
   *     est généré. Le compte staff n'est JAMAIS modifié.
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

    // 2. Compte lié non-PARENT (lien historique erroné — bug « votre mot de
    //    passe habituel ») → SPLIT : compte PARENT dédié + re-lien + mot de
    //    passe réel. Le compte staff reste strictement intact.
    const user = await this.prisma.user.findUnique({
      where: { id: ensured.userId },
      select: { id: true, role: true, email: true },
    });
    if (user && user.role !== 'PARENT') {
      this.logger.warn(
        `User ${user.id} (role=${user.role}) lié au guardian ${guardianId} — création d'un compte PARENT dédié et re-lien (le compte staff n'est pas modifié)`,
      );
      const guardian = await this.prisma.guardian.findUnique({ where: { id: guardianId } });
      if (!guardian) {
        throw new NotFoundException(`Guardian not found: ${guardianId}`);
      }
      const { user: dedicatedUser, password } = await this.createDedicatedParentUser(guardian);
      await this.prisma.guardian.update({
        where: { id: guardianId },
        data: { userId: dedicatedUser.id },
      });
      this.logger.log(
        `Compte PARENT dédié ${dedicatedUser.id} créé et re-lié au guardian ${guardianId}` +
        ` (ancien user ${user.id} role=${user.role} intact)`,
      );
      return { userId: dedicatedUser.id, password };
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
   * ⭐ 16/11/2026 (fix 1.0.8) — Crée un compte PARENT DÉDIÉ pour un guardian
   * dont le lien actuel pointe vers un compte staff (ou dont l'email est déjà
   * pris par un compte non-PARENT). Essaie d'abord l'email réel du guardian ;
   * s'il est globalement pris (users.email @unique), retombe sur l'email
   * déterministe guardian-{guardianId}@no-email.local (connexion par
   * téléphone). Le mot de passe simple est généré et retourné en clair pour
   * l'envoi immédiat — jamais stocké en clair (bcrypt).
   */
  private async createDedicatedParentUser(guardian: any): Promise<{ user: any; password: string }> {
    const normalizedEmail = guardian.email?.trim().toLowerCase() || null;
    const fallbackEmail = `guardian-${guardian.id}@no-email.local`;
    const password = ParentUserProvisioningService.generateSimplePassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const baseData: any = {
      id: randomUUID(),
      tenantId: guardian.tenantId,
      firstName: guardian.firstName,
      lastName: guardian.lastName,
      role: 'PARENT',
      status: 'active',
      passwordHash,
    };

    // 1. Essai avec l'email réel du guardian (permet la connexion par email)
    if (normalizedEmail && normalizedEmail !== fallbackEmail) {
      try {
        const user = await this.prisma.user.create({
          data: { ...baseData, email: normalizedEmail },
        });
        return { user, password };
      } catch (err: any) {
        if (err?.code !== 'P2002') {
          throw err; // erreur inattendue — pas un conflit d'email
        }
        this.logger.warn(
          `Email ${normalizedEmail} déjà pris par un compte non-PARENT — compte PARENT dédié créé avec l'email de repli ${fallbackEmail}`,
        );
      }
    }

    // 2. Repli : email déterministe local (connexion par téléphone)
    const user = await this.prisma.user.create({
      data: { ...baseData, email: fallbackEmail },
    });
    return { user, password };
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
