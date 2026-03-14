-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('chunk', 'padrao', 'discriminacao', 'cloze');

-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('a1', 'a2', 'b1', 'b2', 'c1');

-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('apresentacao', 'polidez', 'reparo_conversacional', 'pedido', 'direcao', 'transporte', 'emergencia', 'trabalho', 'socializacao', 'comida', 'hospedagem', 'compras', 'saude', 'tempo', 'numeros', 'sentimentos', 'opiniao', 'comparacao', 'descricao', 'rotina');

-- CreateEnum
CREATE TYPE "CardSource" AS ENUM ('haiku_auto', 'haiku_manual', 'opus_gold', 'manual', 'import_tsv');

-- CreateEnum
CREATE TYPE "CardQuality" AS ENUM ('raw', 'reviewed', 'edited', 'gold', 'deprecated', 'suspicious');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('easy', 'medium', 'hard', 'blocked');

-- CreateEnum
CREATE TYPE "DifficultyType" AS ENUM ('pronuncia', 'escrita', 'gramatica', 'vocabulario', 'interferencia', 'tom', 'caso', 'ordem');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'running', 'validating', 'done', 'failed', 'rejected');

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "tipo" "CardType" NOT NULL,
    "contexto" TEXT NOT NULL,
    "frentePt" TEXT NOT NULL,
    "frentePtNorm" TEXT NOT NULL,
    "notaGlobal" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "idiomasPrincipais" TEXT[],
    "familiaContraste" TEXT,
    "nivel" "Nivel" NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "source" "CardSource" NOT NULL DEFAULT 'haiku_auto',
    "quality" "CardQuality" NOT NULL DEFAULT 'raw',
    "sourceModel" TEXT,
    "sourcePromptVersion" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTag" (
    "cardId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CardTag_pkey" PRIMARY KEY ("cardId","tagId")
);

-- CreateTable
CREATE TABLE "LangBloco" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "langCode" TEXT NOT NULL,
    "natural" TEXT NOT NULL,
    "romanizacao" TEXT NOT NULL DEFAULT '—',
    "variacaoNativa" TEXT,
    "literal" TEXT NOT NULL,
    "padrao" TEXT NOT NULL,
    "gramatica" TEXT,
    "obs" TEXT NOT NULL,
    "erroTipico" TEXT NOT NULL,
    "contraste" TEXT NOT NULL,
    "armadilha" TEXT NOT NULL,
    "padraoReutilizavel" TEXT NOT NULL,
    "sinonimos" TEXT,
    "antonimo" TEXT,
    "collocations" TEXT,
    "campoSemantico" TEXT,
    "registroVariacoes" TEXT,
    "gatilho" TEXT NOT NULL,
    "registro" TEXT NOT NULL,

    CONSTRAINT "LangBloco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "langCode" TEXT,
    "rating" INTEGER NOT NULL,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interval" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "state" INTEGER NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LangDifficulty" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "langCode" TEXT NOT NULL,
    "level" "DifficultyLevel" NOT NULL,
    "types" "DifficultyType"[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LangDifficulty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "chunkPt" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "familyBatch" TEXT,
    "status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "rawTsv" TEXT,
    "error" TEXT,
    "model" TEXT NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
    "promptVersion" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cachedTokens" INTEGER,
    "cost" DOUBLE PRECISION,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "qaScore" DOUBLE PRECISION,
    "qaFlags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkRegistry" (
    "id" TEXT NOT NULL,
    "chunkPt" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "variacao" TEXT,
    "parentChunk" TEXT,
    "gerado" BOOLEAN NOT NULL DEFAULT false,
    "cardId" TEXT,
    "prioridade" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChunkRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Card_seq_key" ON "Card"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "Card_frentePtNorm_key" ON "Card"("frentePtNorm");

-- CreateIndex
CREATE INDEX "Card_quality_idx" ON "Card"("quality");

-- CreateIndex
CREATE INDEX "Card_categoria_idx" ON "Card"("categoria");

-- CreateIndex
CREATE INDEX "Card_nivel_idx" ON "Card"("nivel");

-- CreateIndex
CREATE INDEX "Card_source_idx" ON "Card"("source");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "CardTag_tagId_idx" ON "CardTag"("tagId");

-- CreateIndex
CREATE INDEX "LangBloco_langCode_idx" ON "LangBloco"("langCode");

-- CreateIndex
CREATE UNIQUE INDEX "LangBloco_cardId_langCode_key" ON "LangBloco"("cardId", "langCode");

-- CreateIndex
CREATE INDEX "Review_due_idx" ON "Review"("due");

-- CreateIndex
CREATE INDEX "Review_cardId_langCode_idx" ON "Review"("cardId", "langCode");

-- CreateIndex
CREATE INDEX "Review_langCode_state_idx" ON "Review"("langCode", "state");

-- CreateIndex
CREATE INDEX "Review_langCode_due_idx" ON "Review"("langCode", "due");

-- CreateIndex
CREATE INDEX "LangDifficulty_langCode_level_idx" ON "LangDifficulty"("langCode", "level");

-- CreateIndex
CREATE INDEX "LangDifficulty_level_idx" ON "LangDifficulty"("level");

-- CreateIndex
CREATE UNIQUE INDEX "LangDifficulty_cardId_langCode_key" ON "LangDifficulty"("cardId", "langCode");

-- CreateIndex
CREATE INDEX "GenerationJob_status_idx" ON "GenerationJob"("status");

-- CreateIndex
CREATE INDEX "GenerationJob_createdAt_idx" ON "GenerationJob"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_chunkPt_idx" ON "GenerationJob"("chunkPt");

-- CreateIndex
CREATE UNIQUE INDEX "ChunkRegistry_chunkPt_key" ON "ChunkRegistry"("chunkPt");

-- CreateIndex
CREATE INDEX "ChunkRegistry_gerado_prioridade_idx" ON "ChunkRegistry"("gerado", "prioridade");

-- CreateIndex
CREATE INDEX "ChunkRegistry_categoria_nivel_idx" ON "ChunkRegistry"("categoria", "nivel");

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LangBloco" ADD CONSTRAINT "LangBloco_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LangDifficulty" ADD CONSTRAINT "LangDifficulty_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
