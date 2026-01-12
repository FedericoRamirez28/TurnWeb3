-- CreateEnum
CREATE TYPE "BonoStatus" AS ENUM ('ISSUED', 'USED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BonoScanResult" AS ENUM ('VALID', 'INVALID_TOKEN', 'NOT_FOUND', 'EXPIRED', 'USED', 'CANCELLED');

-- AlterTable
ALTER TABLE "turnos" ADD COLUMN     "prestadorId" TEXT;

-- CreateTable
CREATE TABLE "prestadores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "razonSocial" TEXT,
    "cuit" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonos_atencion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "afiliadoId" TEXT NOT NULL,
    "prestadorId" TEXT NOT NULL,
    "turnoId" TEXT,
    "afiliadoNombreSnap" TEXT NOT NULL,
    "afiliadoDniSnap" TEXT NOT NULL,
    "prestadorNombreSnap" TEXT NOT NULL,
    "practica" TEXT NOT NULL,
    "observaciones" TEXT,
    "fechaAtencionISO" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "BonoStatus" NOT NULL DEFAULT 'ISSUED',
    "usedAt" TIMESTAMP(3),
    "usedByPrestadorId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonos_atencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonos_atencion_scans" (
    "id" TEXT NOT NULL,
    "bonoId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prestadorId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "result" "BonoScanResult" NOT NULL,

    CONSTRAINT "bonos_atencion_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "prestadores_userId_key" ON "prestadores"("userId");

-- CreateIndex
CREATE INDEX "prestadores_nombre_idx" ON "prestadores"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "bonos_atencion_code_key" ON "bonos_atencion"("code");

-- CreateIndex
CREATE INDEX "bonos_atencion_afiliadoId_idx" ON "bonos_atencion"("afiliadoId");

-- CreateIndex
CREATE INDEX "bonos_atencion_prestadorId_idx" ON "bonos_atencion"("prestadorId");

-- CreateIndex
CREATE INDEX "bonos_atencion_turnoId_idx" ON "bonos_atencion"("turnoId");

-- CreateIndex
CREATE INDEX "bonos_atencion_status_idx" ON "bonos_atencion"("status");

-- CreateIndex
CREATE INDEX "bonos_atencion_scans_bonoId_idx" ON "bonos_atencion_scans"("bonoId");

-- CreateIndex
CREATE INDEX "bonos_atencion_scans_prestadorId_idx" ON "bonos_atencion_scans"("prestadorId");

-- CreateIndex
CREATE INDEX "bonos_atencion_scans_scannedAt_idx" ON "bonos_atencion_scans"("scannedAt");

-- CreateIndex
CREATE INDEX "turnos_afiliadoId_idx" ON "turnos"("afiliadoId");

-- CreateIndex
CREATE INDEX "turnos_prestadorId_idx" ON "turnos"("prestadorId");

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "prestadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestadores" ADD CONSTRAINT "prestadores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion" ADD CONSTRAINT "bonos_atencion_afiliadoId_fkey" FOREIGN KEY ("afiliadoId") REFERENCES "Afiliado"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion" ADD CONSTRAINT "bonos_atencion_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "prestadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion" ADD CONSTRAINT "bonos_atencion_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion" ADD CONSTRAINT "bonos_atencion_usedByPrestadorId_fkey" FOREIGN KEY ("usedByPrestadorId") REFERENCES "prestadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion" ADD CONSTRAINT "bonos_atencion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion_scans" ADD CONSTRAINT "bonos_atencion_scans_bonoId_fkey" FOREIGN KEY ("bonoId") REFERENCES "bonos_atencion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonos_atencion_scans" ADD CONSTRAINT "bonos_atencion_scans_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "prestadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
