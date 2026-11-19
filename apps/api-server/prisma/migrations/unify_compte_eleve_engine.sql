-- ============================================================================
-- UNIFY COMPTE ÉLÈVE ENGINE — moteur de calcul unique (nov. 2026, build 1.0.29)
-- ============================================================================
-- RÈGLE MÉTIER — identique pour TOUS les tenants, sans aucune exception :
--   Le COMPTE DE L'ÉLÈVE = frais d'INSCRIPTION + RÉINSCRIPTION + SCOLARITÉ,
--   augmenté À L'AFFICHAGE des ARRÉRÉS (FeeArrear ouverts — postes de
--   scolarité impayés des années antérieures : « 45 000 dont 5 000 arriérés »).
--   Les FRAIS GÉNÉRAUX, FRAIS D'EXAMENS, CANTEEN et OTHER sont suivis À PART
--   (onglet Frais généraux / sous-onglet Frais des examens) et ne sont JAMAIS
--   additionnés à l'inscription ni à la scolarité.
--
-- INVARIANTS — fonction pure du ledger, recalculable à tout instant :
--   totalDue   = Σ initialAmount des lignes cœur (INSCRIPTION, RÉINSCRIPTION,
--                TUITION) de l'année du compte ;
--   totalPaid  = Σ paidAmount des lignes cœur + avances (argent reçu non
--                imputé à une ligne, non appliqué à un arriéré, non déjà
--                reflété dans les lignes) ;
--   balance    = totalDue − totalPaid ;
--   arriérés   = miroirs des FeeArrear ouverts (ArrearsMirrorService).
--   Mathématique stricte : A + B = C, partout, pour tous les tenants.
--
-- ARCHITECTURE — UNE seule source de vérité des totaux :
--   recompute_student_account_totals() dérive totalDue/totalPaid/balance des
--   lignes + du ledger. Les triggers la déclenchent à chaque écriture de
--   ligne (account_breakdowns) et d'argent (finance_transactions). Plus
--   AUCUN incrément aveugle : l'ancien trigger update_account_balance_after_tx
--   (totalPaid += montant COMPLET de la transaction, y compris la part FIFO
--   des arriérés → double comptage « le payé baissait le solde deux fois »)
--   est supprimé.
--
--   Argent « appliqué aux arriérés » : colonne finance_transactions.
--   "arrearsApplied" — part FIFO de l'encaissement standard, ou montant de
--   l'encaissement dédié d'un arriéré. Cette part est EXCLUE du total payé du
--   compte : les arriérés vivent en FeeArrear (source unique) et ne doivent
--   jamais être comptés deux fois.
--
--   Aucun objet DB réservé à une école : règle unique pour les 11 tenants.
-- ============================================================================

-- 1) Colonne d'annotation de l'argent appliqué aux arriérés -------------------
ALTER TABLE "finance_transactions"
  ADD COLUMN IF NOT EXISTS "arrearsApplied" DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN "finance_transactions"."arrearsApplied" IS
  'Montant de la transaction appliqué aux arriérés (FeeArrear) : part FIFO de l''encaissement standard ou encaissement dédié d''un arriéré. Exclu du total payé du compte de l''élève — les arriérés suivis en FeeArrear ne doivent jamais être comptés deux fois.';

-- 2) Bypass contrôlé pour la maintenance du ledger (annotation rétroactive) --
--    Même famille que app.allow_balance_update / app.allow_transaction_delete /
--    app.allow_student_delete : JAMAIS posé par l'application (déploiements
--    gardent la protection intégrale) ; uniquement par les scripts de
--    maintenance officiels du dépôt (scripts/finance/…).
CREATE OR REPLACE FUNCTION public.prevent_update_after_closure()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  allow text;
BEGIN
  allow := current_setting('app.allow_closure_override', true);
  IF allow IS NOT NULL AND allow = 'true' THEN
    RETURN NEW; -- maintenance contrôlée du ledger (annotation arrearsApplied)
  END IF;
  IF EXISTS (
    SELECT 1 FROM "finance_daily_closures" c
    WHERE c."tenantId" = NEW."tenantId"
      AND c."academicYearId" = NEW."academicYearId"
      AND c.date = DATE(NEW."createdAt")
  ) THEN
    RAISE EXCEPTION 'Transaction locked after daily closure';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Avance d'un compte (argent reçu non imputé) — brique du moteur ----------
--    Avance = argent reçu ni imputé à une ligne (allocations), ni appliqué à
--    un arriéré (arrearsApplied), ni déjà reflété dans les lignes sans trace
--    ledger (imports / écritures historiques) :
--      avance = max(0, min(M − A − R, M − L))
--    M = Σ montants des transactions du compte (paiements + annulations,
--    montants signés) ; A = Σ imputations des paiements non annulés ;
--    R = Σ arrearsApplied des paiements non annulés ; L = Σ paidAmount de
--    toutes les lignes (tous types de frais).
-- (les id Prisma sont mappés en text — une première itération uuid a été
--  déposée puis remplacée : on supprime la variante uuid si présente)
DROP FUNCTION IF EXISTS public.student_account_advance(uuid);
DROP FUNCTION IF EXISTS public.student_account_advance(text);
CREATE OR REPLACE FUNCTION public.student_account_advance(p_account_id text)
RETURNS double precision
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  v_money       double precision;
  v_alloc       double precision;
  v_arrears     double precision;
  v_lines_paid  double precision;
BEGIN
  SELECT coalesce(sum(ft."amount"), 0) INTO v_money
  FROM "finance_transactions" ft
  WHERE ft."studentAccountId" = p_account_id;

  SELECT coalesce(sum(a."amount"), 0) INTO v_alloc
  FROM "finance_transaction_allocations" a
  JOIN "finance_transactions" ft ON ft.id = a."financeTransactionId"
  WHERE ft."studentAccountId" = p_account_id
    AND ft."type" = 'PAYMENT'
    AND NOT EXISTS (
      SELECT 1 FROM "finance_transactions" r
      WHERE r."reversedFromId" = ft.id AND r."type" = 'REVERSAL'
    );

  SELECT coalesce(sum(ft."arrearsApplied"), 0) INTO v_arrears
  FROM "finance_transactions" ft
  WHERE ft."studentAccountId" = p_account_id
    AND ft."type" = 'PAYMENT'
    AND NOT EXISTS (
      SELECT 1 FROM "finance_transactions" r
      WHERE r."reversedFromId" = ft.id AND r."type" = 'REVERSAL'
    );

  SELECT coalesce(sum(ab."paidAmount"), 0) INTO v_lines_paid
  FROM "account_breakdowns" ab
  WHERE ab."studentAccountId" = p_account_id;

  RETURN greatest(0, least(
    v_money - v_alloc - v_arrears,
    v_money - v_lines_paid
  ))::double precision;
END;
$function$;

-- 4) MOTEUR — totaux du compte de l'élève dérivés des lignes + du ledger -----
DROP FUNCTION IF EXISTS public.recompute_student_account_totals(uuid);
DROP FUNCTION IF EXISTS public.recompute_student_account_totals(text);
CREATE OR REPLACE FUNCTION public.recompute_student_account_totals(p_account_id text)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  v_core_due    double precision;
  v_core_paid   double precision;
  v_advance     double precision;
  v_total_due   double precision;
  v_total_paid  double precision;
  v_balance     double precision;
  v_blocked     boolean;
BEGIN
  -- Périmètre « compte de l'élève » : INSCRIPTION + RÉINSCRIPTION + SCOLARITÉ.
  -- Les frais généraux / examens / cantine / autres sont suivis à part et
  -- n'entrent JAMAIS dans ces totaux (même règle pour toutes les écoles).
  SELECT
    coalesce(sum(ab."initialAmount"), 0),
    coalesce(sum(ab."paidAmount"), 0)
  INTO v_core_due, v_core_paid
  FROM "account_breakdowns" ab
  JOIN "fee_structures" fs ON fs.id = ab."feeStructureId"
  WHERE ab."studentAccountId" = p_account_id
    AND fs."feeType" IN ('INSCRIPTION', 'REINSCRIPTION', 'TUITION');

  v_advance := public.student_account_advance(p_account_id);

  v_total_due := v_core_due;
  v_total_paid := v_core_paid + v_advance;
  v_balance := v_total_due - v_total_paid;

  SELECT sa."isBlocked" INTO v_blocked
  FROM "student_accounts" sa
  WHERE sa.id = p_account_id;

  PERFORM set_config('app.allow_balance_update', 'true', true);
  UPDATE "student_accounts"
  SET "totalDue"   = round(v_total_due::numeric, 2),
      "totalPaid"  = round(v_total_paid::numeric, 2),
      "balance"    = round(v_balance::numeric, 2),
      "status"     = CASE
                       WHEN v_blocked THEN "status"
                       WHEN v_balance <= 0.005 THEN 'PAID'::"AccountStatus"
                       WHEN v_total_paid > 0.005 THEN 'PARTIAL'::"AccountStatus"
                       ELSE 'ACTIVE'::"AccountStatus"
                     END,
      "updatedAt"  = now()
  WHERE id = p_account_id;
END;
$function$;

-- 5) Triggers : toute écriture d'argent resynchronise les totaux -------------
--    (remplace l'incrément aveugle de l'ancien trigger : la recompute dérive
--    les totaux des lignes + du ledger — la part arriérés/arriérés appliquée
--    ne peut plus jamais gonfler le payé du compte)
CREATE OR REPLACE FUNCTION public.recompute_after_finance_tx()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_account text;
BEGIN
  v_account := CASE WHEN TG_OP = 'DELETE' THEN OLD."studentAccountId"
                    ELSE NEW."studentAccountId" END;
  PERFORM public.recompute_student_account_totals(v_account);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_balance_after_tx ON "finance_transactions";
DROP FUNCTION IF EXISTS public.update_account_balance_after_tx();

DROP TRIGGER IF EXISTS trg_recompute_after_finance_tx ON "finance_transactions";
CREATE TRIGGER trg_recompute_after_finance_tx
AFTER INSERT OR UPDATE OR DELETE ON "finance_transactions"
FOR EACH ROW EXECUTE FUNCTION public.recompute_after_finance_tx();

-- 6) Triggers : toute écriture de ligne de frais resynchronise les totaux -----
--    (statement-level + tables de transition : le recalcul batch du planner
--    déclenche UNE recompute par compte touché, pas par ligne)
-- ⚠ v_id TEXT (fix 2026-11-19) : account_breakdowns."studentAccountId" est une
--    colonne text et la fonction moteur est (p_account_id text). Déclaré uuid,
--    le PERFORM échouait sur CHAQUE écriture de ligne :
--    « function public.recompute_student_account_totals(uuid) does not exist ».
CREATE OR REPLACE FUNCTION public.recompute_after_breakdown_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_id text;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR v_id IN SELECT DISTINCT "studentAccountId" FROM new_rows LOOP
      PERFORM public.recompute_student_account_totals(v_id);
    END LOOP;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    FOR v_id IN SELECT DISTINCT "studentAccountId" FROM old_rows LOOP
      PERFORM public.recompute_student_account_totals(v_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recompute_after_breakdown_insert ON "account_breakdowns";
CREATE TRIGGER trg_recompute_after_breakdown_insert
AFTER INSERT ON "account_breakdowns"
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.recompute_after_breakdown_change();

DROP TRIGGER IF EXISTS trg_recompute_after_breakdown_update ON "account_breakdowns";
CREATE TRIGGER trg_recompute_after_breakdown_update
AFTER UPDATE ON "account_breakdowns"
REFERENCING NEW TABLE AS new_rows OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.recompute_after_breakdown_change();

DROP TRIGGER IF EXISTS trg_recompute_after_breakdown_delete ON "account_breakdowns";
CREATE TRIGGER trg_recompute_after_breakdown_delete
AFTER DELETE ON "account_breakdowns"
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.recompute_after_breakdown_change();

-- 7) Note sur les invariants financiers --------------------------------------
--    payé ≥ 0, solde = dû − payé : garantis par construction (recompute).
--    Le trigger prevent_balance_update continue de protéger les écritures
--    manuelles : la recompute est le seul chemin légitime (bypass interne).
