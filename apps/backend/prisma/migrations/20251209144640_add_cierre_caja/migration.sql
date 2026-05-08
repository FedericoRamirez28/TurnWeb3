-- CreateTable
CREATE TABLE "cierre_caja" (
    "id" TEXT NOT NULL,
    "fechaISO" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "rows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_caja_fechaISO_key" ON "cierre_caja"("fechaISO");
