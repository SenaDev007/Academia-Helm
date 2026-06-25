/**
 * SEO — Sitemap.xml dynamique par tenant
 * GET /sitemap.xml — génère un sitemap basé sur le sous-domaine
 */

import { NextRequest } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const parts = host.split(':').length > 1 ? host.split(':')[0].split('.') : host.split('.');

  // Si pas un sous-domaine d'école, retourner un sitemap minimal
  if (parts.length < 3) {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://academiahelm.com</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
</urlset>`,
      { headers: { 'Content-Type': 'application/xml' } },
    );
  }

  const slug = parts[0];
  const baseUrl = `https://${slug}.academiahelm.com`;

  // Récupérer les actualités publiées pour le sitemap
  let newsUrls = '';
  try {
    const API_URL = getApiBaseUrlForRoutes();
    const res = await fetch(`${API_URL}/tenant-website/public/${slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.newsArticles) {
        newsUrls = data.newsArticles
          .filter((a: any) => a.status === 'PUBLISHED')
          .map((a: any) => `  <url><loc>${baseUrl}/actualites/${a.slug}</loc><lastmod>${new Date(a.updatedAt).toISOString()}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`)
          .join('\n');
      }
    }
  } catch {}

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/#presentation</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/#actualites</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/#agenda</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>
  <url><loc>${baseUrl}/#galerie</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>${baseUrl}/#contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
${newsUrls}
</urlset>`;

  return new Response(sitemap, { headers: { 'Content-Type': 'application/xml' } });
}
