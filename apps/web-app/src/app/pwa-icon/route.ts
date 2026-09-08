/**
 * ============================================================================
 * PWA ICON ROUTE — Icône dynamique par école
 * ============================================================================
 *
 * GET /pwa-icon?tenant=<subdomain>&s=<size>&m=1
 *
 * Sert une icône carrée PNG (à la taille demandée) à partir du logo de
 * l'école (tenant), pour les manifests PWA et l'apple-touch-icon.
 *
 * Pourquoi cette route ?
 *   - Les logos des tenants sont stockés en base64 (data URI) ou sur des
 *     URLs externes → inutilisables directement dans un manifest PWA.
 *   - L'endpoint API `/tenants/:tenantId/logo` sert déjà l'image brute
 *     (base64 décodé ou redirection 302) — on l'utilise comme source.
 *   - Chrome exige des icônes de taille EXACTE (192/512) pour
 *     l'installabilité : on redimensionne avec sharp.
 *
 * Stratégie :
 *   1. Résoudre le tenant par subdomain (API publique, 4s timeout)
 *   2. Récupérer le logo via /tenants/:id/logo (gère base64 + http)
 *   3. sharp : resize "contain" sur fond blanc (+ padding 10% si maskable)
 *   4. Retourner un PNG avec Cache-Control 24h
 *
 * Fallback (pas de tenant / pas de logo / erreur) :
 *   → redirection 307 vers l'icône statique Academia Helm.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { isReservedSubdomain } from '@/lib/tenant/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Tailles autorisées (eviter les abus de calcul). */
const ALLOWED_SIZES = new Set([48, 96, 144, 180, 192, 256, 384, 512]);

const DEFAULT_ICON = '/apple-touch-icon.png';

/** Résout le tenant (id) depuis un subdomain, null si introuvable. */
async function resolveTenantId(subdomain: string): Promise<string | null> {
  try {
    const apiUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `${apiUrl}/tenants/by-subdomain/${encodeURIComponent(subdomain)}`,
      { signal: controller.signal, headers: { 'Content-Type': 'application/json' } },
    );
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.id || null;
  } catch {
    return null;
  }
}

/** Télécharge le logo du tenant (l'endpoint API gère base64 + http + redirect). */
async function fetchTenantLogo(tenantId: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const apiUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${apiUrl}/tenants/${tenantId}/logo`, {
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return null;
    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return null;
    return { buffer, contentType };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenant = searchParams.get('tenant');
  const rawSize = parseInt(searchParams.get('s') || '512', 10);
  const maskable = searchParams.get('m') === '1';

  const size = ALLOWED_SIZES.has(rawSize) ? rawSize : 512;

  const fallback = () =>
    NextResponse.redirect(new URL(DEFAULT_ICON, request.nextUrl.origin), 307);

  // Sans tenant (domaine principal, réservé, ou param manquant) → icône AH
  if (!tenant || isReservedSubdomain(tenant) || tenant.includes('.') || tenant.includes('/')) {
    return fallback();
  }

  const tenantId = await resolveTenantId(tenant);
  if (!tenantId) return fallback();

  const logo = await fetchTenantLogo(tenantId);
  if (!logo) return fallback();

  // ── Redimensionnement avec sharp (fond blanc, PNG) ──────────────────────
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;

    let pipeline = sharp(Buffer.from(logo.buffer), { failOn: 'none' });

    if (maskable) {
      // Icône maskable : contenu dans la "safe zone" (cercle ~80%)
      // → contenu redimensionné à 80% + padding de 10% de chaque côté
      const inner = Math.round(size * 0.8);
      const padding = Math.round((size - inner) / 2);
      pipeline = pipeline
        .resize(inner, inner, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        });
    } else {
      pipeline = pipeline.resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      });
    }

    const pngBuffer = await pipeline.png().toBuffer();

    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    // sharp indisponible ou image invalide → servir l'image brute
    // (certains navigateurs l'acceptent telle quelle)
    try {
      return new NextResponse(logo.buffer, {
        status: 200,
        headers: {
          'Content-Type': logo.contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return fallback();
    }
  }
}
