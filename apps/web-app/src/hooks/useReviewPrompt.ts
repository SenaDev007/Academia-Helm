'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Tenant, User } from '@/types';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const OPEN_DELAY_MS = 4000;

function storageKey(tenantId: string) {
  return `review_prompted_${tenantId}`;
}

/**
 * Affiche une invite d’avis après 30 jours d’existence du tenant, une seule fois (localStorage).
 */
export function useReviewPrompt(
  tenant: Tenant | undefined,
  user: User | undefined,
): { open: boolean; dismiss: () => void } {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !tenant?.id || !tenant.createdAt) {
      return;
    }
    if (localStorage.getItem(storageKey(tenant.id))) {
      return;
    }
    const created = new Date(tenant.createdAt).getTime();
    if (Number.isNaN(created)) return;
    if (Date.now() < created + THIRTY_DAYS_MS) {
      return;
    }
    const t = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [tenant?.id, tenant?.createdAt]);

  const dismiss = useCallback(() => {
    if (tenant?.id) {
      localStorage.setItem(storageKey(tenant.id), '1');
    }
    setOpen(false);
  }, [tenant?.id]);

  return { open, dismiss };
}

export function buildAuthorName(user: User | undefined): string {
  if (!user) return '';
  const fn = user.firstName?.trim() || '';
  const ln = user.lastName?.trim() || '';
  return [fn, ln].filter(Boolean).join(' ');
}
