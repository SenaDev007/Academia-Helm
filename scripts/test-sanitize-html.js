/**
 * Test standalone du comportement de sanitizeHtml et des templates d'email
 * pour vérifier que les balises <p> ne sont plus échappées dans le feedback.
 *
 * Ce script reproduit à l'identique les fonctions sanitizeHtml + escHtml du
 * fichier recruitment-email-templates.ts, puis teste plusieurs cas :
 *   1. Feedback simple (pas de HTML) → doit être échappé tel quel
 *   2. Feedback HTML riche (<p>excellent</p>) → doit être rendu comme HTML
 *   3. Feedback avec <script> → doit être nettoyé
 *   4. Feedback avec attribut onclick → doit être nettoyé
 *   5. Feedback avec <ul><li> → doit être rendu comme HTML
 *   6. Feedback vide → doit retourner ''
 *   7. Feedback avec javascript: URL → doit être neutralisé
 */

function escHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeHtml(s) {
  if (!s) return '';
  let str = String(s).trim();
  if (!str) return '';

  const htmlTagPattern = /<(p|div|span|ul|ol|li|strong|em|b|i|u|br|h[1-6]|blockquote|a|img|table|tr|td|th|hr|sub|sup|code|pre)\b[^>]*>/i;
  if (!htmlTagPattern.test(str)) {
    return escHtml(str);
  }

  str = str.replace(
    /<(script|iframe|object|embed|style|link|meta|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  str = str.replace(
    /<(script|iframe|object|embed|style|link|meta|noscript|template)\b[^>]*\/?>/gi,
    '',
  );
  str = str.replace(/<!--[\s\S]*?-->/g, '');
  str = str.replace(
    /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    '',
  );
  str = str.replace(
    /(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]*)/gi,
    '$1="#"',
  );

  return str;
}

// Helper : rendu du bloc feedback dans le template (reproduit)
function renderFeedbackBlock(feedback) {
  if (!feedback) return '';
  return `<div style="margin:12px 0 0;padding-top:12px;border-top:1px solid #e2e8f0;font-size:13px;color:#334155;line-height:1.6;">
  <strong style="display:block;margin-bottom:6px;">Feedback :</strong>
  <div style="margin:0;">${sanitizeHtml(feedback)}</div>
</div>`;
}

const testCases = [
  {
    name: '1. Feedback simple sans HTML',
    input: 'excellent',
    expected: 'excellent', // doit être rendu comme texte simple
  },
  {
    name: '2. Feedback HTML riche (cas user — Tiptap <p>)',
    input: '<p>excellent</p>',
    expected: '<p>excellent</p>', // doit être rendu comme HTML
  },
  {
    name: '3. Feedback avec balise script',
    input: '<p>excellent</p><script>alert("xss")</script>',
    expected: '<p>excellent</p>', // le script doit être supprimé
  },
  {
    name: '4. Feedback avec attribut onclick',
    input: '<p onclick="alert(1)">excellent</p>',
    expected: '<p>excellent</p>', // onclick doit être supprimé
  },
  {
    name: '5. Feedback avec liste à puces',
    input: '<ul><li>Point fort 1</li><li>Point fort 2</li></ul>',
    expected: '<ul><li>Point fort 1</li><li>Point fort 2</li></ul>',
  },
  {
    name: '6. Feedback vide',
    input: '',
    expected: '',
  },
  {
    name: '7. Feedback avec lien javascript: (XSS)',
    input: '<p><a href="javascript:alert(1)">Click me</a></p>',
    expected: '<p><a href="#">Click me</a></p>',
  },
  {
    name: '8. Feedback avec texte + gras',
    input: '<p>Le candidat est <strong>très bon</strong></p>',
    expected: '<p>Le candidat est <strong>très bon</strong></p>',
  },
  {
    name: '9. Feedback multi-paragraphes',
    input: '<p>Commentaire global</p><p>Points à améliorer :</p><ul><li>Prise de parole</li></ul>',
    expected: '<p>Commentaire global</p><p>Points à améliorer :</p><ul><li>Prise de parole</li></ul>',
  },
  {
    name: '10. Feedback avec caractères spéciaux',
    input: 'Très bien — honorable < 20/20',
    expected: 'Très bien — honorable &lt; 20/20', // texte non-HTML → échappé
  },
];

console.log('=== TEST sanitizeHtml ===\n');
let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = sanitizeHtml(tc.input);
  const ok = result === tc.expected;
  const status = ok ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} — ${tc.name}`);
  console.log(`  Input:    ${JSON.stringify(tc.input)}`);
  console.log(`  Expected: ${JSON.stringify(tc.expected)}`);
  console.log(`  Got:      ${JSON.stringify(result)}`);
  if (ok) {
    passed++;
  } else {
    failed++;
  }
  console.log('');
}

console.log('=== TEST renderFeedbackBlock (intégration template) ===\n');

// Test spécifique du cas remonté par le user
const userCase = '<p>excellent</p>';
const renderedBlock = renderFeedbackBlock(userCase);
console.log(`Cas user : feedback = "${userCase}"`);
console.log(`Bloc HTML rendu :`);
console.log(renderedBlock);
console.log('');

const hasVisiblePEscaped = renderedBlock.includes('&lt;p&gt;excellent&lt;/p&gt;');
const hasHtmlP = renderedBlock.includes('<p>excellent</p>');
console.log(`Le bloc contient <p>excellent</p> rendu comme HTML ? ${hasHtmlP ? '✅ OUI' : '❌ NON'}`);
console.log(`Le bloc contient <p>excellent</p> échappé (visible) ? ${hasVisiblePEscaped ? '❌ OUI (BUG)' : '✅ NON'}`);

console.log('');
console.log('=== RÉSUMÉ ===');
console.log(`Tests sanitizeHtml : ${passed}/${testCases.length} réussis, ${failed} échoués`);
process.exit(failed === 0 && !hasVisiblePEscaped && hasHtmlP ? 0 : 1);
