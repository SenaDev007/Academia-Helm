-- CreateTable
CREATE TABLE "public_verification_logs" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT,
    "ipAddress" TEXT,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_verification_logs_tokenId_idx" ON "public_verification_logs"("tokenId");

-- CreateIndex
CREATE INDEX "public_verification_logs_createdAt_idx" ON "public_verification_logs"("createdAt");

-- CreateIndex
CREATE INDEX "public_verification_logs_result_idx" ON "public_verification_logs"("result");

-- AddForeignKey
ALTER TABLE "public_verification_logs" ADD CONSTRAINT "public_verification_logs_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "public_verification_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
