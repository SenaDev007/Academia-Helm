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
  Download,
  RotateCcw,
  School,
  Calendar,
  Users,
  LogOut,
} from "lucide-react";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import { SessionsList } from "./sessions-list";
import type { ClassData } from "@/lib/saisiemaster/types";

interface EditorHeaderProps {
  onExport: () => void;
  onReset: () => void;
  onHome: () => void;
}

export function EditorHeader({ onExport, onReset, onHome }: EditorHeaderProps) {
  const { classes, activeClassIndex, setActiveClass, isExporting } =
    useSaisieMasterStore();
  const logout = useSaisieMasterStore((s) => s.logout);
  const setView = useSaisieMasterStore((s) => s.setView);

  const activeClass: ClassData | undefined = classes[activeClassIndex];

  if (!activeClass) return null;

  const handleLogout = () => {
    logout();
    setView("landing");
  };

  const handleResumeSession = (newClasses: ClassData[]) => {
    // Replace current classes with the resumed session.
    useSaisieMasterStore.setState({
      classes: newClasses,
      activeClassIndex: 0,
    });
    // Persist to localStorage so it survives reloads.
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(
          "saisiemaster:autosave",
          JSON.stringify({
            classes: newClasses,
            activeClassIndex: 0,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch (e) {
        console.warn("Persist resumed session failed:", e);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="h-0.5 w-full saisiemaster-tricolor" aria-hidden />
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Gauche — Logo + retour */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onHome}
              aria-label="Retour à l'accueil"
              className="h-9 w-9"
            >
              <Home className="h-4 w-4" />
            </Button>
            <Logo size="sm" showText={false} />
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">SaisieMaster</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">Éditeur</span>
            </div>
          </div>

          {/* Centre — Infos classe + sélecteur multi-classes */}
          <div className="flex items-center gap-2">
            {classes.length > 1 ? (
              <Select
                value={String(activeClassIndex)}
                onValueChange={(v) => setActiveClass(Number(v))}
              >
                <SelectTrigger className="h-9 w-[200px] sm:w-[260px]">
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
              <Badge
                variant="outline"
                className="h-9 px-3 gap-1.5 border-[#008751]/30 bg-[#008751]/5 text-[#008751]"
              >
                <School className="h-3.5 w-3.5" />
                <span className="font-semibold uppercase tracking-wide text-xs">
                  Classe {activeClass.className}
                </span>
              </Badge>
            )}
          </div>

          {/* Droite — Actions */}
          <div className="flex items-center gap-2">
            <SessionsList onResume={handleResumeSession} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </Button>
            <Button
              size="sm"
              onClick={onExport}
              disabled={isExporting}
              className="bg-[#008751] hover:bg-[#008751]/90 shadow-sm"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">
                {isExporting ? "Export…" : "Exporter Excel"}
              </span>
            </Button>
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

        {/* Bandeau métadonnées */}
        <div className="flex flex-wrap items-center gap-3 pb-3 text-xs text-muted-foreground">
          {activeClass.schoolName && (
            <span className="inline-flex items-center gap-1.5">
              <School className="h-3.5 w-3.5 text-[#008751]" />
              <span className="font-medium text-foreground">
                {activeClass.schoolName}
              </span>
            </span>
          )}
          {activeClass.academicYear && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {activeClass.academicYear}
              </span>
            </>
          )}
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {activeClass.students.length} élève
            {activeClass.students.length > 1 ? "s" : ""}
          </span>
          <span className="text-border">·</span>
          <span className="inline-flex items-center gap-1.5">
            {activeClass.subjects.length} matière
            {activeClass.subjects.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </header>
  );
}
