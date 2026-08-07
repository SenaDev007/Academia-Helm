"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  Upload,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/saisiemaster/utils";
import { isExcelFile, parseEducMasterFile } from "@/lib/saisiemaster/excel-parser";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import type { ClassData } from "@/lib/saisiemaster/types";

interface UploadZoneProps {
  onProcessed?: () => void;
  className?: string;
  compact?: boolean;
}

export function UploadZone({
  onProcessed,
  className,
  compact = false,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadClasses = useSaisieMasterStore((s) => s.loadClasses);
  const addClasses = useSaisieMasterStore((s) => s.addClasses);
  const existingClasses = useSaisieMasterStore((s) => s.classes);
  const setImportError = useSaisieMasterStore((s) => s.setImportError);
  const setView = useSaisieMasterStore((s) => s.setView);
  const setAuthView = useSaisieMasterStore((s) => s.setAuthView);
  const isAuthenticated = useSaisieMasterStore((s) => !!s.token);

  // ⭐ Task 33 : vérifier l'auth avant de permettre l'upload.
  // Si l'utilisateur n'est pas connecté, afficher un modal de connexion.
  const requireAuth = useCallback((): boolean => {
    if (!isAuthenticated) {
      toast.info("Connexion requise", {
        description: "Veuillez créer un compte ou vous connecter pour importer votre fichier.",
      });
      setAuthView("signup");
      return false;
    }
    return true;
  }, [isAuthenticated, setAuthView]);

  const processFile = useCallback(
    async (file: File) => {
      // ⭐ Vérifier l'auth avant de traiter le fichier
      if (!requireAuth()) return;

      if (!isExcelFile(file)) {
        toast.error("Format non supporté", {
          description: "Veuillez sélectionner un fichier .xlsx ou .xls",
        });
        return;
      }

      setSelectedFile(file);
      setIsProcessing(true);
      setProgress(10);

      try {
        const buffer = await file.arrayBuffer();
        setProgress(50);

        const classes = parseEducMasterFile(buffer, file.name);
        setProgress(80);

        if (classes.length === 0) {
          setImportError(
            "Aucune classe détectée dans ce fichier. Vérifiez que le fichier provient bien d'EducMaster.",
          );
          toast.error("Aucune classe détectée", {
            description:
              "Vérifiez que le fichier provient bien d'EducMaster et contient des élèves.",
          });
          return;
        }

        // ⭐ Si l'utilisateur a déjà des classes, AJOUTE les nouvelles au lieu de remplacer
        if (existingClasses.length > 0) {
          addClasses(classes);
        } else {
          loadClasses(classes);
        }
        setProgress(100);

        toast.success("Fichier importé avec succès", {
          description: `${classes.length} classe(s) ${existingClasses.length > 0 ? "ajoutée(s)" : "détectée(s)"}, ${classes.reduce(
            (acc, c) => acc + c.students.length,
            0,
          )} élève(s) au total.`,
        });

        setTimeout(() => {
          setView("editor");
          onProcessed?.();
        }, 400);
      } catch (err) {
        console.error(err);
        setImportError(
          err instanceof Error
            ? err.message
            : "Erreur lors de la lecture du fichier",
        );
        toast.error("Erreur de lecture", {
          description:
            err instanceof Error
              ? err.message
              : "Impossible de lire ce fichier Excel",
        });
      } finally {
        setIsProcessing(false);
        setTimeout(() => setProgress(0), 800);
      }
    },
    [loadClasses, addClasses, existingClasses, setImportError, setView, onProcessed, requireAuth],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset input pour permettre de re-sélectionner le même fichier
      if (inputRef.current) inputRef.current.value = "";
    },
    [processFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      // ⭐ Vérifier l'auth avant d'accepter le drop
      if (!requireAuth()) return;
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile, requireAuth],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const reset = () => {
    setSelectedFile(null);
    setProgress(0);
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleFileSelect}
        className="sr-only"
        aria-label="Importer un fichier Excel EducMaster"
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => !isProcessing && requireAuth() && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isProcessing) {
            e.preventDefault();
            if (requireAuth()) inputRef.current?.click();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300",
          "flex flex-col items-center justify-center text-center",
          compact ? "p-6 sm:p-8" : "p-10 sm:p-14",
          isDragging
            ? "border-[#008751] bg-[#008751]/5 scale-[1.01]"
            : "border-border bg-card hover:border-[#008751]/50 hover:bg-muted/30",
          isProcessing && "pointer-events-none opacity-80",
        )}
        aria-busy={isProcessing}
      >
        {/* Bande tricolore en haut quand drag actif */}
        {isDragging && (
          <div className="absolute inset-x-0 top-0 h-1 saisiemaster-tricolor rounded-t-2xl" />
        )}

        {isProcessing ? (
          <div className="space-y-4 w-full max-w-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-10 w-10 animate-spin text-[#008751]" />
              <p className="text-sm font-medium text-foreground">
                Lecture du fichier…
              </p>
              {selectedFile && (
                <p className="text-xs text-muted-foreground truncate max-w-full">
                  {selectedFile.name}
                </p>
              )}
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        ) : (
          <div className="space-y-4 max-w-md">
            <div
              className={cn(
                "mx-auto grid place-items-center rounded-full transition-transform group-hover:scale-110",
                compact ? "h-12 w-12" : "h-16 w-16",
                "bg-gradient-to-br from-[#008751]/10 to-[#fcd116]/15 ring-1 ring-[#008751]/20",
              )}
            >
              <FileSpreadsheet
                className={cn(
                  "text-[#008751]",
                  compact ? "h-6 w-6" : "h-8 w-8",
                )}
              />
            </div>

            <div className="space-y-1.5">
              <p className={cn("font-semibold text-foreground", compact ? "text-base" : "text-lg")}>
                {selectedFile ? selectedFile.name : "Glissez votre template Excel ici"}
              </p>
              <p className="text-sm text-muted-foreground">
                ou{" "}
                <span className="text-[#008751] font-medium underline-offset-2 group-hover:underline">
                  parcourez vos fichiers
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                .xlsx
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                .xls
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-1">
                Format EducMaster
              </span>
            </div>

            {!compact && (
              <div className="pt-3">
                <Button type="button" variant="outline" size="sm">
                  <Upload className="h-4 w-4" />
                  Choisir un fichier
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lien pour réinitialiser si un fichier est sélectionné */}
      {selectedFile && !isProcessing && (
        <div className="mt-3 flex items-center justify-center">
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
            <X className="h-3 w-3" />
            Réinitialiser
          </Button>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground max-w-md mx-auto">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-[#fcd116]" />
        <p>
          Assurez-vous d&apos;utiliser le template officiel téléchargé depuis la
          plateforme <strong className="text-foreground">EducMaster</strong> pour
          garantir la compatibilité à l&apos;import.
        </p>
      </div>
    </div>
  );
}
