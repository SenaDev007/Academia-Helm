-- CreateTable
CREATE TABLE "platform_owner_access_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "platform_owner_id" TEXT NOT NULL,
    "portal_type" TEXT NOT NULL DEFAULT 'SCHOOL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,

    CONSTRAINT "platform_owner_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_access_requests_tenant" ON "platform_owner_access_requests"("tenant_id");
CREATE INDEX "idx_access_requests_owner" ON "platform_owner_access_requests"("platform_owner_id");
CREATE INDEX "idx_access_requests_status" ON "platform_owner_access_requests"("status");
CREATE UNIQUE INDEX "idx_access_requests_unique" ON "platform_owner_access_requests"("tenant_id", "platform_owner_id", "portal_type") WHERE "status" IN ('PENDING', 'APPROVED');

-- AddForeignKey
ALTER TABLE "platform_owner_access_requests" ADD CONSTRAINT "fk_access_requests_tenant" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_owner_access_requests" ADD CONSTRAINT "fk_access_requests_owner" FOREIGN KEY ("platform_owner_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_owner_access_requests" ADD CONSTRAINT "fk_access_requests_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_owner_access_requests" ADD CONSTRAINT "fk_access_requests_revoker" FOREIGN KEY ("revoked_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
