/**
 * ============================================================================
 * DONNÉES DES DÉPARTEMENTS DU BÉNIN
 * ============================================================================
 * 
 * Données géographiques et statistiques des 12 départements du Bénin
 * pour la carte interactive du portail Academia Helm.
 * 
 * ============================================================================
 */

export interface DepartmentData {
  code: string;
  name: string;
  capital: string;
  area: number; // km²
  population: number;
  schoolCount: number;
  teacherCount: number;
  studentCount: number;
  femalePercent: number;
  publicCount: number;
  privateCount: number;
  communes: string[];
  /** Label position offset for SVG map placement */
  labelOffset: { x: number; y: number };
}

export const BENIN_DEPARTMENTS: DepartmentData[] = [
  {
    code: 'AL',
    name: 'Alibori',
    capital: 'Kandi',
    area: 26242,
    population: 868044,
    schoolCount: 855,
    teacherCount: 2853,
    studentCount: 155212,
    femalePercent: 48.0,
    publicCount: 659,
    privateCount: 196,
    communes: ['Kandi', 'Malanville', 'Banikoara', 'Ségbana', 'Gogounou', 'Karimama'],
    labelOffset: { x: 0, y: 5 },
  },
  {
    code: 'AT',
    name: 'Atacora',
    capital: 'Natitingou',
    area: 20499,
    population: 779206,
    schoolCount: 748,
    teacherCount: 2487,
    studentCount: 134680,
    femalePercent: 49.2,
    publicCount: 583,
    privateCount: 165,
    communes: ['Natitingou', 'Tanguiéta', 'Boukombé', 'Cobly', 'Kérou', 'Kouandé', 'Matéri', 'Péhunco', 'Toucountouna'],
    labelOffset: { x: -10, y: 0 },
  },
  {
    code: 'AQ',
    name: 'Atlantique',
    capital: 'Allada',
    area: 3233,
    population: 1398224,
    schoolCount: 1820,
    teacherCount: 7203,
    studentCount: 328540,
    femalePercent: 51.3,
    publicCount: 1024,
    privateCount: 796,
    communes: ['Allada', 'Abomey-Calavi', 'Ouidah', 'Tori-Bossito', 'Toffo', 'Kpomassè', 'Zè'],
    labelOffset: { x: -5, y: 10 },
  },
  {
    code: 'BO',
    name: 'Borgou',
    capital: 'Parakou',
    area: 25856,
    population: 1214530,
    schoolCount: 1704,
    teacherCount: 6299,
    studentCount: 290109,
    femalePercent: 50.3,
    publicCount: 1268,
    privateCount: 436,
    communes: ['Parakou', 'N\'Dali', 'Tchaourou', 'Bembèrèkè', 'Kalalé', 'Pèrèrè', 'Sinendé', 'Banikoara'],
    labelOffset: { x: 5, y: 0 },
  },
  {
    code: 'CO',
    name: 'Collines',
    capital: 'Savalou',
    area: 13931,
    population: 716558,
    schoolCount: 1240,
    teacherCount: 4320,
    studentCount: 198760,
    femalePercent: 50.8,
    publicCount: 928,
    privateCount: 312,
    communes: ['Savalou', 'Dassa-Zoumè', 'Bantè', 'Glazoué', 'Ouèssè', 'Savalou'],
    labelOffset: { x: 0, y: 5 },
  },
  {
    code: 'DO',
    name: 'Donga',
    capital: 'Djougou',
    area: 11066,
    population: 544149,
    schoolCount: 680,
    teacherCount: 2245,
    studentCount: 126340,
    femalePercent: 49.5,
    publicCount: 512,
    privateCount: 168,
    communes: ['Djougou', 'Bassila', 'Copargo', 'Ouaké', 'Cobly'],
    labelOffset: { x: -5, y: 0 },
  },
  {
    code: 'KO',
    name: 'Kouffo',
    capital: 'Dogbo',
    area: 2404,
    population: 554418,
    schoolCount: 590,
    teacherCount: 1980,
    studentCount: 112340,
    femalePercent: 52.1,
    publicCount: 420,
    privateCount: 170,
    communes: ['Dogbo', 'Aplahoué', 'Djakotomey', 'Klouékanmè', 'Lalo', 'Toviklin'],
    labelOffset: { x: -8, y: 0 },
  },
  {
    code: 'LI',
    name: 'Littoral',
    capital: 'Cotonou',
    area: 79,
    population: 1150360,
    schoolCount: 2100,
    teacherCount: 9800,
    studentCount: 445320,
    femalePercent: 50.9,
    publicCount: 630,
    privateCount: 1470,
    communes: ['Cotonou'],
    labelOffset: { x: 0, y: 12 },
  },
  {
    code: 'MO',
    name: 'Mono',
    capital: 'Lokossa',
    area: 1605,
    population: 497243,
    schoolCount: 520,
    teacherCount: 1756,
    studentCount: 98760,
    femalePercent: 51.7,
    publicCount: 382,
    privateCount: 138,
    communes: ['Lokossa', 'Houéyogbé', 'Athiémé', 'Bopa', 'Comè', 'Grand-Popo', 'Dogbo'],
    labelOffset: { x: -5, y: 5 },
  },
  {
    code: 'OU',
    name: 'Ouémé',
    capital: 'Porto-Novo',
    area: 2807,
    population: 1096740,
    schoolCount: 1650,
    teacherCount: 6120,
    studentCount: 285600,
    femalePercent: 50.6,
    publicCount: 924,
    privateCount: 726,
    communes: ['Porto-Novo', 'Adjara', 'Adja-Ouèrè', 'Akpro-Missérété', 'Avrankou', 'Bonou', 'Dangbo', 'Missérété', 'Sèmè-Kpodji'],
    labelOffset: { x: 8, y: 0 },
  },
  {
    code: 'PL',
    name: 'Plateau',
    capital: 'Pobè',
    area: 3264,
    population: 622372,
    schoolCount: 780,
    teacherCount: 2680,
    studentCount: 142580,
    femalePercent: 49.8,
    publicCount: 546,
    privateCount: 234,
    communes: ['Pobè', 'Adja-Ouèrè', 'Ifangni', 'Kétou', 'Pobè', 'Sakété'],
    labelOffset: { x: 5, y: 5 },
  },
  {
    code: 'ZO',
    name: 'Zou',
    capital: 'Abomey',
    area: 5106,
    population: 852772,
    schoolCount: 1420,
    teacherCount: 4980,
    studentCount: 226800,
    femalePercent: 51.0,
    publicCount: 924,
    privateCount: 496,
    communes: ['Abomey', 'Bohicon', 'Agbangnizoun', 'Cové', 'Djidja', 'Ouinhi', 'Za-Kpota', 'Zangnanado'],
    labelOffset: { x: 0, y: 5 },
  },
];

/** Stats globales calculées */
export const BENIN_TOTALS = {
  schools: BENIN_DEPARTMENTS.reduce((s, d) => s + d.schoolCount, 0),
  teachers: BENIN_DEPARTMENTS.reduce((s, d) => s + d.teacherCount, 0),
  students: BENIN_DEPARTMENTS.reduce((s, d) => s + d.studentCount, 0),
  departments: BENIN_DEPARTMENTS.length,
};

/** Trouver un département par son code */
export function getDepartmentByCode(code: string): DepartmentData | undefined {
  return BENIN_DEPARTMENTS.find((d) => d.code === code);
}

/** Trouver un département par son nom (insensible à la casse) */
export function getDepartmentByName(name: string): DepartmentData | undefined {
  const lower = name.toLowerCase();
  return BENIN_DEPARTMENTS.find((d) => d.name.toLowerCase() === lower);
}
