-- DropIndex
DROP INDEX "laboral_companies_cuit_idx";

-- CreateTable
CREATE TABLE "laboral_employees" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nroAfiliado" TEXT,
    "puesto" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboral_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboral_turnos" (
    "id" TEXT NOT NULL,
    "sede" TEXT NOT NULL,
    "fechaRecepcionISO" TEXT NOT NULL,
    "fechaTurnoISO" TEXT NOT NULL,
    "tipoExamen" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "nombreSnap" TEXT NOT NULL,
    "dniSnap" TEXT NOT NULL,
    "nroAfiliadoSnap" TEXT,
    "puestoSnap" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "laboral_turnos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laboral_employees_dni_idx" ON "laboral_employees"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "laboral_employees_companyId_dni_key" ON "laboral_employees"("companyId", "dni");

-- CreateIndex
CREATE INDEX "laboral_turnos_fechaTurnoISO_idx" ON "laboral_turnos"("fechaTurnoISO");

-- CreateIndex
CREATE INDEX "laboral_turnos_companyId_idx" ON "laboral_turnos"("companyId");

-- CreateIndex
CREATE INDEX "laboral_turnos_employeeId_idx" ON "laboral_turnos"("employeeId");

-- AddForeignKey
ALTER TABLE "laboral_employees" ADD CONSTRAINT "laboral_employees_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "laboral_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboral_turnos" ADD CONSTRAINT "laboral_turnos_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "laboral_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboral_turnos" ADD CONSTRAINT "laboral_turnos_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "laboral_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laboral_turnos" ADD CONSTRAINT "laboral_turnos_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
