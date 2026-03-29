export const academicYearsKeys = {
  all: ['academic-years'] as const,
  /** Liste + marquage isCurrent — une entrée par tenant (ou `no-tenant` pour session sans id). */
  snapshot: (tenantKey: string | undefined) =>
    [...academicYearsKeys.all, 'snapshot', tenantKey ?? 'no-tenant'] as const,
};
