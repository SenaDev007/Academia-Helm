/**
 * ============================================================================
 * SEED EXISTING SUBDOMAINS — Création Cloudflare + Vercel pour les tenants existants
 * ============================================================================
 *
 * Ce script parcourt tous les tenants actifs ayant un sous-domaine et crée
 * automatiquement les entrées DNS (CNAME Cloudflare) et les domaines Vercel
 * pour chaque école.
 *
 * Utilisation :
 *   npx ts-node scripts/seed-existing-subdomains.ts
 *   npx ts-node scripts/seed-existing-subdomains.ts --dry-run   # Simulation sans modification
 *   npx ts-node scripts/seed-existing-subdomains.ts --slug=ecole-x  # Un seul tenant
 *
 * Prérequis (.env) :
 *   DATABASE_URL=postgresql://...
 *   CLOUDFLARE_API_TOKEN=...
 *   CLOUDFLARE_ZONE_ID=...
 *   VERCEL_API_TOKEN=...
 *   VERCEL_PROJECT_ID=...
 *   APP_BASE_DOMAIN=academiahelm.com
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config({ path: '.env' });

// ── Configuration ──
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'academiahelm.com';

const DRY_RUN = process.argv.includes('--dry-run');
const SLUG_FILTER = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];

// ── Types ──
interface TenantRow {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  status: string;
}

interface SubdomainResult {
  tenantId: string;
  tenantName: string;
  subdomain: string;
  fullDomain: string;
  cloudflare: 'created' | 'exists' | 'skipped' | 'failed';
  vercel: 'added' | 'exists' | 'skipped' | 'failed';
  vercelVerified: boolean;
  dbTracked: 'created' | 'exists' | 'skipped' | 'failed';
  error?: string;
}

// ── Helpers Cloudflare ──

async function getCloudflareDnsRecord(domain: string): Promise<{ id: string; proxied: boolean } | null> {
  if (!CF_TOKEN || !CF_ZONE_ID) return null;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?name=${domain}`,
      {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      },
    );

    const data = await response.json() as any;
    if (data.success && data.result?.length > 0) {
      return { id: data.result[0].id, proxied: data.result[0].proxied };
    }
    return null;
  } catch {
    return null;
  }
}

async function addCloudflareCname(slug: string): Promise<'created' | 'exists' | 'failed'> {
  if (!CF_TOKEN || !CF_ZONE_ID) return 'skipped' as any;

  const domain = `${slug}.${BASE_DOMAIN}`;

  // Vérifier si l'enregistrement existe déjà
  const existing = await getCloudflareDnsRecord(domain);
  if (existing) {
    console.log(`   ☁️  Cloudflare: CNAME ${domain} existe déjà (proxied: ${existing.proxied})`);
    return 'exists';
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'CNAME',
          name: slug,
          content: 'cname.vercel-dns.com',
          proxied: true,
          ttl: 1,
        }),
      },
    );

    const data = await response.json() as any;

    if (!data.success) {
      const error = data.errors?.[0]?.message || 'Unknown error';
      console.log(`   ❌ Cloudflare: Échec création CNAME ${domain}: ${error}`);
      return 'failed';
    }

    console.log(`   ✅ Cloudflare: CNAME ${domain} → cname.vercel-dns.com (proxied)`);
    return 'created';
  } catch (error: any) {
    console.log(`   ❌ Cloudflare: Erreur réseau pour ${domain}: ${error.message}`);
    return 'failed';
  }
}

// ── Helpers Vercel ──

async function addVercelDomain(domain: string): Promise<'added' | 'exists' | 'failed'> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) return 'skipped' as any;

  try {
    const url = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`
      : `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    });

    const data = await response.json() as any;

    if (response.status === 409) {
      console.log(`   ▲ Vercel: Domaine ${domain} existe déjà`);
      return 'exists';
    }

    if (!response.ok) {
      const error = data.error?.message || data.message || 'Unknown error';
      console.log(`   ❌ Vercel: Échec ajout domaine ${domain}: ${error}`);
      return 'failed';
    }

    console.log(`   ✅ Vercel: Domaine ${domain} ajouté au projet`);
    return 'added';
  } catch (error: any) {
    console.log(`   ❌ Vercel: Erreur réseau pour ${domain}: ${error.message}`);
    return 'failed';
  }
}

async function verifyVercelDomain(domain: string): Promise<boolean> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) return false;

  try {
    const url = VERCEL_TEAM_ID
      ? `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify?teamId=${VERCEL_TEAM_ID}`
      : `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    const data = await response.json() as any;
    return data.verified === true;
  } catch {
    return false;
  }
}

// ── Helper DB ──

async function trackDomainInDb(
  prisma: PrismaClient,
  tenantId: string,
  domain: string,
  verified: boolean,
): Promise<'created' | 'exists' | 'failed'> {
  try {
    const existing = await (prisma as any).tenantDomain.findUnique({
      where: {
        tenantId_domain: { tenantId, domain },
      },
    });

    if (existing) {
      // Mettre à jour
      await (prisma as any).tenantDomain.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          isPrimary: true,
          verifiedAt: verified ? new Date() : existing.verifiedAt,
        },
      });
      return 'exists';
    }

    // Créer
    await (prisma as any).tenantDomain.create({
      data: {
        tenantId,
        domain,
        isPrimary: true,
        isActive: true,
        verifiedAt: verified ? new Date() : null,
      },
    });
    return 'created';
  } catch (error: any) {
    console.log(`   ⚠️  DB: Erreur tracking domaine ${domain}: ${error.message}`);
    return 'failed';
  }
}

// ── Fonction principale ──

async function seedExistingSubdomains() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED EXISTING SUBDOMAINS — Cloudflare + Vercel + DB');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Vérifier la configuration
  const configStatus = {
    'DATABASE_URL': !!process.env.DATABASE_URL,
    'CLOUDFLARE_API_TOKEN': !!CF_TOKEN,
    'CLOUDFLARE_ZONE_ID': !!CF_ZONE_ID,
    'VERCEL_API_TOKEN': !!VERCEL_TOKEN,
    'VERCEL_PROJECT_ID': !!VERCEL_PROJECT_ID,
    'APP_BASE_DOMAIN': !!process.env.APP_BASE_DOMAIN,
  };

  console.log('📋 Configuration :');
  for (const [key, configured] of Object.entries(configStatus)) {
    console.log(`   ${configured ? '✅' : '❌'} ${key}`);
  }
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL est requis. Arrêt.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('🏃 MODE DRY-RUN — Aucune modification ne sera effectuée');
    console.log('');
  }

  if (SLUG_FILTER) {
    console.log(`🎯 Filtre : seul le tenant avec slug "${SLUG_FILTER}" sera traité`);
    console.log('');
  }

  const prisma = new PrismaClient();

  try {
    // Récupérer tous les tenants actifs avec un sous-domaine
    const tenants: TenantRow[] = await prisma.$queryRaw`
      SELECT id, name, slug, subdomain, status
      FROM tenants
      WHERE subdomain IS NOT NULL
        AND status = 'active'
      ORDER BY name ASC
    `;

    console.log(`📊 ${tenants.length} tenant(s) actif(s) avec sous-domaine trouvé(s)`);
    console.log('');

    if (tenants.length === 0) {
      console.log('✅ Aucun tenant à traiter. Terminé.');
      return;
    }

    // Filtrer si demandé
    const filteredTenants = SLUG_FILTER
      ? tenants.filter(t => t.slug === SLUG_FILTER || t.subdomain === SLUG_FILTER)
      : tenants;

    if (filteredTenants.length === 0) {
      console.log(`❌ Aucun tenant trouvé avec le filtre "${SLUG_FILTER}"`);
      return;
    }

    const results: SubdomainResult[] = [];
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    for (let i = 0; i < filteredTenants.length; i++) {
      const tenant = filteredTenants[i];
      const fullDomain = `${tenant.subdomain}.${BASE_DOMAIN}`;

      console.log(`\n[${i + 1}/${filteredTenants.length}] ${tenant.name}`);
      console.log(`   Slug: ${tenant.slug} | Subdomain: ${tenant.subdomain} | Domain: ${fullDomain}`);

      const result: SubdomainResult = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        subdomain: tenant.subdomain!,
        fullDomain,
        cloudflare: 'skipped',
        vercel: 'skipped',
        vercelVerified: false,
        dbTracked: 'skipped',
      };

      if (DRY_RUN) {
        console.log('   🏃 DRY-RUN: Simulation — aucune action');
        result.cloudflare = 'skipped';
        result.vercel = 'skipped';
        result.dbTracked = 'skipped';
        results.push(result);
        skipCount++;
        continue;
      }

      // Étape 1 : Cloudflare CNAME
      result.cloudflare = await addCloudflareCname(tenant.subdomain!);

      // Petite pause entre les appels API pour éviter le rate limiting
      await sleep(500);

      // Étape 2 : Vercel Domain
      result.vercel = await addVercelDomain(fullDomain);

      await sleep(500);

      // Étape 3 : Vérification Vercel
      if (result.vercel === 'added' || result.vercel === 'exists') {
        // Attendre la propagation DNS
        console.log('   ⏳ Attente 3s pour propagation DNS...');
        await sleep(3000);

        const verified = await verifyVercelDomain(fullDomain);
        result.vercelVerified = verified;
        if (verified) {
          console.log(`   ✅ Vercel: ${fullDomain} vérifié (SSL émis)`);
        } else {
          console.log(`   ⏳ Vercel: ${fullDomain} vérification en attente (DNS propagation)');
        }
      }

      // Étape 4 : Tracker en DB
      result.dbTracked = await trackDomainInDb(prisma, tenant.id, fullDomain, result.vercelVerified);

      // Résumé pour ce tenant
      const isSuccess = result.cloudflare !== 'failed' && result.vercel !== 'failed';
      if (isSuccess) {
        successCount++;
        console.log(`   🎉 Succès pour ${fullDomain}`);
      } else {
        failCount++;
        console.log(`   💥 Échec partiel pour ${fullDomain}`);
      }

      results.push(result);

      // Pause entre les tenants pour éviter le rate limiting
      if (i < filteredTenants.length - 1) {
        await sleep(1000);
      }
    }

    // ── Résumé final ──
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  RÉSUMÉ');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`   Total traités : ${results.length}`);
    console.log(`   ✅ Succès     : ${successCount}`);
    console.log(`   💥 Échecs     : ${failCount}`);
    console.log(`   🏃 Ignorés    : ${skipCount}`);
    console.log('');

    // Détail par statut
    const failed = results.filter(r => r.cloudflare === 'failed' || r.vercel === 'failed');
    if (failed.length > 0) {
      console.log('   ❌ Tenants en échec :');
      for (const f of failed) {
        console.log(`      - ${f.tenantName} (${f.fullDomain})`);
        console.log(`        Cloudflare: ${f.cloudflare} | Vercel: ${f.vercel} | DB: ${f.dbTracked}`);
      }
      console.log('');
    }

    const pendingVerification = results.filter(r => !r.vercelVerified && r.vercel !== 'skipped');
    if (pendingVerification.length > 0) {
      console.log('   ⏳ Domaines en attente de vérification Vercel :');
      for (const p of pendingVerification) {
        console.log(`      - ${p.fullDomain} → Relancez le script dans 5-10 minutes ou vérifiez manuellement`);
      }
      console.log('');
      console.log('   💡 Conseil : La vérification SSL peut prendre quelques minutes.');
      console.log('      Relancez ce script plus tard pour retenter la vérification.');
    }

  } catch (error: any) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Exécution ──
seedExistingSubdomains()
  .then(() => {
    console.log('\n✅ Script terminé.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur non gérée:', error);
    process.exit(1);
  });
