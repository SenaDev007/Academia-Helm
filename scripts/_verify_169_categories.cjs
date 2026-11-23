// ⭐ 169 — Test fonctionnel des helpers de catégorisation (vrai code extrait).
const fs = require('fs');
const path = require('path');

function extractMethodFromFile(file, name) {
  const SRC = fs.readFileSync(file, 'utf8');
  const start = SRC.indexOf(`const ${name} =`);
  if (start === -1) throw new Error(`${name} introuvable dans ${file}`);
  // jusqu'à la fermeture de la fonction fléchée + point-virgule
  let i = start, depth = 0, j = -1;
  for (let k = SRC.indexOf('=>', start); k < SRC.length; k++) {
    if (SRC[k] === '{') depth++;
    else if (SRC[k] === '}') {
      depth--;
      if (depth === 0) { j = k; break; }
    }
  }
  return SRC.slice(start, SRC.indexOf(';', j) + 1);
}

const WS = '/home/z/my-project/academia-helm/apps/web-app/src/components/pedagogy/teachers/TeachersAcademicWorkspace.tsx';
const AS = '/home/z/my-project/academia-helm/apps/web-app/src/components/pedagogy/assignments/AssignmentsWorkspace.tsx';

const teacherCategorySrc = extractMethodFromFile(WS, 'teacherCategory');
const levelCategoryOfSrc = extractMethodFromFile(AS, 'levelCategoryOf');

const ts = require('typescript');
const combined = `${teacherCategorySrc}\n${levelCategoryOfSrc}\nmodule.exports = { teacherCategory, levelCategoryOf };\n`;
const transpiled = ts.transpileModule(combined, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
fs.writeFileSync('/tmp/_cat_169.cjs', transpiled);
const { teacherCategory, levelCategoryOf } = require('/tmp/_cat_169.cjs');

const assert = (cond, label) => { if (!cond) { console.error('FAIL:', label); process.exit(1); } console.log('✓', label); };

// Niveaux réels du tenant Mon Avenir Plus (school_levels / pedagogy_academic_levels)
assert(teacherCategory({ schoolLevel: { name: 'Maternelle', code: 'MATERNELLE' } }) === 'MATERNEL_PRIMAIRE', 'Maternelle → MATERNEL_PRIMAIRE');
assert(teacherCategory({ schoolLevel: { name: 'Primaire', code: 'PRIMAIRE' } }) === 'MATERNEL_PRIMAIRE', 'Primaire → MATERNEL_PRIMAIRE');
assert(teacherCategory({ schoolLevel: { name: 'Secondaire', code: 'SECONDAIRE' } }) === 'SECONDAIRE', 'Secondaire → SECONDAIRE');
assert(teacherCategory({ schoolLevel: null, schoolLevelName: null }) === 'AUTRE', 'aucun niveau → AUTRE (pas de filtrage arbitraire)');
assert(teacherCategory({ schoolLevelName: 'Maternelle' }) === 'MATERNEL_PRIMAIRE', 'schoolLevelName seul (enrichedTeachers)');

assert(levelCategoryOf('Secondaire') === 'SECONDAIRE', 'classe de niveau Secondaire → SECONDAIRE');
assert(levelCategoryOf('Maternelle') === 'MATERNEL_PRIMAIRE', 'classe Maternelle → MATERNEL_PRIMAIRE');
assert(levelCategoryOf('Primaire') === 'MATERNEL_PRIMAIRE', 'classe Primaire → MATERNEL_PRIMAIRE');
assert(levelCategoryOf(undefined) === 'AUTRE', 'classe sans niveau → AUTRE');

// Simulation du filtre multigrade (maternel-primaire uniquement)
const allTeachers = [
  { id: 't1', schoolLevel: { name: 'Maternelle' } },
  { id: 't2', schoolLevel: { name: 'Primaire' } },
  { id: 't3', schoolLevel: { name: 'Secondaire' } },
  { id: 't4' },
];
const matPri = allTeachers.filter(t => {
  const lvl = `${t.schoolLevel?.name || ''} ${t.schoolLevel?.code || ''}`.toUpperCase();
  return lvl.includes('MATERN') || lvl.includes('PRIMA') || lvl.includes('PRIM');
});
assert(matPri.length === 2 && matPri.every(t => ['t1', 't2'].includes(t.id)), 'multigrade : seuls maternel-primaire listés (2/4)');

// Simulation du filtre affectation par classe (secondaire → profs secondaire)
const teachersWithPhotos = [
  { id: 't1', schoolLevel: { name: 'Maternelle' } },
  { id: 't3', schoolLevel: { name: 'Secondaire' } },
];
const eligible = [{ teacher: { id: 't1' } }, { teacher: { id: 't3' } }];
const selectedClassCategory = levelCategoryOf('Secondaire');
const getTeacherCategory = (teacherId) => {
  const t = teachersWithPhotos.find(x => x.id === teacherId);
  return levelCategoryOf(`${t?.schoolLevel?.name || ''} ${t?.schoolLevel?.code || ''}`);
};
const levelEligible = eligible.filter(t => getTeacherCategory(t.teacher.id) === selectedClassCategory);
assert(levelEligible.length === 1 && levelEligible[0].teacher.id === 't3', 'affectation classe secondaire → enseignant secondaire seul listé');

// Prof principal (secondaire uniquement)
const mainTeacherList = eligible.filter(t => getTeacherCategory(t.teacher.id) === 'SECONDAIRE');
assert(mainTeacherList.length === 1 && mainTeacherList[0].teacher.id === 't3', 'prof principal : enseignant secondaire seul proposé');

console.log('\nCatégorisation : tous les tests passent.');
