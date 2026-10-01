/**
 * FederisExamMatching — Rapprochement classes d'école ↔ examens nationaux
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ FIX CYCLE D'IMPORTS (2026-09-30) — crash-loop au boot Railway :
 *   ReferenceError: Cannot access 'FederisPatronatService' before initialization
 *
 *   Ces fonctions vivaient dans federis-school-exams.service.ts et
 *   federis-patronat.service.ts les importait DEPUIS ce fichier. Or
 *   school-exams importe deliberation + grades + pdf, lesquels injectent
 *   FederisPatronatService (design:paramtypes) → au chargement CommonJS
 *   (nest-cli.json builder "swc" + decoratorMetadata), le cycle
 *   patronat → school-exams → grades → subjects → patronat laissait
 *   patronat PARTIELLEMENT initialisé quand un autre module accédait à son
 *   export → TDZ ReferenceError → le conteneur redémarrait en boucle.
 *
 *   Les fonctions sont donc hissées dans ce module FEUILLE (ZÉRO import),
 *   consommable par patronat, exams et school-exams sans créer de cycle.
 *
 * Consommateurs : federis-patronat.service (fiche école + adhésions),
 * federis-exams.service (regroupement par série), federis-school-exams.service
 * (classes éligibles + envoi officiel). Le miroir frontend (web-app) conserve
 * ses propres copies typées.
 */

// ── Définitions des examens nationaux ───────────────────────────────────────

export type NationalExamType = 'CEP' | 'BEPC' | 'BAC' | 'CAP';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Normalisation insensible à la casse/accents. */
function normalizeUpper(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Une classe physique (ou officielle) correspond-elle au type d'examen ?
 *   CEP  : « CM2 A », « CM2 »…
 *   BEPC : « 3ème 1 », « 3E A », « 3A »…
 *   BAC  : « Terminale C », « Tle D », « Term A1 »… (hors classes CAP)
 *   CAP  : « Terminale CAP », « Tle CAP Mécanique », « CAP 2 », « 2CAP »…
 *          ⭐ + TOUTES les classes du DOMAINE TECHNIQUE (filières
 *          professionnelles : mécanique, couture, électricité, menuiserie,
 *          coiffure, bâtiment…) hors séries du baccalauréat (A-G) et du
 *          Brevet de Technicien (BT) — ces classes présentent le CAP, le
 *          système les récupère donc automatiquement pour le niveau CAP.
 *    ⚠️ Les classes CAP sont exclues du BAC : elles présentent le CAP,
 *    pas le baccalauréat général/technique.
 *
 * @param names noms candidats de la classe : nom physique, classe officielle
 *              (Pédagogie) et niveau académique — le rapprochement se fait
 *              sur l'ensemble (une classe « Tle CAP Mécanique » rattachée à
 *              une classe officielle « Terminale » reste éligible CAP).
 */
export function classMatchesExam(
  names: (string | null | undefined)[],
  type: NationalExamType,
): boolean {
  const normalized = names.map((n) => normalizeUpper(n)).filter(Boolean) as string[];
  if (normalized.length === 0) return false;

  if (type === 'CEP') return normalized.some((n) => n.startsWith('CM2'));
  if (type === 'BEPC') return normalized.some((n) => /^3($|[^0-9])/.test(n));
  if (type === 'CAP') {
    // 1. Mention explicite « CAP » dans le nom (physique, officiel ou niveau)
    if (normalized.some((n) => n.includes('CAP'))) return true;
    // 2. Domaine technique / filière professionnelle — hors classes portant
    //    une série du baccalauréat (A1…G2 — elles présentent le BAC) et hors
    //    Brevet de Technicien (BT).
    const hasBacSeries = normalized.some((n) => BAC_SERIES_ANYWHERE.test(n));
    const hasBt = normalized.some((n) => /\bBT\b/.test(n));
    if (hasBacSeries || hasBt) return false;
    return normalized.some((n) => CAP_TECHNICAL_KEYWORDS.some((k) => n.includes(k)));
  }
  // BAC — les filières professionnelles (CAP) ne présentent pas le bac
  return normalized.some(
    (n) => !n.includes('CAP') && (n.startsWith('TERM') || n.startsWith('TLE') || n.startsWith('BAC')),
  );
}

/**
 * ⭐ Mots-clés du domaine technique & professionnel (CAP) — filières
 * présentées au Certificat d'Aptitude Professionnelle au Bénin.
 */
const CAP_TECHNICAL_KEYWORDS = [
  'TECHNIQUE',
  'TECHNOLOGIQUE',
  'PROFESSIONNEL',
  'VOCATIONNEL',
  'METIER',
  'APPRENTISSAGE',
  'ARTISANAT',
  'FILIERE',
  'MECANIQUE',
  'AUTOMOBILE',
  'COUTURE',
  'BRODERIE',
  'ELECTRICITE',
  'ELECTRONIQUE',
  'ELECTROTECHNIQUE',
  'MENUISERIE',
  'CHARPENTE',
  'COIFFURE',
  'ESTHETIQUE',
  'BATIMENT',
  'MACONNERIE',
  'SOUDURE',
  'PLOMBERIE',
  'PEINTURE',
  'VENTE',
  'HOTELLERIE',
  'RESTAURATION',
  'CUISINE',
  'PATISSERIE',
  'BOULANGERIE',
  'AGRICULTURE',
  'ELEVAGE',
  'PISCICULTURE',
  'MAINTENANCE',
  'INFORMATIQUE',
] as const;

/** Série de bac explicite (A1, A2, B, C, D, E, F1-F4, G1-G2) après le préfixe d'année. */
const BAC_SERIES_ANYWHERE =
  /(?:TERM(?:INALE)?|TLE|BAC|1ERE|1RE|PREMIERE|2NDE|SECONDE)\s+(?:SERIE\s+)?[A-G]\d?\b/;

/**
 * Extrait la série d'un nom de classe de Terminale (« Terminale C » → « C »).
 * Tolère un numéro de division en fin de nom (« Terminale D 1 » → « D »).
 */
function seriesFromClassName(className: string | null | undefined): string | null {
  const n = normalizeUpper(className);
  if (!n) return null;
  const match = n.match(
    /(?:TERM(?:INALE)?|TLE|BAC)\s*(?:SERIE\s*)?([A-Z]\d?|[A-Z]{2})(?:\s+\d+)?\s*$/,
  );
  return match?.[1] ?? null;
}

/**
 * Série d'élève pour l'envoi officiel (Bac) : classe officielle (AcademicSeries)
 * en priorité, sinon extraction depuis le nom de classe. Exporté pour le
 * regroupement par série côté patronat (federis-exams.service).
 */
export function resolveSeriesFromClassNames(
  physicalName: string | null | undefined,
  officialName: string | null | undefined,
  officialSeriesName: string | null | undefined,
): string | null {
  if (officialSeriesName) return officialSeriesName.toUpperCase();
  return (
    seriesFromClassName(physicalName) ?? seriesFromClassName(officialName) ?? null
  );
}

/** Niveau fédéré (NationalExam.level) ↔ type d'examen national. */
export function federisLevelMatchesType(level: string | null | undefined, type: NationalExamType): boolean {
  const n = normalizeUpper(level);
  if (!n) return false;
  if (type === 'CEP') return n.startsWith('CM2');
  if (type === 'BEPC') return /^3/.test(n);
  if (type === 'CAP') return n.includes('CAP');
  // BAC — exclut les niveaux CAP (filières techniques/professionnelles)
  return (n.startsWith('TERM') || n.startsWith('TLE')) && !n.includes('CAP');
}

// ── Identité des candidats (anti-doublons — 2026-09-30) ─────────────────────
//
// ⚇ RÈGLE MÉTIER : une même personne (prénom + nom + date de naissance) ne
//   doit JAMAIS figurer deux fois sur un même examen. Un doublon se retrouve
//   affecté à DEUX centres lors de la génération des numéros de table —
//   c'est le défaut remonté par le patronat. La clé est partagée par :
//   • federis-exams.service      — import Excel (dédoublonnage base + lot),
//                                  détection des doublons + purge manuelle ;
//   • federis-school-exams.service — envoi officiel des écoles (rapprochement
//                                  par identité AVANT création d'une ligne).

/**
 * Clé d'identité normalisée d'un candidat : prénom|nom|date de naissance
 * (casse, accents et espaces superflus neutralisés ; date au format ISO).
 */
export function candidateIdentityKey(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  dateOfBirth: Date | string | null | undefined,
): string {
  const norm = (v: string | null | undefined) =>
    (v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  let dob = '';
  if (dateOfBirth instanceof Date && !isNaN(dateOfBirth.getTime())) {
    dob = dateOfBirth.toISOString().slice(0, 10);
  } else if (typeof dateOfBirth === 'string' && dateOfBirth.trim()) {
    const d = new Date(dateOfBirth);
    dob = isNaN(d.getTime()) ? dateOfBirth.trim() : d.toISOString().slice(0, 10);
  }
  return `${norm(firstName)}|${norm(lastName)}|${dob}`;
}
