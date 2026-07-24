"use client";

/**
 * ============================================================================
 * SchoolGeolocationSettings — Configuration coords GPS école
 * ============================================================================
 *
 * Permet au directeur de configurer les coordonnées GPS de l'école + rayon.
 *
 * 3 modes de saisie :
 *   1. "Utiliser ma position" — récupère la position GPS du navigateur
 *      (utile quand le directeur est physiquement dans l'école)
 *   2. Saisie manuelle latitude/longitude (si l'utilisateur connaît les coords)
 *   3. Carte Google Maps interactive (uniquement si NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 *      est définie — sinon ce mode est masqué)
 *
 * Endpoints :
 *   GET /api/settings/identity/geolocation
 *   PUT /api/settings/identity/geolocation
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Loader2, Save, Navigation, CheckCircle2, X, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useGeolocation } from "@/hooks/useGeolocation";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function SchoolGeolocationSettings() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulaire local
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [geoRadius, setGeoRadius] = useState<number>(100);

  const { position, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  // === Charger la config existante ===
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/identity/geolocation", { credentials: "include" });
      // ⚠️ Si la réponse n'est pas du JSON (ex: page 404 HTML), ne pas crasher
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setConfig({ configured: false, message: 'Non configuré' });
        return;
      }
      const data = await res.json();
      setConfig(data);
      if (data.configured) {
        setLatitude(String(data.latitude));
        setLongitude(String(data.longitude));
        setGeoRadius(data.geoRadius || 100);
      }
    } catch (e: any) {
      // Dégradation gracieuse — ne pas afficher d'erreur bloquante
      setConfig({ configured: false, message: 'Non configuré' });
      console.warn('[Geolocation] Load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // Quand la position GPS est obtenue, pré-remplir le formulaire
  useEffect(() => {
    if (position) {
      setLatitude(position.latitude.toFixed(6));
      setLongitude(position.longitude.toFixed(6));
      toast.success("📍 Position GPS récupérée", {
        description: `Précision: ${position.accuracy.toFixed(0)}m — vérifiez avant de sauvegarder.`,
      });
    }
  }, [position]);

  // === Sauvegarder ===
  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      toast.error("Latitude invalide", { description: "Doit être un nombre entre -90 et 90" });
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      toast.error("Longitude invalide", { description: "Doit être un nombre entre -180 et 180" });
      return;
    }
    if (geoRadius < 10 || geoRadius > 1000) {
      toast.error("Rayon invalide", { description: "Doit être entre 10 et 1000 mètres" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings/identity/geolocation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ latitude: lat, longitude: lng, geoRadius }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Erreur sauvegarde", { description: data.message });
        return;
      }
      toast.success("✅ Coords école enregistrées", {
        description: `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}, Rayon: ${geoRadius}m`,
      });
      loadConfig();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            Localisation GPS de l'école
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Utilisée pour vérifier la position des enseignants lors du pointage présence.
          </p>
        </div>
        {config?.configured && (
          <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Configuré
          </span>
        )}
      </div>

      {/* Info important */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
        <p className="font-bold mb-1">💡 Comment obtenir les coords GPS ?</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Activez le GPS de votre appareil et cliquez sur "Utiliser ma position" (vous devez être dans l'école).</li>
          <li>Ou ouvrez Google Maps, cliquez sur votre école, copiez les coords (format: 6.3654, 2.4183).</li>
          <li>Ou utilisez la carte interactive ci-dessous (si Google Maps API key configurée).</li>
        </ul>
      </div>

      {/* Bouton "Utiliser ma position" */}
      <div>
        <button
          onClick={getPosition}
          disabled={geoLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {geoLoading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Récupération GPS en cours...</>
          ) : (
            <><Navigation className="h-4 w-4" /> 📍 Utiliser ma position actuelle</>
          )}
        </button>
        {geoError && (
          <p className="mt-1 text-xs text-rose-600">{geoError.userMessage}</p>
        )}
      </div>

      {/* Saisie manuelle */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Latitude</label>
          <input
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            value={latitude}
            onChange={e => setLatitude(e.target.value)}
            placeholder="ex: 6.3654"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Longitude</label>
          <input
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            value={longitude}
            onChange={e => setLongitude(e.target.value)}
            placeholder="ex: 2.4183"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Rayon (mètres)</label>
          <input
            type="number"
            step="10"
            min="10"
            max="1000"
            value={geoRadius}
            onChange={e => setGeoRadius(parseInt(e.target.value) || 100)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Aperçu */}
      {latitude && longitude && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
          <strong>Aperçu:</strong> L'école est à <code className="bg-white px-1 rounded">{latitude}, {longitude}</code>.
          Les enseignants devront être dans un rayon de <strong>{geoRadius}m</strong> pour pointer leur présence.
        </div>
      )}

      {/* Bouton sauvegarder */}
      <button
        onClick={handleSave}
        disabled={saving || !latitude || !longitude}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Enregistrer les coordonnées
      </button>

      {/* Carte Google Maps (optionnelle) */}
      {GOOGLE_MAPS_API_KEY && (
        <div className="border-t border-slate-200 pt-3">
          <p className="text-xs font-bold text-slate-600 mb-2">🗺️ Carte interactive (Google Maps)</p>
          <div className="bg-slate-100 rounded-lg p-8 text-center text-slate-500 text-sm">
            Carte Google Maps — nécessite l'implémentation du composant @react-google-maps/api
            (à installer: <code>npm i @react-google-maps/api</code>)
          </div>
        </div>
      )}

      {!GOOGLE_MAPS_API_KEY && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <strong>Carte interactive désactivée.</strong> Pour activer Google Maps, définissez
            <code className="bg-amber-100 px-1 rounded mx-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>
            dans les variables d'environnement. En attendant, utilisez "Utiliser ma position" ou la saisie manuelle.
          </div>
        </div>
      )}
    </div>
  );
}
