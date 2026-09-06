"use client";

/**
 * ============================================================================
 * LOGOUT CONFIRMATION MODAL — Modal de confirmation personnalisé
 * ============================================================================
 *
 * Remplace le confirm() natif du navigateur par un modal stylisé cohérent
 * avec le design d'Academia Helm (palette bleu/or, icônes, animations).
 *
 * Utilisation :
 *   const [open, setOpen] = useState(false);
 *   <LogoutModal open={open} onClose={() => setOpen(false)} onConfirm={handleLogout} />
 *   <button onClick={() => setOpen(true)}>Se déconnecter</button>
 * ============================================================================
 */

import { Loader2, LogOut, X, AlertTriangle } from "lucide-react";
// ⭐ P4-final : modal bilingue (piste EN → anglais)
import { useL } from "@/lib/i18n/bilingual";

interface LogoutModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  userName?: string;
}

export function LogoutModal({ open, onClose, onConfirm, loading, userName }: LogoutModalProps) {
  const L = useL();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={loading ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{L("Déconnexion", "Log out")}</h3>
              <p className="text-xs text-slate-500">{L("Confirmation requise", "Confirmation required")}</p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
              aria-label={L("Fermer", "Close")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            {userName ? (
              <>
                {L("Êtes-vous sûr de vouloir vous déconnecter de votre session ?", "Are you sure you want to log out of your session?")}
                <br />
                <span className="font-semibold text-slate-900">{userName}</span>{L(", vous devrez vous reconnecter pour accéder à nouveau à votre espace.", ", you will need to log in again to access your workspace.")}
              </>
            ) : (
              <>
                {L("Êtes-vous sûr de vouloir vous déconnecter ?", "Are you sure you want to log out?")}
                <br />
                {L("Vous devrez vous reconnecter pour accéder à nouveau à votre espace.", "You will need to log in again to access your workspace.")}
              </>
            )}
          </p>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-800">
              {L("💡 Toutes vos modifications non enregistrées seront perdues. Pensez à sauvegarder avant de quitter.", "💡 All your unsaved changes will be lost. Remember to save before leaving.")}
            </p>
          </div>
        </div>

        {/* Footer avec actions */}
        <div className="flex items-center justify-end gap-2 p-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {L("Annuler", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {L("Déconnexion…", "Logging out…")}
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                {L("Se déconnecter", "Log out")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
