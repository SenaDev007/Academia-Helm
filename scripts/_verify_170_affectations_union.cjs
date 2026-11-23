// Tâche 170 — Vérification fonctionnelle de l'UNION profils + sans profil
// (AssignmentsWorkspace) : rejoue la logique exacte du composant avec les
// données réelles de Mon Avenir Plus (15 enseignants secondaire dont 14 sans
// profil, 19 maternelle dont 1 sans profil).
const assert = require('assert');

// ── Extraits EXACTS du composant (mêmes fonctions) ──
const levelCategoryOf = (label) => {
  const n = (label || '').toUpperCase();
  if (n.includes('MATERN') || n.includes('PRIMA') || n.includes('PRIM')) return 'MATERNEL_PRIMAIRE';
  if (n.includes('SECOND')) return 'SECONDAIRE';
  return 'AUTRE';
};

function buildEligible(teachers, teachersWithPhotos, isBilingual, currentTrack) {
  const getTeacherLanguages = (teacherId) => {
    const t = teachersWithPhotos.find(t => t.id === teacherId);
    return t?.assignedLanguages || [];
  };
  const withProfile = teachers.filter(t => {
    if (isBilingual) {
      const langs = getTeacherLanguages(t.teacher.id);
      const teacherLang = langs.length > 0 ? langs[0] : null;
      if (currentTrack === 'EN' && teacherLang !== 'EN') return false;
      if (currentTrack === 'FR' && teacherLang === 'EN') return false;
    }
    return true;
  });
  const profiledIds = new Set(teachers.map(t => t.teacher.id));
  const withoutProfile = teachersWithPhotos
    .filter(t => !profiledIds.has(t.id) && (t.status || 'active') === 'active')
    .map(t => ({
      id: `no-profile-${t.id}`,
      teacherId: t.id,
      teacher: {
        id: t.id,
        firstName: t.firstName || '',
        lastName: t.lastName || '',
        matricule: t.matricule || '',
        schoolLevel: t.schoolLevel || null,
      },
      maxWeeklyHours: 18,
      subjectQualifications: [],
      levelAuthorizations: [],
      assignedLanguages: t.assignedLanguages || null,
      __withoutProfile: true,
    }));
  return [...withProfile, ...withoutProfile];
}

function getTeacherCategory(teachersWithPhotos, teachers, teacherId) {
  const mirror = teachersWithPhotos.find(x => x.id === teacherId);
  const fromMirror = levelCategoryOf(`${mirror?.schoolLevel?.name || ''} ${mirror?.schoolLevel?.code || ''}`);
  if (fromMirror !== 'AUTRE') return fromMirror;
  const profile = teachers.find(x => x.teacher?.id === teacherId);
  return levelCategoryOf(`${profile?.teacher?.schoolLevel?.name || ''} ${profile?.teacher?.schoolLevel?.code || ''}`);
}

// ── Données conformes à la base réelle (Mon Avenir Plus, 23/11/2026 AVANT
//    le correctif de données) ──
// teachersWithPhotos (GET /api/teachers, sélecteur sur Secondaire → 15)
const SECOND = { id: '6ec8a1e5-df45-43f2-afbc-266ed153b828', code: 'MATERNELLE', name: 'Maternelle' };
const SECONDAIRE = { id: '95fae326-6da3-4a4a-a95c-6f5164dd5024', code: 'SECONDAIRE', name: 'Secondaire' };
const teachersWithPhotos_secondaire = [
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `sec-${22 + i}`,
    firstName: 'Prof', lastName: `Excel${i}`,
    matricule: `CSPMON-P-26-000${22 + i}`,
    status: 'active',
    schoolLevel: SECONDAIRE,
  })),
  { id: 'sec-doula', firstName: 'Narcisse Boris', lastName: 'DOUGLA KOSSI', matricule: 'CSPMON-P-26-00002', status: 'active', schoolLevel: SECONDAIRE },
];
// Profils académiques AVANT correctif : 18 maternelle + 1 secondaire (DOUGLA)
const teachers_profiles = [
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `p-mat-${i}`,
    teacherId: `mat-${i}`,
    maxWeeklyHours: 18,
    teacher: { id: `mat-${i}`, firstName: 'Inst', lastName: `Mat${i}`, matricule: `CSPMON-P-26-0000${i}`, schoolLevel: SECOND },
    subjectQualifications: [], levelAuthorizations: [],
  })),
  {
    id: 'p-doula',
    teacherId: 'sec-doula',
    maxWeeklyHours: 18,
    teacher: { id: 'sec-doula', firstName: 'Narcisse Boris', lastName: 'DOUGLA KOSSI', matricule: 'CSPMON-P-26-00002', schoolLevel: SECONDAIRE },
    subjectQualifications: [], levelAuthorizations: [],
  },
];

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓', label); } else { fail++; console.log('  ✗', label); } };

// 1. AVANT le fix (liste = profils seuls) : les 14 Excel absents
const oldList = teachers_profiles;
const oldSec = oldList.filter(t => getTeacherCategory(teachersWithPhotos_secondaire, teachers_profiles, t.teacher.id) === 'SECONDAIRE');
ok(oldSec.length === 1 && oldSec[0].teacher.matricule === 'CSPMON-P-26-00002',
  'AVANT : classe secondaire → SEUL DOUGLA (1/15) listé — les 14 Excel invisibles (le bug promoteur)');

// 2. APRÈS le fix : l'union contient les 14 sans profil
const eligible = buildEligible(teachers_profiles, teachersWithPhotos_secondaire, false, null);
ok(eligible.length === 33, `union = 19 profils + 14 sans profil (DOUGLA présent des deux côtés, pas de doublon) → 33 attendu (obtenu ${eligible.length})`);
const secList = eligible.filter(t => getTeacherCategory(teachersWithPhotos_secondaire, teachers_profiles, t.teacher.id) === 'SECONDAIRE');
ok(secList.length === 15, `classe secondaire → les 15 enseignants du secondaire listés (obtenu ${secList.length})`);
ok(secList.filter(t => t.__withoutProfile).length === 14, 'les 14 Excel (sans profil) apparaissent avec le badge « profil à initialiser »');

// 3. Sélecteur de niveau = Primaire → miroir /teachers VIDE (aucun enseignant
//    de niveau Primaire en base) : la catégorisation retombe sur le
//    schoolLevel du PROFIL (fix du repli)
const teachersWithPhotos_primaire = [];
const eligible_p = buildEligible(teachers_profiles, teachersWithPhotos_primaire, false, null);
const matList = eligible_p.filter(t => getTeacherCategory(teachersWithPhotos_primaire, teachers_profiles, t.teacher.id) === 'MATERNEL_PRIMAIRE');
ok(matList.length === 18, `classe primaire (miroir vide) → 18 maternel-primaire toujours catégorisés via le profil (obtenu ${matList.length})`);

// 4. Les entrées sans profil ont maxWeeklyHours=18 + matricule pour l'affectation
const synth = eligible.find(t => t.__withoutProfile);
ok(!!synth && synth.maxWeeklyHours === 18 && !!synth.teacher.matricule && synth.teacher.schoolLevel === SECONDAIRE,
  'entrée synthétique : 18h/sem max, matricule et niveau portés (affectable)');

// 5. Après le correctif de données (profils créés) : union = profils seuls,
//    aucun doublon, les 15 secondaire restent listés
const afterFix = [
  ...teachers_profiles,
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `p-sec-${i}`, teacherId: `sec-${22 + i}`, maxWeeklyHours: 18,
    teacher: { id: `sec-${22 + i}`, firstName: 'Prof', lastName: `Excel${i}`, matricule: `CSPMON-P-26-000${22 + i}`, schoolLevel: SECONDAIRE },
    subjectQualifications: [], levelAuthorizations: [],
  })),
];
const eligible_after = buildEligible(afterFix, teachersWithPhotos_secondaire, false, null);
ok(eligible_after.length === 33 && eligible_after.filter(t => t.__withoutProfile).length === 0,
  'après correctif de données : 33 profils (19+14), plus aucune entrée synthétique (les deux fixes sont cohérents)');
const secAfter = eligible_after.filter(t => getTeacherCategory(teachersWithPhotos_secondaire, afterFix, t.teacher.id) === 'SECONDAIRE');
ok(secAfter.length === 15, 'après correctif de données : classe secondaire → les 15 enseignants du secondaire');

console.log(`\n${pass}/${pass + fail} assertions passées`);
process.exit(fail ? 1 : 0);
