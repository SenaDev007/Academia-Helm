'use client';

/**
 * ============================================================================
 * STAMP DESIGNER — Générateur de cachets professionnel (SVG)
 * ============================================================================
 *
 * Génère des cachets/tampons en SVG directement côté frontend :
 *   - Cachet circulaire (rouge tampon) avec :
 *     * Texte circulaire entre 2 cercles (acronyme école + contacts)
 *     * Logo de l'école au centre
 *     * Titre/poste occupé (Directeur, Promoteur, Comptable, etc.)
 *   - Cachet nominatif rectangulaire (nom du directeur + fonction)
 *   - Version tampon cire personnalisé
 *
 * Par niveau scolaire (Maternelle / Primaire / Secondaire) + piste linguistique (FR/EN).
 * Toggle "Même directeur pour Maternelle + Primaire" (réplique automatique).
 *
 * Source des données :
 *   - schoolIdentity (logo, acronyme, nom, contacts) : /api/settings/identity
 *   - schoolDirectors (nom, fonction, signature) : /api/hr/school-directors
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Stamp, Download, Copy, Check, Loader2, AlertCircle, School, Globe, Link2, Link2Off, UserCog, Award, FlaskConical } from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useBilingual } from '@/contexts/BilingualContext';
import apiClient from '@/lib/api/client';
import { cn } from '@/lib/utils';

const STAMP_RED = '#c0392b';
const STAMP_RED_LIGHT = '#e74c3c';
const WAX_RED = '#8b0000';

interface SchoolIdentity {
  schoolName?: string;
  schoolAcronym?: string;
  logoUrl?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  email?: string;
}

interface Director {
  id: string;
  schoolLevelId: string;
  schoolLevelCode?: string;
  schoolLevelName?: string;
  language: string;
  fullName: string;
  functionLabel?: string;
  email?: string;
  phone?: string;
}

interface SchoolLevel {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

type StampRole = 'director' | 'promoter' | 'accountant' | 'secretary';
type StampStyle = 'standard' | 'wax';

const ROLE_LABELS: Record<StampRole, string> = {
  director: 'Directeur',
  promoter: 'Promoteur',
  accountant: 'Comptable',
  secretary: 'Secrétaire',
};

const ROLE_LABELS_FEMININE: Record<StampRole, string> = {
  director: 'La Directrice',
  promoter: 'Le Promoteur',
  accountant: 'Le Comptable',
  secretary: 'Le Secrétaire',
};

export default function StampDesigner() {
  const { tenant } = useAppSession();
  const { isEnabled: isBilingual } = useBilingual();
  const tenantId = tenant?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<SchoolIdentity | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevel[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedLang, setSelectedLang] = useState<string>('FR');
  const [selectedRole, setSelectedRole] = useState<StampRole>('director');
  const [stampStyle, setStampStyle] = useState<StampStyle>('standard');
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [sameMaternellePrimaire, setSameMaternellePrimaire] = useState(false);

  // ─── Load data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [identityRes, directorsRes, levelsRes] = await Promise.all([
        apiClient.get('/settings/identity'),
        apiClient.get('/hr/school-directors'),
        apiClient.get('/school-levels'),
      ]);

      const identityData = identityRes.data || {};
      setIdentity({
        schoolName: identityData.schoolName,
        schoolAcronym: identityData.schoolAcronym,
        logoUrl: identityData.logoUrl,
        phone: identityData.phone || identityData.phonePrimary,
        address: identityData.address,
        city: identityData.city,
        country: identityData.country || 'Bénin',
        email: identityData.email,
      });

      const directorList = Array.isArray(directorsRes.data) ? directorsRes.data : [];
      setDirectors(directorList);

      const levelList = Array.isArray(levelsRes.data)
        ? levelsRes.data.filter((l: any) => l.id !== 'ALL' && l.isActive)
        : [];
      setSchoolLevels(levelList);
      if (levelList.length > 0 && !selectedLevelId) {
        setSelectedLevelId(levelList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Resolve current director ──────────────────────────────────────
  const currentDirector = useMemo(() => {
    return directors.find(
      (d) => d.schoolLevelId === selectedLevelId && d.language === selectedLang
    );
  }, [directors, selectedLevelId, selectedLang]);

  // ─── Resolve promoter info ─────────────────────────────────────────
  //    Le promoteur est le tenant owner — on utilise les infos du tenant
  const promoterInfo = useMemo(() => {
    return {
      fullName: tenant?.name ? `${tenant.name}` : 'Promoteur',
      functionLabel: 'Promoteur de l\'établissement',
    };
  }, [tenant]);

  // ─── Resolve current role person ───────────────────────────────────
  const currentPerson = useMemo(() => {
    if (selectedRole === 'promoter') return promoterInfo;
    if (selectedRole === 'director' && currentDirector) {
      return {
        fullName: currentDirector.fullName,
        functionLabel: currentDirector.functionLabel || 'Directeur',
      };
    }
    // Pour comptable/secrétaire — pas de données dynamiques pour l'instant
    return {
      fullName: ROLE_LABELS[selectedRole],
      functionLabel: ROLE_LABELS[selectedRole],
    };
  }, [selectedRole, currentDirector, promoterInfo]);

  // ─── Current level info ────────────────────────────────────────────
  const currentLevel = useMemo(() => {
    return schoolLevels.find((l) => l.id === selectedLevelId);
  }, [schoolLevels, selectedLevelId]);

  // ─── Toggle same director Maternelle + Primaire ────────────────────
  const hasMaternelleAndPrimaire = useMemo(() => {
    return schoolLevels.some((l) => (l.code || '').toUpperCase().includes('MATERNELLE'))
      && schoolLevels.some((l) => (l.code || '').toUpperCase().includes('PRIMAIRE'));
  }, [schoolLevels]);

  // ─── Available languages ───────────────────────────────────────────
  const languages = isBilingual ? ['FR', 'EN'] : ['FR'];
  const langLabels: Record<string, string> = { FR: 'Francophone', EN: 'Anglophone' };

  // ─── Download SVG ──────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);
  const handleDownload = useCallback(() => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const levelCode = currentLevel?.code || 'global';
    a.download = `cachet-${selectedRole}-${levelCode}-${selectedLang}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedRole, currentLevel, selectedLang]);

  // ─── Copy SVG code ─────────────────────────────────────────────────
  const handleCopySvg = useCallback(() => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    navigator.clipboard.writeText(svgData).then(() => {
      setCopiedSvg(true);
      setTimeout(() => setCopiedSvg(false), 2000);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-slate-600">Chargement des cachets…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <AlertCircle className="w-5 h-5 inline mr-2" />
        {error}
      </div>
    );
  }

  const acronym = identity?.schoolAcronym || identity?.schoolName?.substring(0, 10) || 'ÉCOLE';
  const contactLine = [
    identity?.address,
    identity?.city,
    identity?.phone ? `Tél: ${identity.phone}` : null,
    identity?.country,
  ].filter(Boolean).join(' • ');

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="bg-gradient-to-r from-red-900 to-red-700 rounded-xl px-5 py-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Stamp className="w-5 h-5" />
          Cachets & Tampons officiels
        </h2>
        <p className="text-[11px] text-red-100 mt-0.5">
          Générez des cachets professionnels par niveau scolaire et par rôle
        </p>
      </div>

      {/* ─── Controls ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
        {/* Level selector */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-600 uppercase">Niveau scolaire</label>
          <select
            value={selectedLevelId}
            onChange={(e) => setSelectedLevelId(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
          >
            {schoolLevels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {/* Language selector (if bilingual) */}
        {isBilingual && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold text-slate-600 uppercase">Piste linguistique</label>
            <div className="flex gap-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-bold transition-colors',
                    selectedLang === lang
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {langLabels[lang]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Role selector */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-600 uppercase">Rôle</label>
          <div className="flex gap-2 flex-wrap">
            {(['director', 'promoter', 'accountant', 'secretary'] as StampRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                  selectedRole === role
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {role === 'director' && <School className="w-3 h-3" />}
                {role === 'promoter' && <Award className="w-3 h-3" />}
                {role === 'accountant' && <UserCog className="w-3 h-3" />}
                {role === 'secretary' && <UserCog className="w-3 h-3" />}
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>

        {/* Stamp style selector */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-600 uppercase">Style</label>
          <div className="flex gap-2">
            <button
              onClick={() => setStampStyle('standard')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                stampStyle === 'standard'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <Stamp className="w-3 h-3" /> Standard (encre rouge)
            </button>
            <button
              onClick={() => setStampStyle('wax')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                stampStyle === 'wax'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <FlaskConical className="w-3 h-3" /> Tampon cire
            </button>
          </div>
        </div>

        {/* Toggle same director Maternelle + Primaire */}
        {hasMaternelleAndPrimaire && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setSameMaternellePrimaire(!sameMaternellePrimaire)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                sameMaternellePrimaire
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              )}
            >
              {sameMaternellePrimaire ? <Link2 className="w-3.5 h-3.5" /> : <Link2Off className="w-3.5 h-3.5" />}
              Même directeur pour Maternelle + Primaire
            </button>
            {sameMaternellePrimaire && (
              <span className="text-[10px] text-blue-600">
                Le même cachet sera utilisé pour les deux niveaux
              </span>
            )}
          </div>
        )}
      </div>

      {/* ─── Stamp preview ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-700">Aperçu du cachet</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySvg}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {copiedSvg ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSvg ? 'Copié !' : 'Copier SVG'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              <Download className="w-3.5 h-3.5" /> Télécharger
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          {/* Cachet circulaire */}
          <CircularStamp
            ref={svgRef}
            acronym={acronym}
            contactLine={contactLine}
            personName={currentPerson.fullName}
            personRole={currentPerson.functionLabel || ROLE_LABELS[selectedRole]}
            logoUrl={identity?.logoUrl}
            style={stampStyle}
          />

          {/* Cachet nominatif rectangulaire */}
          <RectangularStamp
            personName={currentPerson.fullName}
            personRole={currentPerson.functionLabel || ROLE_LABELS[selectedRole]}
            schoolName={identity?.schoolName || ''}
            style={stampStyle}
          />

          {/* Person info */}
          <div className="text-center text-xs text-slate-500">
            {selectedRole === 'director' && !currentDirector && (
              <p className="text-amber-600 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Aucun directeur configuré pour ce niveau et cette piste linguistique.
                Configurez-le dans RH &gt; Directeurs.
              </p>
            )}
            {selectedRole === 'director' && currentDirector && (
              <p className="text-emerald-600">
                Directeur configuré : {currentDirector.fullName} ({currentDirector.functionLabel || 'Directeur'})
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Cachet circulaire SVG (rouge tampon)
// ──────────────────────────────────────────────────────────────────────────

import { forwardRef } from 'react';

interface CircularStampProps {
  acronym: string;
  contactLine: string;
  personName: string;
  personRole: string;
  logoUrl?: string;
  style: StampStyle;
}

const CircularStamp = forwardRef<SVGSVGElement, CircularStampProps>(
  ({ acronym, contactLine, personName, personRole, logoUrl, style }, ref) => {
    const SIZE = 300;
    const CENTER = SIZE / 2;
    const OUTER_R = 140;
    const INNER_R = 105;
    const TEXT_R = 122; // rayon du texte circulaire
    const stampColor = style === 'wax' ? WAX_RED : STAMP_RED;

    // Texte circulaire supérieur (acronyme)
    const topText = acronym.toUpperCase();

    // Texte circulaire inférieur (contacts) — on le met en 2 lignes si trop long
    const contactParts = contactLine.split(' • ');
    const bottomLine1 = contactParts.slice(0, 2).join(' • ');
    const bottomLine2 = contactParts.slice(2).join(' • ');

    // Calculer le path arc pour le texte circulaire
    const topArcPath = `M ${CENTER - TEXT_R} ${CENTER} A ${TEXT_R} ${TEXT_R} 0 0 1 ${CENTER + TEXT_R} ${CENTER}`;
    const bottomArcPath = `M ${CENTER - TEXT_R} ${CENTER} A ${TEXT_R} ${TEXT_R} 0 0 0 ${CENTER + TEXT_R} ${CENTER}`;

    return (
      <svg
        ref={ref}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Filtre pour effet "encre/tampon" */}
          <filter id="stamp-texture" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.4 0.1" />
            <feComposite in2="SourceGraphic" operator="in" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode />
            </feMerge>
          </filter>

          {style === 'wax' && (
            <radialGradient id="wax-gradient" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#c41e3a" stopOpacity="0.9" />
              <stop offset="60%" stopColor={WAX_RED} stopOpacity="1" />
              <stop offset="100%" stopColor="#5a0000" stopOpacity="1" />
            </radialGradient>
          )}

          {/* Clip path pour le logo circulaire au centre */}
          <clipPath id="logo-clip">
            <circle cx={CENTER} cy={CENTER} r="35" />
          </clipPath>
        </defs>

        {/* Cercle extérieur */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_R}
          fill="none"
          stroke={style === 'wax' ? 'url(#wax-gradient)' : stampColor}
          strokeWidth="2.5"
          filter={style === 'standard' ? 'url(#stamp-texture)' : undefined}
        />

        {/* Cercle intérieur */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_R}
          fill="none"
          stroke={style === 'wax' ? 'url(#wax-gradient)' : stampColor}
          strokeWidth="1.5"
          filter={style === 'standard' ? 'url(#stamp-texture)' : undefined}
        />

        {style === 'wax' && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R + 3}
            fill="url(#wax-gradient)"
            opacity="0.15"
          />
        )}

        {/* Texte circulaire supérieur (acronyme) */}
        <text
          fill={stampColor}
          fontSize="14"
          fontWeight="bold"
          fontFamily="'Arial', sans-serif"
          letterSpacing="1"
          filter={style === 'standard' ? 'url(#stamp-texture)' : undefined}
        >
          <textPath href={`#${TOP_PATH_ID}`} startOffset="50%" textAnchor="middle">
            {topText}
          </textPath>
        </text>
        <path id={TOP_PATH_ID} d={topArcPath} fill="none" />

        {/* Texte circulaire inférieur (contacts) */}
        <text
          fill={stampColor}
          fontSize="9"
          fontFamily="'Arial', sans-serif"
          filter={style === 'standard' ? 'url(#stamp-texture)' : undefined}
        >
          <textPath href={`#${BOTTOM_PATH_ID_1}`} startOffset="50%" textAnchor="middle">
            {bottomLine1}
          </textPath>
        </text>
        <path id={BOTTOM_PATH_ID_1} d={bottomArcPath} fill="none" />

        {bottomLine2 && (
          <text
            fill={stampColor}
            fontSize="9"
            fontFamily="'Arial', sans-serif"
            filter={style === 'standard' ? 'url(#stamp-texture)' : undefined}
          >
            <textPath href={`#${BOTTOM_PATH_ID_2}`} startOffset="50%" textAnchor="middle">
              {bottomLine2}
            </textPath>
          </text>
        )}
        <path id={BOTTOM_PATH_ID_2} d={`M ${CENTER - TEXT_R + 15} ${CENTER + 8} A ${TEXT_R - 15} ${TEXT_R - 15} 0 0 0 ${CENTER + TEXT_R - 15} ${CENTER + 8}`} fill="none" />

        {/* Logo de l'école au centre */}
        {logoUrl ? (
          <image
            href={logoUrl}
            x={CENTER - 30}
            y={CENTER - 30}
            width="60"
            height="60"
            clipPath="url(#logo-clip)"
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <circle cx={CENTER} cy={CENTER} r="30" fill="none" stroke={stampColor} strokeWidth="1" strokeDasharray="3 3" />
        )}

        {/* Titre/poste occupé en bas du centre */}
        <text
          x={CENTER}
          y={CENTER + 48}
          fill={stampColor}
          fontSize="11"
          fontWeight="bold"
          fontFamily="'Arial', sans-serif"
          textAnchor="middle"
          filter={style === 'standard' ? 'url(#stamp-texture)' : undefined}
        >
          {personRole.toUpperCase()}
        </text>
      </svg>
    );
  }
);
CircularStamp.displayName = 'CircularStamp';

const TOP_PATH_ID = 'stamp-top-arc';
const BOTTOM_PATH_ID_1 = 'stamp-bottom-arc-1';
const BOTTOM_PATH_ID_2 = 'stamp-bottom-arc-2';

// ──────────────────────────────────────────────────────────────────────────
// Cachet nominatif rectangulaire
// ──────────────────────────────────────────────────────────────────────────

interface RectangularStampProps {
  personName: string;
  personRole: string;
  schoolName: string;
  style: StampStyle;
}

function RectangularStamp({ personName, personRole, schoolName, style }: RectangularStampProps) {
  const W = 300;
  const H = 100;
  const stampColor = style === 'wax' ? WAX_RED : STAMP_RED;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="rect-stamp-texture" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.4 0.1" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode />
          </feMerge>
        </filter>
      </defs>

      {/* Bordure rectangulaire */}
      <rect
        x="5"
        y="5"
        width={W - 10}
        height={H - 10}
        rx="6"
        fill="none"
        stroke={stampColor}
        strokeWidth="2"
        filter={style === 'standard' ? 'url(#rect-stamp-texture)' : undefined}
      />

      {/* Bordure intérieure */}
      <rect
        x="10"
        y="10"
        width={W - 20}
        height={H - 20}
        rx="4"
        fill="none"
        stroke={stampColor}
        strokeWidth="1"
        filter={style === 'standard' ? 'url(#rect-stamp-texture)' : undefined}
      />

      {/* Nom de l'école en haut */}
      <text
        x={W / 2}
        y="25"
        fill={stampColor}
        fontSize="10"
        fontWeight="bold"
        fontFamily="'Arial', sans-serif"
        textAnchor="middle"
        filter={style === 'standard' ? 'url(#rect-stamp-texture)' : undefined}
      >
        {schoolName.toUpperCase().substring(0, 40)}
      </text>

      {/* Ligne de séparation */}
      <line
        x1="30"
        y1="35"
        x2={W - 30}
        y2="35"
        stroke={stampColor}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        filter={style === 'standard' ? 'url(#rect-stamp-texture)' : undefined}
      />

      {/* Nom de la personne (grand) */}
      <text
        x={W / 2}
        y="58"
        fill={stampColor}
        fontSize="18"
        fontWeight="bold"
        fontFamily="'Arial', sans-serif"
        textAnchor="middle"
        filter={style === 'standard' ? 'url(#rect-stamp-texture)' : undefined}
      >
        {personName.toUpperCase()}
      </text>

      {/* Fonction */}
      <text
        x={W / 2}
        y="78"
        fill={stampColor}
        fontSize="12"
        fontFamily="'Arial', sans-serif"
        textAnchor="middle"
        filter={style === 'standard' ? 'url(#rect-stamp-texture)' : undefined}
      >
        {personRole}
      </text>
    </svg>
  );
}
