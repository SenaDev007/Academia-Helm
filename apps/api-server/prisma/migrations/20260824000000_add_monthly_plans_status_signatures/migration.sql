-- ⭐ Add status, signatures, and observation columns to monthly_plans
--    Workflow: DRAFT → SUBMITTED → VALIDATED / REJECTED
--    - teacherSignature: signature data URL captured at submission time
--    - directorSignature: signature data URL applied when director validates
--    - directorObservation: comment from director when validating/rejecting
--    - submittedAt: timestamp of submission
--    - validatedAt: timestamp of validation/rejection
--    - attachedCahierJournalId: link to the first Cahier Journal of the month
--      (per user request: monthly plan attached to first Cahier Journal of each month)

ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "teacherSignature" TEXT;
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "directorSignature" TEXT;
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "directorObservation" TEXT;
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);
ALTER TABLE "monthly_plans"
    ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP(3);

-- ⭐ Index for fast lookup of submitted/pending plans (director's view)
CREATE INDEX IF NOT EXISTS "monthly_plans_status_idx"
    ON "monthly_plans" ("tenantId", "status");
