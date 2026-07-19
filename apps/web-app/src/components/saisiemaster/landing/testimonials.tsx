"use client";

import { useEffect, useState, useRef } from "react";
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
 * Comportement :
 *  - Charge les témoignages publiés depuis l'API publique.
 *  - Si l'utilisateur est authentifié, un CTA "Donner mon avis" s'affiche
 *    et ouvre le modal de témoignage (géré par le parent via onGiveFeedback).
 *  - Affichage des cartes :
 *    * 0 témoignage  : si authentifié → CTA seul ; sinon → section masquée
 *    * 1 témoignage  : carte centrée au milieu (justify-center)
 *    * 2 témoignages : 2 cartes centrées au milieu (justify-center)
 *    * 3+ témoignages : carousel animé infini droite → gauche
 *
 * Animation : les cartes défilent horizontalement de droite à gauche en
 * continu. Au hover, l'animation se met en pause (respect de l'utilisateur).
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
  if (!loading && testimonials.length === 0 && !isAuthenticated) {
    return null;
  }

  return (
    <section id="temoignages" className="py-16 sm:py-24 bg-background overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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

        {/* Affichage des témoignages selon le nombre */}
        {loading ? (
          <LoadingSkeleton />
        ) : testimonials.length === 0 ? (
          // Authentifié mais aucun témoignage publié
          <EmptyState onGiveFeedback={onGiveFeedback} />
        ) : testimonials.length <= 2 ? (
          // 1 ou 2 témoignages → cartes centrées (justify-center)
          <div className="flex flex-wrap items-stretch justify-center gap-5 max-w-5xl mx-auto">
            {testimonials.map((t) => (
              <TestimonialCard
                key={t.id}
                testimonial={t}
                className="w-full sm:w-[420px]"
              />
            ))}
          </div>
        ) : (
          // 3+ témoignages → carousel animé infini droite → gauche
          <TestimonialsCarousel testimonials={testimonials} />
        )}

        {/* CTA — Donner mon avis (centré) */}
        {isAuthenticated && testimonials.length > 0 && (
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

      {/* Keyframes pour l'animation du carousel */}
      <style>{`
        @keyframes saisiemasterTestimonialScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

// ============================================================================
// Carousel animé (3+ témoignages)
// ============================================================================

function TestimonialsCarousel({ testimonials }: { testimonials: PublicTestimonial[] }) {
  // On duplique la liste pour créer un effet de boucle infinie
  // (quand le premier exemplaire disparaît à gauche, le second est déjà
  // en train d'apparaître à droite).
  const duplicated = [...testimonials, ...testimonials];

  // Durée de l'animation basée sur le nombre de cartes
  // (~8s par carte pour un défilement lisible)
  const duration = Math.max(20, testimonials.length * 8);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        // Masque les bords pour un fondu élégant
        maskImage:
          'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
      }}
    >
      <div
        className="flex gap-5 w-max"
        style={{
          animation: `saisiemasterTestimonialScroll ${duration}s linear infinite`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.animationPlayState = 'paused';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.animationPlayState = 'running';
        }}
      >
        {duplicated.map((t, idx) => (
          <TestimonialCard
            key={`${t.id}-${idx}`}
            testimonial={t}
            className="w-[340px] sm:w-[380px] shrink-0"
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Carte témoignage
// ============================================================================

function TestimonialCard({
  testimonial,
  className = '',
}: {
  testimonial: PublicTestimonial;
  className?: string;
}) {
  const { authorName, authorRole, schoolName, city, rating, content, createdAt } =
    testimonial;

  // Initiales pour l'avatar
  const initials = authorName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Date formatée
  const dateFmt = new Date(createdAt).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <article
      className={
        'rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col ' +
        className
      }
    >
      {/* Étoiles */}
      <div className="flex items-center justify-center gap-0.5 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={
              star <= rating
                ? 'h-4 w-4 fill-[#FCD116] text-[#FCD116]'
                : 'h-4 w-4 text-muted-foreground/30'
            }
          />
        ))}
      </div>

      {/* Citation */}
      <blockquote className="text-sm text-foreground/90 leading-relaxed flex-1 mb-4 text-center">
        <Quote className="inline h-4 w-4 text-[#008751]/40 mr-1 -mt-1" />
        {content}
      </blockquote>

      {/* Auteur — centré */}
      <div className="flex flex-col items-center gap-2 pt-4 border-t border-border/60">
        <div className="grid place-items-center h-10 w-10 rounded-full bg-gradient-to-br from-[#008751]/15 to-[#FCD116]/15 text-[#0D6EFD] text-sm font-bold shrink-0">
          {initials || '?'}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{authorName}</p>
          <p className="text-xs text-muted-foreground">
            {authorRole} · {schoolName}
            {city ? ` · ${city}` : ''}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 text-center">
        {dateFmt}
      </p>
    </article>
  );
}

// ============================================================================
// Skeleton loading
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="flex flex-wrap justify-center gap-5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-6 animate-pulse w-full sm:w-[380px]"
        >
          <div className="h-4 w-24 bg-muted rounded mb-3 mx-auto" />
          <div className="h-3 w-full bg-muted rounded mb-2" />
          <div className="h-3 w-5/6 bg-muted rounded mb-2" />
          <div className="h-3 w-4/6 bg-muted rounded mb-6" />
          <div className="h-3 w-32 bg-muted rounded mx-auto" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// État vide (authentifié, 0 témoignage)
// ============================================================================

function EmptyState({ onGiveFeedback }: { onGiveFeedback?: () => void }) {
  return (
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
      {onGiveFeedback && (
        <div className="mt-6">
          <Button
            size="lg"
            onClick={onGiveFeedback}
            className="gap-2 bg-[#008751] hover:bg-[#008751]/90 text-white"
          >
            <MessageSquare className="h-4 w-4" />
            Partager mon expérience
          </Button>
        </div>
      )}
    </div>
  );
}
