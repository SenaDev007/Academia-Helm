'use client';

/**
 * ============================================================================
 * ID CARD VISUAL — Composant partagé de carte scolaire (recto + verso)
 * ============================================================================
 *
 * Design premium conforme au prompt fourni :
 *   - CR80 paysage (85.60 × 53.98 mm)
 *   - Gradient bleu #007BFF → #003087
 *   - Coins arrondis 20px (scaled down)
 *   - Formes diagonales (clip-path) en-tête et pied
 *   - 9 champs d'information (Reg No, Student ID, Student Name, Gender,
 *     Date of Birth, Class, Blood Group, Parent/Guardian, Emergency Contact)
 *   - Logo + slogan à gauche de l'en-tête
 *   - QR code sur le verso
 *
 * Utilisé dans :
 *   - StudentIdCardsSection.tsx (onglet Cartes Scolaires)
 *   - StudentIdentityContent.tsx (onglet Dossier → carte scolaire)
 * ============================================================================
 */

import { cn } from '@/lib/utils';

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
const ACCENT = '#00AEEF';
const TEXT = '#1F2937';
const LIGHT_GRAY = '#E5E7EB';

function formatDate(d?: string) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

  const schoolName = identity?.schoolName || 'Academia Helm';
  const slogan = identity?.slogan || 'Excellence • Discipline • Travail';
  const schoolAddress = [identity?.address, identity?.city].filter(Boolean).join(', ') || '';
  const schoolPhone = identity?.phonePrimary || '';
  const schoolEmail = identity?.email || '';
  const schoolWebsite = identity?.website || '';
  const logoUrl = identity?.logoUrl || '';

  const guardianName = g ? `${g.firstName} ${g.lastName}`.trim() : '—';
  const guardianPhone = g?.phone || '—';

  const isMaternelle = (card.levelCode || '').toUpperCase() === 'MATERNELLE' || (card.levelCode || '').toUpperCase() === 'MAT';
  const isSecondaire = (card.levelCode || '').toUpperCase() === 'SECONDAIRE' || (card.levelCode || '').toUpperCase() === 'SECONDARY' || (card.levelCode || '').toUpperCase() === 'SECOND';

  // Ministère selon le niveau
  const ministry = isSecondaire
    ? "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle"
    : 'Ministère des Enseignements Maternel et Primaire';

  const pickupMorning = identity?.maternellePickupMorning || '12:00';
  const pickupAfternoon = identity?.maternellePickupAfternoon || '16:30';
  const singleExit = identity?.maternelleSingleExit;
  const singleExitTime = identity?.maternelleSingleExitTime || '15:30';

  const LogoBox = ({ size = 'normal' }: { size?: 'normal' | 'small' }) => {
    const cls = size === 'small' ? 'w-7 h-7' : 'w-8 h-8';
    if (logoUrl) return <img src={logoUrl} alt="Logo" className={cn(cls, 'rounded-lg object-contain bg-white p-0.5')} />;
    return (
      <div className={cn(cls, 'rounded-lg bg-white flex items-center justify-center font-bold')}
        style={{ color: PRIMARY, fontSize: size === 'small' ? '8px' : '10px' }}>AH</div>
    );
  };

  // Drapeau du Bénin (vert, jaune, rouge horizontal)
  const BeninFlag = ({ size = 'sm' }: { size?: 'sm' | 'xs' }) => {
    const cls = size === 'xs' ? 'w-4 h-3' : 'w-5 h-4';
    return (
      <div className={cn(cls, 'rounded-sm overflow-hidden border border-gray-200 shrink-0')}>
        <div className="flex h-full">
          <div className="w-1/2 h-full bg-green-600" />
          <div className="w-1/2 flex flex-col">
            <div className="h-1/2 bg-yellow-400" />
            <div className="h-1/2 bg-red-600" />
          </div>
        </div>
      </div>
    );
  };

  // ─── RECTO ───
  if (face === 'recto') {
    return (
      <div className="w-full bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-200 flex flex-col"
        style={{ aspectRatio: '85.6 / 53.98', fontFamily: 'Inter, Poppins, sans-serif' }}>

        {/* ─── EN-TÊTE (24% hauteur) — République du Bénin + Ministère + logo école ─── */}
        <div className="relative shrink-0" style={{ height: '24%' }}>
          {/* Section gauche blanche : drapeau + République du Bénin + Ministère */}
          <div className="absolute left-0 top-0 h-full flex items-center gap-1 px-1.5 z-10"
            style={{ width: '55%', background: 'white' }}>
            <BeninFlag size="xs" />
            <div className="min-w-0 flex-1">
              <div className="text-[5px] font-bold text-gray-800 leading-tight">RÉPUBLIQUE DU BÉNIN</div>
              <div className="text-[3px] text-gray-500 leading-tight truncate">{ministry}</div>
              <div className="text-[4px] font-semibold text-gray-700 leading-tight truncate" style={{ color: PRIMARY }}>{schoolName}</div>
            </div>
          </div>
          {/* Section droite gradient avec clip diagonal : logo école + Student ID */}
          <div className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${SECONDARY} 0%, ${PRIMARY} 100%)`,
              clipPath: 'polygon(52% 0, 100% 0, 100% 100%, 0 100%)',
            }}>
            <div className="flex items-center justify-center h-full pl-[55%] pr-2 gap-1.5 text-white">
              <LogoBox size="normal" />
              <div className="text-center">
                <div className="font-bold text-[6px] uppercase tracking-wider leading-tight">Student ID</div>
                <div className="text-[3px] opacity-80 leading-tight">Carte Scolaire</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CORPS (60% hauteur) — photo gauche 30% + infos droite 70% ─── */}
        <div className="flex flex-1 min-h-0 px-2 py-1.5 gap-2">
          {/* Colonne gauche : photo + QR */}
          <div className="flex flex-col items-center justify-center gap-1 shrink-0" style={{ width: '28%' }}>
            <div className="w-full rounded-lg overflow-hidden border-2"
              style={{ borderColor: SECONDARY, aspectRatio: '1', background: '#f3f4f6', maxWidth: '50px' }}>
              {s.photoUrl
                ? <img src={s.photoUrl} alt={`${s.firstName} ${s.lastName}`} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[5px] text-gray-400">PHOTO</div>}
            </div>
            {/* QR code mini */}
            <div className="w-6 h-6 border border-gray-200 rounded bg-white p-px">
              <div className="grid grid-cols-5 grid-rows-5 gap-px w-full h-full">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div key={i} className={cn(((i * 7 + 3) % 5 < 3) ? 'bg-black' : 'bg-white')} />
                ))}
              </div>
            </div>
          </div>

          {/* Colonne droite : 9 champs en 2 colonnes */}
          <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-0.5 min-w-0">
            <InfoField label="Reg No" value={s.matricule || s.studentCode || '—'} />
            <InfoField label="Student ID" value={card.cardNumber} />
            <InfoField label="Student Name" value={`${s.firstName} ${s.lastName}`} />
            <InfoField label="Gender" value={s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—'} />
            <InfoField label="Date of Birth" value={formatDate(s.dateOfBirth)} />
            <InfoField label="Class" value={card.className || '—'} />
            <InfoField label="Blood Group" value="—" />
            <InfoField label="Parent / Guardian" value={guardianName} />
            <InfoField label="Emergency Contact" value={guardianPhone} />
          </div>
        </div>

        {/* ─── PIED (18% hauteur) — gradient diagonal ─── */}
        <div className="relative shrink-0" style={{ height: '18%' }}>
          <div className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`,
              clipPath: 'polygon(0 0, 100% 0, 100% 100%, 5% 100%)',
            }}>
            <div className="flex items-center justify-between h-full px-3 text-white">
              <div className="min-w-0">
                <p className="text-[3px] opacity-90 truncate">{schoolAddress || '—'}</p>
                <p className="text-[3px] opacity-90 truncate">{schoolPhone}{schoolEmail && ` · ${schoolEmail}`}</p>
              </div>
              <div className="text-right shrink-0 ml-2">
                <p className="text-[4px] italic opacity-90" style={{ fontFamily: 'Brush Script MT, cursive' }}>Principal</p>
                <p className="text-[3px] opacity-70">Signature</p>
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

      {/* Corps : rules à gauche + contact + QR à droite */}
      <div className="flex flex-1 min-h-0 px-2.5 py-1.5 gap-2">
        {/* Gauche : rules + contact */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Rules avec puces bleues carrées */}
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
          <LogoBox size="small" />
          <div className="text-[3px] text-gray-500 text-center leading-tight">{slogan}</div>
          <div className="w-7 h-7 border border-gray-200 rounded bg-white p-px">
            <div className="grid grid-cols-6 grid-rows-6 gap-px w-full h-full">
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className={cn(((i * 7 + 3) % 5 < 3) ? 'bg-black' : 'bg-white')} />
              ))}
            </div>
          </div>
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
      <p className="text-[4px] text-gray-700 leading-tight truncate" style={{ color: TEXT }}>{value}</p>
    </div>
  );
}

export default IdCardVisual;
