'use client';

import dynamic from 'next/dynamic';
import type { Tenant, User } from '@/types';
import { buildAuthorName, useReviewPrompt } from '@/hooks/useReviewPrompt';

const ReviewRequestModal = dynamic(
  () => import('@/components/reviews/ReviewRequestModal'),
  { ssr: false },
);

type Props = {
  user: User;
  tenant: Tenant;
  children?: React.ReactNode;
};

/**
 * Invite in-app à laisser un avis (après 30 jours, une fois par tenant).
 */
export function ReviewPromptHost({ user, tenant, children }: Props) {
  const { open, dismiss } = useReviewPrompt(tenant, user);

  return (
    <>
      {children}
      {open ? (
        <ReviewRequestModal
          tenantId={tenant.id}
          schoolName={tenant.name}
          authorName={buildAuthorName(user)}
          authorRole={
            user.role === 'director' || user.role === 'SUPER_DIRECTOR'
              ? 'Directeur'
              : user.role === 'admin'
                ? 'Administration'
                : user.role === 'teacher' || user.role === 'ENSEIGNANT'
                  ? 'Enseignant'
                  : user.role === 'parent' || user.role === 'PARENT'
                    ? 'Parent'
                    : user.role === 'student' || user.role === 'ELEVE'
                      ? 'Élève'
                      : user.role === 'accountant' || user.role === 'COMPTABLE'
                        ? 'Comptable'
                        : undefined
          }
          onClose={dismiss}
        />
      ) : null}
    </>
  );
}
