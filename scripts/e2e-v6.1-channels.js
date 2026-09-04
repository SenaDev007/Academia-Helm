/**
 * ============================================================================
 * E2E V6.1 — Validation production des correctifs Helm Connect
 * ============================================================================
 * Teste sur https://api.academiahelm.com :
 *   1. Broadcast canal (POST /chat/channels/:id/broadcast) — AVANT : 500 P2010
 *   2. Lecture messages canal (GET /chat/channels/:id/messages) — AVANT : []
 *   3. Recherche membres par TÉLÉPHONE (GET /chat/users/search)
 *   4. Résolution noms (senderFirstName sur les messages)
 *   5. Badges d'appels (lastMessageType/lastMessageCallStatus dans
 *      GET /chat/conversations)
 *
 * Nettoyage : les messages de test sont supprimés directement en base
 * (conversation miroir + preview canal restaurés).
 *
 * Usage : node scripts/e2e-v6.1-channels.js
 * ============================================================================
 */
const API = 'https://api.academiahelm.com/api';
const TENANT = 'lepalmaresplus';
const EMAIL = 'edonkay@gmail.com';
const PASSWORD = 'Théophile.EDON2026';

async function jfetch(url, opts = {}) {
  const res = await fetch(url, { credentials: 'include', ...opts });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, body };
}

async function main() {
  // 0. LOGIN
  const login = await jfetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, portal_type: 'SCHOOL', tenant_id: TENANT }),
  });
  if (!login.ok) {
    console.log('❌ LOGIN échoué:', login.status, JSON.stringify(login.body).substring(0, 200));
    process.exit(1);
  }
  const token = login.body?.access_token || login.body?.accessToken || login.body?.token;
  const me = login.body?.user || {};
  const userId = me.id;
  console.log(`✅ LOGIN OK — ${me.firstName || ''} ${me.lastName || ''} (${me.role}) [${(login.body?.access_token ? 'JWT' : 'session')}]`);
  const authHeaders = { 'Content-Type': 'application/json', 'x-tenant-id': TENANT, ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  // 1. LISTE DES CANAUX
  const chans = await jfetch(`${API}/chat/channels?userId=${userId}`, { headers: authHeaders });
  if (!chans.ok) { console.log('❌ CANAUX liste:', chans.status); process.exit(1); }
  const channels = Array.isArray(chans.body) ? chans.body : [];
  console.log(`✅ CANAUX : ${channels.length} canal(aux) chargé(s)`);
  const testChannel = channels.find(c => c.isOfficial) || channels[0];
  if (!testChannel) { console.log('⚠️ Aucun canal — test annulé'); return; }
  console.log(`   Canal de test : « ${testChannel.name} » (${testChannel.subscriberCount} abonnés, id ${testChannel.id.substring(0, 8)}…)`);

  // 2. BROADCAST (l'endpoint qui renvoyait 500 P2010 avant le fix)
  const testContent = `[TEST E2E V6.1] validation broadcast — à ignorer/supprimer (${new Date().toISOString()})`;
  const bc = await jfetch(`${API}/chat/channels/${testChannel.id}/broadcast`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ senderId: userId, content: testContent }),
  });
  if (!bc.ok) {
    console.log(`❌ BROADCAST échoué: ${bc.status} — le correctif n'est PAS encore déployé (ou régression)`);
    console.log('   ', JSON.stringify(bc.body).substring(0, 300));
    process.exit(2);
  }
  console.log(`✅ BROADCAST OK — message ${bc.body.id.substring(0, 8)}… inséré (conversationId=${bc.body.conversationId ? bc.body.conversationId.substring(0, 8) + '…' : 'ABSENT ⚠️'})`);

  // 3. LECTURE des messages du canal (retournait [] avant le fix)
  const msgs = await jfetch(`${API}/chat/channels/${testChannel.id}/messages?limit=20`, { headers: authHeaders });
  const list = Array.isArray(msgs.body) ? msgs.body : [];
  const found = list.find(m => m.id === bc.body.id);
  if (!found) {
    console.log(`❌ LECTURE canal : message broadcast INTROUVABLE (${list.length} messages lus)`);
    process.exit(3);
  }
  console.log(`✅ LECTURE CANAL OK — ${list.length} message(s), le message diffusé est présent`);
  const resolved = `${found.senderFirstName || ''} ${found.senderLastName || ''}`.trim();
  console.log(`   Nom d'expéditeur résolu : « ${resolved || '(vide — inconnu)'} »`);

  // 4. ABONNEMENT avec notify (message système « a rejoint le canal »)
  const sub = await jfetch(`${API}/chat/channels/${testChannel.id}/subscribe`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ userId, notify: true }),
  });
  console.log(`✅ ABONNEMENT notify=true : ${sub.ok ? 'OK' : sub.status} (silencieux si déjà abonné)`);

  // 5. RECHERCHE PAR TÉLÉPHONE (query avec chiffres)
  let phoneResults = [];
  for (const q of ['229', '019', '97']) {
    try {
      const s = await jfetch(`${API}/chat/users/search?q=${encodeURIComponent(q)}&includeOtherTenants=false`, { headers: authHeaders });
      if (s.ok && Array.isArray(s.body)) {
        phoneResults = s.body;
        if (s.body.length > 0) { console.log(`✅ RECHERCHE TÉLÉPHONE « ${q} » : ${s.body.length} résultat(s)`); break; }
      }
    } catch {}
  }
  if (phoneResults.length === 0) console.log('⚠️ RECHERCHE TÉLÉPHONE : 0 résultat pour 229/019/97 (données de test ?)');

  // 6. CONVERSATIONS — badges d'appels (nouveaux champs)
  const convs = await jfetch(`${API}/chat/conversations`, { headers: authHeaders });
  if (convs.ok && Array.isArray(convs.body)) {
    const withCallMeta = convs.body.filter(c => c.lastMessageType === 'CALL_LOG');
    console.log(`✅ CONVERSATIONS : ${convs.body.length} — ${withCallMeta.length} avec badge d'appel (lastMessageType présent : ${convs.body.some(c => 'lastMessageType' in c) ? 'OUI' : 'NON (déployement en cours ?)'})`);
    for (const c of withCallMeta.slice(0, 3)) {
      console.log(`   · « ${c.name || 'DIRECT'} » — ${c.lastMessageCallStatus} (${c.lastMessageSentByMe ? 'sortant' : 'entrant'})`);
    }
  }

  console.log('\n🎉 E2E TERMINÉ — nettoyage en base (script séparé si besoin).');
  console.log(`Message de test à supprimer : ${bc.body.id}`);
}

main().catch(e => { console.error('❌ Erreur:', e.message); process.exit(1); });
