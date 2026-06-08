'use client';

import { useState, useEffect } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { bgColor, textColor, typo, radius, shadow } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface TestimonialExample {
  content: string;
  authorName: string;
  authorFunction: string;
  schoolName: string;
  rating: number;
  type: 'director' | 'promoter';
}

const testimonialExamples: TestimonialExample[] = [
  {
    content: "Academia Helm a transformé notre gestion quotidienne. Tout est centralisé, accessible et sécurisé. Nous avons gagné un temps précieux sur les tâches administratives.",
    authorName: "Marie Adékambi",
    authorFunction: "Directrice",
    schoolName: "École Primaire Les Étoiles",
    rating: 5,
    type: 'director'
  },
  {
    content: "En tant que promoteur, j'ai besoin de visibilité sur tous mes établissements. Academia Helm me donne cette vision globale en temps réel, avec des rapports détaillés.",
    authorName: "Jean-Baptiste Assogba",
    authorFunction: "Promoteur",
    schoolName: "Groupe Scolaire Excellence",
    rating: 5,
    type: 'promoter'
  },
  {
    content: "La gestion des notes et examens est devenue un jeu d'enfant. Le système est intuitif et nos enseignants l'ont adopté rapidement. Les parents apprécient la transparence.",
    authorName: "Amélie Dossou",
    authorFunction: "Directrice",
    schoolName: "Collège Moderne",
    rating: 5,
    type: 'director'
  },
  {
    content: "L'aspect offline est crucial pour nous. Même sans internet, nous continuons à fonctionner normalement. C'est un avantage concurrentiel majeur.",
    authorName: "Yao Koffi",
    authorFunction: "Promoteur",
    schoolName: "Complexe Scolaire Horizon",
    rating: 5,
    type: 'promoter'
  },
  {
    content: "Les modules financiers sont complets et fiables. Nous avons une traçabilité parfaite de toutes nos opérations. La conformité est assurée.",
    authorName: "Chantal Gbédji",
    authorFunction: "Directrice",
    schoolName: "Lycée International",
    rating: 5,
    type: 'director'
  },
  {
    content: "ORION nous aide à prendre des décisions éclairées. Les alertes sont précieuses et nous permettent d'anticiper les problèmes avant qu'ils ne surviennent.",
    authorName: "Koffi Atchadé",
    authorFunction: "Promoteur",
    schoolName: "Groupe Éducatif Excellence Plus",
    rating: 5,
    type: 'promoter'
  },
  {
    content: "La synchronisation automatique entre nos établissements est remarquable. Nous gagnons un temps considérable sur la consolidation des données.",
    authorName: "Gisèle Amoussou",
    authorFunction: "Directrice",
    schoolName: "École Primaire Les Pionniers",
    rating: 5,
    type: 'director'
  },
  {
    content: "ATLAS nous guide pas à pas dans l'utilisation de la plateforme. Même nos équipes les moins technophiles s'y sont adaptées rapidement.",
    authorName: "Pierre Migan",
    authorFunction: "Promoteur",
    schoolName: "Complexe Éducatif Horizon",
    rating: 5,
    type: 'promoter'
  },
  {
    content: "La gestion des inscriptions en ligne a simplifié notre travail. Les parents peuvent s'inscrire à tout moment et nous suivons tout en temps réel.",
    authorName: "Véronique Sègbo",
    authorFunction: "Directrice",
    schoolName: "Collège Moderne Excellence",
    rating: 5,
    type: 'director'
  },
  {
    content: "Les rapports personnalisés nous permettent de présenter des données claires à notre conseil d'administration. C'est un outil de pilotage indispensable.",
    authorName: "Laurent Tchibozo",
    authorFunction: "Promoteur",
    schoolName: "Réseau Scolaire Vision 2030",
    rating: 5,
    type: 'promoter'
  },
  {
    content: "La sécurité des données est un point crucial pour nous. Academia Helm nous rassure avec son système de sauvegarde automatique et son mode offline.",
    authorName: "Sylvie Hounkpatin",
    authorFunction: "Directrice",
    schoolName: "École Secondaire Les Élites",
    rating: 5,
    type: 'director'
  },
];

export default function AnimatedTestimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Calculer le nombre de groupes (2 cartes par groupe)
  const cardsPerView = 2;
  const totalGroups = Math.ceil(testimonialExamples.length / cardsPerView);

  useEffect(() => {
    if (isPaused) return; // Ne pas créer d'intervalle si en pause

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % totalGroups);
        setIsAnimating(false);
      }, 300);
    }, 6000); // Change every 6 seconds (slower scrolling)

    return () => clearInterval(interval);
  }, [totalGroups, isPaused]);

  const goToPrevious = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + totalGroups) % totalGroups);
      setIsAnimating(false);
    }, 300);
  };

  const goToNext = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % totalGroups);
      setIsAnimating(false);
    }, 300);
  };

  return (
    <div className="relative w-full">
      {/* Navigation Buttons */}
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
            const groupTestimonials = testimonialExamples.slice(startIdx, startIdx + cardsPerView);
            
            return (
              <div
                key={groupIndex}
                className={cn(
                  "min-w-full flex gap-6 md:gap-8 px-4 md:px-8",
                  "justify-center"
                )}
                style={{ flexShrink: 0 }}
              >
                {groupTestimonials.map((testimonial, cardIndex) => {
                  // Vérifier si le texte est tronqué (plus de 150 caractères)
                  const cardId = startIdx + cardIndex;
                  const isTruncated = testimonial.content.length > 150;
                  const isExpanded = expandedCards.has(cardId);
                  const displayContent = isExpanded || !isTruncated
                    ? testimonial.content
                    : testimonial.content.substring(0, 150) + '...';

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
                    key={startIdx + cardIndex}
                    className={cn(
                      groupTestimonials.length === 1 
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
                      {/* Badge for type - Enhanced */}
                      <div className="mb-3">
                        <span className={cn(
                          'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-md',
                          testimonial.type === 'director' 
                            ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                            : 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                        )}>
                          <AppIcon 
                            name={testimonial.type === 'director' ? 'user' : 'building'} 
                            size="submenu" 
                            className="mr-1.5" 
                          />
                          {testimonial.type === 'director' ? 'Directeur' : 'Promoteur'}
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
                              i < testimonial.rating 
                                ? "text-gold-500 fill-gold-500 scale-110 drop-shadow-sm" 
                                : "text-gray-300 fill-transparent"
                            )}
                          />
                        ))}
                      </div>

                      {/* Content - Enhanced Typography */}
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

                      {/* Author - Modern Card Design */}
                      <div className="flex items-center space-x-3 pt-4 border-t-2 border-gray-200">
                        <div className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold text-white shadow-lg border-2 border-white flex-shrink-0',
                          testimonial.type === 'director'
                            ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800'
                            : 'bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800'
                        )}>
                          {testimonial.authorName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(typo('h4'), textColor('primary'), 'font-bold mb-0.5 text-base truncate')}>
                            {testimonial.authorName}
                          </p>
                          <p className={cn(typo('base'), textColor('secondary'), 'font-semibold mb-0.5 text-xs truncate')}>
                            {testimonial.authorFunction}
                          </p>
                          <p className={cn(typo('small'), textColor('muted'), 'text-xs truncate')}>
                            {testimonial.schoolName}
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
    </div>
  );
}

