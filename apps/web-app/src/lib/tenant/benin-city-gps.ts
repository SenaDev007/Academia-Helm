/**
 * ============================================================================
 * BENIN CITY GPS — Coordonnées GPS réelles des principales villes du Bénin
 * ============================================================================
 *
 * Utilisé par la carte de localisation du site institutionnel
 * (SchoolLocationMap) quand l'école n'a PAS configuré ses coordonnées GPS
 * exactes dans le module Paramètres → Identité → Géolocalisation.
 *
 * Résolution par nom de ville (insensible à la casse et aux accents).
 * Source : positions approximatives des centres-villes (suffisant pour
 * placer le pin sur la BONNE ville — l'ancienne carte mettait Porto-Novo
 * pour toutes les écoles, y compris Parakou).
 */

export interface CityGps {
  lat: number;
  lon: number;
}

/** Centres des principales villes/communes du Bénin (lat, lon décimaux). */
const CITY_GPS: Record<string, CityGps> = {
  // ── Littoral / Atlantique littoral ──
  'cotonou': { lat: 6.3703, lon: 2.3912 },
  'porto-novo': { lat: 6.4969, lon: 2.6289 },
  'portonovo': { lat: 6.4969, lon: 2.6289 },
  'abomey-calavi': { lat: 6.4489, lon: 2.3556 },
  'ouidah': { lat: 6.3608, lon: 2.0866 },
  'sèmè-podji': { lat: 6.3761, lon: 2.6289 },
  'tori-bossito': { lat: 6.55, lon: 2.3833 },
  'zè': { lat: 6.4167, lon: 2.2167 },

  // ── Atlantique intérieur / Ouémé / Plateau ──
  'abomey': { lat: 7.1833, lon: 1.9869 },
  'bohicon': { lat: 7.1784, lon: 2.0772 },
  'zakpota': { lat: 7.0167, lon: 2.0667 },
  'ouèssè': { lat: 8.9317, lon: 2.4686 },
  'pobè': { lat: 6.9800, lon: 2.6642 },
  'kétou': { lat: 7.3617, lon: 2.6000 },
  'ketou': { lat: 7.3617, lon: 2.6000 },
  'sakété': { lat: 6.7425, lon: 2.7303 },
  'adjara': { lat: 6.6000, lon: 2.7167 },
  'avrankou': { lat: 6.5578, lon: 2.6611 },
  'adhara': { lat: 6.6000, lon: 2.7167 },

  // ── Zou / Collines ──
  'dassa-zoumè': { lat: 7.7508, lon: 2.1711 },
  'dassa': { lat: 7.7508, lon: 2.1711 },
  'savalou': { lat: 7.9292, lon: 1.9767 },
  'bantè': { lat: 8.8283, lon: 1.8800 },
  'abgangnizoun': { lat: 7.4333, lon: 2.0333 },
  'agra': { lat: 7.5333, lon: 2.1 },

  // ── Mono / Couffo ──
  'lokossa': { lat: 6.6174, lon: 1.7134 },
  'bopa': { lat: 6.5833, lon: 1.9167 },
  'comè': { lat: 6.4058, lon: 1.8853 },
  'dogbo': { lat: 6.7983, lon: 1.7817 },
  'aplahoué': { lat: 6.9297, lon: 1.6642 },
  'athiémé': { lat: 6.5667, lon: 1.7000 },
  'houéyogbé': { lat: 6.6, lon: 1.85 },

  // ── Borgou / Alibori (Nord) ──
  'parakou': { lat: 9.3372, lon: 2.6211 },
  "n'dali": { lat: 9.8211, lon: 2.6964 },
  'ndali': { lat: 9.8211, lon: 2.6964 },
  'tchaourou': { lat: 8.8864, lon: 2.5719 },
  'nikki': { lat: 10.1208, lon: 3.1969 },
  'bembèrèkè': { lat: 10.4425, lon: 2.2347 },
  'bemberke': { lat: 10.4425, lon: 2.2347 },
  'sinendé': { lat: 10.3319, lon: 2.2769 },
  'kalalé': { lat: 10.2994, lon: 3.3564 },
  'banikoara': { lat: 11.2931, lon: 3.1822 },
  'kandi': { lat: 11.1303, lon: 3.0022 },
  'gogounou': { lat: 10.8383, lon: 3.3369 },
  'malanville': { lat: 11.8681, lon: 3.3872 },
  'ségbana': { lat: 11.4681, lon: 3.2317 },
  'karimama': { lat: 11.9250, lon: 3.2417 },

  // ── Atacora / Donga (Nord-Ouest) ──
  'natitingou': { lat: 10.3044, lon: 1.3773 },
  'tanguiéta': { lat: 10.6267, lon: 1.2669 },
  'kouandé': { lat: 10.3222, lon: 1.6108 },
  'boukoumbé': { lat: 10.2039, lon: 1.0997 },
  'matéri': { lat: 10.6281, lon: 1.0233 },
  'cobly': { lat: 10.4206, lon: 1.2811 },
  'péhunco': { lat: 10.2172, lon: 1.8569 },
  'djougou': { lat: 9.7083, lon: 1.6655 },
  'bassila': { lat: 9.0086, lon: 1.6739 },
  'copargo': { lat: 9.8397, lon: 1.5483 },
  'ouaké': { lat: 9.7833, lon: 1.4889 },
};

/** Centres-villes manquants ci-dessus → vue sur l'ensemble du Bénin. */
export const BENIN_CENTER: CityGps = { lat: 9.5, lon: 2.35 };

/** Supprime accents / apostrophes / tirets pour comparer les noms de villes. */
function normalizeCity(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/['\s]+/g, '') // espaces + apostrophes (n'dali → ndali)
    .replace(/-/g, '');
}

/**
 * Résout les coordonnées GPS approximatives d'une ville du Bénin.
 * Retourne null si la ville est inconnue (la carte retombera sur
 * la vue nationale ou le géocodage Nominatim côté composant).
 */
export function getCityGps(city: string | null | undefined): CityGps | null {
  if (!city || typeof city !== 'string') return null;
  const key = normalizeCity(city);
  if (!key) return null;

  // 1. Correspondance directe (pré-normalisée)
  const direct = CITY_GPS[key];
  if (direct) return direct;

  // 2. Correspondance partielle — "Ville (arrondissement)" ou fautes de frappe
  for (const [name, coords] of Object.entries(CITY_GPS)) {
    if (name.length >= 4 && (key.includes(name) || name.includes(key))) {
      return coords;
    }
  }
  return null;
}
