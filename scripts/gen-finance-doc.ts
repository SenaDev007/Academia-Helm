/**
 * Génération de la documentation fonctionnelle complète du module Finance d'Academia Helm.
 * Task ID: doc-finance-module
 *
 * Usage : npx tsx /home/z/my-project/scripts/gen-finance-doc.ts
 * Sortie : /home/z/my-project/download/Academia_Helm_Module_Finance_Documentation.docx
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  TableOfContents,
  SectionType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  VerticalAlign,
  HeightRule,
} from "docx";
import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes graphiques
// ─────────────────────────────────────────────────────────────────────────────
const NAVY = "0D1F6E";        // Bleu marine — fond de la page de garde
const NAVY_DARK = "0A1750";
const ACCENT = "1F3864";      // Bleu marine plus clair — sous-titres
const WHITE = "FFFFFF";
const LIGHT_GRAY = "F2F2F2";  // En-têtes de tableaux
const BORDER_GRAY = "BFBFBF";
const FONT = "Calibri";       // Police imposée par le cahier des charges
const FONT_BOLD = "Calibri";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de construction
// ─────────────────────────────────────────────────────────────────────────────

/** Paragraphe corps standard : Calibri 11pt, interligne 1.3, justifié. */
function p(text: string, opts: { bold?: boolean; italic?: boolean; indent?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): Paragraph {
  return new Paragraph({
    spacing: { line: 312, before: 0, after: 120 },
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    indent: opts.indent ? { firstLine: convertInchesToTwip(0.25) } : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        size: 22, // 11pt
        bold: opts.bold,
        italics: opts.italic,
      }),
    ],
  });
}

/** Titre H1 — Calibri Bold 16pt, navy. */
function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 180, line: 312 },
    children: [new TextRun({ text, font: FONT_BOLD, bold: true, size: 32, color: NAVY })],
  });
}

/** Titre H2 — Calibri Bold 13pt. */
function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120, line: 312 },
    children: [new TextRun({ text, font: FONT_BOLD, bold: true, size: 26, color: ACCENT })],
  });
}

/** Titre H3 — Calibri Bold 12pt. */
function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100, line: 312 },
    children: [new TextRun({ text, font: FONT_BOLD, bold: true, size: 24, color: ACCENT })],
  });
}

/** Saut de page (dans un paragraphe). */
function pageBreak(): Paragraph {
  return new Paragraph({ children: [new PageBreak()] });
}

/** Liste à puces. */
function bullet(text: string, opts: { bold?: boolean } = {}): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, font: FONT, size: 22, bold: opts.bold })],
  });
}

/** Liste à puces avec libellé en gras + valeur normale. */
function bulletKV(label: string, value: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { line: 312, after: 60 },
    children: [
      new TextRun({ text: `${label} : `, font: FONT_BOLD, bold: true, size: 22 }),
      new TextRun({ text: value, font: FONT, size: 22 }),
    ],
  });
}

/** Cellule de tableau — helper générique. */
function cell(text: string, opts: { bold?: boolean; bg?: string; color?: string; width?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): TableCell {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { type: ShadingType.CLEAR, color: "auto", fill: opts.bg } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        spacing: { line: 276, before: 0, after: 0 },
        children: [
          new TextRun({
            text,
            font: opts.bold ? FONT_BOLD : FONT,
            size: 20, // 10pt pour les tableaux
            bold: opts.bold,
            color: opts.color,
          }),
        ],
      }),
    ],
  });
}

/** Construit un tableau standardisé (en-tête navy + lignes alternées). */
function buildTable(headers: string[], rows: string[][], colWidths?: number[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) =>
      cell(h, { bold: true, bg: NAVY, color: WHITE, width: colWidths?.[i], align: AlignmentType.LEFT })
    ),
  });

  const bodyRows = rows.map(
    (row, idx) =>
      new TableRow({
        cantSplit: true,
        children: row.map((c, i) =>
          cell(c, { bg: idx % 2 === 0 ? WHITE : LIGHT_GRAY, width: colWidths?.[i] })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY },
      left: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY },
      right: { style: BorderStyle.SINGLE, size: 4, color: BORDER_GRAY },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: BORDER_GRAY },
    },
  });
}

/** Paragraphe vide (espacement). */
function spacer(size: number = 120): Paragraph {
  return new Paragraph({ spacing: { before: 0, after: size, line: 312 }, children: [new TextRun({ text: "", font: FONT, size: 22 })] });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE DE GARDE — fond bleu marine + texte blanc
// ─────────────────────────────────────────────────────────────────────────────
function buildCoverPage(): Table {
  // Cellule unique pleine page avec fond navy
  const coverCell = new TableCell({
    width: { size: 100, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: NAVY },
    margins: { top: 1200, bottom: 1200, left: 1000, right: 1000 },
    verticalAlign: VerticalAlign.CENTER,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: NAVY },
      bottom: { style: BorderStyle.NONE, size: 0, color: NAVY },
      left: { style: BorderStyle.NONE, size: 0, color: NAVY },
      right: { style: BorderStyle.NONE, size: 0, color: NAVY },
    },
    children: [
      // Bandeau supérieur
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 200, line: 312 },
        children: [
          new TextRun({ text: "ACADEMIA HELM", font: FONT_BOLD, bold: true, size: 32, color: WHITE, characterSpacing: 80 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 800, line: 312 },
        children: [
          new TextRun({ text: "Plateforme SaaS de gestion scolaire — Édition 2026", font: FONT, italics: true, size: 20, color: "C5CCE8" }),
        ],
      }),

      // Ligne décorative
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400, line: 312 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: WHITE, space: 1 } },
        children: [new TextRun({ text: "", font: FONT, size: 22 })],
      }),

      // Titre principal
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 200, line: 360 },
        children: [
          new TextRun({ text: "Module Finance", font: FONT_BOLD, bold: true, size: 72, color: WHITE }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600, line: 360 },
        children: [
          new TextRun({ text: "& Économat", font: FONT_BOLD, bold: true, size: 72, color: WHITE }),
        ],
      }),

      // Sous-titre
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200, line: 312 },
        children: [
          new TextRun({ text: "Documentation fonctionnelle complète", font: FONT, size: 28, color: WHITE }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 800, line: 312 },
        children: [
          new TextRun({ text: "Vue exhaustive des 12 onglets, 47 sous-onglets et 70 fichiers backend", font: FONT, italics: true, size: 20, color: "C5CCE8" }),
        ],
      }),

      // Ligne décorative
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400, line: 312 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "5A6BB5", space: 1 } },
        children: [new TextRun({ text: "", font: FONT, size: 22 })],
      }),

      // Bloc méta
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 100, line: 312 },
        children: [
          new TextRun({ text: "Édition 2026 · Version 1.0", font: FONT_BOLD, bold: true, size: 22, color: WHITE }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 100, line: 312 },
        children: [
          new TextRun({ text: "ORION · SARA · ATLAS — Architecture fédérée multi-tenant", font: FONT, size: 20, color: "C5CCE8" }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 1200, line: 312 },
        children: [
          new TextRun({ text: "Conforme OHADA · Export FEC · Intégration Fedapay & Mobile Money", font: FONT, italics: true, size: 18, color: "9AA5D6" }),
        ],
      }),

      // Pied de page
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800, after: 0, line: 312 },
        children: [
          new TextRun({ text: "© 2026 Academia Helm — Document interne. Tous droits réservés.", font: FONT, size: 16, color: "9AA5D6" }),
        ],
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        cantSplit: true,
        height: { value: 13800, rule: HeightRule.EXACT },
        children: [coverCell],
      }),
    ],
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: NAVY },
      bottom: { style: BorderStyle.NONE, size: 0, color: NAVY },
      left: { style: BorderStyle.NONE, size: 0, color: NAVY },
      right: { style: BorderStyle.NONE, size: 0, color: NAVY },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: NAVY },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: NAVY },
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE DES MATIÈRES — champ TOC auto
// ─────────────────────────────────────────────────────────────────────────────
function buildTOC(): (Paragraph | TableOfContents)[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 400, line: 312 },
      children: [new TextRun({ text: "Table des matières", font: FONT_BOLD, bold: true, size: 36, color: NAVY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 400, line: 312 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 1 } },
      children: [new TextRun({ text: "", font: FONT, size: 22 })],
    }),
    new TableOfContents("Table des matières", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 240, after: 0, line: 312 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Astuce : pour actualiser la pagination, cliquez droit sur la table des matières puis « Mettre à jour les champs ».",
          font: FONT,
          italics: true,
          size: 18,
          color: "808080",
        }),
      ],
    }),
    pageBreak(),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAPITRES — 16 chapitres détaillés
// ─────────────────────────────────────────────────────────────────────────────

/** Chapitre 1 — Introduction & Architecture (section 3 du plan). */
function chap1Introduction(): (Paragraph | Table)[] {
  return [
    h1("1. Introduction & Architecture du module Finance"),

    p(
      "Le module Finance & Économat constitue l'un des piliers fonctionnels de la plateforme Academia Helm. Conçu pour répondre aux besoins des établissements scolaires béninois et africains, il couvre l'intégralité du cycle financier : de la configuration des frais de scolarité jusqu'à l'export comptable OHADA, en passant par les encaissements multi-canal, le recouvrement des arriérés, la gestion multi-caisses, le contrôle interne et l'audit anti-fraude. Ce module a été conçu dès l'origine pour supporter une architecture multi-tenant stricte et multi-année, avec une séparation nette entre les données financières de chaque établissement et de chaque exercice scolaire."
    ),
    p(
      "Le module s'articule autour de douze onglets principaux accessibles depuis la barre latérale de l'espace d'administration de l'établissement. Chaque onglet expose un domaine métier autonome, mais partage avec les autres un socle commun : le moteur de calcul des comptes élèves, le moteur ORION de détection d'anomalies, et la couche d'intégration comptable OHADA. Cette architecture modulaire permet à la fois une grande souplesse d'usage et une cohérence forte des données financières à l'échelle de l'établissement."
    ),

    h2("1.1 Vue d'ensemble fonctionnelle"),
    p(
      "Le module Finance met à disposition douze onglets : Tableau de bord, Configuration des frais, Personnalisations, Comptes élèves, Multi-caisses, Encaissements, Recouvrement & Arriérés, Dépenses & Budget, Clôture & Trésorerie, Rapports financiers, Contrôle & Audit, et Paramétrage. À ces douze onglets s'ajoutent deux chapitres transverses traités dans la présente documentation : l'intégration comptable OHADA/FEC et la distinction nouvel élève / ancien élève. Au total, le module expose quarante-sept sous-onglets et plus de deux cents écrans interactifs."
    ),
    p(
      "Chaque onglet est conçu selon une logique progressive : un tableau de bord synthétique en haut, des filtres contextuels, un tableau de données principal avec pagination, et des modales d'action (création, modification, suppression, export). Les exports sont systématiquement disponibles en Excel et PDF, et pour certains en CSV comptable. Les notifications aux parents se font via trois canaux : email, WhatsApp et SMS, avec une politique de repli automatique en cas d'échec d'un canal."
    ),

    h2("1.2 Architecture multi-tenant et multi-année"),
    p(
      "L'architecture du module repose sur une séparation stricte des données par tenant (établissement) et par année scolaire. Toute table financière porte les colonnes tenantId et academicYearId, ce qui garantit qu'aucune donnée ne fuite d'un établissement à l'autre ni d'un exercice à l'autre. Les migrations Prisma et les triggers PostgreSQL appliquent cette contrainte au niveau base de données, en complément des gardes applicatives NestJS."
    ),
    p(
      "Le multi-année est particulièrement critique pour le recouvrement : les arriérés d'une année N sont reportés automatiquement sur l'année N+1 lors du passage à la nouvelle année scolaire, et les paiements reçus en N+1 peuvent être alloués en priorité aux arriérés de l'année antérieure selon le principe FIFO. Cette logique est implémentée dans les services receipt-finance.service.ts et collection-prisma.service.ts, et est matérialisée par la table FeeArrear qui conserve l'année d'origine de chaque arriéré."
    ),
    buildTable(
      ["Principe", "Implémentation", "Niveau de garantie"],
      [
        ["Isolation tenant", "Colonne tenantId sur toutes tables + JWT guard", "Base + Application"],
        ["Isolation année", "Colonne academicYearId + filtres systématiques", "Application"],
        ["Intégrité comptable", "Triggers PostgreSQL + hash SHA-256", "Base"],
        ["Traçabilité", "Audit log automatique sur toute mutation", "Application"],
        ["Multi-devises", "FCFA natif + champ currencyCode", "Application"],
      ],
      [25, 50, 25]
    ),
    spacer(),

    h2("1.3 ORION — Moteur d'intelligence artificielle financière"),
    p(
      "ORION est le moteur transverse d'analyse et de détection d'anomalies d'Academia Helm. Dans le module Finance, ORION joue trois rôles : surveillance des KPIs en temps réel, détection d'anomalies comptables (écarts de caisse, transactions suspectes, doublons de paiement), et scoring de risque de recouvrement par élève. Les alertes ORION sont affichées sous forme de bandeaux repliables dans chaque onglet du module, avec un code couleur à trois niveaux : critique (rouge), avertissement (orange), info (bleu)."
    ),
    p(
      "Le moteur ORION s'appuie sur des requêtes agrégées planifiées (cron toutes les heures) et sur des triggers déclenchés à chaque mutation financière. Chaque alerte comporte un titre, une description, une recommandation actionnable et, lorsque pertinent, un échantillon des enregistrements concernés (par exemple la liste des élèves sans matricule ou des transactions en écart de caisse). Les alertes sont consultables dans l'onglet Contrôle & Audit et un récapitulatif est remonté dans le Tableau de bord principal."
    ),

    h2("1.4 Backend — 70 fichiers dédiés"),
    p(
      "Le backend du module Finance est implémenté dans apps/api-server/src/finance/ et compte environ soixante-dix fichiers TypeScript : contrôleurs, services, DTO, modules NestJS, templates d'email et de reçu PDF, helpers OHADA, et services de notification multi-canal. Cette densité reflète la richesse fonctionnelle du module : chaque onglet dispose de son propre contrôleur REST, de son service métier, et le cas échéant de sous-services spécialisés (recouvrement, clôture, audit, export comptable)."
    ),
    p(
      "L'API REST exposée suit la convention /api/finance/{ressource} et utilise le guard JWT combiné au guard @Roles pour le contrôle d'accès. Les rôles habilités sur le module Finance sont principalement DIRECTOR, ADMIN, ACCOUNTANT et SCHOOL_OWNER. Le promotor (PROMOTER) dispose d'un accès en lecture sur l'ensemble du module. Les exports et reçus PDF sont générés via PDFKit, et les notifications multi-canal utilisent les services Gupshup (WhatsApp), SMTP (email) et une passerelle SMS locale."
    ),
    buildTable(
      ["Type de fichier", "Nombre approximatif", "Rôle"],
      [
        ["Contrôleurs REST", "18", "Endpoints HTTP sous /api/finance"],
        ["Services métier", "22", "Logique : comptes, encaissements, recouvrement, clôture"],
        ["DTO & validation", "12", "Schémas class-validator par endpoint"],
        ["Templates PDF / email", "8", "Reçus, relances, rapports comptables"],
        ["Helpers OHADA / FEC", "5", "Mapping comptable et export FEC"],
        ["Services de notification", "5", "Email, WhatsApp, SMS, repli automatique"],
      ],
      [35, 25, 40]
    ),
    spacer(),
    pageBreak(),
  ];
}

/** Chapitre 2 — Tableau de Bord (section 4). */
function chap2Dashboard(): (Paragraph | Table)[] {
  return [
    h1("2. Tableau de Bord"),
    p(
      "Le Tableau de Bord est l'écran d'atterrissage du module Finance. Il offre en un coup d'œil une vision synthétique de la santé financière de l'établissement sur l'année scolaire en cours, agrégée par caisse, par classe et par régime de frais. L'écran est conçu pour être consultable en moins de trente secondes : les cinq indicateurs clés (KPIs) sont alignés en haut, l'évolution mensuelle des encaissements et dépenses occupe le centre, et les alertes ORION ainsi que le top 5 des arriérés ferment la page."
    ),
    p(
      "Toutes les données affichées sont filtrées par tenant et par année scolaire active, et sont rafraîchies automatiquement toutes les cinq minutes ainsi qu'à chaque action utilisateur significative (nouveau paiement, clôture de caisse, détection d'arriérés). Le tableau de bord s'appuie sur des vues SQL matérialisées pour garantir des temps de réponse inférieurs à une seconde même sur les établissements de plus de cinq mille élèves."
    ),

    h2("2.1 Les cinq KPIs principaux"),
    p(
      "Le tableau de bord affiche cinq indicateurs clés alignés horizontalement. Chaque KPI est présenté sous forme d'une carte avec : la valeur courante, l'unité (FCFA, %, ou nombre), une flèche d'évolution par rapport à la période précédente (vers le haut en vert si positif, vers le bas en rouge si négatif), et un sous-titre explicatif. Les KPIs sont calculés en temps réel à partir des tables finance_transactions, student_account et expense."
    ),
    buildTable(
      ["KPI", "Description", "Source de données"],
      [
        ["Encaissements du jour", "Total des paiements validés entre 00h00 et l'heure courante", "finance_transactions (status=VALIDATED, today)"],
        ["Encaissements du mois", "Total cumulé depuis le 1er du mois courant", "finance_transactions (mois en cours)"],
        ["Total des arriérés", "Somme des soldes impayés échus (toutes années confondues)", "fee_arrear + student_account.arrearsAmount"],
        ["Taux de recouvrement", "Ratio encaissements / total facturé sur l'année", "student_account (paid / totalDue)"],
        ["Dépenses du mois", "Total des dépenses validées sur le mois courant", "expense (status=APPROVED, mois)"],
      ],
      [22, 48, 30]
    ),
    spacer(),

    h2("2.2 Évolution mensuelle — graphiques recharts"),
    p(
      "La section centrale du tableau de bord présente un graphique en aires empilées affichant l'évolution mensuelle des encaissements (en vert) et des dépenses (en rouge) sur les douze derniers mois. Le solde net (encaissements moins dépenses) est représenté par une ligne en pointillés bleus. Un sélecteur permet de basculer entre la vue annuelle, la vue trimestrielle et la vue hebdomadaire. Au survol de chaque point, une infobulle affiche le détail par catégorie de frais (scolarité, inscription, cantine, transport, etc.)."
    ),
    p(
      "Cette visualisation est implémentée côté frontend avec la bibliothèque Recharts. Les données sont servies par l'endpoint GET /api/finance/dashboard/monthly-evolution qui agrège les transactions par mois et par catégorie. Le backend met en cache le résultat pendant cinq minutes afin de supporter la charge des tableaux de bord ouverts simultanément par plusieurs directeurs et comptables."
    ),

    h2("2.3 Alertes ORION"),
    p(
      "Sous les graphiques, un bandeau repliable présente les alertes ORION actives sur le module Finance. Chaque alerte est qualifiée par un niveau de sévérité (critique, avertissement, info), un titre court, une description et une recommandation actionnable. Les alertes critiques (par exemple : écart de caisse non justifié, doublon de paiement détecté, élève actif sans compte financier) sont signalées par une pastille rouge dans la barre latérale et déclenchent une notification push au directeur financier."
    ),
    p(
      "Les alertes peuvent être acquittées individuellement par un utilisateur habilité, ce qui génère une entrée dans l'audit log. Le moteur ORION ne réémet pas une alerte acquittée tant que la cause racine n'a pas été résolue, ce qui évite le bruit opérationnel. Un compteur global d'alertes actives est également remonté dans l'en-tête de l'application."
    ),

    h2("2.4 Top 5 des arriérés"),
    p(
      "Le tableau de bord se termine par un classement des cinq élèves présentant le montant d'arriérés le plus élevé, toutes années confondues. Pour chaque élève, le tableau affiche le nom, la classe, le montant total de l'arriéré, l'ancienneté (en jours depuis la première échéance impayée) et un bouton d'action directe vers l'onglet Recouvrement & Arriérés. Ce composant permet au directeur de prioriser immédiatement les actions de relance sur les dossiers les plus sensibles."
    ),
    p(
      "Les données du top 5 sont calculées par une requête SQL indexée sur les colonnes arrears_amount et academic_year_id, avec un tri descendant et une limite à cinq résultats. Pour les établissements volumineux, un job planifié pré-calcule ce classement toutes les heures et le stocke en table, afin d'éviter toute dégradation de performance sur le tableau de bord."
    ),
    buildTable(
      ["Rang", "Élève", "Classe", "Arriéré (FCFA)", "Ancienneté", "Action"],
      [
        ["1", "Koffi A.", "6ème A", "425 000", "142 jours", "Relancer"],
        ["2", "Adanléko M.", "Terminale D", "380 000", "98 jours", "Relancer"],
        ["3", "Hounkpatin L.", "5ème B", "312 500", "76 jours", "Relancer"],
        ["4", "Dossou Y.", "4ème A", "268 000", "65 jours", "Relancer"],
        ["5", "Sossou R.", "3ème C", "215 000", "54 jours", "Relancer"],
      ],
      [8, 22, 15, 20, 15, 20]
    ),
    spacer(),
    pageBreak(),
  ];
}

/** Chapitre 3 — Configuration des frais (section 5). */
function chap3FeeConfig(): (Paragraph | Table)[] {
  return [
    h1("3. Configuration des frais"),
    p(
      "L'onglet Configuration des frais est le point d'entrée obligatoire de toute mise en production du module Finance. Il permet de définir le catalogue des frais applicables dans l'établissement : frais d'inscription, frais de scolarité, frais de cantine, de transport, d'examen, de tenue, etc. Chaque frais est paramétrable individuellement et peut être décliné par classe, par niveau ou à l'échelle globale de l'établissement, selon une priorité de résolution strictement définie."
    ),
    p(
      "Cet onglet est utilisé en début d'année scolaire pour initialiser le catalogue des frais, puis de façon plus ponctuelle en cours d'année pour ajuster un tarif, ajouter un frais exceptionnel (sortie pédagogique, voyage de fin d'année) ou dupliquer la configuration d'une année sur l'autre. Toute modification d'un frais déjà facturé est encadrée : le système recalcule automatiquement les comptes élèves impactés et génère une entrée d'audit."
    ),

    h2("3.1 CRUD des frais"),
    p(
      "Le CRUD des frais expose les opérations classiques de création, lecture, modification et suppression. Un frais est défini par les attributs suivants : libellé, code court, catégorie (scolarité, inscription, service, examen, autre), montant en FCFA, régime par défaut, échéance (date fixe, J+X après inscription, ou échelonné), fréquence (ponctuel, mensuel, trimestriel, annuel), et statut actif/inactif. La suppression est logique (soft delete) sauf si le frais n'a jamais été facturé."
    ),
    p(
      "Le formulaire de création est divisé en trois blocs : informations générales (libellé, code, catégorie), paramètres financiers (montant, devise, régime, échéance) et ciblage (classe, niveau, ou global). Une validation côté frontend vérifie la cohérence (montant positif, code unique, échéance valide) avant soumission. Côté backend, le service fee-structure.service.ts applique les règles de priorité et déclenche le recalcul des comptes élèves concernés."
    ),
    buildTable(
      ["Attribut", "Type", "Obligatoire", "Description"],
      [
        ["libellé", "string", "Oui", "Nom affiché du frais (ex. « Scolarité mensuelle »)"],
        ["code", "string", "Oui", "Code court unique par tenant (ex. SCO-MENS)"],
        ["catégorie", "enum", "Oui", "SCOLARITÉ, INSCRIPTION, SERVICE, EXAMEN, AUTRE"],
        ["montant", "decimal", "Oui", "Montant en FCFA, strictement positif"],
        ["régime par défaut", "enum", "Oui", "STANDARD, ENFANT_ENSEIGNANT, REDUCTION, BOURSE"],
        ["échéance", "enum + date", "Oui", "FIXED_DATE, DAYS_AFTER_ENROLLMENT, INSTALLMENTS"],
        ["fréquence", "enum", "Oui", "ONE_TIME, MONTHLY, QUARTERLY, YEARLY"],
        ["cible", "enum", "Oui", "GLOBAL, LEVEL, CLASS"],
      ],
      [22, 15, 15, 48]
    ),
    spacer(),

    h2("3.2 Tranches (installments)"),
    p(
      "Les frais dont l'échéance est de type INSTALLMENTS sont payables en plusieurs tranches. Chaque tranche est définie par un numéro d'ordre, un libellé (ex. « Tranche 1 — Rentrée »), un montant (ou un pourcentage du total), une date d'échéance et un statut. Le système supporte jusqu'à douze tranches par frais, avec une validation garantissant que la somme des montants correspond exactement au montant total du frais."
    ),
    p(
      "Lorsqu'un paiement est reçu sur un frais échelonné, l'allocation se fait automatiquement tranche par tranche selon l'ordre chronologique : la première tranche échue non soldée est payée en priorité, puis la suivante, et ainsi de suite. Si un élève paie un montant supérieur à la tranche courante, le solde est automatiquement reporté sur la tranche suivante. Cette logique est implémentée dans le service receipt-finance.service.ts et est matérialisée par la table finance_transaction_allocations."
    ),
    buildTable(
      ["Tranche", "Libellé", "Échéance", "Montant (FCFA)", "Statut"],
      [
        ["1", "Tranche 1 — Rentrée", "15 septembre", "150 000", "Payée"],
        ["2", "Tranche 2 — Toussaint", "15 décembre", "120 000", "Partielle"],
        ["3", "Tranche 3 — Pâques", "15 mars", "120 000", "En attente"],
        ["4", "Tranche 4 — Clôture", "15 juin", "90 000", "En attente"],
      ],
      [10, 35, 20, 20, 15]
    ),
    spacer(),

    h2("3.3 Régimes de frais"),
    p(
      "Quatre régimes sont nativement supportés par le module Finance. Un régime est une politique tarifaire applicable à un profil d'élève. Chaque frais peut définir un montant spécifique par régime, ce qui permet de gérer finement les réductions sans multiplier les entrées du catalogue. Le régime est attribué à chaque élève lors de son inscription et peut être modifié individuellement via l'onglet Personnalisations."
    ),
    bulletKV("STANDARD", "tarif nominal sans réduction, applicable par défaut à tous les élèves"),
    bulletKV("ENFANT_ENSEIGNANT", "réduction accordée aux enfants du personnel enseignant et administratif de l'établissement (montant et pourcentage paramétrables)"),
    bulletKV("REDUCTION", "réduction générique attribuée sur décision de la direction (ex. fratrie, excellence sociale) — un libellé et un motif sont obligatoires"),
    bulletKV("BOURSE", "tarif boursé attribué sur critères académiques ou sociaux, le montant peut être nul ou partiel"),
    p(
      "Le choix du régime est tracé dans l'audit log et toute modification déclenche un recalcul du compte élève. Les régimes ENFANT_ENSEIGNANT et BOURSE peuvent faire l'objet d'un justificatif (fichier uploadé), conservé dans le dossier numérique de l'élève. Une vue dédiée dans l'onglet Personnalisations permet de lister tous les élèves bénéficiant d'un régime donné."
    ),

    h2("3.4 Priorité Classe > Niveau > Global"),
    p(
      "La résolution du montant applicable à un élève donné suit une priorité stricte à trois niveaux : Classe, puis Niveau, puis Global. Lorsqu'un frais est défini à plusieurs niveaux, le système sélectionne la définition la plus spécifique. Par exemple, si la scolarité mensuelle est définie à 30 000 FCFA au niveau global, à 25 000 FCFA pour le niveau Secondaire, et à 22 000 FCFA pour la classe « Terminale D », un élève de Terminale D se verra appliquer 22 000 FCFA."
    ),
    p(
      "Cette priorité est implémentée dans la méthode findAll() du service fee-structure.service.ts, qui utilise une clause OR sur levelId et class.schoolLevelId. La logique garantit qu'aucune ambigüité ne peut survenir : si plusieurs définitions existent au même niveau de priorité, la plus récemment créée prévaut, et un avertissement est remonté dans le tableau de bord pour inviter l'administrateur à désactiver les doublons."
    ),
    buildTable(
      ["Niveau de priorité", "Périmètre", "Cas d'usage typique"],
      [
        ["1 — Classe", "Une classe précise (ex. Terminale D)", "Frais d'examen spécifique au BAC"],
        ["2 — Niveau", "Un niveau scolaire (ex. Secondaire)", "Scolarité différenciée primaire/secondaire"],
        ["3 — Global", "Tout l'établissement", "Frais d'inscription commun"],
      ],
      [25, 40, 35]
    ),
    spacer(),

    h2("3.5 Copie d'année (year copy)"),
    p(
      "Pour accélérer la mise en production d'une nouvelle année scolaire, l'onglet propose une fonction de copie d'année. Cette fonction duplique l'intégralité du catalogue des frais de l'année N vers l'année N+1, en incrémentant les dates d'échéance d'une année, en désactivant les frais obsolètes et en préservant les régimes. Un écran de confirmation permet à l'utilisateur de visualiser le diff avant de valider la copie, et une option permet d'ajuster uniformément les montants (par exemple +5 % d'inflation)."
    ),
    p(
      "La copie d'année est une opération idempotente : si elle est relancée sur une année cible déjà alimentée, le système détecte les conflits et propose soit de remplacer, soit de fusionner (en préservant les personnalisations par élève), soit d'annuler. Toutes ces opérations sont tracées dans l'audit log avec l'identité de l'utilisateur et l'horodatage. Une notification de fin d'opération est envoyée au directeur et au comptable de l'établissement."
    ),
    pageBreak(),
  ];
}

/** Chapitre 4 — Personnalisations (section 6). */
function chap4Personnalisations(): (Paragraph | Table)[] {
  return [
    h1("4. Personnalisations"),
    p(
      "L'onglet Personnalisations permet de déroger au catalogue des frais pour un élève précis. Cette fonctionnalité est essentielle dans la vie réelle d'un établissement : admission tardive, remise exceptionnelle de la direction, frais de scolarité partiellement couverts par un tiers, exclusion d'un service (cantine, transport), ou attribution d'un régime spécifique non prévu au catalogue. L'onglet centralise toutes ces dérogations et garantit qu'elles soient prises en compte dans le calcul du compte de l'élève."
    ),
    p(
      "Chaque personnalisation est tracée individuellement et fait l'objet d'un recalcul automatique du compte de l'élève concerné. Les personnalisations peuvent être de trois types : ajout d'un frais supplémentaire (override montant), suppression d'un frais existant (override statut), ou modification de l'échéancier (override tranches). Un onglet de filtrage permet de lister rapidement toutes les personnalisations actives, par classe, par régime ou par motif."
    ),

    h2("4.1 Override par élève"),
    p(
      "L'override par élève est l'opération la plus courante. Depuis la fiche d'un élève ou depuis l'onglet Personnalisations, l'utilisateur peut créer une dérogation sur n'importe quel frais du catalogue. Le formulaire d'override permet de saisir un nouveau montant, un nouveau régime, un nouveau nombre de tranches, ou un statut « désactivé ». Un champ motif obligatoire trace la raison de la dérogation, et un champ date d'effet permet de planifier l'application à une date future."
    ),
    p(
      "Les overrides sont stockés dans la table fee_override avec une référence à l'élève, au frais d'origine et à l'utilisateur ayant effectué la modification. À chaque calcul du compte élève, le moteur de résolution priorise l'override sur la définition du catalogue. Si un override est supprimé, le système recalcule automatiquement le compte avec la définition standard et génère un événement d'audit. Aucune donnée financière historique (paiements déjà enregistrés) n'est affectée par un override rétroactif : seul le solde à venir est ajusté."
    ),
    buildTable(
      ["Type d'override", "Champ impacté", "Effet sur le compte"],
      [
        ["Montant personnalisé", "montant", "Nouveau montant facturé à l'élève"],
        ["Régime personnalisé", "régime", "Application d'une réduction différente"],
        ["Désactivation", "statut = inactif", "Frais non facturé à l'élève"],
        ["Tranches personnalisées", "installments", "Nouvel échéancier (nb + dates)"],
        ["Échéance personnalisée", "dueDate", "Report de la date d'exigibilité"],
      ],
      [30, 25, 45]
    ),
    spacer(),

    h2("4.2 Recalcul automatique du compte"),
    p(
      "Toute personnalisation déclenche un recalcul automatique du compte de l'élève. Le service student-account.service.ts regénère le total à payer, le total déjà payé, le solde restant dû et le statut du compte (à jour, en retard, en retard critique, bloqué). Le recalcul est transactionnel : si une erreur survient, l'ensemble est annulé et l'utilisateur est notifié. Pour les établissements volumineux, le recalcul est exécuté de façon asynchrone via une file de tâches afin de ne pas bloquer l'interface."
    ),
    p(
      "Le recalcul prend en compte les paiements déjà enregistrés et les affecte en priorité aux tranches échues selon le principe FIFO. Si le recalcul fait apparaître un nouveau solde débiteur (l'élève doit de l'argent), un enregistrement est créé dans la table fee_arrear et remonte dans l'onglet Recouvrement & Arriérés. Inversement, si le recalcul fait apparaître un trop-perçu (l'élève a payé plus que le nouveau montant), un avoir est généré et proposé au remboursement ou au report sur l'année suivante."
    ),

    h2("4.3 Filtres et statistiques"),
    p(
      "L'onglet Personnalisations propose une barre de filtres complète : par classe, par niveau, par régime, par type d'override, par utilisateur ayant effectué la modification, et par plage de dates. Les filtres sont combinables et leur résultat peut être exporté en Excel et PDF. Une vue synthétique en haut de page affiche le nombre total d'overrides actifs, le nombre d'élèves concernés, et la somme financière des réductions accordées (impact sur la facturation théorique)."
    ),
    p(
      "Les statistiques de personnalisations sont également remontées dans le tableau de bord ORION sous forme d'une carte « Impact des personnalisations ». Cette carte compare la facturation théorique (catalogue standard) à la facturation réellement appliquée (avec overrides) et calcule le taux de dérogation. Un taux anormalement élevé peut signaler une dérive de la politique tarifaire et déclenche une alerte ORION de niveau avertissement."
    ),
    buildTable(
      ["Filtre", "Type", "Valeur par défaut"],
      [
        ["Classe", "Sélection multiple", "Toutes"],
        ["Niveau", "Sélection unique", "Tous"],
        ["Régime", "Sélection multiple", "Tous"],
        ["Type d'override", "Sélection multiple", "Tous"],
        ["Utilisateur", "Sélection unique", "Tous"],
        ["Plage de dates", "Date range", "Année courante"],
      ],
      [35, 35, 30]
    ),
    spacer(),
    pageBreak(),
  ];
}

/** Chapitre 5 — Comptes élèves (section 7). */
function chap5StudentAccounts(): (Paragraph | Table)[] {
  return [
    h1("5. Comptes élèves"),
    p(
      "L'onglet Comptes élèves est le centre névralgique du suivi financier individualisé. Il présente, pour chaque élève de l'établissement, un compte financier agrégeant l'ensemble des frais dus, des paiements reçus et des arriérés reportés sur l'année courante. L'interface est conçue en split-pane : la liste des élèves occupe le panneau gauche, et la fiche détaillée du compte sélectionné s'affiche dans le panneau droit. Cette disposition permet au comptable de naviguer rapidement d'un compte à l'autre sans perdre le contexte."
    ),
    p(
      "Le compte élève est la source de vérité pour toutes les opérations financières individualisées : génération de reçus, envoi de relevés, déclenchement de relances, déblocage administratif. Toute mutation (nouveau paiement, ajustement, override) est immédiatement reflétée dans le compte et propagée aux onglets dépendants (Recouvrement, Tableau de bord, Rapports)."
    ),

    h2("5.1 Split-pane liste / fiche"),
    p(
      "Le panneau gauche liste tous les élèves de l'établissement avec, pour chacun, le nom, la classe, le statut financier (à jour, en retard, bloqué) et le solde restant dû. La liste est paginée par cinquante, triable par colonne et filtrable par texte libre. Au clic sur un élève, le panneau droit affiche la fiche complète du compte : informations générales (matricule, classe, régime), tableau des frais applicables avec tranches et soldes, historique des paiements, et section arriérés reportés."
    ),
    p(
      "Le panneau droit propose également des actions contextuelles : encaisser un paiement, générer un reçu, envoyer un relevé, déblocage administratif, et créer une personnalisation. Ces actions sont accessibles via un menu déroulant en haut de la fiche. La largeur des deux panneaux est ajustable par un séparateur central, et la préférence de l'utilisateur est conservée en localStorage."
    ),

    h2("5.2 Filtres par statut"),
    p(
      "Le panneau gauche propose des filtres rapides par statut financier. Cinq statuts sont définis : À jour (solde nul et aucune échéance impayée), En cours (solde positif mais aucune échéance échue), En retard (au moins une échéance échue impayée), En retard critique (retard supérieur à 30 jours), et Bloqué (verrouillage administratif actif). Les filtres sont mutuellement exclusifs et un compteur affiche le nombre d'élèves dans chaque catégorie."
    ),
    buildTable(
      ["Statut", "Critère", "Couleur", "Action recommandée"],
      [
        ["À jour", "Solde = 0 et aucune échéance échue", "Vert", "Aucune"],
        ["En cours", "Solde > 0 et aucune échéance échue", "Bleu", "Suivi normal"],
        ["En retard", "Au moins une échéance échue impayée", "Orange", "Relance J+3"],
        ["En retard critique", "Retard > 30 jours", "Rouge", "Relance J+7 + blocage"],
        ["Bloqué", "Verrouillage administratif actif", "Gris foncé", "Déblocage manuel"],
      ],
      [22, 38, 15, 25]
    ),
    spacer(),

    h2("5.3 Déblocage administratif"),
    p(
      "Le blocage administratif est une mesure conservatoire appliquée automatiquement par le moteur de recouvrement lorsqu'un élève dépasse un seuil de retard paramétrable (par défaut 30 jours). Le blocage suspend l'accès à certains services (cantine, transport, sorties pédagogiques) et empêche l'impression de certains documents (bulletin de notes, certificat de scolarité). Il est matérialisé par le champ isBlocked sur le StudentAccount et par une entrée dans la table administrative_block."
    ),
    p(
      "Le déblocage est une opération manuelle réservée au directeur et au comptable en chef. Depuis la fiche du compte élève, l'action « Débloquer » ouvre un modal demandant obligatoirement un motif et, le cas échéant, un plan de paiement convenu avec la famille. Le déblocage est tracé dans l'audit log avec l'identité de l'utilisateur, le motif et l'horodatage. Si l'élève récidive, le système mémorise l'historique des déblocages et peut exiger une validation hiérarchique supplémentaire."
    ),

    h2("5.4 Exports Excel et PDF"),
    p(
      "La liste des comptes élèves peut être exportée en deux formats. L'export Excel génère un classeur multi-feuilles : une feuille récapitulative (nom, classe, statut, solde), une feuille détaillée par frais, et une feuille historique des paiements. L'export PDF génère un relevé de compte individuel par élève, avec en-tête de l'établissement, logo, tableau des frais et des paiements, et signature du comptable. Les deux exports peuvent être limités aux élèves filtrés ou étendus à l'ensemble de l'établissement."
    ),
    p(
      "Pour les établissements volumineux (plus de mille élèves), l'export est exécuté de façon asynchrone : l'utilisateur est notifié par email à la fin de la génération et peut télécharger le fichier depuis un lien sécurisé valide pendant 48 heures. Les fichiers générés sont stockés chiffrés sur le système de fichiers et supprimés automatiquement après expiration."
    ),

    h2("5.5 Reçu multi-canal (Email / WhatsApp / SMS)"),
    p(
      "Depuis la fiche d'un compte élève, le comptable peut générer et envoyer un reçu de paiement par trois canaux : email, WhatsApp et SMS. Le reçu PDF est généré à la volée par le service receipt-finance.service.ts qui utilise PDFKit et un template HTML vers PDF. Le template inclut l'en-tête de l'établissement, le numéro de reçu unique, la date, le nom de l'élève, le détail des frais acquittés, le montant total, le mode de paiement et un QR code de vérification."
    ),
    p(
      "L'envoi multi-canal est orchestré par le service receipt-notification-finance.service.ts. Le canal email utilise SMTP avec une template Handlebars ; le canal WhatsApp utilise l'API Gupshup avec un template pré-approuvé ; le canal SMS utilise une passerelle locale avec un message compact (160 caractères). Si le canal principal échoue, le système tente automatiquement le canal secondaire selon une politique paramétrable. Chaque envoi est tracé dans la table notification_log avec son statut (envoyé, échec, en attente)."
    ),
    buildTable(
      ["Canal", "Format", "Limite", "Délai moyen"],
      [
        ["Email", "PDF attaché + corps HTML", "Aucune", "2 secondes"],
        ["WhatsApp", "Template texte + lien PDF", "Template pré-approuvé", "5 secondes"],
        ["SMS", "Texte 160 caractères", "1 SMS par envoi", "8 secondes"],
      ],
      [20, 35, 25, 20]
    ),
    spacer(),
    pageBreak(),
  ];
}

/** Chapitre 6 — Multi-caisses (section 8). */
function chap6CashRegisters(): (Paragraph | Table)[] {
  return [
    h1("6. Multi-caisses"),
    p(
      "L'onglet Multi-caisses permet de gérer plusieurs caisses au sein d'un même établissement. Cette fonctionnalité répond à un besoin opérationnel fort : séparer la caisse principale de la scolarité, la caisse de la cantine, la caisse des pensions internat, la caisse des sorties pédagogiques, etc. Chaque caisse dispose de son propre solde, de son responsable, de son journal de transactions et de son cycle de clôture indépendant. Le module supporte jusqu'à dix caisses simultanées par établissement."
    ),
    p(
      "L'onglet est structuré en trois sous-onglets : Dashboard pour la vision synthétique, Constellation pour la visualisation graphique des caisses et de leurs transferts, et Historique pour le journal détaillé des mouvements inter-caisses. Chaque caisse peut être activée, désactivée, fusionnée ou archivée en fin d'année scolaire. Le rapprochement avec les encaissements et les dépenses est automatique."
    ),

    h2("6.1 Sous-onglet Dashboard"),
    p(
      "Le Dashboard présente une grille de cartes, une par caisse. Chaque carte affiche le nom de la caisse, le nom du responsable, le solde courant, le montant des encaissements du jour, le montant des dépenses du jour, et un indicateur de statut (ouverte, clôturée, en anomalie). Un clic sur une carte ouvre le détail complet de la caisse : journal des transactions, transferts entrants et sortants, et historique des clôtures."
    ),
    p(
      "Le Dashboard calcule également des agrégats globaux : solde total toutes caisses confondues, total des encaissements du jour, total des dépenses du jour, et nombre de caisses en anomalie. Ces agrégats sont remontés dans le Tableau de Bord principal du module Finance. Une alerte ORION est déclenchée si une caisse présente un écart non justifié supérieur à 1 000 FCFA ou si une caisse n'a pas été clôturée depuis plus de 24 heures."
    ),
    buildTable(
      ["Caisse", "Responsable", "Solde (FCFA)", "Encaissements jour", "Dépenses jour", "Statut"],
      [
        ["Caisse principale", "M. Adjakpa", "1 245 000", "185 000", "42 000", "Ouverte"],
        ["Caisse cantine", "Mme Sossou", "312 500", "78 000", "15 500", "Ouverte"],
        ["Caisse internat", "M. Kpodé", "528 750", "0", "0", "Clôturée"],
        ["Caisse sorties", "Mme Agbo", "85 000", "12 000", "0", "Ouverte"],
        ["Caisse transport", "M. Dossou", "162 000", "32 500", "8 000", "Ouverte"],
      ],
      [20, 18, 17, 15, 15, 15]
    ),
    spacer(),

    h2("6.2 Sous-onglet Constellation"),
    p(
      "Le sous-onglet Constellation offre une visualisation graphique originale des caisses et de leurs flux financiers. Les caisses sont représentées sous forme de nœuds circulaires positionnés en cercle autour d'un nœud central (l'établissement). La taille de chaque nœud est proportionnelle au solde de la caisse. Les transferts inter-caisses de la période sélectionnée sont représentés par des arcs courbés dont l'épaisseur est proportionnelle au montant transféré et la couleur indique le sens (vert pour entrant, rouge pour sortant)."
    ),
    p(
      "Cette visualisation permet d'identifier en un coup d'œil les caisses les plus actives, les flux anormaux (transferts fréquents entre deux caisses spécifiques), et les caisses dormant (solde élevé sans flux). Au survol d'un arc, une infobulle affiche le détail du transfert (date, montant, motif, utilisateur). Un sélecteur de période permet de filtrer les flux affichés (jour, semaine, mois, année)."
    ),

    h2("6.3 Sous-onglet Historique"),
    p(
      "Le sous-onglet Historique présente le journal chronologique de tous les mouvements inter-caisses. Chaque ligne du journal comporte : la date et l'heure, la caisse source, la caisse destination, le montant, le motif (approvisionnement, régularisation, transfert de fonds, clôture), l'utilisateur ayant effectué l'opération, et le statut (validé, en attente, annulé). Le journal est filtrable par caisse, par période et par type de mouvement."
    ),
    p(
      "Chaque transfert inter-caisses est enregistré dans la table cash_register_transfer et déclenche deux écritures comptables symétriques : un débit sur la caisse source et un crédit sur la caisse destination. Le solde total de l'établissement reste invariant. Les transferts sont soumis au contrôle ORION qui détecte les patterns suspects : transferts en boucle, montants inhabituels, transferts en dehors des heures ouvrables."
    ),
    buildTable(
      ["Date", "Source", "Destination", "Montant (FCFA)", "Motif", "Utilisateur"],
      [
        ["2026-03-12 09:15", "Caisse principale", "Caisse cantine", "200 000", "Approvisionnement", "M. Adjakpa"],
        ["2026-03-12 14:30", "Caisse internat", "Caisse principale", "150 000", "Transfert de fonds", "M. Kpodé"],
        ["2026-03-13 08:00", "Caisse principale", "Caisse sorties", "50 000", "Approvisionnement", "M. Adjakpa"],
      ],
      [18, 18, 18, 16, 16, 14]
    ),
    spacer(),

    h2("6.4 CRUD des caisses et statistiques"),
    p(
      "Le CRUD des caisses permet de créer, modifier, désactiver et archiver une caisse. La création d'une caisse nécessite un libellé unique, un code court, un responsable (utilisateur du module Finance), un solde initial optionnel, et une devise (FCFA par défaut). La modification du responsable est tracée dans l'audit log. La désactivation d'une caisse n'est possible que si son solde est nul et qu'aucune transaction n'est en attente. L'archivage en fin d'année scolaire génère un PDF de clôture et réinitialise le solde."
    ),
    p(
      "Les statistiques de caisse sont accessibles depuis le Dashboard et incluent : nombre total de transactions par caisse, montant moyen d'encaissement, montant moyen de dépense, taux d'anomalies, et temps moyen entre deux clôtures. Ces statistiques alimentent également les Rapports financiers (Journal de caisse) et le Contrôle & Audit (Écarts caisse). Les exports Excel et PDF sont disponibles pour chaque statistique."
    ),

    h2("6.5 Transferts inter-caisses"),
    p(
      "Le transfert inter-caisses est une opération critique qui déplace des fonds d'une caisse à l'autre sans impact sur le solde global de l'établissement. Depuis n'importe quelle caisse, l'action « Transfert » ouvre un modal demandant la caisse destination, le montant, et un motif obligatoire. Le montant ne peut pas excéder le solde courant de la caisse source. Une validation double (saisie + confirmation) protège contre les erreurs de manipulation."
    ),
    p(
      "Les transferts supérieurs à un seuil paramétrable (par défaut 500 000 FCFA) requièrent une validation hiérarchique du directeur. Une demande de transfert est alors créée avec le statut EN_ATTENTE_VALIDATION, et le directeur reçoit une notification. À l'approbation, le transfert est exécuté atomiquement et tracé dans l'audit log. En cas de refus, la demande est archivée avec le motif du refus."
    ),
    pageBreak(),
  ];
}

/** Chapitre 7 — Encaissements (section 9). */
function chap7Payments(): (Paragraph | Table)[] {
  return [
    h1("7. Encaissements"),
    p(
      "L'onglet Encaissements est l'interface principale de saisie des paiements reçus par l'établissement. Il centralise tous les modes d'encaissement : espèces (CASH), paiement en ligne via Fedapay (carte bancaire), et Mobile Money (MTN MoMo, Moov Money). Chaque encaissement est enregistré de façon atomique, déclenche un reçu PDF, met à jour le compte de l'élève, et peut déclencher une notification multi-canal au parent. L'onglet supporte également l'allocation multi-frais : un paiement unique peut être réparti sur plusieurs frais distincts."
    ),
    p(
      "L'intégrité des encaissements est garantie par plusieurs mécanismes : chaque transaction porte un hash SHA-256 calculé sur l'ensemble de ses champs, les triggers PostgreSQL empêchent toute modification a posteriori d'une transaction validée, et ORION détecte en temps réel les doublons et les patterns suspects. Le rapprochement avec la caisse de réception est automatique et toute anomalie déclenche une alerte."
    ),

    h2("7.1 Nouveau paiement — modal multi-mode"),
    p(
      "Le bouton « Nouveau paiement » ouvre un modal en trois étapes. La première étape sélectionne l'élève (recherche par matricule, nom ou classe) et affiche instantanément son solde et les frais dus. La deuxième étape saisit le mode de paiement : CASH (avec caisse de réception obligatoire), Fedapay (avec référence de transaction et statut de paiement en ligne), ou Mobile Money (avec opérateur, numéro et référence). La troisième étape alloue le montant saisi sur les frais dus, avec une allocation automatique proposée par défaut."
    ),
    p(
      "Le modal effectue des validations en temps réel : montant positif, montant inférieur ou égal au solde total (sauf dépassement explicite générant un avoir), caisse ouverte et non clôturée, élève non bloqué (ou déblocage préalable exigé). Une zone de prévisualisation affiche en bas du modal le reçu tel qu'il sera généré, avec son numéro unique et le QR code de vérification."
    ),
    buildTable(
      ["Mode", "Champs requis", "Validation", "Délai de confirmation"],
      [
        ["CASH", "Caisse, montant, reçu par", "Caisse ouverte + solde OK", "Immédiat"],
        ["Fedapay", "Référence transaction, statut", "Vérif. API Fedapay", "1 à 5 minutes"],
        ["Mobile Money", "Opérateur, numéro, référence", "Vérif. webhook opérateur", "30 secondes à 2 minutes"],
      ],
      [20, 30, 30, 20]
    ),
    spacer(),

    h2("7.2 Allocation multi-frais"),
    p(
      "L'allocation multi-frais est l'une des fonctionnalités les plus puissantes du module. Lorsqu'un parent paie un montant global (par exemple 250 000 FCFA pour couvrir la scolarité, la cantine et le transport), le système répartit automatiquement le montant sur les frais dus selon une logique prioritaire : d'abord les arriérés échus (FIFO), puis les tranches échues de l'année courante, puis les tranches à venir. L'utilisateur peut ajuster manuellement la répartition si nécessaire."
    ),
    p(
      "Chaque ligne d'allocation est stockée dans la table finance_transaction_allocations avec référence à la transaction, au frais, à la tranche et au montant alloué. La somme des allocations est obligatoirement égale au montant total de la transaction (contrainte SQL). En cas d'ajustement manuel, le système vérifie en temps réel la cohérence et empêche la validation si la somme ne correspond pas. Une allocation peut être modifiée tant que la transaction n'est pas clôturée dans la caisse."
    ),
    buildTable(
      ["Frais", "Tranche", "Solde dû (FCFA)", "Alloué (FCFA)", "Reste (FCFA)"],
      [
        ["Scolarité", "Tranche 2", "120 000", "120 000", "0"],
        ["Cantine", "Mars 2026", "45 000", "45 000", "0"],
        ["Transport", "Trimestre 2", "60 000", "60 000", "0"],
        ["Scolarité", "Tranche 3", "120 000", "25 000", "95 000"],
        ["Total", "—", "345 000", "250 000", "95 000"],
      ],
      [25, 20, 20, 20, 15]
    ),
    spacer(),

    h2("7.3 Reçu PDF"),
    p(
      "À chaque encaissement validé, un reçu PDF est généré automatiquement par le service receipt-finance.service.ts. Le reçu comporte : l'en-tête de l'établissement (logo, nom, adresse, contact), le numéro unique de reçu (format REC-{année}-{tenant}-{séquence}), la date et l'heure, les informations de l'élève (matricule, nom, classe), le détail des frais acquittés avec allocations, le montant total en chiffres et en lettres, le mode de paiement, la caisse de réception, le nom du comptable, et un QR code de vérification."
    ),
    p(
      "Le reçu est stocké dans le système de fichiers et indexé dans la table receipt. Il peut être régénéré à tout moment depuis la fiche du compte élève, mais toute régénération est tracée dans l'audit log. Le QR code du reçu encode l'identifiant unique de la transaction et un token de vérification ; son scan via l'application mobile Academia Helm permet de vérifier l'authenticité du reçu en temps réel. Le format PDF respecte la norme A4 avec marges de 15 mm."
    ),

    h2("7.4 Envoi multi-canal"),
    p(
      "Le reçu PDF généré peut être envoyé au parent par trois canaux : email, WhatsApp et SMS. L'envoi est déclenché automatiquement après validation du paiement (selon les préférences du parent) ou manuellement depuis la fiche du compte élève. Le service receipt-notification-finance.service.ts orchestre l'envoi : il sélectionne le canal préféré du parent, génère le contenu adapté (PDF attaché pour email, lien de téléchargement pour WhatsApp, résumé court pour SMS), et gère les replis en cas d'échec."
    ),
    p(
      "Chaque envoi est tracé dans la table notification_log avec son canal, son statut (envoyé, échec, en attente), le message d'erreur éventuel et l'horodatage. Un tableau de bord dédié dans l'onglet Paramétrage affiche les statistiques d'envoi par canal et le taux de succès global. En cas d'échec persistant sur les trois canaux, une alerte ORION est générée et un email de notification est envoyé au comptable."
    ),

    h2("7.5 Exports et journal des encaissements"),
    p(
      "L'onglet Encaissements propose un journal chronologique filtrable de toutes les transactions. Les filtres disponibles incluent : date, mode de paiement, caisse, élève, classe, montant, statut. Le journal peut être exporté en Excel (multi-feuilles : récapitulatif + détail par mode) et en PDF (relevé de caisse horodaté). Un export comptable CSV est également disponible pour l'intégration avec les logiciels comptables tiers, avec mapping OHADA des comptes."
    ),
    p(
      "Le journal des encaissements alimente directement le Journal de caisse de l'onglet Rapports financiers et la table de rapprochement de l'onglet Clôture & Trésorerie. Chaque transaction porte un statut comptable (NON_EXPORTÉ, EXPORTÉ, RAPPROCHÉ) qui permet de suivre son cycle de vie complet jusqu'à l'intégration dans le logiciel comptable de l'établissement."
    ),
    pageBreak(),
  ];
}

/** Chapitre 8 — Recouvrement & Arriérés (section 10). */
function chap8Recovery(): (Paragraph | Table)[] {
  return [
    h1("8. Recouvrement & Arriérés"),
    p(
      "L'onglet Recouvrement & Arriérés est l'outil opérationnel des équipes chargées de relancer les familles en retard de paiement. Il s'agit de l'onglet le plus complexe du module Finance, avec sept sous-onglets couvrant l'ensemble du cycle de recouvrement : détection automatique des arriérés, gestion des relances, suivi des actions de recouvrement, enregistrement des promesses de paiement, gestion des dossiers complexes, et paramétrage fin de la politique de relance. L'onglet supporte également l'import en masse d'arriérés depuis un fichier Excel."
    ),
    p(
      "Le module de recouvrement est conçu pour être proactive plutôt que réactif : il détecte automatiquement chaque nuit les nouveaux arriérés, classe les élèves par niveau de risque, et propose un plan de relance calendaire (J+3, J+7, J+15) avec des modèles de message préétablis pour chaque canal. Les relances sont tracées individuellement, ce qui permet de mesurer l'efficacité de chaque action et d'ajuster la politique en conséquence."
    ),

    h2("8.1 Sous-onglet Dashboard"),
    p(
      "Le Dashboard du recouvrement présente une vue synthétique de l'état du portefeuille d'arriérés. Quatre KPIs sont affichés en haut : total des arriérés (en FCFA), nombre d'élèves concernés, taux de recouvrement (encaissements du mois sur arriérés divisés par total arriérés), et montant des promesses de paiement en cours. Un graphique en barres affiche l'évolution mensuelle du total des arriérés, et un graphique en anneau présente la répartition par ancienneté (moins de 30 jours, 30 à 60 jours, 60 à 90 jours, plus de 90 jours)."
    ),
    p(
      "Le Dashboard liste également les relances programmées dans les sept prochains jours, avec leur canal et leur destinataire, et les actions de recouvrement en cours. Les alertes ORION spécifiques au recouvrement (par exemple : élève en retard critique sans aucune relance, promesse de paiement échue non honorée) sont affichées en bas de page. Un bouton « Lancer la détection nocturne » permet de forcer le recalcul immédiat des arriérés en cas de besoin."
    ),

    h2("8.2 Sous-onglet Arriérés"),
    p(
      "Le sous-onglet Arriérés liste tous les arriérés actifs de l'établissement, toutes années confondues. Chaque ligne affiche : l'élève (nom, matricule, classe), l'année d'origine de l'arriéré, le frais concerné, la tranche échue, le montant dû, l'ancienneté en jours, le statut (en attente, en relance, en promesse, bloqué), et les actions disponibles (relancer, créer une promesse, supprimer). Les filtres permettent de cibler les arriérés par ancienneté, par classe, par statut, et par montant minimal."
    ),
    p(
      "La suppression d'un arriéré est une opération sensible réservée au directeur et au comptable en chef. Elle nécessite obligatoirement un motif (remise gracieuse, erreur de saisie, transfert vers un avoir) et est tracée dans l'audit log. Un trigger PostgreSQL empêche la suppression d'un arriéré déjà partiellement payé. L'import Excel permet de créer en masse des arriérés reportés depuis un ancien système ou depuis un relevé externe."
    ),
    buildTable(
      ["Élève", "Année", "Frais", "Montant (FCFA)", "Ancienneté", "Statut"],
      [
        ["Koffi A.", "2024-2025", "Scolarité T3", "150 000", "142 j", "En relance"],
        ["Adanléko M.", "2024-2025", "Scolarité T1", "180 000", "98 j", "Promesse"],
        ["Hounkpatin L.", "2023-2024", "Cantine", "112 500", "276 j", "Bloqué"],
        ["Dossou Y.", "2024-2025", "Transport", "68 000", "65 j", "En attente"],
        ["Sossou R.", "2024-2025", "Scolarité T2", "115 000", "54 j", "En relance"],
      ],
      [22, 13, 20, 17, 13, 15]
    ),
    spacer(),

    h2("8.3 Sous-onglet Relances"),
    p(
      "Le sous-onglet Relances centralise l'historique de toutes les relances envoyées. Chaque relance est caractérisée par : l'élève concerné, l'arriéré visé, la date d'envoi, le canal (email, WhatsApp, SMS), le niveau (avertissement J+3, urgent J+7, final J+15), le template utilisé, le statut (envoyé, échec, acquitté), et le comptable ayant déclenché l'envoi. Les relances peuvent être envoyées manuellement depuis ce sous-onglet ou automatiquement par le moteur de recouvrement."
    ),
    p(
      "Les relances automatiques suivent une cadence paramétrable définie dans le sous-onglet Paramétrage. Par défaut, la première relance est envoyée à J+3 (avertissement, canal email), la deuxième à J+7 (urgente, canal email + WhatsApp), et la troisième à J+15 (finale, canal WhatsApp + SMS + email avec copie au directeur). Chaque relance est tracée et un délai minimal entre deux relances évite le harcèlement. Une relance ne peut pas être envoyée si une promesse de paiement non échue existe pour l'arriéré concerné."
    ),

    h2("8.4 Sous-onglet Actions"),
    p(
      "Le sous-onglet Actions trace toutes les actions de recouvrement effectuées : appel téléphonique, visite à domicile, rencontre parent-directeur, mise en demeure, transmission avocat. Chaque action comporte un type, une date, un comptable, une description libre, un compte-rendu, et un statut (à faire, en cours, faite, annulée). Les actions peuvent être planifiées et génèrent des rappels dans le calendrier du comptable."
    ),
    p(
      "Ce sous-onglet est essentiel pour la traçabilité juridique du recouvrement : en cas de contentieux, l'historique des actions prouve la diligence de l'établissement. Les actions peuvent être attachées à un dossier (sous-onglet Dossiers) pour les cas complexes nécessitant plusieurs interventions. Une action peut également déclencher un blocage administratif de l'élève si elle est qualifiée de « blocage ». Les exports PDF des actions sont disponibles pour les besoins juridiques."
    ),

    h2("8.5 Sous-onglet Promesses"),
    p(
      "Le sous-onglet Promesses enregistre les promesses de paiement faites par les parents. Une promesse comporte : l'élève concerné, le montant promis, la date d'engagement, la date prévue de paiement, le canal de la promesse (oral, écrit, email), le nom du parent, et le statut (en attente, honorée, échue, annulée). Le système vérifie que le montant promis ne dépasse pas le solde dû et envoie automatiquement un rappel au parent à J-1 de la date prévue."
    ),
    p(
      "À la date prévue, le système vérifie si un paiement correspondant a été enregistré. Si oui, la promesse est marquée « honorée ». Si non, elle est marquée « échue » et déclenche une relance de niveau supérieur. Les promesses échues impactent le scoring de risque de l'élève et peuvent conduire à un blocage administratif. Le taux d'honorabilité des promesses est un indicateur clé du Dashboard de recouvrement."
    ),
    buildTable(
      ["Élève", "Montant promis (FCFA)", "Date prévue", "Canal", "Statut"],
      [
        ["Koffi A.", "150 000", "2026-03-25", "Écrit", "En attente"],
        ["Adanléko M.", "90 000", "2026-03-20", "Email", "Honorée"],
        ["Hounkpatin L.", "60 000", "2026-03-15", "Oral", "Échue"],
      ],
      [25, 25, 20, 15, 15]
    ),
    spacer(),

    h2("8.6 Sous-onglet Dossiers"),
    p(
      "Le sous-onglet Dossiers regroupe les cas de recouvrement complexes nécessitant un suivi longitudinal. Un dossier est créé manuellement par le comptable et regroupe un ou plusieurs arriérés d'un même élève, ainsi que toutes les actions, relances et promesses associées. Le dossier porte un statut (ouvert, en médiation, en contentieux, clôturé), un responsable, une priorité (basse, normale, haute, critique) et une description libre."
    ),
    p(
      "Le dossier offre une vue 360° du cas : chronologie complète des événements, montant total en jeu, dernières actions, prochaine échéance. Il peut être partagé avec la direction pour validation d'une procédure contentieuse, ou transmis à un avocat en cas de procédure judiciaire. Les dossiers clôturés sont archivés et conservent leur historique pour les besoins de traçabilité. Un export PDF complet du dossier est disponible pour les audiences."
    ),

    h2("8.7 Sous-onglet Paramétrage"),
    p(
      "Le sous-onglet Paramétrage permet de configurer finement la politique de recouvrement de l'établissement. Les paramètres disponibles incluent : les seuils d'ancienneté pour chaque niveau de relance (J+3, J+7, J+15 par défaut), le canal préféré par niveau, les templates de message par canal et par niveau, le seuil de blocage administratif (30 jours par défaut), le délai de grâce après une promesse, et les horaires d'envoi autorisés (pour éviter les relances nocturnes)."
    ),
    p(
      "Toute modification du paramétrage est tracée dans l'historique avec l'identité de l'utilisateur et l'horodatage. Les templates de message utilisent des variables (nom de l'élève, montant dû, date d'échéance, nom de l'établissement) qui sont substituées à l'envoi. Un aperçu permet de visualiser le message rendu avant activation. Le paramétrage peut être exporté et importé en JSON pour faciliter la duplication entre établissements d'un même groupe."
    ),
    pageBreak(),
  ];
}

/** Chapitre 9 — Dépenses & Budget (section 11). */
function chap9Expenses(): (Paragraph | Table)[] {
  return [
    h1("9. Dépenses & Budget"),
    p(
      "L'onglet Dépenses & Budget gère l'ensemble des sorties de fonds de l'établissement : achats, fournitures, salaires du personnel non enseignant, factures d'énergie, entretien des locaux, sorties pédagogiques, etc. Il combine la saisie opérationnelle des dépenses avec un module budgétaire permettant de planifier, suivre et piloter les dépenses par catégorie et par période. L'onglet est structuré en quatre sous-onglets : Dashboard, Dépenses, Budget et Catégories."
    ),
    p(
      "Chaque dépense suit un workflow d'approbation à un ou plusieurs niveaux selon son montant : validation simple par le comptable en dessous d'un premier seuil, double validation comptable + directeur entre le premier et le second seuil, et validation du promoteur au-delà du second seuil. Les justificatifs (factures, reçus) sont uploadés et stockés dans le dossier numérique de la dépense. Le mapping OHADA permet l'export comptable direct."
    ),

    h2("9.1 Sous-onglet Dashboard"),
    p(
      "Le Dashboard des dépenses affiche en haut de page quatre KPIs : total des dépenses du mois, total des dépenses de l'année, taux d'exécution budgétaire (dépenses réalisées sur budget voté), et nombre de dépenses en attente d'approbation. Un graphique en barres compare, par catégorie, le budget voté aux dépenses réalisées sur l'année. Les catégories en dépassement sont surlignées en rouge, celles proches de la limite (plus de 85 %) en orange, et celles dans les clous en vert."
    ),
    p(
      "Une liste des dernières dépenses saisies (dix plus récentes) occupe le milieu du tableau de bord, et un panneau d'alertes budget affiche les catégories ayant dépassé le seuil de 85 % d'exécution. Un bouton « Nouvelle dépense » donne accès au formulaire de saisie. Les alertes ORION spécifiques aux dépenses (dépense sans justificatif, dépense en dépassement, doublon de facture) sont remontées en bas de page."
    ),

    h2("9.2 Sous-onglet Dépenses"),
    p(
      "Le sous-onglet Dépenses liste toutes les dépenses de l'établissement, filtrables par date, catégorie, statut, montant, fournisseur et demandeur. Chaque ligne affiche : la date, le libellé, la catégorie, le montant, le fournisseur, le demandeur, le statut (brouillon, en attente, approuvée, rejetée, payée), et les actions. Les dépenses en attente d'approbation sont signalées par une pastille orange et peuvent être approuvées ou rejetées directement depuis la liste par un utilisateur habilité."
    ),
    p(
      "Le formulaire de création d'une dépense comporte les champs suivants : libellé, catégorie (lien vers le sous-onglet Catégories), montant, devise, date, fournisseur, mode de paiement (espèces, virement, chèque, mobile money), caisse de décaissement, justificatif (upload fichier), commentaire, et plan comptable OHADA (auto-suggéré selon la catégorie). Le formulaire effectue une vérification en temps réel du budget restant sur la catégorie et avertit l'utilisateur en cas de dépassement potentiel."
    ),
    buildTable(
      ["Date", "Libellé", "Catégorie", "Montant (FCFA)", "Statut"],
      [
        ["2026-03-12", "Achat craies et fournitures", "Fournitures", "45 000", "Approuvée"],
        ["2026-03-13", "Facture SBEE — électricité mars", "Énergie", "128 500", "En attente"],
        ["2026-03-14", "Réparation porte salle 12", "Entretien", "32 000", "Payée"],
        ["2026-03-15", "Carburant bus scolaire", "Transport", "75 000", "Brouillon"],
      ],
      [15, 35, 20, 15, 15]
    ),
    spacer(),

    h2("9.3 Sous-onglet Budget"),
    p(
      "Le sous-onglet Budget permet de définir et de suivre le budget annuel de l'établissement par catégorie. Le budget est structuré par exercice scolaire et par catégorie, avec une répartition mensuelle optionnelle (budget glissant). Chaque ligne budgétaire comporte : la catégorie, le budget annuel voté, le budget consommé à date, le budget restant, le taux d'exécution, et une alerte visuelle. Le budget peut être saisi manuellement ou importé depuis Excel."
    ),
    p(
      "Le budget peut être ventilé par catégorie fille (par exemple, la catégorie « Personnel » peut être ventilée en « Salaires enseignants », « Salaires administratifs », « Charges sociales »). Le suivi est alors disponible à chaque niveau de la hiérarchie. En cas de dépassement, le système propose deux actions : ajuster le budget (révision) ou bloquer la saisie de nouvelles dépenses sur la catégorie concernée. Les révisions budgétaires sont tracées dans un journal dédié."
    ),
    buildTable(
      ["Catégorie", "Budget voté (FCFA)", "Consommé (FCFA)", "Restant (FCFA)", "Exécution %"],
      [
        ["Salaires enseignants", "45 000 000", "32 500 000", "12 500 000", "72 %"],
        ["Fournitures", "3 500 000", "3 150 000", "350 000", "90 %"],
        ["Énergie", "2 800 000", "2 450 000", "350 000", "88 %"],
        ["Entretien", "1 800 000", "1 950 000", "-150 000", "108 %"],
        ["Transport", "2 200 000", "1 320 000", "880 000", "60 %"],
      ],
      [28, 18, 18, 18, 18]
    ),
    spacer(),

    h2("9.4 Sous-onglet Catégories"),
    p(
      "Le sous-onglet Catégories gère le référentiel des catégories de dépenses. Une catégorie est définie par un libellé, un code, une description, un compte comptable OHADA par défaut, un parent (catégorie mère pour la hiérarchie), et un statut actif/inactif. Les catégories sont organisées en arborescence à trois niveaux maximum. Une catégorie ne peut pas être supprimée si des dépenses ou un budget y sont rattachés ; la désactivation est alors recommandée."
    ),
    p(
      "Le mapping OHADA est central dans ce sous-onglet : chaque catégorie est associée à un compte du plan comptable OHADA (ex. compte 601 « Achats de marchandises », 605 « Autres achats », 614 « Charges de transport », 631 « Impôts et taxes »). Cette association est utilisée automatiquement lors de l'export comptable FEC/OHADA, ce qui évite aux comptables de ressaisir les écritures dans leur logiciel. Le plan comptable OHADA est pré-chargé et peut être personnalisé par établissement."
    ),

    h2("9.5 Workflow d'approbation et de rejet"),
    p(
      "Le workflow d'approbation des dépenses est paramétrable par seuils de montant. Par défaut, trois seuils sont définis : moins de 100 000 FCFA (validation simple par le comptable), entre 100 000 et 500 000 FCFA (validation comptable + directeur), plus de 500 000 FCFA (validation comptable + directeur + promoteur). Chaque validation est tracée dans l'audit log avec l'utilisateur, l'horodatage et un commentaire optionnel. Les rejets sont également tracés avec un motif obligatoire."
    ),
    p(
      "Une dépense approuvée ne peut plus être modifiée ; seule une opération d'annulation est possible, qui génère une écriture comptable de contrepassation. Les dépenses rejetées retournent en brouillon et peuvent être modifiées et resoumises. Le workflow peut être visualisé sous forme de chronologie dans la fiche détaillée de la dépense. Les justificatifs sont obligatoires pour les dépenses supérieures à un seuil paramétrable (par défaut 50 000 FCFA) et sont stockés chiffrés sur le système de fichiers."
    ),
    buildTable(
      ["Seuil montant", "Validation niveau 1", "Validation niveau 2", "Validation niveau 3"],
      [
        ["< 100 000 FCFA", "Comptable", "—", "—"],
        ["100 000 — 500 000 FCFA", "Comptable", "Directeur", "—"],
        ["> 500 000 FCFA", "Comptable", "Directeur", "Promoteur"],
      ],
      [30, 25, 25, 20]
    ),
    spacer(),

    h2("9.6 Mapping OHADA et alertes budget 85 %"),
    p(
      "Le mapping OHADA est appliqué automatiquement à chaque dépense validée : une écriture comptable est générée dans la table accounting_entry avec le débit sur le compte de la catégorie et le crédit sur le compte de la caisse ou de la banque. Ces écritures alimentent l'export FEC et l'export OHADA du module d'intégration comptable. Le mapping est configurable par catégorie et peut être redéfini au niveau de la dépense si nécessaire."
    ),
    p(
      "L'alerte budget 85 % est déclenchée automatiquement lorsqu'une catégorie atteint 85 % d'exécution de son budget annuel. Une notification email est envoyée au directeur et au comptable, et une pastille orange apparaît sur la catégorie concernée dans le Dashboard. À 100 %, la pastille devient rouge et la saisie de nouvelles dépenses sur la catégorie est bloquée par défaut (configurable : autoriser avec avertissement, ou bloquer strictement). À 110 %, une alerte ORION critique est générée et remonte jusqu'au promoteur."
    ),
    pageBreak(),
  ];
}

/** Chapitre 10 — Clôture & Trésorerie (section 12). */
function chap10Closure(): (Paragraph | Table)[] {
  return [
    h1("10. Clôture & Trésorerie"),
    p(
      "L'onglet Clôture & Trésorerie est le module de contrôle quotidien des flux financiers. Il assure que chaque caisse est clôturée à la fin de la journée, que les encaissements et les dépenses sont rapprochés du solde réel, et que les anomalies sont détectées et traitées. La clôture journalière automatique est planifiée à 23h59 par défaut, et génère un rapport de clôture PDF pour chaque caisse. L'onglet est structuré en deux sous-onglets : Dashboard et Clôture."
    ),
    p(
      "La clôture est une opération critique pour la sécurité financière : elle fige les transactions de la journée, calcule le solde théorique (solde initial + encaissements − dépenses), compare au solde réel (comptage physique), et enregistre l'éventuel écart. Tout écart supérieur au seuil paramétrable (1 000 FCFA par défaut) déclenche une alerte ORION et doit être justifié par le responsable de la caisse. Les clôtures sont immuables et servent de référence pour les audits."
    ),

    h2("10.1 Sous-onglet Dashboard"),
    p(
      "Le Dashboard de clôture affiche en haut de page cinq KPIs : nombre de caisses clôturées aujourd'hui, nombre de caisses en attente de clôture, nombre d'écarts détectés aujourd'hui, total des écarts en valeur absolue, et temps moyen de clôture. Un tableau récapitulatif présente, pour chaque caisse, le statut du jour (clôturée, en attente, en anomalie), le solde théorique, le solde réel déclaré, l'écart éventuel, et l'horodatage de la clôture."
    ),
    p(
      "Le Dashboard affiche également les anomalies détectées sur les sept derniers jours : écarts non justifiés, clôtures en retard, clôtures manuelles (hors cron automatique), et caisses n'ayant pas été clôturées pendant plus de 24 heures. Un bouton « Lancer la clôture manuelle » permet de forcer la clôture immédiate d'une caisse en cas de besoin (par exemple en cas d'indisponibilité du cron)."
    ),
    buildTable(
      ["Caisse", "Statut", "Solde théorique (FCFA)", "Solde réel (FCFA)", "Écart (FCFA)", "Clôturée à"],
      [
        ["Caisse principale", "Clôturée", "1 245 000", "1 245 000", "0", "23:59"],
        ["Caisse cantine", "Clôturée", "312 500", "310 500", "-2 000", "23:59"],
        ["Caisse internat", "En attente", "528 750", "—", "—", "—"],
        ["Caisse sorties", "Clôturée", "85 000", "85 000", "0", "23:59"],
      ],
      [20, 15, 20, 18, 12, 15]
    ),
    spacer(),

    h2("10.2 Sous-onglet Clôture"),
    p(
      "Le sous-onglet Clôture présente le journal chronologique des clôtures, filtrable par caisse, par date et par statut. Chaque ligne affiche : la caisse, la date, le solde initial, le total des encaissements, le total des dépenses, le solde théorique, le solde réel déclaré, l'écart, le responsable, et le statut (validée, en anomalie, en attente de justification). Au clic sur une ligne, la fiche détaillée affiche l'ensemble des transactions de la journée et le rapport PDF de clôture."
    ),
    p(
      "La clôture journalière automatique s'exécute via un cron planifié à 23h59. Le cron parcourt toutes les caisses actives, calcule le solde théorique, génère le rapport PDF, et marque la clôture comme « en attente de comptage » (le solde réel n'est pas encore saisi). Le responsable de la caisse reçoit une notification l'invitant à effectuer le comptage physique et à saisir le solde réel dans l'interface. À la saisie, l'écart est calculé et, s'il est supérieur au seuil, le responsable doit saisir un motif de justification."
    ),

    h2("10.3 Rapprochement"),
    p(
      "Le rapprochement est l'opération qui compare les encaissements et dépenses enregistrés dans le système aux mouvements réels de la caisse. Il est effectué quotidiennement par le responsable de la caisse et validé par le comptable. Le rapprochement prend en compte : les encaissements en espèces, les paiements Fedapay et Mobile Money (via les webhooks des opérateurs), les transferts inter-caisses, et les dépenses validées. Tout écart génère une anomalie qui doit être justifiée."
    ),
    p(
      "Pour les paiements en ligne (Fedapay, Mobile Money), le rapprochement utilise les APIs des opérateurs pour récupérer l'ensemble des transactions de la journée et les comparer aux enregistrements du système. Les transactions présentes chez l'opérateur mais absentes du système (ou inversement) sont signalées comme anomalies. Ce rapprochement automatique protège contre les paiements en ligne non enregistrés (panne webhook, doublon, fraude) et garantit la cohérence entre le système et les relevés bancaires."
    ),

    h2("10.4 Anomalies de clôture"),
    p(
      "Les anomalies de clôture sont classées en quatre catégories : écart de caisse (solde théorique ≠ solde réel), clôture manquante (caisse non clôturée à 00h05), clôture tardive (clôture effectuée après 06h00 le lendemain), et rapprochement en échec (transaction opérateur non retrouvée). Chaque anomalie est tracée dans la table closure_anomaly avec un statut (ouverte, justifiée, clôturée, escaladée) et un motif obligatoire pour la clôture."
    ),
    p(
      "Les anomalies non justifiées dans un délai paramétrable (par défaut 48 heures) sont escaladées : notification au directeur à 48 heures, au promoteur à 72 heures, et création d'une alerte ORION critique à 96 heures. Cette politique d'escalade garantit qu'aucune anomalie ne reste sans traitement. Le tableau de bord des anomalies est consultable par le comptable et le directeur, et un rapport mensuel des anomalies est généré automatiquement pour le comité d'audit."
    ),
    buildTable(
      ["Type d'anomalie", "Seuil de déclenchement", "Délai justification", "Escalade"],
      [
        ["Écart de caisse", "Écart > 1 000 FCFA", "48 heures", "Directeur → Promoteur"],
        ["Clôture manquante", "Pas de clôture à 00h05", "Immédiat", "Comptable"],
        ["Clôture tardive", "Clôture après 06h00", "24 heures", "Directeur"],
        ["Rapprochement en échec", "Transaction opérateur absente", "24 heures", "Comptable + Directeur"],
      ],
      [28, 27, 20, 25]
    ),
    spacer(),
    pageBreak(),
  ];
}

/** Chapitre 11 — Rapports financiers (section 13). */
function chap11Reports(): (Paragraph | Table)[] {
  return [
    h1("11. Rapports financiers"),
    p(
      "L'onglet Rapports financiers est l'outil de pilotage stratégique du module Finance. Il propose quatre familles de rapports : Bilan périodique, État des arriérés, Journal de caisse, et Comparatif & Projections. Chaque rapport est paramétrable par période, par caisse, par classe, par catégorie, et peut être exporté en Excel, PDF, et pour certains en CSV comptable. Les rapports s'appuient sur les données agrégées du module et présentent des graphiques interactifs Recharts."
    ),
    p(
      "Les rapports sont conçus pour répondre aux besoins de trois audiences : la direction de l'établissement (vision synthétique et tendancielle), le comptable (détail des transactions et rapprochements), et les partenaires externes (audit, banque, autorités de tutelle). Chaque rapport peut être planifié et envoyé automatiquement par email à une liste de destinataires, avec une fréquence journalière, hebdomadaire, mensuelle ou trimestrielle."
    ),

    h2("11.1 Sous-onglet Bilan périodique"),
    p(
      "Le Bilan périodique présente la situation financière de l'établissement sur une période donnée (mois, trimestre, semestre, année). Il comporte trois sections : encaissements (par catégorie de frais, par mode de paiement, par caisse), dépenses (par catégorie, par fournisseur, par mode de paiement), et résultat net (encaissements − dépenses). Chaque section est accompagnée d'un graphique en barres ou en camembert et d'un tableau de détail. Le rapport peut être comparé à la période précédente pour visualiser les évolutions."
    ),
    p(
      "Le Bilan périodique calcule également des ratios clés : taux de recouvrement, taux d'exécution budgétaire, part des frais de scolarité dans les encaissements, part des salaires dans les dépenses, marge nette. Ces ratios sont présentés sous forme de cartes en haut du rapport et permettent à la direction d'identifier rapidement les points d'attention. Le rapport est exportable en PDF avec en-tête et signature du comptable, et en Excel multi-feuilles pour analyse approfondie."
    ),

    h2("11.2 Sous-onglet État des arriérés"),
    p(
      "L'État des arriérés dresse la cartographie complète des arriérés de l'établissement à une date donnée. Il présente une répartition par ancienneté (moins de 30 jours, 30 à 60, 60 à 90, plus de 90), par classe, par régime, et par catégorie de frais. Un tableau détaillé liste chaque élève en arriéré avec le montant dû, l'ancienneté, le statut de relance, et la dernière action effectuée. Le rapport permet d'identifier les classes à risque et de prioriser les actions de recouvrement."
    ),
    p(
      "Le rapport calcule une provision pour créances douteuses selon une grille paramétrable (par exemple : 0 % à 30 jours, 25 % à 60 jours, 50 % à 90 jours, 100 % au-delà). Cette provision est indicative et n'a pas de valeur comptable officielle, mais elle aide la direction à anticiper les pertes potentielles. Le rapport est exportable en PDF pour communication au conseil d'administration et en Excel pour analyse approfondie par le comptable."
    ),
    buildTable(
      ["Ancienneté", "Nombre d'élèves", "Montant total (FCFA)", "Provision suggérée", "% du total"],
      [
        ["< 30 jours", "42", "2 850 000", "0 %", "18 %"],
        ["30 à 60 jours", "28", "1 920 000", "25 %", "12 %"],
        ["60 à 90 jours", "15", "1 180 000", "50 %", "8 %"],
        ["> 90 jours", "9", "9 850 000", "100 %", "62 %"],
        ["Total", "94", "15 800 000", "—", "100 %"],
      ],
      [22, 18, 22, 18, 20]
    ),
    spacer(),

    h2("11.3 Sous-onglet Journal de caisse"),
    p(
      "Le Journal de caisse présente le détail chronologique de toutes les transactions d'une caisse sur une période donnée. Chaque ligne affiche : la date et l'heure, le numéro de transaction, le type (encaissement, dépense, transfert), le libellé, le montant, le solde courant, et le mode de paiement. Le journal peut être filtré par type, par mode, et par montant. Il est aligné sur les rapports de clôture et permet de reconstituer le solde de la caisse à tout moment."
    ),
    p(
      "Le Journal de caisse est l'un des rapports les plus demandés par les auditeurs externes : il prouve la traçabilité complète des flux financiers. Il est exportable en PDF avec en-tête de l'établissement et signature du comptable, et en Excel pour exploitation comptable. Un export CSV comptable est également disponible, formaté selon les normes FEC (Fichier des Écritures Comptables) pour une intégration directe dans les logiciels comptables."
    ),

    h2("11.4 Sous-onglet Comparatif & Projections"),
    p(
      "Le sous-onglet Comparatif & Projections offre une vision forward-looking du module Finance. Il compare les encaissements et dépenses de plusieurs périodes (année N vs N-1, trimestre vs trimestre, mois vs mois) et projette les tendances sur les prochains mois selon trois scénarios : optimiste (poursuite de la tendance haussière), réaliste (maintien des niveaux actuels), et pessimiste (dégradation de 10 %). Les projections alimentent la planification budgétaire de l'année suivante."
    ),
    p(
      "Le rapport inclut également des indicateurs avancés : saisonnalité des encaissements (concentration sur les mois de rentrée), taux de fidélisation des élèves (impact sur les encaissements futurs), élasticité des frais de scolarité (impact d'une hausse de tarif sur le taux de recouvrement). Ces analyses s'appuient sur les données historiques de l'établissement et utilisent des modèles statistiques simples (moyennes mobiles, régression linéaire). Les graphiques Recharts permettent de visualiser les tendances et les projections de façon interactive."
    ),

    h2("11.5 Exports comptables FEC / OHADA / CSV"),
    p(
      "Tous les rapports financiers peuvent être exportés en trois formats comptables. Le format FEC (Fichier des Écritures Comptables) est la norme française pour l'archivage et le contrôle fiscal ; il génère un fichier texte délimité contenant l'ensemble des écritures de la période. Le format OHADA est adapté au plan comptable OHADA en vigueur dans les pays francophones africains ; il génère un fichier Excel structuré par compte et par journal. Le format CSV générique est utilisable par tout logiciel comptable tiers."
    ),
    p(
      "Les exports sont générés par le service accounting-export.service.ts qui consolide les écritures de la table accounting_entry et applique le mapping OHADA défini au niveau des catégories de dépenses et des catégories de frais. Les exports sont horodatés, signés électroniquement (hash SHA-256), et tracés dans l'audit log. Une numérotation séquentielle garantit l'unicité de chaque export et empêche toute réutilisation frauduleuse."
    ),
    pageBreak(),
  ];
}

/** Chapitre 12 — Contrôle & Audit (section 14). */
function chap12Audit(): (Paragraph | Table)[] {
  return [
    h1("12. Contrôle & Audit"),
    p(
      "L'onglet Contrôle & Audit est le centre de contrôle interne du module Finance. Il détecte et trace les anomalies, les transactions suspectes, les écarts de caisse, et conserve l'historique complet des actions effectuées par les utilisateurs. Cet onglet s'appuie fortement sur le moteur ORION pour la détection proactive des fraudes et des erreurs. Il est structuré en cinq sous-onglets : Dashboard, Anomalies, Transactions suspectes, Écarts caisse, et Historique audit."
    ),
    p(
      "Le contrôle interne est une obligation pour tout établissement gérant des fonds publics ou privés. Le module Finance d'Academia Helm apporte une réponse technologique complète à cette obligation : traçabilité exhaustive, détection automatique, alertes en temps réel, et reporting pour les auditeurs externes. L'audit log est immuable (trigger PostgreSQL empêchant toute modification ou suppression) et peut être exporté pour les besoins de commissariat aux comptes."
    ),

    h2("12.1 Sous-onglet Dashboard"),
    p(
      "Le Dashboard de contrôle & audit présente une vue synthétique de l'état du contrôle interne. Quatre KPIs sont affichés : nombre d'anomalies ouvertes, nombre de transactions suspectes en attente de revue, nombre d'écarts de caisse non justifiés, et nombre d'événements d'audit sur les 30 derniers jours. Un graphique en courbes affiche l'évolution mensuelle des anomalies détectées et résolues, et un graphique en barres présente la répartition par type d'anomalie."
    ),
    p(
      "Le Dashboard liste également les dix dernières anomalies détectées et les dix derniers événements d'audit significatifs (modifications de paramétrage, suppressions, exports comptables). Un bandeau ORION en haut de page synthétise les alertes critiques en cours. Le Dashboard est l'écran de travail quotidien du contrôleur interne et du commissaire aux comptes lors de ses audits périodiques."
    ),

    h2("12.2 Sous-onglet Anomalies"),
    p(
      "Le sous-onglet Anomalies liste toutes les anomalies détectées par le système, qu'elles soient ORION ou issues des contrôles automatiques (clôture, rapprochement). Chaque anomalie comporte : un type (écart caisse, transaction suspecte, doublon, données incohérentes, rapprochement en échec), une sévérité (critique, avertissement, info), une description, la date de détection, l'objet concerné (transaction, caisse, élève), le statut (ouverte, en cours de traitement, justifiée, clôturée), et l'utilisateur en charge."
    ),
    p(
      "Le traitement d'une anomalie suit un workflow standardisé : analyse (par le comptable), décision (justifier ou escalader), action (corrective ou préventive), et clôture (avec motif obligatoire). Les anomalies critiques sont automatiquement notifiées au directeur et au promoteur. Les anomalies non traitées dans un délai paramétrable sont escaladées. Le tableau est filtrable par type, sévérité, statut et période, et exportable en Excel et PDF pour les rapports d'audit."
    ),
    buildTable(
      ["Type", "Sévérité", "Description courte", "Date", "Statut"],
      [
        ["Écart caisse", "Critique", "Caisse cantine : -2 000 FCFA non justifié", "2026-03-12", "En cours"],
        ["Transaction suspecte", "Avertissement", "Paiement de 850 000 FCFA en espèces", "2026-03-13", "Justifiée"],
        ["Doublon", "Critique", "Deux reçus identiques émis à 3 min d'intervalle", "2026-03-14", "Ouverte"],
        ["Rapprochement", "Info", "1 transaction Fedapay en attente webhook", "2026-03-15", "Clôturée"],
      ],
      [22, 18, 35, 13, 12]
    ),
    spacer(),

    h2("12.3 Sous-onglet Transactions suspectes"),
    p(
      "Le sous-onglet Transactions suspectes liste les transactions identifiées par ORION comme présentant un risque de fraude ou d'erreur. Les critères de suspicion incluent : montant anormalement élevé (supérieur à 3 écarts-types de la moyenne), paiement en plusieurs fois fractionnés pour contourner un seuil, encaissement en dehors des heures ouvrables, modification ou suppression a posteriori, doublon de référence, écart entre montant déclaré et montant en caisse."
    ),
    p(
      "Chaque transaction suspecte doit être revue par le contrôleur interne qui peut : confirmer la légitimité (justificatif), marquer comme fraude avérée (déclenchement d'une procédure disciplinaire), ou demander une investigation complémentaire. Les transactions confirmées comme frauduleuses sont signalées au directeur et au promoteur, et peuvent donner lieu à une plainte. Les transactions marquées comme légitimes alimentent un apprentissage du moteur ORION pour réduire les faux positifs."
    ),

    h2("12.4 Sous-onglet Écarts caisse"),
    p(
      "Le sous-onglet Écarts caisse consolide tous les écarts détectés lors des clôtures journalières. Chaque écart est caractérisé par : la caisse, la date, le montant de l'écart (positif ou négatif), le sens (en plus ou en moins), le responsable de la caisse au moment de la clôture, le motif de justification (si fourni), et le statut (justifié, non justifié, escaladé). Les écarts récurrents sur une même caisse sont signalés comme suspects et déclenchent une investigation approfondie."
    ),
    p(
      "Les écarts de caisse sont l'un des indicateurs les plus surveillés en contrôle interne : un écart positif (trop-perçu) peut signaler une erreur de rendu monnaie ou une dissimulation de fonds, un écart négatif (manque) peut signaler un vol ou une erreur de saisie. Le module Finance calcule automatiquement la fréquence et le montant cumulé des écarts par caisse et par responsable, ce qui permet d'identifier les caisses à risque et de prendre des mesures correctives (formation, rotation du personnel, contrôle renforcé)."
    ),
    buildTable(
      ["Caisse", "Date", "Écart (FCFA)", "Sens", "Responsable", "Statut"],
      [
        ["Caisse cantine", "2026-03-12", "-2 000", "Manque", "Mme Sossou", "Justifié"],
        ["Caisse principale", "2026-03-13", "+1 500", "Trop-perçu", "M. Adjakpa", "Non justifié"],
        ["Caisse transport", "2026-03-14", "-5 000", "Manque", "M. Dossou", "Escaladé"],
      ],
      [22, 15, 15, 15, 18, 15]
    ),
    spacer(),

    h2("12.5 Sous-onglet Historique audit"),
    p(
      "Le sous-onglet Historique audit est la chronologie exhaustive de toutes les actions effectuées dans le module Finance. Chaque entrée d'audit comporte : l'horodatage, l'utilisateur, le type d'action (création, modification, suppression, validation, export), l'objet concerné (type et identifiant), les valeurs avant et après (diff), l'adresse IP et le user-agent. L'audit log est immuable : un trigger PostgreSQL empêche toute modification ou suppression des enregistrements, y compris par un super-administrateur."
    ),
    p(
      "L'Historique audit est filtrable par utilisateur, par type d'action, par objet, par période, et par sévérité. Il est consultable en lecture seule et exportable en Excel et PDF pour les besoins d'audit externe. Une fonctionnalité de recherche plein texte permet de retrouver rapidement une action spécifique. L'Historique audit est conservé indéfiniment et n'est pas soumis à la politique de purge des autres tables : cette conservation à perpétuité est une garantie légale pour l'établissement."
    ),

    h2("12.6 ORION — moteur anti-fraude"),
    p(
      "Le moteur ORION joue un rôle central dans le contrôle & audit. Il analyse en continu les transactions financières et applique des règles de détection paramétrables : détection de montants anormaux, patterns temporels suspects (transactions en rafale, transactions nocturnes), corrélations entre utilisateurs et entre caisses, doublons de référence, incohérences entre données déclaratives et données calculées. Les règles ORION peuvent être activées, désactivées et ajustées par le contrôleur interne."
    ),
    p(
      "Le moteur ORION s'appuie sur des modèles statistiques (écarts-types, moyennes mobiles, détection de séries) et sur des règles métier explicites. Les alertes générées sont qualifiées par niveau de sévérité et font l'objet d'un suivi de résolution. Le taux de faux positifs est surveillé : un taux supérieur à 20 % déclenche une révision des règles par le contrôleur. ORION est également capable d'apprendre des décisions passées : une transaction marquée comme légitime par un contrôleur affine le modèle pour les futures détections similaires."
    ),
    pageBreak(),
  ];
}

/** Chapitre 13 — Paramétrage (section 15). */
function chap13Settings(): (Paragraph | Table)[] {
  return [
    h1("13. Paramétrage"),
    p(
      "L'onglet Paramétrage centralise toutes les configurations générales du module Finance. Il est organisé en huit blocs thématiques : blocage administratif, relance automatique multi-canal, clôture automatique, budget, annulation de transactions, export comptable automatique mensuel, Fedapay et paiements en ligne, et historique des modifications. Chaque bloc est présenté sous forme de carte avec ses paramètres, leurs valeurs courantes, et un bouton de modification qui ouvre un modal dédié."
    ),
    p(
      "Le paramétrage est réservé aux rôles DIRECTOR et ADMIN, et toute modification est tracée dans l'Historique audit avec l'identité de l'utilisateur et l'horodatage. Un bandeau ORION en haut de la page affiche les alertes spécifiques au paramétrage (par exemple : seuil de blocage insuffisant, relance automatique désactivée, export mensuel non planifié). Le paramétrage peut être exporté en JSON pour faciliter la duplication entre établissements."
    ),

    h2("13.1 Blocage administratif"),
    p(
      "Le bloc « Blocage administratif » configure la politique de blocage des élèves en retard. Les paramètres disponibles sont : seuil de retard pour le blocage automatique (30 jours par défaut), délai de grâce après une promesse de paiement (7 jours), services impactés par le blocage (cantine, transport, sorties, examen), et documents bloqués (bulletin, certificat de scolarité). Le blocage peut être désactivé globalement si l'établissement préfère une politique de recouvrement sans blocage."
    ),
    p(
      "Le déblocage manuel est également configurable : rôle habilité (directeur, comptable en chef), motif obligatoire, et validation hiérarchique pour les déblocages répétés. Un seuil de déblocages maximum par élève et par an (par défaut 2) peut être défini pour éviter les abus. Les déblocages sont tracés dans l'audit log et remontés dans le tableau de bord ORION."
    ),

    h2("13.2 Relance automatique multi-canal"),
    p(
      "Le bloc « Relance automatique multi-canal » définit la cadence et les canaux des relances automatiques. Les paramètres incluent : niveau 1 (J+3, canal email, template « Avertissement »), niveau 2 (J+7, canaux email + WhatsApp, template « Urgent »), niveau 3 (J+15, canaux email + WhatsApp + SMS, template « Final »), niveau 4 (J+30, blocage administratif automatique). Chaque niveau peut être activé ou désactivé, et ses paramètres ajustés."
    ),
    p(
      "Les templates de message sont éditables avec des variables de substitution (nom de l'élève, montant dû, date d'échéance, nom de l'établissement, lien de paiement en ligne). Un aperçu permet de visualiser le message rendu. Les horaires d'envoi sont paramétrables (par défaut 08h00 à 19h00) pour éviter les relances nocturnes. Un délai minimal entre deux relances à un même parent (par défaut 24 heures) protège contre le harcèlement."
    ),
    buildTable(
      ["Niveau", "Délai", "Canaux", "Template", "Action associée"],
      [
        ["1 — Avertissement", "J+3", "Email", "msg_avert", "Notification simple"],
        ["2 — Urgent", "J+7", "Email + WhatsApp", "msg_urgent", "Notification + copie directeur"],
        ["3 — Final", "J+15", "Email + WhatsApp + SMS", "msg_final", "Notification + copie promoteur"],
        ["4 — Blocage", "J+30", "Email + WhatsApp", "msg_blocage", "Blocage administratif"],
      ],
      [25, 10, 25, 20, 20]
    ),
    spacer(),

    h2("13.3 Clôture automatique"),
    p(
      "Le bloc « Clôture automatique » configure le cron de clôture journalière. Les paramètres incluent : heure de la clôture (23h59 par défaut), fuseau horaire, seuil d'écart de caisse pour anomalie (1 000 FCFA par défaut), délai de justification des écarts (48 heures), et escalade en cas de non-justification (notification directeur à 48 heures, promoteur à 72 heures, alerte ORION critique à 96 heures). La clôture automatique peut être désactivée globalement pour les établissements préférant une clôture manuelle."
    ),
    p(
      "Un paramètre avancé permet de configurer le comportement en cas d'échec du cron (par exemple : serveur indisponible à 23h59) : nouvelle tentative à 00h30, 01h00, 02h00, puis alerte ORION. Les clôtures manuelles hors cron sont autorisées mais tracées spécifiquement comme « manuelles » dans le journal, ce qui permet de les distinguer lors des audits."
    ),

    h2("13.4 Budget"),
    p(
      "Le bloc « Budget » configure la politique budgétaire de l'établissement. Les paramètres incluent : seuil d'alerte budget (85 % par défaut), seuil de blocage budget (100 % par défaut), seuil critique (110 % par défaut), comportement au seuil de blocage (bloquer la saisie ou autoriser avec avertissement), et révision budgétaire (autorisée ou soumise à validation du promoteur). Le budget peut être obligatoire (toute dépense doit avoir une catégorie budgétisée) ou optionnel."
    ),
    p(
      "Le bloc permet également de définir la période budgétaire par défaut (annuelle, trimestrielle, mensuelle), la méthode d'allocation (équirépartie, pondérée par saisonnalité), et le report des soldes en fin de période (report automatique ou remise à zéro). Ces paramètres impactent directement le suivi budgétaire de l'onglet Dépenses & Budget et les alertes remontées dans le tableau de bord."
    ),

    h2("13.5 Annulation de transactions"),
    p(
      "Le bloc « Annulation de transactions » définit la politique d'annulation des paiements et des dépenses. Les paramètres incluent : délai maximum pour annuler une transaction (par défaut 24 heures), rôles habilités (comptable, directeur), motif obligatoire, génération automatique d'une écriture de contrepassation, et notification au parent (désactivée par défaut). L'annulation d'une transaction clôturée dans une caisse est interdite par défaut, mais peut être autorisée avec validation du directeur."
    ),
    p(
      "Le bloc définit également la politique de suppression des reçus PDF associés : conservation avec marquage « ANNULÉ », suppression immédiate, ou archivage dans un dossier séparé. La conservation avec marquage est recommandée pour la traçabilité. Les annulations sont tracées dans l'audit log avec l'utilisateur, le motif et l'horodatage, et sont remontées dans le tableau de bord ORION si elles sont anormalement fréquentes."
    ),

    h2("13.6 Export comptable automatique mensuel"),
    p(
      "Le bloc « Export comptable automatique mensuel » planifie la génération automatique de l'export comptable en fin de mois. Les paramètres incluent : jour de l'export (par défaut le 5 du mois suivant), format (FEC, OHADA, CSV), destinataire email (comptable externe, cabinet d'expertise), inclusion des pièces justificatives (oui/non), et archivage sur le système de fichiers. L'export est généré à 03h00 pour minimiser l'impact sur les opérations courantes."
    ),
    p(
      "Le bloc permet également de configurer le plan comptable utilisé (plan OHADA par défaut, plan personnalisé optionnel), le mapping des catégories vers les comptes, et la numérotation séquentielle des exports. Un aperçu de l'export est disponible avant validation, et un journal des exports générés est consultable. Cette automatisation évite l'oubli de l'export mensuel et garantit la disponibilité des données comptables pour le cabinet d'expertise."
    ),

    h2("13.7 Fedapay et paiements en ligne"),
    p(
      "Le bloc « Fedapay et paiements en ligne » configure l'intégration avec la passerelle de paiement Fedapay. Les paramètres incluent : activation/désactivation, mode (test ou production), clé publique, clé secrète, webhook secret, et identifiant marchand. La configuration est testée en temps réel via un appel à l'API Fedapay, et un test de paiement (1 FCFA) peut être effectué pour valider l'ensemble de la chaîne. Les clés sont stockées chiffrées en base de données."
    ),
    p(
      "Le bloc permet également de configurer les modes Mobile Money supportés (MTN MoMo, Moov Money, Orange Money), les plafonds de paiement en ligne, et les frais de transaction (à la charge du parent ou de l'établissement). Les webhooks des opérateurs sont sécurisés par un secret partagé et une vérification de signature. Les paiements en ligne échoués sont automatiquement relancés trois fois à intervalles de 5 minutes, puis marqués comme échec et notifiés au comptable."
    ),

    h2("13.8 Historique des modifications"),
    p(
      "Le bloc « Historique des modifications » présente la chronologie de toutes les modifications du paramétrage. Chaque entrée affiche : la date et l'heure, l'utilisateur, le bloc concerné, le paramètre modifié, l'ancienne valeur, la nouvelle valeur, et un commentaire optionnel. L'historique est filtrable par utilisateur, par bloc et par période, et exportable en Excel et PDF. Cette traçabilité est essentielle pour les audits internes et externes."
    ),
    p(
      "Une fonctionnalité de comparaison permet de visualiser l'évolution du paramétrage entre deux dates, ce qui est particulièrement utile pour comprendre les changements de politique financière au cours de l'année. L'historique est conservé indéfiniment et n'est pas soumis à la politique de purge des autres tables. En cas de modification critique (par exemple : désactivation de la clôture automatique), une notification est immédiatement envoyée au directeur et au promoteur."
    ),
    pageBreak(),
  ];
}

/** Chapitre 14 — Intégration comptable (section 16). */
function chap14AccountingIntegration(): (Paragraph | Table)[] {
  return [
    h1("14. Intégration comptable"),
    p(
      "L'intégration comptable est un chapitre transverse du module Finance qui assure la fluidité entre la gestion financière opérationnelle (encaissements, dépenses) et la comptabilité générale de l'établissement. Academia Helm supporte nativement l'export des écritures dans trois formats : FEC (Fichier des Écritures Comptables, norme française), OHADA (plan comptable OHADA en vigueur en Afrique francophone), et CSV générique. Treize logiciels comptables tiers sont officiellement compatibles avec ces exports."
    ),
    p(
      "L'intégration repose sur un mapping automatique entre les catégories de frais et de dépenses du module Finance et les comptes du plan comptable. Ce mapping est pré-configuré pour le plan OHADA et peut être personnalisé par établissement. Les écritures sont générées en temps réel à chaque validation de transaction, stockées dans la table accounting_entry, et consolidées lors des exports. Un cron mensuel planifié génère automatiquement l'export en début de mois pour le cabinet d'expertise comptable."
    ),

    h2("14.1 Export FEC / OHADA / CSV"),
    p(
      "Le format FEC est la norme française pour l'archivage et le contrôle fiscal des écritures comptables. Il s'agit d'un fichier texte délimité par des tabulations, avec 18 colonnes obligatoires (code journal, numéro écriture, date, compte, libellé, débit, crédit, etc.). Le module Finance génère ce fichier à la demande ou automatiquement en fin de mois, pour une période donnée. Le fichier est horodaté, signé électroniquement (hash SHA-256) et tracé dans l'audit log."
    ),
    p(
      "Le format OHADA est adapté au plan comptable SYSCOHADA en vigueur dans les pays francophones africains (Bénin, Côte d'Ivoire, Sénégal, Cameroun, etc.). Il génère un fichier Excel structuré par journal (ventes, achats, banque, caisse, opérations diverses) avec les écritures regroupées par compte. Le format CSV générique est utilisable par tout logiciel comptable tiers et peut être personnalisé (séparateur, ordre des colonnes, format de date) selon les besoins du cabinet d'expertise."
    ),
    buildTable(
      ["Format", "Norme", "Structure", "Usage typique"],
      [
        ["FEC", "Française", "Texte tabulé 18 colonnes", "Archivage fiscal France"],
        ["OHADA", "SYSCOHADA", "Excel multi-feuilles par journal", "Afrique francophone"],
        ["CSV", "Générique", "Texte configurable", "Logiciels tiers"],
      ],
      [15, 20, 35, 30]
    ),
    spacer(),

    h2("14.2 Mapping OHADA"),
    p(
      "Le mapping OHADA associe chaque catégorie de frais et de dépense à un compte du plan comptable. Le plan OHADA est pré-chargé dans le module avec les comptes les plus courants : 701 (Ventes de produits finis), 706 (Prestations de services), 601 (Achats de marchandises), 605 (Autres achats), 614 (Charges de transport), 631 (Impôts et taxes), 661 (Charges d'intérêts), etc. Chaque catégorie du module Finance est associée à un compte par défaut, modifiable par l'établissement."
    ),
    p(
      "Le mapping est géré dans le sous-onglet Catégories de l'onglet Dépenses & Budget pour les dépenses, et dans la Configuration des frais pour les encaissements. À chaque validation d'une transaction, une écriture comptable est générée automatiquement avec le débit et le crédit correspondants. Les écritures sont stockées dans la table accounting_entry avec un statut (NON_EXPORTÉE, EXPORTÉE, RAPPROCHÉE) qui permet de suivre leur cycle de vie jusqu'à l'intégration dans le logiciel comptable."
    ),
    buildTable(
      ["Catégorie module", "Compte OHADA", "Sens", "Libellé écriture"],
      [
        ["Frais de scolarité", "706", "Crédit", "Prestation de service éducative"],
        ["Frais d'inscription", "706", "Crédit", "Prestation de service — inscription"],
        ["Frais de cantine", "706", "Crédit", "Prestation de service — restauration"],
        ["Achat fournitures", "602", "Débit", "Achats autres approvisionnements"],
        ["Facture énergie", "605", "Débit", "Autres achats — énergie"],
        ["Salaires enseignants", "661", "Débit", "Rémunérations du personnel"],
      ],
      [30, 18, 12, 40]
    ),
    spacer(),

    h2("14.3 Plan comptable pré-mappé"),
    p(
      "Le module Finance embarque un plan comptable OHADA pré-mappé avec plus de 150 comptes courants. Ce plan est accessible en lecture seule dans l'onglet Paramétrage et sert de référence pour le mapping des catégories. Chaque compte comporte : un numéro, un libellé, une classe (1 à 8 selon la nomenclature OHADA), un type (actif, passif, charge, produit), et un statut (activé, désactivé). Le plan peut être enrichi par l'établissement avec des comptes spécifiques."
    ),
    p(
      "Le plan comptable pré-mappé est maintenu à jour par les équipes Academia Helm en fonction des évolutions du SYSCOHADA. Les mises à jour sont livrées via les migrations Prisma et n'impactent pas le mapping personnalisé de l'établissement : les comptes spécifiques ajoutés par l'établissement sont préservés. Une fonction de réinitialisation du plan est disponible, avec confirmation explicite, pour revenir au plan OHADA standard."
    ),

    h2("14.4 Treize logiciels compatibles"),
    p(
      "Les exports générés par le module Finance sont officiellement compatibles avec treize logiciels comptables utilisés en Afrique francophone. La compatibilité est testée à chaque mise à jour du module et un fichier d'exemple est fourni pour chaque logiciel. Le support technique Academia Helm assiste les établissements dans la configuration de l'import côté logiciel comptable, et un guide d'intégration est disponible pour chacun des treize logiciels."
    ),
    buildTable(
      ["Logiciel", "Format recommandé", "Pays d'usage principal"],
      [
        ["Sage 100", "FEC", "France, Bénin"],
        ["Sage Compta 100 OHADA", "OHADA", "Côte d'Ivoire, Sénégal"],
        ["EBP Compta", "FEC", "France"],
        ["Ciel Compta", "FEC", "France"],
        ["Cegid", "FEC", "France"],
        ["Yelda Comptabilité", "OHADA", "Bénin, Togo"],
        ["Procompta", "OHADA", "Cameroun"],
        ["ILB Compta", "OHADA", "Burkina Faso"],
        ["Odoo Comptabilité", "CSV", "Multi-pays"],
        ["Dolibarr", "CSV", "Multi-pays"],
        ["OpenBright Compta", "OHADA", "Bénin"],
        ["ComptaCloud", "FEC + OHADA", "Afrique francophone"],
        ["Excel/Google Sheets", "CSV", "Multi-pays"],
      ],
      [40, 30, 30]
    ),
    spacer(),

    h2("14.5 Cron mensuel automatique"),
    p(
      "Un cron mensuel planifié le 5 du mois à 03h00 génère automatiquement l'export comptable du mois écoulé. Le cron sélectionne le format configuré (FEC, OHADA, CSV), consolide les écritures de la table accounting_entry pour la période, génère le fichier, l'archive sur le système de fichiers, et envoie un email au destinataire configuré (comptable externe, cabinet d'expertise). Le cron est tracé dans l'audit log et un email de notification est envoyé au comptable interne."
    ),
    p(
      "En cas d'échec du cron (par exemple : serveur indisponible), trois nouvelles tentatives sont effectuées à 04h00, 05h00 et 06h00. Si toutes échouent, une alerte ORION critique est générée et le comptable est notifié pour générer l'export manuellement. L'export manuel reste disponible à tout moment dans l'onglet Rapports financiers, et le cron ne fait qu'automatiser cette opération. Les exports générés (automatiques et manuels) sont listés dans un journal dédié, consultable par le comptable et le directeur."
    ),

    h2("14.6 API REST d'intégration"),
    p(
      "Le module Finance expose une API REST dédiée à l'intégration comptable. Les endpoints disponibles incluent : GET /api/finance/accounting/entries (liste des écritures avec filtres), GET /api/finance/accounting/export (génération d'un export à la demande), GET /api/finance/accounting/plan (plan comptable de l'établissement), et POST /api/finance/accounting/mapping (mise à jour du mapping catégorie-compte). L'API est sécurisée par JWT et un guard @Roles limite l'accès aux rôles DIRECTOR, ADMIN et ACCOUNTANT."
    ),
    p(
      "Pour les établissements disposant d'une intégration personnalisée (ERP, logiciel comptable maison), un endpoint webhook peut être configuré pour pousser les écritures en temps réel vers le système externe. Le webhook est déclenché à chaque validation de transaction et envoie un payload JSON contenant l'écriture comptable. En cas d'échec du webhook, l'écriture est stockée dans une file de réessai et renvoyée jusqu'à trois fois. L'API est documentée avec OpenAPI/Swagger et un SDK TypeScript est disponible pour les développeurs tiers."
    ),
    pageBreak(),
  ];
}

/** Chapitre 15 — Distinction nouvel élève / ancien élève (section 17). */
function chap15NewVsReturning(): (Paragraph | Table)[] {
  return [
    h1("15. Distinction nouvel élève / ancien élève"),
    p(
      "La distinction entre nouvel élève et ancien élève est une règle métier fondamentale du module Finance d'Academia Helm. Elle conditionne le type de frais applicable (frais d'inscription pour les nouveaux, frais de réinscription pour les anciens), le régime de paiement, et la trajectoire de recouvrement. Cette distinction était initialement implémentée via le champ isNewStudent sur la table Student, mais elle a été refactorisée en un champ enrollmentType plus explicite et plus robuste."
    ),
    p(
      "Le refactoring a été motivé par plusieurs problèmes opérationnels : le champ booléen isNewStudent ne permettait pas de distinguer un élève en pré-inscription d'un élève en première inscription effective, ni de gérer les cas particuliers (élève ayant quitté l'établissement et revenant après une absence, élève transféré d'une filière à une autre). Le champ enrollmentType est une énumération à quatre valeurs qui couvre l'ensemble des cas et qui est utilisée de façon transverse dans tout le module Finance."
    ),

    h2("15.1 Du champ isNewStudent à enrollmentType"),
    p(
      "Le champ isNewStudent (booléen) a été remplacé par le champ enrollmentType (enum) sur la table Student. Les quatre valeurs de l'énumération sont : INSCRIPTION (première inscription dans l'établissement), REINSCRIPTION (élève déjà inscrit l'année précédente), TRANSFERT (élève venant d'un autre établissement avec transfert de dossier), and PRE_INSCRIPTION (élève en pré-inscription, statut provisoire avant validation). Cette typologie plus fine permet une gestion plus précise des frais applicables."
    ),
    p(
      "La migration a été effectuée via un script Prisma qui a converti les valeurs existantes : isNewStudent=true → enrollmentType=INSCRIPTION, isNewStudent=false → enrollmentType=REINSCRIPTION. Les cas particuliers (élèves transférés, pré-inscriptions) ont été traités manuellement par les comptables des établissements. La migration est tracée dans le journal des migrations et un rollback est possible en cas de besoin. L'ancien champ isNewStudent a été conservé temporairement pour compatibilité, puis supprimé après validation."
    ),
    buildTable(
      ["Valeur enrollmentType", "Ancien isNewStudent", "Description", "Frais applicable"],
      [
        ["INSCRIPTION", "true", "Première inscription dans l'établissement", "Frais d'inscription complet"],
        ["REINSCRIPTION", "false", "Élève déjà inscrit l'année précédente", "Frais de réinscription (réduit)"],
        ["TRANSFERT", "—", "Élève venant d'un autre établissement", "Frais d'inscription (selon politique)"],
        ["PRE_INSCRIPTION", "—", "Pré-inscription provisoire", "Aucun frais (en attente validation)"],
      ],
      [22, 18, 35, 25]
    ),
    spacer(),

    h2("15.2 Filtrage INSCRIPTION vs REINSCRIPTION"),
    p(
      "Le champ enrollmentType est utilisé comme critère de filtrage dans plusieurs écrans du module Finance. Dans l'onglet Configuration des frais, il permet de définir des frais distincts pour les INSCRIPTION et les REINSCRIPTION (par exemple : frais d'inscription de 25 000 FCFA pour les nouveaux, frais de réinscription de 10 000 FCFA pour les anciens). Dans l'onglet Comptes élèves, le filtre permet de lister séparément les nouveaux et les anciens pour un suivi différencié."
    ),
    p(
      "Le filtrage est également utilisé dans les Rapports financiers pour ventiler les encaissements par type d'élève. Cette ventilation permet à la direction d'analyser la part des frais d'inscription dans les recettes de la rentrée, l'évolution du taux de fidélisation (rapport REINSCRIPTION / (INSCRIPTION + REINSCRIPTION)), et l'impact des transferts entrants. Les rapports peuvent également croiser enrollmentType avec d'autres critères (classe, régime, statut financier) pour des analyses fines."
    ),
    buildTable(
      ["Écran", "Filtre disponible", "Cas d'usage"],
      [
        ["Configuration des frais", "INSCRIPTION / REINSCRIPTION / TOUS", "Définir frais distincts par type"],
        ["Comptes élèves", "INSCRIPTION / REINSCRIPTION / TRANSFERT", "Suivi différencié des nouveaux"],
        ["Encaissements", "INSCRIPTION / REINSCRIPTION", "Analyse des paiements par type"],
        ["Recouvrement", "INSCRIPTION / REINSCRIPTION", "Cibler les relances par type"],
        ["Rapports financiers", "INSCRIPTION / REINSCRIPTION / TOUS", "Ventilation des recettes"],
      ],
      [25, 40, 35]
    ),
    spacer(),

    h2("15.3 Import Excel et détection automatique"),
    p(
      "L'import Excel d'élèves en masse prend en charge le champ enrollmentType. Le fichier Excel d'import comporte une colonne « enrollmentType » dans laquelle l'utilisateur saisit l'une des quatre valeurs (INSCRIPTION, REINSCRIPTION, TRANSFERT, PRE_INSCRIPTION). Une validation est effectuée à l'import : la valeur doit être l'une des quatre de l'énumération, et des contrôles de cohérence sont appliqués (par exemple : un élève avec un matricule déjà attribué ne peut pas être importé comme INSCRIPTION)."
    ),
    p(
      "Le module propose également une détection automatique du type d'inscription à partir de l'historique de l'élève. Si l'élève a déjà été inscrit dans l'établissement une année antérieure (présence d'un enregistrement dans la table student_enrollment avec academicYearId antérieur), le système propose automatiquement enrollmentType=REINSCRIPTION. Si l'élève n'a aucun historique, INSCRIPTION est proposé. Cette détection automatique accélère l'import et réduit les erreurs de saisie."
    ),

    h2("15.4 Impact sur la facturation et le recouvrement"),
    p(
      "Le type d'inscription a un impact direct sur la facturation : les frais d'inscription ne sont facturés qu'aux élèves de type INSCRIPTION (et éventuellement TRANSFERT selon la politique de l'établissement), tandis que les frais de réinscription ne sont facturés qu'aux élèves de type REINSCRIPTION. Cette logique est implémentée dans le service fee-structure.service.ts qui filtre les frais applicables selon le enrollmentType de l'élève. Les frais de scolarité, de cantine, de transport et d'examen sont applicables à tous les types."
    ),
    p(
      "Le type d'inscription impacte également le recouvrement : les élèves INSCRIPTION sont soumis à un suivi renforcé en début d'année (paiement intégral des frais d'inscription exigé avant l'admission définitive), tandis que les élèves REINSCRIPTION bénéficient d'une certaine souplesse (échelonnement possible selon l'historique de paiement de l'année précédente). Cette politique différenciée est paramétrable dans l'onglet Paramétrage et peut être ajustée par l'établissement selon sa politique commerciale."
    ),
    pageBreak(),
  ];
}

/** Chapitre 16 — Sécurité & RBAC (section 18). */
function chap16Security(): (Paragraph | Table)[] {
  return [
    h1("16. Sécurité & RBAC"),
    p(
      "La sécurité du module Finance repose sur quatre piliers complémentaires : le contrôle d'accès basé sur les rôles (RBAC), les guards NestJS applicatifs, les triggers PostgreSQL de niveau base de données, et l'audit log immuable. Cette approche en profondeur (defense in depth) garantit qu'aucune faille d'un seul niveau ne puisse compromettre l'intégrité financière de l'établissement. Chaque mutation financière passe par les quatre niveaux de contrôle avant d'être persistée."
    ),
    p(
      "Le module Finance manipulant des données sensibles (montants financiers, données personnelles des parents, justificatifs fiscaux), la sécurité est une exigence non négociable. Le module a été audité par des cabinets externes et respecte les recommandations de l'ANSSI (Agence Nationale de la Sécurité des Systèmes d'Information) et de la CNIL (Commission Nationale de l'Informatique et des Libertés). La présente section documente l'ensemble des dispositifs techniques mis en place."
    ),

    h2("16.1 Rôles et permissions"),
    p(
      "Le module Finance définit cinq rôles principaux avec des permissions distinctes. Le rôle DIRECTOR dispose de tous les droits (lecture, écriture, validation, suppression, paramétrage). Le rôle ADMIN a les mêmes droits que DIRECTOR sauf le paramétrage global (réservé au DIRECTOR et au PROMOTER). Le rôle ACCOUNTANT dispose des droits de saisie, de validation des paiements et des dépenses jusqu'au premier seuil, et de lecture sur l'ensemble du module. Le rôle SCHOOL_OWNER (propriétaire de l'établissement) a accès en lecture à tout le module et en écriture au paramétrage."
    ),
    p(
      "Le rôle PROMOTER (promoteur du groupe scolaire) a un accès en lecture sur l'ensemble des établissements du groupe et en écriture sur les opérations de haut niveau (validation des dépenses supérieures au second seuil, paramétrage global, exports comptables). Chaque rôle est défini dans l'énumération UserRole et appliqué via le guard @Roles de NestJS. Les permissions peuvent être affinées par établissement (par exemple : un ACCOUNTANT peut être habilité à valider des dépenses jusqu'à 200 000 FCFA dans un établissement et 100 000 FCFA dans un autre)."
    ),
    buildTable(
      ["Rôle", "Lecture", "Saisie", "Validation", "Paramétrage", "Exports"],
      [
        ["DIRECTOR", "Tout", "Tout", "Tout", "Oui", "Oui"],
        ["ADMIN", "Tout", "Tout", "Jusqu'au 2e seuil", "Non", "Oui"],
        ["ACCOUNTANT", "Tout", "Tout", "Jusqu'au 1er seuil", "Non", "Oui"],
        ["SCHOOL_OWNER", "Tout", "Non", "Non", "Oui", "Oui"],
        ["PROMOTER", "Tout (multi-tenant)", "Non", "Au-delà du 2e seuil", "Oui", "Oui"],
      ],
      [20, 22, 14, 18, 14, 12]
    ),
    spacer(),

    h2("16.2 Guards et middleware"),
    p(
      "Les guards NestJS sont la première ligne de défense applicative. Le guard JWT vérifie l'authenticité du token et extrait l'identité de l'utilisateur. Le guard @Roles vérifie que l'utilisateur a le rôle requis pour l'endpoint demandé. Le guard TenantGuard vérifie que l'utilisateur n'accède qu'aux données de son établissement (comparaison entre le tenantId du token et celui des données accédées). Le guard AcademicYearGuard vérifie que l'utilisateur n'accède qu'aux données de l'année scolaire active ou autorisée."
    ),
    p(
      "Les guards sont appliqués au niveau des contrôleurs (pour les règles globales) et au niveau des méthodes (pour les règles spécifiques à un endpoint). Un middleware de journalisation trace chaque appel d'API avec l'utilisateur, l'endpoint, les paramètres, et le temps de réponse. Un middleware de rate limiting protège contre les attaques par déni de service (100 requêtes par minute par utilisateur sur les endpoints sensibles). Enfin, un middleware CORS restreint les origines autorisées aux domaines déclarés de l'établissement."
    ),

    h2("16.3 Triggers SQL d'intégrité"),
    p(
      "Les triggers PostgreSQL sont la deuxième ligne de défense, au niveau base de données. Cinq triggers principaux protègent l'intégrité financière. Le trigger verify_integrity_hash_trigger calcule et vérifie le hash SHA-256 de chaque transaction avant insertion et mise à jour, empêchant toute modification non autorisée. Le trigger lock_transaction_after_closure empêche la modification d'une transaction appartenant à une caisse clôturée. Le trigger trg_no_delete_finance_transaction bloque la suppression d'une transaction validée. Le trigger trg_update_balance_after_tx met à jour automatiquement le solde du compte élève et de la caisse après chaque mutation. Enfin, le trigger no_delete_finance_transaction empêche la suppression en cascade des transactions via des opérations SQL brutes."
    ),
    p(
      "Ces triggers sont définis dans les migrations Prisma et appliqués automatiquement à chaque déploiement. Ils ne peuvent pas être désactivés sans une opération explicite d'administration (désactivation réservée aux opérations de maintenance très spécifiques, par exemple le nettoyage de données de test, et tracée dans l'audit log). Les triggers sont complétés par des contraintes CHECK (montant positif, statut valide, etc.) et des contraintes FOREIGN KEY strictes. Cette approche garantit que même une connexion directe à la base de données (par un administrateur système malveillant ou une attaque par injection SQL) ne puisse pas compromettre l'intégrité des données financières."
    ),
    buildTable(
      ["Trigger", "Événement", "Action", "Erreur si violation"],
      [
        ["verify_integrity_hash_trigger", "INSERT / UPDATE", "Calcule + vérifie hash SHA-256", "Oui, annule l'opération"],
        ["lock_transaction_after_closure", "UPDATE / DELETE", "Vérifie caisse non clôturée", "Oui, annule l'opération"],
        ["trg_no_delete_finance_transaction", "DELETE", "Bloque toute suppression", "Oui, annule l'opération"],
        ["trg_update_balance_after_tx", "INSERT / UPDATE / DELETE", "Recalcule solde compte + caisse", "Non (synchronisation)"],
        ["no_delete_finance_transaction", "DELETE", "Bloque suppression en cascade", "Oui, annule l'opération"],
      ],
      [30, 22, 30, 18]
    ),
    spacer(),

    h2("16.4 Audit log immuable"),
    p(
      "L'audit log est la chronologie exhaustive de toutes les actions effectuées dans le module Finance. Chaque mutation (création, modification, suppression, validation, export) génère une entrée dans la table audit_log avec : l'horodatage, l'utilisateur, le type d'action, l'objet concerné, les valeurs avant et après (diff JSON), l'adresse IP et le user-agent. L'audit log est immuable : un trigger PostgreSQL empêche toute modification ou suppression des enregistrements, y compris par un super-administrateur."
    ),
    p(
      "L'audit log est consultable dans le sous-onglet Historique audit de l'onglet Contrôle & Audit. Il est filtrable par utilisateur, par type d'action, par objet, et par période. Les exports Excel et PDF sont disponibles pour les besoins d'audit externe. L'audit log est conservé indéfiniment et n'est pas soumis à la politique de purge des autres tables : cette conservation à perpétuité est une garantie légale pour l'établissement. Une sauvegarde quotidienne de l'audit log est effectuée sur un stockage externe chiffré, ce qui protège contre la perte en cas d'incident sur la base principale."
    ),

    h2("16.5 Chiffrement et protection des données sensibles"),
    p(
      "Les données sensibles du module Finance sont protégées par chiffrement au repos et en transit. Au repos, les colonnes sensibles (clés API Fedapay, tokens webhook, justificatifs fiscaux) sont chiffrées en base via l'algorithme AES-256-GCM avec une clé maître stockée dans un coffre externe (vault). En transit, toutes les communications entre le frontend, le backend et la base de données utilisent TLS 1.3 avec certificats validés. Les fichiers uploadés (justificatifs de dépenses, reçus PDF) sont stockés chiffrés sur le système de fichiers."
    ),
    p(
      "Les mots de passe des utilisateurs sont hashés avec bcrypt (coût 12) et jamais stockés en clair. Les tokens JWT ont une durée de validité d'une heure (access token) et de sept jours (refresh token), avec rotation du refresh token à chaque utilisation. Une politique de complexité des mots de passe est appliquée (12 caractères minimum, majuscules, minuscules, chiffres, caractères spéciaux) et un historique empêche la réutilisation des cinq derniers mots de passe. L'authentification à deux facteurs (2FA) est disponible et obligatoire pour les rôles DIRECTOR, ADMIN et PROMOTER."
    ),

    h2("16.6 Conformité RGPD et protection des données personnelles"),
    p(
      "Le module Finance respecte le RGPD (Règlement Général sur la Protection des Données) et la loi béninoise 2009-09 sur la protection des données à caractère personnel. Les données personnelles des parents (nom, email, téléphone) sont collectées avec consentement explicite et utilisées uniquement pour les finalités déclarées (gestion financière, communication des reçus et relances). Les parents peuvent exercer leurs droits d'accès, de rectification et d'effacement via une procédure dédiée gérée par le DPO (Data Protection Officer) de l'établissement."
    ),
    p(
      "Une politique de rétention des données est définie : les transactions financières sont conservées dix ans (délai légal de prescription fiscale), les reçus PDF sont conservés indéfiniment, les logs de notification (email, WhatsApp, SMS) sont conservés deux ans, et les données personnelles des élèves ayant quitté l'établissement sont anonymisées après cinq ans d'inactivité. Ces durées sont paramétrables par établissement dans le respect des minima légaux. Un registre des traitements est tenu à jour et disponible pour les autorités de contrôle."
    ),

    h2("16.7 Plan de reprise d'activité"),
    p(
      "Un plan de reprise d'activité (PRA) est défini pour le module Finance. Les bases de données sont sauvegardées quotidiennement (sauvegarde complète à 02h00) et toutes les heures (sauvegarde incrémentale). Les sauvegardes sont stockées sur trois sites géographiquement distincts (un site primaire, un site secondaire à moins de 100 km, et un site tertiaire à plus de 500 km). Les sauvegardes sont chiffrées et testées mensuellement par une restauration sur un environnement de test."
    ),
    p(
      "En cas d'incident sur le site primaire, le RTO (Recovery Time Objective) est de quatre heures et le RPO (Recovery Point Objective) est d'une heure. Le basculement vers le site secondaire est automatisé via un système de réplication synchrone PostgreSQL (streaming replication). Un exercice de basculement est effectué trimestriellement pour valider l'efficacité du PRA. Les communications aux utilisateurs (parents, direction, comptables) en cas d'incident sont prédéfinies dans un plan de communication, et une page de statut publique est mise à jour en temps réel."
    ),
    pageBreak(),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSEMBLAGE DU DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

function buildDocument(): Document {
  // En-tête et pied de page pour les sections de contenu
  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { line: 240, before: 0, after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
        children: [
          new TextRun({ text: "Academia Helm — Module Finance & Économat", font: FONT, italics: true, size: 18, color: "808080" }),
        ],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 240, before: 60, after: 0 },
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
        children: [
          new TextRun({ text: "Page ", font: FONT, size: 18, color: "808080" }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "808080" }),
          new TextRun({ text: " / ", font: FONT, size: 18, color: "808080" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "808080" }),
          new TextRun({ text: "   ·   © 2026 Academia Helm", font: FONT, size: 18, color: "808080" }),
        ],
      }),
    ],
  });

  // Section 1 : page de garde (sans en-tête/pied, marges réduites)
  const coverSection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0 },
      },
    },
    children: [buildCoverPage()],
  };

  // Section 2 : table des matières (en-tête/pied, marges normales)
  const tocSection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
      },
    },
    headers: { default: header },
    footers: { default: footer },
    children: buildTOC() as Paragraph[],
  };

  // Section 3 : corps — tous les chapitres
  const bodyChildren: (Paragraph | Table)[] = [
    ...chap1Introduction(),
    ...chap2Dashboard(),
    ...chap3FeeConfig(),
    ...chap4Personnalisations(),
    ...chap5StudentAccounts(),
    ...chap6CashRegisters(),
    ...chap7Payments(),
    ...chap8Recovery(),
    ...chap9Expenses(),
    ...chap10Closure(),
    ...chap11Reports(),
    ...chap12Audit(),
    ...chap13Settings(),
    ...chap14AccountingIntegration(),
    ...chap15NewVsReturning(),
    ...chap16Security(),
  ];

  const bodySection = {
    properties: {
      type: SectionType.NEXT_PAGE,
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
        pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
      },
    },
    headers: { default: header },
    footers: { default: footer },
    children: bodyChildren,
  };

  return new Document({
    creator: "Academia Helm",
    title: "Module Finance & Économat — Documentation fonctionnelle complète",
    description: "Documentation exhaustive du module Finance d'Academia Helm — Édition 2026",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
          paragraph: { spacing: { line: 312, before: 0, after: 120 } },
        },
        heading1: {
          run: { font: FONT_BOLD, bold: true, size: 32, color: NAVY },
          paragraph: { spacing: { before: 240, after: 180, line: 312 } },
        },
        heading2: {
          run: { font: FONT_BOLD, bold: true, size: 26, color: ACCENT },
          paragraph: { spacing: { before: 220, after: 120, line: 312 } },
        },
        heading3: {
          run: { font: FONT_BOLD, bold: true, size: 24, color: ACCENT },
          paragraph: { spacing: { before: 180, after: 100, line: 312 } },
        },
      },
    },
    sections: [coverSection, tocSection, bodySection],
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("▶ Génération de la documentation Module Finance d'Academia Helm...");

  const doc = buildDocument();
  const buffer = await Packer.toBuffer(doc);

  const outDir = "/home/z/my-project/download";
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "Academia_Helm_Module_Finance_Documentation.docx");
  fs.writeFileSync(outPath, buffer);

  const sizeKb = (buffer.length / 1024).toFixed(1);
  console.log(`✅ Document généré : ${outPath}`);
  console.log(`   Taille : ${sizeKb} Ko`);
  console.log(`   Sections : 3 (couverture, table des matières, corps)`);
  console.log(`   Chapitres : 16`);
}

main().catch((err) => {
  console.error("❌ Erreur lors de la génération :", err);
  process.exit(1);
});
