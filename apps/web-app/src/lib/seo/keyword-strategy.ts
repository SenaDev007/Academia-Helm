export type KeywordIntent = 'transactional' | 'informational' | 'comparative';

export type KeywordItem = {
  keyword: string;
  intent: KeywordIntent;
  pillar:
    | '/gestion-scolaire'
    | '/logiciel-gestion-ecole'
    | '/logiciel-ecole-afrique'
    | '/gestion-etablissement-scolaire';
  priority: 1 | 2 | 3 | 4 | 5;
};

// Liste initiale : à enrichir par l’engine (GSC + conversions + opportunités).
export const KEYWORDS: KeywordItem[] = [
  { keyword: 'gestion scolaire Afrique', intent: 'transactional', pillar: '/gestion-scolaire', priority: 1 },
  { keyword: 'logiciel gestion école', intent: 'transactional', pillar: '/logiciel-gestion-ecole', priority: 1 },
  { keyword: 'logiciel école Afrique', intent: 'transactional', pillar: '/logiciel-ecole-afrique', priority: 1 },
  { keyword: 'gestion établissement scolaire', intent: 'transactional', pillar: '/gestion-etablissement-scolaire', priority: 2 },
  { keyword: 'digitalisation école Afrique', intent: 'informational', pillar: '/logiciel-ecole-afrique', priority: 2 },
  { keyword: 'réduire impayés frais scolaires', intent: 'informational', pillar: '/gestion-scolaire', priority: 2 },
  { keyword: 'meilleur logiciel gestion scolaire', intent: 'comparative', pillar: '/logiciel-gestion-ecole', priority: 3 },
];

export function pickNextKeywords(limit: number) {
  const sorted = [...KEYWORDS].sort((a, b) => a.priority - b.priority);
  return sorted.slice(0, limit);
}

