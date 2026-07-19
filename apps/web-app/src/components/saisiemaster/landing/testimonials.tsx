"use client";

import { useEffect, useState } from "react";
import { Star, Quote, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPublishedTestimonials,
  type PublicTestimonial,
} from "@/lib/saisiemaster/api";
import { useSaisieMasterStore, selectIsAuthenticated } from "@/lib/saisiemaster/store";

/**
 * Section témoignages — affichée sur la landing page SaisieMaster.
 *
 * Charge les témoignages publiés depuis l'API publique.
 * Si l'utilisateur est authentifié, un CTA "Donner mon avis" s'affiche
 * et ouvre le modal de témoignage (géré par le parent via onGiveFeedback).
 *
 * Si aucun témoignage n'est encore publié, la section reste discrète :
 * on n'affiche que le CTA "Partagez votre expérience".
 */
interface TestimonialsProps {
  onGiveFeedback?: () => void;
}

export function Testimonials({ onGiveFeedback }: TestimonialsProps) {
  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const isAuthenticated = useSaisieMasterStore(selectIsAuthenticated);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await getPublishedTestimonials();
      if (!cancelled) {
        setTestimonials(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pas de témoignages ET pas authentifié → on n'affiche rien
  // (la section n'a pas de valeur ajoutée pour un visiteur non connecté
  // si personne n'a encore laissé d'avis)
  if (!loading && testimonials.length === 0 && !isAuthenticated) {
    return null;
  }

  return (
    <section id="temoignages" className="py-16 sm:py-24 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="text-center mb-10">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-[#008751]">
            Témoignages
          </span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Ce que disent les directeurs qui utilisent SaisieMaster
          </h2>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
            Des écoles béninoises de toutes tailles nous font confiance pour
            la saisie de leurs notes EducMaster. Voici leurs retours.
          </p>
        </div>

        {/* Grille de témoignages */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border bg-card p-6 animate-pulse"
              >
                <div className="h-4 w-24 bg-muted rounded mb-3" />
                <div className="h-3 w-full bg-muted rounded mb-2" />
                <div className="h-3 w-5/6 bg-muted rounded mb-2" />
                <div className="h-3 w-4/6 bg-muted rounded mb-6" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : testimonials.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <TestimonialCard key={t.id} testimonial={t} />
            ))}
          </div>
        ) : (
          // Authentifié mais aucun témoignage publié
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[#FCD116]/10 mb-4">
              <Quote className="h-7 w-7 text-[#008751]" />
            </div>
            <p className="text-lg font-medium text-foreground">
              Soyez le premier à partager votre expérience !
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Votre avis aide d&apos;autres directeurs à découvrir SaisieMaster
              et nous aide à améliorer l&apos;outil.
            </p>
          </div>
        )}

        {/* CTA — Donner mon avis */}
        {isAuthenticated && (
          <div className="mt-10 text-center">
            <Button
              size="lg"
              onClick={onGiveFeedback}
              className="gap-2 bg-[#008751] hover:bg-[#008751]/90 text-white"
            >
              <MessageSquare className="h-4 w-4" />
              Partager mon expérience
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Votre témoignage sera publié après validation de notre équipe.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Carte témoignage
// ============================================================================

function TestimonialCard({ testimonial }: { testimonial: PublicTestimonial }) {
  const { authorName, authorRole, schoolName, city, rating, content, createdAt } =
    testimonial;

  // Initiales pour l'avatar
  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Date formatée
  const dateFmt = new Date(createdAt).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Étoiles */}
      <div className="flex items-center gap-0.5 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={
              star <= rating
                ? "h-4 w-4 fill-[#FCD116] text-[#FCD116]"
                : "h-4 w-4 text-muted-foreground/30"
            }
          />
        ))}
      </div>

      {/* Citation */}
      <blockquote className="text-sm text-foreground/90 leading-relaxed flex-1 mb-4">
        <Quote className="inline h-4 w-4 text-[#008751]/40 mr-1 -mt-1" />
        {content}
      </blockquote>

      {/* Auteur */}
      <div className="flex items-center gap-3 pt-4 border-t border-border/60">
        <div className="grid place-items-center h-10 w-10 rounded-full bg-gradient-to-br from-[#008751]/15 to-[#FCD116]/15 text-[#0D6EFD] text-sm font-bold shrink-0">
          {initials || "?"}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {authorName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {authorRole} · {schoolName}
            {city ? ` · ${city}` : ""}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
        {dateFmt}
      </p>
    </article>
  );
}
