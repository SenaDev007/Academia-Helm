/**
 * ============================================================================
 * SEED DATA ENRICHI — Planification pédagogique annuelle (Bénin)
 * ============================================================================
 * Contenu extrait des PDFs officiels :
 *   - CI_CM2_PLANIFICATION_ANNUELLE (8 pages, 6 classes)
 *   - Planification annuelle maternelle (15 pages, Section Grands)
 *
 * Structure PRIMAIRE : classLevel × trimester × month × subject → content
 * Structure MATERNELLE : classLevel × trimester × month × week × domain × subDomain → content
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

const SUBJECTS = [
  'Français', 'Mathématiques', 'EST', 'EPS',
  'Morale', 'Civisme', 'Histoire', 'Géographie',
  'Chant', 'Poésie', 'Conte', 'Dessin', 'Couture',
];

const MONTHS_T1 = ['Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_T2 = ['Janvier', 'Février', 'Mars'];
const MONTHS_T3 = ['Avril', 'Mai', 'Juin'];
const ALL_MONTHS = [...MONTHS_T1, ...MONTHS_T2, ...MONTHS_T3];
const TRIMESTER_OF: Record<string, number> = {};
MONTHS_T1.forEach(m => TRIMESTER_OF[m] = 1);
MONTHS_T2.forEach(m => TRIMESTER_OF[m] = 2);
MONTHS_T3.forEach(m => TRIMESTER_OF[m] = 3);

type ClassData = Record<string, Record<string, string>>; // month → subject → content

// ═══════════════════════════════════════════════════════════════════
//  CM2 — Contenu exact extrait du PDF (page 1)
// ═══════════════════════════════════════════════════════════════════
const CM2_DATA: ClassData = {
  'Septembre': {
    'Français': 'U1:1ère semaine — U1 SA1 à SA4 (10ème séance)',
    'Mathématiques': 'D1 SA1 séq 1-5',
    'EST': 'Évaluation diagnostique — SA1 Séq 1et2 — SA1 séq3 à 9',
    'EPS': 'Nettoyage + traçage du terrain',
    'Morale': 'SA1 P94 à 96',
    'Civisme': 'SA1 P14 à 24',
    'Histoire': 'SA3',
    'Géographie': 'SA2 P158 à 159',
    'Chant': 'Évaluation diagnostique',
    'Poésie': 'Évaluation diagnostique',
    'Conte': 'Évaluation diagnostique',
    'Dessin': 'Évaluation diagnostique',
    'Couture': 'Évaluation diagnostique',
  },
  'Octobre': {
    'Français': 'U1 SA5 à U3 SA7',
    'Mathématiques': 'D1-1 Séq 6 à D1-3 Séq5',
    'EST': 'SA1 Séq 1à7 — SA2 Séq 1',
    'EPS': '',
    'Morale': 'SA1 P98 à 100',
    'Civisme': 'SA1 P26 à 40',
    'Histoire': 'SA3',
    'Géographie': 'SA2 P159 à 171',
    'Chant': 'SA6',
    'Poésie': 'SA6 Séq 1-2',
    'Conte': 'SA6 Séq 1',
    'Dessin': 'SA3 Séq 1',
    'Couture': 'SA5 séq 1-2',
  },
  'Novembre': {
    'Français': 'U3 SA6 à U5 SA6 (3ème séance)',
    'Mathématiques': 'D1 SA2 et 3 séance 6 à D2 SA1 séance 10',
    'EST': 'SA2 Séq 2 à SA3 Séq2',
    'EPS': '',
    'Morale': 'SA1 P107 à 110',
    'Civisme': 'SA1 P48 à 56',
    'Histoire': 'SA3 Séq 1à3',
    'Géographie': 'SA2 P174 à 178',
    'Chant': 'Activité rythmique et vocale',
    'Poésie': 'SA6 Séq 3-4',
    'Conte': 'SA6 séq 2-3',
    'Dessin': 'SA3 séq 2-5',
    'Couture': 'SA5 séq 3-4',
  },
  'Décembre': {
    'Français': 'U5 SA6 3è séance à U6 SA7 1ère séance',
    'Mathématiques': 'D2 SA1 et 2 séance 11 à D2 SA1 et 2 séance 3',
    'EST': 'SA3 Séq 3à5',
    'EPS': 'SA2 Séq 1à3',
    'Morale': 'SA1 P112 à 114',
    'Civisme': 'SA1 P58 à P60',
    'Histoire': 'SA3',
    'Géographie': 'SA2 P180 à 182',
    'Chant': 'SA6 et SA9',
    'Poésie': 'SA6 Séq 5',
    'Conte': 'SA6 séq 4-5',
    'Dessin': 'SA3 séq 6-9',
    'Couture': 'SA5 séq 5',
  },
  'Janvier': {
    'Français': 'U7 SA1 à U8 SA8 1ère séance',
    'Mathématiques': 'D2 SA2 et 3 Séance 4 à D3 SA1 et 2 séance 3',
    'EST': 'SA3 Séq 6 à SA4 Séq5',
    'EPS': 'SA Séq 4 à 12',
    'Morale': 'SA1 P115 à P116',
    'Civisme': 'SA1 P64 à P70',
    'Histoire': 'SA3',
    'Géographie': 'SA2 P184 à P190',
    'Chant': 'SA6 et SA9',
    'Poésie': 'SA6 Séq 6-7',
    'Conte': 'SA6 séq 6-7',
    'Dessin': 'SA3 séq 10-14',
    'Couture': 'SA5 séq 6-7',
  },
  'Février': {
    'Français': 'U9 SA1 à U10 SA5',
    'Mathématiques': 'D3 SA1 et 2 séance 4 à D4 SA1 séance 1 à 10',
    'EST': 'SA4 Séq 6 à SA5 Séq5',
    'EPS': 'SA2 Séq 13 à SA3 Séq1',
    'Morale': 'SA1 P120 à 124',
    'Civisme': 'SA1 P72 à P140',
    'Histoire': 'SA3',
    'Géographie': 'SA2 P192 à P194',
    'Chant': 'SA9',
    'Poésie': 'SA6 séq 8',
    'Conte': 'SA6 séq 8',
    'Dessin': 'SA3 séq 14-16',
    'Couture': 'SA5 séq 8',
  },
  'Mars': {
    'Français': 'U10 SA6 2ème séance à U12 SA4 17RE Séance',
    'Mathématiques': 'D4 SA1 Séance 1 à D4 SA2 séance 7 + intégration',
    'EST': 'SA3 Séq 2à7',
    'EPS': 'Évaluation Bilan sommative',
    'Morale': 'SA1 P126 à P151',
    'Civisme': 'SA3',
    'Histoire': 'SA3',
    'Géographie': 'SA2',
    'Chant': 'Évaluation sommative',
    'Poésie': 'Évaluation sommative',
    'Conte': 'Évaluation sommative',
    'Dessin': 'SA3 séq 17-20',
    'Couture': 'SA5 séq 9-11',
  },
  'Avril': {
    'Français': 'Intégration — U12 SA5 à 7 révision + évaluation',
    'Mathématiques': 'D5 intégration',
    'EST': 'Renforcement',
    'EPS': 'Renforcement',
    'Morale': 'Renforcement',
    'Civisme': 'Renforcement',
    'Histoire': 'Renforcement',
    'Géographie': 'Renforcement',
    'Chant': 'SA4 Séq 4-6',
    'Poésie': 'SA6 Séq 11-13',
    'Conte': 'SA6 Séq 11',
    'Dessin': 'SA3 Séq 21-24',
    'Couture': 'SA5 Séq 12 et 13',
  },
  'Mai': {
    'Français': 'U12 révision',
    'Mathématiques': 'Renforcement',
    'EST': 'Renforcement',
    'EPS': 'Renforcement',
    'Morale': 'Renforcement',
    'Civisme': 'Renforcement',
    'Histoire': 'Renforcement',
    'Géographie': 'Renforcement',
    'Chant': 'Renforcement',
    'Poésie': 'SA11 Séq 12',
    'Conte': 'SA7 Séq 12',
    'Dessin': 'SA10 Séq 11',
    'Couture': 'SA8 Séq 19 à 22',
  },
  'Juin': {
    'Français': 'Révision',
    'Mathématiques': 'Révision',
    'EST': 'CEP 2024',
    'EPS': 'Révision',
    'Morale': 'Révision',
    'Civisme': 'Révision',
    'Histoire': 'Révision',
    'Géographie': 'Révision',
    'Chant': 'Révision',
    'Poésie': 'SA11 Séq 12',
    'Conte': 'SA7 Séq 12',
    'Dessin': 'SA10 Séq 11',
    'Couture': 'SA8 Séq 28 à 35',
  },
};

// ═══════════════════════════════════════════════════════════════════
//  CM1 — Contenu exact extrait du PDF (page 2)
// ═══════════════════════════════════════════════════════════════════
const CM1_DATA: ClassData = {
  'Septembre': {
    'Français': 'Évaluation diagnostique — U1 Semaine 1',
    'Mathématiques': 'Évaluation diagnostique — D1 SA1-1 à 7',
    'EST': 'SA1 Séq 1-3',
    'EPS': '—',
    'Morale': 'SA8 Séq 1',
    'Civisme': 'SA1 Séq 1 et 2',
    'Histoire': 'SA2 Séq 1',
    'Géographie': 'SA6 Séq 6',
    'Chant': 'SA1 Séq 1 à 3',
    'Poésie': 'SA11 Séq 1',
    'Conte': 'SA7 Séq 1',
    'Dessin': 'SA10 Séq 1',
    'Couture': 'SA8 Séq 1 — SA6 Séq 1',
  },
  'Octobre': {
    'Français': 'U1 semaine 2 à U3 semaine 1',
    'Mathématiques': 'D1 SA1 Séq 8 à 15 — SA2 et 3',
    'EST': 'SA1 Séq 4 à SA2 Séq 2',
    'EPS': 'SA5 Séq 1-2',
    'Morale': 'SA8 Séq 2-5',
    'Civisme': 'SA1 Séq 3 à 10',
    'Histoire': 'SA2 Séq 2-4',
    'Géographie': 'SA6 Séq 2-4',
    'Chant': 'SA1 Séq 3-8',
    'Poésie': 'SA11 Séq 2-3',
    'Conte': 'SA7 Séq 2-3',
    'Dessin': 'SA10 Séq 2',
    'Couture': 'SA8 Séq 2-5 — SA6 Séq 2 à 3',
  },
  'Novembre': {
    'Français': 'Intégration + U3 semaine 2 à U4',
    'Mathématiques': 'Intégration + D2 SA1 à SA3',
    'EST': 'SA2 Séq 3 à SA3 Séq 2',
    'EPS': 'SA5 Séq 3-4',
    'Morale': 'SA8 Séq 6-9',
    'Civisme': 'SA1 Séq 11 à 18',
    'Histoire': 'SA2 Séq 5-7',
    'Géographie': 'SA6 Séq 5-7',
    'Chant': 'SA1 Séq 9 à SA2 Séq 1',
    'Poésie': 'SA11 Séq 4-5',
    'Conte': 'SA7 Séq 4-5',
    'Dessin': 'SA10 Séq 3-4',
    'Couture': 'SA8 Séq 6-7 — SA6 Séq 4-5',
  },
  'Décembre': {
    'Français': 'U5 1ère et 2ème semaine + révision',
    'Mathématiques': 'D3 SA1 à SA2',
    'EST': 'SA3 Séq 3-6',
    'EPS': '—',
    'Morale': 'SA8 Séq 10-11',
    'Civisme': 'SA1 Séq 19-22',
    'Histoire': 'SA2 Séq 8-9',
    'Géographie': 'SA6 Séq 8-9',
    'Chant': 'SA2 Séq 2-5',
    'Poésie': 'SA11 Séq 6',
    'Conte': 'SA7 Séq 6',
    'Dessin': 'SA10 Séq 5',
    'Couture': 'SA8 Séq 11 — SA6 Séq 6',
  },
  'Janvier': {
    'Français': 'U6 à U7',
    'Mathématiques': 'D3 SA2 à SA3',
    'EST': 'SA4 Séq 4 à 6',
    'EPS': 'SA2 Séq 6 à 13',
    'Morale': 'SA8 Séq 12-15',
    'Civisme': 'SA1 Séq 23-27',
    'Histoire': 'SA2 Séq 10-12',
    'Géographie': 'SA6 Séq 10-12',
    'Chant': 'SA2 Séq 14',
    'Poésie': 'SA11 Séq 7',
    'Conte': 'SA7 Séq 7',
    'Dessin': 'SA10 Séq 10',
    'Couture': 'SA8 Séq 15 — SA6 Séq 7',
  },
  'Février': {
    'Français': 'U8',
    'Mathématiques': 'D4 SA1 à SA2',
    'EST': 'SA5 Séq 1 à SA6 Séq 2',
    'EPS': 'SA3 Séq 5 à 10',
    'Morale': 'SA8 Séq 16-17',
    'Civisme': 'SA1 Séq 21 à 23',
    'Histoire': 'SA2 Séq 10-11',
    'Géographie': 'SA6 Séq 13',
    'Chant': 'SA3 Séq 5 à 10',
    'Poésie': 'SA11 Séq 8',
    'Conte': 'SA7 Séq 8',
    'Dessin': 'SA10 Séq 8',
    'Couture': 'SA8 Séq 19 — SA6 Séq 8',
  },
  'Mars': {
    'Français': 'U9 à U10',
    'Mathématiques': 'D5',
    'EST': 'SA7 Séq 2 (suite)',
    'EPS': 'SA7 Séq 3-8',
    'Morale': 'Révision',
    'Civisme': 'SA1 Séq 24 à 25',
    'Histoire': 'SA2 Séq 12 à 13',
    'Géographie': 'Révision',
    'Chant': 'SA3 Séq 11 à 17',
    'Poésie': 'SA10 Séq 9',
    'Conte': 'SA7 Séq 11',
    'Dessin': 'SA10 Séq 8',
    'Couture': 'SA8 Séq 19 à 22 — SA6 Séq 9',
  },
  'Avril': {
    'Français': 'U11',
    'Mathématiques': 'D5',
    'EST': 'SA7 Séq 3+ révision',
    'EPS': 'SA7 Séq 3-8',
    'Morale': 'Révision',
    'Civisme': 'Révision',
    'Histoire': 'SA2 Séq 14-15',
    'Géographie': 'Révision',
    'Chant': 'SA3 Séq 11 à 17',
    'Poésie': 'SA11 Séq 12',
    'Conte': 'SA7 Séq 9',
    'Dessin': 'SA10 Séq 10',
    'Couture': 'SA2 Séq 23-27 — SA6 Séq 10',
  },
  'Mai': {
    'Français': 'U12',
    'Mathématiques': 'D5',
    'EST': 'Révision',
    'EPS': 'Révision',
    'Morale': 'Révision',
    'Civisme': 'Révision',
    'Histoire': 'Révision',
    'Géographie': 'Révision',
    'Chant': 'SA3 Séq 18 à 20',
    'Poésie': 'SA11 Séq 11',
    'Conte': 'SA7 Séq 11',
    'Dessin': 'SA10 Séq 10',
    'Couture': 'SA8 Séq 28 à 31 — SA6 Séq 11',
  },
  'Juin': {
    'Français': 'Révision',
    'Mathématiques': 'D5 + Révision',
    'EST': 'Révision',
    'EPS': 'Révision',
    'Morale': 'Révision',
    'Civisme': 'Révision',
    'Histoire': 'Révision',
    'Géographie': 'Révision',
    'Chant': 'Révision',
    'Poésie': 'SA11 Séq 12',
    'Conte': 'SA7 Séq 12',
    'Dessin': 'SA10 Séq 11',
    'Couture': 'SA8 Séq 32 à 35 — SA6 Séq 12',
  },
};

// ═══════════════════════════════════════════════════════════════════
//  CE2, CE1, CP, CI — Structure + contenu à enrichir
//  (Le contenu exact sera extrait dans une itération suivante)
// ═══════════════════════════════════════════════════════════════════
const PLACEHOLDER_DATA: ClassData = {};
for (const month of ALL_MONTHS) {
  PLACEHOLDER_DATA[month] = {};
  for (const subject of SUBJECTS) {
    PLACEHOLDER_DATA[month][subject] = `À compléter — ${month}`;
  }
}

const PRIMAIRE_CLASS_DATA: Record<string, ClassData> = {
  'CM2': CM2_DATA,
  'CM1': CM1_DATA,
  'CE2': PLACEHOLDER_DATA,
  'CE1': PLACEHOLDER_DATA,
  'CP': PLACEHOLDER_DATA,
  'CI': PLACEHOLDER_DATA,
};

// ═══════════════════════════════════════════════════════════════════
//  MATERNELLE — Section Grands
//  5 Domaines × sous-domaines × semaines
//  Le contenu exact sera enrichi dans une itération suivante
// ═══════════════════════════════════════════════════════════════════
const MATERNELLE_DOMAINS = [
  { domain: 'Education pour la santé', subDomains: ['Passage aux toilettes', 'Lavage des mains', 'Goûters'] },
  { domain: 'Expression corporelle', subDomains: ['Expression corporelle'] },
  { domain: 'Pré-lecture / Pré-écriture / Pré-mathématique', subDomains: ['Pré-lecture', 'Pré-écriture', 'Pré-mathématique', 'Observation', 'Education sensorielle', 'Travaux manuels'] },
  { domain: 'Expression plastique / Expression émotionnelle', subDomains: ['Expression plastique', 'Expression émotionnelle'] },
  { domain: 'Poésie / Chant / Contes / Comptine / Communication orale', subDomains: ['Poésie', 'Chant', 'Contes', 'Comptine', 'Communication orale'] },
];

const MATERNELLE_WEEKS = [
  // 1er Trimestre
  { week: '3ème semaine', month: 'Septembre', trimester: 1 },
  { week: '4ème semaine', month: 'Septembre', trimester: 1 },
  { week: '1ère semaine', month: 'Octobre', trimester: 1 },
  { week: '2ème semaine', month: 'Octobre', trimester: 1 },
  { week: '3ème semaine', month: 'Octobre', trimester: 1 },
  { week: '4ème semaine', month: 'Octobre', trimester: 1 },
  { week: '5ème semaine', month: 'Octobre', trimester: 1 },
  { week: '1ère semaine', month: 'Novembre', trimester: 1 },
  { week: '2ème semaine', month: 'Novembre', trimester: 1 },
  { week: '3ème semaine', month: 'Novembre', trimester: 1 },
  { week: '4ème semaine', month: 'Novembre', trimester: 1 },
  { week: 'Congés', month: 'Décembre', trimester: 1 },
  // 2e Trimestre
  { week: '1ère semaine', month: 'Janvier', trimester: 2 },
  { week: '2ème semaine', month: 'Janvier', trimester: 2 },
  { week: '3ème semaine', month: 'Janvier', trimester: 2 },
  { week: '4ème semaine', month: 'Janvier', trimester: 2 },
  { week: '1ère semaine', month: 'Février', trimester: 2 },
  { week: '2ème semaine', month: 'Février', trimester: 2 },
  { week: '3ème semaine', month: 'Février', trimester: 2 },
  { week: '4ème semaine', month: 'Février', trimester: 2 },
  { week: '1ère semaine', month: 'Mars', trimester: 2 },
  { week: '2ème semaine', month: 'Mars', trimester: 2 },
  { week: '3ème semaine', month: 'Mars', trimester: 2 },
  { week: '4ème semaine', month: 'Mars', trimester: 2 },
  // 3e Trimestre
  { week: '1ère semaine', month: 'Avril', trimester: 3 },
  { week: '2ème semaine', month: 'Avril', trimester: 3 },
  { week: '3ème semaine', month: 'Avril', trimester: 3 },
  { week: '4ème semaine', month: 'Avril', trimester: 3 },
  { week: '1ère semaine', month: 'Mai', trimester: 3 },
  { week: '2ème semaine', month: 'Mai', trimester: 3 },
  { week: '3ème semaine', month: 'Mai', trimester: 3 },
  { week: '4ème semaine', month: 'Mai', trimester: 3 },
  { week: '1ère semaine', month: 'Juin', trimester: 3 },
  { week: '2ème semaine', month: 'Juin', trimester: 3 },
  { week: '3ème semaine', month: 'Juin', trimester: 3 },
  { week: '4ème semaine', month: 'Juin', trimester: 3 },
];

// ═══════════════════════════════════════════════════════════════════
//  Génération des données de seed
// ═══════════════════════════════════════════════════════════════════

function generatePrimaireSeed(): AnnualPlanSeedItem[] {
  const items: AnnualPlanSeedItem[] = [];
  for (const [classLevel, classData] of Object.entries(PRIMAIRE_CLASS_DATA)) {
    for (const month of ALL_MONTHS) {
      const trimester = TRIMESTER_OF[month];
      const monthData = classData[month] || {};
      for (const subject of SUBJECTS) {
        const content = monthData[subject] || '—';
        items.push({
          classLevel,
          trimester,
          month,
          week: 'Toutes', // Primaire = monthly, not weekly
          domain: subject,
          subDomain: undefined,
          content,
        });
      }
    }
  }
  return items;
}

function generateMaternelleSeed(): AnnualPlanSeedItem[] {
  const items: AnnualPlanSeedItem[] = [];
  for (const dom of MATERNELLE_DOMAINS) {
    for (const sub of dom.subDomains) {
      for (const w of MATERNELLE_WEEKS) {
        items.push({
          classLevel: 'MATERNELLE_GRANDS',
          trimester: w.trimester,
          month: w.month,
          week: w.week,
          domain: dom.domain,
          subDomain: sub,
          content: w.week === 'Congés' ? 'Congés' : `À compléter — ${w.month} ${w.week}`,
        });
      }
    }
  }
  return items;
}

export const ANNUAL_PLAN_SEED_DATA: AnnualPlanSeedItem[] = [
  ...generateMaternelleSeed(),
  ...generatePrimaireSeed(),
];
