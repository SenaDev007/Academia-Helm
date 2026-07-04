/**
 * Vérification syntaxique de base (sans TypeScript) :
 *   1. Compte des accolades { } équilibrées dans chaque fichier modifié
 *   2. Vérification de l'absence de patterns dangereux
 *      (ex: une ligne qui commence par `}` isolée indiquant un bloc cassé)
 */

const fs = require('fs');

const files = [
  '/home/z/my-project/repo/Academia-Helm/apps/api-server/src/hr/recruitment-email-templates.ts',
  '/home/z/my-project/repo/Academia-Helm/apps/api-server/src/hr/recruitment.service.ts',
  '/home/z/my-project/repo/Academia-Helm/apps/api-server/src/hr/recruitment.controller.ts',
];

let totalErrors = 0;

for (const file of files) {
  console.log(`\n=== ${file.split('/').pop()} ===`);
  const content = fs.readFileSync(file, 'utf-8');

  // Compter accolades, parenthèses, crochets (approximatif — ignore string literals)
  // On enlève les strings simples et doubles pour réduire le bruit
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // commentaires multi-lignes
    .replace(/\/\/[^\n]*/g, '')        // commentaires ligne
    .replace(/`[^`]*`/g, '""')         // template literals (approximatif)
    .replace(/"[^"]*"/g, '""')         // strings doubles
    .replace(/'[^']*'/g, "''");        // strings simples

  const counts = {
    '{': (stripped.match(/{/g) || []).length,
    '}': (stripped.match(/}/g) || []).length,
    '(': (stripped.match(/\(/g) || []).length,
    ')': (stripped.match(/\)/g) || []).length,
    '[': (stripped.match(/\[/g) || []).length,
    ']': (stripped.match(/\]/g) || []).length,
  };

  const balanced =
    counts['{'] === counts['}'] &&
    counts['('] === counts[')'] &&
    counts['['] === counts[']'];

  console.log(`  Braces:    { ${counts['{']} } ${counts['}']}  → ${counts['{'] === counts['}'] ? '✅' : '❌'}`);
  console.log(`  Parens:    ( ${counts['(']} ) ${counts[')']}  → ${counts['('] === counts[')'] ? '✅' : '❌'}`);
  console.log(`  Brackets:  [ ${counts['[']} ] ${counts[']']}  → ${counts['['] === counts[']'] ? '✅' : '❌'}`);
  console.log(`  Total balanced: ${balanced ? '✅ YES' : '❌ NO'}`);

  if (!balanced) {
    totalErrors++;
  }
}

// Vérifications spécifiques
console.log('\n=== Vérifications spécifiques ===');

// 1. Vérifier que validateInterview a bien le bloc de notification email
const service = fs.readFileSync(files[1], 'utf-8');
const hasNotification = service.includes('notifyInterviewResult({') &&
  service.includes('validateInterview: interview result email queued');
console.log(`  validateInterview contient notifyInterviewResult : ${hasNotification ? '✅' : '❌'}`);
if (!hasNotification) totalErrors++;

// 2. Vérifier que sanitizeHtml est défini et utilisé
const templates = fs.readFileSync(files[0], 'utf-8');
const hasSanitize = templates.includes('function sanitizeHtml') &&
  templates.includes('${sanitizeHtml(data.feedback)}');
console.log(`  templates contient sanitizeHtml et l'utilise : ${hasSanitize ? '✅' : '❌'}`);
if (!hasSanitize) totalErrors++;

// 3. Vérifier que les endpoints de test existent dans le controller
const controller = fs.readFileSync(files[2], 'utf-8');
const hasInterviewTest = controller.includes('test-resend-interview-result/:interviewId');
const hasTestTest = controller.includes('test-resend-test-result/:testResultId');
console.log(`  Controller a endpoint test interview result : ${hasInterviewTest ? '✅' : '❌'}`);
console.log(`  Controller a endpoint test test result : ${hasTestTest ? '✅' : '❌'}`);
if (!hasInterviewTest || !hasTestTest) totalErrors++;

// 4. Vérifier que les méthodes testResend* existent dans le service
const hasServiceInterviewTest = service.includes('async testResendInterviewResultEmail');
const hasServiceTestTest = service.includes('async testResendTestResultEmail');
console.log(`  Service a méthode testResendInterviewResultEmail : ${hasServiceInterviewTest ? '✅' : '❌'}`);
console.log(`  Service a méthode testResendTestResultEmail : ${hasServiceTestTest ? '✅' : '❌'}`);
if (!hasServiceInterviewTest || !hasServiceTestTest) totalErrors++;

console.log(`\n=== RÉSUMÉ ===`);
console.log(`Total erreurs : ${totalErrors}`);
process.exit(totalErrors === 0 ? 0 : 1);
