// Test des helpers de matching CAP/BAC (logique extraite à l'identique du service)
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

function seriesFromClassName(className) {
  const n = normalizeUpper(className);
  if (!n) return null;
  const match = n.match(/(?:TERM(?:INALE)?|TLE|BAC)\s*(?:SERIE\s*)?([A-Z]\d?|[A-Z]{2})(?:\s+\d+)?\s*$/);
  return match?.[1] ?? null;
}

const cases = [
  // [nom physique, nom officiel, niveau] → attendus {CEP, BEPC, BAC, CAP, série}
  ['CM2 A', 'CM2', 'Primaire', { cep: true, bac: false, cap: false, serie: null }],
  ['3ème', '3ème', 'Secondaire', { cep: false, bepc: true, bac: false, cap: false, serie: null }],
  ['3e', null, null, { bepc: true }],
  ['Terminale D', null, null, { bac: true, cap: false, serie: 'D' }],
  ['Terminale D 1', null, null, { bac: true, cap: false, serie: 'D' }],
  ['Tle A1 2', null, null, { bac: true, cap: false, serie: 'A1' }],
  ['Terminale C', null, null, { bac: true, cap: false, serie: 'C' }],
  ['Terminale CAP Mécanique', null, null, { bac: false, cap: true, serie: null }],
  ['CAP 2 Couture', null, null, { bac: false, cap: true }],
  ['2CAP', null, null, { cap: true, bac: false }],
  ['Terminale Mécanique', null, null, { cap: true }],                    // filière technique sans série → CAP
  ['Terminale F2 Électricité', null, null, { bac: true, cap: false }],   // série F2 → BAC technique, pas CAP
  ['Terminale BT Mécanique', null, null, { bac: true, cap: false }],     // BT → pas CAP
  ['Seconde A1', null, null, { bac: false, cap: false, serie: null }],
  ['1ère C', null, null, { bac: false, cap: false }],
  ['Tle Mécanique', 'Terminale', 'Technique', { cap: true }],            // niveau Technique → CAP
  ['CM2', 'CM2', null, { cep: true }],
  ['6e', '6ème', 'Secondaire', { cep: false, bepc: false, bac: false, cap: false }],
  ['Classe test', null, null, { cep: false, bepc: false, bac: false, cap: false }],
  ['Maintenance Informatique 2', null, null, { cap: true }],             // filière pro → CAP
  ['Terminale A2', null, null, { bac: true, cap: false, serie: 'A2' }],
  ['Bac G2', null, null, { bac: true, cap: false, serie: 'G2' }],
];

let failures = 0;
for (const [phys, off, lvl, expected] of cases) {
  const names = [phys, off, lvl];
  const r = {
    cep: classMatchesExam(names, 'CEP'),
    bepc: classMatchesExam(names, 'BEPC'),
    bac: classMatchesExam(names, 'BAC'),
    cap: classMatchesExam(names, 'CAP'),
    serie: seriesFromClassName(phys) ?? seriesFromClassName(off),
  };
  const issues = [];
  for (const key of Object.keys(expected)) {
    if (r[key] !== expected[key]) issues.push(`${key}: obtenu=${JSON.stringify(r[key])} attendu=${JSON.stringify(expected[key])}`);
  }
  if (issues.length) {
    failures++;
    console.log(`✗ "${phys}"${off ? ` / "${off}"` : ''}${lvl ? ` / "${lvl}"` : ''} → ${issues.join(' ; ')}`);
  } else {
    console.log(`✓ "${phys}"${off ? ` / "${off}"` : ''}${lvl ? ` / "${lvl}"` : ''}`);
  }
}
console.log(failures === 0 ? '\nTOUS LES TESTS PASSENT' : `\n${failures} ÉCHEC(S)`);
process.exit(failures > 0 ? 1 : 0);
