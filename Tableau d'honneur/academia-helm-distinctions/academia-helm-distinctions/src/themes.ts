import type { DistinctionCode, Level, Theme } from './types.js';

/**
 * Palettes par niveau et par type de distinction.
 * Maternel : couleurs vives et douces, une teinte par mention.
 * Primaire : bleus profonds et couleurs franches, contraste fort.
 * Secondaire : tons académiques sobres (bordeaux, bleu nuit, ardoise, vert forêt).
 */
export const THEMES: Record<DistinctionCode, Theme> = {
  // ---------- MATERNEL ----------
  MAT_OR: {
    code: 'MAT_OR', level: 'maternel', icon: 'Star',
    pattern: ['Sun', 'Cloud', 'Music', 'Apple', 'Rainbow', 'Sparkles'],
    palette: { primary: '#F59E0B', accent: '#F97316', tint: '#FFF8E1', ink: '#4A2F12', soft: '#FDE68A' },
    title: "Étoile d'Or", kicker: "Certificat d'encouragement", shortLabel: "Étoile d'Or",
    given: 'décerné à',
    message: "Bravo ! Tu brilles de mille feux. Tes efforts, ta joie d'apprendre et ta gentillesse font la fierté de toute l'école.",
  },
  MAT_ARGENT: {
    code: 'MAT_ARGENT', level: 'maternel', icon: 'Rocket',
    pattern: ['Cloud', 'Star', 'Telescope', 'Rocket', 'Sparkles', 'Sun'],
    palette: { primary: '#3B82F6', accent: '#06B6D4', tint: '#EAF4FF', ink: '#12355B', soft: '#BFDBFE' },
    title: "Étoile d'Argent", kicker: "Certificat d'encouragement", shortLabel: "Étoile d'Argent",
    given: 'décerné à',
    message: "Super travail ! Tu progresses chaque jour et tu rends ta classe plus joyeuse. Continue comme ça.",
  },
  MAT_BRONZE: {
    code: 'MAT_BRONZE', level: 'maternel', icon: 'Palette',
    pattern: ['Palette', 'Pencil', 'Shapes', 'Heart', 'Blocks', 'Puzzle'],
    palette: { primary: '#EF6C57', accent: '#F59E0B', tint: '#FFF0EA', ink: '#5A2217', soft: '#FECACA' },
    title: 'Étoile de Bronze', kicker: "Certificat d'encouragement", shortLabel: 'Étoile de Bronze',
    given: 'décerné à',
    message: "Bien joué ! Tu apprends avec courage et tu fais de beaux progrès. Ta prochaine étoile t'attend.",
  },
  MAT_EXPLO: {
    code: 'MAT_EXPLO', level: 'maternel', icon: 'Compass',
    pattern: ['Leaf', 'Bird', 'Flower', 'Fish', 'Cat', 'Sun'],
    palette: { primary: '#14B8A6', accent: '#84CC16', tint: '#E8FBF7', ink: '#0F3D3A', soft: '#99F6E4' },
    title: 'Petit Explorateur', kicker: "Certificat d'encouragement", shortLabel: 'Petit Explorateur',
    given: 'décerné à',
    message: "Tu découvres le monde avec curiosité. Chaque jour, tu apprends quelque chose de nouveau. Continue d'explorer !",
  },
  MAT_GRAD: {
    code: 'MAT_GRAD', level: 'maternel', icon: 'GraduationCap',
    pattern: ['Star', 'Sparkles', 'PartyPopper', 'Backpack', 'BookOpen', 'Heart'],
    palette: { primary: '#7C3AED', accent: '#EC4899', tint: '#F5EEFF', ink: '#2E1065', soft: '#DDD6FE' },
    title: 'Diplôme de fin de maternelle', kicker: 'Graduation', shortLabel: 'Graduation',
    given: 'est fièrement remis à',
    message: "Tu as terminé la maternelle avec joie et courage. Tu entres maintenant au CI avec toute notre fierté et tous nos encouragements. Le monde des grands t'attend !",
  },

  // ---------- PRIMAIRE ----------
  PRI_FELIC: {
    code: 'PRI_FELIC', level: 'primaire', icon: 'Trophy',
    pattern: ['BookOpen', 'Pencil', 'Ruler', 'Globe', 'Calculator'],
    palette: { primary: '#0B1F4B', accent: '#C9A227', tint: '#FFFDF6', ink: '#0B1F4B', soft: '#E9DDB0' },
    title: "Tableau d'Honneur", subtitle: 'avec Félicitations', shortLabel: 'Félicitations',
    given: 'Ce certificat est décerné à',
    message: "Résultats brillants, régularité et bonne conduite. Toute l'école est fière de toi.",
  },
  PRI_ENCOU: {
    code: 'PRI_ENCOU', level: 'primaire', icon: 'Medal',
    pattern: ['Calculator', 'Ruler', 'BookOpen', 'Globe', 'Pencil'],
    palette: { primary: '#1D4ED8', accent: '#94A3B8', tint: '#F5F9FF', ink: '#0F2A6B', soft: '#BFD3FF' },
    title: "Tableau d'Honneur", subtitle: 'avec Encouragements', shortLabel: 'Encouragements',
    given: 'Ce certificat est décerné à',
    message: "De bons résultats et un vrai sérieux. Continue sur cette voie, tu peux aller encore plus haut.",
  },
  PRI_HONNEUR: {
    code: 'PRI_HONNEUR', level: 'primaire', icon: 'Award',
    pattern: ['Library', 'Microscope', 'Leaf', 'Globe', 'BookOpen'],
    palette: { primary: '#0F766E', accent: '#B7791F', tint: '#F4FBF8', ink: '#0B3B37', soft: '#B7E4DC' },
    title: "Tableau d'Honneur", subtitle: 'de la période', shortLabel: 'Honneur',
    given: 'Ce certificat est décerné à',
    message: 'Des résultats solides et du sérieux en classe. Bravo pour ton travail.',
  },
  PRI_COURAGE: {
    code: 'PRI_COURAGE', level: 'primaire', icon: 'Flame',
    pattern: ['Rocket', 'Pencil', 'Star', 'Backpack', 'Sun'],
    palette: { primary: '#C2410C', accent: '#F59E0B', tint: '#FFF7ED', ink: '#5B1E07', soft: '#FED7AA' },
    title: 'Mention Courage', subtitle: 'pour ses efforts', shortLabel: 'Courage',
    given: 'Ce certificat est décerné à',
    message: 'Tu as travaillé avec courage. Chaque effort compte, poursuis avec confiance.',
  },
  PRI_GRAD: {
    code: 'PRI_GRAD', level: 'primaire', icon: 'GraduationCap',
    pattern: ['BookOpen', 'Library', 'Backpack', 'Globe', 'Star'],
    palette: { primary: '#4338CA', accent: '#D4AF37', tint: '#F7F7FF', ink: '#1E1B5E', soft: '#C7D2FE' },
    title: 'Certificat de fin de cycle primaire', subtitle: 'Passage en classe de 6e', shortLabel: 'Fin de cycle',
    given: 'Ce certificat est décerné à',
    message: 'A terminé avec succès le cycle primaire. Toute la communauté éducative lui souhaite plein succès au collège.',
  },

  // ---------- SECONDAIRE ----------
  SEC_FELIC: {
    code: 'SEC_FELIC', level: 'secondaire', icon: 'Crown',
    pattern: ['Landmark', 'Scale', 'Atom', 'Globe'],
    palette: { primary: '#6B1F2A', accent: '#B08D3C', tint: '#FBF7EE', ink: '#3B1016', soft: '#E7D9B5' },
    title: "Tableau d'Honneur", subtitle: 'Félicitations du Conseil de classe', shortLabel: 'Félicitations',
    given: 'Le Conseil de classe, réuni à l\'issue du {periode}, décerne à',
    message: "en reconnaissance de résultats exceptionnels, d'un travail régulier et d'une conduite exemplaire.",
  },
  SEC_ENCOU: {
    code: 'SEC_ENCOU', level: 'secondaire', icon: 'Medal',
    pattern: ['Sigma', 'Atom', 'Library', 'Globe'],
    palette: { primary: '#1E3A5F', accent: '#A67C37', tint: '#F6F8FB', ink: '#10233C', soft: '#CBD5E1' },
    title: "Tableau d'Honneur", subtitle: 'Encouragements du Conseil de classe', shortLabel: 'Encouragements',
    given: 'Le Conseil de classe, réuni à l\'issue du {periode}, décerne à',
    message: "en reconnaissance de bons résultats et d'un investissement sérieux dans son travail.",
  },
  SEC_HONNEUR: {
    code: 'SEC_HONNEUR', level: 'secondaire', icon: 'Award',
    pattern: ['FlaskConical', 'Microscope', 'Scale', 'Globe'],
    palette: { primary: '#334155', accent: '#9A5B2E', tint: '#F8F7F5', ink: '#1E293B', soft: '#D6D3D1' },
    title: "Tableau d'Honneur", subtitle: 'Mention Honneur', shortLabel: 'Honneur',
    given: 'Le Conseil de classe, réuni à l\'issue du {periode}, décerne à',
    message: "en reconnaissance de résultats satisfaisants et d'une attitude positive en classe.",
  },
  SEC_PROGRES: {
    code: 'SEC_PROGRES', level: 'secondaire', icon: 'TrendingUp',
    pattern: ['Sigma', 'Telescope', 'Atom', 'Library'],
    palette: { primary: '#0F5C63', accent: '#D1603D', tint: '#F3FAF9', ink: '#083A3F', soft: '#BDE3E1' },
    title: 'Prix du Progrès', subtitle: 'Distinction spéciale', shortLabel: 'Progrès',
    given: 'Le Conseil de classe décerne à',
    message: "pour une progression remarquable de ses résultats au cours de l'année. La preuve qu'on avance quand on persévère.",
  },
  SEC_ASSIDUITE: {
    code: 'SEC_ASSIDUITE', level: 'secondaire', icon: 'CalendarCheck',
    pattern: ['Library', 'BookOpen', 'Landmark', 'Globe'],
    palette: { primary: '#3F3D8F', accent: '#C99A2E', tint: '#F6F5FD', ink: '#1F1E4D', soft: '#D3D1F3' },
    title: "Prix d'Assiduité", subtitle: 'Distinction spéciale', shortLabel: 'Assiduité',
    given: "Le Conseil de classe décerne à",
    message: "pour une présence et une ponctualité exemplaires tout au long de la période. La régularité est la base de la réussite.",
  },
  SEC_COMPORTEMENT: {
    code: 'SEC_COMPORTEMENT', level: 'secondaire', icon: 'HeartHandshake',
    pattern: ['Scale', 'Landmark', 'Library', 'Globe'],
    palette: { primary: '#166534', accent: '#B45309', tint: '#F3FAF5', ink: '#0E3A20', soft: '#BFE3CB' },
    title: 'Prix de Comportement', subtitle: 'Distinction spéciale', shortLabel: 'Comportement',
    given: 'Le Conseil de classe décerne à',
    message: "pour son respect, son esprit d'équipe et son exemple auprès de ses camarades. L'intégrité fait la valeur d'un élève.",
  },
  SEC_GRAD: {
    code: 'SEC_GRAD', level: 'secondaire', icon: 'GraduationCap',
    pattern: ['Landmark', 'Library', 'Atom', 'Globe'],
    palette: { primary: '#2B1B4D', accent: '#C9A227', tint: '#FAF7FF', ink: '#1A0F33', soft: '#DCCFF2' },
    title: 'Certificat de fin de cycle', subtitle: 'Passage en classe supérieure', shortLabel: 'Fin de cycle',
    given: "L'établissement atteste que",
    message: "a accompli avec succès son cycle d'études et poursuit son parcours. Nos vœux l'accompagnent.",
  },
};

/** Thème de base utilisé pour le cadre du tableau collectif de chaque niveau */
export const BOARD_BASE: Record<Level, DistinctionCode> = {
  maternel: 'MAT_GRAD',
  primaire: 'PRI_FELIC',
  secondaire: 'SEC_FELIC',
};

export const BOARD_TITLE: Record<Level, string> = {
  maternel: 'Tableau des Étoiles',
  primaire: "Tableau d'Honneur",
  secondaire: "Tableau d'Honneur",
};

export const DEFAULT_SIGNERS: Record<Level, { director: string; teacher: string }> = {
  maternel: { director: 'La Directrice', teacher: "L'Éducatrice" },
  primaire: { director: 'Le Directeur', teacher: "L'Enseignant(e)" },
  secondaire: { director: "Le Chef d'Établissement", teacher: 'Le Professeur principal' },
};
