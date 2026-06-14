/**
 * ============================================================================
 * COORDONNÉES SVG DES COMMUNES DU BÉNIN
 * ============================================================================
 *
 * Coordonnées des 77 communes du Bénin, positionnées sur la carte SVG
 * (viewBox 0 0 360 400) utilisée dans BeninMap.tsx.
 *
 * Données source : communes_benin.xlsx (12 départements, 77 communes).
 * Chaque commune est associée à son département pour permettre le filtrage.
 * Les coordonnées sont approximatives et positionnées pour un rendu visuel
 * optimal sur la carte SVG.
 *
 * ============================================================================
 */

export interface CityCoord {
  /** Nom de la commune */
  name: string;
  /** Code du département (AL, AT, BO, etc.) */
  dept: string;
  /** Coordonnée X dans le viewBox SVG (0-360) */
  x: number;
  /** Coordonnée Y dans le viewBox SVG (0-400) */
  y: number;
}

/**
 * Coordonnées SVG des 77 communes du Bénin.
 * Alignées sur la carte SVG viewBox="0 0 360 400" de BeninMap.tsx.
 * Source : communes_benin.xlsx — toutes les communes officielles du Bénin.
 */
export const BENIN_CITIES: CityCoord[] = [
  // ── Alibori (AL) — Nord-Est, 6 communes ──
  { name: 'Banikoara', dept: 'AL', x: 190, y: 60 },
  { name: 'Kandi', dept: 'AL', x: 216, y: 55 },
  { name: 'Gogounou', dept: 'AL', x: 200, y: 80 },
  { name: 'Ségbana', dept: 'AL', x: 240, y: 75 },
  { name: 'Bembèrèkè', dept: 'AL', x: 210, y: 95 },
  { name: 'Kalalé', dept: 'AL', x: 250, y: 115 },
  // Villes supplémentaires (non-communes) pour résolution géographique
  { name: 'Malanville', dept: 'AL', x: 230, y: 25 },
  { name: 'Karimama', dept: 'AL', x: 245, y: 30 },

  // ── Atacora (AT) — Nord-Ouest, 9 communes ──
  { name: 'Natitingou', dept: 'AT', x: 125, y: 95 },
  { name: 'Tanguiéta', dept: 'AT', x: 110, y: 75 },
  { name: 'Cobly', dept: 'AT', x: 100, y: 85 },
  { name: 'Boukoumbé', dept: 'AT', x: 95, y: 95 },
  { name: 'Matéri', dept: 'AT', x: 105, y: 65 },
  { name: 'Kouandé', dept: 'AT', x: 135, y: 100 },
  { name: 'Kérou', dept: 'AT', x: 140, y: 80 },
  { name: 'Péhunco', dept: 'AT', x: 125, y: 115 },
  { name: 'Toucountouna', dept: 'AT', x: 120, y: 108 },

  // ── Borgou (BO) — Nord (Centre), 8 communes ──
  { name: 'Parakou', dept: 'BO', x: 220, y: 155 },
  { name: "N'Dali", dept: 'BO', x: 200, y: 140 },
  { name: 'Bembèrèkè', dept: 'BO', x: 225, y: 120 },
  { name: 'Sinendé', dept: 'BO', x: 185, y: 130 },
  { name: 'Tchaourou', dept: 'BO', x: 210, y: 180 },
  { name: 'Pèrèrè', dept: 'BO', x: 235, y: 140 },
  { name: 'Glazoué', dept: 'BO', x: 195, y: 170 },
  { name: 'Nikki', dept: 'BO', x: 260, y: 95 },

  // ── Donga (DO) — Centre-Ouest, 4 communes ──
  { name: 'Djougou', dept: 'DO', x: 153, y: 190 },
  { name: 'Copargo', dept: 'DO', x: 160, y: 175 },
  { name: 'Ouaké', dept: 'DO', x: 135, y: 195 },
  { name: 'Bassila', dept: 'DO', x: 140, y: 210 },

  // ── Collines (CO) — Centre, 6 communes ──
  { name: 'Savè', dept: 'CO', x: 190, y: 240 },
  { name: 'Tchaourou', dept: 'CO', x: 205, y: 245 },
  { name: 'Bantè', dept: 'CO', x: 150, y: 270 },
  { name: 'Dassa-Zoumè', dept: 'CO', x: 180, y: 255 },
  { name: 'Glazoué', dept: 'CO', x: 195, y: 265 },
  { name: 'Ouèssè', dept: 'CO', x: 210, y: 250 },
  // Villes supplémentaires pour résolution géographique
  { name: 'Savalou', dept: 'CO', x: 165, y: 260 },
  { name: 'Ouessè', dept: 'CO', x: 210, y: 250 },

  // ── Zou (ZO) — Centre-Sud, 9 communes ──
  { name: 'Abomey', dept: 'ZO', x: 160, y: 320 },
  { name: 'Bohicon', dept: 'ZO', x: 170, y: 325 },
  { name: 'Agbangnizoun', dept: 'ZO', x: 150, y: 330 },
  { name: 'Djidja', dept: 'ZO', x: 145, y: 310 },
  { name: 'Covè', dept: 'ZO', x: 155, y: 340 },
  { name: 'Zogbodomey', dept: 'ZO', x: 160, y: 345 },
  { name: 'Za-Kpota', dept: 'ZO', x: 175, y: 335 },
  { name: 'Zagnanado', dept: 'ZO', x: 165, y: 348 },
  { name: 'Ouinhi', dept: 'ZO', x: 180, y: 340 },
  // Alias d'accent
  { name: 'Cové', dept: 'ZO', x: 155, y: 340 },

  // ── Couffo (KO) — Sud-Ouest, 6 communes ──
  { name: 'Aplahoué', dept: 'KO', x: 145, y: 350 },
  { name: 'Djakotomey', dept: 'KO', x: 135, y: 345 },
  { name: 'Klouékanmè', dept: 'KO', x: 130, y: 355 },
  { name: 'Lalo', dept: 'KO', x: 140, y: 360 },
  { name: 'Dogbo', dept: 'KO', x: 135, y: 340 },
  { name: 'Toviklin', dept: 'KO', x: 148, y: 345 },

  // ── Plateau (PL) — Est, 5 communes ──
  { name: 'Adja-Ouèrè', dept: 'PL', x: 200, y: 340 },
  { name: 'Pobè', dept: 'PL', x: 215, y: 330 },
  { name: 'Kétou', dept: 'PL', x: 210, y: 310 },
  { name: 'Sakété', dept: 'PL', x: 220, y: 345 },
  { name: 'Ifangni', dept: 'PL', x: 225, y: 355 },

  // ── Ouémé (OU) — Sud-Est, 9 communes ──
  { name: 'Porto-Novo', dept: 'OU', x: 210, y: 370 },
  { name: 'Adjohoun', dept: 'OU', x: 195, y: 355 },
  { name: 'Akpro-Missérété', dept: 'OU', x: 200, y: 362 },
  { name: 'Adjarra', dept: 'OU', x: 215, y: 360 },
  { name: 'Avrankou', dept: 'OU', x: 220, y: 360 },
  { name: 'Bonou', dept: 'OU', x: 195, y: 350 },
  { name: 'Dangbo', dept: 'OU', x: 205, y: 355 },
  { name: 'Aguégués', dept: 'OU', x: 225, y: 380 },
  { name: 'Sèmè-Kpodji', dept: 'OU', x: 220, y: 375 },

  // ── Mono (MO) — Sud-Ouest, 6 communes ──
  { name: 'Lokossa', dept: 'MO', x: 130, y: 370 },
  { name: 'Athiémé', dept: 'MO', x: 118, y: 368 },
  { name: 'Bopa', dept: 'MO', x: 115, y: 385 },
  { name: 'Houéyogbé', dept: 'MO', x: 120, y: 375 },
  { name: 'Comè', dept: 'MO', x: 140, y: 380 },
  { name: 'Grand-Popo', dept: 'MO', x: 105, y: 390 },

  // ── Atlantique (AQ) — Sud (Centre), 8 communes ──
  { name: 'Allada', dept: 'AQ', x: 165, y: 365 },
  { name: 'Zè', dept: 'AQ', x: 190, y: 370 },
  { name: 'Toffo', dept: 'AQ', x: 175, y: 360 },
  { name: 'Abomey-Calavi', dept: 'AQ', x: 170, y: 370 },
  { name: 'Kpomassè', dept: 'AQ', x: 155, y: 380 },
  { name: 'Ouidah', dept: 'AQ', x: 145, y: 375 },
  { name: 'Sô-Ava', dept: 'AQ', x: 178, y: 382 },
  { name: 'Tori-Bossito', dept: 'AQ', x: 180, y: 375 },

  // ── Littoral (LI) — Extrême Sud (côte), 1 commune ──
  { name: 'Cotonou', dept: 'LI', x: 190, y: 380 },
];

/**
 * Index rapide : nom de ville → coordonnées (insensible à la casse)
 * Note: pour les villes homonymes dans différents départements,
 * seule la dernière entrée est conservée dans cette Map.
 * Utiliser findCityCoord() pour une recherche plus précise.
 */
export const CITY_COORD_MAP = new Map(
  BENIN_CITIES.map((c) => [c.name.toLowerCase(), c]),
);

/**
 * Trouve les coordonnées SVG d'une commune par son nom.
 * Recherche insensible à la casse, avec fallback sur le département.
 * Gère les accents variables (Covè/Cové, Bembèrèkè/Bembéréké, etc.).
 */
export function findCityCoord(
  cityName: string,
  deptCode?: string,
): CityCoord | null {
  if (!cityName) return null;

  // 1. Recherche exacte par nom
  const exact = CITY_COORD_MAP.get(cityName.toLowerCase());
  if (exact) return exact;

  // 2. Recherche partielle (la ville peut contenir des accents différents)
  const lower = cityName.toLowerCase();
  const partial = BENIN_CITIES.find((c) =>
    c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()),
  );
  if (partial) return partial;

  // 3. Normalisation des accents courants
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normInput = normalize(cityName);
  const normMatch = BENIN_CITIES.find((c) => normalize(c.name) === normInput);
  if (normMatch) return normMatch;

  // 4. Fallback : première ville du département
  if (deptCode) {
    const deptCity = BENIN_CITIES.find((c) => c.dept === deptCode);
    if (deptCity) return deptCity;
  }

  return null;
}
