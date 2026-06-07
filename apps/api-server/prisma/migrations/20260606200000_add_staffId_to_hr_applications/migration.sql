-- Add staffId column to hr_applications to link recruitment to staff
ALTER TABLE "hr_applications" ADD COLUMN "staffId" TEXT;

-- Create index for the new column
CREATE INDEX "hr_applications_staffId_idx" ON "hr_applications"("staffId");

-- Add foreign key constraint
ALTER TABLE "hr_applications" ADD CONSTRAINT "hr_applications_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
