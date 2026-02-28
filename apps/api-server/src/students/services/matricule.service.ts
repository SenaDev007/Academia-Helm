/**
 * Génération du matricule élève Academia Helm (identifiant interne par établissement).
 * Trois identifiants distincts : matricule Academia Helm (ici) ; NPI (identification personnelle Bénin) ; numéro Educmaster (plateforme MEMP).
 * Format : [CODE_ECOLE][ANNEE_INSCRIPTION_2CHIFFRES][SEQUENCE_5CHIFFRES] ex. CSJ24000124
 * Jamais exposé côté client en écriture ; génération backend uniquement dans une transaction.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

const SEQUENCE_PAD = 5;

@Injectable()
export class MatriculeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retourne le code école (slug tenant, nettoyé, max 6 caractères)
   */
  async getSchoolCode(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return (tenant.slug || 'AH').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AH';
  }

  /**
   * Génère le prochain matricule dans une transaction (à appeler depuis une tx existante).
   * Incrémente la séquence, retourne le matricule au format CODE + YY + SEQ (ex. CSJ24000124).
   */
  async generateInTransaction(
    tx: Omit<Prisma.TransactionClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'>,
    tenantId: string,
    schoolCode: string,
    enrollmentYear: number,
  ): Promise<string> {
    const seq = await tx.studentNumberSequence.upsert({
      where: { tenantId },
      create: { tenantId, current: 1 },
      update: { current: { increment: 1 } },
    });
    const padded = String(seq.current).padStart(SEQUENCE_PAD, '0');
    const yy = String(enrollmentYear).slice(-2);
    return `${schoolCode}${yy}${padded}`;
  }

  /**
   * Génère un matricule pour un nouvel élève (transaction complète).
   * À utiliser lors de la création Student (preRegister / admission).
   */
  async generate(
    tenantId: string,
    academicYearId: string,
  ): Promise<{ matricule: string; enrollmentYear: number }> {
    const schoolCode = await this.getSchoolCode(tenantId);
    const year = await this.getEnrollmentYearFromAcademicYear(academicYearId);

    const matricule = await this.prisma.$transaction(async (tx) => {
      return this.generateInTransaction(tx, tenantId, schoolCode, year);
    });

    return { matricule, enrollmentYear: year };
  }

  /**
   * Année d'inscription (4 chiffres) à partir de l'année scolaire — utilisable par lifecycle / create.
   */
  async getEnrollmentYearFromAcademicYear(academicYearId: string): Promise<number> {
    const ay = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { name: true, startDate: true },
    });
    if (!ay) throw new NotFoundException('Academic year not found');
    const match = ay.name?.match(/\d{4}/);
    if (match) return parseInt(match[0], 10);
    return ay.startDate ? new Date(ay.startDate).getFullYear() : new Date().getFullYear();
  }
}
