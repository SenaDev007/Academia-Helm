"use client";

/**
 * Sélecteur de type d'évaluation — onglets pour tous les types d'évaluations.
 *
 * Affiche les 4 types prédéfinis (EF1, ES1, ES2, ES3) + les types personnalisés
 * créés par l'utilisateur pour la classe active. Un bouton "+" permet de
 * créer un nouveau type d'évaluation personnalisé.
 *
 * Chaque onglet affiche :
 *  - Le code court (EF1, ES1, ES2, ES3, ou code personnalisé)
 *  - Un indicateur visuel si des notes ont été saisies pour ce type
 *  - Un bouton de suppression pour les types personnalisés (au survol)
 */

import { useState } from "react";
import { cn } from "@/lib/saisiemaster/utils";
import { useSaisieMasterStore } from "@/lib/saisiemaster/store";
import { EVALUATION_TYPES } from "@/lib/saisiemaster/constants";
import {
  hasEvaluationNotes,
  getAllEvaluationTypes,
  isDefaultEvaluationType,
} from "@/lib/saisiemaster/evaluation-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function EvaluationTypeSelector() {
  const {
    classes,
    activeClassIndex,
    activeEvalType,
    setActiveEvalType,
    addCustomEvaluationType,
    removeCustomEvaluationType,
  } = useSaisieMasterStore();
  const classData = classes[activeClassIndex];
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");

  if (!classData) return null;

  const allTypes = getAllEvaluationTypes(classData);

  const handleCreate = () => {
    const code = newCode.trim().toUpperCase();
    const label = newLabel.trim();

    if (!code || !label) {
      toast.error("Veuillez remplir le code et le libellé");
      return;
    }

    // Vérifier l'unicité
    if (allTypes.some((t) => t.code === code)) {
      toast.error(`Le code "${code}" existe déjà`);
      return;
    }

    addCustomEvaluationType({ code, label });
    toast.success(`✅ Type d'évaluation "${label}" créé`);
    setNewCode("");
    setNewLabel("");
    setShowCreateModal(false);
  };

  const handleRemove = (code: string, label: string) => {
    if (!confirm(`Supprimer le type d'évaluation "${label}" ? Les notes saisies seront perdues.`)) return;
    removeCustomEvaluationType(code);
    toast.success(`Type d'évaluation supprimé`);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <div className="h-1 w-full saisiemaster-tricolor" aria-hidden />
        <div className="flex overflow-x-auto items-stretch">
          {allTypes.map((evalType) => {
            const isActive = activeEvalType === evalType.code;
            const hasNotes = hasEvaluationNotes(classData, evalType.code);
            const isDefault = isDefaultEvaluationType(evalType.code);
            return (
              <div key={evalType.code} className="relative group flex-1 min-w-[120px]">
                <button
                  onClick={() => setActiveEvalType(evalType.code)}
                  className={cn(
                    "w-full flex flex-col items-center gap-0.5 px-3 py-2.5 text-sm font-bold transition-all whitespace-nowrap border-b-2",
                    isActive
                      ? "text-[#0D6EFD] border-[#0D6EFD] bg-[#0D6EFD]/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent",
                  )}
                  title={evalType.description || evalType.label}
                  aria-pressed={isActive}
                >
                  <span className="text-sm">{evalType.code}</span>
                  <span className="text-[10px] font-normal opacity-70 hidden sm:inline truncate max-w-[120px]">
                    {evalType.label}
                  </span>
                  {hasNotes && (
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full",
                        isActive ? "bg-[#0D6EFD]" : "bg-emerald-500",
                      )}
                      aria-label="Notes saisies"
                    />
                  )}
                </button>
                {/* Bouton suppression pour les types personnalisés */}
                {!isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(evalType.code, evalType.label);
                    }}
                    className="absolute top-1 right-1 p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer ce type d'évaluation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Bouton "+" pour créer un type d'évaluation personnalisé */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-[#0D6EFD] hover:bg-[#0D6EFD]/5 border-b-2 border-transparent transition-all whitespace-nowrap"
            title="Créer un type d'évaluation personnalisé"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        </div>
      </div>

      {/* Modale de création de type d'évaluation */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un type d'évaluation</DialogTitle>
            <DialogDescription>
              Ajoutez un type d'évaluation personnalisé pour la classe{" "}
              <strong>{classData.className}</strong>. Les notes saisies seront
              liées à ce type spécifique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="eval-code">Code court</Label>
              <Input
                id="eval-code"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="Ex: DM1, INT, COMP"
                maxLength={10}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Code unique en majuscules (lettres et chiffres uniquement).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eval-label">Libellé complet</Label>
              <Input
                id="eval-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Ex: Devoir Mensuel 1, Interrogation surprise"
              />
              <p className="text-xs text-muted-foreground">
                Nom complet affiché dans l'interface et dans les exports.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} className="bg-[#0D6EFD] hover:bg-[#0D6EFD]/90">
              <Plus className="h-4 w-4 mr-1" />
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
