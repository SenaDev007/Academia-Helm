import type { Article } from '@/types/article';

const DEFAULT_COVER = '/images/articles/default-cover.jpg';
const DEFAULT_AUTHOR_AVATAR = '/images/team/academia-helm-team.png';

export const articlesData: Article[] = [
  {
    id: 'gestion-etablissement-scolaire',
    slug: 'gestion-etablissement-scolaire',
    title: "Gestion d'établissement scolaire : passer d'une administration réactive à un pilotage maîtrisé",
    description:
      "Maîtrisez la gestion de votre école privée : organisation, finances, RH, examens et pilotage. Guide complet 2026.",
    coverImage: {
      url: DEFAULT_COVER,
      alt: "Gestion d'établissement scolaire en Afrique de l'Ouest",
      credit: 'Unsplash',
    },
    author: {
      name: 'Équipe Academia Helm',
      role: 'Experts en gestion scolaire',
      avatar: DEFAULT_AUTHOR_AVATAR,
    },
    category: 'Gestion scolaire',
    tags: ['gestion scolaire', 'école privée', 'Afrique', 'pilotage'],
    publishedAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-03-30T10:00:00Z',
    readingTime: 8,
    status: 'published',
    seo: {
      title: "Gestion d'établissement scolaire : guide complet 2026 | Academia Helm",
      description: "Maîtrisez la gestion de votre école privée en Afrique de l'Ouest : process, KPI, recouvrement et contrôle.",
      canonical: 'https://academiahelm.com/gestion-etablissement-scolaire',
      ogImage: DEFAULT_COVER,
    },
  },
  {
    id: 'gestion-scolaire',
    slug: 'gestion-scolaire',
    title: 'Gestion scolaire en Afrique : méthode et pilotage pour écoles privées',
    description:
      "Structurez recouvrement, bulletins, absentéisme et communication parents. Guide terrain pour direction d'école en Afrique de l'Ouest.",
    coverImage: {
      url: DEFAULT_COVER,
      alt: 'Gestion scolaire moderne pour écoles privées en Afrique de l’Ouest',
      credit: 'Unsplash',
    },
    author: {
      name: 'Équipe Academia Helm',
      role: 'Experts en gestion scolaire',
      avatar: DEFAULT_AUTHOR_AVATAR,
    },
    category: 'Gestion scolaire',
    tags: ['gestion scolaire', 'recouvrement', 'bulletins', 'Afrique de l’Ouest'],
    publishedAt: '2026-01-18T08:00:00Z',
    updatedAt: '2026-03-30T10:00:00Z',
    readingTime: 9,
    status: 'published',
    seo: {
      title: 'Gestion scolaire en Afrique : guide direction 2026 | Academia Helm',
      description:
        "Gestion scolaire en Afrique de l'Ouest : recouvrement Mobile Money, bulletins, absentéisme et process. Méthode concrète.",
      canonical: 'https://academiahelm.com/gestion-scolaire',
      ogImage: DEFAULT_COVER,
    },
  },
  {
    id: 'logiciel-ecole-afrique',
    slug: 'logiciel-ecole-afrique',
    title: 'Logiciel école Afrique : critères essentiels pour une digitalisation durable',
    description:
      "Mobile Money, offline, sécurité, vitesse mobile : les critères terrain pour choisir un logiciel d’école en Afrique de l’Ouest.",
    coverImage: {
      url: DEFAULT_COVER,
      alt: "Logiciel d'école en Afrique de l'Ouest : Mobile Money, bulletins et pilotage",
      credit: 'Unsplash',
    },
    author: {
      name: 'Équipe Academia Helm',
      role: 'Experts en gestion scolaire',
      avatar: DEFAULT_AUTHOR_AVATAR,
    },
    category: 'Logiciel école',
    tags: ['logiciel école', 'digitalisation', 'Mobile Money', 'Afrique'],
    publishedAt: '2026-01-22T08:00:00Z',
    updatedAt: '2026-03-30T10:00:00Z',
    readingTime: 8,
    status: 'published',
    seo: {
      title: 'Logiciel école Afrique : critères de choix 2026 | Academia Helm',
      description:
        "Choisir un logiciel école en Afrique de l'Ouest : vitesse mobile, Mobile Money, bulletins, sécurité et déploiement rapide.",
      canonical: 'https://academiahelm.com/logiciel-ecole-afrique',
      ogImage: DEFAULT_COVER,
    },
  },
  {
    id: 'logiciel-gestion-ecole',
    slug: 'logiciel-gestion-ecole',
    title: 'Logiciel de gestion d’école : guide complet pour choisir et déployer',
    description:
      "Fonctionnalités clés, critères d’adoption, sécurité et ROI. Déployez un logiciel de gestion d’école en Afrique de l’Ouest en moins de 48h.",
    coverImage: {
      url: DEFAULT_COVER,
      alt: "Logiciel de gestion d'école : finance, scolarité, examens et RH",
      credit: 'Unsplash',
    },
    author: {
      name: 'Équipe Academia Helm',
      role: 'Experts en gestion scolaire',
      avatar: DEFAULT_AUTHOR_AVATAR,
    },
    category: "Logiciel de gestion d'école",
    tags: ['logiciel gestion école', 'finance', 'scolarité', 'examens'],
    publishedAt: '2026-01-25T08:00:00Z',
    updatedAt: '2026-03-30T10:00:00Z',
    readingTime: 10,
    status: 'published',
    seo: {
      title: "Logiciel de gestion d'école : guide 2026 | Academia Helm",
      description:
        "Logiciel de gestion d'école en Afrique de l'Ouest : finance, Mobile Money, bulletins, RH et pilotage. Méthode et critères.",
      canonical: 'https://academiahelm.com/logiciel-gestion-ecole',
      ogImage: DEFAULT_COVER,
    },
  },
];

export function getArticleBySlug(slug: string) {
  return articlesData.find((a) => a.slug === slug);
}

