/**
 * ============================================================================
 * migrate-data-urls-to-tenant-media.ts
 * ============================================================================
 *
 * Script de migration : scanne les tables qui peuvent contenir des data URLs
 * (base64) et les importe dans la nouvelle bibliothèque médias tenant-scoped.
 *
 * Tables scannées :
 *   - media_assets.url                       (URL distante OU data URL)
 *   - cms_pages.content                      (JSON avec blocs image: { imageUrl: data:... })
 *   - seo_meta.og_image_url                  (URL distante OU data URL)
 *   - tenant_identity_profiles.logo_url      (data URL classique)
 *
 * Pour chaque data URL trouvée :
 *   1. Détermine le tenantId (pour media_assets → 'platform', pour les autres → tenant_id)
 *   2. Appelle POST /api/tenant-media (upload via StorageService → 3 variantes)
 *   3. Met à jour la ligne avec l'URL publique retournée
 *
 * Usage :
 *   npx tsx scripts/migrate-data-urls-to-tenant-media.ts
 *
 * Prérequis :
 *   - L'API NestJS doit tourner sur localhost:4000 (ou API_BASE_URL configuré)
 *   - Un JWT admin valide dans ADMIN_JWT env var (pour bypass TenantGuard sur les médias plateforme)
 *
 * ATTENTION : ce script est idempotent — il ignore les URLs qui ne sont PAS
 * des data URLs (http://, https://, chemins relatifs).
 * ============================================================================
 */

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';
const ADMIN_JWT = process.env.ADMIN_JWT || '';

if (!ADMIN_JWT) {
  console.warn('⚠️  ADMIN_JWT env var is empty — tenant-scoped migrations will fail.');
  console.warn('   Set ADMIN_JWT to a valid admin JWT before running this script.');
}

// === Helpers ===

function isDataUrl(s: unknown): s is string {
  return typeof s === 'string' && s.startsWith('data:');
}

function getMimeTypeFromDataUrl(dataUrl: string): { mimeType: string; fileName: string } {
  const m = /^data:([^;]+);base64,/i.exec(dataUrl);
  const mimeType = m?.[1] || 'application/octet-stream';
  const ext = mimeType.split('/')[1]?.split('+')[0] || 'bin';
  return { mimeType, fileName: `migrated-${Date.now()}.${ext}` };
}

async function uploadToTenantMedia(
  tenantId: string,
  dataUrl: string,
  folder: string,
  name: string,
): Promise<string | null> {
  try {
    const { mimeType, fileName } = getMimeTypeFromDataUrl(dataUrl);
    const res = await fetch(`${API_BASE_URL}/api/tenant-media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_JWT}`,
        'X-Tenant-ID': tenantId,
      },
      body: JSON.stringify({
        fileDataUrl: dataUrl,
        fileName: name || fileName,
        mimeType,
        folder,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`   ❌ Upload failed (${res.status}): ${txt.slice(0, 200)}`);
      return null;
    }
    const media = await res.json() as any;
    return media.hdUrl || media.originalUrl || null;
  } catch (err: any) {
    console.error(`   ❌ Upload error: ${err.message}`);
    return null;
  }
}

async function migrate() {
  console.log('='.repeat(70));
  console.log('Migration des data URLs → bibliothèque médias tenant-scoped');
  console.log('='.repeat(70));

  let totalScanned = 0;
  let totalMigrated = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  // ═══════════════════════════════════════════════════════════════════════
  //  1. media_assets (table globale plateforme)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[1/4] Scan de media_assets...');
  const mediaAssets = await prisma.mediaAsset.findMany();
  console.log(`   ${mediaAssets.length} lignes trouvées`);
  for (const asset of mediaAssets) {
    totalScanned++;
    if (!isDataUrl(asset.url)) { totalSkipped++; continue; }
    console.log(`   → Migration: ${asset.name} (${asset.id})`);
    const newUrl = await uploadToTenantMedia('platform', asset.url, 'platform', asset.name);
    if (newUrl) {
      await prisma.mediaAsset.update({ where: { id: asset.id }, data: { url: newUrl } });
      console.log(`   ✓ URL mise à jour`);
      totalMigrated++;
    } else {
      totalFailed++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  2. cms_pages.content (JSON avec blocs image)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[2/4] Scan de cms_pages.content (blocs images)...');
  const cmsPages = await prisma.cmsPage.findMany();
  console.log(`   ${cmsPages.length} pages trouvées`);
  for (const page of cmsPages) {
    if (!page.content) continue;
    let content: any = page.content;
    let modified = false;

    // Format attendu : { sections: [{ type: 'image', imageUrl: 'data:...' }] }
    // OU directement : [{ type: 'image', imageUrl: 'data:...' }]
    const blocks: any[] = Array.isArray(content) ? content :
                          Array.isArray(content?.sections) ? content.sections : [];

    for (const block of blocks) {
      if (block?.type === 'image' && isDataUrl(block.imageUrl)) {
        totalScanned++;
        console.log(`   → Page "${page.title}" bloc image`);
        const newUrl = await uploadToTenantMedia('platform', block.imageUrl, 'cms-pages', page.title);
        if (newUrl) {
          block.imageUrl = newUrl;
          modified = true;
          totalMigrated++;
          console.log(`   ✓ URL mise à jour`);
        } else {
          totalFailed++;
        }
      } else if (block?.imageUrl && isDataUrl(block.imageUrl)) {
        totalScanned++;
        const newUrl = await uploadToTenantMedia('platform', block.imageUrl, 'cms-pages', page.title);
        if (newUrl) { block.imageUrl = newUrl; modified = true; totalMigrated++; }
        else totalFailed++;
      }
    }

    if (modified) {
      await prisma.cmsPage.update({ where: { id: page.id }, data: { content: content as any } });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  3. seo_meta.og_image_url
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[3/4] Scan de seo_meta.og_image_url...');
  const seoMetas = await prisma.seoMeta.findMany({ where: { ogImageUrl: { not: null } } });
  console.log(`   ${seoMetas.length} lignes trouvées`);
  for (const seo of seoMetas) {
    if (!isDataUrl(seo.ogImageUrl)) { totalSkipped++; continue; }
    totalScanned++;
    console.log(`   → Page ${seo.pagePath}`);
    const newUrl = await uploadToTenantMedia('platform', seo.ogImageUrl, 'og', `og-${seo.pagePath}`);
    if (newUrl) {
      await prisma.seoMeta.update({ where: { id: seo.id }, data: { ogImageUrl: newUrl } });
      console.log(`   ✓ URL mise à jour`);
      totalMigrated++;
    } else {
      totalFailed++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  4. tenant_identity_profiles.logo_url (tenant-scoped)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[4/4] Scan de tenant_identity_profiles.logo_url...');
  try {
    const identityProfiles = await (prisma as any).tenantIdentityProfile.findMany({
      where: { logoUrl: { not: null } },
      select: { id: true, tenantId: true, logoUrl: true },
    });
    console.log(`   ${identityProfiles.length} lignes trouvées`);
    for (const ip of identityProfiles) {
      if (!isDataUrl(ip.logoUrl)) { totalSkipped++; continue; }
      totalScanned++;
      console.log(`   → Tenant ${ip.tenantId} (profile ${ip.id})`);
      const newUrl = await uploadToTenantMedia(ip.tenantId, ip.logoUrl, 'logo', `logo-${ip.tenantId}`);
      if (newUrl) {
        await (prisma as any).tenantIdentityProfile.update({
          where: { id: ip.id },
          data: { logoUrl: newUrl },
        });
        console.log(`   ✓ URL mise à jour`);
        totalMigrated++;
      } else {
        totalFailed++;
      }
    }
  } catch (err: any) {
    console.warn(`   ⚠️ TenantIdentityProfile non accessible: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  5. Tentative sur les tables tenant_websites (si elles existent en DB)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n[5/4] Scan optionnel de tenant_websites (tables CMS institutionnel)...');
  try {
    const websites = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, tenant_id, hero_image_url, promoter_photo_url, director_photo_url,
             presentation_image_url, seo_og_image_url
      FROM tenant_websites
      WHERE hero_image_url LIKE 'data:%'
         OR promoter_photo_url LIKE 'data:%'
         OR director_photo_url LIKE 'data:%'
         OR presentation_image_url LIKE 'data:%'
         OR seo_og_image_url LIKE 'data:%'
    `);
    console.log(`   ${websites.length} lignes avec au moins 1 data URL trouvées`);
    for (const w of websites) {
      const updates: any = {};
      const fields = [
        ['hero_image_url', 'hero', 'hero'],
        ['promoter_photo_url', 'promoter', 'promoter'],
        ['director_photo_url', 'director', 'director'],
        ['presentation_image_url', 'presentation', 'presentation'],
        ['seo_og_image_url', 'og', 'og-website'],
      ] as const;

      for (const [col, folder, name] of fields) {
        const val = w[col];
        if (isDataUrl(val)) {
          totalScanned++;
          const newUrl = await uploadToTenantMedia(w.tenant_id, val, folder, name);
          if (newUrl) {
            updates[col] = newUrl;
            totalMigrated++;
          } else {
            totalFailed++;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
        await prisma.$executeRawUnsafe(
          `UPDATE tenant_websites SET ${setClauses.join(', ')} WHERE id = $1`,
          w.id, ...Object.values(updates),
        );
        console.log(`   ✓ Website ${w.id} mis à jour (${Object.keys(updates).length} champ(s))`);
      }
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Table tenant_websites non accessible (probablement inexistante): ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Récapitulatif
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(70));
  console.log('Migration terminée !');
  console.log('='.repeat(70));
  console.log(`Total scanné    : ${totalScanned}`);
  console.log(`✓ Migrés        : ${totalMigrated}`);
  console.log(`⊘ Ignorés (URL) : ${totalSkipped}`);
  console.log(`✗ Échecs        : ${totalFailed}`);
  console.log('');
}

migrate()
  .catch((err) => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
