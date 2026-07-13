'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Carte scolaire premium (recto + verso)
 * ============================================================================
 *
 * Design conforme au template vecteezy_blue-school-id-card-template :
 *
 * RECTO :
 *   - Header bleu : logo école + nom + slogan
 *   - Corps : photo élève à gauche (PAS de QR code) + champs à droite
 *   - Bande bleue bas : adresse + téléphone école à gauche + signature Directeur à droite
 *
 * VERSO :
 *   - Header bleu : "Conditions d'Utilisation" + dates (émise/expiry)
 *   - Corps : conditions + heures sortie maternelle + contact école
 *   - Bas droite : QR code + logo dans bloc bleu
 *
 * CR80 paysage (85.60 × 53.98 mm)
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
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
  cardShowQRCode?: boolean;
  cardShowPhoto?: boolean;
  cardShowGuardian?: boolean;
  cardShowEmergencyCall?: boolean;
  cardShowSchoolAddress?: boolean;
  cardConditionsText?: string;
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ⭐ QR code réel — génère une image base64 depuis le qrPayload
function RealQRCode({ payload, size = 48 }: { payload?: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (payload) {
      QRCode.toDataURL(payload, {
        width: size * 2,
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(setDataUrl).catch(() => setDataUrl(''));
    }
  }, [payload, size]);

  if (!payload || !dataUrl) {
    return (
      <div className="border border-gray-300 rounded bg-white p-px" style={{ width: size, height: size }}>
        <div className="grid grid-cols-7 grid-rows-7 gap-px w-full h-full">
          {Array.from({ length: 49 }).map((_, i) => (
            <div key={i} className={cn(((i * 11 + 5) % 7 < 4) ? 'bg-black' : 'bg-white')} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <img src={dataUrl} alt="QR Code" style={{ width: size, height: size }} className="border border-gray-300 rounded bg-white" />
  );
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

  const schoolName = identity?.schoolName || 'Établissement Scolaire';
  const slogan = identity?.slogan || 'Excellence • Discipline • Travail';
  const schoolAddress = [identity?.address, identity?.city].filter(Boolean).join(', ') || '';
  const schoolPhone = identity?.phonePrimary || '';
  const schoolEmail = identity?.email || '';
  const schoolWebsite = identity?.website || '';
  const logoUrl = identity?.logoUrl || '';

  const guardianName = g ? `${g.firstName} ${g.lastName}`.trim() : '—';
  const guardianPhone = g?.phone || '—';
  const guardianAddress = g?.address || '—';

  const primaryColor = identity?.cardPrimaryColor || '#0D1F6E';
  const secondaryColor = '#1E40AF';

  // Détection du niveau
  const levelUpper = (card.levelCode || '').toUpperCase();
  const isMaternelle = levelUpper === 'MATERNELLE' || levelUpper === 'MAT';

  // ─── Logo école ───
  const SchoolLogo = ({ size = 36 }: { size?: number }) => {
    if (logoUrl) return <img src={logoUrl} alt="Logo" style={{ width: size, height: size }} className="rounded-lg object-contain bg-white p-0.5 shrink-0" />;
    return (
      <div style={{ width: size, height: size, color: primaryColor, fontSize: `${size * 0.35}px` }}
        className="rounded-lg bg-white flex items-center justify-center font-bold shrink-0">
        {schoolName.split(/\s+/).filter(w => w.length > 2).map(w => w[0]).join('').toUpperCase().substring(0, 3) || 'ECO'}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RECTO — Face avant
  // Header bleu (logo + école + slogan) → Photo gauche + champs droite → Bande bas (contact école + signature)
  // PAS DE QR CODE SUR LE RECTO
  // ═══════════════════════════════════════════════════════════════════════
  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-xl overflow-hidden shadow-xl border border-gray-300 flex flex-col"
        style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, Arial, sans-serif' }}>

        {/* ═══ HEADER BLEU (logo + école + slogan) — 22% ═══ */}
        <div className="shrink-0 flex items-center px-3 py-2 gap-2 text-white"
          style={{ height: '22%', background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
          <SchoolLogo size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[6px] font-bold leading-tight uppercase tracking-wide truncate">{schoolName}</div>
            <div className="text-[4px] italic leading-tight opacity-80 truncate">{slogan}</div>
          </div>
        </div>

        {/* ═══ CORPS (photo gauche + champs droite) — 56% ═══ */}
        <div className="flex flex-1 min-h-0 px-3 py-2 gap-3">
          {/* Photo élève à gauche — PAS de QR code */}
          <div className="flex flex-col items-center justify-center shrink-0" style={{ width: '30%' }}>
            {(identity?.cardShowPhoto !== false) && (
              <div className="w-full rounded-md overflow-hidden border-2"
                style={{ borderColor: primaryColor, aspectRatio: '0.75', background: '#f3f4f6' }}>
                {s.photoUrl
                  ? <img src={s.photoUrl} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-[6px] text-gray-400">PHOTO</div>}
              </div>
            )}
          </div>

          {/* Champs à droite */}
          <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
            <InfoField label="N° Carte" value={card.cardNumber} primary={primaryColor} />
            <InfoField label="Matricule" value={s.matricule || s.studentCode || '—'} primary={primaryColor} />
            <InfoField label="Nom et Prénom" value={`${s.lastName.toUpperCase()} ${s.firstName}`} primary={primaryColor} bold />
            <div className="grid grid-cols-2 gap-x-2">
              <InfoField label="Sexe" value={s.gender === 'M' ? 'Masculin' : s.gender === 'F' ? 'Féminin' : '—'} primary={primaryColor} />
              <InfoField label="Date Naiss." value={formatDate(s.dateOfBirth)} primary={primaryColor} />
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <InfoField label="Classe" value={card.className || '—'} primary={primaryColor} />
              <InfoField label="Année" value={card.academicYearName || card.levelName || '—'} primary={primaryColor} />
            </div>
            {(identity?.cardShowGuardian !== false) && (
              <InfoField label="Parent / Tuteur" value={guardianName} primary={primaryColor} />
            )}
            {(identity?.cardShowEmergencyCall !== false) && (
              <InfoField label="Téléphone Urgence" value={guardianPhone} primary={primaryColor} />
            )}
          </div>
        </div>

        {/* ═══ BANDE BAS BLEUE (adresse école + signature Directeur) — 22% ═══ */}
        <div className="shrink-0 flex items-center px-3 text-white"
          style={{ height: '22%', background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}>
          {/* Gauche : adresse + téléphone école */}
          <div className="min-w-0 flex-1">
            {(identity?.cardShowSchoolAddress !== false) && schoolAddress && (
              <div className="text-[3.5px] opacity-90 leading-tight truncate">{schoolAddress}</div>
            )}
            {schoolPhone && (
              <div className="text-[3.5px] opacity-90 leading-tight truncate">Tél : {schoolPhone}</div>
            )}
          </div>
          {/* Droite : signature Directeur */}
          <div className="text-right shrink-0 ml-2">
            <div className="text-[5px] italic opacity-90" style={{ fontFamily: 'Brush Script MT, cursive' }}>Le Directeur</div>
            <div className="text-[3.5px] opacity-70 border-t border-white/30 pt-px mt-0.5">Signature & Cachet</div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VERSO — Face arrière
  // Header bleu (Terms + dates) → Corps (conditions + contact) → Bas (QR code droite)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full bg-white rounded-xl overflow-hidden shadow-xl border border-gray-300 flex flex-col"
      style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, Arial, sans-serif' }}>

      {/* ═══ HEADER BLEU (Conditions + dates) — 18% ═══ */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 text-white"
        style={{ height: '18%', background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
        <span className="text-[5px] font-bold uppercase tracking-wider">Conditions d'Utilisation</span>
        <div className="text-right text-[3.5px] leading-tight">
          <div>Émise le : {formatDate(card.generatedAt)}</div>
          {card.validUntil && <div>Valable jusqu'au : {formatDate(card.validUntil)}</div>}
        </div>
      </div>

      {/* ═══ CORPS (conditions + contact école + QR code) — 82% ═══ */}
      <div className="flex flex-1 min-h-0 px-3 py-2 gap-2">
        {/* Gauche : conditions + heures sortie + contact école */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Conditions */}
          {identity?.cardConditionsText ? (
            <div className="text-[3.5px] text-gray-600 leading-tight whitespace-pre-line mb-1" style={{ maxHeight: '40px', overflow: 'hidden' }}>
              {identity.cardConditionsText}
            </div>
          ) : (
            <ul className="space-y-0.5 mb-1">
              {[
                'Cette carte reste la propriété de l\'établissement.',
                'L\'élève doit la porter tous les jours d\'école.',
                'En cas de perte, signaler immédiatement à l\'administration.',
                'Cette carte est strictement personnelle.',
                'Restituer la carte en cas de départ.',
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-1">
                  <div className="w-1 h-1 rounded-sm mt-0.5 shrink-0" style={{ background: primaryColor }} />
                  <span className="text-[3.5px] text-gray-600 leading-tight">{rule}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Heures de sortie maternelle */}
          {isMaternelle && (
            <div className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 mb-1">
              <div className="text-[3.5px] font-bold text-amber-700 uppercase">Heures de Sortie</div>
              {identity?.maternelleSingleExit
                ? <div className="text-[3.5px] text-amber-800">Sortie unique : {identity?.maternelleSingleExitTime || '15:30'}</div>
                : <>
                  <div className="text-[3.5px] text-amber-800">Matin : {identity?.maternellePickupMorning || '12:00'}</div>
                  <div className="text-[3.5px] text-amber-800">Après-midi : {identity?.maternellePickupAfternoon || '16:30'}</div>
                </>
              }
            </div>
          )}

          {/* Contact école en bas */}
          <div className="mt-auto space-y-0.5">
            {schoolPhone && <div className="text-[3.5px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Tél :</span> {schoolPhone}</div>}
            {schoolEmail && <div className="text-[3.5px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Email :</span> {schoolEmail}</div>}
            {schoolWebsite && <div className="text-[3.5px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Web :</span> {schoolWebsite}</div>}
            {(identity?.cardShowSchoolAddress !== false) && schoolAddress && (
              <div className="text-[3.5px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Adresse :</span> {schoolAddress}</div>
            )}
          </div>
        </div>

        {/* Droite : QR code + logo dans bloc bleu en bas à droite */}
        <div className="flex flex-col items-center justify-end gap-1 shrink-0"
          style={{ width: '28%' }}>
          <div className="rounded-lg p-2 flex flex-col items-center gap-1"
            style={{ background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}10 100%)` }}>
            <SchoolLogo size={24} />
            {(identity?.cardShowQRCode !== false) && (
              <RealQRCode payload={card.qrPayload} size={44} />
            )}
            <div className="text-[3px] text-gray-400 text-center leading-tight">Scanner pour vérifier</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composant : champ d'information inline ───
function InfoField({ label, value, primary, bold }: { label: string; value: string; primary: string; bold?: boolean }) {
  return (
    <div className="min-w-0 flex items-baseline gap-1">
      <span className="text-[3.5px] font-bold uppercase shrink-0" style={{ color: primary }}>{label} :</span>
      <span className={cn('text-[4px] truncate', bold ? 'font-bold' : '')} style={{ color: '#1F2937' }}>{value}</span>
    </div>
  );
}

export default IdCardVisual;
