# Academia Helm, moteur de distinctions : code complet
Chaque bloc correspond à un fichier. Recrée l'arborescence indiquée, puis lance `npm install` et `npm run demo`.

## package.json

```json
{
  "name": "@yehi-or/helm-distinctions",
  "version": "1.0.0",
  "description": "Moteur de génération des tableaux d'honneur, certificats et diplômes pour Academia Helm",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc",
    "demo": "tsx src/demo.ts"
  },
  "dependencies": {
    "@fontsource/fredoka": "^5.1.0",
    "@fontsource/nunito": "^5.1.0",
    "@fontsource/lora": "^5.1.0",
    "@fontsource/playfair-display": "^5.1.0",
    "@sparticuz/chromium": "^131.0.0",
    "lucide-react": "^0.460.0",
    "pdf-lib": "^1.17.1",
    "puppeteer-core": "^23.10.0",
    "qrcode": "^1.5.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}

```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}

```

## src/types.ts

```ts
export type Level = 'maternel' | 'primaire' | 'secondaire';

export type DistinctionCode =
  | 'MAT_OR' | 'MAT_ARGENT' | 'MAT_BRONZE' | 'MAT_EXPLO' | 'MAT_GRAD'
  | 'PRI_FELIC' | 'PRI_ENCOU' | 'PRI_HONNEUR' | 'PRI_COURAGE' | 'PRI_GRAD'
  | 'SEC_FELIC' | 'SEC_ENCOU' | 'SEC_HONNEUR'
  | 'SEC_PROGRES' | 'SEC_ASSIDUITE' | 'SEC_COMPORTEMENT' | 'SEC_GRAD';

export type IconName =
  | 'Star' | 'Sparkles' | 'Rocket' | 'Palette' | 'Compass' | 'GraduationCap'
  | 'Trophy' | 'Medal' | 'Award' | 'BookOpen' | 'Pencil' | 'Heart' | 'Crown'
  | 'Flame' | 'TrendingUp' | 'CalendarCheck' | 'HeartHandshake' | 'Puzzle'
  | 'Shapes' | 'Rainbow' | 'Apple' | 'Cloud' | 'Sun' | 'Music' | 'Blocks'
  | 'Ruler' | 'Calculator' | 'Globe' | 'Backpack' | 'Library' | 'Microscope'
  | 'Atom' | 'FlaskConical' | 'Landmark' | 'Scale' | 'Sigma' | 'Telescope'
  | 'Leaf' | 'Bird' | 'Flower' | 'Fish' | 'Cat' | 'PartyPopper' | 'Hash';

export interface Palette {
  /** Couleur dominante (cadre, titres, médaille) */
  primary: string;
  /** Couleur d'accent (filets, sceau, détails) */
  accent: string;
  /** Fond du document */
  tint: string;
  /** Couleur du texte courant */
  ink: string;
  /** Teinte douce (bulles, bordures légères, lignes de tableau) */
  soft: string;
}

export interface Theme {
  code: DistinctionCode;
  level: Level;
  icon: IconName;
  pattern: IconName[];
  palette: Palette;
  title: string;
  kicker?: string;
  subtitle?: string;
  /** Phrase d'introduction avant le nom. Variables : {periode} {annee} */
  given: string;
  /** Message principal. Variables : {periode} {annee} */
  message: string;
  /** Libellé court utilisé dans le tableau collectif */
  shortLabel: string;
}

export interface SchoolInfo {
  name: string;
  /** URL http(s), chemin local ou data URI */
  logoUrl?: string;
  city?: string;
  directorName?: string;
  directorTitle?: string;
  directorSignatureUrl?: string;
  teacherName?: string;
  teacherTitle?: string;
  teacherSignatureUrl?: string;
}

export interface StudentInfo {
  fullName: string;
  className: string;
  photoUrl?: string;
}

export interface PeriodInfo {
  /** Ex : "1er trimestre" */
  label: string;
  /** Ex : "2025-2026" */
  schoolYear: string;
  /** Date d'émission ISO (AAAA-MM-JJ) */
  issuedOn: string;
}

export interface ResultsInfo {
  average?: number;
  /** Base de notation : 10, 20 ou 100 */
  base: number;
  rank?: number;
  classSize?: number;
  previousAverage?: number;
  previousLabel?: string;
}

export interface DistinctionInput {
  code: DistinctionCode;
  school: SchoolInfo;
  student: StudentInfo;
  period: PeriodInfo;
  results?: ResultsInfo;
  verification: { code: string; url: string };
  /** Remplace le message par défaut */
  customMessage?: string;
  /** Remplace la ligne de résultats */
  statOverride?: string;
}

export interface BoardRow {
  rank: number;
  fullName: string;
  average: number;
  code: DistinctionCode;
}

export interface BoardInput {
  level: Level;
  school: SchoolInfo;
  className: string;
  period: PeriodInfo;
  base: number;
  rows: BoardRow[];
}

export interface PreparedDistinction extends DistinctionInput {
  qrSvg: string;
}

```

## src/themes.ts

```ts
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

```

## src/rules.ts

```ts
import type { DistinctionCode, Level } from './types.js';

export interface Rule {
  code: DistinctionCode;
  /** Seuil minimum en pourcentage de la base de notation (0 à 100) */
  minPct: number;
}

/**
 * Règles par défaut, triées du seuil le plus haut au plus bas.
 * Chaque école peut les remplacer (table distinction_rules).
 * Maternel : le dernier palier est à 0, donc aucun enfant n'est exclu.
 * Primaire : en dessous de 50 %, aucun document public (message privé côté parent).
 * Secondaire : en dessous de 60 %, aucune mention.
 */
export const DEFAULT_RULES: Record<Level, Rule[]> = {
  maternel: [
    { code: 'MAT_OR', minPct: 90 },
    { code: 'MAT_ARGENT', minPct: 75 },
    { code: 'MAT_BRONZE', minPct: 60 },
    { code: 'MAT_EXPLO', minPct: 0 },
  ],
  primaire: [
    { code: 'PRI_FELIC', minPct: 80 },
    { code: 'PRI_ENCOU', minPct: 70 },
    { code: 'PRI_HONNEUR', minPct: 60 },
    { code: 'PRI_COURAGE', minPct: 50 },
  ],
  secondaire: [
    { code: 'SEC_FELIC', minPct: 80 },
    { code: 'SEC_ENCOU', minPct: 70 },
    { code: 'SEC_HONNEUR', minPct: 60 },
  ],
};

export const GRADUATION_CODE: Record<Level, DistinctionCode> = {
  maternel: 'MAT_GRAD',
  primaire: 'PRI_GRAD',
  secondaire: 'SEC_GRAD',
};

export function toPct(average: number, base: number): number {
  if (!base || base <= 0) throw new Error('La base de notation doit être positive');
  return (average / base) * 100;
}

/** Retourne la distinction liée à la moyenne, ou null si aucun palier n'est atteint */
export function resolveDistinction(
  level: Level,
  average: number,
  base: number,
  rules: Rule[] = DEFAULT_RULES[level],
): DistinctionCode | null {
  const pct = toPct(average, base);
  const sorted = [...rules].sort((a, b) => b.minPct - a.minPct);
  return sorted.find((r) => pct >= r.minPct)?.code ?? null;
}

export interface SpecialAwardInput {
  average?: number;
  previousAverage?: number;
  base: number;
  /** Nombre d'absences non justifiées sur la période */
  unjustifiedAbsences?: number;
  /** Nombre de retards sur la période */
  lateCount?: number;
  /** Note de conduite, en pourcentage de sa propre base (0 à 100) */
  conductPct?: number;
}

/** Prix spéciaux du secondaire, indépendants de la mention */
export function resolveSpecialAwards(i: SpecialAwardInput): DistinctionCode[] {
  const out: DistinctionCode[] = [];
  if (i.average != null && i.previousAverage != null) {
    const gain = toPct(i.average, i.base) - toPct(i.previousAverage, i.base);
    if (gain >= 10) out.push('SEC_PROGRES');
  }
  if (i.unjustifiedAbsences === 0 && (i.lateCount ?? 0) === 0) out.push('SEC_ASSIDUITE');
  if (i.conductPct != null && i.conductPct >= 90) out.push('SEC_COMPORTEMENT');
  return out;
}

```

## src/format.ts

```ts
const nf = (d: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtNumber(n: number, decimals = 2): string {
  return nf(decimals).format(n);
}

export function fmtAverage(average: number, base: number): string {
  return `${fmtNumber(average, 2)}/${base}`;
}

export function fmtPct(average: number, base: number): string {
  return `${Math.round((average / base) * 100)} %`;
}

export function fmtRank(rank: number, size?: number): string {
  const r = rank === 1 ? '1er' : `${rank}e`;
  return size ? `${r} sur ${size}` : r;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/** Ajuste la taille d'une police pour qu'un texte tienne dans une largeur donnée */
export function fitFont(text: string, maxWidthPx: number, maxSize: number, emPerChar = 0.6, minSize = 20): number {
  const size = maxWidthPx / Math.max(1, text.length * emPerChar);
  return Math.max(minSize, Math.min(maxSize, Math.floor(size)));
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

```

## src/icons.tsx

```tsx
import type { LucideIcon } from 'lucide-react';
import {
  Apple, Atom, Award, Backpack, Bird, BookOpen, Blocks, Calculator, CalendarCheck, Cat, Cloud,
  Compass, Crown, Fish, Flame, Flower, FlaskConical, Globe, GraduationCap, Hash, Heart,
  HeartHandshake, Landmark, Leaf, Library, Medal, Microscope, Music, PartyPopper, Palette, Pencil,
  Puzzle, Rainbow, Rocket, Ruler, Scale, Shapes, Sigma, Sparkles, Star, Sun, Telescope,
  TrendingUp, Trophy,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { IconName } from './types.js';

const ICONS: Record<IconName, LucideIcon> = {
  Star, Sparkles, Rocket, Palette, Compass, GraduationCap, Trophy, Medal, Award, BookOpen, Pencil,
  Heart, Crown, Flame, TrendingUp, CalendarCheck, HeartHandshake, Puzzle, Shapes, Rainbow, Apple,
  Cloud, Sun, Music, Blocks, Ruler, Calculator, Globe, Backpack, Library, Microscope, Atom,
  FlaskConical, Landmark, Scale, Sigma, Telescope, Leaf, Bird, Flower, Fish, Cat, PartyPopper, Hash,
};

export function Icon(props: { name: IconName; size?: number; stroke?: number; color?: string; style?: CSSProperties }) {
  const C = ICONS[props.name];
  return <C size={props.size ?? 24} strokeWidth={props.stroke ?? 2} color={props.color ?? 'currentColor'} style={props.style} />;
}

```

## src/fonts.ts

```ts
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Level } from './types.js';

const require = createRequire(import.meta.url);
const cache = new Map<string, string>();

interface Face { pkg: string; family: string; weight: number; style?: 'normal' | 'italic' }

const FACES: Record<Level, Face[]> = {
  maternel: [400, 500, 600, 700].map((w) => ({ pkg: 'fredoka', family: 'Fredoka', weight: w })),
  primaire: [
    ...[400, 600, 700, 800].map((w) => ({ pkg: 'nunito', family: 'Nunito', weight: w })),
    { pkg: 'nunito', family: 'Nunito', weight: 700, style: 'italic' as const },
    { pkg: 'nunito', family: 'Nunito', weight: 800, style: 'italic' as const },
  ],
  secondaire: [
    ...[400, 500, 600, 700].map((w) => ({ pkg: 'lora', family: 'Lora', weight: w })),
    ...[400, 500, 600].map((w) => ({ pkg: 'lora', family: 'Lora', weight: w, style: 'italic' as const })),
    ...[600, 700, 800].map((w) => ({ pkg: 'playfair-display', family: 'Playfair Display', weight: w })),
    ...[500, 700].map((w) => ({ pkg: 'playfair-display', family: 'Playfair Display', weight: w, style: 'italic' as const })),
  ],
};

function faceCss(f: Face): string {
  const style = f.style ?? 'normal';
  const key = `${f.pkg}-${f.weight}-${style}`;
  let css = cache.get(key);
  if (!css) {
    const pkgDir = path.dirname(require.resolve(`@fontsource/${f.pkg}/package.json`));
    const file = path.join(pkgDir, 'files', `${f.pkg}-latin-${f.weight}-${style}.woff2`);
    const b64 = readFileSync(file).toString('base64');
    css = `@font-face{font-family:'${f.family}';font-style:${style};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    cache.set(key, css);
  }
  return css;
}

/** CSS @font-face avec polices intégrées en base64 : aucun accès réseau au moment du rendu */
export function fontCss(levels: Level[]): string {
  return [...new Set(levels)].flatMap((l) => FACES[l].map(faceCss)).join('\n');
}

```

## src/assets.ts

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import type { DistinctionInput, PreparedDistinction } from './types.js';
import { THEMES } from './themes.js';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
};

/** Convertit une URL, un chemin local ou un data URI en data URI (rendu hors ligne et stable) */
export async function toDataUri(src?: string): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith('data:')) return src;
  try {
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return undefined;
      const type = res.headers.get('content-type') ?? MIME[path.extname(new URL(src).pathname).toLowerCase()] ?? 'image/png';
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    }
    const buf = await readFile(src);
    const type = MIME[path.extname(src).toLowerCase()] ?? 'image/png';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    // Une image manquante ne doit jamais bloquer la génération d'un certificat
    return undefined;
  }
}

export async function qrSvg(url: string, color: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: color, light: '#0000' },
  });
}

export async function prepare(input: DistinctionInput): Promise<PreparedDistinction> {
  const theme = THEMES[input.code];
  const [logoUrl, directorSignatureUrl, teacherSignatureUrl, photoUrl, svg] = await Promise.all([
    toDataUri(input.school.logoUrl),
    toDataUri(input.school.directorSignatureUrl),
    toDataUri(input.school.teacherSignatureUrl),
    toDataUri(input.student.photoUrl),
    qrSvg(input.verification.url, theme.palette.ink),
  ]);
  return {
    ...input,
    school: { ...input.school, logoUrl, directorSignatureUrl, teacherSignatureUrl },
    student: { ...input.student, photoUrl },
    qrSvg: svg,
  };
}

```

## src/security.ts

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DistinctionCode } from './types.js';

export interface VerificationPayload {
  schoolId: string;
  studentId: string;
  periodId: string;
  code: DistinctionCode;
  schoolYear: string;
}

/**
 * Code de vérification infalsifiable : HMAC-SHA256 tronqué, dérivé des données de l'émission.
 * Stocke le code dans la table distinctions et expose une page publique /verifier/[code].
 */
export function makeVerificationCode(secret: string, p: VerificationPayload): string {
  const mac = createHmac('sha256', secret)
    .update([p.schoolId, p.studentId, p.periodId, p.code, p.schoolYear].join('|'))
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  const year = p.schoolYear.slice(0, 4);
  return `AH-${year}-${mac.slice(0, 4)}-${mac.slice(4, 8)}-${mac.slice(8, 12)}`;
}

export function checkVerificationCode(secret: string, p: VerificationPayload, code: string): boolean {
  const expected = Buffer.from(makeVerificationCode(secret, p));
  const given = Buffer.from(code);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function verificationUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, '')}/verifier/${encodeURIComponent(code)}`;
}

```

## src/css.ts

```ts
/** Feuille de style commune et par niveau. Les couleurs viennent des variables CSS posées sur chaque page. */
export const BASE_CSS = `
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:297mm;background:#fff}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact;text-rendering:geometricPrecision}
.page{width:297mm;height:209.6mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}
.page:last-child{break-after:auto;page-break-after:auto}
.content{position:absolute;z-index:5;display:flex;flex-direction:column;align-items:center;text-align:center}
.school{display:flex;align-items:center;justify-content:center;gap:12px;text-transform:uppercase}
.school img{height:38px;width:auto;object-fit:contain}
.footer{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;align-items:flex-end}
.sig{width:250px;text-align:center}
.sig .simg{height:50px;display:flex;align-items:flex-end;justify-content:center}
.sig .simg img{max-height:50px;max-width:200px;object-fit:contain}
.sig .line{border-top:1.5px solid var(--primary);margin-top:4px}
.sig .lbl{font-size:14px;font-weight:600;margin-top:6px}
.sig .nm{font-size:13px;opacity:.75;margin-top:1px}
.verify{display:flex;flex-direction:column;align-items:center;gap:4px}
.qr svg{width:80px;height:80px;display:block}
.vcode{font-size:11px;letter-spacing:.08em;font-variant-numeric:tabular-nums;opacity:.85}
.place{font-size:12px;opacity:.75;white-space:nowrap}
.fr{position:absolute;inset:0}
.msg{text-wrap:balance}
`;

export const MATERNEL_CSS = `
.mat{background:var(--tint);font-family:'Fredoka',sans-serif;color:var(--ink)}
.mat .bubble{position:absolute;border-radius:50%;background:var(--soft);opacity:.5}
.mat .deco{position:absolute;color:var(--primary);opacity:.24}
.mat .frame{position:absolute;inset:22px;border:10px solid var(--primary);border-radius:46px}
.mat .frame::after{content:'';position:absolute;inset:10px;border:3px dashed var(--accent);border-radius:34px}
.mat .content{inset:60px 72px 64px}
.mat .school{font-size:14px;font-weight:600;letter-spacing:.16em}
.mat .badge-wrap{position:relative;margin-top:14px}
.mat .badge{width:128px;height:128px;border-radius:50%;background:var(--primary);display:grid;place-items:center;color:#fff;
  box-shadow:0 0 0 7px var(--tint),0 0 0 13px var(--accent),0 12px 0 13px rgba(0,0,0,.07)}
.mat .spark{position:absolute;color:var(--accent)}
.mat .kicker{margin-top:24px;font-size:15px;font-weight:500;letter-spacing:.24em;text-transform:uppercase}
.mat h1{font-size:60px;font-weight:700;line-height:1.05;color:var(--primary);margin-top:2px;
  text-shadow:0 3px 0 color-mix(in srgb,var(--ink) 14%,transparent)}
.mat .given{margin-top:4px;font-size:18px;opacity:.8}
.mat .name{margin-top:6px;font-weight:600;color:var(--ink);padding:0 30px 2px;border-bottom:4px dotted var(--accent);line-height:1.15}
.mat .class{margin-top:10px;font-size:20px}
.mat .msg{margin-top:12px;font-size:21px;max-width:720px;line-height:1.35}
.mat .score{margin-top:14px;display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;
  padding:6px 22px;border-radius:30px;font-size:17px;font-weight:600}
.mat .photo{position:absolute;z-index:6;left:118px;top:150px;width:150px;height:150px;border-radius:50%;object-fit:cover;
  border:8px solid var(--primary);box-shadow:0 0 0 6px var(--tint),0 0 0 10px var(--accent)}
.mat .mascot{position:absolute;z-index:6;right:118px;top:150px;width:150px;height:150px;border-radius:50%;background:var(--soft);
  display:grid;place-items:center;color:var(--primary);border:8px solid var(--primary);box-shadow:0 0 0 6px var(--tint),0 0 0 10px var(--accent)}
.mat .sig .line{border-top:2.5px dotted var(--primary)}
.mat .qr{background:#fff;padding:5px;border-radius:12px;border:3px solid var(--soft)}
`;

export const PRIMAIRE_CSS = `
.pri{background:var(--primary);font-family:'Nunito',sans-serif;color:var(--ink)}
.pri .panel{position:absolute;inset:20px;background:var(--tint)}
.pri .panel::before{content:'';position:absolute;inset:10px;border:3px solid var(--accent)}
.pri .panel::after{content:'';position:absolute;inset:19px;border:1px solid var(--primary)}
.pri .side{position:absolute;top:84px;bottom:84px;width:54px;display:flex;flex-direction:column;justify-content:space-around;align-items:center;color:var(--primary);opacity:.15}
.pri .side.l{left:50px}.pri .side.r{right:50px}
.pri .corner{position:absolute;width:62px;height:62px;border:0 solid var(--accent)}
.pri .corner.tl{top:36px;left:36px;border-width:4px 0 0 4px;border-radius:62px 0 0 0}
.pri .corner.tr{top:36px;right:36px;border-width:4px 4px 0 0;border-radius:0 62px 0 0}
.pri .corner.bl{bottom:36px;left:36px;border-width:0 0 4px 4px;border-radius:0 0 0 62px}
.pri .corner.br{bottom:36px;right:36px;border-width:0 4px 4px 0;border-radius:0 0 62px 0}
.pri .wm{position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);color:var(--primary);opacity:.04}
.pri .content{inset:56px 128px 52px}
.pri .school{font-size:13px;font-weight:800;letter-spacing:.2em}
.pri .medal{position:relative;z-index:2;margin-top:10px;width:104px;height:104px;border-radius:50%;
  background:radial-gradient(circle at 30% 28%,color-mix(in srgb,var(--accent) 55%,#fff),var(--accent) 65%);
  border:5px solid var(--primary);display:grid;place-items:center;color:var(--primary);
  box-shadow:0 0 0 5px var(--tint),0 0 0 8px var(--accent)}
.pri .tails{position:relative;z-index:1;display:flex;gap:8px;margin-top:-14px}
.pri .tail{width:28px;height:50px;background:var(--primary);clip-path:polygon(0 0,100% 0,100% 100%,50% 80%,0 100%)}
.pri .banner{position:relative;isolation:isolate;margin-top:8px;background:var(--primary);color:#fff;padding:8px 52px;
  font-weight:800;letter-spacing:.06em;text-transform:uppercase;line-height:1.15}
.pri .banner::before,.pri .banner::after{content:'';position:absolute;top:14px;width:48px;height:100%;z-index:-1;
  background:color-mix(in srgb,var(--primary) 72%,#000)}
.pri .banner::before{left:-36px;clip-path:polygon(0 0,100% 0,100% 100%,0 100%,22px 50%)}
.pri .banner::after{right:-36px;clip-path:polygon(0 0,100% 0,calc(100% - 22px) 50%,100% 100%,0 100%)}
.pri .sub{margin-top:8px;font-size:24px;font-weight:800;font-style:italic;color:color-mix(in srgb,var(--accent) 62%,#000)}
.pri .given{margin-top:10px;font-size:16px;font-weight:600}
.pri .name{margin-top:2px;font-weight:800;color:var(--primary);line-height:1.15;padding:0 20px 4px;border-bottom:2px solid var(--accent)}
.pri .class{margin-top:8px;font-size:18px;font-weight:600}
.pri .chips{display:flex;gap:14px;margin-top:10px}
.pri .chip{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid var(--soft);border-radius:999px;padding:5px 16px;font-weight:700;font-size:16px}
.pri .chip svg{color:var(--primary)}
.pri .msg{margin-top:10px;font-size:19px;font-weight:600;font-style:italic;max-width:760px;line-height:1.35}
.pri .qr{background:#fff;padding:5px;border-radius:8px;border:2px solid var(--soft)}
`;

export const SECONDAIRE_CSS = `
.sec{background:var(--tint);font-family:'Lora',serif;color:var(--ink)}
.sec .guil{position:absolute;left:0;top:0;width:100%;height:100%}
.sec .wm{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);color:var(--primary);opacity:.05}
.sec .f1{position:absolute;inset:20px;border:5px solid var(--primary)}
.sec .f2{position:absolute;inset:30px;border:1px solid var(--primary)}
.sec .f3{position:absolute;inset:36px;border:1.5px solid var(--accent)}
.sec .orn{position:absolute;width:13px;height:13px;background:var(--accent);transform:rotate(45deg);outline:3px solid var(--tint)}
.sec .content{inset:52px 96px 48px}
.sec .school{font-size:16px;font-weight:600;letter-spacing:.28em;color:var(--primary)}
.sec .year{font-size:13px;font-style:italic;margin-top:4px;opacity:.8}
.sec .div{display:flex;align-items:center;gap:10px;width:360px;margin-top:10px}
.sec .div i{flex:1;height:1px;background:var(--accent)}
.sec .div b{width:9px;height:9px;background:var(--accent);transform:rotate(45deg)}
.sec h1{font-family:'Playfair Display',serif;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primary);margin-top:26px;line-height:1.1}
.sec .sub{font-family:'Playfair Display',serif;font-style:italic;font-weight:500;font-size:27px;color:color-mix(in srgb,var(--accent) 60%,#000);margin-top:6px}
.sec .given{font-style:italic;font-size:18px;margin-top:24px}
.sec .name{font-family:'Playfair Display',serif;font-style:italic;font-weight:700;color:var(--primary);margin-top:16px;line-height:1.15;padding:0 26px 4px;border-bottom:1.5px solid var(--accent)}
.sec .class{font-size:19px;margin-top:12px}
.sec .msg{font-style:italic;font-size:19px;margin-top:18px;max-width:860px;line-height:1.45}
.sec .stat{white-space:pre;margin-top:22px;font-weight:600;font-size:16px;letter-spacing:.04em;color:color-mix(in srgb,var(--accent) 60%,#000)}
.sec .seal{position:relative;width:104px;height:104px;border-radius:50%;display:grid;place-items:center;color:var(--tint);margin-bottom:2px;
  background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 55%,#fff),var(--accent) 60%,color-mix(in srgb,var(--accent) 70%,#000));
  border:2px solid var(--primary);box-shadow:0 2px 0 rgba(0,0,0,.12)}
.sec .seal::before{content:'';position:absolute;inset:7px;border:2px dashed var(--tint);border-radius:50%}
.sec .seal::after{content:'';position:absolute;inset:14px;border:1.5px solid color-mix(in srgb,var(--tint) 80%,transparent);border-radius:50%}
.sec .qrcorner{position:absolute;left:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:3px}
.sec .qrcorner .qr svg{width:62px;height:62px}
.sec .qrcorner .vcode{font-size:8.5px}
.sec .sig .lbl{font-style:italic;font-weight:500}
.sec .sig{width:230px}
.sec .footer{padding:0 150px 0 150px}
`;

export const BOARD_CSS = `
.board .content{align-items:stretch;text-align:left}
.board .head{display:flex;flex-direction:column;align-items:center;text-align:center}
.board h1{line-height:1.1}
.board .sub2{margin-top:4px;font-size:18px;opacity:.85}
.board table{width:100%;border-collapse:separate;border-spacing:0 5px;margin-top:12px}
.board th{background:var(--primary);color:#fff;padding:9px 16px;font-size:15px;letter-spacing:.06em;text-transform:uppercase;text-align:left}
.board th:first-child,.board td:first-child{border-radius:12px 0 0 12px;width:84px;text-align:center}
.board th:last-child,.board td:last-child{border-radius:0 12px 12px 0;text-align:center;width:250px}
.board th.num,.board td.num{text-align:center;width:170px}
.board td{padding:7px 16px;background:color-mix(in srgb,var(--soft) 38%,#fff);font-size:19px;font-weight:600}
.board td.rk{font-weight:800;font-size:20px}
.board td.rk svg{vertical-align:middle}
.board .pill{display:inline-flex;align-items:center;gap:7px;padding:4px 14px;border-radius:999px;color:#fff;font-weight:700;font-size:14px;background:var(--pc)}
.board .foot{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:13px;opacity:.75}
.board.mat .content{inset:60px 100px 50px}
.board.pri .content{inset:56px 120px 50px}
.board.sec .content{inset:58px 110px 50px}
.board.mat h1{font-size:46px;font-weight:700;color:var(--primary)}
.board.pri h1{font-size:44px;font-weight:800;color:var(--primary);text-transform:uppercase;letter-spacing:.05em}
.board.sec h1{font-family:'Playfair Display',serif;font-size:44px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.06em}
.board.sec .sub2{font-style:italic}
.board.sec td{font-weight:500}
`;

export const ALL_CSS = [BASE_CSS, MATERNEL_CSS, PRIMAIRE_CSS, SECONDAIRE_CSS, BOARD_CSS].join('\n');

```

## src/templates/shared.tsx

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '../icons.js';
import { DEFAULT_SIGNERS } from '../themes.js';
import { fmtDate } from '../format.js';
import type { IconName, Level, Palette, PreparedDistinction, SchoolInfo, Theme } from '../types.js';

export interface CertProps { d: PreparedDistinction; theme: Theme }

export function vars(p: Palette): CSSProperties {
  return {
    '--primary': p.primary, '--accent': p.accent, '--tint': p.tint, '--ink': p.ink, '--soft': p.soft,
  } as CSSProperties;
}

export function SchoolHeader({ school }: { school: SchoolInfo }) {
  return (
    <div className="school">
      {school.logoUrl ? <img src={school.logoUrl} alt="" /> : null}
      <span>{school.name}</span>
    </div>
  );
}

export function Signature({ label, name, img }: { label: string; name?: string; img?: string }) {
  return (
    <div className="sig">
      <div className="simg">{img ? <img src={img} alt="" /> : null}</div>
      <div className="line" />
      <div className="lbl">{label}</div>
      {name ? <div className="nm">{name}</div> : null}
    </div>
  );
}

export function VerifyBlock({ d, withPlace = true }: { d: PreparedDistinction; withPlace?: boolean }) {
  const place = d.school.city ? `Fait à ${d.school.city}, le ${fmtDate(d.period.issuedOn)}` : `Le ${fmtDate(d.period.issuedOn)}`;
  return (
    <div className="verify">
      <div className="qr" dangerouslySetInnerHTML={{ __html: d.qrSvg }} />
      <div className="vcode">{d.verification.code}</div>
      {withPlace ? <div className="place">{place}</div> : null}
    </div>
  );
}

export function Footer({ d, level, center }: { d: PreparedDistinction; level: Level; center?: ReactNode }) {
  const defaults = DEFAULT_SIGNERS[level];
  return (
    <div className="footer">
      <Signature label={d.school.directorTitle ?? defaults.director} name={d.school.directorName} img={d.school.directorSignatureUrl} />
      {center ?? <VerifyBlock d={d} />}
      <Signature label={d.school.teacherTitle ?? defaults.teacher} name={d.school.teacherName} img={d.school.teacherSignatureUrl} />
    </div>
  );
}

const MAT_SPOTS: [number, number, number, number][] = [
  [70, 70, 54, -14], [190, 46, 38, 10], [62, 210, 40, 12], [900, 62, 50, 14], [1010, 176, 38, -10], [836, 44, 36, 8],
  [70, 520, 48, 10], [182, 604, 38, -12], [952, 530, 52, -10], [1022, 614, 38, 12],
];
const BUBBLES: [number, number, number][] = [
  [-60, -60, 240], [930, -90, 260], [-80, 600, 260], [940, 590, 250], [560, -40, 90], [480, 720, 110],
];

/** Décor et cadre propres à chaque niveau, partagés entre certificats et tableaux collectifs */
export function LevelFrame({ level, pattern, watermark }: { level: Level; pattern: IconName[]; watermark: IconName }) {
  if (level === 'maternel') {
    return (
      <div className="fr">
        {BUBBLES.map(([l, t, s], i) => (
          <div key={i} className="bubble" style={{ left: l, top: t, width: s, height: s }} />
        ))}
        {MAT_SPOTS.map(([l, t, s, r], i) => (
          <div key={i} className="deco" style={{ left: l, top: t, transform: `rotate(${r}deg)` }}>
            <Icon name={pattern[i % pattern.length]} size={s} stroke={2.2} />
          </div>
        ))}
        <div className="frame" />
      </div>
    );
  }
  if (level === 'primaire') {
    const left = pattern.slice(0, 5);
    const right = [...pattern].reverse().slice(0, 5);
    return (
      <div className="fr">
        <div className="panel" />
        <div className="wm"><Icon name={watermark} size={460} stroke={1} /></div>
        <div className="side l">{left.map((n, i) => <Icon key={i} name={n} size={38} stroke={1.8} />)}</div>
        <div className="side r">{right.map((n, i) => <Icon key={i} name={n} size={38} stroke={1.8} />)}</div>
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      </div>
    );
  }
  return (
    <div className="fr">
      <svg className="guil" viewBox="0 0 1123 794" width="1123" height="794" aria-hidden="true">
        {Array.from({ length: 34 }, (_, i) => {
          const r = 44 + i * 9;
          return <circle key={i} cx="561.5" cy="413" r={r} fill="none" stroke="var(--accent)" strokeWidth="0.9" strokeOpacity={Math.max(0.03, 0.26 * (1 - r / 360))} />;
        })}
      </svg>
      <div className="wm"><Icon name={watermark} size={440} stroke={0.8} /></div>
      <div className="f1" /><div className="f2" /><div className="f3" />
      <div className="orn" style={{ left: 29.5, top: 29.5 }} />
      <div className="orn" style={{ right: 29.5, top: 29.5 }} />
      <div className="orn" style={{ left: 29.5, bottom: 29.5 }} />
      <div className="orn" style={{ right: 29.5, bottom: 29.5 }} />
    </div>
  );
}

```

## src/templates/Maternel.tsx

```tsx
import { Icon } from '../icons.js';
import { fill, fitFont, fmtPct } from '../format.js';
import { Footer, LevelFrame, SchoolHeader, vars, type CertProps } from './shared.js';

export function Maternel({ d, theme }: CertProps) {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const stat = d.statOverride ?? (r?.average != null ? `Acquis de la période : ${fmtPct(r.average, r.base)}` : undefined);
  const isGrad = d.code === 'MAT_GRAD';
  const name = d.student.fullName;

  return (
    <section className="page mat" style={vars(theme.palette)}>
      <LevelFrame level="maternel" pattern={theme.pattern} watermark={theme.icon} />
      {d.student.photoUrl ? (
        <>
          <img className="photo" src={d.student.photoUrl} alt="" />
          <div className="mascot"><Icon name={theme.pattern[0]} size={72} stroke={2} /></div>
        </>
      ) : null}
      <div className="content">
        <SchoolHeader school={d.school} />
        <div className="badge-wrap">
          <div className="badge"><Icon name={theme.icon} size={74} stroke={2.2} /></div>
          <span className="spark" style={{ left: -54, top: 4 }}><Icon name="Sparkles" size={34} /></span>
          <span className="spark" style={{ right: -52, top: 0 }}><Icon name="Star" size={30} stroke={2.4} /></span>
          <span className="spark" style={{ left: -84, top: 62 }}><Icon name="Star" size={20} stroke={2.4} /></span>
          <span className="spark" style={{ right: -80, top: 66 }}><Icon name="Sparkles" size={24} /></span>
        </div>
        {theme.kicker ? <div className="kicker">{theme.kicker}</div> : null}
        <h1 style={{ fontSize: fitFont(theme.title, 820, 60, 0.6, 40) }}>{theme.title}</h1>
        <div className="given">{fill(theme.given, vals)}</div>
        <div className="name" style={{ fontSize: fitFont(name, 780, 50, 0.56, 30) }}>{name}</div>
        <div className="class">
          {isGrad ? `${d.student.className}, année scolaire ${d.period.schoolYear}` : `${d.student.className}, ${d.period.label}, année scolaire ${d.period.schoolYear}`}
        </div>
        <p className="msg">{d.customMessage ?? fill(theme.message, vals)}</p>
        {stat ? (
          <div className="score"><Icon name="Star" size={18} stroke={2.4} />{stat}</div>
        ) : isGrad ? (
          <div className="score"><Icon name="GraduationCap" size={18} stroke={2.4} />Passage en classe de CI</div>
        ) : null}
        <Footer d={d} level="maternel" />
      </div>
    </section>
  );
}

```

## src/templates/Primaire.tsx

```tsx
import { Icon } from '../icons.js';
import { fill, fitFont, fmtAverage, fmtRank } from '../format.js';
import { Footer, LevelFrame, SchoolHeader, vars, type CertProps } from './shared.js';

export function Primaire({ d, theme }: CertProps) {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const name = d.student.fullName;
  const isGrad = d.code === 'PRI_GRAD';

  return (
    <section className="page pri" style={vars(theme.palette)}>
      <LevelFrame level="primaire" pattern={theme.pattern} watermark={theme.icon} />
      <div className="content">
        <SchoolHeader school={d.school} />
        <div className="medal"><Icon name={theme.icon} size={56} stroke={2.2} /></div>
        <div className="tails"><div className="tail" /><div className="tail" /></div>
        <div className="banner" style={{ fontSize: fitFont(theme.title, 620, 38, 0.66, 24) }}>{theme.title}</div>
        {theme.subtitle ? <div className="sub">{theme.subtitle}</div> : null}
        <div className="given">{fill(theme.given, vals)}</div>
        <div className="name" style={{ fontSize: fitFont(name, 780, 50, 0.6, 30) }}>{name}</div>
        <div className="class">
          {isGrad ? `${d.student.className}, année scolaire ${d.period.schoolYear}` : `${d.student.className}, ${d.period.label}, année scolaire ${d.period.schoolYear}`}
        </div>
        <div className="chips">
          {d.statOverride ? (
            <div className="chip"><Icon name="Star" size={18} />{d.statOverride}</div>
          ) : (
            <>
              {r?.average != null ? (
                <div className="chip"><Icon name="Calculator" size={18} />{isGrad ? 'Moyenne annuelle' : 'Moyenne'} : {fmtAverage(r.average, r.base)}</div>
              ) : null}
              {r?.rank != null ? (
                <div className="chip"><Icon name="Hash" size={18} />Rang : {fmtRank(r.rank, r.classSize)}</div>
              ) : null}
            </>
          )}
        </div>
        <p className="msg">{d.customMessage ?? fill(theme.message, vals)}</p>
        <Footer d={d} level="primaire" />
      </div>
    </section>
  );
}

```

## src/templates/Secondaire.tsx

```tsx
import { Icon } from '../icons.js';
import { fill, fitFont, fmtAverage, fmtDate, fmtNumber, fmtRank } from '../format.js';
import { Footer, LevelFrame, SchoolHeader, VerifyBlock, vars, type CertProps } from './shared.js';

export function Secondaire({ d, theme }: CertProps) {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const name = d.student.fullName;
  const isGrad = d.code === 'SEC_GRAD';

  let stat = d.statOverride;
  if (!stat && r?.average != null) {
    if (d.code === 'SEC_PROGRES' && r.previousAverage != null) {
      const gain = (r.average - r.previousAverage) / r.base * 20;
      stat = `${r.previousLabel ?? 'Période précédente'} : ${fmtAverage(r.previousAverage, r.base)}   |   ${d.period.label} : ${fmtAverage(r.average, r.base)}   |   +${fmtNumber(gain, 1)} pts sur 20`;
    } else if (isGrad) {
      stat = `Moyenne annuelle : ${fmtAverage(r.average, r.base)}`;
    } else {
      stat = `Moyenne générale : ${fmtAverage(r.average, r.base)}` + (r.rank != null ? `   |   Rang : ${fmtRank(r.rank, r.classSize)}` : '');
    }
  }

  return (
    <section className="page sec" style={vars(theme.palette)}>
      <LevelFrame level="secondaire" pattern={theme.pattern} watermark={theme.icon} />
      <div className="content">
        <SchoolHeader school={d.school} />
        <div className="year">Année scolaire {d.period.schoolYear}</div>
        <div className="div"><i /><b /><i /></div>
        <h1 style={{ fontSize: fitFont(theme.title, 900, 52, 0.76, 28) }}>{theme.title}</h1>
        {theme.subtitle ? <div className="sub">{theme.subtitle}</div> : null}
        <div className="div" style={{ width: 460 }}><i /><b /><i /></div>
        <div className="given">{fill(theme.given, vals)}</div>
        <div className="name" style={{ fontSize: fitFont(name, 820, 50, 0.6, 30) }}>{name}</div>
        <div className="class">Élève de {d.student.className}</div>
        <p className="msg">{d.customMessage ?? fill(theme.message, vals)}</p>
        {stat ? <div className="stat">{stat}</div> : null}
        <Footer
          d={d}
          level="secondaire"
          center={
            <div className="verify">
              <div className="seal"><Icon name={theme.icon} size={50} stroke={1.8} /></div>
              <div className="place">{d.school.city ? `Fait à ${d.school.city}, le ${fmtDate(d.period.issuedOn)}` : `Le ${fmtDate(d.period.issuedOn)}`}</div>
            </div>
          }
        />
        <div className="qrcorner"><VerifyBlock d={d} withPlace={false} /></div>
      </div>
    </section>
  );
}

```

## src/templates/Board.tsx

```tsx
import type { CSSProperties } from 'react';
import { Icon } from '../icons.js';
import { BOARD_BASE, BOARD_TITLE, THEMES } from '../themes.js';
import { fmtAverage, fmtPct } from '../format.js';
import type { BoardInput, BoardRow, IconName, Level } from '../types.js';
import { LevelFrame, vars } from './shared.js';

const CLS: Record<Level, string> = { maternel: 'mat', primaire: 'pri', secondaire: 'sec' };
const TOP: { icon: IconName; color: string }[] = [
  { icon: 'Trophy', color: '#C9A227' }, { icon: 'Medal', color: '#94A3B8' }, { icon: 'Award', color: '#B7791F' },
];

export const ROWS_PER_PAGE = 9;

export function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
}

export function Board({ b }: { b: BoardInput }) {
  const base = THEMES[BOARD_BASE[b.level]];
  const pages = chunk<BoardRow>(b.rows, ROWS_PER_PAGE);
  const numHead = b.level === 'maternel' ? 'Acquis' : 'Moyenne';

  return (
    <>
      {pages.map((rows, pi) => (
        <section key={pi} className={`page board ${CLS[b.level]}`} style={vars(base.palette)}>
          <LevelFrame level={b.level} pattern={base.pattern} watermark={base.icon} />
          <div className="content">
            <div className="head">
              <h1>{BOARD_TITLE[b.level]}</h1>
              <div className="sub2">
                {b.className}, {b.period.label}, année scolaire {b.period.schoolYear}
                {pages.length > 1 ? `  (page ${pi + 1}/${pages.length})` : ''}
              </div>
            </div>
            <table>
              <thead>
                <tr><th>Rang</th><th>Élève</th><th className="num">{numHead}</th><th>Mention</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = THEMES[r.code];
                  const top = r.rank <= 3 ? TOP[r.rank - 1] : undefined;
                  return (
                    <tr key={`${r.rank}-${r.fullName}`}>
                      <td className="rk">
                        {top ? <Icon name={top.icon} size={26} color={top.color} stroke={2.2} /> : r.rank}
                      </td>
                      <td>{r.fullName}</td>
                      <td className="num">{b.level === 'maternel' ? fmtPct(r.average, b.base) : fmtAverage(r.average, b.base)}</td>
                      <td>
                        <span className="pill" style={{ '--pc': t.palette.primary } as CSSProperties}>
                          <Icon name={t.icon} size={16} stroke={2.4} />{t.shortLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="foot">{b.school.name}, généré par Academia Helm</div>
          </div>
        </section>
      ))}
    </>
  );
}

```

## src/render.tsx

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument } from 'pdf-lib';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import { prepare } from './assets.js';
import { ALL_CSS } from './css.js';
import { fontCss } from './fonts.js';
import { slug } from './format.js';
import { THEMES } from './themes.js';
import { Board } from './templates/Board.js';
import { Maternel } from './templates/Maternel.js';
import { Primaire } from './templates/Primaire.js';
import { Secondaire } from './templates/Secondaire.js';
import { toDataUri } from './assets.js';
import type { BoardInput, DistinctionInput, Level, PreparedDistinction } from './types.js';

// ---------- HTML ----------

function Certificate({ d }: { d: PreparedDistinction }) {
  const theme = THEMES[d.code];
  switch (theme.level) {
    case 'maternel': return <Maternel d={d} theme={theme} />;
    case 'primaire': return <Primaire d={d} theme={theme} />;
    case 'secondaire': return <Secondaire d={d} theme={theme} />;
  }
}

function wrap(levels: Level[], body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Academia Helm</title><style>${fontCss(levels)}\n${ALL_CSS}</style></head><body>${body}</body></html>`;
}

/** HTML complet de plusieurs certificats (un certificat par page). Utile aussi pour un aperçu navigateur. */
export async function renderDistinctionsHtml(inputs: DistinctionInput[]): Promise<string> {
  const prepared = await Promise.all(inputs.map(prepare));
  const body = prepared.map((d) => renderToStaticMarkup(<Certificate d={d} />)).join('');
  return wrap(inputs.map((i) => THEMES[i.code].level), body);
}

export async function renderBoardHtml(board: BoardInput): Promise<string> {
  const logoUrl = await toDataUri(board.school.logoUrl);
  const b: BoardInput = { ...board, school: { ...board.school, logoUrl } };
  return wrap([board.level], renderToStaticMarkup(<Board b={b} />));
}

// ---------- PDF ----------

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const local = process.env.CHROMIUM_PATH;
      const browser = await puppeteer.launch(
        local
          ? { executablePath: local, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'] }
          : { executablePath: await chromium.executablePath(), headless: 'shell', args: [...chromium.args, '--font-render-hinting=none'] },
      );
      browser.on('disconnected', () => { browserPromise = null; });
      return browser;
    })();
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    browserPromise = null;
    await b.close();
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function generateDistinctionPdf(input: DistinctionInput): Promise<Buffer> {
  return htmlToPdf(await renderDistinctionsHtml([input]));
}

export async function generateBoardPdf(board: BoardInput): Promise<Buffer> {
  return htmlToPdf(await renderBoardHtml(board));
}

export interface BatchFile { fileName: string; pdf: Buffer; input: DistinctionInput }

/**
 * Génère toute une classe en un seul rendu, puis découpe le PDF fusionné en fichiers individuels.
 * Un seul chargement de page et de polices : 60 certificats en quelques secondes.
 */
export async function generateBatch(inputs: DistinctionInput[]): Promise<{ merged: Buffer; files: BatchFile[] }> {
  if (inputs.length === 0) throw new Error('Aucun certificat à générer');
  const merged = await htmlToPdf(await renderDistinctionsHtml(inputs));
  const src = await PDFDocument.load(merged);
  if (src.getPageCount() !== inputs.length) {
    throw new Error(`Incohérence de pagination : ${src.getPageCount()} pages pour ${inputs.length} certificats`);
  }
  const files: BatchFile[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const doc = await PDFDocument.create();
    const [pg] = await doc.copyPages(src, [i]);
    doc.addPage(pg);
    const input = inputs[i];
    files.push({ fileName: `${input.code}_${slug(input.student.fullName)}.pdf`, pdf: Buffer.from(await doc.save()), input });
  }
  return { merged, files };
}

```

## src/pack.ts

```ts
import { makeVerificationCode, verificationUrl } from './security.js';
import { GRADUATION_CODE, resolveDistinction, type Rule } from './rules.js';
import { generateBatch, generateBoardPdf, type BatchFile } from './render.js';
import type { BoardRow, DistinctionCode, DistinctionInput, Level, PeriodInfo, SchoolInfo } from './types.js';

export interface PackStudent {
  id: string;
  fullName: string;
  average?: number;
  /** Calculé automatiquement si absent */
  rank?: number;
  photoUrl?: string;
  /** Élève qui quitte le cycle (Grande Section, CM2, 3e, Terminale) */
  graduating?: boolean;
  annualAverage?: number;
  previousAverage?: number;
  /** Prix spéciaux déjà calculés (voir resolveSpecialAwards) */
  awards?: DistinctionCode[];
}

export interface ClassPackInput {
  level: Level;
  school: SchoolInfo & { id: string };
  classId: string;
  className: string;
  periodId: string;
  period: PeriodInfo;
  base: number;
  students: PackStudent[];
  rules?: Rule[];
  previousLabel?: string;
  secret: string;
  verifyBaseUrl: string;
}

export interface ClassPackResult {
  mergedPdf: Buffer | null;
  boardPdf: Buffer | null;
  files: BatchFile[];
  /** À enregistrer dans la table distinctions */
  records: { studentId: string; code: DistinctionCode; verificationCode: string }[];
  /** Élèves sans document (ex : moyenne sous le premier palier) */
  skipped: { studentId: string; fullName: string; reason: string }[];
}

/**
 * Point d'entrée dynamique : à partir des moyennes d'une classe, applique les règles,
 * génère les certificats individuels, le PDF fusionné d'impression et le tableau collectif.
 */
export async function buildClassPack(p: ClassPackInput): Promise<ClassPackResult> {
  const withAvg = p.students.filter((s) => s.average != null);
  const ranked = [...withAvg].sort((a, b) => (b.average as number) - (a.average as number));
  const rankOf = new Map(ranked.map((s, i) => [s.id, s.rank ?? i + 1]));
  const classSize = withAvg.length;

  const inputs: DistinctionInput[] = [];
  const records: ClassPackResult['records'] = [];
  const skipped: ClassPackResult['skipped'] = [];
  const boardRows: BoardRow[] = [];

  const make = (s: PackStudent, code: DistinctionCode, extra: Partial<DistinctionInput> = {}): DistinctionInput => {
    const vcode = makeVerificationCode(p.secret, {
      schoolId: p.school.id, studentId: s.id, periodId: p.periodId, code, schoolYear: p.period.schoolYear,
    });
    records.push({ studentId: s.id, code, verificationCode: vcode });
    return {
      code,
      school: p.school,
      student: { fullName: s.fullName, className: p.className, photoUrl: s.photoUrl },
      period: p.period,
      results: {
        average: s.average, base: p.base, rank: rankOf.get(s.id), classSize,
        previousAverage: s.previousAverage, previousLabel: p.previousLabel,
      },
      verification: { code: vcode, url: verificationUrl(p.verifyBaseUrl, vcode) },
      ...extra,
    };
  };

  for (const s of ranked) {
    const code = resolveDistinction(p.level, s.average as number, p.base, p.rules);
    if (code) {
      inputs.push(make(s, code));
      boardRows.push({ rank: rankOf.get(s.id) as number, fullName: s.fullName, average: s.average as number, code });
    } else {
      skipped.push({ studentId: s.id, fullName: s.fullName, reason: 'Moyenne sous le premier palier' });
    }
  }
  for (const s of p.students) {
    if (s.average == null) skipped.push({ studentId: s.id, fullName: s.fullName, reason: 'Moyenne absente' });
    for (const award of s.awards ?? []) inputs.push(make(s, award));
    if (s.graduating) {
      const avg = s.annualAverage ?? s.average;
      inputs.push(make(s, GRADUATION_CODE[p.level], {
        results: { average: avg, base: p.base, rank: rankOf.get(s.id), classSize },
      }));
    }
  }

  const [batch, boardPdf] = await Promise.all([
    inputs.length ? generateBatch(inputs) : Promise.resolve(null),
    boardRows.length
      ? generateBoardPdf({ level: p.level, school: p.school, className: p.className, period: p.period, base: p.base, rows: boardRows })
      : Promise.resolve(null),
  ]);

  return { mergedPdf: batch?.merged ?? null, boardPdf, files: batch?.files ?? [], records, skipped };
}

```

## src/index.ts

```ts
export * from './types.js';
export { THEMES, BOARD_BASE, BOARD_TITLE } from './themes.js';
export { DEFAULT_RULES, GRADUATION_CODE, resolveDistinction, resolveSpecialAwards, toPct, type Rule, type SpecialAwardInput } from './rules.js';
export { makeVerificationCode, checkVerificationCode, verificationUrl } from './security.js';
export {
  generateDistinctionPdf, generateBoardPdf, generateBatch, renderDistinctionsHtml, renderBoardHtml, closeBrowser, htmlToPdf,
  type BatchFile,
} from './render.js';
export { buildClassPack, type ClassPackInput, type ClassPackResult, type PackStudent } from './pack.js';

```

## src/demo.ts

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { THEMES } from './themes.js';
import { buildClassPack, closeBrowser, generateDistinctionPdf, generateBoardPdf } from './index.js';
import type { DistinctionCode, DistinctionInput, SchoolInfo } from './types.js';

const school: SchoolInfo & { id: string } = {
  id: 'sch_001', name: 'Complexe Scolaire Le Flambeau', city: 'Parakou',
  directorName: 'M. Oswald ADJOVI', teacherName: 'Mme Grâce TOSSOU',
};
const period = { label: '1er trimestre', schoolYear: '2025-2026', issuedOn: '2025-12-19' };

const SAMPLE: Record<DistinctionCode, Partial<DistinctionInput> & { name: string; cls: string; avg?: number; base: number; rank?: number; prev?: number }> = {
  MAT_OR: { name: 'HOUNKPATIN Esther', cls: 'Grande Section', avg: 18.4, base: 20 },
  MAT_ARGENT: { name: 'AGBODJI Léa', cls: 'Moyenne Section', avg: 16.2, base: 20 },
  MAT_BRONZE: { name: 'SOSSOU Emmanuel', cls: 'Petite Section', avg: 13.2, base: 20 },
  MAT_EXPLO: { name: 'KPADONOU Ariel', cls: 'Petite Section', avg: 10.4, base: 20 },
  MAT_GRAD: { name: 'HOUNKPATIN Esther', cls: 'Grande Section', base: 20, statOverride: undefined },
  PRI_FELIC: { name: 'AKPO Daniel', cls: 'CM2 B', avg: 17.2, base: 20, rank: 1 },
  PRI_ENCOU: { name: 'ZINSOU Ruth', cls: 'CM1 A', avg: 15.1, base: 20, rank: 6 },
  PRI_HONNEUR: { name: 'SANTOS Marie', cls: 'CE2 A', avg: 12.85, base: 20, rank: 14 },
  PRI_COURAGE: { name: 'DEGBE Rachel', cls: 'CE1 B', avg: 10.4, base: 20, rank: 31 },
  PRI_GRAD: { name: 'AKPO Daniel', cls: 'CM2 B', avg: 14.3, base: 20, rank: 4 },
  SEC_FELIC: { name: 'ADJOVI Grâce Emmanuelle', cls: '3e A', avg: 16.8, base: 20, rank: 2 },
  SEC_ENCOU: { name: 'GBEDO Daniel', cls: '4e B', avg: 14.6, base: 20, rank: 7 },
  SEC_HONNEUR: { name: 'BIAOU Josué', cls: '5e A', avg: 12.75, base: 20, rank: 15 },
  SEC_PROGRES: { name: 'KOUDJO Samuel', cls: '2nde C', avg: 14.1, base: 20, prev: 10.9 },
  SEC_ASSIDUITE: { name: 'TOGNON Esther', cls: '1ère D', base: 20, statOverride: 'Aucune absence, aucun retard sur la période' },
  SEC_COMPORTEMENT: { name: 'SEGNON Lydie', cls: '6e B', base: 20, statOverride: 'Conduite : 19/20' },
  SEC_GRAD: { name: 'ADJOVI Grâce Emmanuelle', cls: '3e A', avg: 14.3, base: 20, rank: 2 },
};

async function main() {
  await mkdir('out/certificats', { recursive: true });
  for (const code of Object.keys(THEMES) as DistinctionCode[]) {
    const s = SAMPLE[code];
    const pdf = await generateDistinctionPdf({
      code, school, period: code === 'SEC_PROGRES' ? { ...period, label: '2e trimestre', issuedOn: '2026-03-27' } : period,
      student: { fullName: s.name, className: s.cls },
      results: s.avg != null ? { average: s.avg, base: s.base, rank: s.rank, classSize: 42, previousAverage: s.prev, previousLabel: '1er trimestre' } : undefined,
      verification: { code: 'AH-2025-7F3A-91C2-B04E', url: 'https://academiahelm.com/verifier/AH-2025-7F3A-91C2-B04E' },
      statOverride: s.statOverride,
    });
    await writeFile(`out/certificats/${code}.pdf`, pdf);
    console.log('ok', code);
  }

  // Test du flux dynamique complet sur une classe
  const names = ['ADJOVI Grâce', 'KOUDJO Samuel', 'TOGNON Esther', 'GBEDO Daniel', 'AHOUANDJINOU Ruth', 'FADONOUGBO Marc', 'SEGNON Lydie', 'BIAOU Josué', 'ODJO Nadège', 'DEGBE Rachel', 'AMOUSSOU Luc', 'HOUESSOU Paul', 'ZINSOU Ruth'];
  const avgs = [17.2, 16.35, 16.05, 15.2, 14.9, 14.15, 13.4, 12.75, 12.1, 10.4, 9.2, 13.9, 11.1];
  const pack = await buildClassPack({
    level: 'primaire', school, classId: 'cls_cm2b', className: 'CM2 B', periodId: 'per_t1',
    period, base: 20, secret: 'dev-secret', verifyBaseUrl: 'https://academiahelm.com',
    students: names.map((n, i) => ({ id: `stu_${i}`, fullName: n, average: avgs[i], graduating: i < 2 })),
  });
  await mkdir('out/classe', { recursive: true });
  if (pack.mergedPdf) await writeFile('out/classe/impression_classe.pdf', pack.mergedPdf);
  if (pack.boardPdf) await writeFile('out/classe/tableau_honneur.pdf', pack.boardPdf);
  for (const f of pack.files) await writeFile(`out/classe/${f.fileName}`, f.pdf);
  console.log('pack:', pack.files.length, 'fichiers,', pack.skipped.length, 'sans document');

  // Tableaux collectifs des deux autres niveaux
  for (const level of ['maternel', 'secondaire'] as const) {
    const codes: DistinctionCode[] = level === 'maternel' ? ['MAT_OR', 'MAT_OR', 'MAT_ARGENT', 'MAT_ARGENT', 'MAT_BRONZE', 'MAT_EXPLO'] : ['SEC_FELIC', 'SEC_FELIC', 'SEC_ENCOU', 'SEC_ENCOU', 'SEC_HONNEUR', 'SEC_HONNEUR'];
    const avg = level === 'maternel' ? [18.4, 18, 16.8, 15.6, 13.2, 10.4] : [17.1, 16.4, 15.3, 14.4, 12.9, 12.2];
    const pdf = await generateBoardPdf({
      level, school, className: level === 'maternel' ? 'Grande Section' : '3e A', period, base: 20,
      rows: codes.map((c, i) => ({ rank: i + 1, fullName: names[i], average: avg[i], code: c })),
    });
    await writeFile(`out/tableau_${level}.pdf`, pdf);
  }
  await closeBrowser();
  console.log('terminé');
}

main().catch(async (e) => { console.error(e); await closeBrowser(); process.exit(1); });

```

## sql/schema.sql

```sql
-- Academia Helm : distinctions, certificats et tableaux d'honneur (PostgreSQL)

CREATE TABLE distinction_rules (
  id          BIGSERIAL PRIMARY KEY,
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  level       TEXT NOT NULL CHECK (level IN ('maternel','primaire','secondaire')),
  code        TEXT NOT NULL,              -- ex : PRI_FELIC (voir DistinctionCode)
  min_pct     NUMERIC(5,2) NOT NULL CHECK (min_pct BETWEEN 0 AND 100),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (school_id, level, code)
);

CREATE TABLE distinctions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id           UUID NOT NULL REFERENCES classes(id),
  period_id          UUID NOT NULL REFERENCES periods(id),
  code               TEXT NOT NULL,
  average            NUMERIC(6,2),
  base               SMALLINT NOT NULL,
  rank               SMALLINT,
  verification_code  TEXT NOT NULL UNIQUE,
  file_url           TEXT,
  issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at         TIMESTAMPTZ,
  -- une seule émission par élève, période et type de distinction
  UNIQUE (student_id, period_id, code)
);

CREATE INDEX distinctions_class_period_idx ON distinctions (class_id, period_id);

-- Page publique /verifier/[code] : SELECT sur verification_code uniquement,
-- en exposant nom, mention, période et école (jamais la moyenne exacte sans consentement).

```

## examples/next-route.ts

```ts
// app/api/classes/[classId]/distinctions/route.ts  (Next.js App Router)
// POST /api/classes/:classId/distinctions?periodId=...  à appeler à la clôture d'une période.

import { buildClassPack, resolveSpecialAwards, type PackStudent } from '@yehi-or/helm-distinctions';
import { NextResponse } from 'next/server';
// Remplace ces imports par ta couche d'accès aux données (Prisma, Drizzle, Supabase...)
import { db, storage, requireRole } from '@/lib/server';

export const runtime = 'nodejs';   // Puppeteer ne tourne pas en edge
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: { classId: string } }) {
  await requireRole(req, ['DIRECTOR', 'ADMIN']);
  const periodId = new URL(req.url).searchParams.get('periodId');
  if (!periodId) return NextResponse.json({ error: 'periodId requis' }, { status: 400 });

  const [school, klass, period, rules, rows] = await Promise.all([
    db.school.current(), db.class.get(params.classId), db.period.get(periodId),
    db.distinctionRules.list({ level: undefined }), db.results.byClass(params.classId, periodId),
  ]);

  const students: PackStudent[] = rows.map((r) => ({
    id: r.studentId,
    fullName: r.fullName,
    average: r.average,
    photoUrl: r.photoUrl,
    graduating: klass.isLastOfCycle && period.isLastOfYear,
    annualAverage: r.annualAverage,
    awards: klass.level === 'secondaire'
      ? resolveSpecialAwards({
          average: r.average, previousAverage: r.previousAverage, base: klass.base,
          unjustifiedAbsences: r.unjustifiedAbsences, lateCount: r.lateCount, conductPct: r.conductPct,
        })
      : [],
    previousAverage: r.previousAverage,
  }));

  const pack = await buildClassPack({
    level: klass.level,
    school: { id: school.id, name: school.name, city: school.city, logoUrl: school.logoUrl,
      directorName: school.directorName, directorSignatureUrl: school.directorSignatureUrl },
    classId: klass.id, className: klass.name, periodId, base: klass.base,
    period: { label: period.label, schoolYear: period.schoolYear, issuedOn: new Date().toISOString().slice(0, 10) },
    students,
    rules: rules.length ? rules.map((x) => ({ code: x.code, minPct: Number(x.minPct) })) : undefined,
    secret: process.env.DISTINCTION_SECRET!,
    verifyBaseUrl: process.env.NEXT_PUBLIC_APP_URL!,
  });

  // Stockage des fichiers individuels et enregistrement des émissions (idempotent)
  const urls = new Map<string, string>();
  for (const f of pack.files) urls.set(f.input.verification.code, await storage.put(`distinctions/${params.classId}/${periodId}/${f.fileName}`, f.pdf));
  await db.distinction.upsertMany(
    pack.records.map((r) => ({ ...r, schoolId: school.id, classId: klass.id, periodId, fileUrl: urls.get(r.verificationCode) })),
  );
  const printUrl = pack.mergedPdf && await storage.put(`distinctions/${params.classId}/${periodId}/impression.pdf`, pack.mergedPdf);
  const boardUrl = pack.boardPdf && await storage.put(`distinctions/${params.classId}/${periodId}/tableau.pdf`, pack.boardPdf);

  return NextResponse.json({ issued: pack.records.length, skipped: pack.skipped, printUrl, boardUrl });
}

```
