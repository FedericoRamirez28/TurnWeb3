/*
  Warnings:

  - Added the required column `monto` to the `Turno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `plan` to the `Turno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `profesional` to the `Turno` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoAtencion` to the `Turno` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Turno" ADD COLUMN     "especialidad" TEXT,
ADD COLUMN     "laboratorio" TEXT,
ADD COLUMN     "monto" INTEGER NOT NULL,
ADD COLUMN     "plan" TEXT NOT NULL,
ADD COLUMN     "profesional" TEXT NOT NULL,
ADD COLUMN     "tipoAtencion" TEXT NOT NULL;
