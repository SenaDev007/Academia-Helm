/**
 * ============================================================================
 * DYNAMIC OPEN GRAPH IMAGE — TENANT SCHOOL BRANDING
 * ============================================================================
 *
 * Génère une image OG personnalisée pour chaque école tenant.
 * Utilise next/og (ImageResponse) pour générer un PNG à partir de JSX.
 *
 * Route : /api/og/tenant/[slug]
 * Exemple : /api/og/tenant/cspeb-eveildafriqueeducation
 *
 * L'image inclut :
 *   - Logo de l'école (ou icône fallback)
 *   - Nom de l'école
 *   - Slogan / devise
 *   - Type d'établissement
 *   - Branding Academia Helm (palette Navy/Gold)
 *
 * Optimisé pour WhatsApp (< 200 KB), Facebook, Telegram, X, LinkedIn.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

// ── Palette Academia Helm ────────────────────────────────────────────
const NAVY = '#0b2f73';
const NAVY_DARK = '#071d4a';
const BLUE = '#1d4fa5';
const GOLD = '#f5b335';
const GOLD_LIGHT = '#fcd779';
const WHITE = '#ffffff';

/** Cache les données de branding 5 min (Edge Runtime) */
export const revalidate = 300;

interface BrandingData {
  name: string;
  slug: string;
  logoUrl: string | null;
  city: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  slogan: string | null;
  schoolAcronym: string | null;
  schoolType: string | null;
}

async function fetchBranding(slug: string): Promise<BrandingData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.academiahelm.com';
    const url = baseUrl.endsWith('/api')
      ? `${baseUrl}/tenants/by-subdomain/${encodeURIComponent(slug)}`
      : `${baseUrl}/api/tenants/by-subdomain/${encodeURIComponent(slug)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    const identity = data.identityProfiles?.[0] ?? null;
    const settings = data.schoolSettings ?? null;
    const school = data.schools ?? null;

    return {
      name:
        identity?.schoolName ||
        settings?.schoolName ||
        school?.name ||
        data.name ||
        slug,
      slug: data.slug || slug,
      logoUrl: identity?.logoUrl || settings?.logoUrl || school?.logo || null,
      city: identity?.city || settings?.city || school?.city || null,
      primaryColor: settings?.primaryColor || school?.primaryColor || null,
      secondaryColor: settings?.secondaryColor || school?.secondaryColor || null,
      slogan:
        identity?.slogan || settings?.slogan || school?.slogan || school?.motto || null,
      schoolAcronym: identity?.schoolAcronym || school?.abbreviation || null,
      schoolType: identity?.schoolType || null,
    };
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  if (!slug || slug.length < 2) {
    return new Response('Invalid slug', { status: 400 });
  }

  const branding = await fetchBranding(slug);

  // Fallback si le branding n'est pas disponible
  const schoolName = branding?.schoolAcronym
    ? `${branding.schoolAcronym} — ${branding.name}`
    : branding?.name || slug;
  const slogan = branding?.slogan || 'Portail Academia Helm';
  const schoolType = branding?.schoolType || 'École partenaire';
  const city = branding?.city || 'Bénin';
  const accentColor = branding?.primaryColor || GOLD;
  const logoUrl = branding?.logoUrl;

  // Tenter de charger le logo
  let logoData: ArrayBuffer | null = null;
  if (logoUrl) {
    try {
      const logoResp = await fetch(logoUrl, { signal: AbortSignal.timeout(3000) });
      if (logoResp.ok) {
        logoData = await logoResp.arrayBuffer();
      }
    } catch {
      // Logo indisponible — fallback sur l'icône
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY})`,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            right: -80,
            top: -80,
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: accentColor,
            opacity: 0.08,
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 100,
            bottom: -60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: accentColor,
            opacity: 0.05,
          }}
        />

        {/* Top bar — Academia Helm branding */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '28px 48px 0 48px',
          }}
        >
          {/* Shield icon */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${accentColor}, ${GOLD})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: WHITE,
              fontWeight: 700,
            }}
          >
            AH
          </div>
          <span style={{ fontSize: 14, color: GOLD_LIGHT, fontWeight: 600, letterSpacing: 2 }}>
            ACADEMIA HELM
          </span>
        </div>

        {/* Main content area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            padding: '20px 48px 20px 48px',
            gap: 40,
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 20,
              background: WHITE,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              border: `3px solid ${accentColor}30`,
              overflow: 'hidden',
            }}
          >
            {logoData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${Buffer.from(logoData).toString('base64')}`}
                alt={schoolName}
                width={130}
                height={130}
                style={{ objectFit: 'contain' }}
              />
            ) : (
              <span style={{ fontSize: 52, color: NAVY, fontWeight: 800 }}>
                {(branding?.schoolAcronym || branding?.name || slug)
                  .substring(0, 3)
                  .toUpperCase()}
              </span>
            )}
          </div>

          {/* Text content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* School type badge */}
            <div
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                alignItems: 'center',
                gap: 6,
                background: `${accentColor}20`,
                border: `1px solid ${accentColor}40`,
                borderRadius: 20,
                padding: '4px 14px',
              }}
            >
              <span style={{ fontSize: 11, color: accentColor, fontWeight: 600 }}>
                {schoolType.toUpperCase()}
              </span>
            </div>

            {/* School name */}
            <div
              style={{
                fontSize: 42,
                fontWeight: 800,
                color: WHITE,
                lineHeight: 1.15,
                maxWidth: 800,
                textShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {schoolName}
            </div>

            {/* Slogan */}
            {slogan && (
              <div
                style={{
                  fontSize: 20,
                  color: 'rgba(255,255,255,0.7)',
                  fontStyle: 'italic',
                  lineHeight: 1.3,
                  maxWidth: 700,
                }}
              >
                {slogan}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 48px 28px 48px',
          }}
        >
          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: accentColor,
              }}
            />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>{city}</span>
          </div>

          {/* URL */}
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {slug}.academiahelm.com
          </span>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            height: 4,
            background: `linear-gradient(90deg, ${accentColor}, ${GOLD}, ${accentColor})`,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
