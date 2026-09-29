/**
 * Seed matières secondaires pour Academia Helm (tenant de test)
 * Crée les ClassSubject pour les classes secondaires (6e → Terminale D)
 * selon le système secondaire béninois.
 *
 * Usage: node scripts/seed-academia-helm-secondaire-matieres.mjs
 *
 * Flux respecté :
 *   1. Les Subject existent déjà (créés via /api/subjects)
 *   2. Les AcademicClass existent (créées via /api/pedagogy/academic-structure/classes)
 *   3. On crée les ClassSubject (matière → classe) avec coefficients
 *
 * Matières secondaire + coefficients (système béninois) :
 *   Lettres: Français(4), Anglais(2), Histoire-Géographie(2), Philosophie(Term only, 2)
 *   Sciences: Mathématiques(4), Physique-Chimie(3), SVT(2), EST(junior only, 2)
 *   Autres: EPS(1), Conduite(1), Informatique(1)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ⭐ Matières secondaire avec coefficients par palier
//    Junior (6e/5e): pas de Philosophie, EST au lieu de Physique-Chimie+SVT
//    Senior (4e→Term): Physique-Chimie + SVT + Philosophie (Term only)
const SUBJECTS_JUNIOR = [
  { name: 'Mathématiques', coefficient: 4, weeklyHours: 6 },
  { name: 'Français', coefficient: 4, weeklyHours: 6 },
  { name: 'Anglais', coefficient: 2, weeklyHours: 3 },
  { name: 'Histoire-Géographie', coefficient: 2, weeklyHours: 3 },
  { name: 'EST', coefficient: 2, weeklyHours: 3 },
  { name: 'EPS', coefficient: 1, weeklyHours: 2 },
  { name: 'Conduite', coefficient: 1, weeklyHours: 0 },
  { name: 'Informatique', coefficient: 1, weeklyHours: 1 },
];

const SUBJECTS_SENIOR = [
  { name: 'Mathématiques', coefficient: 4, weeklyHours: 6 },
  { name: 'Français', coefficient: 4, weeklyHours: 5 },
  { name: 'Anglais', coefficient: 2, weeklyHours: 3 },
  { name: 'Histoire-Géographie', coefficient: 2, weeklyHours: 3 },
  { name: 'Physique-Chimie', coefficient: 3, weeklyHours: 5 },
  { name: 'SVT', coefficient: 2, weeklyHours: 3 },
  { name: 'EPS', coefficient: 1, weeklyHours: 2 },
  { name: 'Conduite', coefficient: 1, weeklyHours: 0 },
  { name: 'Informatique', coefficient: 1, weeklyHours: 1 },
];

const SUBJECTS_TERM = [
  ...SUBJECTS_SENIOR.filter(s => s.name !== 'Histoire-Géographie'),
  { name: 'Philosophie', coefficient: 2, weeklyHours: 4 },
  { name: 'Histoire-Géographie', coefficient: 2, weeklyHours: 3 },
];

async function main() {
  console.log('🚀 Seed matières secondaires — Academia Helm\n');

  // Trouver le tenant Academia Helm
  const tenants = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name FROM tenants WHERE name ILIKE '%academia%helm%' OR slug ILIKE '%academia%helm%' LIMIT 1`
  );
  if (!tenants || tenants.length === 0) {
    console.error('❌ Tenant Academia Helm non trouvé');
    process.exit(1);
  }
  const tenantId = tenants[0].id;
  console.log(`✅ Tenant: ${tenants[0].name} (${tenantId})`);

  // Trouver l'année académique courante
  const years = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, label FROM academic_years WHERE "tenantId" = $1 ORDER BY "startDate" DESC LIMIT 1`,
    tenantId
  );
  if (!years || years.length === 0) {
    console.error('❌ Année académique non trouvée');
    process.exit(1);
  }
  const academicYearId = years[0].id;
  console.log(`✅ Année: ${years[0].label} (${academicYearId})\n`);

  // Trouver les classes secondaires
  const classes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT ac.id, ac.name, sl.code as level_code
     FROM pedagogy_academic_classes ac
     LEFT JOIN school_levels sl ON sl.id = ac."schoolLevelId"
     WHERE ac."tenantId" = $1 AND ac."academicYearId" = $2
       AND sl.code = 'SECONDAIRE'
       AND ac."isActive" != false
     ORDER BY ac.name`,
    tenantId, academicYearId
  );

  if (!classes || classes.length === 0) {
    console.error('❌ Aucune classe secondaire trouvée');
    process.exit(1);
  }
  console.log(`✅ ${classes.length} classe(s) secondaire(s) trouvée(s):\n`);
  for (const cls of classes) {
    console.log(`   - ${cls.name} (${cls.id})`);
  }
  console.log('');

  // Trouver tous les Subject du tenant
  const subjects = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, name FROM subjects WHERE "tenantId" = $1 ORDER BY name`,
    tenantId
  );
  const subjectMap = new Map(subjects.map(s => [s.name.toLowerCase(), s]));
  console.log(`✅ ${subjects.length} Subject(s) trouvé(s)`);

  let created = 0;
  let skipped = 0;

  for (const cls of classes) {
    const className = cls.name.toUpperCase();
    const isJunior = className.includes('6E') || className.includes('5E') || className.includes('6EME') || className.includes('5EME');
    const isTerm = className.includes('TERM') || className.includes('TERMINALE');

    let subjectList = isJunior ? SUBJECTS_JUNIOR : (isTerm ? SUBJECTS_TERM : SUBJECTS_SENIOR);

    for (const subjDef of subjectList) {
      const subject = subjectMap.get(subjDef.name.toLowerCase());
      if (!subject) {
        console.log(`   ⚠️  Subject "${subjDef.name}" non trouvé — ignoré pour ${cls.name}`);
        continue;
      }

      // Vérifier si le ClassSubject existe déjà
      const existing = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id FROM class_subjects WHERE "academicClassId" = $1 AND "subjectId" = $2 AND "academicYearId" = $3 LIMIT 1`,
        cls.id, subject.id, academicYearId
      );

      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }

      // Créer le ClassSubject
      await prisma.$executeRawUnsafe(
        `INSERT INTO class_subjects (id, "tenantId", "academicClassId", "subjectId", "academicYearId", "weeklyHours", "coefficient", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, now(), now())`,
        tenantId, cls.id, subject.id, academicYearId, subjDef.weeklyHours, subjDef.coefficient
      );
      created++;
      console.log(`   ✅ ${cls.name} → ${subjDef.name} (coef: ${subjDef.coefficient})`);
    }
  }

  console.log(`\n📊 Résumé: ${created} ClassSubject(s) créé(s), ${skipped} déjà existant(s)`);
  console.log('✅ Terminé!');
}

main()
  .catch(e => { console.error('❌ Erreur:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
