'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Carte scolaire premium (recto + verso)
 * ============================================================================
 *
 * ⭐ 2026-11-27 (retour promoteur) — refonte visuelle :
 *   - PALETTE DYNAMIQUE : la carte suit la palette de marque de l'école
 *     (thème officiel > customColors CMS > logoPalette AUTO du logo) via les
 *     variables CSS --brand-* injectées par le layout /app — exactement la
 *     même chaîne que le site institutionnel. Contraste GARANTI : bandes
 *     assombries jusqu'à luminance ≤ 0,45 / 0,58 (texte blanc toujours
 *     lisible, jamais de texte pâle sur fond pâle). Bascule manuelle
 *     possible via Paramètres Design (cardUseBrandPalette=false).
 *   - RECTO : signature manuscrite RÉELLE du directeur (remplace le mot
 *     « Signature ») + CACHET appliqué dynamiquement (déborde sur la zone
 *     blanche) + nom du directeur dans la bande ; nom d'école trop long →
 *     SIGLE ; labels compactés (place récupérée pour les noms d'élèves
 *     longs, fin des «... ») ; numéro d'URGENCE en rouge ; adresse et
 *     téléphone bien séparés dans la bande.
 *   - VERSO : N° carte intégré au header (au-dessus de « CONDITIONS
 *     D'UTILISATION ») ; interlignes serrés ; ligne « Direction » avec le
 *     nom du directeur (différent selon le niveau : secondaire ≠
 *     maternel/primaire).
 *
 * Design hybride conservé :
 *   - EN-TÊTE RECTO : République du Bénin + drapeau + ministère + école +
 *     slogan + logo. Bande CONTINUE (pas de clip-path).
 *   - EN-TÊTE VERSO : bande continue avec N° carte + conditions + (maternelle)
 *     heures de sortie.
 *   - CORPS + FOOTER : photo + champs, footer gradient avec clip-path
 *     diagonal + zone signature/cachet, verso conditions + contacts + QR.
 *
 * Toutes les dimensions sont en `cqw` (container query width) — la carte
 * scale proportionnellement. Format naturel : 400 × 250 px (CR80).
 * ============================================================================
 */

import { useState, useEffect } from 'react';
// ⭐ PERF : qrcode importé dynamiquement dans RealQRCode (voir ci-dessous)

interface CardStudent {
  firstName: string;
  lastName: string;
  matricule?: string;
  studentCode?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  placeOfBirth?: string;
  nationality?: string;
  bloodType?: string;
}

interface CardGuardian {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  relationship?: string;
}

interface CardData {
  cardNumber: string;
  qrPayload?: string;
  qrHash?: string;
  generatedAt: string;
  validUntil?: string;
  student: CardStudent;
  guardian?: CardGuardian | null;
  className: string;
  levelName: string;
  levelCode?: string;
  academicYearName?: string;
}

export interface TenantInfo {
  schoolName: string;
  slogan?: string;
  tagline?: string;
  logoText?: string;
  address?: string;
  city?: string;
  phonePrimary?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  maternellePickupMorning?: string;
  maternellePickupAfternoon?: string;
  maternelleSingleExit?: boolean;
  maternelleSingleExitTime?: string;
  cardPrimaryColor?: string;
  cardSecondaryColor?: string;
  cardShowQRCode?: boolean;
  cardShowPhoto?: boolean;
  cardShowGuardian?: boolean;
  cardShowEmergencyCall?: boolean;
  cardShowSchoolAddress?: boolean;
  cardConditionsText?: string;
  // ⭐ 2026-11-27 — palette de marque automatique + direction
  cardUseBrandPalette?: boolean;
  schoolAcronym?: string;
  directorName?: string | null;
  directorSignatureUrl?: string | null;
  stampUrl?: string | null;
  // ⚠️ Champs conservés pour compatibilité avec CardDesignTab,
  //    mais non utilisés par ce design hybride.
  cardShowBarcode?: boolean;
  cardShowMatricule?: boolean;
  cardShowBirthInfo?: boolean;
  cardShowGender?: boolean;
  cardShowLevel?: boolean;
}

function formatDate(d?: string) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE DE MARQUE — lecture des variables CSS --brand-* (chaîne identique
// au site institutionnel) + contraste garanti (miroir de app-brand-theme.ts)
// ═══════════════════════════════════════════════════════════════════════════

function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex || typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h.toLowerCase()}` : null;
}

function parseHex(hex: string): [number, number, number] {
  const n = normalizeHex(hex) || '#000000';
  return [
    parseInt(n.substring(1, 3), 16) || 0,
    parseInt(n.substring(3, 5), 16) || 0,
    parseInt(n.substring(5, 7), 16) || 0,
  ];
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexOf(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => clamp255(x).toString(16).padStart(2, '0')).join('');
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Assombrit jusqu'à luminance simple ≤ max (garde la teinte). */
function darkenUntil(hex: string, maxLum: number): string {
  let [r, g, b] = parseHex(hex);
  let guard = 0;
  while (luminance(r, g, b) > maxLum && guard < 24) {
    r *= 0.92; g *= 0.92; b *= 0.92;
    guard++;
  }
  return hexOf(r, g, b);
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return hexOf(r + amount, g + amount, b + amount);
}

/**
 * Lit --brand-primary / --brand-secondary sur :root (injectées par le layout
 * /app — palette de l'école). Retourne null si absentes (thème Helm défaut).
 */
function readBrandPalette(): { primary: string; secondary: string } | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const styles = getComputedStyle(document.documentElement);
    const primary = normalizeHex(styles.getPropertyValue('--brand-primary').trim());
    const secondaryRaw = normalizeHex(styles.getPropertyValue('--brand-secondary').trim());
    if (!primary) return null;
    return { primary, secondary: secondaryRaw || lighten(primary, 18) };
  } catch {
    return null;
  }
}

// ⭐ QR code réel — génère une image base64 depuis le qrPayload
function RealQRCode({ payload }: { payload?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (payload) {
      import('qrcode')
        .then(({ default: QRCode }) =>
          QRCode.toDataURL(payload, {
            width: 200,
            margin: 0,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M',
          }))
        .then((url) => { if (!cancelled) setDataUrl(url); })
        .catch(() => { if (!cancelled) setDataUrl(''); });
    } else {
      setDataUrl('');
    }
    return () => { cancelled = true; };
  }, [payload]);

  if (!payload || !dataUrl) {
    return (
      <div className="w-full h-full grid grid-cols-7 grid-rows-7 gap-px bg-white">
        {Array.from({ length: 49 }).map((_, i) => (
          <div key={i} className={((i * 11 + 5) % 7 < 4) ? 'bg-black' : 'bg-white'} />
        ))}
      </div>
    );
  }

  return <img src={dataUrl} alt="QR Code" width={200} height={200} className="w-full h-full block" />;
}

export function IdCardVisual({
  card, face, identity,
}: {
  card: CardData;
  face: 'recto' | 'verso';
  identity: TenantInfo | null;
}) {
  const s = card.student;
  const g = card.guardian;

  // ─── Palette de marque (lecture différée — SSR safe) ─────────────────────
  const [brandPalette, setBrandPalette] = useState<{ primary: string; secondary: string } | null>(null);
  useEffect(() => {
    setBrandPalette(readBrandPalette());
  }, []);

  // ─── Données école (avec fallbacks) ──────────────────────────────────────
  const schoolName = identity?.schoolName || 'Établissement Scolaire';
  const slogan = identity?.slogan || 'Excellence • Discipline • Travail';
  const logoUrl = identity?.logoUrl || '';
  const logoText = identity?.logoText ||
    (schoolName.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()) ||
    'AH';

  // ⭐ 2026-11-27 — SIGLE : nom d'école trop long → acronyme (fin de la
  //    troncature «... » dans l'en-tête).
  const schoolAcronym =
    identity?.schoolAcronym ||
    (schoolName.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()) ||
    'AH';
  const displaySchoolName =
    schoolName.length > 26 && schoolAcronym && schoolAcronym.length >= 2
      ? schoolAcronym
      : schoolName;

  const schoolAddress = [identity?.address, identity?.city].filter(Boolean).join(', ') || '';
  const schoolPhone = identity?.phonePrimary || '';
  const schoolEmail = identity?.email || '';
  const schoolWebsite = identity?.website || '';

  // ─── Données élève / tuteur / direction ──────────────────────────────────
  const guardianName = g ? `${g.firstName} ${g.lastName}`.trim() : '—';
  const guardianPhone = g?.phone || '—';
  const directorName = identity?.directorName || null;
  const directorSignatureUrl = identity?.directorSignatureUrl || null;
  const stampUrl = identity?.stampUrl || null;

  // ─── Couleurs (palette de marque, contraste garanti) ─────────────────────
  // ⭐ cardUseBrandPalette=false (Paramètres Design) → couleurs manuelles.
  const useBrand = identity?.cardUseBrandPalette !== false;
  const brand = useBrand ? brandPalette : null;
  const primaryColor = darkenUntil(brand?.primary || identity?.cardPrimaryColor || '#17348f', 0.45);
  const secondaryColor = darkenUntil(brand?.secondary || identity?.cardSecondaryColor || '#29c2e8', 0.58);

  // ─── Conditions d'utilisation ─────────────────────────────────────────────
  const conditionsText = identity?.cardConditionsText ||
    "Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l'administration.";

  // ⭐ Mention spécifique MATERNELLE (remise de l'enfant sur présentation)
  const maternellePickupClause =
    "En cas de maternelle, la personne autorisée venue chercher l'enfant doit obligatoirement présenter cette carte. Sans présentation de la carte, la remise de l'enfant ne sera pas effectuée.";

  // ─── Ministère adapté au niveau scolaire (Bénin) ─────────────────────────
  const levelUpper = (card.levelCode || '').toUpperCase();
  const isMaternelle = levelUpper === 'MATERNELLE' || levelUpper === 'MAT';
  const isSuperieur = levelUpper === 'SUPERIEUR' || levelUpper === 'UNIVERSITY' || levelUpper === 'HIGHER';
  const isSecondaire = levelUpper === 'SECONDAIRE' || levelUpper === 'SECONDARY' || levelUpper === 'SECOND';
  const ministry = isSuperieur
    ? "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique"
    : isSecondaire
    ? "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
    : 'Ministère des Enseignements Maternel et Primaire';

  // ─── Heures de sortie maternelle ──────────────────────────────────────────
  const maternelleSingleExit = identity?.maternelleSingleExit ?? false;
  const maternellePickupMorning = identity?.maternellePickupMorning || '12:00';
  const maternellePickupAfternoon = identity?.maternellePickupAfternoon || '16:30';
  const maternelleSingleExitTime = identity?.maternelleSingleExitTime || '15:30';

  // ─── Composant : Drapeau du Bénin ──
  const BeninFlag = ({ sizeCqw = 3.5 }: { sizeCqw?: number }) => (
    <div
      style={{
        width: `${sizeCqw * 1.3}cqw`,
        height: `${sizeCqw}cqw`,
        display: 'flex',
        border: '0.1cqw solid rgba(255,255,255,0.3)',
        borderRadius: '0.2cqw',
        overflow: 'hidden',
      }}
      className="shrink-0"
    >
      <div style={{ width: '50%', height: '100%', background: '#15803d' }} />
      <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '50%', background: '#facc15' }} />
        <div style={{ height: '50%', background: '#dc2626' }} />
      </div>
    </div>
  );

  // ─── Composant : Logo école (image ou sigle en fallback) ──────────────────
  const SchoolLogo = ({ sizeCqw = 6.5 }: { sizeCqw?: number }) => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt="Logo"
          style={{
            width: `${sizeCqw}cqw`,
            height: `${sizeCqw}cqw`,
            objectFit: 'contain',
          }}
          className="rounded-md bg-white p-0.5 shrink-0"
        />
      );
    }
    return (
      <div
        style={{
          width: `${sizeCqw}cqw`,
          height: `${sizeCqw}cqw`,
          color: primaryColor,
          fontSize: `${sizeCqw * 0.35}cqw`,
          fontWeight: 800,
        }}
        className="rounded-md bg-white flex items-center justify-center shrink-0"
      >
        {logoText.substring(0, 3)}
      </div>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RECTO — Face avant
  // ═════════════════════════════════════════════════════════════════════════
  if (face === 'recto') {
    return (
      <div className="w-full flex flex-col items-center" style={{ containerType: 'inline-size' }}>
        {/* Carte */}
        <div
          className="relative bg-white overflow-hidden flex flex-col"
          style={{
            width: '100%',
            aspectRatio: '400 / 250',
            borderRadius: '3.5cqw',
            border: '1.5cqw solid #f4f4f5',
            boxShadow: '0 2.5cqw 6.25cqw rgba(0,0,0,0.18)',
            fontFamily: 'Inter, Poppins, Arial, sans-serif',
          }}
        >
          {/* ═══ HEADER (bande continue : République + drapeau + ministère + école + slogan + logo) ═══ */}
          <div
            className="shrink-0 flex items-center text-white"
            style={{
              height: '28%',
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              padding: '0 1.6cqw',
              gap: '0.8cqw',
            }}
          >
            <BeninFlag sizeCqw={4.5} />
            <div className="flex-1 text-center min-w-0" style={{ padding: '0 0.5cqw' }}>
              <div style={{
                fontSize: '2.5cqw',
                fontWeight: 800,
                lineHeight: 1.05,
                textTransform: 'uppercase',
                letterSpacing: '0.15cqw',
                marginBottom: '0.5cqw',
              }}>
                RÉPUBLIQUE DU BÉNIN
              </div>
              <div style={{
                fontSize: '1.25cqw',
                lineHeight: 1.15,
                opacity: 0.9,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: '0.5cqw',
              }}>
                {ministry}
              </div>
              {/* ⭐ Nom école : SIGLE si trop long (fin de la troncature) */}
              <div style={{
                fontSize: '1.75cqw',
                fontWeight: 700,
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: '0.4cqw',
                ...(displaySchoolName !== schoolName ? { letterSpacing: '0.2cqw' } : {}),
              }}>
                {displaySchoolName}
              </div>
              <div style={{
                fontSize: '1.15cqw',
                fontStyle: 'italic',
                lineHeight: 1.1,
                opacity: 0.8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {slogan}
              </div>
            </div>
            <SchoolLogo sizeCqw={8} />
          </div>

          {/* ═══ CORPS (photo + champs — labels compactés pour les noms longs) ═══ */}
          <div className="flex" style={{
            padding: '3.5cqw 4cqw 0 4cqw',
            gap: '3.5cqw',
            flex: 1,
            minHeight: 0,
          }}>
            {identity?.cardShowPhoto !== false && (
              <div style={{
                width: '22.5cqw',
                height: '27cqw',
                border: `0.5cqw solid ${primaryColor}`,
                borderRadius: '1cqw',
                overflow: 'hidden',
                flexShrink: 0,
                background: '#f2f2f2',
              }}>
                {s.photoUrl ? (
                  <img src={s.photoUrl} alt={`${s.firstName} ${s.lastName}`}
                    className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{
                    backgroundColor: '#f2f2f2',
                    backgroundImage:
                      'linear-gradient(45deg, #d9d9d9 25%, transparent 25%),' +
                      'linear-gradient(-45deg, #d9d9d9 25%, transparent 25%),' +
                      'linear-gradient(45deg, transparent 75%, #d9d9d9 75%),' +
                      'linear-gradient(-45deg, transparent 75%, #d9d9d9 75%)',
                    backgroundSize: '3.5cqw 3.5cqw',
                    backgroundPosition: '0 0, 0 1.75cqw, 1.75cqw -1.75cqw, -1.75cqw 0',
                  }} />
                )}
              </div>
            )}

            <div className="flex-1 flex flex-col" style={{
              fontSize: '2.2cqw',
              color: '#1a1a2e',
              minWidth: 0,
              gap: 0,
            }}>
              <FieldRow label="Matricule" value={s.matricule || s.studentCode || '—'} />
              <FieldRow label="Nom" value={s.lastName || '—'} bold />
              <FieldRow label="Prénom" value={s.firstName || '—'} bold />
              {identity?.cardShowGuardian !== false && (
                <FieldRow label="Tuteur" value={guardianName} />
              )}
              <FieldRow label="Classe" value={card.className || '—'} />
              {identity?.cardShowEmergencyCall !== false && (
                <FieldRow label="Urgence" value={guardianPhone} emergency />
              )}
            </div>
          </div>

          {/* ═══ FOOTER (bande + zone signature/cachet) ═══ */}
          {/* ⭐ Cachet appliqué dynamiquement — déborde sur la zone blanche,
              soigneusement positionné à gauche de la signature. */}
          {stampUrl && (
            <img
              src={stampUrl}
              alt=""
              aria-hidden
              style={{
                position: 'absolute',
                right: '38.5cqw',
                bottom: '3.5cqw',
                width: '14cqw',
                height: '14cqw',
                objectFit: 'contain',
                opacity: 0.92,
                zIndex: 2,
                pointerEvents: 'none',
              }}
            />
          )}
          {/* ⭐ Zone signature — HORS de la bande (frère) : le clip-path de la
              bande ne coupe PAS la signature qui déborde dans la zone blanche.
              Le mot « Signature » a disparu : image manuscrite réelle ou nom
              du directeur en script. */}
          <div
            className="text-center"
            style={{
              position: 'absolute',
              right: '3cqw',
              bottom: '0.6cqw',
              zIndex: 3,
            }}
          >
            {directorSignatureUrl ? (
              <img
                src={directorSignatureUrl}
                alt="Signature du directeur"
                style={{
                  height: '6cqw',
                  maxWidth: '28cqw',
                  objectFit: 'contain',
                  objectPosition: 'bottom',
                  display: 'block',
                  margin: '0 auto 0.3cqw',
                  filter: 'drop-shadow(0 0 0.1cqw rgba(0,0,0,0.15))',
                }}
              />
            ) : directorName ? (
              <div style={{
                fontFamily: '"Brush Script MT", cursive',
                fontSize: '3.4cqw',
                color: '#0f172a',
                lineHeight: 1,
                maxWidth: '32cqw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                margin: '0 auto 0.3cqw',
              }}>
                {directorName}
              </div>
            ) : (
              <div style={{ height: '4cqw' }} />
            )}
            <div style={{
              color: '#fff',
              fontSize: '2.1cqw',
              fontWeight: 700,
              lineHeight: 1.15,
            }}>
              Directeur(trice)
            </div>
            {directorName && (
              <div style={{
                color: '#fff',
                fontSize: '1.9cqw',
                fontWeight: 600,
                lineHeight: 1.15,
                maxWidth: '34cqw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {directorName}
              </div>
            )}
          </div>
          {/* Bande footer — adresse et téléphone SÉPARÉS (2 lignes nettes,
              la 1re ligne ne touche plus la diagonale) */}
          <div
            className="absolute left-0 right-0 flex items-center"
            style={{
              bottom: 0,
              height: '11.5cqw',
              background: `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`,
              padding: '0 4cqw',
              clipPath: 'polygon(0 22%, 100% 0, 100% 100%, 0 100%)',
            }}
          >
            <div style={{
              color: '#fff',
              fontSize: '1.9cqw',
              lineHeight: 1.3,
              maxWidth: '56%',
              paddingTop: '1.2cqw',
            }}>
              {identity?.cardShowSchoolAddress !== false && schoolAddress && (
                <div className="truncate">{schoolAddress}</div>
              )}
              {schoolPhone && (
                <div style={{ marginTop: '0.3cqw' }}>Tél : {schoolPhone}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // VERSO — Face arrière
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full flex flex-col items-center" style={{ containerType: 'inline-size' }}>
      {/* Carte */}
      <div
        className="relative bg-white overflow-hidden flex flex-col"
        style={{
          width: '100%',
          aspectRatio: '400 / 250',
          borderRadius: '3.5cqw',
          border: '1.5cqw solid #f4f4f5',
          boxShadow: '0 2.5cqw 6.25cqw rgba(0,0,0,0.18)',
          fontFamily: 'Inter, Poppins, Arial, sans-serif',
        }}
      >
        {/* ═══ BACK-HEADER — ⭐ N° CARTE au-dessus du titre + heures maternelle ═══ */}
        <div
          className="shrink-0 flex items-center justify-between text-white"
          style={{
            height: '22%',
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            padding: '0 4cqw',
          }}
        >
          <div className="flex-1 min-w-0">
            <div style={{
              fontSize: '1.35cqw',
              fontWeight: 700,
              letterSpacing: '0.08cqw',
              opacity: 0.92,
              marginBottom: '0.35cqw',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              N° CARTE : {card.cardNumber || '—'}
            </div>
            <div style={{
              fontWeight: 800,
              fontSize: isMaternelle ? '1.4cqw' : '2cqw',
              letterSpacing: '0.15cqw',
              lineHeight: 1.1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              CONDITIONS D'UTILISATION
            </div>
          </div>
          {isMaternelle && (
            <div style={{
              fontSize: '1.25cqw',
              textAlign: 'right',
              lineHeight: 1.35,
              flexShrink: 0,
              paddingLeft: '2cqw',
            }}>
              {maternelleSingleExit ? (
                <div style={{ fontWeight: 700 }}>
                  Sortie unique : {maternelleSingleExitTime}
                </div>
              ) : (
                <>
                  <div>Sortie Matin : {maternellePickupMorning}</div>
                  <div>Sortie Après-midi : {maternellePickupAfternoon}</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ═══ BACK-BODY (conditions + contacts serrés + direction) ═══ */}
        <div
          className="relative"
          style={{
            padding: '1.5cqw 4.5cqw 0 4.5cqw',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* LOGO FILIGRANE */}
          {logoUrl && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '35cqw',
                height: '35cqw',
                opacity: 0.08,
                pointerEvents: 'none',
                zIndex: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={logoUrl}
                alt=""
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}

          {/* term-item (puce ■ + texte) */}
          <div className="flex relative" style={{
            gap: '1.5cqw',
            fontSize: '1.8cqw',
            color: '#444',
            lineHeight: 1.3,
            marginBottom: '0.8cqw',
            zIndex: 1,
          }}>
            <span style={{ color: primaryColor, fontWeight: 900, flexShrink: 0 }}>■</span>
            <span>{conditionsText}</span>
          </div>

          {/* Mention spécifique MATERNELLE */}
          {isMaternelle && (
            <div className="flex relative" style={{
              gap: '1.5cqw',
              fontSize: '1.8cqw',
              color: '#444',
              lineHeight: 1.3,
              marginBottom: '0.8cqw',
              zIndex: 1,
            }}>
              <span style={{ color: primaryColor, fontWeight: 900, flexShrink: 0 }}>■</span>
              <span>{maternellePickupClause}</span>
            </div>
          )}

          {/* contact-block — ⭐ interlignes SERRETS + ligne Direction */}
          <div className="relative" style={{
            marginTop: '0.6cqw',
            fontSize: '1.95cqw',
            color: '#1a1a2e',
            zIndex: 1,
          }}>
            {schoolPhone && <ContactRow label="Tél" value={schoolPhone} />}
            {schoolEmail && <ContactRow label="Email" value={schoolEmail} />}
            {schoolWebsite && <ContactRow label="Web" value={schoolWebsite} />}
            {identity?.cardShowSchoolAddress !== false && schoolAddress && (
              <ContactRow label="Adresse" value={schoolAddress} />
            )}
            {directorName && <ContactRow label="Direction" value={directorName} bold />}
          </div>
        </div>

        {/* ═══ BACK-FOOTER (dates + QR) ═══ */}
        <div
          className="absolute left-0 right-0 flex items-center justify-end gap-4"
          style={{
            bottom: 0,
            height: '14.5cqw',
            background: `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`,
            padding: '0 4cqw',
            clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 100%)',
          }}
        >
          <div style={{
            color: '#fff',
            fontSize: '1.4cqw',
            textAlign: 'right',
            lineHeight: 1.4,
            paddingRight: '0.6cqw',
            paddingTop: '1cqw',
            opacity: 0.95,
          }}>
            <div>Émise le : {formatDate(card.generatedAt)}</div>
            {card.validUntil && <div>Expire le : {formatDate(card.validUntil)}</div>}
          </div>

          {identity?.cardShowQRCode !== false && (
            <div style={{
              width: '11.5cqw',
              height: '11.5cqw',
              background: '#fff',
              borderRadius: '0.75cqw',
              padding: '0.75cqw',
              boxShadow: '0 0.25cqw 0.5cqw rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}>
              <RealQRCode payload={card.qrPayload} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composant : ligne de champ (label : value) ──────────────────────
// ⭐ Labels COMPACTS : largeur 19.5cqw → 13cqw + colonne 2.5cqw → 1cqw →
//    ~8cqw récupérés pour la valeur (noms d'élèves longs sans «... »).
function FieldRow({ label, value, bold, emergency }: { label: string; value: string; bold?: boolean; emergency?: boolean }) {
  return (
    <div className="flex" style={{ marginBottom: '0.2cqw' }}>
      <span style={{
        fontWeight: 700,
        width: '13cqw',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ width: '1cqw', flexShrink: 0 }}>:</span>
      <span style={{
        color: emergency ? '#dc2626' : '#333',
        fontWeight: emergency ? 700 : bold ? 700 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Sous-composant : ligne de contact (interligne serré) ─────────────────
function ContactRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex" style={{ marginBottom: '0.12cqw', lineHeight: 1.2 }}>
      <span style={{
        fontWeight: 700,
        width: '11cqw',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ marginRight: '0.4cqw', flexShrink: 0 }}>:</span>
      <span style={{
        fontWeight: bold ? 700 : 400,
        color: bold ? '#0f172a' : undefined,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

export default IdCardVisual;
