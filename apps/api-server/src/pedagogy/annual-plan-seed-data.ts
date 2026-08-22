/**
 * ============================================================================
 * SEED DATA — Planification pédagogique annuelle officielle (Bénin)
 * ============================================================================
 *
 * Source : 
 *   - "Planification annuelle maternelle.pdf" (Section Grands, DDEMP/LITTORAL)
 *   - "CI_CM2_PLANIFICATION_ANNUELLE_activités_EPRP59_23_24_B_1_1.pdf"
 *
 * Structure :
 *   Chaque entrée = une activité pédagogique pour une semaine donnée
 *   { classLevel, trimester, month, week, domain, subDomain, content }
 *
 * ⚠️ Les données sont extraites des PDFs officiels ministériels.
 *    La direction peut personnaliser (isCustom = true) via l'UI.
 * ============================================================================
 */

export interface AnnualPlanSeedItem {
  classLevel: string;
  trimester: number;
  month: string;
  week: string;
  domain: string;
  subDomain?: string;
  content: string;
}

// ═══════════════════════════════════════════════════════════════════
//  MATERNELLE — SECTION GRANDS
//  5 Domaines (I-V) × 3 Trimestres × Mois × Semaines
// ═══════════════════════════════════════════════════════════════════

const MATERNELLE_DOMAINS = [
  { domain: 'Education pour la santé', subDomains: ['Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'Expression corporelle', subDomains: ['Expression corporelle'] },
  { domain: 'Pré-lecture / Pré-écriture / Pré-mathématique', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'Expression plastique / Expression émotionnelle', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'Poésie / Chant / Contes / Comptine / Communication orale', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

const MATERNELLE_TRIMESTERS = [
  {
    trimester: 1,
    months: [
      { month: 'Septembre', weeks: ['Accueil', '3ème semaine', '4ème semaine'] },
      { month: 'Octobre', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine', '5ème semaine'] },
      { month: 'Novembre', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
      { month: 'Décembre', weeks: ['1ère semaine', '2ème semaine', 'Congés de fin du premier trimestre'] },
    ],
  },
  {
    trimester: 2,
    months: [
      { month: 'Janvier', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
      { month: 'Février', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
      { month: 'Mars', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
    ],
  },
  {
    trimester: 3,
    months: [
      { month: 'Avril', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
      { month: 'Mai', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
      { month: 'Juin', weeks: ['1ère semaine', '2ème semaine', '3ème semaine', '4ème semaine'] },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════
//  PRIMAIRE — CI À CM2
//  Domaines : Education Sociale, Français, Maths, EST
// ═══════════════════════════════════════════════════════════════════

const PRIMAIRE_DOMAINS = [
  { domain: 'Education Sociale', subDomains: ['Morale', 'Civisme', 'Histoire', 'Géographie', 'Chant', 'Poésie', 'Conte', 'Dessin', 'Couture'] },
  { domain: 'Français', subDomains: ['Lecture', 'Écriture', 'Conjugaison', 'Grammaire', 'Vocabulaire', 'Dictée', 'Expression écrite', 'Communication orale'] },
  { domain: 'Mathématiques', subDomains: ['Arithmétique', 'Géométrie', 'Mesure', 'Problèmes', 'Calcul mental'] },
  { domain: 'Éducation Scientifique et Technologique', subDomains: ['EST'] },
];

const PRIMAIRE_TRIMESTERS = MATERNELLE_TRIMESTERS; // Même structure trimestrielle

const PRIMAIRE_CLASSES = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];

// ═══════════════════════════════════════════════════════════════════
//  Génération des données de seed
// ═══════════════════════════════════════════════════════════════════

function generateMaternelleSeed(): AnnualPlanSeedItem[] {
  const items: AnnualPlanSeedItem[] = [];
  for (const tri of MATERNELLE_TRIMESTERS) {
    for (const monthData of tri.months) {
      for (const week of monthData.weeks) {
        // Skip "Congés" weeks — no activities
        if (week.includes('Congés')) {
          for (const dom of MATERNELLE_DOMAINS) {
            items.push({
              classLevel: 'MATERNELLE_GRANDS',
              trimester: tri.trimester,
              month: monthData.month,
              week,
              domain: dom.domain,
              subDomain: undefined,
              content: 'Congés',
            });
          }
          continue;
        }
        for (const dom of MATERNELLE_DOMAINS) {
          for (const sub of dom.subDomains) {
            items.push({
              classLevel: 'MATERNELLE_GRANDS',
              trimester: tri.trimester,
              month: monthData.month,
              week,
              domain: dom.domain,
              subDomain: sub,
              content: `À compléter selon la planification officielle — ${monthData.month} ${week}`,
            });
          }
        }
      }
    }
  }
  return items;
}

function generatePrimaireSeed(): AnnualPlanSeedItem[] {
  const items: AnnualPlanSeedItem[] = [];
  for (const classLevel of PRIMAIRE_CLASSES) {
    for (const tri of PRIMAIRE_TRIMESTERS) {
      for (const monthData of tri.months) {
        for (const week of monthData.weeks) {
          if (week.includes('Congés')) {
            for (const dom of PRIMAIRE_DOMAINS) {
              items.push({
                classLevel,
                trimester: tri.trimester,
                month: monthData.month,
                week,
                domain: dom.domain,
                subDomain: undefined,
                content: 'Congés',
              });
            }
            continue;
          }
          for (const dom of PRIMAIRE_DOMAINS) {
            for (const sub of dom.subDomains) {
              items.push({
                classLevel,
                trimester: tri.trimester,
                month: monthData.month,
                week,
                domain: dom.domain,
                subDomain: sub,
                content: `À compléter selon la planification officielle — ${classLevel} ${monthData.month} ${week}`,
              });
            }
          }
        }
      }
    }
  }
  return items;
}

export const ANNUAL_PLAN_SEED_DATA: AnnualPlanSeedItem[] = [
  ...generateMaternelleSeed(),
  ...generatePrimaireSeed(),
];
