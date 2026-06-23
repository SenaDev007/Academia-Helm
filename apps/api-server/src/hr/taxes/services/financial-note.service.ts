/**
 * ============================================================================
 * FINANCIAL NOTES SERVICE — 36 Notes annexes SYSCOHADA
 * ============================================================================
 * Préchargement et gestion des 36 notes annexes du modèle SYSCOHADA.
 * ============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

interface NoteTemplate { code: string; title: string; lines: Array<{ label: string; note?: string }> }

export const SYSCOHADA_NOTES: NoteTemplate[] = [
  { code: 'NOTE 1', title: 'DETTES GARANTIES PAR DES SURETES REELLES', lines: [
    { label: 'Emprunts obligataires convertibles' }, { label: 'Autres emprunts obligataires' },
    { label: 'Emprunts et dettes des établissements de crédit' }, { label: 'Autres dettes financières' },
    { label: 'SOUS TOTAL (1)' }, { label: 'Dettes de crédit-bail immobilier' },
    { label: 'Dettes de crédit-bail mobilier' }, { label: 'Dettes sur contrats de location-vente' },
    { label: 'Dettes sur contrats de location-acquisition' }, { label: 'SOUS TOTAL (2)' },
  ]},
  { code: 'NOTE 2', title: 'INFORMATIONS OBLIGATOIRES', lines: [
    { label: 'A - Déclaration de conformité au SYSCOHADA' }, { label: 'B - Règles et méthodes comptables' },
    { label: 'C - Dérogation aux postulats et conventions' }, { label: 'D - Informations complémentaires relatives au tableau des flux' },
  ]},
  { code: 'NOTE 3A', title: 'IMMOBILISATION BRUTE', lines: [
    { label: "Frais de développement et de prospection" }, { label: 'Brevets, licences, logiciels et droits similaires' },
    { label: 'Fonds commercial et droit au bail' }, { label: 'Autres immobilisations incorporelles' },
    { label: 'Terrains' }, { label: 'Bâtiments' }, { label: 'Aménagements, agencements et installations' },
    { label: 'Matériel, mobilier et actifs biologiques' }, { label: 'Matériel de transport' },
    { label: 'Avances et acomptes versés sur immobilisations' }, { label: 'Titres de participation' },
    { label: 'Autres immobilisations financières' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 3B', title: 'BIENS PRIS EN LOCATION ACQUISITION', lines: [
    { label: 'Contrats en cours au début de lexercice' }, { label: 'Contrats conclus pendant lexercice' },
    { label: 'Contrats résiliés pendant lexercice' }, { label: 'Contrats en cours à la clôture' },
  ]},
  { code: 'NOTE 3C', title: 'IMMOBILISATIONS (AMORTISSEMENTS)', lines: [
    { label: 'Frais de développement et de prospection' }, { label: 'Brevets, licences, logiciels et droits' },
    { label: 'Fonds commercial et droit au bail' }, { label: 'Terrains' }, { label: 'Bâtiments' },
    { label: 'Aménagements, agencements et installations' }, { label: 'Matériel, mobilier et actifs biologiques' },
    { label: 'Matériel de transport' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 3D', title: 'IMMOBILISATIONS (PLUS-VALUES ET MOINS-VALUES)', lines: [
    { label: 'Immobilisations incorporelles' }, { label: 'Immobilisations corporelles' },
    { label: 'Immobilisations financières' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 3E', title: 'INFORMATIONS SUR LES REEVALUATIONS', lines: [
    { label: 'Nature et date des réévaluations' }, { label: 'Éléments réévalués par postes du bilan' },
    { label: 'Montants coûts historiques' }, { label: 'Amortissements supplémentaires' }, { label: 'Incidences sur les résultats' },
  ]},
  { code: 'NOTE 4', title: 'IMMOBILISATIONS FINANCIERES', lines: [
    { label: 'Titres de participation' }, { label: 'Prêts et créances' }, { label: 'Dépôts et cautionnements versés' },
    { label: 'Autres immobilisations financières' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 5', title: 'ACTIF CIRCULANT HAO', lines: [
    { label: "Créances sur cessions d'immobilisations" }, { label: 'Autres créances hors activités ordinaires' },
    { label: 'TOTAL BRUT' }, { label: 'Dépréciations' }, { label: 'TOTAL NET' },
  ]},
  { code: 'NOTE 6', title: 'STOCKS ET EN COURS', lines: [
    { label: 'Marchandises' }, { label: 'Matières premières et fournitures liées' }, { label: 'Autres approvisionnements' },
    { label: 'En-cours de production de biens' }, { label: 'En-cours de production de services' }, { label: 'Produits finis' },
    { label: 'TOTAL' },
  ]},
  { code: 'NOTE 7', title: 'CLIENTS', lines: [
    { label: 'Clients effets à recevoir' }, { label: 'Clients dettes en compte' }, { label: 'Clients - avances reçues' },
    { label: 'Créances litigieuses' }, { label: 'TOTAL BRUT' }, { label: 'Dépréciations' }, { label: 'TOTAL NET' },
  ]},
  { code: 'NOTE 8', title: 'AUTRES CREANCES', lines: [
    { label: 'Créances diverses' }, { label: 'État' }, { label: 'Comptes courants des administrateurs et dirigeants' },
    { label: 'Avances consenties au personnel' }, { label: 'Dépôts et cautionnements versés' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 8A', title: "TABLEAU D'ETALEMENT DES CHARGES IMMOBILISEES", lines: [
    { label: "Frais d'établissement" }, { label: 'Charges à répartir sur plusieurs exercices' },
    { label: 'Primes de remboursement des obligations' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 9', title: 'TITRES DE PLACEMENT', lines: [
    { label: 'Titres de trésor et bons de caisse à court terme' }, { label: 'Actions' }, { label: 'Obligations' },
    { label: 'Autres titres' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 10', title: 'VALEURS A ENCAISSER', lines: [
    { label: 'Effets à encaisser' }, { label: "Effets à l'encaissement" }, { label: 'Chèques à encaisser' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 11', title: 'DISPONIBILITES', lines: [
    { label: 'Banques locales' }, { label: 'Banques étrangères' }, { label: 'Chèques postaux' }, { label: 'Caisses' },
    { label: 'Régies d\'avances et accréditifs' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 12', title: 'ECARTS DE CONVERSION', lines: [
    { label: 'Écarts de conversion actif' }, { label: 'Écarts de conversion passif' },
  ]},
  { code: 'NOTE 13', title: 'CAPITAL', lines: [
    { label: 'Valeur nominale des actions ou parts' }, { label: 'Nombre d\'actions ou parts' },
    { label: 'Actionnaires (nom, nationalité, nature, nombre, montant)' },
  ]},
  { code: 'NOTE 14', title: 'PRIMES ET RESERVES', lines: [
    { label: "Prime d'apport" }, { label: "Primes d'émission" }, { label: 'Prime de fusion' },
    { label: 'Réserve légale' }, { label: 'Réserves statutaires' }, { label: 'Réserves réglementées' },
    { label: 'Réserves libres' }, { label: 'Report à nouveau' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 15A', title: 'TOTAL SUBVENTIONS ET PROVISIONS REGLEMENTEES', lines: [
    { label: 'État' }, { label: 'Régions' }, { label: 'Départements' }, { label: 'Communes' },
    { label: 'Entreprises publiques' }, { label: 'Entreprises privées' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 15B', title: 'AUTRES FONDS PROPRES', lines: [
    { label: 'Titres participatifs' }, { label: 'Avances conditionnées' },
    { label: 'Titres subordonnés à durée indéterminée' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 16A', title: 'EMPRUNTS ET DETTES FINANCIERES', lines: [
    { label: 'Emprunts obligataires' }, { label: 'Emprunts et dettes auprès des établissements de crédit' },
    { label: 'Avances reçues de l\'État' }, { label: 'Avances reçues et comptes courants bloqués' },
    { label: 'Dettes de crédit-bail' }, { label: 'Dettes sur contrats de location-acquisition' },
    { label: 'TOTAL' },
  ]},
  { code: 'NOTE 16B', title: 'ENGAGEMENTS DE RETRAITE', lines: [
    { label: "Taux d'augmentation des salaires" }, { label: "Taux d'actualisation" },
    { label: "Taux de rotation du personnel" }, { label: "Âge moyen de départ à la retraite" },
  ]},
  { code: 'NOTE 16B bis', title: 'ENGAGEMENTS DE RETRAITE (NET COMPTABILISE)', lines: [
    { label: "Valeur actuelle de l'obligation" }, { label: 'Valeur actuelle des actifs affectés' },
    { label: 'Gains ou pertes actuariels' }, { label: 'Passif net comptabilisé' },
  ]},
  { code: 'NOTE 16C', title: 'ACTIFS ET PASSIFS EVENTUELS', lines: [
    { label: 'Actif éventuel - Litiges' }, { label: 'Actif éventuel - Garanties' },
    { label: 'Passif éventuel - Litiges' }, { label: 'Passif éventuel - Garanties données' },
  ]},
  { code: 'NOTE 17', title: "FOURNISSEURS D'EXPLOITATION", lines: [
    { label: 'Fournisseurs dettes en compte (hors groupe)' }, { label: 'Fournisseurs effets à payer (hors groupe)' },
    { label: 'Fournisseurs dettes et effets à payer groupe' }, { label: 'Fournisseurs avances reçues' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 18', title: 'DETTES FISCALES ET SOCIALES', lines: [
    { label: 'Personnel avances et acomptes' }, { label: 'Personnel rémunérations dues' }, { label: 'Autres personnel' },
    { label: 'Caisse de sécurité sociale' }, { label: 'Caisse de retraite' }, { label: 'Autres organismes sociaux' },
    { label: 'TOTAL DETTES SOCIALES' }, { label: 'État impôts sur les bénéfices' }, { label: 'État impôts et taxes' },
    { label: 'État TVA' }, { label: 'État impôts retenus à la source' }, { label: 'Autres dettes État' },
    { label: 'TOTAL DETTES FISCALES' },
  ]},
  { code: 'NOTE 19', title: 'AUTRES DETTES', lines: [
    { label: 'Organismes internationaux' }, { label: 'Apporteurs, opérations sur le capital' },
    { label: 'Associés, compte courant' }, { label: 'Dépôts et cautionnements reçus' },
    { label: 'Provisions pour risques à court terme' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 20', title: "BANQUES, CREDITS D'ESCOMPTE ET DE TRESORERIE", lines: [
    { label: 'Escomptes de crédit de campagne' }, { label: 'Escomptes de crédit ordinaires' },
    { label: 'Concours bancaires' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 21', title: "CHIFFRE D'AFFAIRES ET AUTRES PRODUITS", lines: [
    { label: 'Ventes dans la région' }, { label: 'Ventes hors région' }, { label: 'Ventes groupe' },
    { label: 'Ventes à lexportation' }, { label: 'Prestations de services' }, { label: 'Produits accessoires' },
    { label: 'TOTAL' },
  ]},
  { code: 'NOTE 22', title: 'ACHATS', lines: [
    { label: 'Achats de marchandises' }, { label: 'Achats de matières premières et fournitures liées' },
    { label: 'Autres achats' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 23', title: 'TRANSPORTS', lines: [
    { label: 'Transports sur achats' }, { label: 'Transports sur ventes' }, { label: 'Transports de personnel' },
    { label: 'Transports pour le compte de tiers' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 24', title: 'SERVICES EXTERIEURS', lines: [
    { label: 'Sous-traitance générale' }, { label: 'Locations et charges locatives' }, { label: 'Assurances' },
    { label: 'Documentation' }, { label: 'Recherche et développement' }, { label: 'Publicité et publications' },
    { label: 'Frais bancaires' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 25', title: 'IMPOTS ET TAXES', lines: [
    { label: 'Patente et licences' }, { label: "Droit d'enregistrement et de timbre" },
    { label: 'Taxes sur appointements et salaires' }, { label: 'Taxes sur vehicles' },
    { label: 'Contributions diverses' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 26', title: 'AUTRES CHARGES', lines: [
    { label: 'Pertes sur créances' }, { label: 'Charges HAO' }, { label: 'Dotations aux dépréciations' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 27A', title: 'CHARGES DE PERSONNEL', lines: [
    { label: 'Rémunérations directes versées au personnel' }, { label: 'Indemnités forfaitaires versées au personnel' },
    { label: 'Charges sociales' }, { label: 'Charges fiscales sur appointements' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 27B', title: 'PERSONNEL (DETAIL)', lines: [
    { label: 'Effectif moyen permanent' }, { label: 'Effectif moyen temporaire' }, { label: 'Masse salariale brute' },
    { label: 'Charges sociales patronales' },
  ]},
  { code: 'NOTE 28', title: 'REPRISES ET DOTATIONS', lines: [
    { label: 'Reprises damortissements (exploitation)' }, { label: 'Reprises de provisions (exploitation)' },
    { label: 'Dotations aux amortissements (exploitation)' }, { label: 'Dotations aux provisions (exploitation)' },
    { label: 'Reprises financières' }, { label: 'Dotations financières' }, { label: 'Reprises HAO' }, { label: 'Dotations HAO' },
  ]},
  { code: 'NOTE 29', title: 'REVENUS FINANCIERS', lines: [
    { label: 'Revenus de titres de participation' }, { label: 'Revenus de prêts' }, { label: 'Revenus de dépôts' },
    { label: 'Revenus de comptes courants' }, { label: 'Escomptes obtenus' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 30', title: 'FRAIS FINANCIERS', lines: [
    { label: 'Intérêts sur emprunts' }, { label: 'Agios et frais bancaires' }, { label: 'Pertes de change' },
    { label: 'Escomptes accordés' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 31', title: 'PRODUITS HAO', lines: [
    { label: 'Subventions' }, { label: 'Dégrèvements dimpôts' }, { label: 'Indemnités dassurance' },
    { label: 'TOTAL' },
  ]},
  { code: 'NOTE 32', title: 'CHARGES HAO', lines: [
    { label: 'Valeurs comptables des cessions dimmobilisations' }, { label: 'Pénalités et amendes fiscales' },
    { label: 'Dons et libéralités' }, { label: 'TOTAL' },
  ]},
  { code: 'NOTE 33', title: 'ENGAGEMENTS FINANCIERS', lines: [
    { label: 'Cautions et garanties données' }, { label: 'Aval' }, { label: 'Engagements de crédit-bail' },
  ]},
  { code: 'NOTE 34', title: 'TAXE SUR VALEUR AJOUTEE', lines: [
    { label: 'TVA collectée' }, { label: 'TVA déductible' }, { label: 'TVA à reverser' }, { label: 'Reports de TVA' },
  ]},
  { code: 'NOTE 35', title: 'INFORMATIONS SUR LES PARTIES LIEES', lines: [
    { label: 'Montant des transactions avec les parties liées' }, { label: 'Soldes débiteurs' },
    { label: 'Soldes créditeurs' }, { label: 'Nature de la relation' },
  ]},
  { code: 'NOTE 36', title: 'EVENEMENTS POSTERIEURS', lines: [
    { label: 'Date de lévénement' }, { label: 'Nature de lévénement' }, { label: 'Montant' },
  ]},
];

@Injectable()
export class FinancialNoteService {
  private readonly logger = new Logger(FinancialNoteService.name);
  constructor(private prisma: PrismaService) {}

  async getOrCreateAll(tenantId: string, academicYearId: string) {
    let notes = await this.prisma.financialNote.findMany({
      where: { tenantId, academicYearId },
      orderBy: [{ noteCode: 'asc' }, { sortOrder: 'asc' }],
    });

    if (notes.length === 0) {
      let order = 0;
      for (const note of SYSCOHADA_NOTES) {
        for (const line of note.lines) {
          await this.prisma.financialNote.create({
            data: {
              tenantId, academicYearId,
              noteCode: note.code,
              noteTitle: note.title,
              lineLabel: line.label,
              amountN: 0,
              sortOrder: order++,
            },
          }).catch(() => {});
        }
      }
      notes = await this.prisma.financialNote.findMany({
        where: { tenantId, academicYearId },
        orderBy: [{ noteCode: 'asc' }, { sortOrder: 'asc' }],
      });
    }
    return notes;
  }

  async updateLine(id: string, amountN?: number, amountN1?: number) {
    return this.prisma.financialNote.update({
      where: { id },
      data: { amountN: amountN ?? undefined, amountN1: amountN1 ?? undefined },
    });
  }

  async getNoteTitles() {
    return SYSCOHADA_NOTES.map(n => ({ code: n.code, title: n.title, lineCount: n.lines.length }));
  }
}
