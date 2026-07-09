/**
 * Test local de la génération du template multi-feuilles.
 * Génère un fichier .xlsx avec une feuille par classe configurée pour le tenant CSPEB.
 */
const ExcelJS = require('exceljs');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cnG4TeNF2rXI@ep-curly-frost-agx7owra-pooler.c-2.eu-central-1.aws.neon.tech/AcademiaHelm?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

const HEADERS = [
  'Prénom', 'Nom', 'Date de naissance', 'Sexe', 'Lieu de naissance',
  'Nationalité', "Type d'élève", 'Nom du parent/tuteur',
  'Téléphone du parent', 'Email du parent',
];

function sanitizeSheetName(name) {
  let clean = name.replace(/[\\/?*\[\]:]/g, '-').trim();
  if (clean.length > 31) clean = clean.substring(0, 31);
  return clean || 'Feuille';
}

function applySheetLayout(worksheet, schoolLevelName, className) {
  worksheet.columns = HEADERS.map(h => ({ header: h, key: h, width: 22 }));
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1F6E' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 30;

  worksheet.addRow(['Marie', 'AKOVI', '15/03/2015', 'F', 'Cotonou', 'Béninoise', 'Nouvel élève', 'Koffi AKOVI', '+229 01 97 22 23 45', 'koffi.akovi@email.com']);
  const exRow = worksheet.getRow(2);
  exRow.font = { italic: true, color: { argb: 'FF6B7280' }, size: 10 };
  exRow.alignment = { vertical: 'middle' };

  for (let i = 1; i <= 2; i++) {
    const row = worksheet.getRow(i);
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  }

  worksheet.addRow([]);
  const noteRow = worksheet.addRow([
    `🏫 Feuille pour la classe : ${className} (${schoolLevelName}) — ` +
    `le niveau et la classe sont déduits automatiquement du nom de cette feuille.`,
  ]);
  noteRow.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
}

function addInstructionsRow(worksheet) {
  worksheet.addRow([]);
  worksheet.addRow(['⚠️ Lignes d\'exemple à supprimer avant import. Respectez l\'ordre des colonnes.']);
  worksheet.addRow(['📅 Date de naissance au format JJ/MM/AAAA (ex: 15/03/2015)']);
  worksheet.addRow(["👤 Sexe : M (Garçon) ou F (Fille)"]);
  worksheet.addRow(["📦 Type d'élève : \"Nouvel élève\" (paie frais d'inscription) ou \"Ancien élève\" (paie frais de réinscription)"]);
  worksheet.addRow(['💰 Arriérés antérieurs : ⚠️ NON inclus dans ce fichier — utilisez l\'import d\'arriérés dédié (module Recouvrement).']);
  worksheet.addRow(['📋 Chaque feuille correspond à une classe physique configurée dans votre établissement.']);
  worksheet.addRow(['💡 Pour ajouter une feuille pour une nouvelle classe, configurez-la d\'abord dans Paramètres > Classes, puis re-téléchargez ce template.']);

  const lastRow = worksheet.rowCount;
  for (let i = lastRow - 6; i <= lastRow; i++) {
    const row = worksheet.getRow(i);
    row.font = { italic: true, color: { argb: 'FF92400E' }, size: 10 };
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const tenantId = '59b8c348-ae5f-4d67-8fbd-af6aefa1f394';
    console.log('=== Récupération des classes du tenant CSPEB ===\n');

    const r = await client.query(`
      SELECT c.id, c.name, c.code, sl.name AS level_name, sl.code AS level_code, sl."order"
      FROM classes c
      JOIN school_levels sl ON c."schoolLevelId" = sl.id
      WHERE c."tenantId" = $1
      ORDER BY sl."order" ASC, c.name ASC
    `, [tenantId]);

    console.log(`Classes trouvées : ${r.rows.length}`);
    console.table(r.rows.map(x => ({
      name: x.name,
      code: x.code,
      level: x.level_name,
      order: x.order,
    })));

    if (r.rows.length === 0) {
      console.log('❌ Aucune classe configurée');
      return;
    }

    // Générer le classeur
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Academia Helm';
    workbook.created = new Date();

    for (const cls of r.rows) {
      const sheetName = sanitizeSheetName(cls.name || cls.code);
      const ws = workbook.addWorksheet(sheetName);
      applySheetLayout(ws, cls.level_name, cls.name);
      addInstructionsRow(ws);
      console.log(`  ✅ Feuille créée : "${sheetName}" (${cls.level_name})`);
    }

    // Sauvegarder
    const outPath = '/home/z/my-project/download/template-import-eleves-multi-feuilles.xlsx';
    const outDir = path.dirname(outPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    await workbook.xlsx.writeFile(outPath);
    console.log(`\n✅ Template généré : ${outPath}`);
    console.log(`   Taille : ${fs.statSync(outPath).size} octets`);
    console.log(`   Feuilles : ${workbook.worksheets.length}`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('Erreur:', e); process.exit(1); });
