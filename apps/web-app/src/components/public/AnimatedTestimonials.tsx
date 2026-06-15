'use client';

import { useState, useEffect, useCallback } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import { buildReviewsPublishedUrl } from '@/lib/reviews-api-url';

interface PublishedReview {
  id: string;
  authorName: string;
  authorRole: string | null;
  schoolName: string;
  city: string;
  photoUrl: string | null;
  rating: number;
  comment: string;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
}

interface ReviewsApiResponse {
  reviews: PublishedReview[];
  stats: {
    average: number;
    total: number;
    distribution: Record<number, number>;
  };
}

export default function AnimatedTestimonials() {
  const [reviews, setReviews] = useState<PublishedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Fetch real reviews from the API
  useEffect(() => {
    async function loadReviews() {
      try {
        const url = buildReviewsPublishedUrl();
        const res = await fetch(url);
        if (res.ok) {
          const data: ReviewsApiResponse = await res.json();
          setReviews(data.reviews || []);
        } else {
          setReviews([]);
        }
      } catch {
        setReviews([]);
      } finally {
        setIsLoading(false);
      }
    }
    loadReviews();
  }, []);

  const cardsPerView = 2;
  const totalGroups = Math.ceil(reviews.length / cardsPerView);

  useEffect(() => {
    if (isPaused || totalGroups <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % totalGroups);
        setIsAnimating(false);
      }, 300);
    }, 6000);

    return () => clearInterval(interval);
  }, [totalGroups, isPaused]);

  const goToPrevious = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + totalGroups) % totalGroups);
      setIsAnimating(false);
    }, 300);
  }, [totalGroups]);

  const goToNext = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % totalGroups);
      setIsAnimating(false);
    }, 300);
  }, [totalGroups]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // No reviews yet — show CTA to leave a review
  if (reviews.length === 0) {
    return (
      <div className={cn(
        bgColor('card'),
        'rounded-3xl border-2 border-dashed border-gray-300 p-8 md:p-12 text-center'
      )}>
        <div className="flex justify-center mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <AppIcon
              key={i}
              name="star"
              size="menu"
              className="text-gray-300 fill-transparent"
            />
          ))}
        </div>
        <p className={cn(typo('base'), textColor('primary'), 'font-semibold mb-2')}>
          Soyez le premier à partager votre expérience
        </p>
        <p className={cn(typo('small'), textColor('muted'), 'mb-6')}>
          Les avis vérifiés de nos utilisateurs apparaîtront ici dès qu'ils seront approuvés.
        </p>
        <a
          href="/avis"
          className={cn(
            'inline-flex items-center px-6 py-3 rounded-xl text-sm font-semibold text-white',
            'bg-blue-600 hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105'
          )}
        >
          Donner mon avis
          <AppIcon name="trends" size="action" className="ml-2 text-white" />
        </a>
      </div>
    );
  }

  // Determine role display info
  const getRoleBadge = (role: string | null) => {
    if (!role) return { label: 'Utilisateur', bgClass: 'bg-gray-100 text-gray-700 border-gray-300' };
    const r = role.toLowerCase();
    if (r.includes('direct') || r.includes('proviseur') || r.includes('principal'))
      return { label: 'Direction', bgClass: 'bg-blue-100 text-blue-700 border-blue-300' };
    if (r.includes('promot') || r.includes('fondateur'))
      return { label: 'Promoteur', bgClass: 'bg-purple-100 text-purple-700 border-purple-300' };
    if (r.includes('enseign') || r.includes('prof') || r.includes('maître'))
      return { label: 'Enseignant', bgClass: 'bg-green-100 text-green-700 border-green-300' };
    if (r.includes('parent') || r.includes('père') || r.includes('mère'))
      return { label: 'Parent', bgClass: 'bg-amber-100 text-amber-700 border-amber-300' };
    if (r.includes('élève') || r.includes('etudiant') || r.includes('student'))
      return { label: 'Élève', bgClass: 'bg-cyan-100 text-cyan-700 border-cyan-300' };
    if (r.includes('compt') || r.includes('caissier'))
      return { label: 'Comptable', bgClass: 'bg-indigo-100 text-indigo-700 border-indigo-300' };
    return { label: role, bgClass: 'bg-gray-100 text-gray-700 border-gray-300' };
  };

  const getAvatarGradient = (role: string | null) => {
    if (!role) return 'from-gray-600 via-gray-700 to-gray-800';
    const r = role.toLowerCase();
    if (r.includes('direct') || r.includes('proviseur') || r.includes('principal'))
      return 'from-blue-600 via-blue-700 to-blue-800';
    if (r.includes('promot') || r.includes('fondateur'))
      return 'from-purple-600 via-purple-700 to-purple-800';
    if (r.includes('enseign') || r.includes('prof'))
      return 'from-green-600 via-green-700 to-green-800';
    if (r.includes('parent'))
      return 'from-amber-500 via-amber-600 to-amber-700';
    if (r.includes('élève') || r.includes('etudiant'))
      return 'from-cyan-500 via-cyan-600 to-cyan-700';
    return 'from-gray-600 via-gray-700 to-gray-800';
  };

  return (
    <div className="relative w-full">
      {/* Navigation Buttons */}
      {totalGroups > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-0 md:left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-xl border-2 border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-600 transition-all duration-300 hover:scale-110 group"
            aria-label="Témoignage précédent"
          >
            <AppIcon name="chevronLeft" size="menu" className="text-gray-700 group-hover:text-blue-600 transition-colors" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-0 md:right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 md:w-14 md:h-14 bg-white rounded-full shadow-xl border-2 border-gray-200 flex items-center justify-center hover:bg-blue-50 hover:border-blue-600 transition-all duration-300 hover:scale-110 group"
            aria-label="Témoignage suivant"
          >
            <AppIcon name="chevronRight" size="menu" className="text-gray-700 group-hover:text-blue-600 transition-colors" />
          </button>
        </>
      )}

      {/* Testimonials Container - Horizontal Scroll */}
      <div className="w-full overflow-hidden px-4 md:px-8">
        <div
          className={cn(
            'flex transition-transform duration-500 ease-in-out',
            isAnimating && 'opacity-90'
          )}
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {/* Render all groups */}
          {Array.from({ length: totalGroups }).map((_, groupIndex) => {
            const startIdx = groupIndex * cardsPerView;
            const groupReviews = reviews.slice(startIdx, startIdx + cardsPerView);

            return (
              <div
                key={groupIndex}
                className={cn(
                  "min-w-full flex gap-6 md:gap-8 px-4 md:px-8",
                  "justify-center"
                )}
                style={{ flexShrink: 0 }}
              >
                {groupReviews.map((review) => {
                  const cardId = review.id;
                  const isTruncated = review.comment.length > 150;
                  const isExpanded = expandedCards.has(cardId);
                  const displayContent = isExpanded || !isTruncated
                    ? review.comment
                    : review.comment.substring(0, 150) + '...';
                  const badge = getRoleBadge(review.authorRole);

                  const handleReadMore = () => {
                    setExpandedCards(prev => new Set(prev).add(cardId));
                  };

                  const handleReadLess = () => {
                    setExpandedCards(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(cardId);
                      return newSet;
                    });
                  };

                  return (
                    <div
                      key={review.id}
                      className={cn(
                        groupReviews.length === 1
                          ? 'w-full max-w-sm md:max-w-md'
                          : 'w-full max-w-sm md:max-w-md flex-1',
                        bgColor('card'),
                        'rounded-3xl',
                        shadow.card,
                        'border-2 border-gray-200 p-5 md:p-8 hover:shadow-2xl hover:border-blue-600/30 transition-all duration-300 relative overflow-hidden group bg-white'
                      )}
                      onMouseEnter={() => setIsPaused(true)}
                      onMouseLeave={() => setIsPaused(false)}
                    >
                      {/* Modern Decorative Background */}
                      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-600/5 to-transparent rounded-bl-full"></div>
                      <div className="absolute bottom-0 left-0 w-36 h-36 bg-gradient-to-tr from-gold-500/5 to-transparent rounded-tr-full"></div>

                      <div className="relative z-10">
                        {/* Badge for role */}
                        <div className="mb-3">
                          <span className={cn(
                            'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-md border-2',
                            badge.bgClass
                          )}>
                            <AppIcon
                              name="user"
                              size="submenu"
                              className="mr-1.5"
                            />
                            {badge.label}
                          </span>
                        </div>

                        {/* Rating - Étoiles dorées dynamiques */}
                        <div className="flex items-center mb-4 gap-1">
                          {[...Array(5)].map((_, i) => (
                            <AppIcon
                              key={i}
                              name="star"
                              size="submenu"
                              className={cn(
                                "transition-all duration-300",
                                i < review.rating
                                  ? "text-gold-500 fill-gold-500 scale-110 drop-shadow-sm"
                                  : "text-gray-300 fill-transparent"
                              )}
                            />
                          ))}
                        </div>

                        {/* Content */}
                        <div className="mb-4">
                          <p className={cn(
                            typo('base'),
                            textColor('primary'),
                            'leading-relaxed italic text-sm md:text-base font-medium'
                          )}>
                            <span className="text-blue-600 text-xl font-bold leading-none mr-1">"</span>
                            {displayContent}
                            <span className="text-blue-600 text-xl font-bold leading-none ml-1">"</span>
                          </p>
                          {isTruncated && !isExpanded && (
                            <button
                              onClick={handleReadMore}
                              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-semibold underline transition-colors"
                            >
                              Lire la suite
                            </button>
                          )}
                          {isTruncated && isExpanded && (
                            <button
                              onClick={handleReadLess}
                              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-semibold underline transition-colors"
                            >
                              Voir moins
                            </button>
                          )}
                        </div>

                        {/* Author */}
                        <div className="flex items-center space-x-3 pt-4 border-t-2 border-gray-200">
                          {review.photoUrl ? (
                            <img
                              src={review.photoUrl}
                              alt={review.authorName}
                              className="w-12 h-12 rounded-lg object-cover border-2 border-white shadow-lg flex-shrink-0"
                            />
                          ) : (
                            <div className={cn(
                              'w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-lg border-2 border-white flex-shrink-0',
                              `bg-gradient-to-br ${getAvatarGradient(review.authorRole)}`
                            )}>
                              {review.authorName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn(typo('h4'), textColor('primary'), 'font-bold mb-0.5 text-base truncate')}>
                              {review.authorName}
                            </p>
                            {review.authorRole && (
                              <p className={cn(typo('base'), textColor('secondary'), 'font-semibold mb-0.5 text-xs truncate')}>
                                {review.authorRole}
                              </p>
                            )}
                            <p className={cn(typo('small'), textColor('muted'), 'text-xs truncate')}>
                              {review.schoolName}
                              {review.city && `, ${review.city}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Dots - Below the cards */}
      {totalGroups > 1 && (
        <div className="flex justify-center items-center space-x-3 mt-4">
          {Array.from({ length: totalGroups }).map((_, groupIndex) => (
            <button
              key={groupIndex}
              onClick={() => {
                setIsAnimating(true);
                setTimeout(() => {
                  setCurrentIndex(groupIndex);
                  setIsAnimating(false);
                }, 300);
              }}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                groupIndex === currentIndex
                  ? 'bg-blue-600 w-8 shadow-md'
                  : 'bg-gray-300 hover:bg-gray-400 w-2'
              )}
              aria-label={`Aller au groupe ${groupIndex + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
