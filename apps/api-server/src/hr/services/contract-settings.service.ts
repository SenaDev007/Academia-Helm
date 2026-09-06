/**
 * ============================================================================
 * CONTRACT SETTINGS SERVICE — Paramétrage par école + alertes de conformité (CDC §8/§9)
 * ============================================================================
 *
 * SaaS multi-écoles : AUCUNE liste figée dans le code. Les motifs de CDD, les
 * types de stage, les seuils d'alerte et l'activation du test d'aide à la
 * qualification vivent dans hr_contract_settings — une ligne par école
 * (bootstrap-on-demand au premier accès, valeurs par défaut contract-rules).
 *
 * Ce service expose aussi :
 *   - getSettings()           : paramétrage effectif de l'école
 *   - updateSettings()        : modification (RH/direction)
 *   - getConformiteAlertes()  : alertes §8.1 CDD échu non clôturé, §8.2 durée
 *                               cumulée, renouvellements dépassés, §10 dossiers
 *                               « Vacataire » à requalifier
 *   - getCddChainInfo()       : chaîne CDD d'un personnel (compteur + durée cumulée)
 * ============================================================================
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  DEFAULT_CDD_MOTIFS,
  DEFAULT_CDD_DUREE_MAX_MOIS,
  DEFAULT_CDD_RENOUVELLEMENTS_MAX,
  DEFAULT_INDEMNITE_FIN_CONTRAT_PCT,
  DEFAULT_TEST_QUESTIONS,
  QualificationQuestion,
  computeCddChains,
  activeCddChain,
  alerteCddExpireSansCloture,
  alerteDureeCumulee,
  alerteDossierARequalifier,
  ConformiteAlerte,
  CddChainSummary,
  TYPES_CONTRAT_PAR_STATUT,
} from './contract-rules';
import { DEFAULT_STAGE_TYPES } from './internship-convention-template';

export interface ContractSettingsPayload {
  cddMotifs: string[];
  stageTypes: string[];
  cddDureeMaxMois: number;
  cddRenouvellementsMax: number;
  indemniteFinContratPct: number;
  testQualificationEnabled: boolean;
  testQuestions: QualificationQuestion[];
  /** Types de contrat disponibles par statut (alimente les sélecteurs filtrés) */
  typesContratParStatut: Record<string, string[]>;
}

@Injectable()
export class ContractSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Paramétrage effectif de l'école (bootstrap-on-demand au premier accès). */
  async getSettings(tenantId: string): Promise<ContractSettingsPayload> {
    let row: any = null;
    try {
      row = await this.prisma.hrContractSettings.findUnique({ where: { tenantId } });
      if (!row) {
        row = await this.prisma.hrContractSettings
          .create({
            data: {
              tenantId,
              cddMotifs: DEFAULT_CDD_MOTIFS as any,
              stageTypes: DEFAULT_STAGE_TYPES as any,
              testQuestions: DEFAULT_TEST_QUESTIONS as any,
            },
          })
          .catch(async () => {
            // Collision d'accès concurrent : relecture
            return this.prisma.hrContractSettings.findUnique({ where: { tenantId } });
          });
      }
    } catch {
      row = null; // table absente (bootstrap non encore joué) → défauts purs
    }
    return {
      cddMotifs: parseStringArray(row?.cddMotifs, DEFAULT_CDD_MOTIFS),
      stageTypes: parseStringArray(row?.stageTypes, DEFAULT_STAGE_TYPES),
      cddDureeMaxMois: numberOr(row?.cddDureeMaxMois, DEFAULT_CDD_DUREE_MAX_MOIS),
      cddRenouvellementsMax: numberOr(row?.cddRenouvellementsMax, DEFAULT_CDD_RENOUVELLEMENTS_MAX),
      indemniteFinContratPct: numberOr(row?.indemniteFinContratPct, DEFAULT_INDEMNITE_FIN_CONTRAT_PCT),
      testQualificationEnabled: row?.testQualificationEnabled ?? true,
      testQuestions: parseQuestions(row?.testQuestions, DEFAULT_TEST_QUESTIONS),
      typesContratParStatut: Object.fromEntries(
        Object.entries(TYPES_CONTRAT_PAR_STATUT).map(([k, v]) => [k, [...v]]),
      ),
    };
  }

  /** Modification du paramétrage (écoles → zéro intervention sur le code). */
  async updateSettings(tenantId: string, patch: {
    cddMotifs?: string[];
    stageTypes?: string[];
    cddDureeMaxMois?: number;
    cddRenouvellementsMax?: number;
    indemniteFinContratPct?: number;
    testQualificationEnabled?: boolean;
    testQuestions?: QualificationQuestion[];
  }): Promise<ContractSettingsPayload> {
    if (patch.cddDureeMaxMois != null && (patch.cddDureeMaxMois < 1 || patch.cddDureeMaxMois > 600)) {
      throw new BadRequestException('Le seuil de durée cumulée CDD doit être compris entre 1 et 600 mois.');
    }
    if (patch.cddRenouvellementsMax != null && (patch.cddRenouvellementsMax < 0 || patch.cddRenouvellementsMax > 10)) {
      throw new BadRequestException('Le nombre maximal de renouvellements CDD doit être compris entre 0 et 10.');
    }
    if (patch.indemniteFinContratPct != null && (patch.indemniteFinContratPct < 0 || patch.indemniteFinContratPct > 100)) {
      throw new BadRequestException('Le taux de l’indemnité de fin de contrat doit être compris entre 0 et 100 %.');
    }
    for (const [key, arr] of [
      ['cddMotifs', patch.cddMotifs],
      ['stageTypes', patch.stageTypes],
    ] as const) {
      if (arr != null) {
        if (!Array.isArray(arr) || arr.length > 40 || arr.some((s) => typeof s !== 'string' || !s.trim())) {
          throw new BadRequestException(`${key} : liste de libellés (texte non vide, 40 max).`);
        }
      }
    }
    if (patch.testQuestions != null) {
      if (!Array.isArray(patch.testQuestions) || patch.testQuestions.length > 10) {
        throw new BadRequestException('testQuestions : 1 à 10 questions au maximum.');
      }
      for (const q of patch.testQuestions) {
        if (!q?.id || !q?.question || !Array.isArray(q.options) || q.options.length !== 2) {
          throw new BadRequestException('Chaque question requiert un id, un texte et exactement 2 options binaires.');
        }
        if (q.firstOptionMeaning !== 'subordination' && q.firstOptionMeaning !== 'autonomie') {
          throw new BadRequestException('firstOptionMeaning : « subordination » ou « autonomie ».');
        }
      }
    }

    const data: any = {};
    if (patch.cddMotifs !== undefined) data.cddMotifs = patch.cddMotifs.map((s) => s.trim());
    if (patch.stageTypes !== undefined) data.stageTypes = patch.stageTypes.map((s) => s.trim());
    if (patch.cddDureeMaxMois !== undefined) data.cddDureeMaxMois = patch.cddDureeMaxMois;
    if (patch.cddRenouvellementsMax !== undefined) data.cddRenouvellementsMax = patch.cddRenouvellementsMax;
    if (patch.indemniteFinContratPct !== undefined) data.indemniteFinContratPct = patch.indemniteFinContratPct;
    if (patch.testQualificationEnabled !== undefined) data.testQualificationEnabled = patch.testQualificationEnabled;
    if (patch.testQuestions !== undefined) data.testQuestions = patch.testQuestions;

    try {
      await this.prisma.hrContractSettings.upsert({
        where: { tenantId },
        update: data,
        create: {
          tenantId,
          cddMotifs: DEFAULT_CDD_MOTIFS as any,
          stageTypes: DEFAULT_STAGE_TYPES as any,
          testQuestions: DEFAULT_TEST_QUESTIONS as any,
          ...data,
        },
      });
    } catch (err: any) {
      throw new BadRequestException(`Impossible d’enregistrer le paramétrage : ${err?.message}`);
    }
    return this.getSettings(tenantId);
  }

  /**
   * Alertes de conformité (§8) — non bloquantes, JAMAIS masquées :
   *   1. CDD échu sans clôture ni renouvellement → risque requalification CDI ;
   *   2. durée cumulée CDD > seuil (paramétrable) ;
   *   3. renouvellements dépassés ;
   *   4. dossiers « Vacataire » hérités à requalifier (§10).
   */
  async getConformiteAlertes(tenantId: string): Promise<ConformiteAlerte[]> {
    const settings = await this.getSettings(tenantId);
    const alertes: ConformiteAlerte[] = [];

    let contracts: any[] = [];
    let staffRows: any[] = [];
    try {
      contracts = await this.prisma.contract.findMany({
        where: { tenantId, status: { in: ['ACTIVE', 'PENDING', 'DRAFT'] } },
        include: { staff: { select: { id: true, firstName: true, lastName: true } } },
      });
      staffRows = await this.prisma.staff.findMany({
        where: { tenantId, needsRequalification: true, status: { not: 'ARCHIVED' } },
        select: { id: true, firstName: true, lastName: true },
      });
    } catch {
      return alertes;
    }

    // §8.1 — CDD échu sans clôture/renouvellement (statut encore actif/pending)
    const now = new Date();
    for (const c of contracts) {
      if (c.contractType !== 'CDD' || !c.endDate) continue;
      // Une indemnité enregistrée (terms.indemniteFinContrat) = clôture effectuée
      const indemniteEnregistree = !!(c.terms as any)?.indemniteFinContrat;
      if (indemniteEnregistree) continue;
      const alerte = alerteCddExpireSansCloture(
        {
          id: c.id,
          staffId: c.staffId,
          staffName: c.staff ? `${c.staff.firstName} ${c.staff.lastName}` : undefined,
          endDate: c.endDate,
        },
        now,
      );
      if (alerte) alertes.push(alerte);
    }

    // §8.2 — durée cumulée + renouvellements, par personnel
    const byStaff = new Map<string, any[]>();
    for (const c of contracts) {
      if (c.contractType !== 'CDD') continue;
      if (!byStaff.has(c.staffId)) byStaff.set(c.staffId, []);
      byStaff.get(c.staffId)!.push(c);
    }
    for (const [staffId, cdds] of byStaff) {
      const staffName = cdds[0]?.staff ? `${cdds[0].staff.firstName} ${cdds[0].staff.lastName}` : undefined;
      const chain = activeCddChain(cdds);
      if (!chain) continue;
      const duree = alerteDureeCumulee(chain, settings.cddDureeMaxMois, staffId, staffName);
      if (duree) alertes.push(duree);
      if (chain.renouvellements > settings.cddRenouvellementsMax) {
        alertes.push({
          kind: 'CDD_RENOUVELLEMENTS_DEPASSES',
          severity: 'avertissement',
          staffId,
          title: 'Renouvellements CDD au-delà du maximum',
          message:
            `${chain.renouvellements} renouvellement(s) enregistré(s) pour ${staffName || 'ce personnel'} ` +
            `(maximum paramétré : ${settings.cddRenouvellementsMax}). Au-delà, la relation devient un CDI de plein droit.`,
          action: 'TRANSFORMER_CDI',
        });
      }
    }

    // §10 — dossiers « Vacataire » à requalifier
    for (const s of staffRows) {
      alertes.push(alerteDossierARequalifier(s.id, `${s.firstName} ${s.lastName}`));
    }

    // Tri : critique > avertissement, puis par type
    const order = { critique: 0, avertissement: 1, info: 2 } as Record<string, number>;
    return alertes.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }

  /** Chaîne CDD d'un personnel : compteur de renouvellements + durée cumulée (§4.3). */
  async getCddChainInfo(staffId: string, tenantId: string): Promise<{
    staffId: string;
    chains: CddChainSummary[];
    activeChain: CddChainSummary | null;
    seuilMois: number;
    depasseSeuil: boolean;
  }> {
    const settings = await this.getSettings(tenantId);
    const contracts = await this.prisma.contract.findMany({
      where: { staffId, tenantId, contractType: 'CDD', status: { not: 'DELETED' } },
      orderBy: { startDate: 'asc' },
    });
    const chains = computeCddChains(contracts);
    const activeChain = activeCddChain(contracts);
    return {
      staffId,
      chains,
      activeChain,
      seuilMois: settings.cddDureeMaxMois,
      depasseSeuil: !!activeChain && activeChain.dureeCumuleeMois > settings.cddDureeMaxMois,
    };
  }
}

// ─── Helpers de normalisation (JSONB → types) ───────────────────────────────

function parseStringArray(raw: any, fallback: string[]): string[] {
  if (Array.isArray(raw)) {
    const cleaned = raw.filter((s: any) => typeof s === 'string' && s.trim());
    if (cleaned.length > 0) return cleaned;
  }
  return fallback;
}

function parseQuestions(raw: any, fallback: QualificationQuestion[]): QualificationQuestion[] {
  if (Array.isArray(raw) && raw.length > 0) {
    const cleaned = raw.filter(
      (q: any) => q && typeof q.id === 'string' && typeof q.question === 'string'
        && Array.isArray(q.options) && q.options.length === 2,
    );
    if (cleaned.length >= 1) return cleaned.map((q: any) => ({
      id: String(q.id),
      question: String(q.question),
      help: q.help ? String(q.help) : undefined,
      options: [String(q.options[0]), String(q.options[1])] as [string, string],
      firstOptionMeaning: q.firstOptionMeaning === 'autonomie' ? 'autonomie' : 'subordination',
    }));
  }
  return fallback;
}

function numberOr(raw: any, fallback: number): number {
  const n = Number(raw);
  return isFinite(n) && n > 0 ? n : fallback;
}
