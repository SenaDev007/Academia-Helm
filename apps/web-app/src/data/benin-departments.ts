/**
 * ============================================================================
 * DONNÉES DES DÉPARTEMENTS DU BÉNIN
 * ============================================================================
 * 
 * Données géographiques et statistiques des 12 départements du Bénin
 * pour la carte interactive du portail Academia Helm.
 * 
 * Sources : Données officielles du gouvernement béninois (emp.educmaster.bj)
 * 
 * Champs PRIMAIRE = Maternelle + Primaire
 * Champs SECONDAIRE = Secondaire général
 * 
 * ============================================================================
 */

export interface CircumscriptionData {
  name: string;
  schoolCount: number;
  studentCount: number;
  teacherCount: number;
  femalePercent: number;
}

export interface SecondaireData {
  schoolCount: number;
  studentCount: number;
  teacherCount: number;
  femalePercent: number;
  publicCount: number;
  privateCount: number;
}

export interface DepartmentData {
  code: string;
  name: string;
  capital: string;
  area: number; // km²
  population: number;
  // Primaire (Maternelle + Primaire)
  schoolCount: number;
  teacherCount: number;
  studentCount: number;
  femalePercent: number;
  publicCount: number;
  privateCount: number;
  communes: string[];
  // Secondaire
  secondaire: SecondaireData;
  // Circonscriptions scolaires (primaire)
  circumscriptions: CircumscriptionData[];
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
    studentCount: 155225,
    femalePercent: 48,
    publicCount: 659,
    privateCount: 196,
    communes: ['Banikoara', 'Kandi', 'Malanville', 'Gogounou', 'Ségbana', 'Karimama'],
    secondaire: {
      schoolCount: 103,
      studentCount: 43915,
      teacherCount: 1833,
      femalePercent: 46.6,
      publicCount: 51,
      privateCount: 52,
    },
    circumscriptions: [
      { name: 'Banikoara', schoolCount: 279, studentCount: 41792, teacherCount: 889, femalePercent: 46.5 },
      { name: 'Kandi', schoolCount: 191, studentCount: 32843, teacherCount: 704, femalePercent: 48.2 },
      { name: 'Malanville', schoolCount: 128, studentCount: 27397, teacherCount: 415, femalePercent: 46 },
      { name: 'Gogounou', schoolCount: 119, studentCount: 26245, teacherCount: 428, femalePercent: 50.9 },
      { name: 'Ségbana', schoolCount: 77, studentCount: 18191, teacherCount: 249, femalePercent: 49 },
      { name: 'Karimama', schoolCount: 61, studentCount: 8757, teacherCount: 168, femalePercent: 49.6 },
    ],
    labelOffset: { x: 0, y: 5 },
  },
  {
    code: 'AT',
    name: 'Atacora',
    capital: 'Natitingou',
    area: 20499,
    population: 779206,
    schoolCount: 1159,
    teacherCount: 3928,
    studentCount: 151819,
    femalePercent: 49.4,
    publicCount: 909,
    privateCount: 250,
    communes: ['Natitingou', 'Matéri', 'Boukoumbé', 'Kouandé', 'Tanguiéta', 'Cobly', 'Kérou', 'Péhunco', 'Toucountouna'],
    secondaire: {
      schoolCount: 146,
      studentCount: 50269,
      teacherCount: 2577,
      femalePercent: 45.6,
      publicCount: 83,
      privateCount: 63,
    },
    circumscriptions: [
      { name: 'Natitingou', schoolCount: 219, studentCount: 21755, teacherCount: 861, femalePercent: 50.6 },
      { name: 'Matéri', schoolCount: 159, studentCount: 20446, teacherCount: 511, femalePercent: 50.2 },
      { name: 'Boukoumbé', schoolCount: 142, studentCount: 15222, teacherCount: 471, femalePercent: 48.6 },
      { name: 'Kouandé', schoolCount: 138, studentCount: 13070, teacherCount: 463, femalePercent: 50 },
      { name: 'Tanguiéta', schoolCount: 115, studentCount: 17687, teacherCount: 371, femalePercent: 48.7 },
      { name: 'Cobly', schoolCount: 108, studentCount: 20785, teacherCount: 368, femalePercent: 48.4 },
      { name: 'Kérou', schoolCount: 104, studentCount: 17004, teacherCount: 348, femalePercent: 48 },
      { name: 'Péhunco', schoolCount: 102, studentCount: 16690, teacherCount: 320, femalePercent: 50.2 },
      { name: 'Toucountouna', schoolCount: 72, studentCount: 9160, teacherCount: 215, femalePercent: 49.7 },
    ],
    labelOffset: { x: -10, y: 0 },
  },
  {
    code: 'AQ',
    name: 'Atlantique',
    capital: 'Allada',
    area: 3233,
    population: 1398224,
    schoolCount: 3514,
    teacherCount: 12540,
    studentCount: 408418,
    femalePercent: 48.2,
    publicCount: 1028,
    privateCount: 2486,
    communes: ['Abomey-Calavi', 'Ouidah', 'Allada', 'Zè', 'Tori-Bossito', 'Toffo', 'Kpomassè', 'So-Ava'],
    secondaire: {
      schoolCount: 1161,
      studentCount: 250062,
      teacherCount: 14965,
      femalePercent: 49.2,
      publicCount: 108,
      privateCount: 1053,
    },
    circumscriptions: [
      { name: 'Abomey-Calavi 2', schoolCount: 647, studentCount: 61924, teacherCount: 2117, femalePercent: 49.3 },
      { name: 'Abomey-Calavi 4', schoolCount: 580, studentCount: 62775, teacherCount: 2043, femalePercent: 48.7 },
      { name: 'Ouidah', schoolCount: 527, studentCount: 57641, teacherCount: 1768, femalePercent: 48.3 },
      { name: 'Abomey-Calavi 1', schoolCount: 471, studentCount: 50373, teacherCount: 1800, femalePercent: 49.6 },
      { name: 'Allada', schoolCount: 298, studentCount: 37948, teacherCount: 1054, femalePercent: 47.7 },
      { name: 'Zè', schoolCount: 243, studentCount: 30134, teacherCount: 852, femalePercent: 47.9 },
      { name: 'Abomey-Calavi 3', schoolCount: 228, studentCount: 26262, teacherCount: 787, femalePercent: 48.5 },
      { name: 'Tori-Bossito', schoolCount: 189, studentCount: 24591, teacherCount: 658, femalePercent: 47.8 },
      { name: 'Toffo', schoolCount: 156, studentCount: 27051, teacherCount: 669, femalePercent: 46.4 },
      { name: 'Kpomassè', schoolCount: 104, studentCount: 14077, teacherCount: 455, femalePercent: 47.5 },
      { name: 'So-Ava', schoolCount: 71, studentCount: 15642, teacherCount: 337, femalePercent: 42.2 },
    ],
    labelOffset: { x: -5, y: 10 },
  },
  {
    code: 'BO',
    name: 'Borgou',
    capital: 'Parakou',
    area: 25856,
    population: 1214530,
    schoolCount: 1704,
    teacherCount: 6300,
    studentCount: 290164,
    femalePercent: 50.3,
    publicCount: 1112,
    privateCount: 592,
    communes: ['Parakou', 'Nikki', 'Tchaourou', 'Bembèrèkè', "N'Dali", 'Kalalé', 'Sinendé', 'Pèrérè'],
    secondaire: {
      schoolCount: 299,
      studentCount: 109201,
      teacherCount: 4906,
      femalePercent: 50,
      publicCount: 101,
      privateCount: 198,
    },
    circumscriptions: [
      { name: 'Parakou 1', schoolCount: 289, studentCount: 44276, teacherCount: 1219, femalePercent: 49 },
      { name: 'Parakou 2', schoolCount: 252, studentCount: 39291, teacherCount: 1119, femalePercent: 49.5 },
      { name: 'Nikki', schoolCount: 205, studentCount: 33624, teacherCount: 643, femalePercent: 51.9 },
      { name: 'Tchaourou 1', schoolCount: 182, studentCount: 37075, teacherCount: 717, femalePercent: 48 },
      { name: 'Bembèrèkè', schoolCount: 168, studentCount: 30277, teacherCount: 549, femalePercent: 51.3 },
      { name: "N'Dali", schoolCount: 149, studentCount: 28894, teacherCount: 641, femalePercent: 51.1 },
      { name: 'Kalalé', schoolCount: 135, studentCount: 22127, teacherCount: 347, femalePercent: 52.1 },
      { name: 'Sinendé', schoolCount: 117, studentCount: 22923, teacherCount: 366, femalePercent: 52 },
      { name: 'Pèrérè', schoolCount: 111, studentCount: 13539, teacherCount: 329, femalePercent: 52 },
      { name: 'Tchaourou 2', schoolCount: 96, studentCount: 18138, teacherCount: 370, femalePercent: 48.9 },
    ],
    labelOffset: { x: 5, y: 0 },
  },
  {
    code: 'CO',
    name: 'Collines',
    capital: 'Savalou',
    area: 13931,
    population: 716558,
    schoolCount: 1105,
    teacherCount: 4242,
    studentCount: 156462,
    femalePercent: 47.8,
    publicCount: 908,
    privateCount: 197,
    communes: ['Dassa-Zoumè', 'Glazoué', 'Savalou', 'Savè', 'Bantè', 'Ouèssè'],
    secondaire: {
      schoolCount: 161,
      studentCount: 64990,
      teacherCount: 2861,
      femalePercent: 44.8,
      publicCount: 104,
      privateCount: 57,
    },
    circumscriptions: [
      { name: 'Dassa-Zoumè', schoolCount: 218, studentCount: 23555, teacherCount: 766, femalePercent: 48.5 },
      { name: 'Glazoué', schoolCount: 208, studentCount: 30789, teacherCount: 806, femalePercent: 48.5 },
      { name: 'Savalou', schoolCount: 203, studentCount: 31733, teacherCount: 800, femalePercent: 47.6 },
      { name: 'Savè', schoolCount: 164, studentCount: 19772, teacherCount: 600, femalePercent: 47.2 },
      { name: 'Bantè', schoolCount: 163, studentCount: 26703, teacherCount: 635, femalePercent: 48.2 },
      { name: 'Ouèssè', schoolCount: 149, studentCount: 23910, teacherCount: 635, femalePercent: 46.3 },
    ],
    labelOffset: { x: 0, y: 5 },
  },
  {
    code: 'KO',
    name: 'Kouffo',
    capital: 'Aplahoué',
    area: 2404,
    population: 554418,
    schoolCount: 867,
    teacherCount: 3819,
    studentCount: 129465,
    femalePercent: 47,
    publicCount: 742,
    privateCount: 125,
    communes: ['Aplahoué', 'Klouékanmè', 'Dogbo', 'Djakotomey', 'Lalo', 'Toviklin'],
    secondaire: {
      schoolCount: 114,
      studentCount: 44832,
      teacherCount: 2170,
      femalePercent: 43.8,
      publicCount: 83,
      privateCount: 31,
    },
    circumscriptions: [
      { name: 'Aplahoué', schoolCount: 204, studentCount: 25102, teacherCount: 803, femalePercent: 46.1 },
      { name: 'Klouékanmè', schoolCount: 154, studentCount: 24332, teacherCount: 689, femalePercent: 47.5 },
      { name: 'Dogbo', schoolCount: 143, studentCount: 16090, teacherCount: 664, femalePercent: 47.8 },
      { name: 'Djakotomey', schoolCount: 141, studentCount: 25109, teacherCount: 667, femalePercent: 47.3 },
      { name: 'Lalo', schoolCount: 118, studentCount: 23667, teacherCount: 534, femalePercent: 45.2 },
      { name: 'Toviklin', schoolCount: 107, studentCount: 15165, teacherCount: 462, femalePercent: 49.3 },
    ],
    labelOffset: { x: -8, y: 0 },
  },
  {
    code: 'DO',
    name: 'Donga',
    capital: 'Djougou',
    area: 11066,
    population: 544149,
    schoolCount: 899,
    teacherCount: 3287,
    studentCount: 143783,
    femalePercent: 48.1,
    publicCount: 722,
    privateCount: 177,
    communes: ['Djougou', 'Ouaké', 'Bassila', 'Copargo'],
    secondaire: {
      schoolCount: 124,
      studentCount: 41008,
      teacherCount: 1942,
      femalePercent: 45.6,
      publicCount: 68,
      privateCount: 56,
    },
    circumscriptions: [
      { name: 'Djougou I', schoolCount: 244, studentCount: 39498, teacherCount: 975, femalePercent: 47.7 },
      { name: 'Djougou II', schoolCount: 228, studentCount: 38203, teacherCount: 803, femalePercent: 47.8 },
      { name: 'Ouaké', schoolCount: 128, studentCount: 18506, teacherCount: 450, femalePercent: 49.2 },
      { name: 'Bassila 1', schoolCount: 120, studentCount: 21522, teacherCount: 483, femalePercent: 48.7 },
      { name: 'Copargo', schoolCount: 104, studentCount: 12882, teacherCount: 313, femalePercent: 48.1 },
      { name: 'Bassila 2', schoolCount: 75, studentCount: 13172, teacherCount: 263, femalePercent: 47.4 },
    ],
    labelOffset: { x: -5, y: 0 },
  },
  {
    code: 'LI',
    name: 'Littoral',
    capital: 'Cotonou',
    area: 79,
    population: 1150360,
    schoolCount: 1105,
    teacherCount: 3729,
    studentCount: 104637,
    femalePercent: 49.6,
    publicCount: 269,
    privateCount: 835,
    communes: ['Cotonou'],
    secondaire: {
      schoolCount: 371,
      studentCount: 93167,
      teacherCount: 5914,
      femalePercent: 49.9,
      publicCount: 24,
      privateCount: 347,
    },
    circumscriptions: [
      { name: 'Cotonou 2', schoolCount: 422, studentCount: 37747, teacherCount: 1380, femalePercent: 49.7 },
      { name: 'Cotonou 1', schoolCount: 330, studentCount: 29599, teacherCount: 1152, femalePercent: 50.2 },
      { name: 'Cotonou 3', schoolCount: 246, studentCount: 22887, teacherCount: 765, femalePercent: 49.2 },
      { name: 'Cotonou 4', schoolCount: 107, studentCount: 14404, teacherCount: 432, femalePercent: 48.8 },
    ],
    labelOffset: { x: 0, y: 12 },
  },
  {
    code: 'MO',
    name: 'Mono',
    capital: 'Lokossa',
    area: 1605,
    population: 497243,
    schoolCount: 836,
    teacherCount: 3670,
    studentCount: 101807,
    femalePercent: 48.3,
    publicCount: 636,
    privateCount: 200,
    communes: ['Houéyogbé', 'Lokossa', 'Comè', 'Bopa', 'Grand-Popo', 'Athiémé'],
    secondaire: {
      schoolCount: 148,
      studentCount: 56867,
      teacherCount: 3091,
      femalePercent: 47.2,
      publicCount: 74,
      privateCount: 74,
    },
    circumscriptions: [
      { name: 'Houéyogbé', schoolCount: 183, studentCount: 18886, teacherCount: 771, femalePercent: 48.2 },
      { name: 'Lokossa', schoolCount: 166, studentCount: 27357, teacherCount: 841, femalePercent: 48.9 },
      { name: 'Comè', schoolCount: 165, studentCount: 19369, teacherCount: 746, femalePercent: 48.8 },
      { name: 'Bopa', schoolCount: 129, studentCount: 14317, teacherCount: 534, femalePercent: 46.9 },
      { name: 'Grand-Popo', schoolCount: 102, studentCount: 9117, teacherCount: 388, femalePercent: 48.5 },
      { name: 'Athiémé', schoolCount: 91, studentCount: 12761, teacherCount: 390, femalePercent: 48.2 },
    ],
    labelOffset: { x: -5, y: 5 },
  },
  {
    code: 'OU',
    name: 'Ouémé',
    capital: 'Porto-Novo',
    area: 2807,
    population: 1096740,
    schoolCount: 2660,
    teacherCount: 9560,
    studentCount: 303832,
    femalePercent: 48.4,
    publicCount: 938,
    privateCount: 1722,
    communes: ['Porto-Novo', 'Sèmè-Podji', 'Akpro-Missérété', 'Adjarra', 'Avrankou', 'Dangbo', 'Adjohoun', 'Bonou', 'Aguégués'],
    secondaire: {
      schoolCount: 575,
      studentCount: 191593,
      teacherCount: 10642,
      femalePercent: 50.3,
      publicCount: 89,
      privateCount: 486,
    },
    circumscriptions: [
      { name: 'Porto-Novo 1', schoolCount: 470, studentCount: 40555, teacherCount: 1523, femalePercent: 49.1 },
      { name: 'Sèmè-Podji 2', schoolCount: 342, studentCount: 36365, teacherCount: 1302, femalePercent: 49 },
      { name: 'Akpro-Missérété', schoolCount: 339, studentCount: 46776, teacherCount: 1308, femalePercent: 47.6 },
      { name: 'Sèmè-Podji 1', schoolCount: 325, studentCount: 31972, teacherCount: 1081, femalePercent: 48.6 },
      { name: 'Adjarra', schoolCount: 303, studentCount: 30657, teacherCount: 1052, femalePercent: 48.5 },
      { name: 'Avrankou', schoolCount: 290, studentCount: 42614, teacherCount: 1203, femalePercent: 48.4 },
      { name: 'Porto-Novo 2', schoolCount: 184, studentCount: 15972, teacherCount: 553, femalePercent: 48.7 },
      { name: 'Dangbo', schoolCount: 171, studentCount: 23754, teacherCount: 656, femalePercent: 46.9 },
      { name: 'Adjohoun', schoolCount: 124, studentCount: 19161, teacherCount: 463, femalePercent: 48.5 },
      { name: 'Bonou', schoolCount: 75, studentCount: 10955, teacherCount: 280, femalePercent: 48.7 },
      { name: 'Aguégués', schoolCount: 37, studentCount: 5051, teacherCount: 139, femalePercent: 49.2 },
    ],
    labelOffset: { x: 8, y: 0 },
  },
  {
    code: 'PL',
    name: 'Plateau',
    capital: 'Pobè',
    area: 3264,
    population: 622372,
    schoolCount: 928,
    teacherCount: 3505,
    studentCount: 139774,
    femalePercent: 47,
    publicCount: 624,
    privateCount: 304,
    communes: ['Kétou', 'Ifangni', 'Adja-Ouèrè', 'Pobè', 'Sakété'],
    secondaire: {
      schoolCount: 132,
      studentCount: 57815,
      teacherCount: 2684,
      femalePercent: 47.1,
      publicCount: 65,
      privateCount: 67,
    },
    circumscriptions: [
      { name: 'Kétou', schoolCount: 226, studentCount: 38155, teacherCount: 849, femalePercent: 46 },
      { name: 'Ifangni', schoolCount: 195, studentCount: 25999, teacherCount: 772, femalePercent: 48.3 },
      { name: 'Adja-Ouèrè', schoolCount: 177, studentCount: 28133, teacherCount: 664, femalePercent: 46.6 },
      { name: 'Pobè', schoolCount: 169, studentCount: 27006, teacherCount: 627, femalePercent: 46.5 },
      { name: 'Sakété', schoolCount: 161, studentCount: 20481, teacherCount: 593, femalePercent: 48.2 },
    ],
    labelOffset: { x: 5, y: 5 },
  },
  {
    code: 'ZO',
    name: 'Zou',
    capital: 'Abomey',
    area: 5106,
    population: 852772,
    schoolCount: 1509,
    teacherCount: 5872,
    studentCount: 208339,
    femalePercent: 47.8,
    publicCount: 1097,
    privateCount: 412,
    communes: ['Bohicon', 'Za-Kpota', 'Djidja', 'Abomey', 'Zogbodomey', 'Agbangnizou', 'Zagnanado', 'Ouinhi', 'Covè'],
    secondaire: {
      schoolCount: 218,
      studentCount: 85349,
      teacherCount: 4028,
      femalePercent: 45.1,
      publicCount: 93,
      privateCount: 125,
    },
    circumscriptions: [
      { name: 'Bohicon 2', schoolCount: 231, studentCount: 31494, teacherCount: 909, femalePercent: 48.7 },
      { name: 'Za-Kpota', schoolCount: 199, studentCount: 32771, teacherCount: 805, femalePercent: 46.7 },
      { name: 'Djidja', schoolCount: 192, studentCount: 22543, teacherCount: 701, femalePercent: 46.2 },
      { name: 'Abomey', schoolCount: 187, studentCount: 24977, teacherCount: 703, femalePercent: 48.8 },
      { name: 'Zogbodomey', schoolCount: 164, studentCount: 25900, teacherCount: 642, femalePercent: 47.2 },
      { name: 'Bohicon 1', schoolCount: 140, studentCount: 23705, teacherCount: 632, femalePercent: 49.3 },
      { name: 'Agbangnizou', schoolCount: 133, studentCount: 17555, teacherCount: 534, femalePercent: 47.9 },
      { name: 'Zagnanado', schoolCount: 100, studentCount: 8748, teacherCount: 329, femalePercent: 47 },
      { name: 'Ouinhi', schoolCount: 89, studentCount: 9465, teacherCount: 316, femalePercent: 45.9 },
      { name: 'Covè', schoolCount: 74, studentCount: 11181, teacherCount: 301, femalePercent: 49.2 },
    ],
    labelOffset: { x: 0, y: 5 },
  },
];

/** Stats globales calculées — Primaire */
export const BENIN_TOTALS = {
  schools: BENIN_DEPARTMENTS.reduce((s, d) => s + d.schoolCount, 0),
  teachers: BENIN_DEPARTMENTS.reduce((s, d) => s + d.teacherCount, 0),
  students: BENIN_DEPARTMENTS.reduce((s, d) => s + d.studentCount, 0),
  departments: BENIN_DEPARTMENTS.length,
  publicCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.publicCount, 0),
  privateCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.privateCount, 0),
};

/** Stats globales — Secondaire */
export const BENIN_SECONDAIRE_TOTALS = {
  schools: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.schoolCount, 0),
  teachers: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.teacherCount, 0),
  students: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.studentCount, 0),
  publicCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.publicCount, 0),
  privateCount: BENIN_DEPARTMENTS.reduce((s, d) => s + d.secondaire.privateCount, 0),
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
