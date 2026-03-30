/**
 * Appels client vers les proxies Next — Structure académique & séries (Module 2)
 */

export async function pedagogyFetch<T>(
  path: string,
  options?: { method?: string; body?: object },
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    let err: { message?: string; error?: string } = {};
    if (text.trim()) {
      try {
        err = JSON.parse(text) as { message?: string; error?: string };
      } catch {
        err = {};
      }
    }
    throw new Error(err.message ?? err.error ?? res.statusText || 'Erreur réseau');
  }
  if (!text.trim()) {
    return null as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Réponse invalide du serveur');
  }
}

export function academicStructureUrl(
  subPath: string,
  query?: Record<string, string | undefined>,
) {
  const trimmed = subPath.replace(/^\//, '');
  const base = trimmed
    ? `/api/pedagogy/academic-structure/${trimmed}`
    : `/api/pedagogy/academic-structure`;
  if (!query) return base;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

export function academicSeriesUrl(
  subPath: string,
  query?: Record<string, string | undefined>,
) {
  const trimmed = subPath.replace(/^\//, '');
  const base = trimmed
    ? `/api/pedagogy/academic-series/${trimmed}`
    : `/api/pedagogy/academic-series`;
  if (!query) return base;
  const q = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
