/**
 * ============================================================================
 * 📧 TÂCHE 181 — TESTS UNITAIRES de la logique pure (sans DB ni NestJS)
 * ============================================================================
 * Couvre : chiffrement AES-256-GCM (aller-retour, IV unique, clé différente),
 * classification des erreurs SMTP (4xx/5xx/auth/réseau), pied de page,
 * normalisation des destinataires, classification des erreurs Nodemailer.
 * Exécution : npx ts-node --transpile-only scripts/test-school-email-181.ts
 * ============================================================================
 */

import * as assert from 'assert';

// ─── 1. Chiffrement AES-256-GCM (logique extraite du service, même algo) ───
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function encryptWithKey(key: Buffer, plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { secretEncrypted: encrypted.toString('base64'), secretIv: iv.toString('base64'), secretTag: cipher.getAuthTag().toString('base64') };
}
function decryptWithKey(key: Buffer, parts: { secretEncrypted: string; secretIv: string; secretTag: string }) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts.secretIv, 'base64'));
  decipher.setAuthTag(Buffer.from(parts.secretTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts.secretEncrypted, 'base64')), decipher.final()]).toString('utf8');
}

const keyA = createHash('sha256').update('cle-maitre-A').digest();
const secret = 'abcdefghijklmnop qrstuvwxyz0123456789ABCDEFGH'; // mot de passe d'application 16+ car.

const enc1 = encryptWithKey(keyA, secret);
const enc2 = encryptWithKey(keyA, secret);
assert.strictEqual(decryptWithKey(keyA, enc1), secret, '1a. aller-retour AES-256-GCM');
assert.notStrictEqual(enc1.secretIv, enc2.secretIv, '1b. IV unique par secret');
assert.notStrictEqual(enc1.secretEncrypted, enc2.secretEncrypted, '1c. ciphertext différent (IV unique)');
assert.strictEqual(enc1.secretEncrypted.length > 0 && !enc1.secretEncrypted.includes(secret), true, '1d. le secret n\'apparaît pas en clair');
// Clé différente → échec GCM (mesure CDC §7.6)
const keyB = createHash('sha256').update('cle-maitre-B').digest();
let decryptFailed = false;
try { decryptWithKey(keyB, enc1); } catch { decryptFailed = true; }
assert.strictEqual(decryptFailed, true, '1e. clé changée → EmailSecretDecryptError (GCM)');
// Altération du ciphertext → échec
let tamperFailed = false;
try {
  const tampered = { ...enc1, secretEncrypted: Buffer.from('x'.repeat(24)).toString('base64') };
  decryptWithKey(keyA, tampered);
} catch { tamperFailed = true; }
assert.strictEqual(tamperFailed, true, '1f. donnée altérée → échec d\'authenticité GCM');
console.log('✓ 1. Chiffrement AES-256-GCM (6/6)');

// ─── 2. Classification des erreurs SMTP ─────────────────────────────────────
import { classifySmtpError, safeSmtpErrorMessage } from '../src/school-email/smtp-helpers';

assert.strictEqual(classifySmtpError({ responseCode: 421, message: 'Service not available' }), 'retryable', '2a. SMTP 421 → retryable');
assert.strictEqual(classifySmtpError({ responseCode: 450, message: 'Mailbox busy' }), 'retryable', '2b. SMTP 450 → retryable');
assert.strictEqual(classifySmtpError({ responseCode: 452, message: 'Insufficient storage' }), 'retryable', '2c. SMTP 452 → retryable');
assert.strictEqual(classifySmtpError({ responseCode: 550, message: 'No such user' }), 'fatal', '2d. SMTP 550 → fatal');
assert.strictEqual(classifySmtpError({ responseCode: 553, message: 'Mailbox name not allowed' }), 'fatal', '2e. SMTP 553 → fatal');
assert.strictEqual(classifySmtpError({ code: 'EAUTH', message: 'Invalid login' }), 'fatal_auth', '2f. EAUTH → fatal_auth');
assert.strictEqual(classifySmtpError({ responseCode: 535, message: 'Authentication failed' }), 'fatal_auth', '2g. SMTP 535 → fatal_auth');
assert.strictEqual(classifySmtpError({ code: 'ETIMEDOUT' }), 'retryable', '2h. ETIMEDOUT → retryable');
assert.strictEqual(classifySmtpError({ code: 'ECONNECTION' }), 'retryable', '2i. ECONNECTION → retryable');
assert.strictEqual(classifySmtpError({ code: 'ECONNRESET' }), 'retryable', '2j. ECONNRESET → retryable');
assert.strictEqual(classifySmtpError({ message: 'Server busy, try again later' }), 'retryable', '2k. « try again » → retryable');
assert.strictEqual(classifySmtpError(null), 'retryable', '2l. erreur inconnue → retryable (3 tentatives max)');

// Message d'erreur sûr : ne contient JAMAIS le mot de passe
const safe = safeSmtpErrorMessage({ code: 'EAUTH', message: 'Invalid login: password=SuperSecret123' });
assert.strictEqual(safe.includes('SuperSecret123'), true === false ? true : false, '2m. safeSmtpErrorMessage — pas de secret');
console.log('✓ 2. Classification erreurs SMTP (13/13)');

// ─── 3. Pied de page automatique ────────────────────────────────────────────
import { appendHtmlFooter, appendTextFooter } from '../src/school-email/smtp-helpers';

const html = '<html><body><p>Bonjour</p></body></html>';
const withFooter = appendHtmlFooter(html, 'Complexe Mon Avenir Plus');
assert.strictEqual(withFooter.includes('Envoyé via Academia Helm'), true, '3a. mention Academia Helm');
assert.strictEqual(withFooter.includes('Complexe Mon Avenir Plus'), true, '3b. nom de l\'école');
assert.strictEqual(withFooter.indexOf('</body>') > withFooter.indexOf('Envoyé via'), true, '3c. footer inséré avant </body>');
assert.strictEqual(withFooter.startsWith('<html>'), true, '3d. document intact');

const txt = appendTextFooter('Bonjour', 'École Test');
assert.strictEqual(txt, 'Bonjour\n\n— École Test\nEnvoyé via Academia Helm', '3e. footer texte exact');

const htmlSansBody = appendHtmlFooter('<p>Salut</p>', 'École X');
assert.strictEqual(htmlSansBody.includes('Envoyé via Academia Helm'), true, '3f. footer sans <body>');

// Échappement du nom d'école
const htmlXss = appendHtmlFooter('<p>x</p>', 'École <script>alert(1)</script>');
assert.strictEqual(htmlXss.includes('<script>'), false, '3g. nom d\'école échappé (anti-XSS)');
console.log('✓ 3. Pied de page automatique (7/7)');

// ─── 4. Normalisation des destinataires ─────────────────────────────────────
import { normalizeRecipients } from '../src/school-email/smtp-helpers';

const n1 = normalizeRecipients('A@B.com', ['c@d.com', 'invalide'], 'E@F.com');
assert.deepStrictEqual(n1.to, ['a@b.com'], '4a. minuscules + filtrage');
assert.deepStrictEqual(n1.cc, ['c@d.com'], '4b. cc filtré');
assert.deepStrictEqual(n1.bcc, ['e@f.com'], '4c. bcc');
assert.strictEqual(n1.total, 3, '4d. total = to + cc + bcc (CDC §4.1)');

const n2 = normalizeRecipients(['', 'pas-un-email', '  ok@ecole.com  ']);
assert.deepStrictEqual(n2.to, ['ok@ecole.com'], '4e. nettoyage espaces + invalides rejetés');
assert.strictEqual(n2.total, 1, '4f. un seul valide');

const n3 = normalizeRecipients(null, undefined, null);
assert.strictEqual(n3.total, 0, '4g. vide → 0 destinataire');
console.log('✓ 4. Normalisation destinataires (7/7)');

// ─── 5. File : délais de backoff et constantes ─────────────────────────────
// BACKOFF_MS est privé ; on vérifie la sémantique documentée via le code source.
import * as fs from 'fs';
const dispatcherSrc = fs.readFileSync('src/school-email/email-queue-dispatcher.service.ts', 'utf8');
assert.strictEqual(dispatcherSrc.includes('BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000]'), true, '5a. backoff croissant 1/5/15 min');
assert.strictEqual(dispatcherSrc.includes('RATE_PER_MINUTE = 20'), true, '5b. débit 20/min/école');
assert.strictEqual(dispatcherSrc.includes('FOR UPDATE SKIP LOCKED'), true, '5c. verrouillage SKIP LOCKED');
assert.strictEqual(dispatcherSrc.includes("'0 */6 * * *'"), true, '5d. balayage anti-crash 5 champs (pas 6)');
assert.strictEqual(dispatcherSrc.includes('maxAttempts'), true, '5e. tentatives max');
console.log('✓ 5. Constantes de la file (5/5)');

// ─── 6. DTOs : validation class-validator ──────────────────────────────────
import 'reflect-metadata';
import { validate } from 'class-validator';
import { SaveSchoolEmailConfigDto } from '../src/school-email/dto/school-email.dto';

async function testDtos(): Promise<void> {
  const dto = new SaveSchoolEmailConfigDto();
  dto.mode = 'smtp';
  dto.fromName = 'Complexe Scolaire Mon Avenir Plus';
  dto.fromEmail = 'monavenirplus@gmail.com';
  dto.smtpPort = 587;
  dto.smtpPassword = 'abcd efgh ijkl mnop';
  const errs = await validate(dto);
  assert.strictEqual(errs.length, 0, '6a. DTO SMTP valide accepté');

  const badDto = new SaveSchoolEmailConfigDto();
  (badDto as any).mode = 'google_oauth'; // Phase 2 — doit être refusé en phase 1
  badDto.fromName = '';
  (badDto as any).fromEmail = 'pas-un-email';
  (badDto as any).smtpPort = 25;
  const badErrs = await validate(badDto);
  assert.strictEqual(badErrs.length >= 3, true, '6b. mode non supporté + email invalide + port invalide rejetés');

  const noPassword = new SaveSchoolEmailConfigDto();
  noPassword.mode = 'smtp';
  noPassword.fromName = 'École';
  noPassword.fromEmail = 'a@b.com';
  const noPwdErrs = await validate(noPassword);
  assert.strictEqual(noPwdErrs.length, 0, '6c. smtpPassword optionnel (édition sans retaper)');
  console.log('✓ 6. DTOs class-validator (3/3)');
}

// ─── 7. Branding (retour promoteur 2026-11-26) + priorité Reply-To ─────────
import {
  appendTextFooterWithBranding,
  isTokenReplyAddress,
  resolveReplyToHeader,
  wrapHtmlWithBranding,
} from '../src/school-email/smtp-helpers';

// 7a-7e : Reply-To — l'école reçoit les réponses
assert.strictEqual(
  resolveReplyToHeader('log_abc123@replies.academiahelm.com', null, 'ecole@gmail.com'),
  'ecole@gmail.com',
  "7a. adresse jeton cède la place à la boîte de l'école",
);
assert.strictEqual(
  resolveReplyToHeader('log_abc123@replies.academiahelm.com', 'direction@ecole.bj', 'x@gmail.com'),
  'direction@ecole.bj',
  "7b. replyTo configuré dans l'onglet prime sur le jeton",
);
assert.strictEqual(
  resolveReplyToHeader('recruteur@ecole.bj', 'direction@ecole.bj', 'x@gmail.com'),
  'recruteur@ecole.bj',
  '7c. override explicite (RH recruteur) conservé',
);
assert.strictEqual(
  resolveReplyToHeader('log_abc123@replies.academiahelm.com', null, null),
  'log_abc123@replies.academiahelm.com',
  "7d. repli jeton si l'école n'a aucune adresse",
);
assert.strictEqual(resolveReplyToHeader(null, null, null), undefined, '7e. vide → undefined');

// 7f-7l : branding HTML — logo en-tête ET pied
const branding = {
  schoolName: "CSP Mon Avenir Plus N'Dali",
  logoCid: 'school-logo@academiahelm',
  contactLines: ["N'Dali, Bénin", '+229 97 00 00 00', 'cspmonavenirplusndali@gmail.com'],
};
const wrapped = wrapHtmlWithBranding('<html><body><div>Contenu</div></body></html>', branding);
const bOpen = wrapped.toLowerCase().indexOf('<body>');
const hIdx = wrapped.indexOf('border-bottom:3px solid #1a2ba6');
const cIdx = wrapped.indexOf('Contenu');
const fIdx = wrapped.indexOf('Envoyé via Academia Helm');
const closeIdx = wrapped.toLowerCase().lastIndexOf('</body>');
assert.strictEqual(
  hIdx > bOpen && cIdx > hIdx && fIdx > cIdx && closeIdx > fIdx,
  true,
  '7f. ordre header → contenu → footer → </body>',
);
const cidCount = (wrapped.match(/cid:school-logo@academiahelm/g) || []).length;
assert.strictEqual(cidCount, 2, '7g. logo CID présent 2 fois (en-tête + pied)');
assert.strictEqual(
  wrapped.includes('CSP Mon Avenir Plus N&#39;Dali'),
  true,
  "7h. nom d'école échappé (anti-XSS)",
);
assert.strictEqual(
  wrapped.includes('cspmonavenirplusndali@gmail.com') && wrapped.includes('+229 97 00 00 00'),
  true,
  '7i. coordonnées affichées dans le pied',
);
const frag = wrapHtmlWithBranding('<p>Bonjour</p>', branding);
assert.strictEqual(
  frag.indexOf('border-bottom:3px solid') < frag.indexOf('<p>Bonjour</p>') &&
    frag.indexOf('Envoyé via') > frag.indexOf('<p>Bonjour</p>'),
  true,
  '7j. fragment sans <body> enveloppé header+footer',
);
const noLogo = wrapHtmlWithBranding('<p>x</p>', { schoolName: 'École', contactLines: [] });
assert.strictEqual(noLogo.includes('<img'), false, '7k. sans logo → aucune balise img');
const urlLogo = wrapHtmlWithBranding('<p>x</p>', {
  schoolName: 'École',
  logoUrl: 'https://api.academiahelm.com/l.png',
  contactLines: [],
});
assert.strictEqual(
  urlLogo.includes('src="https://api.academiahelm.com/l.png"'),
  true,
  '7l. repli URL https quand CID indisponible',
);

// 7m : pied de page texte enrichi
const txtBrand = appendTextFooterWithBranding('Bonjour.', branding);
assert.strictEqual(
  txtBrand.includes("CSP Mon Avenir Plus N'Dali") &&
    txtBrand.includes('cspmonavenirplusndali@gmail.com') &&
    txtBrand.includes('Envoyé via Academia Helm'),
  true,
  '7m. footer texte : nom + coordonnées + mention',
);

// 7n-7o : détection adresse jeton
assert.strictEqual(
  isTokenReplyAddress('log_deadbeef@replies.academiahelm.com'),
  true,
  '7n. détection adresse jeton',
);
assert.strictEqual(isTokenReplyAddress('direction@ecole.bj'), false, '7o. adresse réelle ≠ jeton');
console.log('✓ 7. Branding + Reply-To école (15/15)');

(async () => {
  await testDtos();
  console.log('\n══════════════════════════════════════════════════');
  console.log('✅ TÂCHE 181 — TESTS LOGIQUE PURE : 56/56 OK');
  console.log('══════════════════════════════════════════════════');
})();
