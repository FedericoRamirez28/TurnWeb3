-- CreateTable
CREATE TABLE "LaboralPortada" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apellidoNombre" TEXT NOT NULL,
    "nroSocio" TEXT,
    "domicilio" TEXT,
    "fechaNacimiento" TEXT,
    "dni" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaboralPortada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaboralPortada_userId_apellidoNombre_idx" ON "LaboralPortada"("userId", "apellidoNombre");

-- CreateIndex
CREATE INDEX "LaboralPortada_userId_dni_idx" ON "LaboralPortada"("userId", "dni");

-- CreateIndex
CREATE UNIQUE INDEX "LaboralPortada_userId_dni_key" ON "LaboralPortada"("userId", "dni");

-- AddForeignKey
ALTER TABLE "LaboralPortada" ADD CONSTRAINT "LaboralPortada_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
