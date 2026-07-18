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
} from "lucide-react";
import { useSaisieMasterStore, computeSaisieStats } from "@/lib/saisiemaster/store";
import { exportEducMasterFile, downloadBlob } from "@/lib/saisiemaster/excel-generator";
import { trackActivity } from "@/lib/saisiemaster/api";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const { classes, activeClassIndex, setExporting, isExporting } =
    useSaisieMasterStore();
  const [exported, setExported] = useState(false);

  const classData = classes[activeClassIndex];
  const stats = classData ? computeSaisieStats(classData) : null;

  const handleExport = () => {
    if (!classData) return;
    setExporting(true);
    try {
      const { blob, fileName } = exportEducMasterFile(classData);
      downloadBlob(blob, fileName);
      setExported(true);
      toast.success("Fichier exporté avec succès", {
        description: fileName,
      });
      // Track export activity for lead scoring (best-effort, non-blocking).
      void trackActivity("export");
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export", {
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
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

        <DialogFooter className="gap-2">
          {exported ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Fermer
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Télécharger à nouveau
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting}
                className="bg-[#008751] hover:bg-[#008751]/90"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Générer le fichier
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
