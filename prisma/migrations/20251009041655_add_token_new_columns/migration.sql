-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "action" TEXT,
ADD COLUMN     "bodingCurve" TEXT,
ADD COLUMN     "solAmonut" DOUBLE PRECISION,
ADD COLUMN     "tokenAmount" DOUBLE PRECISION,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "creator" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Token_type_idx" ON "Token"("type");

-- CreateIndex
CREATE INDEX "Token_type_action_idx" ON "Token"("type", "action");
