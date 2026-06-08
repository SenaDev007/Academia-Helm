---
Task ID: 1
Agent: Main Agent
Task: Implement professional employee termination (débauche) and contract termination (résiliation) features

Work Log:
- Explored existing HR module: Staff model, Contract model, services, controllers, DTOs, frontend components
- Added 5 new fields to Staff Prisma model: terminationType, terminationDetails (Json), terminatedAt, noticePeriodDays, lastWorkingDate
- Created SQL migration file: prisma/migrations/add_termination_fields.sql
- Added TerminateStaffDto and TerminateContractDto to DTOs
- Implemented terminateStaff() method in StaffPrismaService - professional 3-phase process with transaction
- Implemented findTerminatedStaff() method for listing departed employees
- Implemented reactivateStaff() method for employee reintegration
- Enhanced terminateContract() in ContractsPrismaService with automatic staff status update
- Added 3 new endpoints to StaffPrismaController: POST :id/terminate, GET terminated/list, POST :id/reactivate
- Enhanced PUT :id/terminate endpoint in ContractsPrismaController with TerminateContractDto
- Created StaffTerminationModal.tsx - 3-step wizard (Type de départ → Motif & Détails → Checklist de sortie)
- Created ContractTerminationModal.tsx - professional contract termination form
- Updated StaffWorkspace.tsx - added terminate button on staff cards, termination modal integration
- Updated staff/[id]/page.tsx - added terminate/reactivate buttons, termination info card, StaffTerminationModal
- Updated ContractsWorkspace.tsx - added terminate button on active contracts, ContractTerminationModal
- Generated Prisma client with new schema fields

Stage Summary:
- Full backend + frontend implementation for employee departure (débauche) and contract termination (résiliation)
- 8 termination types supported: RESIGNATION, DISMISSAL, MUTUAL_AGREEMENT, END_OF_CONTRACT, RETIREMENT, DEATH, ABANDONMENT, OTHER
- Professional exit checklist: exit interview, equipment return, exit documents, final settlement
- Automatic staff status update when terminating last active contract
- Employee reintegration (reactivation) capability
- SQL migration ready: prisma/migrations/add_termination_fields.sql
- All text in French, consistent with existing HR module

---
Task ID: 1
Agent: Main
Task: Fix job offer creation error + remove CSPEB tenant + rename default tenant

Work Log:
- Renamed default tenant from "Tenant par Défaut - Academia Helm" to "Academia Helm" via PATCH API + seed.ts update
- Set CSPEB tenant status to WITHDRAWN to hide from frontend
- Fixed dev-available-tenants endpoint to exclude WITHDRAWN tenants (auth.service.ts)
- Added startup code to hard-delete CSPEB tenant (temporarily, then removed after deploy)
- Investigated job offer creation error: CreateJobDto used short field names (dept, loc) but frontend sent long names (department, location)
- Fixed CreateJobDto and UpdateJobDto to accept BOTH short and long field names
- Fixed recruitment.service.ts createJob/updateJob to map aliases (department→dept, location→loc, keyMissions→missions, requiredEducation→academicLevel, requiredExperience→experience)
- Tested both formats work correctly via API
- Cleaned up test jobs

Stage Summary:
- Default tenant now shows "Academia Helm" on frontend
- CSPEB tenant completely hidden (WITHDRAWN status + filtered from all endpoints)
- Job offer creation now works with both short and long field names
- No regression: short field names still work, all HR flows intact
