/*
  Warnings:

  - You are about to drop the `Token` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Token";

-- CreateTable
CREATE TABLE "token" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "symbol" TEXT,
    "creator" TEXT,
    "boding_curve" TEXT,
    "action" TEXT,
    "sol_amonut" DOUBLE PRECISION,
    "token_amount" DOUBLE PRECISION,
    "mint" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "created_token_event" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "mint" TEXT NOT NULL,
    "creator" TEXT,
    "name" TEXT,
    "symbol" TEXT,
    "uri" TEXT,
    "bonding_curve" TEXT,

    CONSTRAINT "created_token_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_token_event" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "mint" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sol_amount" DOUBLE PRECISION,
    "token_amount" DOUBLE PRECISION,
    "is_buy" BOOLEAN NOT NULL,
    "virtual_sol_reserves" DOUBLE PRECISION,
    "virtual_token_reserves" DOUBLE PRECISION,
    "real_sol_reserves" DOUBLE PRECISION,
    "real_token_reserves" DOUBLE PRECISION,
    "program_data" TEXT,

    CONSTRAINT "trade_token_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graduation_token_event" (
    "id" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slot" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "mint" TEXT NOT NULL,
    "final_status" TEXT,
    "reward_amount" DOUBLE PRECISION,
    "details" TEXT,

    CONSTRAINT "graduation_token_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_signature_key" ON "token"("signature");

-- CreateIndex
CREATE INDEX "token_mint_idx" ON "token"("mint");

-- CreateIndex
CREATE INDEX "token_type_idx" ON "token"("type");

-- CreateIndex
CREATE INDEX "token_type_action_idx" ON "token"("type", "action");

-- CreateIndex
CREATE UNIQUE INDEX "created_token_event_signature_key" ON "created_token_event"("signature");

-- CreateIndex
CREATE INDEX "created_token_event_mint_idx" ON "created_token_event"("mint");

-- CreateIndex
CREATE INDEX "created_token_event_slot_idx" ON "created_token_event"("slot");

-- CreateIndex
CREATE INDEX "created_token_event_timestamp_idx" ON "created_token_event"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "trade_token_event_signature_key" ON "trade_token_event"("signature");

-- CreateIndex
CREATE INDEX "trade_token_event_mint_idx" ON "trade_token_event"("mint");

-- CreateIndex
CREATE INDEX "trade_token_event_action_idx" ON "trade_token_event"("action");

-- CreateIndex
CREATE INDEX "trade_token_event_mint_action_idx" ON "trade_token_event"("mint", "action");

-- CreateIndex
CREATE INDEX "trade_token_event_timestamp_idx" ON "trade_token_event"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "graduation_token_event_signature_key" ON "graduation_token_event"("signature");

-- CreateIndex
CREATE INDEX "graduation_token_event_mint_idx" ON "graduation_token_event"("mint");

-- CreateIndex
CREATE INDEX "graduation_token_event_timestamp_idx" ON "graduation_token_event"("timestamp");
