/**
 * ============================================================================
 * MATERNELLE DOMAIN GROUPING — Bulletin des notes (UI + PDF)
 * ============================================================================
 *
 * ⭐ 2026-09-30 — Utilitaire partagé entre :
 *   - Frontend BulletinMaternellePage1 (bulletin d'évaluation)
 *   - Frontend VueParMatiereTrimestriel / VueParMatiereAnnuel
 *   - Backend bulletin-pdf.service.ts (buildHtml maternelle + buildHtmlVueParMatiere)
 *
 * Groupage des matières maternelle en 5 domaines officiels :
 *
 *   DOMAINE 1 — Éducation pour la santé
 *     - Éducation pour la santé
 *     - Éducation à des réflexions de santé / Éducation à des réflexes de santé
 *
 *   DOMAINE 2 — Éducation du mouvement, Gestuelle et Rythmique
 *     - Éducation du mouvement
 *     - Gestuelle
 *     - Rythmique
 *
 *   DOMAINE 3 — Observation, Éducation sensorielle, Pré-lecture, Pré-écriture, Pré-mathématique
 *     - Observation
 *     - Éducation sensorielle
 *     - Pré-lecture / Pré-lecture
 *     - Pré-écriture / Pré-écriture
 *     - Pré-mathématique / Pré-mathématiques
 *
 *   DOMAINE 4 — Expression plastique, Expression émotionnelle
 *     - Expression plastique
 *     - Expression émotionnelle
 *
 *   DOMAINE 5 — Langage, Conte, Comptine, Poésie, Chant
 *     - Langage
 *     - Conte
 *     - Comptine
 *     - Poésie
 *     - Chant
 *
 * Normalisation NFD (sans accents) + lowercase pour la robustesse.
 * L'ordre d'affichage est fixe : Domaine 1 → 2 → 3 → 4 → 5, et dans chaque
 * domaine l'ordre canonique ci-dessus. Les matières non reconnues vont dans
 * le Domaine 5 (fallback) ou un Domaine "Autres" si elles ne matchent aucun
 * marqueur.
 * ============================================================================
 */

export type MaternelleDomain = 1 | 2 | 3 | 4 | 5;

interface DomainRule {
  domain: MaternelleDomain;
  markers: string[];   // NFD-normalized substrings
}

// ─── Règles de groupage (NFD-normalized) ─────────────────────────────────────
const DOMAIN_RULES: DomainRule[] = [
  // DOMAINE 1
  {
    domain: 1,
    markers: [
      'education pour la sante',
      'education a des reflexions de sante',
      'education a des reflexes de sante',
      'reflexions de sante',
      'reflexes de sante',
    ],
  },
  // DOMAINE 2
  {
    domain: 2,
    markers: [
      'education du mouvement',
      'gestuelle',
      'rythmique',
      'expression corporelle',
      'mouvement',
    ],
  },
  // DOMAINE 3
  {
    domain: 3,
    markers: [
      'observation',
      'education sensorielle',
      'pre-lecture',
      'pre lecture',
      'pre-ecriture',
      'pre ecriture',
      'pre-mathematique',
      'pre-mathematiques',
      'pre mathematique',
      'pre mathematiques',
      'eveil scientifique',
    ],
  },
  // DOMAINE 4
  {
    domain: 4,
    markers: [
      'expression plastique',
      'expression emotionnelle',
      'dessin',
      'peinture',
      'coloriage',
    ],
  },
  // DOMAINE 5
  {
    domain: 5,
    markers: [
      'langage',
      'conte',
      'comptine',
      'poesie',
      'chant',
      'expression orale',
      'expression orale',
      'communication',
    ],
  },
];

// ─── Ordre canonique dans chaque domaine ─────────────────────────────────────
const DOMAIN_CANONICAL_ORDER: Record<MaternelleDomain, string[]> = {
  1: [
    'education pour la sante',
    'education a des reflexions de sante',
    'education a des reflexes de sante',
  ],
  2: [
    'education du mouvement',
    'gestuelle',
    'rythmique',
    'expression corporelle',
  ],
  3: [
    'observation',
    'education sensorielle',
    'pre-lecture',
    'pre-ecriture',
    'pre-mathematique',
    'pre-mathematiques',
    'eveil scientifique',
  ],
  4: [
    'expression plastique',
    'expression emotionnelle',
  ],
  5: [
    'langage',
    'conte',
    'comptine',
    'poesie',
    'chant',
    'expression orale',
  ],
};

// ─── Labels des domaines (pour l'affichage) ──────────────────────────────────
export const DOMAIN_LABELS: Record<MaternelleDomain, string> = {
  1: 'Domaine 1 — Éducation pour la santé',
  2: 'Domaine 2 — Éducation du mouvement, Gestuelle et Rythmique',
  3: 'Domaine 3 — Observation, Éducation sensorielle, Pré-lecture, Pré-écriture, Pré-mathématique',
  4: 'Domaine 4 — Expression plastique, Expression émotionnelle',
  5: 'Domaine 5 — Langage, Conte, Comptine, Poésie, Chant',
};

const normalizeName = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Retourne le domaine (1-5) d'une matière maternelle.
 * Si la matière ne match aucune règle, retourne 5 (fallback).
 */
export function getMaternelleDomain(subjectName: string): MaternelleDomain {
  const n = normalizeName(subjectName);
  if (!n) return 5;
  for (const rule of DOMAIN_RULES) {
    for (const marker of rule.markers) {
      const m = normalizeName(marker);
      if (m && n.includes(m)) return rule.domain;
    }
  }
  // Fallback : Anglais, Informatique, etc. → Domaine 5
  return 5;
}

/**
 * Retourne l'index canonique d'une matière dans son domaine.
 * Plus petit = plus prioritaire (affiché en premier).
 */
export function getMaternelleDomainCanonicalIndex(subjectName: string, domain: MaternelleDomain): number {
  const n = normalizeName(subjectName);
  if (!n) return Number.MAX_SAFE_INTEGER;
  const order = DOMAIN_CANONICAL_ORDER[domain] || [];
  for (let i = 0; i < order.length; i++) {
    const m = normalizeName(order[i]);
    if (m && n.includes(m)) return i;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Trie les matières maternelle par domaine puis par ordre canonique.
 * L'ordre ne dépend pas de l'ordre d'entrée → identique pour tous les élèves.
 */
export function sortMaternelleSubjects<T extends { name: string }>(subjects: T[]): T[] {
  return [...subjects].sort((a, b) => {
    const domA = getMaternelleDomain(a.name);
    const domB = getMaternelleDomain(b.name);
    if (domA !== domB) return domA - domB;
    const idxA = getMaternelleDomainCanonicalIndex(a.name, domA);
    const idxB = getMaternelleDomainCanonicalIndex(b.name, domB);
    if (idxA !== idxB) return idxA - idxB;
    return normalizeName(a.name).localeCompare(normalizeName(b.name), 'fr');
  });
}

/**
 * Groupe les matières par domaine (1-5).
 * Retourne un Map<MaternelleDomain, T[]> ordonné par domaine.
 */
export function groupMaternelleByDomain<T extends { name: string }>(subjects: T[]): Map<MaternelleDomain, T[]> {
  const result = new Map<MaternelleDomain, T[]>();
  for (const dom of [1, 2, 3, 4, 5] as MaternelleDomain[]) {
    result.set(dom, []);
  }
  for (const s of subjects) {
    const dom = getMaternelleDomain(s.name);
    result.get(dom)!.push(s);
  }
  // Trier dans chaque domaine
  for (const dom of [1, 2, 3, 4, 5] as MaternelleDomain[]) {
    const group = result.get(dom)!;
    if (group.length === 0) continue;
    group.sort((a, b) => {
      const idxA = getMaternelleDomainCanonicalIndex(a.name, dom);
      const idxB = getMaternelleDomainCanonicalIndex(b.name, dom);
      if (idxA !== idxB) return idxA - idxB;
      return normalizeName(a.name).localeCompare(normalizeName(b.name), 'fr');
    });
  }
  return result;
}
