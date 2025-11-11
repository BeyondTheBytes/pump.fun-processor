/*
  Warnings:

  - Added the required column `type` to the `created_token_event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `graduation_token_event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `trade_token_event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "created_token_event" ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "graduation_token_event" ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "trade_token_event" ADD COLUMN     "type" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "created_token_event_type_idx" ON "created_token_event"("type");

-- CreateIndex
CREATE INDEX "graduation_token_event_type_idx" ON "graduation_token_event"("type");

-- CreateIndex
CREATE INDEX "trade_token_event_type_idx" ON "trade_token_event"("type");
