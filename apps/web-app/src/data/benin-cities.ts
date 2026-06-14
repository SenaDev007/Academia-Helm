/**
 * ============================================================================
 * COORDONNÉES SVG DES VILLES DU BÉNIN
 * ============================================================================
 *
 * Coordonnées des principales villes du Bénin, positionnées sur la carte SVG
 * (viewBox 0 0 360 400) utilisée dans BeninMap.tsx.
 *
 * Chaque ville est associée à son département pour permettre le filtrage.
 * Les coordonnées sont approximatives et positionnées pour un rendu visuel
 * optimal sur la carte SVG.
 *
 * ============================================================================
 */

export interface CityCoord {
  /** Nom de la ville */
  name: string;
  /** Code du département (AL, AT, BO, etc.) */
  dept: string;
  /** Coordonnée X dans le viewBox SVG (0-360) */
  x: number;
  /** Coordonnée Y dans le viewBox SVG (0-400) */
  y: number;
}

/**
 * Coordonnées SVG des villes principales du Bénin.
 * Alignées sur la carte SVG viewBox="0 0 360 400" de BeninMap.tsx.
 */
export const BENIN_CITIES: CityCoord[] = [
  // ── Alibori (AL) ──
  { name: 'Kandi', dept: 'AL', x: 216, y: 55 },
  { name: 'Malanville', dept: 'AL', x: 230, y: 25 },
  { name: 'Banikoara', dept: 'AL', x: 190, y: 60 },
  { name: 'Gogounou', dept: 'AL', x: 200, y: 80 },
  { name: 'Karimama', dept: 'AL', x: 245, y: 30 },
  { name: 'Ségbana', dept: 'AL', x: 240, y: 75 },

  // ── Atacora (AT) ──
  { name: 'Natitingou', dept: 'AT', x: 125, y: 95 },
  { name: 'Tanguiéta', dept: 'AT', x: 110, y: 75 },
  { name: 'Djougou', dept: 'AT', x: 145, y: 115 },
  { name: 'Cobly', dept: 'AT', x: 100, y: 85 },
  { name: 'Boukoumbé', dept: 'AT', x: 95, y: 95 },
  { name: 'Kérou', dept: 'AT', x: 140, y: 80 },
  { name: 'Péhonko', dept: 'AT', x: 130, y: 105 },
  { name: 'Matéri', dept: 'AT', x: 105, y: 65 },
  { name: 'Toucountouna', dept: 'AT', x: 120, y: 105 },

  // ── Borgou (BO) ──
  { name: 'Parakou', dept: 'BO', x: 220, y: 155 },
  { name: 'Tchaourou', dept: 'BO', x: 210, y: 180 },
  { name: 'N\'Dali', dept: 'BO', x: 200, y: 140 },
  { name: 'Bembéréké', dept: 'BO', x: 225, y: 120 },
  { name: 'Kalalé', dept: 'BO', x: 250, y: 115 },
  { name: 'Pèrèrè', dept: 'BO', x: 235, y: 140 },
  { name: 'Sinendé', dept: 'BO', x: 185, y: 130 },
  { name: 'Nikki', dept: 'BO', x: 260, y: 95 },

  // ── Donga (DO) ──
  { name: 'Djougou', dept: 'DO', x: 153, y: 190 },
  { name: 'Bassila', dept: 'DO', x: 140, y: 210 },
  { name: 'Ouaké', dept: 'DO', x: 135, y: 195 },
  { name: 'Copargo', dept: 'DO', x: 160, y: 175 },

  // ── Collines (CO) ──
  { name: 'Savalou', dept: 'CO', x: 165, y: 260 },
  { name: 'Dassa-Zoumè', dept: 'CO', x: 180, y: 255 },
  { name: 'Glazoué', dept: 'CO', x: 195, y: 265 },
  { name: 'Bantè', dept: 'CO', x: 150, y: 270 },
  { name: 'Savè', dept: 'CO', x: 190, y: 240 },
  { name: 'Ouessè', dept: 'CO', x: 210, y: 250 },

  // ── Zou (ZO) ──
  { name: 'Abomey', dept: 'ZO', x: 160, y: 320 },
  { name: 'Bohicon', dept: 'ZO', x: 170, y: 325 },
  { name: 'Cové', dept: 'ZO', x: 155, y: 340 },
  { name: 'Djidja', dept: 'ZO', x: 145, y: 310 },
  { name: 'Za-Kpota', dept: 'ZO', x: 175, y: 335 },
  { name: 'Zogbodomey', dept: 'ZO', x: 160, y: 345 },
  { name: 'Agbangnizoun', dept: 'ZO', x: 150, y: 330 },

  // ── Plateau (PL) ──
  { name: 'Pobè', dept: 'PL', x: 215, y: 330 },
  { name: 'Kétou', dept: 'PL', x: 210, y: 310 },
  { name: 'Sakété', dept: 'PL', x: 220, y: 345 },
  { name: 'Ifangni', dept: 'PL', x: 225, y: 355 },
  { name: 'Adja-Ouèrè', dept: 'PL', x: 200, y: 340 },

  // ── Couffo (KO) ──
  { name: 'Dogbo', dept: 'KO', x: 135, y: 340 },
  { name: 'Aplahoué', dept: 'KO', x: 145, y: 350 },
  { name: 'Klouékanmè', dept: 'KO', x: 130, y: 355 },
  { name: 'Lalo', dept: 'KO', x: 140, y: 360 },
  { name: 'Toviklin', dept: 'KO', x: 148, y: 345 },

  // ── Mono (MO) ──
  { name: 'Lokossa', dept: 'MO', x: 130, y: 370 },
  { name: 'Comè', dept: 'MO', x: 140, y: 380 },
  { name: 'Houéyogbé', dept: 'MO', x: 120, y: 375 },
  { name: 'Bopa', dept: 'MO', x: 115, y: 385 },
  { name: 'Grand-Popo', dept: 'MO', x: 105, y: 390 },

  // ── Atlantique (AQ) ──
  { name: 'Allada', dept: 'AQ', x: 165, y: 365 },
  { name: 'Ouidah', dept: 'AQ', x: 145, y: 375 },
  { name: 'Abomey-Calavi', dept: 'AQ', x: 170, y: 370 },
  { name: 'Tori-Bossito', dept: 'AQ', x: 180, y: 375 },
  { name: 'Zè', dept: 'AQ', x: 190, y: 370 },
  { name: 'Kpomassè', dept: 'AQ', x: 155, y: 380 },
  { name: 'Toffo', dept: 'AQ', x: 175, y: 360 },

  // ── Ouémé (OU) ──
  { name: 'Porto-Novo', dept: 'OU', x: 210, y: 370 },
  { name: 'Sèmè-Kpodji', dept: 'OU', x: 220, y: 375 },
  { name: 'Adjarra', dept: 'OU', x: 215, y: 360 },
  { name: 'Dangbo', dept: 'OU', x: 205, y: 355 },
  { name: 'Avrankou', dept: 'OU', x: 220, y: 360 },
  { name: 'Bonou', dept: 'OU', x: 195, y: 350 },
  { name: 'Aguégués', dept: 'OU', x: 225, y: 380 },

  // ── Littoral (LI) ──
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
 * Trouve les coordonnées SVG d'une ville par son nom.
 * Recherche insensible à la casse, avec fallback sur le département.
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

  // 3. Fallback : première ville du département
  if (deptCode) {
    const deptCity = BENIN_CITIES.find((c) => c.dept === deptCode);
    if (deptCity) return deptCity;
  }

  return null;
}
