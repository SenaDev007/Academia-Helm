/**
 * ============================================================================
 * /api/og — Aperçu OpenGraph des liens partagés dans Helm Connect (V4)
 * ============================================================================
 *
 * ⭐ Porté de « Yeshua Connect » (/api/og) : le LinkEmbed du chat interroge
 * cette route pour afficher les cartes d'aperçu façon Discord.
 *
 * Sécurité (SSRF) :
 *   - schémas http/https uniquement ;
 *   - refus des hôtes privés / loopback / link-local / métadonnées ;
 *   - timeout borné (5 s) + taille de réponse bornée (256 Ko) ;
 *   - résolution DNS vérifiée (l'IP réelle est contrôlée, pas juste le nom).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
];

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Schéma non autorisé');
  }
  const host = url.hostname;
  if (BLOCKED_HOST_PATTERNS.some((p) => p.test(host))) {
    throw new Error('Hôte privé refusé');
  }
  // Résolution DNS : contrôler l'IP réelle (anti-DNS-rebinding basique)
  try {
    const { lookup } = await import('dns').then((m) => m.promises);
    const addresses = await lookup(host, { all: true });
    for (const addr of addresses) {
      const a = addr.address;
      if (
        BLOCKED_HOST_PATTERNS.some((p) => p.test(a))
        || a.startsWith('fe80:') || a === '::1' || a.startsWith('fc') || a.startsWith('fd')
      ) {
        throw new Error('Adresse privée refusée');
      }
    }
  } catch (e: any) {
    if (e.message?.includes('refusé')) throw e;
    // Échec DNS → on laisse tenter (peut être un host public valide résolu
    // différemment côté serveur) — le fetch echouera de lui-même sinon.
  }
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');
  if (!rawUrl) {
    return NextResponse.json({ error: 'url requis' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }

  try {
    await assertPublicHost(target);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'URL refusée' }, { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // User-Agent navigateur pour maximiser les métadonnées OG
        'User-Agent': 'Mozilla/5.0 (compatible; HelmConnectBot/1.0; +https://academiahelm.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ url: rawUrl }, { status: 200 });
    }
    // Taille bornée — ne lire que le début du HTML (les balises <head> sont
    // en tête) : 256 Ko suffisent largement.
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let received = 0;
      while (received < 256 * 1024) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        html += decoder.decode(value, { stream: true });
        if (html.includes('</head>')) break; // assez
      }
      try { await reader.cancel(); } catch {}
    } else {
      html = await res.text();
    }

    const pick = (...patterns: RegExp[]): string | undefined => {
      for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1]) {
          try { return decodeURIComponent(m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')); } catch { return m[1]; }
        }
      }
      return undefined;
    };

    const title = pick(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      /<title[^>]*>([^<]+)<\/title>/i,
    );
    const description = pick(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    );
    let image = pick(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    );
    const siteName = pick(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    );

    // Absolutiser l'image relative
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, target).toString(); } catch { image = undefined; }
    }

    return NextResponse.json({
      url: rawUrl,
      title: title?.slice(0, 200),
      description: description?.slice(0, 300),
      image,
      siteName: siteName?.slice(0, 80),
    });
  } catch {
    // Timeout / réseau — réponse sobre (le front affichera le domaine seul)
    return NextResponse.json({ url: rawUrl });
  } finally {
    clearTimeout(timeout);
  }
}
