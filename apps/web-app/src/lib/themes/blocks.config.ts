/**
 * ============================================================================
 * blocks.config.ts — Catalogue de variantes de composants CMS
 * ============================================================================
 *
 * 8 catégories de composants, chacune avec plusieurs variantes :
 *   - navbar   : barres de navigation (5 variantes)
 *   - hero     : sections héros (6 variantes)
 *   - footer   : bas de page (5 variantes)
 *   - border   : styles de bordures décoratives (6 variantes)
 *   - testimonial : blocs de témoignages (5 variantes)
 *   - text     : styles de texte / titres (6 variantes)
 *   - image    : présentations d'images (5 variantes)
 *   - video    : présentations vidéo (4 variantes)
 *
 * Chaque variante :
 *   - a un id, name, description
 *   - est rendue via un composant React dédié (dans /components/cms/blocks/)
 *   - s'adapte automatiquement au thème via les CSS vars (hsl(var(--xxx)))
 *   - accepte un override de couleurs custom (colorOverrides)
 *
 * Workflow utilisateur :
 *   1. L'utilisateur choisit D'ABORD un thème (page /platform/tenant-theme)
 *   2. Puis il ouvre la galerie de composants — toutes les variantes sont
 *      prévisualisées avec la palette du thème choisi
 *   3. S'il veut ajuster, il peut override les couleurs (primary, accent, etc.)
 *      sans changer de thème — le système applique ses couleurs custom
 *      par-dessus le thème
 * ============================================================================
 */

export type BlockCategory =
  | 'navbar' | 'hero' | 'footer' | 'border'
  | 'testimonial' | 'text' | 'image' | 'video';

export interface BlockVariant {
  id: string;
  category: BlockCategory;
  name: string;
  description: string;
  // Le composant React qui rend cette variante (chargé dynamiquement)
  componentKey: string;
}

export interface ColorOverride {
  primary?: string;       // HSL string "H S% L%"
  accent?: string;
  background?: string;
  foreground?: string;
  // ... autres override possibles
}

// === Catalogue des variantes par catégorie ===

export const BLOCK_VARIANTS: BlockVariant[] = [
  // ─── NAVBAR (5 variantes) ─────────────────────────────────────────────
  { id: 'navbar-classic',   category: 'navbar', name: 'Classique',         description: 'Logo à gauche, menu horizontal à droite', componentKey: 'NavbarClassic' },
  { id: 'navbar-centered',  category: 'navbar', name: 'Centré',            description: 'Logo centré, menu réparti des deux côtés', componentKey: 'NavbarCentered' },
  { id: 'navbar-transparent', category: 'navbar', name: 'Transparente',    description: 'Sans fond, par-dessus le hero — effet overlay', componentKey: 'NavbarTransparent' },
  { id: 'navbar-split',     category: 'navbar', name: 'Scindée',           description: 'Logo au centre, menu à gauche + CTA à droite', componentKey: 'NavbarSplit' },
  { id: 'navbar-minimal',   category: 'navbar', name: 'Minimale',          description: 'Logo + icône menu burger, ultra épuré', componentKey: 'NavbarMinimal' },

  // ─── HERO (6 variantes) ───────────────────────────────────────────────
  { id: 'hero-centered',    category: 'hero', name: 'Centré',              description: 'Titre + sous-titre + 2 boutons, alignement centré', componentKey: 'HeroCentered' },
  { id: 'hero-split',       category: 'hero', name: 'Deux colonnes',       description: 'Texte à gauche, image illustrative à droite', componentKey: 'HeroSplit' },
  { id: 'hero-fullscreen',  category: 'hero', name: 'Plein écran',         description: 'Image de fond plein écran + texte overlay', componentKey: 'HeroFullscreen' },
  { id: 'hero-gradient',    category: 'hero', name: 'Dégradé',             description: 'Fond dégradé primary→accent, sans image', componentKey: 'HeroGradient' },
  { id: 'hero-video-bg',    category: 'hero', name: 'Vidéo de fond',       description: 'Vidéo autoplay en arrière-plan + texte overlay', componentKey: 'HeroVideoBg' },
  { id: 'hero-typing',      category: 'hero', name: 'Texte animé',         description: 'Titre avec mots qui défilent (effet machine à écrire)', componentKey: 'HeroTyping' },

  // ─── FOOTER (5 variantes) ─────────────────────────────────────────────
  { id: 'footer-simple',    category: 'footer', name: 'Simple',            description: 'Logo + copyright, une ligne', componentKey: 'FooterSimple' },
  { id: 'footer-multi-col', category: 'footer', name: 'Multi-colonnes',    description: '4 colonnes : à propos, liens, contact, réseaux sociaux', componentKey: 'FooterMultiCol' },
  { id: 'footer-cta',       category: 'footer', name: 'Avec CTA',          description: 'Bandeau d\'appel à l\'action au-dessus du footer', componentKey: 'FooterCta' },
  { id: 'footer-newsletter', category: 'footer', name: 'Newsletter',       description: 'Inscription newsletter + liens en bas', componentKey: 'FooterNewsletter' },
  { id: 'footer-dark',      category: 'footer', name: 'Fond foncé',        description: 'Fond sidebar, contraste élevé', componentKey: 'FooterDark' },

  // ─── BORDER (6 variantes) ─────────────────────────────────────────────
  { id: 'border-solid',     category: 'border', name: 'Ligne pleine',      description: 'Bordure simple, couleur primary', componentKey: 'BorderSolid' },
  { id: 'border-gradient',  category: 'border', name: 'Dégradé',           description: 'Bordure dégradée primary → accent', componentKey: 'BorderGradient' },
  { id: 'border-dashed',    category: 'border', name: 'Pointillés',        description: 'Ligne en pointillés, style rétro', componentKey: 'BorderDashed' },
  { id: 'border-double',    category: 'border', name: 'Double ligne',      description: 'Deux lignes parallèles, style classique', componentKey: 'BorderDouble' },
  { id: 'border-glow',      category: 'border', name: 'Lueur',             description: 'Bordure avec effet de halo (box-shadow)', componentKey: 'BorderGlow' },
  { id: 'border-rounded',   category: 'border', name: 'Arrondie épaisse',  description: 'Bordure épaisse très arrondie, style badge', componentKey: 'BorderRounded' },

  // ─── TESTIMONIAL (5 variantes) ────────────────────────────────────────
  { id: 'testimonial-card', category: 'testimonial', name: 'Carte',        description: 'Carte avec citation + auteur + photo', componentKey: 'TestimonialCard' },
  { id: 'testimonial-quote', category: 'testimonial', name: 'Citation pleine', description: 'Grande citation centrée, sans carte', componentKey: 'TestimonialQuote' },
  { id: 'testimonial-grid', category: 'testimonial', name: 'Grille',       description: '3 témoignages côte à côte', componentKey: 'TestimonialGrid' },
  { id: 'testimonial-slider', category: 'testimonial', name: 'Carrousel',  description: 'Un témoignage à la fois, navigation par flèches', componentKey: 'TestimonialSlider' },
  { id: 'testimonial-video', category: 'testimonial', name: 'Vidéo',       description: 'Témoignage vidéo avec play button', componentKey: 'TestimonialVideo' },

  // ─── TEXT (6 variantes) ───────────────────────────────────────────────
  { id: 'text-heading-xl',  category: 'text', name: 'Titre XL',           description: 'Titre très grand, police serif, style éditorial', componentKey: 'TextHeadingXl' },
  { id: 'text-heading-accent', category: 'text', name: 'Titre accentué',  description: 'Titre avec mot en couleur accent', componentKey: 'TextHeadingAccent' },
  { id: 'text-paragraph',   category: 'text', name: 'Paragraphe',         description: 'Paragraphe standard, aligné justifié', componentKey: 'TextParagraph' },
  { id: 'text-lead',        category: 'text', name: 'Texte d\'intro',     description: 'Paragraphe d\'introduction, plus grand', componentKey: 'TextLead' },
  { id: 'text-list-styled', category: 'text', name: 'Liste stylée',       description: 'Liste à puces avec icônes personnalisées', componentKey: 'TextListStyled' },
  { id: 'text-blockquote',  category: 'text', name: 'Citation',           description: 'Bloc citation avec barre verticale accent', componentKey: 'TextBlockquote' },

  // ─── IMAGE (5 variantes) ──────────────────────────────────────────────
  { id: 'image-single',     category: 'image', name: 'Image simple',      description: 'Une image, légende optionnelle', componentKey: 'ImageSingle' },
  { id: 'image-grid-3',     category: 'image', name: 'Grille 3',          description: '3 images côte à côte, ratio uniforme', componentKey: 'ImageGrid3' },
  { id: 'image-mosaic',     category: 'image', name: 'Mosaïque',          description: 'Disposition asymétrique type Pinterest', componentKey: 'ImageMosaic' },
  { id: 'image-before-after', category: 'image', name: 'Avant / Après',   description: 'Deux images avec slider de comparaison', componentKey: 'ImageBeforeAfter' },
  { id: 'image-gallery',    category: 'image', name: 'Galerie vignettes', description: 'Grille de miniatures cliquables', componentKey: 'ImageGallery' },

  // ─── VIDEO (4 variantes) ──────────────────────────────────────────────
  { id: 'video-embed',      category: 'video', name: 'Intégrée',          description: 'Vidéo YouTube/Vimeo intégrée avec frame', componentKey: 'VideoEmbed' },
  { id: 'video-bg-section', category: 'video', name: 'Section vidéo',     description: 'Section entière avec vidéo autoplay mute en fond', componentKey: 'VideoBgSection' },
  { id: 'video-modal',      category: 'video', name: 'Modale',            description: 'Bouton play → ouvre vidéo en modal plein écran', componentKey: 'VideoModal' },
  { id: 'video-playlist',   category: 'video', name: 'Playlist',          description: 'Liste de vidéos avec miniature + titre', componentKey: 'VideoPlaylist' },
];

// === Helpers ===

export function getVariantsByCategory(category: BlockCategory): BlockVariant[] {
  return BLOCK_VARIANTS.filter((v) => v.category === category);
}

export function getVariantById(id: string): BlockVariant | undefined {
  return BLOCK_VARIANTS.find((v) => v.id === id);
}

export const BLOCK_CATEGORIES: { id: BlockCategory; label: string; description: string; icon: string }[] = [
  { id: 'navbar',       label: 'Barres de navigation', description: 'En-tête de votre site', icon: 'Menu' },
  { id: 'hero',         label: 'Sections héros',      description: 'Grande bannière d\'accueil', icon: 'LayoutTemplate' },
  { id: 'footer',       label: 'Bas de page',         description: 'Pied de page du site', icon: 'PanelBottom' },
  { id: 'border',       label: 'Bordures',            description: 'Styles de séparateurs décoratifs', icon: 'Square' },
  { id: 'testimonial',  label: 'Témoignages',         description: 'Avis des parents et élèves', icon: 'Quote' },
  { id: 'text',         label: 'Textes & titres',     description: 'Typographie des contenus', icon: 'Type' },
  { id: 'image',        label: 'Images',              description: 'Présentations visuelles', icon: 'Image' },
  { id: 'video',        label: 'Vidéos',              description: 'Intégrations multimédia', icon: 'Video' },
];
