-- CreateEnum
CREATE TYPE "TurnosPlan" AS ENUM ('BASE', 'ESMERALDA', 'RUBI', 'DORADO', 'PARTICULAR');

-- CreateEnum
CREATE TYPE "TurnosPrecioTipo" AS ENUM ('LABORATORIO', 'ESPECIALIDAD');

-- CreateTable
CREATE TABLE "turnos_precios" (
    "id" TEXT NOT NULL,
    "tipo" "TurnosPrecioTipo" NOT NULL,
    "nombre" TEXT NOT NULL,
    "plan" "TurnosPlan" NOT NULL,
    "valor" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_precios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "laboral_precios" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "valorSocios" INTEGER NOT NULL,
    "valorNoSocios" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboral_precios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turnos_precios_tipo_plan_idx" ON "turnos_precios"("tipo", "plan");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_precios_tipo_nombre_plan_key" ON "turnos_precios"("tipo", "nombre", "plan");

-- CreateIndex
CREATE INDEX "laboral_precios_categoria_idx" ON "laboral_precios"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "laboral_precios_categoria_nombre_key" ON "laboral_precios"("categoria", "nombre");
