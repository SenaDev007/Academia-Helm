/**
 * FederisSchoolDetail — Fiche complète d'une école rattachée
 *
 * (2026-09-29 #3) « Dès lors qu'une école adhère (accepte l'invitation),
 * le clic sur cette école ouvre sa fiche complète » :
 *
 *   - Informations de l'établissement : adresse, promoteur, direction,
 *     contacts, année scolaire, patronat dépositaire du lien.
 *   - Niveaux scolaires couverts (dynamiques selon les classes réelles de
 *     l'école) : primaire CM2 → CEP, secondaire 1er cycle 3ème → BEPC,
 *     secondaire 2nd cycle Terminale → Baccalauréat, CAP.
 *   - Effectifs des classes d'examen issus de la BASE DE DONNÉES DE L'ÉCOLE :
 *     CM2, 3ème, Terminale catégorisée PAR SÉRIE (A1, C, D…), CAP par
 *     FILIÈRE professionnelle.
 *   - Candidats officiellement présentés : SOUS-ONGLETS DYNAMIQUES CEP /
 *     BEPC / Baccalauréat / CAP — un onglet apparaît dès que l'école a
 *     transmis la liste officielle au patronat, avec la liste complète des
 *     candidats (les compteurs du module sont mis à jour globalement).
 *
 * Source : GET /federis/patronat/schools/:schoolTenantId/detail.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import AppIcon from '@/components/ui/AppIcon';
import { apiClient } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { FedPage } from '@/components/federis/federis-motion';

// ── Types (réponse du backend) ──────────────────────────────────────────────

interface SchoolDetailSchool {
  id: string;
  name: string;
  slug?: string | null;
  subdomain?: string | null;
  logo?: string | null;
  address?: string | null;
  city?: string | null;
  department?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  email?: string | null;
  website?: string | null;
  promoteur?: string | null;
  directeur?: string | null;
  educationLevels: string[];
  joinedAt?: string | null;
  accessLevel: string;
  patronat?: { name: string; territoryName: string | null } | null;
}

interface SchoolDetailLevel {
  code: 'CM2' | '3EME' | 'TERMINALE' | 'CAP';
  cycle: string;
  classe: string;
  examType: 'CEP' | 'BEPC' | 'BAC' | 'CAP';
  examLabel: string;
  students: number;
}

interface LabelCount {
  label: string;
  count: number;
}

interface SchoolDetailEffectifs {
  CEP: { total: number; byClass: LabelCount[] };
  BEPC: { total: number; byClass: LabelCount[] };
  BAC: { total: number; bySerie: LabelCount[] };
  CAP: { total: number; byFiliere: LabelCount[] };
}

interface PresentedCandidate {
  id: string;
  matricule: string;
  registrationNumber: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  dateOfBirth: string | null;
  series: string | null;
  schoolClass: string | null;
}

interface SchoolPresentation {
  examType: 'CEP' | 'BEPC' | 'BAC' | 'CAP';
  exam: { code: string; name: string } | null;
  candidates: PresentedCandidate[];
}

interface SchoolDetailResponse {
  school: SchoolDetailSchool;
  academicYear: string | null;
  levels: SchoolDetailLevel[];
  effectifs: SchoolDetailEffectifs;
  presentations: SchoolPresentation[];
}

// ── Constantes ──────────────────────────────────────────────────────────────

const EXAM_TAB_LABELS: Record<SchoolPresentation['examType'], string> = {
  CEP: 'CEP',
  BEPC: 'BEPC',
  BAC: 'Baccalauréat',
  CAP: 'CAP',
};

const EXAM_TAB_FULL: Record<SchoolPresentation['examType'], string> = {
  CEP: 'Certificat d\u2019Études Primaires',
  BEPC: 'Brevet d\u2019Études du Premier Cycle',
  BAC: 'Baccalauréat — par série',
  CAP: 'CAP — par filière',
};

const hasSeriesTab = (t: SchoolPresentation['examType']) => t === 'BAC' || t === 'CAP';

/** Logo d'école (image ou initiales) — cohérent avec FederisSchoolsPage. */
function SchoolLogo({ name, logo }: { name: string; logo?: string | null }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        className="h-14 w-14 rounded-xl object-cover ring-1 ring-slate-200 bg-white flex-shrink-0"
      />
    );
  }
  return (
    <div className="h-14 w-14 rounded-xl bg-blue-900 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Barre de répartition (séries / filières / classes). */
function DistributionBar({
  items,
  emptyLabel,
}: {
  items: LabelCount[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400 italic">{emptyLabel}</p>;
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="w-40 shrink-0 truncate text-xs font-medium text-slate-600"
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div
              className="flex h-full items-center justify-end rounded-md bg-blue-900/80 pr-1.5 text-[10px] font-bold text-white"
              style={{ width: `${Math.max((item.count / max) * 100, 14)}%` }}
            >
              {item.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Composant principal ─────────────────────────────────────────────────────

export default function FederisSchoolDetail({
  schoolTenantId,
  onBack,
}: {
  schoolTenantId: string;
  onBack: () => void;
}) {
  const [data, setData] = useState<SchoolDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SchoolPresentation['examType'] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .get(`/federis/patronat/schools/${schoolTenantId}/detail`, { timeout: 30000 })
      .then((res) => {
        if (cancelled) return;
        setData(res.data ?? null);
        setActiveTab(res.data?.presentations?.[0]?.examType ?? null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(
          err?.response?.data?.message ??
            "Impossible de charger la fiche de l'école. Veuillez réessayer.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [schoolTenantId]);

  // Onglet actif → candidats filtrés par recherche
  const activePresentation = useMemo(
    () => data?.presentations.find((p) => p.examType === activeTab) ?? null,
    [data, activeTab],
  );

  const filteredCandidates = useMemo(() => {
    if (!activePresentation) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activePresentation.candidates;
    return activePresentation.candidates.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.matricule?.toLowerCase().includes(q) ||
        c.registrationNumber?.toLowerCase().includes(q) ||
        (c.series ?? '').toLowerCase().includes(q) ||
        (c.schoolClass ?? '').toLowerCase().includes(q),
    );
  }, [activePresentation, search]);

  const totalPresented =
    data?.presentations.reduce((acc, p) => acc + p.candidates.length, 0) ?? 0;

  // ── Chargement ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <FedPage className="space-y-6">
        <div className="h-9 w-48 rounded-lg bg-slate-100 animate-pulse" />
        <div className="fed-card h-32 animate-pulse" />
        <div className="fed-card h-64 animate-pulse" />
      </FedPage>
    );
  }

  if (error || !data) {
    return (
      <FedPage className="space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-blue-900 hover:underline"
        >
          <AppIcon name="chevronLeft" size="submenu" />
          Retour aux écoles rattachées
        </button>
        <div className="fed-card px-6 py-10 text-center">
          <AppIcon name="warning" size="dashboard" className="text-amber-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600">{error ?? 'Fiche indisponible.'}</p>
        </div>
      </FedPage>
    );
  }

  const { school, academicYear, levels, effectifs, presentations } = data;

  return (
    <FedPage className="space-y-6">
      {/* Retour */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-blue-900 hover:underline"
      >
        <AppIcon name="chevronLeft" size="submenu" />
        Retour aux écoles rattachées
      </button>

      {/* En-tête — identité de l'école */}
      <div className="fed-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <SchoolLogo name={school.name} logo={school.logo} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-blue-900 tracking-tight">
              {school.name}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {school.joinedAt
                ? `Rattachée le ${new Date(school.joinedAt).toLocaleDateString('fr-FR')}`
                : 'Rattachement en cours'}
              {school.patronat
                ? ` · Patronat ${school.patronat.name}${
                    school.patronat.territoryName
                      ? ` (${school.patronat.territoryName})`
                      : ''
                  }`
                : ''}
              {academicYear ? ` · Année scolaire ${academicYear}` : ''}
            </p>
            {/* Totaux rapides */}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-900 text-[10px] font-bold uppercase">
                {levels.reduce((acc, l) => acc + l.students, 0)} élèves en classes d&apos;examen
              </span>
              <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-800 text-[10px] font-bold uppercase">
                {totalPresented} candidat{totalPresented > 1 ? 's' : ''} présenté
                {totalPresented > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Informations de l'école */}
      <section className="fed-card p-6">
        <h2 className="text-base font-bold text-blue-900 flex items-center gap-2 mb-4">
          <AppIcon name="building" size="submenu" className="text-blue-900" />
          Informations de l&apos;établissement
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {school.promoteur && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Promoteur</p>
              <p className="text-sm font-medium text-slate-800">{school.promoteur}</p>
            </div>
          )}
          {school.directeur && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Direction</p>
              <p className="text-sm font-medium text-slate-800">{school.directeur}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Adresse</p>
            <p className="text-sm font-medium text-slate-800">
              {school.address ?? '—'}
              {school.city || school.department ? (
                <span className="block text-xs text-slate-500">
                  {[school.city, school.department].filter(Boolean).join(', ')}
                </span>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Téléphone</p>
            <p className="text-sm font-medium text-slate-800">
              {[school.phone, school.secondaryPhone].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Email</p>
            <p className="text-sm font-medium text-slate-800 break-all">{school.email ?? '—'}</p>
          </div>
          {school.website && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Site web</p>
              <p className="text-sm font-medium text-slate-800 break-all">{school.website}</p>
            </div>
          )}
        </div>
      </section>

      {/* Niveaux scolaires */}
      <section className="fed-card p-6">
        <h2 className="text-base font-bold text-blue-900 flex items-center gap-2 mb-1">
          <AppIcon name="scolarite" size="submenu" className="text-blue-900" />
          Niveaux scolaires de l&apos;établissement
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Niveaux couverts par l&apos;école selon ses classes réelles — chaque niveau conduit à un
          examen national.
        </p>
        {levels.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Aucune classe d&apos;examen enregistrée pour l&apos;année scolaire en cours.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {levels.map((level) => (
              <div
                key={level.code}
                className="flex items-center justify-between gap-3 border border-blue-100 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{level.cycle}</p>
                  <p className="text-sm font-bold text-blue-900">Classe de {level.classe}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-slate-800 tabular-nums">{level.students}</p>
                  <p className="text-[10px] text-slate-400">élèves · {level.examLabel}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Effectifs des classes d'examen — base de données de l'école */}
      <section className="fed-card p-6">
        <h2 className="text-base font-bold text-blue-900 flex items-center gap-2 mb-1">
          <AppIcon name="students" size="submenu" className="text-blue-900" />
          Effectifs des classes d&apos;examen
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Effectifs issus de la base de données de l&apos;école — la Terminale est catégorisée par
          série et le CAP par filière.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {(
            [
              { key: 'CEP', classe: 'CM2', exam: 'CEP' },
              { key: 'BEPC', classe: '3ème', exam: 'BEPC' },
              { key: 'BAC', classe: 'Terminale', exam: 'Baccalauréat' },
              { key: 'CAP', classe: 'Terminale CAP', exam: 'CAP' },
            ] as const
          ).map((tile) => (
            <div key={tile.key} className="border border-blue-100 rounded-xl px-4 py-4 text-center">
              <p className="text-xs text-slate-500">Classe de {tile.classe}</p>
              <p className="text-3xl font-bold text-blue-900 tabular-nums mt-1">
                {effectifs[tile.key].total}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">présentent le {tile.exam}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">
              Terminale — effectifs par série
            </p>
            <DistributionBar
              items={effectifs.BAC.bySerie}
              emptyLabel="Aucune classe de Terminale enregistrée."
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">
              CAP — effectifs par filière
            </p>
            <DistributionBar
              items={effectifs.CAP.byFiliere}
              emptyLabel="Aucune classe CAP enregistrée."
            />
          </div>
        </div>
      </section>

      {/* Candidats officiellement présentés — sous-onglets dynamiques */}
      <section className="fed-card p-6">
        <h2 className="text-base font-bold text-blue-900 flex items-center gap-2 mb-1">
          <AppIcon name="check" size="submenu" className="text-blue-900" />
          Candidats présentés aux examens
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Un sous-onglet apparaît dès que l&apos;école présente officiellement ses élèves à un
          examen — la liste officielle transmise au patronat s&apos;affiche alors ici.
        </p>

        {presentations.length === 0 ? (
          <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-xl px-6 py-10 text-center">
            <AppIcon name="info" size="dashboard" className="text-amber-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              Aucun candidat n&apos;a encore été présenté officiellement
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
              Lorsque l&apos;école transmettra ses listes
              {levels.length > 0
                ? ` (${levels.map((l) => l.examLabel).join(', ')})`
                : ''}
              , un sous-onglet par examen apparaîtra ici avec la liste des candidats, et les
              compteurs du module seront mis à jour.
            </p>
          </div>
        ) : (
          <>
            {/* Sous-onglets dynamiques — pattern onglets segmentés Helm */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto mb-4">
              {presentations.map((p) => {
                const active = activeTab === p.examType;
                return (
                  <button
                    key={p.examType}
                    type="button"
                    onClick={() => {
                      setActiveTab(p.examType);
                      setSearch('');
                    }}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2 rounded-lg text-xs whitespace-nowrap transition-all',
                      active
                        ? 'bg-white shadow-sm text-blue-900 font-bold'
                        : 'text-slate-500 font-semibold hover:text-blue-900',
                    )}
                  >
                    {EXAM_TAB_LABELS[p.examType]}
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                        active ? 'bg-blue-900 text-white' : 'bg-slate-200 text-slate-600',
                      )}
                    >
                      {p.candidates.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {activePresentation && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <p className="text-xs text-slate-500">
                    {activePresentation.exam
                      ? `Campagne ${activePresentation.exam.name} (${activePresentation.exam.code})`
                      : EXAM_TAB_FULL[activePresentation.examType]}{' '}
                    · {activePresentation.candidates.length} candidat
                    {activePresentation.candidates.length > 1 ? 's' : ''} présenté
                    {activePresentation.candidates.length > 1 ? 's' : ''} officiellement
                  </p>
                  <div className="relative sm:w-72">
                    <AppIcon
                      name="search"
                      size="submenu"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="fed-input-light w-full pl-10 pr-4 py-2 text-sm"
                      placeholder="Rechercher un candidat (nom, matricule, série)…"
                    />
                  </div>
                </div>

                <div className="border border-blue-100 rounded-xl overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#f7f9fc] text-left text-xs text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Matricule</th>
                        <th className="px-4 py-3 font-semibold">Nom et prénoms</th>
                        <th className="px-4 py-3 font-semibold">Sexe</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">
                          Naissance
                        </th>
                        {hasSeriesTab(activePresentation.examType) && (
                          <th className="px-4 py-3 font-semibold">
                            {activePresentation.examType === 'BAC'
                              ? 'Série'
                              : 'Filière / Classe'}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCandidates.map((c) => (
                        <tr key={c.id} className="border-t border-blue-50 hover:bg-[#f7f9fc]">
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {c.matricule || c.registrationNumber}
                          </td>
                          <td className="px-4 py-3 font-medium text-blue-900">
                            {c.lastName} {c.firstName}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{c.gender ?? '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 hidden md:table-cell whitespace-nowrap">
                            {c.dateOfBirth
                              ? new Date(c.dateOfBirth).toLocaleDateString('fr-FR')
                              : '—'}
                          </td>
                          {hasSeriesTab(activePresentation.examType) && (
                            <td className="px-4 py-3 text-xs text-slate-600">
                              {activePresentation.examType === 'BAC'
                                ? c.series
                                  ? `Série ${c.series}`
                                  : '—'
                                : c.schoolClass ?? c.series ?? '—'}
                            </td>
                          )}
                        </tr>
                      ))}
                      {filteredCandidates.length === 0 && (
                        <tr>
                          <td
                            colSpan={hasSeriesTab(activePresentation.examType) ? 5 : 4}
                            className="px-4 py-8 text-center text-sm text-slate-400"
                          >
                            Aucun candidat ne correspond à la recherche.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {search.trim() && (
                  <p className="text-[10px] text-slate-400 mt-2">
                    {filteredCandidates.length} candidat
                    {filteredCandidates.length > 1 ? 's' : ''} affiché
                    {filteredCandidates.length > 1 ? 's' : ''} sur{' '}
                    {activePresentation.candidates.length}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </FedPage>
  );
}
