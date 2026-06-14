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
import { PrismaService } from '../../database/prisma.service';
import { EmailService } from '../../communication/services/email.service';
import { UserRole, ROLE_PORTAL_MAP, Portal } from '../../common/enums/user-role.enum';
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
        select: { id: true, name: true, slug: true, subdomain: true, abbreviation: true },
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
   * Rédigé avec le style ghostwriter senior, palette Academia Helm.
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
    } = params;

    const roleLabel = ROLE_LABELS[userRole] || userRole;
    const portalLabel = PORTAL_LABELS[portal] || 'Portail École';
    const displayName = `${staffFirstName} ${staffLastName}`.trim() || 'Collaborateur';
    const loginLabel = isTeacher ? 'Matricule' : 'Adresse email';

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vos identifiants Academia Helm</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #F7F9FC;
      color: #0F172A;
      line-height: 1.6;
    }

    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(10, 42, 94, 0.08);
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #0A2A5E 0%, #0D3B85 60%, #114FC4 100%);
      padding: 40px 32px 32px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 30% 50%, rgba(242, 201, 76, 0.08) 0%, transparent 50%);
      pointer-events: none;
    }
    .header-logo {
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin-bottom: 4px;
    }
    .header-logo span {
      color: #F2C94C;
    }
    .header-tagline {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 500;
    }

    /* ── Welcome ── */
    .welcome-section {
      padding: 36px 32px 24px;
    }
    .welcome-greeting {
      font-size: 20px;
      font-weight: 700;
      color: #0A2A5E;
      margin-bottom: 16px;
    }
    .welcome-text {
      font-size: 14px;
      color: #334155;
      line-height: 1.7;
    }
    .welcome-text strong {
      color: #0A2A5E;
    }

    /* ── Credentials Card ── */
    .credentials-card {
      margin: 0 24px 24px;
      background: linear-gradient(135deg, #F7F9FC 0%, #EEF2F8 100%);
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      overflow: hidden;
    }
    .credentials-header {
      background: #0A2A5E;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .credentials-header-icon {
      width: 20px;
      height: 20px;
      background: rgba(242, 201, 76, 0.2);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
    }
    .credentials-header-text {
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .credentials-body {
      padding: 20px;
    }
    .credential-row {
      display: flex;
      align-items: flex-start;
      padding: 12px 0;
      border-bottom: 1px solid #E2E8F0;
    }
    .credential-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .credential-label {
      font-size: 11px;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      min-width: 130px;
      padding-top: 2px;
    }
    .credential-value {
      font-size: 14px;
      color: #0A2A5E;
      font-weight: 600;
      word-break: break-all;
    }
    .credential-value.password {
      font-family: 'Courier New', monospace;
      font-size: 15px;
      color: #CFA63A;
      background: #FFFBEB;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #FDE68A;
      letter-spacing: 1px;
    }
    .credential-value.role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      background: #EEF2FF;
      color: #0A2A5E;
      border: 1px solid #C7D2FE;
    }
    ${schoolLevel ? `
    .credential-value.level-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    ` : ''}

    /* ── CTA Button ── */
    .cta-section {
      padding: 0 32px 32px;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      padding: 14px 40px;
      background: linear-gradient(135deg, #0A2A5E 0%, #114FC4 100%);
      color: #ffffff;
      text-decoration: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 16px rgba(10, 42, 94, 0.3);
      transition: all 0.2s ease;
    }
    .cta-button:hover {
      box-shadow: 0 6px 24px rgba(10, 42, 94, 0.4);
      transform: translateY(-1px);
    }

    /* ── Security Notice ── */
    .security-notice {
      margin: 0 24px 24px;
      padding: 16px 20px;
      background: #FFF7ED;
      border: 1px solid #FED7AA;
      border-radius: 10px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .security-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .security-text {
      font-size: 12px;
      color: #9A3412;
      line-height: 1.6;
    }
    .security-text strong {
      color: #7C2D12;
    }

    /* ── Footer ── */
    .footer {
      background: #0A2A5E;
      padding: 28px 32px;
      text-align: center;
    }
    .footer-brand {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .footer-brand span {
      color: #F2C94C;
    }
    .footer-copyright {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
    }
    .footer-tagline {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.25);
      margin-top: 6px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <div class="header-logo">Academia <span>Helm</span></div>
      <div class="header-tagline">Plateforme de pilotage éducatif</div>
    </div>

    <!-- Welcome -->
    <div class="welcome-section">
      <div class="welcome-greeting">Bienvenue, ${displayName}.</div>
      <div class="welcome-text">
        Votre intégration au sein de <strong>${schoolName}</strong> est désormais finalisée. 
        Votre contrat a été signé et votre dossier est activé sur la plateforme 
        <strong>Academia Helm</strong>. Vous trouverez ci-dessous vos identifiants de connexion 
        qui vous permettent d'accéder à votre espace personnel dès maintenant.
      </div>
    </div>

    <!-- Credentials Card -->
    <div class="credentials-card">
      <div class="credentials-header">
        <div class="credentials-header-icon">&#128273;</div>
        <div class="credentials-header-text">VOS IDENTIFIANTS DE CONNEXION</div>
      </div>
      <div class="credentials-body">
        <div class="credential-row">
          <div class="credential-label">${loginLabel}</div>
          <div class="credential-value">${username}</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Mot de passe</div>
          <div class="credential-value password">${password}</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Accréditation</div>
          <div class="credential-value role-badge">${roleLabel}</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Portail</div>
          <div class="credential-value">${portalLabel}</div>
        </div>
        ${schoolLevel ? `
        <div class="credential-row">
          <div class="credential-label">Niveau scolaire</div>
          <div class="credential-value">${schoolLevel}</div>
        </div>
        ` : ''}
      </div>
    </div>

    <!-- CTA -->
    <div class="cta-section">
      <a href="${loginUrl}" class="cta-button">Accéder à ma plateforme</a>
    </div>

    <!-- Security Notice -->
    <div class="security-notice">
      <div class="security-icon">&#9888;&#65039;</div>
      <div class="security-text">
        <strong>Sécurité de votre compte :</strong> Ce mot de passe est temporaire et doit être 
        modifié dès votre première connexion. Ne partagez jamais vos identifiants avec qui que 
        ce soit. Academia Helm ne vous demandera jamais votre mot de passe par email ou par téléphone.
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-brand">Academia <span>Helm</span></div>
      <div class="footer-copyright">&copy; 2021-2026 YEHI OR Tech. Tous droits réservés.</div>
      <div class="footer-tagline">Prenez le gouvernail de votre institution</div>
    </div>
  </div>
</body>
</html>`;

    const text = `
Academia Helm — Vos identifiants de connexion

Bonjour ${displayName},

Votre intégration au sein de ${schoolName} est finalisée. Voici vos identifiants pour accéder à la plateforme Academia Helm :

${loginLabel} : ${username}
Mot de passe : ${password}
Accréditation : ${roleLabel}
Portail : ${portalLabel}
${schoolLevel ? `Niveau scolaire : ${schoolLevel}` : ''}

Connectez-vous : ${loginUrl}

IMPORTANT : Ce mot de passe est temporaire. Veuillez le modifier dès votre première connexion. Ne partagez jamais vos identifiants.

— Academia Helm
© 2021-2026 YEHI OR Tech
`;

    await this.emailService.sendEmail({
      to,
      subject: `${schoolName} — Vos identifiants Academia Helm`,
      html,
      text,
      from: process.env.EMAIL_FROM_NOREPLY || 'noreply@academiahelm.com',
      fromName: 'Academia Helm',
    });
  }
}
