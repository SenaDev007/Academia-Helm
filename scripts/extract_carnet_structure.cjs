/**
 * Extract complete text from both carnet de correspondance PDFs to understand the exact structure.
 */
const pypdf = require('pypdf');
const fs = require('fs');

async function extractPdf(path, label) {
  const reader = await pypdf.PdfReader(path);
  const pages = [];
  for await (const page of reader.pages) {
    pages.push(await page.extract_text());
  }
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${label} — ${pages.length} pages`);
  console.log('='.repeat(80));
  pages.forEach((text, i) => {
    console.log(`\n--- PAGE ${i + 1} ---`);
    console.log(text);
  });
}

(async () => {
  await extractPdf('/home/z/my-project/upload/Carnet de correspondance - Maternelle.pdf', 'MATERNELLE');
  await extractPdf('/home/z/my-project/upload/Carnet de correspondance CI-CM2.pdf', 'PRIMAIRE CI-CM2');
})();
