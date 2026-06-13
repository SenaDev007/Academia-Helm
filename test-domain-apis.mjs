/**
 * Test script for Cloudflare + Vercel domain management APIs
 * Tests connectivity, lists existing records, and can create a test subdomain
 */

const CLOUDFLARE_API_TOKEN = process.env.CF_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CF_ZONE;
const VERCEL_API_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT;
const BASE_DOMAIN = 'academiahelm.com';

const CF_BASE = `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}`;
const VERCEL_BASE = 'https://api.vercel.com';

// ─── Helpers ────────────────────────────────────────────────
async function cfFetch(path, options = {}) {
  const url = `${CF_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!data.success && data.errors) {
    console.error(`  ❌ Cloudflare API error:`, data.errors);
  }
  return data;
}

async function vercelFetch(path, options = {}) {
  const url = `${VERCEL_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json();
  if (data.error) {
    console.error(`  ❌ Vercel API error:`, data.error);
  }
  return data;
}

function logSection(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function logSuccess(msg) {
  console.log(`  ✅ ${msg}`);
}

function logInfo(msg) {
  console.log(`  ℹ️  ${msg}`);
}

function logError(msg) {
  console.log(`  ❌ ${msg}`);
}

// ─── Test 1: Cloudflare API Connectivity ────────────────────
async function testCloudflareConnectivity() {
  logSection('TEST 1: Cloudflare API Connectivity');
  
  // Verify token
  const verifyRes = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
  });
  const verifyData = await verifyRes.json();
  
  if (verifyData.success && verifyData.result?.status === 'active') {
    logSuccess(`Token is valid and active`);
    logInfo(`Token ID: ${verifyData.result.id}`);
  } else {
    logError(`Token verification failed: ${JSON.stringify(verifyData.errors)}`);
    return false;
  }

  // Get zone info
  const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}`, {
    headers: { 'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}` },
  });
  const zoneData = await zoneRes.json();
  
  if (zoneData.success) {
    logSuccess(`Zone found: ${zoneData.result.name}`);
    logInfo(`Zone status: ${zoneData.result.status}`);
    logInfo(`Nameservers: ${zoneData.result.name_servers?.join(', ')}`);
  } else {
    logError(`Zone lookup failed: ${JSON.stringify(zoneData.errors)}`);
    return false;
  }
  
  return true;
}

// ─── Test 2: List Cloudflare DNS Records ────────────────────
async function testListDnsRecords() {
  logSection('TEST 2: Cloudflare DNS Records');
  
  const data = await cfFetch('/dns_records?per_page=100');
  
  if (!data.success) return;
  
  const records = data.result || [];
  logInfo(`Total DNS records: ${records.length}`);
  
  // Filter for relevant records (subdomains of academiahelm.com)
  const subdomainRecords = records.filter(r => 
    r.name === BASE_DOMAIN || r.name.endsWith('.' + BASE_DOMAIN)
  );
  
  console.log('\n  DNS Records for academiahelm.com:');
  console.log('  ┌──────────────────────────────────────────┬────────┬─────────┬─────────┐');
  console.log('  │ Name                                     │ Type   │ Proxied │ Content │');
  console.log('  ├──────────────────────────────────────────┼────────┼─────────┼─────────┤');
  
  for (const r of subdomainRecords) {
    const name = r.name.padEnd(40).substring(0, 40);
    const type = r.type.padEnd(6);
    const proxied = (r.proxied ? '✓' : '✗').padEnd(7);
    const content = (r.content || '').padEnd(35).substring(0, 35);
    console.log(`  │ ${name} │ ${type} │ ${proxied} │ ${content} │`);
  }
  
  console.log('  └──────────────────────────────────────────┴────────┴─────────┴─────────┘');
  
  // Check for existing CNAME records pointing to vercel
  const vercelCnames = subdomainRecords.filter(r => 
    r.type === 'CNAME' && r.content.includes('vercel')
  );
  
  if (vercelCnames.length > 0) {
    logInfo(`Found ${vercelCnames.length} CNAME record(s) pointing to Vercel`);
    vercelCnames.forEach(r => {
      console.log(`    - ${r.name} → ${r.content} (proxied: ${r.proxied})`);
    });
  } else {
    logInfo('No CNAME records pointing to Vercel found');
  }
  
  // Check for wildcard
  const wildcard = subdomainRecords.find(r => r.name === '*.' + BASE_DOMAIN);
  if (wildcard) {
    logInfo(`Wildcard record found: *.${BASE_DOMAIN} → ${wildcard.content} (${wildcard.type}, proxied: ${wildcard.proxied})`);
  } else {
    logInfo('No wildcard DNS record found (expected - we removed it)');
  }
  
  return subdomainRecords;
}

// ─── Test 3: Vercel API Connectivity ────────────────────────
async function testVercelConnectivity() {
  logSection('TEST 3: Vercel API Connectivity');
  
  // Verify token
  const verifyRes = await vercelFetch('/v2/user');
  
  if (verifyRes.user) {
    logSuccess(`Token is valid`);
    logInfo(`User: ${verifyRes.user.name || verifyRes.user.username || verifyRes.user.email}`);
  } else {
    logError(`Token verification failed`);
    return false;
  }

  // Get project info
  const projectRes = await vercelFetch(`/v13/projects/${VERCEL_PROJECT_ID}`);
  
  if (projectRes.id) {
    logSuccess(`Project found: ${projectRes.name}`);
    logInfo(`Project ID: ${projectRes.id}`);
    logInfo(`Framework: ${projectRes.framework || 'N/A'}`);
    
    // List project domains
    if (projectRes.targets?.production?.alias) {
      logInfo(`Production aliases: ${projectRes.targets.production.alias.join(', ')}`);
    }
  } else {
    logError(`Project lookup failed`);
    return false;
  }
  
  return true;
}

// ─── Test 4: List Vercel Project Domains ────────────────────
async function testListVercelDomains() {
  logSection('TEST 4: Vercel Project Domains');
  
  const data = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`);
  
  if (data.error) {
    logError(`Failed to list domains`);
    return [];
  }
  
  const domains = data.domains || [];
  logInfo(`Total domains in project: ${domains.length}`);
  
  if (domains.length > 0) {
    console.log('\n  Vercel Domains:');
    console.log('  ┌──────────────────────────────────────┬─────────────┬──────────────┐');
    console.log('  │ Domain                               │ Config OK?  │ Verified?    │');
    console.log('  ├──────────────────────────────────────┼─────────────┼──────────────┤');
    
    for (const d of domains) {
      const name = d.name.padEnd(36).substring(0, 36);
      const config = (d.configured !== false ? '✓' : '✗').padEnd(11);
      const verified = (d.verified ? '✓' : '✗').padEnd(12);
      console.log(`  │ ${name} │ ${config} │ ${verified} │`);
    }
    
    console.log('  └──────────────────────────────────────┴─────────────┴──────────────┘');
    
    // Detail on problematic domains
    const problematic = domains.filter(d => d.configured === false || !d.verified);
    if (problematic.length > 0) {
      console.log('\n  ⚠️  Domains with issues:');
      for (const d of problematic) {
        console.log(`    - ${d.name}: configured=${d.configured}, verified=${d.verified}`);
        if (d.verification) {
          console.log(`      Verification: ${JSON.stringify(d.verification)}`);
        }
      }
    }
  }
  
  return domains;
}

// ─── Test 5: Create a test subdomain ────────────────────────
async function testCreateSubdomain(slug) {
  const domain = `${slug}.${BASE_DOMAIN}`;
  
  logSection(`TEST 5: Create Subdomain "${domain}"`);
  
  // Step 1: Check if CNAME already exists in Cloudflare
  logInfo('Step 1: Checking existing Cloudflare CNAME...');
  const existingRecords = await cfFetch(`/dns_records?name=${domain}`);
  
  if (existingRecords.success) {
    const existing = existingRecords.result?.find(r => r.type === 'CNAME' && r.name === domain);
    if (existing) {
      logInfo(`CNAME already exists: ${domain} → ${existing.content} (proxied: ${existing.proxied})`);
      
      if (existing.content === 'cname.vercel-dns.com' && existing.proxied) {
        logSuccess('CNAME is correctly configured!');
      } else {
        logInfo(`CNAME needs update - content: ${existing.content}, proxied: ${existing.proxied}`);
      }
    } else {
      // Create the CNAME
      logInfo('Creating CNAME record...');
      const createRes = await cfFetch('/dns_records', {
        method: 'POST',
        body: JSON.stringify({
          type: 'CNAME',
          name: slug,
          content: 'cname.vercel-dns.com',
          proxied: true,
          ttl: 1, // auto
        }),
      });
      
      if (createRes.success) {
        logSuccess(`CNAME created: ${domain} → cname.vercel-dns.com (proxied: true)`);
        logInfo(`Record ID: ${createRes.result.id}`);
      } else {
        logError(`Failed to create CNAME: ${JSON.stringify(createRes.errors)}`);
        return false;
      }
    }
  }
  
  // Step 2: Add domain to Vercel
  logInfo('Step 2: Adding domain to Vercel project...');
  const vercelAddRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  if (vercelAddRes.error) {
    if (vercelAddRes.error.code === 'domain_already_exists' || vercelAddRes.error.code === 'CONFLICT') {
      logInfo(`Domain already exists in Vercel project`);
    } else {
      logError(`Failed to add domain to Vercel: ${vercelAddRes.error.message || JSON.stringify(vercelAddRes.error)}`);
    }
  } else {
    logSuccess(`Domain added to Vercel: ${domain}`);
  }
  
  // Step 3: Wait a moment then verify
  logInfo('Step 3: Waiting 3 seconds before verification...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  logInfo('Step 4: Verifying domain in Vercel...');
  const verifyRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`, {
    method: 'POST',
  });
  
  if (verifyRes.error) {
    if (verifyRes.error.code === 'PRECONDITION_FAILED') {
      logInfo(`Domain verification pending - DNS propagation may take a few minutes`);
      logInfo(`This is normal for newly created CNAME records`);
    } else {
      logError(`Verification issue: ${verifyRes.error.message || JSON.stringify(verifyRes.error)}`);
    }
  } else {
    logSuccess(`Domain verified successfully!`);
  }
  
  // Step 5: Check final status
  logInfo('Step 5: Checking final domain status...');
  const statusRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}`);
  
  if (statusRes.name) {
    console.log(`\n  Final Status for ${domain}:`);
    console.log(`    - Configured: ${statusRes.configured !== false ? '✓ Yes' : '✗ No'}`);
    console.log(`    - Verified: ${statusRes.verified ? '✓ Yes' : '✗ No (pending)'}`);
    console.log(`    - Verification token: ${statusRes.verification?.token || 'N/A'}`);
    
    if (statusRes.configured !== false && statusRes.verified) {
      logSuccess('Domain is fully configured and verified!');
      return true;
    } else {
      logInfo('Domain is being configured - SSL certificate may take a few minutes');
      return 'pending';
    }
  }
  
  return false;
}

// ─── Test 6: Check a domain's full status ───────────────────
async function testCheckDomainStatus(slug) {
  const domain = `${slug}.${BASE_DOMAIN}`;
  
  logSection(`TEST 6: Full Status Check for "${domain}"`);
  
  // Cloudflare status
  const cfRecords = await cfFetch(`/dns_records?name=${domain}`);
  if (cfRecords.success) {
    const cname = cfRecords.result?.find(r => r.type === 'CNAME' && r.name === domain);
    if (cname) {
      logSuccess(`Cloudflare: CNAME exists → ${cname.content} (proxied: ${cname.proxied})`);
    } else {
      logError(`Cloudflare: No CNAME record found for ${domain}`);
    }
  }
  
  // Vercel status
  const vercelDomain = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}`);
  if (vercelDomain.name) {
    logSuccess(`Vercel: Domain exists`);
    logInfo(`  Configured: ${vercelDomain.configured !== false ? 'Yes' : 'No'}`);
    logInfo(`  Verified: ${vercelDomain.verified ? 'Yes' : 'No'}`);
    if (vercelDomain.configured !== false && vercelDomain.verified) {
      logSuccess(`  SSL: Active`);
    }
  } else {
    logError(`Vercel: Domain not found in project`);
  }
  
  // DNS resolution check
  logInfo('Checking DNS resolution...');
  try {
    const dnsRes = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const dnsData = await dnsRes.json();
    if (dnsData.Answer) {
      const cnameAnswer = dnsData.Answer.find(a => a.type === 5);
      if (cnameAnswer) {
        logSuccess(`DNS Resolution: ${domain} → ${cnameAnswer.data}`);
      }
    } else {
      logInfo(`DNS Resolution: No CNAME answer yet (propagation may be in progress)`);
    }
  } catch (e) {
    logInfo('DNS resolution check unavailable');
  }
}

// ─── Main ───────────────────────────────────────────────────
async function main() {
  const mode = process.argv[2] || 'full';
  const testSlug = process.argv[3] || 'test-verification';
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Academia Helm - Domain Management API Tests                ║');
  console.log('║  Testing Cloudflare + Vercel API Integration                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Mode: ${mode}`);
  console.log(`  Base domain: ${BASE_DOMAIN}`);
  console.log(`  Timestamp: ${new Date().toISOString()}\n`);
  
  try {
    // Test 1: Cloudflare connectivity
    const cfOk = await testCloudflareConnectivity();
    if (!cfOk) {
      logError('Cloudflare connectivity failed - aborting');
      return;
    }
    
    // Test 2: List DNS records
    await testListDnsRecords();
    
    // Test 3: Vercel connectivity
    const vercelOk = await testVercelConnectivity();
    if (!vercelOk) {
      logError('Vercel connectivity failed - aborting');
      return;
    }
    
    // Test 4: List Vercel domains
    await testListVercelDomains();
    
    // Test 5: Create test subdomain (only if mode is 'create' or 'full')
    if (mode === 'create' || mode === 'full') {
      await testCreateSubdomain(testSlug);
    }
    
    // Test 6: Check status (only if mode is 'status' or 'full')
    if (mode === 'status' || mode === 'full') {
      await testCheckDomainStatus(testSlug);
    }
    
    logSection('TEST SUMMARY');
    logSuccess('All API connectivity tests passed!');
    logInfo('Cloudflare API: Working');
    logInfo('Vercel API: Working');
    logInfo('The DomainManagementService should work correctly with these credentials.');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

main();
