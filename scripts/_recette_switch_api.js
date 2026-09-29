/**
 * Recette API du switch de portail — contre la PRODUCTION (api.academiahelm.com)
 *
 * Scénario Fatou TEST (secrétaire-enseignante, double casquette) :
 *   1. Login Portail ÉCOLE (email)        → token SCHOOL   [règle double casquette loginSchool]
 *   2. GET switch-options (SCHOOL)         → available: [TEACHER] + profil teacher
 *   3. POST switch-portal → TEACHER        → token TEACHER + teacher {matricule}
 *   4. GET switch-options (TEACHER)        → available: [SCHOOL]
 *   5. POST switch-portal → SCHOOL         → retour École (bascule réversible)
 *   6. NÉGATIF : switch vers portail courant → 400 « déjà sur le portail »
 *   7. NÉGATIF : switch vers cible invalide → 400
 *   8. Login Portail ENSEIGNANT (matricule) → token TEACHER [loginTeacher direct]
 *   9. NÉGATIF : Promoteur (sans profil enseignant) → switch-options available: []
 *      (le bouton « Basculer » ne doit pas s'afficher)
 */
const API = 'https://api.academiahelm.com/api';
const TENANT_SLUG = 'cspeb-eveildafriqueeducation';

const TEST_EMAIL = 'recette.doublecasquette@cspeb.test';
const TEST_PASSWORD = 'Recette@2026';
const TEST_MATRICULE = 'CSPEBE-26-00013';
const PROMOTEUR_EMAIL = 'salumerhel2036@gmail.com';
const PROMOTEUR_PASSWORD = 'CSPEB.fondé2021';

let pass = 0, fail = 0;
function check(label, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
}

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function main() {
  // ══ 1. Login ÉCOLE (email + mot de passe) ══
  const schoolLogin = await post('/portal/auth/school', {
    tenantId: TENANT_SLUG,
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  const schoolToken = schoolLogin.json?.token ?? schoolLogin.json?.accessToken;
  check('1. Login Portail ÉCOLE (email) accepté pour ENSEIGNANT + affectation admin',
    schoolLogin.status === 200 && !!schoolToken,
    `status=${schoolLogin.status} portal=${schoolLogin.json?.portalType ?? schoolLogin.json?.user?.portal ?? '?'} role=${schoolLogin.json?.user?.role ?? '?'}`);

  if (!schoolToken) {
    console.log('Réponse:', JSON.stringify(schoolLogin.json).slice(0, 400));
    console.log('>> Arrêt : impossible de continuer sans token.');
    process.exit(1);
  }

  // ══ 2. switch-options depuis ÉCOLE ══
  const opt1 = await get('/portal/auth/switch-options', schoolToken);
  const avail1 = opt1.json?.available ?? [];
  check('2. switch-options (session ÉCOLE) → TEACHER disponible',
    opt1.status === 200 && avail1.includes('TEACHER'),
    `current=${opt1.json?.current} available=[${avail1}] teacher=${opt1.json?.teacher?.matricule ?? 'null'}`);

  // ══ 3. Bascule ÉCOLE → ENSEIGNANT ══
  const sw1 = await post('/portal/auth/switch-portal', { targetPortal: 'TEACHER' }, schoolToken);
  const teacherToken = sw1.json?.token;
  check('3. Bascule ÉCOLE → ENSEIGNANT sans déconnexion',
    sw1.status === 200 && !!teacherToken && sw1.json?.portalType === 'TEACHER',
    `status=${sw1.status} portal=${sw1.json?.portalType} matricule=${sw1.json?.teacher?.matricule ?? '?'} sessionId=${sw1.json?.sessionId ? 'oui' : 'non'}`);

  // ══ 4. switch-options depuis ENSEIGNANT ══
  const opt2 = await get('/portal/auth/switch-options', teacherToken);
  const avail2 = opt2.json?.available ?? [];
  check('4. switch-options (session ENSEIGNANT) → ÉCOLE disponible',
    opt2.status === 200 && avail2.includes('SCHOOL') && !avail2.includes('TEACHER'),
    `current=${opt2.json?.current} available=[${avail2}]`);

  // ══ 5. Bascule retour ENSEIGNANT → ÉCOLE ══
  const sw2 = await post('/portal/auth/switch-portal', { targetPortal: 'SCHOOL' }, teacherToken);
  check('5. Bascule retour ENSEIGNANT → ÉCOLE (réversibilité)',
    sw2.status === 200 && sw2.json?.portalType === 'SCHOOL',
    `status=${sw2.status} portal=${sw2.json?.portalType}`);

  // ══ 6. Négatif : bascule vers le portail courant ══
  const schoolToken2 = sw2.json?.token ?? schoolToken;
  const sw3 = await post('/portal/auth/switch-portal', { targetPortal: 'SCHOOL' }, schoolToken2);
  check('6. Négatif : bascule vers portail courant refusée (400)',
    sw3.status === 400,
    `status=${sw3.status} msg=${(sw3.json?.message || '').slice(0, 60)}`);

  // ══ 7. Négatif : cible invalide ══
  const sw4 = await post('/portal/auth/switch-portal', { targetPortal: 'PARENT' }, schoolToken2);
  check('7. Négatif : portail cible invalide refusé (400)',
    sw4.status === 400,
    `status=${sw4.status}`);

  // ══ 8. Login ENSEIGNANT direct (matricule) ══
  const teacherLogin = await post('/portal/auth/teacher', {
    tenantId: TENANT_SLUG,
    teacherIdentifier: TEST_MATRICULE,
    password: TEST_PASSWORD,
  });
  const directTeacherToken = teacherLogin.json?.token;
  check('8. Login direct Portail ENSEIGNANT (matricule) fonctionne',
    teacherLogin.status === 200 && !!directTeacherToken,
    `status=${teacherLogin.status} matricule=${teacherLogin.json?.teacher?.matricule ?? '?'}`);

  // ══ 9. Négatif : Promoteur sans profil enseignant ══
  const promoLogin = await post('/portal/auth/school', {
    tenantId: TENANT_SLUG,
    email: PROMOTEUR_EMAIL,
    password: PROMOTEUR_PASSWORD,
  });
  if (promoLogin.status === 200 && promoLogin.json?.token) {
    const optP = await get('/portal/auth/switch-options', promoLogin.json.token);
    const availP = optP.json?.available ?? [];
    check('9. Négatif : Promoteur (sans 2e casquette) → aucune bascule disponible',
      optP.status === 200 && availP.length === 0,
      `available=[${availP}] (bouton « Basculer » masqué)`);
  } else {
    check('9. Promoteur : login impossible (mot de passe changé ?) — test sauté', true,
      `status=${promoLogin.status}`);
  }

  console.log(`\n════ RÉSULTAT : ${pass} OK / ${fail} ÉCHEC(S) ════`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
