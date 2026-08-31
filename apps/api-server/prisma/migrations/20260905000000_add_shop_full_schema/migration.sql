-- ============================================================================
-- Shop Full Schema Migration — Creates 14 missing boutique tables + renames
-- ============================================================================
-- The initial migration (20260117123009) only created 4 tables:
--   shop_products, shop_stock (singular), shop_sales, shop_sale_items
-- The Prisma schema declares 19 models with @@map("shop_stocks") etc.
-- This migration creates the 15 missing tables and renames shop_stock → shop_stocks.
-- ============================================================================

-- 0. Create enum types FIRST (before tables that use them)
DO $$ BEGIN
  CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'EXPIRED', 'WASTE', 'RETURN', 'DAMAGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'CANCELLED', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "WalletTxType" AS ENUM ('CREDIT', 'DEBIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1. Rename shop_stock → shop_stocks (schema uses plural)
ALTER TABLE IF EXISTS "shop_stock" RENAME TO "shop_stocks";

-- 1. shop_categories
CREATE TABLE IF NOT EXISTS "shop_categories" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_categories_tenantId_name_key" ON "shop_categories"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "shop_categories_parentId_idx" ON "shop_categories"("parentId");
ALTER TABLE "shop_categories" ADD CONSTRAINT "shop_categories_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_categories" ADD CONSTRAINT "shop_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "shop_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. shop_stock_movements
CREATE TABLE IF NOT EXISTS "shop_stock_movements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "referenceId" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_stock_movements_tenantId_idx" ON "shop_stock_movements"("tenantId");
CREATE INDEX IF NOT EXISTS "shop_stock_movements_productId_idx" ON "shop_stock_movements"("productId");
ALTER TABLE "shop_stock_movements" ADD CONSTRAINT "shop_stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_stock_movements" ADD CONSTRAINT "shop_stock_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. shop_orders
CREATE TABLE IF NOT EXISTS "shop_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "studentId" TEXT,
    "parentId" TEXT,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "pickupDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_orders_tenantId_academicYearId_orderNumber_key" ON "shop_orders"("tenantId", "academicYearId", "orderNumber");
CREATE INDEX IF NOT EXISTS "shop_orders_tenantId_idx" ON "shop_orders"("tenantId");
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. shop_order_items
CREATE TABLE IF NOT EXISTS "shop_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "shop_order_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_order_items_orderId_idx" ON "shop_order_items"("orderId");
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. shop_suppliers
CREATE TABLE IF NOT EXISTS "shop_suppliers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_suppliers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_suppliers_tenantId_name_key" ON "shop_suppliers"("tenantId", "name");
ALTER TABLE "shop_suppliers" ADD CONSTRAINT "shop_suppliers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. shop_purchase_orders
CREATE TABLE IF NOT EXISTS "shop_purchase_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "receivedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_purchase_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_purchase_orders_tenantId_academicYearId_poNumber_key" ON "shop_purchase_orders"("tenantId", "academicYearId", "poNumber");
CREATE INDEX IF NOT EXISTS "shop_purchase_orders_tenantId_idx" ON "shop_purchase_orders"("tenantId");
ALTER TABLE "shop_purchase_orders" ADD CONSTRAINT "shop_purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "shop_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchase_orders" ADD CONSTRAINT "shop_purchase_orders_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_purchase_orders" ADD CONSTRAINT "shop_purchase_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. shop_purchase_order_items
CREATE TABLE IF NOT EXISTS "shop_purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "totalPrice" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "shop_purchase_order_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_purchase_order_items_purchaseOrderId_idx" ON "shop_purchase_order_items"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "shop_purchase_order_items_productId_idx" ON "shop_purchase_order_items"("productId");
ALTER TABLE "shop_purchase_order_items" ADD CONSTRAINT "shop_purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "shop_purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_purchase_order_items" ADD CONSTRAINT "shop_purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. shop_loyalty_cards
CREATE TABLE IF NOT EXISTS "shop_loyalty_cards" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT,
    "staffId" TEXT,
    "cardNumber" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_loyalty_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_loyalty_cards_studentId_key" ON "shop_loyalty_cards"("studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "shop_loyalty_cards_staffId_key" ON "shop_loyalty_cards"("staffId");
CREATE UNIQUE INDEX IF NOT EXISTS "shop_loyalty_cards_cardNumber_key" ON "shop_loyalty_cards"("cardNumber");
CREATE INDEX IF NOT EXISTS "shop_loyalty_cards_tenantId_idx" ON "shop_loyalty_cards"("tenantId");
ALTER TABLE "shop_loyalty_cards" ADD CONSTRAINT "shop_loyalty_cards_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. shop_wallet_transactions
CREATE TABLE IF NOT EXISTS "shop_wallet_transactions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_wallet_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_wallet_transactions_tenantId_idx" ON "shop_wallet_transactions"("tenantId");
CREATE INDEX IF NOT EXISTS "shop_wallet_transactions_cardId_idx" ON "shop_wallet_transactions"("cardId");
ALTER TABLE "shop_wallet_transactions" ADD CONSTRAINT "shop_wallet_transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "shop_loyalty_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_wallet_transactions" ADD CONSTRAINT "shop_wallet_transactions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. shop_settings
CREATE TABLE IF NOT EXISTS "shop_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lowStockAlert" BOOLEAN NOT NULL DEFAULT true,
    "allowPreOrders" BOOLEAN NOT NULL DEFAULT true,
    "loyaltyProgramActive" BOOLEAN NOT NULL DEFAULT false,
    "pointsPer1000" INTEGER NOT NULL DEFAULT 10,
    "receiptHeader" TEXT,
    "receiptFooter" TEXT,
    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_settings_tenantId_key" ON "shop_settings"("tenantId");
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 11. shop_discounts
CREATE TABLE IF NOT EXISTS "shop_discounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "code" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_discounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_discounts_code_key" ON "shop_discounts"("code");
CREATE INDEX IF NOT EXISTS "shop_discounts_tenantId_academicYearId_idx" ON "shop_discounts"("tenantId", "academicYearId");
ALTER TABLE "shop_discounts" ADD CONSTRAINT "shop_discounts_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_discounts" ADD CONSTRAINT "shop_discounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 12. shop_returns
CREATE TABLE IF NOT EXISTS "shop_returns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "saleId" TEXT,
    "orderId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "refundAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_returns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_returns_tenantId_academicYearId_idx" ON "shop_returns"("tenantId", "academicYearId");
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_returns" ADD CONSTRAINT "shop_returns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. shop_school_kits
CREATE TABLE IF NOT EXISTS "shop_school_kits" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolLevelId" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "description" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_school_kits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_school_kits_tenantId_academicYearId_idx" ON "shop_school_kits"("tenantId", "academicYearId");
ALTER TABLE "shop_school_kits" ADD CONSTRAINT "shop_school_kits_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_school_kits" ADD CONSTRAINT "shop_school_kits_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 14. shop_school_kit_items
CREATE TABLE IF NOT EXISTS "shop_school_kit_items" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "shop_school_kit_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shop_school_kit_items_kitId_idx" ON "shop_school_kit_items"("kitId");
ALTER TABLE "shop_school_kit_items" ADD CONSTRAINT "shop_school_kit_items_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "shop_school_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_school_kit_items" ADD CONSTRAINT "shop_school_kit_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "shop_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 15. shop_deliveries
CREATE TABLE IF NOT EXISTS "shop_deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "deliveryMode" TEXT NOT NULL,
    "recipientName" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shop_deliveries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_deliveries_orderId_key" ON "shop_deliveries"("orderId");
CREATE INDEX IF NOT EXISTS "shop_deliveries_tenantId_academicYearId_idx" ON "shop_deliveries"("tenantId", "academicYearId");
ALTER TABLE "shop_deliveries" ADD CONSTRAINT "shop_deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_deliveries" ADD CONSTRAINT "shop_deliveries_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shop_deliveries" ADD CONSTRAINT "shop_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 16. Add missing columns to shop_products (if not already present)
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "maxStock" INTEGER;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "minStock" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT NOT NULL DEFAULT '';
-- FK for categoryId
DO $$ BEGIN
  ALTER TABLE "shop_products" ADD CONSTRAINT "shop_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "shop_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 17. Add missing columns to shop_sales (if not already present)
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "academicYearId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "customerType" TEXT NOT NULL DEFAULT 'WALK_IN';
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "studentId" TEXT;
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "subTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "shop_sales" ADD COLUMN IF NOT EXISTS "walletUsed" BOOLEAN NOT NULL DEFAULT false;

-- 18. Add reservedQty + lastInventory + location to shop_stocks (renamed from shop_stock)
ALTER TABLE IF EXISTS "shop_stocks" ADD COLUMN IF NOT EXISTS "reservedQty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS "shop_stocks" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE IF EXISTS "shop_stocks" ADD COLUMN IF NOT EXISTS "lastInventory" TIMESTAMP(3);
ALTER TABLE IF EXISTS "shop_stocks" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT '';
ALTER TABLE IF EXISTS "shop_stocks" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS "shop_stocks" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Done. All 15 missing shop tables created + shop_stock renamed to shop_stocks.
