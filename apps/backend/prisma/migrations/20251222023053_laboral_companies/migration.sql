-- CreateTable
CREATE TABLE "laboral_companies" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nroSocio" TEXT,
    "cuit" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "domicilio" TEXT,
    "notas" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "laboral_companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "laboral_companies_nombre_idx" ON "laboral_companies"("nombre");

-- CreateIndex
CREATE INDEX "laboral_companies_cuit_idx" ON "laboral_companies"("cuit");

-- AddForeignKey
ALTER TABLE "laboral_companies" ADD CONSTRAINT "laboral_companies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
