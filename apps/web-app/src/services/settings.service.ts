/**
 * ============================================================================
 * SERVICE SETTINGS - API Client pour le module Paramètres
 * ============================================================================
 */

const BASE_URL = '/api/settings';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Une erreur est survenue' }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
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

export async function getActiveIdentityProfile() {
  return fetchWithAuth(`${BASE_URL}/identity`);
}

export async function getIdentityHistory(options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
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
}) {
  return fetchWithAuth(`${BASE_URL}/identity`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function activateIdentityVersion(versionId: string, reason?: string) {
  return fetchWithAuth(`${BASE_URL}/identity/activate/${versionId}`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
}

export async function getIdentityPreview() {
  return fetchWithAuth(`${BASE_URL}/identity/preview`);
}

// ============================================================================
// STRUCTURE PÉDAGOGIQUE
// ============================================================================

export async function getPedagogicalStructure() {
  return fetchWithAuth(`${BASE_URL}/pedagogical-structure`);
}

export async function updatePedagogicalStructure(data: {
  maternelleEnabled?: boolean;
  primaireEnabled?: boolean;
  secondaireEnabled?: boolean;
  cyclesConfiguration?: any;
  activeSeries?: string[];
  allowLevelModification?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/pedagogical-structure`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// OPTION BILINGUE
// ============================================================================

export async function getBilingualSettings() {
  return fetchWithAuth(`${BASE_URL}/bilingual`);
}

export async function updateBilingualSettings(data: {
  isEnabled?: boolean;
  separateSubjects?: boolean;
  separateGrades?: boolean;
  defaultUILanguage?: string;
  billingImpactAcknowledged?: boolean;
}) {
  return fetchWithAuth(`${BASE_URL}/bilingual`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getBilingualBillingImpact() {
  return fetchWithAuth(`${BASE_URL}/bilingual/billing-impact`);
}

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export async function getFeatures() {
  return fetchWithAuth(`${BASE_URL}/features`);
}

export async function enableFeature(featureCode: string, reason?: string) {
  return fetchWithAuth(`${BASE_URL}/features/${featureCode}/enable`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function disableFeature(featureCode: string, reason?: string) {
  return fetchWithAuth(`${BASE_URL}/features/${featureCode}/disable`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
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

export async function getAcademicYears() {
  return fetchWithAuth(`${BASE_URL}/academic-years`);
}

export async function getActiveAcademicYear() {
  return fetchWithAuth(`${BASE_URL}/academic-years/active`);
}

export async function createAcademicYear(data: {
  name: string;
  label: string;
  preEntryDate?: string;
  startDate: string;
  endDate: string;
}) {
  return fetchWithAuth(`${BASE_URL}/academic-years`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function activateAcademicYear(id: string) {
  return fetchWithAuth(`${BASE_URL}/academic-years/${id}/activate`, {
    method: 'POST',
  });
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
// RÔLES & PERMISSIONS
// ============================================================================

export async function getRoles() {
  return fetchWithAuth(`${BASE_URL}/roles`);
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
}) {
  return fetchWithAuth(`${BASE_URL}/roles`, {
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
}) {
  return fetchWithAuth(`${BASE_URL}/roles/${roleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(roleId: string) {
  return fetchWithAuth(`${BASE_URL}/roles/${roleId}`, {
    method: 'DELETE',
  });
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]) {
  return fetchWithAuth(`${BASE_URL}/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionIds }),
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
