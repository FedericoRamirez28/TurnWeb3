-- CreateTable
CREATE TABLE "laboral_consultorio_turnos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "empresaNombreSnap" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nacimientoISO" TEXT,
    "motivo" TEXT NOT NULL,
    "diagnostico" TEXT NOT NULL,
    "fechaTurnoISO" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboral_consultorio_turnos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laboral_consultorio_turnos_userId_fechaTurnoISO_idx" ON "laboral_consultorio_turnos"("userId", "fechaTurnoISO");

-- CreateIndex
CREATE INDEX "laboral_consultorio_turnos_userId_companyId_idx" ON "laboral_consultorio_turnos"("userId", "companyId");

-- CreateIndex
CREATE INDEX "laboral_consultorio_turnos_userId_dni_idx" ON "laboral_consultorio_turnos"("userId", "dni");

-- CreateIndex
CREATE UNIQUE INDEX "laboral_consultorio_turnos_userId_companyId_dni_fechaTurnoI_key" ON "laboral_consultorio_turnos"("userId", "companyId", "dni", "fechaTurnoISO", "motivo");

-- AddForeignKey
ALTER TABLE "laboral_consultorio_turnos" ADD CONSTRAINT "laboral_consultorio_turnos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboral_consultorio_turnos" ADD CONSTRAINT "laboral_consultorio_turnos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "laboral_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
