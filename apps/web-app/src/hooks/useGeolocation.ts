/**
 * ============================================================================
 * useGeolocation — Hook React pour le pointage géolocalisé
 * ============================================================================
 *
 * Wrappe navigator.geolocation.getCurrentPosition() avec :
 *   - Gestion des permissions (granted/denied/prompt)
 *   - États loading / error / position
 *   - Retry automatique
 *   - Support HTTPS uniquement (navigator.geolocation requiert HTTPS en prod)
 *
 * Utilisé par :
 *   - Dashboard enseignant (auto-pointage présence)
 *   - Settings école (pour récupérer la position actuelle et la proposer
 *     comme coords école)
 * ============================================================================
 */

'use client';

import { useState, useCallback, useRef } from 'react';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface GeoError {
  code: number;
  message: string;
  // Codes standard GeolocationPositionError :
  // 1 = PERMISSION_DENIED
  // 2 = POSITION_UNAVAILABLE
  // 3 = TIMEOUT
  userMessage: string;
}

export interface UseGeolocationResult {
  position: GeoPosition | null;
  loading: boolean;
  error: GeoError | null;
  getPosition: () => Promise<GeoPosition>;
  reset: () => void;
}

const ERROR_MESSAGES: Record<number, string> = {
  1: "Vous avez refusé la permission de localisation. Activez-la dans les paramètres de votre navigateur pour pointer votre présence.",
  2: "Position GPS indisponible. Vérifiez que le GPS de votre appareil est activé et réessayez.",
  3: "Délai d'attente dépassé pour la géolocalisation. Réessayez.",
};

export function useGeolocation(): UseGeolocationResult {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GeoError | null>(null);
  const positionRef = useRef<GeoPosition | null>(null);

  const getPosition = useCallback((): Promise<GeoPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        const err: GeoError = {
          code: -1,
          message: 'Geolocation API non supportée par ce navigateur',
          userMessage: "Votre navigateur ne supporte pas la géolocalisation. Utilisez Chrome, Firefox, Safari ou Edge récent.",
        };
        setError(err);
        reject(err);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geoPos: GeoPosition = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp,
          };
          positionRef.current = geoPos;
          setPosition(geoPos);
          setLoading(false);
          resolve(geoPos);
        },
        (err) => {
          const geoErr: GeoError = {
            code: err.code,
            message: err.message,
            userMessage: ERROR_MESSAGES[err.code] || `Erreur de géolocalisation: ${err.message}`,
          };
          setError(geoErr);
          setLoading(false);
          reject(geoErr);
        },
        {
          enableHighAccuracy: true,  // GPS haute précision (plus lent mais précis)
          timeout: 15000,            // 15s max
          maximumAge: 0,             // Pas de cache — force une nouvelle mesure
        },
      );
    });
  }, []);

  const reset = useCallback(() => {
    setPosition(null);
    setError(null);
    setLoading(false);
    positionRef.current = null;
  }, []);

  return { position, loading, error, getPosition, reset };
}
