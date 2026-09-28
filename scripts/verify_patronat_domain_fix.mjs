/**
 * Validation production — création du sous-domaine patronat (pattern Helm)
 * ============================================================================
 * Correctif : commit 78ade4056 « fix(federis): création du sous-domaine
 * patronat à l'activation — pattern Helm onboarding ».
 *
 * Scénario :
 *   1. Attendre le déploiement Railway (la réponse verify gagne le champ
 *      domainStatus une fois le nouveau code en ligne) ;
 *   2. POST /federis/public/checkout/verify { transactionId } sur la
 *      transaction PAYÉE du patronat national (514552 / facture
 *      FED-PAT-2026-0014, sous-domaine patronatnational) → le SELF-HEAL
 *      (buildActivationSnapshot) détecte l'absence de TenantDomain et crée
 *      le domaine Cloudflare + Vercel ;
 *   3. Vérifier la création : réponse (domainStatus/vercelAdded), résolution
 *      DNS et HTTPS du sous-domaine.
 *
 * Usage : node scripts/verify_patronat_domain_fix.mjs [transactionId]
 */

const API_BASE = 'https://api.academiahelm.com/api';
const DEFAULT_TX = '514552'; // patronat national réel (facture FED-PAT-2026-0014)
const SUBDOMAIN = 'patronatnational.academiahelm.com';
const DEPLOY_TIMEOUT_MS = 12 * 60 * 1000; // 12 min max d'attente déploiement
const POLL_INTERVAL_MS = 30_000;

const txId = process.argv[2] || DEFAULT_TX;

async function verify() {
  const res = await fetch(`${API_BASE}/federis/public/checkout/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionId: txId }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Réponse non JSON (HTTP ${res.status}) : ${text.slice(0, 200)}`);
  }
  return { status: res.status, data };
}

async function checkDns(domain) {
  try {
    const { execSync } = await import('node:child_process');
    const out = execSync(`dig +short ${domain} CNAME`, { timeout: 10_000 }).toString().trim();
    const a = execSync(`dig +short ${domain} A`, { timeout: 10_000 }).toString().trim();
    return { cname: out || null, a: a || null };
  } catch {
    return { cname: null, a: null };
  }
}

async function checkHttps(domain) {
  try {
    const res = await fetch(`https://${domain}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: true, status: res.status, server: res.headers.get('server') };
  } catch (err) {
    return { ok: false, error: String(err?.cause?.code || err?.message || err).slice(0, 120) };
  }
}

const banner = (s) => console.log(`\n${'═'.repeat(70)}\n  ${s}\n${'═'.repeat(70)}`);

banner(`VALIDATION création sous-domaine patronat — tx ${txId}`);

// ── 1. Attendre le déploiement (champ domainStatus présent) ──────────
console.log(`\n[1/3] Attente déploiement Railway (max ${DEPLOY_TIMEOUT_MS / 60000} min)…`);
const start = Date.now();
let first;
let deployed = false;
while (Date.now() - start < DEPLOY_TIMEOUT_MS) {
  try {
    const { status, data } = await verify();
    if (!first) first = { status, data };
    const hasField = 'domainStatus' in (data ?? {});
    console.log(
      `  ${new Date().toISOString().slice(11, 19)} HTTP ${status} — status=${data?.status} outcome=${data?.outcome ?? '-'} domainStatus=${data?.domainStatus ?? 'ABSENT (ancien code)'}${data?.message ? ` msg=${String(data.message).slice(0, 80)}` : ''}`,
    );
    if (hasField) {
      deployed = true;
      break;
    }
  } catch (err) {
    console.log(`  ${new Date().toISOString().slice(11, 19)} erreur réseau : ${String(err?.message || err).slice(0, 100)}`);
  }
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
}

if (!deployed) {
  console.log('\n❌ Le nouveau code n’est pas encore en ligne (domainStatus absent après le timeout).');
  console.log('   → Vérifier le déploiement Railway, puis relancer ce script.');
  if (first) console.log('\nDernière réponse brute :', JSON.stringify(first.data, null, 2).slice(0, 1500));
  process.exit(1);
}

// ── 2. Résultat du verify (self-heal déclenché) ───────────────────────
const final = await verify();
const d = final.data;
console.log(`\n[2/3] Réponse verify finale :`);
console.log(`  status         : ${d?.status}`);
console.log(`  activated      : ${d?.activated}`);
console.log(`  subdomain      : ${d?.subdomain}`);
console.log(`  siteUrl        : ${d?.siteUrl}`);
console.log(`  loginUrl       : ${d?.loginUrl}`);
console.log(`  domainStatus   : ${d?.domainStatus}`);
console.log(`  domainError    : ${d?.domainError ?? '—'}`);

// ── 3. DNS + HTTPS du sous-domaine ────────────────────────────────────
console.log(`\n[3/3] Vérification technique ${SUBDOMAIN} :`);
const dns = await checkDns(SUBDOMAIN);
console.log(`  DNS CNAME : ${dns.cname ?? '(aucun)'}`);
console.log(`  DNS A     : ${dns.a ? dns.a.split('\n').slice(0, 3).join(', ') : '(aucun)'}`);
const https = await checkHttps(SUBDOMAIN);
console.log(
  `  HTTPS     : ${https.ok ? `HTTP ${https.status} (server: ${https.server})` : `ÉCHEC — ${https.error}`}`,
);

banner('SYNTHÈSE');
if (d?.domainStatus === 'created') {
  console.log('✅ Domaine patronat CRÉÉ (Cloudflare/Vercel) — self-heal opérationnel.');
} else if (d?.domainStatus === 'not_configured') {
  console.log('⚠️  domainStatus=not_configured → VERCEL_API_TOKEN / VERCEL_PROJECT_ID absents sur Railway.');
} else if (d?.domainStatus === 'failed') {
  console.log(`⚠️  domainStatus=failed → ${d?.domainError}`);
} else {
  console.log(`⚠️  domainStatus inattendu : ${d?.domainStatus}`);
}
if (!https.ok) {
  console.log('ℹ️  HTTPS pas encore accessible — normal si :');
  console.log('   - propagation DNS en cours (quelques minutes),');
  console.log('   - certificat SSL en cours d’émission côté Vercel,');
  console.log('   - le wildcard *.academiahelm.com n’est pas encore créé dans Cloudflare');
  console.log('     (record : * CNAME cname.vercel-dns.com, proxied).');
}
console.log('\nÀ vérifier côté dashboards : Vercel → Settings → Domains (le sous-domaine');
console.log('doit apparaître) et Cloudflare → DNS (wildcard ou CNAME individuel).');
