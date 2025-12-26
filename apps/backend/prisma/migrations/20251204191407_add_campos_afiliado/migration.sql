/*
  Warnings:

  - Added the required column `numeroAfiliado` to the `Afiliado` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Afiliado" ADD COLUMN     "codigoPostal" TEXT,
ADD COLUMN     "esTitular" BOOLEAN DEFAULT true,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "numeroAfiliado" TEXT NOT NULL,
ADD COLUMN     "partido" TEXT,
ADD COLUMN     "provincia" TEXT,
ADD COLUMN     "telefonoAlt" TEXT;
