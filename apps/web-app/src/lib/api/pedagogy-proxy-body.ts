/**
 * Relais App Router → backend : ne pas se fier à `request.body` (souvent absent / non fiable),
 * toujours lire le flux avec `request.text()` pour POST/PUT/PATCH/DELETE.
 */
import { NextRequest } from 'next/server';

export async function readProxyBodyText(
  request: NextRequest,
  method: string,
): Promise<string | undefined> {
  if (method === 'GET' || method === 'HEAD') return undefined;
  const text = await request.text();
  return text.length > 0 ? text : undefined;
}
