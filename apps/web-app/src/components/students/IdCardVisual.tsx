'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Carte scolaire premium (recto + verso)
 * ============================================================================
 *
 * Design conforme au template vecteezy_blue-school-id-card-template :
 *   - CR80 paysage (85.60 × 53.98 mm)
 *   - Recto : header bleu (logo + école + slogan) → photo gauche + champs droite → footer contact + signature
 *   - Verso : header bleu (Terms & Conditions) → conditions + contact école → QR code droite
 *   - Couleurs : bleu primaire (configurable) + blanc + accents
 *
 * Ministère adapté au niveau (Maternel/Primaire vs Secondaire vs Supérieur)
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
  const isSecondaire = levelUpper === 'SECONDAIRE' || levelUpper === 'SECONDARY' || levelUpper === 'SECOND';
  const isSuperieur = levelUpper === 'SUPERIEUR' || levelUpper === 'UNIVERSITY' || levelUpper === 'HIGHER';

  const ministry = isSuperieur
    ? 'Ministère de l\u2019Enseignement Supérieur et de la Recherche Scientifique'
    : isSecondaire
    ? 'Ministère de l\u2019Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l\u2019Insertion des Jeunes'
    : 'Ministère des Enseignements Maternel et Primaire';

  const acronym = schoolName
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 8) || 'ECOLE';

  // ─── Logo école ───
  const SchoolLogo = ({ size = 36 }: { size?: number }) => {
    if (logoUrl) return <img src={logoUrl} alt="Logo" style={{ width: size, height: size }} className="rounded-lg object-contain bg-white p-0.5 shrink-0" />;
    return (
      <div style={{ width: size, height: size }} className="rounded-lg bg-white flex items-center justify-center font-bold shrink-0"
        style={{ width: size, height: size, color: primaryColor, fontSize: `${size * 0.35}px` }}>
        {acronym.substring(0, 3)}
      </div>
    );
  };

  // ─── Drapeau du Bénin ───
  const BeninFlag = ({ size = 24 }: { size?: number }) => (
    <div style={{ width: size * 1.3, height: size }} className="rounded overflow-hidden border border-white/30 shrink-0 flex">
      <div className="w-1/2 h-full bg-green-600" />
      <div className="w-1/2 flex flex-col">
        <div className="h-1/2 bg-yellow-400" />
        <div className="h-1/2 bg-red-600" />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RECTO — Face avant de la carte
  // Layout : Header bleu → Corps (photo gauche + champs droite) → Footer (contact + signature)
  // ═══════════════════════════════════════════════════════════════════════
  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-xl overflow-hidden shadow-xl border border-gray-300 flex flex-col"
        style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, Arial, sans-serif' }}>

        {/* ═══ HEADER BLEU (logo + école + slogan) — 22% ═══ */}
        <div className="shrink-0 flex items-center px-2.5 py-1.5 gap-2 text-white"
          style={{ height: '22%', background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
          <SchoolLogo size={28} />
          <div className="flex-1 min-w-0 text-center">
            <div className="text-[5px] font-bold leading-tight uppercase tracking-wide truncate">{schoolName}</div>
            <div className="text-[3px] leading-tight opacity-80 truncate">{ministry}</div>
            <div className="text-[3px] italic leading-tight opacity-70 truncate">{slogan}</div>
          </div>
          <BeninFlag size={16} />
        </div>

        {/* ═══ CORPS (photo gauche + champs droite) — 56% ═══ */}
        <div className="flex flex-1 min-h-0 px-2 py-1.5 gap-2">
          {/* Colonne gauche : photo + QR code */}
          <div className="flex flex-col items-center justify-start gap-1 shrink-0" style={{ width: '28%' }}>
            {(identity?.cardShowPhoto !== false) && (
              <div className="w-full rounded-md overflow-hidden border-2"
                style={{ borderColor: primaryColor, aspectRatio: '0.75', background: '#f3f4f6' }}>
                {s.photoUrl
                  ? <img src={s.photoUrl} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-[5px] text-gray-400">PHOTO</div>}
              </div>
            )}
            {(identity?.cardShowQRCode !== false) && (
              <RealQRCode payload={card.qrPayload} size={32} />
            )}
          </div>

          {/* Colonne droite : champs d'information */}
          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
            <InfoField label="N° Carte" value={card.cardNumber} primary={primaryColor} />
            <InfoField label="Matricule" value={s.matricule || s.studentCode || '—'} primary={primaryColor} />
            <InfoField label="Nom et Prénom" value={`${s.lastName.toUpperCase()} ${s.firstName}`} primary={primaryColor} bold />
            <div className="grid grid-cols-2 gap-x-2">
              <InfoField label="Sexe" value={s.gender === 'M' ? 'Masculin' : s.gender === 'F' ? 'Féminin' : '—'} primary={primaryColor} />
              <InfoField label="Date de Naiss." value={formatDate(s.dateOfBirth)} primary={primaryColor} />
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <InfoField label="Classe" value={card.className || '—'} primary={primaryColor} />
              <InfoField label="Année Scolaire" value={card.academicYearName || card.levelName || '—'} primary={primaryColor} />
            </div>
            {(identity?.cardShowGuardian !== false) && (
              <InfoField label="Parent / Tuteur" value={guardianName} primary={primaryColor} />
            )}
            {(identity?.cardShowEmergencyCall !== false) && (
              <InfoField label="Téléphone Urgence" value={guardianPhone} primary={primaryColor} />
            )}
          </div>
        </div>

        {/* ═══ FOOTER (contact + signature) — 22% ═══ */}
        <div className="shrink-0 flex items-center px-2.5 text-white"
          style={{ height: '22%', background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}>
          {/* Gauche : contact école */}
          <div className="min-w-0 flex-1">
            <div className="text-[3px] font-bold uppercase opacity-90 mb-0.5">Contact</div>
            {schoolPhone && <div className="text-[3px] opacity-80 truncate">Tél : {schoolPhone}</div>}
            {schoolEmail && <div className="text-[3px] opacity-80 truncate">{schoolEmail}</div>}
            {(identity?.cardShowSchoolAddress !== false) && schoolAddress && (
              <div className="text-[3px] opacity-70 truncate">{schoolAddress}</div>
            )}
          </div>
          {/* Droite : signature */}
          <div className="text-right shrink-0 ml-2">
            <div className="text-[4px] italic opacity-90 mb-px" style={{ fontFamily: 'Brush Script MT, cursive' }}>Le Directeur</div>
            <div className="text-[3px] opacity-70 border-t border-white/30 pt-px">Signature & Cachet</div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // VERSO — Face arrière de la carte
  // Layout : Header bleu (Terms) → Corps (conditions + contact) → QR droite
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="w-full bg-white rounded-xl overflow-hidden shadow-xl border border-gray-300 flex flex-col"
      style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, Arial, sans-serif' }}>

      {/* ═══ HEADER BLEU (Terms & Conditions + dates) — 18% ═══ */}
      <div className="shrink-0 flex items-center justify-between px-2.5 py-1.5 text-white"
        style={{ height: '18%', background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}>
        <span className="text-[5px] font-bold uppercase tracking-wider">Conditions d'Utilisation</span>
        <div className="text-right text-[3px] leading-tight">
          <div>Émise le : {formatDate(card.generatedAt)}</div>
          {card.validUntil && <div>Valable jusqu'au : {formatDate(card.validUntil)}</div>}
        </div>
      </div>

      {/* ═══ CORPS (conditions + QR) — 82% ═══ */}
      <div className="flex flex-1 min-h-0 px-2 py-1.5 gap-2">
        {/* Gauche : conditions + contact école */}
        <div className="flex-1 flex flex-col min-w-0">
          {identity?.cardConditionsText ? (
            <div className="text-[3px] text-gray-600 leading-tight whitespace-pre-line mb-1" style={{ maxHeight: '48px', overflow: 'hidden' }}>
              {identity.cardConditionsText}
            </div>
          ) : (
            <ul className="space-y-0.5 mb-1">
              {[
                'Cette carte reste la propriété de l\'établissement.',
                'L\'élève doit la porter tous les jours d\'école.',
                'En cas de perte, signaler immédiatement à l\'administration.',
                'Cette carte est strictement personnelle et non transférable.',
                'Restituer la carte en cas de départ de l\'établissement.',
              ].map((rule, i) => (
                <li key={i} className="flex items-start gap-1">
                  <div className="w-1 h-1 rounded-sm mt-0.5 shrink-0" style={{ background: primaryColor }} />
                  <span className="text-[3px] text-gray-600 leading-tight">{rule}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Heures de sortie maternelle */}
          {isMaternelle && (
            <div className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 mb-1">
              <div className="text-[3px] font-bold text-amber-700 uppercase">Heures de Sortie</div>
              {identity?.maternelleSingleExit
                ? <div className="text-[3px] text-amber-800">Sortie unique : {identity?.maternelleSingleExitTime || '15:30'}</div>
                : <>
                  <div className="text-[3px] text-amber-800">Matin : {identity?.maternellePickupMorning || '12:00'}</div>
                  <div className="text-[3px] text-amber-800">Après-midi : {identity?.maternellePickupAfternoon || '16:30'}</div>
                </>
              }
            </div>
          )}

          {/* Contact école */}
          <div className="mt-auto space-y-0.5">
            {schoolPhone && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Tél :</span> {schoolPhone}</div>}
            {schoolEmail && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Email :</span> {schoolEmail}</div>}
            {schoolWebsite && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Web :</span> {schoolWebsite}</div>}
            {(identity?.cardShowSchoolAddress !== false) && schoolAddress && (
              <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: primaryColor }}>Adresse :</span> {schoolAddress}</div>
            )}
          </div>
        </div>

        {/* Droite : QR code + logo */}
        <div className="flex flex-col items-center justify-center gap-1 shrink-0"
          style={{ width: '26%', background: `linear-gradient(135deg, ${primaryColor}11 0%, ${secondaryColor}08 100%)`, borderRadius: '6px' }}>
          <SchoolLogo size={24} />
          <div className="text-[3px] text-gray-500 text-center leading-tight font-bold">{acronym}</div>
          {(identity?.cardShowQRCode !== false) && (
            <RealQRCode payload={card.qrPayload} size={40} />
          )}
          <div className="text-[2.5px] text-gray-400 text-center leading-tight">Scan pour vérifier</div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composant : champ d'information ───
function InfoField({ label, value, primary, bold }: { label: string; value: string; primary: string; bold?: boolean }) {
  return (
    <div className="min-w-0 flex items-baseline gap-1">
      <span className="text-[3px] font-bold uppercase shrink-0" style={{ color: primary }}>{label} :</span>
      <span className={cn('text-[3.5px] truncate', bold ? 'font-bold' : '')} style={{ color: '#1F2937' }}>{value}</span>
    </div>
  );
}

export default IdCardVisual;
