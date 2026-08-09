"use client";

import { Logo } from "@/components/saisiemaster/brand/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  School,
  LogOut,
  CircleDot,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { useSaisieMasterStore, restoreFromBackend } from "@/lib/saisiemaster/store";
import { toast } from "sonner";
import type { ClassData } from "@/lib/saisiemaster/types";

interface EditorHeaderProps {
  onHome: () => void;
}

/**
 * En-tête de l'éditeur SaisieMaster — version redesign "screenshot".
 *
 * Layout :
 *  - Gauche : logo SaisieMaster + titre de page ("Saisie des notes – Classe : CI")
 *  - Droite : infos utilisateur (nom école, "Directeur", badge "En ligne")
 *
 * Le sélecteur multi-classes (si plusieurs feuilles ont été importées) est
 * intégré au titre de page sous forme de dropdown discret.
 */
export function EditorHeader({ onHome }: EditorHeaderProps) {
  const { classes, activeClassIndex, setActiveClass } = useSaisieMasterStore();
  const logout = useSaisieMasterStore((s) => s.logout);
  const setView = useSaisieMasterStore((s) => s.setView);
  const prospect = useSaisieMasterStore((s) => s.prospect);
  const [syncing, setSyncing] = useState(false);

  const activeClass: ClassData | undefined = classes[activeClassIndex];

  const handleLogout = () => {
    logout();
    setView("landing");
  };

  // ⭐ Forcer la synchronisation depuis le backend Neon
  //    Récupère TOUTES les sessions du prospect et remplace l'état local
  const handleSyncFromBackend = async () => {
    setSyncing(true);
    try {
      console.log("[saisiemaster] 🔄 Manual sync from backend triggered");
      const backendData = await restoreFromBackend();
      if (backendData && backendData.classes.length > 0) {
        useSaisieMasterStore.setState({
          classes: backendData.classes,
          activeClassIndex: Math.min(
            backendData.activeClassIndex,
            backendData.classes.length - 1,
          ),
          editorView: "notes",
        });
        // Mettre à jour localStorage
        try {
          window.localStorage.setItem(
            "saisiemaster:autosave",
            JSON.stringify({
              classes: backendData.classes,
              activeClassIndex: backendData.activeClassIndex,
              savedAt: backendData.savedAt,
            }),
          );
        } catch {}
        toast.success(
          `Synchronisé : ${backendData.classes.length} classe(s) récupérée(s) depuis le backend`,
        );
      } else {
        toast.info("Aucune donnée trouvée sur le backend");
      }
    } catch (e: any) {
      toast.error("Erreur de synchronisation", { description: e.message });
    } finally {
      setSyncing(false);
    }
  };

  // Nom du directeur = prénom + nom du prospect (s'il est connecté).
  const directorName =
    prospect && prospect.firstName
      ? `${prospect.firstName} ${prospect.lastName}`.trim()
      : "Directeur";

  // Nom de l'école = depuis le prospect si présent, sinon depuis les
  // métadonnées du fichier importé.
  const schoolName = prospect?.schoolName || activeClass?.schoolName || "École";

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-white dark:bg-zinc-950">
      <div className="h-0.5 w-full saisiemaster-tricolor" aria-hidden />
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Gauche — Logo + retour + titre */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onHome}
              aria-label="Retour à l'accueil"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Home className="h-4 w-4" />
            </Button>
            <Logo className="h-8 w-auto shrink-0" />

            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground/60">/</span>
              <span className="font-semibold text-foreground text-sm whitespace-nowrap">
                Saisie des notes
              </span>
              {activeClass && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
                  {classes.length > 1 ? (
                    <Select
                      value={String(activeClassIndex)}
                      onValueChange={(v) => setActiveClass(Number(v))}
                    >
                      <SelectTrigger className="h-9 w-[160px] sm:w-[200px]">
                        <SelectValue placeholder="Choisir une classe" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((cls, idx) => (
                          <SelectItem key={cls.sheetName} value={String(idx)}>
                            <span className="font-medium">{cls.className}</span>
                            <span className="text-muted-foreground ml-2">
                              ({cls.students.length} él.)
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
                      <span className="text-muted-foreground">Classe :</span>
                      <span className="font-semibold text-[#0D6EFD]">
                        {activeClass.className}
                      </span>
                    </span>
                  )}
                </>
              )}
              {!activeClass && (
                <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-muted-foreground">
                  Aucune classe — importez un template
                </span>
              )}
            </div>
          </div>

          {/* Droite — Infos utilisateur */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight min-w-0 max-w-[260px]">
              <span
                className="text-sm font-semibold text-foreground truncate max-w-full"
                title={schoolName}
              >
                {schoolName}
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <School className="h-3 w-3" />
                <span className="truncate max-w-[160px]" title={directorName}>
                  {directorName}
                </span>
                <span className="text-border">·</span>
                <span>Directeur</span>
              </div>
            </div>

            {/* ⭐ Bouton "Sync" — force la récupération depuis le backend Neon */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncFromBackend}
              disabled={syncing}
              aria-label="Synchroniser depuis le backend"
              title="Récupérer les données depuis le backend Neon (utile si vous avez travaillé sur un autre appareil)"
              className="h-9 px-3 text-muted-foreground hover:text-[#0D6EFD] shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              <span className="hidden lg:inline ml-1.5 text-xs font-semibold">
                {syncing ? "Sync..." : "Sync"}
              </span>
            </Button>

            <Badge
              variant="outline"
              className="hidden md:inline-flex items-center gap-1.5 border-[#008751]/30 bg-[#008751]/5 text-[#008751] px-2 py-1"
              title="Statut de connexion"
            >
              <CircleDot className="h-3 w-3 animate-pulse" />
              <span className="text-[11px] font-semibold">En ligne</span>
            </Badge>

            {/* Avatar compact (mobile) */}
            {prospect && (
              <div className="flex sm:hidden items-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0D6EFD]/10 text-[#0D6EFD] text-xs font-semibold">
                  {prospect.firstName.charAt(0).toUpperCase()}
                  {prospect.lastName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="h-9 w-9 text-muted-foreground hover:text-[#e31b23]"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
