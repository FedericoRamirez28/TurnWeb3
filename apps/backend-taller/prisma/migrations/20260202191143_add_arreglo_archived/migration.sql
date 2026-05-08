-- AlterTable
ALTER TABLE "Arreglo" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Arreglo_movilId_archived_idx" ON "Arreglo"("movilId", "archived");
