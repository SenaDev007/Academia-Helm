/**
 * Générateur du document de tarification Academia Helm
 * Format Word (.docx) avec tableaux détaillés
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, ShadingType,
  PageOrientation, WidthType, convertInchesToTwip,
  Header, Footer, PageNumber, NumberFormat,
} = require('docx');
const fs = require('fs');

// === Palette ===
const C = {
  primary: '0A1628',    // Navy foncé
  body: '1A2B40',       // Gris-bleu foncé
  secondary: '6878A0',  // Gris-bleu moyen
  accent: '2563EB',     // Bleu vif
  surface: 'F0F4FF',    // Bleu très clair
  white: 'FFFFFF',
  greenD: '059669',
  greenL: 'D1FAE5',
  amberD: 'D97706',
  amberL: 'FEF3C7',
  redD: 'DC2626',
  redL: 'FEE2E2',
  grayL: 'F3F4F6',
  grayD: '4B5563',
};

// === Helpers ===
function p(text, opts = {}) {
  return new Paragraph({
    spacing: { line: 312, after: opts.after || 120, before: opts.before || 0 },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    indent: opts.indent !== false ? { firstLine: 480 } : undefined,
    children: [new TextRun({
      text,
      font: { name: 'Calibri' },
      size: opts.size || 22,
      color: opts.color || C.body,
      bold: opts.bold || false,
      italics: opts.italics || false,
    })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, font: { name: 'Calibri' }, size: 32, color: C.primary, bold: true })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 150 },
    children: [new TextRun({ text, font: { name: 'Calibri' }, size: 28, color: C.primary, bold: true })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: { name: 'Calibri' }, size: 24, color: C.accent, bold: true })],
  });
}

function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { type: ShadingType.CLEAR, fill: opts.shading } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { line: 276 },
      indent: undefined,
      children: [new TextRun({
        text: String(text),
        font: { name: 'Calibri' },
        size: opts.size || 20,
        color: opts.color || C.body,
        bold: opts.bold || false,
      })],
    })],
  });
}

function headerCell(text, width) {
  return cell(text, { shading: C.accent, color: C.white, bold: true, align: AlignmentType.CENTER, width });
}

function tableRow(cells, opts = {}) {
  return new TableRow({
    cantSplit: true,
    tableHeader: opts.header || false,
    children: cells,
  });
}

function makeTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: C.secondary },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: C.secondary },
      left: { style: BorderStyle.SINGLE, size: 1, color: C.secondary },
      right: { style: BorderStyle.SINGLE, size: 1, color: C.secondary },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
    },
  });
}

// === DOCUMENT ===
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: C.body } },
    },
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
        margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Academia Helm — Tarification SaaS', font: 'Calibri', size: 18, color: C.secondary, italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', font: 'Calibri', size: 18, color: C.secondary }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 18, color: C.secondary }),
            new TextRun({ text: ' / ', font: 'Calibri', size: 18, color: C.secondary }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 18, color: C.secondary }),
          ],
        })],
      }),
    },
    children: [
      // === PAGE DE GARDE ===
      new Paragraph({ spacing: { before: 3000 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
        children: [new TextRun({ text: 'ACADEMIA HELM', font: 'Calibri', size: 52, color: C.primary, bold: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'Plateforme SaaS de gestion scolaire', font: 'Calibri', size: 28, color: C.accent })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
        children: [new TextRun({ text: 'YEHI OR Tech', font: 'Calibri', size: 22, color: C.secondary, italics: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: 'DOCUMENT DE TARIFICATION', font: 'Calibri', size: 36, color: C.primary, bold: true })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: 'Modèle économique, coûts d\'infrastructure et grille tarifaire', font: 'Calibri', size: 24, color: C.secondary })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 2000 },
        children: [new TextRun({ text: 'Version 1.0 — Juillet 2026', font: 'Calibri', size: 20, color: C.grayD })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '— Document confidentiel —', font: 'Calibri', size: 18, color: C.secondary, italics: true })],
      }),
      new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),

      // === SOMMAIRE ===
      h1('Sommaire'),
      p('1. Contexte et objectifs', { indent: false }),
      p('2. Coûts d\'infrastructure (mode Pro)', { indent: false }),
      p('3. Estimation des données par école', { indent: false }),
      p('4. Add-ons facturables (SMS Twilio, Email Resend, WhatsApp gratuit, Bilingue)', { indent: false }),
      p('5. Grille tarifaire — 3 plans (SEED, GROW, LEAD)', { indent: false }),
      p('6. Projections de rentabilité', { indent: false }),
      p('7. Politique de facturation', { indent: false }),
      p('8. Positionnement concurrentiel', { indent: false }),
      p('9. Recommandations stratégiques', { indent: false }),

      // === 1. CONTEXTE ===
      h1('1. Contexte et objectifs'),
      p('Ce document détaille la stratégie de tarification de la plateforme Academia Helm, un SaaS multi-tenant de gestion scolaire développé par YEHI OR Tech. La plateforme est hébergée sur une infrastructure cloud composée de Neon PostgreSQL (base de données), Fly.io (backend API NestJS), Vercel Pro (frontend Next.js), OVH (nom de domaine), Twilio (SMS transactionnels) et Resend (emails transactionnels).'),
      p('Les écoles clientes actuelles incluent le CSPEB (96 élèves) et CSP Mon Avenir Plus N\'Dali (698 élèves pour l\'année 2025-2026). L\'objectif est de définir une grille tarifaire qui couvre tous les coûts d\'infrastructure en mode Pro (payant), rémunère de façon pérenne l\'exploitant de la plateforme, tout en restant compétitive sur le marché béninois de la gestion scolaire.'),
      p('Tous les plans donnent accès à l\'intégralité des modules et fonctionnalités de la plateforme. La seule limitation entre les plans est le nombre d\'élèves. Les add-ons (SMS, emails transactionnels, option bilingue) sont facturés séparément.'),

      // === 2. COÛTS D'INFRASTRUCTURE ===
      h1('2. Coûts d\'infrastructure (mode Pro)'),
      p('Tous les coûts sont calculés en considérant que nous sommes en mode payant (Pro) chez chaque fournisseur, afin de garantir des performances optimales et un support technique.'),

      h2('2.1 Coûts fixes mensuels'),
      makeTable([
        tableRow([
          headerCell('Service', 22),
          headerCell('Plan', 15),
          headerCell('Coût USD/mois', 15),
          headerCell('Coût FCFA/mois', 15),
          headerCell('Justification', 33),
        ], { header: true }),
        tableRow([
          cell('Neon PostgreSQL'),
          cell('Pro'),
          cell('19 $', { align: AlignmentType.CENTER }),
          cell('11 500', { align: AlignmentType.CENTER }),
          cell('Inclus 10 GB stockage + compute auto-scaling. Couvre jusqu\'à ~30 écoles (~6 GB). Au-delà, passer au plan Scale (49 $/mois).'),
        ]),
        tableRow([
          cell('Fly.io (backend API)'),
          cell('Pro'),
          cell('20 $', { align: AlignmentType.CENTER }),
          cell('12 000', { align: AlignmentType.CENTER }),
          cell('1 VM dedicated-cpu 1GB avec auto-scaling. Suffisant pour ~30 écoles actives. Inclut health checks et déploiements zero-downtime.'),
          ], { shading: C.surface }),
        tableRow([
          cell('Vercel (frontend)'),
          cell('Pro'),
          cell('20 $', { align: AlignmentType.CENTER }),
          cell('12 000', { align: AlignmentType.CENTER }),
          cell('Plan Pro obligatoire pour sous-domaines custom, fonctions serverless et analytics. Inclus 1 TB bande passante.'),
        ]),
        tableRow([
          cell('OVH (nom de domaine)'),
          cell('Perso',
          { align: AlignmentType.CENTER }),
          cell('2 $', { align: AlignmentType.CENTER }),
          cell('1 000', { align: AlignmentType.CENTER }),
          cell('Nom de domaine academiahelm.com (renouvellement annuel ~24 $ amortis sur 12 mois).'),
          ], { shading: C.surface }),
        tableRow([
          cell('Twilio (SMS transactionnels)'),
          cell('Usage-based'),
          cell('~10 $', { align: AlignmentType.CENTER }),
          cell('6 000', { align: AlignmentType.CENTER }),
          cell('Passerelle SMS internationale. Coût unitaire ~20 FCFA/SMS au Bénin. Facturé à l’usage — estimation basée sur ~300 SMS/mois initialement.'),
        ]),
        tableRow([
          cell('Resend (emails transactionnels)'),
          cell('Pro', { align: AlignmentType.CENTER }),
          cell('20 $', { align: AlignmentType.CENTER }),
          cell('12 000', { align: AlignmentType.CENTER }),
          cell('Service d’envoi d’emails transactionnels (reçus PDF, notifications, rapports). Nom de domaine vérifié. Inclus 50 000 emails/mois.'),
          ], { shading: C.surface }),
        tableRow([
          cell('Total fixe', { bold: true, shading: C.accent, color: C.white }),
          cell('—', { bold: true, shading: C.accent, color: C.white, align: AlignmentType.CENTER }),
          cell('91 $', { bold: true, shading: C.accent, color: C.white, align: AlignmentType.CENTER }),
          cell('53 500', { bold: true, shading: C.accent, color: C.white, align: AlignmentType.CENTER }),
          cell('Coût fixe mensuel de base, indépendant du nombre d\'écoles (jusqu\'à ~30 écoles). Le coût Twilio varie selon le volume réel de SMS envoyés.', { bold: true, shading: C.accent, color: C.white }),
        ]),
      ]),

      h2('2.2 Coût marginal par école'),
      p('Au-delà du coût fixe, chaque école ajoutée génère un coût marginal négligeable (stockage DB + bande passante). Le seuil de passage au plan Neon Scale (49 $/mois) est atteint autour de 30 écoles.'),
      makeTable([
        tableRow([
          headerCell('Palier', 20),
          headerCell('Écoles', 12),
          headerCell('Élèves totaux', 15),
          headerCell('Taille DB', 15),
          headerCell('Neon', 13),
          headerCell('Total infra/mois', 25),
        ], { header: true }),
        tableRow([
          cell('Actuel'),
          cell('2', { align: AlignmentType.CENTER }),
          cell('~800', { align: AlignmentType.CENTER }),
          cell('~300 MB', { align: AlignmentType.CENTER }),
          cell('Pro (19 $)', { align: AlignmentType.CENTER }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Court terme', { shading: C.surface }),
          cell('5', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~2 500', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~800 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('Pro (19 $)', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Moyen terme'),
          cell('15', { align: AlignmentType.CENTER }),
          cell('~7 500', { align: AlignmentType.CENTER }),
          cell('~3 GB', { align: AlignmentType.CENTER }),
          cell('Pro (19 $)', { align: AlignmentType.CENTER }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Long terme', { shading: C.surface }),
          cell('30', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~15 000', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~6 GB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('Pro (19 $)', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Scale'),
          cell('50+', { align: AlignmentType.CENTER }),
          cell('~25 000+', { align: AlignmentType.CENTER }),
          cell('~12 GB+', { align: AlignmentType.CENTER }),
          cell('Scale (69 $)', { align: AlignmentType.CENTER }),
          cell('82 500 FCFA', { align: AlignmentType.CENTER }),
        ]),
      ]),

      h2('2.3 Frais de transaction FedaPay'),
      p('FedaPay prélève 1,8 % par transaction de paiement en ligne (Mobile Money, carte bancaire). Ce frais est prélevé directement sur le paiement — ce n\'est pas un coût pour YEHI OR Tech ni pour l\'école, c\'est transparent pour les deux parties. Exemple : un parent paie 50 000 FCFA → l\'école reçoit 49 100 FCFA.'),

      // === 3. ESTIMATION DES DONNÉES ===
      h1('3. Estimation des données par école'),
      p('Chaque école génère des données dans tous les modules de l\'application. Voici une estimation du volume de données par taille d\'école, basée sur les données réelles de Mon Avenir Plus (698 élèves).'),

      h2('3.1 Volume de données par taille d\'école'),
      makeTable([
        tableRow([
          headerCell('Type de donnée', 30),
          headerCell('100 élèves', 15),
          headerCell('300 élèves', 15),
          headerCell('700 élèves', 15),
          headerCell('1 500 élèves', 25),
        ], { header: true }),
        tableRow([
          cell('Élèves (students)'),
          cell('~5 MB', { align: AlignmentType.CENTER }),
          cell('~15 MB', { align: AlignmentType.CENTER }),
          cell('~35 MB', { align: AlignmentType.CENTER }),
          cell('~75 MB', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Comptes + transactions (finance)', { shading: C.surface }),
          cell('~10 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~30 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~70 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~150 MB', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Examens, notes, bulletins'),
          cell('~8 MB', { align: AlignmentType.CENTER }),
          cell('~25 MB', { align: AlignmentType.CENTER }),
          cell('~60 MB', { align: AlignmentType.CENTER }),
          cell('~130 MB', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Personnel, RH, paie', { shading: C.surface }),
          cell('~3 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~8 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~15 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~30 MB', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Documents, médias, uploads'),
          cell('~15 MB', { align: AlignmentType.CENTER }),
          cell('~45 MB', { align: AlignmentType.CENTER }),
          cell('~100 MB', { align: AlignmentType.CENTER }),
          cell('~200 MB', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Communication, notifications', { shading: C.surface }),
          cell('~2 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~6 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~15 MB', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('~30 MB', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Modules supplémentaires (boutique, cantine, etc.)'),
          cell('~5 MB', { align: AlignmentType.CENTER }),
          cell('~15 MB', { align: AlignmentType.CENTER }),
          cell('~35 MB', { align: AlignmentType.CENTER }),
          cell('~75 MB', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Total estimé', { bold: true, shading: C.accent, color: C.white }),
          cell('~48 MB', { bold: true, align: AlignmentType.CENTER, shading: C.accent, color: C.white }),
          cell('~144 MB', { bold: true, align: AlignmentType.CENTER, shading: C.accent, color: C.white }),
          cell('~330 MB', { bold: true, align: AlignmentType.CENTER, shading: C.accent, color: C.white }),
          cell('~690 MB', { bold: true, align: AlignmentType.CENTER, shading: C.accent, color: C.white }),
        ]),
      ]),

      p('Avec le plan Neon Pro (10 GB inclus), on peut accueillir environ 30 écoles de taille moyenne (700 élèves) avant d\'atteindre la limite. Au-delà, le plan Neon Scale (49 $/mois, 50 GB) couvre jusqu\'à ~150 écoles.'),

      // === 4. ADD-ONS ===
      h1('4. Add-ons facturables'),
      p('Certains services ont un coût variable qui dépend de l\'usage réel. Ces services sont facturés en complément de l\'abonnement, sous forme d\'add-ons.'),

      h2('4.1 SMS transactionnels (Twilio)'),
      p('Les SMS sont envoyés via Twilio, passerelle SMS internationale dont le dossier d\'enregistrement est en cours de validation. Le coût unitaire facturé par Twilio pour un SMS envoyé au Bénin est de ~20 FCFA par SMS. La plateforme Academia Helm envoie des SMS pour : reçus de paiement, rappels de recouvrement, notifications d\'absence, convocations, alertes de blocage de compte élève.', { indent: false }),
      p('Volume estimé par école : ~2 SMS/élève/mois (reçus de paiement + rappels éventuels). Une école de 100 élèves génère ~200 SMS/mois ; une école de 700 élèves génère ~1 400 SMS/mois ; une école de 1 500 élèves génère ~3 000 SMS/mois.', { indent: false }),
      p('Tarification facturée à l\'école : 30 FCFA par SMS envoyé (marge de 50 % sur le coût Twilio). Le compteur est relevé en fin de mois et la facture est émise avec l\'abonnement mensuel.', { indent: false }),

      makeTable([
        tableRow([
          headerCell('Élément', 40),
          headerCell('Détail', 30),
          headerCell('Coût/Montant', 30),
        ], { header: true }),
        tableRow([
          cell('Coût unitaire SMS (Twilio)'),
          cell('Par SMS envoyé'),
          cell('20 FCFA/SMS', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Volume estimé (100 élèves)', { shading: C.surface }),
          cell('~200 SMS/mois (reçus + rappels + absences)'),
          cell('~4 000 FCFA/mois', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Volume estimé (700 élèves)'),
          cell('~1 400 SMS/mois'),
          cell('~28 000 FCFA/mois', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Volume estimé (1 500 élèves)', { shading: C.surface }),
          cell('~3 000 SMS/mois'),
          cell('~60 000 FCFA/mois', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Facturation à l\'école', { bold: true }),
          cell('Marge de 50 % sur le coût Twilio'),
          cell('30 FCFA/SMS facturé', { align: AlignmentType.CENTER, bold: true }),
        ]),
        tableRow([
          cell('Revenu net pour YEHI OR Tech', { bold: true, shading: C.greenL }),
          cell('Par SMS (après coût Twilio)'),
          cell('10 FCFA/SMS', { align: AlignmentType.CENTER, bold: true, shading: C.greenL }),
        ]),
        tableRow([
          cell('Forfait SMS illimité (optionnel)', { bold: true, shading: C.surface }),
          cell('Pour écoles > 5 000 SMS/mois — tarif préférentiel'),
          cell('100 000 FCFA/mois', { align: AlignmentType.CENTER, bold: true, shading: C.surface }),
        ]),
      ]),

      h2('4.2 Emails transactionnels (Resend)'),
      p('Les emails (reçus PDF de paiement, notifications de paiement en ligne, rapports mensuels, convocations, alertes de blocage) sont envoyés via Resend, service d\'envoi d\'emails transactionnels. Le nom de domaine academiahelm.com est vérifié et configuré sur Resend (SPF, DKIM, DMARC).', { indent: false }),
      p('Volume estimé par école : ~1 email/élève/mois (reçu de paiement + notifications). Une école de 100 élèves génère ~100 emails/mois ; une école de 700 élèves génère ~700 emails/mois ; une école de 1 500 élèves génère ~1 500 emails/mois.', { indent: false }),
      p('Tarification facturée à l\'école : 5 000 FCFA/mois forfait (inclut jusqu\'à 5 000 emails/mois par école). Au-delà de 5 000 emails/mois, tarif dégressif de 1 FCFA/email supplémentaire.', { indent: false }),

      makeTable([
        tableRow([
          headerCell('Élément', 40),
          headerCell('Détail', 30),
          headerCell('Coût/Montant', 30),
        ], { header: true }),
        tableRow([
          cell('Coût infrastructure Resend'),
          cell('Plan Pro — 50 000 emails/mois inclus'),
          cell('20 $/mois (~12 000 FCFA)', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Volume estimé (100 élèves)', { shading: C.surface }),
          cell('~100 emails/mois'),
          cell('~600 FCFA/mois (coût réel)', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Volume estimé (700 élèves)'),
          cell('~700 emails/mois'),
          cell('~4 200 FCFA/mois (coût réel)'),
        ]),
        tableRow([
          cell('Volume estimé (1 500 élèves)', { shading: C.surface }),
          cell('~1 500 emails/mois'),
          cell('~9 000 FCFA/mois (coût réel)', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Facturation à l\'école', { bold: true }),
          cell('Forfait mensuel (jusqu\'à 5 000 emails/mois)'),
          cell('5 000 FCFA/mois', { align: AlignmentType.CENTER, bold: true }),
        ]),
        tableRow([
          cell('Revenu net pour YEHI OR Tech', { bold: true, shading: C.greenL }),
          cell('Marge dégressive selon le volume'),
          cell('Variable (jusqu\'à ~5 000 FCFA/mois/école)', { align: AlignmentType.CENTER, bold: true, shading: C.greenL }),
        ]),
      ]),

      h2('4.3 Notifications WhatsApp (gratuit)'),
      p('Les notifications WhatsApp (reçus de paiement, rappels, convocations) sont envoyées directement depuis le compte WhatsApp de l\'école, configuré sur le téléphone ou l\'ordinateur de l\'établissement. Aucune API payante n\'est utilisée pour WhatsApp — c\'est une fonctionnalité gratuite offerte à toutes les écoles.', { indent: false }),
      p('Fonctionnement : l\'utilisateur (secrétaire, comptable, directeur) clique sur le bouton « Envoyer sur WhatsApp » dans la plateforme ; le navigateur ouvre l\'application WhatsApp Web (ou l\'app mobile) avec le message pré-rempli et le numéro du destinataire. L\'envoi est alors effectué manuellement par l\'utilisateur depuis le compte WhatsApp de l\'école.', { indent: false }),
      p('Avantages :', { indent: false }),
      p('• Aucun coût d\'API pour YEHI OR Tech ni pour l\'école', { indent: false }),
      p('• Aucune limite de volume (contrairement aux APIs WhatsApp Business qui facturent par message)', { indent: false }),
      p('• L\'école garde le contrôle total de son numéro WhatsApp (pas de risque de bannissement par API)', { indent: false }),
      p('• Le message est envoyé depuis le numéro officiel de l\'école (reconnaissance par les parents)', { indent: false }),
      p('Limitations :', { indent: false }),
      p('• L\'envoi est manuel (un clic par message) — pas d\'envoi automatique en masse programmé', { indent: false }),
      p('• Nécessite que l\'appareil (téléphone ou ordinateur) soit connecté à Internet', { indent: false }),
      p('• Pas de tracking de livraison (l\'école voit la double flèche bleue dans WhatsApp mais la plateforme ne reçoit pas de webhook de statut)', { indent: false }),
      makeTable([
        tableRow([
          headerCell('Élément', 40),
          headerCell('Détail', 30),
          headerCell('Coût/Montant', 30),
        ], { header: true }),
        tableRow([
          cell('Coût infrastructure WhatsApp'),
          cell('Aucun — utilise le compte WhatsApp de l\'école'),
          cell('0 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Facturation à l\'école', { bold: true }),
          cell('Gratuit — inclus dans tous les plans'),
          cell('0 FCFA', { align: AlignmentType.CENTER, bold: true }),
        ]),
        tableRow([
          cell('Volume illimité', { bold: true, shading: C.greenL }),
          cell('Aucune limite — envoi manuel par clic'),
          cell('0 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.greenL }),
        ]),
      ]),

      h2('4.4 Option Bilingue'),
      p('L\'option bilingue (français + anglais) permet à l\'école de proposer la plateforme en deux langues. Cette option implique un surcoût de configuration et de maintenance des traductions. Elle est facturée annuellement.'),
      makeTable([
        tableRow([
          headerCell('Élément', 40),
          headerCell('Détail', 30),
          headerCell('Montant', 30),
        ], { header: true }),
        tableRow([
          cell('Frais d\'activation bilingue'),
          cell('Configuration initiale (unique)'),
          cell('50 000 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Surcoût annuel bilingue', { bold: true }),
          cell('Maintenance des traductions + support'),
          cell('50 000 FCFA/an', { align: AlignmentType.CENTER, bold: true }),
        ]),
        tableRow([
          cell('Revenu net pour YEHI OR Tech', { bold: true, shading: C.greenL }),
          cell('Coût marginal ~0 (configuration automatisée)'),
          cell('~50 000 FCFA/an', { align: AlignmentType.CENTER, bold: true, shading: C.greenL }),
        ]),
      ]),

      // === 5. GRILLE TARIFAIRE ===
      h1('5. Grille tarifaire — 3 plans'),
      p('Tous les plans donnent accès à TOUS les modules et TOUTES les fonctionnalités. La seule différence est la limite du nombre d\'élèves. Les add-ons (SMS, emails, bilingue) sont facturés séparément.'),

      h2('5.1 Tableau récapitulatif'),
      makeTable([
        tableRow([
          headerCell('', 20),
          headerCell('SEED', 26),
          headerCell('GROW', 27),
          headerCell('LEAD', 27),
        ], { header: true }),
        tableRow([
          cell('Limite élèves', { bold: true }),
          cell('≤ 200', { align: AlignmentType.CENTER, bold: true }),
          cell('≤ 700', { align: AlignmentType.CENTER, bold: true }),
          cell('≤ 1 500', { align: AlignmentType.CENTER, bold: true }),
        ]),
        tableRow([
          cell('Frais d\'installation', { bold: true, shading: C.surface }),
          cell('100 000 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('200 000 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('300 000 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Abonnement mensuel', { bold: true }),
          cell('20 000 FCFA', { align: AlignmentType.CENTER, bold: true, color: C.accent }),
          cell('35 000 FCFA', { align: AlignmentType.CENTER, bold: true, color: C.accent }),
          cell('50 000 FCFA', { align: AlignmentType.CENTER, bold: true, color: C.accent }),
        ]),
        tableRow([
          cell('Abonnement annuel', { bold: true, shading: C.surface }),
          cell('200 000 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('350 000 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('500 000 FCFA', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Économie annuelle (2 mois offerts)', { bold: true }),
          cell('40 000 FCFA', { align: AlignmentType.CENTER, color: C.greenD }),
          cell('70 000 FCFA', { align: AlignmentType.CENTER, color: C.greenD }),
          cell('100 000 FCFA', { align: AlignmentType.CENTER, color: C.greenD }),
        ]),
        tableRow([
          cell('Support', { bold: true, shading: C.surface }),
          cell('Email (48h)', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('Email + WhatsApp (24h)', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('WhatsApp + téléphone (4h)', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
      ]),

      h2('5.2 Ce que couvre chaque plan'),
      p('TOUS les plans incluent l\'intégralité des 13 modules : Élèves & Scolarité, Finances & Économat, Examens & Bulletins, Organisation Pédagogique, RH & Personnel, Communication, Agrégation & Décision, Bibliothèque, Transport, Cantine, Infirmerie, QHSE, EduCast, Boutique, Réunions, ORION (Pilotage Direction), Site Institutionnel.'),
      p('Tous les plans incluent également : paiements en ligne (FedaPay), multi-caisses, reçus PDF/WhatsApp/SMS, multi-niveaux (Maternelle + Primaire + Secondaire), personnalisation de marque (logo, couleurs), site institutionnel.'),
      p('La seule différence entre les plans est le nombre maximum d\'élèves et le niveau de support.'),

      h2('5.3 Ce que couvrent les frais d\'installation'),
      p('Les frais d\'installation (100 000 à 300 000 FCFA) sont facturés une seule fois à la souscription. Ils couvrent :'),
      p('• Création du tenant + configuration initiale (sous-domaine, branding)', { indent: false }),
      p('• Import des données élèves existantes (Excel → base de données)', { indent: false }),
      p('• Création des classes officielles + sections physiques', { indent: false }),
      p('• Configuration des frais par classe + tranches de paiement', { indent: false }),
      p('• Création des comptes utilisateurs (direction, secrétariat, comptabilité)', { indent: false }),
      p('• Formation initiale (2-3h en visio)', { indent: false }),
      p('• Support prioritaire les 30 premiers jours', { indent: false }),

      // === 6. PROJECTIONS ===
      h1('6. Projections de rentabilité'),
      p('Les projections ci-dessous tiennent compte des coûts d\'infrastructure en mode Pro. La marge nette correspond au revenu des abonnements annuels diminué du coût d\'infrastructure, indépendamment de toute commission externe. Le coût d\'infrastructure (~53 500 FCFA/mois, soit ~642 000 FCFA/an — incluant Neon, Fly.io, Vercel, OVH, Twilio et Resend) est partagé entre toutes les écoles : plus il y a d\'écoles, plus le coût marginal par école est faible.', { indent: false }),
      p('Note : Les revenus des add-ons (SMS Twilio facturés 30 FCFA/SMS avec 10 FCFA de marge, emails Resend facturés 5 000 FCFA/mois/école) ne sont PAS inclus dans les projections ci-dessous. Ils s\'ajoutent en complément, selon la consommation réelle de chaque école. Pour une école de 700 élèves avec ~1 400 SMS/mois et ~700 emails/mois : revenu add-on ≈ (1 400 × 10) + (5 000 − 4 200) = 14 800 FCFA/mois de marge supplémentaire.', { indent: false }),

      h2('6.1 Scénario actuel (2 écoles)'),
      makeTable([
        tableRow([
          headerCell('Élément', 45),
          headerCell('Montant annuel', 30),
          headerCell('Montant mensuel', 25),
        ], { header: true }),
        tableRow([
          cell('Revenu abonnements (1 SEED + 1 GROW)'),
          cell('550 000 FCFA', { align: AlignmentType.CENTER }),
          cell('45 833 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Coût infrastructure', { shading: C.surface }),
          cell('642 000 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
        ]),
        tableRow([
          cell('Marge nette (récurrent)', { bold: true, shading: C.accent, color: C.white }),
          cell('-92 000 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
          cell('-7 667 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
        ]),
      ]),
      p('Note : Avec seulement 2 écoles, la marge récurrente est négative (-7 667 FCFA/mois). Le seuil de rentabilité est atteint à partir de 3 écoles (Revenu 750 000 FCFA/an > Coût 642 000 FCFA/an). Les add-ons (SMS + emails) peuvent compenser partiellement ce déficit. L\'objectif est de passer rapidement à 5+ écoles pour atteindre une rémunération confortable de l\'exploitant.'),

      h2('6.2 Scénario court terme (5 écoles)'),
      makeTable([
        tableRow([
          headerCell('Élément', 45),
          headerCell('Montant annuel', 30),
          headerCell('Montant mensuel', 25),
        ], { header: true }),
        tableRow([
          cell('Revenu abonnements (2 SEED + 2 GROW + 1 LEAD)'),
          cell('1 600 000 FCFA', { align: AlignmentType.CENTER }),
          cell('133 333 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Coût infrastructure', { shading: C.surface }),
          cell('642 000 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
        ]),
        tableRow([
          cell('Marge nette (récurrent)', { bold: true, shading: C.accent, color: C.white }),
          cell('958 000 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
          cell('79 833 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
        ]),
      ]),

      h2('6.3 Scénario moyen terme (15 écoles)'),
      makeTable([
        tableRow([
          headerCell('Élément', 45),
          headerCell('Montant annuel', 30),
          headerCell('Montant mensuel', 25),
        ], { header: true }),
        tableRow([
          cell('Revenu abonnements (5 SEED + 7 GROW + 3 LEAD)'),
          cell('4 950 000 FCFA', { align: AlignmentType.CENTER }),
          cell('412 500 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Coût infrastructure', { shading: C.surface }),
          cell('642 000 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
        ]),
        tableRow([
          cell('Marge nette (récurrent)', { bold: true, shading: C.accent, color: C.white }),
          cell('4 308 000 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
          cell('359 000 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
        ]),
      ]),

      h2('6.4 Scénario scale (30 écoles)'),
      makeTable([
        tableRow([
          headerCell('Élément', 45),
          headerCell('Montant annuel', 30),
          headerCell('Montant mensuel', 25),
        ], { header: true }),
        tableRow([
          cell('Revenu abonnements (10 SEED + 15 GROW + 5 LEAD)'),
          cell('9 750 000 FCFA', { align: AlignmentType.CENTER }),
          cell('812 500 FCFA', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Coût infrastructure (toujours Neon Pro)', { shading: C.surface }),
          cell('642 000 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
          cell('53 500 FCFA', { align: AlignmentType.CENTER, color: C.redD, shading: C.surface }),
        ]),
        tableRow([
          cell('Marge nette (récurrent)', { bold: true, shading: C.accent, color: C.white }),
          cell('9 108 000 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
          cell('759 000 FCFA', { align: AlignmentType.CENTER, bold: true, shading: C.accent, color: C.white }),
        ]),
      ]),

      // === 7. POLITIQUE DE FACTURATION ===
      h1('7. Politique de facturation'),
      h2('7.1 Abonnement annuel privilégié'),
      p('L\'abonnement annuel est l\'option par défaut, avec 2 mois offerts (économie de ~17 %). Avantages :'),
      p('• Trésorerie prévisible pour YEHI OR Tech', { indent: false }),
      p('• Moins de gestion administrative (1 facture/an au lieu de 12)', { indent: false }),
      p('• L\'école perçoit l\'économie (40 000 à 100 000 FCFA)', { indent: false }),

      h2('7.2 Add-ons : facturation mensuelle'),
      p('Les SMS (Twilio) et les emails (Resend) sont facturés mensuellement sur la base de la consommation réelle :', { indent: false }),
      p('• SMS : compteur de SMS envoyés × 30 FCFA/SMS. Relevé en fin de mois et facturé avec l\'abonnement mensuel.', { indent: false }),
      p('• Emails : forfait mensuel de 5 000 FCFA (incluant jusqu\'à 5 000 emails/mois par école). Au-delà de 5 000 emails/mois, tarif dégressif de 1 FCFA/email supplémentaire.', { indent: false }),
      p('• WhatsApp : gratuit — aucune facturation (envoi manuel depuis le compte WhatsApp de l\'école).', { indent: false }),
      p('• Option bilingue : facturée annuellement (50 000 FCFA/an + 50 000 FCFA frais d\'activation).', { indent: false }),
      p('Un rapport de consommation mensuel (nombre de SMS envoyés, nombre d\'emails envoyés, nombre de notifications WhatsApp) est disponible dans le back-office de l\'école pour assurer une transparence totale sur la facturation.', { indent: false }),

      h2('7.3 Révision des limites'),
      p('Si une école dépasse la limite de son plan (ex : 200 élèves en plan SEED), elle doit upgrader vers le plan supérieur. La vérification se fait automatiquement lors de l\'import d\'élèves ou de la création manuelle.'),

      h2('7.4 Période d\'essai'),
      p('Une période d\'essai de 30 jours est offerte à la souscription, avec accès à toutes les fonctionnalités (plan GROW). Aucune carte bancaire requise pendant l\'essai.'),

      // === 8. POSITIONNEMENT ===
      h1('8. Positionnement concurrentiel'),
      makeTable([
        tableRow([
          headerCell('Solution', 25),
          headerCell('Coût mensuel', 20),
          headerCell('Modules', 15),
          headerCell('Paiements en ligne', 15),
          headerCell('Site institutionnel', 15),
          headerCell('ORION IA', 10),
        ], { header: true }),
        tableRow([
          cell('Logiciels classiques (Excel, etc.)'),
          cell('0 FCFA', { align: AlignmentType.CENTER }),
          cell('0', { align: AlignmentType.CENTER }),
          cell('Non', { align: AlignmentType.CENTER }),
          cell('Non', { align: AlignmentType.CENTER }),
          cell('Non', { align: AlignmentType.CENTER }),
        ]),
        tableRow([
          cell('Logiciels locaux (Gescôle, etc.)', { shading: C.surface }),
          cell('15 000-50 000', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('3-5', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('Rarement', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('Non', { align: AlignmentType.CENTER, shading: C.surface }),
          cell('Non', { align: AlignmentType.CENTER, shading: C.surface }),
        ]),
        tableRow([
          cell('Academia Helm — SEED'),
          cell('20 000', { align: AlignmentType.CENTER, color: C.accent, bold: true }),
          cell('13+', { align: AlignmentType.CENTER, bold: true }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true }),
        ]),
        tableRow([
          cell('Academia Helm — GROW', { shading: C.surface }),
          cell('35 000', { align: AlignmentType.CENTER, color: C.accent, bold: true, shading: C.surface }),
          cell('13+', { align: AlignmentType.CENTER, bold: true, shading: C.surface }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true, shading: C.surface }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true, shading: C.surface }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true, shading: C.surface }),
        ]),
        tableRow([
          cell('Academia Helm — LEAD'),
          cell('50 000', { align: AlignmentType.CENTER, color: C.accent, bold: true }),
          cell('13+', { align: AlignmentType.CENTER, bold: true }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true }),
          cell('Oui', { align: AlignmentType.CENTER, color: C.greenD, bold: true }),
        ]),
      ]),
      p('Academia Helm se positionne dans la fourchette haute du marché, justifiée par la richesse fonctionnelle (13 modules + ORION IA + paiements en ligne + site institutionnel + offline-first). Aucun concurrent au Bénin n\'offre cette combinaison à ce prix.'),

      // === 9. RECOMMANDATIONS ===
      h1('9. Recommandations stratégiques'),
      h2('9.1 Break-even'),
      p('Avec 3 écoles (Revenu ~750 000 FCFA/an > Coût infrastructure 642 000 FCFA/an), les coûts d\'infrastructure sont couverts. Avec 5 écoles, la marge nette récurrente atteint ~79 833 FCFA/mois pour YEHI OR Tech (après infrastructure). Les add-ons (SMS Twilio + emails Resend) s\'ajoutent en complément : pour 5 écoles avec une consommation moyenne, ils génèrent ~50 000-75 000 FCFA/mois de marge additionnelle.', { indent: false }),

      h2('9.2 Évolution Neon'),
      p('Jusqu\'à ~30 écoles (~6 GB) : Neon Pro (19 $/mois) suffit. Au-delà de 30 écoles, prévoir Neon Scale (49 $/mois, 50 GB) — le coût marginal reste faible par rapport aux revenus (82 500 FCFA/mois pour 50+ écoles générant 800 000+ FCFA/mois).'),

      h2('9.3 Gestion des SMS et emails'),
      p('Les SMS (Twilio, 20 FCFA/SMS coût réel) et les emails (Resend, ~12 000 FCFA/mois coût fixe) sont les deux coûts variables à surveiller. Surveiller le volume mensuel par école :', { indent: false }),
      p('• Si une école dépasse 5 000 SMS/mois, proposer un forfait SMS illimité à 100 000 FCFA/mois (au lieu du tarif unitaire à 30 FCFA/SMS).', { indent: false }),
      p('• Si une école dépasse 5 000 emails/mois, négocier un forfait emails illimité à 15 000 FCFA/mois.', { indent: false }),
      p('• Les notifications WhatsApp restent gratuites et illimitées — encourager les écoles à utiliser WhatsApp en priorité pour réduire les coûts SMS.', { indent: false }),

      h2('9.4 Croissance 2026-2027'),
      p('Avec Mon Avenir Plus qui passera probablement à 750-800 élèves en 2026-2027, cette école restera dans le plan GROW (≤ 700 élèves → passage au plan LEAD si dépassement). Le CSPEB (96 élèves) reste en SEED. L\'objectif de croissance est d\'atteindre 10 écoles d\'ici fin 2026 et 20 écoles d\'ici mi-2027.'),

      new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),
      p('— Fin du document —', { align: AlignmentType.CENTER, indent: false, italics: true, color: C.secondary }),
    ],
  }],
});

// === Génération ===
const outputPath = '/home/z/my-project/download/Academia_Helm_Tarification_SaaS.docx';

Packer.toBuffer(doc).then(buffer => {
  // Créer le dossier download s'il n'existe pas
  const dir = require('path').dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log('✅ Document généré : ' + outputPath);
  console.log('   Taille : ' + (buffer.length / 1024).toFixed(1) + ' KB');
}).catch(err => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
