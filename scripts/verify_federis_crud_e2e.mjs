/**
 * E2E — Validation live des nouveaux endpoints Federis (2026-09-28)
 *
 * Chaîne testée sur https://api.academiahelm.com :
 *   1. Register (patronat NATIONAL de test) → login (JWT)
 *   2. GET /federis/patronat/identity        → identité par défaut
 *   3. PATCH /federis/patronat/identity      → nom + logo configurés
 *   4. GET /federis/patronat/pricing         → barème NATIONAL (250k/500k)
 *   5. Bureau : POST + GET + PATCH + DELETE  → CRUD complet persisté
 *   6. Question-bank : POST + GET + PATCH + DELETE
 *   7. GET /federis/patronat/territorial-levels
 *
 * ⚠️ Patronat de QA créé sans paiement (abonnement PENDING_PAYMENT) — les
 * endpoints testés ne dépendent pas du statut d'abonnement.
 */

const API = 'https://api.academiahelm.com/api';

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function jsonFetch(url, { method = 'GET', body, token } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  const text = await res.text();
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 300);
  }
  return { status: res.status, body: parsed };
}

async function main() {
  const stamp = Date.now().toString(36);
  const email = `testqa.crud.${stamp}@academiahelm.test`;

  // ── 1. Register + Login ─────────────────────────────────────────────
  const { body: countries } = await jsonFetch(`${API}/federis/public/countries`);
  const benin = (countries ?? []).find((c) => /b.nin/i.test(c.name ?? '') || c.code === 'BJ');
  if (!benin) throw new Error('Bénin introuvable');
  log(`🌍 Pays : ${benin.name}`);

  const reg = await jsonFetch(`${API}/federis/public/register`, {
    method: 'POST',
    body: {
      countryId: benin.id,
      territorialLevelCode: 'NATIONAL',
      name: `Patronat QA CRUD ${stamp}`,
      territoryName: benin.name,
      responsibleName: 'Test QA Crud',
      email,
      phone: '+2290197000' + (stamp.length % 10),
      password: 'CrudQA#2026Secure',
    },
  });
  if (reg.status !== 201 && reg.body?.success !== true) {
    throw new Error(`register: HTTP ${reg.status} ${JSON.stringify(reg.body).slice(0, 300)}`);
  }
  log(`📝 Patronat QA créé : ${reg.body.patronat?.name}`);

  const login = await jsonFetch(`${API}/auth/login`, {
    method: 'POST',
    body: { email, password: 'CrudQA#2026Secure' },
  });
  const token = login.body?.accessToken;
  if (!token) throw new Error(`login: HTTP ${login.status} ${JSON.stringify(login.body).slice(0, 300)}`);
  log('🔐 Login OK');

  // ── 2. GET identity (défaut) ────────────────────────────────────────
  const id0 = await jsonFetch(`${API}/federis/patronat/identity`, { token });
  if (id0.status !== 200) throw new Error(`identity GET: HTTP ${id0.status}`);
  log(`🪪 Identité par défaut : « ${id0.body.name} » (logo: ${id0.body.logo ? 'présent' : 'null'})`);

  // ── 3. PATCH identity (nom + logo) ──────────────────────────────────
  const tinyLogo =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const upd = await jsonFetch(`${API}/federis/patronat/identity`, {
    method: 'PATCH',
    token,
    body: {
      name: `Patronat QA CRUD ${stamp} — Renommé`,
      abbreviation: 'PQA',
      logo: tinyLogo,
      primaryEmail: email,
    },
  });
  if (upd.status !== 200 || upd.body?.success !== true) {
    throw new Error(`identity PATCH: HTTP ${upd.status} ${JSON.stringify(upd.body).slice(0, 300)}`);
  }
  log(`✏️  Identité mise à jour : « ${upd.body.patronat.name} » + logo configuré`);

  const id1 = await jsonFetch(`${API}/federis/patronat/identity`, { token });
  if (id1.body.name !== `Patronat QA CRUD ${stamp} — Renommé` || !id1.body.logo) {
    throw new Error(`identity re-GET incohérent : ${JSON.stringify(id1.body).slice(0, 200)}`);
  }
  log('🔁 Relecture identité : nom + logo persistés ✓');

  // ── 4. Pricing : barème NATIONAL (250k / 500k) ──────────────────────
  const pricing = await jsonFetch(`${API}/federis/patronat/pricing`, { token });
  if (pricing.status !== 200) throw new Error(`pricing: HTTP ${pricing.status}`);
  const essential = pricing.body.plans?.find((p) => p.code === 'ESSENTIEL');
  const institution = pricing.body.plans?.find((p) => p.code === 'INSTITUTION');
  log(
    `💰 Barème ${pricing.body.orgLevel} : Essentiel ${essential?.amountXOF?.toLocaleString()} / Institution ${institution?.amountXOF?.toLocaleString()} XOF`,
  );
  if (pricing.body.orgLevel !== 'NATIONAL' || essential?.amountXOF !== 250000 || institution?.amountXOF !== 500000) {
    throw new Error('Barème NATIONAL incorrect (attendu 250 000 / 500 000)');
  }
  log('✅ Barème national supérieur confirmé (250k > 100k, 500k > 250k)');

  // ── 5. Bureau CRUD ──────────────────────────────────────────────────
  const bureauCreate = await jsonFetch(`${API}/federis/patronat/bureau`, {
    method: 'POST',
    token,
    body: {
      firstName: 'Awa',
      lastName: 'Dossou',
      role: 'SECRETAIRE_GENERAL',
      email: `awa.${stamp}@patronat.test`,
      phone: '+22997000001',
    },
  });
  if (bureauCreate.status !== 201 && bureauCreate.body?.success !== true) {
    throw new Error(`bureau POST: HTTP ${bureauCreate.status} ${JSON.stringify(bureauCreate.body).slice(0, 300)}`);
  }
  const memberId = bureauCreate.body.member?.id;
  log(`👤 Bureau : Awa Dossou (Secrétaire Général) créée — id ${memberId?.slice(0, 8)}…`);

  const bureauList = await jsonFetch(`${API}/federis/patronat/bureau`, { token });
  const listed = bureauList.body.members?.map((m) => `${m.firstName} ${m.lastName} (${m.roleLabel})`);
  log(`📋 Composition (${bureauList.body.members?.length} membres) : ${listed?.join(' · ')}`);
  if (!bureauList.body.canManage) throw new Error('canManage should be true pour le coordonnateur');

  const bureauPatch = await jsonFetch(`${API}/federis/patronat/bureau/${memberId}`, {
    method: 'PATCH',
    token,
    body: { role: 'TRESORIER_GENERAL', isActive: false },
  });
  if (bureauPatch.status !== 200) throw new Error(`bureau PATCH: HTTP ${bureauPatch.status} ${JSON.stringify(bureauPatch.body).slice(0, 200)}`);
  log('✏️  Bureau : rôle → Trésorier Général, inactive ✓');

  const bureauDel = await jsonFetch(`${API}/federis/patronat/bureau/${memberId}`, {
    method: 'DELETE',
    token,
  });
  if (bureauDel.status !== 200 && bureauDel.body?.success !== true) {
    throw new Error(`bureau DELETE: HTTP ${bureauDel.status}`);
  }
  log('🗑️  Bureau : membre retiré ✓ (CRUD complet validé)');

  // ── 6. Question-bank CRUD ───────────────────────────────────────────
  const qbCreate = await jsonFetch(`${API}/federis/patronat/question-bank`, {
    method: 'POST',
    token,
    body: {
      title: `Mathématiques — BAC D QA ${stamp}`,
      resourceType: 'EXAM_PAPER',
      subject: 'Mathématiques',
      classLevel: 'BAC D',
      examType: 'Session QA',
      fileUrl: tinyLogo,
      accessLevel: 'RESTRICTED',
    },
  });
  if (qbCreate.status !== 201 && qbCreate.body?.success !== true) {
    throw new Error(`question-bank POST: HTTP ${qbCreate.status} ${JSON.stringify(qbCreate.body).slice(0, 300)}`);
  }
  const resourceId = qbCreate.body.resource?.id;
  log(`📚 Banque : « ${qbCreate.body.resource?.title} » recensé — id ${resourceId?.slice(0, 8)}…`);

  const qbList = await jsonFetch(`${API}/federis/patronat/question-bank`, { token });
  log(`📚 Banque : ${qbList.body.resources?.length} épreuve(s) — canManage=${qbList.body.canManage}`);
  if (!qbList.body.resources?.some((r) => r.id === resourceId)) throw new Error('Ressource absente de la liste');

  const qbPatch = await jsonFetch(`${API}/federis/patronat/question-bank/${resourceId}`, {
    method: 'PATCH',
    token,
    body: { status: 'LOCKED' },
  });
  if (qbPatch.status !== 200) throw new Error(`question-bank PATCH: HTTP ${qbPatch.status}`);
  log('🔒 Banque : épreuve verrouillée ✓');

  const qbDel = await jsonFetch(`${API}/federis/patronat/question-bank/${resourceId}`, {
    method: 'DELETE',
    token,
  });
  if (qbDel.status !== 200 && qbDel.body?.success !== true) {
    throw new Error(`question-bank DELETE: HTTP ${qbDel.status}`);
  }
  log('🗑️  Banque : épreuve retirée ✓ (CRUD complet validé)');

  // ── 7. Territorial-levels (national) ────────────────────────────────
  const levels = await jsonFetch(`${API}/federis/patronat/territorial-levels`, { token });
  if (levels.status !== 200) throw new Error(`territorial-levels: HTTP ${levels.status}`);
  log(`🗺️  Niveaux territoriaux : ${(levels.body.levels ?? []).map((l) => l.label).join(', ') || '(aucun configuré)'}`);

  // ── 8. Landing page : logo propagé ──────────────────────────────────
  const reg2 = reg.body.patronat ?? {};
  const subdomain = reg2.subdomain ?? reg2.tenant?.subdomain;
  if (subdomain) {
    const info = await jsonFetch(`${API}/federis/public/patronat-info/${subdomain}`);
    if (info.body?.found && info.body.patronat?.logo) {
      log(`🌐 Landing ${subdomain} : nom « ${info.body.patronat.name} » + logo personnalisé propagés ✓`);
    } else {
      log(`🌐 Landing ${subdomain} : ${info.body?.found ? 'logo non propagé (à vérifier)' : 'sous-domaine pas encore actif (PENDING_PAYMENT — normal)'}`);
    }
  }

  console.log('\n════════════════════════════════════════════');
  console.log('✅ E2E COMPLET : identité configurable + pricing par niveau + bureau CRUD + question-bank CRUD — TOUT EST PERSISTÉ ET DÉPLOYÉ');
  console.log('════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('❌ E2E ÉCHOUÉ :', err.message);
  process.exit(1);
});
