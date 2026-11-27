/**
 * Chargement parallèle des données « Paramètres » — source unique pour la page et le préchargement post-login.
 */

import * as settingsService from '@/services/settings.service';

export interface SettingsBilingualExtras {
  impact: unknown;
  migrationNeeded: boolean | null;
}

export interface SettingsBootstrapPayload {
  general: unknown;
  featuresData: unknown;
  security: unknown;
  orion: unknown;
  atlas: unknown;
  offline: unknown;
  academicYearsResult: { years: unknown[]; activeYear: unknown | null };
  structure: unknown;
  bilingual: unknown;
  communication: unknown;
  rolesData: unknown;
  permissionsData: unknown;
  usersData: unknown;
  billing: unknown;
  plans: unknown;
  invoicesData: unknown;
  identity: unknown;
  identityHist: { versions?: unknown[] };
  educationHierarchy: unknown;
  bilingualExtras: SettingsBilingualExtras;
}

/**
 * ⭐ PERF (chantier GTMetrix — spéc. §7 « Optimisation des appels réseau »)
 *
 * Variante « core » du bootstrap : SEULEMENT les 5 données chaudes partagées
 * par les shells de tous les rôles (TopBar/Sidebar/providers) :
 *   general, features, academic-years (+ active), identity, bilingual.
 *
 * AVANT : le prefetch post-login déclenchait 23 GET /api/settings/* en
 * parallèle à CHAQUE montage /app (history 50, invoices 10, users, roles,
 * permissions, plans, billing… utiles uniquement sur la page Paramètres).
 * → ~18 requêtes réseau économisées par vue, budget GTMetrix < 50 requêtes.
 *
 * La page Paramètres continue d'utiliser fetchSettingsBootstrap (complet) :
 * les 23 appels n'ont lieu qu'à la visite réelle de la page.
 */
export interface SettingsBootstrapCorePayload {
  general: unknown;
  featuresData: unknown;
  academicYearsResult: { years: unknown[]; activeYear: unknown | null };
  bilingual: unknown;
  identity: unknown;
}

export async function fetchSettingsBootstrapCore(
  tenantId: string | undefined,
): Promise<SettingsBootstrapCorePayload> {
  const [general, featuresData, academicYearsResult, bilingual, identity] =
    await Promise.all([
      settingsService.getGeneralSettings(tenantId).catch(() => null),
      settingsService.getFeatures(tenantId ?? undefined).catch(() => []),
      tenantId
        ? Promise.all([
            settingsService.getAcademicYears(tenantId).catch(() => []),
            settingsService.getActiveAcademicYear(tenantId).catch(() => null),
          ]).then(([y, a]) => ({ years: y, activeYear: a }))
        : Promise.resolve({ years: [], activeYear: null }),
      settingsService.getBilingualSettings(tenantId ?? undefined).catch(() => null),
      settingsService.getActiveIdentityProfile(tenantId ?? undefined).catch(() => null),
    ]);

  return {
    general,
    featuresData,
    academicYearsResult,
    bilingual,
    identity,
  };
}

export async function fetchSettingsBootstrap(
  tenantId: string | undefined,
): Promise<SettingsBootstrapPayload> {
  const [
    general,
    featuresData,
    security,
    orion,
    atlas,
    offline,
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
  ] = await Promise.all([
    settingsService.getGeneralSettings(tenantId).catch(() => null),
    settingsService.getFeatures(tenantId ?? undefined).catch(() => []),
    settingsService.getSecuritySettings(tenantId).catch(() => null),
    settingsService.getOrionSettings(tenantId).catch(() => null),
    settingsService.getAtlasSettings(tenantId).catch(() => null),
    settingsService.getOfflineSyncSettings(tenantId).catch(() => null),
    // ⭐ 2026-11-27 — getSettingsHistory retiré (onglet Historique supprimé
    //    définitivement, retour promoteur) : une requête économisée par
    //    chargement de la page Paramètres.
    tenantId
      ? Promise.all([
          settingsService.getAcademicYears(tenantId).catch(() => []),
          settingsService.getActiveAcademicYear(tenantId).catch(() => null),
        ]).then(([y, a]) => ({ years: y, activeYear: a }))
      : Promise.resolve({ years: [], activeYear: null }),
    settingsService.getPedagogicalStructure(tenantId ?? undefined).catch(() => null),
    settingsService.getBilingualSettings(tenantId ?? undefined).catch(() => null),
    settingsService.getCommunicationSettings(tenantId).catch(() => null),
    settingsService.getRoles(tenantId ?? undefined).catch(() => []),
    settingsService.getPermissions().catch(() => []),
    settingsService.getUsersWithRoles(tenantId ?? undefined).catch(() => []),
    settingsService.getBillingSettings(tenantId).catch(() => null),
    settingsService.getAvailablePlans().catch(() => []),
    settingsService.getBillingInvoices({ limit: 10 }, tenantId).catch(() => []),
    settingsService.getActiveIdentityProfile(tenantId ?? undefined).catch(() => null),
    settingsService.getIdentityHistory({ limit: 20 }, tenantId ?? undefined).catch(() => ({ versions: [] })),
    settingsService.getEducationStructure(tenantId ?? undefined).catch(() => null),
    Promise.all([
      settingsService.getBilingualBillingImpact(tenantId ?? undefined).catch(() => null),
      settingsService.getBilingualCheckMigration(tenantId ?? undefined).catch(() => ({ migrationNeeded: false })),
    ]).then(([impact, migration]) => ({
      impact,
      migrationNeeded: (migration as { migrationNeeded?: boolean })?.migrationNeeded ?? null,
    })),
  ]);

  return {
    general,
    featuresData,
    security,
    orion,
    atlas,
    offline,
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
  };
}
