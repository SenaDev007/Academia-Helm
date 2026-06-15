import type { Article } from '@/types/article';
import { BRAND } from '@/lib/brand';
import { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo';

/** Assets réels sous `public/images/` (évite les 404 en dev si les JPG dédiés n’existent pas). */
export const DEFAULT_ARTICLE_COVER = DEFAULT_OG_IMAGE_PATH;
export const DEFAULT_ARTICLE_AUTHOR_AVATAR = BRAND.logoPath;
export const BLOG_DEFAULT_COVER = '/images/articles/blog.svg';

const DEFAULT_COVER = DEFAULT_ARTICLE_COVER;
const DEFAULT_AUTHOR_AVATAR = DEFAULT_ARTICLE_AUTHOR_AVATAR;

export const articlesData: Article[] = [
  {
    id: 'gestion-etablissement-scolaire',
    slug: 'gestion-etablissement-scolaire',
    title: "Gestion d'établissement scolaire : passer d'une administration réactive à un pilotage maîtrisé",
    description:
      "Maîtrisez la gestion de votre école privée : organisation, finances, RH, examens et pilotage. Guide complet 2026.",
    coverImage: {
      url: '/images/articles/gestion-etablissement-scolaire.svg',
      alt: "Gestion d'établissement scolaire en Afrique de l'Ouest",
      credit: 'Academia Helm',
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
      ogImage: '/images/articles/gestion-etablissement-scolaire.svg',
    },
  },
  {
    id: 'gestion-scolaire',
    slug: 'gestion-scolaire',
    title: 'Gestion scolaire en Afrique : méthode et pilotage pour écoles privées',
    description:
      "Structurez recouvrement, bulletins, absentéisme et communication parents. Guide terrain pour direction d'école en Afrique de l'Ouest.",
    coverImage: {
      url: '/images/articles/gestion-scolaire.svg',
      alt: 'Gestion scolaire moderne pour écoles privées en Afrique de l’Ouest',
      credit: 'Academia Helm',
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
      ogImage: '/images/articles/gestion-scolaire.svg',
    },
  },
  {
    id: 'logiciel-ecole-afrique',
    slug: 'logiciel-ecole-afrique',
    title: 'Logiciel école Afrique : critères essentiels pour une digitalisation durable',
    description:
      "Mobile Money, offline, sécurité, vitesse mobile : les critères terrain pour choisir un logiciel d’école en Afrique de l’Ouest.",
    coverImage: {
      url: '/images/articles/logiciel-ecole-afrique.svg',
      alt: "Logiciel d'école en Afrique de l'Ouest : Mobile Money, bulletins et pilotage",
      credit: 'Academia Helm',
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
      ogImage: '/images/articles/logiciel-ecole-afrique.svg',
    },
  },
  {
    id: 'logiciel-gestion-ecole',
    slug: 'logiciel-gestion-ecole',
    title: 'Logiciel de gestion d’école : guide complet pour choisir et déployer',
    description:
      "Fonctionnalités clés, critères d’adoption, sécurité et ROI. Déployez un logiciel de gestion d’école en Afrique de l’Ouest en moins de 48h.",
    coverImage: {
      url: '/images/articles/logiciel-gestion-ecole.svg',
      alt: "Logiciel de gestion d'école : finance, scolarité, examens et RH",
      credit: 'Academia Helm',
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
      ogImage: '/images/articles/logiciel-gestion-ecole.svg',
    },
  },
];

export function getArticleBySlug(slug: string) {
  return articlesData.find((a) => a.slug === slug);
}

