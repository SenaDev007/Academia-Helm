"use client";

/**
 * ============================================================================
 * MyAttendanceCard — Carte "Ma présence du jour" pour le dashboard enseignant
 * ============================================================================
 *
 * Permet à l'enseignant de marquer SA présence depuis son téléphone/PC :
 *   - Demande la géoloc navigateur (useGeolocation hook)
 *   - Envoie coords au backend POST /api/hr/attendance/self-check-in
 *   - Le backend vérifie le rayon (100m par défaut) et refuse si hors zone
 *
 * États gérés :
 *   - Pas encore pointé → bouton "🎯 Pointer ma présence"
 *   - Pointé (check-in) → badge vert avec heure + bouton "🏁 Fin de journée"
 *   - Pointé (check-out) → badge complet avec heures travaillées
 *   - Refusé (hors rayon) → message d'erreur avec distance
 *   - Refusé (coords école non configurées) → message d'avertissement
 *   - Marqué par semainier → badge "Marqué par le semainier" (non modifiable)
 *
 * ⭐ Mutual exclusion : si présence déjà marquée par le semainier → pas de bouton.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import {
  MapPin, Loader2, CheckCircle2, XCircle, Clock, LogOut,
  AlertTriangle, UserCheck, Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useAppSession } from "@/contexts/AppSessionContext";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

interface MyAttendanceCardProps {
  /** Date cible (YYYY-MM-DD). Défaut = aujourd'hui. */
  date?: string;
}

export function MyAttendanceCard({ date }: MyAttendanceCardProps) {
  const { user } = useAppSession();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { position, loading: geoLoading, error: geoError, getPosition } = useGeolocation();

  // === Charger la présence du jour ===
  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hr/attendance/my-today?date=${targetDate}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data);
      } else {
        setAttendance(null);
      }
    } catch {
      setAttendance(null);
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // === Action : Pointer ma présence ===
  const handleCheckIn = async () => {
    setSaving(true);
    try {
      // 1. Demander la position GPS
      const pos = await getPosition();
      toast.info("📍 Position GPS obtenue", {
        description: `Précision: ${pos.accuracy.toFixed(0)}m — vérification en cours...`,
      });

      // 2. Envoyer au backend
      const res = await fetch("/api/hr/attendance/self-check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: targetDate,
          status: "PRESENT",
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          deviceInfo: navigator.userAgent.substring(0, 200),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Erreur géo ou mutual exclusion
        const reason = data.reason || data.message || "Erreur inconnue";
        const details = data.details || data.message;
        if (reason === 'HORS_RAYON') {
          toast.error("🚫 Pointage refusé", {
            description: `Vous êtes à ${data.distance?.toFixed(0)}m de l'école (rayon autorisé: ${data.allowedRadius}m). Rapprochez-vous pour pointer.`,
          });
        } else if (reason === 'COORDS_ECOLE_NON_CONFIGUREES') {
          toast.error("🏫 École non géolocalisée", {
            description: "Le directeur doit configurer les coordonnées GPS de l'école dans Paramètres → Établissement.",
          });
        } else {
          toast.error("Pointage refusé", { description: details || reason });
        }
        return;
      }

      toast.success("✅ Présence enregistrée", {
        description: `Pointé à ${new Date(data.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • Distance école: ${data.geoDistance?.toFixed(0)}m`,
      });
      loadAttendance();
    } catch (e: any) {
      // Erreur géoloc
      toast.error("📍 Géolocalisation impossible", {
        description: e?.userMessage || e?.message || "Erreur inconnue",
      });
    } finally {
      setSaving(false);
    }
  };

  // === Action : Fin de journée (check-out) ===
  const handleCheckOut = async () => {
    if (!confirm("Confirmer la fin de journée ? Vos heures travaillées seront calculées.")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hr/attendance/self-check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: targetDate }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Dépointage impossible", { description: data.message });
        return;
      }
      toast.success("🏁 Fin de journée enregistrée", {
        description: `Heures travaillées: ${data.hoursWorked}h`,
      });
      loadAttendance();
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  // === Render ===
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de ma présence...
        </div>
      </div>
    );
  }

  const isMarkedBySemainier = attendance?.markedByRole === 'SEMINARIER';
  const isMarkedBySelf = attendance?.markedByRole === 'SELF';
  const hasCheckOut = attendance?.checkOut != null;

  return (
    <div className={cn(
      "bg-white rounded-xl border-2 p-5 shadow-sm",
      isMarkedBySemainier ? "border-purple-300" :
      isMarkedBySelf ? "border-emerald-300" : "border-slate-200"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600" />
            Ma présence du jour
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date(targetDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Badge statut */}
        {attendance && (
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-bold",
            isMarkedBySelf ? "bg-emerald-100 text-emerald-700" :
            isMarkedBySemainier ? "bg-purple-100 text-purple-700" :
            "bg-slate-100 text-slate-700"
          )}>
            {isMarkedBySelf ? "AUTO-POINTÉ" :
             isMarkedBySemainier ? "PAR SEMAINIER" :
             "MARQUÉ"}
          </span>
        )}
      </div>

      {/* Cas 1 : Pas encore pointé */}
      {!attendance && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">
            <p className="font-semibold mb-0.5">Vous n'avez pas encore pointé votre présence aujourd'hui.</p>
            <p className="text-xs">Cliquez sur le bouton ci-dessous en arrivant à l'école. La vérification GPS est automatique.</p>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={saving || geoLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving || geoLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Vérification GPS en cours...</>
            ) : (
              <><MapPin className="h-5 w-5" /> 🎯 Pointer ma présence</>
            )}
          </button>
          {geoError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-2 text-xs text-rose-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{geoError.userMessage}</span>
            </div>
          )}
          <p className="text-xs text-slate-400 text-center">
            ℹ️ Vous devez activer la localisation sur votre appareil et être dans l'enceinte de l'école.
          </p>
        </div>
      )}

      {/* Cas 2 : Pointé par soi-même */}
      {attendance && isMarkedBySelf && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-1">
              <CheckCircle2 className="h-4 w-4" />
              Présence pointée à {attendance.checkIn ? new Date(attendance.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
            {attendance.geoDistance != null && (
              <p className="text-xs text-emerald-600">
                📍 Distance de l'école: {attendance.geoDistance.toFixed(0)}m (vérifié GPS)
              </p>
            )}
            {hasCheckOut && (
              <div className="mt-2 pt-2 border-t border-emerald-200 text-xs text-emerald-700">
                <div className="flex items-center gap-1.5">
                  <LogOut className="h-3 w-3" />
                  Fin de journée: {new Date(attendance.checkOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="mt-0.5 font-bold">
                  ⏱️ Heures travaillées: {attendance.hoursWorked}h
                </div>
              </div>
            )}
          </div>

          {!hasCheckOut && (
            <button
              onClick={handleCheckOut}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              🏁 Fin de journée
            </button>
          )}
        </div>
      )}

      {/* Cas 3 : Marqué par le semainier (non modifiable) */}
      {attendance && isMarkedBySemainier && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-sm mb-1">
            <UserCheck className="h-4 w-4" />
            Présence marquée par le semainier
          </div>
          <p className="text-xs text-purple-600">
            Statut: <strong>{attendance.status}</strong>
            {attendance.checkIn && ` • Arrivée: ${new Date(attendance.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
          </p>
          {attendance.notes && (
            <p className="text-xs text-purple-600 mt-1 italic">Note: {attendance.notes}</p>
          )}
          <p className="text-xs text-purple-500 mt-2">
            ℹ️ Vous ne pouvez pas modifier une présence marquée par le semainier.
          </p>
        </div>
      )}
    </div>
  );
}
