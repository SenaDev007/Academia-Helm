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
