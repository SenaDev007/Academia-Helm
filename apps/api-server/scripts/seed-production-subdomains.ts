/**
 * ============================================================================
 * SEED PRODUCTION SUBDOMAINS — Script autonome
 * ============================================================================
 * Interroge directement la base de données Neon pour récupérer les tenants actifs,
 * puis crée les sous-domaines dans Vercel (le wildcard Cloudflare gère le DNS).
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE = process.env.CLOUDFLARE_ZONE_ID;
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT = process.env.VERCEL_PROJECT_ID;
const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'academiahelm.com';

const DRY_RUN = process.argv.includes('--dry-run');
const SLUG_FILTER = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];

// ── Vercel API ──
async function vercelFetch(path, options = {}) {
  const url = `https://api.vercel.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return { status: res.status, data: await res.json() };
}

// ── Cloudflare API ──
async function cfFetch(path, options = {}) {
  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return await res.json();
}

// ── Helpers ──
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Step 1: Detect wildcard ──
async function detectWildcard() {
  console.log('\n📋 Step 1: Detecting Cloudflare wildcard CNAME...');
  const data = await cfFetch(`/dns_records?name=*.${BASE_DOMAIN}`);
  const hasWildcard = data.success && data.result?.some(
    r => r.type === 'CNAME' && r.name === `*.${BASE_DOMAIN}` && r.proxied === true
  );
  
  if (hasWildcard) {
    console.log(`  ✅ Wildcard *.${BASE_DOMAIN} détecté — CNAME individuels non nécessaires`);
  } else {
    console.log(`  ❌ Pas de wildcard — CNAME individuels requis`);
  }
  return hasWildcard;
}

// ── Step 2: Get existing Vercel domains ──
async function getExistingVercelDomains() {
  console.log('\n📋 Step 2: Récupération des domaines Vercel existants...');
  const { data } = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains`);
  
  if (data.error) {
    console.log(`  ❌ Erreur: ${data.error.message}`);
    return new Set();
  }
  
  const domains = (data.domains || []).map(d => d.name);
  console.log(`  ${domains.length} domaine(s) déjà dans Vercel:`);
  for (const d of domains) {
    console.log(`    • ${d}`);
  }
  return new Set(domains);
}

// ── Step 3: Get active tenants from DB ──
async function getActiveTenants(prisma) {
  console.log('\n📋 Step 3: Récupération des tenants actifs depuis la base de données...');
  
  const tenants = await prisma.$queryRaw`
    SELECT id, name, slug, subdomain, status
    FROM tenants
    WHERE subdomain IS NOT NULL
      AND status = 'active'
    ORDER BY name ASC
  `;
  
  console.log(`  ${tenants.length} tenant(s) actif(s) avec sous-domaine trouvé(s):`);
  for (const t of tenants) {
    console.log(`    • ${t.name} → ${t.subdomain}.${BASE_DOMAIN} (slug: ${t.slug})`);
  }
  
  return tenants;
}

// ── Step 4: Create subdomain in Vercel ──
async function createVercelSubdomain(domain) {
  console.log(`\n  ▲ Ajout de ${domain} dans Vercel...`);
  
  const { status, data } = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  if (status === 409) {
    console.log(`  ℹ️  ${domain} existe déjà dans Vercel`);
    return 'exists';
  }
  
  if (status > 299) {
    const error = data.error?.message || data.message || 'Unknown error';
    console.log(`  ❌ Échec: ${error}`);
    return 'failed';
  }
  
  console.log(`  ✅ ${domain} ajouté dans Vercel`);
  return 'added';
}

// ── Step 5: Verify domain in Vercel ──
async function verifyVercelDomain(domain) {
  console.log(`  🔐 Vérification de ${domain}...`);
  
  const { data } = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains/${domain}/verify`, {
    method: 'POST',
  });
  
  if (data.verified) {
    console.log(`  ✅ ${domain} vérifié — SSL émis`);
    return true;
  }
  
  const reason = data.error?.message || 'Propagation DNS en cours';
  console.log(`  ⏳ ${domain} vérification en attente: ${reason}`);
  return false;
}

// ── Step 6: Track in DB ──
async function trackInDb(prisma, tenantId, domain, verified) {
  try {
    const existing = await prisma.$queryRaw`
      SELECT id, "verifiedAt" FROM tenant_domains 
      WHERE "tenantId" = ${tenantId} AND domain = ${domain}
      LIMIT 1
    `;
    
    if (existing.length > 0) {
      await prisma.$executeRaw`
        UPDATE tenant_domains 
        SET "isActive" = true, "isPrimary" = true, 
            "verifiedAt" = COALESCE(${verified ? new Date() : null}, "verifiedAt"),
            "updatedAt" = NOW()
        WHERE id = ${existing[0].id}
      `;
      console.log(`  📝 TenantDomain mis à jour pour ${domain}`);
      return 'updated';
    }
    
    await prisma.$executeRaw`
      INSERT INTO tenant_domains (id, "tenantId", domain, "isPrimary", "isActive", "verifiedAt", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${tenantId}, ${domain}, true, true, ${verified ? new Date() : null}, NOW(), NOW())
    `;
    console.log(`  📝 TenantDomain créé pour ${domain}`);
    return 'created';
  } catch (error) {
    console.log(`  ⚠️  Erreur DB pour ${domain}: ${error.message}`);
    return 'failed';
  }
}

// ── Main ──
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SEED PRODUCTION SUBDOMAINS — Academia Helm                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Timestamp: ${new Date().toISOString()}`);
  
  if (DRY_RUN) {
    console.log('  🏃 MODE DRY-RUN — Aucune modification ne sera effectuée');
  }
  
  if (SLUG_FILTER) {
    console.log(`  🎯 Filtre: seul le tenant "${SLUG_FILTER}" sera traité`);
  }
  
  // Step 1: Detect wildcard
  const hasWildcard = await detectWildcard();
  
  // Step 2: Existing Vercel domains
  const existingDomains = await getExistingVercelDomains();
  
  // Step 3: Connect to DB and get tenants
  const prisma = new PrismaClient();
  
  try {
    const tenants = await getActiveTenants(prisma);
    
    if (tenants.length === 0) {
      console.log('\n✅ Aucun tenant actif avec sous-domaine. Terminé.');
      return;
    }
    
    // Filter if needed
    const filteredTenants = SLUG_FILTER
      ? tenants.filter(t => t.slug === SLUG_FILTER || t.subdomain === SLUG_FILTER)
      : tenants;
    
    if (filteredTenants.length === 0) {
      console.log(`\n❌ Aucun tenant trouvé avec le filtre "${SLUG_FILTER}"`);
      return;
    }
    
    // Process each tenant
    console.log(`\n═══════════════════════════════════════════════════════════════`);
    console.log(`  TRAITEMENT DE ${filteredTenants.length} TENANT(S)`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    const results = [];
    
    for (let i = 0; i < filteredTenants.length; i++) {
      const tenant = filteredTenants[i];
      const fullDomain = `${tenant.subdomain}.${BASE_DOMAIN}`;
      
      console.log(`\n[${i + 1}/${filteredTenants.length}] ${tenant.name} (${fullDomain})`);
      
      const result = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        domain: fullDomain,
        vercel: 'skipped',
        verified: false,
        db: 'skipped',
      };
      
      if (DRY_RUN) {
        console.log('  🏃 DRY-RUN: Simulation — aucune action');
        results.push(result);
        continue;
      }
      
      // Skip if domain already in Vercel
      if (existingDomains.has(fullDomain)) {
        console.log(`  ℹ️  ${fullDomain} existe déjà dans Vercel`);
        result.vercel = 'exists';
        
        // Try to verify if not yet
        await sleep(1000);
        const verified = await verifyVercelDomain(fullDomain);
        result.verified = verified;
      } else {
        // Add to Vercel
        const addResult = await createVercelSubdomain(fullDomain);
        result.vercel = addResult;
        
        if (addResult === 'added' || addResult === 'exists') {
          // Wait for DNS propagation then verify
          console.log('  ⏳ Attente 3s pour propagation DNS...');
          await sleep(3000);
          const verified = await verifyVercelDomain(fullDomain);
          result.verified = verified;
        }
      }
      
      // Track in DB
      result.db = await trackInDb(prisma, tenant.id, fullDomain, result.verified);
      
      results.push(result);
      
      // Pause between tenants
      if (i < filteredTenants.length - 1) {
        await sleep(1000);
      }
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const added = results.filter(r => r.vercel === 'added').length;
    const existing = results.filter(r => r.vercel === 'exists').length;
    const failed = results.filter(r => r.vercel === 'failed').length;
    const verified = results.filter(r => r.verified).length;
    
    console.log(`\n  Total traités    : ${results.length}`);
    console.log(`  ✅ Ajoutés       : ${added}`);
    console.log(`  ℹ️  Existaient    : ${existing}`);
    console.log(`  ❌ Échoués       : ${failed}`);
    console.log(`  🔐 Vérifiés      : ${verified}`);
    
    if (failed > 0) {
      console.log('\n  ❌ Tenants en échec:');
      for (const r of results.filter(r => r.vercel === 'failed')) {
        console.log(`    - ${r.tenantName} (${r.domain})`);
      }
    }
    
    const unverified = results.filter(r => !r.verified && r.vercel !== 'failed');
    if (unverified.length > 0) {
      console.log('\n  ⏳ Domaines en attente de vérification:');
      for (const r of unverified) {
        console.log(`    - ${r.domain} → Relancez le script dans 5-10 minutes`);
      }
      console.log('\n  💡 Conseil: La vérification SSL peut prendre quelques minutes.');
      console.log('     Relancez ce script plus tard pour retenter la vérification.');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
