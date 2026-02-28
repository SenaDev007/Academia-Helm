/**
 * ============================================================================
 * PUBLIC VERIFICATION SERVICE - QR CARTE SCOLAIRE (VÉRIFICATION PUBLIQUE)
 * ============================================================================
 * Token = SHA256(randomBytes(32)), aucun matricule/tenant dans le QR.
 * URL : https://verify.academiahelm.com/v/{token}
 * Réponse : Nom, École, Année active, Statut, Photo — pas d'info sensible.
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

const REGENERATE_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 min entre deux régénérations

@Injectable()
export class PublicVerificationService {
  private readonly logger = new Logger(PublicVerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** URL publique de vérification (sans tenant/matricule) */
  getPublicVerifyUrl(token: string): string {
    const base = process.env.PUBLIC_VERIFY_URL || 'https://verify.academiahelm.com';
    return `${base.replace(/\/$/, '')}/v/${encodeURIComponent(token)}`;
  }

  /** Génère l'image QR en Data URL (errorCorrectionLevel H, 300px) */
  async generateQRDataURL(publicUrl: string): Promise<string> {
    try {
      const QRCode = await import('qrcode');
      return QRCode.toDataURL(publicUrl, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
      });
    } catch {
      this.logger.warn('qrcode package not available, returning empty QR');
      return '';
    }
  }

  /**
   * Journalise une tentative de vérification (rate limiting, audit)
   */
  async logVerification(tokenId: string | null, ipAddress: string | null, result: 'VALID' | 'INVALID' | 'EXPIRED'): Promise<void> {
    try {
      await this.prisma.publicVerificationLog.create({
        data: { tokenId, ipAddress, result },
      });
    } catch (e) {
      this.logger.warn(`Verification log failed: ${(e as Error).message}`);
    }
  }

  /**
   * Génère un token de vérification publique (SHA256 cryptographiquement fort, pas de payload sensible)
   */
  async generateVerificationToken(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
    // Vérifier que l'élève existe et est actif
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
        status: 'ACTIVE',
      },
      include: {
        identifier: true,
        academicYear: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé ou inactif');
    }

    if (!(student as any).matricule && !student.identifier) {
      throw new BadRequestException('L\'élève doit avoir un matricule institutionnel pour générer un token de vérification');
    }

    // Vérifier si un token actif existe déjà pour cette année
    const existingToken = await this.prisma.publicVerificationToken.findFirst({
      where: {
        tenantId,
        entityId: studentId,
        academicYearId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingToken) {
      // Retourner le token existant
      return {
        token: existingToken.token,
        tokenHash: existingToken.tokenHash,
        expiresAt: existingToken.expiresAt,
      };
    }

    // Calculer la date d'expiration (fin année scolaire + 1 mois)
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new NotFoundException('Année scolaire non trouvée');
    }

    const expiresAt = new Date(academicYear.endDate);
    expiresAt.setMonth(expiresAt.getMonth() + 1); // +1 mois après la fin de l'année

    // Token = SHA256(randomBytes(32)) — aucun matricule/tenant dans le QR
    const rawToken = crypto.randomBytes(32).toString('hex');
    const token = crypto.createHash('sha256').update(rawToken).digest('hex');

    const verificationToken = await this.prisma.publicVerificationToken.create({
      data: {
        tenantId,
        entityType: 'STUDENT',
        entityId: studentId,
        tokenHash: token,
        token,
        academicYearId,
        expiresAt,
        isActive: true,
      },
    });

    this.logger.log(`Token de vérification généré pour l'élève ${studentId}`);

    return {
      token: verificationToken.token,
      tokenHash: verificationToken.tokenHash,
      expiresAt: verificationToken.expiresAt,
    };
  }

  /**
   * Retourne l'URL publique et l'image QR pour le dossier élève / carte scolaire
   */
  async getStudentQRForDossier(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ): Promise<{ publicUrl: string; qrImage: string; isActive: boolean }> {
    let record = await this.prisma.publicVerificationToken.findFirst({
      where: { tenantId, entityId: studentId, academicYearId, isActive: true },
    });
    if (!record || record.expiresAt <= new Date()) {
      await this.generateVerificationToken(tenantId, studentId, academicYearId);
      record = await this.prisma.publicVerificationToken.findFirst({
        where: { tenantId, entityId: studentId, academicYearId },
      });
    }
    if (!record) throw new NotFoundException('Token de vérification non trouvé');
    const publicUrl = this.getPublicVerifyUrl(record.token);
    const qrImage = await this.generateQRDataURL(publicUrl);
    return {
      publicUrl,
      qrImage,
      isActive: record.isActive && record.expiresAt > new Date(),
    };
  }

  /**
   * Désactive tous les tokens d'un élève (ex. élève suspendu)
   */
  async deactivateTokensForStudent(studentId: string): Promise<void> {
    const r = await this.prisma.publicVerificationToken.updateMany({
      where: { entityId: studentId, isActive: true },
      data: { isActive: false },
    });
    if (r.count > 0) this.logger.log(`Tokens désactivés pour l'élève ${studentId}`);
  }

  /**
   * Régénère le token (désactive l'ancien, crée un nouveau). Limite : 1 fois toutes les 5 min.
   */
  async regenerateToken(tenantId: string, studentId: string, academicYearId: string): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
    const last = await this.prisma.publicVerificationToken.findFirst({
      where: { tenantId, entityId: studentId, academicYearId },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < REGENERATE_MIN_INTERVAL_MS) {
      throw new BadRequestException('Régénération possible dans quelques minutes (anti-abus)');
    }
    await this.prisma.publicVerificationToken.updateMany({
      where: { tenantId, entityId: studentId, academicYearId },
      data: { isActive: false },
    });
    return this.generateVerificationToken(tenantId, studentId, academicYearId);
  }

  /**
   * Valide un token (URL /v/:token). Retourne Nom, École, Année, Statut, Photo — pas de tenant/matricule sensible.
   * @param ipAddress pour journalisation (rate limiting, audit)
   */
  async verifyToken(token: string, ipAddress?: string | null): Promise<{
    student: {
      id: string;
      firstName: string;
      lastName: string;
      dateOfBirth?: Date;
      gender?: string;
      photo?: string;
      matricule: string;
      class?: string;
      level?: string;
      academicYear: string;
      status: string;
      institution: string;
    };
    isValid: boolean;
    isExpired: boolean;
    message?: string;
  }> {
    const lookupHash = token.length === 64 && /^[a-f0-9]+$/i.test(token)
      ? token
      : crypto.createHash('sha256').update(token).digest('hex');
    const verificationToken = await this.prisma.publicVerificationToken.findUnique({
      where: { tokenHash: lookupHash },
      include: {
        student: {
          include: {
            identifier: true,
            tenant: {
              include: {
                schools: {
                  take: 1,
                },
              },
            },
            studentEnrollments: {
              where: {
                status: 'ACTIVE',
              },
              include: {
                class: true,
                schoolLevel: true,
              },
              take: 1,
            },
            academicYear: true,
          },
        },
      },
    });

    if (!verificationToken) {
      await this.logVerification(null, ipAddress ?? null, 'INVALID');
      return {
        student: null as any,
        isValid: false,
        isExpired: false,
        message: 'Carte invalide ou désactivée',
      };
    }

    const isExpired = verificationToken.expiresAt < new Date();
    const isActive = verificationToken.isActive && !isExpired;

    if (!isActive) {
      await this.logVerification(verificationToken.id, ipAddress ?? null, isExpired ? 'EXPIRED' : 'INVALID');
      return {
        student: null as any,
        isValid: false,
        isExpired,
        message: 'Carte invalide ou désactivée',
      };
    }

    await this.logVerification(verificationToken.id, ipAddress ?? null, 'VALID');

    // Incrémenter le compteur de vérifications
    await this.prisma.publicVerificationToken.update({
      where: { id: verificationToken.id },
      data: {
        verificationCount: {
          increment: 1,
        },
        lastVerifiedAt: new Date(),
      },
    });

    const student = verificationToken.student;
    const enrollment = student.studentEnrollments?.[0];
    const institution = student.tenant.schools?.[0]?.name || student.tenant.name;

    const fullName = [student.firstName, student.lastName].filter(Boolean).join(' ').trim();
    return {
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName,
        dateOfBirth: student.dateOfBirth || undefined,
        gender: student.gender || undefined,
        photo: (student as any).photoUrl || undefined,
        matricule: (student as any).matricule ?? student.identifier?.globalMatricule ?? 'N/A',
        class: enrollment?.class?.name || undefined,
        level: enrollment?.schoolLevel?.label || undefined,
        academicYear: student.academicYear.name,
        status: student.status,
        institution,
        school: institution,
      },
      isValid: true,
      isExpired: false,
    };
  }

  /**
   * Renouvelle un token pour une nouvelle année scolaire
   */
  async renewTokenForNewYear(
    tenantId: string,
    studentId: string,
    oldAcademicYearId: string,
    newAcademicYearId: string,
  ): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
    // Désactiver l'ancien token
    await this.prisma.publicVerificationToken.updateMany({
      where: {
        tenantId,
        entityId: studentId,
        academicYearId: oldAcademicYearId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Générer un nouveau token
    return this.generateVerificationToken(tenantId, studentId, newAcademicYearId);
  }

  /**
   * Récupère les statistiques de vérification
   */
  async getVerificationStats(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const tokens = await this.prisma.publicVerificationToken.findMany({
      where,
      include: {
        student: true,
      },
    });

    return {
      total: tokens.length,
      active: tokens.filter(t => t.isActive && t.expiresAt > new Date()).length,
      expired: tokens.filter(t => t.expiresAt <= new Date()).length,
      totalVerifications: tokens.reduce((sum, t) => sum + t.verificationCount, 0),
      byAcademicYear: tokens.reduce((acc, t) => {
        const year = t.academicYearId;
        acc[year] = (acc[year] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

