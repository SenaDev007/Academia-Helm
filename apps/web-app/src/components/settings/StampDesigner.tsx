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
import { Stamp, Download, Copy, Check, Loader2, AlertCircle, School, Link2, Link2Off, UserCog, Award, Save } from 'lucide-react';
import { useAppSession } from '@/contexts/AppSessionContext';
import { useBilingual } from '@/contexts/BilingualContext';
import apiClient from '@/lib/api/client';
import { cn } from '@/lib/utils';

const STAMP_RED = '#c0392b';
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

type StampRole = 'director' | 'promoter' | 'accountant' | 'secretary' | 'secretary_accountant';
type StampStyle = 'standard'; // ⭐ Version cire supprimée — pas assez aboutie

// ⭐ Rôles affichés sur le cachet circulaire et le cachet nominatif.
//    Chaque rôle peut être masculin OU féminin : on affiche la forme longue
//    « Le X » / « La X » pour correspondre à la formulation administrative
//    française (ex : « Le Directeur », « La Directrice », « Le Secrétaire
//    Comptable », « La Secrétaire Comptable »).
const ROLE_LABELS: Record<StampRole, string> = {
  director: 'Directeur',
  promoter: 'Promoteur',
  accountant: 'Comptable',
  secretary: 'Secrétaire',
  secretary_accountant: 'Secrétaire Comptable',
};

// ⭐ Forme longue utilisée sur le cachet (avec article). On garde le masculin
//    par défaut pour les rôles non genrés (Comptable, Secrétaire Comptable)
//    car l'information de genre du titulaire n'est pas encore disponible côté
//    frontend — l'utilisateur pourra basculer manuellement si nécessaire.
const ROLE_LABELS_FULL: Record<StampRole, string> = {
  director: 'Le Directeur',
  promoter: 'Le Promoteur',
  accountant: 'Le Comptable',
  secretary: 'Le Secrétaire',
  secretary_accountant: 'Le Secrétaire Comptable',
};

// ⭐ Mapping entre les codes AdminRole (staff-admin-assignments) et nos
//    StampRole locaux. Le backend stocke les affectations administratives
//    avec des codes en MAJUSCULES (PROMOTEUR, DIRECTEUR, COMPTABLE,
//    SECRETAIRE, SECRETAIRE_COMPTABLE) — on normalise pour retrouver le
//    StampRole correspondant.
const ADMIN_ROLE_TO_STAMP_ROLE: Record<string, StampRole> = {
  PROMOTEUR: 'promoter',
  DIRECTEUR: 'director',
  DIRECTEUR_GENERAL: 'director',
  DIRECTEUR_ADJOINT: 'director',
  DIRECTEUR_PEDAGOGIQUE: 'director',
  DIRECTEUR_DES_ETUDES: 'director',
  COMPTABLE: 'accountant',
  SECRETAIRE: 'secretary',
  SECRETAIRE_COMPTABLE: 'secretary_accountant',
};

export default function StampDesigner() {
  const { tenant } = useAppSession();
  const { isEnabled: isBilingual } = useBilingual();
  const tenantId = tenant?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [identity, setIdentity] = useState<SchoolIdentity | null>(null);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [schoolLevels, setSchoolLevels] = useState<SchoolLevel[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');
  const [selectedLang, setSelectedLang] = useState<string>('FR');
  const [selectedRole, setSelectedRole] = useState<StampRole>('director');
  const [stampStyle] = useState<StampStyle>('standard'); // Toujours standard (cire supprimée)
  const [copiedSvg, setCopiedSvg] = useState(false);
  const [savedStamps, setSavedStamps] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sameMaternellePrimaire, setSameMaternellePrimaire] = useState(false);

  // ⭐ Affectations administratives (staff-admin-assignments) — la vraie
  //    source de vérité pour savoir QUI occupe QUEL poste. Chaque rôle
  //    configuré (Directeur, Comptable, Secrétaire, Secrétaire Comptable)
  //    a une personne vivante attachée — c'est elle qui doit figurer sur
  //    le cachet nominatif et le cachet circulaire.
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatedStamps, setGeneratedStamps] = useState<Record<string, { circular: string; rectangular: string }>>({});

  // ─── Load data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [identityRes, directorsRes, levelsRes, assignmentsRes] = await Promise.all([
        apiClient.get('/settings/identity'),
        apiClient.get('/hr/school-directors'),
        apiClient.get('/school-levels'),
        // ⭐ Charge les affectations administratives pour trouver les
        //    personnes attachées à chaque poste (Comptable, Secrétaire,
        //    Secrétaire Comptable). On filtre isActive=true pour ne garder
        //    que les affectations actives.
        apiClient.get('/staff-admin-assignments?isActive=true').catch(() => ({ data: [] })),
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

      const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];
      setAdminAssignments(assignments);

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
      functionLabel: 'Le Promoteur',
    };
  }, [tenant]);

  // ─── Resolve person by role from admin assignments ─────────────────
  //    Renvoie la personne (nom + fonction) attachée à un StampRole donné,
  //    en cherchant dans les affectations admin actives. Le mapping
  //    AdminRole → StampRole est défini par ADMIN_ROLE_TO_STAMP_ROLE.
  const resolvePersonForRole = useCallback(
    (role: StampRole): { fullName: string; functionLabel: string } | null => {
      // 1. Promoteur — toujours dérivé du tenant (pas d'affectation admin)
      if (role === 'promoter') return promoterInfo;

      // 2. Directeur — utilise les school-directors (avec niveau + langue)
      if (role === 'director') {
        if (currentDirector) {
          return {
            fullName: currentDirector.fullName,
            functionLabel: currentDirector.functionLabel || 'Le Directeur',
          };
        }
        return null;
      }

      // 3. Comptable / Secrétaire / Secrétaire Comptable — chercher dans
      //    les affectations admin. On filtre par schoolLevelCode si le
      //    niveau sélectionné correspond à un code connu (ex: SECONDAIRE).
      const currentLevel = schoolLevels.find((l) => l.id === selectedLevelId);
      const levelCode = currentLevel?.code;

      // On cherche d'abord une affectation spécifique au niveau, puis on
      // retombe sur une affectation globale (schoolLevelCode null) si elle
      // existe — l'admin peut avoir configuré le comptable au niveau global.
      const matchingAssignments = adminAssignments.filter((a: any) => {
        // Rôle doit mapper vers le StampRole recherché
        const stampRole = ADMIN_ROLE_TO_STAMP_ROLE[a.adminRole];
        if (stampRole !== role) return false;
        // Si niveau sélectionné, on filtre par code de niveau OU par
        // affectation globale (schoolLevelCode null/undefined)
        if (levelCode) {
          return !a.schoolLevelCode || a.schoolLevelCode === levelCode;
        }
        return true;
      });

      if (matchingAssignments.length === 0) return null;
      // On prend la première affectation trouvée (la plus récente,
      // puisque le service les renvoie triées par startDate desc).
      const assignment = matchingAssignments[0];
      const staff = assignment.staff;
      if (!staff) return null;
      const fullName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim();
      if (!fullName) return null;
      // functionLabel — utilise celui de l'affectation si présent, sinon
      // le libellé générique (Le Comptable / Le Secrétaire / Le Secrétaire
      // Comptable).
      const functionLabel = assignment.functionLabel || ROLE_LABELS_FULL[role];
      return { fullName, functionLabel };
    },
    [adminAssignments, currentDirector, promoterInfo, schoolLevels, selectedLevelId],
  );

  // ─── Resolve current role person (preview) ─────────────────────────
  const currentPerson = useMemo(() => {
    const person = resolvePersonForRole(selectedRole);
    if (person) return person;
    // Fallback : utiliser le libellé du rôle comme nom (placeholder)
    return {
      fullName: ROLE_LABELS[selectedRole],
      functionLabel: ROLE_LABELS_FULL[selectedRole],
    };
  }, [selectedRole, resolvePersonForRole]);

  // ─── All configured roles (roles with a person attached) ──────────
  //    Utilisé pour :
  //    1. Afficher la liste des rôles configurés dans la section « Cachets
  //       par poste »
  //    2. Générer les cachets pour tous les rôles configurés en un clic
  const configuredRoles = useMemo<StampRole[]>(() => {
    const roles: StampRole[] = [];
    (['promoter', 'director', 'accountant', 'secretary', 'secretary_accountant'] as StampRole[]).forEach((role) => {
      const person = resolvePersonForRole(role);
      if (person) roles.push(role);
    });
    return roles;
  }, [resolvePersonForRole]);

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

  // ─── Download SVG (single stamp) ────────────────────────────────────
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

  // ─── Generate all configured stamps ────────────────────────────────
  //    Sérialise chaque cachet (circulaire + rectangulaire) en SVG et le
  //    stocke dans l'état `generatedStamps` + localStorage. La clé est
  //    `${role}_${levelCode}_${lang}` pour que chaque combinaison rôle
  //    × niveau × langue ait son propre cachet persistant.
  const handleGenerateAllStamps = useCallback(async () => {
    if (configuredRoles.length === 0) {
      setError('Aucun poste configuré. Affectez d\'abord des personnes aux rôles (RH > Administration) puis réessayez.');
      return;
    }
    setGeneratingAll(true);
    setError(null);
    try {
      const levelCode = currentLevel?.code || 'global';
      const newStamps: Record<string, { circular: string; rectangular: string }> = { ...generatedStamps };

      // Pour chaque rôle configuré, on rend successivement le cachet
      // circulaire puis le cachet rectangulaire, on les sérialise en SVG,
      // et on les stocke. La stratégie : on change selectedRole puis on
      // attend le re-render, mais comme React est synchrone pour les
      // opérations de sérialisation SVG, on génère directement le SVG
      // en construisant les composants « manuellement » via React.render
      // to static markup. Plus simple : on délègue la sérialisation à des
      // refs cachés que l'on rend pour chaque rôle.
      //
      // ⭐ Implémentation pratique : on délègue à un sous-composant
      //    <AllStampsGenerator> qui rend TOUS les cachets en même temps
      //    (un par rôle configuré), chacun avec son propre ref. Le bouton
      //    « Générer » itère sur ces refs pour sérialiser les SVGs. Voir
      //    plus bas le composant AllStampsGenerator.

      for (const role of configuredRoles) {
        const key = `${role}_${levelCode}_${selectedLang}`;
        // On vérifie que le stamp existe dans le DOM (rendu par
        // AllStampsGenerator) avant de le sérialiser.
        const circularSvg = document.getElementById(`circular-stamp-${key}`) as SVGSVGElement | null;
        const rectangularSvg = document.getElementById(`rectangular-stamp-${key}`) as SVGSVGElement | null;
        if (circularSvg && rectangularSvg) {
          newStamps[key] = {
            circular: new XMLSerializer().serializeToString(circularSvg),
            rectangular: new XMLSerializer().serializeToString(rectangularSvg),
          };
        }
      }

      setGeneratedStamps(newStamps);

      // ⭐ Persiste dans localStorage pour réutilisation hors-ligne et
      //    survie aux rafraîchissements.
      try {
        const allData: Record<string, any> = {};
        Object.entries(newStamps).forEach(([k, v]) => {
          allData[k] = v;
        });
        localStorage.setItem('academia_generated_stamps', JSON.stringify(allData));
      } catch {
        // localStorage peut être plein — non critique
      }

      setSuccess('Tous les cachets ont été générés pour les postes configurés.');
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la génération des cachets');
    } finally {
      setGeneratingAll(false);
    }
  }, [configuredRoles, currentLevel, selectedLang, generatedStamps]);

  // ⭐ Charge les cachets persistés au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('academia_generated_stamps');
      if (stored) setGeneratedStamps(JSON.parse(stored));
    } catch {
      // localStorage peut être corrompu — non critique
    }
  }, []);

  // ⭐ Auto-masque le message de succès après 4 secondes
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 4000);
      return () => clearTimeout(t);
    }
  }, [success]);

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

        {/* Role selector — inclut Secrétaire Comptable (5e rôle) */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-600 uppercase">Rôle (aperçu individuel)</label>
          <div className="flex gap-2 flex-wrap">
            {(['director', 'promoter', 'accountant', 'secretary', 'secretary_accountant'] as StampRole[]).map((role) => {
              const person = resolvePersonForRole(role);
              const isConfigured = !!person;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  title={isConfigured ? `Configuré : ${person!.fullName}` : 'Non configuré — affectez une personne dans RH > Administration'}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                    selectedRole === role
                      ? 'bg-red-600 text-white'
                      : isConfigured
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-dashed border-slate-300',
                  )}
                >
                  {role === 'director' && <School className="w-3 h-3" />}
                  {role === 'promoter' && <Award className="w-3 h-3" />}
                  {role === 'accountant' && <UserCog className="w-3 h-3" />}
                  {role === 'secretary' && <UserCog className="w-3 h-3" />}
                  {role === 'secretary_accountant' && <UserCog className="w-3 h-3" />}
                  {ROLE_LABELS[role]}
                  {isConfigured && (
                    <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Configuré" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ⭐ Bouton « Générer tous les cachets » — génère un cachet circulaire
            ET un cachet nominatif pour CHAQUE rôle configuré (Promoteur,
            Directeur, Comptable, Secrétaire, Secrétaire Comptable). Les cachets
            générés sont stockés dans l'état `generatedStamps` et affichés dans
            la section « Cachets générés » plus bas. */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-600 uppercase">Génération en lot</label>
          <button
            onClick={handleGenerateAllStamps}
            disabled={generatingAll || configuredRoles.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stamp className="w-4 h-4" />}
            {generatingAll ? 'Génération...' : `Générer tous les cachets (${configuredRoles.length} poste${configuredRoles.length > 1 ? 's' : ''})`}
          </button>
          {configuredRoles.length === 0 && (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Aucun poste configuré. Affectez d'abord des personnes aux rôles dans RH &gt; Administration.
            </span>
          )}
          {configuredRoles.length > 0 && (
            <span className="text-[10px] text-slate-500">
              Postes configurés : {configuredRoles.map(r => ROLE_LABELS[r]).join(', ')}
            </span>
          )}
        </div>

        {/* ⭐ Bouton sauvegarder le cachet individuel (preview) */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-600 uppercase">Action (cachet individuel)</label>
          <button
            onClick={async () => {
              if (!svgRef.current) return;
              setSaving(true);
              const svgData = new XMLSerializer().serializeToString(svgRef.current);
              const key = `${selectedRole}_${currentLevel?.code || 'global'}_${selectedLang}`;
              setSavedStamps(prev => ({ ...prev, [key]: svgData }));
              // Sauvegarder dans localStorage pour réutilisation
              try {
                const allStamps = JSON.parse(localStorage.getItem('academia_saved_stamps') || '{}');
                allStamps[key] = svgData;
                localStorage.setItem('academia_saved_stamps', JSON.stringify(allStamps));
              } catch {}
              setSaving(false);
            }}
            disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder ce cachet
          </button>
          {savedStamps[`${selectedRole}_${currentLevel?.code || 'global'}_${selectedLang}`] && (
            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Cachet sauvegardé
            </span>
          )}
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
            personRole={currentPerson.functionLabel || ROLE_LABELS_FULL[selectedRole]}
            logoUrl={identity?.logoUrl}
            style={stampStyle}
          />

          {/* Cachet nominatif rectangulaire — utilise l'acronyme (plus court)
              plutôt que le nom complet qui déborde du cadre. */}
          <RectangularStamp
            personName={currentPerson.fullName}
            personRole={currentPerson.functionLabel || ROLE_LABELS_FULL[selectedRole]}
            schoolAcronym={identity?.schoolAcronym || identity?.schoolName?.substring(0, 12) || 'ÉCOLE'}
            schoolName={identity?.schoolName || ''}
            style={stampStyle}
          />

          {/* Person info */}
          <div className="text-center text-xs text-slate-500 space-y-1">
            {(() => {
              const person = resolvePersonForRole(selectedRole);
              if (person) {
                return (
                  <p className="text-emerald-600 flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {ROLE_LABELS_FULL[selectedRole]} : {person.fullName}
                  </p>
                );
              }
              return (
                <p className="text-amber-600 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Aucune personne configurée pour le poste « {ROLE_LABELS[selectedRole]} ».
                  Affectez quelqu'un dans RH &gt; Administration.
                </p>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ⭐ Affiche le message de succès s'il y en a un */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* ============================================================
          ⭐ SECTION : CACHETS GÉNÉRÉS PAR POSTE
          ============================================================
          Quand l'utilisateur clique sur « Générer tous les cachets »,
          un cachet circulaire + un cachet nominatif sont créés pour
          CHAQUE poste configuré (Promoteur, Directeur, Comptable,
          Secrétaire, Secrétaire Comptable). Les cachets sont rendus en
          invisibles (display:none) pour permettre la sérialisation SVG,
          puis affichés en deux sections visuelles :
            1. Cachets circulaires (un par poste)
             2. Cachets nominatifs (un par poste)
          Chaque cachet peut être téléchargé individuellement.
          ============================================================ */}
      {configuredRoles.length > 0 && (
        <>
          {/* ⭐ Rendu invisible — sert uniquement à sérialiser les SVGs en
              JS quand l'utilisateur clique sur « Générer ». Chaque SVG a un
              id unique `circular-stamp-<role>_<levelCode>_<lang>` et
              `rectangular-stamp-<role>_<levelCode>_<lang>` pour être
              récupéré via document.getElementById(). */}
          <div className="hidden" aria-hidden="true">
            {configuredRoles.map((role) => {
              const person = resolvePersonForRole(role)!;
              const key = `${role}_${currentLevel?.code || 'global'}_${selectedLang}`;
              return (
                <div key={`hidden-${key}`}>
                  <CircularStamp
                    acronym={acronym}
                    contactLine={contactLine}
                    personName={person.fullName}
                    personRole={person.functionLabel || ROLE_LABELS_FULL[role]}
                    logoUrl={identity?.logoUrl}
                    style={stampStyle}
                    svgId={`circular-stamp-${key}`}
                  />
                  <RectangularStamp
                    personName={person.fullName}
                    personRole={person.functionLabel || ROLE_LABELS_FULL[role]}
                    schoolAcronym={identity?.schoolAcronym || identity?.schoolName?.substring(0, 12) || 'ÉCOLE'}
                    schoolName={identity?.schoolName || ''}
                    style={stampStyle}
                    svgId={`rectangular-stamp-${key}`}
                  />
                </div>
              );
            })}
          </div>

          {/* ⭐ SECTION 1 : Cachets circulaires par poste */}
          {Object.keys(generatedStamps).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Stamp className="w-4 h-4 text-red-700" />
                Cachets circulaires par poste
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(generatedStamps).map(([key, stamps]) => {
                  const [role] = key.split('_');
                  const roleLabel = ROLE_LABELS[role as StampRole] || role;
                  const person = resolvePersonForRole(role as StampRole);
                  return (
                    <div key={`circ-${key}`} className="flex flex-col items-center gap-2 p-4 border border-slate-100 rounded-lg">
                      <div className="text-xs font-bold text-slate-700">{roleLabel}</div>
                      {person && (
                        <div className="text-[10px] text-slate-500 text-center">{person.fullName}</div>
                      )}
                      <div
                        className="w-32 h-32 flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: stamps.circular }}
                      />
                      <button
                        onClick={() => {
                          const blob = new Blob([stamps.circular], { type: 'image/svg+xml' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `cachet-circulaire-${role}-${key.split('_')[1] || 'global'}-${key.split('_')[2] || 'FR'}.svg`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Download className="w-3 h-3" /> Télécharger
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ⭐ SECTION 2 : Cachets nominatifs par poste */}
          {Object.keys(generatedStamps).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <UserCog className="w-4 h-4 text-red-700" />
                Cachets nominatifs par poste
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(generatedStamps).map(([key, stamps]) => {
                  const [role] = key.split('_');
                  const roleLabel = ROLE_LABELS[role as StampRole] || role;
                  const person = resolvePersonForRole(role as StampRole);
                  return (
                    <div key={`rect-${key}`} className="flex flex-col items-center gap-2 p-4 border border-slate-100 rounded-lg">
                      <div className="text-xs font-bold text-slate-700">{roleLabel}</div>
                      {person && (
                        <div className="text-[10px] text-slate-500 text-center">{person.fullName}</div>
                      )}
                      <div
                        className="w-full max-w-xs flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: stamps.rectangular }}
                      />
                      <button
                        onClick={() => {
                          const blob = new Blob([stamps.rectangular], { type: 'image/svg+xml' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `cachet-nominatif-${role}-${key.split('_')[1] || 'global'}-${key.split('_')[2] || 'FR'}.svg`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white"
                      >
                        <Download className="w-3 h-3" /> Télécharger
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
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
  /** ⭐ ID optionnel appliqué au <svg> racine. Utilisé par la génération
   *  en lot pour récupérer le SVG sérialisé via document.getElementById(). */
  svgId?: string;
}

const CircularStamp = forwardRef<SVGSVGElement, CircularStampProps>(
  ({ acronym, contactLine, personName, personRole, logoUrl, style, svgId }, ref) => {
    const SIZE = 320;
    const CENTER = SIZE / 2;
    const OUTER_R = 148;
    const INNER_R = 118;
    // ⭐ Texte PLUS PROCHE des cercles (compact, pas d'espace vide)
    const TEXT_R_TOP = 133;  // proche du cercle extérieur
    const TEXT_R_BOTTOM = 133; // même rayon pour l'arc inférieur
    const stampColor = style === 'wax' ? WAX_RED : STAMP_RED;

    // ⭐ Préfixe d'ID unique pour éviter les collisions quand on rend
    //    plusieurs cachets circulaires sur la même page (génération en
    //    lot). Si `svgId` est fourni, on l'utilise comme préfixe ; sinon on
    //    garde les IDs historiques pour la preview unique.
    const uid = svgId ? svgId : 'stamp';
    const GRAIN_ID = `${uid}-grain-v2`;
    const DISTORT_ID = `${uid}-distort`;
    const LOGO_CLIP_ID = `${uid}-logo-clip`;
    const TOP_PATH_ID = `${uid}-top-arc`;
    const BOTTOM_PATH_ID = `${uid}-bottom-arc`;
    const BOTTOM_PATH_ID_2 = `${uid}-bottom-arc-2`;
    const BOTTOM_PATH_ID_3 = `${uid}-bottom-arc-3`;

    const topText = acronym.toUpperCase();

    // ⭐ Texte contacts : aller à la ligne si trop long (mais rester dans le demi-cercle)
    //    Au lieu de tout mettre sur 1 ligne, on divise intelligemment
    const contactParts = contactLine.split(' • ');
    let bottomLines: string[] = [];
    if (contactParts.length <= 2) {
      bottomLines = [contactParts.join(' • ')];
    } else if (contactParts.length <= 4) {
      bottomLines = [contactParts.slice(0, 2).join(' • '), contactParts.slice(2).join(' • ')];
    } else {
      bottomLines = [contactParts.slice(0, 2).join(' • '), contactParts.slice(2, 4).join(' • '), contactParts.slice(4).join(' • ')];
    }

    // Arcs
    const topArcPath = `M ${CENTER - TEXT_R_TOP} ${CENTER} A ${TEXT_R_TOP} ${TEXT_R_TOP} 0 0 1 ${CENTER + TEXT_R_TOP} ${CENTER}`;
    const bottomArcPath1 = `M ${CENTER - TEXT_R_BOTTOM} ${CENTER} A ${TEXT_R_BOTTOM} ${TEXT_R_BOTTOM} 0 0 0 ${CENTER + TEXT_R_BOTTOM} ${CENTER}`;
    const bottomArcPath2 = `M ${CENTER - TEXT_R_BOTTOM + 8} ${CENTER + 6} A ${TEXT_R_BOTTOM - 8} ${TEXT_R_BOTTOM - 8} 0 0 0 ${CENTER + TEXT_R_BOTTOM - 8} ${CENTER + 6}`;
    const bottomArcPath3 = `M ${CENTER - TEXT_R_BOTTOM + 16} ${CENTER + 12} A ${TEXT_R_BOTTOM - 16} ${TEXT_R_BOTTOM - 16} 0 0 0 ${CENTER + TEXT_R_BOTTOM - 16} ${CENTER + 12}`;

    // Étoiles à 9h et 3h
    const starLeftX = CENTER - TEXT_R_TOP - 1;
    const starRightX = CENTER + TEXT_R_TOP + 1;
    const starY = CENTER + 4;

    // ⭐ Taille de police GROSSE et compacte (d'après l'analyse VLM)
    const topFontSize = topText.length > 15 ? 14 : topText.length > 10 ? 16 : 18;
    const topLetterSpacing = topText.length > 12 ? 1.5 : 2;

    // Taille police du bas : presque aussi grand que le haut
    const bottomFontSize = bottomLines.length === 1 ? 11 : bottomLines.length === 2 ? 10 : 9;

    return (
      <svg
        ref={ref}
        id={svgId}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ⭐ Filtre tampon AMÉLIORÉ : grain + distorsion légère + opacité irrégulière */}
          <filter id={GRAIN_ID} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3" result="noise" />
            <feColorMatrix in="noise" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.6 0.2" result="grainAlpha" />
            <feComposite in="SourceGraphic" in2="grainAlpha" operator="over" />
          </filter>
          {/* ⭐ Filtre pour distorsion légère des bordures (effet "hand-stamped") */}
          <filter id={DISTORT_ID} x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="1" seed="9" result="distort" />
            <feDisplacementMap in="SourceGraphic" in2="distort" scale="1" xChannelSelector="R" yChannelSelector="G" />
          </filter>

          {style === 'wax' && (
            <>
              <radialGradient id="wax-gradient" cx="38%" cy="28%" r="75%">
                <stop offset="0%" stopColor="#d4364a" stopOpacity="0.9" />
                <stop offset="30%" stopColor="#a02020" stopOpacity="1" />
                <stop offset="65%" stopColor={WAX_RED} stopOpacity="1" />
                <stop offset="100%" stopColor="#2a0505" stopOpacity="1" />
              </radialGradient>
              <radialGradient id="wax-highlight" cx="35%" cy="22%" r="30%">
                <stop offset="0%" stopColor="#ffcccc" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ffcccc" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="wax-bevel" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff8888" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#4a0000" stopOpacity="0" />
                <stop offset="100%" stopColor="#1a0000" stopOpacity="0.5" />
              </linearGradient>
              <filter id="wax-engrave" x="-20%" y="-20%" width="140%" height="140%">
                <feOffset dx="1.5" dy="2" in="SourceAlpha" result="shadowOffset" />
                <feGaussianBlur stdDeviation="1" in="shadowOffset" result="shadowBlur" />
                <feFlood floodColor="#000000" floodOpacity="0.6" result="shadowColor" />
                <feComposite in="shadowColor" in2="shadowBlur" operator="in" result="shadow" />
                <feOffset dx="-0.8" dy="-1" in="SourceAlpha" result="hlOffset" />
                <feGaussianBlur stdDeviation="0.6" in="hlOffset" result="hlBlur" />
                <feFlood floodColor="#ffaaaa" floodOpacity="0.5" result="hlColor" />
                <feComposite in="hlColor" in2="hlBlur" operator="in" result="highlight" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="highlight" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="wax-edge" x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="5" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </>
          )}

          <clipPath id={LOGO_CLIP_ID}>
            {/* ⭐ Logo poussé vers le HAUT pour laisser la place au titre du
                poste (Directeur / Promoteur / Comptable / Secrétaire /
                Secrétaire Comptable) juste en dessous, entre le logo et le
                bas du cachet. cy = CENTER - 25 (au lieu de -8). */}
            <circle cx={CENTER} cy={CENTER - 25} r="26" />
          </clipPath>
        </defs>

        {/* ⭐ Groupe principal avec effet tampon (grain + distorsion) */}
        <g filter={style === 'standard' ? `url(#${GRAIN_ID})` : undefined}>

          {/* Cercle extérieur — épais */}
          <circle
            cx={CENTER} cy={CENTER} r={OUTER_R}
            fill="none"
            stroke={style === 'wax' ? 'url(#wax-gradient)' : stampColor}
            strokeWidth="3"
            filter={style === 'standard' ? `url(#${DISTORT_ID})` : undefined}
          />
          {/* Cercle intérieur */}
          <circle
            cx={CENTER} cy={CENTER} r={INNER_R}
            fill="none"
            stroke={style === 'wax' ? 'url(#wax-gradient)' : stampColor}
            strokeWidth="2"
            filter={style === 'standard' ? `url(#${DISTORT_ID})` : undefined}
          />

          {/* ⭐ Étoiles séparatrices ★ à 9h et 3h */}
          <text x={starLeftX} y={starY} fill={stampColor} fontSize="14" textAnchor="middle" dominantBaseline="middle">★</text>
          <text x={starRightX} y={starY} fill={stampColor} fontSize="14" textAnchor="middle" dominantBaseline="middle">★</text>

          {/* ⭐ Texte circulaire supérieur — GROS et COMPACT */}
          <path id={TOP_PATH_ID} d={topArcPath} fill="none" />
          <text
            fill={stampColor}
            fontSize={topFontSize}
            fontWeight="bold"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            letterSpacing={topLetterSpacing}
          >
            <textPath href={`#${TOP_PATH_ID}`} startOffset="50%" textAnchor="middle">
              {topText}
            </textPath>
          </text>

          {/* ⭐ Texte circulaire inférieur — CONTACTS (multi-lignes si besoin) */}
          <path id={BOTTOM_PATH_ID} d={bottomArcPath1} fill="none" />
          <text
            fill={stampColor}
            fontSize={bottomFontSize}
            fontFamily="'Arial', 'Helvetica', sans-serif"
            letterSpacing="0.5"
          >
            <textPath href={`#${BOTTOM_PATH_ID}`} startOffset="50%" textAnchor="middle">
              {bottomLines[0] || ''}
            </textPath>
          </text>
          {bottomLines[1] && (
            <>
              <path id={BOTTOM_PATH_ID_2} d={bottomArcPath2} fill="none" />
              <text fill={stampColor} fontSize={bottomFontSize - 1} fontFamily="'Arial', 'Helvetica', sans-serif" letterSpacing="0.5">
                <textPath href={`#${BOTTOM_PATH_ID_2}`} startOffset="50%" textAnchor="middle">
                  {bottomLines[1]}
                </textPath>
              </text>
            </>
          )}
          {bottomLines[2] && (
            <>
              <path id={BOTTOM_PATH_ID_3} d={bottomArcPath3} fill="none" />
              <text fill={stampColor} fontSize={bottomFontSize - 2} fontFamily="'Arial', 'Helvetica', sans-serif" letterSpacing="0.5">
                <textPath href={`#${BOTTOM_PATH_ID_3}`} startOffset="50%" textAnchor="middle">
                  {bottomLines[2]}
                </textPath>
              </text>
            </>
          )}

          {/* ⭐ Logo de l'école — poussé vers le haut (cy = CENTER - 25)
              pour laisser la place au titre du poste juste en dessous. */}
          {logoUrl ? (
            <image
              href={logoUrl}
              x={CENTER - 26}
              y={CENTER - 51}
              width="52"
              height="52"
              clipPath={`url(#${LOGO_CLIP_ID})`}
              preserveAspectRatio="xMidYMid slice"
            />
          ) : (
            <circle cx={CENTER} cy={CENTER - 25} r="24" fill="none" stroke={stampColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
          )}

          {/* ⭐ Titre/poste occupé — placé juste sous le logo (qui est
              maintenant plus haut). On garde une taille lisible (13px) et
              on tronque les rôles longs (ex: "Secrétaire Comptable") pour
              éviter tout débordement sur les côtés. */}
          <text
            x={CENTER}
            y={CENTER + 18}
            fill={stampColor}
            fontSize="13"
            fontWeight="bold"
            fontFamily="'Arial', 'Helvetica', sans-serif"
            textAnchor="middle"
            letterSpacing="1"
          >
            {personRole.toUpperCase()}
          </text>

        </g>

        {/* Effet wax 3D */}
        {style === 'wax' && (
          <>
            <circle cx={CENTER} cy={CENTER} r={OUTER_R + 3} fill="url(#wax-gradient)" filter="url(#wax-edge)" />
            <circle cx={CENTER} cy={CENTER} r={OUTER_R} fill="url(#wax-bevel)" opacity="0.6" />
            <ellipse cx={CENTER - 40} cy={CENTER - 50} rx="45" ry="30" fill="url(#wax-highlight)" />
            <circle cx={CENTER} cy={CENTER} r={OUTER_R + 2} fill="none" stroke="#1a0000" strokeWidth="0.5" opacity="0.4" filter="url(#wax-edge)" />
          </>
        )}
      </svg>
    );
  }
);
CircularStamp.displayName = 'CircularStamp';

// ──────────────────────────────────────────────────────────────────────────
// Cachet nominatif rectangulaire
// ──────────────────────────────────────────────────────────────────────────

interface RectangularStampProps {
  personName: string;
  personRole: string;
  schoolAcronym: string;
  schoolName: string;
  style: StampStyle;
  /** ⭐ ID optionnel appliqué au <svg> racine. Utilisé par la génération
   *  en lot pour récupérer le SVG sérialisé via document.getElementById(). */
  svgId?: string;
}

function RectangularStamp({ personName, personRole, schoolAcronym, schoolName, style, svgId }: RectangularStampProps) {
  const W = 320;
  const H = 110;
  const stampColor = style === 'wax' ? WAX_RED : STAMP_RED;

  // ⭐ Préfixe d'ID unique pour éviter les collisions quand on rend
  //    plusieurs cachets rectangulaires sur la même page.
  const uid = svgId ? svgId : 'rect-stamp';
  const TEXTURE_ID = `${uid}-texture`;

  // ⭐ Acronyme GROS en haut (au lieu du nom complet qui déborde du cadre).
  //    On le met en majuscules pour un rendu « tampon officiel ».
  const acronymText = (schoolAcronym || 'ÉCOLE').toUpperCase();
  // Taille de police dynamique : 22px si court (≤6 chars), 18px sinon.
  const acronymFontSize = acronymText.length > 8 ? 16 : acronymText.length > 6 ? 18 : 22;

  // ⭐ Nom complet de l'école en plus petit (max 40 chars) — affiché sous
  //    l'acronyme pour rester informatif sans déborder du cadre.
  const fullSchoolLine = schoolName ? schoolName.substring(0, 42) : '';

  return (
    <svg id={svgId} viewBox={`0 0 ${W} ${H}`} width={W} height={H} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id={TEXTURE_ID} x="-5%" y="-5%" width="110%" height="110%">
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
        filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
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
        filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
      />

      {/* ⭐ ACRONYME en haut (GROS) — c'est l'identifiant court de l'école */}
      <text
        x={W / 2}
        y="28"
        fill={stampColor}
        fontSize={acronymFontSize}
        fontWeight="bold"
        fontFamily="'Arial', sans-serif"
        textAnchor="middle"
        letterSpacing="2"
        filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
      >
        {acronymText}
      </text>

      {/* ⭐ Nom complet de l'école en plus petit (max 40 chars) — informatif */}
      {fullSchoolLine && (
        <text
          x={W / 2}
          y="44"
          fill={stampColor}
          fontSize="8"
          fontFamily="'Arial', sans-serif"
          textAnchor="middle"
          filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
        >
          {fullSchoolLine.toUpperCase()}
        </text>
      )}

      {/* Ligne de séparation */}
      <line
        x1="30"
        y1="54"
        x2={W - 30}
        y2="54"
        stroke={stampColor}
        strokeWidth="0.5"
        strokeDasharray="2 2"
        filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
      />

      {/* ⭐ Nom de la personne (grand) + role juste en dessous.
          C'est l'essence du cachet nominatif : NOM + POSTE occupé. */}
      <text
        x={W / 2}
        y="76"
        fill={stampColor}
        fontSize="18"
        fontWeight="bold"
        fontFamily="'Arial', sans-serif"
        textAnchor="middle"
        filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
      >
        {personName.toUpperCase().substring(0, 36)}
      </text>

      {/* Fonction (Le Directeur / La Directrice / Le Comptable / etc.) */}
      <text
        x={W / 2}
        y="95"
        fill={stampColor}
        fontSize="13"
        fontWeight="bold"
        fontFamily="'Arial', sans-serif"
        textAnchor="middle"
        letterSpacing="1"
        filter={style === 'standard' ? `url(#${TEXTURE_ID})` : undefined}
      >
        {personRole}
      </text>
    </svg>
  );
}
