"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileArchive,
} from "lucide-react";
import { useSaisieMasterStore, computeSaisieStats } from "@/lib/saisiemaster/store";
import {
  exportEducMasterFile,
  exportAllEvaluationsZip,
  downloadBlob,
} from "@/lib/saisiemaster/excel-generator";
import { trackActivity } from "@/lib/saisiemaster/api";
import { EVALUATION_TYPES } from "@/lib/saisiemaster/constants";
import {
  hasEvaluationNotes,
  getAllEvaluationTypes,
} from "@/lib/saisiemaster/evaluation-utils";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { classes, activeClassIndex, activeEvalType, setExporting, isExporting } =
    useSaisieMasterStore();
  const [exported, setExported] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportingEval, setExportingEval] = useState<string | null>(null);

  const classData = classes[activeClassIndex];
  // Stats pour le type d'évaluation actif
  const stats = classData ? computeSaisieStats(classData, activeEvalType) : null;

  /** Export individuel : 1 fichier Excel pour un type d'évaluation. */
  const handleExportEval = (evalCode: string) => {
    if (!classData) return;
    setExportingEval(evalCode);
    try {
      const { blob, fileName } = exportEducMasterFile(
        classData,
        evalCode as "EF1" | "ES1" | "ES2" | "ES3",
      );
      downloadBlob(blob, fileName);
      setExported(true);
      toast.success(`✅ ${evalCode} exporté`, { description: fileName });
      void trackActivity("export");
    } catch (err) {
      console.error(err);
      toast.error(`Erreur export ${evalCode}`, {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setExportingEval(null);
    }
  };

  /** Export groupé : ZIP contenant les 4 fichiers Excel. */
  const handleExportZip = async () => {
    if (!classData) return;
    setExportingZip(true);
    setExporting(true);
    try {
      const { blob, fileName } = await exportAllEvaluationsZip(classData);
      downloadBlob(blob, fileName);
      setExported(true);
      toast.success("✅ ZIP téléchargé (4 fichiers)", { description: fileName });
      void trackActivity("export");
    } catch (err) {
      console.error(err);
      toast.error("Erreur export ZIP", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setExportingZip(false);
      setExporting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) setExported(false);
    onOpenChange(open);
  };

  if (!classData || !stats) return null;

  const isComplete = stats.completionRate === 100;
  const hasWarnings = stats.completionRate < 100;
  // Tous les types d'évaluations (4 prédéfinis + personnalisés)
  const allTypes = getAllEvaluationTypes(classData);
  const hasAnyNotes = allTypes.some((t) =>
    hasEvaluationNotes(classData, t.code),
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-[#008751]" />
            Exporter le fichier EducMaster
          </DialogTitle>
          <DialogDescription>
            Génération d&apos;un fichier Excel conforme au format EducMaster pour
            la classe{" "}
            <strong className="text-foreground">{classData.className}</strong>.
          </DialogDescription>
        </DialogHeader>

        {exported ? (
          <div className="space-y-3 py-2">
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <div className="grid place-items-center h-12 w-12 rounded-full bg-[#008751]/10">
                <CheckCircle2 className="h-7 w-7 text-[#008751]" />
              </div>
              <p className="font-semibold text-foreground">Export réussi !</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Le fichier a été téléchargé. Vous pouvez maintenant l&apos;importer
                dans la plateforme EducMaster.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Classe</span>
                <span className="font-medium">{classData.className}</span>
              </div>
              {classData.schoolName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">École</span>
                  <span className="font-medium truncate ml-2 max-w-[200px]">
                    {classData.schoolName}
                  </span>
                </div>
              )}
              {classData.academicYear && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Année</span>
                  <span className="font-medium">{classData.academicYear}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Élèves</span>
                <span className="font-medium">{classData.students.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saisie</span>
                <span
                  className={`font-medium ${
                    isComplete
                      ? "text-[#008751]"
                      : stats.completionRate >= 50
                        ? "text-[#8a6d0b]"
                        : "text-[#e31b23]"
                  }`}
                >
                  {stats.completionRate}% ({stats.filledCells}/{stats.totalCells})
                </span>
              </div>
            </div>

            {hasWarnings && (
              <Alert className="border-[#fcd116]/40 bg-[#fcd116]/10">
                <AlertTriangle className="h-4 w-4 text-[#8a6d0b]" />
                <AlertTitle className="text-[#8a6d0b]">
                  Saisie incomplète
                </AlertTitle>
                <AlertDescription className="text-xs text-[#8a6d0b]">
                  {stats.totalCells - stats.filledCells} cellule(s) non remplie(s).
                  Le fichier exporté contiendra des cellules vides — vous pourrez
                  compléter plus tard dans EducMaster.
                </AlertDescription>
              </Alert>
            )}

            {isComplete && (
              <Alert className="border-[#008751]/40 bg-[#008751]/10">
                <CheckCircle2 className="h-4 w-4 text-[#008751]" />
                <AlertTitle className="text-[#008751]">
                  Saisie complète
                </AlertTitle>
                <AlertDescription className="text-xs text-[#008751]">
                  Toutes les notes ont été saisies. Le fichier est prêt à être
                  importé dans EducMaster.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Section export : 4 boutons individuels + 1 bouton ZIP */}
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-[#008751]" />
              Export individuel (1 fichier par évaluation)
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allTypes.map((t) => {
                const hasNotes = hasEvaluationNotes(classData, t.code);
                return (
                  <Button
                    key={t.code}
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportEval(t.code)}
                    disabled={exportingEval === t.code || exportingZip}
                    className="justify-start text-xs h-auto py-2"
                    title={hasNotes ? `${t.label} — notes saisies` : `${t.label} — vide`}
                  >
                    {exportingEval === t.code ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                    ) : (
                      <Download className="h-3.5 w-3.5 mr-2" />
                    )}
                    <span className="font-bold">{t.code}</span>
                    <span
                      className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                        hasNotes ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#0D6EFD]/30 bg-[#0D6EFD]/5 p-3">
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <FileArchive className="h-3.5 w-3.5 text-[#0D6EFD]" />
              Export groupé (4 fichiers d'un coup)
            </p>
            <Button
              onClick={handleExportZip}
              disabled={exportingZip || !hasAnyNotes}
              className="w-full bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white"
              size="sm"
            >
              {exportingZip ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileArchive className="h-4 w-4 mr-2" />
              )}
              Télécharger le ZIP ({allTypes.length} fichiers)
            </Button>
            {!hasAnyNotes && (
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                Aucune note saisie pour le moment.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
