/**
 * Corrige les noms d'élèves avec abréviations manquant de points.
 * Exemple : "AFFODJOU O F Esdras" → "AFFODJOU O. F. Esdras"
 * 
 * Règle : une lettre majuscule seule (initiale) suivie d'un espace ou en fin de nom
 * doit avoir un point après elle. On ne modifie pas les noms qui ont déjà des points.
 */

const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';

/**
 * Ajoute des points après les initiales (lettres majuscules seules).
 * Exemples :
 *   "AFFODJOU O F Esdras" → "AFFODJOU O. F. Esdras"
 *   "ABDOULAYE T Saratou" → "ABDOULAYE T. Saratou"
 *   "OROU G M E Exaucee" → "OROU G. M. E. Exaucee"
 *   "ABOUDOU Fadil" → "ABOUDOU Fadil" (pas de changement, Fadil n'est pas une initiale)
 *   "ABDOU K Fridaoussath" → "ABDOU K. Fridaoussath"
 */
function addDotsToInitials(name) {
  if (!name) return name;
  
  // Split par espaces
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  
  // Pour chaque partie, si c'est une seule lettre majuscule (sans point), ajouter un point
  const correctedParts = parts.map(part => {
    // Une seule lettre majuscule sans point → ajouter point
    if (/^[A-Z]$/.test(part)) {
      return part + '.';
    }
    // Déjà a un point → laisser tel quel
    if (/^[A-Z]\.$/.test(part)) {
      return part;
    }
    return part;
  });
  
  return correctedParts.join(' ');
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Correction des noms avec abréviations manquant de points ===\n');

  // Charger tous les élèves
  const res = await client.query(`
    SELECT id, "firstName", "lastName", matricule
    FROM students
    WHERE "tenantId" = $1
    ORDER BY "lastName", "firstName"
  `, [TENANT_ID]);

  console.log(`Total élèves: ${res.rows.length}\n`);

  let updated = 0;
  let examples = [];

  for (const student of res.rows) {
    const originalLast = student.lastName || '';
    const originalFirst = student.firstName || '';
    
    const correctedLast = addDotsToInitials(originalLast);
    const correctedFirst = addDotsToInitials(originalFirst);
    
    if (correctedLast !== originalLast || correctedFirst !== originalFirst) {
      await client.query(`
        UPDATE students SET "lastName" = $1, "firstName" = $2, "updatedAt" = NOW()
        WHERE id = $3
      `, [correctedLast, correctedFirst, student.id]);
      
      updated++;
      if (examples.length < 20) {
        examples.push({
          matricule: student.matricule,
          before: `${originalLast} ${originalFirst}`,
          after: `${correctedLast} ${correctedFirst}`,
        });
      }
    }
  }

  console.log(`Élèves corrigés: ${updated}`);
  console.log(`\nExemples:`);
  examples.forEach(e => {
    console.log(`  ${e.matricule} | ${e.before} → ${e.after}`);
  });

  await client.end();
  console.log('\n✅ Correction terminée.');
}

main().catch(e => { console.error(e); process.exit(1); });
