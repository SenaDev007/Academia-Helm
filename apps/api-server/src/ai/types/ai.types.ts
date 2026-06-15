/**
 * ============================================================================
 * AI TYPES — Academia Helm Enterprise AI Architecture
 * ============================================================================
 * Types partagés pour l'écosystème IA : ORION, SARA, ATLAS
 * Conforme à la spécification v2.0
 */

// ─── AGENT TYPES ──────────────────────────────────────────────────────────

export type AIAgentName = 'ORION' | 'SARA' | 'ATLAS';

export type AIAgentRole =
  | 'ANALYSTE'     // ORION
  | 'ASSISTANTE'   // SARA
  | 'EXECUTANT';   // ATLAS

export interface AIAgentConfig {
  name: AIAgentName;
  role: AIAgentRole;
  description: string;
  isReadOnly: boolean;
  systemPromptTemplate: string;
  defaultModel: string;
  fallbackModel: string;
  defaultTemperature: number;
  maxTokens: number;
  requiredPermissions: string[];
}

// ─── AI REQUEST / RESPONSE ────────────────────────────────────────────────

export interface AIRequest {
  agent: AIAgentName;
  userId: string;
  tenantId: string;
  schoolId?: string;
  message: string;
  sessionId?: string;
  context?: Record<string, unknown>;
  tools?: string[];
  stream?: boolean;
}

export interface AIResponse {
  agent: AIAgentName;
  content: string;
  isPlaceholder: boolean;
  toolsUsed?: ToolCallResult[];
  sessionId?: string;
  suggestedActions?: AISuggestedAction[];
  confidence?: number;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  executionMs: number;
}

export interface AISuggestedAction {
  type: 'ORION_ANALYSIS' | 'ATLAS_WORKFLOW' | 'ATLAS_DOCUMENT' | 'NAVIGATION' | 'CONFIRMATION';
  label: string;
  description: string;
  parameters?: Record<string, unknown>;
  requiresConfirmation: boolean;
}

// ─── MCP CONTEXT ──────────────────────────────────────────────────────────

export interface MCPContext {
  // School Context
  schoolId: string;
  schoolName: string;
  currentAcademicYear: string;
  currentPeriod: string;
  subscriptionPlan: string;
  enabledModules: string[];
  timezone: string;
  locale: string;

  // User Context
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userPermissions: string[];
  assignedClasses?: string[];
  childrenIds?: string[];
  studentId?: string;
  classId?: string;

  // Permission Context
  canViewAllStudents: boolean;
  canViewFinance: boolean;
  canViewHR: boolean;
  canTriggerAtlas: boolean;
  canViewOrion: boolean;

  // Session Context
  sessionId?: string;
  conversationHistory?: ConversationTurn[];
  currentContext?: {
    lastStudentId?: string;
    lastClassId?: string;
    lastPeriod?: string;
    lastTopic?: string;
  };
}

export interface MCPRequest {
  userId: string;
  tenantId: string;
  schoolId?: string;
  sessionId?: string;
}

// ─── TOOL CALLING ─────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  version: string;
  agent: AIAgentName | 'ALL';
  category: 'STUDENT' | 'ACADEMIC' | 'FINANCE' | 'HR' | 'COMMUNICATION' | 'AUDIT' | 'ANALYTICS' | 'DOCUMENT' | 'WORKFLOW' | 'KNOWLEDGE';
  inputSchema: Record<string, unknown>;
  requiredPermissions: string[];
  requiresTenant: boolean;
  isReadOnly: boolean;
  requiresConfirmation: boolean;
  execute: (params: Record<string, unknown>, context: MCPContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  metadata?: {
    queryTime: number;
    rowCount?: number;
    source: string;
  };
}

export interface ToolCallResult {
  toolName: string;
  parameters: Record<string, unknown>;
  result: ToolResult;
  executionMs: number;
}

// ─── CONVERSATION ─────────────────────────────────────────────────────────

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCallResult[];
  metadata?: Record<string, unknown>;
}

export type ConversationState =
  | 'GREETING'
  | 'INTENT_DETECTION'
  | 'SLOT_FILLING'
  | 'TOOL_CALLING'
  | 'ORION_DELEGATION'
  | 'ATLAS_DELEGATION'
  | 'RESPONSE_GENERATION'
  | 'CONFIRMATION_REQUIRED'
  | 'COMPLETED'
  | 'ERROR';

// ─── SARA INTENTS ─────────────────────────────────────────────────────────

export type SaraIntent =
  // Requêtes de données
  | 'QUERY_STUDENT_GRADES'
  | 'QUERY_STUDENT_ATTENDANCE'
  | 'QUERY_FINANCE_UNPAID'
  | 'QUERY_TEACHER_SCHEDULE'
  | 'QUERY_ORION_ANALYSIS'
  | 'QUERY_NOTIFICATIONS'
  // Actions pédagogiques
  | 'GENERATE_EXERCISES'
  | 'CREATE_EVALUATION'
  | 'SEARCH_PEDAGOGY_LIBRARY'
  // Actions système
  | 'GENERATE_DOCUMENT'
  | 'SEND_NOTIFICATION'
  | 'TRIGGER_WORKFLOW'
  // Support
  | 'HELP_REQUEST'
  | 'FEATURE_EXPLANATION'
  | 'PROCEDURE_QUERY'
  | 'NAVIGATION_HELP'
  | 'ONBOARDING_GUIDE'
  // Inconnu
  | 'UNKNOWN';

export type SaraRole =
  | 'DIRECTION'
  | 'ENSEIGNANT'
  | 'COMPTABLE'
  | 'PARENT'
  | 'ELEVE'
  | 'SURVEILLANT'
  | 'PROMOTEUR';

// ─── ORION TYPES ──────────────────────────────────────────────────────────

export type OrionDomain = 'ACADEMIC' | 'FINANCE' | 'HR' | 'COMPLIANCE' | 'SECURITY';

export type OrionAlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ORIONScore {
  schoolId: string;
  calculatedAt: Date;
  globalScore: number; // 0-100
  subScores: {
    academic: number;   // pondération : 35%
    finance: number;    // pondération : 30%
    hr: number;         // pondération : 15%
    compliance: number; // pondération : 10%
    security: number;   // pondération : 10%
  };
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  topAlerts: ORIONAlertItem[];
  topRecommendations: ORIONRecommendation[];
}

export interface ORIONAlertItem {
  id: string;
  domain: OrionDomain;
  priority: OrionAlertPriority;
  title: string;
  description: string;
  impact: string;
  suggestedAction: string;
  canAtlasExecute: boolean;
  createdAt: Date;
}

export interface ORIONRecommendation {
  id: string;
  domain: OrionDomain;
  priority: OrionAlertPriority;
  title: string;
  description: string;
  impact: string;
  suggestedAction: string;
  canAtlasExecute: boolean;
  atlasWorkflowId?: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'DONE' | 'DISMISSED';
}

// ─── ATLAS TYPES ──────────────────────────────────────────────────────────

export type AtlasDocumentType =
  | 'ATTESTATION_SCOLARITE'
  | 'CERTIFICAT_FREQUENTATION'
  | 'BULLETIN_TRIMESTRIEL'
  | 'RECU_PAIEMENT'
  | 'CONTRAT_SCOLARITE'
  | 'CONVOCATION_PARENT'
  | 'FICHE_ELEVE'
  | 'RAPPORT_MENSUEL'
  | 'RAPPORT_FINANCIER'
  | 'ATTESTATION_TRAVAIL'
  | 'CONTRAT_ENSEIGNANT'
  | 'LETTRE_RELANCE';

export type AtlasWorkflowType =
  | 'BULLETIN_GENERATION_CAMPAIGN'
  | 'PAYMENT_REMINDER_CAMPAIGN'
  | 'MONTHLY_REPORT_GENERATION'
  | 'NEW_STUDENT_ENROLLMENT_FLOW';

export type AtlasNotificationType =
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_RECEIPT'
  | 'GRADE_PUBLISHED'
  | 'BULLETIN_PUBLISHED'
  | 'ABSENCE_ALERT'
  | 'DOCUMENT_READY'
  | 'ORION_ALERT'
  | 'ANNOUNCEMENT'
  | 'EVENT_REMINDER'
  | 'EXAM_SCHEDULE';

export interface AtlasWorkflowStep {
  name: string;
  action: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface AtlasWorkflowExecution {
  id: string;
  workflowType: AtlasWorkflowType;
  tenantId: string;
  triggeredBy: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  steps: AtlasWorkflowStep[];
  requiresConfirmation: boolean;
  confirmedAt?: Date;
  startedAt: Date;
  completedAt?: Date;
  estimatedDuration: string;
  result?: Record<string, unknown>;
}

// ─── AI AUDIT ─────────────────────────────────────────────────────────────

export interface AIAuditEntry {
  agent: AIAgentName;
  userId: string;
  tenantId: string;
  operation: string;
  input: string;
  output?: string;
  toolsUsed?: string[];
  model?: string;
  tokensUsed?: number;
  executionMs: number;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

// ─── AI COST CONTROL ──────────────────────────────────────────────────────

export interface AICostEntry {
  agent: AIAgentName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number; // USD
  tenantId: string;
  userId: string;
  operation: string;
  timestamp: Date;
}

export interface AIBudgetStatus {
  tenantId: string;
  monthlyBudget: number;
  currentSpend: number;
  remaining: number;
  percentUsed: number;
  plan: string;
}

// ─── EVENT BUS ────────────────────────────────────────────────────────────

export type AcademiaHelmEventType =
  | 'STUDENT_CREATED'
  | 'STUDENT_ENROLLED'
  | 'GRADE_PUBLISHED'
  | 'BULLETIN_GENERATED'
  | 'PERIOD_CLOSED'
  | 'ATTENDANCE_RECORDED'
  | 'TEACHER_ABSENT'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_OVERDUE'
  | 'INVOICE_GENERATED'
  | 'ORION_ALERT_FIRED'
  | 'ATLAS_WORKFLOW_COMPLETED';

export interface AcademiaHelmEvent {
  type: AcademiaHelmEventType;
  tenantId: string;
  schoolId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}
