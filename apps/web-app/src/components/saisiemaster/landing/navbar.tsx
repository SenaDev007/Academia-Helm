"use client";

import Link from "next/link";
import { Logo } from "@/components/saisiemaster/brand/logo";
import { Button } from "@/components/ui/button";
import { Github, BookOpen } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="md" />

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <a href="#fonctionnement" className="hover:text-foreground transition-colors">
            Fonctionnement
          </a>
          <a href="#fonctionnalites" className="hover:text-foreground transition-colors">
            Fonctionnalités
          </a>
          <a href="#a-propos" className="hover:text-foreground transition-colors">
            À propos
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Code source GitHub"
            >
              <Github className="h-4 w-4" />
              <span className="hidden lg:inline">GitHub</span>
            </a>
          </Button>
          <Button size="sm" asChild>
            <a href="#demarrer">
              <BookOpen className="h-4 w-4" />
              Commencer
            </a>
          </Button>
        </div>
      </div>
      {/* Bande tricolore Bénin en bas du header */}
      <div className="h-0.5 w-full saisiemaster-tricolor" aria-hidden />
    </header>
  );
}
