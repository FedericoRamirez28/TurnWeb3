-- CreateTable
CREATE TABLE "LaboralAdicional" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "nroAfiliado" TEXT,
    "nombre" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "adicional" TEXT NOT NULL,
    "fechaISO" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaboralAdicional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaboralAdicional_userId_fechaISO_idx" ON "LaboralAdicional"("userId", "fechaISO");

-- CreateIndex
CREATE INDEX "LaboralAdicional_userId_dni_idx" ON "LaboralAdicional"("userId", "dni");

-- CreateIndex
CREATE INDEX "LaboralAdicional_userId_empresa_idx" ON "LaboralAdicional"("userId", "empresa");

-- CreateIndex
CREATE UNIQUE INDEX "LaboralAdicional_userId_empresa_dni_adicional_fechaISO_nomb_key" ON "LaboralAdicional"("userId", "empresa", "dni", "adicional", "fechaISO", "nombre", "nroAfiliado");

-- AddForeignKey
ALTER TABLE "LaboralAdicional" ADD CONSTRAINT "LaboralAdicional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
