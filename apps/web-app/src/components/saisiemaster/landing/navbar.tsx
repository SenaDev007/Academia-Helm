"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, LogOut, History, LogIn, ChevronDown } from "lucide-react";
import { useSaisieMasterStore, selectIsAuthenticated } from "@/lib/saisiemaster/store";
import { LogoWithHalo } from "@/components/saisiemaster/brand/logo-with-halo";

interface NavbarProps {
  onStart: () => void;
}

export function Navbar({ onStart }: NavbarProps) {
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);
  const prospect = useSaisieMasterStore((s) => s.prospect);
  const setView = useSaisieMasterStore((s) => s.setView);
  const setAuthView = useSaisieMasterStore((s) => s.setAuthView);
  const logout = useSaisieMasterStore((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fermer le menu au clic en dehors
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleStart = () => {
    if (isAuthenticated) {
      const el = document.getElementById("demarrer");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setAuthView("signup");
    }
  };

  const handleLogin = () => {
    setAuthView("login");
  };

  const handleLogout = () => {
    logout();
    setView("landing");
  };

  const handleMesSaisies = () => {
    setView("editor");
    setMenuOpen(false);
  };

  // Get initials safely
  const initials = prospect
    ? `${prospect.firstName?.[0] ?? ""}${prospect.lastName?.[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* ⭐ Logo agrandi (44px) avec halo tricolore animé */}
        <LogoWithHalo size="md" />

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#fonctionnement" className="hover:text-foreground transition-colors">
            Fonctionnement
          </a>
          {/* ⭐ Bouton "Fonctionnalités" supprimé — la section n'existe plus */}
          <a href="#a-propos" className="hover:text-foreground transition-colors">
            À propos
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated && prospect ? (
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#008751]/10 text-[#008751] text-xs font-semibold">
                  {initials}
                </span>
                <span className="hidden sm:inline font-medium">
                  {prospect.firstName || ""}
                </span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">
                      {prospect.firstName || ""} {prospect.lastName || ""}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {prospect.email || ""}
                    </p>
                    <p className="text-xs text-gray-500">
                      {prospect.schoolName || ""}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleMesSaisies}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                    >
                      <History className="h-4 w-4" />
                      Mes saisies
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-2 text-sm text-[#e31b23] hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLogin}
                className="gap-2"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Se connecter</span>
                <span className="sm:hidden">Connexion</span>
              </Button>
              <Button
                size="sm"
                onClick={handleStart}
                className="bg-[#008751] hover:bg-[#008751]/90 text-white"
              >
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Commencer gratuitement</span>
                <span className="sm:hidden">Commencer</span>
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Bande tricolore Bénin en bas du header */}
      <div className="h-0.5 w-full saisiemaster-tricolor" aria-hidden />
    </header>
  );
}
