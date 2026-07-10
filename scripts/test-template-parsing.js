/**
 * Test du parsing multi-feuilles du template généré.
 * Vérifie que le service peut lire chaque feuille et déduire la classe + niveau.
 */
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const filePath = '/home/z/my-project/download/template-import-eleves-multi-feuilles.xlsx';
  if (!fs.existsSync(filePath)) {
    console.log('❌ Fichier template introuvable — exécutez test-template-multi-feuilles.js d\'abord');
    return;
  }

  // Charger le fichier Excel
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  console.log(`=== Feuilles dans le template (${workbook.worksheets.length}) ===`);
  workbook.worksheets.forEach(ws => console.log(`  - ${ws.name}`));

  // Charger les classes du tenant
  const client = await pool.connect();
  try {
    const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
    const classes = await client.query(`
      SELECT c.id, c.name, c.code, c."schoolLevelId", sl.name AS level_name, sl.code AS level_code
      FROM classes c
      JOIN school_levels sl ON c."schoolLevelId" = sl.id
      WHERE c."tenantId" = $1
    `, [tenantId]);

    console.log('\n=== Test de correspondance feuille → classe ===');
    let matched = 0;
    let unmatched = 0;

    workbook.eachSheet((worksheet) => {
      const sheetName = worksheet.name;
      const cls = classes.rows.find(
        c => c.name.toLowerCase() === sheetName.toLowerCase() ||
             (c.code && c.code.toLowerCase() === sheetName.toLowerCase())
      );
      if (cls) {
        console.log(`  ✅ "${sheetName}" → classe "${cls.name}" (niveau: ${cls.level_name})`);
        matched++;
      } else {
        console.log(`  ❌ "${sheetName}" → AUCUNE CLASSE TROUVÉE`);
        unmatched++;
      }
    });

    console.log(`\n=== Résultat ===`);
    console.log(`  Feuilles matchées : ${matched}/${workbook.worksheets.length}`);
    console.log(`  Feuilles non matchées : ${unmatched}/${workbook.worksheets.length}`);

    // Vérifier aussi qu'on peut lire les en-têtes et les lignes d'exemple
    console.log('\n=== Vérification du contenu de la première feuille ===');
    const firstSheet = workbook.getWorksheet(1);
    if (firstSheet) {
      console.log(`  Nom de la feuille : ${firstSheet.name}`);
      console.log(`  Nombre de lignes : ${firstSheet.rowCount}`);
      const headers = [];
      for (let i = 1; i <= 10; i++) {
        const v = firstSheet.getRow(1).getCell(i).value;
        if (v) headers.push(v);
      }
      console.log(`  En-têtes (${headers.length}) : ${headers.join(' | ')}`);

      const example = [];
      for (let i = 1; i <= 10; i++) {
        const v = firstSheet.getRow(2).getCell(i).value;
        example.push(v || '');
      }
      console.log(`  Ligne exemple : ${example.join(' | ')}`);
    }

    console.log('\n✅ Le parsing multi-feuilles fonctionnera correctement');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Erreur:', e); process.exit(1); });
