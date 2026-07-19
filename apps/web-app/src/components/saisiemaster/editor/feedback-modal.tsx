"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Star, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { submitTestimonial, getMyTestimonials, type MyTestimonial } from "@/lib/saisiemaster/api";
import { cn } from "@/lib/saisiemaster/utils";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLES = [
  "Directeur",
  "Directrice",
  "Enseignant",
  "Enseignante",
  "Secrétaire",
  "Surveillant",
  "Autre",
];

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState("");
  const [authorRole, setAuthorRole] = useState("Directeur");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [mine, setMine] = useState<MyTestimonial[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);

  // Reset on open + load existing testimonials (pour empêcher un 2e avis)
  useEffect(() => {
    if (open) {
      setRating(0);
      setHoverRating(0);
      setContent("");
      setAuthorRole("Directeur");
      setCity("");
      setError(null);
      setSuccess(false);
      setSubmitting(false);
      setLoadingMine(true);
      // Load user's existing testimonials
      (async () => {
        const list = await getMyTestimonials();
        setMine(list);
        setLoadingMine(false);
      })();
    }
  }, [open]);

  const displayRating = hoverRating || rating;

  // ⭐ L'utilisateur a déjà donné son avis → on bloque le formulaire
  const hasAlreadySubmitted = mine.length > 0;

  const handleSubmit = async () => {
    setError(null);

    // Sécurité : si l'utilisateur a déjà un témoignage, on bloque
    if (hasAlreadySubmitted) {
      setError(
        "Vous avez déjà donné votre avis. Vous ne pouvez pas en soumettre un second.",
      );
      return;
    }

    if (rating < 1 || rating > 5) {
      setError("Veuillez sélectionner une note (1 à 5 étoiles)");
      return;
    }
    if (content.trim().length < 20) {
      setError("Le témoignage doit contenir au moins 20 caractères");
      return;
    }
    if (content.length > 2000) {
      setError("Le témoignage ne peut pas dépasser 2000 caractères");
      return;
    }
    // ⭐ Ville obligatoire
    if (city.trim().length < 2) {
      setError("Veuillez indiquer votre ville");
      return;
    }

    setSubmitting(true);
    try {
      await submitTestimonial({
        rating,
        content: content.trim(),
        authorRole,
        city: city.trim(),
      });
      setSuccess(true);
      // Refresh list
      const list = await getMyTestimonials();
      setMine(list);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Échec de l'envoi. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Partager mon expérience</DialogTitle>
          <DialogDescription>
            Votre avis aide d&apos;autres directeurs à découvrir SaisieMaster.
            Il sera publié sur la landing page après validation.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-[#198754]/10">
              <CheckCircle2 className="h-7 w-7 text-[#198754]" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                Merci pour votre témoignage !
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Il sera visible publiquement après validation de notre équipe.
              </p>
            </div>
            <Button onClick={handleClose} className="bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white">
              Fermer
            </Button>
          </div>
        ) : loadingMine ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">
              Vérification de vos témoignages existants…
            </p>
          </div>
        ) : hasAlreadySubmitted ? (
          // ⭐ L'utilisateur a déjà donné son avis → on bloque le formulaire
          <div className="py-6 space-y-4">
            <div className="rounded-md border border-[#FD7E14]/30 bg-[#FD7E14]/5 px-4 py-3 text-sm text-[#FD7E14]">
              <p className="font-medium">Vous avez déjà donné votre avis</p>
              <p className="text-xs mt-1">
                Pour garantir la diversité des retours, chaque utilisateur ne
                peut soumettre qu&apos;un seul témoignage. Le vôtre est en attente
                de validation par notre équipe.
              </p>
            </div>

            {/* Afficher le témoignage existant */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">
                Votre témoignage
              </p>
              <ul className="space-y-2">
                {mine.map((t) => (
                  <li key={t.id} className="text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={cn(
                              "h-3 w-3",
                              s <= t.rating
                                ? "fill-[#FCD116] text-[#FCD116]"
                                : "text-muted-foreground/30",
                            )}
                          />
                        ))}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                          t.isPublished
                            ? "bg-[#198754]/15 text-[#198754]"
                            : "bg-[#FD7E14]/15 text-[#FD7E14]",
                        )}
                      >
                        {t.isPublished ? "Publié" : "En attente de validation"}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{t.content}</p>
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter>
              <Button onClick={handleClose} className="bg-[#0D6EFD] hover:bg-[#0D6EFD]/90 text-white">
                Fermer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Note (étoiles) */}
            <div>
              <label className="text-sm font-medium text-foreground">
                Votre note <span className="text-[#DC3545]">*</span>
              </label>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 hover:scale-110 transition-transform"
                    aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition-colors",
                        star <= displayRating
                          ? "fill-[#FCD116] text-[#FCD116]"
                          : "text-muted-foreground/30",
                      )}
                    />
                  </button>
                ))}
                {displayRating > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    {displayRating}/5
                  </span>
                )}
              </div>
            </div>

            {/* Témoignage */}
            <div>
              <label className="text-sm font-medium text-foreground">
                Votre témoignage <span className="text-[#DC3545]">*</span>
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({content.length}/2000)
                </span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 2000))}
                placeholder="Racontez votre expérience avec SaisieMaster : ce que vous appréciez, comment l'outil a facilité votre travail de saisie des notes..."
                rows={5}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/40"
              />
            </div>

            {/* Rôle */}
            <div>
              <label className="text-sm font-medium text-foreground">
                Votre fonction
              </label>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value)}
                className="mt-2 w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/40"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Ville (obligatoire) */}
            <div>
              <label className="text-sm font-medium text-foreground">
                Ville <span className="text-[#DC3545]">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Parakou, Cotonou, Porto-Novo..."
                required
                className="mt-2 w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D6EFD]/40"
              />
            </div>

            {/* Mes témoignages précédents */}
            {mine.length > 0 && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Vos témoignages précédents ({mine.length})
                </p>
                <ul className="space-y-2">
                  {mine.map((t) => (
                    <li key={t.id} className="text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="inline-flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                "h-3 w-3",
                                s <= t.rating
                                  ? "fill-[#FCD116] text-[#FCD116]"
                                  : "text-muted-foreground/30",
                              )}
                            />
                          ))}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                            t.isPublished
                              ? "bg-[#198754]/15 text-[#198754]"
                              : "bg-[#FD7E14]/15 text-[#FD7E14]",
                          )}
                        >
                          {t.isPublished ? "Publié" : "En attente"}
                        </span>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">
                        {t.content}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Erreur */}
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-[#DC3545]/30 bg-[#DC3545]/5 px-3 py-2 text-sm text-[#DC3545]">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose} disabled={submitting}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating === 0 || content.trim().length < 20 || city.trim().length < 2}
                className="bg-[#008751] hover:bg-[#008751]/90 text-white gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  "Publier mon avis"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
