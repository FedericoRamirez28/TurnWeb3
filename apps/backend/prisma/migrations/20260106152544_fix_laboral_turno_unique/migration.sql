-- Remove legacy unique index that blocked multiple turnos in same slot
DROP INDEX IF EXISTS "laboral_turnos_sede_fechaTurnoISO_horaTurno_key";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "laboral_turnos_employeeId_sede_fechaTurnoISO_horaTurno_tipo_key"
ON "laboral_turnos"("employeeId", "sede", "fechaTurnoISO", "horaTurno", "tipoExamen");

