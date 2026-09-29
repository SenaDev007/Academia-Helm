// Test de la logique de la « Fiche détail école rattachée » (2026-09-29 #3)
// Logique extraite à l'identique des services (classMatchesExam,
// federisLevelMatchesType, resolveSeriesFromClassNames + regroupements
// effectifs par série / filière et présentations par examen).
function normalizeUpper(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

const CAP_TECHNICAL_KEYWORDS = [
  'TECHNIQUE','TECHNOLOGIQUE','PROFESSIONNEL','VOCATIONNEL','METIER','APPRENTISSAGE','ARTISANAT','FILIERE',
  'MECANIQUE','AUTOMOBILE','COUTURE','BRODERIE','ELECTRICITE','ELECTRONIQUE','ELECTROTECHNIQUE','MENUISERIE',
  'CHARPENTE','COIFFURE','ESTHETIQUE','BATIMENT','MACONNERIE','SOUDURE','PLOMBERIE','PEINTURE','VENTE',
  'HOTELLERIE','RESTAURATION','CUISINE','PATISSERIE','BOULANGERIE','AGRICULTURE','ELEVAGE','PISCICULTURE',
  'MAINTENANCE','INFORMATIQUE',
];
const BAC_SERIES_ANYWHERE =
  /(?:TERM(?:INALE)?|TLE|BAC|1ERE|1RE|PREMIERE|2NDE|SECONDE)\s+(?:SERIE\s+)?[A-G]\d?\b/;

function classMatchesExam(names, type) {
  const normalized = names.map((n) => normalizeUpper(n)).filter(Boolean);
  if (normalized.length === 0) return false;
  if (type === 'CEP') return normalized.some((n) => n.startsWith('CM2'));
  if (type === 'BEPC') return normalized.some((n) => /^3($|[^0-9])/.test(n));
  if (type === 'CAP') {
    if (normalized.some((n) => n.includes('CAP'))) return true;
    const hasBacSeries = normalized.some((n) => BAC_SERIES_ANYWHERE.test(n));
    const hasBt = normalized.some((n) => /\bBT\b/.test(n));
    if (hasBacSeries || hasBt) return false;
    return normalized.some((n) => CAP_TECHNICAL_KEYWORDS.some((k) => n.includes(k)));
  }
  return normalized.some(
    (n) => !n.includes('CAP') && (n.startsWith('TERM') || n.startsWith('TLE') || n.startsWith('BAC')),
  );
}

function federisLevelMatchesType(level, type) {
  const n = normalizeUpper(level);
  if (!n) return false;
  if (type === 'CEP') return n.startsWith('CM2');
  if (type === 'BEPC') return /^3/.test(n);
  if (type === 'CAP') return n.includes('CAP');
  return (n.startsWith('TERM') || n.startsWith('TLE')) && !n.includes('CAP');
}

function seriesFromClassName(className) {
  const n = normalizeUpper(className);
  if (!n) return null;
  const match = n.match(/(?:TERM(?:INALE)?|TLE|BAC)\s*(?:SERIE\s*)?([A-Z]\d?|[A-Z]{2})(?:\s+\d+)?\s*$/);
  return match?.[1] ?? null;
}

function resolveSeriesFromClassNames(physicalName, officialName, officialSeriesName) {
  if (officialSeriesName) return officialSeriesName.toUpperCase();
  return seriesFromClassName(physicalName) ?? seriesFromClassName(officialName) ?? null;
}

// ── Réplique du regroupement effectifs (getSchoolDetail) ────────────────────

function computeEffectifs(classes) {
  // classes : [{ name, officialName, officialSeriesName, officialLevelName, count }]
  const classForExam = (type) =>
    classes.filter((c) =>
      classMatchesExam([c.name, c.officialName, c.officialLevelName], type),
    );
  const cepClasses = classForExam('CEP');
  const bepcClasses = classForExam('BEPC');
  const bacClasses = classForExam('BAC');
  const capClasses = classForExam('CAP');
  const sum = (l) => l.reduce((a, c) => a + c.count, 0);

  const bacBySeries = new Map();
  for (const c of bacClasses) {
    const serie =
      resolveSeriesFromClassNames(c.name, c.officialName, c.officialSeriesName) ?? 'NON PRECISEE';
    bacBySeries.set(serie, (bacBySeries.get(serie) ?? 0) + c.count);
  }
  const capByFiliere = new Map();
  for (const c of capClasses) {
    capByFiliere.set(c.name, (capByFiliere.get(c.name) ?? 0) + c.count);
  }
  return {
    CEP: sum(cepClasses),
    BEPC: sum(bepcClasses),
    BAC: sum(bacClasses),
    CAP: sum(capClasses),
    bacBySeries: Object.fromEntries(bacBySeries),
    capByFiliere: Object.fromEntries(capByFiliere),
  };
}

// ── Réplique du regroupement présentations par examen ───────────────────────

function groupPresentations(candidates) {
  // candidates : [{ level (NationalExam.level), series, schoolClass }]
  const EXAM_ORDER = ['CEP', 'BEPC', 'BAC', 'CAP'];
  const byType = new Map();
  for (const c of candidates) {
    const type = EXAM_ORDER.find((t) => federisLevelMatchesType(c.level, t));
    if (!type) continue;
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  return Object.fromEntries(byType);
}

// ── Cas de test ─────────────────────────────────────────────────────────────

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`✗ ${label}\n   attendu : ${JSON.stringify(expected)}\n   obtenu  : ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${label}`);
  }
}

// École complète : primaire + 1er cycle + 2nd cycle (séries) + CAP (filières)
const ecoleComplete = [
  { name: 'CM2 A', officialName: 'CM2', officialLevelName: 'Primaire', officialSeriesName: null, count: 52 },
  { name: 'CM2 B', officialName: 'CM2', officialLevelName: 'Primaire', officialSeriesName: null, count: 44 },
  { name: '3ème 1', officialName: '3ème', officialLevelName: 'Secondaire', officialSeriesName: null, count: 60 },
  { name: 'Terminale A1', officialName: 'Terminale', officialLevelName: 'Terminale', officialSeriesName: null, count: 30 },
  { name: 'Terminale C', officialName: 'Terminale', officialLevelName: 'Terminale', officialSeriesName: null, count: 25 },
  { name: 'Terminale D 1', officialName: 'Terminale', officialLevelName: 'Terminale', officialSeriesName: null, count: 28 },
  { name: 'Tle CAP Mécanique', officialName: 'Terminale CAP', officialLevelName: 'CAP', officialSeriesName: null, count: 15 },
  { name: 'CAP 2 Couture', officialName: 'CAP', officialLevelName: 'CAP', officialSeriesName: null, count: 12 },
];

const eff = computeEffectifs(ecoleComplete);
check('Effectifs CM2 (CEP) = 96', eff.CEP, 96);
check('Effectifs 3ème (BEPC) = 60', eff.BEPC, 60);
check('Effectifs Terminale (BAC) = 83', eff.BAC, 83);
check('Effectifs CAP = 27', eff.CAP, 27);
check('Terminale PAR SÉRIE', eff.bacBySeries, { A1: 30, C: 25, D: 28 });
check('CAP PAR FILIÈRE (nom de classe)', eff.capByFiliere, { 'Tle CAP Mécanique': 15, 'CAP 2 Couture': 12 });

// École technique : séries générales → BAC, filières du domaine technique → CAP.
// ⚠️ Sémantique du repo (classMatchesExam) : une classe « Terminale
//    Électronique » (préfixe TERM + mot-clé technique SANS mention CAP)
//    apparaît dans les DEUX éligibilités — identique au module « Examens
//    nationaux » côté école. Une filière CAP pure porte « CAP » dans son nom
//    (« Tle CAP Mécanique ») ou un nom technique sans préfixe d'année.
const ecoleTechnique = [
  { name: 'Terminale G2', officialName: 'Terminale', officialLevelName: 'Terminale', officialSeriesName: null, count: 20 },
  { name: 'Tle CAP Électronique', officialName: 'Terminale CAP', officialLevelName: 'CAP', officialSeriesName: null, count: 18 },
];
const effTech = computeEffectifs(ecoleTechnique);
check('Technique — Terminale G2 → BAC (série G2)', effTech.BAC, 20);
check('Technique — Tle CAP Électronique → CAP uniquement', effTech.CAP, 18);
check('Technique — séries', effTech.bacBySeries, { G2: 20 });
check('Technique — filières', effTech.capByFiliere, { 'Tle CAP Électronique': 18 });

// Ambiguïté documentée : « Terminale Électronique » (préfixe TERM + mot-clé
// technique, sans mention CAP) est éligible aux DEUX examens — même
// comportement que le module école (getEligibleClasses indépendants).
const ambigue = computeEffectifs([
  { name: 'Terminale Électronique', officialName: null, officialLevelName: null, officialSeriesName: null, count: 18 },
]);
check('Ambiguïté repo — éligible BAC et CAP', [ambigue.BAC, ambigue.CAP], [18, 18]);

// École primaire uniquement
const ecolePrimaire = [
  { name: 'CM2', officialName: null, officialLevelName: null, officialSeriesName: null, count: 41 },
];
const effPrim = computeEffectifs(ecolePrimaire);
check('Primaire — uniquement CM2', [effPrim.CEP, effPrim.BEPC, effPrim.BAC, effPrim.CAP], [41, 0, 0, 0]);

// Série via la classe officielle (AcademicSeries) prioritaire sur le nom physique
check(
  'Série officielle prioritaire (D physique vs C officielle)',
  resolveSeriesFromClassNames('Terminale D', 'Terminale', 'C'),
  'C',
);
check('Série extraite du nom physique (Tle D)', resolveSeriesFromClassNames('Tle D', null, null), 'D');
check('Pas de série → null', resolveSeriesFromClassNames('Terminale', null, null), null);

// Présentations — regroupement par type d'examen depuis NationalExam.level
const presentations = groupPresentations([
  { level: 'CM2', series: null, schoolClass: 'CM2 A' },
  { level: 'CM2', series: null, schoolClass: 'CM2 B' },
  { level: '3EME', series: null, schoolClass: '3ème 1' },
  { level: 'TERMINALE', series: 'D', schoolClass: 'Terminale D 1' },
  { level: 'TERMINALE', series: 'C', schoolClass: 'Terminale C' },
  { level: 'CAP', series: null, schoolClass: 'Tle CAP Mécanique' },
]);
check(
  'Sous-onglets dynamiques — CEP 2, BEPC 1, BAC 2, CAP 1',
  presentations,
  { CEP: 2, BEPC: 1, BAC: 2, CAP: 1 },
);

// Niveau inconnu → ignoré (aucun onglet)
check(
  'Niveau non reconnu ignoré',
  groupPresentations([{ level: 'CM1', series: null, schoolClass: null }]),
  {},
);

console.log(
  failures === 0
    ? `\n✅ Fiche détail — logique validée (15 checks)`
    : `\n❌ ${failures} échec(s)`,
);
process.exit(failures > 0 ? 1 : 0);
