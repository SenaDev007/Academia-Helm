"use client";

/**
 * ============================================================================
 * SEMAINIER NOTIFICATION BANNER — Bannière de notification pour l'enseignant
 * ============================================================================
 *
 * S'affiche dans le dashboard enseignant quand l'utilisateur est le semainier
 * pour la semaine courante OU la semaine prochaine.
 *
 * Règles d'affichage :
 *   - Si l'enseignant est le semainier de la SEMAINE COURANTE :
 *     "Vous êtes le semainier cette semaine (S{N} du {start} au {end})"
 *     → visible du LUNDI au VENDREDI de la semaine concernée
 *   - Si l'enseignant est le semainier de la SEMAINE PROCHAINE :
 *     "Vous êtes le semainier la semaine prochaine (S{N} du {start} au {end})"
 *     → visible dès le SAMEDI/DIMANCHE qui précèdent la semaine concernée
 *
 * Backend endpoint :
 *   GET /api/pedagogy-space/seminar-config/my-assignment?teacherId=X&academicYearId=Y
 *   Retourne : { currentWeek: config|null, nextWeek: config|null }
 *
 * Comportement UI :
 *   - Bannière colorée (purple pour semaine courante, blue pour semaine prochaine)
 *   - Bouton "Aller au Cahier du Semainier" qui redirige vers /app/teacher/pedagogy
 *   - Auto-refresh toutes les 5 minutes (en cas de changement de semaine)
 * ============================================================================
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarRange, AlertCircle, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const cn = (...c: (string | boolean | undefined)[]) => c.filter(Boolean).join(" ");

interface SemainierNotificationBannerProps {
  teacherId: string;
  academicYearId: string;
}

export function SemainierNotificationBanner({ teacherId, academicYearId }: SemainierNotificationBannerProps) {
  const [assignment, setAssignment] = useState<{ currentWeek: any | null; nextWeek: any | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAssignment = async () => {
    if (!teacherId || !academicYearId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy-space/seminar-config/my-assignment?teacherId=${teacherId}&academicYearId=${academicYearId}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setAssignment({
          currentWeek: data.currentWeek || null,
          nextWeek: data.nextWeek || null,
        });
      } else {
        setAssignment({ currentWeek: null, nextWeek: null });
      }
    } catch (e) {
      // Erreur silencieuse — la bannière n'est pas critique
      setAssignment({ currentWeek: null, nextWeek: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignment();
    // ⭐ Auto-refresh toutes les 5 minutes (au cas où l'enseignant laisse le dashboard ouvert)
    const interval = setInterval(loadAssignment, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [teacherId, academicYearId]);

  // Si pas encore chargé ou aucune assignation, ne rien afficher
  if (!assignment) return null;
  if (!assignment.currentWeek && !assignment.nextWeek) return null;

  const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  // ⭐ Déterminer quel type de bannière afficher (priorité : currentWeek > nextWeek)
  const showCurrent = !!assignment.currentWeek;
  const showNext = !showCurrent && !!assignment.nextWeek;
  const config = showCurrent ? assignment.currentWeek : assignment.nextWeek;

  if (!config) return null;

  // ⭐ Déterminer le statut (si déjà signé, soumis, etc.)
  const status = (config.status || '').toUpperCase();
  const isSigned = status === 'SIGNED' || status === 'SUBMITTED' || status === 'VALIDATED';
  const isSubmitted = status === 'SUBMITTED';
  const isValidated = status === 'VALIDATED';

  return (
    <div className={cn(
      "rounded-xl border-2 p-4 shadow-sm",
      showCurrent
        ? "bg-gradient-to-r from-purple-50 to-purple-100 border-purple-300"
        : "bg-gradient-to-r from-blue-50 to-blue-100 border-blue-300"
    )}>
      <div className="flex flex-wrap items-start gap-3">
        {/* Icône principale */}
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-full shrink-0",
          showCurrent ? "bg-purple-200" : "bg-blue-200"
        )}>
          <CalendarRange className={cn("h-6 w-6", showCurrent ? "text-purple-700" : "text-blue-700")} />
        </div>

        {/* Contenu principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn(
              "text-base font-bold",
              showCurrent ? "text-purple-900" : "text-blue-900"
            )}>
              {showCurrent ? "📋 Vous êtes le semainier cette semaine" : "📋 Vous êtes le semainier la semaine prochaine"}
            </h3>
            {/* Badge statut si déjà signé/soumis */}
            {isSigned && (
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold",
                isValidated ? "bg-emerald-100 text-emerald-700"
                  : isSubmitted ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
              )}>
                {isValidated ? '✓ Validé' : isSubmitted ? '⏳ Soumis' : '✓ Signé'}
              </span>
            )}
          </div>
          <p className={cn("text-sm mt-1", showCurrent ? "text-purple-800" : "text-blue-800")}>
            <strong>Semaine S{config.weekNumber}</strong> · Trimestre {config.trimester}
            <br />
            Du <strong>{fmtDate(config.weekStartDate)}</strong> au <strong>{fmtDate(config.weekEndDate)}</strong>
          </p>
          {config.classNames && config.classNames.length > 0 && (
            <p className="text-xs mt-1 opacity-80">
              <span className="font-semibold">Classes assignées :</span> {config.classNames.join(', ')}
            </p>
          )}
          {showNext && (
            <p className="text-xs mt-2 text-blue-700 italic">
              💡 Préparez vos rapports journaliers dès ce week-end pour gagner du temps.
            </p>
          )}
        </div>

        {/* Action : aller au cahier du semainier */}
        <Link
          href="/app/teacher/pedagogy"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0",
            showCurrent
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
          title="Aller à l'espace pédagogique → Cahier du Semainier"
        >
          Aller au Cahier du Semainier
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* ⭐ Ligne d'info en bas */}
      <div className={cn(
        "mt-3 pt-2 border-t flex items-center gap-2 text-[11px]",
        showCurrent ? "border-purple-200 text-purple-700" : "border-blue-200 text-blue-700"
      )}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>
          {showCurrent
            ? "Vous devez remplir les 5 rapports journaliers (Lundi → Vendredi) + le rapport de fin de semaine, puis les envoyer au directeur pour validation."
            : "Cette notification restera visible jusqu'à la fin de la semaine prochaine. Pensez à consulter le cahier du semainier dès lundi."}
        </span>
      </div>

      {/* ⭐ Bouton recharger discret (en cas de besoin) */}
      <div className="absolute -top-2 -right-2">
        <button
          onClick={loadAssignment}
          disabled={loading}
          className="p-1.5 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 disabled:opacity-50"
          title="Recharger l'assignation"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : <RefreshCw className="h-3 w-3 text-slate-500" />}
        </button>
      </div>
    </div>
  );
}
