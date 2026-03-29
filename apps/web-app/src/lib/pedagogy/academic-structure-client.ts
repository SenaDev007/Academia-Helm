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
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
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
