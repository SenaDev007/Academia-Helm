-- ============================================================================
-- Shop Settings — Add missing fields for extended configuration
-- ============================================================================
-- Fields added:
--   lowStockAlertEnabled      Boolean  (alias for lowStockAlert)
--   weeklyInventoryReport     Boolean  (weekly inventory email report)
--   defaultLowStockThreshold  Int      (default alert threshold for stocks)
--   allowClientCredit         Boolean  (allow students to buy on credit)
--   autoPrintReceipt          Boolean  (auto-print receipt on checkout)
--   barcodeScannerEnabled     Boolean  (barcode scanner support in POS)
--   orionPredictiveInventory  Boolean  (AI-powered inventory predictions)
-- ============================================================================

ALTER TABLE "shop_settings"
  ADD COLUMN IF NOT EXISTS "lowStockAlertEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "weeklyInventoryReport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "defaultLowStockThreshold" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "allowClientCredit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "barcodeScannerEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "orionPredictiveInventory" BOOLEAN NOT NULL DEFAULT true;
