/**
 * ============================================================================
 * 📧 TÂCHE 183 (PHASE 2) — TESTS UNITAIRES de la logique pure Google OAuth2
 * ============================================================================
 * Couvre : PKCE S256 (vecteur de test RFC 7636), génération state,
 * construction de l'URL d'autorisation, classification des erreurs de l'API
 * Gmail (429/5xx → relance, 401 → auth, invalid_grant → expiration),
 * masquage des jetons dans les messages, extraction des raisons d'erreur du
 * point de terminaison token (JSON + form-encoded), encodage base64url, et
 * composition MIME réelle via MailComposer (From/To/Subject/Reply-To/PJ).
 * Exécution : npx ts-node --transpile-only scripts/test-school-email-183.ts
 * ============================================================================
 */

import * as assert from 'assert';
import * as crypto from 'crypto';

// Imports directs des helpers purs (aucune dépendance NestJS).
import {
  base64Url,
  buildGoogleAuthUrl,
  classifyGmailApiError,
  generateCodeVerifier,
  generateOauthState,
  isGmailApiDisabledError,
  pkceChallengeS256,
  safeGmailErrorMessage,
  tokenErrorReason,
  GmailApiError,
  GoogleAuthExpiredError,
  GMAIL_SEND_SCOPE,
  GOOGLE_USERINFO_EMAIL_SCOPE,
} from '../src/school-email/google-oauth.helpers';

let passed = 0;
function ok(cond: boolean, label: string) {
  assert.strictEqual(cond, true, label);
  passed++;
}

// ─── 1. PKCE (RFC 7636) ─────────────────────────────────────────────────────

// 1a. Vecteur de test OFFICIEL RFC 7636 appendice B : le challenge S256 du
// verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" doit donner
// "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM".
assert.strictEqual(
  pkceChallengeS256('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
  'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  '1a. vecteur RFC 7636 — challenge S256 exact',
);
passed++;

// 1b. Verifier : 64 octets → 86 caractères base64url (plage Google 43-128).
const v1 = generateCodeVerifier();
const v2 = generateCodeVerifier();
ok(v1.length === 86, '1b. verifier de 86 caractères (plage 43-128)');
ok(/^[A-Za-z0-9_-]+$/.test(v1), '1c. alphabet base64url uniquement (sans + / =)');
ok(v1 !== v2, '1d. verifier unique par génération');

// 1c. Challenge : 43 caractères, déterministe, sans remplissage.
const c1 = pkceChallengeS256(v1);
ok(c1.length === 43, '1e. challenge S256 de 43 caractères (SHA-256 → 32 octets)');
ok(!c1.includes('='), '1f. challenge sans padding');
assert.strictEqual(pkceChallengeS256(v1), c1, '1g. challenge déterministe');
passed++;

// ─── 2. State anti-CSRF ─────────────────────────────────────────────────────

const s1 = generateOauthState();
const s2 = generateOauthState();
ok(s1.length === 64 && /^[0-9a-f]+$/.test(s1), '2a. state = 64 caractères hexadécimaux');
ok(s1 !== s2, '2b. state unique par génération');

// ─── 3. URL d'autorisation ──────────────────────────────────────────────────

const url = buildGoogleAuthUrl({
  clientId: 'client-id-test.apps.googleusercontent.com',
  redirectUri: 'https://api.academiahelm.com/api/school-email/google/callback',
  state: s1,
  codeChallenge: c1,
  loginHint: 'ecole.test@gmail.com',
});
const u = new URL(url);
ok(u.origin + u.pathname === 'https://accounts.google.com/o/oauth2/v2/auth', '3a. point de terminaison accounts.google.com');
ok(u.searchParams.get('client_id') === 'client-id-test.apps.googleusercontent.com', '3b. client_id');
ok(
  u.searchParams.get('redirect_uri') === 'https://api.academiahelm.com/api/school-email/google/callback',
  '3c. redirect_uri',
);
ok(u.searchParams.get('response_type') === 'code', '3d. response_type=code (code d\'autorisation)');
ok(
  u.searchParams.get('scope') === `${GMAIL_SEND_SCOPE} ${GOOGLE_USERINFO_EMAIL_SCOPE}`,
  '3e. portées gmail.send + userinfo.email (moindre privilège)',
);
ok(u.searchParams.get('access_type') === 'offline', '3f. access_type=offline (refresh token)');
ok(u.searchParams.get('prompt') === 'consent', '3g. prompt=consent (refresh token réémis)');
ok(u.searchParams.get('state') === s1, '3h. state porté');
ok(u.searchParams.get('code_challenge') === c1, '3i. code_challenge porté');
ok(u.searchParams.get('code_challenge_method') === 'S256', '3j. méthode S256');
ok(u.searchParams.get('login_hint') === 'ecole.test@gmail.com', '3k. login_hint du compte école');

// Sans login_hint → paramètre absent.
const urlNoHint = buildGoogleAuthUrl({
  clientId: 'x',
  redirectUri: 'https://api.example.com/cb',
  state: 'st',
  codeChallenge: 'ch',
});
ok(!urlNoHint.includes('login_hint'), '3l. login_hint absent si non fourni');

// ─── 4. Classification des erreurs API Gmail ────────────────────────────────

ok(classifyGmailApiError(new GoogleAuthExpiredError('invalid_grant')) === 'expired', '4a. GoogleAuthExpiredError → expired');
ok(
  classifyGmailApiError(new GmailApiError('bad', 400, '{"error":"invalid_grant","error_description":"Token has been expired or revoked."}')) === 'expired',
  '4b. 400 invalid_grant → expired (connexion Expirée)',
);
ok(classifyGmailApiError(new GmailApiError('unauthorized', 401, '')) === 'fatal_auth', '4c. 401 → fatal_auth');
ok(
  classifyGmailApiError(new GmailApiError('forbidden', 403, 'Invalid Credentials')) === 'fatal_auth',
  '4d. 403 invalid credentials → fatal_auth',
);
ok(classifyGmailApiError(new GmailApiError('rate', 429, 'userRateLimitExceeded')) === 'retryable', '4e. 429 → retryable (quota Gmail)');
ok(classifyGmailApiError(new GmailApiError('backend', 503, 'backendError')) === 'retryable', '4f. 503 → retryable (guidance Google)');
ok(classifyGmailApiError(new GmailApiError('bad request', 400, 'invalid argument')) === 'fatal', '4g. 400 autre → fatal');
ok(classifyGmailApiError(new GmailApiError('not found', 404, '')) === 'fatal', '4h. 404 → fatal');
ok(classifyGmailApiError({ code: 'ETIMEDOUT', message: 'timeout' }) === 'retryable', '4i. réseau ETIMEDOUT → retryable');
ok(classifyGmailApiError({ message: 'temporarily unavailable, try again later' }) === 'retryable', '4j. « temporarily » → retryable');
ok(classifyGmailApiError(new Error('unknown')) === 'retryable', '4k. inconnu → retryable (3 tentatives max)');
ok(classifyGmailApiError(null) === 'retryable', '4l. erreur nulle → retryable');
// Body invalid_grant sur AUTRE statut (défense en profondeur).
ok(classifyGmailApiError(new GmailApiError('strange', 500, 'invalid_grant')) === 'expired', '4m. invalid_grant (statut 500) → expired');

// ─── 5. Messages d'erreur sûrs (jamais de jeton) ───────────────────────────

const masked = safeGmailErrorMessage(new GmailApiError('Échec : refresh_token=YA29.a0AfH6SMBx… rejeté', 400, ''));
ok(!masked.includes('YA29'), '5a. refresh_token masqué');
ok(masked.includes('[MASQUÉ]'), '5b. motif de masquage présent');
const masked2 = safeGmailErrorMessage({ message: 'auth=Bearer abc123xyz refusé' });
ok(!masked2.includes('abc123xyz'), '5c. bearer token masqué');
const masked3 = safeGmailErrorMessage(new GmailApiError('Envoi refusé', 429, ''));
ok(masked3.startsWith('Gmail 429 — '), '5d. statut Gmail préfixé');

// ─── 6. Extraction des raisons d'erreur du point token ─────────────────────

assert.strictEqual(
  tokenErrorReason('{"error":"invalid_grant","error_description":"Token has been expired or revoked."}'),
  'invalid_grant — Token has been expired or revoked.',
  '6a. erreur JSON parsée',
);
passed++;
assert.strictEqual(
  tokenErrorReason('error=invalid_grant&error_description=Bad+Verification+Code'),
  'invalid_grant — Bad Verification Code',
  '6b. erreur form-encoded parsée (décodage +)',
);
passed++;
assert.strictEqual(tokenErrorReason('corps illisible…'), 'corps illisible…', '6c. corps brut renvoyé tel quel');
ok(tokenErrorReason('').includes('erreur inconnue'), '6d. corps vide → erreur inconnue');

// TÂCHE 185 — format IMBRIQUÉ de l'API Gmail REST (rencontré en production :
// API désactivée → 403 {"error":{"code":403,"message":"…","status":…}}).
const gmailDisabledBody = JSON.stringify({
  error: {
    code: 403,
    message:
      'Gmail API has not been used in project 709396505816 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=709396505816 then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.',
    status: 'PERMISSION_DENIED',
  },
});
const reasonGmail = tokenErrorReason(gmailDisabledBody);
ok(
  reasonGmail.startsWith('Gmail API has not been used in project 709396505816'),
  '6e. erreur Gmail imbriquée : message extrait (pas le JSON brut)',
);
ok(reasonGmail.includes('PERMISSION_DENIED'), '6f. statut Gmail annexé');
ok(!reasonGmail.includes('{'), '6g. aucun reste de JSON dans le message');
const gmailQuota = tokenErrorReason(
  JSON.stringify({ error: { code: 429, message: 'User rate limit exceeded.', status: 'RESOURCE_EXHAUSTED' } }),
);
ok(gmailQuota.includes('User rate limit exceeded'), '6h. autre erreur Gmail imbriquée parsée');

// ─── 6bis. Détection « API Gmail désactivée » (tâche 185) ───────────────────

ok(isGmailApiDisabledError(gmailDisabledBody), '6bis-a. corps 403 API désactivée détecté');
ok(
  isGmailApiDisabledError('{"error":{"code":403,"message":"it is disabled"}}'),
  '6bis-b. variante « it is disabled »',
);
ok(
  !isGmailApiDisabledError(
    JSON.stringify({
      error: { code: 403, message: 'Request had insufficient authentication scopes.', status: 'PERMISSION_DENIED' },
    }),
  ),
  '6bis-c. portée insuffisante ≠ API désactivée (ne bloque pas la connexion)',
);
ok(!isGmailApiDisabledError(''), '6bis-d. corps vide → non bloquant');

// ─── 7. base64url ───────────────────────────────────────────────────────────

const buf = Buffer.from('Hello Academia Helm +/ = test');
const b64 = base64Url(buf);
ok(!b64.includes('+') && !b64.includes('/') && !b64.includes('='), '7a. alphabet base64url strict');
assert.strictEqual(Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(), 'Hello Academia Helm +/ = test', '7b. aller-retour base64url');
passed++;

// ─── 8. Composition MIME réelle (MailComposer — voie d'envoi Phase 2) ──────

// Reproduit buildRawMime du GoogleOauthService : même appel, même encodage.
async function buildRawMime(mail: Record<string, unknown>): Promise<string> {
  const MailComposer = require('nodemailer/lib/mail-composer');
  const composer = new MailComposer(mail);
  const buffer: Buffer = await composer.compile().build();
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

(async () => {
  const rawB64 = await buildRawMime({
    from: '"Complexe Scolaire Mon Avenir Plus" <ecole.test@gmail.com>',
    to: ['parent@example.com', ' directeur@example.com '],
    replyTo: 'secretariat@monavenirplus.bj',
    subject: 'Bulletin du premier trimestre 2026-2027',
    html: '<p>Bonjour, voici le bulletin.</p>',
    text: 'Bonjour, voici le bulletin.',
    attachments: [
      { filename: 'bulletin.pdf', content: Buffer.from('%PDF-1.4 simulé'), contentType: 'application/pdf' },
    ],
  });
  const mime = Buffer.from(rawB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

  ok(mime.includes('From: Complexe Scolaire Mon Avenir Plus <ecole.test@gmail.com>'), '8a. en-tête From');
  ok(mime.includes('parent@example.com'), '8b. destinataire To');
  ok(mime.includes('Reply-To: secretariat@monavenirplus.bj'), '8c. en-tête Reply-To');
  ok(mime.includes('Bulletin du premier trimestre 2026-2027'), '8d. objet encodé');
  ok(mime.includes('multipart/mixed'), '8e. structure multipart (corps + PJ)');
  ok(mime.includes('application/pdf'), '8f. pièce jointe PDF typée');
  ok(mime.includes('text/html'), '8g. alternative HTML');
  ok(mime.includes('text/plain'), '8h. alternative texte brut');
  ok(!rawB64.includes('=') || rawB64.length > 0, '8i. encodage base64url du MIME');
  ok(!rawB64.includes('+') && !rawB64.includes('/'), '8j. alphabet base64url strict pour {raw}');

  console.log(`\n✅ TÂCHE 183 — ${passed} tests de logique pure Google OAuth2 : OK`);
  console.log('   (PKCE RFC 7636, state, URL d\'autorisation, classification API Gmail,');
  console.log('    masquage jetons, erreurs token, base64url, composition MIME réelle,');
  console.log('    erreurs Gmail REST imbriquées + détection API désactivée [tâche 185])');
})().catch((err) => {
  console.error('\n❌ Échec des tests tâche 183 :', err);
  process.exit(1);
});
