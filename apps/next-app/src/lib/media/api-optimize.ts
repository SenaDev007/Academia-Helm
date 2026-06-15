import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';

export type OptimizeImageApiResult = {
  dataUrl: string;
  mimeType: string;
  bytesBefore: number;
  bytesAfter: number;
};

/**
 * Passe une data URL par le backend Sharp (WebP, max 1600px). Utile si le navigateur
 * n’a pas pu assez compresser ou pour homogénéiser le stockage.
 */
export async function optimizeImageDataUrlViaApi(dataUrl: string): Promise<OptimizeImageApiResult> {
  const res = await fetch('/api/media/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getClientAuthorizationHeader(),
    },
    credentials: 'include',
    body: JSON.stringify({ dataUrl }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = res.statusText;
    if (text.trim()) {
      try {
        const j = JSON.parse(text) as { message?: string };
        if (j.message) msg = j.message;
      } catch {
        /* ignore */
      }
    }
    throw new Error(msg);
  }
  return JSON.parse(text) as OptimizeImageApiResult;
}
