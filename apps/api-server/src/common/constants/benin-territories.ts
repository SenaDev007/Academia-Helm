/**
 * ============================================================================
 * TERRITOIRES DU BÉNIN — communes → départements + alias de départements
 * ============================================================================
 *
 * Source : données officielles du gouvernement béninois, alignées sur
 * apps/web-app/src/data/benin-departments.ts (12 départements, 77 communes)
 * et apps/web-app/src/data/benin-cities.ts — même canonique des deux côtés.
 *
 * ⭐ Usage (découverte automatique des écoles — Federis, 2026-09-29) :
 * l'onboarding Helm ne collecte que la VILLE de l'école (champ School.city,
 * cf. OnboardingWizard « Ville ») — le champ School.department reste vide
 * pour la quasi-totalité des écoles réelles. La correspondance
 * commune → département permet donc de rattacher chaque école au
 * département de son patronat.
 *
 * ⚠️ Alias de départements : en décembre 2016, 4 départements ont été
 * renommés (libellés composés). Les deux libellés sont acceptés :
 *   Atlantique ↔ Atlantique-Littoral · Alibori ↔ Alibori-Borgou
 *   Mono ↔ Couffo-Mono · Ouémé ↔ Ouémé-Plateau
 */

/** Libellé officiel des 12 départements du Bénin. */
export const BENIN_DEPARTMENTS = [
  'Alibori',
  'Atacora',
  'Atlantique',
  'Borgou',
  'Collines',
  'Couffo',
  'Donga',
  'Littoral',
  'Mono',
  'Ouémé',
  'Plateau',
  'Zou',
] as const;

/** Alias / renommages 2016 : clé = libellé officiel, valeurs = acceptés aussi. */
export const BENIN_DEPARTMENT_ALIASES: Record<string, string[]> = {
  Atlantique: ['Atlantique-Littoral'],
  Alibori: ['Alibori-Borgou'],
  Mono: ['Couffo-Mono'],
  Ouémé: ['Ouémé-Plateau'],
};

/**
 * Les 77 communes du Bénin → département officiel.
 * (Miroir exact de benin-departments.ts — données officielles du repo.)
 */
export const BENIN_COMMUNE_TO_DEPARTMENT: Record<string, string> = {
  // ── Alibori ──
  Banikoara: 'Alibori',
  Kandi: 'Alibori',
  Malanville: 'Alibori',
  Gogounou: 'Alibori',
  'Ségbana': 'Alibori',
  Karimama: 'Alibori',
  // ── Atacora ──
  Natitingou: 'Atacora',
  'Matéri': 'Atacora',
  'Boukoumbé': 'Atacora',
  'Kouandé': 'Atacora',
  'Tanguiéta': 'Atacora',
  Cobly: 'Atacora',
  'Kérou': 'Atacora',
  'Péhunco': 'Atacora',
  Toucountouna: 'Atacora',
  // ── Atlantique ──
  'Abomey-Calavi': 'Atlantique',
  Ouidah: 'Atlantique',
  Allada: 'Atlantique',
  'Zè': 'Atlantique',
  'Tori-Bossito': 'Atlantique',
  Toffo: 'Atlantique',
  'Kpomassè': 'Atlantique',
  'So-Ava': 'Atlantique',
  // ── Borgou ──
  Parakou: 'Borgou',
  Nikki: 'Borgou',
  Tchaourou: 'Borgou',
  'Bembèrèkè': 'Borgou',
  "N'Dali": 'Borgou',
  'Kalalé': 'Borgou',
  'Sinendé': 'Borgou',
  'Pèrérè': 'Borgou',
  // ── Collines ──
  'Dassa-Zoumè': 'Collines',
  'Glazoué': 'Collines',
  Savalou: 'Collines',
  'Savè': 'Collines',
  'Bantè': 'Collines',
  'Ouèssè': 'Collines',
  // ── Couffo ──
  Aplahoué: 'Couffo',
  'Klouékanmè': 'Couffo',
  Dogbo: 'Couffo',
  Djakotomey: 'Couffo',
  Lalo: 'Couffo',
  Toviklin: 'Couffo',
  // ── Donga ──
  Djougou: 'Donga',
  'Ouaké': 'Donga',
  Bassila: 'Donga',
  Copargo: 'Donga',
  // ── Littoral ──
  Cotonou: 'Littoral',
  // ── Mono ──
  'Houéyogbé': 'Mono',
  Lokossa: 'Mono',
  'Comè': 'Mono',
  Bopa: 'Mono',
  'Grand-Popo': 'Mono',
  'Athiémè': 'Mono',
  // ── Ouémé ──
  'Porto-Novo': 'Ouémé',
  'Sèmè-Podji': 'Ouémé',
  'Akpro-Missérété': 'Ouémé',
  Adjarra: 'Ouémé',
  Avrankou: 'Ouémé',
  Dangbo: 'Ouémé',
  Adjohoun: 'Ouémé',
  Bonou: 'Ouémé',
  'Aguégués': 'Ouémé',
  // ── Plateau ──
  'Kétou': 'Plateau',
  Ifangni: 'Plateau',
  'Adja-Ouèrè': 'Plateau',
  'Pobè': 'Plateau',
  'Sakété': 'Plateau',
  // ── Zou ──
  Bohicon: 'Zou',
  'Za-Kpota': 'Zou',
  Djidja: 'Zou',
  Abomey: 'Zou',
  Zogbodomey: 'Zou',
  Agbangnizou: 'Zou',
  Zagnanado: 'Zou',
  Ouinhi: 'Zou',
  'Covè': 'Zou',
};

/** Alias de communes fréquents (zones urbaines, orthographes courantes). */
export const BENIN_COMMUNE_ALIASES: Record<string, string> = {
  Calavi: 'Abomey-Calavi',
  'Godomey': 'Abomey-Calavi',
  'Akassato': 'Abomey-Calavi',
  'Zinvié': 'Abomey-Calavi',
  'Porto Novo': 'Porto-Novo',
  'Semè-Podji': 'Sèmè-Podji',
  'Seme-Kpodji': 'Sèmè-Podji',
  'Dassa': 'Dassa-Zoumè',
  'Dogbo-Tota': 'Dogbo',
  'Grand Popo': 'Grand-Popo',
  'Adjara': 'Adjarra',
  'Bembereke': 'Bembèrèkè',
  'Bembèrèkè': 'Bembèrèkè',
  'Perere': 'Pèrérè',
  'Sinende': 'Sinendé',
  'Ketou': 'Kétou',
  'Pobe': 'Pobè',
  'Sakete': 'Sakété',
  'Ouessè': 'Ouèssè',
  'Aguégué': 'Aguégués',
  'Zagnanado': 'Zagnanado',
};

/** Normalisation territoriale : accents retirés, casse et séparateurs ignorés. */
export function normalizeTerritoryKey(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Ensemble des libellés normalisés acceptés pour un département
 * (libellé officiel + alias 2016). Ex. « Atlantique » → { ATLANTIQUE,
 * ATLANTIQUELITTORAL }.
 */
export function departmentKeys(department: string): Set<string> {
  const keys = new Set<string>([normalizeTerritoryKey(department)]);
  for (const alias of BENIN_DEPARTMENT_ALIASES[department] ?? []) {
    keys.add(normalizeTerritoryKey(alias));
  }
  return keys;
}

/** Map normalisée commune → clés de département (construite une fois). */
const COMMUNE_DEPARTMENT_KEYS: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();
  const add = (commune: string, department: string) => {
    map.set(normalizeTerritoryKey(commune), departmentKeys(department));
  };
  for (const [commune, department] of Object.entries(BENIN_COMMUNE_TO_DEPARTMENT)) {
    add(commune, department);
  }
  for (const [alias, commune] of Object.entries(BENIN_COMMUNE_ALIASES)) {
    add(alias, BENIN_COMMUNE_TO_DEPARTMENT[commune] ?? commune);
  }
  return map;
})();

/**
 * Un libellé de territoire (département, alias ou commune) contient-il la
 * ville donnée ? Utilisé pour la découverte automatique : le patronat
 * « Atlantique-Littoral » doit trouver les écoles d'« Abomey-Calavi ».
 */
export function territoryIncludesCity(
  territory: string | null | undefined,
  city: string | null | undefined,
): boolean {
  const cityKeys = cityKeysOf(city);
  if (cityKeys === null) return false;
  return territoryIncludesKeys(territory, cityKeys);
}

/** Clés de département d'une ville béninoise (null si ville inconnue). */
export function cityKeysOf(city: string | null | undefined): Set<string> | null {
  if (!city) return null;
  return COMMUNE_DEPARTMENT_KEYS.get(normalizeTerritoryKey(city)) ?? null;
}

/** Map normalisée commune → libellé canonique du département (construite une fois). */
const COMMUNE_DEPARTMENT_NAME: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [commune, department] of Object.entries(BENIN_COMMUNE_TO_DEPARTMENT)) {
    map.set(normalizeTerritoryKey(commune), department);
  }
  for (const [alias, commune] of Object.entries(BENIN_COMMUNE_ALIASES)) {
    map.set(normalizeTerritoryKey(alias), BENIN_COMMUNE_TO_DEPARTMENT[commune] ?? commune);
  }
  return map;
})();

/**
 * ⭐ Département canonique d'une ville béninoise (null si ville inconnue).
 * Ex. « Parakou » → « Borgou », « Abomey-Calavi » → « Atlantique ».
 * Utilisé pour catégoriser les écoles par département (vision patronat
 * national) et pour attribuer une demande d'adhésion au patronat
 * départemental de l'école.
 */
export function cityToDepartment(city: string | null | undefined): string | null {
  if (!city) return null;
  return COMMUNE_DEPARTMENT_NAME.get(normalizeTerritoryKey(city)) ?? null;
}

/** Le territoire donné (tout libellé) couvre-t-il l'ensemble de clées ? */
export function territoryIncludesKeys(
  territory: string | null | undefined,
  keys: Set<string>,
): boolean {
  if (!territory) return false;
  const t = normalizeTerritoryKey(territory);
  if (!t) return false;
  // Correspondance directe (le territoire EST le département / son alias)
  if (keys.has(t)) return true;
  // Correspondance par inclusion (« Département de l'Atlantique-Littoral »)
  for (const k of keys) {
    if (k.length >= 4 && t.includes(k)) return true;
  }
  return false;
}
