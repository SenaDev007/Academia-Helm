# Academia Helm — Work Log

---
Task ID: 1
Agent: Main Agent
Task: Fix authentication flow - reproduce dev login flow for all login types

Work Log:
- Analyzed the dev login flow (portal DEV button → /api/auth/login with portal_type)
- Identified that the backend AuthService.login() only resolved tenant_id by UUID, not slug
- When users navigate via school-portal (e.g., /login?portal=school&tenant=slug), only the slug was available
- Added `resolveTenantId()` method to AuthService that resolves both UUID and slug (like PortalAuthService)
- Updated all tenant_id resolution in AuthService.login() to use the new method
- After resolution, the slug is replaced with the resolved UUID for downstream processing

Stage Summary:
- Backend now accepts both UUID and slug as tenant_id in /api/auth/login
- All login types (school, teacher, parent) can work with tenant slugs from URL params
- The dev login flow is now reproducible for all other login types

---
Task ID: 2
Agent: Main Agent
Task: Disable Cloudflare Turnstile completely

Work Log:
- Modified turnstile.ts: verifyTurnstile() now always returns { success: true } immediately
- Original verification code preserved as comments for easy re-enabling later
- Modified TurnstileWidget.tsx: component renders null and auto-passes 'skip-development' token via useEffect
- Removed all Cloudflare script loading, widget rendering, and status indicators
- Modified LoginPage.tsx handleSubmit: removed Turnstile token requirement check (commented out)
- Server-side routes still call verifyTurnstile() but it always passes

Stage Summary:
- Turnstile is completely disabled - no widget shown, no verification required
- Users can authenticate without any human verification challenge
- Ready to re-enable by uncommenting the code in turnstile.ts and restoring TurnstileWidget.tsx from git history

---
Task ID: 3
Agent: Main Agent
Task: Analyze settings module vs commit 431e2bd and restore

Work Log:
- Compared settings page code between current state and commit 431e2bd - IDENTICAL (zero diff)
- The settings page (4742 lines) with 15 tabs was unchanged
- Found that only settings API routes were modified with ISR caching (revalidate: 120/300)
- ISR caching could cause stale data: settings changes not immediately visible
- Removed all `export const revalidate = N` declarations from settings API routes
- Restored `cache: 'no-store'` in all settings fetch calls
- Simplified settings-proxy-fetch.ts: removed conditional ISR logic, always uses no-store
- Affected routes: general, academic-years/active, education/structure, features, identity, permissions/grouped, roles, finance/settings

Stage Summary:
- Settings page code was already identical to commit 431e2bd
- The ISR caching additions were the only changes - now reverted
- All settings API routes now use cache: 'no-store' for immediate data freshness
- Settings changes should be immediately visible after saving

---
Task ID: 4
Agent: Sub Agent
Task: Create Riverpod providers for all modules

Work Log:
- Read existing pattern from `lib/features/students/providers/students_provider.dart`
- Read all 8 service files to understand available methods:
  - FinanceService: 20+ methods (fee structures, expenses, transactions, accounts, settings, treasury, recovery, KPIs, anomalies, audit)
  - HrService: 9 methods (staff CRUD, contracts CRUD, payroll, leaves, credentials)
  - PedagogyService: 25+ methods (class diaries, lesson plans, journals, assignments, subjects, series, teachers, profiles, classes, timetables, semainier, homework, materials, KPIs, ORION)
  - ExamsService: 11 methods (evaluations, grades, bulletins, councils, config, dashboard, institutional exams)
  - CommunicationService: 10 methods (messages, announcements, email, SMS, WhatsApp, campaigns, templates)
  - SettingsService: 14 methods (general, academic years, classes, subjects, roles, permissions, features, security, billing, communication, seals)
  - MeetingsService: 12 methods (CRUD, agenda, minutes, participants, decisions)
  - OrionService: 8 methods (ask, monthly summary, alerts, history, config, KPIs, insights) — mostly read-only
- Created 8 provider files following the exact pattern from students_provider.dart
- Used `error.displayMessage` (via ApiErrorX extension) instead of `error.message` for consistency
- Each provider file includes: service singleton, list/detail FutureProviders, family providers for parameterized queries, and a StateNotifierProvider for mutations
- Created argument classes (TeacherAssignmentArgs, ClassSubjectsArgs, SemainierArgs, OrionAlertsArgs, OrionHistoryArgs) for complex family providers
- ORION module respects its read-only constraint — mutation notifier only has acknowledgeAlert and updateConfig

Files Created:
1. `lib/features/finance/providers/finance_provider.dart` — 18 providers + 14 mutation methods
2. `lib/features/hr/providers/hr_provider.dart` — 9 providers + 7 mutation methods
3. `lib/features/pedagogy/providers/pedagogy_provider.dart` — 16 providers + 20 mutation methods + 3 arg classes
4. `lib/features/exams/providers/exams_provider.dart` — 10 providers + 7 mutation methods
5. `lib/features/communication/providers/communication_provider.dart` — 7 providers + 7 mutation methods
6. `lib/features/settings/providers/settings_provider.dart` — 12 providers + 7 mutation methods
7. `lib/features/meetings/providers/meetings_provider.dart` — 7 providers + 8 mutation methods
8. `lib/features/orion/providers/orion_provider.dart` — 9 providers + 3 mutation methods + 2 arg classes

Stage Summary:
- All 8 modules now have complete Riverpod provider coverage matching their service layers
- Pattern is consistent: service singleton → FutureProvider for lists → FutureProvider.family for details/filtered queries → StateNotifierProvider for mutations
- All providers use `Map<String, dynamic>` / `List<Map<String, dynamic>>` matching the service layer return types
- Mutation notifiers auto-invalidate relevant providers on success and properly handle loading/error states

---
Task ID: 3-7-9
Agent: Sub Agent
Task: Portal selection + permissions system + secure logout

Work Log:

### TASK 3: Portal Selection Screen
- Created `lib/features/auth/providers/portal_provider.dart`:
  - `PortalType` enum with 4 values: platform, school, teacher, parent
  - Extension `PortalTypeX` with `displayName`, `description`, `apiName` getters (French)
  - `selectedPortalProvider` — StateProvider<PortalType?>
  - `portalDisplayNameProvider` — derived Provider<String>

- Created `lib/features/auth/pages/portal_select_screen.dart`:
  - PortalSelectScreen with AH branding header
  - 4 portal cards: PLATFORM (cloud/navy), SCHOOL (school/blue), TEACHER (cast_for_education/teal), PARENT (family_restroom/gold-brown)
  - Each card has icon, title (French), description (French), gradient background
  - Phone: 2×2 grid via GridView.count
  - Tablet: horizontal cards with arrow icon
  - On tap → store selection in portal provider → navigate to /login

- Updated `lib/core/router/app_router.dart`:
  - Added `/portal-select` route pointing to PortalSelectScreen
  - Added `/logout` route pointing to LogoutScreen
  - Updated splash import

- Updated `lib/core/router/route_guards.dart`:
  - Changed unauthenticated redirect from `/login` to `/portal-select`
  - Added `/logout` to unconditional allow list
  - Authenticated users on `/portal-select` or `/login` redirect to dashboard/tenant-select

- Updated `lib/features/auth/pages/splash_screen.dart`:
  - Unauthenticated users now redirect to `/portal-select` instead of `/login`

### TASK 7: Granular Permissions System
- Created `lib/core/permissions/permission_module.dart`:
  - Enum `PermissionModule` with 17 values: eleves, inscriptions, documentsScolaires, organisationPedagogique, materielPedagogique, examens, bulletins, finances, recouvrement, depenses, rh, paie, communication, parametres, anneesScolaires, orion, qhse
  - Each has `displayName` getter (French) and `apiKey` getter
  - Static `fromApiKey` lookup method

- Created `lib/core/permissions/permission_action.dart`:
  - Enum `PermissionAction` with: read, write, delete, manage
  - Each has `displayName` getter (French) and `apiKey` getter
  - Static `fromApiKey` lookup method

- Created `lib/core/permissions/permission.dart`:
  - `Permission` class with module and actions fields
  - `allows()`, `canRead`, `canWrite`, `canDelete`, `canManage` helpers
  - `fromJson()` factory for API response parsing
  - Custom equality and hashCode

- Created `lib/core/permissions/permissions_provider.dart`:
  - `permissionsProvider` — FutureProvider fetching `/auth/permissions`
  - `PermissionCheck` parameter class for family providers
  - `hasPermissionProvider` — Provider.family<bool, PermissionCheck>
  - `hasModuleAccessProvider` — Provider.family<bool, PermissionModule> (READ check)
  - `canWriteProvider` — Provider.family<bool, PermissionModule>
  - `canDeleteProvider` — Provider.family<bool, PermissionModule>
  - `canManageProvider` — Provider.family<bool, PermissionModule>

- Created `lib/core/permissions/permission_guard.dart`:
  - `PermissionGuard` ConsumerWidget that shows/hides children based on permission
  - Usage: `PermissionGuard(module: PermissionModule.finances, action: PermissionAction.write, child: ...)`
  - Optional `fallback` widget parameter

### TASK 9: 5-Step Secure Logout
- Created `lib/core/auth/logout_state.dart`:
  - `LogoutStep` enum with 5 steps: confirmation, serverInvalidation, offlinePreservation, contextCleanup, redirect
  - Each step has French `message` getter and `index`
  - `LogoutProgress` class with currentStep, progress (0.0-1.0), message
  - `LogoutResult` class with success/failure, error, completedSteps

- Created `lib/core/auth/secure_logout_service.dart`:
  - `SecureLogoutService` class with 5-step logout:
    1. Confirmation (UI dialog handled by caller)
    2. Server session invalidation (best-effort POST to /auth/logout, 5s timeout)
    3. Offline data preservation (Hive data kept, only auth keys targeted)
    4. App context cleanup (TokenStorage.clearTokens, FlutterSecureStorage auth keys, SharedPreferences session keys, invalidate authStateProvider)
    5. Controlled redirect (caller navigates to /portal-select)
  - Progress reporting via `onProgress` callback
  - Returns `LogoutResult` with success/failure

- Created `lib/features/auth/pages/logout_screen.dart`:
  - ConsumerStatefulWidget with auto-start logout on init
  - Navy gradient background matching app branding
  - Linear progress bar with gold accent
  - 5-step dot indicators (completed=gold check, current=spinning, pending=numbered)
  - Error state with "Réessayer" button and "Forcer la déconnexion" link
  - Auto-navigates to `/portal-select` on success

- Updated `lib/core/widgets/adaptive_scaffold.dart`:
  - Converted to ConsumerWidget for Riverpod access
  - Logout button in NavigationRail trailing now triggers confirmation dialog
  - Added logout tile in NavigationDrawer
  - Confirmation dialog: "Êtes-vous sûr de vouloir vous déconnecter ? Vos données hors-ligne seront préservées."
  - On confirm → navigate to `/logout` route which runs the 5-step process

### Supporting fixes
- Added `AHRadius` class to `lib/core/theme/ah_spacing.dart` (sm/md/lg/xl/xxl/full) — was referenced in 12+ files but never defined
- Added `AHColors.navyLight` constant to `lib/core/theme/ah_colors.dart` — was referenced in 6+ files but never defined
- Added `gray*` aliases (gray50-gray900) to `AHColors` — codebase used both `grey` and `gray` spellings

Stage Summary:
- Portal selection flow: splash → portal-select → login → tenant-select → dashboard
- 17-module × 4-action permission system with Riverpod providers and UI guard widget
- 5-step secure logout with progress UI, server invalidation, data preservation, and controlled redirect
- All user-facing strings in French
- Fixed missing AHRadius and AHColors.navyLight constants that existing code referenced

---
Task ID: 1-2
Agent: Sub Agent
Task: Unify auth + TokenStorage

Work Log:

### TASK 1: Unify the Auth System

The app had TWO competing auth systems:
1. `features/auth/providers/auth_provider.dart` — MOCK auth (fake tokens, hardcoded tenants)
2. `core/auth/auth_notifier.dart` — REAL auth (API calls, real tokens)

Unified them so only REAL auth (core/auth) is used everywhere.

#### 1. Enhanced `lib/core/auth/auth_state.dart`
- Added `TenantBasic` freezed class with: id, name, acronym, logoUrl, type, subdomain + `shortName` getter
- Added `availableTenants` (List<TenantBasic>), `selectedTenantId` (String?), and `selectedPortal` (PortalType?) fields to `AuthAuthenticated`
- Added `AuthState.loginLoading()` variant for login-specific loading state
- Imported `PortalType` from `core/enums/user_role.dart` (canonical source) instead of defining a new enum
- Added `AuthStateX` extension helpers: `isAuthenticated`, `isLoading`, `isLoginLoading`, `userOrNull`, `accessTokenOrNull`, `availableTenantsOrNull`, `selectedTenantIdOrNull`, `selectedPortalOrNull`, `hasTenant`, `roleOrNull`

#### 2. Enhanced `lib/core/auth/auth_notifier.dart`
- Added `selectTenant(String tenantId)` — calls `/tenants/select` API, persists session, updates state
- Added `selectPortal(PortalType portal)` — updates selected portal in state
- Updated `login()` to parse `availableTenants` from login response and persist session data
- Added `forgotPassword(String email)` — calls `/auth/forgot-password` API
- Added `resetPassword({required String token, required String newPassword})` — calls `/auth/reset-password` API
- Updated `updateUser()` to preserve all authenticated state fields (tenants, tenantId, portal)
- Added `_parseTenants()` helper to extract tenants from various API response formats

#### 3. Updated `lib/core/router/route_guards.dart`
- Replaced import of `features/auth/providers/auth_provider.dart` with `core/auth/auth_notifier.dart`, `core/auth/auth_providers.dart`, `core/auth/auth_state.dart`
- Updated `authGuardRedirect` to use `authNotifierProvider` instead of `authStateProvider`
- Updated `canAccessAdminRoute`, `canAccessTeacherRoute`, `canAccessParentRoute` to read from `currentUserRoleProvider` (real auth)

#### 4. Updated `lib/features/auth/pages/login_screen.dart`
- Changed from `authStateProvider` to `authNotifierProvider`
- Calls `authNotifier.login(email: email, password: password)`
- On success, navigates based on tenant count: 1 → auto-select → dashboard, >1 → tenant-select, 0 → dashboard
- Catches `AuthException` for proper error display

#### 5. Updated `lib/features/auth/pages/tenant_select_screen.dart`
- Reads tenants from `availableTenantsProvider` (core/auth)
- Calls `authNotifier.selectTenant(tenant.id)` (passing ID string)
- Uses `TenantBasic` type instead of `TenantInfo`

#### 6. Updated `lib/features/dashboard/pages/dashboard_screen.dart`
- Reads user name from `currentUserDisplayNameProvider` (core/auth)
- Reads tenant name from `authNotifierProvider` state (selectedTenantId → lookup in availableTenants)
- Reads role from `currentUserRoleProvider` (core/auth)

#### 7. Created `lib/core/auth/auth_providers.dart` (NEW FILE)
- `isAuthenticatedProvider` — derives from authNotifierProvider
- `currentUserProvider` — returns User?
- `currentUserRoleProvider` — returns String?
- `currentUserDisplayNameProvider` — returns String?
- `currentSelectedTenantIdProvider` — returns String?
- `availableTenantsProvider` — returns List<TenantBasic>
- `selectedPortalProvider` — returns PortalType?

#### 8. Deprecated `lib/features/auth/providers/auth_provider.dart`
- All classes and providers marked with `@Deprecated('Use ... from core/auth instead')`
- Deprecated `AuthState` class kept for backward compat, with `fromRealAuthState()` factory
- Deprecated `TenantInfo` class kept, with `fromTenantBasic()` factory
- Deprecated providers delegate to real auth providers via `real_providers` prefix import
- `authStateProvider` delegates to real `authNotifierProvider`
- `currentTenantNameProvider` reads from real auth state

#### 9. Updated all other files using mock auth
- `splash_screen.dart` — uses `authNotifierProvider`
- `profile_screen.dart` — uses `authNotifierProvider`, reads user/tenant from real auth state
- `ah_app_bar.dart` — uses `authNotifierProvider`, reads tenant/user data from real auth state
- `dashboard_provider.dart` — imports from `core/auth/auth_providers.dart`
- `tenant_card.dart` — uses `TenantBasic` instead of `TenantInfo`
- `permissions_provider.dart` — uses `authNotifierProvider` instead of `authStateProvider`
- `secure_logout_service.dart` — uses `authNotifierProvider`, added new TokenStorage keys to cleanup list

### TASK 2: Complete TokenStorage

#### 1. Enhanced `lib/core/auth/token_storage.dart`
- Added keys: `_sessionIdKey`, `_lastActivityKey`, `_userDataKey`, `_tenantDataKey`
- Added `setSessionId(String id)` / `getSessionId()`
- Added `persistSession({required Map<String, dynamic> user, Map<String, dynamic>? tenant})` — merges with existing user data, writes JSON to secure storage
- Added `getSessionUser()` / `getSessionUserSync()` — returns Map<String, dynamic>?
- Added `getSessionTenant()` / `getSessionTenantSync()` — returns Map<String, dynamic>?
- Added `updateLastActivity()` — writes current ISO8601 timestamp
- Added `getLastActivity()` — reads timestamp, returns DateTime?
- Updated `clearTokens()` to also clear new keys (_sessionIdKey, _lastActivityKey, _userDataKey, _tenantDataKey)
- In-memory cache (_cachedUserData, _cachedTenantData) for synchronous reads

#### 2. Fixed `lib/core/loading/post_login_flow.dart`
- Changed `AuthUser` reference to `User` (from core/auth/auth_state.dart)
- Changed `TenantInfo` reference to `Map<String, dynamic>?` for tenant data
- Removed `TokenStorage tokenStorage` parameter (TokenStorage is all-static)
- Changed `Dio _dio` field to `ApiClient _apiClient` parameter (passes as constructor arg)
- Fixed import: `../api/client.dart` → `../network/api_client.dart`
- Removed `import 'package:dio/dio.dart'` (no longer needed)
- All API calls use `_apiClient.getRaw()` instead of raw Dio calls

#### 3. Fixed `lib/core/widgets/loading/post_login_loading_screen.dart`
- Changed `AuthUser user` to `User user` (from core/auth/auth_state.dart)
- Changed `TenantInfo? tenant` to `Map<String, dynamic>? tenant`
- Added `required ApiClient apiClient` parameter
- Simplified navigation: always goes to `/dashboard` on success

Stage Summary:
- Single real auth system (core/auth) used everywhere — mock auth deprecated
- AuthState freezed model now includes tenants, portal, and login-specific loading
- AuthNotifier handles full lifecycle: login, tenant selection, portal selection, forgot/reset password
- TokenStorage complete with session persistence, activity tracking, and user/tenant data
- PostLoginFlow uses real ApiClient and User/TenantBasic types
- All 10+ files updated to import from core/auth instead of features/auth/providers
- Freezed .g.dart files need generation via `dart run build_runner build --delete-conflicting-outputs`

---
Task ID: 5
Agent: Sub Agent
Task: Replace ALL placeholder screens with real, functional module screens

Work Log:

### 1. Created Providers for 10 Missing Modules

Modules that had services+providers (9): students, finance, hr, pedagogy, exams, communication, settings, meetings, orion

Created providers for the remaining 10 modules using ApiClient:
1. `lib/features/aggregation/providers/aggregation_provider.dart` — 4 providers (dashboard, data, reports, mutation)
2. `lib/features/general/providers/general_provider.dart` — 5 providers (dashboard, news, documents, announcements, mutation)
3. `lib/features/library/providers/library_provider.dart` — 6 providers (dashboard, catalog, borrowings, returns, statistics, mutation)
4. `lib/features/transport/providers/transport_provider.dart` — 6 providers (dashboard, routes, vehicles, students, statistics, mutation)
5. `lib/features/canteen/providers/canteen_provider.dart` — 6 providers (dashboard, menus, reservations, payments, statistics, mutation)
6. `lib/features/infirmary/providers/infirmary_provider.dart` — 5 providers (dashboard, visits, medications, statistics, mutation)
7. `lib/features/qhse/providers/qhse_provider.dart` — 6 providers (dashboard, audits, incidents, risks, statistics, mutation)
8. `lib/features/educast/providers/educast_provider.dart` — 5 providers (dashboard, channels, videos, statistics, mutation)
9. `lib/features/shop/providers/shop_provider.dart` — 6 providers (dashboard, products, orders, payments, statistics, mutation)
10. `lib/features/platform/providers/platform_provider.dart` — 6 providers (dashboard, tenants, users, audit logs, statistics, mutation)

### 2. Created Shared Module Data Widgets

`lib/core/widgets/module_data_list.dart` — Contains:
- `ModuleDataList`: Reusable widget combining ModuleLoadingWrapper + ListView + empty state + optional FAB
- `ModuleDashboardView`: Reusable dashboard widget showing StatCards from provider data
- `StatCardConfig`: Configuration class for dashboard stat cards
- `showAddItemDialog()`: Helper to show a simple add-item dialog with text fields
- `AddFieldConfig`: Configuration for dialog fields

### 3. Converted ALL 19 Module Screens to ConsumerWidget

Each screen was converted from `StatefulWidget` with hardcoded data to `ConsumerWidget` using Riverpod providers and `ModuleLoadingWrapper`. Key patterns:

**Dashboard sub-tabs**: Use `ModuleDashboardView` with `StatCardConfig` and dashboard provider
**List sub-tabs**: Use `ModuleDataList` with list provider, empty states, and FAB for adding items
**Detail/Settings sub-tabs**: Use `ModuleLoadingWrapper<Map<String, dynamic>>` with detail provider
**Simple sub-tabs**: Use `SubTabContentWrapper` with `SectionHeader` (placeholder for future expansion)

Converted screens:
1. `students_screen.dart` — 16 sub-tabs, uses studentsProvider, studentEnrollmentsProvider, studentAdmissionsProvider, studentsOrionKpisProvider, studentsStatisticsProvider
2. `finance_screen.dart` — 10 sub-tabs, uses transactionsProvider, feeStructuresProvider, expensesProvider, kpiReportsProvider, financeAuditLogsProvider, financeSettingsProvider
3. `hr_screen.dart` — 14 sub-tabs, uses staffProvider, contractsProvider, payrollProvider, leavesProvider
4. `pedagogy_screen.dart` — 12 sub-tabs, uses pedagogyKpiDashboardProvider, classDiariesProvider, lessonPlansProvider, teacherAssignmentsProvider
5. `exams_screen.dart` — 11 sub-tabs, uses examsDashboardProvider, evaluationsProvider, councilsProvider
6. `communication_screen.dart` — 15 sub-tabs, uses messagesProvider, announcementsProvider, campaignsProvider, templatesProvider
7. `settings_screen.dart` — 15 sub-tabs, uses generalSettingsProvider, academicYearsProvider, classesProvider, settingsSubjectsProvider
8. `meetings_screen.dart` — 5 sub-tabs, uses allMeetingsProvider, meetingMinutesProvider, meetingDecisionsProvider
9. `orion_screen.dart` — 5 sub-tabs, uses orionMonthlySummaryProvider, orionAlertsProvider, orionInsightsProvider, orionKpisProvider, orionConfigProvider
10. `platform_screen.dart` — 16 sub-tabs, uses platformDashboardProvider, platformTenantsProvider, platformUsersProvider, platformAuditLogsProvider
11. `aggregation_screen.dart` — 3 sub-tabs, uses aggregationDashboardProvider, aggregationDataProvider, aggregationReportsProvider
12. `general_screen.dart` — 1 sub-tab, uses generalDashboardProvider, generalNewsProvider
13. `library_screen.dart` — 13 sub-tabs, uses libraryDashboardProvider, libraryCatalogProvider, libraryBorrowingsProvider, libraryReturnsProvider
14. `transport_screen.dart` — 14 sub-tabs, uses transportDashboardProvider, transportRoutesProvider, transportVehiclesProvider, transportStudentsProvider
15. `canteen_screen.dart` — 12 sub-tabs, uses canteenDashboardProvider, canteenMenusProvider, canteenReservationsProvider, canteenPaymentsProvider
16. `infirmary_screen.dart` — 10 sub-tabs, uses infirmaryDashboardProvider, infirmaryVisitsProvider, infirmaryMedicationsProvider
17. `qhse_screen.dart` — 14 sub-tabs, uses qhseDashboardProvider, qhseRisksProvider, qhseIncidentsProvider, qhseAuditsProvider
18. `educast_screen.dart` — 17 sub-tabs, uses educastDashboardProvider, educastChannelsProvider, educastVideosProvider
19. `shop_screen.dart` — 14 sub-tabs, uses shopDashboardProvider, shopProductsProvider, shopOrdersProvider, shopPaymentsProvider

### 4. Updated app_router.dart

- Replaced ALL `_PlaceholderScreen` usages with real screen imports
- Added routes for all 19 module screens: /students, /finance, /hr, /pedagogy, /exams, /communication, /settings, /meetings, /orion, /platform, /aggregation, /general, /library, /transport, /canteen, /infirmary, /qhse, /educast, /shop
- Legacy routes (/parents, /teachers, /admin, /messages, /notifications) now redirect to their real counterparts
- Removed `_PlaceholderScreen` class entirely

### Key Design Decisions:
- All screens use `ConsumerWidget` (not StatefulWidget) for Riverpod access
- All data-fetching sub-tabs use `ModuleLoadingWrapper` for consistent loading/error/empty states
- FAB buttons trigger `showAddItemDialog()` which returns Map<String, dynamic> data for mutation providers
- All UI text is in FRENCH
- Provider names are matched exactly to what exists in the provider files (verified with grep)
- Simple sub-tabs that don't have dedicated providers use `SubTabContentWrapper` with `SectionHeader` — ready for future expansion

---
Task ID: 8-10
Agent: Sub Agent
Task: Wire offline sync + academic year/school level management

Work Log:

### TASK 8: Wire Offline Sync (OfflineService._syncEvent)

#### 1. Implemented `_syncEvent()` in `lib/core/offline/offline_service.dart`
- Replaced the TODO placeholder with a fully functional sync implementation
- Reads the access token from `FlutterSecureStorage` using key `ah_access_token`
- Builds the API endpoint via the new `_buildSyncEndpoint()` helper
- Creates a standalone `Dio` instance configured with `ApiConfig.versionedBaseUrl`, timeouts, auth header, and `X-Tenant-Id`
- Executes the appropriate HTTP method (POST/PATCH/DELETE) based on `SyncOperationType`
- After successful sync, marks the local entity as synced by setting `_isDirty = false` and `_lastSync` to the current timestamp
- Added imports for `package:dio/dio.dart` and `../network/api_config.dart`

#### 2. Added `_buildSyncEndpoint()` helper method
- Maps every `SyncEntityType` enum value to its corresponding API endpoint
- Handles all 33 entity types defined in the enum (student, teacher, class$, subject, exam, grade, payment, expense, feeStructure, financeSetting, disciplinaryIncident, incident, staff, contract, leave, classDiary, lessonPlan, lessonJournal, homeworkEntry, pedagogicalMaterial, materialStock, teacherMaterialAssignment, academicSeries, seriesSubject, teacherProfile, teacherClassAssignment, message, announcement, meeting, campaign, attendance, absence, invoice, homework, loan, session, notification, alert, examCandidate, examResult)
- For CREATE operations, returns the collection endpoint (e.g., `/students`)
- For UPDATE/DELETE operations, returns the entity endpoint (e.g., `/students/{id}`)
- For `grade` (always update), always returns the entity endpoint
- For `financeSetting`, both create and update go to `/finance/settings`
- Has a default fallback that generates endpoints from the enum name for unknown types
- Fixed the duplicate `feeStructure` case from the task spec — the second was correctly mapped to `financeSetting`

#### 3. Created `lib/core/sync/sync_status_provider.dart`
- `outboxCountProvider` — FutureProvider reading pending event count from OfflineService
- `isSyncingProvider` — StateProvider<bool> tracking sync-in-progress state
- `lastSyncTimeProvider` — StateProvider<DateTime?> for last successful sync timestamp
- `syncNowProvider` — Provider exposing a function that calls `OfflineService.forceSync()`, sets isSyncing/lastSyncTime states, and invalidates outboxCountProvider after completion

### TASK 10: Academic Year & School Level Management

#### 1. Created `lib/core/academic_year/academic_year_model.dart`
- `AcademicYearModel` class with: id, name, startDate, endDate, isActive, isCurrent, status
  - `fromDomain()` factory from freezed entity
  - `fromJson()` / `toJson()` for API serialization
  - `displayName` getter (returns name)
  - `shortLabel` getter (e.g., "2024-2025")
  - `isActiveOrCurrent` helper
- `SchoolLevelModel` class with: id, code, name, label, order, isActive
  - `fromDomain()` factory from freezed entity
  - `fromJson()` / `toJson()` for API serialization
  - `emoji` getter — contextual emoji per level (🧒/📖/🎓/🏫)
  - `semanticColor` getter — hex color per level (gold/green/blue/grey)

#### 2. Created `lib/core/academic_year/academic_year_provider.dart`
- `academicYearsProvider` — FutureProvider fetching `/academic-years` from API
- `currentAcademicYearProvider` — StateProvider<AcademicYearModel?> with SharedPreferences persistence
- `academicYearInitializerProvider` — FutureProvider that restores from SharedPreferences on startup, or auto-selects the "current" year from API
- `availableAcademicYearsProvider` — derived Provider from academicYearsProvider
- `setCurrentAcademicYearProvider` — sets current year, persists to SharedPreferences, invalidates dependent providers
- `clearAcademicYearProvider` — clears current year (for logout)
- Uses `dart:convert` for JSON encoding/decoding
- SharedPreferences keys: `ah_current_academic_year_id`, `ah_current_academic_year_json`

#### 3. Created `lib/core/academic_year/school_level_provider.dart`
- `schoolLevelsProvider` — FutureProvider fetching `/school-levels` from API
- `currentSchoolLevelProvider` — StateProvider<SchoolLevelModel?> with SharedPreferences persistence
- `schoolLevelInitializerProvider` — FutureProvider that restores from SharedPreferences on startup, or auto-selects the first active level
- `availableSchoolLevelsProvider` — derived Provider from schoolLevelsProvider
- `setCurrentSchoolLevelProvider` — sets current level, persists to SharedPreferences, invalidates dependent providers
- `clearSchoolLevelProvider` — clears current level (for logout)
- SharedPreferences keys: `ah_current_school_level_id`, `ah_current_school_level_json`

#### 4. Created `lib/core/academic_year/academic_year_selector.dart`
- `AcademicYearSelector` — ConsumerStatefulWidget with compact/full modes
- Compact mode: shows current year name with calendar icon and dropdown arrow in a navy-tinted pill
- Full mode: shows a card with "Année scolaire" title and `Wrap` of year chips
- `_YearChip` — animated chip with navy/gold styling when selected, green dot for current year
- Bottom sheet picker with radio buttons, "En cours" badge for current year, shortLabel subtitle
- Initializes `academicYearInitializerProvider` on first build
- Calls `setCurrentAcademicYearProvider` on selection change
- All French UI strings

#### 5. Created `lib/core/academic_year/school_level_selector.dart`
- `SchoolLevelSelector` — ConsumerStatefulWidget with compact/full modes
- Compact mode: shows level emoji + label in a blue-tinted pill with dropdown arrow
- Full mode: shows a card with "Niveau scolaire" title and `Wrap` of level chips
- `_LevelChip` — animated chip with navy/gold styling when selected, emoji prefix
- Bottom sheet picker with emoji, check icon for selected, "Niveau scolaire" title
- Initializes `schoolLevelInitializerProvider` on first build
- Calls `setCurrentSchoolLevelProvider` on selection change
- All French UI strings

#### 6. Updated `lib/core/network/auth_interceptor.dart`
- Added imports for `academic_year_provider.dart` and `school_level_provider.dart`
- Updated doc comments to document new header injection responsibilities
- Added `x-academic-year-id` header injection from `currentAcademicYearProvider`
- Added `x-school-level-id` header injection from `currentSchoolLevelProvider`
- Both wrapped in try/catch for graceful degradation when providers aren't initialized

Stage Summary:
- Offline sync fully wired: _syncEvent() makes real HTTP calls with auth and tenant headers, marks entities as synced
- _buildSyncEndpoint() covers all 33+ entity types with proper API endpoint mapping
- Sync status providers expose outbox count, syncing state, last sync time, and manual trigger
- Academic year and school level contexts with full Riverpod providers and SharedPreferences persistence
- Reusable selector widgets (compact for app bar, full for dashboard) with French UI
- Auth interceptor now injects academic year and school level context headers on every API request
- All new files follow existing code patterns (AHColors, AHSpacing, AHTypography, French strings)

---
Task ID: 11
Agent: Sub Agent (Task 11-12)
Task: Add Forgot Password / Reset Password Flow

Work Log:
- Verified auth_notifier.dart already has forgotPassword() and resetPassword() methods (no changes needed)
- Created lib/features/auth/pages/forgot_password_screen.dart:
  - Navy gradient background, white card (matches login screen visual style)
  - Email input field with validation
  - "Envoyer le code" button with loading state
  - Success state showing email sent confirmation + auto-redirect to reset-password
  - "Retour à la connexion" link navigating to /login
  - Responsive layout (tablet + phone)
- Created lib/features/auth/pages/reset_password_screen.dart:
  - Navy gradient background, white card (matches login screen visual style)
  - 6-digit OTP entry with individual text fields, auto-focus navigation
  - New password field with show/hide toggle
  - Confirm password field with match validation
  - "Réinitialiser le mot de passe" button with loading state
  - On success → SnackBar + navigate to /login
  - "Retour à la connexion" link
- Updated lib/features/auth/widgets/login_form.dart:
  - Added go_router import
  - Wired "Mot de passe oublié ?" button to navigate to /forgot-password
- Updated lib/core/router/app_router.dart:
  - Added imports for ForgotPasswordScreen and ResetPasswordScreen
  - Added /forgot-password route → ForgotPasswordScreen
  - Added /reset-password route → ResetPasswordScreen
  - Both as public routes (outside authenticated shell)
- Updated lib/core/router/route_guards.dart:
  - Added isForgotPasswordRoute and isResetPasswordRoute checks
  - Created isPublicRoute composite for unauthenticated access
  - Allow public routes for unauthenticated users
  - Redirect authenticated users away from forgot/reset to dashboard

Stage Summary:
- Complete forgot password → OTP → reset password flow implemented
- All UI text in French, matching existing auth screen styling
- Routes are public (no auth required), with proper redirect logic
- auth_notifier already had the required methods

---
Task ID: 12
Agent: Sub Agent (Task 11-12)
Task: Integrate ORION Transversally in Modules

Work Log:
- Created lib/features/orion/widgets/orion_alert_banner.dart:
  - Compact banner showing alert count with severity color (red=critical, orange=warning, blue=info)
  - Expandable to show up to 5 alert details
  - "Voir tout" button navigating to /orion module
  - Uses AsyncValue for loading/error/data states
  - Hides when no alerts
- Created lib/features/orion/widgets/orion_kpi_card.dart:
  - Small card showing KPI value + trend + label
  - Trend arrow (up=green/good, down=red/bad, flat=gray)
  - Optional icon and trend value string (+5%, -2%, etc.)
  - ORION gold star icon indicator
- Created lib/features/orion/widgets/orion_insight_section.dart:
  - Section showing ORION AI insights with summary text + confidence level
  - Confidence bar with color coding (green ≥80%, orange ≥60%, red <60%)
  - "Voir l'analyse complète" link navigating to /orion
  - Collapsible (expandable/collapsible header)
  - Shows up to 3 insights
- Updated 6 module screens with ORION integration:
  - students_screen.dart: Added OrionAlertBanner + "students-orion" sub-tab with _OrionContent
  - finance_screen.dart: Added OrionAlertBanner + "finance-orion" sub-tab with _OrionContent
  - pedagogy_screen.dart: Added OrionAlertBanner + "pedagogy-orion" sub-tab with _OrionContent
  - exams_screen.dart: Added OrionAlertBanner + "exams-orion" sub-tab with _OrionContent
  - hr_screen.dart: Added OrionAlertBanner + "hr-orion" sub-tab with _OrionContent
  - communication_screen.dart: Added OrionAlertBanner + "communication-orion" sub-tab with _OrionContent
- Each _OrionContent shows:
  - Section header with module-specific title (ORION — Élèves, etc.)
  - KPI cards (up to 4) with trend indicators
  - OrionInsightSection with AI insights and confidence
  - Active alerts list (up to 5) using ModuleLoadingWrapper
- Updated lib/core/enums/module_config.dart:
  - Added "Orion" sub-tab (id: xxx-orion, icon: sparkles) to all 6 modules
- Each screen now wraps StatefulModulePage in Column with OrionAlertBanner at top
  following the pattern: Column → [OrionAlertBanner, Expanded(StatefulModulePage)]

Stage Summary:
- ORION is now integrated transversally in 6 key modules (Students, Finance, Pedagogy, Exams, HR, Communication)
- Each module has an OrionAlertBanner at the top for active alerts visibility
- Each module has an "Orion" sub-tab showing KPIs, AI insights, and alerts
- 3 reusable widgets created: OrionAlertBanner, OrionKpiCard, OrionInsightSection
- Module configs updated to include Orion sub-tabs
- All UI text in French
