/**
 * ============================================================================
 * default-cms-content.ts — Contenu par défaut du site institutionnel
 * ============================================================================
 *
 * Utilisé quand un tenant n'a pas encore configuré son CMS. Toutes les
 * sections sont visibles avec ces valeurs "Academia Helm" génériques.
 *
 * Règles de merge dans InstitutionalWebsite.tsx :
 *   - Si website?.xxx existe et est non vide → utiliser la vraie valeur
 *   - Sinon → utiliser DEFAULT_xxx
 *   - Sauf si website?.xxxIsActive === false (explicitement désactivé) → masquer
 *
 * Les collections (news, events, gallery, testimonials, faq) ont 1-2 items
 * de démo légers pour montrer comment ça rend.
 *
 * ⭐ IMAGES PAR DÉFAUT (2026-09) : un tenant sans images CMS reçoit désormais
 * des images d'école par défaut (campus, salle de classe, sport, laboratoire,
 * bibliothèque...) générées pour Academia Helm — le landing page n'est plus
 * un dégradé vide. Voir public/images/portal-defaults/.
 * ============================================================================
 */

// ─── Images par défaut du site institutionnel (photos d'école génériques) ─
// Sert de fallback visuel attractif pour les écoles qui n'ont pas encore
// configuré leurs images CMS. Les écoles peuvent les remplacer via le CMS.
export const DEFAULT_PORTAL_IMAGES = {
  hero: '/images/portal-defaults/hero-campus.png',
  presentation: '/images/portal-defaults/presentation-classroom.png',
  news: [
    '/images/portal-defaults/news-science.png',
    '/images/portal-defaults/news-sport.png',
    '/images/portal-defaults/news-graduation.png',
  ],
  gallery: [
    '/images/portal-defaults/gallery-campus.png',
    '/images/portal-defaults/gallery-classroom.png',
    '/images/portal-defaults/gallery-sport.png',
    '/images/portal-defaults/gallery-library.png',
  ],
} as const;

// ─── Configuration globale par défaut ─────────────────────────────────────

export const DEFAULT_WEBSITE_CONFIG = {
  // Hero
  heroTitle: 'Excellence éducative et accompagnement personnalisé',
  heroSubtitle: "Une école où chaque enfant grandit, apprend et s'épanouit dans un cadre bienveillant.",
  // Image de hero par défaut — photo d'un campus scolaire africain (Academia
  // Helm) ; remplacée dès que l'école configure heroImageUrl dans le CMS.
  heroImageUrl: DEFAULT_PORTAL_IMAGES.hero,
  heroCtaText: 'Pré-inscription',
  heroCtaUrl: '/public/pre-enrollment',
  heroIsActive: true,

  // ⭐ 2026-09-22 — Chiffres clés : PLUS de valeurs par défaut. « 500 élèves /
  //    30 enseignants / 95% réussite » étaient des chiffres INVENTÉS affichés
  //    sur tous les sites non configurés. Non configuré → bandeau masqué.
  //    Les vrais chiffres se saisissent via le CMS (onglet Chiffres clés).

  // Mot du promoteur
  promoterWord: "Chers parents, chers élèves, c'est avec une grande fierté que je vous accueille au sein de notre établissement. Depuis notre création, nous avons à cœur d'offrir une éducation d'excellence qui allie rigueur académique, épanouissement personnel et valeurs humaines. Notre mission est de former des citoyens responsables, créatifs et ouverts sur le monde, prêts à relever les défis de demain.",
  promoterName: 'Le Promoteur',
  promoterPhotoUrl: null,
  promoterIsActive: true,

  // Mot du directeur
  directorWord: "Bienvenue dans notre établissement. Chaque enfant est unique et mérite un accompagnement personnalisé. Notre équipe pédagogique dévouée s'engage à créer un environnement d'apprentissage stimulant, sécurisant et bienveillant. Ensemble, parents et équipe éducative, nous donnerons à vos enfants les meilleurs atouts pour réussir leur scolarité et construire leur avenir.",
  directorName: 'Le Directeur',
  directorPhotoUrl: null,
  directorIsActive: true,

  // Présentation
  presentationTitle: 'Présentation de notre établissement',
  presentationContent: "Notre établissement s'engage à offrir une éducation de qualité, alliant tradition et modernité. Nous proposons un cadre d'apprentissage stimulant où chaque élève peut développer son potentiel académique, artistique et sportif.\n\nAvec des classes à effectif réduit, un encadrement personnalisé et des équipements modernes, nous créons les conditions optimales pour la réussite de chaque élève.",
  presentationImageUrl: DEFAULT_PORTAL_IMAGES.presentation,
  presentationIsActive: true,

  // Admissions
  admissionsTitle: 'Comment nous rejoindre ?',
  admissionsContent: "Le processus d'admission se déroule en plusieurs étapes :\n\n1. Retrait du dossier d'inscription à l'accueil de l'établissement\n2. Constitution du dossier (bulletins, acte de naissance, photos, certificat de transfert le cas échéant)\n3. Dépôt du dossier complet au secrétariat\n4. Test d'admission et entretien (selon le niveau)\n5. Notification de la décision et inscription définitive\n\nLes inscriptions sont ouvertes toute l'année selon les places disponibles. Nous vous invitons à nous contacter pour vérifier la disponibilité dans le niveau souhaité.",
  admissionsIsActive: true,

  // Vie scolaire
  schoolLifeTitle: 'La vie dans notre école',
  schoolLifeContent: "Au-delà des apprentissages académiques, notre établissement offre une vie scolaire riche et stimulante :\n\n• Des clubs et activités parascolaires (théâtre, musique, science, débat)\n• Des sorties éducatives et voyages d'étude\n• Des événements culturels et sportifs tout au long de l'année\n• Un accompagnement personnalisé et un suivi régulier des élèves\n• Une cantine scolaire proposant des repas équilibrés\n\nNotre objectif : faire de l'école un lieu d'épanouissement où chaque enfant trouve sa place.",
  schoolLifeIsActive: true,

  // Footer
  footerAboutText: "Notre établissement est engagé depuis plus de 20 ans dans la formation des futures générations. Nous offrons une éducation d'excellence alliant rigueur académique, valeurs humaines et ouverture sur le monde.",
  footerCopyrightText: '© 2026 Établissement Scolaire. Tous droits réservés.',
  footerIsActive: true,

  // Contact
  contactEmail: 'contact@mon-ecole.com',
  contactPhone: '+229 00 00 00 00',
  contactAddress: 'Cotonou, Bénin',
  contactMapUrl: null,

  // SEO
  seoMetaTitle: null,
  seoMetaDescription: null,
  seoKeywords: null,
  seoOgImageUrl: null,

  // Réseaux sociaux
  socialLinks: {},

  // Paramètres
  isActive: true,
  aiEnabled: false,
  aiWelcomeMessage: "Bonjour ! Je suis l'assistant de l'établissement. Comment puis-je vous aider ?",
};

// ─── Collections — 2026-09-22 : contenus de démo factices retirés ────────
// ⭐ Les faux articles d'actualités, événements et témoignages (parents
//    fictifs) n'apparaissent plus sur les sites non configurés : chaque école
//    publie SES propres contenus via le CMS (onglets Actualités, Agenda,
//    Témoignages). Non configuré → état vide honnête.
// ⭐ La galerie et la FAQ conservent leurs valeurs génériques de plateforme
//    (visuels Academia Helm neutres / Q&R procédurales standard) : elles ne
//    formulent aucune affirmation propre à une école et sont remplacées dès
//    que l'école configure le CMS.
//
// ⭐ 2026-09-25 — Ajout des exports vides DEFAULT_NEWS_ARTICLES,
//    DEFAULT_EVENTS, DEFAULT_TESTIMONIALS (tableaux vides) pour la
//    compatibilité avec InstitutionalWebsite.tsx qui les importe.
//    Raison : InstitutionalWebsite.tsx fait du destructuring + `.length > 0`
//    pour décider d'afficher ou non la section — un tableau vide masque
//    proprement la section sans casser le build.

export const DEFAULT_NEWS_ARTICLES: any[] = [];

export const DEFAULT_EVENTS: any[] = [];

export const DEFAULT_TESTIMONIALS: any[] = [];

export const DEFAULT_GALLERY_ITEMS = [
  { id: 'demo-gallery-1', imageUrl: DEFAULT_PORTAL_IMAGES.gallery[0], caption: 'Campus principal', category: 'Campus', displayOrder: 0, isActive: true },
  { id: 'demo-gallery-2', imageUrl: DEFAULT_PORTAL_IMAGES.gallery[1], caption: 'Salles de classe modernes', category: 'Infrastructure', displayOrder: 1, isActive: true },
  { id: 'demo-gallery-3', imageUrl: DEFAULT_PORTAL_IMAGES.gallery[2], caption: 'Activités sportives', category: 'Sport', displayOrder: 2, isActive: true },
  { id: 'demo-gallery-4', imageUrl: DEFAULT_PORTAL_IMAGES.gallery[3], caption: 'Bibliothèque', category: 'Infrastructure', displayOrder: 3, isActive: true },
];


export const DEFAULT_FAQ_ITEMS = [
  {
    id: 'demo-faq-1',
    question: "Quels sont les frais de scolarité ?",
    answer: "Les frais de scolarité varient selon le niveau (maternelle, primaire, secondaire). Nous vous invitons à contacter le secrétariat au +229 00 00 00 00 ou par email pour obtenir la grille tarifaire complète et les modalités de paiement.",
    category: 'Inscriptions',
    displayOrder: 0,
    isActive: true,
  },
  {
    id: 'demo-faq-2',
    question: "Comment s'inscrire dans l'établissement ?",
    answer: "Le processus d'inscription se déroule en 5 étapes : retrait du dossier, constitution, dépôt, test d'admission et inscription définitive. Consultez la section « Admissions » pour plus de détails.",
    category: 'Inscriptions',
    displayOrder: 1,
    isActive: true,
  },
  {
    id: 'demo-faq-3',
    question: "Quels programmes proposez-vous ?",
    answer: "Notre établissement propose un programme complet allant de la maternelle au secondaire, conforme aux normes du ministère de l'Éducation. Nous offrons également des activités parascolaires variées (sport, arts, sciences).",
    category: 'Pédagogie',
    displayOrder: 2,
    isActive: true,
  },
  {
    id: 'demo-faq-4',
    question: "Proposez-vous un service de transport scolaire ?",
    answer: "Oui, nous proposons un service de transport scolaire couvrant plusieurs zones de la ville. Les tarifs et les itinéraires sont disponibles auprès du secrétariat.",
    category: 'Services',
    displayOrder: 3,
    isActive: true,
  },
];

// ─── Helper : merge defaults + real data ──────────────────────────────────

/**
 * Renvoie la valeur réelle si elle existe et est non vide, sinon le défaut.
 * Pour les chaînes, "non vide" = longueur > 0 après trim.
 */
export function withDefault<T>(real: T | null | undefined, fallback: T): T {
  if (real === null || real === undefined) return fallback;
  if (typeof real === 'string' && real.trim() === '') return fallback;
  if (Array.isArray(real) && real.length === 0) return fallback;
  return real;
}

/**
 * Détermine si une section doit être affichée.
 * - Si isActive est explicitement false → masquer
 * - Si isActive est true OU non défini (null/undefined) → afficher (avec défauts)
 */
export function shouldShowSection(isActive: boolean | null | undefined): boolean {
  return isActive !== false;
}
