-- AlterTable
ALTER TABLE "ParteDiario" ADD COLUMN     "observaciones" TEXT,
ADD COLUMN     "patente" TEXT;

-- CreateIndex
CREATE INDEX "ParteDiario_movilId_createdAt_idx" ON "ParteDiario"("movilId", "createdAt");
