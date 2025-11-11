-- CreateTable
CREATE TABLE "token_ath_history" (
    "id" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "price_sol" DECIMAL(65,30) NOT NULL,
    "price_usd" DECIMAL(65,30),
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_ath_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_ath_current" (
    "mint" TEXT NOT NULL,
    "price_sol" DECIMAL(65,30) NOT NULL,
    "price_usd" DECIMAL(65,30),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_ath_current_pkey" PRIMARY KEY ("mint")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_ath_history_signature_key" ON "token_ath_history"("signature");

-- CreateIndex
CREATE INDEX "token_ath_history_mint_idx" ON "token_ath_history"("mint");
