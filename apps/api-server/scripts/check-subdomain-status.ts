/**
 * ============================================================================
 * CHECK SUBDOMAIN STATUS — Vérifie le statut DNS/Vercel/DB d'un sous-domaine
 * ============================================================================
 *
 * Utilisation :
 *   npx ts-node scripts/check-subdomain-status.ts
 *   npx ts-node scripts/check-subdomain-status.ts --slug=ecole-x
 *
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;
const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const BASE_DOMAIN = process.env.APP_BASE_DOMAIN || 'academiahelm.com';

async function checkSubdomainStatus() {
  const slugFilter = process.argv.find(a => a.startsWith('--slug='))?.split('=')[1];

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  CHECK SUBDOMAIN STATUS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const prisma = new PrismaClient();

  try {
    const tenants: { id: string; name: string; slug: string; subdomain: string | null; status: string }[] =
      await prisma.$queryRaw`
        SELECT id, name, slug, subdomain, status
        FROM tenants
        WHERE subdomain IS NOT NULL
        ORDER BY name ASC
      `;

    const filtered = slugFilter
      ? tenants.filter(t => t.slug === slugFilter || t.subdomain === slugFilter)
      : tenants;

    console.log(`📊 ${filtered.length} tenant(s) avec sous-domaine\n`);

    for (const tenant of filtered) {
      const fullDomain = `${tenant.subdomain}.${BASE_DOMAIN}`;
      console.log(`── ${tenant.name} (${tenant.status})`);
      console.log(`   Domaine: ${fullDomain}`);

      // Cloudflare
      let cfStatus = '❌ Non configuré';
      if (CF_TOKEN && CF_ZONE_ID) {
        try {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?name=${fullDomain}`,
            { headers: { Authorization: `Bearer ${CF_TOKEN}` } },
          );
          const data = await response.json() as any;
          if (data.success && data.result?.length > 0) {
            const record = data.result[0];
            cfStatus = record.proxied
              ? `✅ CNAME → ${record.content} (proxied ☁️)`
              : `⚠️  CNAME → ${record.content} (DNS only, pas de proxy)`;
          }
        } catch {
          cfStatus = '❌ Erreur API';
        }
      } else {
        cfStatus = '⚠️  API Cloudflare non configurée';
      }
      console.log(`   Cloudflare: ${cfStatus}`);

      // Vercel
      let vercelStatus = '❌ Non ajouté';
      if (VERCEL_TOKEN && VERCEL_PROJECT_ID) {
        try {
          const url = VERCEL_TEAM_ID
            ? `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains/${fullDomain}?teamId=${VERCEL_TEAM_ID}`
            : `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains/${fullDomain}`;

          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
          });

          if (response.ok) {
            const data = await response.json() as any;
            const verified = data.verified ? '✅ Vérifié (SSL OK)' : '⚠️  Non vérifié';
            const configStatus = data.configVerified ? '✅' : '⚠️';
            vercelStatus = `${verified} | Config: ${configStatus}`;
          } else if (response.status === 404) {
            vercelStatus = '❌ Pas dans Vercel';
          }
        } catch {
          vercelStatus = '❌ Erreur API';
        }
      } else {
        vercelStatus = '⚠️  API Vercel non configurée';
      }
      console.log(`   Vercel:     ${vercelStatus}`);

      // DB
      let dbStatus = '❌ Non tracé';
      try {
        const dbDomain = await (prisma as any).tenantDomain.findFirst({
          where: { tenantId: tenant.id, domain: fullDomain, isActive: true },
        });
        if (dbDomain) {
          dbStatus = dbDomain.verifiedAt
            ? `✅ Tracé (vérifié le ${new Date(dbDomain.verifiedAt).toLocaleDateString()})`
            : '⚠️  Tracé mais non vérifié';
        }
      } catch {
        dbStatus = '⚠️  Table tenant_domains non disponible';
      }
      console.log(`   DB:         ${dbStatus}`);
      console.log('');
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubdomainStatus()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
