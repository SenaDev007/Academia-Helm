export type Level = 'maternel' | 'primaire' | 'secondaire';

/** ⭐ 2026-10-05 — Langue du PDF généré (FR par défaut, EN pour piste anglophone). */
export type Lang = 'FR' | 'EN';

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
  /** ⭐ Champs enrichis pour l'en-tête officiel style bulletin */
  /** Adresse physique de l'établissement (ex: "Cotonou, Bénin") */
  address?: string;
  /** Téléphone de l'établissement */
  phone?: string;
  /** Email de l'établissement */
  email?: string;
  /** Slogan/devise de l'établissement */
  slogan?: string;
  /** Ministère de tutelle (déduit du niveau) */
  ministry?: string;
  /** Code pays (BJ par défaut) pour le drapeau */
  countryCode?: string;
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
  /** ⭐ 2026-10-05 — Langue du PDF (FR ou EN). Défaut: 'FR'. */
  lang?: Lang;
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
  /** ⭐ 2026-10-05 — Langue du PDF (FR ou EN). Défaut: 'FR'. */
  lang?: Lang;
  school: SchoolInfo;
  className: string;
  period: PeriodInfo;
  base: number;
  rows: BoardRow[];
}

export interface PreparedDistinction extends DistinctionInput {
  qrSvg: string;
}
