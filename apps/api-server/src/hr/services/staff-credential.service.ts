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
import { renderCredentialEmail, TenantBranding } from '../recruitment-email-templates';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// ── Mapping Staff roleType → UserRole ──

const STAFF_ROLE_TO_USER_ROLE: Record<string, UserRole> = {
  TEACHER: UserRole.ENSEIGNANT,
  ADMIN: UserRole.SECRETAIRE,
  SUPPORT: UserRole.SECRETAIRE,
  DIRECTOR: UserRole.DIRECTEUR,
  OTHER: UserRole.SECRETAIRE,
};

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
  [Portal.FEDERIS]: 'Portail FEDERIS',
};

// ── Refinement: position-based role detection ──

function refineUserRole(roleType: string, position?: string): UserRole {
  // Base mapping
  const baseRole = STAFF_ROLE_TO_USER_ROLE[roleType] || UserRole.SECRETAIRE;

  // If ADMIN type, check position for more specific role
  if (roleType === 'ADMIN' || roleType === 'SUPPORT') {
    const posLower = (position || '').toLowerCase();
    if (posLower.includes('comptable') || posLower.includes('compta')) {
      return UserRole.COMPTABLE;
    }
    if (posLower.includes('secrétaire comptable') || posLower.includes('secretaire comptable')) {
      return UserRole.SECRETAIRE_COMPTABLE;
    }
    if (posLower.includes('censeur')) {
      return UserRole.CENSEUR;
    }
    if (posLower.includes('surveillant') || posLower.includes('surv')) {
      return UserRole.SURVEILLANT;
    }
    if (posLower.includes('directeur') || posLower.includes('director') || posLower.includes('principal') || posLower.includes('proviseur')) {
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
        this.logger.log(`User already exists for ${staff.email} — linking staff to existing user`);
        // Lier le staff à l'utilisateur existant en mettant à jour son tenantId si nécessaire
        if (!existingUser.tenantId && tenantId) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { tenantId },
          });
        }
        return { created: false, error: 'Un compte existe déjà avec cette adresse email' };
      }

      // 3. Déterminer le rôle plateforme
      const userRole = refineUserRole(staff.roleType, staff.position);
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
      const tempPassword = this.generateSecurePassword();
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
      const userRole = refineUserRole(staff.roleType, staff.position);
      const portal = ROLE_PORTAL_MAP[userRole] || Portal.ECOLE;
      const isTeacher = staff.roleType === 'TEACHER';
      const username = isTeacher
        ? (staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || normalizedEmail)
        : normalizedEmail;

      // 5. Générer un mot de passe temporaire sécurisé et le hasher
      const tempPassword = this.generateSecurePassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // 6. Chercher si un user existe déjà avec cet email
      const existingUser = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
      });

      let userId: string;
      let action: 'created' | 'updated';

      if (existingUser) {
        // ── Mise à jour du passwordHash (et du rôle / tenant / statut si nécessaire) ──
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash: hashedPassword,
            role: userRole,
            tenantId: existingUser.tenantId || tenantId,
            status: 'active',
            firstName: existingUser.firstName || staff.firstName || '',
            lastName: existingUser.lastName || staff.lastName || '',
          },
        });
        userId = existingUser.id;
        action = 'updated';
        this.logger.log(`🔐 User updated: ${userId} (${normalizedEmail}) — password reset by admin${triggeredByUserId ? ` (${triggeredByUserId})` : ''}`);
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
        });
        emailSent = true;
        this.logger.log(`📧 Credential ${action === 'updated' ? 'reset' : 'creation'} email sent to ${normalizedEmail}`);
      } catch (emailErr: any) {
        this.logger.error(`Failed to send credential email to ${normalizedEmail}: ${emailErr?.message}`);
        // Non-blocking — les credentials sont créés/mis à jour même si l'email échoue
      }

      return {
        success: true,
        message: emailSent
          ? `Identifiants ${action === 'updated' ? 'régénérés' : 'générés'} et envoyés par email à ${normalizedEmail}`
          : `Identifiants ${action === 'updated' ? 'régénérés' : 'générés'} (l'envoi email a échoué — vérifiez la configuration SMTP)`,
        userId,
        username,
        email: normalizedEmail,
        emailSent,
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
   * Génère un mot de passe temporaire sécurisé et mémorable.
   * Format : MotAdjectif3Chiffres (ex: "BraveLion742")
   */
  private generateSecurePassword(): string {
    const adjectives = [
      'Brave', 'Noble', 'Fier', 'Sage', 'Rapide', 'Fort', 'Clair', 'Lumineux',
      'Grand', 'Vif', 'Haut', 'Neuf', 'Vrai', 'Doux', 'Calme', 'Solide',
    ];
    const nouns = [
      'Lion', 'Aigle', 'Phare', 'Helm', 'Pilot', 'Guide', 'Cap', 'Voile',
      'Etoile', 'Flambeau', 'Roc', 'Ocean', 'Mont', 'Arbre', 'Roc', 'Boussole',
    ];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const digits = crypto.randomInt(100, 999);

    return `${adj}${noun}${digits}`;
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
          || 'https://academia-helm-api.fly.dev';
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
