/**
 * ============================================================================
 * FINANCIAL STATEMENT SERVICE — États financiers SYSCOHADA
 * ============================================================================
 *
 * Gère le Bilan (Actif/Passif), le Compte de Résultat et le Tableau de Flux
 * de Trésorerie (TFT), avec le référentiel de codes SYSCOHADA préchargé.
 *
 * Comparatif N / N-1 systématique.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

// ─── Référentiel SYSCOHADA : BILAN ACTIF ──────────────────────────────────
const BILAN_ACTIF_LINES = [
  { code: 'AD', label: 'IMMOBILISATIONS INCORPORELLES', note: '3', category: 'IMMOBILISATIONS', isSubtotal: true, sortOrder: 1 },
  { code: 'AE', label: 'Frais de développement et de prospection', sortOrder: 2 },
  { code: 'AF', label: 'Brevets, licences, logiciels et droits', sortOrder: 3 },
  { code: 'AG', label: 'Fonds commercial et droit au bail', sortOrder: 4 },
  { code: 'AH', label: 'Autres immobilisations incorporelles', sortOrder: 5 },
  { code: 'AI', label: 'IMMOBILISATIONS CORPORELLES', note: '3', category: 'IMMOBILISATIONS', isSubtotal: true, sortOrder: 6 },
  { code: 'AJ', label: 'Terrains', sortOrder: 7 },
  { code: 'AK', label: 'Bâtiments', sortOrder: 8 },
  { code: 'AL', label: 'Aménagements, agencements et installations', sortOrder: 9 },
  { code: 'AM', label: 'Matériel, mobilier et actifs biologiques', sortOrder: 10 },
  { code: 'AN', label: 'Matériel de transport', sortOrder: 11 },
  { code: 'AP', label: 'Avances et acomptes versés sur immobilisations', note: '3', sortOrder: 12 },
  { code: 'AQ', label: 'IMMOBILISATIONS FINANCIÈRES', note: '4', category: 'IMMOBILISATIONS', isSubtotal: true, sortOrder: 13 },
  { code: 'AR', label: 'Titres de participation', sortOrder: 14 },
  { code: 'AS', label: 'Autres immobilisations financières', sortOrder: 15 },
  { code: 'AZ', label: 'TOTAL ACTIF IMMOBILISÉ', isTotal: true, category: 'IMMOBILISATIONS', sortOrder: 16 },
  { code: 'BA', label: 'ACTIF CIRCULANT HAO', note: '5', category: 'CIRCULANT', isSubtotal: true, sortOrder: 17 },
  { code: 'BB', label: 'Stocks et encours', note: '6', category: 'CIRCULANT', sortOrder: 18 },
  { code: 'BG', label: 'CRÉANCES ET EMPLOIS ASSIMILÉS', category: 'CIRCULANT', isSubtotal: true, sortOrder: 19 },
  { code: 'BH', label: 'Fournisseurs avances versées', note: '17', sortOrder: 20 },
  { code: 'BI', label: 'Clients', note: '7', sortOrder: 21 },
  { code: 'BJ', label: 'Autres créances', note: '8', sortOrder: 22 },
  { code: 'BK', label: 'TOTAL ACTIF CIRCULANT', category: 'CIRCULANT', isTotal: true, sortOrder: 23 },
  { code: 'BQ', label: 'Titres de placement', note: '9', category: 'TRESORERIE', sortOrder: 24 },
  { code: 'BR', label: 'Valeurs à encaisser', note: '10', category: 'TRESORERIE', sortOrder: 25 },
  { code: 'BS', label: 'Banques, chèques postaux, caisse et assimilés', note: '11', category: 'TRESORERIE', sortOrder: 26 },
  { code: 'BT', label: 'TOTAL TRÉSORERIE-ACTIF', category: 'TRESORERIE', isTotal: true, sortOrder: 27 },
  { code: 'BU', label: 'Écart de conversion-Actif', note: '12', sortOrder: 28 },
  { code: 'BZ', label: 'TOTAL GÉNÉRAL', isTotal: true, sortOrder: 29 },
];

// ─── Référentiel SYSCOHADA : BILAN PASSIF ─────────────────────────────────
const BILAN_PASSIF_LINES = [
  { code: 'CA', label: 'Capital', note: '13', category: 'CAPITAUX_PROPRES', sortOrder: 1 },
  { code: 'CB', label: 'Apporteurs capital non appelé', note: '13', sortOrder: 2 },
  { code: 'CD', label: 'Primes liées au capital social', note: '14', sortOrder: 3 },
  { code: 'CE', label: 'Écarts de réévaluation', note: '3e', sortOrder: 4 },
  { code: 'CF', label: 'Réserves indisponibles', note: '14', sortOrder: 5 },
  { code: 'CG', label: 'Réserves libres', note: '14', sortOrder: 6 },
  { code: 'CH', label: 'Report à nouveau', note: '14', sortOrder: 7 },
  { code: 'CJ', label: "Résultat net de l'exercice", sortOrder: 8 },
  { code: 'CL', label: "Subventions d'investissement", note: '15', sortOrder: 9 },
  { code: 'CM', label: 'Provisions réglementées', note: '15', sortOrder: 10 },
  { code: 'CP', label: 'TOTAL CAPITAUX PROPRES ET RESSOURCES ASSIMILÉES', category: 'CAPITAUX_PROPRES', isTotal: true, sortOrder: 11 },
  { code: 'DA', label: 'Emprunts et dettes financières diverses', note: '16', category: 'DETTES_FINANCIERES', sortOrder: 12 },
  { code: 'DB', label: 'Dettes de location-acquisition', note: '16', sortOrder: 13 },
  { code: 'DC', label: 'Provisions pour risques et charges', note: '16', sortOrder: 14 },
  { code: 'DD', label: 'TOTAL DETTES FINANCIÈRES ET RESSOURCES ASSIMILÉES', category: 'DETTES_FINANCIERES', isTotal: true, sortOrder: 15 },
  { code: 'DF', label: 'TOTAL RESSOURCES STABLES', isTotal: true, sortOrder: 16 },
  { code: 'DH', label: 'Dettes circulantes HAO', note: '5', category: 'PASSIF_CIRCULANT', sortOrder: 17 },
  { code: 'DI', label: 'Clients, avances reçues', note: '7', sortOrder: 18 },
  { code: 'DJ', label: "Fournisseurs d'exploitation", note: '17', sortOrder: 19 },
  { code: 'DK', label: 'Dettes fiscales et sociales', note: '18', sortOrder: 20 },
  { code: 'DM', label: 'Autres dettes', note: '19', sortOrder: 21 },
  { code: 'DN', label: 'Provisions pour risques à court terme', note: '19', sortOrder: 22 },
  { code: 'DP', label: 'TOTAL PASSIF CIRCULANT', category: 'PASSIF_CIRCULANT', isTotal: true, sortOrder: 23 },
  { code: 'DQ', label: "Banques, crédits d'escompte", note: '20', category: 'TRESORERIE', sortOrder: 24 },
  { code: 'DR', label: 'Banques, établissements financiers et crédits de trésorerie', note: '20', category: 'TRESORERIE', sortOrder: 25 },
  { code: 'DT', label: 'TOTAL TRÉSORERIE-PASSIF', category: 'TRESORERIE', isTotal: true, sortOrder: 26 },
  { code: 'DV', label: 'Écart de conversion-Passif', note: '12', sortOrder: 27 },
  { code: 'DZ', label: 'TOTAL GÉNÉRAL', isTotal: true, sortOrder: 28 },
];

// ─── Référentiel SYSCOHADA : COMPTE DE RÉSULTAT ───────────────────────────
const COMPTE_RESULTAT_LINES = [
  { code: 'TA', label: 'Ventes de marchandises', note: '21', sign: '+', sortOrder: 1 },
  { code: 'RA', label: 'Achats de marchandises', note: '22', sign: '-', sortOrder: 2 },
  { code: 'RB', label: 'Variation de stocks de marchandises', note: '6', sign: '-/+', sortOrder: 3 },
  { code: 'XA', label: 'MARGE COMMERCIALE', isSubtotal: true, sortOrder: 4 },
  { code: 'TB', label: 'Ventes de produits fabriqués', note: '21', sign: '+', sortOrder: 5 },
  { code: 'TC', label: 'Travaux, services vendus', note: '21', sign: '+', sortOrder: 6 },
  { code: 'TD', label: 'Produits accessoires', note: '21', sign: '+', sortOrder: 7 },
  { code: 'XB', label: "CHIFFRE D'AFFAIRES", isSubtotal: true, sortOrder: 8 },
  { code: 'TE', label: 'Production stockée (ou déstockage)', note: '6', sign: '-/+', sortOrder: 9 },
  { code: 'TF', label: 'Production immobilisée', note: '21', sortOrder: 10 },
  { code: 'TG', label: "Subventions d'exploitation", note: '21', sortOrder: 11 },
  { code: 'TH', label: 'Autres produits', note: '21', sign: '+', sortOrder: 12 },
  { code: 'TI', label: "Transferts de charges d'exploitation", note: '12', sign: '+', sortOrder: 13 },
  { code: 'RC', label: 'Achats de matières premières et fournitures liées', note: '22', sign: '-', sortOrder: 14 },
  { code: 'RD', label: 'Variation de stocks de matières premières', note: '6', sign: '-/+', sortOrder: 15 },
  { code: 'RE', label: 'Autres achats', note: '22', sign: '-', sortOrder: 16 },
  { code: 'RF', label: "Variation de stocks d'autres approvisionnements", note: '6', sign: '-/+', sortOrder: 17 },
  { code: 'RG', label: 'Transports', note: '23', sign: '-', sortOrder: 18 },
  { code: 'RH', label: 'Services extérieurs', note: '24', sign: '-', sortOrder: 19 },
  { code: 'RI', label: 'Impôts et taxes', note: '25', sign: '-', sortOrder: 20 },
  { code: 'RJ', label: 'Autres charges', note: '26', sign: '-', sortOrder: 21 },
  { code: 'XC', label: 'VALEUR AJOUTÉE', isSubtotal: true, sortOrder: 22 },
  { code: 'RK', label: 'Charges de personnel', note: '27', sign: '-', sortOrder: 23 },
  { code: 'XD', label: "EXCÉDENT BRUT D'EXPLOITATION", isSubtotal: true, sortOrder: 24 },
  { code: 'TJ', label: "Reprises d'amortissements, provisions et dépréciations", note: '28', sign: '+', sortOrder: 25 },
  { code: 'RL', label: "Dotations aux amortissements, provisions et dépréciations", note: '3C&28', sign: '-', sortOrder: 26 },
  { code: 'XE', label: "RÉSULTAT D'EXPLOITATION", isSubtotal: true, sortOrder: 27 },
  { code: 'TK', label: 'Revenus financiers et assimilés', note: '29', sign: '+', sortOrder: 28 },
  { code: 'TL', label: 'Reprises de provisions et dépréciations financières', note: '28', sign: '+', sortOrder: 29 },
  { code: 'TM', label: 'Transferts de charges financières', note: '12', sign: '+', sortOrder: 30 },
  { code: 'RM', label: 'Frais financiers et charges assimilées', note: '29', sign: '-', sortOrder: 31 },
  { code: 'RN', label: 'Dotations aux provisions et dépréciations financières', note: '3C&28', sign: '-', sortOrder: 32 },
  { code: 'XF', label: 'RÉSULTAT FINANCIER', isSubtotal: true, sortOrder: 33 },
  { code: 'XG', label: 'RÉSULTAT DES ACTIVITÉS ORDINAIRES', isSubtotal: true, sortOrder: 34 },
  { code: 'TS', label: 'Produits des activités HAO', note: '30', sign: '+', sortOrder: 35 },
  { code: 'RS', label: 'Charges HAO', note: '31', sign: '-', sortOrder: 36 },
  { code: 'XH', label: 'RÉSULTAT HAO', isSubtotal: true, sortOrder: 37 },
  { code: 'XI', label: 'RÉSULTAT NET DE L\'EXERCICE', isTotal: true, sortOrder: 38 },
];

// ─── Référentiel SYSCOHADA : TFT ──────────────────────────────────────────
const TFT_LINES = [
  { code: 'ZA', label: 'Trésorerie nette au 1er janvier', sortOrder: 1 },
  { code: '', label: 'Flux de trésorerie provenant des activités opérationnelles', isSubtotal: true, sortOrder: 2 },
  { code: 'FA', label: "Capacité d'Autofinancement Global", sortOrder: 3 },
  { code: 'FB', label: '- Variation Actif circulant HAO', sortOrder: 4 },
  { code: 'FC', label: '- Variation des stocks', sortOrder: 5 },
  { code: 'FD', label: '- Variation des créances', sortOrder: 6 },
  { code: 'FE', label: '+ Variation du passif circulant', sortOrder: 7 },
  { code: '', label: 'Variation du BF lié aux activités opérationnelles', isSubtotal: true, sortOrder: 8 },
  { code: 'ZB', label: 'Flux de trésorerie provenant des activités opérationnelles', isTotal: true, sortOrder: 9 },
  { code: '', label: 'Flux de trésorerie provenant des activités d\'investissement', isSubtotal: true, sortOrder: 10 },
  { code: 'FF', label: '- Décaissements liés aux acquisitions d\'immobilisations', sortOrder: 11 },
  { code: 'FG', label: '- Décaissements liés aux acquisitions d\'immobilisations financières', sortOrder: 12 },
  { code: 'FH', label: '- Décaissements liés aux prêts', sortOrder: 13 },
  { code: 'FI', label: '+ Encaissements liés aux cessions d\'immobilisations', sortOrder: 14 },
  { code: 'ZC', label: 'Flux de trésorerie provenant des activités d\'investissement', isTotal: true, sortOrder: 15 },
  { code: '', label: 'Flux de trésorerie provenant des activités de financement', isSubtotal: true, sortOrder: 16 },
  { code: 'FJ', label: '+ Encaissements liés aux augmentations de capital', sortOrder: 17 },
  { code: 'FK', label: '+ Encaissements liés aux subventions d\'investissement', sortOrder: 18 },
  { code: 'FL', label: '+ Encaissements liés aux emprunts et dettes financières', sortOrder: 19 },
  { code: 'FM', label: '- Remboursements d\'emprunts et dettes financières', sortOrder: 20 },
  { code: 'FN', label: '- Dividendes versés', sortOrder: 21 },
  { code: 'ZD', label: 'Flux de trésorerie provenant des activités de financement', isTotal: true, sortOrder: 22 },
  { code: 'ZE', label: 'Variation de trésorerie de l\'exercice', isTotal: true, sortOrder: 23 },
  { code: 'ZG', label: 'Trésorerie nette à la clôture', isTotal: true, sortOrder: 24 },
];

const REFERENTIEL: Record<string, any[]> = {
  BILAN_ACTIF: BILAN_ACTIF_LINES,
  BILAN_PASSIF: BILAN_PASSIF_LINES,
  COMPTE_RESULTAT: COMPTE_RESULTAT_LINES,
  TFT: TFT_LINES,
};

@Injectable()
export class FinancialStatementService {
  private readonly logger = new Logger(FinancialStatementService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Récupère ou initialise les lignes d'un état financier pour une année.
   */
  async getOrCreate(tenantId: string, academicYearId: string, type: string) {
    let lines = await this.prisma.financialStatement.findMany({
      where: { tenantId, academicYearId, type },
      orderBy: { sortOrder: 'asc' },
    });

    if (lines.length === 0) {
      // Initialiser avec le référentiel SYSCOHADA
      const template = REFERENTIEL[type] || [];
      for (const line of template) {
        await this.prisma.financialStatement.create({
          data: {
            tenantId,
            academicYearId,
            type,
            lineCode: line.code || `AUTO-${line.sortOrder}`,
            lineLabel: line.label,
            note: line.note || null,
            category: line.category || null,
            isSubtotal: line.isSubtotal || false,
            isTotal: line.isTotal || false,
            sortOrder: line.sortOrder,
            amountN: 0,
          },
        }).catch(() => {}); // Ignore les doublons
      }
      lines = await this.prisma.financialStatement.findMany({
        where: { tenantId, academicYearId, type },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return lines;
  }

  /**
   * Met à jour le montant d'une ligne.
   */
  async updateLine(id: string, amountN?: number, amountN1?: number) {
    return this.prisma.financialStatement.update({
      where: { id },
      data: {
        amountN: amountN !== undefined ? amountN : undefined,
        amountN1: amountN1 !== undefined ? amountN1 : undefined,
      },
    });
  }

  /**
   * Met à jour plusieurs lignes en batch.
   */
  async updateLines(updates: Array<{ id: string; amountN?: number; amountN1?: number }>) {
    const results = [];
    for (const u of updates) {
      try {
        const r = await this.updateLine(u.id, u.amountN, u.amountN1);
        results.push(r);
      } catch (e: any) {
        this.logger.warn(`updateLine failed for ${u.id}: ${e.message}`);
      }
    }
    return results;
  }

  /**
   * Récupère les totaux pour le tableau de bord.
   */
  async getSummary(tenantId: string, academicYearId: string) {
    const [actif, passif, resultat] = await Promise.all([
      this.prisma.financialStatement.findFirst({ where: { tenantId, academicYearId, type: 'BILAN_ACTIF', lineCode: 'BZ' } }),
      this.prisma.financialStatement.findFirst({ where: { tenantId, academicYearId, type: 'BILAN_PASSIF', lineCode: 'DZ' } }),
      this.prisma.financialStatement.findFirst({ where: { tenantId, academicYearId, type: 'COMPTE_RESULTAT', lineCode: 'XI' } }),
    ]);

    return {
      totalActif: actif?.amountN || 0,
      totalPassif: passif?.amountN || 0,
      resultatNet: resultat?.amountN || 0,
    };
  }
}
