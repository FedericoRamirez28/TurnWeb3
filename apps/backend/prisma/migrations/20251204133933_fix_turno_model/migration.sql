/*
  Warnings:

  - You are about to drop the `Turno` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Turno" DROP CONSTRAINT "Turno_afiliadoId_fkey";

-- DropForeignKey
ALTER TABLE "Turno" DROP CONSTRAINT "Turno_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Turno" DROP CONSTRAINT "Turno_prestadorId_fkey";

-- DropTable
DROP TABLE "Turno";

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "fechaTomado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaReal" TIMESTAMP(3),
    "hora" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "observaciones" TEXT,
    "tipoAtencion" TEXT NOT NULL,
    "especialidad" TEXT,
    "laboratorio" TEXT,
    "plan" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "profesional" TEXT NOT NULL,
    "prestadorId" TEXT NOT NULL,
    "afiliadoId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
