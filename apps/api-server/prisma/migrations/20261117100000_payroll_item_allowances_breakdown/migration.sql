-- ============================================================================
-- PayrollItem : traçabilité des indemnités incluses dans le salaire brut
-- ----------------------------------------------------------------------------
-- Exigence utilisateur (17/11/2026) : le calcul de paie doit tenir compte des
-- indemnités (salaire brut = base + indemnités par type + heures supp +
-- primes → salaire réel), de façon TRANSPARENTE et FIGÉE à l'instant du calcul.
--
-- Deux colonnes ajoutées à payroll_items :
--   allowancesTotal DECIMAL(10,2) NOT NULL DEFAULT 0
--       → total des indemnités actives (staff_allowances) au moment du calcul.
--   allowancesDetail JSONB NULL
--       → détail figé par type [{code,label,amount}], utilisé par la page
--         période (composition du brut) et les documents FP/EP (gains
--         détaillés, plus d'indemnités « noyées » dans les primes).
--
-- Rétro-compatibilité :
--   • lignes historiques : allowancesTotal backfillé depuis le résidu
--     brut − base − heuresSup − primes (formule exacte du moteur) ;
--   • allowancesDetail backfillé UNIQUEMENT lorsque le résidu est exactement
--     égal à la somme courante des indemnités actives du staff (preuve que le
--     détail d'aujourd'hui == celui figé à l'époque) — sinon NULL, et la page
--     retombe sur l'affichage « indemnités » sans détail par type.
--   • les documents déjà émis (snapshots figés sans gains.indemnites)
--     restent rendus à l'identique (champs optionnels dans les gabarits).
--
-- ⚠️ Appliqué manuellement sur Neon (le docker-entrypoint Railway ne lance
--    JAMAIS prisma migrate deploy — cf. docker-entrypoint.sh).
-- ============================================================================

ALTER TABLE "payroll_items" ADD COLUMN "allowancesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "payroll_items" ADD COLUMN "allowancesDetail" JSONB;

-- Backfill du total : résidu du brut = indemnités (formule du moteur).
UPDATE "payroll_items"
   SET "allowancesTotal" = GREATEST(0, ROUND("grossSalary" - "baseSalary" - "overtimeAmount" - "bonuses", 2))
 WHERE GREATEST(0, ROUND("grossSalary" - "baseSalary" - "overtimeAmount" - "bonuses", 2)) > 0;

-- Backfill du détail : uniquement si preuve de cohérence (résidu == Σ actives).
WITH actives AS (
  SELECT sa."staffId",
         sa."tenantId",
         jsonb_agg(
           jsonb_build_object('code', at."code", 'label', at."name", 'amount', sa."amount")
           ORDER BY at."code"
         ) AS detail,
         SUM(sa."amount") AS total
    FROM staff_allowances sa
    JOIN allowance_types at ON at.id = sa."allowanceTypeId"
   WHERE sa."status" = 'ACTIVE'
   GROUP BY sa."staffId", sa."tenantId"
)
UPDATE "payroll_items" pi
   SET "allowancesDetail" = a.detail
  FROM actives a
 WHERE a."staffId" = pi."staffId"
   AND a."tenantId" = pi."tenantId"
   AND ROUND((pi."grossSalary" - pi."baseSalary" - pi."overtimeAmount" - pi."bonuses")::numeric, 2)
       = ROUND(a.total::numeric, 2);
