import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  let email = '';
  let source = '';
  let keywords = '';

  if (contentType.includes('application/json')) {
    const body = (await req.json()) as { email?: string; source?: string; keywords?: string };
    email = String(body.email || '').trim().toLowerCase();
    source = String(body.source || '').trim();
    keywords = String(body.keywords || '').trim();
  } else {
    const form = await req.formData();
    email = String(form.get('email') || '').trim().toLowerCase();
    source = String(form.get('source') || '').trim();
    keywords = String(form.get('keywords') || '').trim();
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Email invalide' }, { status: 400 });
  }

  const payload = {
    email,
    source: source || 'unknown',
    keywords,
    createdAt: new Date().toISOString(),
  };

  const redis = getRedis();
  if (redis) {
    const key = `leads:${payload.createdAt}:${Math.random().toString(16).slice(2)}`;
    await redis.set(key, payload);
    await redis.lpush('leads:index', key);
  } else {
    // Fallback: on ne persiste pas sans Redis (évite l’écriture disque en serverless)
    console.log('[lead]', payload);
  }

  // UX: redirige vers signup avec un signal de source
  const url = new URL('/signup', req.url);
  url.searchParams.set('utm_source', 'seo');
  url.searchParams.set('utm_medium', 'blog');
  if (source) url.searchParams.set('utm_content', source);
  return NextResponse.redirect(url, 303);
}

