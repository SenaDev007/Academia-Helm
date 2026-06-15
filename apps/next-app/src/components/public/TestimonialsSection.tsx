/**
 * Testimonials Section Component
 * 
 * Section témoignages pour la landing page
 * Affichage sobre et institutionnel
 */

'use client';

import { useEffect, useState } from 'react';
import type { Testimonial } from '@/types';
import { getPublishedTestimonials } from '@/services/testimonial.service';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface TestimonialsSectionProps {
  limit?: number;
  featured?: boolean;
}

export default function TestimonialsSection({ limit = 3, featured = true }: TestimonialsSectionProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTestimonials() {
      try {
        const data = await getPublishedTestimonials(featured, limit);
        setTestimonials(data);
      } catch (error) {
        // Erreur silencieuse : l'API n'est pas disponible, on n'affiche pas la section
        // Pas besoin de logger l'erreur car c'est attendu si le backend n'est pas démarré
        // console.warn('Testimonials API not available');
        setTestimonials([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadTestimonials();
  }, [featured, limit]);

  if (isLoading) {
    return (
      <section className={`py-16 ${bgColor('app')} px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <AppIcon name="view" size="menu" className="text-graphite-500 animate-spin" />
          </div>
        </div>
      </section>
    );
  }

  if (testimonials.length === 0) {
    return null; // Ne pas afficher la section s'il n'y a pas de témoignages
  }

  return (
    <div className="w-full">
        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className={cn(
                bgColor('card'),
                radius.card,
                shadow.card,
                'border-2 border-gray-200 p-8 hover:shadow-2xl hover:border-gold-500/30 transition-all duration-300 relative overflow-hidden group'
              )}
            >
              {/* Decorative corner accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gold-500/5 rounded-bl-full"></div>
              
              <div className="relative z-10">
                {/* Rating - Étoiles dorées dynamiques */}
                <div className="flex items-center mb-6 gap-1.5">
                {[...Array(5)].map((_, i) => (
                  <AppIcon
                    key={i}
                      name="star"
                    size="submenu"
                      className={cn(
                        "transition-all duration-300",
                        i < testimonial.rating 
                          ? "text-gold-500 fill-gold-500 scale-110 drop-shadow-sm" 
                          : "text-gray-300 fill-transparent"
                      )}
                  />
                ))}
              </div>

              {/* Content */}
                <p className={`${typo('base')} ${textColor('secondary')} leading-relaxed mb-8 italic text-base`}>
                "{testimonial.content}"
              </p>

              {/* Author */}
                <div className="flex items-center space-x-4 pt-6 border-t-2 border-gray-100">
                {testimonial.authorPhotoUrl ? (
                  <img
                    src={testimonial.authorPhotoUrl}
                    alt={testimonial.authorName}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gold-500/20 shadow-md"
                  />
                ) : (
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg border-2 border-gold-500/20`}>
                      <span className={`${typo('base')} text-white font-bold text-lg`}>
                      {testimonial.authorName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                  <div className="flex-1">
                    <p className={`${typo('base')} ${textColor('primary')} font-bold mb-1`}>
                    {testimonial.authorName}
                  </p>
                    <p className={`${typo('small')} ${textColor('secondary')} font-semibold mb-1`}>
                    {testimonial.authorFunction}
                  </p>
                    <p className={`${typo('small')} ${textColor('muted')}`}>
                    {testimonial.schoolName}
                    {testimonial.schoolCity && `, ${testimonial.schoolCity}`}
                  </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/testimonials"
            className={cn(
              'inline-flex items-center font-semibold transition-all duration-300 px-6 py-3 rounded-lg',
              'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl hover:scale-105'
            )}
          >
            Voir tous les témoignages
            <AppIcon name="trends" size="action" className="ml-2 text-white" />
          </Link>
        </div>
      </div>
  );
}

