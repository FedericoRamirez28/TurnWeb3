/*
  Warnings:

  - A unique constraint covering the columns `[arregloId]` on the table `HistorialDiaRow` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "HistorialDiaRow" ADD COLUMN     "arregloId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HistorialDiaRow_arregloId_key" ON "HistorialDiaRow"("arregloId");
