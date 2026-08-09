const {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, TableLayoutType, VerticalAlign,
  SectionType,
} = require("docx");
const fs = require("fs");

// ─── Palette: IG-1 Ink Gold (Finance / Investment / Premium) ───
const P = {
  bg: "1A1A1A",
  primary: "0F2027",
  body: "1A1A1A",
  secondary: "4A6575",
  accent: "C9A84C",
  surface: "F5F2E8",
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
  tableHeaderBg: "C9A84C",
  tableHeaderText: "1A1A1A",
  tableAccentLine: "C9A84C",
  tableInnerLine: "DDD5C0",
  tableSurface: "F5F2E8",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB,
                       insideHorizontal: NB, insideVertical: NB };

// ─── Helpers ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200, line: 360, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 32, color: P.primary,
      font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 160, line: 340, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 26, color: P.primary,
      font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function body(text, opts = {}) {
  const runs = [];
  // Support **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22, color: P.body,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: 22, color: P.body,
        font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" } }));
    }
  }
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 120, ...opts.spacing },
    children: runs,
  });
}

function bullet(text) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22, color: P.body }));
    } else if (part) {
      runs.push(new TextRun({ text: part, size: 22, color: P.body }));
    }
  }
  return new Paragraph({
    indent: { left: 600, hanging: 300 },
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text: "•  ", bold: true, size: 22, color: P.accent }), ...runs],
  });
}

function emptyPara() {
  return new Paragraph({ spacing: { after: 100 }, children: [] });
}

// ─── Table builder ───
function makeTable(headers, rows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: P.tableHeaderBg },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: P.tableAccentLine },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: P.tableAccentLine },
        left: { style: BorderStyle.SINGLE, size: 2, color: P.tableInnerLine },
        right: { style: BorderStyle.SINGLE, size: 2, color: P.tableInnerLine },
      },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 280 },
        children: [new TextRun({ text: h, bold: true, size: 22, color: P.tableHeaderText,
          font: { ascii: "Calibri" } })],
      })],
    })),
  });

  const dataRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((cell, i) => new TableCell({
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? "FFFFFF" : P.tableSurface },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: P.tableInnerLine },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: P.tableInnerLine },
        left: { style: BorderStyle.SINGLE, size: 2, color: P.tableInnerLine },
        right: { style: BorderStyle.SINGLE, size: 2, color: P.tableInnerLine },
      },
      margins: { top: 50, bottom: 50, left: 100, right: 100 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER,
        spacing: { line: 280 },
        children: [new TextRun({ text: cell, size: 21, color: P.body,
          font: { ascii: "Calibri" } })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

// ─── Cover (R1 — Pure Paragraph Left) ───
function buildCover() {
  const padL = 1200, padR = 800;
  const children = [];

  // Top spacing
  children.push(new Paragraph({ spacing: { before: 4000 } }));

  // English label
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
    children: [new TextRun({ text: "A C A D E M I A   H E L M",
      size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
  }));

  // Title
  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 200, line: 920, lineRule: "atLeast" },
    children: [new TextRun({ text: "Stratégie Tarifaire", size: 80, bold: true,
      color: P.titleColor, font: { ascii: "Arial" } })],
  }));
  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 600, line: 920, lineRule: "atLeast" },
    children: [new TextRun({ text: "& Analyse de Rentabilité", size: 80, bold: true,
      color: P.titleColor, font: { ascii: "Arial" } })],
  }));

  // Subtitle
  children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: 800 },
    children: [new TextRun({ text: "Nouvelle grille tarifaire compétitive — Août 2026",
      size: 24, color: P.subtitleColor, font: { ascii: "Arial" } })],
  }));

  // Meta
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const metaLines = [
    "Préparé par : Direction Academia Helm",
    "Date : 9 août 2026",
    "Confidentiel — Usage interne",
  ];
  for (const line of metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 },
      spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.metaColor,
        font: { ascii: "Arial" } })],
    }));
  }

  // Bottom spacing
  children.push(new Paragraph({ spacing: { before: 4000 } }));

  // Footer
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: "Academia Helm", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: "www.academiahelm.com", size: 16, color: P.footerColor, font: { ascii: "Arial" } }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ─── Body Content ───
function buildBody() {
  const children = [];

  // ── 1. Tableau Final du Pricing ──
  children.push(h1("1. Tableau Final du Pricing"));
  children.push(body("Le pricing d'Academia Helm est basé sur un principe simple : **tous les modules sont inclus quel que soit le plan**. Le tarif dépend uniquement de la taille de l'école (nombre d'élèves). Cela permet à chaque école, quelle que soit sa taille, de bénéficier de l'ensemble des fonctionnalités de la plateforme sans restriction."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Plan", "Tranche d'élèves", "Mensuel (FCFA)", "Annuel (FCFA)", "Frais d'activation (FCFA)"],
    [
      ["Helm Essentiel", "1 — 50", "10 000", "100 000", "50 000"],
      ["Helm Croissance", "51 — 150", "15 000", "150 000", "75 000"],
      ["Helm Performance", "151 — 400", "25 000", "250 000", "100 000"],
      ["Helm Institution", "401 et +", "50 000", "500 000", "150 000"],
    ],
    [18, 15, 17, 17, 33]
  ));
  children.push(emptyPara());

  children.push(body("Les frais d'activation sont facturés une seule fois lors de l'inscription. L'abonnement peut être mensuel ou annuel (l'annuel offre l'équivalent de 2 mois gratuits)."));

  // ── 2. Détail des Plans ──
  children.push(h1("2. Détail des Plans"));

  children.push(h2("2.1. Helm Essentiel (1 — 50 élèves)"));
  children.push(body("Ce plan est conçu pour les petites écoles privées qui démarrent leur transformation numérique. Il offre un point d'entrée accessible tout en incluant l'ensemble des modules de la plateforme."));
  children.push(bullet("**Prix mensuel** : 10 000 FCFA"));
  children.push(bullet("**Prix annuel** : 100 000 FCFA"));
  children.push(bullet("**Frais d'activation** : 50 000 FCFA (facturés une fois)"));
  children.push(bullet("**Modules inclus** : Tous (Élèves, Pédagogie, Examens, Finance, RH/Paie, Communication, QHSE, ORION, Modules complémentaires)"));
  children.push(bullet("**Support** : par email"));
  children.push(bullet("**Cible** : Écoles de moins de 50 élèves (la majorité du marché)"));

  children.push(h2("2.2. Helm Croissance (51 — 150 élèves)"));
  children.push(body("Le plan le plus populaire, adapté aux écoles en pleine expansion qui ont besoin d'outils avancés pour gérer leur croissance. C'est dans cette tranche que se situe le cœur de marché rentable."));
  children.push(bullet("**Prix mensuel** : 15 000 FCFA"));
  children.push(bullet("**Prix annuel** : 150 000 FCFA"));
  children.push(bullet("**Frais d'activation** : 75 000 FCFA"));
  children.push(bullet("**Support** : prioritaire email + WhatsApp"));
  children.push(bullet("**Bonus** : Tableaux de bord ORION inclus"));
  children.push(bullet("**Cible** : Écoles de 51 à 150 élèves (croissance)"));

  children.push(h2("2.3. Helm Performance (151 — 400 élèves)"));
  children.push(body("Pour les grandes écoles qui veulent un pilotage avancé et l'analytics prédictif. Ce plan inclut un support dédié 7j/7 et des fonctionnalités avancées d'analyse."));
  children.push(bullet("**Prix mensuel** : 25 000 FCFA"));
  children.push(bullet("**Prix annuel** : 250 000 FCFA"));
  children.push(bullet("**Frais d'activation** : 100 000 FCFA"));
  children.push(bullet("**Support** : dédié 7j/7"));
  children.push(bullet("**Bonus** : ORION + alertes intelligentes, sauvegarde automatique avec restauration 1h"));
  children.push(bullet("**Cible** : Écoles de 151 à 400 élèves"));

  children.push(h2("2.4. Helm Institution (401 élèves et +)"));
  children.push(body("Pour les réseaux d'écoles, les complexes scolaires multi-campus et les grands établissements qui nécessitent une gestion avancée multi-sites."));
  children.push(bullet("**Prix mensuel** : 50 000 FCFA"));
  children.push(bullet("**Prix annuel** : 500 000 FCFA"));
  children.push(bullet("**Frais d'activation** : 150 000 FCFA"));
  children.push(bullet("**Support** : account manager dédié"));
  children.push(bullet("**Bonus** : Gestion multi-écoles, formation sur site, sauvegarde temps réel + réplication"));
  children.push(bullet("**Cible** : Réseaux d'écoles, complexes multi-campus (401+ élèves)"));

  // ── 3. Option Bilingue ──
  children.push(h1("3. Option Bilingue (FR/EN)"));
  children.push(body("Pour les écoles bilingues qui souhaitent activer le mode bilingue (français/anglais) avec pistes linguistiques séparées, une option payante s'ajoute au plan de base."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Option", "Mensuel (FCFA)", "Annuel (FCFA)", "Description"],
    [
      ["Bilingue FR/EN", "5 000", "50 000", "Pistes linguistiques séparées, bulletins bilingues, communication multilingue"],
    ],
    [25, 15, 15, 45]
  ));
  children.push(emptyPara());
  children.push(body("Cette option est disponible quel que soit le plan choisi (Helm Essentiel, Croissance, Performance ou Institution). Elle est facturée en sus de l'abonnement principal."));

  // ── 4. Tarification SMS et Email ──
  children.push(h1("4. Tarification SMS et Email"));
  children.push(body("Les frais de communication (SMS et email) sont **à la charge de l'école** et facturés en sus selon la consommation réelle. Academia Helm ne prend pas de marge sur ces services : les coûts sont facturés au prix coûtant."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Canal", "Facturation", "À la charge de", "Détail"],
    [
      ["SMS", "Au volume (par SMS envoyé)", "École", "Tarif variable selon le pays de destination"],
      ["Email", "Au volume (par email envoyé)", "École", "Facturé selon la consommation via le prestataire"],
      ["WhatsApp", "Gratuit", "Inclus", "Aucun frais — inclus dans tous les plans"],
    ],
    [15, 25, 20, 40]
  ));
  children.push(emptyPara());
  children.push(body("L'école peut suivre sa consommation de SMS et email en temps réel depuis le module Communication de la plateforme. Un seuil d'alerte peut être configuré pour éviter les dépassements de budget."));

  // ── 5. Analyse de Rentabilité ──
  children.push(h1("5. Analyse de Rentabilité"));

  children.push(h2("5.1. Coûts d'Infrastructure (Version Pro)"));
  children.push(body("L'infrastructure d'Academia Helm repose sur des services cloud professionnels (Version Pro) qui garantissent performance, scalabilité et disponibilité. Voici les coûts mensuels et annuels de chaque service."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Service", "Rôle", "Coût mensuel (€)", "Coût annuel (€)", "Coût annuel (FCFA)"],
    [
      ["Railway (Pro)", "Backend NestJS", "25 €", "300 €", "~197 000"],
      ["Neon (Pro)", "PostgreSQL Database", "25 €", "300 €", "~197 000"],
      ["Vercel (Pro)", "Frontend Next.js", "20 €", "240 €", "~157 000"],
      ["Cloudflare R2", "Stockage fichiers", "10 €", "120 €", "~79 000"],
      ["TOTAL", "", "80 €", "960 €", "~630 000"],
    ],
    [18, 22, 15, 15, 30]
  ));
  children.push(emptyPara());
  children.push(body("**Note** : Le taux de change utilisé est 1 € = 656 FCFA (taux moyen 2026). Les coûts peuvent varier légèrement selon l'usage (bande passante, stockage, compute)."));

  children.push(h2("5.2. Calcul du Point Mort (Break-Even)"));
  children.push(body("Le point mort correspond au nombre minimum d'écoles abonnées nécessaire pour couvrir les coûts d'infrastructure annuels (630 000 FCFA)."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Plan", "Revenu annuel (FCFA)", "Écoles pour couvrir 630 000 FCFA"],
    [
      ["Helm Essentiel", "100 000", "7 écoles"],
      ["Helm Croissance", "150 000", "5 écoles"],
      ["Helm Performance", "250 000", "3 écoles"],
      ["Helm Institution", "500 000", "2 écoles"],
    ],
    [30, 35, 35]
  ));
  children.push(emptyPara());
  children.push(body("**Conclusion** : Dès la 7ème école (au plan le moins cher), Academia Helm est rentable. Avec un mix de plans, le point mort est atteint encore plus rapidement (ex : 3 écoles Helm Performance suffisent). Au-delà du point mort, chaque école supplémentaire génère une marge brute supérieure à 90%."));

  children.push(h2("5.3. Scénario Réaliste à 12 Mois"));
  children.push(body("Voici une projection réaliste de la croissance sur 12 mois, basée sur les statistiques du marché (la majorité des écoles privées de la région ont moins de 100 élèves) et un rythme d'acquisition progressif."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Période", "Écoles", "Mix plans", "Revenu annuel cumulé (FCFA)", "Coûts annuels (FCFA)", "Marge (FCFA)"],
    [
      ["Mois 1-3", "3 écoles", "3 × Essentiel (30j offerts)", "0 (essai)", "158 000", "-158 000"],
      ["Mois 4-6", "5 écoles", "3 × Essentiel + 2 × Croissance", "600 000", "315 000", "+285 000"],
      ["Mois 7-9", "10 écoles", "5 × Ess. + 4 × Crois. + 1 × Perf.", "1 350 000", "473 000", "+877 000"],
      ["Mois 10-12", "20 écoles", "10 × Ess. + 7 × Crois. + 2 × Perf. + 1 × Inst.", "3 000 000", "630 000", "+2 370 000"],
    ],
    [12, 10, 28, 18, 12, 20]
  ));
  children.push(emptyPara());
  children.push(body("À la fin de la première année, avec seulement 20 écoles, Academia Helm génère une marge nette positive de **2 370 000 FCFA** (environ 3 600 €)."));

  children.push(h2("5.4. Projections à Moyen Terme (Années 2 et 3)"));
  children.push(emptyPara());

  children.push(makeTable(
    ["Étape", "Écoles", "Revenu annuel (FCFA)", "Coûts (FCFA)", "Marge nette (FCFA)"],
    [
      ["Fin Année 1", "20 écoles", "~3 000 000", "~630 000", "~2 370 000"],
      ["Fin Année 2", "50 écoles", "~8 000 000", "~1 000 000", "~7 000 000"],
      ["Fin Année 3", "100 écoles", "~18 000 000", "~1 500 000", "~16 500 000"],
    ],
    [15, 15, 25, 20, 25]
  ));
  children.push(emptyPara());
  children.push(body("À partir de 50 écoles (Année 2), les coûts d'infrastructure augmentent (passage à des plans supérieurs pour Railway et Neon), mais la marge nette reste largement positive grâce à l'effet d'échelle."));

  // ── 6. Comparaison Concurrentiel ──
  children.push(h1("6. Comparaison avec la Concurrence"));
  children.push(body("Le principal concurrent direct sur le marché est **Logeco School** (logeco.africa), présent depuis 2022 avec 1 000+ écoles et 150 000+ élèves."));
  children.push(emptyPara());

  children.push(makeTable(
    ["Critère", "Logeco School", "Academia Helm"],
    [
      ["Plan gratuit", "0-50 élèves (0 FCFA)", "Pas de plan gratuit"],
      ["Plan entrée", "51-400 → 50 000 FCFA/an", "1-50 → 100 000 FCFA/an"],
      ["Plan milieu", "(même plan)", "51-150 → 150 000 FCFA/an"],
      ["Plan haut", "401-500 → 75 000 FCFA/an", "151-400 → 250 000 FCFA/an"],
      ["Plan premium", "500+ → 100 000 FCFA/an", "401+ → 500 000 FCFA/an"],
      ["Application", "Desktop uniquement", "Web + Mobile + Desktop"],
      ["Modules", "4 (élèves, notes, frais, sync)", "9+ (complets)"],
      ["IA", "Non", "Oui (Sarah + ORION)"],
      ["RH / Paie", "Non", "Oui (CNSS + IFU + IRPP)"],
      ["Communication", "Non", "SMS + WhatsApp + Email"],
      ["Multi-pays", "Non", "Bénin, Togo, CI, Cameroun"],
    ],
    [25, 35, 40]
  ));
  children.push(emptyPara());
  children.push(body("Academia Helm ne concurrence pas Logeco sur le prix, mais sur la **valeur**. Pour 2x le prix de Logeco, une école obtient 10x plus de fonctionnalités, un accès multi-appareils (web + mobile + desktop), une IA intégrée, et la gestion RH/Paie complète."));

  // ── 7. Conclusion ──
  children.push(h1("7. Conclusion"));
  children.push(body("Le nouveau pricing d'Academia Helm est conçu pour être à la fois **compétitif** face aux acteurs du marché et **rentable** pour assurer la pérennité de la plateforme."));
  children.push(emptyPara());

  children.push(bullet("**Rentabilité immédiate** : Le point mort est atteint dès la 7ème école (plan Essentiel) ou la 3ème école (plan Performance)."));
  children.push(bullet("**Marge brute élevée** : Au-delà du point mort, chaque école supplémentaire génère une marge supérieure à 90% (les coûts variables étant quasi-nuls en SaaS)."));
  children.push(bullet("**Prix adaptés au marché** : Les tranches (1-50, 51-150, 151-400, 401+) correspondent aux réalités des écoles privées africaines, dont la majorité ont moins de 100 élèves."));
  children.push(bullet("**Tous les modules inclus** : Contrairement à la concurrence, Academia Helm ne bride aucune fonctionnalité selon le plan. Une petite école a accès aux mêmes outils qu'un grand réseau."));
  children.push(bullet("**Option bilingue rentable** : À 5 000 FCFA/mois, le bilingue est accessible et génère un revenu additionnel significatif pour les écoles qui en ont besoin."));
  children.push(bullet("**SMS/Email à la charge de l'école** : Academia Helm ne subit pas les coûts variables de communication — ils sont facturés à l'école au prix coûtant."));
  children.push(bullet("**WhatsApp gratuit** : Un avantage concurrentiel majeur — la communication WhatsApp est incluse sans frais dans tous les plans."));
  children.push(emptyPara());

  children.push(body("Avec une projection de 20 écoles à la fin de la première année (marge de 2,37 millions FCFA) et 100 écoles à la fin de la troisième année (marge de 16,5 millions FCFA), Acadedia Helm est sur une trajectoire de croissance rentable et durable. Le positionnement premium (fonctionnalités complètes vs Logeco) justifie un prix supérieur, tandis que les tranches d'entrée accessibles (Helm Essentiel à 10 000 FCFA/mois) permettent de capturer le marché des petites écoles."));

  return children;
}

// ─── Assemble Document ───
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 22, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    // Cover section
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    // Body section
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({
              text: "Academia Helm — Stratégie Tarifaire",
              size: 16, color: P.secondary, font: { ascii: "Calibri" },
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Page ", size: 18, color: P.secondary }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: P.secondary }),
              new TextRun({ text: " / ", size: 18, color: P.secondary }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: P.secondary }),
            ],
          })],
        }),
      },
      children: buildBody(),
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const outputPath = "/home/z/my-project/download/Strategie_Tarifaire_Academia_Helm.docx";
  fs.writeFileSync(outputPath, buf);
  console.log("✅ Document généré : " + outputPath);
  console.log("   Taille : " + (buf.length / 1024).toFixed(1) + " KB");
});
