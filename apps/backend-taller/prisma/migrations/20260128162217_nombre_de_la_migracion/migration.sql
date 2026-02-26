-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('baja', 'alta', 'urgente');

-- CreateTable
CREATE TABLE "Movil" (
    "id" TEXT NOT NULL,
    "numero" INTEGER,
    "patenteFija" TEXT,
    "vtvFecha" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Movil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParteDiario" (
    "id" TEXT NOT NULL,
    "movilId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chofer" TEXT,
    "kmInicio" INTEGER,
    "kmFin" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParteDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Arreglo" (
    "id" TEXT NOT NULL,
    "movilId" TEXT NOT NULL,
    "patenteSnap" TEXT,
    "fechaISO" TEXT,
    "motivo" TEXT,
    "anotaciones" TEXT,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'baja',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Arreglo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "arregloId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "completa" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalizadoItem" (
    "id" TEXT NOT NULL,
    "movilId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalizadoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistorialDiaRow" (
    "id" TEXT NOT NULL,
    "movilId" TEXT NOT NULL,
    "fechaISO" TEXT NOT NULL,
    "horaEntrada" TEXT,
    "horaSalida" TEXT,
    "salidaIndefinida" BOOLEAN NOT NULL DEFAULT false,
    "patente" TEXT,
    "motivo" TEXT,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'baja',
    "anotaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialDiaRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movil_numero_key" ON "Movil"("numero");

-- CreateIndex
CREATE INDEX "ParteDiario_movilId_fecha_idx" ON "ParteDiario"("movilId", "fecha");

-- CreateIndex
CREATE INDEX "Arreglo_movilId_createdAt_idx" ON "Arreglo"("movilId", "createdAt");

-- CreateIndex
CREATE INDEX "Tarea_arregloId_orden_idx" ON "Tarea"("arregloId", "orden");

-- CreateIndex
CREATE INDEX "FinalizadoItem_movilId_createdAt_idx" ON "FinalizadoItem"("movilId", "createdAt");

-- CreateIndex
CREATE INDEX "HistorialDiaRow_movilId_fechaISO_idx" ON "HistorialDiaRow"("movilId", "fechaISO");

-- AddForeignKey
ALTER TABLE "ParteDiario" ADD CONSTRAINT "ParteDiario_movilId_fkey" FOREIGN KEY ("movilId") REFERENCES "Movil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arreglo" ADD CONSTRAINT "Arreglo_movilId_fkey" FOREIGN KEY ("movilId") REFERENCES "Movil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_arregloId_fkey" FOREIGN KEY ("arregloId") REFERENCES "Arreglo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalizadoItem" ADD CONSTRAINT "FinalizadoItem_movilId_fkey" FOREIGN KEY ("movilId") REFERENCES "Movil"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistorialDiaRow" ADD CONSTRAINT "HistorialDiaRow_movilId_fkey" FOREIGN KEY ("movilId") REFERENCES "Movil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
