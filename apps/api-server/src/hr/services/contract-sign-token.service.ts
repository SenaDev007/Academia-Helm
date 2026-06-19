/**
 * ============================================================================
 * CONTRACT SIGN TOKEN SERVICE
 * ============================================================================
 *
 * Gère les tokens de signature électronique de contrats par lien magique.
 *
 * Workflow :
 *   1. generateToken(contractId, tenantId)
 *      → Crée un token UUID 32 chars hex + expiration 30 jours
 *      → Retourne le token + l'URL publique de signature
 *
 *   2. validateToken(token)
 *      → Vérifie : existe, non expiré, non utilisé, contrat non déjà signé
 *      → Retourne les infos contrat (sans données sensibles) pour affichage
 *
 *   3. markAsUsed(token, ip, userAgent)
 *      → Marque le token comme utilisé (ne peut plus être réutilisé)
 *      → À appeler APRÈS signContract() réussi
 *
 * Sécurité :
 *   - Token = 32 chars hex (128 bits d'entropie) → impossible à deviner
 *   - Expiration 30 jours (configurable via CONTRACT_SIGN_TOKEN_EXPIRY_DAYS)
 *   - 1 token = 1 signature (usedAt set après usage)
 *   - IP + User-Agent tracés pour audit
 *   - Si contrat déjà signé, le token est invalidé
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { randomBytes } from 'crypto';

export interface ContractSignTokenResult {
  token: string;
  contractId: string;
  signUrl: string;
  expiresAt: Date;
}

export interface ValidatedContractInfo {
  token: string;
  contractId: string;
  tenantId: string;
  // Infos publiques affichées au candidat (pas de données sensibles)
  contractType: string;
  startDate: Date;
  endDate: Date | null;
  baseSalary: number;
  paymentMode: string;
  status: string;
  isAlreadySigned: boolean;
  // Infos staff (pour personnaliser la page)
  staffFirstName: string;
  staffLastName: string;
  staffEmail: string;
  staffPosition: string;
  // Infos établissement (pour personnaliser la page)
  schoolName: string;
  schoolLogoUrl: string | null;
  // Infos employeur déjà signé ?
  employerSignedAt: string | null;
  employerSignerName: string | null;
}

@Injectable()
export class ContractSignTokenService {
  private readonly logger = new Logger(ContractSignTokenService.name);
  private readonly tokenExpiryDays: number;
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Expiration en jours (default: 30)
    this.tokenExpiryDays = parseInt(
      this.configService.get<string>('CONTRACT_SIGN_TOKEN_EXPIRY_DAYS') || '30',
      10,
    );
    // URL publique de l'app (pour construire l'URL de signature)
    this.publicBaseUrl =
      this.configService.get<string>('PUBLIC_WEB_URL') ||
      this.configService.get<string>('APP_PUBLIC_URL') ||
      'https://academiahelm.com';
  }

  /**
   * Génère un token de signature pour un contrat.
   *
   * @param contractId  ID du contrat (doit exister)
   * @param tenantId    ID du tenant (pour sécurité)
   * @returns { token, contractId, signUrl, expiresAt }
   */
  async generateToken(contractId: string, tenantId: string): Promise<ContractSignTokenResult> {
    // Vérifier que le contrat existe et appartient au tenant
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, status: true, signedAt: true },
    });
    if (!contract) {
      throw new NotFoundException(`Contrat ${contractId} non trouvé dans ce tenant`);
    }

    // Si déjà signé, on ne génère pas de token
    if (contract.signedAt) {
      throw new BadRequestException('Ce contrat est déjà signé — pas besoin de token');
    }

    // Générer le token (32 chars hex = 128 bits d'entropie)
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.tokenExpiryDays);

    // Invalider les anciens tokens non utilisés pour ce contrat (si régénération)
    await this.prisma.contractSignToken.updateMany({
      where: {
        contractId,
        usedAt: null,
      },
      data: { usedAt: new Date() }, // Marquer comme utilisés (inutilisables)
    });

    // Créer le nouveau token
    await this.prisma.contractSignToken.create({
      data: {
        contractId,
        tenantId,
        token,
        expiresAt,
      },
    });

    // Construire l'URL publique de signature
    const signUrl = `${this.publicBaseUrl}/sign/contract/${token}`;

    this.logger.log(
      `Token de signature généré pour contrat ${contractId} — expires ${expiresAt.toISOString()}`,
    );

    return { token, contractId, signUrl, expiresAt };
  }

  /**
   * Valide un token et retourne les infos contrat à afficher au candidat.
   *
   * @throws NotFoundException si token inexistant
   * @throws BadRequestException si token expiré, déjà utilisé, ou contrat déjà signé
   */
  async validateToken(token: string): Promise<ValidatedContractInfo> {
    const tokenRecord = await this.prisma.contractSignToken.findUnique({
      where: { token },
      include: {
        contract: {
          include: {
            staff: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                position: true,
              },
            },
            tenant: {
              select: {
                id: true,
                name: true,
                tenantIdentityProfile: {
                  where: { isActive: true },
                  select: { schoolName: true, logoUrl: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new NotFoundException('Token de signature invalide ou introuvable');
    }

    // Vérifier l'expiration
    if (tokenRecord.expiresAt < new Date()) {
      throw new BadRequestException(
        'Ce lien de signature a expiré. Veuillez contacter l\'établissement pour obtenir un nouveau lien.',
      );
    }

    // Vérifier que le token n'a pas déjà été utilisé
    if (tokenRecord.usedAt) {
      throw new BadRequestException(
        'Ce lien de signature a déjà été utilisé. Le contrat a été signé le ' +
          tokenRecord.usedAt.toLocaleDateString('fr-FR') +
          '.',
      );
    }

    const contract = tokenRecord.contract;
    if (!contract) {
      throw new NotFoundException('Contrat associé au token introuvable');
    }

    // Si le contrat a été signé par ailleurs (via admin par ex.), on invalide
    if (contract.signedAt) {
      throw new BadRequestException(
        'Ce contrat a déjà été signé. Aucune action supplémentaire n\'est requise.',
      );
    }

    // Extraire les infos employeur déjà signé (si signature double)
    const terms = (contract.terms as any) || {};
    const tenantProfile = contract.tenant?.tenantIdentityProfile?.[0];

    return {
      token: tokenRecord.token,
      contractId: contract.id,
      tenantId: tokenRecord.tenantId,
      contractType: contract.contractType,
      startDate: contract.startDate,
      endDate: contract.endDate,
      baseSalary: Number(contract.baseSalary),
      paymentMode: contract.paymentMode,
      status: contract.status,
      isAlreadySigned: false,
      staffFirstName: contract.staff?.firstName || '',
      staffLastName: contract.staff?.lastName || '',
      staffEmail: contract.staff?.email || '',
      staffPosition: contract.staff?.position || '',
      schoolName: tenantProfile?.schoolName || contract.tenant?.name || 'Établissement',
      schoolLogoUrl: tenantProfile?.logoUrl || null,
      employerSignedAt: terms.employerSignedAt || null,
      employerSignerName: terms.employerSignerName || null,
    };
  }

  /**
   * Marque un token comme utilisé (après signature réussie).
   * Idempotent : si déjà utilisé, ne fait rien.
   */
  async markAsUsed(token: string, ip?: string, userAgent?: string): Promise<void> {
    await this.prisma.contractSignToken.updateMany({
      where: { token, usedAt: null },
      data: {
        usedAt: new Date(),
        signedByIp: ip || null,
        signedByUserAgent: userAgent ? userAgent.substring(0, 500) : null,
      },
    });
    this.logger.log(`Token de signature ${token.substring(0, 8)}... marqué comme utilisé`);
  }

  /**
   * Récupère le tenantId d'un token (pour le passer à signContract).
   * Utilisé par le endpoint public de signature.
   */
  async getTenantIdForToken(token: string): Promise<string | null> {
    const tokenRecord = await this.prisma.contractSignToken.findUnique({
      where: { token },
      select: { tenantId: true },
    });
    return tokenRecord?.tenantId || null;
  }

  /**
   * Récupère le contractId d'un token.
   */
  async getContractIdForToken(token: string): Promise<string | null> {
    const tokenRecord = await this.prisma.contractSignToken.findUnique({
      where: { token },
      select: { contractId: true },
    });
    return tokenRecord?.contractId || null;
  }
}
