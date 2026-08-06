#!/usr/bin/env node
/**
 * Remove the case blocks for removed tabs in settings/page.tsx:
 * - communication (lines 4590-4826 inclusive)
 * - payments      (lines 4994-4995)
 * - orion         (lines 5230-5409)
 * - atlas         (lines 5411-5576)
 * - offline       (lines 5578-5715)
 *
 * Strategy: read file → filter out the line ranges → write back.
 * Then replace each case block with a placeholder redirect:
 *   case 'X': return null;
 *
 * Line numbers from `rg` 1-indexed.
 */
const fs = require('fs');
const path = '/home/z/my-project/apps/web-app/src/app/app/settings/page.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
// lines[] is 0-indexed but our line numbers are 1-indexed

// Build set of line indices to remove (convert 1-indexed → 0-indexed)
const removeSet = new Set();

// communication: 4590 → 4826 (case ... return ...); )
for (let i = 4590; i <= 4827; i++) removeSet.add(i);

// payments: 4994 → 4995
for (let i = 4994; i <= 4996; i++) removeSet.add(i);

// orion: 5230 → 5409
for (let i = 5230; i <= 5410; i++) removeSet.add(i);

// atlas: 5411 → 5576
for (let i = 5411; i <= 5577; i++) removeSet.add(i);

// offline: 5578 → 5715
for (let i = 5578; i <= 5716; i++) removeSet.add(i);

// Build new file: replace each removed block with a tiny placeholder
// We'll insert a placeholder for each removed block at the position of the
// first removed line of that block.
const placeholders = {
  4590: "      case 'communication':\n        return null; // Removed tab — communication géré via module Communication",
  4994: "      case 'payments':\n        return null; // Removed tab — paiements gérés via Facturation",
  5230: "      case 'orion':\n        return null; // Removed tab — ORION accessible via widget flottant",
  5411: "      case 'atlas':\n        return null; // Removed tab — ATLAS accessible via widget flottant",
  5578: "      case 'offline':\n        return null; // Removed tab — sync hors-ligne gérée automatiquement",
};

const newLines = [];
for (let i = 1; i <= lines.length; i++) {
  if (removeSet.has(i)) {
    if (placeholders[i]) {
      newLines.push(placeholders[i]);
    }
    continue;
  }
  newLines.push(lines[i - 1]);
}

fs.writeFileSync(path, newLines.join('\n'));
console.log('Done. Removed', removeSet.size, 'lines, inserted placeholders for 5 case blocks.');
