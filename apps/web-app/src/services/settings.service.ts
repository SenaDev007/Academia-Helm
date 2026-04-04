/**
 * ============================================================================
 * SERVICE SETTINGS - API Client pour le module Paramètres
 * ============================================================================
 */

import { getClientAuthorizationHeader, tryRefreshAccessToken } from '@/lib/auth/client-access-token';

const BASE_URL = '/api/settings';

function getErrorMessage(error: { message?: unknown; error?: string }, fallback: string): string {
  const msg = error.message;
  if (Array.isArray(msg) && msg.length) return String(msg[0]);
  if (typeof msg === 'string') return msg;
  if (error.error && typeof error.error === 'string') return error.error;
  return fallback;
}

function settingsAuthHeaders(extra?: HeadersInit): Record<string, string> {
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getClientAuthorizationHeader(),
  };
  if (!extra) return base;
  if (extra instanceof Headers) {
    extra.forEach((v, k) => {
      base[k] = v;
    });
    return base;
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) base[k] = v;
    return base;
  }
  return { ...base, ...(extra as Record<string, string>) };
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: settingsAuthHeaders(options.headers),
  });

  if (response.status === 401 && (await tryRefreshAccessToken())) {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: settingsAuthHeaders(options.headers),
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Une erreur est survenue' }));
    throw new Error(getErrorMessage(error, `HTTP ${response.status}`));
  }

  return response.json();
}

/** Appels sans cache pour données toujours à jour (ex. années scolaires depuis le backend) */
async function fetchWithAuthNoCache(url: string, options: RequestInit = {}) {
  const noCacheHeaders = (): Record<string, string> => ({
    ...settingsAuthHeaders(options.headers),
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  });

  let response = await fetch(url, {
    ...options,
    cache: 'no-store',
    credentials: 'include',
    headers: noCacheHeaders(),
  });

  if (response.status === 401 && (await tryRefreshAccessToken())) {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      credentials: 'include',
      headers: noCacheHeaders(),
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Une erreur est survenue' }));
    throw new Error(getErrorMessage(error, `HTTP ${response.status}`));
  }

  return response.json();
}

// ============================================================================
// IDENTITÉ & PARAMÈTRES GÉNÉRAUX
// ============================================================================

export async function getGeneralSettings() {
  return fetchWithAuth(`${BASE_URL}/general`);
}

export async function updateGeneralSettings(data: {
  schoolName?: string;
  abbreviation?: string;
  establishmentType?: string;
  authorizationNumber?: string;
  authorizationDate?: string;
  foundingDate?: string;
  logoUrl?: string;
  sealUrl?: string;
  signatureUrl?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  secondaryPhone?: string;
  fax?: string;
  email?: string;
  website?: string;
  whatsapp?: string;
  timezone?: string;
  defaultLanguage?: string;
  currency?: string;
  currencySymbol?: string;
  slogan?: string;
  primaryColor?: string;
  secondaryColor?: string;
}) {
  return fetchWithAuth(`${BASE_URL}/general`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// IDENTITÉ ÉTABLISSEMENT — SOURCE LÉGALE DE VÉRITÉ VERSIONNÉE
// ============================================================================

export async function getActiveIdentityProfile(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/identity${qs}`);
}

export async function getIdentityHistory(options?: { limit?: number; offset?: number }, tenantId?: string | null) {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (tenantId) params.append('tenant_id', tenantId);
  return fetchWithAuth(`${BASE_URL}/identity/history?${params.toString()}`);
}

export async function createIdentityVersion(data: {
  schoolName: string;
  schoolAcronym?: string;
  schoolType?: string;
  authorizationNumber?: string;
  foundationDate?: string;
  slogan?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  postalCode?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  email?: string;
  website?: string;
  currency?: string;
  timezone?: string;
  logoUrl?: string;
  stampUrl?: string;
  directorSignatureUrl?: string;
  changeReason?: string;
}, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/identity${qs}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function activateIdentityVersion(versionId: string, reason?: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/identity/activate/${versionId}${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
}

export async function getIdentityPreview(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/identity/preview${qs}`);
}

// ============================================================================
// CACHETS & SIGNATURES GÉNÉRÉS (tenant_stamps / tenant_signatures)
// Liés au niveau scolaire et aux rôles (départements administratifs).
// ============================================================================

export type StampFormat = 'circular' | 'rectangular' | 'oval';

/** Un set de cachets pour un niveau (ou global si educationLevelId null) */
export type StampsData = {
  educationLevelId: string | null;
  educationLevelName: string | null;
  circularStampUrl: string | null;
  rectangularStampUrl: string | null;
  ovalStampUrl: string | null;
  generatedAt: string | null;
};

/** Élément de la liste des cachets (tous niveaux) */
export type StampsListItem = StampsData & { id: string; tenantId: string };

/** Une signature : responsable par niveau et par rôle */
export type SignatureListItem = {
  id: string;
  tenantId: string;
  educationLevelId: string | null;
  educationLevelName: string | null;
  role: string;
  holderFirstName: string;
  holderLastName: string;
  holderName: string;
  signatureUrl: string | null;
  generatedAt: string | null;
};

/** Rôles (départements) pour les signatures */
export const SIGNATURE_ROLES = [
  { value: 'DIRECTEUR', label: 'Directeur / Directrice' },
  { value: 'DIRECTEUR_ADJOINT', label: 'Directeur adjoint' },
  { value: 'COMPTABLE', label: 'Comptable' },
  { value: 'SECRETAIRE', label: 'Secrétaire' },
  { value: 'RESPONSABLE_PEDAGOGIQUE', label: 'Responsable pédagogique' },
  { value: 'AUTRE', label: 'Autre' },
] as const;

function stampsQuery(tenantId?: string | null, educationLevelId?: string | null, list?: boolean): string {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenant_id', tenantId);
  if (list) params.set('list', 'true');
  if (educationLevelId != null && educationLevelId !== '') params.set('education_level_id', educationLevelId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Liste des cachets (tous niveaux + global) */
export async function getStampsList(tenantId?: string | null): Promise<StampsListItem[]> {
  const qs = stampsQuery(tenantId, undefined, true);
  return fetchWithAuth(`${BASE_URL}/stamps${qs}`);
}

/** Un set de cachets pour un niveau (ou global si educationLevelId null) */
export async function getStamps(
  tenantId?: string | null,
  educationLevelId?: string | null
): Promise<StampsData> {
  const qs = stampsQuery(tenantId, educationLevelId, false);
  return fetchWithAuth(`${BASE_URL}/stamps${qs}`);
}

export async function generateStamps(
  tenantId?: string | null,
  options?: { formats?: StampFormat[]; educationLevelId?: string | null }
): Promise<StampsData & { generatedAt: string }> {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/stamps/generate${qs}`, {
    method: 'POST',
    body: JSON.stringify({
      formats: options?.formats ?? ['circular', 'rectangular', 'oval'],
      educationLevelId: options?.educationLevelId ?? null,
    }),
  });
}

/** URL pour afficher l'image d'un cachet (par niveau) ou d'une signature (par id) */
export function getStampsAssetUrl(
  type: 'circular' | 'rectangular' | 'oval' | 'signature',
  tenantId?: string | null,
  educationLevelId?: string | null,
  signatureId?: string | null
): string {
  const params = new URLSearchParams();
  params.set('type', type);
  if (tenantId) params.set('tenant_id', tenantId);
  if (type !== 'signature' && educationLevelId != null && educationLevelId !== '')
    params.set('education_level_id', educationLevelId);
  if (type === 'signature' && signatureId) params.set('signature_id', signatureId);
  return `${BASE_URL}/stamps/asset?${params.toString()}`;
}

/** Liste des signatures (optionnel filtre par niveau) */
export async function getSignaturesList(
  tenantId?: string | null,
  educationLevelId?: string | null
): Promise<SignatureListItem[]> {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenant_id', tenantId);
  if (educationLevelId != null && educationLevelId !== '') params.set('education_level_id', educationLevelId);
  const qs = params.toString();
  return fetchWithAuth(`${BASE_URL}/signatures${qs ? `?${qs}` : ''}`);
}

/** Générer une signature pour un niveau et un rôle (département) */
export async function generateSignature(
  tenantId: string | null | undefined,
  data: {
    role: string;
    holderFirstName: string;
    holderLastName: string;
    educationLevelId?: string | null;
  }
): Promise<SignatureListItem & { generatedAt: string }> {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/signature/generate${qs}`, {
    method: 'POST',
    body: JSON.stringify({
      role: data.role,
      holderFirstName: data.holderFirstName,
      holderLastName: data.holderLastName,
      educationLevelId: data.educationLevelId ?? null,
    }),
  });
}

// ============================================================================
// STRUCTURE PÉDAGOGIQUE
// ============================================================================

export async function getPedagogicalStructure(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/pedagogical-structure${qs}`);
}

export async function updatePedagogicalStructure(
  data: {
    maternelleEnabled?: boolean;
    primaireEnabled?: boolean;
    secondaireEnabled?: boolean;
    cyclesConfiguration?: any;
    activeSeries?: string[];
    allowLevelModification?: boolean;
  },
  tenantId?: string | null
) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/pedagogical-structure${qs}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Structure pedagogique hierarchique (niveaux -> cycles -> grades -> classes physiques)
export async function getEducationStructure(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuthNoCache(`${BASE_URL}/education/structure${qs}`);
}

export async function initializeEducationStructure(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/education/structure/initialize${qs}`, { method: 'POST' });
}

export async function getEducationClassrooms(academicYearId: string, tenantId?: string | null) {
  const qs = tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuthNoCache(`${BASE_URL}/education/classrooms?academic_year_id=${encodeURIComponent(academicYearId)}${qs}`);
}

export async function createEducationClassroom(
  data: { academicYearId: string; gradeId: string; name: string; code?: string; capacity?: number },
  tenantId?: string | null
) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/education/classrooms${qs}`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEducationClassroom(
  id: string,
  data: { name?: string; code?: string; capacity?: number; isActive?: boolean; gradeId?: string },
  tenantId?: string | null
) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/education/classrooms/${id}${qs}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function archiveEducationClassroom(id: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/education/classrooms/${id}/archive${qs}`, { method: 'POST' });
}

export async function duplicateEducationClassrooms(
  oldAcademicYearId: string,
  newAcademicYearId: string,
  tenantId?: string | null
) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/education/classrooms/duplicate${qs}`, {
    method: 'POST',
    body: JSON.stringify({ oldAcademicYearId, newAcademicYearId }),
  });
}

export async function setEducationLevelEnabled(id: string, isEnabled: boolean, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/education/levels/${id}/enabled${qs}`, {
    method: 'PUT',
    body: JSON.stringify({ isEnabled }),
  });
}

// ============================================================================
// OPTION BILINGUE
// ============================================================================

export async function getBilingualSettings(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/bilingual${qs}`);
}

export async function updateBilingualSettings(data: {
  isEnabled?: boolean;
  separateSubjects?: boolean;
  separateGrades?: boolean;
  defaultLanguage?: string;
  defaultUILanguage?: string;
  billingImpactAcknowledged?: boolean;
  pricingSupplement?: number;
}, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/bilingual${qs}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getBilingualCheckMigration(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/bilingual/check-migration${qs}`);
}

export async function getBilingualBillingImpact(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/bilingual/billing-impact${qs}`);
}

export async function startBilingualMigration(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/bilingual/migrate${qs}`, { method: 'POST' });
}

// ============================================================================
// FEATURE FLAGS (Modules & fonctionnalités)
// ============================================================================

export async function getFeatures(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/features${qs}`);
}

export async function enableFeature(featureCode: string, reason?: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/features/${featureCode}/enable${qs}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function disableFeature(featureCode: string, reason?: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/features/${featureCode}/disable${qs}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function enableAllModules(reason?: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/features/enable-all${qs}`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? 'Activation globale depuis les paramètres' }),
  });
}

export async function disableAllModules(reason?: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/features/disable-all${qs}`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason ?? 'Désactivation globale depuis les paramètres' }),
  });
}

// ============================================================================
// SÉCURITÉ
// ============================================================================

export async function getSecuritySettings() {
  return fetchWithAuth(`${BASE_URL}/security`);
}

export async function updateSecuritySettings(data: {
  passwordMinLength?: number;
  passwordRequireUppercase?: boolean;
  passwordRequireLowercase?: boolean;
  passwordRequireNumbers?: boolean;
  passwordRequireSpecial?: boolean;
  passwordExpirationDays?: number | null;
  sessionTimeoutMinutes?: number;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
  twoFactorEnabled?: boolean;
  requireEmailVerification?: boolean;
  auditLogRetentionDays?: number;
  dataRetentionYears?: number;
  gdprCompliant?: boolean;
  allowInspectionAccess?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/security`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// ORION
// ============================================================================

export async function getOrionSettings() {
  return fetchWithAuth(`${BASE_URL}/orion`);
}

export async function updateOrionSettings(data: {
  isEnabled?: boolean;
  alertThresholdCritical?: number;
  alertThresholdWarning?: number;
  kpiCalculationFrequency?: string;
  autoGenerateInsights?: boolean;
  insightsFrequency?: string;
  visibleKPICategories?: string[];
  allowOrionExports?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/orion`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// ATLAS
// ============================================================================

export async function getAtlasSettings() {
  return fetchWithAuth(`${BASE_URL}/atlas`);
}

export async function updateAtlasSettings(data: {
  isEnabled?: boolean;
  scope?: string;
  allowedModules?: string[];
  allowHumanHandoff?: boolean;
  conversationHistoryDays?: number;
  maxConversationsPerDay?: number | null;
  language?: string;
}) {
  return fetchWithAuth(`${BASE_URL}/atlas`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// OFFLINE SYNC
// ============================================================================

export async function getOfflineSyncSettings() {
  return fetchWithAuth(`${BASE_URL}/offline-sync`);
}

export async function updateOfflineSyncSettings(data: {
  isEnabled?: boolean;
  syncFrequencyMinutes?: number;
  conflictResolution?: string;
  autoSyncOnConnect?: boolean;
  maxOfflineDays?: number;
  allowOfflineModification?: boolean;
  syncOnBackground?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/offline-sync`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// COMMUNICATION
// ============================================================================

export async function getCommunicationSettings() {
  return fetchWithAuth(`${BASE_URL}/communication`);
}

export async function updateCommunicationSettings(data: {
  smsProvider?: string;
  smsCredentials?: any;
  smsEnabled?: boolean;
  whatsappProvider?: string;
  whatsappCredentials?: any;
  whatsappEnabled?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  smtpSecure?: boolean;
  emailEnabled?: boolean;
  defaultSenderName?: string;
  defaultSenderPhone?: string;
  dailySmsLimit?: number;
  dailyEmailLimit?: number;
}) {
  return fetchWithAuth(`${BASE_URL}/communication`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// ANNÉES SCOLAIRES
// ============================================================================

/** Optionnel : pour Plateforme Owner, passer l'ID de l'établissement à consulter (ou depuis l'URL ?tenant_id=) */
export async function getAcademicYears(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuthNoCache(`${BASE_URL}/academic-years${qs}`);
}

export async function getActiveAcademicYear(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuthNoCache(`${BASE_URL}/academic-years/active${qs}`);
}

export async function getAcademicYearStats(id: string) {
  return fetchWithAuth(`${BASE_URL}/academic-years/${id}/stats`);
}

export async function createAcademicYear(data: {
  name: string;
  label: string;
  preEntryDate?: string;
  startDate?: string;
  endDate?: string;
}) {
  return fetchWithAuth(`${BASE_URL}/academic-years`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function activateAcademicYear(id: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/academic-years/${id}/activate${qs}`, {
    method: 'POST',
  });
}

export async function closeAcademicYear(id: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/academic-years/${id}/close${qs}`, {
    method: 'POST',
  });
}

export async function generateNextAcademicYear(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/academic-years/generate-next${qs}`, {
    method: 'POST',
  });
}

export async function updateAcademicYear(id: string, data: {
  name?: string;
  label?: string;
  preEntryDate?: string;
  officialStartDate?: string;
  startDate?: string;
  endDate?: string;
}, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/academic-years/${id}${qs}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAcademicYear(id: string) {
  return fetchWithAuth(`${BASE_URL}/academic-years/${id}`, {
    method: 'DELETE',
  });
}

export async function duplicateAcademicYear(sourceId: string, data: {
  name: string;
  label: string;
  startDate: string;
  endDate: string;
  preEntryDate?: string;
  duplicateClasses?: boolean;
  duplicateFees?: boolean;
  duplicateSubjects?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/academic-years/${sourceId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// PÉRIODES ACADÉMIQUES (trimestres / semestres / séquences)
// ============================================================================

export type AcademicPeriodType = 'TRIMESTER' | 'SEMESTER' | 'SEQUENCE' | 'CUSTOM';

export interface AcademicPeriod {
  id: string;
  tenantId: string;
  academicYearId: string;
  name: string;
  type: AcademicPeriodType;
  periodOrder: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getAcademicYearPeriods(academicYearId: string, tenantId?: string | null): Promise<AcademicPeriod[]> {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  const res = await fetchWithAuthNoCache(`${BASE_URL}/academic-years/${academicYearId}/periods${qs}`);
  return Array.isArray(res) ? res : [];
}

/** Crée les 3 trimestres par défaut pour une année qui n'a pas encore de périodes. */
export async function createDefaultAcademicPeriods(academicYearId: string, tenantId?: string | null): Promise<AcademicPeriod[]> {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  const res = await fetchWithAuth(`${BASE_URL}/academic-years/${academicYearId}/periods/bootstrap${qs}`, { method: 'POST' });
  return Array.isArray(res) ? res : [];
}

export async function getCurrentAcademicPeriod(academicYearId: string, tenantId?: string | null): Promise<AcademicPeriod | null> {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuthNoCache(`${BASE_URL}/academic-years/${academicYearId}/periods/current${qs}`);
}

export async function createAcademicPeriod(
  academicYearId: string,
  data: { name: string; type: AcademicPeriodType; periodOrder: number; startDate: string; endDate: string },
  tenantId?: string | null
) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/academic-years/${academicYearId}/periods${qs}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAcademicPeriod(
  id: string,
  data: { name?: string; type?: AcademicPeriodType; periodOrder?: number; startDate?: string; endDate?: string },
  tenantId?: string | null
) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/periods/${id}${qs}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function activateAcademicPeriod(id: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/periods/${id}/activate${qs}`, { method: 'POST' });
}

export async function closeAcademicPeriod(id: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/periods/${id}/close${qs}`, { method: 'POST' });
}

// ============================================================================
// HISTORIQUE
// ============================================================================

export async function getSettingsHistory(options?: {
  category?: string;
  key?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.category) params.append('category', options.category);
  if (options?.key) params.append('key', options.key);
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.limit) params.append('limit', options.limit.toString());

  return fetchWithAuth(`${BASE_URL}/history?${params.toString()}`);
}

// ============================================================================
// RÔLES & PERMISSIONS (RBAC multi-tenant)
// ============================================================================

function rolesQs(tenantId?: string | null) {
  return tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
}

/** Force la création des permissions et rôles système en BDD si absents (production, idempotent). */
export async function ensureRbacInitialized() {
  return fetchWithAuth(`${BASE_URL}/rbac/ensure-initialized`, { method: 'POST' });
}

export async function getRoles(tenantId?: string | null) {
  return fetchWithAuth(`${BASE_URL}/roles${rolesQs(tenantId)}`);
}

export async function getPermissions() {
  return fetchWithAuth(`${BASE_URL}/permissions`);
}

export async function getPermissionsGrouped() {
  return fetchWithAuth(`${BASE_URL}/permissions/grouped`);
}

export async function createRole(data: {
  name: string;
  description?: string;
  isSystemRole?: boolean;
  canAccessOrion?: boolean;
  canAccessAtlas?: boolean;
  allowedLevelIds?: string[];
  permissionIds?: string[];
}, tenantId?: string | null) {
  return fetchWithAuth(`${BASE_URL}/roles${rolesQs(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(roleId: string, data: {
  name?: string;
  description?: string;
  canAccessOrion?: boolean;
  canAccessAtlas?: boolean;
  allowedLevelIds?: string[];
}, tenantId?: string | null) {
  return fetchWithAuth(`${BASE_URL}/roles/${roleId}${rolesQs(tenantId)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(roleId: string, tenantId?: string | null) {
  return fetchWithAuth(`${BASE_URL}/roles/${roleId}${rolesQs(tenantId)}`, {
    method: 'DELETE',
  });
}

export async function updateRolePermissions(roleId: string, permissionIds: string[], tenantId?: string | null) {
  return fetchWithAuth(`${BASE_URL}/roles/${roleId}/permissions${rolesQs(tenantId)}`, {
    method: 'PUT',
    body: JSON.stringify({ permissionIds }),
  });
}

/** Liste des utilisateurs du tenant avec leurs rôles (Paramètres → Utilisateurs & rôles) */
export async function getUsersWithRoles(tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/users${qs}`);
}

/** Assigne un rôle à un utilisateur */
export async function assignRoleToUser(userId: string, roleId: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/users/${userId}/assign-role${qs}`, {
    method: 'POST',
    body: JSON.stringify({ roleId }),
  });
}

/** Révoque un rôle d'un utilisateur */
export async function revokeRoleFromUser(userId: string, roleId: string, tenantId?: string | null) {
  const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
  return fetchWithAuth(`${BASE_URL}/users/${userId}/revoke-role${qs}`, {
    method: 'POST',
    body: JSON.stringify({ roleId }),
  });
}

// ============================================================================
// TESTS DE COMMUNICATION
// ============================================================================

export async function testSms() {
  return fetchWithAuth(`${BASE_URL}/communication/test-sms`, {
    method: 'POST',
  });
}

export async function testEmail() {
  return fetchWithAuth(`${BASE_URL}/communication/test-email`, {
    method: 'POST',
  });
}

export async function testWhatsapp() {
  return fetchWithAuth(`${BASE_URL}/communication/test-whatsapp`, {
    method: 'POST',
  });
}

// ============================================================================
// FACTURATION & ABONNEMENT SaaS
// ============================================================================

export async function getBillingSettings() {
  return fetchWithAuth(`${BASE_URL}/billing`);
}

export async function getBillingSummary() {
  return fetchWithAuth(`${BASE_URL}/billing/summary`);
}

export async function getAvailablePlans() {
  return fetchWithAuth(`${BASE_URL}/billing/plans`);
}

export async function updateBillingSettings(data: {
  billingCycle?: string;
  autoRenew?: boolean;
  bilingualEnabled?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/billing`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePlan(planCode: string) {
  return fetchWithAuth(`${BASE_URL}/billing/change-plan`, {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  });
}

export async function getBillingInvoices(options?: { status?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.limit) params.append('limit', options.limit.toString());
  return fetchWithAuth(`${BASE_URL}/billing/invoices?${params.toString()}`);
}

export async function getFeaturesBillingImpact() {
  return fetchWithAuth(`${BASE_URL}/billing/features-impact`);
}
