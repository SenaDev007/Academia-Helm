/**
 * Test script that verifies the Handlebars cleanup fix
 * by reproducing the bug with the OLD regex and confirming
 * the NEW regex preserves block helpers.
 *
 * This mirrors the logic in:
 * apps/api-server/src/hr/services/contract-pdf.service.ts
 * (generateContractPdf + generateContractHtml)
 */

import Handlebars from 'handlebars';

// A representative excerpt of the template returned by buildHtmlFromArticles()
// (only the header section with {{#if isSigned}}...{{else}}...{{/if}})
const templateExcerpt = `
<div class="header">
  <div class="school-info">
    <h1>{{schoolName}}</h1>
    <p>{{schoolAddress}}</p>
  </div>
  <div class="contract-meta">
    <div class="ref">Réf. {{contractReference}}</div>
    <p>Émis le {{generatedAt}} à {{generatedTime}}</p>
    {{#if isSigned}}
      <span class="status-badge">✓ SIGNÉ</span>
    {{else}}
      <span class="status-badge unsigned">EN ATTENTE DE SIGNATURE</span>
    {{/if}}
  </div>
</div>

<div class="sig-grid">
  <div class="sig-box">
    {{#if isEmployerSigned}}
      <p>Signé le : {{employerSignedAt}}</p>
      {{#if employerSignatureData}}
        <img src="{{employerSignatureData}}" />
      {{/if}}
    {{else}}
      <div>Signature employeur</div>
    {{/if}}
  </div>
</div>

{{#if qrCodeDataUrl}}
  <img src="{{qrCodeDataUrl}}" />
{{/if}}
`;

// Sample templateVars (mirrors what generateContractPdf produces)
const templateVars = {
  schoolName: 'CSPEB',
  schoolAddress: 'Parakou',
  contractReference: 'CSPEBE-26-00003',
  generatedAt: '22 juin 2026',
  generatedTime: '12:00',
  isSigned: false,
  isEmployerSigned: false,
  employerSignedAt: null,
  employerSignatureData: null,
  qrCodeDataUrl: '',
};

// ─── OLD regex (buggy) ────────────────────────────────────────────────────
const OLD_knownHelpers = ['if', 'each', 'unless', 'else', 'with', 'lookup', 'log', 'block', 'partial', 'content', 'insert', 'eq', 'ne', 'gt', 'lt', 'and', 'or', 'not'];
function oldCleanup(src) {
  return src.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    const trimmed = inner.trim();
    const firstWord = trimmed.split(/\s+/)[0];
    if (OLD_knownHelpers.includes(firstWord)) return match;
    if (templateVars.hasOwnProperty(trimmed)) return match;
    if (trimmed.includes('.')) return match;
    return trimmed;
  });
}

// ─── NEW regex (fixed) ────────────────────────────────────────────────────
const NEW_knownHelpers = ['if', 'each', 'unless', 'else', 'with', 'lookup', 'log', 'block', 'partial', 'content', 'insert', 'eq', 'ne', 'gt', 'lt', 'and', 'or', 'not', 'this'];
function newCleanup(src) {
  return src.replace(/\{\{([^}]+)\}\}/g, (match, inner) => {
    const trimmed = inner.trim();
    // 1) Preserve block openers/closers and inverses
    if (/^(#|\/|\^)/.test(trimmed) || trimmed === 'else') {
      return match;
    }
    const firstWord = trimmed.split(/\s+/)[0];
    // 2) Preserve known helpers
    if (NEW_knownHelpers.includes(firstWord)) return match;
    // 3) Preserve parenthesized helper calls
    if (/^\(/.test(trimmed)) return match;
    // 4) Preserve known variables
    if (templateVars.hasOwnProperty(trimmed)) return match;
    // 5) Preserve dotted access and @root
    if (trimmed.includes('.') || trimmed.startsWith('@')) return match;
    return trimmed;
  });
}

console.log('=== Test 1: OLD regex (expected to FAIL) ===');
const oldResult = oldCleanup(templateExcerpt);
try {
  const compiled = Handlebars.compile(oldResult);
  const html = compiled(templateVars);
  console.log('  ✅ OLD regex compiled and rendered successfully (unexpected!)');
} catch (err) {
  console.log('  ❌ OLD regex FAILED as expected:', err.message.split('\n')[0]);
}

console.log('\n=== Test 2: NEW regex (expected to PASS) ===');
const newResult = newCleanup(templateExcerpt);
try {
  const compiled = Handlebars.compile(newResult);
  const html = compiled(templateVars);
  console.log('  ✅ NEW regex compiled and rendered successfully');
  console.log('  Rendered HTML (excerpt):');
  console.log('  ' + html.split('\n').filter(l => l.includes('SIGNATURE') || l.includes('Signature')).slice(0, 3).join('\n  '));
} catch (err) {
  console.log('  ❌ NEW regex FAILED:', err.message.split('\n')[0]);
}

console.log('\n=== Test 3: Verify {{#if isSigned}} preserved ===');
const hasIf = newResult.includes('{{#if isSigned}}');
const hasElse = newResult.includes('{{else}}');
const hasCloseIf = newResult.includes('{{/if}}');
console.log('  {{#if isSigned}} present:', hasIf);
console.log('  {{else}} present:', hasElse);
console.log('  {{/if}} present:', hasCloseIf);
console.log('  All three required for valid block:', hasIf && hasElse && hasCloseIf ? '✅' : '❌');
