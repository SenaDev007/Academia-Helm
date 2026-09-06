/**
 * ============================================================================
 * INTERNSHIPS SERVICE — Flux « Stage » séparé de l'embauche salariée (CDC §6)
 * ============================================================================
 *
 * Le stage professionnel relève du Décret n°2018-196 du 23 mai 2018 — un texte
 * DISTINCT du Code du travail. Un stagiaire n'est pas un salarié :
 *   - pas de contrat de travail, pas de bulletin de paie salarié ;
 *   - une gratification (si applicable) — jamais un salaire ;
 *   - une assurance accident du travail OBLIGATOIRE à la charge de
 *     l'établissement d'accueil : la référence de police est exigée avant
 *     toute validation (passage DRAFT → ACTIVE).
 *
 * La convention est générée par le MÊME moteur de documents que les contrats
 * (ContractPdfService — Puppeteer + filigrane acronyme école + hash SHA-256),
 * avec un template juridique distinct (CONVENTION_STAGE).
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { ContractPdfService } from './services/contract-pdf.service';
import { STAGE_STATUTS } from './services/internship-convention-template';

@Injectable()
export class InternshipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contractPdf: ContractPdfService,
  ) {}

  async findAll(tenantId: string, filters?: { status?: string }) {
    const where: any = { tenantId };
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
    return this.prisma.hrInternship.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        tuteur: { select: { id: true, firstName: true, lastName: true, position: true } },
      },
    });
  }

  async findById(id: string, tenantId: string) {
    const internship = await this.prisma.hrInternship.findFirst({
      where: { id, tenantId },
      include: {
        tuteur: { select: { id: true, firstName: true, lastName: true, position: true } },
      },
    });
    if (!internship) throw new NotFoundException(`Stage ${id} introuvable`);
    return internship;
  }

  /**
   * Crée une convention de stage. Le stage démarre en DRAFT : la validation
   * (ACTIVE) exige l'assurance accident du travail souscrite + police.
   */
  async create(tenantId: string, data: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationalId?: string;
    birthDate?: string | Date;
    position?: string;
    typeStage?: string;
    startDate: string | Date;
    endDate: string | Date;
    gratificationAmount?: number;
    gratificationPeriodicite?: string;
    etablissementOrigine?: string;
    tuteurNom?: string;
    tuteurStaffId?: string;
    assuranceSouscrite?: boolean;
    assurancePoliceRef?: string;
    assuranceCompagnie?: string;
    status?: string;
  }) {
    if (!data.firstName?.trim() || !data.lastName?.trim()) {
      throw new BadRequestException('Nom et prénom du stagiaire requis.');
    }
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Dates de début et de fin du stage requises.');
    }
    if (end <= start) {
      throw new BadRequestException('La date de fin du stage doit être postérieure à la date de début.');
    }

    // Validation immédiate si on demande directement ACTIVE
    const wantedStatus = data.status || 'DRAFT';
    if (wantedStatus === 'ACTIVE') {
      this.assertAssuranceValide(data.assuranceSouscrite, data.assurancePoliceRef);
    }

    return this.prisma.hrInternship.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        nationalId: data.nationalId?.trim() || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        position: data.position?.trim() || null,
        typeStage: data.typeStage?.trim() || null,
        startDate: start,
        endDate: end,
        gratificationAmount: data.gratificationAmount != null ? new Prisma.Decimal(data.gratificationAmount) : null,
        gratificationPeriodicite: data.gratificationPeriodicite?.trim() || null,
        etablissementOrigine: data.etablissementOrigine?.trim() || null,
        tuteurNom: data.tuteurNom?.trim() || null,
        tuteurStaffId: data.tuteurStaffId || null,
        assuranceSouscrite: data.assuranceSouscrite === true,
        assurancePoliceRef: data.assurancePoliceRef?.trim() || null,
        assuranceCompagnie: data.assuranceCompagnie?.trim() || null,
        status: wantedStatus,
      },
    });
  }

  async update(id: string, tenantId: string, data: any) {
    const current = await this.findById(id, tenantId);
    if (current.status === 'ENDED' || current.status === 'CANCELLED') {
      throw new BadRequestException('Ce stage est terminé ou annulé : il n\u2019est plus modifiable (créez un nouveau stage).');
    }

    const allowed = [
      'firstName', 'lastName', 'email', 'phone', 'nationalId', 'position', 'typeStage',
      'gratificationAmount', 'gratificationPeriodicite', 'etablissementOrigine',
      'tuteurNom', 'tuteurStaffId', 'assuranceSouscrite', 'assurancePoliceRef', 'assuranceCompagnie',
    ];
    const patch: any = { ...prismaUpdateDefaults() };
    for (const f of allowed) {
      if (data[f] !== undefined) patch[f] = typeof data[f] === 'string' ? data[f].trim() || null : data[f];
    }
    if (data.birthDate !== undefined) patch.birthDate = data.birthDate ? new Date(data.birthDate) : null;
    if (data.startDate !== undefined) patch.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) patch.endDate = new Date(data.endDate);
    if (patch.gratificationAmount !== undefined && patch.gratificationAmount != null) {
      patch.gratificationAmount = new Prisma.Decimal(patch.gratificationAmount);
    }
    if (patch.startDate && patch.endDate && new Date(patch.endDate) <= new Date(patch.startDate)) {
      throw new BadRequestException('La date de fin du stage doit être postérieure à la date de début.');
    }

    return this.prisma.hrInternship.update({ where: { id }, data: patch });
  }

  /**
   * Changement de statut — l'activation (ACTIVE) est REFUSÉE sans assurance
   * accident du travail souscrite + référence de police (obligation du
   * Décret n°2018-196 à la charge de l'établissement d'accueil).
   */
  async changeStatus(id: string, tenantId: string, newStatus: string) {
    const current = await this.findById(id, tenantId);
    if (!STAGE_STATUTS.includes(newStatus as any)) {
      throw new BadRequestException(`Statut de stage invalide : ${newStatus} (attendus : ${STAGE_STATUTS.join(', ')}).`);
    }
    if (newStatus === 'ACTIVE') {
      this.assertAssuranceValide(current.assuranceSouscrite, current.assurancePoliceRef);
    }
    if (current.status === 'ENDED' || current.status === 'CANCELLED') {
      throw new BadRequestException('Ce stage est déjà terminé ou annulé.');
    }
    if (newStatus === 'ENDED' && current.status !== 'ACTIVE') {
      throw new BadRequestException('Seul un stage en cours (ACTIVE) peut être marqué terminé.');
    }
    return this.prisma.hrInternship.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), status: newStatus },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    return this.prisma.hrInternship.delete({ where: { id } });
  }

  /** Génère la convention de stage (PDF + hash) via le moteur de documents commun. */
  async generateConvention(id: string, tenantId: string) {
    const internship = await this.findById(id, tenantId);
    if (internship.status === 'DRAFT') {
      throw new BadRequestException(
        'Validez d\u2019abord le stage (assurance accident du travail obligatoire) avant de générer la convention.',
      );
    }
    return this.contractPdf.generateInternshipConvention(id, tenantId);
  }

  async downloadConvention(id: string, tenantId: string) {
    const internship = await this.findById(id, tenantId);
    const terms = (internship.terms as any) || {};
    if (!terms.conventionUrl || !terms.conventionHash) {
      throw new BadRequestException('Aucune convention générée pour ce stage.');
    }
    return this.contractPdf.downloadConventionFile(terms.conventionUrl, terms.conventionHash, id, tenantId);
  }

  private assertAssuranceValide(souscrite?: boolean, policeRef?: string | null) {
    if (souscrite !== true) {
      throw new BadRequestException(
        'Assurance accident du travail OBLIGATOIRE : cochez la souscription avant de valider le stage (Décret n°2018-196, charge de l\u2019établissement d\u2019accueil).',
      );
    }
    if (!policeRef || !String(policeRef).trim()) {
      throw new BadRequestException('La référence de la police d\u2019assurance accident du travail est requise pour valider le stage.');
    }
  }
}
