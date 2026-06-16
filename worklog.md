---
Task ID: 1
Agent: Main Agent
Task: Implémenter la persistance des chats SARA avec expiration automatique après 30 jours

Work Log:
- Analysé le projet : 3 widgets de chat (SaraWidget, SupportChatWidget, InAppSaraGuide) stockaient les messages uniquement en useState (éphémère, perdus au rechargement)
- Créé `/apps/web-app/src/lib/sara/chat-storage.ts` — utilitaire de persistance avec localStorage et expiration 30 jours
- Mis à jour `SaraWidget.tsx` : chargement des messages sauvegardés + sauvegarde automatique via useEffect
- Mis à jour `SupportChatWidget.tsx` : même logique + helpers de sérialisation/désérialisation pour les objets Date
- Mis à jour `InAppSaraGuide.tsx` : même logique avec préservation du message d'accueil contextuel
- Vérifié la compilation TypeScript : aucune erreur liée aux modifications

Stage Summary:
- Fichier créé : `src/lib/sara/chat-storage.ts` (utilitaire complet de persistance)
- 3 composants modifiés pour utiliser la persistance
- Les conversations sont maintenant sauvegardées dans localStorage et persistent entre les rechargements
- Les conversations plus vieilles que 30 jours sont automatiquement supprimées au chargement
- Chaque widget a sa propre clé de stockage : `sara_chat:sara-widget`, `sara_chat:support-chat`, `sara_chat:inapp-guide`

---
Task ID: 2
Agent: Main Agent
Task: IARH — Wiring up "lettre de demande d'emploi" (required) in /jobs application flow + Sarah auto-tracking + Co-pilot RH enhancements

Work Log:
- Investigation approfondie via subagent Explore : localisé les 4 sous-onglets IARH dans IaWorkspace.tsx (parse/matching/fraud/copilot), le contrôleur IA (ia-prisma.controller.ts), le service IA (ia-prisma.service.ts), le formulaire public /jobs (CareersContent.tsx), le contrôleur de recrutement (recruitment.controller.ts) et le service applyJob (recruitment.service.ts)
- Constaté que les tâches 1, 2, 3, 4, 5 étaient déjà fonctionnelles : SSE streaming opérationnel, image réelle Sarah (/images/SarahAI.png) déjà en place, persona "Assistante RH" déjà configurée, analyse CV via GLM-5.1 vision active, matching XAI opérationnel, détection fraude par anomalies active, boutons retour des pages détail RH naviguent déjà vers le bon onglet parent
- Backend (recruitment.controller.ts) : ajouté `applicationLetter` au FileFieldsInterceptor (maxCount: 1) + mis à jour la signature du handler `applyJob`
- Backend (recruitment.service.ts applyJob) :
  * Ajouté `hasApplicationLetter` + `applicationLetterName` + `applicationLetterPath` + `applicationLetterFile`
  * Upload du fichier dans `candidate-docs/${tenantId}/pending/application-letter`
  * Création d'un CandidateDocument avec `documentType: 'APPLICATION_LETTER'`
  * Enrichi le profil candidat envoyé à l'IA avec la mention des 2 lettres (lettre de demande d'emploi + lettre de motivation)
  * Mis à jour le prompt IA HDIE pour scorer les 2 lettres distinctement
  * Mis à jour la signature de `generateHeuristicScores` pour accepter les 2 lettres + avoir des bonus distincts (lettre demande +25, lettre motivation +15)
  * Mise à jour des 4 callsites de `generateHeuristicScores` (applyJob x3 + createApplication x1) pour la nouvelle signature
- Frontend (CareersContent.tsx) :
  * L'état `applicationLetterFile` était déjà déclaré mais jamais utilisé — wiring complet effectué
  * `canProceed()` step 5 exige maintenant `cvFile && applicationLetterFile`
  * Ajouté un bloc UI "Lettre de demande d'emploi *" (required) avec upload
  * Renommé l'ancien bloc "Lettre de motivation" en mentionnant "(optionnel)"
  * Ajouté un 4e bloc "Lettre de recommandation académique (optionnel)" dans la grille 2x2
  * Submit FormData inclut `applicationLetter` en plus de cv/coverLetter/recommendationLetter
  * Bouton submit désactivé si `!cvFile || !applicationLetterFile` avec label "CV + lettre de demande requis"
  * `resetForm()` efface aussi `applicationLetterFile`
  * Notice de processing + message de succès mentionnent explicitement Sarah et l'analyse automatique
- Backend (ia-prisma.service.ts) — Enhancement du Co-pilot RH (Sarah) :
  * Ajouté 2 méthodes privées : `getTopCandidatesForCopilot(tenantId, limit)` (récupère le top N candidats par score global avec détail des sous-scores et matchDetail) et `getAnomalySummaryForCopilot(tenantId)` (résumé anomalies par sévérité + top 3)
  * Les 2 méthodes copilotChatStream + copilotChat chargent maintenant ces données en parallèle avec les KPIs existants
  * Le system prompt de Sarah inclut désormais une section "SUIVI ET ANALYSE AUTOMATIQUE DES CANDIDATURES" qui :
    - Décrit sa mission première (traquer/récupérer/analyzer les 4 types de documents : CV obligatoire, lettre de demande obligatoire, lettre de motivation optionnelle, recommandation optionnelle)
    - Liste le TOP 3 candidats par score global avec détail des sous-scores et matchDetail
    - Affiche un résumé des anomalies détectées (total + par sévérité + top 3 anomalies)
    - Oriente Sarah vers les onglets IARH appropriés selon les questions
  * Mise à jour appliquée à la fois sur la version streaming (copilotChatStream) ET la version non-streaming (copilotChat)
- Frontend (IaWorkspace.tsx) — Co-pilot RH presets enrichis :
  * Ajouté "Dernières analyses auto" (prompt détaillé demandant top 3 + scores matching)
  * Ajouté "Anomalies détectées" (prompt sur les risques de fraude)
  * Renommé "Quels sont les meilleurs candidats ?" en "Meilleurs candidats" (plus court pour le scroll horizontal)

Stage Summary:
- 5 fichiers modifiés (api-server: ia-prisma.service.ts, recruitment.controller.ts, recruitment.service.ts ; web-app: IaWorkspace.tsx, CareersContent.tsx)
- +238 lignes, -34 lignes
- Le portail /jobs accepte maintenant 4 documents : CV (requis), lettre de demande d'emploi (requis), lettre de motivation (optionnel), lettre de recommandation académique (optionnel)
- Le backend applyJob analyse automatiquement via GLM-5.1 : score CV, score lettre, score matching, score global, matchDetail, risks, riskDetail — stockés dans HrApplication + HrAiReport
- Sarah (Co-pilot RH) a maintenant accès en temps réel au TOP 3 candidats et au résumé des anomalies — elle peut répondre précisément quand on lui demande les dernières candidatures analysées
- Sarah mentionne explicitement les 4 types de documents et leur caractère obligatoire/optionnel dans son system prompt
- SSE streaming, image Sarah réelle et persona "Assistante RH" déjà en place — confirmés fonctionnels

---
Task ID: 3
Agent: Main Agent
Task: Fix Détection fraude ID display + restore contract sign/edit/preview features + fix "expiré" bug on unsigned contracts

Work Log:
- Investigated the IARH "Détection fraude" sub-tab issue: identified that ia-prisma.service.ts detectFraud() was appending the raw candidate UUID in parentheses when grouping by email/phone duplicates (`${c.firstName} ${c.lastName} (${c.id})`). The UI showed "Aurore Akpovi (uuid)" instead of "Aurore Akpovi".
- Investigated the contract issues: identified that the contract detail page (apps/web-app/src/app/app/hr/contracts/[id]/page.tsx) had LOST three features that were present in commit c9e301da:
  * ContractEditModal (edit dates/salary/payment mode) — imports & button removed
  * ContractDocumentEditor (edit articles of the contract) — imports & button removed
  * In-app PDF preview iframe — entire section removed
- Investigated the "expiré" bug: identified that the backend ContractsPrismaService.createContract() was auto-expiring ALL existing ACTIVE and PENDING contracts when a new one was created. So if a user accidentally created two contracts for the same staff, the first PENDING (unsigned) one became EXPIRED. Then the sign button (which required `status === 'ACTIVE'`) never appeared, leaving the contract stuck.
- Investigated the sign button condition: it was `contract.status === 'ACTIVE'` but contracts start as `PENDING` (per commit c64e1ba2) and only become `ACTIVE` after signing. So the button was unreachable.

Backend fixes (api-server):
- ia-prisma.service.ts detectFraud(): removed `(${c.id})` from email and phone duplicate grouping — only the readable name is now returned.
- contracts-prisma.service.ts createContract(): changed `status: { in: ['ACTIVE', 'PENDING'] }` → `status: 'ACTIVE'`. Only ACTIVE contracts get auto-expired when a new one is created. PENDING (unsigned) contracts stay PENDING and can coexist with a new contract (so the user can choose which one to sign).
- contracts-prisma.service.ts: added new `reactivateContract(id, tenantId)` method that reactivates an unsigned EXPIRED contract → PENDING. Guards: rejects already-signed contracts and non-EXPIRED statuses.
- contracts-prisma.controller.ts: added new `PUT /hr/contracts/:id/reactivate` endpoint.

Frontend fixes (web-app):
- contracts/[id]/page.tsx (full rewrite of the action bar + restoration of lost features):
  * Re-imported ContractEditModal, ContractDocumentEditor, Pencil/Eye/RotateCcw icons
  * Added state: editModalOpen, docEditorOpen, pdfPreviewUrl, loadingPreview, reactivating
  * Added loadPdfPreview() function with auth header + 401 token-refresh retry + auto-generate fallback
  * Added "Éditer le document" button → opens ContractDocumentEditor (when !isSigned)
  * Added "Modifier les infos" button → opens ContractEditModal (when !isSigned)
  * Added "Réactiver" button → calls PUT /contracts/:id/reactivate (when contract is EXPIRED and !isSigned)
  * Added "Signer le contrat" button — condition is now `!isSigned && (PENDING || ACTIVE || DRAFT)` instead of just `ACTIVE`
  * Added reactivation helper banner explaining the flow for unsigned EXPIRED contracts
  * Restored in-app PDF preview section at the bottom (iframe + "Charger l'aperçu" button + "Actualiser" button)
- ContractsWorkspace.tsx: replaced `STATUS_CONFIG[x] || STATUS_CONFIG.EXPIRED` (which falsely labelled unknown statuses as 'Expiré') with a neutral `STATUS_FALLBACK` ('En attente', amber style).
- staff/[id]/page.tsx (contracts tab):
  * Each contract card is now a clickable Link to /app/hr/contracts/[id] (was just a static div)
  * Replaced raw status display with a readable statusMap (PENDING → 'En attente de signature', DRAFT → same, etc.)
  * Added "(non signé)" badge when contract.signedAt is null
  * Added "Ouvrir le contrat →" link label
  * Imported `Link` from 'next/link'

Verification:
- TypeScript check: no NEW errors introduced by these changes (pre-existing environment errors about missing React/NestJS type declarations remain, but they are not caused by this commit).
- All 6 modified files commit cleanly together (commit 8320b2c5).

Stage Summary:
- 6 files modified (+336, -33)
- Détection fraude now displays readable candidate names instead of UUIDs
- Contracts module fully restored: edit modal + document editor + in-app PDF preview + sign button (for PENDING/ACTIVE/DRAFT) + reactivate button (for unsigned EXPIRED)
- Backend no longer auto-expires unsigned PENDING contracts — they remain signable
- Legacy unsigned EXPIRED contracts can be reactivated to PENDING via the new endpoint and the "Réactiver" button on the contract detail page
- Staff detail page now links directly to each contract's detail page with proper status labels

---
Task ID: ah-admin-isolation-and-contract-fix
Agent: main agent
Task: 1) Fix HR contract signing error "Erreur lors de la signature" — 2) Isolate admin back-office to admin.academiahelm.com subdomain — 3) Remove all mock data from /app/platform/* workspaces and connect to real DB

Work Log:
- Analyzed screenshots: (1) sidebar shows all platform modules on regular app; (2) contract signing modal returns generic "Erreur lors de la signature"
- Investigated root cause of contract signing error:
  - ContractSignModal always sends signerRole: 'Employé'
  - Backend contract-pdf.service.signContract() requires terms.employerSignedAt to be set BEFORE employee can sign
  - Fresh contracts have terms = {} → backend throws "L'employeur doit signer le contrat en premier"
  - Frontend swallows the backend error message and shows generic toast
  - Also found a no-op .replace('E','E') on line 630 (broken accent normalization)
- Fixed ContractSignModal.tsx (both app/app and app/(app) copies):
  - Added signer role selector (Employeur / Employé) with auto-detection from contract state
  - Surface the actual backend error message in the toast
  - Disable Employé button when employer hasn't signed yet (with explanation)
- Fixed contract-pdf.service.ts signContract():
  - Replaced broken .replace('É','E').replace('E','E') with proper NFD normalization
- Investigated admin sidebar leak:
  - PilotageSidebar.tsx renders PLATFORM_MODULES whenever isPlatformPortal is true (purely role-based)
  - No hostname check → modules appear on every subdomain for platform owners
  - Middleware redirects admin.academiahelm.com → main domain (wrong behavior)
- Created useAdminSubdomain hook (client-side hostname detection)
- Patched PilotageSidebar.tsx:
  - isPlatformPortal now requires BOTH role AND admin.academiahelm.com subdomain
  - Added "Back-Office Academia Helm" link at bottom for platform owners on non-admin subdomains
- Patched middleware.ts:
  - admin.academiahelm.com is no longer redirected to main domain
  - Added auth gate: unauthenticated users on admin subdomain are redirected to /login?admin=1
  - Added /app/platform/* route guard: requests from non-admin subdomains are redirected to admin.academiahelm.com
  - Moved user session read earlier (before reserved-subdomain block) to fix ordering bug
- Patched LoginPage.tsx:
  - Added maybeRedirectToAdminSubdomain() helper
  - When ?admin=1 is set, platform owners are redirected to admin.<parent-domain> after successful login
  - Applied to handlePlatformLogin, handleStandardLogin, handleSchoolLogin (platform retry path)
- Created new PlatformModule (api-server):
  - platform.service.ts: 14 methods (dashboard, tenants, initial-subscriptions, invoices, payments, users, audit-logs, support/tickets, roles, permissions, plans, modules, monitoring, orion)
  - platform.controller.ts: 13 endpoints under /platform/*
  - platform.module.ts: registered in app.module.ts
  - All endpoints guarded by JwtAuthGuard + assertPlatformRole()
- Created BFF proxy route: apps/web-app/src/app/api/platform/[...path]/route.ts
- Created shared hook usePlatformData() + PlatformStates (Loading/Error/Empty) components
- Refactored all 14 platform workspaces to use real DB data via /api/platform/*:
  - PlatformDashboard, TenantsWorkspace, InitialSubscriptionsWorkspace, PlatformBillingWorkspace,
    PlatformPaymentsWorkspace, PlatformUsersWorkspace, PlatformSupportWorkspace, PlatformAuditWorkspace,
    PlatformOrionWorkspace, MonitoringWorkspace, ModulesWorkspace, PlatformRBACWorkspace,
    SubscriptionsWorkspace, PlatformSettingsWorkspace
  - All MOCK_* constants removed
  - Loading/error/empty states added
  - Where a table doesn't exist yet (SupportTicket, Monitoring infrastructure, Orion predictive),
    an empty state with explanatory note is shown instead of mock data
- Updated vercel.json: added maxDuration/memory for /api/platform/[...path] route

Stage Summary:
- HR contract signing now works for both employer-first and employee-second flows
- Platform back-office modules are HIDDEN from the regular app sidebar
- /app/platform/* routes are BLOCKED on non-admin subdomains (auto-redirect to admin.academiahelm.com)
- admin.academiahelm.com requires PLATFORM_OWNER auth and lets platform users through
- All 14 platform workspaces now display real DB data (tenants, subscriptions, invoices, payments,
  users, audit logs, roles, permissions, plans, modules adoption, orion alerts)
- Support tickets and monitoring infrastructure return empty states with notes (no mock data)
- Files modified: 17 workspaces/components + middleware + sidebar + login page + contract modal/service
- New files: PlatformModule (3 files), BFF platform proxy route, useAdminSubdomain hook,
  usePlatformData hook, PlatformStates components

---
Task ID: ah-verification-followup
Agent: Main Agent
Task: Verify previously-shipped fixes (HR contract signing, admin subdomain isolation, platform mock-data removal) and patch any regressions before user re-tests

Work Log:
- Verified HR contract signing fix is in place:
  * ContractSignModal.tsx (both app/app and app/(app) copies) — added signer role selector (EMPLOYEUR / EMPLOYE), auto-detection from contract.terms.employerSignedAt, surfaces actual backend error in toast, disables Employé button when employer hasn't signed yet
  * contract-pdf.service.ts signContract() — proper NFD normalization for signerRole, two-step signing flow (employer first → PENDING, then employee → ACTIVE), guards for already-signed / expired / terminated
  * contracts-prisma.controller.ts POST :id/sign endpoint accepts SignContractDto with signerRole
- Verified admin subdomain isolation:
  * middleware.ts — admin.academiahelm.com is NOT redirected (allowed through with x-admin-subdomain header), requires user.isPlatformOwner or redirects to /login?admin=1, blocks /app/platform/* on non-admin subdomains
  * PilotageSidebar.tsx — isPlatformPortal now requires BOTH (user.portal==='PLATFORM' || isPlatformOwner) AND useAdminSubdomain(); PLATFORM_MODULES only render on admin subdomain; "Back-Office Academia Helm" link shown at bottom of sidebar for platform owners on non-admin subdomains
  * useAdminSubdomain hook — client-side hostname detection (admin.* prefix, dev-mode admin- prefix, ?admin=1 override); getAdminBackOfficeUrl helper for cross-subdomain redirects
  * LoginPage.tsx — maybeRedirectToAdminSubdomain() helper called from 5 login paths; when ?admin=1 is set and login succeeds as PLATFORM_OWNER, user is redirected to admin.<parent-domain>${redirectPath}
- Verified all 14 platform workspaces use real DB data:
  * Grep for MOCK_/mockData/mockTenants/etc. in apps/web-app/src/components/platform/ → no matches
  * Grep for usePlatformData|/api/platform/|fetch( → 13 files match (all 13 workspaces)
  * Backend platform module: 14 endpoints under /platform/*, all guarded by JwtAuthGuard + assertPlatformRole, registered in app.module.ts
  * BFF proxy route /api/platform/[...path]/route.ts forwards to NestJS with auth headers
- Caught and fixed a syntax regression in PlatformOrionWorkspace.tsx:
  * Line 71 had 'Aucun potentiel d'expansion détecté actuellement.' — unescaped apostrophe inside a single-quoted JSX string literal broke the parser (TS1005: '}' expected)
  * Switched to double quotes: "Aucun potentiel d'expansion détecté actuellement."
- Added 2 syntax-check scripts (scripts/syntax-check-{platform,backend}.mjs) using @babel/parser to validate all 53 platform workspaces + middleware + sidebar + login page + contract sign modal + backend platform module + contract-pdf service — 0 syntax errors
- Committed and pushed (commit 449b9117)

Stage Summary:
- All 3 high-priority user-reported issues (admin sidebar leak, contract signing error, mock data in back-office) were already correctly fixed in commit f5c8ecac
- One syntax regression in PlatformOrionWorkspace.tsx caught and fixed before user re-test
- Branch is now clean, all changes pushed to origin/main
- User can now: (1) visit admin.academiahelm.com to access the isolated back-office, (2) sign HR contracts using the new two-step flow (employer first, employee second), (3) see only real DB data across all 14 platform workspaces
