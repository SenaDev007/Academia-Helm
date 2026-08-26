'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Carte scolaire premium (recto + verso)
 * ============================================================================
 *
 * Design hybride :
 *   - EN-TÊTE RECTO : style ANCIEN conservé (République du Bénin + drapeau +
 *     ministère + nom école + slogan + logo). La bande est CONTINUE (pas de
 *     clip-path) pour que toutes les informations restent lisibles.
 *   - EN-TÊTE VERSO : bande continue (pas de clip-path) avec "CONDITIONS
 *     D'UTILISATION" + dates émise/expire clairement visibles.
 *   - CORPS + FOOTER : design Claude AI (photo + 6 champs, footer gradient
 *     avec clip-path diagonal + signature Directeur, verso avec conditions
 *     + bloc contact + QR code).
 *
 * ⚠️ La corde (lanyard) au-dessus de la carte a été SUPPRIMÉE. Seul le point
 *    d'attache (clip circulaire) est conservé.
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

// ⭐ QR code réel — génère une image base64 depuis le qrPayload
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

  // ─── Ministère adapté au niveau scolaire (Bénin) ─────────────────────────
  const levelUpper = (card.levelCode || '').toUpperCase();
  const isSuperieur = levelUpper === 'SUPERIEUR' || levelUpper === 'UNIVERSITY' || levelUpper === 'HIGHER';
  const isSecondaire = levelUpper === 'SECONDAIRE' || levelUpper === 'SECONDARY' || levelUpper === 'SECOND';
  const ministry = isSuperieur
    ? "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique"
    : isSecondaire
    ? "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
    : 'Ministère des Enseignements Maternel et Primaire';

  // ─── Composant : Drapeau du Bénin (vert à gauche, jaune/rouge à droite) ──
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

  // ─── Composant : Logo école (image ou sigle/acronym en fallback) ──────────
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
          {/* ═══ HEADER BLEU (style ancien — Republic + flag + ministry + school + slogan + logo) ═══ */}
          {/* BANDE CONTINUE : pas de clip-path, pas d'accent-bar séparée */}
          <div
            className="shrink-0 flex items-center text-white"
            style={{
              height: '24%',
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              padding: '0 1.6cqw',
              gap: '0.6cqw',
            }}
          >
            {/* Drapeau du Bénin à gauche */}
            <BeninFlag sizeCqw={3.5} />
            {/* Centre : République + Ministère + École + Slogan */}
            <div className="flex-1 text-center min-w-0" style={{ padding: '0 0.5cqw' }}>
              <div style={{
                fontSize: '1.25cqw',
                fontWeight: 700,
                lineHeight: 1.1,
                textTransform: 'uppercase',
                letterSpacing: '0.1cqw',
              }}>
                RÉPUBLIQUE DU BÉNIN
              </div>
              <div style={{
                fontSize: '0.75cqw',
                lineHeight: 1.1,
                opacity: 0.85,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {ministry}
              </div>
              <div style={{
                fontSize: '1cqw',
                fontWeight: 700,
                lineHeight: 1.1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {schoolName}
              </div>
              <div style={{
                fontSize: '0.75cqw',
                fontStyle: 'italic',
                lineHeight: 1.1,
                opacity: 0.75,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {slogan}
              </div>
            </div>
            {/* Logo école à droite */}
            <SchoolLogo sizeCqw={6.5} />
          </div>

          {/* ═══ CORPS (Claude AI style : photo + 6 champs) ═══ */}
          <div className="flex" style={{
            padding: '3.5cqw 4cqw 0 4cqw',
            gap: '3.5cqw',
            flex: 1,
            minHeight: 0,
          }}>
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
                  // Damier placeholder
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

          {/* ═══ FOOTER (Claude AI style : gradient + clip-path + adresse + signature) ═══ */}
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
            {/* footer-address */}
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

            {/* footer-sign */}
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
        {/* ═══ BACK-HEADER (BANDE CONTINUE — pas de clip-path, dates clairement visibles) ═══ */}
        <div
          className="shrink-0 flex items-center justify-between text-white"
          style={{
            height: '22%',
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            padding: '0 4cqw',
          }}
        >
          <div style={{
            fontWeight: 800,
            fontSize: '1.25cqw',
            letterSpacing: '0.1cqw',
            lineHeight: 1.1,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            CONDITIONS D'UTILISATION
          </div>
          <div style={{
            fontSize: '1cqw',
            textAlign: 'right',
            lineHeight: 1.6,
            flexShrink: 0,
            paddingLeft: '2cqw',
          }}>
            <div>Émise le : {formatDate(card.generatedAt)}</div>
            {card.validUntil && <div>Expire le : {formatDate(card.validUntil)}</div>}
          </div>
        </div>

        {/* ═══ BACK-BODY (Claude AI style : conditions + contact) ═══ */}
        <div style={{
          padding: '3cqw 4.5cqw 0 4.5cqw',
          flex: 1,
          minHeight: 0,
        }}>
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

        {/* ═══ BACK-FOOTER (Claude AI style : gradient + clip-path + logo + QR) ═══ */}
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
