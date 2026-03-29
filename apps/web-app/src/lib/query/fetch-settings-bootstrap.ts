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
  historyData: unknown;
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
  ] = await Promise.all([
    settingsService.getGeneralSettings().catch(() => null),
    settingsService.getFeatures(tenantId ?? undefined).catch(() => []),
    settingsService.getSecuritySettings().catch(() => null),
    settingsService.getOrionSettings().catch(() => null),
    settingsService.getAtlasSettings().catch(() => null),
    settingsService.getOfflineSyncSettings().catch(() => null),
    settingsService.getSettingsHistory({ limit: 50 }).catch(() => []),
    tenantId
      ? Promise.all([
          settingsService.getAcademicYears(tenantId).catch(() => []),
          settingsService.getActiveAcademicYear(tenantId).catch(() => null),
        ]).then(([y, a]) => ({ years: y, activeYear: a }))
      : Promise.resolve({ years: [], activeYear: null }),
    settingsService.getPedagogicalStructure(tenantId ?? undefined).catch(() => null),
    settingsService.getBilingualSettings(tenantId ?? undefined).catch(() => null),
    settingsService.getCommunicationSettings().catch(() => null),
    settingsService.getRoles(tenantId ?? undefined).catch(() => []),
    settingsService.getPermissions().catch(() => []),
    settingsService.getUsersWithRoles(tenantId ?? undefined).catch(() => []),
    settingsService.getBillingSettings().catch(() => null),
    settingsService.getAvailablePlans().catch(() => []),
    settingsService.getBillingInvoices({ limit: 10 }).catch(() => []),
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
  };
}
