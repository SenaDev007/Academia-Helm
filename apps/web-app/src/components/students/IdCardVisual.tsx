'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Carte scolaire premium (recto + verso)
 * ============================================================================
 *
 * Design conforme au template "Carte Scolaire - Recto Verso" validé par Claude AI.
 * Référence visuelle : /home/z/my-project/upload/spec-carte-scolaire-zai.md
 *
 * RECTO :
 *   - Bande accentuelle (gradient) en haut
 *   - Header deux-tons : logo+tagline à gauche (clip-path diagonal) + nom école + slogan à droite (gradient)
 *   - Corps : photo élève à gauche + champs à droite (Matricule / ID / Nom / Tuteur / Classe / Urgence)
 *   - Footer : adresse+tél école à gauche + signature Directeur à droite (clip-path diagonal)
 *
 * VERSO :
 *   - Header gradient : "CONDITIONS D'UTILISATION" + dates (émise/expire) — clip-path diagonal
 *   - Corps : conditions (puce ■) + bloc contact (Tél / Email / Web)
 *   - Footer : logo+tagline à gauche + QR code à droite (clip-path diagonal)
 *
 * ⚠️ La corde (lanyard) au-dessus de la carte a été SUPPRIMÉE conformément à la
 *    demande utilisateur. Seul le point d'attache (clip circulaire) est conservé
 *    pour indiquer l'emplacement où la carte serait tenue par un lanyard.
 *
 * Toutes les dimensions sont en `cqw` (container query width) ce qui permet
 * à la carte de scaling proportionnellement avec la largeur du conteneur.
 * Format naturel : 400 × 250 px (ratio 1.6 ≈ CR80 85.6 × 53.98 mm).
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

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
  cardFooterText?: string;
  // ⚠️ Les champs suivants sont conservés pour compatibilité avec l'ancien
  //    moteur (Puppeteer) et CardDesignTab, mais ne sont plus utilisés par
  //    le nouveau design Claude AI (le rendu ne varie plus selon ces options).
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

// ⭐ QR code réel — génère une image base64 depuis le qrPayload.
function RealQRCode({ payload }: { payload?: string }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (payload) {
      QRCode.toDataURL(payload, {
        width: 200,
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(setDataUrl).catch(() => setDataUrl(''));
    } else {
      setDataUrl('');
    }
  }, [payload]);

  if (!payload || !dataUrl) {
    // Fallback : fausse grille 7×7 simulant un QR code
    return (
      <div className="w-full h-full grid grid-cols-7 grid-rows-7 gap-px bg-white">
        {Array.from({ length: 49 }).map((_, i) => (
          <div key={i} className={((i * 11 + 5) % 7 < 4) ? 'bg-black' : 'bg-white'} />
        ))}
      </div>
    );
  }

  return <img src={dataUrl} alt="QR Code" className="w-full h-full block" />;
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

  // ─── Données école (avec fallbacks) ──────────────────────────────────────
  const schoolName = identity?.schoolName || 'Établissement Scolaire';
  const slogan = identity?.slogan || 'Excellence • Discipline • Travail';
  const tagline = identity?.tagline || identity?.slogan || 'Éducation • Avenir • Réussite';
  const logoUrl = identity?.logoUrl || '';
  // Sigle/acronyme de l'école pour le placeholder logo
  const logoText = identity?.logoText ||
    (schoolName.split(/\s+/).filter(w => w.length > 2).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()) ||
    'AH';

  const schoolAddress = [identity?.address, identity?.city].filter(Boolean).join(', ') || '';
  const schoolPhone = identity?.phonePrimary || '';
  const schoolEmail = identity?.email || '';
  const schoolWebsite = identity?.website || '';

  // ─── Données élève / tuteur ─────────────────────────────────────────────
  const guardianName = g ? `${g.firstName} ${g.lastName}`.trim() : '—';
  const guardianPhone = g?.phone || '—';

  // ─── Couleurs (tokens dynamiques) ────────────────────────────────────────
  const primaryColor = identity?.cardPrimaryColor || '#17348f';
  const secondaryColor = identity?.cardSecondaryColor || '#29c2e8';

  // ─── Conditions d'utilisation ─────────────────────────────────────────────
  const conditionsText = identity?.cardConditionsText ||
    "Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l'administration. La carte doit être restituée en cas de départ de l'établissement.";

  // ═══════════════════════════════════════════════════════════════════════
  // RECTO — Face avant
  // ═══════════════════════════════════════════════════════════════════════
  if (face === 'recto') {
    return (
      <div className="w-full flex flex-col items-center" style={{ containerType: 'inline-size' }}>
        {/* Point d'attache (clip circulaire) — SANS corde/lanyard au-dessus */}
        <div aria-hidden style={{
          width: '7.5cqw',
          height: '7.5cqw',
          borderRadius: '50%',
          border: '1.25cqw solid #b7bcc4',
          background: '#e9e9ec',
          marginBottom: '-4.5cqw',
          position: 'relative',
          zIndex: 2,
        }} />

        {/* Carte */}
        <div
          className="relative bg-white overflow-hidden"
          style={{
            width: '100%',
            aspectRatio: '400 / 250',
            borderRadius: '3.5cqw',
            border: '1.5cqw solid #f4f4f5',
            boxShadow: '0 2.5cqw 6.25cqw rgba(0,0,0,0.18)',
            fontFamily: 'Arial, Helvetica, sans-serif',
          }}
        >
          {/* accent-bar — gradient pleine largeur en haut */}
          <div style={{
            height: '1.25cqw',
            background: `linear-gradient(90deg, ${primaryColor}, ${secondaryColor})`,
          }} />

          {/* ─── HEADER (2-tons avec clip-path diagonal) ─── */}
          <div className="relative flex" style={{ height: '17.5cqw' }}>
            {/* header-left : blanc, clip-path diagonal en bas à droite */}
            <div
              className="flex flex-col justify-center"
              style={{
                width: '42%',
                background: '#ffffff',
                paddingLeft: '4.5cqw',
                clipPath: 'polygon(0 0, 100% 0, 82% 100%, 0% 100%)',
              }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo"
                  style={{ height: '8cqw', width: 'auto', objectFit: 'contain' }} />
              ) : (
                <div style={{
                  fontWeight: 800,
                  fontSize: '3.5cqw',
                  color: '#1a1a2e',
                  letterSpacing: '0.05cqw',
                  lineHeight: 1.1,
                }}>
                  {logoText}
                </div>
              )}
              <div style={{
                fontSize: '2cqw',
                color: '#555',
                letterSpacing: '0.25cqw',
                marginTop: '0.5cqw',
              }}>
                {tagline}
              </div>
            </div>

            {/* header-right : gradient, margin-left négatif pour chevauchement */}
            <div
              className="flex flex-col justify-center flex-1"
              style={{
                background: `linear-gradient(100deg, ${primaryColor} 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`,
                marginLeft: '-14%',
                paddingLeft: '8.5cqw',
              }}
            >
              <div style={{
                color: '#fff',
                fontWeight: 800,
                fontSize: '4cqw',
                letterSpacing: '0.075cqw',
                lineHeight: 1.1,
              }}>
                {schoolName}
              </div>
              <div style={{
                color: '#dff0ff',
                fontSize: '2.25cqw',
                letterSpacing: '0.25cqw',
                marginTop: '0.5cqw',
                lineHeight: 1.1,
              }}>
                {slogan}
              </div>
            </div>
          </div>

          {/* ─── CORPS : photo + champs ─── */}
          <div className="flex" style={{ padding: '3.5cqw 4cqw 0 4cqw', gap: '3.5cqw' }}>
            {/* photo-box */}
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
                  // Damier placeholder (cf. spec Claude AI .photo-box)
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

            {/* fields */}
            <div className="flex-1 flex flex-col" style={{
              fontSize: '2.375cqw',
              color: '#1a1a2e',
              minWidth: 0,
            }}>
              <FieldRow label="N° Carte" value={card.cardNumber || '—'} />
              <FieldRow label="Matricule" value={s.matricule || s.studentCode || '—'} />
              <FieldRow label="Nom" value={`${s.lastName} ${s.firstName}`.trim() || '—'} bold />
              {identity?.cardShowGuardian !== false && (
                <FieldRow label="Tuteur" value={guardianName} />
              )}
              <FieldRow label="Classe" value={card.className || '—'} />
              {identity?.cardShowEmergencyCall !== false && (
                <FieldRow label="Urgence" value={guardianPhone} />
              )}
            </div>
          </div>

          {/* ─── FOOTER (gradient + clip-path diagonal en haut à droite) ─── */}
          <div
            className="absolute left-0 right-0 flex items-center justify-between"
            style={{
              bottom: 0,
              height: '11.5cqw',
              background: `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`,
              padding: '0 4cqw',
              clipPath: 'polygon(0 25%, 100% 0, 100% 100%, 0 100%)',
            }}
          >
            {/* footer-address (left) */}
            <div style={{
              color: '#fff',
              fontSize: '2cqw',
              lineHeight: 1.5,
              maxWidth: '60%',
            }}>
              {identity?.cardShowSchoolAddress !== false && schoolAddress && (
                <div className="truncate">{schoolAddress}</div>
              )}
              {schoolPhone && <div>Tél : {schoolPhone}</div>}
            </div>

            {/* footer-sign (right) */}
            <div className="text-center" style={{ paddingTop: '1cqw' }}>
              <div style={{
                fontFamily: '"Brush Script MT", cursive',
                fontSize: '4cqw',
                color: '#fff',
                lineHeight: 1,
              }}>
                Signature
              </div>
              <div style={{
                color: '#fff',
                fontSize: '2.25cqw',
                fontWeight: 700,
                marginTop: '0.5cqw',
              }}>
                Directeur
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VERSO — Face arrière
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full flex flex-col items-center" style={{ containerType: 'inline-size' }}>
      {/* Point d'attache (clip circulaire) — SANS corde/lanyard au-dessus */}
      <div aria-hidden style={{
        width: '7.5cqw',
        height: '7.5cqw',
        borderRadius: '50%',
        border: '1.25cqw solid #b7bcc4',
        background: '#e9e9ec',
        marginBottom: '-4.5cqw',
        position: 'relative',
        zIndex: 2,
      }} />

      {/* Carte */}
      <div
        className="relative bg-white overflow-hidden"
        style={{
          width: '100%',
          aspectRatio: '400 / 250',
          borderRadius: '3.5cqw',
          border: '1.5cqw solid #f4f4f5',
          boxShadow: '0 2.5cqw 6.25cqw rgba(0,0,0,0.18)',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {/* ─── BACK-HEADER (gradient + clip-path diagonal en bas à droite) ─── */}
        <div
          className="flex items-center justify-between"
          style={{
            height: '15cqw',
            background: `linear-gradient(100deg, ${primaryColor} 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`,
            padding: '0 4cqw 0 4.5cqw',
            clipPath: 'polygon(0 0, 88% 0, 100% 100%, 0% 100%)',
          }}
        >
          <div style={{
            color: '#fff',
            fontWeight: 800,
            fontSize: '3.25cqw',
            letterSpacing: '0.075cqw',
            lineHeight: 1.1,
          }}>
            CONDITIONS D'UTILISATION
          </div>
          <div style={{
            color: '#eaf3ff',
            fontSize: '2cqw',
            textAlign: 'right',
            lineHeight: 1.6,
          }}>
            <div>Émise le : {formatDate(card.generatedAt)}</div>
            {card.validUntil && <div>Expire le : {formatDate(card.validUntil)}</div>}
          </div>
        </div>

        {/* ─── BACK-BODY : conditions + contact ─── */}
        <div style={{ padding: '3cqw 4.5cqw 0 4.5cqw' }}>
          {/* term-item (puce ■ + texte) */}
          <div className="flex" style={{
            gap: '2cqw',
            fontSize: '2cqw',
            color: '#444',
            lineHeight: 1.5,
            marginBottom: '2cqw',
          }}>
            <span style={{ color: primaryColor, fontWeight: 900, flexShrink: 0 }}>■</span>
            <span>{conditionsText}</span>
          </div>

          {/* contact-block */}
          <div style={{ marginTop: '2.5cqw', fontSize: '2.25cqw', color: '#1a1a2e' }}>
            {schoolPhone && <ContactRow label="Tél" value={schoolPhone} />}
            {schoolEmail && <ContactRow label="Email" value={schoolEmail} />}
            {schoolWebsite && <ContactRow label="Web" value={schoolWebsite} />}
            {identity?.cardShowSchoolAddress !== false && schoolAddress && (
              <ContactRow label="Adresse" value={schoolAddress} />
            )}
          </div>
        </div>

        {/* ─── BACK-FOOTER (gradient + clip-path diagonal en haut à droite) ─── */}
        <div
          className="absolute left-0 right-0 flex items-center justify-between"
          style={{
            bottom: 0,
            height: '14.5cqw',
            background: `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor} 55%, ${secondaryColor} 100%)`,
            padding: '0 4cqw',
            clipPath: 'polygon(0 30%, 100% 0, 100% 100%, 0 100%)',
          }}
        >
          {/* back-logo (left) */}
          <div style={{ paddingTop: '1.5cqw' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo"
                style={{ height: '6cqw', width: 'auto', objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '3cqw',
                  lineHeight: 1.1,
                }}>
                  {logoText}
                </div>
                <div style={{
                  color: '#cfe6ff',
                  fontSize: '1.75cqw',
                  letterSpacing: '0.25cqw',
                  marginTop: '0.5cqw',
                }}>
                  {tagline}
                </div>
              </>
            )}
          </div>

          {/* QR code (right) */}
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
function FieldRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex" style={{ marginBottom: '1.5cqw' }}>
      <span style={{
        fontWeight: 700,
        width: '19.5cqw',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ width: '2.5cqw', flexShrink: 0 }}>:</span>
      <span style={{
        color: '#333',
        fontWeight: bold ? 700 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Sous-composant : ligne de contact (label : value) ────────────────────
function ContactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex" style={{ marginBottom: '1cqw' }}>
      <span style={{
        fontWeight: 700,
        width: '15cqw',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{ marginRight: '0.5cqw' }}>:</span>
      <span style={{
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
