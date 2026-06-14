/**
 * Test: Create subdomain using ONLY Vercel API (no Cloudflare CNAME needed)
 * Since *.academiahelm.com wildcard CNAME already exists in Cloudflare DNS,
 * we only need to add the domain to Vercel for it to work.
 */

const VERCEL_API_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT;
const BASE_DOMAIN = 'academiahelm.com';

const VERCEL_BASE = 'https://api.vercel.com';

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
  return await res.json();
}

async function testWildcardOnlySubdomain(slug) {
  const domain = `${slug}.${BASE_DOMAIN}`;
  
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Test: Wildcard-Only Subdomain Creation                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Subdomain: ${domain}`);
  console.log(`  Approach: Add domain to Vercel ONLY (no individual Cloudflare CNAME)`);
  console.log(`  Rationale: *.academiahelm.com wildcard CNAME already exists in Cloudflare\n`);
  
  // Step 1: Add domain to Vercel
  console.log('  Step 1: Adding domain to Vercel project...');
  const addRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  
  if (addRes.error) {
    if (addRes.error.code === 'domain_already_exists' || addRes.error.code === 'CONFLICT') {
      console.log('  ℹ️  Domain already exists in Vercel project');
    } else {
      console.log('  ❌ Failed to add domain:', addRes.error.message || JSON.stringify(addRes.error));
      return;
    }
  } else {
    console.log('  ✅ Domain added to Vercel:', domain);
  }
  
  // Step 2: Wait and verify
  console.log('  Step 2: Waiting 5 seconds before verification...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('  Step 3: Verifying domain in Vercel...');
  const verifyRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`, {
    method: 'POST',
  });
  
  if (verifyRes.error) {
    if (verifyRes.error.code === 'PRECONDITION_FAILED') {
      console.log('  ⚠️  Domain verification pending - DNS may need more time to propagate');
    } else {
      console.log('  ⚠️  Verification issue:', verifyRes.error.message || JSON.stringify(verifyRes.error));
    }
  } else {
    console.log('  ✅ Domain verified successfully!');
  }
  
  // Step 3: Check final status
  console.log('  Step 4: Checking final domain status...');
  const statusRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}`);
  
  if (statusRes.name) {
    console.log(`\n  Final Status:`);
    console.log(`    Domain: ${statusRes.name}`);
    console.log(`    Configured: ${statusRes.configured !== false ? '✅ Yes' : '❌ No'}`);
    console.log(`    Verified: ${statusRes.verified ? '✅ Yes' : '⏳ Pending'}`);
    
    if (statusRes.configured !== false && statusRes.verified) {
      console.log('\n  🎉 SUCCESS! The wildcard-only approach works!');
      console.log('  No individual Cloudflare CNAME record needed.');
    }
  }
  
  // Step 4: Test HTTPS accessibility
  console.log('\n  Step 5: Testing HTTPS accessibility...');
  try {
    const httpsRes = await fetch(`https://${domain}`, { 
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });
    console.log(`    HTTP Status: ${httpsRes.status}`);
    console.log(`    Server: ${httpsRes.headers.get('server') || 'N/A'}`);
    
    if (httpsRes.headers.get('server') === 'cloudflare') {
      console.log('    ✅ Request is being proxied through Cloudflare');
    }
  } catch (e) {
    console.log(`    ⚠️  HTTPS check: ${e.message}`);
  }
  
  // Step 5: DNS resolution check
  console.log('\n  Step 6: DNS resolution check...');
  try {
    const dnsRes = await fetch(`https://dns.google/resolve?name=${domain}&type=CNAME`);
    const dnsData = await dnsRes.json();
    if (dnsData.Answer) {
      console.log(`    DNS resolves: ${JSON.stringify(dnsData.Answer.map(a => a.data))}`);
    } else {
      console.log('    No CNAME answer yet (propagation may be in progress)');
    }
  } catch (e) {
    console.log('    DNS check unavailable');
  }
}

async function cleanup(slug) {
  const domain = `${slug}.${BASE_DOMAIN}`;
  console.log(`\n  Cleaning up test domain: ${domain}`);
  
  // Remove from Vercel
  const delRes = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}`, {
    method: 'DELETE',
  });
  
  if (delRes.error) {
    console.log(`  ⚠️  Vercel delete: ${delRes.error.message || 'failed'}`);
  } else {
    console.log('  ✅ Removed from Vercel');
  }
  
  // Remove from Cloudflare (if individual CNAME was created)
  const CF_TOKEN = process.env.CF_TOKEN;
  const CF_ZONE = process.env.CF_ZONE;
  
  const cfRecords = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records?name=${domain}`,
    { headers: { 'Authorization': `Bearer ${CF_TOKEN}` } }
  );
  const cfData = await cfRecords.json();
  
  if (cfData.success && cfData.result?.length > 0) {
    for (const record of cfData.result) {
      if (record.type === 'CNAME') {
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/dns_records/${record.id}`,
          { method: 'DELETE', headers: { 'Authorization': `Bearer ${CF_TOKEN}` } }
        );
        console.log('  ✅ Removed Cloudflare CNAME record');
      }
    }
  } else {
    console.log('  ℹ️  No individual Cloudflare CNAME to remove (wildcard handles it)');
  }
}

// Main
const mode = process.argv[2] || 'test';
const slug = process.argv[3] || 'test-wildcard';

if (mode === 'test') {
  testWildcardOnlySubdomain(slug);
} else if (mode === 'cleanup') {
  cleanup(slug);
} else if (mode === 'cleanup-all') {
  // Cleanup both test subdomains
  (async () => {
    await cleanup('test-verification');
    await cleanup('test-wildcard');
  })();
}
