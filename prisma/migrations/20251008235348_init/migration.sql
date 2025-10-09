-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "creator" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Token_mint_key" ON "Token"("mint");

-- CreateIndex
CREATE UNIQUE INDEX "Token_signature_key" ON "Token"("signature");

-- CreateIndex
CREATE INDEX "Token_mint_idx" ON "Token"("mint");
