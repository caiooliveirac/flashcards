-- CreateEnum
CREATE TYPE "GrammarModuleStatus" AS ENUM ('draft', 'generated', 'reviewed', 'gold');

-- CreateTable
CREATE TABLE "GrammarModule" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "level" TEXT NOT NULL DEFAULT 'a2',
    "content" JSONB NOT NULL,
    "prerequisites" TEXT[],
    "relatedCardIds" TEXT[],
    "status" "GrammarModuleStatus" NOT NULL DEFAULT 'draft',
    "qualityScore" DOUBLE PRECISION,
    "sourceModel" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cachedTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrammarModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardGrammarLink" (
    "cardId" TEXT NOT NULL,
    "grammarModuleId" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "CardGrammarLink_pkey" PRIMARY KEY ("cardId","grammarModuleId")
);

-- CreateIndex
CREATE INDEX "GrammarModule_language_idx" ON "GrammarModule"("language");

-- CreateIndex
CREATE INDEX "GrammarModule_language_cluster_idx" ON "GrammarModule"("language", "cluster");

-- CreateIndex
CREATE INDEX "GrammarModule_status_idx" ON "GrammarModule"("status");

-- CreateIndex
CREATE INDEX "CardGrammarLink_grammarModuleId_idx" ON "CardGrammarLink"("grammarModuleId");

-- AddForeignKey
ALTER TABLE "CardGrammarLink" ADD CONSTRAINT "CardGrammarLink_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGrammarLink" ADD CONSTRAINT "CardGrammarLink_grammarModuleId_fkey" FOREIGN KEY ("grammarModuleId") REFERENCES "GrammarModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
