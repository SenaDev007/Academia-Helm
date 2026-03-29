/**
 * Témoignages affichés sur la landing (contenu éditorial — pas d’agrégateur tiers).
 * À enrichir avec de vrais retours clients lorsque disponibles.
 */

export interface HelmReview {
  id: string;
  quote: string;
  author: string;
  role: string;
  org: string;
  /** 1–5, affichage étoiles décoratif */
  rating: number;
}

export const HELM_LANDING_REVIEWS: HelmReview[] = [
  {
    id: '1',
    quote:
      'Nous avons enfin une vision unique sur les inscriptions, les frais et le suivi des classes. L’équipe administrative respire.',
    author: 'Direction pédagogique',
    role: 'Proviseur adjoint',
    org: 'Lycée privé — région côtière',
    rating: 5,
  },
  {
    id: '2',
    quote:
      'Le module financier et les relances nous ont fait gagner un temps précieux sur la préparation de la rentrée.',
    author: 'Service comptable',
    role: 'Responsable financier',
    org: 'Groupe scolaire K–12',
    rating: 5,
  },
  {
    id: '3',
    quote:
      'ORION nous aide à prioriser les dossiers sensibles sans noyer l’équipe dans des tableaux interminables.',
    author: 'Secrétariat général',
    role: 'Secrétaire général',
    org: 'Collège & lycée',
    rating: 5,
  },
];
