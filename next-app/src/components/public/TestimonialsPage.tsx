/**
 * Testimonials Page Component
 * 
 * Page publique dédiée aux témoignages
 * Affichage sobre et institutionnel de tous les témoignages validés
 */

'use client';

import { useEffect, useState } from 'react';
import type { Testimonial } from '@/types';
import { getPublishedTestimonials } from '@/services/testimonial.service';
import PremiumHeader from '../layout/PremiumHeader';
import { Star, Quote, Loader, AlertCircle } from 'lucide-react';

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTestimonials() {
      try {
        const data = await getPublishedTestimonials(false, 50); // Tous les témoignages, max 50
        setTestimonials(data);
      } catch (err: any) {
        setError(err.message || 'Erreur lors du chargement des témoignages');
      } finally {
        setIsLoading(false);
      }
    }
    loadTestimonials();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <PremiumHeader />
      <div className="h-20" />

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-blue-900 mb-4">
              Témoignages
            </h1>
            <p className="text-lg text-graphite-700 max-w-3xl mx-auto">
              Découvrez ce que disent les directeurs et promoteurs d'établissements
              qui utilisent Academia Hub pour gérer leur direction scolaire.
            </p>
            <p className="text-sm text-graphite-500 mt-4">
              Tous les témoignages sont vérifiés et validés manuellement pour garantir leur authenticité.
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-8 h-8 animate-spin text-graphite-500" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Erreur</h3>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Testimonials Grid */}
          {!isLoading && !error && (
            <>
              {testimonials.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-graphite-700">
                    Aucun témoignage disponible pour le moment.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {testimonials.map((testimonial) => (
                    <div
                      key={testimonial.id}
                      className={`bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow ${
                        testimonial.featured ? 'border-2 border-gold-500' : 'border-gray-200'
                      }`}
                    >
                      {/* Featured Badge */}
                      {testimonial.featured && (
                        <div className="mb-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gold-500/10 text-gold-600 border border-gold-500/20">
                            Témoignage mis en avant
                          </span>
                        </div>
                      )}

                      {/* Quote Icon */}
                      <div className="mb-4">
                        <Quote className="w-8 h-8 text-gold-500" />
                      </div>

                      {/* Rating */}
                      <div className="flex items-center mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-5 h-5 ${
                              i < testimonial.rating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>

                      {/* Content */}
                      <p className="text-graphite-700 leading-relaxed mb-6 italic">
                        "{testimonial.content}"
                      </p>

                      {/* Author */}
                      <div className="flex items-center space-x-4 pt-4 border-t border-gray-100">
                        {testimonial.authorPhotoUrl ? (
                          <img
                            src={testimonial.authorPhotoUrl}
                            alt={testimonial.authorName}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {testimonial.authorName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-blue-900 text-sm truncate">
                            {testimonial.authorName}
                          </p>
                          <p className="text-xs text-graphite-700 truncate">
                            {testimonial.authorFunction}
                          </p>
                          <p className="text-xs text-graphite-500 truncate">
                            {testimonial.schoolName}
                            {testimonial.schoolCity && `, ${testimonial.schoolCity}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

