/**
 * ============================================================================
 * MODULE TRANSVERSAL — PARAMÈTRES DE L'APPLICATION
 * ============================================================================
 * Plateforme de pilotage éducatif - Academia Helm
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { settingsKeys } from '@/lib/query/settings-keys';
import { academicYearsKeys } from '@/lib/query/academic-years-keys';
import {
  buildAcademicYearsSnapshot,
  hydrateAcademicYearsFromBootstrap,
} from '@/lib/query/academic-years-fetch';
import type { SettingsBootstrapPayload } from '@/lib/query/fetch-settings-bootstrap';
import { useSettingsBootstrapQuery } from '@/hooks/useSettingsBootstrapQuery';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import NextImage from 'next/image';
import { 
  Globe, Shield, Brain, MessageSquare, CloudOff, History, 
  ToggleLeft, ToggleRight, Stamp, GraduationCap, Languages, 
  Bell, Users, Calendar, Save, Loader2, CheckCircle, AlertCircle,
  Mail, UserCog, Lock, Key, Smartphone, CreditCard, Receipt, RefreshCw,
  Upload, Image, CalendarDays, UserCircle, School, Archive, CalendarRange,
  Pencil, CopyPlus, Layers
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import GeneratedStampsSignatures from '@/components/settings/GeneratedStampsSignatures';
import { useAppSession } from '@/contexts/AppSessionContext';
import * as settingsService from '@/services/settings.service';
import { SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT } from '@/lib/settings/events';
import { formatGradeLabel } from '@/lib/utils';

/** Format d’affichage des dates d’année scolaire (conforme calendrier officiel, évite décalage timezone) */
function toInputDate(date: Date | string | null | undefined): string {
  if (date == null) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function formatAcademicDate(date: Date | string | null | undefined, options?: { weekday?: boolean }): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', {
    timeZone: 'UTC',
    weekday: options?.weekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Affiche un nom de rôle pour l'UI : PLATFORM_OWNER → "PLATFORM OWNER", PLATFORM_ADMIN → "PLATFORM ADMIN" */
function formatRoleDisplayName(name: string | null | undefined): string {
  if (name == null || name === '') return '';
  return String(name).replace(/_/g, ' ');
}

type TabId = 'identity' | 'academic-year' | 'structure' | 'bilingual' | 'features' | 
             'roles' | 'communication' | 'billing' | 'security' | 'seals' | 'orion' | 'atlas' | 'offline' | 'appareils' | 'history';

const SCHOOL_IDENTITY_UPDATED_EVENT = 'settings-school-identity-updated';

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, tenant } = useAppSession();
  const urlTenantId = searchParams.get('tenant_id');
  /** Rôles pouvant cibler un autre tenant (query) ou retomber sur le tenant du JWT */
  const isCrossTenantRole =
    user?.role === 'PLATFORM_OWNER' ||
    user?.role === 'PLATFORM_ADMIN' ||
    user?.role === 'SUPER_ADMIN';
  const effectiveTenantId =
    isCrossTenantRole || !tenant?.id ? urlTenantId || tenant?.id : tenant?.id;
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';
  /** Spec : Appareils autorisés accessible par PLATFORM_OWNER, PLATFORM_ADMIN, Promoteur, DIRECTOR, ADMIN */
  const canAccessDevices =
    !!user?.role &&
    ['PLATFORM_OWNER', 'PLATFORM_ADMIN', 'PROMOTEUR', 'PROMOTER', 'DIRECTOR', 'ADMIN'].includes(user.role);

  const [availableTenantsForPO, setAvailableTenantsForPO] = useState<{ tenantId: string; name?: string }[]>([]);
  const [loadingTenantsPO, setLoadingTenantsPO] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('identity');
  /** Prêt après première application du bootstrap (évite flash formulaires vides). */
  const [pageReady, setPageReady] = useState(false);
  const shouldApplyBootstrapRef = useRef(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // États pour les données
  const [generalSettings, setGeneralSettings] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [orionSettings, setOrionSettings] = useState<any>(null);
  const [atlasSettings, setAtlasSettings] = useState<any>(null);
  const [offlineSyncSettings, setOfflineSyncSettings] = useState<any>(null);
  const [devicesList, setDevicesList] = useState<Array<{
    id: string;
    deviceName: string | null;
    deviceType: string;
    lastUsedAt: string | null;
    lastSyncAt: string | null;
    createdAt: string;
    user?: { id: string; email: string; firstName: string | null; lastName: string | null };
  }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [activeAcademicYear, setActiveAcademicYear] = useState<any>(null);
  const [academicYearAction, setAcademicYearAction] = useState<'activate' | 'close' | 'generate' | null>(null);
  const [academicYearTargetId, setAcademicYearTargetId] = useState<string | null>(null);
  const [academicYearBusy, setAcademicYearBusy] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editingYearForm, setEditingYearForm] = useState<{ preEntryDate: string; officialStartDate: string; startDate: string; endDate: string } | null>(null);
  const [editingYearBusy, setEditingYearBusy] = useState(false);
  const [academicPeriods, setAcademicPeriods] = useState<settingsService.AcademicPeriod[]>([]);
  const [periodYearId, setPeriodYearId] = useState<string | null>(null);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [showNewPeriodForm, setShowNewPeriodForm] = useState(false);
  const [newPeriodForm, setNewPeriodForm] = useState<{ name: string; type: settingsService.AcademicPeriodType; periodOrder: number; startDate: string; endDate: string }>({
    name: '', type: 'TRIMESTER', periodOrder: 1, startDate: '', endDate: '',
  });
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingPeriodForm, setEditingPeriodForm] = useState<{ name: string; type: settingsService.AcademicPeriodType; periodOrder: number; startDate: string; endDate: string } | null>(null);
  const [pedagogicalStructure, setPedagogicalStructure] = useState<any>(null);
  const [bilingualSettings, setBilingualSettings] = useState<any>(null);
  const [communicationSettings, setCommunicationSettings] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [usersWithRoles, setUsersWithRoles] = useState<any[]>([]);
  const [billingSettings, setBillingSettings] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Identité versionnée
  const [identityProfile, setIdentityProfile] = useState<any>(null);
  const [identityVersions, setIdentityVersions] = useState<any[]>([]);
  const [documentPreview, setDocumentPreview] = useState<any>(null);
  const [changeReason, setChangeReason] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Formulaires modifiés
  const [identityForm, setIdentityForm] = useState<any>({});
  const [communicationForm, setCommunicationForm] = useState<any>({});
  const [billingForm, setBillingForm] = useState<any>({});
  const [securityForm, setSecurityForm] = useState<any>({});
  const [orionForm, setOrionForm] = useState<any>({});
  const [atlasForm, setAtlasForm] = useState<any>({});
  const [offlineForm, setOfflineForm] = useState<any>({});
  const [structureForm, setStructureForm] = useState<any>({});
  const [educationStructure, setEducationStructure] = useState<{ levels?: any[] } | null>(null);
  const [structureYearId, setStructureYearId] = useState<string | null>(null);
  const [educationClassrooms, setEducationClassrooms] = useState<any[]>([]);
  const [structureBusy, setStructureBusy] = useState(false);
  const [newClassroomGradeId, setNewClassroomGradeId] = useState<string | null>(null);
  const [newClassroomName, setNewClassroomName] = useState('');
  const [newClassroomCapacity, setNewClassroomCapacity] = useState<number | ''>('');
  const [editingClassroomId, setEditingClassroomId] = useState<string | null>(null);
  const [editingClassroomName, setEditingClassroomName] = useState('');
  const [editingClassroomCapacity, setEditingClassroomCapacity] = useState<number | ''>('');
  const [editingClassroomSeriesCode, setEditingClassroomSeriesCode] = useState('');
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkGradeId, setBulkGradeId] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState<number>(3);
  const [bulkSuffixType, setBulkSuffixType] = useState<'letters' | 'numbers'>('letters');
  const [bulkCapacity, setBulkCapacity] = useState<number | ''>('');
  const [bilingualForm, setBilingualForm] = useState<any>({});
  const [bilingualBillingImpact, setBilingualBillingImpact] = useState<{ monthly?: number; annual?: number; currency?: string } | null>(null);
  const [bilingualMigrationNeeded, setBilingualMigrationNeeded] = useState<boolean | null>(null);

  const allGradesFromStructure = useMemo(() => {
    const levels = educationStructure?.levels ?? [];
    const out: { id: string; name: string; code: string; cycle: { name: string }; level: { name: string }; series?: { code: string; name?: string; order?: number } }[] = [];
    levels.forEach((l: any) => l.cycles?.forEach((c: any) => c.grades?.forEach((g: any) => out.push({ ...g, cycle: c, level: l }))));
    return out;
  }, [educationStructure?.levels]);

  /** Classes physiques triées par ordre niveau → cycle → grade → nom (pour le tableau). */
  const sortedClassrooms = useMemo(() => {
    const list = [...(educationClassrooms ?? [])];
    const levelOrder = (name: string) => {
      if (name === 'MATERNELLE') return 0;
      if (name === 'PRIMAIRE') return 1;
      if (name === 'SECONDAIRE') return 2;
      return 99;
    };
    list.sort((a: any, b: any) => {
      const lA = a.grade?.cycle?.level;
      const lB = b.grade?.cycle?.level;
      const ordL = (lA?.order ?? levelOrder(lA?.name ?? '')) - (lB?.order ?? levelOrder(lB?.name ?? ''));
      if (ordL !== 0) return ordL;
      const ordC = (a.grade?.cycle?.order ?? 0) - (b.grade?.cycle?.order ?? 0);
      if (ordC !== 0) return ordC;
      const ordG = (a.grade?.order ?? 0) - (b.grade?.order ?? 0);
      if (ordG !== 0) return ordG;
      return (a.name ?? '').localeCompare(b.name ?? '', 'fr');
    });
    return list;
  }, [educationClassrooms]);

  /** Séries du 2nd cycle secondaire (A1, A2, B, C, D). Liste de secours si l'API ne renvoie pas les séries. */
  const SECOND_CYCLE_SERIES_FALLBACK = [
    { code: 'A1', name: 'Série A1', order: 1 },
    { code: 'A2', name: 'Série A2', order: 2 },
    { code: 'B', name: 'Série B', order: 3 },
    { code: 'C', name: 'Série C', order: 4 },
    { code: 'D', name: 'Série D', order: 5 },
  ];
  const secondCycleSeriesOptions = useMemo(() => {
    const grades = allGradesFromStructure.filter(
      (g: any) => g?.level?.name === 'SECONDAIRE' && g?.cycle?.name === '2nd cycle' && g?.series
    );
    const byCode = new Map<string, { code: string; name?: string; order?: number }>();
    grades.forEach((g: any) => {
      if (g.series && !byCode.has(g.series.code)) byCode.set(g.series.code, g.series);
    });
    const fromApi = Array.from(byCode.values()).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
    return fromApi.length > 0 ? fromApi : SECOND_CYCLE_SERIES_FALLBACK;
  }, [allGradesFromStructure]);

  const [selectedSecondCycleSeriesCode, setSelectedSecondCycleSeriesCode] = useState<string>('');

  useEffect(() => {
    if (!newClassroomGradeId) {
      setSelectedSecondCycleSeriesCode('');
      return;
    }
    const g = allGradesFromStructure.find((x: any) => x.id === newClassroomGradeId);
    const is2nd = g?.level?.name === 'SECONDAIRE' && g?.cycle?.name === '2nd cycle';
    if (!is2nd || g?.series) setSelectedSecondCycleSeriesCode('');
  }, [newClassroomGradeId, allGradesFromStructure]);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const notifySchoolIdentityUpdated = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(SCHOOL_IDENTITY_UPDATED_EVENT));
  }, []);

  const notifySchoolLevelsUpdated = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(SETTINGS_SCHOOL_LEVELS_UPDATED_EVENT));
  }, []);

  const {
    data: bootstrapData,
    isError: bootstrapQueryFailed,
    error: bootstrapQueryError,
  } = useSettingsBootstrapQuery(effectiveTenantId);

  const applyBootstrapPayload = useCallback(
    (data: SettingsBootstrapPayload) => {
      const {
        general,
        featuresData,
        security,
        orion,
        atlas,
        offline,
        historyData,
        academicYearsResult,
        structure,
        bilingual,
        communication,
        rolesData,
        permissionsData,
        usersData,
        billing,
        plans,
        invoicesData,
        identity,
        identityHist,
        educationHierarchy,
        bilingualExtras,
      } = data;

      setGeneralSettings(general);
      setIdentityForm(general || {});

      if (identity) {
        const id = identity as Record<string, unknown>;
        setIdentityProfile(identity);
        setIdentityForm({
          schoolName: (id.schoolName as string) || '',
          schoolAcronym: (id.schoolAcronym as string) || '',
          schoolType: (id.schoolType as string) || 'PRIVEE',
          authorizationNumber: (id.authorizationNumber as string) || '',
          foundationDate:
            typeof id.foundationDate === 'string' ? id.foundationDate.split('T')[0] : '',
          devise: (id.slogan as string) || '',
          address: (id.address as string) || '',
          city: (id.city as string) || '',
          department: (id.department as string) || '',
          country: (id.country as string) || 'BJ',
          postalCode: (id.postalCode as string) || '',
          phonePrimary: (id.phonePrimary as string) || '',
          phoneSecondary: (id.phoneSecondary as string) || '',
          email: (id.email as string) || '',
          website: (id.website as string) || '',
          currency: (id.currency as string) || 'XOF',
          timezone: (id.timezone as string) || 'Africa/Porto-Novo',
          logoUrl: (id.logoUrl as string) || '',
        });
      }
      setIdentityVersions(identityHist?.versions || []);
      setFeatures(Array.isArray(featuresData) ? featuresData : []);
      setSecuritySettings(security);
      setSecurityForm(security || {});
      setOrionSettings(orion);
      setOrionForm(orion || {});
      setAtlasSettings(atlas);
      setAtlasForm(atlas || {});
      setOfflineSyncSettings(offline);
      setOfflineForm(offline || {});
      setHistory(Array.isArray(historyData) ? historyData : []);
      const years = (academicYearsResult?.years ?? []) as any[];
      const activeYear = (academicYearsResult?.activeYear ?? null) as any;
      const yearList = years || [];
      const hasActiveInList = activeYear && yearList.some((y: any) => y.id === activeYear.id);
      setAcademicYears(
        hasActiveInList ? yearList : (activeYear ? [activeYear, ...yearList] : yearList),
      );
      setActiveAcademicYear(activeYear || null);
      const defaultYearId = activeYear?.id ?? yearList[0]?.id ?? null;
      setPeriodYearId(defaultYearId);

      const edu = educationHierarchy as { levels?: any[] } | null | undefined;
      if (edu?.levels) {
        setEducationStructure(edu as any);
      } else {
        setEducationStructure((edu || { levels: [] }) as any);
      }

      setBilingualBillingImpact(bilingualExtras?.impact ?? null);
      setBilingualMigrationNeeded(
        bilingualExtras?.migrationNeeded !== undefined && bilingualExtras?.migrationNeeded !== null
          ? bilingualExtras.migrationNeeded
          : null,
      );

      setPedagogicalStructure(structure);
      setStructureForm(structure || {});
      setBilingualSettings(bilingual);
      setBilingualForm(bilingual || {});
      setCommunicationSettings(communication);
      setCommunicationForm(communication || {});
      const finalRoles = Array.isArray(rolesData) ? rolesData : [];
      const finalPermissions = Array.isArray(permissionsData) ? permissionsData : [];
      const needsBootstrap = finalRoles.length === 0 || finalPermissions.length === 0;
      const finalUsers = Array.isArray(usersData) ? usersData : [];

      setRoles(finalRoles);
      setPermissions(finalPermissions);
      setUsersWithRoles(finalUsers);
      setBillingSettings(billing);
      setBillingForm(billing || {});
      setAvailablePlans((Array.isArray(plans) ? plans : plans ?? []) as any[]);
      setInvoices((Array.isArray(invoicesData) ? invoicesData : invoicesData ?? []) as any[]);

      if (needsBootstrap) {
        void (async () => {
          try {
            await settingsService.ensureRbacInitialized();
            const [rolesAfter, permsAfter, usersAfter] = await Promise.all([
              settingsService.getRoles(effectiveTenantId ?? undefined).catch(() => []),
              settingsService.getPermissions().catch(() => []),
              effectiveTenantId
                ? settingsService.getUsersWithRoles(effectiveTenantId).catch(() => [])
                : Promise.resolve(finalUsers),
            ]);
            const r = Array.isArray(rolesAfter) ? rolesAfter : [];
            const p = Array.isArray(permsAfter) ? permsAfter : [];
            const u = Array.isArray(usersAfter) ? usersAfter : finalUsers;
            setRoles(r);
            setPermissions(p);
            setUsersWithRoles(u);
            if (r.length > 0 || p.length > 0) {
              showToast('success', 'Rôles et permissions initialisés et enregistrés en BDD');
            }
          } catch (e: unknown) {
            const msg =
              e instanceof Error ? e.message : "Impossible d'initialiser les rôles (vérifiez l'API)";
            showToast('error', msg);
          }
        })();
      }
    },
    [effectiveTenantId, showToast],
  );

  useEffect(() => {
    setPageReady(false);
    shouldApplyBootstrapRef.current = true;
  }, [effectiveTenantId]);

  const settingsErrorToastShownRef = useRef(false);
  useEffect(() => {
    if (!bootstrapQueryFailed) {
      settingsErrorToastShownRef.current = false;
      return;
    }
    if (settingsErrorToastShownRef.current) return;
    settingsErrorToastShownRef.current = true;
    console.error('Error loading settings:', bootstrapQueryError);
    showToast('error', 'Erreur lors du chargement des paramètres');
    setPageReady(true);
  }, [bootstrapQueryFailed, bootstrapQueryError, showToast]);

  useEffect(() => {
    if (!bootstrapData) return;
    if (!shouldApplyBootstrapRef.current) return;
    shouldApplyBootstrapRef.current = false;
    hydrateAcademicYearsFromBootstrap(queryClient, effectiveTenantId, bootstrapData);
    applyBootstrapPayload(bootstrapData);
    setPageReady(true);
  }, [bootstrapData, effectiveTenantId, queryClient, applyBootstrapPayload]);

  const loading = !pageReady;

  /** Périodes : rechargées dès que l’année sélectionnée change (préchargées au montage via le bootstrap). */
  useEffect(() => {
    if (!periodYearId || !effectiveTenantId) {
      if (!periodYearId) setAcademicPeriods([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await settingsService.getAcademicYearPeriods(periodYearId, effectiveTenantId);
        if (!cancelled) setAcademicPeriods(Array.isArray(list) ? list : []);
      } catch (_) {
        if (!cancelled) setAcademicPeriods([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [periodYearId, effectiveTenantId]);

  /** Classes physiques : préchargées au montage ; rechargement si année structure ou année active change. */
  useEffect(() => {
    const yearId = structureYearId || activeAcademicYear?.id;
    if (!yearId || !effectiveTenantId) {
      if (!structureYearId && !activeAcademicYear?.id) setEducationClassrooms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await settingsService.getEducationClassrooms(yearId, effectiveTenantId);
        if (!cancelled) setEducationClassrooms(Array.isArray(list) ? list : []);
      } catch (_) {
        if (!cancelled) setEducationClassrooms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [structureYearId, activeAcademicYear?.id, effectiveTenantId]);

  // Charger la liste des établissements pour le PO (onglet Année scolaire)
  useEffect(() => {
    if (!isPlatformOwner || activeTab !== 'academic-year') return;
    let cancelled = false;
    setLoadingTenantsPO(true);
    (async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) return;
        const res = await fetch('/api/auth/available-tenants', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAvailableTenantsForPO(
          Array.isArray(data) ? data.map((t: any) => ({ tenantId: t.tenantId || t.id, name: t.name || t.tenantName })) : []
        );
      } catch (_) {}
      finally {
        if (!cancelled) setLoadingTenantsPO(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPlatformOwner, activeTab]);

  useEffect(() => {
    if (activeTab !== 'appareils') return;
    let cancelled = false;
    setDevicesLoading(true);
    fetch('/api/sync/devices', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.devices) setDevicesList(data.devices);
      })
      .catch(() => { if (!cancelled) setDevicesList([]); })
      .finally(() => { if (!cancelled) setDevicesLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleSaveIdentity = async () => {
    if (!changeReason.trim()) {
      showToast('error', 'Veuillez indiquer la raison de la modification');
      return;
    }
    try {
      setSaving(true);
      // Mapper devise vers slogan pour l'API ; cachets/signatures sont gérés dans l'onglet Cachets (par niveau)
      const { devise, stampUrl: _s, directorSignatureUrl: _d, ...rest } = identityForm;
      const newVersion = await settingsService.createIdentityVersion(
        { ...rest, slogan: devise, changeReason: changeReason.trim() },
        effectiveTenantId ?? undefined
      );
      showToast('success', `Nouvelle version ${newVersion.version} créée`);
      setIdentityProfile(newVersion);
      setChangeReason('');
      notifySchoolIdentityUpdated();
      // Recharger l'historique
      const histData = await settingsService.getIdentityHistory({ limit: 20 }, effectiveTenantId ?? undefined);
      setIdentityVersions(histData?.versions || []);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (versionId: string, versionNum: number) => {
    if (!confirm(`Voulez-vous restaurer la version ${versionNum} ? Une nouvelle version sera créée.`)) return;
    try {
      setSaving(true);
      const restored = await settingsService.activateIdentityVersion(versionId, `Restauration de la version ${versionNum}`, effectiveTenantId ?? undefined);
      showToast('success', `Version ${restored.version} restaurée`);
      setIdentityProfile(restored);
      notifySchoolIdentityUpdated();
      // Mettre à jour le formulaire
      setIdentityForm({
        schoolName: restored.schoolName || '',
        schoolAcronym: restored.schoolAcronym || '',
        schoolType: restored.schoolType || 'PRIVEE',
        authorizationNumber: restored.authorizationNumber || '',
        foundationDate: restored.foundationDate?.split('T')[0] || '',
        devise: restored.slogan || '',
        address: restored.address || '',
        city: restored.city || '',
        department: restored.department || '',
        country: restored.country || 'BJ',
        phonePrimary: restored.phonePrimary || '',
        phoneSecondary: restored.phoneSecondary || '',
        email: restored.email || '',
        website: restored.website || '',
        currency: restored.currency || 'XOF',
        timezone: restored.timezone || 'Africa/Porto-Novo',
        logoUrl: restored.logoUrl || '',
      });
      // Recharger l'historique
      const histData = await settingsService.getIdentityHistory({ limit: 20 }, effectiveTenantId ?? undefined);
      setIdentityVersions(histData?.versions || []);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la restauration');
    } finally {
      setSaving(false);
    }
  };

  const reloadAcademicYears = async () => {
    if (!effectiveTenantId) {
      setAcademicYears([]);
      setActiveAcademicYear(null);
      return;
    }
    try {
      const [years, active] = await Promise.all([
        settingsService.getAcademicYears(effectiveTenantId),
        settingsService.getActiveAcademicYear(effectiveTenantId),
      ]);
      setAcademicYears(years || []);
      setActiveAcademicYear(active || null);
      queryClient.setQueryData(
        academicYearsKeys.snapshot(effectiveTenantId ?? 'no-tenant'),
        buildAcademicYearsSnapshot(years, active),
      );
      queryClient.setQueryData<SettingsBootstrapPayload>(
        settingsKeys.bootstrap(effectiveTenantId),
        (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            academicYearsResult: {
              years: years ?? [],
              activeYear: active ?? null,
            },
          };
        },
      );
    } catch (_) {}
  };

  const handleGenerateNextAcademicYear = async () => {
    setAcademicYearAction('generate');
    setAcademicYearTargetId(null);
  };

  const handleConfirmAcademicYearAction = async () => {
    if (!academicYearAction) return;
    try {
      setAcademicYearBusy(true);
      if (academicYearAction === 'generate') {
        const created = await settingsService.generateNextAcademicYear(effectiveTenantId);
        showToast('success', `Année ${created.name} créée. Vous pouvez l'activer quand vous le souhaitez.`);
      } else if (academicYearAction === 'activate' && academicYearTargetId) {
        await settingsService.activateAcademicYear(academicYearTargetId, effectiveTenantId);
        showToast('success', 'Année scolaire activée. Toutes les données seront désormais rattachées à cette année.');
      } else if (academicYearAction === 'close' && academicYearTargetId) {
        await settingsService.closeAcademicYear(academicYearTargetId, effectiveTenantId);
        showToast('success', 'Année clôturée. Elle est désormais en lecture seule.');
      }
      setAcademicYearAction(null);
      setAcademicYearTargetId(null);
      await reloadAcademicYears();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setAcademicYearBusy(false);
    }
  };

  const handleCancelAcademicYearAction = () => {
    setAcademicYearAction(null);
    setAcademicYearTargetId(null);
  };

  const handleStartEditAcademicYearDates = (year: { id: string; preEntryDate?: Date | string | null; officialStartDate?: Date | string | null; startDate?: Date | string; endDate?: Date | string | null }) => {
    setEditingYearId(year.id);
    setEditingYearForm({
      preEntryDate: toInputDate(year.preEntryDate),
      officialStartDate: toInputDate(year.officialStartDate ?? year.startDate),
      startDate: toInputDate(year.startDate),
      endDate: toInputDate(year.endDate),
    });
  };

  const handleCancelEditAcademicYearDates = () => {
    setEditingYearId(null);
    setEditingYearForm(null);
  };

  const handleSaveAcademicYearDates = async () => {
    if (!editingYearId || !editingYearForm) return;
    try {
      setEditingYearBusy(true);
      await settingsService.updateAcademicYear(editingYearId, {
        preEntryDate: editingYearForm.preEntryDate || undefined,
        officialStartDate: editingYearForm.officialStartDate || undefined,
        startDate: editingYearForm.startDate || undefined,
        endDate: editingYearForm.endDate || undefined,
      }, effectiveTenantId ?? undefined);
      showToast('success', 'Dates mises à jour.');
      setEditingYearId(null);
      setEditingYearForm(null);
      await reloadAcademicYears();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setEditingYearBusy(false);
    }
  };

  const reloadPeriods = useCallback(async () => {
    if (!periodYearId || !effectiveTenantId) return;
    try {
      const list = await settingsService.getAcademicYearPeriods(periodYearId, effectiveTenantId);
      setAcademicPeriods(Array.isArray(list) ? list : []);
    } catch (_) {
      setAcademicPeriods([]);
    }
  }, [periodYearId, effectiveTenantId]);

  const handleCreatePeriod = async () => {
    if (!periodYearId || !newPeriodForm.name.trim() || !newPeriodForm.startDate || !newPeriodForm.endDate) {
      showToast('error', 'Nom et dates début/fin requis.');
      return;
    }
    try {
      setPeriodBusy(true);
      await settingsService.createAcademicPeriod(
        periodYearId,
        {
          name: newPeriodForm.name.trim(),
          type: newPeriodForm.type,
          periodOrder: newPeriodForm.periodOrder,
          startDate: newPeriodForm.startDate,
          endDate: newPeriodForm.endDate,
        },
        effectiveTenantId ?? undefined
      );
      showToast('success', 'Période créée.');
      setShowNewPeriodForm(false);
      setNewPeriodForm({ name: '', type: 'TRIMESTER', periodOrder: academicPeriods.length + 1, startDate: '', endDate: '' });
      await reloadPeriods();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la création');
    } finally {
      setPeriodBusy(false);
    }
  };

  const handleActivatePeriod = async (id: string) => {
    try {
      setPeriodBusy(true);
      await settingsService.activateAcademicPeriod(id, effectiveTenantId ?? undefined);
      showToast('success', 'Période activée.');
      await reloadPeriods();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setPeriodBusy(false);
    }
  };

  const handleClosePeriod = async (id: string) => {
    try {
      setPeriodBusy(true);
      await settingsService.closeAcademicPeriod(id, effectiveTenantId ?? undefined);
      showToast('success', 'Période clôturée. Les notes et absences ne pourront plus être modifiées.');
      await reloadPeriods();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setPeriodBusy(false);
    }
  };

  const handleStartEditPeriod = (p: settingsService.AcademicPeriod) => {
    setEditingPeriodId(p.id);
    setEditingPeriodForm({
      name: p.name,
      type: p.type,
      periodOrder: p.periodOrder,
      startDate: toInputDate(p.startDate) || (typeof p.startDate === 'string' ? p.startDate.slice(0, 10) : ''),
      endDate: toInputDate(p.endDate) || (typeof p.endDate === 'string' ? p.endDate.slice(0, 10) : ''),
    });
  };

  const handleCancelEditPeriod = () => {
    setEditingPeriodId(null);
    setEditingPeriodForm(null);
  };

  const handleCreateDefaultPeriods = async () => {
    if (!periodYearId) return;
    try {
      setPeriodBusy(true);
      await settingsService.createDefaultAcademicPeriods(periodYearId, effectiveTenantId ?? undefined);
      showToast('success', 'Les 3 trimestres ont été créés. Vous pouvez les modifier ou en ajouter d\'autres.');
      await reloadPeriods();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la création');
    } finally {
      setPeriodBusy(false);
    }
  };

  const handleSavePeriodEdit = async () => {
    if (!editingPeriodId || !editingPeriodForm) return;
    if (!editingPeriodForm.name.trim() || !editingPeriodForm.startDate || !editingPeriodForm.endDate) {
      showToast('error', 'Nom et dates début/fin requis.');
      return;
    }
    try {
      setPeriodBusy(true);
      await settingsService.updateAcademicPeriod(
        editingPeriodId,
        {
          name: editingPeriodForm.name.trim(),
          type: editingPeriodForm.type,
          periodOrder: editingPeriodForm.periodOrder,
          startDate: editingPeriodForm.startDate,
          endDate: editingPeriodForm.endDate,
        },
        effectiveTenantId ?? undefined
      );
      showToast('success', 'Période mise à jour.');
      setEditingPeriodId(null);
      setEditingPeriodForm(null);
      await reloadPeriods();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setPeriodBusy(false);
    }
  };

  const handleSaveSecurity = async () => {
    try {
      setSaving(true);
      await settingsService.updateSecuritySettings(securityForm);
      showToast('success', 'Paramètres de sécurité enregistrés');
      const updated = await settingsService.getSecuritySettings();
      setSecuritySettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrion = async () => {
    try {
      setSaving(true);
      await settingsService.updateOrionSettings(orionForm);
      showToast('success', 'Paramètres ORION enregistrés');
      const updated = await settingsService.getOrionSettings();
      setOrionSettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAtlas = async () => {
    try {
      setSaving(true);
      await settingsService.updateAtlasSettings(atlasForm);
      showToast('success', 'Paramètres ATLAS enregistrés');
      const updated = await settingsService.getAtlasSettings();
      setAtlasSettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOffline = async () => {
    try {
      setSaving(true);
      await settingsService.updateOfflineSyncSettings(offlineForm);
      showToast('success', 'Paramètres offline enregistrés');
      const updated = await settingsService.getOfflineSyncSettings();
      setOfflineSyncSettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStructure = async () => {
    try {
      setSaving(true);
      await settingsService.updatePedagogicalStructure(structureForm, effectiveTenantId ?? undefined);
      showToast('success', 'Structure pédagogique enregistrée');
      const updated = await settingsService.getPedagogicalStructure(effectiveTenantId ?? undefined);
      setPedagogicalStructure(updated);
      notifySchoolLevelsUpdated();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleInitializeEducationStructure = async () => {
    try {
      setStructureBusy(true);
      const res = await settingsService.initializeEducationStructure(effectiveTenantId ?? undefined);
      setEducationStructure(res || { levels: res?.levels ?? [] });
      showToast('success', 'Structure pédagogique initialisée (niveaux, cycles, classes pédagogiques).');
      notifySchoolLevelsUpdated();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const handleSetEducationLevelEnabled = async (levelId: string, isEnabled: boolean) => {
    try {
      setStructureBusy(true);
      await settingsService.setEducationLevelEnabled(levelId, isEnabled, effectiveTenantId ?? undefined);
      const res = await settingsService.getEducationStructure(effectiveTenantId ?? undefined);
      if (res?.levels) setEducationStructure(res);
      showToast('success', isEnabled ? 'Niveau activé' : 'Niveau désactivé');
      notifySchoolLevelsUpdated();
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const structureYearIdOrActive = structureYearId || activeAcademicYear?.id;
  const handleCreateEducationClassroom = async () => {
    if (!newClassroomGradeId || !structureYearIdOrActive) {
      showToast('error', 'Sélectionnez une classe pédagogique et une année.');
      return;
    }
    const name = (newClassroomName || '').trim();
    if (!name) {
      showToast('error', 'Nom de la classe physique requis (ex. CE1 A).');
      return;
    }
    try {
      setStructureBusy(true);
      await settingsService.createEducationClassroom(
        {
          academicYearId: structureYearIdOrActive,
          gradeId: newClassroomGradeId,
          name,
          capacity: newClassroomCapacity === '' ? undefined : Number(newClassroomCapacity),
        },
        effectiveTenantId ?? undefined
      );
      setNewClassroomGradeId(null);
      setNewClassroomName('');
      setNewClassroomCapacity('');
      const list = await settingsService.getEducationClassrooms(structureYearIdOrActive, effectiveTenantId ?? undefined);
      setEducationClassrooms(Array.isArray(list) ? list : []);
      showToast('success', 'Classe physique créée.');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const handleArchiveEducationClassroom = async (id: string) => {
    try {
      setStructureBusy(true);
      await settingsService.archiveEducationClassroom(id, effectiveTenantId ?? undefined);
      if (structureYearIdOrActive) {
        const list = await settingsService.getEducationClassrooms(structureYearIdOrActive, effectiveTenantId ?? undefined);
        setEducationClassrooms(Array.isArray(list) ? list : []);
      }
      showToast('success', 'Classe archivée.');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const handleDuplicateEducationClassrooms = async () => {
    if (!structureYearIdOrActive || !academicYears.length) {
      showToast('error', 'Sélectionnez une année source.');
      return;
    }
    // Année suivante = ordre chronologique (tri par startDate)
    const sorted = [...academicYears].sort(
      (a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    const idx = sorted.findIndex((y: any) => y.id === structureYearIdOrActive);
    const nextYear = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
    if (!nextYear) {
      showToast('error', 'Aucune année scolaire suivante. Créez la prochaine année (ex. 2026-2027) pour dupliquer vers.');
      return;
    }
    try {
      setStructureBusy(true);
      const res = await settingsService.duplicateEducationClassrooms(
        structureYearIdOrActive,
        nextYear.id,
        effectiveTenantId ?? undefined
      );
      showToast('success', `${res?.duplicated ?? 0} classe(s) dupliquée(s) vers ${nextYear.name}.`);
      setStructureYearId(nextYear.id);
      const list = await settingsService.getEducationClassrooms(nextYear.id, effectiveTenantId ?? undefined);
      setEducationClassrooms(Array.isArray(list) ? list : []);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const handleUpdateEducationClassroom = async () => {
    if (!editingClassroomId || !structureYearIdOrActive) return;
    const name = (editingClassroomName || '').trim();
    if (!name) {
      showToast('error', 'Nom de la classe requis.');
      return;
    }
    const editingRow = educationClassrooms.find((x: any) => x.id === editingClassroomId);
    const isSecondCycle = editingRow?.grade?.level?.name === 'SECONDAIRE' && editingRow?.grade?.cycle?.name === '2nd cycle';
    let gradeId: string | undefined;
    if (isSecondCycle && editingClassroomSeriesCode && allGradesFromStructure.length) {
      const baseRaw = (editingRow?.grade?.name ?? '').split(' ')[0] ?? '';
      const base = baseRaw === 'Tle' ? 'Terminale' : baseRaw;
      const newGrade = allGradesFromStructure.find(
        (g: any) => g?.level?.name === 'SECONDAIRE' && g?.cycle?.name === '2nd cycle' && g.series?.code === editingClassroomSeriesCode && (g.name.startsWith(base) || g.name.startsWith(baseRaw))
      );
      if (newGrade && newGrade.id !== editingRow?.grade?.id) gradeId = newGrade.id;
    }
    try {
      setStructureBusy(true);
      await settingsService.updateEducationClassroom(
        editingClassroomId,
        {
          name,
          capacity: editingClassroomCapacity === '' ? undefined : Number(editingClassroomCapacity),
          ...(gradeId && { gradeId }),
        },
        effectiveTenantId ?? undefined
      );
      setEditingClassroomId(null);
      setEditingClassroomName('');
      setEditingClassroomCapacity('');
      setEditingClassroomSeriesCode('');
      const list = await settingsService.getEducationClassrooms(structureYearIdOrActive, effectiveTenantId ?? undefined);
      setEducationClassrooms(Array.isArray(list) ? list : []);
      showToast('success', 'Classe mise à jour.');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const handleBulkCreateClassrooms = async () => {
    if (!bulkGradeId || !structureYearIdOrActive || bulkCount < 1 || bulkCount > 30) {
      showToast('error', 'Sélectionnez un grade et un nombre de classes (1 à 30).');
      return;
    }
    const grade = allGradesFromStructure.find((g: any) => g.id === bulkGradeId);
    const prefix = grade?.name ?? '';
    const names: string[] = [];
    if (bulkSuffixType === 'letters') {
      for (let i = 0; i < bulkCount; i++) {
        names.push(`${prefix} ${String.fromCharCode(65 + i)}`.trim());
      }
    } else {
      for (let i = 1; i <= bulkCount; i++) {
        names.push(`${prefix} ${i}`.trim());
      }
    }
    const capacity = bulkCapacity === '' ? undefined : Number(bulkCapacity);
    try {
      setStructureBusy(true);
      let created = 0;
      for (const name of names) {
        await settingsService.createEducationClassroom(
          {
            academicYearId: structureYearIdOrActive,
            gradeId: bulkGradeId,
            name,
            capacity,
          },
          effectiveTenantId ?? undefined
        );
        created++;
      }
      const list = await settingsService.getEducationClassrooms(structureYearIdOrActive, effectiveTenantId ?? undefined);
      setEducationClassrooms(Array.isArray(list) ? list : []);
      showToast('success', `${created} classe(s) créée(s) : ${names.join(', ')}`);
      setShowBulkCreate(false);
      setBulkGradeId(null);
      setBulkCount(3);
      setBulkCapacity('');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur');
    } finally {
      setStructureBusy(false);
    }
  };

  const handleSaveBilingual = async () => {
    try {
      setSaving(true);
      await settingsService.updateBilingualSettings(bilingualForm, effectiveTenantId ?? undefined);
      showToast('success', 'Paramètres bilingues enregistrés');
      const updated = await settingsService.getBilingualSettings(effectiveTenantId ?? undefined);
      setBilingualSettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (featureCode: string, currentlyEnabled: boolean) => {
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      if (currentlyEnabled) {
        await settingsService.disableFeature(featureCode, 'Désactivation depuis les paramètres', tid);
      } else {
        await settingsService.enableFeature(featureCode, 'Activation depuis les paramètres', tid);
      }
      showToast('success', `Module ${currentlyEnabled ? 'désactivé' : 'activé'}`);
      const updated = await settingsService.getFeatures(tid);
      setFeatures(Array.isArray(updated) ? updated : []);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('settings:features-updated'));
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAllModules = async (enableAll: boolean) => {
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      if (enableAll) {
        const res = await settingsService.enableAllModules(undefined, tid);
        const n = typeof res?.enabled === 'number' ? res.enabled : 0;
        showToast('success', n > 0 ? `${n} module(s) activé(s)` : 'Tous les modules étaient déjà activés');
      } else {
        const res = await settingsService.disableAllModules(undefined, tid);
        const n = typeof res?.disabled === 'number' ? res.disabled : 0;
        showToast('success', n > 0 ? `${n} module(s) désactivé(s)` : 'Tous les modules étaient déjà désactivés');
      }
      const updated = await settingsService.getFeatures(tid);
      setFeatures(Array.isArray(updated) ? updated : []);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('settings:features-updated'));
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la modification');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCommunication = async () => {
    try {
      setSaving(true);
      await settingsService.updateCommunicationSettings(communicationForm);
      showToast('success', 'Paramètres de communication enregistrés');
      const updated = await settingsService.getCommunicationSettings();
      setCommunicationSettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSms = async () => {
    try {
      setSaving(true);
      await settingsService.testSms();
      showToast('success', 'SMS de test envoyé');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'envoi du SMS de test');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setSaving(true);
      await settingsService.testEmail();
      showToast('success', 'Email de test envoyé');
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'envoi de l\'email de test');
    } finally {
      setSaving(false);
    }
  };

  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleForm, setRoleForm] = useState<any>({ name: '', description: '', isSystemRole: false, canAccessOrion: false, canAccessAtlas: false, allowedLevelIds: [], permissionIds: [] });
  const [editingRolePermissionIds, setEditingRolePermissionIds] = useState<string[]>([]);
  const [editingPermissionsRoleId, setEditingPermissionsRoleId] = useState<string | null>(null);
  const [assignRoleUserId, setAssignRoleUserId] = useState<string | null>(null);
  const [permissionFilterModule, setPermissionFilterModule] = useState<string>('');
  const [matrixModuleFilter, setMatrixModuleFilter] = useState<string>('');

  const permissionsGrouped = useMemo(() => {
    const g: Record<string, { id: string; name: string; resource: string; action: string }[]> = {};
    for (const p of permissions || []) {
      const res = (p as { resource?: string }).resource ?? '';
      if (!g[res]) g[res] = [];
      g[res].push(p as { id: string; name: string; resource: string; action: string });
    }
    return g;
  }, [permissions]);

  /** Libellés des modules pour la matrice (RBAC) */
  const RESOURCE_LABELS: Record<string, string> = {
    ELEVES: 'Élèves & Scolarité',
    INSCRIPTIONS: 'Inscriptions',
    DOCUMENTS_SCOLAIRES: 'Documents scolaires',
    ORGANISATION_PEDAGOGIQUE: 'Organisation pédagogique',
    MATERIEL_PEDAGOGIQUE: 'Matériel pédagogique',
    EXAMENS: 'Examens',
    BULLETINS: 'Notes & Bulletins',
    FINANCES: 'Finances & Économat',
    RECOUVREMENT: 'Recouvrement',
    DEPENSES: 'Dépenses',
    RH: 'Personnel, RH & Paie',
    PAIE: 'Paie',
    COMMUNICATION: 'Communication',
    PARAMETRES: 'Paramètres',
    ANNEES_SCOLAIRES: 'Années scolaires',
    ORION: 'ORION',
    ATLAS: 'ATLAS',
    QHSE: 'QHSE',
    BIBLIOTHEQUE: 'Bibliothèque',
    TRANSPORT: 'Transport',
    CANTINE: 'Cantine',
    INFIRMERIE: 'Infirmerie',
    EDUCAST: 'EduCast',
    BOUTIQUE: 'Boutique',
  };

  /** Rôles plateforme (PLATFORM_OWNER, PLATFORM_ADMIN) vs rôles école (tenant + autres système) */
  const { platformRoles, schoolRoles } = useMemo(() => {
    const list = Array.isArray(roles) ? roles : [];
    const platformNames = ['PLATFORM_OWNER', 'PLATFORM_ADMIN'];
    const platform = list.filter((r: any) => platformNames.includes(r.name));
    const school = list.filter((r: any) => !platformNames.includes(r.name));
    return { platformRoles: platform, schoolRoles: school };
  }, [roles]);

  const handleInitializeRbac = async () => {
    try {
      setSaving(true);
      await settingsService.ensureRbacInitialized();
      showToast('success', 'Rôles et permissions initialisés');
      const tid = effectiveTenantId ?? undefined;
      const [rolesAfter, permsAfter, usersAfter] = await Promise.all([
        settingsService.getRoles(tid).catch(() => []),
        settingsService.getPermissions().catch(() => []),
        effectiveTenantId ? settingsService.getUsersWithRoles(tid).catch(() => []) : Promise.resolve([]),
      ]);
      setRoles(Array.isArray(rolesAfter) ? rolesAfter : []);
      setPermissions(Array.isArray(permsAfter) ? permsAfter : []);
      if (Array.isArray(usersAfter)) setUsersWithRoles(usersAfter);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'initialisation RBAC');
    } finally {
      setSaving(false);
    }
  };

  /** Pour la matrice : ensemble des permissionIds par rôle */
  const rolePermissionSet = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const r of Array.isArray(roles) ? roles : []) {
      m[r.id] = new Set((r.rolePermissions || []).map((rp: any) => rp.permissionId));
    }
    return m;
  }, [roles]);

  const handleCreateRole = async () => {
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      await settingsService.createRole(roleForm, tid);
      showToast('success', 'Rôle créé avec succès');
      const updated = await settingsService.getRoles(tid);
      setRoles(updated || []);
      setRoleForm({ name: '', description: '', isSystemRole: false, canAccessOrion: false, canAccessAtlas: false, allowedLevelIds: [], permissionIds: [] });
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la création du rôle');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      await settingsService.updateRole(roleId, editingRole, tid);
      showToast('success', 'Rôle mis à jour');
      const updated = await settingsService.getRoles(tid);
      setRoles(updated || []);
      setEditingRole(null);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce rôle ?')) return;
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      await settingsService.deleteRole(roleId, tid);
      showToast('success', 'Rôle supprimé');
      const updated = await settingsService.getRoles(tid);
      setRoles(updated || []);
    } catch (error: any) {
      showToast('error', error.message || 'Impossible de supprimer ce rôle');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRolePermissions = async (roleId: string) => {
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      await settingsService.updateRolePermissions(roleId, editingRolePermissionIds, tid);
      showToast('success', 'Permissions enregistrées');
      const updated = await settingsService.getRoles(tid);
      setRoles(Array.isArray(updated) ? updated : []);
      const role = Array.isArray(updated) ? updated.find((r: any) => r.id === roleId) : null;
      setEditingRolePermissionIds(role?.rolePermissions?.map((rp: any) => rp.permissionId) ?? []);
      setEditingPermissionsRoleId(null);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement des permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignRole = async (userId: string, roleId: string) => {
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      await settingsService.assignRoleToUser(userId, roleId, tid);
      showToast('success', 'Rôle attribué');
      const updated = await settingsService.getUsersWithRoles(tid);
      setUsersWithRoles(Array.isArray(updated) ? updated : []);
      setAssignRoleUserId(null);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'attribution');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeRole = async (userId: string, roleId: string) => {
    if (!confirm('Révoquer ce rôle pour cet utilisateur ?')) return;
    try {
      setSaving(true);
      const tid = effectiveTenantId ?? undefined;
      await settingsService.revokeRoleFromUser(userId, roleId, tid);
      showToast('success', 'Rôle révoqué');
      const updated = await settingsService.getUsersWithRoles(tid);
      setUsersWithRoles(Array.isArray(updated) ? updated : []);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la révocation');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBilling = async () => {
    try {
      setSaving(true);
      await settingsService.updateBillingSettings({
        billingCycle: billingForm.billingCycle,
        autoRenew: billingForm.autoRenew,
      });
      showToast('success', 'Paramètres de facturation enregistrés');
      const updated = await settingsService.getBillingSettings();
      setBillingSettings(updated);
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePlan = async (planCode: string) => {
    if (!confirm('Êtes-vous sûr de vouloir changer de plan ?')) return;
    try {
      setSaving(true);
      await settingsService.changePlan(planCode);
      showToast('success', 'Plan changé avec succès');
      const updated = await settingsService.getBillingSettings();
      setBillingSettings(updated);
      setBillingForm(updated || {});
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors du changement de plan');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'identity' as TabId, label: 'Identité', icon: Globe },
    { id: 'academic-year' as TabId, label: 'Année scolaire', icon: Calendar },
    { id: 'structure' as TabId, label: 'Structure', icon: GraduationCap },
    { id: 'bilingual' as TabId, label: 'Bilingue', icon: Languages },
    { id: 'features' as TabId, label: 'Modules', icon: ToggleLeft },
    { id: 'roles' as TabId, label: 'Rôles', icon: UserCog },
    { id: 'communication' as TabId, label: 'Communication', icon: Mail },
    { id: 'billing' as TabId, label: 'Facturation', icon: CreditCard },
    { id: 'security' as TabId, label: 'Sécurité', icon: Shield },
    { id: 'seals' as TabId, label: 'Cachets', icon: Stamp },
    { id: 'orion' as TabId, label: 'ORION', icon: Brain },
    { id: 'atlas' as TabId, label: 'ATLAS', icon: MessageSquare },
    { id: 'offline' as TabId, label: 'Offline', icon: CloudOff },
    { id: 'appareils' as TabId, label: 'Appareils autorisés', icon: Smartphone },
    { id: 'history' as TabId, label: 'Historique', icon: History },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'identity':
        return (
          <div className="space-y-4">
            {/* Header avec version actuelle */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold">Source Légale de Vérité</h3>
                  <p className="text-blue-100 text-sm">Identité institutionnelle versionnée</p>
                </div>
                <div className="text-right">
                  {identityProfile && (
                    <>
                      <div className="text-2xl font-bold">v{identityProfile.version}</div>
                      <div className="text-xs text-blue-200">
                        {identityProfile.activatedAt && new Date(identityProfile.activatedAt).toLocaleDateString('fr-FR')}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowVersionHistory(!showVersionHistory)}
                className="mt-2 text-sm text-blue-200 hover:text-white underline"
              >
                {showVersionHistory ? 'Masquer l\'historique' : 'Voir l\'historique des versions'}
              </button>
            </div>

            {/* Historique des versions */}
            {showVersionHistory && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Historique des versions</h4>
                {identityVersions.length === 0 ? (
                  <p className="text-gray-500 text-sm">Aucune version antérieure</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {identityVersions.map((v: any) => (
                      <div key={v.id} className={`flex justify-between items-center p-2 rounded ${v.isActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                        <div>
                          <span className="font-medium">v{v.version}</span>
                          <span className="text-sm text-gray-600 ml-2">{v.schoolName}</span>
                          {v.isActive && <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded">Active</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{new Date(v.createdAt).toLocaleDateString('fr-FR')}</span>
                          {!v.isActive && (
                            <button onClick={() => handleRestoreVersion(v.id, v.version)} className="text-xs text-blue-600 hover:underline">
                              Restaurer
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 1: Informations Légales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                1. Informations Légales
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom officiel *</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.schoolName || ''} onChange={(e) => setIdentityForm({ ...identityForm, schoolName: e.target.value })} placeholder="Collège d'Enseignement Général de Porto-Novo" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Sigle</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.schoolAcronym || ''} onChange={(e) => setIdentityForm({ ...identityForm, schoolAcronym: e.target.value })} placeholder="CEG PN" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.schoolType || 'PRIVEE'} onChange={(e) => setIdentityForm({ ...identityForm, schoolType: e.target.value })}>
                    <option value="PUBLIQUE">Publique</option>
                    <option value="PRIVEE">Privée</option>
                    <option value="CONFESSIONNELLE">Confessionnelle</option>
                    <option value="INSTITUT">Institut</option>
                    <option value="UNIVERSITE">Université</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">N° Autorisation</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.authorizationNumber || ''} onChange={(e) => setIdentityForm({ ...identityForm, authorizationNumber: e.target.value })} placeholder="MEMP/2024/001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date de création</label>
                  <input type="date" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.foundationDate || ''} onChange={(e) => setIdentityForm({ ...identityForm, foundationDate: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.devise || ''} onChange={(e) => setIdentityForm({ ...identityForm, devise: e.target.value })} placeholder="Discipline - Fraternité - Travail" />
                </div>
              </div>
            </div>

            {/* Section 2: Contacts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-green-600" />
                2. Contacts
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tél. principal</label>
                  <input type="tel" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.phonePrimary || ''} onChange={(e) => setIdentityForm({ ...identityForm, phonePrimary: e.target.value })} placeholder="01 XX XX XX XX" maxLength={14} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tél. secondaire</label>
                  <input type="tel" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.phoneSecondary || ''} onChange={(e) => setIdentityForm({ ...identityForm, phoneSecondary: e.target.value })} placeholder="01 XX XX XX XX" maxLength={14} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email officiel</label>
                  <input type="email" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.email || ''} onChange={(e) => setIdentityForm({ ...identityForm, email: e.target.value })} placeholder="contact@ecole.bj" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Site web</label>
                  <input type="url" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.website || ''} onChange={(e) => setIdentityForm({ ...identityForm, website: e.target.value })} placeholder="https://www.ecole.bj" />
                </div>
              </div>
            </div>

            {/* Section 3: Localisation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-purple-600" />
                3. Localisation
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pays</label>
                  <div className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                    {(() => {
                      const countryMap: Record<string, string> = {
                        'BJ': '🇧🇯 Bénin',
                        'TG': '🇹🇬 Togo',
                        'CI': '🇨🇮 Côte d\'Ivoire'
                      };
                      return countryMap[identityForm.country] || '🇧🇯 Bénin';
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Département / Région</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.department || ''} onChange={(e) => setIdentityForm({ ...identityForm, department: e.target.value })} placeholder="Ouémé" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ville</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.city || ''} onChange={(e) => setIdentityForm({ ...identityForm, city: e.target.value })} placeholder="Porto-Novo" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Code postal</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.postalCode || ''} onChange={(e) => setIdentityForm({ ...identityForm, postalCode: e.target.value })} placeholder="01 BP 123" />
                </div>
                <div className="col-span-2 md:col-span-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Adresse complète</label>
                  <input type="text" className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.address || ''} onChange={(e) => setIdentityForm({ ...identityForm, address: e.target.value })} placeholder="Quartier Djègandji, Rue 123, Lot 456" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fuseau horaire</label>
                  <select className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.timezone || 'Africa/Porto-Novo'} onChange={(e) => setIdentityForm({ ...identityForm, timezone: e.target.value })}>
                    <option value="Africa/Porto-Novo">🇧🇯 Porto-Novo (UTC+1)</option>
                    <option value="Africa/Lome">🇹🇬 Lomé (UTC+0)</option>
                    <option value="Africa/Abidjan">🇨🇮 Abidjan (UTC+0)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monnaie</label>
                  <select className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={identityForm.currency || 'XOF'} onChange={(e) => setIdentityForm({ ...identityForm, currency: e.target.value })}>
                    <option value="XOF">XOF - Franc CFA (FCFA)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Branding Officiel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Image className="w-4 h-4 text-orange-600" />
                4. Branding Officiel
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                  {identityForm.logoUrl ? (
                    <NextImage src={identityForm.logoUrl} alt="Logo" width={64} height={64} className="mx-auto object-contain mb-2" unoptimized loading="lazy" />
                  ) : (
                    <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  )}
                  <p className="text-xs font-medium text-gray-700 mb-2">Logo officiel</p>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">
                    <Upload className="w-3 h-3" /> Téléverser
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdentityForm({ ...identityForm, logoUrl: r.result as string }); r.readAsDataURL(f); }}} />
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Cachets et signatures : configurés par niveau scolaire dans l&apos;onglet <strong>Cachets</strong>.
              </p>
            </div>

            {/* Section 5: Aperçu Document */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                5. Aperçu Document Officiel
              </h4>
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start gap-4 mb-4">
                  {identityForm.logoUrl && <NextImage src={identityForm.logoUrl} alt="Logo" width={64} height={64} className="object-contain" unoptimized loading="lazy" />}
                  <div className="flex-1">
                    <h5 className="font-bold text-lg">{identityForm.schoolName || 'Nom de l\'établissement'}</h5>
                    {identityForm.schoolAcronym && <p className="text-sm text-gray-600">({identityForm.schoolAcronym})</p>}
                    <p className="text-xs text-gray-500 italic">{identityForm.devise || 'Devise de l\'établissement'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t pt-2">
                  <div>Adresse : {identityForm.address || '-'}, {identityForm.city || '-'}</div>
                  <div>Tél : {identityForm.phonePrimary || '-'}</div>
                  <div>Email : {identityForm.email || '-'}</div>
                  <div>N° Auth. : {identityForm.authorizationNumber || '-'}</div>
                </div>
                <div className="flex justify-end gap-4 mt-4 pt-2 border-t text-xs text-gray-500">
                  Cachets et signatures du niveau sélectionné dans l&apos;app sont utilisés sur les documents (onglet Cachets).
                </div>
              </div>
            </div>

            {/* Sauvegarde avec raison obligatoire */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 font-medium">Modification versionnée</p>
                  <p className="text-xs text-yellow-700 mb-2">Chaque modification crée une nouvelle version. Indiquez la raison du changement.</p>
                  <input
                    type="text"
                    className="w-full px-3 py-2 text-sm border border-yellow-300 rounded-md focus:ring-2 focus:ring-yellow-500"
                    placeholder="Raison de la modification (obligatoire)"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleSaveIdentity}
                  disabled={saving || !changeReason.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Créer une nouvelle version
                </button>
              </div>
            </div>
          </div>
        );

      case 'academic-year':
        return (
          <div className="space-y-6">
            {/* Sélecteur d'établissement pour Plateforme Owner */}
            {isPlatformOwner && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-amber-900 mb-2">Établissement à gérer</h3>
                {!effectiveTenantId ? (
                  <>
                    <p className="text-sm text-amber-800 mb-3">
                      Sélectionnez un établissement pour voir et gérer ses années scolaires.
                    </p>
                    {loadingTenantsPO ? (
                      <div className="flex items-center gap-2 text-amber-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Chargement des établissements…</span>
                      </div>
                    ) : availableTenantsForPO.length > 0 ? (
                      <select
                        className="w-full max-w-md px-3 py-2 border border-amber-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        value=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) router.push(`${pathname}?tenant_id=${encodeURIComponent(id)}`);
                        }}
                      >
                        <option value="">— Choisir un établissement —</option>
                        {availableTenantsForPO.map((t) => (
                          <option key={t.tenantId} value={t.tenantId}>
                            {t.name || t.tenantId}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-amber-700">Aucun établissement accessible. Ajoutez <code className="bg-amber-100 px-1 rounded">?tenant_id=xxx</code> dans l’URL.</p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-amber-800">
                      Établissement : <strong>{availableTenantsForPO.find((t) => t.tenantId === effectiveTenantId)?.name || effectiveTenantId}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push(pathname)}
                      className="text-sm text-amber-700 hover:text-amber-900 underline"
                    >
                      Changer
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Message si aucun établissement en contexte (non-PO) */}
            {!isPlatformOwner && !effectiveTenantId && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  Contexte établissement manquant. Reconnectez-vous ou{' '}
                  <a href="/auth/select-tenant" className="font-medium text-amber-900 underline hover:no-underline">
                    sélectionnez un établissement
                  </a>
                  .
                </p>
              </div>
            )}

            {/* Carte Année active */}
            <div className="min-h-[140px] bg-blue-900 bg-gradient-to-r from-blue-900 to-blue-800 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-5 h-5 text-white/80 shrink-0" aria-hidden />
                <h3 className="text-lg font-bold">Année scolaire en cours</h3>
              </div>
              <p className="text-white/90 text-sm mb-4 ml-7">Contexte par défaut pour toutes les données (élèves, notes, finances, KPI)</p>
              {activeAcademicYear ? (
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <div className="text-2xl font-bold">{activeAcademicYear.name}</div>
                    <div className="text-white/90 text-sm">{activeAcademicYear.label}</div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-white/80 shrink-0" aria-hidden />
                      <strong>Pré-rentrée :</strong>{' '}
                      {formatAcademicDate(activeAcademicYear.preEntryDate, { weekday: true })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-white/80 shrink-0" aria-hidden />
                      <strong>Rentrée (début des activités pédagogiques) :</strong>{' '}
                      {formatAcademicDate(activeAcademicYear.officialStartDate ?? activeAcademicYear.startDate, { weekday: true })}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-white/80 shrink-0" aria-hidden />
                      <strong>Fin (dernier jour de classe) :</strong>{' '}
                      {formatAcademicDate(activeAcademicYear.endDate)}
                    </span>
                  </div>
                  {activeAcademicYear._count && (
                    <div className="inline-flex items-center gap-2 text-white/90 text-sm">
                      <UserCircle className="w-4 h-4 text-white/80 shrink-0" aria-hidden />
                      <span>{activeAcademicYear._count.students ?? 0} élèves</span>
                      <span className="text-white/70">·</span>
                      <School className="w-4 h-4 text-white/80 shrink-0" aria-hidden />
                      <span>{activeAcademicYear._count.classes ?? 0} classes</span>
                    </div>
                  )}
                  <div className="w-full mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleStartEditAcademicYearDates(activeAcademicYear)}
                      disabled={editingYearBusy}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white text-blue-900 rounded-md hover:bg-blue-100 disabled:opacity-50"
                      title="Modifier la pré-rentrée, la rentrée et la fin d’année"
                    >
                      <CalendarRange className="w-4 h-4" aria-hidden />
                      Modifier les dates
                    </button>
                    <span className="text-white/80 text-xs">Pré-rentrée, rentrée officielle, fin d’année</span>
                  </div>
                </div>
              ) : (
                <div className="text-white/90 ml-7">
                  Aucune année active. Créez une année ou activez-en une dans l’historique ci-dessous.
                </div>
              )}
            </div>

            {/* Formulaire modification des dates */}
            {editingYearId && editingYearForm && (() => {
              const editingYear = activeAcademicYear?.id === editingYearId ? activeAcademicYear : academicYears.find((y: any) => y.id === editingYearId);
              return (
                <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-sm p-5">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Modifier les dates — {editingYear?.name ?? editingYearId}
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">Ajustez les dates ci-dessous puis cliquez sur Enregistrer.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pré-rentrée</label>
                      <input
                        type="date"
                        value={editingYearForm.preEntryDate}
                        onChange={(e) => setEditingYearForm({ ...editingYearForm, preEntryDate: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rentrée officielle</label>
                      <input
                        type="date"
                        value={editingYearForm.officialStartDate}
                        onChange={(e) => setEditingYearForm({ ...editingYearForm, officialStartDate: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Début (activités)</label>
                      <input
                        type="date"
                        value={editingYearForm.startDate}
                        onChange={(e) => setEditingYearForm({ ...editingYearForm, startDate: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fin (dernier jour)</label>
                      <input
                        type="date"
                        value={editingYearForm.endDate}
                        onChange={(e) => setEditingYearForm({ ...editingYearForm, endDate: e.target.value })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAcademicYearDates}
                      disabled={editingYearBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {editingYearBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}
                      Enregistrer
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEditAcademicYearDates}
                      disabled={editingYearBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Confirmation critique */}
            {(academicYearAction === 'generate' || (academicYearAction && academicYearTargetId)) && (
              <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  {academicYearAction === 'generate' && (
                    <p className="text-gray-900 font-medium">Générer la prochaine année scolaire ?</p>
                  )}
                  {academicYearAction === 'activate' && academicYearTargetId && (
                    <p className="text-gray-900 font-medium">Activer cette année ? Toutes les nouvelles données y seront rattachées.</p>
                  )}
                  {academicYearAction === 'close' && academicYearTargetId && (
                    <p className="text-gray-900 font-medium">Clôturer cette année ? Elle passera en lecture seule.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelAcademicYearAction}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-200"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmAcademicYearAction}
                    disabled={academicYearBusy}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {academicYearBusy ? 'En cours…' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}

            {/* Actions globales */}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleGenerateNextAcademicYear}
                disabled={academicYearBusy}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium shadow-sm"
              >
                <RefreshCw className="w-4 h-4 shrink-0" aria-hidden />
                Préparer la prochaine année
              </button>
            </div>

            {/* Historique des années */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[200px]">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                Historique des années
              </h3>
              {academicYears.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden />
                  <p>Aucune année scolaire. Cliquez sur « Préparer la prochaine année » pour en créer une.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {academicYears.map((year) => (
                    <div
                      key={year.id}
                      className={`p-4 border rounded-lg flex flex-wrap items-center justify-between gap-3 ${
                        year.isActive ? 'border-blue-600 bg-blue-50' : year.isClosed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" aria-hidden />
                          <div>
                            <h4 className="font-semibold text-gray-900">{year.name}</h4>
                            <p className="text-sm text-gray-600">{year.label}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Pré-rentrée : {formatAcademicDate(year.preEntryDate)} · Rentrée : {formatAcademicDate(year.officialStartDate ?? year.startDate)} · Fin : {formatAcademicDate(year.endDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {year.isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium">
                              <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              Active
                            </span>
                          )}
                          {year.isClosed && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded-full">
                              <Archive className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              Clôturée
                            </span>
                          )}
                          {year._count && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <UserCircle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              {year._count.students ?? 0} élèves
                              <School className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              {year._count.classes ?? 0} classes
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditAcademicYearDates(year)}
                          disabled={editingYearBusy}
                          title="Modifier les dates (pré-rentrée, rentrée, fin)"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CalendarRange className="w-3.5 h-3.5" aria-hidden />
                          Modifier les dates
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (year.isActive) return;
                            setAcademicYearAction('activate');
                            setAcademicYearTargetId(year.id);
                          }}
                          disabled={academicYearBusy || year.isActive}
                          title={year.isActive ? 'Cette année est déjà active' : 'Rendre cette année active'}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                          Activer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (year.isActive || year.isClosed) return;
                            setAcademicYearAction('close');
                            setAcademicYearTargetId(year.id);
                          }}
                          disabled={academicYearBusy || year.isActive || year.isClosed}
                          title={
                            year.isActive
                              ? 'Activez une autre année avant de clôturer celle-ci'
                              : year.isClosed
                                ? 'Cette année est déjà clôturée'
                                : 'Clôturer cette année (lecture seule)'
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Archive className="w-3.5 h-3.5" aria-hidden />
                          Clôturer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Périodes académiques (trimestres / semestres) */}
            {academicYears.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-blue-600 shrink-0" aria-hidden />
                  Périodes académiques
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Définissez les trimestres, semestres ou séquences pour les notes, bulletins et statistiques. Une seule période peut être active à la fois.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année scolaire</label>
                  <select
                    value={periodYearId ?? ''}
                    onChange={(e) => {
                      setPeriodYearId(e.target.value || null);
                      setEditingPeriodId(null);
                      setEditingPeriodForm(null);
                    }}
                    className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner une année</option>
                    {academicYears.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.name} — {y.label}</option>
                    ))}
                  </select>
                </div>
                {periodYearId && (
                  <>
                    {!showNewPeriodForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewPeriodForm(true);
                          setNewPeriodForm({
                            name: '',
                            type: 'TRIMESTER',
                            periodOrder: academicPeriods.length + 1,
                            startDate: academicYears.find((y: any) => y.id === periodYearId)?.startDate ? toInputDate(academicYears.find((y: any) => y.id === periodYearId).startDate) : '',
                            endDate: academicYears.find((y: any) => y.id === periodYearId)?.endDate ? toInputDate(academicYears.find((y: any) => y.id === periodYearId).endDate) : '',
                          });
                        }}
                        disabled={periodBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 mb-4"
                      >
                        <CalendarRange className="w-3.5 h-3.5" aria-hidden />
                        Ajouter une période
                      </button>
                    ) : (
                      <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-3">Nouvelle période</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
                  <input
                    type="text"
                              value={newPeriodForm.name}
                              onChange={(e) => setNewPeriodForm({ ...newPeriodForm, name: e.target.value })}
                              placeholder="ex. Trimestre 1"
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                              value={newPeriodForm.type}
                              onChange={(e) => setNewPeriodForm({ ...newPeriodForm, type: e.target.value as settingsService.AcademicPeriodType })}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            >
                              <option value="TRIMESTER">Trimestre</option>
                              <option value="SEMESTER">Semestre</option>
                              <option value="SEQUENCE">Séquence</option>
                              <option value="CUSTOM">Personnalisé</option>
                  </select>
                </div>
                <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Ordre</label>
                            <input
                              type="number"
                              min={1}
                              value={newPeriodForm.periodOrder}
                              onChange={(e) => setNewPeriodForm({ ...newPeriodForm, periodOrder: parseInt(e.target.value, 10) || 1 })}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-2 lg:col-span-1" />
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
                            <input
                              type="date"
                              value={newPeriodForm.startDate}
                              onChange={(e) => setNewPeriodForm({ ...newPeriodForm, startDate: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
                            <input
                              type="date"
                              value={newPeriodForm.endDate}
                              onChange={(e) => setNewPeriodForm({ ...newPeriodForm, endDate: e.target.value })}
                              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleCreatePeriod}
                            disabled={periodBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            {periodBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
                            Créer
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowNewPeriodForm(false)}
                            disabled={periodBusy}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Bouton visible uniquement quand l'année sélectionnée n'a aucune période (trimestres/semestres) */}
                    {academicPeriods.length === 0 ? (
                      <div className="py-4 space-y-3">
                        <p className="text-sm text-gray-500">Aucune période pour cette année.</p>
                        <button
                          type="button"
                          onClick={handleCreateDefaultPeriods}
                          disabled={periodBusy}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {periodBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CalendarRange className="w-4 h-4" aria-hidden />}
                          Créer les 3 trimestres par défaut
                        </button>
                        <p className="text-xs text-gray-400">Ou ajoutez une période manuellement avec le bouton ci-dessus.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {academicPeriods.map((p) => (
                          <div
                            key={p.id}
                            className={`p-3 border rounded-lg flex flex-wrap items-center justify-between gap-2 ${
                              p.isActive ? 'border-blue-600 bg-blue-50' : p.isClosed ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
                            }`}
                          >
                            {editingPeriodId === p.id && editingPeriodForm ? (
                              <div className="w-full space-y-3">
                                <h4 className="font-medium text-gray-900">Modifier la période</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
                                    <input
                                      type="text"
                                      value={editingPeriodForm.name}
                                      onChange={(e) => setEditingPeriodForm({ ...editingPeriodForm, name: e.target.value })}
                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                  <select
                                      value={editingPeriodForm.type}
                                      onChange={(e) => setEditingPeriodForm({ ...editingPeriodForm, type: e.target.value as settingsService.AcademicPeriodType })}
                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                    >
                                      <option value="TRIMESTER">Trimestre</option>
                                      <option value="SEMESTER">Semestre</option>
                                      <option value="SEQUENCE">Séquence</option>
                                      <option value="CUSTOM">Personnalisé</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ordre</label>
                                    <input
                                      type="number"
                                      min={1}
                                      value={editingPeriodForm.periodOrder}
                                      onChange={(e) => setEditingPeriodForm({ ...editingPeriodForm, periodOrder: parseInt(e.target.value, 10) || 1 })}
                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div />
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
                                    <input
                                      type="date"
                                      value={editingPeriodForm.startDate}
                                      onChange={(e) => setEditingPeriodForm({ ...editingPeriodForm, startDate: e.target.value })}
                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
                                    <input
                                      type="date"
                                      value={editingPeriodForm.endDate}
                                      onChange={(e) => setEditingPeriodForm({ ...editingPeriodForm, endDate: e.target.value })}
                                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleSavePeriodEdit}
                                    disabled={periodBusy}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {periodBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
                                    Enregistrer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditPeriod}
                                    disabled={periodBusy}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">{p.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {p.type === 'TRIMESTER' ? 'Trimestre' : p.type === 'SEMESTER' ? 'Semestre' : p.type === 'SEQUENCE' ? 'Séquence' : 'Personnalisé'}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {toInputDate(p.startDate) || p.startDate} → {toInputDate(p.endDate) || p.endDate}
                                  </span>
                                  {p.isActive && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded font-medium">
                                      <CheckCircle className="w-3 h-3" aria-hidden /> Active
                                    </span>
                                  )}
                                  {p.isClosed && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 rounded">
                                      <Lock className="w-3 h-3" aria-hidden /> Clôturée
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditPeriod(p)}
                                    disabled={periodBusy || p.isClosed}
                                    title={p.isClosed ? 'Période clôturée : modification impossible' : 'Modifier nom, type, ordre et dates'}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Modifier
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleActivatePeriod(p.id)}
                                    disabled={periodBusy || p.isActive || p.isClosed}
                                    title={p.isClosed ? 'Période clôturée' : p.isActive ? 'Déjà active' : 'Activer cette période'}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Activer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClosePeriod(p.id)}
                                    disabled={periodBusy || p.isClosed}
                                    title={p.isClosed ? 'Déjà clôturée' : 'Clôturer (bloque les modifications notes/absences)'}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Clôturer
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 'structure':
        const levels = educationStructure?.levels ?? [];
        const allGrades = allGradesFromStructure;
        const isSecondCycleSecondary = (g: any) => g?.level?.name === 'SECONDAIRE' && g?.cycle?.name === '2nd cycle';
        const selectedGradeForClassroom = newClassroomGradeId ? allGrades.find((g: any) => g.id === newClassroomGradeId) : null;
        const selectedGradeForBulk = bulkGradeId ? allGrades.find((g: any) => g.id === bulkGradeId) : null;
        const showSeriesReminderAdd = selectedGradeForClassroom && isSecondCycleSecondary(selectedGradeForClassroom);
        const showSeriesReminderBulk = selectedGradeForBulk && isSecondCycleSecondary(selectedGradeForBulk);
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Structure pédagogique</h3>
              <p className="text-sm text-gray-600 mb-2">
                Hiérarchie académique officielle (élèves, notes, bulletins et ORION en dépendent) :
              </p>
              <p className="text-xs text-gray-500 mb-4">
                École → Année scolaire → Niveau (Maternelle / Primaire / Secondaire) → Cycle → Classe pédagogique (CE1, 6ème…) → Classe physique (CE1 A, CE1 B, 6ème 2…).
              </p>
              {levels.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-gray-600 mb-4">Aucune structure. Initialisez les niveaux, cycles et classes pédagogiques par défaut.</p>
                  <button
                    type="button"
                    onClick={handleInitializeEducationStructure}
                    disabled={structureBusy}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {structureBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
                    Initialiser la structure par défaut
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {levels.map((level: any) => (
                    <div key={level.id} className={`border rounded-lg overflow-hidden ${level.isEnabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                        <span className="font-semibold text-gray-900">{level.name}</span>
                        <button
                          type="button"
                          onClick={() => handleSetEducationLevelEnabled(level.id, !level.isEnabled)}
                          disabled={structureBusy}
                          className="p-1"
                        >
                          {level.isEnabled ? (
                            <ToggleRight className="w-6 h-6 text-green-600" title="Désactiver le niveau" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" title="Activer le niveau" />
                          )}
                        </button>
                      </div>
                      {level.isEnabled && level.cycles?.length > 0 && (
                        <div className="p-3 space-y-2">
                          {level.cycles.map((cycle: any) => (
                            <div key={cycle.id} className="ml-2">
                              <div className="text-sm font-medium text-gray-700 mb-1">{cycle.name}</div>
                              <div className="flex flex-wrap gap-2 ml-2">
                                {(cycle.grades || []).map((grade: any) => (
                                  <span key={grade.id} className="inline-flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-sm">
                                      {formatGradeLabel(grade.name)}
                                    </span>
                                    {grade.series && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-medium" title="Série">
                                        Série {grade.series.code}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {levels.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Classes physiques (par année)</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Créez les classes réelles (CE1 A, CE1 B, 6ème 1…) pour chaque année scolaire. Une classe physique dépend d&apos;une année et d&apos;un grade.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Année scolaire</label>
                  <select
                    value={structureYearIdOrActive ?? ''}
                    onChange={(e) => setStructureYearId(e.target.value || null)}
                    className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">Sélectionner une année</option>
                    {academicYears.map((y: any) => (
                      <option key={y.id} value={y.id}>{y.name}</option>
                    ))}
                  </select>
                </div>
                {structureYearIdOrActive && (
                  <>
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <select
                        value={newClassroomGradeId ?? ''}
                        onChange={(e) => setNewClassroomGradeId(e.target.value || null)}
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="">Classe pédagogique (grade)</option>
                        {allGrades.map((g) => (
                          <option key={g.id} value={g.id}>{g.level.name} → {g.cycle.name} → {formatGradeLabel(g.name)}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newClassroomName}
                        onChange={(e) => setNewClassroomName(e.target.value)}
                        placeholder="ex. CE1 A, 6ème 2"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm w-40"
                      />
                      <input
                        type="number"
                        min={1}
                        value={newClassroomCapacity}
                        onChange={(e) => setNewClassroomCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                        placeholder="Capacité (opt.)"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm w-24"
                      />
                        <button
                        type="button"
                        onClick={handleCreateEducationClassroom}
                        disabled={structureBusy || !newClassroomGradeId || !newClassroomName.trim() || (showSeriesReminderAdd && !selectedGradeForClassroom?.series?.code && !selectedSecondCycleSeriesCode)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {structureBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Ajouter la classe
                      </button>
                    </div>
                    {showSeriesReminderAdd && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Série (2nd cycle secondaire) <span className="text-amber-600">*</span></label>
                        <select
                          value={selectedGradeForClassroom?.series?.code ?? selectedSecondCycleSeriesCode ?? ''}
                          onChange={(e) => {
                            const code = e.target.value;
                            if (!selectedGradeForClassroom) return;
                            if (!code) {
                              setSelectedSecondCycleSeriesCode('');
                              return;
                            }
                            const base = selectedGradeForClassroom.name.split(' ')[0];
                            const newGrade = allGrades.find(
                              (g: any) => g?.level?.name === 'SECONDAIRE' && g?.cycle?.name === '2nd cycle' && g.name.startsWith(base) && g.series?.code === code
                            );
                            if (newGrade) {
                              setNewClassroomGradeId(newGrade.id);
                              setSelectedSecondCycleSeriesCode('');
                            } else {
                              setSelectedSecondCycleSeriesCode(code);
                            }
                          }}
                          className="rounded-md border border-amber-300 bg-amber-50/50 px-3 py-2 text-sm w-48"
                        >
                          <option value="">Choisir la série</option>
                          {secondCycleSeriesOptions.map((s: any) => (
                            <option key={s.code} value={s.code}>{s.code} — {s.name ?? s.code}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Obligatoire pour le 2nd cycle secondaire (A1, A2, B, C, D).</p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => setShowBulkCreate(!showBulkCreate)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Création multiple
                      </button>
                      <button
                        type="button"
                        onClick={handleDuplicateEducationClassrooms}
                        disabled={structureBusy || academicYears.length < 2}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Dupliquer les classes vers l&apos;année suivante
                      </button>
                    </div>
                    {showBulkCreate && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Créer plusieurs classes d&apos;un coup</h4>
                        <div className="flex flex-wrap items-center gap-3">
                          <select
                            value={bulkGradeId ?? ''}
                            onChange={(e) => setBulkGradeId(e.target.value || null)}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="">Classe pédagogique (grade)</option>
                            {allGrades.map((g: any) => (
                              <option key={g.id} value={g.id}>{g.level.name} → {g.cycle.name} → {formatGradeLabel(g.name)}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-sm">
                            <span>Nombre :</span>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={bulkCount}
                              onChange={(e) => setBulkCount(Math.min(30, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                              className="rounded-md border border-gray-300 px-2 py-1.5 w-16 text-sm"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <span>Suffixe :</span>
                            <select
                              value={bulkSuffixType}
                              onChange={(e) => setBulkSuffixType(e.target.value as 'letters' | 'numbers')}
                              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            >
                              <option value="letters">Lettres (A, B, C…)</option>
                              <option value="numbers">Chiffres (1, 2, 3…)</option>
                            </select>
                          </label>
                          <input
                            type="number"
                            min={1}
                            placeholder="Capacité (opt.)"
                            value={bulkCapacity}
                            onChange={(e) => setBulkCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                            className="rounded-md border border-gray-300 px-2 py-1.5 w-24 text-sm"
                          />
                          <button
                            type="button"
                            onClick={handleBulkCreateClassrooms}
                            disabled={structureBusy || !bulkGradeId || (showSeriesReminderBulk && !selectedGradeForBulk?.series?.code)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                          >
                            {structureBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                            Créer les {bulkCount} classes
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Ex. grade CE1, 3 classes, lettres → CE1 A, CE1 B, CE1 C
                        </p>
                        {showSeriesReminderBulk && (
                          <div className="mt-3">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Série (2nd cycle secondaire) <span className="text-amber-600">*</span></label>
                            <select
                              value={selectedGradeForBulk?.series?.code ?? ''}
                              onChange={(e) => {
                                const code = e.target.value;
                                if (!code || !selectedGradeForBulk) return;
                                const base = selectedGradeForBulk.name.split(' ')[0];
                                const newGrade = allGrades.find(
                                  (g: any) => g?.level?.name === 'SECONDAIRE' && g?.cycle?.name === '2nd cycle' && g.name.startsWith(base) && g.series?.code === code
                                );
                                if (newGrade) setBulkGradeId(newGrade.id);
                              }}
                              className="rounded-md border border-amber-300 bg-amber-50/50 px-3 py-2 text-sm w-48"
                            >
                              <option value="">Choisir la série</option>
                              {secondCycleSeriesOptions.map((s: any) => (
                                <option key={s.code} value={s.code}>{s.code} — {s.name ?? s.code}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    {sortedClassrooms.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4">Aucune classe physique pour cette année. Ajoutez-en ci-dessus.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-700">Nom</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-700">Classe pédagogique</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-700 w-20">Série</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-700 w-24">Capacité</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-700">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedClassrooms.map((c: any) => (
                              <tr key={c.id} className="border-b border-gray-100 last:border-0">
                                <td className="py-2 px-3">
                                  {editingClassroomId === c.id ? (
                                    <input
                                      type="text"
                                      value={editingClassroomName}
                                      onChange={(e) => setEditingClassroomName(e.target.value)}
                                      className="rounded border border-gray-300 px-2 py-1 w-full max-w-[140px]"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="font-medium">{formatGradeLabel(c.name)}</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-gray-600">{formatGradeLabel(c.grade?.name) || '—'}</td>
                                <td className="py-2 px-3 text-gray-600">
                                  {editingClassroomId === c.id &&
                                  c.grade?.level?.name === 'SECONDAIRE' &&
                                  c.grade?.cycle?.name === '2nd cycle' ? (
                                    <select
                                      value={editingClassroomSeriesCode}
                                      onChange={(e) => setEditingClassroomSeriesCode(e.target.value)}
                                      className="rounded border border-gray-300 px-2 py-1 text-sm min-w-[4rem] w-24 bg-white cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      aria-label="Série"
                                    >
                                      <option value="">—</option>
                                      {(secondCycleSeriesOptions.length > 0 ? secondCycleSeriesOptions : SECOND_CYCLE_SERIES_FALLBACK).map((s: any) => (
                                        <option key={s.code} value={s.code}>{s.code}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    c.grade?.series?.code ?? '—'
                                  )}
                                </td>
                                <td className="py-2 px-3">
                                  {editingClassroomId === c.id ? (
                                    <input
                                      type="number"
                                      min={1}
                                      value={editingClassroomCapacity}
                                      onChange={(e) => setEditingClassroomCapacity(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                                      placeholder="—"
                                      className="rounded border border-gray-300 px-2 py-1 w-20"
                                    />
                                  ) : (
                                    <span>{c.capacity != null ? c.capacity : '—'}</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">
                                  {editingClassroomId === c.id ? (
                                    <span className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={handleUpdateEducationClassroom}
                                        disabled={structureBusy}
                                        className="text-blue-600 hover:underline text-xs disabled:opacity-50"
                                      >
                                        Enregistrer
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setEditingClassroomId(null); setEditingClassroomName(''); setEditingClassroomCapacity(''); setEditingClassroomSeriesCode(''); }}
                                        className="text-gray-500 hover:underline text-xs"
                                      >
                                        Annuler
                                      </button>
                                    </span>
                                  ) : (
                                    <span className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingClassroomId(c.id);
                                          setEditingClassroomName(c.name ?? '');
                                          setEditingClassroomCapacity(c.capacity ?? '');
                                          setEditingClassroomSeriesCode(c.grade?.series?.code ?? '');
                                        }}
                                        disabled={structureBusy}
                                        className="text-gray-500 hover:text-blue-600 disabled:opacity-50"
                                        title="Modifier"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleArchiveEducationClassroom(c.id)}
                                        disabled={structureBusy}
                                        className="text-gray-500 hover:text-red-600 disabled:opacity-50"
                                        title="Archiver"
                                      >
                                        Archiver
                                      </button>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 'bilingual':
        const migrationNeeded = bilingualMigrationNeeded ?? bilingualSettings?.migrationRequired ?? false;
        const wantsToEnable = bilingualForm.isEnabled && !bilingualSettings?.isEnabled;
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Option bilingue</h3>
              <p className="text-sm text-gray-600 mb-4">
                Mode académique structurant : mêmes élèves et classes, mais matières, notes, bulletins et statistiques séparés en français et anglais. Impacte la structure pédagogique, les matières, les notes, les bulletins, les tableaux d&apos;honneur, la tarification et ORION.
              </p>

              {/* Avertissement critique à l'activation */}
              {wantsToEnable && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>
                      L&apos;activation du bilingue déclenche un supplément tarifaire et peut nécessiter une migration si vous avez déjà des matières ou notes. Vous ne pourrez pas désactiver le bilingue tant que des données anglaises existent.
                    </span>
                  </p>
                  {migrationNeeded && (
                    <label className="mt-3 flex items-center gap-2 text-sm text-amber-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!bilingualForm.billingImpactAcknowledged}
                        onChange={(e) => setBilingualForm({ ...bilingualForm, billingImpactAcknowledged: e.target.checked })}
                        className="rounded border-amber-300"
                      />
                      J&apos;ai pris connaissance de l&apos;impact sur la facturation et de la migration éventuelle.
                    </label>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer le mode bilingue</h4>
                    <p className="text-sm text-gray-600">Séparation pédagogique FR / EN (notes, bulletins, statistiques)</p>
                  </div>
                  <button
                    onClick={() => setBilingualForm({ ...bilingualForm, isEnabled: !bilingualForm.isEnabled })}
                    className="p-2"
                  >
                    {bilingualForm.isEnabled ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                </div>
                {bilingualForm.isEnabled && (
                  <>
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-gray-800">Séparer les matières</h4>
                        <p className="text-sm text-gray-600">Matières distinctes pour FR et EN</p>
                      </div>
                      <button
                        onClick={() => setBilingualForm({ ...bilingualForm, separateSubjects: !bilingualForm.separateSubjects })}
                        className="p-2"
                      >
                        {bilingualForm.separateSubjects ? (
                          <ToggleRight className="w-6 h-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-gray-800">Séparer les moyennes</h4>
                        <p className="text-sm text-gray-600">Calculer des moyennes par langue</p>
                      </div>
                      <button
                        onClick={() => setBilingualForm({ ...bilingualForm, separateGrades: !bilingualForm.separateGrades })}
                        className="p-2"
                      >
                        {bilingualForm.separateGrades ? (
                          <ToggleRight className="w-6 h-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Langue par défaut pour les évaluations (bulletins, moyennes)
                      </label>
                      <select
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={bilingualForm.defaultLanguage ?? bilingualForm.defaultUILanguage ?? 'FR'}
                        onChange={(e) => setBilingualForm({ ...bilingualForm, defaultLanguage: e.target.value })}
                  >
                    <option value="FR">Français</option>
                    <option value="EN">English</option>
                  </select>
                </div>
                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Langue par défaut de l&apos;interface
                      </label>
                  <select
                        className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={bilingualForm.defaultUILanguage || 'FR'}
                        onChange={(e) => setBilingualForm({ ...bilingualForm, defaultUILanguage: e.target.value })}
                  >
                        <option value="FR">Français</option>
                        <option value="EN">English</option>
                  </select>
                </div>
                  </>
                )}
              </div>

              {/* Impact tarifaire */}
              {bilingualForm.isEnabled && bilingualBillingImpact && (bilingualBillingImpact.monthly > 0 || bilingualBillingImpact.annual > 0) && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Impact sur la facturation</h4>
                  <p className="text-sm text-blue-800">
                    Supplément option bilingue : <strong>{bilingualBillingImpact.monthly ?? 0} {bilingualBillingImpact.currency ?? ''}</strong> / mois, ou <strong>{bilingualBillingImpact.annual ?? 0} {bilingualBillingImpact.currency ?? ''}</strong> / an.
                  </p>
                </div>
              )}

              {migrationNeeded && bilingualSettings?.migrationRequired && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <p className="text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Une migration est requise pour activer le bilingue avec vos données existantes (matières ou notes déjà présentes).
                  </p>
                  {bilingualSettings?.migrationStatus === 'PENDING' && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const res = await settingsService.startBilingualMigration(effectiveTenantId ?? undefined);
                          showToast('success', res?.message ?? `Migration terminée. ${res?.migrated?.subjects ?? 0} matières, ${res?.migrated?.examScores ?? 0} notes.`);
                          const [updated, impact] = await Promise.all([
                            settingsService.getBilingualSettings(effectiveTenantId ?? undefined),
                            settingsService.getBilingualBillingImpact(effectiveTenantId ?? undefined).catch(() => null),
                          ]);
                          setBilingualSettings(updated);
                          setBilingualForm(updated || {});
                          setBilingualMigrationNeeded(false);
                          if (impact) setBilingualBillingImpact(impact);
                        } catch (e: any) {
                          showToast('error', e.message ?? 'Erreur migration');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Lancer la migration (marquer les données en FR)
                    </button>
                  )}
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveBilingual}
                  disabled={saving || (wantsToEnable && migrationNeeded && !bilingualForm.billingImpactAcknowledged)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        );

      case 'features':
        // Ordre d'affichage des modules (aligné sidebar / backend FEATURE_KEYS)
        const modulesDisplayOrder = [
          'STUDENTS', 'FINANCE', 'EXAMS', 'PEDAGOGY', 'HR_PAYROLL', 'COMMUNICATION',
          'LIBRARY', 'TRANSPORT', 'CANTEEN', 'INFIRMARY', 'QHSE', 'EDUCAST', 'SHOP',
          'ORION', 'ATLAS', 'OFFLINE_SYNC',
        ];
        const featureLabels: Record<string, string> = {
          STUDENTS: 'Élèves & Scolarité',
          FINANCE: 'Finances & Économat',
          EXAMS: 'Examens, Notes & Bulletins',
          PEDAGOGY: 'Organisation Pédagogique',
          HR_PAYROLL: 'Personnel, RH & Paie',
          COMMUNICATION: 'Communication',
          LIBRARY: 'Bibliothèque',
          TRANSPORT: 'Transport',
          CANTEEN: 'Cantine',
          INFIRMARY: 'Infirmerie',
          QHSE: 'QHSE',
          EDUCAST: 'EduCast',
          SHOP: 'Boutique',
          ORION: 'ORION',
          ATLAS: 'ATLAS',
          OFFLINE_SYNC: 'Sync. hors ligne',
        };
        const sortedFeatures = [...features].sort((a: { featureCode: string }, b: { featureCode: string }) => {
          const ia = modulesDisplayOrder.indexOf(a.featureCode);
          const ib = modulesDisplayOrder.indexOf(b.featureCode);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return a.featureCode.localeCompare(b.featureCode);
        });
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Modules & Fonctionnalités</h3>
              <p className="text-sm text-gray-600 mb-4">
                Modules activés par défaut : Élèves & Scolarité, Finances & Économat, Examens (Notes & Bulletins), Organisation Pédagogique, Personnel (RH & Paie), Communication. Les autres sont désactivés par défaut.
              </p>
              {features.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ToggleLeft className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Chargement des modules…</p>
                </div>
              ) : (
              <div className="space-y-4">
                  {/* Interrupteur global : activer/désactiver tous les modules */}
                  {(() => {
                    const allEnabled = features.every((f: { isEnabled: boolean }) => f.isEnabled);
                    return (
                      <div className="flex items-center justify-between p-4 border border-blue-200 rounded-lg bg-blue-50/50 mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-800">Tous les modules</h4>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {allEnabled ? 'Tous activés' : 'Tous désactivés ou partiellement'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleAllModules(!allEnabled)}
                          disabled={saving}
                          className="p-2 rounded-lg hover:bg-blue-100 transition-colors"
                          title={allEnabled ? 'Désactiver tous les modules' : 'Activer tous les modules'}
                        >
                          {allEnabled ? (
                            <ToggleRight className="w-6 h-6 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-500" />
                          )}
                        </button>
                      </div>
                    );
                  })()}
                  {sortedFeatures.map((feature: { featureCode: string; isEnabled: boolean; premium?: boolean }) => (
                  <div
                    key={feature.featureCode}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50/50"
                  >
                    <div>
                    <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-800">
                            {featureLabels[feature.featureCode] ?? feature.featureCode}
                          </h4>
                          {feature.premium && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
                              Premium
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Statut : <span className={feature.isEnabled ? 'text-green-600' : 'text-gray-500'}>
                            {feature.isEnabled ? 'Activé' : 'Désactivé'}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleFeature(feature.featureCode, feature.isEnabled)}
                        disabled={saving}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        title={feature.isEnabled ? 'Désactiver le module' : 'Activer le module'}
                      >
                      {feature.isEnabled ? (
                          <ToggleRight className="w-6 h-6 text-green-600" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-400" />
                        )}
                        </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'roles':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Utilisateurs, rôles & permissions (RBAC)</h3>
              <p className="text-sm text-gray-600 mb-6">
                Contrôle d&apos;accès multi-tenant : <strong>rôles plateforme</strong> (PLATFORM OWNER, PLATFORM ADMIN), <strong>rôles école</strong> (DIRECTEUR, COMPTABLE, ENSEIGNANT, etc.), permissions par module et action (lecture, écriture, suppression, validation). Accès ORION/ATLAS par rôle. Un enseignant ne voit que ses classes ; un parent que son enfant ; un comptable ne modifie pas les notes.
              </p>

              {/* ——— Section 1 : Liste des utilisateurs ——— */}
              <div className="mb-8">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Liste des utilisateurs du tenant
                </h4>
                <p className="text-sm text-gray-600 mb-4">Attribuez ou révoquez des rôles par utilisateur. Isolation stricte : chaque utilisateur n&apos;accède qu&apos;aux données de son tenant.</p>
                {usersWithRoles.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">
                    {!effectiveTenantId && isPlatformOwner
                      ? 'Sélectionnez un établissement (ci-dessus) pour afficher les utilisateurs.'
                      : 'Aucun utilisateur dans cet établissement ou contexte tenant manquant.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left">
                          <th className="py-2 px-3 font-semibold text-gray-800">Utilisateur</th>
                          <th className="py-2 px-3 font-semibold text-gray-800">Rôles</th>
                          <th className="py-2 px-3 font-semibold text-gray-800 w-44">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersWithRoles.map((u: any) => (
                          <tr key={u.id} className="border-b border-gray-100">
                            <td className="py-2 px-3">
                              <span className="font-medium text-gray-800">{u.firstName} {u.lastName}</span>
                              <span className="text-gray-500 ml-1">({u.email})</span>
                            </td>
                            <td className="py-2 px-3">
                              {(u.userRoles || []).length === 0 ? (
                                <span className="text-gray-400">Aucun rôle</span>
                              ) : (
                                <span className="flex flex-wrap gap-1">
                                  {(u.userRoles || []).map((ur: any) => (
                                    <span key={ur.role?.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                      {formatRoleDisplayName(ur.role?.name)}
                                      <button type="button" onClick={() => handleRevokeRole(u.id, ur.role?.id)} disabled={saving} className="text-red-600 hover:underline" title="Révoquer">×</button>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {assignRoleUserId === u.id ? (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <select
                                    id={`assign-role-${u.id}`}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                    onChange={(e) => {
                                      const roleId = e.target.value;
                                      if (roleId) handleAssignRole(u.id, roleId);
                                    }}
                                  >
                                    <option value="">Choisir un rôle…</option>
                                    {roles.filter((r: any) => !(u.userRoles || []).some((ur: any) => ur.role?.id === r.id)).map((r: any) => (
                                      <option key={r.id} value={r.id}>{formatRoleDisplayName(r.name)}</option>
                                    ))}
                                  </select>
                                  <button type="button" onClick={() => setAssignRoleUserId(null)} className="text-gray-500 hover:underline text-xs">Annuler</button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => setAssignRoleUserId(u.id)} className="px-2 py-1 text-sm border border-blue-300 text-blue-600 rounded hover:bg-blue-50">
                                  Attribuer un rôle
                        </button>
                      )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                )}
              </div>

              {/* ——— Section 2 : Rôles (plateforme + école) ——— */}
              <div className="mb-8">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  Rôles
                </h4>

                {platformRoles.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Niveau 1 — Rôles plateforme</p>
                    <div className="flex flex-wrap gap-2">
                      {platformRoles.map((role: any) => (
                        <div key={role.id} className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg">
                          <span className="font-medium text-gray-800">{formatRoleDisplayName(role.name)}</span>
                          <span className="text-xs text-gray-500">— {role.description || 'Rôle système'}</span>
                          {role.canAccessOrion && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">ORION</span>}
                          {role.canAccessAtlas && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">ATLAS</span>}
                          <button type="button" onClick={() => { setEditingPermissionsRoleId(role.id); setEditingRolePermissionIds(role.rolePermissions?.map((rp: any) => rp.permissionId) ?? []); }} className="text-xs text-blue-600 hover:underline">Permissions</button>
                  </div>
                ))}
              </div>
                  </div>
                )}

                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Niveau 2 — Rôles école</p>
                {/* Bouton "Initialiser" visible uniquement lorsque la liste des rôles est vide */}
                {platformRoles.length === 0 && schoolRoles.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm space-y-3">
                    <p>Aucun rôle. Créez un rôle personnalisé ci-dessous ou initialisez les rôles système.</p>
                    <button type="button" onClick={handleInitializeRbac} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                      Initialiser les rôles et permissions
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {schoolRoles.map((role: any) => (
                      <div key={role.id} className="p-4 border border-gray-200 rounded-lg">
                        {editingRole?.id === role.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <input type="text" className="px-3 py-2 border border-gray-300 rounded-md" value={editingRole.name} onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })} placeholder="Nom" />
                              <input type="text" className="px-3 py-2 border border-gray-300 rounded-md" value={editingRole.description || ''} onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })} placeholder="Description" />
                            </div>
                            <div className="flex flex-wrap gap-4">
                              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editingRole.canAccessOrion} onChange={(e) => setEditingRole({ ...editingRole, canAccessOrion: e.target.checked })} className="rounded" /><span className="text-sm">Accès ORION</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editingRole.canAccessAtlas} onChange={(e) => setEditingRole({ ...editingRole, canAccessAtlas: e.target.checked })} className="rounded" /><span className="text-sm">Accès ATLAS</span></label>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleUpdateRole(role.id)} disabled={saving} className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Sauvegarder</button>
                              <button onClick={() => setEditingRole(null)} className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50">Annuler</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <span className="font-semibold text-gray-800">{formatRoleDisplayName(role.name)}</span>
                              {role.isSystemRole && <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Système</span>}
                              <p className="text-sm text-gray-600 mt-0.5">{role.description || '—'}</p>
                              <div className="flex gap-2 text-xs mt-1">
                                {role.canAccessOrion && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">ORION</span>}
                                {role.canAccessAtlas && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">ATLAS</span>}
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <button type="button" onClick={() => { setEditingPermissionsRoleId(role.id); setEditingRolePermissionIds(role.rolePermissions?.map((rp: any) => rp.permissionId) ?? []); }} className="px-3 py-1 text-sm border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50">Permissions</button>
                              {!role.isSystemRole && (
                                <>
                                  <button onClick={() => setEditingRole({ ...role })} className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Modifier</button>
                                  <button onClick={() => handleDeleteRole(role.id)} disabled={saving} className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50">Supprimer</button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ——— Section 3 : Créer un rôle personnalisé ——— */}
              <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-3">Créer un rôle personnalisé</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du rôle</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })} placeholder="Ex: Enseignant principal" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Rôle pour les enseignants" />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={roleForm.canAccessOrion} onChange={(e) => setRoleForm({ ...roleForm, canAccessOrion: e.target.checked })} className="rounded" /><span className="text-sm text-gray-700">Accès ORION</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={roleForm.canAccessAtlas} onChange={(e) => setRoleForm({ ...roleForm, canAccessAtlas: e.target.checked })} className="rounded" /><span className="text-sm text-gray-700">Accès ATLAS</span></label>
                </div>
                <div className="mt-4">
                  <button onClick={handleCreateRole} disabled={saving || !roleForm.name} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                    Créer le rôle
                  </button>
                </div>
              </div>

              {/* ——— Section 4 : Matrice des permissions (vue globale) ——— */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-800 mb-2">Matrice des permissions</h4>
                <p className="text-sm text-gray-600 mb-3">Vue synthétique : module × action × rôles. Pour modifier les permissions d&apos;un rôle, utilisez le bouton « Permissions » sur le rôle.</p>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par module</label>
                  <select value={matrixModuleFilter} onChange={(e) => setMatrixModuleFilter(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Tous les modules</option>
                    {Object.keys(permissionsGrouped).sort().map((res) => (
                      <option key={res} value={res}>{RESOURCE_LABELS[res] || res}</option>
                    ))}
                  </select>
                </div>
                {Object.keys(permissionsGrouped).length === 0 ? (
                  <div className="py-4 space-y-2">
                    <p className="text-sm text-gray-500">Aucune permission en base.</p>
                    <button type="button" onClick={handleInitializeRbac} disabled={saving} className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Initialiser les rôles et permissions
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-left">
                          <th className="py-2 px-3 font-semibold text-gray-800 sticky left-0 bg-gray-50">Module</th>
                          <th className="py-2 px-3 font-semibold text-gray-800">Action</th>
                          {roles.map((r: any) => (
                            <th key={r.id} className="py-2 px-2 font-medium text-gray-700 whitespace-nowrap min-w-[6rem]">{formatRoleDisplayName(r.name)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(permissionsGrouped)
                          .filter(([res]) => !matrixModuleFilter || res === matrixModuleFilter)
                          .flatMap(([resource, perms]) =>
                            perms.map((perm: { id: string; action: string }) => (
                              <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-1.5 px-3 text-gray-700 sticky left-0 bg-white">{RESOURCE_LABELS[resource] || resource}</td>
                                <td className="py-1.5 px-3 text-gray-600">{perm.action}</td>
                                {roles.map((r: any) => (
                                  <td key={r.id} className="py-1.5 px-2 text-center">
                                    {rolePermissionSet[r.id]?.has(perm.id) ? <span className="text-green-600 font-medium">✓</span> : '—'}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal édition des permissions d'un rôle */}
            {editingPermissionsRoleId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingPermissionsRoleId(null)}>
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800">Permissions du rôle — {formatRoleDisplayName(roles.find((r: any) => r.id === editingPermissionsRoleId)?.name)}</h4>
                    <button type="button" onClick={() => setEditingPermissionsRoleId(null)} className="text-gray-500 hover:text-gray-700">✕</button>
                  </div>
                  <div className="p-4 border-b border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par module</label>
                    <select value={permissionFilterModule} onChange={(e) => setPermissionFilterModule(e.target.value)} className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Tous les modules</option>
                      {Object.keys(permissionsGrouped).sort().map((res) => (
                        <option key={res} value={res}>{RESOURCE_LABELS[res] || res}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {Object.keys(permissionsGrouped).length === 0 ? (
                      <p className="text-sm text-gray-500 py-4">Aucune permission. Utilisez le bouton « Initialiser les rôles et permissions » dans la section Rôles.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left">
                            <th className="py-2 font-semibold text-gray-800">Module</th>
                            <th className="py-2 font-semibold text-gray-800">Action (read / write / delete / validate)</th>
                            <th className="py-2 font-semibold text-gray-800 w-24">Autoriser</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(permissionsGrouped)
                            .filter(([res]) => !permissionFilterModule || res === permissionFilterModule)
                            .flatMap(([resource, perms]) =>
                              perms.map((perm: { id: string; action: string }) => (
                                <tr key={perm.id} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-2 text-gray-700">{RESOURCE_LABELS[resource] || resource}</td>
                                  <td className="py-2 text-gray-600">{perm.action}</td>
                                  <td className="py-2">
                                    <input type="checkbox" checked={editingRolePermissionIds.includes(perm.id)} onChange={(e) => { if (e.target.checked) setEditingRolePermissionIds((ids) => [...ids, perm.id]); else setEditingRolePermissionIds((ids) => ids.filter((id) => id !== perm.id)); }} className="rounded" />
                                  </td>
                                </tr>
                              ))
                            )}
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingPermissionsRoleId(null)} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Annuler</button>
                    <button type="button" onClick={() => editingPermissionsRoleId && handleSaveRolePermissions(editingPermissionsRoleId)} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">{saving ? 'Enregistrement…' : 'Sauvegarder'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'communication':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Communication & Notifications</h3>
              <p className="text-sm text-gray-600 mb-6">
                Configurez les canaux de communication (SMS, Email, WhatsApp) pour les notifications automatiques.
              </p>

              <div className="space-y-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Smartphone className="w-5 h-5" />
                      SMS
                    </h4>
                    <button
                      onClick={() => setCommunicationForm({ ...communicationForm, smsEnabled: !communicationForm.smsEnabled })}
                      className="p-1"
                    >
                      {communicationForm.smsEnabled ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {communicationForm.smsEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider SMS</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smsProvider || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smsProvider: e.target.value })}
                        >
                          <option value="">Sélectionner</option>
                          <option value="twilio">Twilio</option>
                          <option value="vonage">Vonage</option>
                          <option value="orange">Orange SMS</option>
                          <option value="sendchamp">SendChamp</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Limite SMS/jour</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.dailySmsLimit || 100}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, dailySmsLimit: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button
                          onClick={handleTestSms}
                          disabled={saving}
                          className="text-sm px-3 py-1 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50"
                        >
                          Envoyer un SMS de test
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Email (SMTP)
                    </h4>
                    <button
                      onClick={() => setCommunicationForm({ ...communicationForm, emailEnabled: !communicationForm.emailEnabled })}
                      className="p-1"
                    >
                      {communicationForm.emailEnabled ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {communicationForm.emailEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hôte SMTP</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smtpHost || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smtpHost: e.target.value })}
                          placeholder="smtp.example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Port SMTP</label>
                        <input
                          type="number"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smtpPort || 587}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smtpPort: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur SMTP</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smtpUser || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smtpUser: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe SMTP</label>
                        <input
                          type="password"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smtpPassword || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smtpPassword: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email expéditeur</label>
                        <input
                          type="email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smtpFromEmail || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smtpFromEmail: e.target.value })}
                          placeholder="noreply@ecole.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom expéditeur</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.smtpFromName || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, smtpFromName: e.target.value })}
                          placeholder="Mon Établissement"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={communicationForm.smtpSecure !== false}
                            onChange={(e) => setCommunicationForm({ ...communicationForm, smtpSecure: e.target.checked })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">Connexion sécurisée (TLS)</span>
                        </label>
                        <button
                          onClick={handleTestEmail}
                          disabled={saving}
                          className="text-sm px-3 py-1 border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50"
                        >
                          Envoyer un email de test
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      WhatsApp
                    </h4>
                    <button
                      onClick={() => setCommunicationForm({ ...communicationForm, whatsappEnabled: !communicationForm.whatsappEnabled })}
                      className="p-1"
                    >
                      {communicationForm.whatsappEnabled ? (
                        <ToggleRight className="w-6 h-6 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                  {communicationForm.whatsappEnabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider WhatsApp</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={communicationForm.whatsappProvider || ''}
                          onChange={(e) => setCommunicationForm({ ...communicationForm, whatsappProvider: e.target.value })}
                        >
                          <option value="">Sélectionner</option>
                          <option value="twilio">Twilio WhatsApp</option>
                          <option value="meta">Meta Business API</option>
                          <option value="360dialog">360dialog</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom expéditeur par défaut</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={communicationForm.defaultSenderName || ''}
                      onChange={(e) => setCommunicationForm({ ...communicationForm, defaultSenderName: e.target.value })}
                      placeholder="Mon Établissement"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone expéditeur</label>
                    <input
                      type="tel"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={communicationForm.defaultSenderPhone || ''}
                      onChange={(e) => setCommunicationForm({ ...communicationForm, defaultSenderPhone: e.target.value })}
                      placeholder="+229 XX XX XX XX"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveCommunication}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        );

      case 'billing':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Facturation & Abonnement SaaS</h3>
              <p className="text-sm text-gray-600 mb-6">
                Gérez votre abonnement, consultez vos factures et modifiez votre plan.
              </p>

              {billingSettings ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-600 font-medium">Plan actuel</p>
                      <p className="text-2xl font-bold text-blue-800">{billingSettings.plan || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-600 font-medium">Statut</p>
                      <p className="text-2xl font-bold text-green-800">{billingSettings.status || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-600 font-medium">Montant</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {billingSettings.amount?.toLocaleString()} {billingSettings.currency || 'XOF'}
                      </p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-4">Paramètres d'abonnement</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cycle de facturation</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={billingForm.billingCycle || 'MONTHLY'}
                          onChange={(e) => setBillingForm({ ...billingForm, billingCycle: e.target.value })}
                        >
                          <option value="MONTHLY">Mensuel</option>
                          <option value="YEARLY">Annuel</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <h5 className="font-medium text-gray-800">Renouvellement automatique</h5>
                          <p className="text-sm text-gray-600">Renouveler automatiquement l'abonnement</p>
                        </div>
                        <button
                          onClick={() => setBillingForm({ ...billingForm, autoRenew: !billingForm.autoRenew })}
                          className="p-1"
                        >
                          {billingForm.autoRenew ? (
                            <ToggleRight className="w-6 h-6 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={handleSaveBilling}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer
                      </button>
                    </div>
                  </div>

                  {availablePlans.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-4">Changer de plan</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {availablePlans.map((plan: any) => (
                          <div
                            key={plan.id}
                            className={`p-4 border rounded-lg ${
                              billingSettings.planDetails?.code === plan.code
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            <h5 className="font-semibold text-gray-800">{plan.name}</h5>
                            <p className="text-2xl font-bold text-gray-900 mt-2">
                              {plan.monthlyPrice?.toLocaleString()} <span className="text-sm font-normal">XOF/mois</span>
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              ou {plan.yearlyPrice?.toLocaleString()} XOF/an
                            </p>
                            <ul className="mt-3 text-sm text-gray-600 space-y-1">
                              <li>• Max {plan.maxSchools} école(s)</li>
                              {plan.bilingualAllowed && <li>• Option bilingue incluse</li>}
                            </ul>
                            {billingSettings.planDetails?.code !== plan.code && (
                              <button
                                onClick={() => handleChangePlan(plan.code)}
                                disabled={saving}
                                className="mt-4 w-full px-3 py-2 text-sm border border-blue-500 text-blue-600 rounded-md hover:bg-blue-50 disabled:opacity-50"
                              >
                                <RefreshCw className="w-4 h-4 inline mr-2" />
                                Choisir ce plan
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {invoices.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5" />
                        Factures récentes
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-3 font-medium text-gray-600">N° Facture</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Montant</th>
                              <th className="text-left py-2 px-3 font-medium text-gray-600">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((invoice: any) => (
                              <tr key={invoice.id} className="border-b border-gray-100">
                                <td className="py-2 px-3">{invoice.invoiceNumber}</td>
                                <td className="py-2 px-3">
                                  {new Date(invoice.issueDate).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="py-2 px-3">
                                  {invoice.amount?.toLocaleString()} {invoice.currency}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    invoice.status === 'PAID' 
                                      ? 'bg-green-100 text-green-700' 
                                      : invoice.status === 'PENDING'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                    {invoice.status === 'PAID' ? 'Payée' : invoice.status === 'PENDING' ? 'En attente' : invoice.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun abonnement configuré.</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres de sécurité</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longueur minimale du mot de passe
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={securityForm.passwordMinLength || 8}
                    onChange={(e) => setSecurityForm({ ...securityForm, passwordMinLength: parseInt(e.target.value) })}
                      min={6}
                      max={20}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Durée de session (minutes)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={securityForm.sessionTimeoutMinutes || 30}
                    onChange={(e) => setSecurityForm({ ...securityForm, sessionTimeoutMinutes: parseInt(e.target.value) })}
                      min={5}
                      max={480}
                    />
                  </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tentatives de connexion max
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={securityForm.maxLoginAttempts || 5}
                    onChange={(e) => setSecurityForm({ ...securityForm, maxLoginAttempts: parseInt(e.target.value) })}
                    min={3}
                    max={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Durée de blocage (minutes)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={securityForm.lockoutDurationMinutes || 15}
                    onChange={(e) => setSecurityForm({ ...securityForm, lockoutDurationMinutes: parseInt(e.target.value) })}
                    min={5}
                    max={60}
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveSecurity}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
          </div>
        );

      case 'seals':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <GeneratedStampsSignatures tenantId={effectiveTenantId ?? undefined} />
            </div>
          </div>
        );

      case 'orion':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres ORION</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer ORION</h4>
                    <p className="text-sm text-gray-600">Activez l'IA de pilotage ORION</p>
                  </div>
                  <button
                    onClick={() => setOrionForm({ ...orionForm, isEnabled: !orionForm.isEnabled })}
                    className="p-2"
                  >
                    {orionForm.isEnabled ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                  </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seuil d'alerte critique
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={orionForm.alertThresholdCritical || 5}
                      onChange={(e) => setOrionForm({ ...orionForm, alertThresholdCritical: parseInt(e.target.value) })}
                    />
                </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seuil d'alerte warning
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={orionForm.alertThresholdWarning || 10}
                      onChange={(e) => setOrionForm({ ...orionForm, alertThresholdWarning: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveOrion}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'atlas':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Paramètres ATLAS</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer ATLAS</h4>
                    <p className="text-sm text-gray-600">Activez le chatbot IA ATLAS</p>
                  </div>
                  <button
                    onClick={() => setAtlasForm({ ...atlasForm, isEnabled: !atlasForm.isEnabled })}
                    className="p-2"
                  >
                    {atlasForm.isEnabled ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                  </div>
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">Transfert humain</h4>
                    <p className="text-sm text-gray-600">Permettre le transfert vers un opérateur humain</p>
                </div>
                  <button
                    onClick={() => setAtlasForm({ ...atlasForm, allowHumanHandoff: !atlasForm.allowHumanHandoff })}
                    className="p-2"
                  >
                    {atlasForm.allowHumanHandoff ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveAtlas}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'offline':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Synchronisation Offline</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer le mode offline</h4>
                    <p className="text-sm text-gray-600">Permet l'utilisation de l'application hors ligne</p>
                  </div>
                  <button
                    onClick={() => setOfflineForm({ ...offlineForm, isEnabled: !offlineForm.isEnabled })}
                    className="p-2"
                  >
                    {offlineForm.isEnabled ? (
                      <ToggleRight className="w-6 h-6 text-green-600" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fréquence de sync (minutes)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={offlineForm.syncFrequencyMinutes || 15}
                      onChange={(e) => setOfflineForm({ ...offlineForm, syncFrequencyMinutes: parseInt(e.target.value) })}
                    />
              </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Durée max hors ligne (jours)
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={offlineForm.maxOfflineDays || 7}
                      onChange={(e) => setOfflineForm({ ...offlineForm, maxOfflineDays: parseInt(e.target.value) })}
                    />
            </div>
          </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSaveOffline}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'appareils':
        if (!canAccessDevices) {
          return (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <p className="text-gray-600">
                Accès réservé à la plateforme (PLATFORM_OWNER, PLATFORM_ADMIN), au promoteur et à la direction.
              </p>
            </div>
          );
        }
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Appareils autorisés
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Liste des appareils ayant accès à cet établissement. Révoquez un appareil pour invalider ses sessions et sa synchronisation offline.
              </p>
              {devicesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : devicesList.length === 0 ? (
                <p className="text-gray-500 py-4">Aucun appareil enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Nom appareil</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Utilisateur</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Dernière sync</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">Statut</th>
                        <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 border-b">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devicesList.map((d) => (
                        <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">{d.deviceName || d.deviceType || '—'}</td>
                          <td className="px-4 py-2 text-sm">
                            {d.user ? `${d.user.firstName || ''} ${d.user.lastName || ''}`.trim() || d.user.email : '—'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString('fr-FR') : d.lastUsedAt ? new Date(d.lastUsedAt).toLocaleString('fr-FR') : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Actif</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Révoquer cet appareil ? Les sessions et la sync offline seront invalidées.')) return;
                                try {
                                  const res = await fetch(`/api/auth/devices/${d.id}`, { method: 'DELETE', credentials: 'include' });
                                  const data = await res.json().catch(() => ({}));
                                  if (res.ok) {
                                    showToast('success', data?.message || 'Appareil révoqué');
                                    setDevicesList((prev) => prev.filter((x) => x.id !== d.id));
                                  } else showToast('error', data?.message || 'Erreur');
                                } catch {
                                  showToast('error', 'Erreur lors de la révocation');
                                }
                              }}
                              className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                              Révoquer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Historique des modifications</h3>
                {history.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <History className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucune modification enregistrée.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-gray-800">{item.key}</h4>
                            <p className="text-sm text-gray-600">{item.category}</p>
                            <p className="text-xs text-gray-500 mt-1">
                            {new Date(item.changedAt).toLocaleString('fr-FR')}
                            {item.user && ` par ${item.user.firstName} ${item.user.lastName}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <ModuleHeader
        title="Paramètres de l'application"
        description="La plateforme de pilotage éducatif nouvelle génération. Prenez le gouvernail de votre institution. Configurez l'établissement, activez/désactivez des capacités, adaptez le comportement métier."
        icon="settings"
        kpis={[]}
        actions={[]}
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div className="p-6 overflow-x-hidden">
        {/* Navigation par onglets - scroll horizontal isolé */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {tabs
              .filter((tab) => tab.id !== 'appareils' || canAccessDevices)
              .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Chargement des paramètres...</span>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>
    </div>
  );
}
