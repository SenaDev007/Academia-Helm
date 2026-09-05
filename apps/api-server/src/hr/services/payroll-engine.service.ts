/**
 * ============================================================================
 * PAYROLL ENGINE SERVICE — Moteur de paie à deux branches (RH Bénin)
 * ============================================================================
 *
 * DEUX branches STRICTEMENT séparées, dérivées du statut contractuel :
 *
 * 1. Fiche de paie (SALARIE_DECLARE / SALARIE_NON_DECLARE) :
 *      brut → (si déclaré) brut − cotisation salariale CNSS (3,6 %) = brut imposable
 *          → application du barème ITS progressif → ITS dû
 *      net = brut − cnss_salarial (si applicable) − ITS
 *      si déclaré : charges patronales calculées en parallèle (affichées et
 *      provisionnées pour la déclaration CNSS, NON déduites du net)
 *
 * 2. État de paiement (PRESTATAIRE_SERVICE) :
 *      montant brut convenu (forfait ou heures × taux horaire)
 *      AIB = brut × (3 % si IFU renseigné, 5 % sinon) — retenue à la source
 *      net = brut − AIB ; PAS d'ITS, PAS de CNSS
 *
 * ⚠️ CONTRAINTE NON NÉGOCIABLE : aucune valeur de taux (CNSS, ITS, AIB, SMIG)
 * n'est codée en dur ici — tout est lu dans payroll_fiscal_rates (versionné par
 * année fiscale). Un changement de loi de finances = une ligne en base.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { deriveDocumentPaieType, StatutContractuel } from './employment-contract-templates';

export interface FiscalRateSet {
  fiscalYear: number;
  cnssSalarial: number;
  cnssPrestationsFamiliales: number;
  cnssRisquesProMin: number;
  cnssRisquesProMax: number;
  cnssVieillesse: number;
  cnssPatronalGlobal: number;
  itsBrackets: Array<{ min: number; max: number | null; rate: number }>;
  aibAvecIfu: number;
  aibSansIfu: number;
  smig: number;
  cnssMensuelSeuil: number;
  /// Jours de congés payés acquis par mois travaillé (1,5 par défaut — à confirmer 2)
  joursCongesParMois: number;
  categoryRules: Record<string, { essai: string; renouvellement: string; preavis: string }> | null;
  sourceNotes?: string | null;
}

export interface FicheDePaieResult {
  documentPaieType: 'FICHE_DE_PAIE';
  brut: number;
  cnssActif: boolean;
  cnssSalarial: number;          // retenue salariale (précompte)
  brutImposable: number;
  its: number;                    // ITS dû (barème progressif)
  net: number;                    // net à payer
  chargesPatronales: {
    prestationsFamiliales: number;
    risquesPro: number;           // borne min par défaut
    vieillesse: number;
    total: number;                // patronal global de référence
    totalGlobal: number;
  } | null;                       // null si non déclaré
  rates: { fiscalYear: number; sourceNotes?: string | null };
}

export interface EtatDePaiementResult {
  documentPaieType: 'ETAT_DE_PAIEMENT';
  brut: number;
  ifuPresent: boolean;
  tauxAib: number;                // 3 (IFU) ou 5 (sans IFU) — depuis payroll_fiscal_rates
  aib: number;                    // retenue à la source
  net: number;
  mention: string;                // « ce document ne constitue pas une fiche de paie »
  rates: { fiscalYear: number; sourceNotes?: string | null };
}

const MENTION_ETAT_PAIEMENT =
  "Ce document ne constitue pas une fiche de paie. Il s'agit d'un état de paiement " +
  'relatif à un contrat de prestation de services, soumis à la retenue à la source AIB ' +
  '(Acompte sur Impôt assis sur les Bénéfices) et excluant toute affiliation CNSS au titre ' +
  'de la présente relation contractuelle.';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PayrollEngineService {
  private readonly logger = new Logger(PayrollEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Lecture des taux (jamais en dur) ──────────────────────────────────────

  /**
   * Barème en vigueur : dernière ligne dont effectiveFrom ≤ date ; à défaut,
   * la ligne la plus récente (barème le plus proche connu).
   */
  async getFiscalRates(countryCode = 'BJ', at: Date = new Date()): Promise<FiscalRateSet | null> {
    let row: any = null;
    try {
      row = await this.prisma.payrollFiscalRate.findFirst({
        where: { countryCode, effectiveFrom: { lte: at } },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (!row) {
        row = await this.prisma.payrollFiscalRate.findFirst({
          where: { countryCode },
          orderBy: { effectiveFrom: 'desc' },
        });
      }
    } catch (err: any) {
      this.logger.warn(`payroll_fiscal_rates indisponible : ${err?.message}`);
      return null;
    }
    if (!row) return null;
    return this.mapRateRow(row);
  }

  private mapRateRow(row: any): FiscalRateSet {
    const bracketsRaw = Array.isArray(row.itsBrackets) ? row.itsBrackets : [];
    const itsBrackets = bracketsRaw
      .map((b: any) => ({
        min: Number(b?.min ?? 0),
        max: b?.max == null ? null : Number(b.max),
        rate: Number(b?.rate ?? 0),
      }))
      .filter((b: any) => !isNaN(b.min) && !isNaN(b.rate))
      .sort((a: any, b: any) => a.min - b.min);
    return {
      fiscalYear: row.fiscalYear,
      cnssSalarial: Number(row.cnssSalarial ?? 0),
      cnssPrestationsFamiliales: Number(row.cnssPrestationsFamiliales ?? 0),
      cnssRisquesProMin: Number(row.cnssRisquesProMin ?? 0),
      cnssRisquesProMax: Number(row.cnssRisquesProMax ?? 0),
      cnssVieillesse: Number(row.cnssVieillesse ?? 0),
      cnssPatronalGlobal: Number(row.cnssPatronalGlobal ?? 0),
      itsBrackets,
      aibAvecIfu: Number(row.aibAvecIfu ?? 0),
      aibSansIfu: Number(row.aibSansIfu ?? 0),
      smig: Number(row.smig ?? 0),
      cnssMensuelSeuil: Number(row.cnssMensuelSeuil ?? 20),
      joursCongesParMois: Number(row.joursCongesParMois ?? 1.5),
      categoryRules: (row.categoryRules as any) ?? null,
      sourceNotes: row.sourceNotes ?? null,
    };
  }

  // ─── Calculs (branches strictement séparées) ──────────────────────────────

  /**
   * BRANCHE 1 — Fiche de paie (salarié déclaré ou non déclaré).
   * cnssActif uniquement si statut = SALARIE_DECLARE.
   */
  computeFicheDePaie(brut: number, opts: { cnssActif: boolean; rates: FiscalRateSet }): FicheDePaieResult {
    const { rates } = opts;
    const cnssActif = opts.cnssActif && rates.cnssSalarial > 0;
    const cnssSalarial = cnssActif ? round2((brut * rates.cnssSalarial) / 100) : 0;
    const brutImposable = round2(cnssActif ? brut - cnssSalarial : brut);
    const its = round2(this.computeIts(brutImposable, rates.itsBrackets));
    const net = round2(brut - cnssSalarial - its);

    const chargesPatronales = cnssActif
      ? {
          prestationsFamiliales: round2((brut * rates.cnssPrestationsFamiliales) / 100),
          risquesPro: round2((brut * rates.cnssRisquesProMin) / 100),
          vieillesse: round2((brut * rates.cnssVieillesse) / 100),
          total: round2((brut * rates.cnssPatronalGlobal) / 100),
          totalGlobal: round2((brut * rates.cnssPatronalGlobal) / 100),
        }
      : null;

    return {
      documentPaieType: 'FICHE_DE_PAIE',
      brut: round2(brut),
      cnssActif,
      cnssSalarial,
      brutImposable,
      its,
      net,
      chargesPatronales,
      rates: { fiscalYear: rates.fiscalYear, sourceNotes: rates.sourceNotes },
    };
  }

  /**
   * BRANCHE 2 — État de paiement (prestataire de services).
   * Pas d'ITS, pas de CNSS : uniquement la retenue AIB à la source.
   */
  computeEtatDePaiement(brut: number, opts: { ifuPresent: boolean; rates: FiscalRateSet }): EtatDePaiementResult {
    const { rates } = opts;
    const tauxAib = opts.ifuPresent ? rates.aibAvecIfu : rates.aibSansIfu;
    const aib = round2((brut * tauxAib) / 100);
    const net = round2(brut - aib);
    return {
      documentPaieType: 'ETAT_DE_PAIEMENT',
      brut: round2(brut),
      ifuPresent: opts.ifuPresent,
      tauxAib,
      aib,
      net,
      mention: MENTION_ETAT_PAIEMENT,
      rates: { fiscalYear: rates.fiscalYear, sourceNotes: rates.sourceNotes },
    };
  }

  /**
   * Dispatch par statut contractuel — la dérivation document/CNSS/IFU est stricte :
   *   SALARIE_DECLARE → fiche de paie + CNSS
   *   SALARIE_NON_DECLARE → fiche de paie sans CNSS (ITS uniquement)
   *   PRESTATAIRE_SERVICE → état de paiement (AIB uniquement)
   */
  async calculateForStatut(
    brut: number,
    statut: StatutContractuel | string | null | undefined,
    opts: { ifuPresent?: boolean },
  ): Promise<FicheDePaieResult | EtatDePaiementResult | null> {
    const rates = await this.getFiscalRates();
    if (!rates) {
      this.logger.warn('Aucun barème payroll_fiscal_rates disponible — calcul impossible');
      return null;
    }
    if (statut === 'PRESTATAIRE_SERVICE') {
      return this.computeEtatDePaiement(brut, { ifuPresent: !!opts.ifuPresent, rates });
    }
    return this.computeFicheDePaie(brut, {
      cnssActif: statut === 'SALARIE_DECLARE',
      rates,
    });
  }

  /** Barème ITS progressif par tranches mensuelles (aucun taux en dur). */
  computeIts(taxable: number, brackets: Array<{ min: number; max: number | null; rate: number }>): number {
    if (!brackets.length || taxable <= 0) return 0;
    let tax = 0;
    for (const b of brackets) {
      if (taxable <= b.min) break;
      const upper = b.max == null ? taxable : Math.min(taxable, b.max);
      if (upper > b.min) {
        tax += (upper - b.min) * (b.rate / 100);
      }
    }
    return tax;
  }

  /** Règles de catégorie (période d'essai / préavis) pour un roleType. */
  getCategoryRule(rates: FiscalRateSet | null, roleType: string | null | undefined) {
    if (!rates?.categoryRules) return null;
    const key =
      roleType === 'DIRECTOR' ? 'CADRE'
      : roleType === 'TEACHER' ? 'ENSEIGNANT'
      : roleType === 'ADMIN' ? 'AGENT_MAITRISE'
      : 'OUVRIER_EMPLOYE';
    return rates.categoryRules[key] ?? null;
  }

  /** Type de document de paie dérivé (helper exposé pour les contrôleurs). */
  documentPaieTypeForStatut(statut: string | null | undefined) {
    return deriveDocumentPaieType(statut);
  }
}
