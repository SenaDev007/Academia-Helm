/**
 * ============================================================================
 * STAFF CREDENTIAL SERVICE - CRÉATION AUTOMATIQUE DE CREDENTIALS
 * ============================================================================
 * 
 * Lorsqu'un employé signe son contrat et devient ACTIF, ce service :
 * 1. Crée automatiquement un compte utilisateur (User) dans le système d'auth
 * 2. Mappe le roleType du Staff vers le rôle plateforme correspondant
 * 3. Génère un mot de passe temporaire sécurisé
 * 4. Envoie un email professionnel avec les credentials, le niveau
 *    d'accréditation et le lien du sous-domaine de l'école
 * 
 * Règles d'identification :
 *   - Enseignants : identifiant = matricule (tenantMatricule)
 *   - Autres personnel : identifiant = adresse email
 * 
 * Design V2 : Palette Academia Helm
 *   - Navy #0A2A5E / Gold #F2C94C
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { UserRole, ROLE_PORTAL_MAP, Portal } from '../../common/enums/user-role.enum';
import { ADMIN_ROLE_TO_USER_ROLE, resolveUserRoleWithLevel, resolveAggregatedUserRole } from '../../common/constants/admin-roles';
import { renderCredentialEmail, TenantBranding } from '../recruitment-email-templates';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

/**
 * Politique de mot de passe chargée depuis les SecuritySettings du tenant.
 * Si aucun paramètre n'est trouvé, on utilise les valeurs par défaut.
 */
interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}

const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: false,
};

const SPECIAL_CHARS = '!@#$%^&*?';

// ── Mapping Staff roleType → UserRole ──
//    (ADMIN_ROLE_TO_USER_ROLE est importé depuis common/constants/admin-roles.ts)

const STAFF_ROLE_TO_USER_ROLE: Record<string, UserRole> = {
  TEACHER: UserRole.ENSEIGNANT,
  ADMIN: UserRole.SECRETAIRE,
  SUPPORT: UserRole.SECRETAIRE,
  DIRECTOR: UserRole.DIRECTEUR,
  OTHER: UserRole.SECRETAIRE,
};

// (ADMIN_ROLE_TO_USER_ROLE est importé depuis common/constants/admin-roles.ts)

// ── Labels lisibles pour les rôles ──

const ROLE_LABELS: Record<string, string> = {
  [UserRole.ENSEIGNANT]: 'Enseignant',
  [UserRole.SECRETAIRE]: 'Secrétaire',
  [UserRole.COMPTABLE]: 'Comptable',
  [UserRole.SECRETAIRE_COMPTABLE]: 'Secrétaire Comptable',
  [UserRole.DIRECTEUR]: 'Directeur',
  [UserRole.CENSEUR]: 'Censeur',
  [UserRole.SURVEILLANT]: 'Surveillant',
  [UserRole.PROMOTEUR]: 'Promoteur',
};

const PORTAL_LABELS: Record<string, string> = {
  [Portal.ECOLE]: 'Portail École',
  [Portal.ENSEIGNANT]: 'Portail Enseignant',
  [Portal.PLATEFORME]: 'Portail Plateforme',
  [Portal.PARENT_ELEVE]: 'Portail Parent/Élève',
};

// ── Refinement: position-based role detection ──

function refineUserRole(roleType: string, position?: string): UserRole {
  // Base mapping
  const baseRole = STAFF_ROLE_TO_USER_ROLE[roleType] || UserRole.SECRETAIRE;

  // If ADMIN type, check position for more specific role
  // ⭐ Ordre IMPORTANT : on vérifie d'abord les rôles les plus spécifiques
  //    (SECRETAIRE_COMPTABLE avant COMPTABLE, SURVEILLANT_GENERAL avant SURVEILLANT)
  //    car "Secrétaire-Comptable" contient "comptable" et matcherait COMPTABLE
  //    si on vérifiait COMPTABLE en premier.
  if (roleType === 'ADMIN' || roleType === 'SUPPORT') {
    const posLower = (position || '').toLowerCase();

    // ── Rôles spécifiques (à vérifier EN PREMIER) ──
    if (posLower.includes('secrétaire comptable') || posLower.includes('secretaire comptable') || posLower.includes('secrétaire-comptable') || posLower.includes('secretaire-comptable')) {
      return UserRole.SECRETAIRE_COMPTABLE;
    }
    if (posLower.includes('surveillant général') || posLower.includes('surveillant general') || posLower.includes('surveillant-général') || posLower.includes('surveillant-general')) {
      return UserRole.SURVEILLANT;
    }
    if (posLower.includes('censeur')) {
      return UserRole.CENSEUR;
    }
    if (posLower.includes('économe') || posLower.includes('econome') || posLower.includes('intendant')) {
      return UserRole.COMPTABLE; // Économe/Intendant → COMPTABLE (gestion financière)
    }
    if (posLower.includes('proviseur') || posLower.includes('directeur des études') || posLower.includes('directeur général') || posLower.includes('directeur adjoint')) {
      return UserRole.DIRECTEUR;
    }

    // ── Rôles génériques (à vérifier EN SECOND) ──
    if (posLower.includes('comptable') || posLower.includes('compta')) {
      return UserRole.COMPTABLE;
    }
    if (posLower.includes('secrétaire') || posLower.includes('secretaire')) {
      return UserRole.SECRETAIRE;
    }
    if (posLower.includes('surveillant') || posLower.includes('surv')) {
      return UserRole.SURVEILLANT;
    }
    if (posLower.includes('directeur') || posLower.includes('director') || posLower.includes('principal')) {
      return UserRole.DIRECTEUR;
    }
  }

  return baseRole;
}

@Injectable()
export class StaffCredentialService {
  private readonly logger = new Logger(StaffCredentialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Crée les credentials pour un employé dont le contrat vient d'être signé.
   * Appelé automatiquement après la transition Staff: PENDING_SIGNATURE → ACTIVE.
   * 
   * @returns Résultat de la création ou null si déjà existant/impossible
   */
  async createCredentialsForStaff(staffId: string, tenantId: string): Promise<{
    created: boolean;
    userId?: string;
    username?: string;
    password?: string;
    role?: string;
    emailSent?: boolean;
    error?: string;
  } | null> {
    try {
      // 1. Récupérer le staff avec toutes les infos nécessaires
      const staff = await this.prisma.staff.findFirst({
        where: { id: staffId, tenantId },
        include: {
          schoolLevel: { select: { id: true, name: true, code: true } },
        },
      });

      if (!staff) {
        this.logger.warn(`Staff ${staffId} not found — skipping credential creation`);
        return null;
      }

      // Vérifier que le staff est actif
      if (staff.status !== 'ACTIVE') {
        this.logger.warn(`Staff ${staffId} is not ACTIVE (${staff.status}) — skipping credential creation`);
        return null;
      }

      // Vérifier qu'on a un email
      if (!staff.email) {
        this.logger.warn(`Staff ${staffId} has no email — cannot create credentials`);
        return { created: false, error: 'Aucune adresse email renseignée pour ce personnel' };
      }

      // 2. Vérifier si un utilisateur existe déjà avec cet email
      const existingUser = await this.prisma.user.findFirst({
        where: { email: staff.email.trim().toLowerCase() },
      });

      if (existingUser) {
        // ⭐ FIX CROSS-TENANT (bug « Utilisateur associé non trouvé » du portail
        //    enseignant) : un compte existe déjà avec cet email. Ancien
        //    comportement : échec silencieux (« Un compte existe déjà ») → le
        //    personnel ne pouvait JAMAIS se connecter si le compte existait dans
        //    un autre tenant (loginTeacher cherche le User par email + tenantId).
        //    Nouveau comportement : on délègue à generateOrRegenerateCredentials
        //    qui réassigne le compte au tenant du staff, resynchronise son
        //    identité (prénom/nom/rôle) et génère un nouveau mot de passe
        //    envoyé par email.
        this.logger.log(
          `User already exists for ${staff.email} — delegating to credential regeneration (handles cross-tenant reassignment)`,
        );
        const regen = await this.generateOrRegenerateCredentials(staffId, tenantId);
        return {
          created: regen.success,
          userId: regen.userId,
          username: regen.username,
          emailSent: regen.emailSent,
          error: regen.success ? undefined : (regen.error || regen.message),
        };
      }

      // 3. Déterminer le rôle plateforme
      //    ⭐ Priorité : staff_admin_assignments > refineUserRole(roleType, position)
      //    On cherche d'abord les affectations admin ACTIVES du staff pour
      //    déterminer son rôle précis (SECRETAIRE, COMPTABLE, SECRETAIRE_COMPTABLE,
      //    DIRECTEUR, CENSEUR, SURVEILLANT, etc.). Si aucune affectation, on
      //    fallback sur refineUserRole qui parse staff.position.
      //    ⭐⭐ On utilise resolveUserRoleWithLevel qui prend en compte le
      //        schoolLevelCode de l'affectation pour produire un UserRole
      //        niveau-spécifique (ex: SECRETAIRE_COMPTABLE_MAT_PRI).
      let userRole: UserRole;
      // ⭐ FIX CUMULS (2026-09-06) : toutes les affectations actives sont agrégées
      //    (avant : take:1 → un staff « Directeur + Enseignant » ou multi-postes
      //    perdait ses autres casquettes au moment de créer son compte).
      const adminAssignments = await this.prisma.staffAdminAssignment.findMany({
        where: { staffId, tenantId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
      if (adminAssignments.length > 0) {
        const resolvedRole = resolveAggregatedUserRole(
          adminAssignments.map((a) => ({ adminRole: a.adminRole, schoolLevelCode: a.schoolLevelCode })),
        );
        userRole = resolvedRole as UserRole;
        this.logger.log(`Role determined from admin assignments (aggregated): ${adminAssignments.map((a) => `${a.adminRole}@${a.schoolLevelCode}`).join(' + ')} → ${userRole}`);
      } else {
        userRole = refineUserRole(staff.roleType, staff.position);
        this.logger.log(`Role determined from refineUserRole: roleType=${staff.roleType}, position=${staff.position} → ${userRole}`);
      }
      const portal = ROLE_PORTAL_MAP[userRole] || Portal.ECOLE;

      // 4. Déterminer l'identifiant de connexion
      //    Enseignants → matricule | Autres → email
      const isTeacher = staff.roleType === 'TEACHER';
      let username: string;
      
      if (isTeacher) {
        // Utiliser le tenantMatricule (spécifique à l'école) ou le globalMatricule
        username = staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || staff.email;
        if (!staff.tenantMatricule && !staff.globalMatricule && !staff.employeeNumber) {
          this.logger.warn(`Teacher ${staffId} has no matricule — falling back to email as username`);
        }
      } else {
        username = staff.email.trim().toLowerCase();
      }

      // 5. Générer un mot de passe temporaire sécurisé
      const tempPassword = this.generateSecurePassword(await this.loadPasswordPolicy(tenantId));
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 6. Créer l'utilisateur dans la base
      const user = await this.prisma.user.create({
        data: {
          email: staff.email.trim().toLowerCase(),
          passwordHash: hashedPassword,
          firstName: staff.firstName || '',
          lastName: staff.lastName || '',
          role: userRole,
          tenantId,
          status: 'active',
        },
      });

      this.logger.log(`✅ User created: ${user.id} (${user.email}) with role ${userRole}`);

      // 7. Récupérer les infos du tenant pour le sous-domaine
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: { id: true, name: true, slug: true, subdomain: true },
      });

      const schoolSubdomain = tenant?.subdomain || tenant?.slug || '';
      const schoolName = tenant?.name || 'Academia Helm';
      const baseDomain = process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'https://academiahelm.com';
      
      // Construire l'URL de connexion
      let loginUrl: string;
      if (schoolSubdomain) {
        // Sous-domaine : https://ecole.academiahelm.com
        const domain = baseDomain.replace(/^https?:\/\//, '');
        loginUrl = `https://${schoolSubdomain}.${domain}`;
      } else {
        loginUrl = baseDomain;
      }

      // 8. Envoyer l'email avec les credentials
      let emailSent = false;
      try {
        await this.sendCredentialEmail({
          to: staff.email.trim().toLowerCase(),
          staffFirstName: staff.firstName || '',
          staffLastName: staff.lastName || '',
          username,
          password: tempPassword,
          userRole,
          portal,
          schoolName,
          loginUrl,
          isTeacher,
          schoolLevel: staff.schoolLevel?.name || null,
          tenantId,
          staffId,
        });
        emailSent = true;
        this.logger.log(`📧 Credential email sent to ${staff.email}`);
      } catch (emailErr: any) {
        this.logger.error(`Failed to send credential email to ${staff.email}: ${emailErr?.message}`);
        // Non-blocking — les credentials sont créés même si l'email échoue
      }

      return {
        created: true,
        userId: user.id,
        username,
        password: tempPassword,
        role: userRole,
        emailSent,
      };
    } catch (error: any) {
      this.logger.error(`Error creating credentials for staff ${staffId}: ${error?.message}`);
      return { created: false, error: error?.message };
    }
  }

  /**
   * Génère (ou régénère) les credentials de connexion pour un staff.
   * 
   * Contrairement à `createCredentialsForStaff` qui échoue si un user existe déjà,
   * cette méthode est idempotente :
   *   - Si aucun user n'existe pour l'email du staff → crée un nouvel user
   *   - Si un user existe déjà → met à jour son passwordHash (et son rôle/tenant si nécessaire)
   * 
   * Déclenchée manuellement par l'admin via le bouton "Générer Identifiant"
   * du module RH > Contrats.
   * 
   * @returns { success, message, userId?, username?, email?, emailSent?, error? }
   */
  async generateOrRegenerateCredentials(
    staffId: string,
    tenantId: string,
    triggeredByUserId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    userId?: string;
    username?: string;
    email?: string;
    emailSent?: boolean;
    error?: string;
  }> {
    try {
      // 1. Récupérer le staff avec toutes les infos nécessaires
      const staff = await this.prisma.staff.findFirst({
        where: { id: staffId, tenantId },
        include: {
          schoolLevel: { select: { id: true, name: true, code: true } },
        },
      });

      if (!staff) {
        return {
          success: false,
          message: 'Personnel introuvable',
          error: 'Personnel introuvable',
        };
      }

      // 2. Vérifier que le staff a un statut actif (ACTIVE ou PENDING_SIGNATURE)
      const allowedStatuses = ['ACTIVE', 'PENDING_SIGNATURE'];
      if (!allowedStatuses.includes(staff.status || '')) {
        return {
          success: false,
          message: `Le personnel doit avoir un statut ACTIVE ou PENDING_SIGNATURE (actuel: ${staff.status || 'inconnu'})`,
          error: `Statut invalide: ${staff.status}`,
        };
      }

      // 3. Vérifier qu'on a un email
      if (!staff.email || !staff.email.trim()) {
        return {
          success: false,
          message: 'Aucune adresse email renseignée pour ce personnel. Veuillez d\'abord renseigner son email.',
          error: 'Email manquant',
        };
      }

      const normalizedEmail = staff.email.trim().toLowerCase();

      // 4. Déterminer le rôle plateforme et l'identifiant de connexion
      //    ⭐ Priorité : staff_admin_assignments > refineUserRole(roleType, position)
      //    ⭐⭐ On utilise resolveUserRoleWithLevel pour produire un UserRole
      //        niveau-spécifique (ex: SECRETAIRE_COMPTABLE_MAT_PRI).
      let userRole: UserRole;
      // ⭐ FIX CUMULS (2026-09-06) : agrégation de toutes les affectations actives
      const adminAssignments = await this.prisma.staffAdminAssignment.findMany({
        where: { staffId, tenantId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
      if (adminAssignments.length > 0) {
        const resolvedRole = resolveAggregatedUserRole(
          adminAssignments.map((a) => ({ adminRole: a.adminRole, schoolLevelCode: a.schoolLevelCode })),
        );
        userRole = resolvedRole as UserRole;
        this.logger.log(`[generateOrRegenerate] Role from admin assignments (aggregated): ${adminAssignments.map((a) => `${a.adminRole}@${a.schoolLevelCode}`).join(' + ')} → ${userRole}`);
      } else {
        userRole = refineUserRole(staff.roleType, staff.position);
        this.logger.log(`[generateOrRegenerate] Role from refineUserRole: roleType=${staff.roleType}, position=${staff.position} → ${userRole}`);
      }
      const portal = ROLE_PORTAL_MAP[userRole] || Portal.ECOLE;
      const isTeacher = staff.roleType === 'TEACHER';
      const username = isTeacher
        ? (staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || normalizedEmail)
        : normalizedEmail;

      // 4b. Vérifier si ce personnel a AUSSI un profil enseignant
      // (même s'il est ADMIN/COMPTABLE/DIRECTOR, il peut être habilité à enseigner)
      const teacherProfile = !isTeacher
        ? await this.prisma.teacher.findFirst({
            where: {
              tenantId,
              email: normalizedEmail,
              status: 'active',
            },
          })
        : null;
      const hasTeacherProfile = !isTeacher && !!teacherProfile;
      const teacherMatricule = isTeacher
        ? (staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || '')
        : (teacherProfile?.matricule || '');

      // 5. Générer un mot de passe temporaire sécurisé et le hasher
      const tempPassword = this.generateSecurePassword(await this.loadPasswordPolicy(tenantId));
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 6. Chercher si un user existe déjà avec cet email
      //    ⭐ NOTE : l'email est globalement unique (contrainte @unique sur User.email),
      //    donc findFirst par email seul retrouve le user quel que soit son tenant.
      const existingUser = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      let userId: string;
      let action: 'created' | 'updated';
      let tenantTransferred = false;

      if (existingUser) {
        // ⭐ FIX CROSS-TENANT (bug « Utilisateur associé non trouvé » du portail
        //    enseignant) : si le user existant appartient à un AUTRE tenant (ex:
        //    compte créé dans une autre école avec le même email), le login
        //    enseignant échoue car il cherche le User par email + tenantId.
        //    → On réassigne le user au tenant du staff : la génération
        //      d'identifiants RH est une action administrative explicite du
        //      directeur de CE tenant. On resynchronise aussi son identité
        //      (prénom/nom/rôle) avec la fiche du personnel.
        if (existingUser.tenantId && existingUser.tenantId !== tenantId) {
          tenantTransferred = true;
          this.logger.warn(
            `[generateOrRegenerate] User ${existingUser.id} (${normalizedEmail}) réassigné du tenant ` +
            `${existingUser.tenantId} vers le tenant ${tenantId} (génération d'identifiants RH par l'admin de ce tenant)`,
          );
        }

        // ── Mise à jour du passwordHash (et du rôle / tenant / statut si nécessaire) ──
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash: hashedPassword,
            role: userRole,
            // ⭐ Toujours rattacher au tenant du staff (et non garder l'ancien)
            tenantId,
            status: 'active',
            // ⭐ Resynchroniser l'identité avec la fiche du personnel
            firstName: staff.firstName || existingUser.firstName || '',
            lastName: staff.lastName || existingUser.lastName || '',
          },
        });
        userId = existingUser.id;
        action = 'updated';
        this.logger.log(`🔐 User updated: ${userId} (${normalizedEmail}) — password reset by admin${triggeredByUserId ? ` (${triggeredByUserId})` : ''}${tenantTransferred ? ' [tenant réassigné]' : ''}`);
      } else {
        // ── Création d'un nouvel user ──
        const newUser = await this.prisma.user.create({
          data: {
            email: normalizedEmail,
            passwordHash: hashedPassword,
            firstName: staff.firstName || '',
            lastName: staff.lastName || '',
            role: userRole,
            tenantId,
            status: 'active',
          },
        });
        userId = newUser.id;
        action = 'created';
        this.logger.log(`✅ User created: ${userId} (${normalizedEmail}) with role ${userRole}`);
      }

      // 7. Récupérer les infos du tenant pour l'email (nom, sous-domaine, logo)
      const tenant = await this.prisma.tenant.findFirst({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          subdomain: true,
        },
      });

      const schoolSubdomain = tenant?.subdomain || tenant?.slug || '';
      const schoolName = tenant?.name || 'Academia Helm';
      const schoolLogoUrl = null;
      const baseDomain = process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'https://academiahelm.com';

      // Construire l'URL de connexion
      let loginUrl: string;
      if (schoolSubdomain) {
        const domain = baseDomain.replace(/^https?:\/\//, '');
        loginUrl = `https://${schoolSubdomain}.${domain}/login`;
      } else {
        loginUrl = `${baseDomain}/login`;
      }

      // 8. Envoyer l'email avec les credentials (même si l'user existait déjà — c'est une régénération)
      let emailSent = false;
      try {
        await this.sendCredentialEmail({
          to: normalizedEmail,
          staffFirstName: staff.firstName || '',
          staffLastName: staff.lastName || '',
          username,
          password: tempPassword,
          userRole,
          portal,
          schoolName,
          loginUrl,
          isTeacher,
          schoolLevel: staff.schoolLevel?.name || null,
          logoUrl: schoolLogoUrl,
          schoolContacts: tenant?.schoolSettings
            ? {
                phone: tenant.schoolSettings.phone || null,
                email: tenant.schoolSettings.email || null,
                address: tenant.schoolSettings.address || null,
              }
            : null,
          isRegeneration: action === 'updated',
          tenantId,
          staffId,
          // ⭐ Si le personnel a aussi un profil enseignant, on inclut les
          // identifiants du portail enseignant dans le même email.
          hasTeacherProfile,
          teacherMatricule,
          teacherPortalUrl: hasTeacherProfile ? loginUrl.replace('/login', '/login?portal=teacher') : '',
        });
        emailSent = true;
        this.logger.log(`📧 Credential ${action === 'updated' ? 'reset' : 'creation'} email sent to ${normalizedEmail}${hasTeacherProfile ? ' (includes teacher portal credentials)' : ''}`);
      } catch (emailErr: any) {
        this.logger.error(`Failed to send credential email to ${normalizedEmail}: ${emailErr?.message}`);
        // Non-blocking — les credentials sont créés/mis à jour même si l'email échoue
      }

      const messageParts = [`Identifiants ${action === 'updated' ? 'régénérés' : 'générés'} et envoyés par email à ${normalizedEmail}`];
      if (hasTeacherProfile) {
        messageParts.push(`+ identifiants portail enseignant (matricule: ${teacherMatricule})`);
      }
      if (tenantTransferred) {
        messageParts.push('— le compte existait dans un autre établissement : il a été rattaché à votre école');
      }

      return {
        success: true,
        message: emailSent
          ? messageParts.join(' ')
          : `Identifiants ${action === 'updated' ? 'régénérés' : 'générés'} (l'envoi email a échoué — vérifiez la configuration SMTP)`,
        userId,
        username,
        email: normalizedEmail,
        emailSent,
        hasTeacherProfile,
        teacherMatricule: hasTeacherProfile ? teacherMatricule : undefined,
      };
    } catch (error: any) {
      this.logger.error(`Error generating credentials for staff ${staffId}: ${error?.message}`);
      return {
        success: false,
        message: error?.message || 'Erreur lors de la génération des identifiants',
        error: error?.message,
      };
    }
  }

  /**
   * Charge la politique de mot de passe du tenant depuis les SecuritySettings.
   * Retourne les valeurs par défaut si aucune config n'existe en base.
   */
  private async loadPasswordPolicy(tenantId: string): Promise<PasswordPolicy> {
    try {
      const settings = await this.prisma.securitySettings.findUnique({
        where: { tenantId },
      });
      if (!settings) return { ...DEFAULT_PASSWORD_POLICY };
      return {
        minLength: settings.passwordMinLength ?? DEFAULT_PASSWORD_POLICY.minLength,
        requireUppercase: settings.passwordRequireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
        requireLowercase: settings.passwordRequireLowercase ?? DEFAULT_PASSWORD_POLICY.requireLowercase,
        requireNumbers: settings.passwordRequireNumbers ?? DEFAULT_PASSWORD_POLICY.requireNumbers,
        requireSpecial: settings.passwordRequireSpecial ?? DEFAULT_PASSWORD_POLICY.requireSpecial,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to load password policy for tenant ${tenantId}, using defaults: ${err?.message}`);
      return { ...DEFAULT_PASSWORD_POLICY };
    }
  }

  /**
   * Génère un mot de passe temporaire sécurisé ET conforme à la politique
   * de sécurité du tenant (longueur minimale, complexité).
   *
   * Construction :
   *   - On choisit aléatoirement un adjectif (majuscule au début) pour remplir
   *     l'exigence majuscule.
   *   - On choisit un nom (minuscules) pour remplir l'exigence minuscule.
   *   - On ajoute des chiffres pour l'exigence chiffre.
   *   - On ajoute des caractères spéciaux si exigé.
   *   - On padde avec caractères aléatoires jusqu'à atteindre minLength.
   *   - On termine par un mélange (shuffle) pour éviter un format prédictible.
   */
  private generateSecurePassword(policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): string {
    const adjectives = [
      'Brave', 'Noble', 'Fier', 'Sage', 'Rapide', 'Fort', 'Clair', 'Lumineux',
      'Grand', 'Vif', 'Haut', 'Neuf', 'Vrai', 'Doux', 'Calme', 'Solide',
    ];
    const nouns = [
      'Lion', 'Aigle', 'Phare', 'Helm', 'Pilot', 'Guide', 'Cap', 'Voile',
      'Etoile', 'Flambeau', 'Roc', 'Ocean', 'Mont', 'Arbre', 'Boussole',
    ];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)].toLowerCase();
    const digits = String(crypto.randomInt(100, 999));
    const parts: string[] = [];

    if (policy.requireUppercase) parts.push(adj);
    else parts.push(adj.toLowerCase());
    if (policy.requireLowercase) parts.push(noun);
    if (policy.requireNumbers) parts.push(digits);
    if (policy.requireSpecial) {
      // 1 à 2 caractères spéciaux aléatoires
      const n = crypto.randomInt(1, 3);
      let spec = '';
      for (let i = 0; i < n; i++) spec += SPECIAL_CHARS[crypto.randomInt(0, SPECIAL_CHARS.length)];
      parts.push(spec);
    }

    // Padding aléatoire pour atteindre minLength
    const allChars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = parts.join('');
    while (password.length < policy.minLength) {
      password += allChars[crypto.randomInt(0, allChars.length)];
    }

    // Shuffle pour éviter un format prédictible (maj-min-num-spec)
    password = this.shuffleString(password);

    // Vérification finale — si une exigence n'est pas satisfaite (cas rare),
    // on ajoute le caractère manquant à une position aléatoire.
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ'[crypto.randomInt(0, 23)];
      password = this.insertAt(password, c, crypto.randomInt(0, password.length));
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      const c = 'abcdefghjkmnpqrstuvwxyz'[crypto.randomInt(0, 23)];
      password = this.insertAt(password, c, crypto.randomInt(0, password.length));
    }
    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      const c = String(crypto.randomInt(2, 10));
      password = this.insertAt(password, c, crypto.randomInt(0, password.length));
    }
    if (policy.requireSpecial && !new RegExp(`[${SPECIAL_CHARS}]`).test(password)) {
      const c = SPECIAL_CHARS[crypto.randomInt(0, SPECIAL_CHARS.length)];
      password = this.insertAt(password, c, crypto.randomInt(0, password.length));
    }

    return password;
  }

  private shuffleString(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  private insertAt(str: string, char: string, pos: number): string {
    return str.slice(0, pos) + char + str.slice(pos);
  }

  /**
   * Envoie l'email professionnel contenant les credentials du nouvel utilisateur.
   * Utilise le template standard Helm (renderCredentialEmail) avec header logo+nom école,
   * footer Academia Helm — cohérent avec les autres emails de recrutement.
   */
  private async sendCredentialEmail(params: {
    to: string;
    staffFirstName: string;
    staffLastName: string;
    username: string;
    password: string;
    userRole: string;
    portal: string;
    schoolName: string;
    loginUrl: string;
    isTeacher: boolean;
    schoolLevel?: string | null;
    logoUrl?: string | null;
    schoolContacts?: { phone?: string | null; email?: string | null; address?: string | null } | null;
    isRegeneration?: boolean;
    tenantId?: string;
    staffId?: string;
    hasTeacherProfile?: boolean;
    teacherMatricule?: string;
    teacherPortalUrl?: string;
  }): Promise<void> {
    const {
      to,
      staffFirstName,
      staffLastName,
      username,
      password,
      userRole,
      portal,
      schoolName,
      loginUrl,
      isTeacher,
      schoolLevel,
      isRegeneration = false,
      tenantId,
      staffId,
      hasTeacherProfile = false,
      teacherMatricule = '',
      teacherPortalUrl = '',
    } = params;

    const roleLabel = ROLE_LABELS[userRole] || userRole;
    const portalLabel = PORTAL_LABELS[portal] || 'Portail École';
    const loginLabel = isTeacher ? 'Matricule' : 'Adresse email';

    // ─── Récupérer le branding complet du tenant ──────────────────────────
    // (logo via tenant_identity_profiles, pas le logoUrl null passé en param)
    const branding = tenantId ? await this.getTenantBranding(tenantId) : { schoolName };

    // ─── Générer l'email avec le template standard Helm ────────────────────
    const { subject, html } = renderCredentialEmail({
      branding,
      candidateName: `${staffFirstName} ${staffLastName}`.trim(),
      candidateFirstName: staffFirstName || 'Collaborateur',
      jobTitle: roleLabel,
      username,
      password,
      loginLabel,
      roleLabel,
      portalLabel,
      loginUrl,
      schoolLevel,
      isRegeneration,
    });

    const text = `
${schoolName} — ${isRegeneration ? 'Réinitialisation de vos identifiants' : 'Vos identifiants de connexion'}

Bonjour ${staffFirstName} ${staffLastName},

${isRegeneration ? `Votre compte a été réinitialisé par l'administration de ${schoolName}.` : `Votre intégration au sein de ${schoolName} est finalisée.`}

Voici vos identifiants de connexion :

${loginLabel} : ${username}
Mot de passe : ${password}
Accréditation : ${roleLabel}
Portail : ${portalLabel}
${schoolLevel ? `Niveau scolaire : ${schoolLevel}` : ''}

Connectez-vous : ${loginUrl}
${hasTeacherProfile ? `

═══════════════════════════════════════════
PORTAIL ENSEIGNANT — Vos identifiants supplémentaires
═══════════════════════════════════════════

Vous êtes également habilité(e) à enseigner. Voici vos identifiants pour le portail enseignant :

Matricule enseignant : ${teacherMatricule}
Mot de passe : ${password} (identique à votre compte école)

Connectez-vous au portail enseignant : ${teacherPortalUrl}

IMPORTANT : Vous avez deux comptes avec le même mot de passe.
- Portail École : connectez-vous avec votre adresse email (${username})
- Portail Enseignant : connectez-vous avec votre matricule (${teacherMatricule})
` : ''}
IMPORTANT : Ce mot de passe est temporaire. Veuillez le modifier dès votre première connexion. Ne partagez jamais vos identifiants.

— ${schoolName} — Academia Helm
`;

    await this.emailService.sendCategorized({
      tenantId: tenantId || 'unknown',
      category: 'ADMINISTRATIF',
      subCategory: isRegeneration
        ? 'reinitialisation_identifiants_staff'
        : 'creation_identifiants_staff',
      module: 'hr',
      to,
      toName: `${staffFirstName} ${staffLastName}`.trim() || undefined,
      subject,
      html,
      text,
      fromEmail: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: branding.schoolName, // ← nom de l'école, pas 'Academia Helm'
      recipientType: 'STAFF',
      recipientId: staffId,
      triggeredBy: 'SYSTEM',
      relatedEntityId: staffId,
      relatedEntityType: 'Staff',
    });
  }

  /**
   * Récupère le branding (logo + nom + contact) du tenant.
   * Même logique que recruitment-notification.service.ts getTenantBranding().
   */
  private async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      // 0. Récupérer le RecruiterProfile (config recruteur) pour l'email + signature
      const recruiterProfile = await this.prisma.recruiterProfile
        .findFirst({
          where: { tenantId, isActive: true },
          select: {
            fullName: true,
            email: true,
            phone: true,
            functionLabel: true,
            signatureText: true,
            signatureLogoUrl: true,
          },
        })
        .catch(() => null);

      // 1. Essayer tenant_identity_profiles (identité école)
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });

      if (profile?.schoolName) {
        const apiBaseUrl = this.config.get<string>('APP_PUBLIC_URL')
          || 'https://api.academiahelm.com';
        const logoUrl = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;

        return {
          schoolName: profile.schoolName,
          schoolLogo: logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          recruiterName: recruiterProfile?.fullName,
          recruiterEmail: recruiterProfile?.email,
          recruiterFunction: recruiterProfile?.functionLabel,
          recruiterPhone: recruiterProfile?.phone,
          signatureText: recruiterProfile?.signatureText,
          signatureLogoUrl: recruiterProfile?.signatureLogoUrl,
        };
      }

      // 2. Fallback sur le tenant directement
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return {
        schoolName: tenant?.name || 'Établissement',
        recruiterName: recruiterProfile?.fullName,
        recruiterEmail: recruiterProfile?.email,
        recruiterFunction: recruiterProfile?.functionLabel,
        recruiterPhone: recruiterProfile?.phone,
        signatureText: recruiterProfile?.signatureText,
        signatureLogoUrl: recruiterProfile?.signatureLogoUrl,
      };
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed for tenant ${tenantId}: ${err.message}`);
      return { schoolName: 'Établissement' };
    }
  }
}
