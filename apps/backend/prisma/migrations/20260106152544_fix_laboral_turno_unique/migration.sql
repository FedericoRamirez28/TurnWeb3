/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,sede,fechaTurnoISO,horaTurno,tipoExamen]` on the table `laboral_turnos` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "laboral_turnos_employeeId_sede_fechaTurnoISO_horaTurno_tipo_key" ON "laboral_turnos"("employeeId", "sede", "fechaTurnoISO", "horaTurno", "tipoExamen");
