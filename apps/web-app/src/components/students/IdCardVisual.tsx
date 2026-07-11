'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Carte scolaire premium (recto + verso)
 * ============================================================================
 *
 * Design institutionnel conforme au cahier des charges :
 *   - CR80 paysage (85.60 × 53.98 mm)
 *   - En-tête : drapeau Bénin (gauche) + République/Ministère/École (centre) + logo (droite)
 *   - Corps : photo + QR code (gauche) + 10 champs (droite)
 *   - Pied : contact parent (gauche) + signature Directeur (droite)
 *   - Gradient bleu, coins arrondis, ombres discrètes
 *
 * Ministère adapté au niveau :
 *   Maternel/Primaire → Ministère des Enseignements Maternel et Primaire
 *   Secondaire → Ministère de l'Enseignement Secondaire, de la Formation
 *     Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes
 *   Supérieur → Ministère de l'Enseignement Supérieur et de la Recherche Scientifique
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
}

interface CardGuardian {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
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
}

interface TenantInfo {
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
}

const PRIMARY = '#003087';
const SECONDARY = '#007BFF';
const TEXT = '#1F2937';
const LIGHT_GRAY = '#E5E7EB';

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ⭐ Composant QR code réel — génère une image base64 depuis le qrPayload
function RealQRCode({ payload, size = 56 }: { payload?: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (payload) {
      QRCode.toDataURL(payload, {
        width: size * 2, // 2x for retina
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      }).then(setDataUrl).catch(() => setDataUrl(''));
    }
  }, [payload, size]);

  if (!payload || !dataUrl) {
    // Fallback : grille fictive si pas de payload
    return (
      <div className="border border-gray-200 rounded bg-white p-px" style={{ width: size / 2, height: size / 2 }}>
        <div className="grid grid-cols-7 grid-rows-7 gap-px w-full h-full">
          {Array.from({ length: 49 }).map((_, i) => (
            <div key={i} className={cn(((i * 11 + 5) % 7 < 4) ? 'bg-black' : 'bg-white')} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <img src={dataUrl} alt="QR Code" style={{ width: size / 2, height: size / 2 }} className="border border-gray-200 rounded bg-white" />
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

  // Détection du niveau
  const levelUpper = (card.levelCode || '').toUpperCase();
  const isMaternelle = levelUpper === 'MATERNELLE' || levelUpper === 'MAT';
  const isSecondaire = levelUpper === 'SECONDAIRE' || levelUpper === 'SECONDARY' || levelUpper === 'SECOND';
  const isSuperieur = levelUpper === 'SUPERIEUR' || levelUpper === 'UNIVERSITY' || levelUpper === 'HIGHER';

  // Ministère selon le niveau
  const ministry = isSuperieur
    ? 'Ministère de l\u2019Enseignement Supérieur et de la Recherche Scientifique'
    : isSecondaire
    ? 'Ministère de l\u2019Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l\u2019Insertion des Jeunes'
    : 'Ministère des Enseignements Maternel et Primaire';

  // Sigle/acronyme de l'école (premières lettres des mots)
  const acronym = schoolName
    .split(/\s+/)
    .filter(w => w.length > 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 8) || 'ECOLE';

  const pickupMorning = identity?.maternellePickupMorning || '12:00';
  const pickupAfternoon = identity?.maternellePickupAfternoon || '16:30';
  const singleExit = identity?.maternelleSingleExit;
  const singleExitTime = identity?.maternelleSingleExitTime || '15:30';

  // Logo école
  const SchoolLogo = ({ size = 'md' }: { size?: 'sm' | 'md' }) => {
    const cls = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
    if (logoUrl) return <img src={logoUrl} alt="Logo" className={cn(cls, 'rounded-lg object-contain bg-white p-0.5 shrink-0')} />;
    return (
      <div className={cn(cls, 'rounded-lg bg-white flex items-center justify-center font-bold shrink-0')}
        style={{ color: PRIMARY, fontSize: size === 'sm' ? '8px' : '10px' }}>AH</div>
    );
  };

  // Drapeau du Bénin (vert à gauche, jaune/rouge à droite)
  const BeninFlag = () => (
    <div className="w-9 h-7 rounded overflow-hidden border border-gray-300 shrink-0 flex">
      <div className="w-1/2 h-full bg-green-600" />
      <div className="w-1/2 flex flex-col">
        <div className="h-1/2 bg-yellow-400" />
        <div className="h-1/2 bg-red-600" />
      </div>
    </div>
  );

  // ─── RECTO ───
  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
        style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, sans-serif' }}>

        {/* ═══ EN-TÊTE INSTITUTIONNEL (26%) ═══ */}
        <div className="shrink-0 flex items-center px-2 py-1.5 gap-2 border-b-2"
          style={{ height: '26%', borderColor: SECONDARY + '40' }}>
          {/* Drapeau à gauche */}
          <BeninFlag />
          {/* Centre : République + Ministère + École + Sigle + Devise */}
          <div className="flex-1 text-center min-w-0 px-1">
            <div className="text-[5px] font-bold text-gray-800 leading-tight">RÉPUBLIQUE DU BÉNIN</div>
            <div className="text-[3px] text-gray-500 leading-tight">{ministry}</div>
            <div className="text-[4px] font-bold leading-tight truncate" style={{ color: PRIMARY }}>{schoolName}</div>
            <div className="text-[3px] font-semibold text-gray-400 leading-tight">{acronym}</div>
            <div className="text-[2.5px] italic text-gray-400 leading-tight truncate">{slogan}</div>
          </div>
          {/* Logo école à droite (même taille que drapeau) */}
          <SchoolLogo size="md" />
        </div>

        {/* ═══ CORPS (52%) ═══ */}
        <div className="flex flex-1 min-h-0 px-2 py-1.5 gap-2">
          {/* Colonne gauche : photo + QR code */}
          <div className="flex flex-col items-center justify-center gap-1 shrink-0" style={{ width: '26%' }}>
            <div className="w-full rounded-lg overflow-hidden border-2"
              style={{ borderColor: SECONDARY, aspectRatio: '0.75', background: '#f3f4f6', maxWidth: '42px' }}>
              {s.photoUrl
                ? <img src={s.photoUrl} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[5px] text-gray-400">PHOTO</div>}
            </div>
            {/* QR code de vérification réel */}
            <RealQRCode payload={card.qrPayload} size={56} />
          </div>

          {/* Colonne droite : 10 champs en 2 colonnes */}
          <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-0.5 min-w-0">
            <InfoField label="N° Inscription" value={s.matricule || s.studentCode || '—'} />
            <InfoField label="Matricule" value={card.cardNumber} />
            <InfoField label="Nom et Prénom" value={`${s.lastName} ${s.firstName}`} />
            <InfoField label="Sexe" value={s.gender === 'M' ? 'Masculin' : s.gender === 'F' ? 'Féminin' : '—'} />
            <InfoField label="Date de Naissance" value={formatDate(s.dateOfBirth)} />
            <InfoField label="Classe" value={card.className || '—'} />
            <InfoField label="Année Scolaire" value={card.levelName || '—'} />
            <InfoField label="Groupe Sanguin" value="—" />
            <InfoField label="Parent / Tuteur" value={guardianName} />
            <InfoField label="Téléphone Urgence" value={guardianPhone} />
          </div>
        </div>

        {/* ═══ PIED DE PAGE (22%) ═══ */}
        <div className="shrink-0 relative" style={{ height: '22%' }}>
          <div className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)` }}>
            <div className="flex items-center justify-between h-full px-2.5 text-white">
              {/* Gauche : contact urgence */}
              <div className="min-w-0 flex-1">
                <div className="text-[3px] font-bold uppercase opacity-90 mb-0.5">Contact d'Urgence</div>
                <div className="text-[3px] opacity-80 truncate">{guardianName}</div>
                <div className="text-[3px] opacity-80 truncate">{guardianPhone}</div>
                <div className="text-[3px] opacity-70 truncate">{guardianAddress}</div>
              </div>
              {/* Droite : signature */}
              <div className="text-right shrink-0 ml-2">
                <div className="text-[4px] italic opacity-90 mb-px" style={{ fontFamily: 'Brush Script MT, cursive' }}>Le Directeur</div>
                <div className="text-[3px] opacity-70 border-t border-white/30 pt-px">Signature & Cachet</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── VERSO ───
  return (
    <div className="w-full bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
      style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, sans-serif' }}>

      {/* En-tête gradient avec TERMS & dates */}
      <div className="shrink-0 px-3 py-1.5 flex items-center justify-between text-white"
        style={{ background: `linear-gradient(135deg, ${SECONDARY} 0%, ${PRIMARY} 100%)`, height: '18%' }}>
        <span className="text-[6px] font-bold uppercase tracking-wider">Terms & Conditions</span>
        <div className="text-right text-[3px] leading-tight">
          <div>Issue: {formatDate(card.generatedAt)}</div>
          <div>Expiry: {formatDate(card.validUntil)}</div>
        </div>
      </div>

      {/* Corps : rules + contact + QR */}
      <div className="flex flex-1 min-h-0 px-2.5 py-1.5 gap-2">
        {/* Gauche : rules + heures maternelle + contact */}
        <div className="flex-1 flex flex-col min-w-0">
          <ul className="space-y-0.5 mb-1">
            {[
              'This card remains the property of the school.',
              'Students must carry it every school day.',
              'Loss must be reported immediately.',
              'This card is non-transferable.',
              'Return the card upon leaving the institution.',
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-1">
                <div className="w-1 h-1 rounded-sm mt-0.5 shrink-0" style={{ background: SECONDARY }} />
                <span className="text-[3px] text-gray-600 leading-tight">{rule}</span>
              </li>
            ))}
          </ul>

          {/* Heures de sortie maternelle */}
          {isMaternelle && (
            <div className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 mb-1">
              <div className="text-[3px] font-bold text-amber-700 uppercase">Pickup Hours</div>
              {singleExit
                ? <div className="text-[3px] text-amber-800">Exit: {singleExitTime}</div>
                : <>
                  <div className="text-[3px] text-amber-800">Morning: {pickupMorning}</div>
                  <div className="text-[3px] text-amber-800">Afternoon: {pickupAfternoon}</div>
                </>
              }
            </div>
          )}

          {/* Contact area */}
          <div className="mt-auto space-y-0.5">
            {schoolPhone && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: PRIMARY }}>Tel:</span> {schoolPhone}</div>}
            {schoolEmail && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: PRIMARY }}>Email:</span> {schoolEmail}</div>}
            {schoolWebsite && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: PRIMARY }}>Web:</span> {schoolWebsite}</div>}
            {schoolAddress && <div className="text-[3px] text-gray-500"><span className="font-bold" style={{ color: PRIMARY }}>Addr:</span> {schoolAddress}</div>}
          </div>
        </div>

        {/* Droite : logo + QR avec fond géométrique */}
        <div className="flex flex-col items-center justify-center gap-1 shrink-0"
          style={{ width: '24%', background: `linear-gradient(135deg, ${SECONDARY}22 0%, ${PRIMARY}11 100%)`, borderRadius: '8px' }}>
          <SchoolLogo size="sm" />
          <div className="text-[3px] text-gray-500 text-center leading-tight">{acronym}</div>
          <RealQRCode payload={card.qrPayload} size={56} />
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composant : champ d'information ───

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[3px] font-bold text-gray-400 uppercase leading-tight truncate">{label}</p>
      <p className="text-[4px] leading-tight truncate" style={{ color: TEXT }}>{value}</p>
    </div>
  );
}

export default IdCardVisual;
