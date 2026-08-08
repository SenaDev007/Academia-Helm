# Phase 5 — Admin Modules Audit: Gap Summary

## FINANCE — 3 BROKEN tabs + 6 MISSING tabs

### BROKEN (must fix immediately):
1. `_ReportsContent` watches `financeAnomaliesProvider` — shows audit data under "Rapports" label
2. `_InvoicesContent` watches `feeStructuresProvider` — shows fee configs under "Factures" label
3. `_ReceiptsContent` watches `transactionsProvider` — duplicates Payments tab under "Reçus" label

### MISSING (providers exist, no UI):
- Student Accounts (`studentAccountsProvider` unused)
- Recovery & Arrears (`arrearsProvider`, `recoveryRemindersProvider` unused)
- Treasury Closures (`treasuryClosuresProvider` unused)
- Collection-summary (`classEncaissementsProvider`, `monthlyEncaissementsProvider` unused)
- Fee Overrides (`overrideFeeStructure` mutation exists, no UI)
- Aggregation (no provider, no UI)

### REDUCED:
- Dashboard: 4 KPIs vs 7 (missing Réductions, Prévisionnel net, Solde net, Taux recouvrement)
- Payments: no receipt generation, no multi-method, no exports
- Expenses: no approve/reject workflow, no budget sub-tab
- Audit: 1 of 6 sub-tabs
- Settings: read-only view of 3 fields

## STUDENTS — 2 CRITICAL BUGS + 1 FAKE tab

### CRITICAL BUGS:
1. `_EnrollmentsContent.onAdd` calls `createStudent()` instead of `createEnrollment()` — enrollment form writes a student record
2. `_DisciplineContent.onAdd` calls `createStudent()` instead of creating discipline incident — filing incident creates a student
3. `_GradesContent` is fake — reuses `studentsProvider` and reads non-existent `item['average']` field

### MISSING UIs (service exists, no consumer):
- Admissions (5 service methods orphaned)
- ID Cards (3 service methods + 2 QR methods orphaned)
- Matricules (4 service methods orphaned)
- Dossiers (provider exists, no screen)
- History (1 service method orphaned)
- Guardians (only POST exists)

### PLACEHOLDER tabs (9): Health, Transports, Canteen, Communications, Scholarships, Activities, Alumni, Reports, Archive

### DEAD CODE: `/lib/features/students/services/students_service.dart` is a duplicate

## HR — 8 MISSING service methods + endpoint mismatches

### CRITICAL:
- 8 methods referenced by providers but NOT implemented in `hr_service.dart`:
  getStaffById, getContractById, getPayrollById, getCredentials, updateStaff, updateContract, approveLeave, rejectLeave
- Dashboard fakes KPIs from staff list length (no overview/dashboard call)
- Endpoint mismatches: `/hr/leaves` should be `/hr/leaves/requests`, `/hr/payroll` should be `/hr/payroll/periods`
- Currency bug: hardcodes `€` instead of FCFA

### MISSING: directors, recruitment, attendance, planning, allowances, payroll detail, contracts detail/sign/PDF, staff detail, CNSS/taxes

### PLACEHOLDER tabs (9): recruitment, training, evaluations, discipline, documents, orgchart, policies, reports, settings

## SETTINGS — 10 of 14 service methods unused

### MISSING:
- Identity edit form (service has `updateGeneral`, never called)
- Academic year CRUD (read-only list)
- Structure (levels/cycles/grades/series — collapsed to flat list)
- Features toggle (`getFeatures`/`enableFeature`/`disableFeature` never called)
- Roles CRUD (`getRoles`/`getPermissions` never called)
- Billing view
- Security settings
- Devices management
- History/audit trail

### DEAD CODE: `settings_screen_full.dart` (617 lines of mockup)
