/**
 * ============================================================================
 * SEED PRODUCTION SUBDOMAINS — Script autonome pour créer les sous-domaines
 * des écoles existantes dans Vercel (le wildcard Cloudflare gère le DNS)
 * ============================================================================
 * 
 * Ce script:
 * 1. Récupère les domaines existants dans Vercel
 * 2. Récupère les tenants actifs depuis l'API de production
 * 3. Pour chaque tenant sans domaine Vercel, l'ajoute
 * 4. Vérifie les domaines ajoutés
 */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT = process.env.VERCEL_PROJECT;
const CF_TOKEN = process.env.CF_TOKEN;
const CF_ZONE = process.env.CF_ZONE;
const BASE_DOMAIN = 'academiahelm.com';
const API_BASE = 'https://api.academiahelm.com';

// ── Vercel API Helpers ──
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
  return await res.json();
}

// ── Cloudflare API Helpers ──
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

// ── Step 1: Get existing Vercel domains ──
async function getExistingVercelDomains() {
  console.log('\n📋 Step 1: Fetching existing Vercel domains...');
  const data = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains`);
  
  if (data.error) {
    console.log(`  ❌ Error: ${data.error.message}`);
    return [];
  }
  
  const domains = (data.domains || []).map(d => ({
    name: d.name,
    configured: d.configured !== false,
    verified: d.verified === true,
  }));
  
  console.log(`  Found ${domains.length} domains in Vercel:`);
  for (const d of domains) {
    const status = d.configured && d.verified ? '✅' : d.verified ? '⚠️' : '❌';
    console.log(`    ${status} ${d.name} (configured: ${d.configured}, verified: ${d.verified})`);
  }
  
  return domains;
}

// ── Step 2: Get active tenants from production API ──
async function getActiveTenants() {
  console.log('\n📋 Step 2: Fetching active tenants from production...');
  
  // We need to use the internal API. Since Cloudflare blocks server requests,
  // let's try the public portal API endpoint
  try {
    // Try fetching the portal data which lists schools
    const res = await fetch(`${API_BASE}/portal/schools`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (res.ok) {
      const data = await res.json();
      console.log(`  Found ${data.length || 0} schools via portal API`);
      return data;
    } else {
      console.log(`  API returned ${res.status} — Cloudflare challenge likely`);
    }
  } catch (e) {
    console.log(`  ⚠️  Cannot reach production API: ${e.message}`);
  }
  
  return null;
}

// ── Step 3: Detect wildcard and plan actions ──
async function detectWildcard() {
  console.log('\n📋 Step 3: Detecting Cloudflare wildcard CNAME...');
  
  const data = await cfFetch(`/dns_records?name=*.${BASE_DOMAIN}`);
  const hasWildcard = data.success && data.result?.some(
    r => r.type === 'CNAME' && r.name === `*.${BASE_DOMAIN}` && r.proxied === true
  );
  
  if (hasWildcard) {
    console.log(`  ✅ Wildcard CNAME *.${BASE_DOMAIN} detected — no individual CNAMEs needed`);
  } else {
    console.log(`  ❌ No wildcard CNAME found — individual CNAMEs will be needed`);
  }
  
  return hasWildcard;
}

// ── Step 4: Add domain to Vercel ──
async function addVercelDomain(domain) {
  console.log(`  Adding ${domain} to Vercel...`);
  
  const data = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  if (data.error) {
    if (data.error.code === 'domain_already_exists') {
      console.log(`  ℹ️  ${domain} already exists in Vercel`);
      return 'exists';
    }
    console.log(`  ❌ Failed: ${data.error.message}`);
    return 'failed';
  }
  
  console.log(`  ✅ ${domain} added to Vercel`);
  return 'added';
}

// ── Step 5: Verify domain in Vercel ──
async function verifyVercelDomain(domain) {
  console.log(`  Verifying ${domain}...`);
  
  const data = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains/${domain}/verify`, {
    method: 'POST',
  });
  
  if (data.verified) {
    console.log(`  ✅ ${domain} verified — SSL issued`);
    return true;
  }
  
  const reason = data.error?.message || 'DNS propagation';
  console.log(`  ⏳ ${domain} verification pending: ${reason}`);
  return false;
}

// ── Step 6: Check domain status ──
async function checkDomainStatus(domain) {
  const data = await vercelFetch(`/v10/projects/${VERCEL_PROJECT}/domains/${domain}`);
  
  if (data.name) {
    return {
      name: data.name,
      configured: data.configured !== false,
      verified: data.verified === true,
    };
  }
  return null;
}

// ── Main ──
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SEED PRODUCTION SUBDOMAINS                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Base domain: ${BASE_DOMAIN}`);
  console.log(`  Timestamp: ${new Date().toISOString()}`);
  
  const mode = process.argv[2] || 'check';
  const specificDomain = process.argv[3];
  
  // Step 1: Existing Vercel domains
  const existingDomains = await getExistingVercelDomains();
  const existingNames = new Set(existingDomains.map(d => d.name));
  
  // Step 2: Detect wildcard
  const hasWildcard = await detectWildcard();
  
  // Step 3: Get tenants
  const tenants = await getActiveTenants();
  
  if (mode === 'check') {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  STATUS CHECK MODE');
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Show which school subdomains exist in Vercel
    const schoolDomains = existingDomains.filter(d => 
      d.name !== BASE_DOMAIN && 
      d.name !== `www.${BASE_DOMAIN}` && 
      !d.name.endsWith('.vercel.app')
    );
    
    console.log(`\n  School subdomains in Vercel: ${schoolDomains.length}`);
    for (const d of schoolDomains) {
      const status = d.configured && d.verified ? '✅ OK' : '⚠️ PENDING';
      console.log(`    ${status}  ${d.name}`);
    }
    
    // Check unverified domains
    const unverified = schoolDomains.filter(d => !d.verified);
    if (unverified.length > 0) {
      console.log(`\n  ⚠️  ${unverified.length} domain(s) need verification:`);
      for (const d of unverified) {
        console.log(`    - ${d.name}`);
      }
      
      if (process.argv.includes('--fix')) {
        console.log('\n  🔧 Fixing unverified domains...');
        for (const d of unverified) {
          await new Promise(r => setTimeout(r, 2000));
          await verifyVercelDomain(d.name);
        }
      } else {
        console.log('\n  💡 Run with --fix to attempt verification of pending domains');
      }
    }
    
    console.log('\n  To add new school subdomains, run:');
    console.log('    node seed-production.mjs add');
    console.log('    node seed-production.mjs add ecole-mon-ecole');
    
  } else if (mode === 'add') {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ADD SUBDOMAIN MODE');
    console.log('═══════════════════════════════════════════════════════════════');
    
    if (specificDomain) {
      // Add a specific domain
      const fullDomain = specificDomain.includes('.') ? specificDomain : `${specificDomain}.${BASE_DOMAIN}`;
      
      if (existingNames.has(fullDomain)) {
        console.log(`\n  ℹ️  ${fullDomain} already exists in Vercel`);
        const status = await checkDomainStatus(fullDomain);
        if (status) {
          console.log(`    Configured: ${status.configured ? '✅' : '❌'}`);
          console.log(`    Verified: ${status.verified ? '✅' : '⏳'}`);
          if (!status.verified) {
            await verifyVercelDomain(fullDomain);
          }
        }
      } else {
        console.log(`\n  Creating ${fullDomain}...`);
        const result = await addVercelDomain(fullDomain);
        if (result === 'added' || result === 'exists') {
          await new Promise(r => setTimeout(r, 3000));
          const verified = await verifyVercelDomain(fullDomain);
          
          // Final status
          const finalStatus = await checkDomainStatus(fullDomain);
          if (finalStatus) {
            console.log(`\n  Final status for ${fullDomain}:`);
            console.log(`    Configured: ${finalStatus.configured ? '✅' : '❌'}`);
            console.log(`    Verified: ${finalStatus.verified ? '✅' : '⏳'}`);
          }
        }
      }
    } else {
      // Add all missing domains from tenants list
      if (!tenants || tenants.length === 0) {
        console.log('\n  ❌ Cannot fetch tenant list from production API.');
        console.log('  Cloudflare challenge is blocking server requests.');
        console.log('\n  Please provide specific subdomains to add:');
        console.log('    node seed-production.mjs add ecole-saint-joseph');
        console.log('    node seed-production.mjs add ecole-nouvelle');
        return;
      }
      
      // Process tenants
      for (const tenant of tenants) {
        if (tenant.subdomain) {
          const fullDomain = `${tenant.subdomain}.${BASE_DOMAIN}`;
          if (!existingNames.has(fullDomain)) {
            await addVercelDomain(fullDomain);
            await new Promise(r => setTimeout(r, 3000));
            await verifyVercelDomain(fullDomain);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }
    }
    
  } else if (mode === 'verify-all') {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  VERIFY ALL DOMAINS MODE');
    console.log('═══════════════════════════════════════════════════════════════');
    
    for (const d of existingDomains) {
      if (!d.verified && !d.name.endsWith('.vercel.app')) {
        await new Promise(r => setTimeout(r, 2000));
        await verifyVercelDomain(d.name);
      }
    }
    
  } else if (mode === 'delete') {
    if (!specificDomain) {
      console.log('\n  ❌ Please specify a domain to delete:');
      console.log('    node seed-production.mjs delete test.academiahelm.com');
      return;
    }
    
    console.log(`\n  Deleting ${specificDomain} from Vercel...`);
    const delRes = await fetch(
      `https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/domains/${specificDomain}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` },
      }
    );
    
    if (delRes.ok) {
      console.log(`  ✅ ${specificDomain} removed from Vercel`);
    } else {
      const data = await delRes.json();
      console.log(`  ❌ Failed: ${data.error?.message || 'Unknown error'}`);
    }
  }
  
  // Final summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CURRENT DOMAIN STATUS');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const finalDomains = await getExistingVercelDomains();
  const schoolDomains = finalDomains.filter(d => 
    d.name !== BASE_DOMAIN && 
    d.name !== `www.${BASE_DOMAIN}` && 
    !d.name.endsWith('.vercel.app')
  );
  
  console.log(`\n  School subdomains: ${schoolDomains.length}`);
  for (const d of schoolDomains) {
    const status = d.configured && d.verified ? '✅' : d.configured ? '⚠️' : '❌';
    console.log(`    ${status}  ${d.name}`);
  }
}

main().catch(console.error);
