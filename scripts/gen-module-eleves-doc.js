/**
 * ============================================================================
 * Génération de la documentation du Module Élèves Academia Helm
 * ============================================================================
 * Format : Word (.docx)
 * Sortie : /home/z/my-project/download/Module_Eleves_Academia_Helm.docx
 *
 * Structure :
 *   - Page de garde (R1 — Pure Paragraph Left)
 *   - Table des matières
 *   - 14 chapitres (un par sous-onglet du module + intro/architecture)
 * ============================================================================
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageBreak, PageNumber, AlignmentType, HeadingLevel,
  BorderStyle, WidthType, ShadingType, TableLayoutType, TableOfContents,
  PageOrientation, NumberFormat, LevelFormat, convertInchesToTwip,
} = require("docx");
const fs = require("fs");

// ============================================================================
// PALETTE — Tech / Éducation (cool + light + active)
// ============================================================================
const P = {
  primary: "#0A1628",   // Headings
  body: "#1A2B40",      // Body text
  secondary: "#6878A0", // Captions
  accent: "#1E40AF",    // Blue accent
  surface: "#F4F8FC",   // Table alternating rows
  bg: "#FFFFFF",        // Cover background
  titleColor: "#0A1628",
  subtitleColor: "#1E40AF",
  metaColor: "#475569",
  footerColor: "#6878A0",
};
const c = (hex) => hex.replace("#", "");

// ============================================================================
// HELPERS — Borders
// ============================================================================
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB,
                       insideHorizontal: NB, insideVertical: NB };

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: c(P.secondary) };
const accentBorder = { style: BorderStyle.SINGLE, size: 8, color: c(P.accent) };

// ============================================================================
// HELPERS — Paragraphes
// ============================================================================
function heading(text, level = HeadingLevel.HEADING_1) {
  const sizes = {
    [HeadingLevel.HEADING_1]: 32,  // 16pt
    [HeadingLevel.HEADING_2]: 30,  // 15pt
    [HeadingLevel.HEADING_3]: 28,  // 14pt
    [HeadingLevel.HEADING_4]: 26,  // 13pt
  };
  return new Paragraph({
    heading: level,
    spacing: {
      before: level === HeadingLevel.HEADING_1 ? 360 : 240,
      after: 120,
      line: 312,
    },
    children: [new TextRun({
      text,
      bold: true,
      color: c(P.primary),
      size: sizes[level] || 28,
      font: { ascii: "Calibri", eastAsia: "Calibri" },
    })],
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: opts.indent === false ? 0 : 0 },
    spacing: { line: 312, after: 120 },
    children: [new TextRun({
      text,
      size: 22,  // 11pt
      color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Calibri" },
    })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { line: 312, after: 60 },
    indent: { left: 720 + (level * 360), hanging: 360 },
    children: [new TextRun({
      text,
      size: 22,
      color: c(P.body),
      font: { ascii: "Calibri", eastAsia: "Calibri" },
    })],
  });
}

function richBullet(parts, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { line: 312, after: 60 },
    indent: { left: 720 + (level * 360), hanging: 360 },
    children: parts.map(p => new TextRun({
      text: p.text,
      size: 22,
      bold: p.bold || false,
      color: c(p.color || P.body),
      font: { ascii: "Calibri", eastAsia: "Calibri" },
    })),
  });
}

function info(text) {
  return new Paragraph({
    spacing: { line: 312, before: 120, after: 120 },
    indent: { left: 240, right: 240 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 24, color: c(P.accent), space: 12 },
    },
    shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
    children: [new TextRun({
      text,
      size: 22,
      italics: true,
      color: c(P.body),
      font: { ascii: "Calibri" },
    })],
  });
}

function codeBlock(text) {
  const lines = text.split("\n");
  return lines.map(line => new Paragraph({
    spacing: { line: 276, after: 0 },
    indent: { left: 240, right: 240 },
    shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
    children: [new TextRun({
      text: line || " ",
      size: 20,  // 10pt
      color: "0F172A",
      font: { ascii: "Consolas", eastAsia: "Consolas" },
    })],
  }));
}

// ============================================================================
// HELPERS — Tableaux
// ============================================================================
function makeTable(headers, rows, options = {}) {
  const colWidths = options.colWidths;
  const totalWidth = 9000; // ~15.5 cm
  const widths = colWidths || headers.map(() => Math.floor(totalWidth / headers.length));

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map((h, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: { type: ShadingType.CLEAR, fill: c(P.accent) },
      borders: {
        top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder,
      },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 276 },
        children: [new TextRun({
          text: h, bold: true, size: 22, color: "FFFFFF",
          font: { ascii: "Calibri" },
        })],
      })],
    })),
  });

  const dataRows = rows.map((row, idx) => new TableRow({
    cantSplit: true,
    children: row.map((cell, i) => new TableCell({
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: idx % 2 === 0
        ? { type: ShadingType.CLEAR, fill: c(P.surface) }
        : { type: ShadingType.CLEAR, fill: "FFFFFF" },
      borders: {
        top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder,
      },
      children: [new Paragraph({
        spacing: { line: 276 },
        children: [new TextRun({
          text: String(cell || ""),
          size: 20,  // 10pt
          color: c(P.body),
          font: { ascii: "Calibri" },
        })],
      })],
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [headerRow, ...dataRows],
  });
}

// ============================================================================
// COVER — Recipe R1 (Pure Paragraph Left)
// ============================================================================
function buildCover() {
  const padL = 1200, padR = 800;
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 12 };

  const children = [];

  // Top whitespace
  children.push(new Paragraph({ spacing: { before: 2400 } }));

  // English label
  children.push(new Paragraph({
    indent: { left: padL, right: padR }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 8 } },
    children: [new TextRun({
      text: "A C A D E M I A   H E L M   —   M O D U L E   1",
      size: 18, color: c(P.accent),
      font: { ascii: "Calibri" }, characterSpacing: 40,
    })],
  }));

  // Main title (2 lines)
  const titleLines = ["Module Élèves", "& Inscriptions"];
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: 920, lineRule: "atLeast" },
      children: [new TextRun({
        text: titleLines[i], size: 80, bold: true,
        color: c(P.titleColor), font: { ascii: "Arial" },
      })],
    }));
  }

  // Subtitle
  children.push(new Paragraph({
    indent: { left: padL }, spacing: { after: 800 },
    children: [new TextRun({
      text: "Documentation technique & fonctionnelle complète",
      size: 26, color: c(P.subtitleColor),
      font: { ascii: "Arial" },
    })],
  }));

  // Meta info
  const metaLines = [
    "Plateforme : Academia Helm — CSPEB Eveil d'Afrique Education (Bénin)",
    "Stack technique : NestJS · Next.js 14 · Prisma · Neon PostgreSQL",
    "Version documentée : Juillet 2026",
    "Statut : Production — refonte Module 1 terminée",
  ];
  for (const line of metaLines) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({
        text: line, size: 22, color: c(P.metaColor),
        font: { ascii: "Arial" },
      })],
    }));
  }

  // Bottom whitespace
  children.push(new Paragraph({ spacing: { before: 3200 } }));

  // Footer
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent), space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({
        text: "Document interne — Academia Helm",
        size: 16, color: c(P.footerColor), font: { ascii: "Arial" },
      }),
      new TextRun({ text: "                                        " }),
      new TextRun({
        text: "Module 1 / 14",
        size: 16, color: c(P.footerColor), font: { ascii: "Arial" },
      }),
    ],
  }));

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: c(P.bg) },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ============================================================================
// TOC
// ============================================================================
function buildToc() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 360 },
      children: [new TextRun({
        text: "Table des matières",
        size: 36, bold: true, color: c(P.primary),
        font: { ascii: "Calibri" },
      })],
    }),
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({
      spacing: { before: 240 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: "(Clic droit sur la table → Mettre à jour les champs pour rafraîchir les numéros de page)",
        size: 18, italics: true, color: c(P.secondary),
        font: { ascii: "Calibri" },
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ============================================================================
// CONTENT — Chapitres
// ============================================================================

function chapter1() {
  return [
    heading("1. Vue d'ensemble du Module Élèves"),
    body("Le Module Élèves est le socle opérationnel d'Academia Helm. Il orchestre l'ensemble du cycle de vie scolaire d'un élève, depuis la pré-inscription publique jusqu'à la sortie définitive, en passant par l'admission, l'inscription administrative, l'affectation à une section physique, la génération des cartes scolaires, la gestion documentaire et la mobilité inter-établissements."),
    body("Conçu pour le contexte béninois (CSPEB Eveil d'Afrique Education), ce module intègre les exigences réglementaires nationales : conformité Educmaster (emp.educmaster.bj), génération de NPI, format officiel des listes de classe avec en-tête ministériel, et traçabilité complète des mouvements pour audit."),
    body("L'architecture distingue désormais deux concepts clés : la classe officielle (AcademicClass — ex : CE1, CP, 6ème) à laquelle l'élève est rattaché administrativement à l'admission, et la classe physique (Class — ex : CE1-A, CE1-B) qui correspond à la section réelle où il est assis en salle. Cette séparation clarifie les responsabilités : l'admission gère la classe officielle, l'affectation gère la section physique."),

    heading("1.1. Positionnement dans l'écosystème", HeadingLevel.HEADING_2),
    body("Le Module Élèves est connecté à tous les autres modules de la plateforme :"),
    bullet("Module Finance — chaque élève possède un StudentAccount annuel qui agrège frais dus, paiements et arriérés. Le régime tarifaire (normal, boursier, enfant enseignant) est appliqué au niveau de l'élève."),
    bullet("Module Pédagogie — les classes officielles (AcademicClass) proviennent du module Pédagogie. Les emplois du temps et matières enseignées y sont rattachés."),
    bullet("Module Communication — notifications automatiques aux parents (admission acceptée, transfert, réinscription) via Email + WhatsApp + SMS."),
    bullet("Module ORION IA — analyse prédictive des risques (abandon, redoublement), alertes sur données manquantes, statistiques avancées."),
    bullet("Portails Parents — consultation publique du dossier élève, vérification QR code de la carte scolaire."),

    heading("1.2. Sous-onglets du module", HeadingLevel.HEADING_2),
    body("Le module est organisé en 13 sous-onglets accessibles depuis la barre latérale :"),
    makeTable(
      ["#", "Onglet", "Description courte"],
      [
        ["1", "Tableau de Bord", "KPIs globaux, alertes ORION, raccourcis"],
        ["2", "Admissions", "Candidatures, validation, conversion en élèves"],
        ["3", "Inscriptions", "Élèves par classe officielle, réinscriptions, PDF"],
        ["4", "Affectations & Mouvements", "Sections physiques, changements de classe/série"],
        ["5", "Liste des Élèves", "Listes par section physique, PDF par salle"],
        ["6", "Sorties & Abandons", "Retraits, réintégrations, motifs"],
        ["7", "Cartes Scolaires", "Génération individuelle et par lot, QR code"],
        ["8", "Dossiers Élèves", "Dossier complet 12 onglets par élève"],
        ["9", "Familles", "Regroupement par fratrie, responsables légaux"],
        ["10", "Transferts & Mobilité", "Transferts inter-écoles (sortants/entrants)"],
        ["11", "Historique Scolaire", "Parcours 3 dernières années, décisions conseil"],
        ["12", "Educmaster", "Export Excel conforme templates gouvernementaux"],
        ["13", "ORION, Stats & Audit", "Statistiques avancées, alertes IA, audit"],
      ],
      { colWidths: [600, 2800, 5600] },
    ),

    heading("1.3. Architecture technique", HeadingLevel.HEADING_2),
    body("Backend NestJS (contrôleur @Controller('students')) avec 10 contrôleurs spécialisés (admission, lifecycle, identifier, id-card, dossier, transfers, orion, import, public-verification, public-admission). Le schéma Prisma compte plus de 12 modèles dédiés : Student, StudentEnrollment, StudentGuardian, Admission, AdmissionDocument, ClassTransfer, StudentTransferRequest, GeneratedDocument, NationalExportLog, StudentFeeProfile, StudentAccount, etc."),
    body("Frontend Next.js 14 — composant central StudentsModulePage.tsx qui orchestre les 13 sous-onglets. Chaque onglet est un composant React autonome (StudentHistoryContent, AdmissionsContent, EnrollmentsContent, etc.) avec son propre état et son chargement de données."),
    body("Base de données Neon PostgreSQL — toutes les tables sont préfixées par tenantId pour le multi-tenant. Les migrations Prisma sont versionnées (001 à 014+) et appliquées via npx prisma migrate deploy."),
  ];
}

function chapter2() {
  return [
    heading("2. Tableau de Bord"),
    body("Le Tableau de Bord est l'écran d'accueil du Module Élèves. Il offre une vue synthétique de l'état du module : effectifs par niveau, statistiques d'admission, alertes ORION prioritaires, et raccourcis vers les actions les plus fréquentes."),
    body("Il sert de point d'entrée quotidien pour les administrateurs et secrétaires de l'établissement, leur permettant d'identifier rapidement les situations nécessitant une action (dossiers en attente, élèves sans affectation, cartes manquantes, transferts à traiter)."),

    heading("2.1. Indicateurs clés affichés", HeadingLevel.HEADING_2),
    bullet("Effectif total par niveau scolaire (Maternelle, Primaire, Secondaire) avec évolution vs année précédente."),
    bullet("Répartition par statut (ACTIVE, ADMITTED, RE_ENROLLED, PENDING, WITHDRAWN, TRANSFERRED)."),
    bullet("Taux d'occupation des classes (élèves inscrits / capacité déclarée)."),
    bullet("Admissions en attente de décision (SUBMITTED, UNDER_REVIEW, MISSING_DOCUMENTS)."),
    bullet("Alertes ORION : élèves à risque d'abandon, données manquantes, doublons potentiels."),

    heading("2.2. Raccourcis proposés", HeadingLevel.HEADING_2),
    bullet("Nouvelle admission → bascule vers l'onglet Admissions avec formulaire pré-ouvert."),
    bullet("Réinscription massive → bascule vers Inscriptions avec filtre sur l'année précédente."),
    bullet("Génération cartes par lot → bascule vers Cartes Scolaires."),
    bullet("Export Educmaster → bascule vers l'onglet Educmaster."),
  ];
}

function chapter3() {
  return [
    heading("3. Admissions"),
    body("L'onglet Admissions gère le cycle complet des candidatures : pré-inscription publique (par les parents via le portail), soumission du dossier, validation administrative, décision (acceptation / refus / liste d'attente), et conversion en élève officiel avec génération automatique du matricule, du compte financier et du responsable légal."),

    heading("3.1. Workflow des statuts", HeadingLevel.HEADING_2),
    body("Une admission suit un workflow précis avec les statuts suivants :"),
    makeTable(
      ["Statut", "Libellé", "Signification"],
      [
        ["DRAFT", "Brouillon", "Pré-inscription parent en cours (portail public)"],
        ["PENDING", "En attente", "Dossier soumis, en attente de revue administrative"],
        ["SUBMITTED", "Soumis", "Dossier complet, prêt pour décision"],
        ["UNDER_REVIEW", "En revue", "Dossier en cours d'examen par l'administration"],
        ["MISSING_DOCUMENTS", "Docs manquants", "Documents obligatoires manquants"],
        ["ACCEPTED", "Accepté", "Candidature acceptée, prêt à convertir en élève"],
        ["REJECTED", "Refusé", "Candidature refusée"],
        ["WAITLISTED", "Liste d'attente", "En file d'attente (places limitées)"],
        ["CONVERTED", "Converti", "Dossier transformé en élève officiel"],
        ["CANCELLED", "Annulé", "Dossier annulé (parent ou admin)"],
      ],
      { colWidths: [2200, 1800, 5000] },
    ),

    heading("3.2. Actions disponibles", HeadingLevel.HEADING_2),
    bullet("Soumettre une candidature (DRAFT → SUBMITTED)."),
    bullet("Accepter / Refuser / Mettre en liste d'attente (SUBMITTED → ACCEPTED/REJECTED/WAITLISTED)."),
    bullet("Demander des documents complémentaires (→ MISSING_DOCUMENTS)."),
    bullet("Convertir en élève (ACCEPTED → CONVERTED) : génère automatiquement le matricule, le StudentAccount, et le StudentGuardian."),
    bullet("Accepter et inscrire directement (batch) : combine acceptation + conversion + inscription en une action."),
    bullet("Reprendre un dossier (remet en UNDER_REVIEW depuis ACCEPTED/REJECTED)."),
    bullet("Supprimer un dossier (action irréversible)."),

    heading("3.3. Sous-onglet Paramétrage", HeadingLevel.HEADING_2),
    body("L'onglet Admissions contient un sous-onglet « Paramétrage » qui permet de configurer :"),
    bullet("Date d'ouverture et de clôture des admissions pour l'année scolaire."),
    bullet("Activation / désactivation du portail public de pré-inscription."),
    bullet("Documents obligatoires requis (acte de naissance, NPI, photos, bulletins précédents)."),
    bullet("Message d'accueil affiché sur le portail public."),

    heading("3.4. Documents d'admission", HeadingLevel.HEADING_2),
    body("Chaque dossier peut contenir plusieurs documents uploadés par les parents ou l'administration :"),
    bullet("Acte de naissance (BIRTH_CERTIFICATE)."),
    bullet("Carte NPI (NPI_CARD)."),
    bullet("Certificat de scolarité précédent (SCHOOL_CERTIFICATE)."),
    bullet("Bulletin de notes (REPORT_CARD)."),
    bullet("Photo d'identité (PHOTO)."),
    bullet("Autres documents (OTHER)."),
    body("Chaque document peut être validé ou rejeté individuellement par l'administration, avec motif de rejet."),

    heading("3.5. Entretiens d'admission", HeadingLevel.HEADING_2),
    body("Le module supporte la planification d'entretiens d'admission (AdmissionInterview) avec date, heure, interviewers, notes et statut (SCHEDULED, COMPLETED, CANCELLED)."),

    heading("3.6. Endpoints API", HeadingLevel.HEADING_2),
    body("Contrôleur : AdmissionController (@Controller('students/admissions'))"),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["POST", "/students/admissions", "Créer une candidature"],
        ["GET", "/students/admissions", "Lister les candidatures (filtres)"],
        ["GET", "/students/admissions/:id", "Détail d'une candidature"],
        ["PATCH", "/students/admissions/:id", "Modifier une candidature"],
        ["DELETE", "/students/admissions/:id", "Supprimer une candidature"],
        ["POST", "/students/admissions/batch/submit", "Soumettre en lot"],
        ["POST", "/students/admissions/batch/accept", "Accepter en lot"],
        ["POST", "/students/admissions/batch/convert", "Convertir en lot"],
        ["POST", "/students/admissions/batch/accept-and-enroll", "Accepter + inscrire en lot"],
        ["POST", "/students/admissions/:id/submit", "Soumettre une candidature"],
        ["POST", "/students/admissions/:id/decide", "Décision (accept/refuse/waitlist)"],
        ["POST", "/students/admissions/:id/accept", "Accepter"],
        ["POST", "/students/admissions/:id/reject", "Refuser"],
        ["POST", "/students/admissions/:id/waitlist", "Liste d'attente"],
        ["POST", "/students/admissions/:id/cancel", "Annuler"],
        ["POST", "/students/admissions/:id/request-documents", "Demander docs complémentaires"],
        ["POST", "/students/admissions/:id/convert", "Convertir en élève"],
        ["POST", "/students/admissions/:id/accept-and-enroll", "Accepter + inscrire"],
        ["GET", "/students/admissions/:id/documents", "Lister les documents"],
        ["POST", "/students/admissions/:id/documents", "Ajouter un document"],
        ["POST", "/students/admissions/:id/upload-document", "Upload document (base64)"],
        ["GET", "/students/admissions/:id/documents/:docId/download", "Télécharger un document"],
        ["PATCH", "/students/admissions/documents/:documentId", "Modifier un document"],
        ["POST", "/students/admissions/documents/:documentId/validate", "Valider un document"],
        ["POST", "/students/admissions/documents/:documentId/reject", "Rejeter un document"],
        ["DELETE", "/students/admissions/documents/:documentId", "Supprimer un document"],
        ["GET", "/students/admissions/:id/interviews", "Lister les entretiens"],
        ["POST", "/students/admissions/:id/interviews", "Planifier un entretien"],
        ["PATCH", "/students/admissions/interviews/:interviewId", "Modifier un entretien"],
        ["POST", "/students/admissions/interviews/:interviewId/complete", "Marquer terminé"],
        ["DELETE", "/students/admissions/interviews/:interviewId", "Supprimer un entretien"],
      ],
      { colWidths: [900, 4500, 3600] },
    ),

    heading("3.7. Notifications automatiques", HeadingLevel.HEADING_2),
    body("Le service AdmissionNotificationService envoie automatiquement des notifications aux parents à chaque changement de statut :"),
    bullet("Dossier soumis → email de confirmation avec numéro de dossier."),
    bullet("Dossier accepté → email + WhatsApp + SMS de félicitations avec prochaine étape."),
    bullet("Dossier refusé → email avec motif."),
    bullet("Documents manquants → email listant les documents à fournir."),
    bullet("Conversion en élève → email avec matricule et instructions de connexion au portail parent."),
  ];
}

function chapter4() {
  return [
    heading("4. Inscriptions"),
    body("L'onglet Inscriptions affiche les élèves par classe OFFICIELLE (AcademicClass — ex : CE1, CP, 6ème). C'est ici que se gèrent les inscriptions administratives, les réinscriptions individuelles et massives, et la génération des listes de classe PDF par classe officielle."),

    heading("4.1. Arborescence niveau → classe officielle → élèves", HeadingLevel.HEADING_2),
    body("Les élèves sont groupés par niveau scolaire (Maternelle / Primaire / Secondaire), puis par classe officielle (CI, CP, CE1, CE2, CM1, CM2 pour le Primaire ; Maternelle 1, Maternelle 2 pour la Maternelle). Chaque classe officielle peut contenir plusieurs sections physiques (CE1-A, CE1-B), mais l'onglet Inscriptions regroupe tous les élèves d'une même classe officielle dans une seule liste."),

    heading("4.2. Statistiques affichées", HeadingLevel.HEADING_2),
    bullet("Inscrits : élèves avec un statut ACTIVE ou VALIDATED."),
    bullet("Nouveaux : élèves avec enrollmentType = NEW (première inscription)."),
    bullet("Réinscrits : élèves avec enrollmentType = REPEAT (année précédente dans le même établissement)."),
    bullet("En attente : élèves avec statut PENDING (inscription non finalisée)."),
    bullet("Non réinscrits : élèves de l'année précédente sans inscription cette année."),

    heading("4.3. Actions disponibles", HeadingLevel.HEADING_2),
    bullet("Nouvelle inscription : ouvre le formulaire StudentEnrollmentForm avec sélection élève + classe officielle + année."),
    bullet("Réinscription individuelle : propose automatiquement la classe suivante (ex : CE1 → CE2)."),
    bullet("Réinscription massive : sélection multiple + lot (applique le même enrollmentType à tous)."),
    bullet("Validation administrative : valide ou rejette les inscriptions en attente."),
    bullet("Export CSV : exporte la liste filtrée au format CSV."),
    bullet("Génération PDF liste de classe (mode=official) : génère un PDF avec en-tête ministériel pour la classe officielle. Le PDF regroupe TOUS les élèves de la classe officielle, toutes sections physiques confondues."),
    bullet("Visualisation PDF : récupère le PDF stocké en DB (généré précédemment) sans regénérer."),

    heading("4.4. Génération PDF liste de classe (mode official)", HeadingLevel.HEADING_2),
    body("La génération PDF utilise le service ClassListPdfService avec mode='official'. Le PDF contient :"),
    bullet("En-tête officiel : drapeau du Bénin, République du Bénin, ministère (MEMP pour Maternelle/Primaire, MESFTPRIJ pour Secondaire), nom et logo de l'école."),
    bullet("Titre : « Liste des Élèves »."),
    bullet("Sous-titre : « Classe officielle — X sections physiques »."),
    bullet("Infos classe : nom de la classe officielle, effectif total, année scolaire."),
    bullet("Tableau : N°, Nom et Prénom(s), Matricule, Sexe, Date de naissance."),
    bullet("Zones de signature : Le Responsable / Le Directeur."),
    body("Le PDF est stocké en DB (GeneratedDocument, documentType='CLASS_LIST_PDF') avec metadata.classId et metadata.mode='official' pour éviter les collisions avec les PDFs par classe physique."),
    body("Endpoints PDF (tous acceptent le paramètre mode=official|physical) :"),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["GET", "/students/class-list/:classId/pdf?academicYearId=...&mode=official", "Génère et retourne le PDF directement"],
        ["POST", "/students/class-list/:classId/pdf/generate", "Génère + stocke en DB (body: { academicYearId, mode })"],
        ["GET", "/students/class-list/:classId/pdf/stored?academicYearId=...&mode=official", "Récupère le PDF stocké (404 si non généré)"],
        ["GET", "/students/class-list/:classId/pdf/exists?academicYearId=...&mode=official", "Vérifie si un PDF existe"],
      ],
      { colWidths: [900, 5000, 3100] },
    ),

    heading("4.5. Import en masse", HeadingLevel.HEADING_2),
    body("Un modal d'import (ImportElevesModal) permet d'importer une liste d'élèves depuis un fichier Excel multi-feuilles (une feuille par classe). Le template est téléchargeable depuis l'interface. Le service StudentsImportService valide chaque ligne, crée les Student + StudentEnrollment + StudentGuardian en transaction, et retourne un rapport détaillé (succès, erreurs, doublons)."),

    heading("4.6. Alertes ORION intégrées", HeadingLevel.HEADING_2),
    body("Un panneau ORION est affiché en haut de l'onglet, montrant les alertes ciblées sur les inscriptions :"),
    bullet("Élèves sans matricule (données manquantes bloquantes pour Educmaster)."),
    bullet("Cartes scolaires manquantes (élèves sans carte générée pour l'année)."),
    bullet("Doublons potentiels (même nom + même date de naissance)."),
    bullet("Inscriptions incomplètes (sans responsable légal ou sans classe officielle)."),
  ];
}

function chapter5() {
  return [
    heading("5. Affectations & Mouvements"),
    body("L'onglet Affectations & Mouvements gère l'affectation des élèves aux sections physiques (Class — ex : CE1-A, CE1-B) et les mouvements entre classes. Il contient 4 sous-onglets :"),

    heading("5.1. Sous-onglets", HeadingLevel.HEADING_2),
    makeTable(
      ["Sous-onglet", "Description"],
      [
        ["Affectation vers classe physique", "Affecte un élève à une section physique (classId) à partir de sa classe officielle. Gère les capacités et suggère les sections disponibles."],
        ["Changement de classe", "Déplace un élève d'une section physique à une autre (ex : CE1-A → CE1-B). Garde l'historique via ClassTransfer."],
        ["Changement de série (Secondaire uniquement)", "Déplace un élève entre séries (ex : S → D). Spécifique au Secondaire avec gestion des séries (AcademicSeries)."],
        ["Historique", "Historique complet des affectations et changements de classe pour tous les élèves."],
      ],
      { colWidths: [3000, 6000] },
    ),

    heading("5.2. Distinction classe officielle vs physique", HeadingLevel.HEADING_2),
    body("Cette distinction est fondamentale dans Academia Helm :"),
    bullet("Classe officielle (AcademicClass, table pedagogy_academic_classes) : niveau pédagogique (CE1, CP, 6ème). Rattachée à l'élève via StudentEnrollment.academicClassId à l'admission."),
    bullet("Classe physique (Class, table classes) : section réelle en salle (CE1-A, CE1-B). Rattachée à l'élève via StudentEnrollment.classId à l'affectation."),
    body("Un élève peut être admis en classe officielle CE1 sans encore avoir de section physique assignée. L'affectation est une étape ultérieure. Une classe officielle peut avoir plusieurs sections physiques (1 CE1 → CE1-A + CE1-B)."),

    heading("5.3. Endpoints API", HeadingLevel.HEADING_2),
    body("Contrôleur : StudentsLifecycleController (@Controller('students'))"),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["POST", "/students/pre-register", "Pré-inscription publique"],
        ["POST", "/students/:id/admit", "Admettre un élève (génère matricule)"],
        ["POST", "/students/:id/re-enroll", "Réinscrire un élève"],
        ["POST", "/students/change-class", "Changer de section physique"],
        ["POST", "/students/change-series", "Changer de série (Secondaire)"],
        ["GET", "/students/:id/history", "Historique d'un élève"],
        ["GET", "/students/:id/audit", "Journal d'audit d'un élève"],
      ],
      { colWidths: [900, 4000, 4100] },
    ),

    heading("5.4. Modèle ClassTransfer", HeadingLevel.HEADING_2),
    body("Chaque changement de classe est tracé dans la table ClassTransfer avec :"),
    bullet("studentId, tenantId, academicYearId."),
    bullet("fromClassId, toClassId (sections physiques source et destination)."),
    bullet("fromSeriesId, toSeriesId (pour les changements de série Secondaire)."),
    bullet("transferType : 'CLASS_CHANGE' ou 'SERIES_CHANGE'."),
    bullet("reason, requestedById, approvedById, status."),
    bullet("createdAt, executedAt."),
  ];
}

function chapter6() {
  return [
    heading("6. Liste des Élèves"),
    body("L'onglet Liste des Élèves est le complément de l'onglet Inscriptions : il affiche les élèves par classe PHYSIQUE (sections CE1-A, CE1-B...) plutôt que par classe officielle. Il permet d'imprimer une liste par salle de classe réelle."),

    heading("6.1. Différence avec l'onglet Inscriptions", HeadingLevel.HEADING_2),
    makeTable(
      ["Critère", "Onglet Inscriptions", "Onglet Liste des Élèves"],
      [
        ["Type de classe", "Classe officielle (AcademicClass)", "Classe physique (Class)"],
        ["Regroupement", "StudentEnrollment.academicClassId", "StudentEnrollment.classId"],
        ["Mode PDF", "official (regroupe toutes les sections)", "physical (une feuille par section)"],
        ["Question répondue", "Quelle classe officielle l'élève a-t-il intégrée ?", "Dans quelle salle l'élève est-il assis ?"],
        ["Cas d'usage", "Inscription administrative, listes officielles", "Listes par salle, appels, affectations"],
      ],
      { colWidths: [1800, 3500, 3700] },
    ),

    heading("6.2. Fonctionnalités", HeadingLevel.HEADING_2),
    bullet("Arborescence niveau → section physique → élèves (avec recherche texte)."),
    bullet("Affichage de la classe officielle rattachée à chaque section (ex : CE1-A ↳ CE1)."),
    bullet("Génération PDF par section physique (mode=physical) — une feuille par salle."),
    bullet("Visualisation PDF stocké (récupération instantanée depuis la DB)."),
    bullet("Statut de chaque élève affiché (ACTIVE, ADMITTED, RE_ENROLLED, etc.)."),

    heading("6.3. PDF par section physique", HeadingLevel.HEADING_2),
    body("Le PDF généré en mode='physical' contient les mêmes éléments que le mode officiel (en-tête ministériel, tableau des élèves, signatures), mais avec un sous-titre « Section physique — classe officielle : CE1 » au lieu de « Classe officielle — X sections physiques ». Le nom de la classe affiché est celui de la section (ex : CE1-A)."),
  ];
}

function chapter7() {
  return [
    heading("7. Sorties & Abandons"),
    body("L'onglet Sorties & Abandons gère les élèves qui quittent l'établissement en cours d'année : retraits volontaires, abandons, exclusions disciplinaires. Il permet également la réintégration d'un élève précédemment retiré."),

    heading("7.1. Types de sorties", HeadingLevel.HEADING_2),
    makeTable(
      ["Type", "Description", "Statut final élève"],
      [
        ["WITHDRAWAL", "Retrait volontaire par les parents", "WITHDRAWN"],
        ["ABANDONMENT", "Abandon (plusieuurs absences non justifiées)", "WITHDRAWN"],
        ["EXCLUSION", "Exclusion disciplinaire", "WITHDRAWN"],
        ["TRANSFER", "Transfert vers une autre école", "TRANSFERRED"],
      ],
      { colWidths: [2000, 4500, 2500] },
    ),

    heading("7.2. Informations enregistrées", HeadingLevel.HEADING_2),
    bullet("exitDate : date effective de sortie."),
    bullet("exitReason : motif détaillé."),
    bullet("exitType : type de sortie (WITHDRAWAL, ABANDONMENT, EXCLUSION, TRANSFER)."),
    bullet("requestedById : utilisateur qui a demandé la sortie."),
    bullet("approvedById : utilisateur qui a validé."),
    bullet("notes : commentaires libres."),

    heading("7.3. Réintégration", HeadingLevel.HEADING_2),
    body("Un élève WITHDRAWN peut être réintégré. La réintégration crée une nouvelle StudentEnrollment (statut ACTIVE) pour l'année en cours. Le matricule et le globalStudentId sont conservés (l'élève retrouve son identifiant permanent)."),
    body("Cas particulier : la contrainte d'unicité @@unique([tenantId, academicYearId, studentId]) sur StudentEnrollment impose qu'il n'y ait qu'une seule inscription active par élève par année. Si l'élève a déjà une inscription ACTIVE pour l'année, la réintégration échoue avec un message explicite."),

    heading("7.4. Auto-refresh", HeadingLevel.HEADING_2),
    body("Après un retrait ou une réintégration, l'UI se rafraîchit automatiquement (loadData dans le bloc finally) pour refléter immédiatement le changement de statut dans la liste."),
  ];
}

function chapter8() {
  return [
    heading("8. Cartes Scolaires"),
    body("L'onglet Cartes Scolaires génère les cartes scolaires annuelles des élèves avec QR code de vérification. La carte est officielle, conforme aux exigences du ministère béninois, et permet la vérification publique via le portail Portails Parents."),

    heading("8.1. Génération individuelle", HeadingLevel.HEADING_2),
    body("Chaque élève peut avoir une carte générée individuellement. La carte contient :"),
    bullet("Recto : logo école, nom, prénom, matricule, classe, année scolaire, photo, QR code."),
    bullet("Verso : informations complémentaires (nom du père, mère, tuteur, téléphone, adresse, sang, allergies éventuelles)."),
    bullet("QR code : lien vers la page publique de vérification /verify/:cardNumber."),

    heading("8.2. Génération par lot", HeadingLevel.HEADING_2),
    body("Trois niveaux de génération par lot sont disponibles :"),
    bullet("Global : génère les cartes pour TOUS les élèves actifs du tenant, tous niveaux confondus (si schoolLevelId non fourni)."),
    bullet("Par niveau : génère pour tous les élèves d'un niveau (Maternelle, Primaire, Secondaire)."),
    bullet("Par classe : génère pour tous les élèves d'une classe spécifique."),
    body("La génération par lot utilise PuppeteerPoolService (HTML → PDF) avec un timeout étendu (5 minutes) car la génération de N cartes via Puppeteer est lente (~2-5 secondes par carte)."),

    heading("8.3. Boutons de suppression", HeadingLevel.HEADING_2),
    bullet("Suppression globale : purge TOUTES les cartes du tenant (action irréversible, nécessite confirmation)."),
    bullet("Suppression par niveau : purge les cartes d'un niveau spécifique."),
    bullet("Suppression par classe : purge les cartes d'une classe spécifique."),

    heading("8.4. Vérification publique QR code", HeadingLevel.HEADING_2),
    body("Le QR code de la carte pointe vers une URL publique /verify/:cardNumber. Cette page est accessible sans authentification et affiche :"),
    bullet("Statut de la carte (VALIDE / EXPIRÉE / RÉVOQUÉE)."),
    bullet("Nom, prénom, matricule, classe, année scolaire."),
    bullet("Photo de l'élève."),
    bullet("Logo de l'école."),
    body("Service backend : PublicVerificationService."),

    heading("8.5. Endpoints API", HeadingLevel.HEADING_2),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["POST", "/students/id-cards/generate", "Génère une carte individuelle"],
        ["POST", "/students/id-cards/generate-bulk", "Génération par lot (niveau, classe ou global)"],
        ["GET", "/students/id-cards/:studentId?academicYearId=...", "Récupère la carte d'un élève"],
        ["GET", "/students/id-cards/:studentId/pdf", "Télécharge la carte en PDF"],
        ["GET", "/students/id-cards/stats?academicYearId=...", "Statistiques (générées, manquantes, par niveau)"],
        ["DELETE", "/students/id-cards/global", "Suppression globale"],
        ["DELETE", "/students/id-cards/by-level/:levelId", "Suppression par niveau"],
        ["DELETE", "/students/id-cards/by-class/:classId", "Suppression par classe"],
        ["GET", "/students/verify/:cardNumber", "Vérification publique (sans auth)"],
      ],
      { colWidths: [900, 4500, 3600] },
    ),
  ];
}

function chapter9() {
  return [
    heading("9. Dossiers Élèves"),
    body("L'onglet Dossiers Élèves est la vue détaillée 360° d'un élève. Il présente une liste des élèves (avec filtres niveau + classe + recherche) et, au clic sur un élève, affiche son dossier complet organisé en 12 onglets thématiques."),

    heading("9.1. Liste des élèves avec filtres", HeadingLevel.HEADING_2),
    bullet("Filtre niveau scolaire (Maternelle / Primaire / Secondaire)."),
    bullet("Filtre classe (conditionné au niveau sélectionné)."),
    bullet("Recherche texte (nom, prénom, matricule)."),
    bullet("Affichage : photo, nom, prénom, matricule, classe, statut."),

    heading("9.2. Présélection depuis d'autres onglets", HeadingLevel.HEADING_2),
    body("Le bouton « Dossier Complet » de l'onglet Historique Scolaire bascule vers cet onglet avec présélection de l'élève via la query string ?tab=dossiers&studentId=xxx. StudentsModulePage lit tab pour activer l'onglet, et StudentIdentityContent lit studentId pour précharger automatiquement la carte de l'élève."),

    heading("9.3. Les 12 onglets du dossier élève", HeadingLevel.HEADING_2),
    makeTable(
      ["#", "Onglet", "Contenu"],
      [
        ["1", "Identité", "Photo, nom, prénom, date/lieu de naissance, sexe, nationalité, NPI, matricule, globalStudentId"],
        ["2", "Infos Admin", "Numéro de dossier, statut administratif, régime scolaire (Normal/Boursier/Enfant enseignant/Spécial), boursier, source du dossier"],
        ["3", "Responsables", "Père, mère, tuteur — téléphone, email, profession, adresse, relation"],
        ["4", "Scolarité", "Historique des inscriptions (StudentEnrollment), historique des mouvements (ClassTransfer)"],
        ["5", "Documents", "Acte de naissance, NPI, certificat de scolarité, bulletins, photos, autres"],
        ["6", "Carte scolaire", "Aperçu recto/verso de la carte, téléchargement PDF, N° de carte"],
        ["7", "Frais & Paiements", "Régime tarifaire, détail des frais (avec personnalisations), résumé (dû/payé/arriérés/solde), historique des transactions"],
        ["8", "Médical", "Allergies, vaccinations, contact médecin, traitement en cours, régime alimentaire (en cours d'implémentation)"],
        ["9", "Bulletins", "Bulletins par année et trimestre (en cours d'implémentation)"],
        ["10", "Observations", "Observations administratives, pédagogiques, disciplinaires, financières, familiales"],
        ["11", "Alertes ORION", "Alertes IA spécifiques à cet élève (risque d'abandon, données manquantes)"],
        ["12", "Audit", "Journal d'audit des actions sur ce dossier (pré-inscription, admission, réinscription, transfert, changement de classe)"],
      ],
      { colWidths: [500, 2200, 6300] },
    ),

    heading("9.4. Onglet Frais & Paiements — détail des frais personnalisés", HeadingLevel.HEADING_2),
    body("L'onglet Frais affiche désormais le DÉTAIL des frais (breakdowns) avec les montants personnalisés (overrides), conformément au module Finance > Compte Élève. Pour chaque ligne de frais :"),
    bullet("Le libellé du frais (FeeStructure.label)."),
    bullet("La catégorie (FeeStructure.feeCategory)."),
    bullet("Le montant standard (FeeStructure.amount)."),
    bullet("Le montant personnalisé si un override existe (FeeOverride.customAmount) — affiché en surbrillance ambrée."),
    bullet("Le montant standard barré si override appliqué."),
    bullet("Un badge « Personnalisé » + motif de l'override (FeeOverride.reason)."),
    body("Cette fonctionnalité est cruciale pour les élèves bénéficiant de réductions (ex : enfant enseignant, boursier, aide exceptionnelle). Elle garantit que le dossier élève affiche les mêmes montants que le module Finance, évitant les confusion entre parent et administration."),

    heading("9.5. Endpoints API", HeadingLevel.HEADING_2),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["GET", "/students/:id/documents", "Liste des documents de l'élève"],
        ["GET", "/students/movement-history?studentId=...&limit=50", "Historique des mouvements"],
        ["GET", "/students/:id/history", "Historique scolaire (enrollments + transfers)"],
        ["GET", "/students/:id/audit", "Journal d'audit"],
        ["GET", "/finance/student-accounts?studentId=...&academicYearId=...", "Compte financier (via Finance)"],
        ["GET", "/finance/student-accounts/:id", "Détails du compte (breakdowns + overrides)"],
      ],
      { colWidths: [900, 4600, 3500] },
    ),
  ];
}

function chapter10() {
  return [
    heading("10. Familles"),
    body("L'onglet Familles regroupe les élèves par fratrie. Une famille est identifiée par un parent commun (guardien). L'onglet permet de visualiser tous les enfants d'une même famille, leurs classes respectives, et les informations du responsable légal."),

    heading("10.1. Affichage", HeadingLevel.HEADING_2),
    bullet("Liste des familles avec le nom du responsable, le nombre d'enfants, et la classe de chaque enfant."),
    bullet("Photos des enfants affichées dans chaque carte de famille."),
    bullet("Filtres niveau + classe + recherche texte."),

    heading("10.2. Modèle StudentGuardian", HeadingLevel.HEADING_2),
    body("La relation élève-responsable est gérée par la table StudentGuardian avec :"),
    bullet("studentId, guardianId : relation plusieurs-à-plusieurs."),
    bullet("relationship : PARENT, GODPARENT, UNCLE, AUNT, OTHER."),
    bullet("isPrimary : true si c'est le responsable principal (contact prioritaire)."),
    bullet("Un Guardian peut être partagé entre plusieurs élèves (fratrie)."),

    heading("10.3. Gestion des responsables", HeadingLevel.HEADING_2),
    body("Chaque responsable (Guardian) possède :"),
    bullet("firstName, lastName."),
    bullet("phone, email (pour les notifications Email + WhatsApp + SMS)."),
    bullet("profession, address."),
    bullet("relation avec l'élève (PARENT / GODPARENT / etc.)."),
  ];
}

function chapter11() {
  return [
    heading("11. Transferts & Mobilité"),
    body("L'onglet Transferts & Mobilité gère les transferts d'élèves ENTRE établissements du réseau Academia Helm. C'est une fonctionnalité avancée qui permet à une école d'envoyer un dossier élève vers une autre école, qui peut l'accepter ou le refuser."),

    heading("11.1. Sous-onglets", HeadingLevel.HEADING_2),
    makeTable(
      ["Sous-onglet", "Description"],
      [
        ["Sortants", "Transferts initiés par cette école (élève part vers une autre école)"],
        ["Entrants", "Transferts reçus par cette école (élève arrive d'une autre école)"],
        ["Demandes reçues", "Demandes en attente de décision (accepter / refuser)"],
        ["Dossiers transférés", "Dossiers complets transférés (avec documents et parcours)"],
        ["Historique", "Tous les transferts (sortants + entrants) toutes années confondues"],
        ["Paramètres", "Configuration des notifications transfert"],
      ],
      { colWidths: [2500, 6500] },
    ),

    heading("11.2. Workflow des transferts", HeadingLevel.HEADING_2),
    body("Le workflow complet d'un transfert :"),
    makeTable(
      ["Statut", "Description"],
      [
        ["DRAFT", "Brouillon (école source prépare le transfert)"],
        ["REQUESTED", "Demande envoyée à l'école destination"],
        ["SENT_TO_DESTINATION", "Demande reçue par l'école destination"],
        ["ACCEPTED_BY_DESTINATION", "École destination a accepté"],
        ["APPROVED_BY_SOURCE", "École source a approuvé le départ"],
        ["COMPLETED", "Transfert exécuté — dossier copié côté destination"],
        ["REJECTED_BY_DESTINATION", "École destination a refusé"],
        ["CANCELLED", "Annulé par l'école source"],
        ["ARCHIVED", "Archivé (transfert ancien)"],
      ],
      { colWidths: [3000, 6000] },
    ),

    heading("11.3. TransferWizard — assistant de transfert", HeadingLevel.HEADING_2),
    body("L'assistant TransferWizard guide l'utilisateur en 3 étapes :"),
    bullet("Étape 1 — Sélection de l'élève : filtres niveau + classe + recherche texte (pattern identique à AdmissionsContent)."),
    bullet("Étape 2 — Sélection de l'école destination : liste des écoles du réseau avec logos, exclusion automatique de l'école tenante, recherche par ville."),
    bullet("Étape 3 — Confirmation : motif du transfert, message à l'école destination, niveau et classe demandés côté destination."),

    heading("11.4. Copie du dossier élève", HeadingLevel.HEADING_2),
    body("Lors de l'exécution du transfert (statut COMPLETED), le service StudentTransferService.execute() copie :"),
    bullet("L'identité complète de l'élève (nom, prénom, date/lieu de naissance, NPI, etc.)."),
    bullet("La photo de l'élève (si existante)."),
    bullet("Tous les documents d'admission (acte de naissance, NPI, bulletins, etc.)."),
    bullet("Les responsables légaux (Guardian)."),
    bullet("Le parcours scolaire (enrollments historiques)."),
    bullet("Le globalStudentId est CONSERVÉ (identifiant permanent cross-école)."),
    bullet("Un nouveau matricule local est attribué par l'école destination."),

    heading("11.5. Notifications automatiques", HeadingLevel.HEADING_2),
    body("À chaque étape du transfert, des notifications sont envoyées :"),
    bullet("École source + école destination : notification in-app + email pro à chaque changement de statut."),
    bullet("Parents : Email + WhatsApp + SMS (3 canaux en parallèle via Promise.allSettled) à chaque étape clé (demande envoyée, acceptée, refusée, exécutée)."),
    body("Le service StudentTransferService utilise les vrais services SmsService + WhatsAppService + EmailService (pattern identique au module Finance encaissements)."),

    heading("11.6. Endpoints API", HeadingLevel.HEADING_2),
    body("Contrôleur : StudentTransferController (@Controller('students/transfers'))"),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["POST", "/students/transfers", "Créer une demande de transfert"],
        ["GET", "/students/transfers/outgoing", "Liste des transferts sortants"],
        ["GET", "/students/transfers/incoming", "Liste des transferts entrants"],
        ["GET", "/students/transfers/search-schools", "Rechercher écoles destinataires"],
        ["POST", "/students/transfers/:id/approve", "Approuver (école destination)"],
        ["POST", "/students/transfers/:id/reject", "Refuser"],
        ["POST", "/students/transfers/:id/request-complement", "Demander des compléments"],
        ["POST", "/students/transfers/:id/confirm-exit", "Confirmer le départ (école source)"],
        ["POST", "/students/transfers/:id/execute", "Exécuter le transfert (copie dossier)"],
        ["GET", "/students/transfers/:id/dossier", "Récupérer le dossier transféré"],
      ],
      { colWidths: [900, 4200, 3900] },
    ),
  ];
}

function chapter12() {
  return [
    heading("12. Historique Scolaire"),
    body("L'onglet Historique Scolaire affiche, pour chaque élève, son parcours sur les 3 dernières années avec les décisions du conseil de classe (PROMOTED = passe en classe supérieure, REPEATED = redouble, EN COURS = année non clôturée)."),

    heading("12.1. Filtres disponibles", HeadingLevel.HEADING_2),
    bullet("Sélecteur Niveau scolaire (Maternelle / Primaire / Secondaire) — pattern TransferWizard."),
    bullet("Sélecteur Classe (conditionné au niveau sélectionné)."),
    bullet("Recherche texte (nom, prénom, matricule)."),

    heading("12.2. Affichage du parcours", HeadingLevel.HEADING_2),
    body("Pour chaque élève, un parcours visuel montre les 3 dernières années sous forme de cartes alignées :"),
    bullet("Libellé de l'année scolaire (ex : 2024-2025)."),
    bullet("Nom de la classe fréquentée."),
    bullet("Décision du conseil : PROMOTED (vert) / REPEATED (ambre) / EN COURS (gris)."),
    bullet("Moyenne éventuelle (ex : 14.5/20)."),
    bullet("Icône cadenas si l'année est verrouillée (conseil de classe passé)."),

    heading("12.3. Légende intégrée", HeadingLevel.HEADING_2),
    body("Une légende en haut du tableau explique chaque code couleur et icône, rendant l'onglet auto-explicatif :"),
    bullet("PROMOTED : passe en classe supérieure."),
    bullet("REPEATED : redouble l'année."),
    bullet("EN COURS : année en cours (non clôturée)."),
    bullet("Cadenas fermé : année verrouillée (conseil passé)."),
    bullet("Cadenas ouvert : année ouverte (modifiable)."),

    heading("12.4. Bouton « Dossier Complet »", HeadingLevel.HEADING_2),
    body("Chaque ligne possède un bouton « Dossier Complet » qui bascule vers l'onglet Dossiers Élèves avec présélection automatique de l'élève via la query string ?tab=dossiers&studentId=xxx. StudentsModulePage lit tab pour activer l'onglet, et StudentIdentityContent lit studentId au montage pour précharger la carte de l'élève sélectionné."),
  ];
}

function chapter13() {
  return [
    heading("13. Educmaster"),
    body("L'onglet Educmaster gère l'export des données élèves vers la plateforme gouvernementale Educmaster (emp.educmaster.bj — ministère des enseignements maternel et primaire / secondaire au Bénin). L'export produit un fichier Excel par niveau (Maternelle ou Primaire), conforme aux templates officiels."),

    heading("13.1. Format du fichier Excel", HeadingLevel.HEADING_2),
    body("Le fichier Excel généré respecte exactement les colonnes officielles d'Educmaster :"),
    makeTable(
      ["#", "Colonne", "Source"],
      [
        ["1", "Nom", "Student.lastName (majuscules)"],
        ["2", "Prénom (s)", "Student.firstName"],
        ["3", "Sexe", "Student.gender (M/F)"],
        ["4", "Date de naissance", "Student.dateOfBirth (format JJ/MM/AAAA)"],
        ["5", "Lieu de naissance", "Student.placeOfBirth"],
        ["6", "Téléphone de parents", "Guardian.phone (tous, séparés par /)"],
        ["7", "Nationalité", "Student.nationality"],
        ["8", "NPI", "Student.npi"],
      ],
      { colWidths: [500, 2800, 5700] },
    ),

    heading("13.2. Structure par niveau", HeadingLevel.HEADING_2),
    bullet("Maternelle : un fichier, feuilles « Maternelle 1 » et « Maternelle 2 » (une feuille par classe officielle)."),
    bullet("Primaire : un fichier, feuilles CI, CP, CE1, CE2, CM1, CM2 (une feuille par classe officielle)."),
    body("Les élèves sans classe officielle (academicClassId null) vont dans une feuille « Non classés »."),

    heading("13.3. Résolution du SchoolLevel", HeadingLevel.HEADING_2),
    body("Le frontend envoie le CODE du niveau (MATERNELLE / PRIMAIRE) plutôt qu'un UUID, ce qui élimine toute ambiguïté entre education_levels.id et school_levels.id. Le backend résout le SchoolLevel par :"),
    bullet("Match exact sur code (ex : MATERNELLE) — insensible à la casse."),
    bullet("Fallback : match sur name ou label (insensible à la casse)."),
    bullet("Fallback final : par UUID schoolLevelId (rétro-compatibilité)."),

    heading("13.4. Récupération des élèves", HeadingLevel.HEADING_2),
    body("Le service EducmasterExcelExportService interroge StudentEnrollment par (tenantId, academicYearId, schoolLevelId) — c'est la source de vérité. Les élèves sont ensuite groupés par AcademicClass (une feuille Excel par classe officielle)."),

    heading("13.5. Nom du fichier généré", HeadingLevel.HEADING_2),
    body("Le nom du fichier suit le format : NomEcole_Niveau.xlsx (ex : EcoleSainteMarie_Maternelle.xlsx). Le frontend récupère ce nom depuis le Content-Disposition du backend."),

    heading("13.6. Logs d'export (NationalExportLog)", HeadingLevel.HEADING_2),
    body("Chaque export est tracé dans la table NationalExportLog avec :"),
    bullet("tenantId, studentId (un log par élève exporté)."),
    bullet("exportType : EDUCMASTER."),
    bullet("exportedAt : timestamp."),
    bullet("status : SUCCESS / FAILED."),

    heading("13.7. Endpoints API", HeadingLevel.HEADING_2),
    makeTable(
      ["Méthode", "Route", "Description"],
      [
        ["GET", "/students/export/educmaster-excel?academicYearId=...&code=MATERNELLE", "Génère l'Excel Educmaster (code = MATERNELLE/PRIMAIRE/SECONDAIRE)"],
        ["GET", "/students/export/educmaster-excel?academicYearId=...&schoolLevelId=...", "Génère l'Excel (fallback par UUID)"],
        ["POST", "/students/:id/export-educmaster", "Export JSON individuel (legacy)"],
      ],
      { colWidths: [900, 5200, 2900] },
    ),
  ];
}

function chapter14() {
  return [
    heading("14. ORION, Stats & Audit"),
    body("Le dernier onglet combine trois fonctions complémentaires : les statistiques avancées du module, les alertes IA ORION, et l'audit des actions. Cette fusion évite l'éparpillement et offre une vue consolidée de la santé du module."),

    heading("14.1. Statistiques avancées", HeadingLevel.HEADING_2),
    bullet("Évolution des effectifs sur 5 ans (graphique linéaire)."),
    bullet("Répartition par genre (M/F) par niveau."),
    bullet("Taux de réussite par classe (basé sur les décisions PROMOTED vs REPEATED)."),
    bullet("Taux d'abandon par niveau (sorties vs effectif total)."),
    bullet("Cartes scolaires : générées / manquantes / par niveau."),
    bullet("Admissions : taux d'acceptation, délai moyen de décision."),

    heading("14.2. Alertes ORION IA (GLM-5.2)", HeadingLevel.HEADING_2),
    body("ORION est l'IA intégrée à Academia Helm, propulsée par GLM-5.2 via z-ai-web-dev-sdk. Elle analyse en continu les données du module Élèves et génère des alertes prédictives :"),
    bullet("Risque d'abandon : élève avec absences répétées + baisse de notes + retard de paiement."),
    bullet("Risque de redoublement : moyenne en chute libre sur les derniers contrôles."),
    bullet("Données manquantes : NPI manquant, photo manquante, responsable sans téléphone."),
    bullet("Doublons potentiels : même nom + même date de naissance entre 2 élèves."),
    bullet("Incohérences : élève actif sans inscription, élève sans classe officielle."),
    body("Chaque alerte a une sévérité (CRITICAL / HIGH / MEDIUM / LOW) et peut être marquée comme résolue par un administrateur."),

    heading("14.3. Widget ORION flottant", HeadingLevel.HEADING_2),
    body("Un widget ORION flottant (OrionWidget) est disponible dans toute l'application, permettant de poser des questions en langage naturel à l'IA. Le service OrionAiService expose deux méthodes :"),
    bullet("chat() : conversation multi-tour avec contexte du module."),
    bullet("analyze() : analyse d'une situation spécifique (élève, classe, niveau)."),

    heading("14.4. Audit des actions", HeadingLevel.HEADING_2),
    body("Chaque action du Module Élèves est tracée dans un journal d'audit :"),
    bullet("pre-register : pré-inscription publique."),
    bullet("admit : admission d'un élève."),
    bullet("re-enroll : réinscription."),
    bullet("transfer : transfert inter-écoles."),
    bullet("change-class : changement de section physique."),
    bullet("change-series : changement de série (Secondaire)."),
    bullet("withdraw : sortie d'élève."),
    bullet("reintegrate : réintégration."),
    bullet("generate-id-card : génération de carte."),
    bullet("export-educmaster : export Educmaster."),
    body("Chaque entrée d'audit contient : userId, action, entityId (studentId), timestamp, before/after state (JSON), tenantId."),

    heading("14.5. Conformité et audit-proof", HeadingLevel.HEADING_2),
    body("Le module est conçu pour être audit-proof :"),
    bullet("Toutes les modifications sont tracées (table AuditLog)."),
    bullet("Les suppressions sont soft-delete (isActive = false) plutôt que des DELETE physiques."),
    bullet("Les exports Educmaster sont immuables (NationalExportLog non modifiable après création)."),
    bullet("Les PDFs générés sont stockés en DB (GeneratedDocument) avec hash et timestamp."),
    bullet("Les transferts inter-écoles laissent une trace dans les deux établissements."),
  ];
}

function chapter15() {
  return [
    heading("15. Architecture technique détaillée"),

    heading("15.1. Modèles Prisma principaux", HeadingLevel.HEADING_2),
    makeTable(
      ["Modèle", "Table SQL", "Rôle"],
      [
        ["Student", "students", "Élève (identité, NPI, matricule, globalStudentId, photo)"],
        ["StudentEnrollment", "student_enrollments", "Inscription annuelle (academicClassId + classId)"],
        ["StudentGuardian", "student_guardians", "Relation élève ↔ responsable (plusieurs-à-plusieurs)"],
        ["Guardian", "guardians", "Responsable légal (peut être partagé entre fratrie)"],
        ["Admission", "admissions", "Candidature (workflow DRAFT → CONVERTED)"],
        ["AdmissionDocument", "admission_documents", "Documents d'admission (uploadés par parent)"],
        ["AdmissionInterview", "admission_interviews", "Entretiens d'admission"],
        ["ClassTransfer", "class_transfers", "Changement de section physique ou de série"],
        ["StudentTransferRequest", "student_transfer_requests", "Transfert inter-écoles"],
        ["GeneratedDocument", "generated_documents", "PDFs générés (listes de classe, contrats, etc.)"],
        ["NationalExportLog", "national_export_logs", "Log d'export Educmaster (immuable)"],
        ["StudentFeeProfile", "student_fee_profiles", "Régime tarifaire de l'élève (normal, boursier, etc.)"],
        ["StudentAccount", "student_accounts", "Compte financier annuel de l'élève"],
        ["AcademicClass", "pedagogy_academic_classes", "Classe officielle (CE1, CP, 6ème)"],
        ["Class", "classes", "Classe physique / section (CE1-A, CE1-B)"],
      ],
      { colWidths: [2200, 2700, 4100] },
    ),

    heading("15.2. Identifiants distincts", HeadingLevel.HEADING_2),
    body("Le module gère 3 identifiants distincts par élève, souvent confondus :"),
    makeTable(
      ["Identifiant", "Format", "Usage", "Modifiable"],
      [
        ["Matricule Academia Helm", "AH-STU-YYYY-NNNNNNNNN", "Identifiant interne établissement", "Non (généré automatiquement)"],
        ["NPI", "13 chiffres", "Numéro d'Identification Personnel (citoyens béninois)", "Non (attribué par l'État)"],
        ["Numéro Educmaster", "Attribué par MEMP", "Identifiant plateforme gouvernementale", "Non (attribué par emp.educmaster.bj)"],
      ],
      { colWidths: [2500, 2500, 3000, 1000] },
    ),

    heading("15.3. Multi-tenant", HeadingLevel.HEADING_2),
    body("Toutes les tables sont préfixées par tenantId (UUID de l'établissement). Le décorateur @TenantId() extrait automatiquement le tenant depuis le JWT ou le header x-tenant-id. Le SchoolLevelId decorator résout le niveau scolaire actif depuis :"),
    bullet("Priorité 1 : contexte admin (ContextInterceptor)."),
    bullet("Priorité 2 : request.schoolLevelId (param query)."),
    bullet("Priorité 3 : header x-school-level-id."),

    heading("15.4. Notifications multi-canaux", HeadingLevel.HEADING_2),
    body("Le module utilise 3 canaux de notification en parallèle (Promise.allSettled pour résilience) :"),
    bullet("Email : EmailService (avec traçabilité EmailLog + tracking ouvertures)."),
    bullet("WhatsApp : WhatsAppService (avec templates WhatsAppTemplateRegistry + log)."),
    bullet("SMS : SmsService (Twilio ou SMS Gateway, avec normalization E.164)."),
    body("Le pattern est identique au module Finance (encaissements) — les 3 services sont importés depuis CommunicationModule."),

    heading("15.5. Génération PDF via Puppeteer", HeadingLevel.HEADING_2),
    body("Tous les PDFs du module (listes de classe, cartes scolaires, dossiers) sont générés via PuppeteerPoolService qui maintient un pool de pages Chrome réutilisables. Le HTML est construit côté backend, rendu par Chromium, puis exporté en PDF A4 avec en-tête officiel."),
    body("Le pool évite le coût de démarrage d'une nouvelle instance Chrome à chaque génération. Les pages sont acquises via acquirePage() et relâchées via releasePage()."),

    heading("15.6. Routes BFF (Next.js)", HeadingLevel.HEADING_2),
    body("Le frontend Next.js ne communique jamais directement avec le backend NestJS. Toutes les requêtes passent par des routes BFF (Backend-for-Frontend) sous /api/ qui :"),
    bullet("Injectent les headers d'authentification (JWT, tenantId)."),
    bullet("Gèrent le proxy HTTPS vers le backend Fly.io."),
    bullet("Normalisent les réponses (pagination, erreurs)."),
    bullet("Contournent les limitations du backend (ex : /api/all-classes pour éviter le forbidNonWhitelisted du PaginationDto)."),
  ];
}

function chapter16() {
  return [
    heading("16. Bonnes pratiques et points d'attention"),

    heading("16.1. Sécurité et accès aux données", HeadingLevel.HEADING_2),
    bullet("Tous les accès aux données élèves sont sécurisés par JwtAuthGuard + TenantGuard."),
    bullet("Le décorateur @TenantId() garantit qu'un admin ne voit que les élèves de son établissement."),
    bullet("Les routes publiques (pré-inscription, vérification QR) sont explicitement marquées comme telles et n'exposent que les données minimales."),

    heading("16.2. Performance et optimisation", HeadingLevel.HEADING_2),
    bullet("Utiliser Promise.allSettled (et non Promise.all) pour les notifications multi-canaux — un échec WhatsApp ne doit pas bloquer l'email."),
    bullet("Pour les listes longues (getAll), paginer côté backend (limit=200 max)."),
    bullet("Les PDFs générés sont stockés en DB une fois, puis visualisés instantanément sans regénérer."),
    bullet("PuppeteerPoolService réutilise les pages Chrome — éviter de créer des nouvelles instances."),
    bullet("Pour Educmaster, récupérer les élèves via StudentEnrollment.schoolLevelId (FK directe) plutôt que via une jointure complexe."),

    heading("16.3. Conformité réglementaire Bénin", HeadingLevel.HEADING_2),
    bullet("Tous les PDFs officiels (listes de classe, cartes) incluent l'en-tête ministériel adapté au niveau (MEMP pour Maternelle/Primaire, MESFTPRIJ pour Secondaire)."),
    bullet("Le drapeau du Bénin est intégré en SVG data URL dans tous les PDFs."),
    bullet("L'export Educmaster respecte strictement l'ordre et les libellés des colonnes officielles."),
    bullet("Le NPI est collecté et exporté (obligatoire pour emp.educmaster.bj)."),
    bullet("Les logs d'export (NationalExportLog) sont immuables pour audit."),

    heading("16.4. Patterns à respecter", HeadingLevel.HEADING_2),
    bullet("Pattern TransferWizard pour les filtres niveau + classe + recherche (cohérence UI)."),
    bullet("Pattern PDF generate + visualiser (générer une fois, visualiser N fois)."),
    bullet("Pattern notifications multi-canaux via CommunicationModule (Email + WhatsApp + SMS)."),
    bullet("Pattern fallback || undefined pour sécuriser tous les accès aux propriétés imbriquées."),

    heading("16.5. Pièges à éviter", HeadingLevel.HEADING_2),
    bullet("Ne pas confondre classe officielle (AcademicClass) et classe physique (Class) — c'est la cause #1 de bugs."),
    bullet("Ne pas utiliser schoolLevelId ou education_levels.id indifféremment — toujours envoyer le CODE (MATERNELLE/PRIMAIRE) pour résoudre sans ambiguïté."),
    bullet("Ne pas oublier d'inclure academicClass dans getEnrollments — sinon l'onglet Inscriptions ne peut pas grouper par classe officielle."),
    bullet("Ne pas créer un PDF sans metadata.mode — cela provoque des collisions entre PDFs officiels et physiques de la même classe."),
    bullet("Ne pas appeler /api/classes sans header x-school-level-id=ALL — le PaginationDto rejecte schoolLevelId=ALL (400 Bad Request)."),
  ];
}

function chapter17() {
  return [
    heading("17. Évolutions futures et roadmap"),

    heading("17.1. Modules en cours d'implémentation", HeadingLevel.HEADING_2),
    bullet("Onglet Médical du dossier élève : allergies, vaccinations, contact médecin, traitement en cours, régime alimentaire. Infrastructure Prisma déjà en place (InfirmaryMedicalRecord, InfirmaryAllergy, InfirmaryVisit, etc.)."),
    bullet("Onglet Bulletins du dossier élève : bulletins par année et trimestre. Nécessite l'intégration avec le module Notes & Évaluations (à venir)."),

    heading("17.2. Améliorations planifiées", HeadingLevel.HEADING_2),
    bullet("Recherche globale élève (barre de recherche transversale dans le header)."),
    bullet("Export PDF du dossier complet élève (tous les onglets en un seul PDF)."),
    bullet("Import en masse des admissions depuis Excel (template téléchargeable)."),
    bullet("Intégration Fedapay pour paiement en ligne des frais de scolarité."),
    bullet("Signature électronique des contrats d'inscription (Tamperproof audit)."),

    heading("17.3. Intégrations prévues", HeadingLevel.HEADING_2),
    bullet("ANIP (Agence Nationale d'Identification des Personnes) — synchronisation NPI."),
    bullet("API gouvernementale Educmaster — envoi direct JSON (au lieu d'Excel manuel)."),
    bullet("Module Pedago : synchronisation automatique des classes officielles vers le module Élèves."),
    bullet("Module Transport : affectation des élèves aux bus scolaires."),
    bullet("Module Cantine : inscriptions cantine et allergies alimentaires."),
  ];
}

// ============================================================================
// ASSEMBLY
// ============================================================================
const allChapters = [
  ...chapter1(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter2(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter3(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter4(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter5(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter6(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter7(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter8(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter9(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter10(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter11(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter12(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter13(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter14(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter15(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter16(),
  new Paragraph({ children: [new PageBreak()] }),
  ...chapter17(),
];

const doc = new Document({
  creator: "Academia Helm",
  title: "Module Élèves — Documentation complète",
  description: "Documentation technique et fonctionnelle du Module Élèves Academia Helm",
  styles: {
    default: {
      document: {
        run: {
          font: { ascii: "Calibri", eastAsia: "Calibri" },
          size: 22,
          color: c(P.body),
        },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 120, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri" }, size: 30, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [
    // 1. Cover section
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
      children: buildCover(),
    },
    // 2. TOC section
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              children: [PageNumber.CURRENT],
              size: 18, color: c(P.secondary), font: { ascii: "Calibri" },
            })],
          })],
        }),
      },
      children: buildToc(),
    },
    // 3. Body section
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: c(P.accent), space: 4 } },
            children: [new TextRun({
              text: "Academia Helm — Module Élèves",
              size: 18, color: c(P.secondary), italics: true,
              font: { ascii: "Calibri" },
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Page ",
                size: 18, color: c(P.secondary), font: { ascii: "Calibri" },
              }),
              new TextRun({
                children: [PageNumber.CURRENT],
                size: 18, color: c(P.secondary), font: { ascii: "Calibri" },
              }),
              new TextRun({
                text: " / ",
                size: 18, color: c(P.secondary), font: { ascii: "Calibri" },
              }),
              new TextRun({
                children: [PageNumber.TOTAL_PAGES],
                size: 18, color: c(P.secondary), font: { ascii: "Calibri" },
              }),
            ],
          })],
        }),
      },
      children: allChapters,
    },
  ],
});

// ============================================================================
// WRITE
// ============================================================================
const OUTPUT = "/home/z/my-project/download/Module_Eleves_Academia_Helm.docx";
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUTPUT, buf);
  console.log(`✅ Document généré : ${OUTPUT}`);
  console.log(`   Taille : ${(buf.length / 1024).toFixed(1)} Ko`);
});
