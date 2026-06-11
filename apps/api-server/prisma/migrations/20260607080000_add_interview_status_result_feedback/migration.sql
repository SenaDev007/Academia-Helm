-- Add status, result, and feedback fields to HrInterview
-- status: tracks interview lifecycle (PLANIFIÉ → EN_COURS → TERMINÉ)
-- result: outcome of the interview (RÉUSSI, ÉCHOUÉ, EN_ATTENTE)
-- feedback: detailed feedback/comments after interview completion

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hr_interviews' AND column_name = 'status'
  ) THEN
    ALTER TABLE "hr_interviews" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PLANIFIÉ';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hr_interviews' AND column_name = 'result'
  ) THEN
    ALTER TABLE "hr_interviews" ADD COLUMN "result" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hr_interviews' AND column_name = 'feedback'
  ) THEN
    ALTER TABLE "hr_interviews" ADD COLUMN "feedback" TEXT;
  END IF;
END $$;
