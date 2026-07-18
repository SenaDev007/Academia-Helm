/**
 * Comparaison Excel ↔ DB pour Mon Avenir Plus (2025-2026)
 *
 * Pour chaque classe du fichier Excel :
 *   - Lire les colonnes : Noms, Arriéré, Inscript, P1, P2, P3, P4, P5, P6,
 *     Total Scolarité, Total des paiements
 *   - Comparer avec les données DB :
 *     * account_breakdowns.paidAmount pour INSCRIPTION et TUITION
 *     * finance_transaction_allocations pour les paiements par tranche
 *   - Identifier les écarts (élèves avec montant DB ≠ montant Excel)
 *
 * Génère un rapport :
 *   - Stats globales (élèves vérifiés, élèves conformes, élèves avec écart)
 *   - Top 20 écarts (élève, classe, montant Excel, montant DB, écart)
 */
const XLSX = require('xlsx');
const { Client } = require('/home/z/my-project/node_modules/pg');

const DATABASE_URL = 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require';

const TENANT_ID = 'e0aaa032-bf95-494a-8dfb-7ea62d9fcdeb';
const ACADEMIC_YEAR_ID = '78e862b0-ff11-49dc-9c5f-cc455b402c7b';

const EXCEL_FILES = [
  '/home/z/my-project/upload/POINT PRIMAIRE 2025-2026.xlsx',
  '/home/z/my-project/upload/POINT SECONDAIRE  2025-2026.xlsx',
];

function readExcelFile(filePath) {
  const wb = XLSX.readFile(filePath);
  const result = []; // [{ className, students: [{ name, arriere, inscript, p1, p2, p3, p4, p5, p6, totalScolarite, totalPayments }] }]
  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'RECAP') continue;
    const sheet = wb.Sheets[sheetName];
    // ⭐ raw: true pour récupérer les valeurs numériques réelles (8000 et non "8,000")
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
    const className = sheetName.trim();
    const students = [];
    // Data starts at row 5 (index 5) — header rows are 0-4
    for (let i = 5; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[1]) continue; // Skip empty rows
      const name = String(row[1]).trim();
      if (!name || name === 'Noms et Prénoms') continue;
      // Skip "TOTAL" rows
      if (name.toUpperCase().includes('TOTAL')) continue;
      const num = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        // Si c'est déjà un nombre, on l'utilise tel quel
        if (typeof val === 'number') return val;
        // Sinon, on parse la string (en retirant espaces et virgules)
        const n = Number(String(val).replace(/[\s,]/g, ''));
        return isNaN(n) ? 0 : n;
      };
      students.push({
        name,
        arriere: num(row[2]),
        inscript: num(row[4]),
        p1: num(row[8]),
        p2: num(row[9]),
        p3: num(row[10]),
        p4: num(row[11]),
        p5: num(row[12]),
        p6: num(row[13]),
        totalScolarite: num(row[14]),
        totalPayments: num(row[16]),
      });
    }
    result.push({ className, students });
  }
  return result;
}

// Normaliser un nom pour comparaison (supprimer accents, espaces, casse)
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Construire plusieurs variantes de nom pour matcher Excel (NOM Prénom)
// vs DB (Prénom NOM). On essaie toutes les combinaisons.
function buildNameVariants(firstName, lastName) {
  const variants = new Set();
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  // Format DB : "firstName lastName"
  variants.add(normalizeName(f + ' ' + l));
  // Format inverse : "lastName firstName" (format Excel)
  variants.add(normalizeName(l + ' ' + f));
  // Sans les initiales (ex: "BARANON M." → "BARANON")
  const lNoInit = l.replace(/\s+[A-Z]\.?\s*/g, ' ').trim();
  const fNoInit = f.replace(/\s+[A-Z]\.?\s*/g, ' ').trim();
  if (lNoInit !== l) {
    variants.add(normalizeName(f + ' ' + lNoInit));
    variants.add(normalizeName(lNoInit + ' ' + f));
  }
  if (fNoInit !== f) {
    variants.add(normalizeName(fNoInit + ' ' + l));
    variants.add(normalizeName(l + ' ' + fNoInit));
  }
  // Sans aucune initiale
  if (lNoInit !== l || fNoInit !== f) {
    variants.add(normalizeName(fNoInit + ' ' + lNoInit));
    variants.add(normalizeName(lNoInit + ' ' + fNoInit));
  }
  // Retirer les chaînes vides
  variants.delete('');
  return Array.from(variants);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log('=== Lecture des fichiers Excel ===\n');
  let excelClasses = [];
  for (const f of EXCEL_FILES) {
    console.log('  ' + f);
    const classes = readExcelFile(f);
    console.log(`    ${classes.length} classes: ${classes.map(c => c.className + '(' + c.students.length + ')').join(', ')}`);
    excelClasses = excelClasses.concat(classes);
  }
  console.log(`\nTotal: ${excelClasses.length} classes, ${excelClasses.reduce((s, c) => s + c.students.length, 0)} élèves\n`);

  // Charger données DB : pour chaque élève, account_breakdowns + transactions
  console.log('=== Chargement données DB ===\n');
  const dbData = await client.query(`
    SELECT
      s.id as student_id,
      s."firstName",
      s."lastName",
      s."firstName" || ' ' || s."lastName" as student_name,
      s.matricule,
      c.name as class_name,
      sl.code as level_code,
      -- Account breakdowns
      (SELECT ab."paidAmount" FROM account_breakdowns ab
       JOIN fee_structures fs ON fs.id = ab."feeStructureId"
       JOIN student_accounts sa2 ON sa2.id = ab."studentAccountId"
       WHERE sa2."studentId" = s.id AND fs."feeType" = 'INSCRIPTION') as inscription_paid,
      (SELECT ab."paidAmount" FROM account_breakdowns ab
       JOIN fee_structures fs ON fs.id = ab."feeStructureId"
       JOIN student_accounts sa2 ON sa2.id = ab."studentAccountId"
       WHERE sa2."studentId" = s.id AND fs."feeType" = 'TUITION') as tuition_paid,
      (SELECT ab."initialAmount" FROM account_breakdowns ab
       JOIN fee_structures fs ON fs.id = ab."feeStructureId"
       JOIN student_accounts sa2 ON sa2.id = ab."studentAccountId"
       WHERE sa2."studentId" = s.id AND fs."feeType" = 'INSCRIPTION') as inscription_expected,
      (SELECT ab."initialAmount" FROM account_breakdowns ab
       JOIN fee_structures fs ON fs.id = ab."feeStructureId"
       JOIN student_accounts sa2 ON sa2.id = ab."studentAccountId"
       WHERE sa2."studentId" = s.id AND fs."feeType" = 'TUITION') as tuition_expected,
      -- Arriéré
      (SELECT COALESCE(SUM(fa."totalDue"), 0) FROM fee_arrears fa
       WHERE fa."studentId" = s.id AND fa."academicYearId" = $2
       AND fa."tenantId" = $1) as arrear_expected,
      (SELECT COALESCE(SUM(fa."totalPaid"), 0) FROM fee_arrears fa
       WHERE fa."studentId" = s.id AND fa."academicYearId" = $2
       AND fa."tenantId" = $1) as arrear_paid
    FROM students s
    JOIN student_enrollments se ON se."studentId" = s.id AND se."academicYearId" = $2
    LEFT JOIN classes c ON c.id = se."classId"
    LEFT JOIN school_levels sl ON sl.id = c."schoolLevelId"
    WHERE s."tenantId" = $1
    ORDER BY c.name, s."lastName"
  `, [TENANT_ID, ACADEMIC_YEAR_ID]);
  console.log(`  ${dbData.rows.length} élèves en DB\n`);

  // Index DB par nom normalisé (toutes les variantes)
  const dbByNameVariants = new Map();
  for (const r of dbData.rows) {
    const variants = buildNameVariants(r.firstName, r.lastName);
    for (const v of variants) {
      // Si plusieurs élèves matchent la même variante, on garde le premier.
      // (en pratique, ça ne devrait pas arriver avec un nom complet)
      if (!dbByNameVariants.has(v)) {
        dbByNameVariants.set(v, r);
      }
    }
  }
  console.log(`  ${dbByNameVariants.size} variantes de noms indexées\n`);

  // Comparer
  console.log('=== Comparaison Excel ↔ DB ===\n');
  let stats = {
    totalCompared: 0,
    matched: 0,
    notFoundInDb: 0,
    withDiscrepancy: 0,
    exactMatch: 0,
  };
  const discrepancies = [];

  for (const excelClass of excelClasses) {
    console.log(`\n--- Classe: ${excelClass.className} (${excelClass.students.length} élèves) ---`);
    let classMatched = 0;
    let classDiscrepancy = 0;
    let classNotFound = 0;

    for (const excelStudent of excelClass.students) {
      stats.totalCompared++;
      const normName = normalizeName(excelStudent.name);
      // Essayer plusieurs stratégies de matching
      let dbStudent = dbByNameVariants.get(normName);

      // Si pas trouvé, essayer en permutant les parties du nom Excel
      // (ex: "BARANON M Kadidjatou" → "Kadidjatou BARANON M")
      if (!dbStudent) {
        const parts = excelStudent.name.trim().split(/\s+/);
        if (parts.length >= 2) {
          // Dernier mot = prénom, le reste = nom
          const lastPart = parts[parts.length - 1];
          const restName = parts.slice(0, -1).join(' ');
          const reversedName = normalizeName(lastPart + ' ' + restName);
          dbStudent = dbByNameVariants.get(reversedName);
        }
      }

      // Si toujours pas trouvé, essayer en cherchant le prénom dans firstName
      // et le reste dans lastName (matching approximatif)
      if (!dbStudent) {
        const parts = excelStudent.name.trim().split(/\s+/);
        if (parts.length >= 2) {
          // Le premier mot est probablement le lastName (ex: "BARANON")
          // Le dernier est probablement le firstName (ex: "Kadidjatou")
          const possibleLastName = parts[0];
          const possibleFirstName = parts[parts.length - 1];
          for (const r of dbData.rows) {
            const dbLN = (r.lastName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const dbFN = (r.firstName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const exLN = possibleLastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const exFN = possibleFirstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (dbLN.startsWith(exLN) && dbFN.startsWith(exFN)) {
              dbStudent = r;
              break;
            }
          }
        }
      }

      if (!dbStudent) {
        stats.notFoundInDb++;
        classNotFound++;
        if (classNotFound <= 2) {
          console.log(`  ❓ Non trouvé en DB: ${excelStudent.name}`);
        }
        continue;
      }

      stats.matched++;
      classMatched++;

      const dbInscription = Number(dbStudent.inscription_paid) || 0;
      const dbTuition = Number(dbStudent.tuition_paid) || 0;
      const excelInscript = excelStudent.inscript;
      const excelTotalScolarite = excelStudent.p1 + excelStudent.p2 + excelStudent.p3 + excelStudent.p4 + excelStudent.p5 + excelStudent.p6;

      // Comparer INSCRIPTION
      const inscriptDiff = Math.abs(dbInscription - excelInscript);
      // Comparer TUITION (P1+P2+P3+P4+P5+P6)
      const tuitionDiff = Math.abs(dbTuition - excelTotalScolarite);

      const tolerance = 1; // 1 FCFA de tolérance pour arrondis
      const hasDiscrepancy = inscriptDiff > tolerance || tuitionDiff > tolerance;

      if (hasDiscrepancy) {
        stats.withDiscrepancy++;
        classDiscrepancy++;
        discrepancies.push({
          name: excelStudent.name,
          className: excelClass.className,
          excelInscript,
          dbInscription,
          inscriptDiff,
          excelTotalScolarite,
          dbTuition,
          tuitionDiff,
          excelP1: excelStudent.p1,
          excelP2: excelStudent.p2,
          excelP3: excelStudent.p3,
          excelP4: excelStudent.p4,
          excelP5: excelStudent.p5,
          excelP6: excelStudent.p6,
        });
        if (classDiscrepancy <= 3) {
          console.log(`  ⚠️  ${excelStudent.name}`);
          if (inscriptDiff > tolerance) {
            console.log(`     INSCRIPTION: Excel=${excelInscript} | DB=${dbInscription} | Δ=${inscriptDiff}`);
          }
          if (tuitionDiff > tolerance) {
            console.log(`     TUITION: Excel=${excelTotalScolarite} (P1=${excelStudent.p1}+P2=${excelStudent.p2}+P3=${excelStudent.p3}+P4=${excelStudent.p4}+P5=${excelStudent.p5}+P6=${excelStudent.p6}) | DB=${dbTuition} | Δ=${tuitionDiff}`);
          }
        }
      } else {
        stats.exactMatch++;
      }
    }
    console.log(`  Résumé: ${classMatched} matchés, ${classDiscrepancy} avec écart, ${classNotFound} non trouvés`);
  }

  console.log('\n=== STATISTIQUES GLOBALES ===');
  console.log(`  Total comparés: ${stats.totalCompared}`);
  console.log(`  Matchés en DB: ${stats.matched}`);
  console.log(`  Non trouvés: ${stats.notFoundInDb}`);
  console.log(`  Conformes (Δ < 1 FCFA): ${stats.exactMatch}`);
  console.log(`  Avec écart: ${stats.withDiscrepancy}`);
  console.log(`  Taux de conformité: ${stats.matched > 0 ? ((stats.exactMatch / stats.matched) * 100).toFixed(1) : 0}%`);

  console.log('\n=== TOP 30 ÉCARTS LES PLUS GRANDS ===');
  discrepancies.sort((a, b) => (b.inscriptDiff + b.tuitionDiff) - (a.inscriptDiff + a.tuitionDiff));
  discrepancies.slice(0, 30).forEach((d, i) => {
    console.log(`${i + 1}. ${d.name} (${d.className})`);
    if (d.inscriptDiff > 1) {
      console.log(`   INSCRIPTION: Excel=${d.excelInscript} | DB=${d.dbInscription} | Δ=${d.inscriptDiff}`);
    }
    if (d.tuitionDiff > 1) {
      console.log(`   TUITION: Excel=${d.excelTotalScolarite} (P1=${d.excelP1}+P2=${d.excelP2}+P3=${d.excelP3}+P4=${d.excelP4}+P5=${d.excelP5}+P6=${d.excelP6}) | DB=${d.dbTuition} | Δ=${d.tuitionDiff}`);
    }
  });

  await client.end();
  console.log('\n✅ Comparaison terminée');
}

main().catch(e => { console.error(e); process.exit(1); });
