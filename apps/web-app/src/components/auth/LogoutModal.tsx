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

interface LogoutModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  userName?: string;
}

export function LogoutModal({ open, onClose, onConfirm, loading, userName }: LogoutModalProps) {
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
              <h3 className="text-base font-bold text-slate-900">Déconnexion</h3>
              <p className="text-xs text-slate-500">Confirmation requise</p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
              aria-label="Fermer"
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
                Êtes-vous sûr de vouloir vous déconnecter de votre session ?
                <br />
                <span className="font-semibold text-slate-900">{userName}</span>, vous devrez vous reconnecter pour accéder à nouveau à votre espace.
              </>
            ) : (
              <>
                Êtes-vous sûr de vouloir vous déconnecter ?
                <br />
                Vous devrez vous reconnecter pour accéder à nouveau à votre espace.
              </>
            )}
          </p>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 Toutes vos modifications non enregistrées seront perdues. Pensez à sauvegarder avant de quitter.
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
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Déconnexion…
              </>
            ) : (
              <>
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
