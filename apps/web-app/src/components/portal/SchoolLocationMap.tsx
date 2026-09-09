'use client';

/**
 * ============================================================================
 * SCHOOL LOCATION MAP — Carte de localisation du site institutionnel
 * ============================================================================
 *
 * Remplace l'ancienne iframe OpenStreetMap codée en dur (bbox autour de
 * Porto-Novo pour TOUTES les écoles — le pin tombait à Porto-Novo même pour
 * une école de Parakou).
 *
 * Chaîne de résolution de la position (par priorité) :
 *   1. GPS EXACT — coordonnées configurées dans le module Paramètres →
 *      Identité → Géolocalisation (transmises via l'API publique
 *      /tenant-website/public/:slug/identity-info)
 *   2. GÉOCODAGE — recherche Nominatim (OpenStreetMap) sur
 *      « adresse, ville, Bénin » (timeout 5 s, une seule requête)
 *   3. VILLE — table GPS des villes du Bénin (benin-city-gps.ts)
 *   4. PAYS — vue nationale (centre du Bénin, dézoomée)
 *
 * Affiche l'iframe OpenStreetMap avec un marker sur la position résolue +
 * un lien « Ouvrir la carte » vers openstreetmap.org.
 */

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, MapPin, Loader2 } from 'lucide-react';
import { getCityGps, BENIN_CENTER, type CityGps } from '@/lib/tenant/benin-city-gps';

interface SchoolLocationMapProps {
  /** Latitude exacte (module Paramètres → Géolocalisation) ou null. */
  latitude?: number | null;
  /** Longitude exacte (module Paramètres → Géolocalisation) ou null. */
  longitude?: number | null;
  /** Adresse postale (géocodage Nominatim). */
  address?: string | null;
  /** Ville (fallback table GPS Bénin). */
  city?: string | null;
  schoolName: string;
  navy: string;
}

type ResolutionSource = 'gps' | 'geocode' | 'city' | 'country';

interface ResolvedPosition {
  lat: number;
  lon: number;
  /** Demi-largeur du bbox (degrés) — selon la précision de la source. */
  delta: number;
  source: ResolutionSource;
}

/** Construit l'URL de l'iframe embed OpenStreetMap avec marker. */
function buildOsmEmbedSrc(pos: ResolvedPosition): string {
  const { lat, lon, delta } = pos;
  const bbox = [lon - delta, lat - delta * 0.8, lon + delta, lat + delta * 0.8]
    .map((n) => n.toFixed(5))
    .join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/** Géocode une adresse via Nominatim (public, CORS OK, usage léger). */
async function geocodeNominatim(query: string): Promise<CityGps | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=bj&q=' +
      encodeURIComponent(query);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null; // timeout / réseau / CORS → fallback silencieux
  }
}

export default function SchoolLocationMap({
  latitude,
  longitude,
  address,
  city,
  schoolName,
  navy,
}: SchoolLocationMapProps) {
  // Position initiale : GPS exact → ville → pays (geocoding asynchrone ensuite)
  const [position, setPosition] = useState<ResolvedPosition | null>(() => {
    if (typeof latitude === 'number' && typeof longitude === 'number' &&
      !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      return { lat: latitude, lon: longitude, delta: 0.012, source: 'gps' };
    }
    const cityGps = getCityGps(city);
    if (cityGps) return { ...cityGps, delta: 0.05, source: 'city' };
    return { ...BENIN_CENTER, delta: 1.6, source: 'country' };
  });

  // ─── Étape 2 : géocodage Nominatim si pas de GPS exact ────────────────
  // Tentative unique « adresse, ville, Bénin » — si elle réussit, elle est
  // plus précise que le centre-ville. Sinon on garde la position courante.
  const geocodeKey = useMemo(
    () => `${address || ''}|${city || ''}`,
    [address, city],
  );

  useEffect(() => {
    // GPS exact déjà disponible → pas besoin de géocoder
    if (typeof latitude === 'number' && typeof longitude === 'number' &&
      !Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      return;
    }
    let cancelled = false;
    const query = [address, city, 'Bénin'].filter(Boolean).join(', ').trim();
    if (!query || query === 'Bénin') return;

    (async () => {
      const result = await geocodeNominatim(query);
      if (!cancelled && result) {
        setPosition({ ...result, delta: 0.02, source: 'geocode' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geocodeKey, latitude, longitude]);

  const iframeSrc = position ? buildOsmEmbedSrc(position) : null;

  // Lien « Ouvrir la carte » — itinéraire vers la position résolue
  const openMapHref = position
    ? `https://www.openstreetmap.org/directions?to=${position.lat.toFixed(5)},${position.lon.toFixed(5)}`
    : '#';

  // Libellé de précision affiché sous la carte
  const precisionLabel: Record<ResolutionSource, string | null> = {
    gps: 'Position GPS exacte (paramètres de l\u2019établissement)',
    geocode: 'Position approximative (adresse)',
    city: 'Position approximative (centre de la ville)',
    country: null,
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
      {iframeSrc ? (
        <iframe
          title={`Localisation de ${schoolName}`}
          src={iframeSrc}
          className="w-full h-64 md:h-72 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="w-full h-64 md:h-72 flex items-center justify-center bg-slate-100">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {city || 'Bénin'}
            {position && precisionLabel[position.source] && (
              <span className="hidden sm:inline text-slate-400"> — {precisionLabel[position.source]}</span>
            )}
          </span>
        </span>
        <a
          href={openMapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold flex items-center gap-1 hover:underline shrink-0"
          style={{ color: navy }}
        >
          Ouvrir la carte <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
