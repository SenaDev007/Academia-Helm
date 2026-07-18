/**
 * ============================================================================
 * SAISIEMASTER — Frontend API client
 * ============================================================================
 *
 * Client TypeScript pour les endpoints BFF /api/saisiemaster/*.
 *
 * Toutes les requêtes utilisent des chemins RELATIFS (/api/saisiemaster/...)
 * pour passer par les routes BFF Next.js (qui elles-mêmes proxyfient vers
 * le backend NestJS).
 *
 * Le token SaisieMaster est stocké dans localStorage sous la clé
 * `saisiemaster:token` et le prospect sous `saisiemaster:prospect`.
 *
 * Auth: email + mot de passe. Le mot de passe est hashé (bcrypt) côté backend.
 * Pour les prospects créés avant l'ajout du mot de passe, le login peut
 * toujours se faire en email-only (fallback de rétro-compatibilité).
 * ============================================================================
 */

import type { ClassData } from "./types";

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

export const STORAGE_KEYS = {
  token: "saisiemaster:token",
  prospect: "saisiemaster:prospect",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Prospect {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  phoneNumber: string | null;
  city: string | null;
  status: string;
  signupDate: string;
  lastLoginAt: string | null;
  loginCount: number;
  classesCreated: number;
  gradesEntered: number;
  exportsCount: number;
}

export interface ProspectProfile extends Prospect {
  sessions: ProspectSession[];
}

export interface ProspectSession {
  id: string;
  prospectId?: string;
  className: string;
  schoolYear: string | null;
  academicYear: string | null;
  studentCount: number;
  subjectCount: number;
  gradesData: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  schoolName?: string;
  phoneNumber?: string | null;
  city?: string | null;
}

export interface SignupPayload {
  email: string;
  firstName: string;
  lastName: string;
  schoolName: string;
  phoneNumber?: string;
  city?: string;
  /** Mot de passe en clair (min 6 caractères). Hashé côté backend. */
  password?: string;
}

export interface LoginPayload {
  email: string;
  /** Mot de passe en clair. Requis si le compte en possède un. */
  password?: string;
}

export interface AuthResponse {
  prospect: Prospect;
  token: string;
}

export interface SaveSessionPayload {
  className: string;
  schoolYear?: string;
  academicYear?: string;
  studentCount: number;
  subjectCount: number;
  gradesData: unknown;
}

export type ActivityType = "login" | "grade_entered" | "export";

// ---------------------------------------------------------------------------
// Storage helpers (browser-only)
// ---------------------------------------------------------------------------

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

export function getStoredProspect(): Prospect | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.prospect);
    if (!raw) return null;
    return JSON.parse(raw) as Prospect;
  } catch {
    return null;
  }
}

export function setAuth(prospect: Prospect, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.token, token);
    window.localStorage.setItem(STORAGE_KEYS.prospect, JSON.stringify(prospect));
  } catch (e) {
    console.warn("[saisiemaster] setAuth failed:", e);
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEYS.token);
    window.localStorage.removeItem(STORAGE_KEYS.prospect);
  } catch (e) {
    console.warn("[saisiemaster] clearAuth failed:", e);
  }
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  // ⭐ Fix: sur le sous-domaine saisiemaster.academiahelm.com, les routes
  // /api/* ne sont pas accessibles (Vercel ne les sert pas correctement).
  // On utilise une URL absolue vers le domaine principal pour les requêtes API.
  let apiUrl = path;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Si on est sur saisiemaster.academiahelm.com, rediriger les appels API
    // vers www.academiahelm.com (qui a les routes BFF configurées)
    if (host.startsWith("saisiemaster.")) {
      apiUrl = `https://www.academiahelm.com${path}`;
    }
  }

  const response = await fetch(apiUrl, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(30000),
  });

  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ApiError(
        "Réponse invalide du serveur",
        502,
        raw.slice(0, 200),
      );
    }
  }

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ??
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ??
      `HTTP ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>("/api/saisiemaster/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAuth(result.prospect, result.token);
  return result;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const result = await apiFetch<AuthResponse>("/api/saisiemaster/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  setAuth(result.prospect, result.token);
  return result;
}

export async function getProfile(): Promise<ProspectProfile> {
  return apiFetch<ProspectProfile>("/api/saisiemaster/profile", {
    method: "GET",
    headers: authHeaders(),
  });
}

/**
 * Update the prospect's profile (firstName, lastName, schoolName,
 * phoneNumber, city). Email cannot be changed.
 * Returns the updated Prospect (without sessions).
 */
export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<Prospect> {
  return apiFetch<Prospect>("/api/saisiemaster/profile", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getSessions(): Promise<ProspectSession[]> {
  const result = await apiFetch<ProspectSession[] | { sessions?: ProspectSession[] }>(
    "/api/saisiemaster/sessions",
    { method: "GET", headers: authHeaders() },
  );
  // Backend returns an array directly
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.sessions)) return result.sessions;
  return [];
}

export async function saveSession(
  payload: SaveSessionPayload,
): Promise<ProspectSession> {
  return apiFetch<ProspectSession>("/api/saisiemaster/sessions", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteSession(sessionId: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(
    `/api/saisiemaster/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "DELETE",
      headers: authHeaders(),
    },
  );
}

export async function trackActivity(type: ActivityType): Promise<void> {
  try {
    await apiFetch("/api/saisiemaster/track", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ type }),
    });
  } catch (e) {
    // Tracking is best-effort — don't block the user flow on it.
    console.warn("[saisiemaster] trackActivity failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Convenience: convert a ClassData (from the editor) to a SaveSessionPayload
// ---------------------------------------------------------------------------

export function classDataToSessionPayload(
  cls: ClassData,
): SaveSessionPayload {
  return {
    className: cls.className || cls.sheetName,
    schoolYear: cls.academicYear || undefined,
    academicYear: cls.academicYear || undefined,
    studentCount: cls.students.length,
    subjectCount: cls.subjects.length,
    // The full grades data — notes indexed by [studentId][subjectId]
    gradesData: {
      sheetName: cls.sheetName,
      className: cls.className,
      schoolName: cls.schoolName,
      academicYear: cls.academicYear,
      sourceFileName: cls.sourceFileName,
      students: cls.students,
      subjects: cls.subjects,
      notes: cls.notes,
    },
  };
}

/**
 * Reverse: convert a backend ProspectSession.gradesData back to a ClassData.
 */
export function sessionToClassData(session: ProspectSession): ClassData | null {
  if (!session?.gradesData) return null;
  const data = session.gradesData as Partial<ClassData> & {
    students?: ClassData["students"];
    subjects?: ClassData["subjects"];
    notes?: ClassData["notes"];
  };
  if (!data.students || !data.subjects) return null;
  return {
    sheetName: data.sheetName ?? session.className,
    className: data.className ?? session.className,
    schoolName: data.schoolName ?? "",
    academicYear: data.academicYear ?? session.academicYear ?? "",
    students: data.students,
    subjects: data.subjects,
    notes: data.notes ?? {},
    sourceFileName: data.sourceFileName ?? "(session restaurée)",
    importedAt: session.createdAt,
  };
}
