/**
 * ============================================================================
 * CONTRACTS PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des contrats de travail
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { prismaCreateDefaults, prismaUpdateDefaults } from '../common/utils/prisma-helpers';
import { StorageService } from '../common/services/storage.service';
import { deriveDocumentPaieType, isValidStatutContractuel } from './services/employment-contract-templates';
import { PayrollEngineService } from './services/payroll-engine.service';
import {
  isValidTypeForStatut,
  typesDisponiblesPourStatut,
  computeCddChains,
  computeIndemniteFinContrat,
  CddLikeContract,
} from './services/contract-rules';
import { ContractSettingsService } from './services/contract-settings.service';

@Injectable()
export class ContractsPrismaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly payrollEngine: PayrollEngineService,
    private readonly contractSettings: ContractSettingsService,
  ) {}

  /**
   * Crée un contrat
   *
   * ⭐ Refonte CDC « étape Contrat » — structure à DEUX niveaux :
   *   statutContractuel (déjà choisi à l'étape Emploi) → contractType FILTRÉ :
   *     - SALARIE_DECLARE | SALARIE_NON_DECLARE → CDI ou CDD (exclusivement)
   *     - PRESTATAIRE_SERVICE                     → PRESTATION (valeur unique)
   *   « VACATAIRE » / « STAGE » ne sont PLUS acceptés à la création (le stage
   *   vit dans le flux séparé hr_internships ; le vacataire n'est pas un statut
   *   légal — requalification obligatoire des dossiers hérités §10).
   * Validations backend (jamais seulement en UI) :
   *   - CDD : date de fin + motif obligatoires ; compteur de renouvellements et
   *     durée cumulée calculés sur la chaîne du personnel ;
   *   - CDI : pas de date de fin ; période d'essai (mois) suggérée mais modifiable ;
   *   - PRESTATION : mode + montant requis (FORFAIT/HORAIRE) ;
   *   - SALARIE_* : salaire ≥ SMIG ; SALARIE_DECLARE : n° CNSS requis.
   */
  async createContract(data: {
    tenantId: string;
    academicYearId?: string;
    schoolLevelId?: string;
    staffId: string;
    contractType: string;
    startDate: Date;
    endDate?: Date;
    baseSalary?: number;
    paymentMode?: string;
    status?: string;
    terms?: any;
    templateId?: string;
    schoolLevelId?: string;
    statutContractuel?: string;
    prestationPaymentMode?: string;
    prestationAmount?: number;
    cddMotif?: string;
    justificationStatut?: string;
    periodeEssaiMois?: number;
  }) {
    // ── Validations conditionnelles par statut (backend) ──
    const statut = data.statutContractuel || null;
    if (statut && !isValidStatutContractuel(statut)) {
      throw new BadRequestException(`Statut contractuel invalide : ${statut}`);
    }

    // ⭐ CDC §4.2 — correspondance statut → type de contrat (refus explicite,
    //    jamais une coercion silencieuse : le front filtre déjà dynamiquement)
    if (statut && !isValidTypeForStatut(statut, data.contractType)) {
      const allowed = typesDisponiblesPourStatut(statut).join(' / ');
      if (data.contractType === 'VACATAIRE' || data.contractType === 'STAGE' || data.contractType === 'CONSULTANT') {
        throw new BadRequestException(
          `« ${data.contractType} » n’est plus un type de contrat accepté pour un ${statut === 'PRESTATAIRE_SERVICE' ? 'prestataire' : 'salarié'} : ` +
          (data.contractType === 'STAGE'
            ? 'le stage relève du flux dédié « Stagiaires » (convention de stage, Décret n°2018-196), pas du processus d’embauche salarié.'
            : '« Vacataire » n’est pas une catégorie du Code du travail : qualifiez la situation en CDD (subordination) ou en prestation de services (autonomie).'),
        );
      }
      throw new BadRequestException(
        `Type de contrat « ${data.contractType} » incompatible avec le statut ${statut}. Types disponibles : ${allowed}.`,
      );
    }

    const staff = await this.prisma.staff.findFirst({
      where: { id: data.staffId, tenantId: data.tenantId },
      include: { employeeCNSS: true },
    });
    if (!staff) throw new NotFoundException(`Personnel ${data.staffId} introuvable`);

    let contractType = data.contractType;
    let prestationAmount = data.prestationAmount ?? null;
    let baseSalary = data.baseSalary ?? 0;
    let endDate: Date | null = data.endDate ? new Date(data.endDate) : null;
    let cddMotif: string | null = data.cddMotif ?? (data.terms?.cddMotif ?? null);
    let periodeEssaiMois: number | null = data.periodeEssaiMois ?? (data.terms?.periodeEssaiMois ?? null);

    if (statut === 'PRESTATAIRE_SERVICE') {
      // Contrat de prestation de services — jamais un contrat de travail
      contractType = 'PRESTATION';
      if (!data.prestationPaymentMode || !['FORFAIT', 'HORAIRE'].includes(data.prestationPaymentMode)) {
        throw new BadRequestException(
          'Mode de rémunération du prestataire requis : FORFAIT (montant global) ou HORAIRE (taux horaire).',
        );
      }
      const amount = Number(data.prestationAmount);
      if (!amount || isNaN(amount) || amount <= 0) {
        throw new BadRequestException(
          data.prestationPaymentMode === 'HORAIRE'
            ? 'Le taux horaire du prestataire est requis et doit être supérieur à 0.'
            : 'Le montant du forfait du prestataire est requis et doit être supérieur à 0.',
        );
      }
      prestationAmount = amount;
      // Pas de SMIG pour un prestataire (pas de lien de subordination) :
      // baseSalary porte le forfait (FORFAIT) ou 0 (HORAIRE — le brut se calcule
      // au relevé d'heures lors de la paie)
      baseSalary = data.prestationPaymentMode === 'FORFAIT' ? amount : 0;
    } else if (statut === 'SALARIE_DECLARE' || statut === 'SALARIE_NON_DECLARE') {
      // ⭐ CDC §4.3 — champs conditionnels par type
      if (contractType === 'CDD') {
        if (!endDate) {
          throw new BadRequestException(
            'Un CDD exige une date de fin obligatoire (contrat à durée déterminée — art. 34 Code du travail).',
          );
        }
        if (new Date(endDate).getTime() <= new Date(data.startDate).getTime()) {
          throw new BadRequestException('La date de fin du CDD doit être postérieure à la date de début.');
        }
        if (!cddMotif || !String(cddMotif).trim()) {
          throw new BadRequestException(
            'Le motif du CDD est obligatoire (remplacement, surcroît d’activité temporaire, tâche déterminée… — texte libre).',
          );
        }
      }
      if (contractType === 'CDI') {
        // CDI : pas de date de fin (§4.3) — on l'ignore volontairement
        endDate = null;
        cddMotif = null;
      }
      // Contrat de travail : salaire plancher = SMIG (payroll_fiscal_rates — jamais en dur)
      const rates = await this.payrollEngine.getFiscalRates();
      const smig = rates?.smig ?? 0;
      const brut = Number(data.baseSalary ?? 0);
      if (smig > 0 && brut < smig) {
        throw new BadRequestException(
          `Salaire brut mensuel inférieur au SMIG en vigueur (${smig.toLocaleString('fr-FR')} FCFA). ` +
          'Le salaire d\u2019un contrat de travail ne peut pas descendre sous ce plancher légal.',
        );
      }
      if (statut === 'SALARIE_DECLARE') {
        const cnss = staff.cnssNumber || (staff as any).employeeCNSS?.cnssNumber;
        if (!cnss) {
          throw new BadRequestException(
            'Ce salarié est déclaré à la CNSS : le numéro CNSS est obligatoire sur sa fiche avant la création du contrat.',
          );
        }
      }
    }

    const documentPaieType = deriveDocumentPaieType(statut);

    // ⭐ CDC §4.3 — chaîne CDD du personnel : compteur de renouvellements et
    //    durée cumulée détectés automatiquement (renouvellement = nouveau CDD
    //    contigu/lié au précédent). Non stocké : recalculé depuis les données.
    let cddChainId: string | null = null;
    let cddRenouvellements = 0;
    if (statut !== 'PRESTATAIRE_SERVICE' && contractType === 'CDD') {
      const previousCdds = await this.prisma.contract.findMany({
        where: {
          staffId: data.staffId,
          tenantId: data.tenantId,
          contractType: 'CDD',
          status: { not: 'DELETED' },
        },
        orderBy: { startDate: 'asc' },
      });
      const chains = computeCddChains(previousCdds as unknown as CddLikeContract[]);
      const nowMs = new Date(data.startDate).getTime();
      const contiguous = chains.find(
        (ch) => ch.finDeChaine && nowMs - ch.finDeChaine.getTime() <= 60 * 24 * 60 * 60 * 1000 && nowMs >= ch.finDeChaine.getTime() - 30 * 24 * 60 * 60 * 1000,
      );
      if (contiguous && contiguous.chainId) {
        cddChainId = contiguous.chainId;
        cddRenouvellements = contiguous.contracts; // le nouveau contrat = contrat n° (contracts + 1) → renouvellements = contracts
      } else {
        // Nouvelle chaîne : le contrat devient sa propre racine
        cddChainId = null; // sera = id du contrat créé
        cddRenouvellements = 0;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Désactiver l'éventuel contrat actif existant
      // IMPORTANT: On n'expire PAS les CDI (sans date de fin) — ils restent en vigueur
      // On n'expire que les contrats à durée déterminée (CDD, VACATAIRE, STAGE, CONSULTANT)
      // IMPORTANT: On n'expire PAS les contrats PENDING (non signés) — l'utilisateur peut
      // vouloir conserver plusieurs brouillons en parallèle. Seuls les contrats ACTIVE
      // (déjà en vigueur) sont expirés automatiquement lorsqu'un nouveau contrat est créé.
      const contractsToExpire = await tx.contract.findMany({
        where: {
          staffId: data.staffId,
          tenantId: data.tenantId,
          status: 'ACTIVE',
          contractType: { in: ['CDD', 'VACATAIRE', 'STAGE', 'CONSULTANT', 'PRESTATION'] },
        },
        select: { id: true },
      });

      if (contractsToExpire.length > 0) {
        await tx.contract.updateMany({
          where: {
            id: { in: contractsToExpire.map(c => c.id) },
          },
          data: { status: 'EXPIRED' },
        });
      }

      // Pour les CDI existants, on ne les expire pas — ils restent en vigueur
      // Le nouveau contrat peut coexister si c'est un avenant ou un remplacement
      // Si c'est vraiment un remplacement, l'admin doit résilier manuellement l'ancien CDI

      // Créer le nouveau contrat — PENDING par défaut tant que l'employé n'a pas signé
      const contractStatus = data.status ?? 'PENDING';
      const newContract = await tx.contract.create({
        data: {
          ...prismaCreateDefaults(),
          tenantId: data.tenantId,
          staffId: data.staffId,
          contractType,
          statutContractuel: statut,
          documentPaieType,
          prestationPaymentMode: statut === 'PRESTATAIRE_SERVICE' ? data.prestationPaymentMode : null,
          prestationAmount,
          cddMotif: contractType === 'CDD' ? (cddMotif ? String(cddMotif).trim() : null) : null,
          cddRenouvellements,
          cddChainId: contractType === 'CDD' ? (cddChainId || 'PENDING_ROOT') : null,
          periodeEssaiMois: contractType === 'CDI' ? periodeEssaiMois : null,
          justificationStatut: data.justificationStatut?.trim() || null,
          startDate: data.startDate ? new Date(data.startDate) : new Date(),
          endDate,
          baseSalary: new Prisma.Decimal(baseSalary),
          paymentMode: data.paymentMode ?? 'BANK',
          status: contractStatus,
          terms: data.terms ?? null,
          templateId: data.templateId ?? null,
          academicYearId: data.academicYearId ?? null,
          schoolLevelId: data.schoolLevelId ?? null,
        },
        include: { staff: true },
      });

      // Racine de chaîne : le contrat initial porte sa propre id de chaîne
      if (newContract.cddChainId === 'PENDING_ROOT') {
        await tx.contract.update({
          where: { id: newContract.id },
          data: { cddChainId: newContract.id },
        });
        (newContract as any).cddChainId = newContract.id;
      }

      // ⭐ Miroir du statut sur la fiche du personnel (si pas encore défini)
      // + date de déclaration CNSS automatique quand le numéro CNSS est déjà connu
      if (statut) {
        const staffPatch: any = {
          statutContractuel: statut,
          documentPaieType,
          statutContractuelLockedAt: new Date(),
        };
        if (data.justificationStatut?.trim()) {
          staffPatch.justificationStatut = data.justificationStatut.trim();
        }
        if (statut === 'SALARIE_DECLARE' && (staff.cnssNumber || (staff as any).employeeCNSS?.cnssNumber) && !staff.cnssDeclarationDate) {
          staffPatch.cnssDeclarationDate = new Date();
        }
        if (statut === 'PRESTATAIRE_SERVICE' && data.prestationPaymentMode) {
          staffPatch.prestationPaymentMode = data.prestationPaymentMode;
          staffPatch.prestationAmount = prestationAmount;
        }
        // Miroir du type de contrat (cohérence fiche ↔ contrat)
        if (contractType !== 'PRESTATION') {
          staffPatch.contractType = contractType;
        } else {
          staffPatch.contractType = 'PRESTATION';
        }
        await tx.staff.update({ where: { id: data.staffId }, data: staffPatch }).catch(() => null);
      }

      // Si le contrat est créé en PENDING (non signé), mettre le personnel en PENDING_SIGNATURE
      if (contractStatus === 'PENDING' || contractStatus === 'DRAFT') {
        await tx.staff.updateMany({
          where: { id: data.staffId, status: 'ACTIVE' },
          data: { status: 'PENDING_SIGNATURE' },
        });
      }

      return newContract;
    });
  }

  /**
   * Récupère tous les contrats
   */
  async findAllContracts(tenantId: string, filters?: {
    staffId?: string;
    type?: string;
    status?: string;
  }) {
    const where: any = { tenantId };
    if (filters?.staffId) where.staffId = filters.staffId;
    if (filters?.type) where.contractType = filters.type;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;

    const contracts = await this.prisma.contract.findMany({
      where: {
        ...where,
        staff: {
          status: { not: 'ARCHIVED' },
        },
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            position: true,
            roleType: true,
            photo: { select: { thumbnailUrl: true, originalUrl: true } },
          },
        },
        template: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    // Add staffCode alias so frontend can access contract.staff.staffCode
    // Resolve photo URLs for R2/S3 storage (thumbnailUrl is a storage key, not a full URL)
    return Promise.all(contracts.map(async (c) => ({
      ...c,
      staff: c.staff ? {
        ...c.staff,
        staffCode: c.staff.employeeNumber,
        photoUrl: c.staff.photo?.thumbnailUrl
          ? await this.storageService.resolveFileUrl(c.staff.photo.thumbnailUrl)
          : null,
      } : c.staff,
    })));
  }

  /**
   * Récupère un contrat par ID
   */
  async findContractById(id: string, tenantId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, tenantId },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
            email: true,
            phone: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            schools: { select: { address: true } },
            country: { select: { name: true, currencyCode: true } },
          },
        },
        academicYear: {
          select: { id: true, name: true },
        },
        template: { select: { id: true, name: true } },
        amendments: {
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException(`Contract with ID ${id} not found`);
    }

    // Add staffCode alias so frontend can access contract.staff.staffCode
    return {
      ...contract,
      staff: contract.staff ? { ...contract.staff, staffCode: contract.staff.employeeNumber } : contract.staff,
    };
  }

  /**
   * Met à jour un contrat
   */
  async updateContract(id: string, tenantId: string, data: any) {
    const current = await this.findContractById(id, tenantId);

    // ⭐ Le statut contractuel ne se modifie JAMAIS par simple édition de champ :
    //    un changement de statut (CNSS, requalification salarié/prestataire) a des
    //    implications légales et passe par une procédure tracée. Sur un contrat
    //    signé, le statut est intégralement verrouillé.
    if (data.statutContractuel !== undefined && data.statutContractuel !== current.statutContractuel) {
      throw new BadRequestException(
        'Le statut contractuel ne peut pas être modifié par édition directe. ' +
        'Utilisez la procédure tracée de changement de statut (date d\u2019effet + justification).',
      );
    }
    if (current.signedAt && data.statutContractuel !== undefined) {
      throw new BadRequestException('Contrat déjà signé : le statut contractuel est verrouillé.');
    }

    // ⭐ CDC §4.2 — garde statut ↔ type sur l'édition (miroir de la création)
    const targetType = data.contractType ?? current.contractType;
    const statut = current.statutContractuel;
    if (statut && data.contractType !== undefined && !isValidTypeForStatut(statut, targetType)) {
      const allowed = typesDisponiblesPourStatut(statut).join(' / ');
      throw new BadRequestException(
        `Type de contrat « ${targetType} » incompatible avec le statut ${statut}. Types disponibles : ${allowed}.`,
      );
    }
    // CDD : motif et date de fin restent exigés à l'édition
    if (statut && targetType === 'CDD' && data.endDate === null) {
      throw new BadRequestException('Un CDD ne peut pas être transformé en contrat sans date de fin : choisissez CDI (via un avenant) ou une date de terme.');
    }
    // CDI : pas de date de fin
    if (statut && targetType === 'CDI' && data.endDate !== undefined && data.endDate !== null) {
      throw new BadRequestException('Un CDI n\u2019a pas de date de fin (contrat à durée indéterminée).');
    }

    const updateData: any = {};
    const allowedFields = [
      'contractType', 'startDate', 'endDate', 'baseSalary', 'paymentMode',
      'status', 'terms', 'templateId', 'academicYearId', 'schoolLevelId',
      'prestationPaymentMode', 'prestationAmount',
      'cddMotif', 'periodeEssaiMois', 'justificationStatut',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    // Convert date fields
    if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);
    if (updateData.baseSalary !== undefined) updateData.baseSalary = new Prisma.Decimal(updateData.baseSalary);

    return this.prisma.contract.update({
      where: { id },
      data: { ...prismaUpdateDefaults(), ...updateData },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REFONTE CDC « étape Contrat » — renouvellement / clôture CDD / requalification
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Renouvelle un CDD (§4.3) : crée le contrat suivant de la MÊME chaîne,
   * incrémente le compteur de renouvellements, recalcule la durée cumulée
   * et ALERTe si le seuil paramétrable est dépassé (jamais bloquant).
   */
  async renewCdd(id: string, tenantId: string, data: {
    startDate: string | Date;
    endDate: string | Date;
    cddMotif?: string;
    baseSalary?: number;
    paymentMode?: string;
    performedBy?: string;
  }) {
    const current = await this.findContractById(id, tenantId);
    if (current.contractType !== 'CDD') {
      throw new BadRequestException('Seul un CDD peut être renouvelé.');
    }
    const statut = current.statutContractuel;
    if (!statut || statut === 'PRESTATAIRE_SERVICE') {
      throw new BadRequestException(
        'Le renouvellement de CDD concerne un salarié (déclaré ou non déclaré). Un prestataire signe un contrat de prestation.',
      );
    }
    if ((current.terms as any)?.indemniteFinContrat) {
      throw new BadRequestException('Ce CDD est déjà clôturé (indemnité de fin de contrat enregistrée) : créez un nouveau contrat.');
    }

    const settings = await this.contractSettings.getSettings(tenantId);
    const motif = (data.cddMotif || current.cddMotif || '').trim();
    if (!motif) {
      throw new BadRequestException('Le motif du CDD renouvelé est obligatoire (texte libre).');
    }

    const renewed = await this.createContract({
      tenantId,
      staffId: current.staffId,
      academicYearId: current.academicYearId ?? undefined,
      schoolLevelId: current.schoolLevelId ?? undefined,
      contractType: 'CDD',
      statutContractuel: statut,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      baseSalary: data.baseSalary ?? Number(current.baseSalary),
      paymentMode: data.paymentMode ?? current.paymentMode,
      cddMotif: motif,
      status: 'PENDING',
      terms: {
        ...((current.terms as any) || {}),
        renouvellementDe: current.id,
        renouvellementLe: new Date().toISOString(),
        renouvellePar: data.performedBy ?? undefined,
      },
    });

    // Chaîne explicite : le renouvellement hérite de la chaîne du parent
    const chainId = current.cddChainId || current.id;
    await this.prisma.contract.update({
      where: { id: renewed.id },
      data: {
        cddChainId: chainId,
        // compteur = nombre de contrats déjà présents dans la chaîne (parent inclus)
        cddRenouvellements: Math.max(renewed.cddRenouvellements, current.cddRenouvellements + 1),
      },
    }).catch(() => null);

    // Durée cumulée de la chaîne complète + alerte (§8.2) — non bloquant
    const chainInfo = await this.contractSettings.getCddChainInfo(current.staffId, tenantId);
    return {
      contract: { ...renewed, cddChainId: chainId },
      chain: chainInfo.activeChain,
      seuilMois: chainInfo.seuilMois,
      depasseSeuil: chainInfo.depasseSeuil,
      renouvellementsDepasses: !!chainInfo.activeChain && chainInfo.activeChain.renouvellements > settings.cddRenouvellementsMax,
      alerte: chainInfo.depasseSeuil
        ? `Durée cumulée CDD : ${chainInfo.activeChain?.dureeCumuleeMois} mois — seuil paramétré : ${chainInfo.seuilMois} mois. Au-delà, la relation devient un CDI de plein droit.`
        : null,
    };
  }

  /**
   * Clôture un CDD à son terme (§8.4) : calcule l'indemnité de fin de contrat
   * (taux paramétrable — défaut 6 %) sur la rémunération brute totale versée
   * pendant la durée du contrat, avec possibilité d'ajustement manuel AVANT
   * validation. La clôture referme aussi la chaîne (le CDD ne génère plus
   * d'alerte de requalification).
   */
  async closeCdd(id: string, tenantId: string, data: {
    montantAjuste?: number | null;
    remunerationBruteOverride?: number | null;
    note?: string;
    performedBy?: string;
    performedByEmail?: string;
  }) {
    const current = await this.findContractById(id, tenantId);
    if (current.contractType !== 'CDD') {
      throw new BadRequestException('La clôture avec indemnité concerne un CDD.');
    }
    if ((current.terms as any)?.indemniteFinContrat) {
      throw new BadRequestException('Ce CDD est déjà clôturé : indemnité de fin de contrat déjà enregistrée.');
    }

    const settings = await this.contractSettings.getSettings(tenantId);

    // Base = rémunération totale brute versée pendant la durée du contrat :
    // somme des payroll_items du personnel entre début et fin du contrat
    // (tous statuts calculés/validés/payés — les PENDING non émis exclus).
    let remunerationBrute = 0;
    if (data.remunerationBruteOverride != null) {
      remunerationBrute = Number(data.remunerationBruteOverride);
    } else {
      try {
        const items = await this.prisma.payrollItem.aggregate({
          where: {
            staffId: current.staffId,
            tenantId,
            status: { in: ['CALCULATED', 'VALIDATED', 'PAID'] },
          },
          _sum: { grossSalary: true },
        });
        remunerationBrute = Number(items._sum.grossSalary ?? 0);
      } catch {
        remunerationBrute = 0;
      }
    }

    const indemnite = computeIndemniteFinContrat(remunerationBrute, settings.indemniteFinContratPct, data.montantAjuste);

    const terms = {
      ...((current.terms as any) || {}),
      indemniteFinContrat: {
        ...indemnite,
        baseSource: data.remunerationBruteOverride != null ? 'saisie manuelle' : 'payroll_items (somme des bruts)',
        note: data.note || null,
        dateCloture: new Date().toISOString(),
        validePar: data.performedBy ?? null,
        valideParEmail: data.performedByEmail ?? null,
      },
    };

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'EXPIRED',
        terms,
      },
    });

    // Miroir staff : plus de CDD actif → pas de changement de statut du personnel
    // (la relation s'arrête au terme ; le personnel reste actif pour son dossier).
    return {
      contract: updated,
      indemnite: terms.indemniteFinContrat,
      baseCalculee: remunerationBrute,
      tauxPct: settings.indemniteFinContratPct,
    };
  }

  /**
   * Requalifie un dossier hérité « Vacataire » (§10) : CDD (salarié) ou
   * contrat de prestation (prestataire). Trace la décision, met à jour le
   * contrat ET la fiche, efface le badge « à requalifier ». Le test d'aide
   * à la décision est proposé côté interface — jamais imposé.
   */
  async requalifyContract(id: string, tenantId: string, data: {
    newContractType: 'CDD' | 'CDI' | 'PRESTATION';
    statutContractuel?: 'SALARIE_DECLARE' | 'SALARIE_NON_DECLARE' | 'PRESTATAIRE_SERVICE';
    endDate?: string | Date | null;
    cddMotif?: string;
    baseSalary?: number;
    prestationPaymentMode?: 'FORFAIT' | 'HORAIRE';
    prestationAmount?: number;
    prestationDescription?: string;
    justification: string;
    performedBy?: string;
    performedByEmail?: string;
  }) {
    const current = await this.findContractById(id, tenantId);
    if (!current.needsRequalification && current.contractType !== 'VACATAIRE') {
      throw new BadRequestException(
        'Ce contrat n\u2019est pas marqué « à requalifier » (réservé aux dossiers hérités Vacataire).',
      );
    }
    const justification = (data.justification || '').trim();
    if (justification.length < 10) {
      throw new BadRequestException('Justification requise (10 caractères minimum) — traçabilité en cas de contrôle.');
    }

    const toPrestation = data.newContractType === 'PRESTATION';
    const newStatut =
      data.statutContractuel ||
      (toPrestation ? 'PRESTATAIRE_SERVICE' : 'SALARIE_DECLARE');
    if (toPrestation && newStatut !== 'PRESTATAIRE_SERVICE') {
      throw new BadRequestException('Un contrat de prestation exige le statut PRESTATAIRE_SERVICE.');
    }
    if (!toPrestation && newStatut === 'PRESTATAIRE_SERVICE') {
      throw new BadRequestException('Un contrat de travail (CDI/CDD) exige un statut salarié (déclaré ou non déclaré).');
    }
    if (!toPrestation && data.newContractType === 'CDD' && !data.endDate) {
      throw new BadRequestException('La requalification en CDD exige une date de fin.');
    }
    if (!toPrestation && data.newContractType === 'CDD' && !(data.cddMotif || '').trim()) {
      throw new BadRequestException('La requalification en CDD exige le motif du recours à la durée déterminée.');
    }

    const previousStatut = current.statutContractuel || null;
    const documentPaieType = deriveDocumentPaieType(newStatut);

    const updated = await this.prisma.$transaction(async (tx) => {
      const terms: any = {
        ...((current.terms as any) || {}),
        requalification: {
          depuis: current.contractType,
          vers: data.newContractType,
          statutAvant: previousStatut,
          statutApres: newStatut,
          justification,
          date: new Date().toISOString(),
          performedBy: data.performedBy ?? null,
          performedByEmail: data.performedByEmail ?? null,
        },
      };
      if (toPrestation && data.prestationDescription) {
        terms.prestation = {
          ...((terms.prestation as any) || {}),
          description: data.prestationDescription.trim(),
        };
      }

      const patch: any = {
        ...prismaUpdateDefaults(),
        contractType: data.newContractType,
        statutContractuel: newStatut,
        documentPaieType,
        needsRequalification: false,
        requalifieDepuis: current.contractType,
        terms,
        justificationStatut: justification,
        cddMotif: data.newContractType === 'CDD' ? (data.cddMotif || '').trim() : null,
        cddRenouvellements: data.newContractType === 'CDD' ? current.cddRenouvellements : 0,
      };
      if (data.newContractType === 'CDD' && data.endDate) patch.endDate = new Date(data.endDate);
      if (data.newContractType === 'CDI') {
        patch.endDate = null;
        if (data.baseSalary !== undefined) patch.baseSalary = new Prisma.Decimal(data.baseSalary);
      }
      if (toPrestation) {
        patch.prestationPaymentMode = data.prestationPaymentMode || 'FORFAIT';
        if (data.prestationAmount != null) {
          patch.prestationAmount = new Prisma.Decimal(data.prestationAmount);
          patch.baseSalary = new Prisma.Decimal(data.prestationPaymentMode === 'HORAIRE' ? 0 : data.prestationAmount);
        }
        patch.cddMotif = null;
        patch.cddRenouvellements = 0;
        patch.cddChainId = null;
      } else if (data.baseSalary !== undefined) {
        patch.baseSalary = new Prisma.Decimal(data.baseSalary);
      }

      const contract = await tx.contract.update({ where: { id }, data: patch });

      // Miroir fiche personnel + levée du badge « à requalifier »
      const staffPatch: any = {
        needsRequalification: false,
        contractType: data.newContractType,
        justificationStatut: justification,
      };
      if (previousStatut !== newStatut || !previousStatut) {
        staffPatch.statutContractuel = newStatut;
        staffPatch.documentPaieType = documentPaieType;
        if (!previousStatut) staffPatch.statutContractuelLockedAt = new Date();
      }
      if (toPrestation) {
        staffPatch.prestationPaymentMode = data.prestationPaymentMode || 'FORFAIT';
        if (data.prestationAmount != null) staffPatch.prestationAmount = new Prisma.Decimal(data.prestationAmount);
      }
      await tx.staff.update({ where: { id: current.staffId }, data: staffPatch }).catch(() => null);

      // Procédure tracée si le statut change réellement (§ Task 10 — staff_statut_changes)
      if (previousStatut && previousStatut !== newStatut) {
        await tx.staffStatutChange.create({
          data: {
            tenantId,
            staffId: current.staffId,
            previousStatut,
            newStatut,
            effectiveDate: new Date(),
            justification: `[Requalification Vacataire] ${justification}`,
            performedBy: data.performedBy ?? null,
            performedByEmail: data.performedByEmail ?? null,
          },
        }).catch(() => null);
      }

      return contract;
    });

    return updated;
  }

  /**
   * Crée un avenant (Amendment) au contrat
   */
  async createAmendment(data: {
    tenantId: string;
    contractId: string;
    amendmentType: string;
    description: string;
    previousValue?: string;
    newValue?: string;
    effectiveDate: Date;
  }) {
    // Verify contract exists within tenant
    const contract = await this.prisma.contract.findFirst({
      where: { id: data.contractId, tenantId: data.tenantId },
    });
    if (!contract) {
      throw new NotFoundException(
        `Contract ${data.contractId} not found in tenant`,
      );
    }

    return this.prisma.contractAmendment.create({
      data: {
        ...prismaCreateDefaults(),
        tenantId: data.tenantId,
        contractId: data.contractId,
        amendmentType: data.amendmentType,
        description: data.description,
        previousValue: data.previousValue ?? null,
        newValue: data.newValue ?? null,
        effectiveDate: data.effectiveDate,
        status: 'DRAFT',
      },
    });
  }

  /**
   * Termine un contrat — Résiliation professionnelle.
   *
   * Si updateStaffStatus est true (ou non spécifié et c'est le seul contrat actif du staff),
   * le statut du staff est également mis à jour en INACTIVE avec les détails de la résiliation.
   */
  async terminateContract(
    id: string,
    tenantId: string,
    terminationReason?: string,
    options?: {
      terminatedAt?: Date;
      terminationType?: string;
      updateStaffStatus?: boolean;
    },
  ) {
    const contract = await this.findContractById(id, tenantId);
    const terminatedAt = options?.terminatedAt || new Date();

    // Determine if we should update staff status
    const shouldUpdateStaff = options?.updateStaffStatus !== false; // default true

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Terminate the contract
      const terminated = await tx.contract.update({
        where: { id },
        data: {
          ...prismaUpdateDefaults(),
          status: 'TERMINATED',
          terminatedAt,
          terminationReason: terminationReason || null,
        },
      });

      // 2. Check if this was the only active contract for the staff
      const remainingActiveContracts = await tx.contract.count({
        where: {
          staffId: contract.staffId,
          tenantId,
          status: { in: ['ACTIVE', 'PENDING'] },
          id: { not: id },
        },
      });

      // 3. Update staff status if no more active contracts and updateStaffStatus is true
      if (shouldUpdateStaff && remainingActiveContracts === 0) {
        const staffUpdateData: any = {
          ...prismaUpdateDefaults(),
          status: 'INACTIVE',
          terminatedAt,
          terminationType: options?.terminationType || 'END_OF_CONTRACT',
          lastWorkingDate: terminatedAt,
        };

        // Build termination details
        const terminationDetails = {
          terminationType: options?.terminationType || 'END_OF_CONTRACT',
          terminationLabel: 'Résiliation de contrat',
          effectiveDate: terminatedAt.toISOString(),
          lastWorkingDate: terminatedAt.toISOString(),
          reason: terminationReason || null,
          contractTerminated: {
            id: contract.id,
            contractType: contract.contractType,
            startDate: contract.startDate,
            baseSalary: Number(contract.baseSalary),
          },
          automaticStaffUpdate: true,
        };
        staffUpdateData.terminationDetails = terminationDetails;

        await tx.staff.update({
          where: { id: contract.staffId },
          data: staffUpdateData,
        });
      }

      return terminated;
    });

    return result;
  }

  /**
   * Supprime un contrat (soft-delete : status → DELETED)
   */
  async deleteContract(id: string, tenantId: string) {
    const contract = await this.findContractById(id, tenantId);
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'DELETED',
      },
    });
  }

  /**
   * Réactive un contrat expiré non signé.
   * Permet à l'utilisateur de remettre un contrat en PENDING pour le signer
   * s'il a été automatiquement expiré à tort (ou par erreur de manipulation).
   *
   * Conditions :
   * - Le contrat ne doit pas être déjà signé (signedAt null)
   * - Le statut actuel doit être EXPIRED (on ne réactive pas un TERMINATED ou DELETED)
   *
   * Après réactivation, le contrat repasse en PENDING et peut être signé.
   */
  async reactivateContract(id: string, tenantId: string) {
    const contract = await this.findContractById(id, tenantId);

    if (contract.signedAt) {
      throw new BadRequestException(
        'Impossible de réactiver un contrat déjà signé. Créez un avenant ou un nouveau contrat.',
      );
    }

    if (contract.status !== 'EXPIRED') {
      throw new BadRequestException(
        `Seuls les contrats expirés peuvent être réactivés (statut actuel: ${contract.status}).`,
      );
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...prismaUpdateDefaults(),
        status: 'PENDING',
      },
    });
  }

  /**
   * Récupère le contrat actif ou en attente d'un membre du personnel
   */
  async findActiveContract(staffId: string, tenantId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: {
        staffId,
        tenantId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
      include: {
        staff: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            position: true,
            roleType: true,
          },
        },
        template: { select: { id: true, name: true } },
        amendments: {
          orderBy: { effectiveDate: 'desc' },
        },
      },
    });

    // Add staffCode alias so frontend can access contract.staff.staffCode
    return contract ? {
      ...contract,
      staff: contract.staff ? { ...contract.staff, staffCode: contract.staff.employeeNumber } : contract.staff,
    } : null;
  }
}
