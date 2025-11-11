/*
  Warnings:

  - You are about to drop the column `details` on the `graduation_token_event` table. All the data in the column will be lost.
  - You are about to drop the column `final_status` on the `graduation_token_event` table. All the data in the column will be lost.
  - You are about to drop the column `reward_amount` on the `graduation_token_event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "graduation_token_event" DROP COLUMN "details",
DROP COLUMN "final_status",
DROP COLUMN "reward_amount",
ADD COLUMN     "boding_curve" TEXT,
ADD COLUMN     "pool_authority" TEXT,
ADD COLUMN     "wsol_mint" TEXT;
