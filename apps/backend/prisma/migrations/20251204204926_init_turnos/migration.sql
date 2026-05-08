/*
  Warnings:

  - You are about to drop the column `apellido` on the `Afiliado` table. All the data in the column will be lost.
  - You are about to drop the column `empresaId` on the `Afiliado` table. All the data in the column will be lost.
  - You are about to drop the column `nombre` on the `Afiliado` table. All the data in the column will be lost.
  - You are about to drop the column `planId` on the `Afiliado` table. All the data in the column will be lost.
  - You are about to drop the column `empresaId` on the `turnos` table. All the data in the column will be lost.
  - You are about to drop the column `prestadorId` on the `turnos` table. All the data in the column will be lost.
  - You are about to drop the `Empresa` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanSalud` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Prestador` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Usuario` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `nombreCompleto` to the `Afiliado` table without a default value. This is not possible if the table is not empty.
  - Made the column `esTitular` on table `Afiliado` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `prestador` to the `turnos` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Afiliado" DROP CONSTRAINT "Afiliado_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Afiliado" DROP CONSTRAINT "Afiliado_planId_fkey";

-- DropForeignKey
ALTER TABLE "PlanSalud" DROP CONSTRAINT "PlanSalud_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Prestador" DROP CONSTRAINT "Prestador_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "Usuario" DROP CONSTRAINT "Usuario_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "turnos" DROP CONSTRAINT "turnos_empresaId_fkey";

-- DropForeignKey
ALTER TABLE "turnos" DROP CONSTRAINT "turnos_prestadorId_fkey";

-- AlterTable
ALTER TABLE "Afiliado" DROP COLUMN "apellido",
DROP COLUMN "empresaId",
DROP COLUMN "nombre",
DROP COLUMN "planId",
ADD COLUMN     "nombreCompleto" TEXT NOT NULL,
ADD COLUMN     "plan" TEXT,
ALTER COLUMN "esTitular" SET NOT NULL;

-- AlterTable
ALTER TABLE "turnos" DROP COLUMN "empresaId",
DROP COLUMN "prestadorId",
ADD COLUMN     "prestador" TEXT NOT NULL,
ALTER COLUMN "plan" DROP NOT NULL;

-- DropTable
DROP TABLE "Empresa";

-- DropTable
DROP TABLE "PlanSalud";

-- DropTable
DROP TABLE "Prestador";

-- DropTable
DROP TABLE "Usuario";
