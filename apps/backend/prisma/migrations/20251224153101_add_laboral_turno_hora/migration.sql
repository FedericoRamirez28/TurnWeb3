/*
  Warnings:

  - A unique constraint covering the columns `[sede,fechaTurnoISO,horaTurno]` on the table `laboral_turnos` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "laboral_turnos" ADD COLUMN     "horaTurno" TEXT;

-- CreateIndex
CREATE INDEX "laboral_turnos_sede_fechaTurnoISO_horaTurno_idx" ON "laboral_turnos"("sede", "fechaTurnoISO", "horaTurno");


