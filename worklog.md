# Academia Helm — AI Agents Worklog

Multi-agent shared worklog for the Academia Helm AI Ecosystem project.
Agents: Sarah (closer + guide), Orion (analytical read-only), Atlas (executor).

---
Task ID: 0
Agent: main
Task: Initial setup — clone repo, read AI Ecosystem document, analyze codebase architecture

Work Log:
- Cloned https://github.com/SenaDev007/Academia-Helm.git to /home/z/my-project/academia-helm
- Read Academia_Helm_AI_Ecosystem_ORION_SARA_ATLAS.md (v2.1)
- Read Academia Helm Enterprise AI Architecture spec
- Explored apps/web-app (Next.js 16 PWA) and apps/api-server (NestJS)
- Read existing SaraWidget.tsx (864 lines, holographic cyan style)
- Read sara.service.ts (NestJS, 849 lines, rich closer prompt)
- Read orion-ai.service.ts (basic prompt, limited context)
- Read atlas.service.ts (good base, needs enrichment)
- Read AI Gateway, OrionReadonlyGuard, tool-definitions-sara.ts
- Identified Academia Helm palette in globals.css: Royal Blue (#0A2A5E → #1C6FE8), Living Gold (#CFA63A → #FFE08A), Graphite, Cloud

Stage Summary:
- All 3 AI agents already exist with substantial implementation
- Sarah widget uses cyan holographic style that DOES NOT match Academia Helm brand palette
- Sarah has two parallel prompts (NestJS rich + Next.js fallback simpler) — need to sync
- Orion has readonly guard but limited context (only students data) and basic prompt
- Atlas has decent base but needs more structure per the document
- SiteContentService already loads pricing/reviews dynamically from DB
- Multi-tenant strict already enforced via JWT tenant resolution in Sara controller
- Next steps: redesign UI, enhance 3 prompts, expand Orion context, commit & push

---
Task ID: 1
Agent: main
Task: Redesign SaraWidget UI + enhance Sarah closer capabilities

Work Log:
- Backed up original SaraWidget.tsx to SaraWidget.legacy.tsx.bak
- Rewrote SaraWidget.tsx with Academia Helm brand palette (Royal Blue + Living Gold)
- Reduced widget size from 400x600 to 360x540 (more compact, Messenger/WhatsApp style)
- Reduced text from 13px to 12px for body, 11px for meta
- Replaced holographic cyan (#00e5ff) with Royal Blue (#0A2A5E, #0D3B85, #114FC4, #1C6FE8)
- Added Living Gold (#CFA63A, #F2C94C, #FFE08A) as accent color
- Removed scanline animation, particles, corner brackets — replaced with minimal style
- Added Sarah avatar bubble next to each assistant message (like Messenger)
- Added "clear chat" button + "new conversation" feature
- Added branded footer "Propulsé par ACADEMIA HELM"
- Kept all functionality: streaming, suggestions, history persistence
- Enhanced NestJS sara.service.ts system prompt:
  * Added INTELLIGENCE ÉMOTIONNELLE & CHALEUR HUMAINE section
  * Enhanced MÉTHODE DE RAISONNEMENT to 4 steps with deeper objections analysis
  * Added CAPACITÉ DE NAVIGATION section (all public site pages + app modules)
  * Added ACCÈS AUX DONNÉES EN TEMPS RÉEL section (SiteContentService)
  * Applied same enhancements to In-App prompt
- Synced system_prompt.txt (Next.js fallback route) with same enhanced structure
- Fixed Sara fallback route to use "Sarah" (with h) instead of "SARA" in AI replacements

Stage Summary:
- Sarah's chat interface now uses Academia Helm Royal Blue + Living Gold palette
- Widget is 360x540 (was 400x600), text is 12px (was 13px) — more minimalist & professional
- Style inspired by Messenger/WhatsApp: compact bubbles, avatar next to each msg
- Sarah has enriched closer capabilities: emotional intelligence, 4-step reasoning, navigation, live data
- Sarah has explicit navigation capability for all public pages AND app modules
- Sarah has explicit read-only access to live site data via SiteContentService
- Both Sara prompts (NestJS + Next.js fallback) are now synchronized and enriched

---
Task ID: 2
Agent: main
Task: Enhance Orion — analytical/predictive/decisional, 5 domains, ORION score, multi-tenant strict

Work Log:
- Expanded Orion buildContext from 8 to 17 data points covering 5 domains:
  * Académique: students, activeStudents, admissions, enrollments, classes, teachers, idCards, absences, grades
  * RH: teachers, contracts, salarySlips
  * Finance: payments, expenses, paymentPlans
  * Administratif: auditLogs total + recentAuditLogs (last 7 days, top 10)
  * Sécurité: audit log events
- All Prisma queries are wrapped with .catch(() => 0) for resilience
- Added typed alert system with 3 severity levels (INFO/ATTENTION/CRITIQUE) and domains
- Added ORION score calculation (0-100) based on weighted metrics across 5 domains:
  * Académique: 30 pts max
  * RH: 15 pts max
  * Finance: 25 pts max
  * Administratif: 15 pts max
  * Sécurité: 15 pts max (with penalties for CRITIQUE alerts)
- Completely rewrote buildSystemPrompt:
  * Identity section with absolute rules (READ-ONLY, MULTI-TENANT STRICT)
  * Live context with ORION score interpretation
  * 5 domain breakdown with all metrics
  * 7 analytical capabilities (analyse, prédiction, recommandation, alertes, KPIs, score, rapports)
  * Tone & style (consultant en management scolaire)
  * Collaboration with Sarah + ATLAS
  * Strict rules (no comparisons, no inventions, no medical/legal advice)

Stage Summary:
- Orion now has rich, multi-domain context for deep analysis
- ORION score (0-100) gives a quick maturity read for the establishment
- 3-tier alert system (INFO/ATTENTION/CRITIQUE) with domain tagging
- Multi-tenant strict is explicitly enforced (all Prisma queries filtered by tenantId)
- Read-only behavior is explicit (no create/update/delete — only analyze & recommend)
- Collaboration with Sarah and ATLAS is clearly defined

---
Task ID: 3
Agent: main
Task: Enhance Atlas — Documents/Auto/Reporting/Archivage, multi-tenant strict, human validation

Work Log:
- Completely restructured Atlas system prompt with 4 explicit missions:
  1. DOCUMENTS — 12 document types (attestations, certificats, bulletins, reçus, contrats, lettres, etc.)
  2. AUTOMATISATION — 8 workflow types (SMS/WhatsApp/Email/Push campaigns, recouvrement, bulletins, rapports, inscriptions)
  3. REPORTING — 10 export types (rapports PDF/Excel, exports Educmaster, statistiques)
  4. ARCHIVAGE — 7 archiving capabilities (classement, indexation, recherche, retention policy)
- Added explicit ACTIONS CRITIQUES REQUIRANT CONFIRMATION HUMAINE section:
  * >10 entities affected
  * Data deletion
  * Financial modifications
  * External communications
  * Legal document generation
  * Configuration changes
  * Irreversible actions
- Added explicit MULTI-TENANT STRICT rule at the top of the prompt
- Added COLLABORATION AVEC LES AUTRES AGENTS IA section (ORION detection, Sarah requests)
- Added TON & STYLE section (actionnable, exec assistant style)
- Added 14 strict rules including no cross-tenant, no decisions, no commercial talk

Stage Summary:
- Atlas now has clear 4-mission structure per the AI Ecosystem document
- Critical actions requiring human validation are explicitly listed
- Multi-tenant strict is enforced at prompt level
- Collaboration with ORION (analysis) and Sarah (commercial) is clearly scoped
- Atlas never takes strategic decisions — that's ORION's role
- Atlas never converses with prospects — that's Sarah's role


---
Task ID: 4
Agent: main
Task: Restrict Sarah DB access to pricing only + verify multi-tenant strict on Orion/Atlas

Work Log:
- Clarified Sarah's DB access scope per user: ONLY pricing (not contact/reviews)
- Rewrote SiteContentService to:
  * Load ONLY pricing from DB (SubscriptionPlan + PricingConfig)
  * Use static contact info (never from DB)
  * Use placeholder for reviews (Sarah doesn't read reviews from DB)
  * Removed loadContactContent() and loadReviewsContent() methods
  * Added explicit documentation about the strict pricing-only access
- Updated Sarah's landing prompt to clarify:
  * ✅ CAN READ: pricing plans, fees, add-ons, discounts (from DB)
  * ❌ CANNOT READ: reviews, school operational data, multi-tenant data
  * Has knowledge of all public site pages (for navigation reference)
- Updated Sarah's in-app prompt with same restrictions
- Verified Orion multi-tenant strict:
  * Controller uses @UseGuards(JwtAuthGuard, TenantGuard) ✓
  * Uses @GetTenant() decorator (resolves tenantId from JWT) ✓
  * All Prisma queries filter by tenantId in buildContext() ✓
- Verified Atlas multi-tenant strict:
  * UPGRADED controller from JwtAuthGuard-only to JwtAuthGuard + TenantGuard
  * Migrated from req.user.tenantId to @GetTenant() tenant.id (more secure)
  * Added explicit BadRequestException if tenant not resolved
  * All 4 endpoints (chat, chat/stream, gateway, history) now enforce tenant isolation
- Verified all agents use GLM 5.2:
  * Sarah: persona 'SARA' → OpenRouterService → z-ai/glm-5.2 ✓
  * Sarah Guide (new): persona 'SARA' → same ✓
  * Orion: direct fetch to NVIDIA API with z-ai/glm-5.2 ✓
  * Atlas: persona 'ATLAS' → OpenRouterService → z-ai/glm-5.2 ✓
  * Next.js fallback route: z-ai/glm-5.2 ✓

Stage Summary:
- Sarah's DB access is now STRICTLY limited to pricing (was previously loading pricing + reviews + contact)
- Orion multi-tenant strict confirmed (controller + service level)
- Atlas multi-tenant strict UPGRADED (added TenantGuard + GetTenant decorator)
- All 4 agents (Sarah landing, Sarah Guide, Orion, Atlas) use GLM 5.2 via NVIDIA

---
Task ID: 5
Agent: main
Task: Ultra-enrich Orion system prompt with analytical frameworks, KPIs, predictions

Work Log:
- Completely rewrote Orion's buildSystemPrompt with ultra-enriched content:
  * Identity section: ORION = consultant en management scolaire senior
  * Explicit multi-tenant strict rule with refusal script
  * 5-PHASE REASONING SYSTEM (DÉCOMPOSITION → COLLECTE → ANALYSE → PRÉDICTION → RECOMMANDATION)
  * ORION score interpretation with 4 levels (MAÎTRISÉ/FONCTIONNEL/DÉMARRAGE/RISQUE)
  * KPI CATALOG with formulas and thresholds per domain:
    - Académique: taux d'occupation, taux d'absence, ratio élèves/enseignant, etc.
    - RH: taux de contractualisation, charge administrative de paie
    - Finance: taux de paiement, couverture des dépenses, recette moyenne
    - Administratif: taux de cartes émises, activité d'audit
    - Sécurité: volume d'audit, événements suspects
  * PREDICTION METHODOLOGIES per domain (with trigger thresholds)
  * DECISION REPORT TEMPLATE (synthèse exécutive → alertes → KPIs → prédictions → recommandations → question stratégique)
  * Enhanced tone & style (quantify everything, always propose action)
  * Collaboration with Sarah + ATLAS clearly scoped

Stage Summary:
- Orion prompt went from ~230 lines to ~580 lines
- Now has structured 5-phase reasoning system
- Has explicit KPI formulas with optimal/attention/critique thresholds
- Has prediction methodologies for all 5 domains
- Has professional decision report template
- Multi-tenant strict is reinforced with explicit refusal scripts

---
Task ID: 6
Agent: main
Task: Ultra-enrich Atlas system prompt with detailed documents, workflows, execution protocols

Work Log:
- Completely restructured Atlas system prompt:
  * Identity: ATLAS = assistant exécutif de direction
  * Explicit multi-tenant strict rule with refusal script
  * Explicit human validation rule with protocol
  * 5-PHASE REASONING SYSTEM (COMPRÉHENSION → VÉRIFICATION → CLASSIFICATION → EXÉCUTION → RAPPORT)
  * DETAILED 4-MISSION CATALOG:
    1. DOCUMENTS (12 types categorized: élèves, financiers, RH, établissement) with prerequisites, format, criticality
    2. AUTOMATISATION (8 workflows: communications, pédagogiques, financiers, RH, personnalisés) with parameters and criticality
    3. REPORTING (10 exports: réglementaires, financiers, académiques, QHSE) with formats and filters
    4. ARCHIVAGE (automatic, indexation, recherche, politique de rétention with legal durations)
  * CRITICAL ACTIONS CATALOG requiring human confirmation:
    - Impact élevé (>10 entités, suppressions, modifications financières, communications externes, etc.)
    - Actions financières spécifiques (paie, relances, annulation paiement)
    - Actions pédagogiques (publication bulletins, calcul moyennes)
    - PROTOCOLE DE CONFIRMATION en 6 étapes
  * Collaboration with ORION + Sarah with concrete examples
  * Tone & style adapted per role (DIRECTEUR, COMPTABLE, ENSEIGNANT, SECRÉTAIRE, SURVEILLANT)
  * 17 strict rules (was 14)

Stage Summary:
- Atlas prompt went from ~150 lines to ~480 lines
- Now has structured 5-phase reasoning system
- Has detailed catalog of 12 document types with prerequisites
- Has 8 workflow types with parameters and criticality flags
- Has explicit human validation protocol (6 steps)
- Has archiving retention policy (legal durations)
- Multi-tenant strict reinforced with explicit refusal scripts

---
Task ID: 7
Agent: main
Task: Create Sarah Guide In-App — global navigation/onboarding assistant (no tenant data)

Work Log:
- Added 2 new methods to SaraService:
  * handleGuideQueryStream() — SSE streaming version
  * handleGuideQuery() — non-streaming version
  * Both use a NEW getGuideSystemPrompt() (separate from landing/in-app prompts)
- Created getGuideSystemPrompt() with:
  * Identity: Sarah Guide = GPS de l'application (globale, pas multi-tenant)
  * MISSION UNIQUE: navigation & onboarding ONLY (no data access)
  * Explicit rule: NO access to school data (redirige vers ORION/ATLAS/modules)
  * Intelligence émotionnelle & accompagnement humain (warm welcome, calm, empathy)
  * CAPACITÉ DE NAVIGATION COMPLÈTE — MULTI-UI:
    - UI Administration (12 modules détaillés)
    - UI Enseignant (7 sections)
    - UI Parent-Élève (6 sections)
    - UI Promoteur (4 sections)
    - UI Platform Admin (5 sections)
  * DETAILED MODULE DESCRIPTIONS (10 modules with features + navigation paths)
  * ONBOARDING GUIDES per role:
    - Directeur/Admin (8 steps)
    - Enseignant (6 steps)
    - Parent (6 steps)
  * Périmètre strict (✅ can do / ❌ cannot do)
  * Strict rules (6 phrases max, redirect data requests to ORION/ATLAS)
- Added 2 new routes to SaraController:
  * POST /sara/guide/stream (SSE streaming, JwtAuthGuard only — no TenantGuard)
  * POST /sara/guide (non-streaming, JwtAuthGuard only — no TenantGuard)
  * Both documented as GLOBAL (not multi-tenant strict)
- Added 2 new methods to saraApi client:
  * guideStream() — async generator with JWT token + tenant header
  * guide() — non-streaming via apiClient
  * Both use getClientToken() + cookie for auth headers

Stage Summary:
- Sarah Guide In-App is a NEW global assistant dedicated to navigation/onboarding
- It is NOT multi-tenant strict (by design — it doesn't read school data)
- It covers ALL UIs: Administration, Teacher, Parent, Promoteur, Platform Admin
- It redirects data requests to ORION and action requests to ATLAS
- It has detailed onboarding guides per role
- It has detailed module descriptions for all 10 modules
- New API endpoints: POST /sara/guide and POST /sara/guide/stream
- Frontend client: saraApi.guide() and saraApi.guideStream()


---
Task ID: 8
Agent: main
Task: Fix Git configuration — update author email to match GitHub account

Work Log:
- Vercel deployment blocked because commit author email (yehiortech@gmail.com) was not recognized
- Updated git config user.email to s.akpovitohoul@gmail.com (matches GitHub account)
- Updated git config user.name to SenaDev007 (matches GitHub username)
- Creating new commit with corrected author to trigger Vercel deployment

Stage Summary:
- Git config updated: user.email = s.akpovitohoul@gmail.com, user.name = SenaDev007
- New commit will have correct author for Vercel deployment

---
Task ID: 9
Agent: main
Task: Fix git email (s.akpovitohou@gmail.com) + create InAppSaraGuideWidget component

Work Log:
GIT EMAIL FIX:
- Previous email "s.akpovitohoul@gmail.com" had an extra "l" — corrected to "s.akpovitohou@gmail.com"
- Updated git config user.email = s.akpovitohou@gmail.com
- Will create new commit with correct email to trigger Vercel deployment

IN-APP SARA GUIDE WIDGET:
- Created new component: apps/web-app/src/components/ai/InAppSaraGuideWidget.tsx (~800 lines)
- Uses saraApi.guideStream() — the new Sarah Guide endpoint (POST /sara/guide/stream)
- Branding Academia Helm (Royal Blue + Living Gold) — consistent with SaraWidget landing
- Compact Messenger/WhatsApp style (360×540, text 12px)
- Avatar Sarah next to each assistant message
- Auto-detects user role via useAuth() hook
- Auto-detects current module via usePathname() + path-to-module mapping
- Contextual suggestions per role AND per module (16 modules in catalog)
- Role-based onboarding suggestions (director, teacher, accountant, parent, secretary, surveillant)
- Contextual welcome message ("You are in module X as role Y")
- Streaming support via saraApi.guideStream() with JWT auth headers
- History persistence via loadChatMessages/saveChatMessages (key: 'sara-guide-inapp')
- Clear chat button + new conversation feature
- Branded footer "Sarah Guide · Navigation uniquement · ACADEMIA HELM"
- Floating button with compass icon (navigation theme) + gold ring + "?" badge
- No scanline/particles — minimal & professional

INTEGRATION:
- Added 'sara-guide-inapp' to ChatWidgetId type in chat-storage.ts
- Imported InAppSaraGuideWidget in apps/web-app/src/app/app/layout-client.tsx
- Widget now renders on ALL authenticated /app/* pages (school admin, teacher portal, parent portal)
- Positioned bottom-right (z-999) — doesn't conflict with SaraWidget (landing only)

Stage Summary:
- Sarah Guide In-App widget is now live on all authenticated app pages
- Uses the dedicated /sara/guide/stream endpoint (GLM 5.2, global, no tenant data)
- Auto-adapts to user role and current module for contextual guidance
- Redirection logic: data requests → ORION, action requests → ATLAS
- Git email corrected to s.akpovitohou@gmail.com for Vercel deployment

---
Task ID: 10
Agent: main

Task: Fix halo on mobile + make Sarah Guide UI-aware + multi-model ensemble (GLM 5.2 + MiniMax-M3 + GPT-OSS-120B)

Work Log:

HALO FIX (mobile):
- SaraWidget.tsx: reduced glow blur from 6px to 4px, gradient opacity 25→20, gold ring inset -2→-1.5px, opacity 0.7→0.55
- Added CSS class markers (sara-glow-bg, sara-gold-ring) for targeted mobile override
- Added @media (max-width: 768px) rule: blur 2px, opacity 0.6 for glow, opacity 0.4 for ring
- Reduced pulse animation scale from 1.08 to 1.04 (less aggressive)
- Same fix applied to InAppSaraGuideWidget.tsx (sara-guide-glow-bg, sara-guide-gold-ring)

SARAH GUIDE UI-AWARE (contextual adaptation):
- Added UIType detection (admin, teacher, parent, promoter, platform) via detectUIFromPath()
- Created UI_MODULE_CATALOGS with specific modules per UI:
  * admin: 11 modules (students, pedagogy, exams, finance, hr, communication, qhse, orion, atlas, settings, dashboard)
  * teacher: 7 modules (dashboard, grades, timetable, library, communication, attendance, sara_compose)
  * parent: 6 modules (dashboard, grades, attendance, payments, messages, calendar)
  * promoter: 5 modules (dashboard, schools, billing, analytics, orion)
  * platform: 6 modules (dashboard, tenants, users, monitoring, features, rbac)
- detectModuleFromPath() now takes uiType param and detects modules per-UI
- Removed old monolithic MODULE_CATALOG and DEFAULT_MODULE
- Welcome message now shows UI label + module + role
- Header subtitle shows UI label + module icon + label
- saraApi.guideStream() now accepts uiType param
- Backend sara.controller.ts and sara.service.ts accept uiType
- New getUIContext() method returns label + modules list + adaptationRule per UI
- Adaptation rules prevent Sarah from mentioning admin modules to teachers/parents and vice versa
- Bumped SARA_GUIDE_VERSION to v2-2025-08 (purges old messages)

MULTI-MODEL ENSEMBLE (GLM 5.2 + MiniMax-M3 + GPT-OSS-120B):
- Created ModelEnsembleService (apps/api-server/src/common/services/model-ensemble.service.ts)
  * 3 models: glm-5.2, minimax-m3, gpt-oss-120b
  * Each with specific config (temperature, top_p, max_tokens, supportsReasoning, supportsFunctionCalling)
  * AGENT_MODEL_MAPPING: SARA→GLM-5.2, ORION→MiniMax-M3, ATLAS→GPT-OSS-120B
  * buildRequestBody() adapts params per model (top_p 0.95 for MiniMax, 1 for others)
  * extractResponse() handles both reasoning_details (GLM) and reasoning_content (MiniMax/GPT-OSS)
  * extractStreamDelta() handles streaming reasoning_content
  * getFallbackChain() returns model fallback order (GLM 5.2 as universal fallback)
- Registered ModelEnsembleService in CommonModule (@Global, exported)
- Updated OpenRouterService:
  * Added PERSONA_MODEL_MAPPING for automatic agent→model routing
  * MODEL_FALLBACK_CHAIN now includes all 3 new models
  * chat() and chatStream() auto-select model based on persona if no model specified
  * executeChatCall() adds model-specific top_p (0.95 for MiniMax-M3, 1 for GPT-OSS)
  * executeChatCall() extracts reasoning_content (MiniMax/GPT-OSS) in addition to reasoning_details (GLM)
  * Added reasoning_content field to OpenRouterChatResponse interface
- Updated OrionAiService.callGlmModel():
  * Now tries MiniMax-M3 first (temp=1, top_p=0.95, max_tokens=8192)
  * Falls back to GLM-5.2 if MiniMax-M3 fails (temp=0.7, top_p=1, max_tokens=2000)
  * Logs reasoning_content when available (MiniMax-M3 exposes it)

ROUTING SUMMARY:
  - Sarah Landing (widget) → GLM 5.2 (via Next.js fallback route, unchanged)
  - Sarah Guide In-App → GLM 5.2 (via OpenRouterService, persona SARA)
  - Orion → MiniMax-M3 (direct fetch with fallback to GLM 5.2)
  - Atlas → GPT-OSS-120B (via OpenRouterService, persona ATLAS — automatic routing)

Stage Summary:
- Halo on mobile is now subtle (blur 2px, opacity 0.6) instead of thick (blur 6px, opacity 1)
- Sarah Guide is now UI-aware: admin sees admin modules, teacher sees teacher modules, parent sees parent modules
- Each UI has its own adaptation rule preventing cross-UI module mentions
- Multi-model ensemble implemented: GLM 5.2 + MiniMax-M3 + GPT-OSS-120B
- Automatic agent→model routing via PERSONA_MODEL_MAPPING
- reasoning_content support added for MiniMax-M3 and GPT-OSS-120B
- Fallback chain: primary model → GLM 5.2 → other models → placeholder

---
Task ID: 11
Agent: main
Task: Fix AI agents not responding + slow responses + add onboarding with "don't show again" checkbox

Work Log:

DIAGNOSIS — Why agents returned generic error:
- Root cause: OpenRouterService.chatStream() had enableFallback=true by default
  with MODEL_FALLBACK_CHAIN containing 5 models (GLM 5.2, MiniMax-M3, GPT-OSS-120B, GLM 5.1, GLM 4.5 Air)
- With maxRetries=2 per model = up to 10 attempts before giving up
- If MiniMax-M3 or GPT-OSS-120B not accessible with NVIDIA key → 30s+ timeout → generic error
- Also: frontend called backend NestJS directly, which may have CORS/latency issues on Vercel

FIX 1 — Disable fallback for streaming (speed):
- Changed enableFallback default from true to false for chatStream()
- Only retry on the same model (2 attempts max), no cross-model fallback in streaming
- Non-streaming chat() still has full fallback chain (acceptable for non-interactive calls)
- Reduced streaming timeout from 60s to 30s (fail fast)

FIX 2 — Frontend route priority (reliability):
- saraApi.queryStream() now tries Next.js route FIRST (/api/public/sara/chat/stream)
  * Same origin → no CORS issues
  * Uses NVIDIA_API_KEY configured on Vercel directly
  * Already deployed with the frontend
- Falls back to backend NestJS /sara/query/stream if Next.js route fails
- Falls back to non-streaming /sara/query as last resort
- Same pattern applied to saraApi.guideStream() for Sarah Guide In-App

FIX 3 — Next.js route supports mode 'inapp' with UI context:
- route.ts now accepts mode, userRole, currentModule, uiType params
- buildInAppUIContext() function generates UI-specific context:
  * admin: 11 modules listed with paths
  * teacher: 7 modules (no admin modules mentioned)
  * parent: 6 modules (with Wave/MTN/Moov payment info)
  * promoter: 5 modules (multi-campus focus)
  * platform: 6 modules (technical admin)
- Each UI has adaptation rule preventing cross-UI module mentions
- Reduced max_tokens from 800 to 600 (faster response)
- Reduced temperature from 0.85 to 0.7 (more focused)

FIX 4 — Vercel function config:
- Added maxDuration: 60s + memory: 1024MB for /api/public/sara/chat/stream route
- Added same config for /api/public/sara/chat route
- Prevents Vercel 10s timeout on AI calls

ONBOARDING with "don't show again" checkbox:
- Added showOnboarding + dontShowAgain state to InAppSaraGuideWidget
- ONBOARDING_DISMISS_KEY = 'sara_guide_onboarding_dismissed' in localStorage
- On mount: check if dismissed → skip onboarding
- On button click: if not dismissed → show onboarding panel (not chat)
- Onboarding panel:
  * Sarah avatar + header (Royal Blue + Gold)
  * Welcome message: "Shalom! Je suis Sarah... Souhaitez-vous que je vous guide ?"
  * Checkbox: "Ne plus afficher ce message"
  * Two buttons: "Non merci" (dismiss) + "Oui, guidez-moi" (accept)
- If checkbox checked + "Non merci" → saves to localStorage, never shows again
- If checkbox checked + "Oui, guidez-moi" → saves + opens chat
- If checkbox unchecked → onboarding shows again next time

API KEY SECURITY:
- Verified: NVIDIA_API_KEY is read from environment variable (not hardcoded)
- No API keys found in any source file
- Keys must be configured on Vercel (for Next.js route) AND backend (for NestJS)

Stage Summary:
- AI agents should now respond correctly (Next.js route as primary, backend as fallback)
- Responses should be faster (no multi-model fallback in streaming, 30s timeout, 600 max_tokens)
- Onboarding panel appears on first click with "don't show again" checkbox
- Sarah Guide adapts to current UI (admin/teacher/parent/promoter/platform) via Next.js route
- API keys are environment variables, never hardcoded

---
Task ID: 12
Agent: main
Task: Make Orion 100% functional across ALL modules (14 modules)

Work Log:
- Explored Prisma schema — identified 400+ models across all modules
- Created OrionModuleScanner service (apps/api-server/src/orion/services/orion-module-scanner.service.ts, ~700 lines)
  * Scans 14 modules exhaustively with multi-tenant strict filtering
  * Each module returns: name, summary, anomalies[], kpis[]
  * All Prisma queries wrapped in safeCount()/safeAggregate() for resilience
  * formatScanForPrompt() generates formatted text for system prompt injection

MODULES COVERED (14):
1. Pédagogie — Timetable, TimetableEntry, TimetableVersion, TeachingAssignment, ClassSubject,
   PedagogicalDocument, PedagogicalSheet, LessonJournal, LessonJournalValidation,
   PedagogicalSheetValidation, PedagogicalMaterial, ClassDiary, CahierJournal
   Alerts: missing EDT, pending validations, missing teacher assignments, empty pedagogical space

2. Élèves & Scolarité — Student, Admission, StudentEnrollment, TransferRequest, ClassTransfer,
   StudentIdCard, NationalExportLog, Absence, AttendanceRecord, Discipline, DisciplinaryAction
   Alerts: no active students, pending admissions, incomplete dossiers, high absence rate

3. Finance — FeeConfiguration, FeeStructure, CashRegister, CashClosure, Payment, OnlinePayment,
   PaymentFlow, DailyClosure, CollectionAction, CollectionCase, FeeArrear, Expense,
   FinanceExpense, FinanceTransaction, TreasuryMovement, FinanceDailyClosure, FinancialAnomaly
   Alerts: no fee config, no payment plans, arrears, financial anomalies, deficit (expenses > income)

4. Examens & Notes — Exam, ExamSession, Grade, ExamScore, ReportCard, ReportCardItem,
   GradeCalculation, GradeValidationBatch, ExamDeliberation, GradeCorrectionRequest,
   GradeLock, HonorRoll, Ranking
   Alerts: no exams, exams without grades, pending grades, no report cards generated

5. RH — Teacher, Contract, ContractAmendment, LeaveRequest, Payroll, SalarySlip, SalaryPayment,
   CNSSDeclaration, EmployeeCNSS, HrCandidate, HrApplication, HrInterview, HrJob, OvertimeRecord
   Alerts: teachers without contracts, pending leaves, contracts expiring <30 days, no CNSS

6. Communication — Message, MessageLog, WhatsappLog, EmailLog, PushNotification,
   ScheduledMessage, MessageTemplate, Announcement
   Alerts: failed messages, pending scheduled messages

7. QHSE — QHSEIncident, QhsIncident, QHSEAudit, QHSEHygieneInspection, QHSESecurityControl,
   QHSEHealthVisit, QHSERisk, QHSEActionPlan, QHSECompliance, QHSEPeriodicControl
   Alerts: critical incidents, open incidents >5

8. Paramètres — TenantSetting, TenantFeature, SchoolSettings, SchoolAcademicSettings,
   Role, Permission, AuditLog, SecuritySettings, FinancialSettings
   Alerts: no roles configured, low audit activity

9. Cantine — CanteenMenu, CanteenEnrollment, CanteenPayment, CanteenMealService,
   CanteenAttendance, CanteenIncident, CanteenStockMovement, CanteenSupplier
   Alerts: no menus, pending payments, incidents

10. EduCast — EduCastTeacherChannel, EduCastChannelSubscriber, EduCastMediaItem,
    EduCastResource, EduCastWebinar, EduCastPurchase, EduCastPayoutRequest
    Alerts: no channels, pending payouts

11. Boutique — ShopProduct, ShopCategory, ShopOrder, ShopOrderItem, ShopDiscount,
    ShopLoyaltyCard, ShopDelivery, ShopPurchaseOrder
    Alerts: no products, pending orders, low stock (≤5)

12. Transport — TransportTrip, TransportAssignment, Vehicle, TransportDriver,
    TransportAttendant, TransportZone, TransportSchedule, TransportIncident
    Alerts: assignments without trips, incidents

13. Infirmerie — InfirmaryVisit, InfirmaryMedicalRecord, InfirmaryEmergency, InfirmaryCheckup,
    InfirmaryAllergy, Medication, InfirmaryMedicationMovement
    Alerts: emergencies, no visits

14. Bibliothèque — LibraryBook, LibraryCopy, LibraryLoan, LibraryPenalty, LibraryReservation,
    LibraryCategory, LibraryDigitalResource
    Alerts: overdue loans, penalties, empty library

INTEGRATION:
- Registered OrionModuleScanner in OrionAiModule (providers + exports)
- Injected OrionModuleScanner into OrionAiService constructor
- Updated buildContext() to call moduleScanner.scanAllModules(tenantId, academicYearId)
- Module scan anomalies merged with existing alerts (deduplicated)
- moduleScan included in context return object
- buildSystemPrompt() now injects formatted scan via formatScanForPrompt()
- Added "ANALYSE MULTI-MODULE" section to system prompt with 5 analysis modes:
  1. Analysis per module (user asks "analyse module X")
  2. Global analysis (user asks "analyse everything")
  3. Pedagogical analysis (EDT, espace péda, validation direction, affectations)
  4. Financial analysis (frais, multi-caisses, encaissements, recouvrements, dépenses, clôtures)
  5. Students analysis (inscriptions, transferts, absences, discipline)

MULTI-TENANT STRICT:
- All scanner queries filtered by tenantFilter = { tenantId }
- Year-specific queries filtered by tenantYearFilter = { tenantId, academicYearId }
- No cross-tenant data ever read
- Scanner is non-blocking: if it fails, Orion still works with basic context

Stage Summary:
- Orion now reads data from 14 modules (was 5 domains with basic counts)
- ~100 Prisma queries per scan covering all module tabs
- Module-specific anomalies with INFO/ATTENTION/CRITIQUE severity
- Module-specific KPIs with interpretation vs thresholds
- Formatted scan injected into system prompt for AI analysis
- Multi-tenant strict enforced on all queries
- Orion can now answer "analyse le module pédagogie", "analyse les finances", etc.

Task: Termine le seed + fix onglet Déverrouillage (scopeLevel is not defined)

Work Log:
- Inspected current DB state:
  * 2 tenants (59b8c348 + e0aaa032)
  * 6 PRIMAIRE classes for tenant 59b8c348 (CI A, CP, CE1, CE2, CM1, CM2) — 23 subjects each
  * Active year 2026-2027 (a7593470) with 3 academic_periods (Trimestre 1/2/3)
  * 3 evaluation_types for PRIMAIRE: EM1, EM2, EC
  * 574 evaluations existed (556 VALIDATED + 18 PLANNED with NULL teacherId)
  * 2755 grades — ALL had NULL periodId
- Discovered data model inconsistency:
  * evaluations.periodId → academic_periods.id (table: academic_periods)
  * grades.periodId → quarters.id (table: quarters — DIFFERENT TABLE!)
  * Built mapping academic_period → quarter (by trimester number)
- STEP 1: Backfilled 2209 grades.periodId (mapping academic_periods → quarters)
- STEP 2: Fixed 18 PLANNED evaluations — assigned teacherId from TEACHER_BY_CLASS mapping + marked VALIDATED
- STEP 3: Created missing PRIMAIRE evaluations via BULK INSERT:
  * CE1: 23 new evals + 777 grades (184 already existed)
  * CE2: 69 new evals + 988 grades (138 already existed)
  * CI A: 92 new evals + 837 grades (115 already existed)
  * CM1: 207 new evals + 2484 grades (all from scratch)
  * CM2: 92 new evals + 891 grades (115 already existed)
  * CP: 207 new evals + 4554 grades (all from scratch)
- STEP 4: Created quarters for 2025-2026 academic year (was missing)
  * Created Q#1 Trimestre 1, Q#2 Deuxième Trimestre, Q#3 Troisième Trimestre
  * Backfilled remaining 546 grades with periodId (Maternelle grades from 2025-2026)
- FINAL STATE:
  * 1787 evaluations (all VALIDATED, no NULL teacherId)
  * 19920 grades (no NULL periodId)
  * 6 PRIMAIRE classes × 3 trimesters × 3 eval types × 23 subjects = ~1242 evaluations

FOR THE DÉVERROUILLAGE TAB:
- Diagnosed: previous "onglet déverrouillage" was lost (not committed). The "scopeLevel is not defined" error was from a non-existent page.
- Created new backend `evaluation_unlock_requests` table:
  * id, tenantId, evaluationId, requestedById, classId, subjectId, periodId, schoolLevelId
  * reason, status (PENDING/APPROVED/REJECTED), reviewedById, reviewedAt, reviewComment
  * Foreign keys to evaluations, users, classes, subjects
- Created new backend controller `UnlockRequestsController`:
  * GET  /institutional-exams/unlock-requests (list with filters: status, classId, schoolLevelId, academicYearId)
  * GET  /institutional-exams/unlock-requests/:id (detail)
  * POST /institutional-exams/unlock-requests (create)
  * PATCH /institutional-exams/unlock-requests/:id/approve (sets eval to OPEN_FOR_GRADING)
  * PATCH /institutional-exams/unlock-requests/:id/reject (with reviewComment)
- Registered UnlockRequestsController in exams.module.ts
- Updated evaluations.controller.ts unlockRequest endpoint:
  * Now persists to evaluation_unlock_requests (was just returning success without saving)
  * Added NotFoundException import (was missing)
  * Injects PrismaService
- Added "Déverrouillage" tab to EXAMS_SUB_MODULES (between Validation and Registre)
- Created /app/exams/deverrouillage/page.tsx:
  * Uses useExamScope() PROPERLY — no scopeLevel reference error
  * Lists unlock requests grouped by class
  * Filters by status (PENDING/APPROVED/REJECTED/ALL)
  * Approve/Reject buttons per request
  * Stats cards (Total, En attente, Approuvées, Rejetées)
  * Shows justificatif, requested by, dates, review info
- Created /app/exams/deverrouillage/loading.tsx

Stage Summary:
- SEED COMPLETE: 1787 evaluations, 19920 grades, all with proper teacherId + periodId
- DÉVERROUILLAGE TAB: Full stack implementation (DB + API + UI)
- Backend persists unlock requests + allows approve/reject
- Frontend uses useExamScope() correctly — no more "scopeLevel is not defined"
- All PRIMAIRE classes (CI A, CP, CE1, CE2, CM1, CM2) × 3 trimesters × 3 eval types × 23 subjects covered
- Maternelle 1, 2 already complete from before (3 trimesters × 3 types × ~26 subjects)


---
Task ID: 13
Agent: main
Task: Three coordinated fixes — sidebar revert, dynamic academic year algorithm, "VALIDATED is not defined" exam module crash

Work Log:
- Read user feedback carefully: module filtering belongs in Paramètres > Onglet Modules (NOT sidebar)
- Inspected commit ba5276d3 — found it had:
  * Removed 'Site Institutionnel' from MAIN_MODULES in PilotageSidebar.tsx
  * Reordered modules (moved Pédagogie below Élèves)
  * Both changes were unwanted — user only wanted filtering via the existing toggle UI

FIX 1 — Revert sidebar, keep filtering in Paramètres > Modules tab:
- PilotageSidebar.tsx MAIN_MODULES:
  * Restored 'Site Institutionnel' entry with featureCode: 'CMS'
  * Restored canonical order: Tableau de pilotage → Pédagogie → Élèves →
    Finance → Examens → RH → Communication → Site Institutionnel
  * Added comment: "Le filtrage par module activé/désactivé se fait dans
    Paramètres > Onglet Modules"
- settings/page.tsx:
  * Added 'CMS' to modulesDisplayOrder array (after COMMUNICATION)
  * Added `CMS: 'Site Institutionnel'` to featureLabels map
- Sidebar's existing showModule() logic already reads enabledSet from
  backend, so toggling CMS off in Paramètres > Modules will hide it from
  the sidebar automatically — no hard-coded hiding needed

FIX 2 — Verify pré-rentrée/rentrée algorithm is dynamic per year:
- Confirmed SchoolCalendarConfigService.calculateYearDates(startYear, config):
  * preEntryDate = Nth Monday of September (default N=1)
  * officialStartDate = preEntryDate + 1 week
  * endDate = last Friday of June of startYear+1
- Confirmed AcademicYearSettingsService.generateNext() calls
  buildYearDates(nextStartYear, tenantId) — fully dynamic
- Confirmed promoteToNext() also uses buildYearDates() with computed
  nextStartYear = startYear + 1
- Added scripts/verify-academic-year-algorithm.cjs to prove correctness:
    2024-2025 → pre=Sept 2 (Mon),  rentrée=Sept 9 (Mon)
    2025-2026 → pre=Sept 1 (Mon),  rentrée=Sept 8 (Mon)
    2026-2027 → pre=Sept 7 (Mon),  rentrée=Sept 14 (Mon) ✅ matches user's expectation
    2027-2028 → pre=Sept 6 (Mon),  rentrée=Sept 13 (Mon)
    2028-2029 → pre=Sept 4 (Mon),  rentrée=Sept 11 (Mon)
    2029-2030 → pre=Sept 3 (Mon),  rentrée=Sept 10 (Mon)
    2030-2031 → pre=Sept 2 (Mon),  rentrée=Sept 9 (Mon)
- Algorithm is fully dynamic — no hard-coded year values

FIX 3 — "VALIDATED is not defined" in Exams module (CRITICAL):
- Logged into production as promoter via agent-browser:
  * URL: https://cspeb-eveildafriqueeducation.academiahelm.com/login
  * Email: salumerhel2036@gmail.com (Erhel DEGBE, PROMOTER)
  * Navigated to /app/exams → clicked Primaire → clicked Francophone
  * Reproduced error: "Erreur du module — Détail : VALIDATED is not defined"
- Root cause: apps/web-app/src/app/app/exams/page.tsx line 149-154
  The byStatus object used ES2015 shorthand property names:
    const byStatus = {
      VALIDATED,           // ← undefined variable!
      PLANNED,             // ← undefined variable!
      SUBMITTED,           // ← undefined variable!
      OPEN_FOR_GRADING,    // ← undefined variable!
    };
  These identifiers were NOT in scope. The intent was to map each status
  key to its pre-computed count variable (validated, planned, submitted,
  openForGrading).
- Fix: replaced shorthand with explicit key: value pairs:
    const byStatus = {
      VALIDATED: validated,
      PLANNED: planned,
      SUBMITTED: submitted,
      OPEN_FOR_GRADING: openForGrading,
    };
- Verified no other exam page has the same shorthand-without-variable bug
- Committed and pushed (33fc1e24)
- Vercel deployment pending at time of writing (auto-deploy triggered)

Stage Summary:
- Sidebar restored to canonical state with all 8 modules (incl. Site Institutionnel)
- Module filtering lives exclusively in Paramètres > Onglet Modules via toggles
- Academic year algorithm confirmed dynamic per year (verified 2024→2031)
- "VALIDATED is not defined" crash fixed — root cause was ES2015 shorthand
  property names referencing non-existent variables
- All changes committed in 33fc1e24 and pushed to origin/main

---
Task ID: 14
Agent: main
Task: Fix Vercel build failure — "Unterminated regexp literal" in settings/page.tsx

Work Log:
- Vercel build failed at line 2833 with "Unterminated regexp literal"
- Same error in both ba5276d3 and 33fc1e24 deployments
- Root cause: previous commit ba5276d3 had removed the
  "Modifier les dates" button from the academic years history list.
  The button was wrapped in <div className="flex items-center gap-2 shrink-0">.
  The commit removed:
    - <div className="flex items-center gap-2 shrink-0">  (wrapper OPEN)
    - <button>Modifier les dates</button>                  (the button)
  But KEPT the matching wrapper </div> — leaving an orphan closing tag.
- The orphan </div> caused Turbopack/SWC to misparse the JSX file.
  The parser tried to recover and eventually encountered '/' in </div>
  which it interpreted as the start of a regex literal — hence the
  misleading "Unterminated regexp literal" error.
- Fix: removed the orphan </div> on line 2832.
- Verified with `npx tsc --noEmit` — no more errors on settings/page.tsx
- Committed 8809172f and pushed to origin/main

Stage Summary:
- Vercel build should now succeed (one-line fix)
- The "Activer" and "Clôturer" buttons remain as direct siblings of the
  inner-left content block, inside the outer row div — same visual layout
- Combined with the previous fix (33fc1e24 for "VALIDATED is not defined"),
  the Exams module should now work end-to-end on production

---
Task ID: 15
Agent: main
Task: Settings page overhaul — multi-role RBAC, sub-tabs, remove 5 tabs, refactor Facturation

Work Log:
1) Removed emoji 📍 from GPS button (Identité > Localisation GPS)
   - apps/web-app/src/components/settings/SchoolGeolocationSettings.tsx
   - Button now shows only the Navigation icon + text

2) Deleted 5 tabs from Settings sidebar:
   - Communication (géré via module Communication dédié)
   - Paiements (fusionné avec Facturation)
   - ORION (accessible via widget flottant)
   - ATLAS (accessible via widget flottant)
   - Offline (sync hors-ligne gérée automatiquement)
   - Removed their case blocks (728 lines) via scripts/strip-removed-tabs-cases.cjs
   - Old URLs with ?tab=X are auto-redirected via REMOVED_TABS_REDIRECT map
   - Kept TabId entries for URL backward compatibility

3) Split Rôles tab into two sub-tabs:
   - "Rôles & Permissions" : gestion des rôles (plateforme + école), création,
     matrice des permissions — sans la liste des utilisateurs
   - "Liste des utilisateurs" : attribution/révocation de rôles par utilisateur
   - Sub-tab state via `rolesSubTab` ('roles' | 'users')
   - Sub-tab nav uses underline-style tabs (border-b-2 blue when active)

4) Implemented flexible multi-role attribution:
   - Replaced single-select dropdown with multi-select checkbox panel
   - User can check multiple roles simultaneously → batch attribution
   - State `pendingAssignRoleIds: string[]` tracks pending selections
   - "Attribuer (N)" button shows count of pending roles
   - Already-assigned roles are filtered out of the checkbox list
   - Existing roles shown as removable chips with × button
   - Info banner explains multi-role semantics + RH impact

5) Backend: assignRoleToUser now syncs primary role
   - apps/api-server/src/settings/services/roles-permissions.service.ts
   - When user.role is null, sets it to the first assigned role
   - Allows legacy modules reading user.role to keep working
   - UserRole table already supports N roles per user (no schema change needed)

6) Multi-role now impacts RH personnel file:
   - apps/api-server/src/hr/staff-prisma.service.ts findStaffById now loads
     the matching User + all userRoles (with role details)
   - Returns `userAccount: { id, email, primaryRole, status, roles[] }`
   - apps/web-app/src/app/app/hr/staff/[id]/page.tsx now displays:
     * "Rôles attribués au compte utilisateur" panel in credentials section
     * Email + status of the user account
     * List of attributed roles (system vs custom styling)
     * Hint directing admin to Paramètres > Rôles > Liste des utilisateurs
       to add/remove roles
   - No emoji used (per user preference)

7) Refactored Facturation tab:
   - Added lazy-load effect when user opens billing tab
     (re-fetches billingSettings + availablePlans + invoices)
   - Added "Actualiser" button + loading spinner
   - Header shows the school name from identityProfile
   - Empty state for invoices (was hidden before)
   - Shows invoice count in section header

Stage Summary:
- 5 tabs deleted (Communication, Paiements, ORION, ATLAS, Offline)
- Rôles tab now has 2 sub-tabs (Rôles & Permissions / Liste des utilisateurs)
- Multi-role attribution fully supported (frontend + backend)
- RH staff detail page shows attributed roles + status
- Facturation tab reloads data dynamically + shows empty states
- All changes TypeScript-clean (no errors in modified files)

---
Task ID: 16
Agent: main
Task: Settings overhaul — Sécurité (politique mot de passe + session + auth avancée) + Appareils (2 sub-tabs)

Work Log:

== ONGLET SÉCURITÉ ==

1) Politique de mots de passe — Refonte professionnelle :
   - Header enrichi avec badge "Sécurité critique" + explication du
     lien avec le module RH (génération d'identifiants)
   - Champs : longueur min (6-20), expiration (0-365 jours),
     4 cases à cocher complexité (majuscule, minuscule, chiffre, spécial)
     avec hints visuels (A-Z, a-z, 0-9, !@#$%^&*?)
   - ⭐ Aperçu live d'un mot de passe généré selon la politique :
     * Fonction generateSamplePassword(form) côté frontend réplique
       la logique du backend (adj + noun + digits + special + padding + shuffle)
     * Badge "Régénérer l'aperçu" pour générer un nouveau sample
     * Chips visuels montrant les caractéristiques satisfaites
     * Longueur affichée / minLength configuré

2) Backend StaffCredentialService.generateSecurePassword(policy) :
   - apps/api-server/src/hr/services/staff-credential.service.ts
   - Nouvelle méthode loadPasswordPolicy(tenantId) charge les
     SecuritySettings depuis la DB (avec fallback valeurs par défaut)
   - generateSecurePassword(policy) construit le mot de passe :
     * Adjectif (majuscule) si requireUppercase
     * Nom (minuscule) si requireLowercase
     * 3 chiffres si requireNumbers
     * 1-2 caractères spéciaux si requireSpecial
     * Padding aléatoire jusqu'à minLength
     * Shuffle Fisher-Yates pour format imprévisible
     * Vérification finale + insertion caractère manquant si besoin
   - Les 2 calls (createCredentialsForStaff + generateOrRegenerateCredentials)
     passent maintenant la policy du tenant

3) Session et verrouillage — Étendu :
   - Durée de session max (5-480 min) — existant
   - ⭐ Inactivité avant verrouillage (1-120 min) — NOUVEAU
   - Tentatives max (3-10) — existant
   - Durée de blocage (5-60 min) — existant
   - Chaque champ a maintenant hint + description métier
   - Bandeau impact expliquant le comportement

4) Authentification avancée — Étendue :
   - 2FA (existant)
   - Vérification email (existant)
   - ⭐ Reconnaissance des appareils (deviceFingerprintEnabled) — NOUVEAU
   - ⭐ Notification de nouvelle connexion (notifyOnNewDevice) — NOUVEAU
   - Chaque toggle a description détaillée du comportement

5) Backend SecuritySettings :
   - 3 nouvelles colonnes ajoutées à security_settings via migration :
     * inactivityLockMinutes (Int, default 15)
     * deviceFingerprintEnabled (Bool, default true)
     * notifyOnNewDevice (Bool, default true)
   - Migration exécutée sur la DB Neon de production
   - SecuritySettingsService.updateSecuritySettings accepte les 3 nouveaux champs
   - validateNewFields() vérifie les plages de valeurs
   - getSecuritySettings crée les valeurs par défaut pour les nouveaux tenants

== ONGLET APPAREILS AUTORISÉS ==

6) Refonte avec 2 sous-onglets :
   - "Appareils connectés" : liste filtrée par période (30j / mois / trimestre / année)
   - "Historique de connexion" : archive paginée de tous les événements

7) Sous-onglet Appareils connectés :
   - Filtre période : 30 derniers jours / Ce mois / Ce trimestre / Cette année
   - Tableau enrichi : Appareil (nom + UA), Type (badge visuel),
     Utilisateur (nom + email + rôle), Adresse IP, Dernière activité,
     Statut (En attente / Approuvé / Inactif), Actions
   - ⭐ Détection des appareils en attente (isPendingValidation) :
     * Ligne surlignée en ambre
     * Badge "En attente" visible
     * Bouton "Approuver" (validation admin) à côté de "Révoquer"
   - DeviceTypeBadge : détecte Smartphone / Tablette / Ordinateur
     à partir de deviceType + userAgent

8) Sous-onglet Historique de connexion :
   - Filtres : Action (LOGIN, LOGOUT, LOGIN_FAILED, DEVICE_REVOKED,
     DEVICE_APPROVED, LOCKOUT, OTP_SENT, OTP_VERIFIED) + Statut (SUCCESS/FAILED)
   - Tableau : Date/Heure, Utilisateur, Action (badge coloré),
     Appareil (nom + type + IP), Adresse IP, Statut, Détail (reason)
   - Pagination (50 par page) avec boutons Précédent/Suivant
   - Compteur "X entrée(s) — page Y/Z"

9) Backend TenantDevicesController (NOUVEAU) :
   - apps/api-server/src/auth/controllers/tenant-devices.controller.ts
   - 3 endpoints :
     * GET /auth/devices/connected — appareils récents par période
     * GET /auth/devices/login-history — historique paginé (50/page)
     * POST /auth/devices/:deviceId/approve — validation manuelle admin
   - Filtre strict par tenantId (isolation multi-tenant)
   - Rôles autorisés : SUPER_ADMIN, PLATFORM_OWNER, PLATFORM_SUPER_ADMIN,
     PLATFORM_ADMIN, PROMOTER, SCHOOL_OWNER, SCHOOL_ADMIN,
     DIRECTEUR_GENERAL, DIRECTEUR_ETABLISSEMENT, DIRECTEUR
   - periodToStartDate() convertit '30d'/'month'/'quarter'/'year' en Date
   - Inclut user + device dans les réponses pour affichage enrichi

10) Frontend settings.service.ts :
    - getConnectedDevices({ period, tenantId })
    - getLoginHistory({ page, limit, userId, action, status, from, to, tenantId })
    - approveDevice(deviceId)
    - Lazy-load via useEffect quand sous-onglet ouvert ou période change

Stage Summary:
- Politique mot de passe : génère maintenant des mots de passe conformes
  à la config du tenant (longueur + complexité)
- Aperçu live dans l'onglet Sécurité montre le format attendu
- 3 nouveaux champs security_settings (inactivité, fingerprint, notification)
- Appareils : 2 sous-onglets avec filtres période + pagination
- Détection appareils en attente + bouton Approuver
- Historique complet avec filtres action/statut + pagination
- Backend : nouveau TenantDevicesController avec 3 endpoints
- Migration DB appliquée sur Neon production

---
Task ID: 17
Agent: main
Task: Fix ClassCouncil Prisma P2010 + add global council creation for all classes of a school level

Work Log:

== BUG: "column periodId of relation class_councils does not exist" ==

1) Diagnostic:
   - Inspected actual DB schema: class_councils has columns
     id, tenantId, academicYearId, schoolLevelId, academicTrackId?,
     classId, quarterId?, councilDate, status, participants[], notes?, createdAt, updatedAt
   - NO periodId column — the councils.service.ts was using periodId everywhere
     (legacy code written against a wrong schema)
   - Also referenced non-existent columns: title, chairedById
   - All $queryRawUnsafe / $executeRawUnsafe calls were broken

2) Fix — rewrote councils.service.ts completely:
   - Replaced ALL raw SQL queries with safe Prisma client API calls
     (this.prisma.classCouncil.findMany, create, updateMany, deleteMany)
   - Renamed periodId → quarterId everywhere (matches actual schema)
   - Removed references to title, chairedById (use notes instead)
   - getCouncils() now uses Prisma findMany with proper includes
     (class, schoolLevel, quarter, academicTrack, _count)
   - getCouncilDetails() now uses Prisma findFirst with includes
   - saveDecision() uses findFirst + create/update (was raw INSERT...ON CONFLICT)
   - startCouncil/closeCouncil now require tenantId (updateMany for safety)
   - getAIAnalysis() uses Prisma findMany for evaluations + grades + attendance
   - Note: Evaluation.periodId references AcademicPeriod (different table
     from ClassCouncil.quarterId which references Quarter). For AI analysis,
     we filter by classId + academicYearId + status=VALIDATED only (skip
     period filter to avoid the table mismatch).

== FEATURE: Global council creation for all classes of a school level ==

3) Backend — createGlobalCouncils(tenantId, data):
   - Fetches all classes of the school level with active enrollments
   - Checks for existing councils (same classId + quarterId + academicYearId)
     to avoid duplicates
   - Transaction: creates one ClassCouncil per class in a single $transaction
   - Returns: { created: [...], skipped: [...], totalClasses, createdCount, skippedCount }
   - Skipped classes have reason: 'already_exists'

4) Controller — POST /institutional-exams/councils:
   - If data.schoolLevelId is provided WITHOUT data.classId → calls
     createGlobalCouncils (global mode)
   - If data.classId is provided → calls createCouncil (single class mode)
   - GET /institutional-exams/councils now accepts quarterId (and periodId
     as legacy alias → mapped to quarterId for backward compat)
   - GET now also accepts schoolLevelId filter

5) Frontend — councils/page.tsx:
   - CreateCouncilModal: added mode selector (radio buttons)
     * "Global — Toutes les classes du niveau {scopeLevel}" (default)
     * "Classe unique"
   - Global mode: hides class selector, shows info banner explaining
     that one council will be created per class
   - handleCreate: sends payload with schoolLevelId (no classId for global)
     + quarterId (was periodId before)
   - loadCouncils: now passes schoolLevelId filter so each level shows
     only its own councils
   - Toast message: "X conseil(s) programmé(s) pour toutes les classes
     du niveau MATERNELLE (Y déjà existant(s))"

Stage Summary:
- Prisma P2010 error fixed (periodId → quarterId, raw SQL → safe Prisma API)
- Global council creation: one click creates N councils (one per class)
- All teachers of all classes of the level see the council in their UI
- Backend handles deduplication (skips existing councils for same
  classId + quarterId + academicYearId)
- Frontend modal defaults to global mode with clear explanation

---
Task ID: 18
Agent: main
Task: Bulletins — director visa editable + symbole emoji + 2-column PDF layout + filename

Work Log:

== BACKEND ==

1) ReportCard schema — 2 nouvelles colonnes :
   - directorVisa (Text, nullable)
   - directorVisaUpdatedAt (Timestamp, nullable)
   - Migration appliquée sur Neon production
   - Schéma Prisma mis à jour

2) BulletinsController — 2 nouveaux endpoints :
   - PATCH /institutional-exams/bulletins/director-visa
     Body: { studentId, periodId, directorVisa, schoolLevelId? }
     Upsert ReportCard : met à jour directorVisa ou crée le ReportCard
   - GET /institutional-exams/bulletins/director-visa?studentId=X&periodId=Y
     Retourne { directorVisa, updatedAt }

3) BulletinPdfService — refonte majeure de buildHtml :
   - BulletinPdfData étendu : subjects[].directorVisa, symboleMerite,
     directorVisa (global), appreciationGlobale (texte)
   - computeSymboleMerite(data) :
     * Maternelle : TS → 🌟 Très Satisfaisant, S → 👍 Satisfaisant,
       PS → ⚠️ Peu Satisfaisant
     * Primaire/Secondaire : >=16 → 🏆, >=14 → 🌟, >=12 → 👍,
       >=10 → ✅, <10 → ⚠️
   - ⭐ Layout 2 colonnes (flex) après la section infos élève :
     * Colonne gauche (flex: 2.3) : tableau des notes + synthèse
       (moyenne, plus forte/faible, seuil) + symbole mérité (maternelle)
     * Colonne droite (flex: 1) : symbole mérité (emoji gros) +
       appréciation globale (texte) + visa directeur (texte) +
       analyse et recommandations + 3 signatures empilées + QR code
   - Tableau : ajout de la colonne "Visa Directeur" (surlignée en bleu foncé)
     pour Maternelle ET Primaire
   - Total General row : ajout cellule visa directeur (mention globale)
   - Chaque sujet : cellule visa directeur éditable (s.directorVisa ||
     s.appreciation || '—')
   - Format paysage A4 conservé

4) Filename PDF — ajout type éval + trimestre :
   - Frontend : bulletin_[élève]_[typeEval]_[trimestre].pdf
   - Backend : même règle dans generateBulletinPdf
   - Exemple : bulletin_DEGBE_Erhel_EM1_Trimestre_1.pdf

== FRONTEND ==

5) BulletinMaternellePage1 — refonte :
   - État directorVisas (Record<subjectId, string>) initialisé depuis
     score.directorVisa || score.appreciation
   - Chaque ligne : input text éditable dans la colonne "Visa Directeur"
     avec auto-save on blur (handleVisaBlur)
   - Surlignage bg-blue-50/30 sur la colonne visa directeur
   - Symbole mérité (emoji 🌟/👍/⚠️) séparé de l'appréciation globale
     (texte) — grid grid-cols-2
   - Hint italic : "visa auto-rempli depuis appréciation enseignant,
     éditable, auto-enregistré à la sortie de la ligne"

6) BulletinPrimairePage1 — refonte :
   - Même pattern : directorVisas state + input éditable par matière
   - Ajout colonne "Visa Directeur" dans le tableau (header bleu foncé)
   - Total General row : cellule visa directeur = mention globale
   - Symbole mérité (emoji 🏆/🌟/👍/✅/⚠️) basé sur moyenne générale
   - Appréciation globale (texte Très Bien/Bien/Assez Bien/Passable/Insuffisant)
     séparée du symbole

7) BulletinPage2 — refonte section symbole :
   - Grid 3 colonnes : Symbole mérité (emoji) | Appréciation globale (texte)
     | Visa du Directeur (textarea éditable)
   - directorVisa state + handleDirectorVisaBlur (auto-save + indicateur
     "✓ Enregistré" pendant 2s)
   - Reset visa quand l'élève change (useEffect sur student.id)
   - Auto-rempli depuis student.appreciationGlobale si vide
   - Placeholder = appreciationGlobale (suggère la valeur par défaut)

Stage Summary:
- Visa directeur : éditable par élève ET par matière, auto-save on blur
- Symbole mérité (emoji) distinct de l'appréciation globale (texte)
- PDF : layout 2 colonnes (gauche: notes+synthèse, droite: symbole+visa+signatures)
- Filename : bulletin_[élève]_[typeEval]_[trimestre].pdf
- Migration DB : 2 nouvelles colonnes sur report_cards
- 2 nouveaux endpoints backend pour persister le visa directeur

---
Task ID: 2026-08-08-maternelle-autogen-teacher-bulletins
Agent: main
Task: Two corrections — (1) Implement auto-generation of pedagogical analysis + director visa + date for kindergarten (maternelle) bulletins, mirroring what was done for primary. (2) Fix teacher UI: after director distributes bulletins (workflow step 2), nothing appears in teacher's "Examens et Notes" module — only evaluations are visible. Add a "Bulletins à signer" tab to teacher UI.

Work Log:
- Issue 1 (maternelle auto-gen):
  - In `apps/web-app/src/app/app/exams/bulletins/page.tsx` — `BulletinPage2` component:
    - Identified that the "Auto-générer les recommandations" button was hidden for maternelle (`{!isMaternelle && ...}`)
    - Refactored the "Analyse pédagogique" section header to include a flex layout with the auto-generate button visible for both maternelle and primaire (button label changes: "Auto-générer (analyse + visa + date)" for maternelle, "Auto-générer les recommandations" for primaire)
    - Added an "Auto-remplir" button to the "Visa du Directeur" card (visible for both maternelle and primaire) — lets the teacher/director regenerate the visa + current date quickly
  - In `apps/api-server/src/modules/exams/services/bulletins.service.ts` — `autoGenerateAnnotations`:
    - Added `qualitativeCode` to the Prisma select (was missing)
    - Added detection of qualitative mode (grades with TS/S/PS codes)
    - Added a `qualitativeMap` (TS=16, S=12, PS=8) for numeric conversion
    - Added maternelle-specific logic in a `if (isQualitativeMode)` branch:
      - Count TS/S/PS occurrences and compute percentages
      - Generate maternelle-specific `defautsMajeurs`, `qualitesRemarquables`, `analyseRecommandations` based on TS/S/PS distribution
    - Kept the existing logic for primaire/secondaire in the `else` branch
    - Added `tsCount`, `sCount`, `psCount`, `totalQualitative`, `qualitativeMode` to the returned stats
    - Director visa `Vu ce JJ/MM/AAAA` is unchanged — works for both modes

- Issue 2 (teacher UI missing bulletins tab):
  - Backend (`apps/api-server/src/modules/exams/bulletins.controller.ts` — `getTeacherBulletins`):
    - Refactored the endpoint to return not only a flat `bulletins` list (now with `classId` + `className` per bulletin) but also a `classes` summary array (classId, className, total, counts per status, currentStatus) — this lets the frontend render the list directly without N+1 calls to workflow-status
    - Added `studentEnrollments` include on the student select (filtered by teacherClassIds + academicYearId) so we can resolve the classId per bulletin
    - Kept teacher resolution via `Teacher` (by userId) → `TeacherClassAssignment` (classId) and the `Class.teacherClassAssignments.some(...)` fallback
    - Filtered final classes to those that have at least one TEACHER_DISTRIBUTED or TEACHER_SIGNED bulletin
  - Frontend (`apps/web-app/src/app/app/teacher/exams/page.tsx`):
    - Added imports for new icons (FileText, PenTool, Undo, Send, Shield, ShieldAlert, Sparkles) and `SignatureCanvas`
    - Added `tab` state ('evaluations' | 'bulletins') to `TeacherExamsPage`
    - Added `TeacherTabsHeader` component — pill-style tabs to switch between "Mes évaluations" and "Bulletins à signer" (with optional badge count)
    - Added `TeacherBulletinsToSign` component:
      - Period selector (loaded from `/api/settings/academic-years/{id}/periods`)
      - Calls `GET /institutional-exams/bulletins/teacher-bulletins?periodId=X` — uses the new `classes` summary directly
      - Anti-screenshot protection enabled (`useAntiScreenshot(true)` — same pattern as director bulletins page): disables right-click, Ctrl+P, Ctrl+S, PrintScreen, text selection
      - Anti-screenshot warning banner (amber, with ShieldAlert icon)
      - Lists `ClassBulletinCard` components — each shows the class name, workflow status chips, and action buttons ("Signer les bulletins" → opens signature modal, "Renvoyer au directeur" → confirm + POST /teacher-return)
      - Signature modal with `SignatureCanvas` (340×120) → POST /institutional-exams/bulletins/class/{classId}/teacher-sign
      - Empty state with "Retour à Mes évaluations" button
    - Added `ClassBulletinCard` and `WorkflowChip` helper components

Stage Summary:
- Backend `autoGenerateAnnotations` now handles maternelle (qualitative TS/S/PS) AND primaire/secondaire (numeric /20) with appropriate vocabulary ("enfant" vs "élève", "activités" vs "matières")
- The director visa "Vu ce JJ/MM/AAAA" is auto-generated the same way for both levels
- The teacher UI now has a complete "Bulletins à signer" tab that:
  - Lists only classes where the teacher is the titulaire AND has at least one TEACHER_DISTRIBUTED or TEACHER_SIGNED bulletin
  - Shows the full workflow state per class
  - Allows signing all bulletins of a class in one click (modal SignatureCanvas)
  - Allows returning bulletins to the director
  - Has anti-screenshot protection (clic droit, Ctrl+P, PrintScreen désactivés) matching the director's workflow
- The teacher-bulletins endpoint is now optimized (single call returns everything needed — no N+1 frontend calls to workflow-status)
- TypeScript check: 0 new errors introduced (60 pre-existing Prisma-related errors in bulletins.controller.ts unchanged)
- Files modified: 4 (apps/web-app/src/app/app/exams/bulletins/page.tsx, apps/web-app/src/app/app/teacher/exams/page.tsx, apps/api-server/src/modules/exams/bulletins.controller.ts, apps/api-server/src/modules/exams/services/bulletins.service.ts)

---
Task ID: 2026-08-09-anglophone-bulletin-pdf
Agent: main
Task: Implement the anglophone bulletin PDF format (2 pages, A5 portrait) — page 1 with pupil info + grades table (Subject | First CA /40 | Second CA /40 | Exam /60 | Total /100), page 2 with mark obtainable/obtained + class teacher comments + affective assessment (A/B/C checkboxes) + psychomotor skills (A/B/C checkboxes) + director's comments + signatures. The bulletin must consolidate all 3 evaluation components (FCA + SCA + EXAM) per subject.

Work Log:
- Backend (apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts):
  - Extended `BulletinPdfData` interface with new optional fields for the anglophone layout:
    - `scopeLang?: 'FR' | 'EN' | null` — triggers the EN layout branch
    - `studentAge`, `studentBirthDate`, `admissionNumber`, `sessionYear`
    - `termEndingDate`, `nextTermStartDate`, `numberOfSubjects`
    - Per-subject: `firstCA?`, `secondCA?`, `exam?`, `total?` (the 3 CA+Exam components)
  - Added branch in `generateBulletin()` — if `scopeLang === 'EN'`, calls the new `buildHtmlAnglophone()` method instead of the francophone `buildHtml()`
  - Implemented `buildHtmlAnglophone()` — generates the 2-page A5 portrait PDF:
    - Page 1: Official header (Republic of Benin + flag + ministry in English + school) + Report Card title + Term ending date + Pupil info table (Name, Age, Class, Position, Admission No, Session, Pupil's Average) + Grades table (Subject | First CA /40 | Second CA /40 | Exam /60 | Total /100) + Pupil's Average row
    - Page 2: Mark Obtainable / Mark Obtained / No in Class table + Class Teacher's Comments (auto-generated based on /100 average + next term start date) + Affective Assessment (10 skills × A/B/C checkboxes) + Psychomotor Skills (6 skills × A/B/C checkboxes) + Director's Comments (auto-generated based on /100 average) + Signatures (Class Teacher + Headmaster/Headmistress) + QR code
  - Added 2 helper methods:
    - `getEnTeacherComment(pupilAverage, nextTermStart)` — 7-level appreciation with next term start date included
    - `getEnDirectorComment(pupilAverage)` — 7-level principal's comment
  - Per-subject Total computation: `(firstCA + secondCA + exam) / 140 * 100` — converts the raw sum (max 140) to /100
  - Mark Obtainable = 100 × nb subjects; Mark Obtained = sum of subject /100 totals; Pupil's Average = mean of subject totals

- Backend Controller (apps/api-server/src/modules/exams/bulletins.controller.ts):
  - Extended `generateBulletinPdf` to also resolve `studentAge` (from `birthDate`) and `admissionNumber` from the Student record
  - Merged the resolved values into `pdfData` with `??` fallback (frontend value takes priority, then backend-resolved, then null)

- Frontend (apps/web-app/src/app/app/exams/bulletins/page.tsx):
  - Imported `enUS` locale from `date-fns/locale` for English date formatting
  - Extended `SubjectScore` interface with `firstCA?`, `secondCA?`, `exam?`, `total?` fields
  - Relaxed `loadBulletins` early-return guard for EN — `selectedEvalTypeId` is no longer required for EN (we load all 3 eval types)
  - Modified the evaluation filter: for EN, loads ALL evals with code FCA/SCA/EXAM for the selected period (consolidated view). For FR, keeps the existing single-eval-type behavior.
  - Modified the grade accumulation loop: for EN (and non-maternelle), each grade is stored in its corresponding slot (`firstCA`, `secondCA`, or `exam`) based on `evaluationType.code`. The `total` is recomputed after each insertion using the /100 conversion.
  - Modified the average computation: for EN, `generalAverage` = mean of subject totals (on /100). The `appreciationGlobale` uses the 7-level EN scale.
  - Modified `passingCount` for EN: threshold is `/50` (not `/10` like FR).
  - Updated `handleGeneratePdf` to send the new EN fields when `scopeLang === 'EN'`:
    - `scopeLang`, `sessionYear`, `termEndingDate`, `nextTermStartDate`, `numberOfSubjects`
    - Per-subject: `firstCA`, `secondCA`, `exam`, `total`
    - Term ending date derived from the selected period's `endDate` (formatted in English: "Friday, April 11, 2025")
    - Next term start date derived from the next period's `startDate` (sorted chronologically)
  - Hid the "Évaluation" filter dropdown for EN — replaced with a static info badge "Report Card (First CA + Second CA + Examination)" since the EN bulletin is always consolidated
  - Added new `BulletinAnglophonePage1` component for the on-screen preview:
    - Pupil info card (Name, Position, Admission No, No in Class, Pupil's Average)
    - 5-column grades table (Subject | First CA /40 | Second CA /40 | Exam /60 | Total /100)
    - Mark Obtainable / Mark Obtained summary cards
    - Overall Appreciation badge (7-level EN scale)
  - Wired the new component in the bulletin preview dispatcher: if `scopeLang === 'EN'`, renders `BulletinAnglophonePage1` instead of `BulletinPrimairePage1`

Stage Summary:
- The anglophone bulletin is now a 2-page A5 portrait PDF that consolidates the 3 evaluation components (FCA + SCA + EXAM) per subject
- The PDF is auto-generated by Puppeteer on the backend with English labels throughout (Republic of Benin, ministry, Report Card, Subject, First CA, etc.)
- Page 2 includes auto-generated teacher comments (with next term start date) and director comments, both based on the pupil's /100 average using the 7-level EN scale (Outstanding/Very Good/Good/Fair/Pass/Weak/Very Weak)
- Affective assessment (10 skills: Punctuality, Politeness, Honesty, etc.) and Psychomotor skills (6: Handwriting, Drawing, etc.) sections include A/B/C checkboxes (Unicode ☐) for paper-based filling
- On-screen preview now shows the 3-component grades table so users see the new layout before generating the PDF
- The eval type filter is hidden for EN since the bulletin is always consolidated
- TypeScript check: 0 new errors introduced (23 pre-existing Prisma-related errors in bulletins.controller.ts unchanged; frontend type-check passes clean)
- Files modified: 3 (apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts, apps/api-server/src/modules/exams/bulletins.controller.ts, apps/web-app/src/app/app/exams/bulletins/page.tsx)

---
Task ID: 2026-08-09-anglophone-page2-editable + saisiemaster-mobile-sync
Agent: main
Task: Two workstreams in one push.
  (1) Anglophone bulletin — Page 2 with auto-generated teacher/director comments + Affective/Psychomotor skills (auto-filled but editable), 3 signatures (Teacher + Parent + Director) matching the FR pattern.
  (2) Saisie Master mobile sync bug — when saving grades on smartphone, data stays in localStorage only; not synced to Neon DB; not visible on computer.

Work Log:

=== (1) Anglophone Bulletin — Page 2 editable ===

Backend:

- Prisma schema (apps/api-server/prisma/schema.prisma):
  - Added 4 new fields to ReportCard model: enTeacherComment, enDirectorComment (String?), enAffectiveAssessment, enPsychomotorAssessment (String? — JSON-serialized {skill: 'A'|'B'|'C'} maps)
  - Migration: prisma db push required to add the columns

- bulletins.service.ts:
  - Extended `saveAnnotations()` data type with 4 new optional EN fields
  - Extended `getAnnotations()` select to return the 4 new fields
  - All fields nullable (no breaking change)

- bulletins.controller.ts:
  - Extended `saveAnnotations` body type to accept the 4 new EN fields

- bulletin-pdf.service.ts:
  - Extended BulletinPdfData interface with: enTeacherComment, enDirectorComment, enAffectiveAssessment, enPsychomotorAssessment
  - Updated buildHtmlAnglophone():
    * Teacher/Director comments: use the user-edited value if non-empty, fallback to auto-generated getEnTeacherComment()/getEnDirectorComment() based on /100 average
    * Affective/Psychomotor checkboxes: parse JSON from DB; if empty/invalid, auto-generate via autoFillAffective() / autoFillPsychomotor()
    * Checkbox rendering: ☑ (filled) for the user-selected level A/B/C; ☐ for the others; color-coded (green/blue/amber)
    * Page 2 signatures: now 3 columns (Class Teacher + Parent/Guardian + Headmistress/Headmaster) matching the FR maternelle/primaire pattern
  - Added 2 helper methods:
    * autoFillAffective(pupilAverage): fills 10 standardized skills with A/B/C based on /100 average. Soft skills (Honesty, Self-control, Respect, Cooperation) get one level higher than academic baseline.
    * autoFillPsychomotor(pupilAverage): fills 6 standardized skills similarly.

Frontend (apps/web-app/src/app/app/exams/bulletins/page.tsx):

- Added BulletinAnglophonePage2 component (mirror of francophone BulletinPage2 but adapted for EN layout):
  - Mark obtainable/obtained/No in class cards (auto-calculated, non-editable)
  - Class Teacher's Comments: textarea auto-filled from getAutoTeacherComment() (7-level EN scale based on /100 average, includes next term start date); editable; auto-save on blur
  - Affective Assessment: 10 standardized skills × A/B/C radio buttons (auto-filled from autoFillAffectiveMap(); editable per skill; auto-save on change)
  - Psychomotor Skills: 6 standardized skills × A/B/C radio buttons (same pattern)
  - Director's Comments: textarea auto-filled from getAutoDirectorComment(); editable; auto-save on blur
  - 3 signatures: Class Teacher + Parent/Guardian + Headmistress/Headmaster — each with SignatureCanvas (when not yet signed) or rendered signature image (when signed from workflow)
  - "Auto-fill" button to regenerate all 4 fields (comments + Affective + Psychomotor) based on current /100 average
  - "✓ Saved" indicator that appears for 2s after each auto-save
  - Loads existing annotations from backend on mount; falls back to auto-generation if no stored values

- Wired the new component in the page dispatcher: when scopeLang === 'EN' && !isMaternelle && page === 2 → render BulletinAnglophonePage2 (instead of BulletinPage2)

- Updated handleGeneratePdf payload to send the 4 EN annotation fields (loaded from backend annotations endpoint) to the PDF generator

- Added nextTermStartDateForCard (useMemo): computes the next period's start date (formatted in English: "Monday, May 5, 2025") and passes it down to BulletinAnglophonePage2 for the teacher comment

=== (2) Saisie Master Mobile Sync Bug Fix ===

Investigation:
- The auto-save useEffect in editor-page.tsx was only triggering backend save when BOTH `token && prospect` were set. If the prospect field was null (which can happen in some flows), backend save was silently skipped — but localStorage save always succeeded.
- Even when backend save failed (network error, etc.), the status was still set to "saved" — lying to the user.
- The beforeunload handler only saved to localStorage, NOT to the backend.
- The `scheduleBackendSync()` in store.ts only synced the ACTIVE class — when the user switched class, the previous class's notes were never synced.
- The ResumeBanner early-returned if `!prospect || !token` — same issue.

Fixes applied:

1. editor-page.tsx — auto-save (every 10s):
   - Changed condition from `if (token && prospect)` to `if (token)` (prospect is just metadata, not auth)
   - Replaced raw `fetch()` with `saveSession()` from api.ts (handles cross-domain routing from saisiemaster.academiahelm.com → www.academiahelm.com)
   - Replaced inline payload building with `classDataToSessionPayload()` (DRY)
   - Added `saveAllClassesToBackend()` helper that syncs ALL classes (not just the active one)
   - Honest status: `saved` only if backend accepted; new `local-only` status if backend failed/skipped (shown in red with warning text)
   - New ActionBar status: "⚠ Local uniquement — non synchronisé (connexion requise)" when backend didn't accept

2. editor-page.tsx — manual Save button:
   - Same fixes: uses `saveAllClassesToBackend()`, honest status, toast error if backend fails
   - User now gets clear feedback: success toast "Modifications enregistrées" only if backend accepted; error toast "Sauvegarde locale uniquement" if not

3. editor-page.tsx — beforeunload handler:
   - Now attempts a backend save via `navigator.sendBeacon()` (fire-and-forget, works even after tab close)
   - Includes `_beaconToken` in body (sendBeacon can't set custom headers)
   - Fallback to `fetch(..., { keepalive: true })` if sendBeacon fails (data > 64KB)
   - localStorage save remains the synchronous first step

4. store.ts — `scheduleBackendSync()`:
   - Now syncs ALL classes via `Promise.all()` (was only the active class before)
   - Removed the `activeClass` variable — no longer used

5. resume-banner.tsx — `useRestoredInfo()`:
   - Changed early-return from `if (!prospect || !token)` to `if (!token)` (prospect is optional metadata)
   - User now sees the resume banner on computer if they have a token (even if prospect metadata is missing)

6. BFF route (apps/web-app/src/app/api/saisiemaster/sessions/route.ts):
   - POST endpoint now accepts the auth token from the request body under `_beaconToken` (fallback when sendBeacon can't set Authorization header)
   - Strips `_beaconToken` and `_beacon` fields before forwarding to backend NestJS
   - Backward-compatible: if Authorization header is present, it's still used

Stage Summary:

- Anglophone bulletin Page 2 is now fully editable: teacher comments, director comments, Affective assessment (10 skills × A/B/C), Psychomotor skills (6 skills × A/B/C) are all auto-generated from /100 average using the 7-level EN scale, but the user can override any of them. Changes are auto-saved on blur via the existing annotations endpoint.
- The 3-signature section (Class Teacher + Parent + Headmaster) matches the francophone maternelle/primaire pattern.
- The auto-fill button regenerates everything based on current average.
- Saisie Master mobile sync is now honest and reliable:
  - Backend save is triggered whenever the user has a token (no longer requires prospect metadata)
  - The status indicator no longer lies — it clearly shows "saved" only on success, "local-only" on failure
  - Tab close triggers a best-effort sendBeacon + fetch keepalive to the backend (with token in body since sendBeacon can't set headers)
  - scheduleBackendSync now syncs ALL classes, not just the active one — so switching class doesn't lose unsaved data
  - On computer, the user sees their mobile work via restoreFromBackend() (no longer blocked by missing prospect metadata)
  - Cross-domain routing handled by saveSession() (saisiemaster.academiahelm.com → www.academiahelm.com)
- TypeScript check: 0 new errors (frontend passes clean; backend has 71 pre-existing Prisma-related errors, same count as before my changes)
- Files modified: 6 (apps/api-server/prisma/schema.prisma, apps/api-server/src/modules/exams/services/bulletin-pdf.service.ts, apps/api-server/src/modules/exams/services/bulletins.service.ts, apps/api-server/src/modules/exams/bulletins.controller.ts, apps/web-app/src/app/app/exams/bulletins/page.tsx, apps/web-app/src/components/saisiemaster/editor/editor-page.tsx, apps/web-app/src/components/saisiemaster/landing/resume-banner.tsx, apps/web-app/src/lib/saisiemaster/store.ts, apps/web-app/src/app/api/saisiemaster/sessions/route.ts)

⚠️ Migration required: `prisma db push` to add the 4 new fields to the report_cards table.

---
Task ID: 2026-08-09-cahier-journal-fiches-integration
Agent: main
Task: Module Pédagogie → Espace Pédagogique → onglet "Cahier Journal" renommé "Cahier Journal & Fiches Pédagogiques". Fusionner les fiches pédagogiques avec le cahier journal : après enregistrement du cahier journal hebdo, bascule automatique vers sous-onglet Fiches qui liste les matières planifiées par jour et permet de préparer la fiche pédagogique de chaque matière. Hiérarchie : CahierJournal(week) → Jour → Matière → Fiche.

Work Log:

=== Backend : Relation structurelle CahierJournal ↔ PrimaryPedagogicalFiche ===

- Prisma schema (apps/api-server/prisma/schema.prisma) :
  - Sur `CahierJournal` : ajout de la relation inverse `fiches PrimaryPedagogicalFiche[]`
  - Sur `PrimaryPedagogicalFiche` : ajout de `cahierJournalId String?` + relation `cahierJournal CahierJournal? @relation(...)` + index `@@index([cahierJournalId])`
  - Migration: `npx prisma db push` à exécuter par l'utilisateur pour ajouter la colonne

- Service (apps/api-server/src/pedagogy/pedagogical-space.service.ts) :
  - Ajout de 3 nouvelles méthodes :
    * `getFichesForCahierJournal(tenantId, journalId)` : retourne { fiches, parJour, matieresPlanifiees, stats }
      - Charge le cahier journal + ses fiches (par `cahierJournalId` structurel)
      - Fallback par plage de dates pour les fiches non rattachées (rétro-compatibilité)
      - Extrait les matières planifiées depuis `entries` JSON (parcourt entries.lundi.francais, entries.lundi.maths, etc.)
      - Pour chaque matière planifiée, vérifie si une fiche existe → badge "préparée" / "à préparer"
      - Stats : totalFiches, totalMatieresPlanifiees, totalFichesPreparees, totalFichesManquantes, toutesFichesPreparees
    * `linkFicheToCahierJournal(tenantId, journalId, ficheId)` : rattache manuellement une fiche existante à un cahier journal
    * `mapMatiereKeyToSheetType(matiereKey)` : devine le sheetType depuis le nom de la matière (francais→FRANCAIS, math→MATH, science/eps→EST, histoire/morale→ES, chant/dessin→EA)
  - Ajout de `cahierJournalId` dans les fieldMap des méthodes `createPedagogicalFiche` et `updatePedagogicalFiche`
  - Modification de `submitCahierJournalWithFiches` : au moment de soumettre chaque fiche (DRAFT → SUBMITTED), on écrit aussi `cahierJournalId = journalId` sur la fiche — verrou structurel

- Controller (apps/api-server/src/pedagogy/pedagogical-space.controller.ts) :
  - Ajout de `GET /pedagogy-space/cahier-journal/:id/fiches` → appelle `getFichesForCahierJournal`
  - Ajout de `POST /pedagogy-space/cahier-journal/:id/link-fiche` (body: `{ ficheId }`) → appelle `linkFicheToCahierJournal`

=== Frontend : Container unifié CahierJournalFichesContainer ===

- Nouveau composant (apps/web-app/src/components/pedagogy/production/CahierJournalFichesContainer.tsx, ~360 lignes) :
  - Gère 2 sous-onglets : "Cahier Journal" ↔ "Fiches Pédagogiques"
  - État partagé : currentJournalId (résultat du save/submit du cahier journal)
  - `onJournalSaved(journalId, meta)` callback → bascule auto vers sous-onglet Fiches + toast
  - `onJournalSubmitted(journalId, meta)` callback → même chose après soumission
  - En-tête avec : badge "X fiches manquantes" (orange) ou "X fiches" (vert), semaine courante, classe, statut
  - Composant `FichesBadge` : fetch sur `GET /cahier-journal/:id/fiches` pour afficher le compteur
  - Composant `StatusBadge` : DRAFT / SUBMITTED / VALIDATED / REJECTED
  - Composant `FichesAPreparer` :
    - Bandeau récapitulatif (vert si toutes préparées, orange sinon)
    - Liste par jour (Lundi → Vendredi) avec matières planifiées + badges ✅/⚠
    - Pour chaque matière non préparée : bouton "+ Préparer" qui appelle `onPrepareFiche(day, matiere, sheetType?)`
    - Pour chaque matière déjà préparée : bouton "Voir"
  - `handlePrepareFicheFor(day, matiere, sheetType?)` : bascule vers sous-onglet Fiches avec un payload initial

- Modification de PedagogicalSpaceWorkspace.tsx :
  - Renommage de l'onglet `cahier-journal` : "Cahier Journal" → "Cahier Journal & Fiches Pédagogiques"
  - Suppression de l'onglet séparé `fiches` (fusionné dans cahier-journal)
  - Le rendu de `cahier-journal` utilise désormais `CahierJournalFichesContainer` au lieu de `CahierJournalTab` directement

- Modification de CahierJournalTab.tsx :
  - Ajout de 2 props optionnelles : `onJournalSaved?` et `onJournalSubmitted?`
  - Dans `handleSave()` : après le PUT réussi, appel de `onJournalSaved?.(journal.id, meta)` avec weekStartDate, weekEndDate, className, status
  - Dans `confirmSubmitWithFiches()` : après le POST réussi, appel de `onJournalSubmitted?.(journal.id, meta)` avec status: 'SUBMITTED'
  - Backward-compatible : si les callbacks ne sont pas fournis, le composant fonctionne comme avant

- Modification de PedagogicalSheetsTab.tsx :
  - Ajout de 4 nouvelles props optionnelles : `cahierJournalId?`, `initialLessonDay?`, `initialSheetType?`, `initialMatiere?`
  - Dans `handleCreateOrUpdate()` : ajout de `cahierJournalId: cahierJournalId || undefined` dans le body POST
  - Ajout d'un `useEffect` qui s'exécute au mount (ou quand les props initiales changent) :
    - Si `initialLessonDay` est fourni : calcule la date du jour correspondant dans la semaine courante (lundi=1, ..., vendredi=5)
    - Si `initialSheetType` est fourni : pré-remplit le sheetType du formulaire
    - Si `initialMatiere` est fourni : pré-remplit `cours` et `titre` avec le nom de la matière
    - Ouvre automatiquement le formulaire (`setShowForm(true)`)
  - Le formulaire de fiche pédagogique s'ouvre pré-rempli quand l'utilisateur clique sur "Préparer la fiche" dans le panneau FichesAPreparer

=== Flux utilisateur final ===

1. Enseignant ouvre Espace Pédagogique → "Cahier Journal & Fiches Pédagogiques"
2. Sous-onglet "Cahier Journal" → grille hebdo (5 jours × matières dynamiques)
3. Enseignant remplit les cellules : lundi=français, lundi=maths, mardi=...
4. Clic "Enregistrer" → PUT réussi → bascule auto vers sous-onglet "Fiches Pédagogiques"
5. Sous-onglet Fiches affiche :
   - Bandeau "X fiches à préparer"
   - Cartes par jour : Lundi → Français (⚠ à préparer) + Maths (⚠ à préparer) + ...
   - Pour chaque matière : bouton "+ Préparer"
6. Enseignant clique sur "+ Préparer" pour Français Lundi :
   - Formulaire fiche pédagogique s'ouvre automatiquement
   - Pré-rempli : sheetType=FRANCAIS, lessonDate=lundi de la semaine courante, cours=Français
   - cahierJournalId stocké dans le state → sera envoyé au backend à la création
7. Enseignant remplit la fiche (objectifs, déroulement, etc.) + clic "Créer la fiche"
8. La fiche est créée en DB avec `cahierJournalId` renseigné
9. La liste des matières planifiées se met à jour → le badge Français passe de ⚠ à ✅
10. Quand toutes les matières planifiées ont leur fiche → bandeau vert "Toutes les fiches sont préparées"
11. Clic "Soumettre" sur le cahier journal → POST submit-with-fiches → soumet cahier + fiches en une transaction

=== Hiérarchie de persistance ===

- CahierJournal (1) → Fiches pédagogiques (N)
- Chaque fiche a désormais un `cahierJournalId` (relation structurelle en DB)
- Quand on consulte le cahier journal d'une autre semaine, le endpoint `GET /cahier-journal/:id/fiches` ramène SES fiches (et uniquement les siennes)
- Fallback par plage de dates pour les fiches créées avant l'ajout du champ (rétro-compatibilité)

Stage Summary:

- L'onglet "Cahier Journal" a été renommé "Cahier Journal & Fiches Pédagogiques" et contient 2 sous-onglets
- L'onglet "Fiches Pédagogiques" séparé a été supprimé (fusionné dans le cahier journal)
- Après enregistrement du cahier journal, bascule automatique vers le sous-onglet Fiches qui affiche la liste des matières planifiées groupées par jour
- Pour chaque matière planifiée sans fiche : bouton "+ Préparer" qui ouvre le formulaire pré-rempli (sheetType deviné depuis le nom de la matière, lessonDate calculée depuis le jour, cahierJournalId stocké)
- Relation structurelle `cahierJournalId` en DB entre PrimaryPedagogicalFiche et CahierJournal (avec fallback par date pour rétro-compatibilité)
- 3 nouveaux endpoints backend : GET /cahier-journal/:id/fiches, POST /cahier-journal/:id/link-fiche, + modification de createPedagogicalFiche/updatePedagogicalFiche/submitCahierJournalWithFiches pour gérer cahierJournalId
- Frontend type-check : 0 erreurs (passes clean)
- Backend : aucune nouvelle erreur (les duplicates préexistants dans pedagogical-space.service.ts sont inchangés)
- Fichiers modifiés : 6 + 1 nouveau fichier (CahierJournalFichesContainer.tsx)
- Migration requise : `npx prisma db push` pour ajouter la colonne `cahierJournalId` à `primary_pedagogical_fiches`
