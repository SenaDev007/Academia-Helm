"use client";

import { useState } from "react";
import {
  PencilLine,
  FolderTree,
  Files,
  History,
  Settings,
  PanelLeftClose,
  PanelLeft,
  X,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/saisiemaster/utils";
import { FeedbackModal } from "./feedback-modal";

/**
 * Sidebar de l'éditeur SaisieMaster.
 *
 * Design inspiré du screenshot fourni :
 *  - Fond gris clair (#F8F9FA)
 *  - Élément actif en bleu (#0D6EFD) avec texte blanc
 *  - 5 items : Saisie des notes, Mes classes, Mes fichiers, Historique, Paramètres
 *
 * Responsive :
 *  - Desktop (≥md) : sidebar fixe à gauche, collapsible (largeur 240px ↔ 64px)
 *  - Mobile (<md) : drawer latéral déclenché par un bouton hamburger flottant
 */

export type EditorNavId = "notes" | "classes" | "files" | "history" | "settings";

interface NavItem {
  id: EditorNavId;
  label: string;
  icon: typeof PencilLine;
}

const NAV_ITEMS: NavItem[] = [
  { id: "notes", label: "Saisie des notes", icon: PencilLine },
  { id: "classes", label: "Mes classes", icon: FolderTree },
  { id: "files", label: "Mes fichiers", icon: Files },
  { id: "history", label: "Historique", icon: History },
  { id: "settings", label: "Paramètres", icon: Settings },
];

interface EditorSidebarProps {
  /** Item actif. */
  active: EditorNavId;
  /** Callback appelé lors d'un clic sur un item. */
  onSelect: (id: EditorNavId) => void;
}

export function EditorSidebar({ active, onSelect }: EditorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleSelect = (id: EditorNavId) => {
    onSelect(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Bouton hamburger flottant (mobile uniquement) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed bottom-4 left-4 z-50 inline-flex items-center justify-center h-12 w-12 rounded-full bg-[#0D6EFD] text-white shadow-lg hover:bg-[#0D6EFD]/90 transition-colors"
        aria-label="Ouvrir le menu de navigation"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      {/* Backdrop mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "z-50 shrink-0 bg-[#F8F9FA] dark:bg-zinc-900 border-r border-border/60 flex flex-col",
          "transition-[width,transform] duration-200 ease-in-out",
          // Desktop : sidebar statique, collapsible
          collapsed ? "md:w-[64px]" : "md:w-[240px]",
          // Mobile : drawer latéral
          "fixed md:static inset-y-0 left-0 w-[260px] md:w-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* En-tête de la sidebar (mobile : bouton fermer / desktop : bouton replier) */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-border/60">
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
              collapsed && "md:hidden",
            )}
          >
            Navigation
          </span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden md:inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground"
            aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Liste de navigation */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  collapsed && "md:justify-center md:px-0",
                  isActive
                    ? "bg-[#0D6EFD] text-white shadow-sm shadow-[#0D6EFD]/30"
                    : "text-foreground/70 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn("truncate", collapsed && "md:hidden")}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Pied de sidebar — bouton témoignage + version */}
        <div className="p-3 border-t border-border/60 space-y-2">
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            title={collapsed ? "Donner mon avis" : undefined}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              "text-[#008751] hover:bg-[#008751]/10",
              collapsed && "md:justify-center md:px-0",
            )}
          >
            <MessageSquare className="h-5 w-5 shrink-0" />
            <span className={cn("truncate", collapsed && "md:hidden")}>
              Donner mon avis
            </span>
          </button>
          <div
            className={cn(
              "flex items-center gap-2 text-[10px] text-muted-foreground",
              collapsed && "md:hidden",
            )}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#008751]" />
            SaisieMaster v1.0
          </div>
        </div>
      </aside>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
