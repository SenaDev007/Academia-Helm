/**
 * ============================================================================
 * FICHE VISION EXTRACTION SERVICE — Extraction IA des fiches pédagogiques
 * ============================================================================
 *
 * ⭐ 2026-10-16 — NOUVELLE CAPACITÉ (demande promoteur) :
 * Les enseignants disposent sur le terrain de fiches pédagogiques déjà
 * préparées (PDF / Word / photocopies) mais portant des filigranes (nom de
 * l'auteur d'origine) — refusées par les écoles car non rédigées par
 * l'enseignant lui-même. Ce service permet à l'enseignant de soumettre des
 * CAPTURES de ces fiches ; les modèles vision de NVIDIA (build.nvidia.com)
 * extraient le contenu et notre interface de préparation de fiche se remplit
 * automatiquement, champ par champ, selon le type de fiche choisi.
 *
 * Workflow :
 *   1. L'enseignant ouvre une fiche dans l'Espace Pédagogique et choisit son
 *      type (MATH, FRANCAIS, EST, ES, EA, EPS, STANDARD, DOMAINE, DOMAINE_2).
 *   2. Il clique « Extraire depuis des captures (IA) » et dépose 1 à 6
 *      captures (JPEG/PNG compressées côté navigateur).
 *   3. Ce service construit le schéma JSON EXACT des champs du type de fiche
 *      visé et l'envoie aux modèles vision NVIDIA avec les images en base64.
 *   4. La réponse JSON est parsée robustement (balises markdown, texte
 *      parasite), filtrée sur une liste blanche de champs, puis retournée.
 *   5. Le frontend pré-remplit le formulaire ; l'enseignant VÉRIFIE, ajuste
 *      et enregistre — la fiche finale est rédigée sous SON compte, sans
 *      filigrane d'origine.
 *
 * Modèles (API OpenAI-compatible https://integrate.api.nvidia.com/v1 — même
 * gateway que le reste de la plateforme, variable NVIDIA_API_KEY) :
 *   - Modèle principal : nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
 *     (omni-modal, OCR de référence, ACCEPTE PLUSIEURS IMAGES par requête —
 *     indispensable pour une fiche répartie sur plusieurs captures).
 *   - Modèle de repli : meta/llama-3.2-90b-vision-instruct (vision de haute
 *     qualité, multi-images également).
 *   - meta/llama-3.2-11b-vision-instruct écarté : UNE SEULE image par
 *     requête + réduction automatique à 1120px (support-matrix NVIDIA NIM).
 *
 * Variables d'environnement :
 *   - NVIDIA_API_KEY       : clé API build.nvidia.com (déjà utilisée par le
 *                            gateway IA central — openrouter.service.ts).
 *   - NVIDIA_VISION_MODEL  : modèle vision principal
 *                            (défaut : nvidia/nemotron-3-nano-omni-30b-a3b-reasoning)
 *   - NVIDIA_VISION_FALLBACK : modèle de repli
 *                            (défaut : meta/llama-3.2-90b-vision-instruct)
 * ============================================================================
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenRouterService } from '../common/services/openrouter.service';

// ─── Limites de sécurité ────────────────────────────────────────────────────

const MAX_IMAGES = 6;
const MAX_BASE64_LENGTH_PER_IMAGE = 700_000; // ~700 Ko base64 ≈ 520 Ko binaire
const MAX_TOTAL_BASE64_LENGTH = 4_000_000; // < limite JSON body 5 Mo
// ⭐ 45 s par tentative de modèle : le BFF Next.js (Vercel) proxifie
//    /api/pedagogy-space/* avec maxDuration 60 s — une extraction de
//    10 à 30 s est le cas nominal ; au-delà de 45 s le modèle principal
//    est abandonné au profit du repli plutôt que de faire mourir la
//    requête côté Vercel (504 silencieux pour l'enseignant).
const EXTRACTION_TIMEOUT_MS = 45_000;

// ─── Schémas des champs par type de fiche (listes blanches) ─────────────────
// Chaque entrée : [clé du formulaire, description pour le modèle]

type FieldSpec = Record<string, string>;

const PRIMAIRE_HEADER_FIELDS: FieldSpec = {
  san: "N° du SAN (Séquence d'Apprentissage N°) tel qu'écrit sur la fiche (chiffre seul)",
  sequence: "N° de la séquence",
  lessonDate: "Date de la leçon au format AAAA-MM-JJ si visible (sinon chaîne vide)",
  cours: "Cours / classe concernée (ex: CE1)",
  titre: "Titre de la leçon tel qu'écrit en haut de fiche (ex: Vocabulaire thématique, Le pluriel des noms) — ne pas y recopier le THEME",
  duree: "Durée de la leçon (ex: 30 min, 45 minutes)",
  fn: "N° de la fiche (Fn°)",
  dossier: "N° du dossier (DOSSIER N°)",
  theme: "THEME principal de la fiche (ex: L'homme et sa santé)",
  saTheme: "Thème (sous-thème SA) — la ligne « Thème : » sous le thème principal",
  seance: "N° de la séance",
  unite: "N° de l'unité (français)",
  etape: "N° de l'étape (français)",
  matiereSpecifique: "Matière spécifique (français : Dictée, Vocabulaire, Lecture, Grammaire, Conjugaison, Orthographe, Expression écrite, Production écrite...) — catégorie seule, ex: Vocabulaire",
};

const PLANNING_FIELDS: FieldSpec = {
  competence: "I-1. Compétences disciplinaires (ex: Communiquer oralement…)",
  habilete: "I-2. Compétences transversales (habiletés)",
  prealable: "I-3. Compétences transdisciplinaires / préalables",
  contenu: "I-4. Connaissances et techniques / Composantes et techniques — ET, pour une fiche de VOCABULAIRE, les ressources lexicales (une catégorie par ligne : Noms : … / Verbes : … / Adjectifs qualificatifs : … / Autres : …)",
  methodes: "I-5. Stratégie objet d'apprentissage (méthodes / stratégies)",
  moyensDidactiques: "I-6. Stratégie d'enseignement/apprentissage/évaluation, moyens et SUPPORTS DIDACTIQUES (texte support, images, documents…)",
  evaluation: "I-7. Matériel / supports d'évaluation (rubrique Matériel et évaluation si fusionnée — sinon matériel dans moyensDidactiques)",
};

const RETOUR_FIELDS: FieldSpec = {
  objectivation: "III- Objectivation (consigne/activité de retour)",
  objectivationResultat: "III- Objectivation — résultat attendu",
  evalRetour: "III- Évaluation (retour)",
  evalRetourResultat: "III- Évaluation — résultat attendu",
  projection: "III- Projection (leçon suivante / réinvestissement)",
  projectionResultat: "III- Projection — résultat attendu",
  retenons: "RETENONS — leçon à retenir (synthèse en bas de fiche)",
};

const PRIMAIRE_COMMON_FIELDS: FieldSpec = {
  ...PRIMAIRE_HEADER_FIELDS,
  ...PLANNING_FIELDS,
  ...RETOUR_FIELDS,
};

const IBIS_FIELDS_BY_TYPE: Record<string, FieldSpec> = {
  MATH: {
    ibis_1: "Phases préparatoires — Calcule à brûle pourpoint",
    ibis_2: "Phases préparatoires — Comptage/Décomptage ou table de multiplication",
    ibis_3: "Phases préparatoires — Cadran opératoire (en rapport avec les opérations étudiées)",
    ibis_4: "Phases préparatoires — Calcul mental",
    ibis_5: "Phases préparatoires — Deux problèmes à résoudre mentalement",
  },
  FRANCAIS: {
    ibis_1: "Exercice structural — Unité N°",
    ibis_2: "Exercice structural — Structure",
    ibis_3: "Exercice structural — Objectif",
    ibis_4: "Exercice structural — Fiche N°",
    ibis_5: "Exercice structural — Durée (ex: 10 min)",
    phase_intro_ens1: "Exercice structural — Phase introductive, colonne Enseignant (1re) — CONTENU des cellules, jamais le titre de la colonne",
    phase_intro_ens2: "Exercice structural — Phase introductive, colonne Enseignant (2e) — CONTENU des cellules, jamais le titre de la colonne",
    phase_syst_ens: "Exercice structural — Phase de systématisation, colonne Enseignant — CONTENU des cellules, jamais le titre de la colonne",
    phase_syst_app: "Exercice structural — Phase de systématisation, colonne Apprenant — CONTENU des cellules, jamais le titre de la colonne",
    app_col1: "Phase d'application — colonne « Entrées Enseignant(e) ou élève » — CONTENU des cellules, jamais le titre de la colonne",
    app_col2: "Phase d'application — colonne « Structure Élève 1 » — CONTENU des cellules, jamais le titre de la colonne",
    app_col3: "Phase d'application — colonne « Réduction Élève 2 » — CONTENU des cellules, jamais le titre de la colonne",
  },
  EST: {
    ibis_1: "Activités préliminaires — Rappel de la leçon précédente",
  },
  ES: {
    ibis_1: "Activités préliminaires — Rappel de la leçon précédente",
  },
  EA: {
    ibis_1: "Proposition de nouvelles acquisitions — Annoncer l'objet d'apprentissage (titre du chant/dessin)",
    ibis_2: "Proposition de nouvelles acquisitions — Pré-conception",
  },
  EPS: {
    ibis_1: "Proposition de nouvelles acquisitions — Annoncer l'objet d'apprentissage (titre de l'activité physique et sportive)",
    ibis_2: "Proposition de nouvelles acquisitions — Pré-conception",
  },
  STANDARD: {
    ibis_1: "Activités préliminaires — Rappel de la leçon précédente",
    ibis_2: "Vocabulaire / notions nouvelles de la séance",
  },
};

// Champs communs à TOUS les types primaires (liste blanche finale)
// ⭐ "deroulement" DOIT figurer ici : c'est le tableau II- Déroulement,
//    traité spécifiquement par sanitizeFields() — sans lui, l'extraction
//    du déroulement était rejetée avec « non prévu pour ce type de fiche »
//    (bug constaté au test du 2026-10-16 avec la fiche CM1 réelle).
const ALL_PRIMAIRE_KEYS = new Set<string>([
  ...Object.keys(PRIMAIRE_COMMON_FIELDS),
  ...Object.values(IBIS_FIELDS_BY_TYPE).flatMap(f => Object.keys(f)),
  'deroulement',
]);

// ─── Bruit OCR : libellés de rubriques et titres de colonnes ────────────────
// ⭐ 2026-10-16 (test avec fiche CM1 réelle) : les modèles de vision recopient
//    parfois le TITRE d'une colonne ou d'une rubrique au lieu de son contenu
//    (ex : app_col1 = « Enseignant », habilete = « Compétences transversales »).
//    Ces valeurs n'apportent rien — les libellés existent déjà dans le
//    formulaire — on les rejette donc silencieusement (comparaison insensible
//    à la casse/accents et aux espaces multiples, ≤ 60 caractères).

const RUBRIC_LABEL_NOISE = new Set([
  // Titres de colonnes des tableaux de fiche
  'enseignant', 'enseignant(e)', 'enseignante', 'apprenant', 'apprenants',
  'apprenant 1', 'apprenants 1', 'apprenant 2', 'apprenants 2',
  'élève 1', 'élève 2', 'entrées enseignant(e) ou élève',
  'structure élève 1', 'réduction élève 2',
  'consignes', 'résultats attendus', "activités de l'enseignant",
  "activités des apprenants", 'n°', 'etape', 'durée', 'plan',
  'description des activités', 'formation', 'évolution', 'dosage',
  // Libellés de rubriques (valeur = libellé seul → rubrique vide sur la fiche)
  'éléments de planification', 'déroulement', 'retour et projection',
  'exercice structural', 'phase introductive', 'phase de systématisation',
  "phase d'application", 'objectivation', 'évaluation', 'projection',
  'retenons', 'compétences disciplinaires', 'compétences transversales',
  'composantes et techniques', 'supports didactiques', 'matériel',
  'rangement', 'mise en situation', 'acquis antérieurs',
  "annonce de l'apprentissage", 'situation problème',
]);

function isRubricLabelNoise(text: string): boolean {
  const normalized = String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s ]+/g, ' ');
  return normalized.length > 0 && normalized.length <= 60 && RUBRIC_LABEL_NOISE.has(normalized);
}

// ─── Maternelle (DOMAINE / DOMAINE_2) — structure imbriquée ────────────────

const MATERNELLE_FIELDS: FieldSpec = {
  'maternelle.ficheDe': "Fiche de (nom de l'enseignante si mentionné)",
  'maternelle.domainNumber': "N° du domaine (ex: 1, 3, IV)",
  'maternelle.domaineDu': "Domaine de... (intitulé du domaine)",
  'maternelle.composante': "Composante",
  'maternelle.sousComposante': "Sous-composante",
  'maternelle.activiteNumero': "Activité N°",
  'maternelle.theme': "Thème",
  'maternelle.titre': "Titre de l'activité",
  'maternelle.section': "Section (ex: PS, MS, GS)",
  'maternelle.duree': "Durée",
  'maternelle.materiel': "Matériel",
  'maternelle.competence': "Compétence",
  'maternelle.capacite': "Capacité",
  'maternelle.habiletes': "Habiletés",
  'maternelle.strategies': "Stratégies",
  'maternelle.realisation': "RÉALISATION (texte de l'activité) — DOMAINE",
  'maternelle.situationProbleme': "DOMAINE_2 — Situation problème",
  'maternelle.questionComprehension': "DOMAINE_2 — Question de compréhension",
  'maternelle.activites.a1': "DOMAINE_2 — Activité 1",
  'maternelle.activites.nb2': "DOMAINE_2 — consigne/note activité 1 (colonne NB2)",
  'maternelle.activites.a2': "DOMAINE_2 — Activité 2",
  'maternelle.activites.nb3': "DOMAINE_2 — consigne/note activité 2 (colonne NB3)",
  'maternelle.activites.a3': "DOMAINE_2 — Activité 3",
  'maternelle.intro.miseEnSituation': "INTRODUCTION — Mise en situation",
  'maternelle.intro.acquisAnterieurs': "INTRODUCTION — Acquis antérieurs",
  'maternelle.intro.annonceApprentissage': "INTRODUCTION — Annonce de l'apprentissage",
  'maternelle.retour': "RETOUR ET PROJECTION — Retour",
  'maternelle.evaluation': "RETOUR ET PROJECTION — Évaluation",
  'maternelle.connexion': "RETOUR ET PROJECTION — Connexion",
  'maternelle.projection': "RETOUR ET PROJECTION — Projection",
  'maternelle.rangement': "RANGEMENT",
  'maternelle.notesPersonnelles': "Notes personnelles",
};

const MATERNELLE_KEYS = new Set(Object.keys(MATERNELLE_FIELDS));

// ─── Types de fiches reconnus ───────────────────────────────────────────────

const KNOWN_SHEET_TYPES = new Set([
  'MATH', 'FRANCAIS', 'EST', 'ES', 'EA', 'EPS', 'STANDARD',
  'DOMAINE', 'DOMAINE_2',
]);

const SHEET_TYPE_LABELS: Record<string, string> = {
  MATH: 'Mathématiques',
  FRANCAIS: 'Français',
  EST: 'Éducation Scientifique et Technologique (EST)',
  ES: 'Éducation Sociale (ES)',
  EA: 'Éducation Artistique (EA)',
  EPS: 'Éducation Physique et Sportive (EPS)',
  STANDARD: 'Anglais / Informatique (fiche standard)',
  DOMAINE: 'Maternelle — fiche Domaine',
  DOMAINE_2: 'Maternelle — fiche Domaine 2',
};

// ─── Structure de référence par type de fiche (guide du modèle vision) ──────
// ⭐ 2026-10-16 (validation avec capture réelle — fiche de français CM1
// « Vocabulaire thématique » fournie par le promoteur) : pour que l'IA
// « connaisse » la structure de chaque catégorie de fiche (français, maths,
// EST…, maternelle) et range chaque zone lue sur la capture dans le bon
// champ, on décrit au modèle la STRUCTURE CANONIQUE attendue : ordre des
// zones, libellés alternatifs rencontrés sur le terrain, et règles de
// dispatch quand une zone n'a pas de champ dédié (ex: les ressources
// lexicales d'une fiche de vocabulaire vont dans « contenu »).

const SHEET_TYPE_GUIDANCE: Record<string, string> = {
  FRANCAIS: `Zone d'en-tête : Cours, Durée, Date, Unité d'apprentissage N°, Étape N°, THÈME (ex: « L'homme et sa santé » → theme) et MATIÈRE SPÉCIFIQUE (Dictée, Vocabulaire, Lecture, Grammaire, Conjugaison, Orthographe, Expression écrite, Production écrite… → catégorie seule dans matiereSpecifique). Le TITRE de la leçon (ex: « Vocabulaire thématique ») va dans titre.
Zone I. ÉLÉMENTS DE PLANIFICATION : « Compétences disciplinaires » → competence ; « Compétences transversales » → habilete (sans répéter le libellé de la rubrique) ; « Composantes et techniques » (mots/expressions/savoirs visés) → contenu ; « Supports didactiques » (texte support, documents, images) → moyensDidactiques ; méthodes/stratégies → methodes.
Zone I.bis — DEUX VARIANTES, adapte-toi à ce que tu vois :
• Fiche À exercice structural (fréquent en Grammaire, Conjugaison, Orthographe, Dictée) : une zone « Exercice structural » (Unité N°, Structure, Objectif, Fiche N°, Durée) puis des tableaux : phase introductive (2 colonnes Enseignant), phase de systématisation (Enseignant | Apprenant), phase d'application (3 colonnes) → remplis ibis_1 à ibis_5 puis phase_intro_ens1 / phase_intro_ens2, phase_syst_ens / phase_syst_app, app_col1 / app_col2 / app_col3 avec le CONTENU des cellules (jamais les titres des colonnes).
• Fiche de VOCABULAIRE (titre « Vocabulaire thématique » ou matière spécifique Vocabulaire) : PAS de zone « Exercice structural » — laisse ibis_* vides. Les RESSOURCES LEXICALES (listes « Noms », « Verbes », « Adjectifs qualificatifs », « Autres ») vont dans « contenu », une catégorie par ligne, ex : « Noms : infirmière, docteur, pansement, thermomètre… ». Si la fiche comporte néanmoins des tableaux de phases (introductive/systématisation/application), remplis phase_* et app_col* avec leur contenu — sinon laisse-les vides.
Zone II. DÉROULEMENT : tableau « Consignes/Activités de l'enseignant | Résultats attendus (activités des apprenants : A dit, A observe, A complète, A échange…) » ; une entrée par ligne ; phases Introduction (révision/rappel), Développement-Observation, Réalisation, Retour et projection dans l'ordre — TOUJOURS remplir "deroulement".
Zone III. RETOUR ET PROJECTION : objectivation, évaluation, projection (avec leurs résultats attendus) et « RETENONS » si présent (ne pas y recopier les ressources lexicales).`,

  MATH: `Zone d'en-tête : Fn°, DOSSIER N°, THEME, Thème (sous-thème SA), Séance N°, SAN, Séquence, Durée, Date.
Zone I. ÉLÉMENTS DE PLANIFICATION : compétences disciplinaires → competence ; compétences transversales → habilete ; préalables → prealable ; contenus/techniques à construire → contenu ; stratégies/méthodes → methodes ; matériel et supports → moyensDidactiques / evaluation.
Zone I.bis. PHASES PRÉPARATOIRES : « Calcule à brûle pourpoint » → ibis_1 ; « Comptage/Décomptage ou table de multiplication » → ibis_2 ; « Cadran opératoire » (opérations étudiées) → ibis_3 ; « Calcul mental » → ibis_4 ; « Deux problèmes à résoudre mentalement » → ibis_5.
Zone II. DÉROULEMENT : tableau consignes | résultats attendus ; phases Introduction / Réalisation (observation, manipulation, exercices) / Retour et projection.
Zone III. RETOUR ET PROJECTION + « RETENONS ».`,

  EST: `Fiche d'Éducation Scientifique et Technologique.
Zone d'en-tête : Fn°, THEME, Séance N°, SAN, Séquence, Durée, Date.
Zone I. Éléments de planification : compétences, préalables, contenus (savoirs scientifiques et technologiques), stratégies, matériel/expériences.
Zone I.bis. ACTIVITÉS PRÉLIMINAIRES : « Rappel de la leçon précédente » → ibis_1.
Zone II. DÉROULEMENT : situation de départ / situation problème, hypothèses, expérimentation / observation, structuration, conclusion — tableau consignes | résultats attendus.
Zone III. Retour et projection + « RETENONS ».`,

  ES: `Fiche d'Éducation Sociale.
Zone d'en-tête : Fn°, THEME, Séance N°, SAN, Séquence, Durée, Date.
Zone I. Éléments de planification : compétences, préalables, contenus (valeurs, règles de vie, citoyenneté), stratégies, matériel.
Zone I.bis. ACTIVITÉS PRÉLIMINAIRES : « Rappel de la leçon précédente » → ibis_1.
Zone II. DÉROULEMENT : tableau consignes | résultats attendus (évocation, échange, mise en situation, conclusion).
Zone III. Retour et projection + « RETENONS ».`,

  EA: `Fiche d'Éducation Artistique.
Zone d'en-tête : Fn°, THEME, Séance N°, SAN, Séquence, Durée, Date.
Zone I. Éléments de planification : compétences, préalables, contenus (chants, dessins, arts), stratégies, matériel.
Zone I.bis. PROPOSITION DE NOUVELLES ACQUISITIONS : « Annoncer l'objet d'apprentissage » (titre du chant/dessin) → ibis_1 ; « Pré-conception » → ibis_2.
Zone II. DÉROULEMENT : écoute/observation, apprentissage (apprentissage du chant, technique du dessin…), présentation — tableau consignes | résultats attendus.
Zone III. Retour et projection + « RETENONS ».`,

  EPS: `Fiche d'Éducation Physique et Sportive.
Zone d'en-tête : Fn°, THEME, Séance N°, SAN, Séquence, Durée, Date.
Zone I. Éléments de planification : compétences, préalables, contenus (techniques sportives), stratégies, matériel.
Zone I.bis. PROPOSITION DE NOUVELLES ACQUISITIONS : « Annoncer l'objet d'apprentissage » (titre de l'activité physique et sportive) → ibis_1 ; « Pré-conception » → ibis_2.
Zone II. DÉROULEMENT : échauffement, démonstration, entraînement, jeu/application — tableau consignes | résultats attendus.
Zone III. Retour et projection + « RETENONS ».`,

  STANDARD: `Fiche standard (Anglais / Informatique).
Zone d'en-tête : Fn°, THEME, Séance N°, SAN, Séquence, Durée, Date.
Zone I. Éléments de planification : compétences, préalables, contenus, stratégies, matériel.
Zone I.bis. ACTIVITÉS PRÉLIMINAIRES : « Rappel de la leçon précédente » → ibis_1 ; « Vocabulaire / notions nouvelles de la séance » → ibis_2 (nouveaux mots, expressions, termes techniques — une liste par ligne).
Zone II. DÉROULEMENT : tableau consignes | résultats attendus.
Zone III. Retour et projection + « RETENONS ».`,

  DOMAINE: `Fiche de préparation MATERNELLE (fiche Domaine).
Zone d'en-tête : « Fiche de » (enseignante), N° du domaine, Domaine de…, Composante, Sous-composante, Activité N°, Thème, Titre de l'activité, Section (PS/MS/GS), Durée, Matériel, Compétence, Capacité, Habiletés, Stratégies.
Zone INTRODUCTION : tableau 2 colonnes (Consignes | Résultats attendus) — mise en situation, acquis antérieurs, annonce de l'apprentissage → maternelle.deroulementIntro.
Zone RÉALISATION : texte/activité → maternelle.realisation.
Zone RETOUR ET PROJECTION : retour, évaluation, connexion, projection → maternelle.retour / evaluation / connexion / projection.
Zone RANGEMENT → maternelle.rangement. Notes personnelles → maternelle.notesPersonnelles.`,

  DOMAINE_2: `Fiche de préparation MATERNELLE (fiche Domaine 2 — avec tableau RÉALISATION 5 colonnes).
Zone d'en-tête : « Fiche de » (enseignante), N° du domaine, Domaine de…, Composante, Sous-composante, Activité N°, Thème, Titre, Section (PS/MS/GS), Durée, Matériel, Compétence, Capacité, Habiletés, Stratégies.
Zone INTRODUCTION : tableau 2 colonnes (Consignes | Résultats attendus) — mise en situation, acquis antérieurs, annonce de l'apprentissage → maternelle.deroulementIntro.
Zone SITUATION PROBLÈME → maternelle.situationProbleme ; QUESTION DE COMPRÉHENSION → maternelle.questionComprehension.
Zone RÉALISATION : tableau 5 colonnes Plan | Durée | Description des activités | Formation/Évolution | Dosage → maternelle.der5 (une entrée par ligne).
Zone ACTIVITÉS : Activité 1 (+ consigne NB2), Activité 2 (+ consigne NB3), Activité 3 → maternelle.activites.
Zone RETOUR ET PROJECTION : retour, évaluation, connexion, projection → maternelle.retour / evaluation / connexion / projection.
Zone RANGEMENT → maternelle.rangement. Notes personnelles → maternelle.notesPersonnelles.`,
};

@Injectable()
export class FicheVisionExtractionService {
  private readonly logger = new Logger(FicheVisionExtractionService.name);

  private readonly primaryModel: string;
  private readonly fallbackModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly openRouter: OpenRouterService,
  ) {
    this.primaryModel =
      this.configService.get<string>('NVIDIA_VISION_MODEL') ||
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
    this.fallbackModel =
      this.configService.get<string>('NVIDIA_VISION_FALLBACK') ||
      'meta/llama-3.2-90b-vision-instruct';
    this.logger.log(
      `Fiche Vision Extraction — modèle principal: ${this.primaryModel}, repli: ${this.fallbackModel}`,
    );
  }

  /** Le gateway IA est-il configuré (clé NVIDIA présente) ? */
  isConfigured(): boolean {
    return this.openRouter.isConfigured();
  }

  /**
   * Extraction du contenu d'une fiche pédagogique à partir de captures.
   *
   * @param tenantId  Tenant courant (journalisation / quota)
   * @param body      { sheetType, images: string[] (data URLs base64), className? }
   */
  async extractFicheFromImages(
    tenantId: string,
    body: {
      sheetType?: string;
      images?: string[];
      className?: string;
    },
  ): Promise<{
    ok: true;
    fields: Record<string, any>;
    model: string;
    usage?: { promptTokens: number; completionTokens: number };
    warnings: string[];
  }> {
    const sheetType = String(body?.sheetType || '').toUpperCase();
    if (!KNOWN_SHEET_TYPES.has(sheetType)) {
      throw new BadRequestException(
        `Type de fiche inconnu : « ${sheetType || '(vide)'} ». Types acceptés : ${[...KNOWN_SHEET_TYPES].join(', ')}.`,
      );
    }

    const images = Array.isArray(body?.images) ? body.images : [];
    if (images.length === 0) {
      throw new BadRequestException('Aucune capture fournie — ajoutez au moins une image de la fiche.');
    }
    if (images.length > MAX_IMAGES) {
      throw new BadRequestException(`Trop de captures : ${images.length} fournies, ${MAX_IMAGES} maximum.`);
    }

    // Validation du format + taille de chaque image (data URL base64)
    let totalLength = 0;
    const imageParts: Array<{ type: 'image_url'; image_url: { url: string; detail: 'high' } }> = [];
    for (let i = 0; i < images.length; i++) {
      const raw = String(images[i] || '');
      const match = raw.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
      if (!match) {
        throw new BadRequestException(
          `Capture ${i + 1} : format invalide — seuls les PNG, JPEG et WebP encodés en data URL base64 sont acceptés.`,
        );
      }
      const b64 = match[2];
      if (b64.length > MAX_BASE64_LENGTH_PER_IMAGE) {
        throw new BadRequestException(
          `Capture ${i + 1} trop volumineuse (≈${Math.round(b64.length / 1024)} Ko). Réduisez la taille de l'image (capture d'écran plutôt que photo haute résolution).`,
        );
      }
      totalLength += b64.length;
      imageParts.push({
        type: 'image_url',
        image_url: { url: raw, detail: 'high' },
      });
    }
    if (totalLength > MAX_TOTAL_BASE64_LENGTH) {
      throw new BadRequestException(
        `Volume total des captures trop élevé (≈${Math.round(totalLength / 1024)} Ko). Importez les captures en plusieurs fois.`,
      );
    }

    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Extraction IA non configurée : la variable d\'environnement NVIDIA_API_KEY (clé API build.nvidia.com) doit être définie sur le serveur.',
      );
    }

    const isMaternelle = sheetType === 'DOMAINE' || sheetType === 'DOMAINE_2';
    const schemaFields = isMaternelle
      ? MATERNELLE_FIELDS
      : { ...PRIMAIRE_COMMON_FIELDS, ...(IBIS_FIELDS_BY_TYPE[sheetType] || {}) };

    const systemPrompt = this.buildSystemPrompt(sheetType, isMaternelle);
    const userPrompt = this.buildUserPrompt(sheetType, schemaFields, images.length, body?.className);

    // ⭐ Message multimodal : [texte d'instruction, image 1, image 2, ...]
    //    Les modèles vision NVIDIA acceptent plusieurs image_url dans le même
    //    message utilisateur — l'ordre est conservé (page 1, page 2, ...).
    const multimodalContent: any[] = [{ type: 'text', text: userPrompt }, ...imageParts];

    const warnings: string[] = [];

    // ── Appel modèle principal, puis repli ────────────────────────────────
    const modelsToTry = [this.primaryModel, this.fallbackModel];
    let lastError: any = null;
    let rawContent = '';
    let usedModel = '';

    for (const model of modelsToTry) {
      try {
        this.logger.log(
          `[tenant ${tenantId}] Extraction fiche ${sheetType} — ${images.length} capture(s), modèle ${model}`,
        );
        const response = await this.openRouter.chat({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: multimodalContent },
          ],
          temperature: 0.1, // extraction déterministe (pas de création)
          maxTokens: 6000, // une fiche complète peut être longue
          timeout: EXTRACTION_TIMEOUT_MS,
          enableFallback: false, // le fallback global pointe vers des modèles TEXTE — incompatibles images
          maxRetries: 1, // ⭐ 1 retry réseau max : la fenêtre Vercel (60 s) est partagée avec le modèle de repli
          persona: 'SCE',
        });

        if (response?.isPlaceholder || !response?.content?.trim()) {
          throw new Error(
            response?.isPlaceholder
              ? 'Réponse placeholder du gateway IA (erreur API amont)'
              : 'Réponse vide du modèle',
          );
        }
        rawContent = response.content;
        usedModel = response.model || model;

        const parsed = this.parseJsonResponse(rawContent);
        if (!parsed) {
          throw new Error('Impossible de parser la réponse JSON du modèle');
        }
        const fields = this.sanitizeFields(parsed, sheetType, isMaternelle, warnings);
        const filledCount = Object.entries(fields).filter(([k, v]) =>
          k === 'deroulement' || k === 'der5'
            ? Array.isArray(v) && v.length > 0
            : String(v ?? '').trim().length > 0,
        ).length;
        if (filledCount === 0) {
          throw new Error('Aucun champ exploitable extrait — captures probablement illisibles ou hors sujet');
        }

        this.logger.log(
          `[tenant ${tenantId}] Extraction réussie — modèle ${usedModel}, ${filledCount} champ(s) rempli(s)` +
          (response.usage ? `, ${response.usage.totalTokens} tokens` : ''),
        );

        return {
          ok: true,
          fields,
          model: usedModel,
          usage: response.usage
            ? { promptTokens: response.usage.promptTokens, completionTokens: response.usage.completionTokens }
            : undefined,
          warnings,
        };
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `[tenant ${tenantId}] Modèle ${model} échoué pour l'extraction : ${error?.message}`,
        );
      }
    }

    this.logger.error(
      `[tenant ${tenantId}] Extraction fiche ${sheetType} IMPOSSIBLE après tous les modèles : ${lastError?.message}`,
    );
    throw new BadRequestException(
      `L'extraction IA a échoué (${lastError?.message || 'erreur inconnue'}). ` +
      "Vérifiez la qualité des captures (l'image doit être nette, bien cadrée, lisible) puis réessayez.",
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Prompts
  // ─────────────────────────────────────────────────────────────────────────

  private buildSystemPrompt(sheetType: string, isMaternelle: boolean): string {
    const label = SHEET_TYPE_LABELS[sheetType] || sheetType;
    return `Tu es le moteur d'extraction de fiches pédagogiques d'Academia Helm.
RÔLE : tu lis des captures d'écran (photos ou captures) d'une fiche pédagogique béninoise de type « ${label} »${isMaternelle ? ' (maternelle)' : ' (primaire)'} et tu transcris FIDÈLEMENT son contenu dans un objet JSON.

RÈGLES ABSOLUES :
1. TRANSCRIPTION, PAS CRÉATION : tu recopies ce qui est écrit sur la fiche. Tu N'INVENTES RIEN, tu ne complètes pas les champs absents, tu ne reformules pas. Si une information est absente ou illisible, le champ reste une chaîne vide "".
2. IGNORE LES FILIGRANES : ne recopie ni le nom de l'auteur d'origine (filigrane/pied de page du document source), ni les logos, ni les numéros de page.
3. RÉPONSE = JSON UNIQUEMENT : un seul objet JSON, sans texte avant ni après, sans balises markdown (\`\`\`). Si un champ est un tableau, utilise la structure demandée.
4. FORMAT DU TEXTE : texte simple lisible, sans markdown (*, #). Les listes peuvent utiliser des tirets en début de ligne. Conserve les termes pédagogiques exacts (compétences, habiletés, consignes...).
5. Si plusieurs captures correspondent à des pages successives de la MÊME fiche, fusionne-les dans l'objet unique (les champs de la page 2 complètent ceux de la page 1).
6. Les tableaux imprimés (déroulement, exercices structuraux) doivent être transcrits case par case dans les champs prévus, en conservant l'ordre des lignes.
7. STRUCTURE DE RÉFÉRENCE : le message utilisateur décrit la structure canonique d'une fiche de ce type (zones attendues et champ de destination de chaque zone). Sers-t'en pour reconnaître chaque zone (en-tête, éléments de planification, exercices, déroulement, retour) et reporter son contenu dans les BONS champs. Si une zone attendue est ABSENTE de la fiche, laisse les champs correspondants vides — ne les devine pas et n'y force aucun contenu.`;
  }

  private buildUserPrompt(
    sheetType: string,
    schemaFields: FieldSpec,
    imageCount: number,
    className?: string,
  ): string {
    const label = SHEET_TYPE_LABELS[sheetType] || sheetType;
    const lines: string[] = [];
    lines.push(
      `Voici ${imageCount} capture(s) d'une fiche pédagogique de type « ${label} ».` +
      (className ? ` Classe concernée : ${className}.` : ''),
    );
    lines.push('');
    lines.push('Transcris son contenu dans un objet JSON avec EXACTEMENT ces clés :');
    lines.push('{');
    for (const [key, description] of Object.entries(schemaFields)) {
      lines.push(`  "${key}": "", // ${description}`);
    }
    if (sheetType === 'DOMAINE_2') {
      lines.push('  "maternelle.der5": [ { "plan": "", "duree": "", "description": "", "formationEvolution": "", "dosage": "" } ], // Tableau RÉALISATION 5 colonnes : Plan | Durée | Description des activités | Formation Evolution | Dosage — une entrée par ligne du tableau');
      lines.push('  "maternelle.deroulementIntro": { "miseEnSituation": { "consignes": "", "resultats": "" }, "acquisAnterieurs": { "consignes": "", "resultats": "" }, "annonceApprentissage": { "consignes": "", "resultats": "" } }, // DOMAINE — INTRODUCTION : tableau 2 colonnes (Consignes | Résultats Attendus)');
    } else if (sheetType === 'DOMAINE') {
      lines.push('  "maternelle.deroulementIntro": { "miseEnSituation": { "consignes": "", "resultats": "" }, "acquisAnterieurs": { "consignes": "", "resultats": "" }, "annonceApprentissage": { "consignes": "", "resultats": "" } }, // INTRODUCTION : tableau 2 colonnes (Consignes | Résultats Attendus)');
    } else {
      lines.push('  "deroulement": [ { "etape": "", "consignes": "", "resultats": "" } ], // II- DÉROULEMENT : tableau N°/Étape | Consignes | Résultats attendus — une entrée par ligne, avec les phases Introduction, Développement/Observation, Réalisation, Retour et projection dans l\'ordre');
    }
    lines.push('}');
    lines.push('');
    // ⭐ Structure de référence : décrit au modèle les zones attendues de ce
    //    type de fiche et où ranger chacune (voir SHEET_TYPE_GUIDANCE).
    const guidance = SHEET_TYPE_GUIDANCE[sheetType];
    if (guidance) {
      lines.push(`STRUCTURE DE RÉFÉRENCE d'une fiche « ${label} » (zones attendues dans l'ordre, et champ de destination de chaque zone) :`);
      lines.push(guidance);
      lines.push('');
    }
    lines.push(
      'Rappel : champ absent de la fiche = "". Ne mets jamais "null", "N/A" ou "non visible" — uniquement "" ou le contenu exact.',
    );
    lines.push('Réponds avec le JSON seul.');
    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Parsing & assainissement
  // ─────────────────────────────────────────────────────────────────────────

  /** Extraction robuste du JSON : balises markdown, texte parasite, JSON tronqué. */
  private parseJsonResponse(raw: string): Record<string, any> | null {
    if (!raw) return null;

    // 1. Tenter le JSON brut direct
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
    } catch { /* continue */ }

    // 2. Balises markdown ```json ... ``` ou ``` ... ```
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      try {
        const obj = JSON.parse(fenceMatch[1].trim());
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
      } catch { /* continue */ }
    }

    // 3. Premier '{' → dernier '}' (texte parasite autour du JSON)
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first !== -1 && last > first) {
      const candidate = raw.substring(first, last + 1);
      try {
        const obj = JSON.parse(candidate);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
      } catch {
        // 4. Réparer le JSON tronqué (max_tokens atteint) : fermer accolades/crochets
        try {
          const repaired = this.repairTruncatedJson(candidate);
          const obj = JSON.parse(repaired);
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj;
        } catch { /* échec définitif */ }
      }
    }
    return null;
  }

  /** Ferme les accolades/crochets ouverts d'un JSON tronqué (sans garantie). */
  private repairTruncatedJson(text: string): string {
    // Couper sur la dernière virgule ou le dernier double-quote fermé pour
    // éviter des fragments invalides, puis rééquilibrer les délimiteurs.
    let trimmed = text;
    const lastComma = Math.max(trimmed.lastIndexOf(','), trimmed.lastIndexOf(':'));
    if (lastComma > 0) trimmed = trimmed.substring(0, lastComma);
    const stack: string[] = [];
    let inString = false;
    let escape = false;
    for (const ch of trimmed) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') stack.pop();
    }
    let repaired = trimmed;
    if (inString) repaired += '"';
    while (stack.length > 0) {
      const open = stack.pop();
      repaired += open === '{' ? '}' : ']';
    }
    return repaired;
  }

  /**
   * Filtre la réponse sur les listes blanches du type de fiche :
   * clés inconnues rejetées, valeurs converties en chaînes propres,
   * tableaux validés structurellement.
   */
  private sanitizeFields(
    parsed: Record<string, any>,
    sheetType: string,
    isMaternelle: boolean,
    warnings: string[],
  ): Record<string, any> {
    const clean: Record<string, any> = {};
    const allowedKeys = isMaternelle ? MATERNELLE_KEYS : ALL_PRIMAIRE_KEYS;

    for (const [key, value] of Object.entries(parsed || {})) {
      // Clés éventuellement préfixées "maternelle." pour les fiches maternelle
      const normalizedKey = isMaternelle && !key.startsWith('maternelle.') && MATERNELLE_KEYS.has(`maternelle.${key}`)
        ? `maternelle.${key}`
        : key;

      if (!allowedKeys.has(normalizedKey)) {
        if (String(value ?? '').trim() !== '') {
          warnings.push(`Champ « ${key} » ignoré (non prévu pour ce type de fiche).`);
        }
        continue;
      }

      // Déroulement primaire (tableau d'étapes)
      if (normalizedKey === 'deroulement') {
        const steps = Array.isArray(value) ? value : [];
        const validSteps = steps
          .map((s: any) => ({
            etape: this.cleanText(s?.etape),
            consignes: this.cellOrEmpty(this.cleanText(s?.consignes)),
            resultats: this.cellOrEmpty(this.cleanText(s?.resultats ?? s?.resultatsAttendus)),
          }))
          .filter(s => s.etape || s.consignes || s.resultats);
        if (validSteps.length > 0) clean.deroulement = validSteps;
        continue;
      }

      // Maternelle — tableaux imbriqués (dotted keys)
      if (normalizedKey === 'maternelle.der5') {
        const rows = Array.isArray(value) ? value : [];
        const validRows = rows
          .map((r: any) => ({
            plan: this.cellOrEmpty(this.cleanText(r?.plan)),
            duree: this.cellOrEmpty(this.cleanText(r?.duree)),
            description: this.cellOrEmpty(this.cleanText(r?.description)),
            formationEvolution: this.cellOrEmpty(this.cleanText(r?.formationEvolution ?? r?.formation)),
            dosage: this.cellOrEmpty(this.cleanText(r?.dosage)),
          }))
          .filter(r => r.plan || r.duree || r.description || r.formationEvolution || r.dosage);
        if (validRows.length > 0) clean['maternelle.der5'] = validRows;
        continue;
      }

      if (normalizedKey === 'maternelle.deroulementIntro' && value && typeof value === 'object' && !Array.isArray(value)) {
        const intro: Record<string, any> = {};
        for (const phase of ['miseEnSituation', 'acquisAnterieurs', 'annonceApprentissage']) {
          const p = (value as any)[phase];
          if (p && typeof p === 'object') {
            intro[phase] = {
              consignes: this.cleanText((p as any).consignes),
              resultats: this.cleanText((p as any).resultats),
            };
          }
        }
        if (Object.keys(intro).length > 0) clean['maternelle.deroulementIntro'] = intro;
        continue;
      }

      // Champs scalaires
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        // Certains modèles renvoient des objets inattendus sur des champs texte
        const flattened = this.flattenToString(value);
        if (flattened && !isRubricLabelNoise(flattened)) clean[normalizedKey] = flattened;
        continue;
      }
      const text = this.cleanText(value);
      if (text && !isRubricLabelNoise(text)) clean[normalizedKey] = text;
    }

    // Normaliser les valeurs "null"-like du modèle
    for (const [k, v] of Object.entries(clean)) {
      if (typeof v === 'string' && /^(null|n\/?a|none|non visible|non applicable|undefined)$/i.test(v.trim())) {
        delete clean[k];
      }
    }
    return clean;
  }

  private flattenToString(value: any): string {
    if (Array.isArray(value)) {
      return value.map(v => this.cleanText(typeof v === 'object' ? JSON.stringify(v) : v)).filter(Boolean).join('\n');
    }
    if (value && typeof value === 'object') {
      return Object.values(value)
        .map(v => this.cleanText(typeof v === 'object' ? this.flattenToString(v) : String(v ?? '')))
        .filter(Boolean)
        .join('\n');
    }
    return this.cleanText(value);
  }

  private cleanText(value: any): string {
    return String(value ?? '')
      .replace(/\u0000/g, '')
      .replace(/^(null|n\/?a|none|undefined)$/i, '')
      .trim();
  }

  /** Cellule de tableau : vide si le modèle n'a recopié qu'un titre de colonne. */
  private cellOrEmpty(text: string): string {
    return isRubricLabelNoise(text) ? '' : text;
  }
}
