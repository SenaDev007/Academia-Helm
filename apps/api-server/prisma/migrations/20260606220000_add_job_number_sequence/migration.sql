-- CreateTable: Job number sequence for sequential job reference numbers
CREATE TABLE "job_number_sequences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique tenantId
CREATE UNIQUE INDEX "job_number_sequences_tenantId_key" ON "job_number_sequences"("tenantId");

-- Add foreign key
ALTER TABLE "job_number_sequences" ADD CONSTRAINT "job_number_sequences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
