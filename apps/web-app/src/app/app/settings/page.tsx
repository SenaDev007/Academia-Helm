/**
 * ============================================================================
 * MODULE TRANSVERSAL — PARAMÈTRES DE L'APPLICATION
 * ============================================================================
 * Plateforme de pilotage éducatif - Academia Helm
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { 
  Globe, Shield, Brain, MessageSquare, CloudOff, History, 
  ToggleLeft, ToggleRight, Stamp, GraduationCap, Languages, 
  Bell, Users, Calendar, Save, Loader2, CheckCircle, AlertCircle,
  Mail, UserCog, Lock, Key, Smartphone, CreditCard, Receipt, RefreshCw,
  Upload, Image, FileSignature, CalendarDays, UserCircle, School, Archive, CalendarRange
} from 'lucide-react';
import { ModuleHeader } from '@/components/modules/blueprint';
import AdministrativeSealsManagement from '@/components/settings/AdministrativeSealsManagement';
import ElectronicSignaturesManagement from '@/components/settings/ElectronicSignaturesManagement';
import { useAppSession } from '@/contexts/AppSessionContext';
import * as settingsService from '@/services/settings.service';

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

type TabId = 'identity' | 'academic-year' | 'structure' | 'bilingual' | 'features' | 
             'roles' | 'communication' | 'billing' | 'security' | 'seals' | 'orion' | 'atlas' | 'offline' | 'history';

type SealsSubTab = 'seals' | 'signatures';

interface Toast {
  type: 'success' | 'error';
  message: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, tenant } = useAppSession();
  const urlTenantId = searchParams.get('tenant_id');
  const isPlatformOwner = user?.role === 'PLATFORM_OWNER';
  const effectiveTenantId = (isPlatformOwner || !tenant?.id) ? (urlTenantId || tenant?.id) : tenant?.id;

  const [availableTenantsForPO, setAvailableTenantsForPO] = useState<{ tenantId: string; name?: string }[]>([]);
  const [loadingTenantsPO, setLoadingTenantsPO] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [sealsSubTab, setSealsSubTab] = useState<SealsSubTab>('seals');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // États pour les données
  const [generalSettings, setGeneralSettings] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState<any>(null);
  const [orionSettings, setOrionSettings] = useState<any>(null);
  const [atlasSettings, setAtlasSettings] = useState<any>(null);
  const [offlineSyncSettings, setOfflineSyncSettings] = useState<any>(null);
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
  const [bilingualForm, setBilingualForm] = useState<any>({});

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    loadAllSettings();
  }, [effectiveTenantId]);

  // Recharger les années scolaires depuis le backend à chaque ouverture de l’onglet (dates dynamiques)
  useEffect(() => {
    if (activeTab !== 'academic-year') return;
    if (!effectiveTenantId) {
      setAcademicYears([]);
      setActiveAcademicYear(null);
      setPeriodYearId(null);
      setAcademicPeriods([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [years, activeYear] = await Promise.all([
          settingsService.getAcademicYears(effectiveTenantId).catch(() => []),
          settingsService.getActiveAcademicYear(effectiveTenantId).catch(() => null),
        ]);
        if (cancelled) return;
        const yearList = years || [];
        const hasActiveInList = activeYear && yearList.some((y: any) => y.id === activeYear.id);
        setAcademicYears(hasActiveInList ? yearList : (activeYear ? [activeYear, ...yearList] : yearList));
        setActiveAcademicYear(activeYear || null);
        setPeriodYearId((prev) => prev || activeYear?.id || yearList[0]?.id || null);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [activeTab, effectiveTenantId]);

  // Charger les périodes académiques de l'année sélectionnée
  useEffect(() => {
    if (activeTab !== 'academic-year' || !periodYearId || !effectiveTenantId) {
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
    return () => { cancelled = true; };
  }, [activeTab, periodYearId, effectiveTenantId]);

  // Charger la structure pédagogique hiérarchique (onglet Structure)
  useEffect(() => {
    if (activeTab !== 'structure' || !effectiveTenantId) {
      if (activeTab !== 'structure') setEducationStructure(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await settingsService.getEducationStructure(effectiveTenantId);
        if (!cancelled && res?.levels) setEducationStructure(res);
        else if (!cancelled) setEducationStructure(res || { levels: [] });
      } catch (_) {
        if (!cancelled) setEducationStructure({ levels: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, effectiveTenantId]);

  // Charger les classes physiques pour l'année sélectionnée (onglet Structure)
  useEffect(() => {
    const yearId = structureYearId || activeAcademicYear?.id;
    if (activeTab !== 'structure' || !yearId || !effectiveTenantId) {
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
    return () => { cancelled = true; };
  }, [activeTab, structureYearId, activeAcademicYear?.id, effectiveTenantId]);

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

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      const [general, featuresData, security, orion, atlas, offline, historyData, academicYearsResult, structure, bilingual, communication, rolesData, permissionsData, billing, plans, invoicesData, identity, identityHist] = 
        await Promise.all([
          settingsService.getGeneralSettings().catch(() => null),
          settingsService.getFeatures().catch(() => []),
          settingsService.getSecuritySettings().catch(() => null),
          settingsService.getOrionSettings().catch(() => null),
          settingsService.getAtlasSettings().catch(() => null),
          settingsService.getOfflineSyncSettings().catch(() => null),
          settingsService.getSettingsHistory({ limit: 50 }).catch(() => []),
          effectiveTenantId
            ? Promise.all([
                settingsService.getAcademicYears(effectiveTenantId).catch(() => []),
                settingsService.getActiveAcademicYear(effectiveTenantId).catch(() => null),
              ]).then(([y, a]) => ({ years: y, activeYear: a }))
            : Promise.resolve({ years: [], activeYear: null }),
          settingsService.getPedagogicalStructure().catch(() => null),
          settingsService.getBilingualSettings().catch(() => null),
          settingsService.getCommunicationSettings().catch(() => null),
          settingsService.getRoles().catch(() => []),
          settingsService.getPermissions().catch(() => []),
          settingsService.getBillingSettings().catch(() => null),
          settingsService.getAvailablePlans().catch(() => []),
          settingsService.getBillingInvoices({ limit: 10 }).catch(() => []),
          settingsService.getActiveIdentityProfile().catch(() => null),
          settingsService.getIdentityHistory({ limit: 20 }).catch(() => ({ versions: [] })),
        ]);

      setGeneralSettings(general);
      setIdentityForm(general || {});
      
      // Identité versionnée
      if (identity) {
        setIdentityProfile(identity);
        setIdentityForm({
          schoolName: identity.schoolName || '',
          schoolAcronym: identity.schoolAcronym || '',
          schoolType: identity.schoolType || 'PRIVEE',
          authorizationNumber: identity.authorizationNumber || '',
          foundationDate: identity.foundationDate?.split('T')[0] || '',
          devise: identity.slogan || '',
          address: identity.address || '',
          city: identity.city || '',
          department: identity.department || '',
          country: identity.country || 'BJ',
          postalCode: identity.postalCode || '',
          phonePrimary: identity.phonePrimary || '',
          phoneSecondary: identity.phoneSecondary || '',
          email: identity.email || '',
          website: identity.website || '',
          currency: identity.currency || 'XOF',
          timezone: identity.timezone || 'Africa/Porto-Novo',
          logoUrl: identity.logoUrl || '',
          stampUrl: identity.stampUrl || '',
          directorSignatureUrl: identity.directorSignatureUrl || '',
        });
      }
      setIdentityVersions(identityHist?.versions || []);
      setFeatures(featuresData || []);
      setSecuritySettings(security);
      setSecurityForm(security || {});
      setOrionSettings(orion);
      setOrionForm(orion || {});
      setAtlasSettings(atlas);
      setAtlasForm(atlas || {});
      setOfflineSyncSettings(offline);
      setOfflineForm(offline || {});
      setHistory(historyData || []);
      const years = academicYearsResult?.years ?? [];
      const activeYear = academicYearsResult?.activeYear ?? null;
      const yearList = years || [];
      const hasActiveInList = activeYear && yearList.some((y: any) => y.id === activeYear.id);
      setAcademicYears(
        hasActiveInList ? yearList : (activeYear ? [activeYear, ...yearList] : yearList)
      );
      setActiveAcademicYear(activeYear || null);
      setPedagogicalStructure(structure);
      setStructureForm(structure || {});
      setBilingualSettings(bilingual);
      setBilingualForm(bilingual || {});
      setCommunicationSettings(communication);
      setCommunicationForm(communication || {});
      setRoles(rolesData || []);
      setPermissions(permissionsData || []);
      setBillingSettings(billing);
      setBillingForm(billing || {});
      setAvailablePlans(plans || []);
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error('Error loading settings:', error);
      showToast('error', 'Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!changeReason.trim()) {
      showToast('error', 'Veuillez indiquer la raison de la modification');
      return;
    }
    try {
      setSaving(true);
      // Mapper devise vers slogan pour l'API
      const { devise, ...rest } = identityForm;
      const newVersion = await settingsService.createIdentityVersion({
        ...rest,
        slogan: devise,
        changeReason: changeReason.trim(),
      });
      showToast('success', `Nouvelle version ${newVersion.version} créée`);
      setIdentityProfile(newVersion);
      setChangeReason('');
      // Recharger l'historique
      const histData = await settingsService.getIdentityHistory({ limit: 20 });
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
      const restored = await settingsService.activateIdentityVersion(versionId, `Restauration de la version ${versionNum}`);
      showToast('success', `Version ${restored.version} restaurée`);
      setIdentityProfile(restored);
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
        stampUrl: restored.stampUrl || '',
        directorSignatureUrl: restored.directorSignatureUrl || '',
      });
      // Recharger l'historique
      const histData = await settingsService.getIdentityHistory({ limit: 20 });
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
      await settingsService.updatePedagogicalStructure(structureForm);
      showToast('success', 'Structure pédagogique enregistrée');
      const updated = await settingsService.getPedagogicalStructure();
      setPedagogicalStructure(updated);
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

  const handleSaveBilingual = async () => {
    try {
      setSaving(true);
      await settingsService.updateBilingualSettings(bilingualForm);
      showToast('success', 'Paramètres bilingues enregistrés');
      const updated = await settingsService.getBilingualSettings();
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
      if (currentlyEnabled) {
        await settingsService.disableFeature(featureCode, 'Désactivation depuis les paramètres');
      } else {
        await settingsService.enableFeature(featureCode, 'Activation depuis les paramètres');
      }
      showToast('success', `Module ${currentlyEnabled ? 'désactivé' : 'activé'}`);
      const updated = await settingsService.getFeatures();
      setFeatures(updated || []);
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
  const [roleForm, setRoleForm] = useState<any>({ name: '', description: '', isSystemRole: false, canAccessOrion: false, canAccessAtlas: false, allowedLevelIds: [] });

  const handleCreateRole = async () => {
    try {
      setSaving(true);
      await settingsService.createRole(roleForm);
      showToast('success', 'Rôle créé avec succès');
      const updated = await settingsService.getRoles();
      setRoles(updated || []);
      setRoleForm({ name: '', description: '', isSystemRole: false, canAccessOrion: false, canAccessAtlas: false, allowedLevelIds: [] });
    } catch (error: any) {
      showToast('error', error.message || 'Erreur lors de la création du rôle');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (roleId: string) => {
    try {
      setSaving(true);
      await settingsService.updateRole(roleId, editingRole);
      showToast('success', 'Rôle mis à jour');
      const updated = await settingsService.getRoles();
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
      await settingsService.deleteRole(roleId);
      showToast('success', 'Rôle supprimé');
      const updated = await settingsService.getRoles();
      setRoles(updated || []);
    } catch (error: any) {
      showToast('error', error.message || 'Impossible de supprimer ce rôle');
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
                    <img src={identityForm.logoUrl} alt="Logo" className="w-16 h-16 mx-auto object-contain mb-2" />
                  ) : (
                    <Image className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  )}
                  <p className="text-xs font-medium text-gray-700 mb-2">Logo officiel</p>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">
                    <Upload className="w-3 h-3" /> Téléverser
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdentityForm({ ...identityForm, logoUrl: r.result as string }); r.readAsDataURL(f); }}} />
                  </label>
                </div>
                <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                  {identityForm.stampUrl ? (
                    <img src={identityForm.stampUrl} alt="Cachet" className="w-16 h-16 mx-auto object-contain mb-2" />
                  ) : (
                    <Stamp className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  )}
                  <p className="text-xs font-medium text-gray-700 mb-2">Cachet officiel</p>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">
                    <Upload className="w-3 h-3" /> Téléverser
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdentityForm({ ...identityForm, stampUrl: r.result as string }); r.readAsDataURL(f); }}} />
                  </label>
                </div>
                <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center">
                  {identityForm.directorSignatureUrl ? (
                    <img src={identityForm.directorSignatureUrl} alt="Signature" className="w-16 h-16 mx-auto object-contain mb-2" />
                  ) : (
                    <FileSignature className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                  )}
                  <p className="text-xs font-medium text-gray-700 mb-2">Signature directeur</p>
                  <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200">
                    <Upload className="w-3 h-3" /> Téléverser
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onloadend = () => setIdentityForm({ ...identityForm, directorSignatureUrl: r.result as string }); r.readAsDataURL(f); }}} />
                  </label>
                </div>
              </div>
            </div>

            {/* Section 5: Aperçu Document */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                5. Aperçu Document Officiel
              </h4>
              <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                <div className="flex items-start gap-4 mb-4">
                  {identityForm.logoUrl && <img src={identityForm.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />}
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
                <div className="flex justify-end gap-4 mt-4 pt-2 border-t">
                  {identityForm.stampUrl && <img src={identityForm.stampUrl} alt="Cachet" className="w-12 h-12 object-contain" />}
                  {identityForm.directorSignatureUrl && <img src={identityForm.directorSignatureUrl} alt="Signature" className="w-12 h-12 object-contain" />}
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
        const allGrades: { id: string; name: string; code: string; cycle: { name: string }; level: { name: string } }[] = [];
        levels.forEach((l: any) => l.cycles?.forEach((c: any) => c.grades?.forEach((g: any) => allGrades.push({ ...g, cycle: c, level: l }))));
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
                                  <span key={grade.id} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-sm">
                                    {grade.name}
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
                          <option key={g.id} value={g.id}>{g.level.name} → {g.cycle.name} → {g.name}</option>
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
                        disabled={structureBusy || !newClassroomGradeId || !newClassroomName.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {structureBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Ajouter la classe
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
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
                    {educationClassrooms.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4">Aucune classe physique pour cette année. Ajoutez-en ci-dessus.</p>
                    ) : (
                      <ul className="space-y-2">
                        {educationClassrooms.map((c: any) => (
                          <li key={c.id} className="flex items-center justify-between p-2 border border-gray-200 rounded-md">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-gray-500">{c.grade?.name ?? ''}</span>
                            <button
                              type="button"
                              onClick={() => handleArchiveEducationClassroom(c.id)}
                              disabled={structureBusy}
                              className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                            >
                              Archiver
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );

      case 'bilingual':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Option bilingue</h3>
              <p className="text-sm text-gray-600 mb-6">
                Configurez l'option bilingue français/anglais pour votre établissement.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <h4 className="font-semibold text-gray-800">Activer le bilingue</h4>
                    <p className="text-sm text-gray-600">Permet l'enseignement en français et anglais</p>
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
                        <p className="text-sm text-gray-600">Calculer des moyennes séparées</p>
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
                        Langue par défaut de l'interface
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {bilingualSettings?.migrationRequired && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Une migration est requise pour activer le bilingue avec vos données existantes.
                  </p>
                </div>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleSaveBilingual}
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

      case 'features':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Modules & Fonctionnalités</h3>
              {features.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ToggleLeft className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Aucun module configuré.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {features.map((feature) => (
                    <div
                      key={feature.featureCode}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                    >
                      <div>
                        <h4 className="font-semibold text-gray-800">{feature.featureCode}</h4>
                        <p className="text-sm text-gray-600">
                          Statut: <span className={feature.isEnabled ? 'text-green-600' : 'text-gray-500'}>
                            {feature.isEnabled ? 'Activé' : 'Désactivé'}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleFeature(feature.featureCode, feature.isEnabled)}
                        disabled={saving}
                        className="p-2 rounded-lg hover:bg-gray-100"
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
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Gestion des rôles</h3>
              <p className="text-sm text-gray-600 mb-6">
                Définissez les rôles et leurs permissions pour contrôler l'accès aux différentes fonctionnalités.
              </p>
              
              <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-3">Créer un nouveau rôle</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom du rôle</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={roleForm.name}
                      onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                      placeholder="Ex: Enseignant principal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={roleForm.description}
                      onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                      placeholder="Rôle pour les enseignants"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleForm.canAccessOrion}
                      onChange={(e) => setRoleForm({ ...roleForm, canAccessOrion: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Accès ORION</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roleForm.canAccessAtlas}
                      onChange={(e) => setRoleForm({ ...roleForm, canAccessAtlas: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Accès ATLAS</span>
                  </label>
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleCreateRole}
                    disabled={saving || !roleForm.name}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
                    Créer le rôle
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Rôles existants</h4>
                {roles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserCog className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Aucun rôle configuré.</p>
                  </div>
                ) : (
                  roles.map((role) => (
                    <div
                      key={role.id}
                      className="p-4 border border-gray-200 rounded-lg"
                    >
                      {editingRole?.id === role.id ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                              type="text"
                              className="px-3 py-2 border border-gray-300 rounded-md"
                              value={editingRole.name}
                              onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                            />
                            <input
                              type="text"
                              className="px-3 py-2 border border-gray-300 rounded-md"
                              value={editingRole.description || ''}
                              onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                            />
                          </div>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingRole.canAccessOrion}
                                onChange={(e) => setEditingRole({ ...editingRole, canAccessOrion: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm">Accès ORION</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingRole.canAccessAtlas}
                                onChange={(e) => setEditingRole({ ...editingRole, canAccessAtlas: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm">Accès ATLAS</span>
                            </label>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateRole(role.id)}
                              disabled={saving}
                              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                            >
                              Sauvegarder
                            </button>
                            <button
                              onClick={() => setEditingRole(null)}
                              className="px-3 py-1 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                              {role.name}
                              {role.isSystemRole && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Système</span>
                              )}
                            </h5>
                            <p className="text-sm text-gray-600">{role.description || 'Aucune description'}</p>
                            <div className="mt-1 flex gap-2 text-xs">
                              {role.canAccessOrion && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">ORION</span>
                              )}
                              {role.canAccessAtlas && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">ATLAS</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {!role.isSystemRole && (
                              <>
                                <button
                                  onClick={() => setEditingRole({ ...role })}
                                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                  Modifier
                                </button>
                                <button
                                  onClick={() => handleDeleteRole(role.id)}
                                  disabled={saving}
                                  className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                                >
                                  Supprimer
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
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
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setSealsSubTab('seals')}
                    className={`px-6 py-4 text-sm font-medium ${
                      sealsSubTab === 'seals'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Cachets Administratifs
                  </button>
                  <button
                    onClick={() => setSealsSubTab('signatures')}
                    className={`px-6 py-4 text-sm font-medium ${
                      sealsSubTab === 'signatures'
                        ? 'text-blue-600 border-b-2 border-blue-600'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Signatures Électroniques
                  </button>
                </div>
              </div>
              <div className="p-6">
                {sealsSubTab === 'seals' ? (
                  <AdministrativeSealsManagement />
                ) : (
                  <ElectronicSignaturesManagement />
                )}
              </div>
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
            {tabs.map((tab) => {
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
