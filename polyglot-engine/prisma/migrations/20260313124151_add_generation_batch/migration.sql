-- AlterTable
ALTER TABLE "GenerationJob" ADD COLUMN     "cardId" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "qaChecks" JSONB;

-- CreateTable
CREATE TABLE "GenerationBatch" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "langsGenerated" TEXT[],
    "rawResponse" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationBatch_jobId_idx" ON "GenerationBatch"("jobId");

-- AddForeignKey
ALTER TABLE "GenerationBatch" ADD CONSTRAINT "GenerationBatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
