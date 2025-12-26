// apps/backend/prisma/seed.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

function readJson(relPath) {
  const p = path.join(__dirname, relPath);

  if (!fs.existsSync(p)) {
    throw new Error(`No existe el archivo: ${p}`);
  }

  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`El JSON debe ser un array. Archivo: ${p}`);
  }

  return parsed;
}

async function upsertTurnosPrecios(items) {
  let created = 0;
  let updated = 0;

  for (const it of items) {
    const tipo = it.tipo; // 'LABORATORIO' | 'ESPECIALIDAD'
    const nombre = String(it.nombre || "").trim();
    const plan = it.plan; // 'BASE' | 'ESMERALDA' | 'RUBI' | 'DORADO' | 'PARTICULAR'
    const valor = Number(it.valor);

    if (!tipo || !nombre || !plan) continue;
    if (!Number.isFinite(valor)) continue;

    const res = await prisma.turnosPrecio.upsert({
      where: {
        // @@unique([tipo, nombre, plan], name: "uniq_turnos_precio")
        uniq_turnos_precio: { tipo, nombre, plan },
      },
      create: {
        tipo,
        nombre,
        plan,
        valor: Math.round(valor),
        isActive: true,
      },
      update: {
        valor: Math.round(valor),
        isActive: true,
      },
    });

    if (res.createdAt.getTime() === res.updatedAt.getTime()) created++;
    else updated++;
  }

  return { created, updated };
}

async function upsertLaboralPrecios(items) {
  let created = 0;
  let updated = 0;

  for (const it of items) {
    const categoria = String(it.categoria || "").trim();
    const nombre = String(it.nombre || "").trim();
    const valorSocios = Number(it.valorSocios);
    const valorNoSocios = Number(it.valorNoSocios);

    if (!categoria || !nombre) continue;
    if (!Number.isFinite(valorSocios) || !Number.isFinite(valorNoSocios)) continue;

    const res = await prisma.laboralPrecio.upsert({
      where: {
        // @@unique([categoria, nombre], name: "uniq_laboral_precio")
        uniq_laboral_precio: { categoria, nombre },
      },
      create: {
        categoria,
        nombre,
        valorSocios: Math.round(valorSocios),
        valorNoSocios: Math.round(valorNoSocios),
        isActive: true,
      },
      update: {
        valorSocios: Math.round(valorSocios),
        valorNoSocios: Math.round(valorNoSocios),
        isActive: true,
      },
    });

    if (res.createdAt.getTime() === res.updatedAt.getTime()) created++;
    else updated++;
  }

  return { created, updated };
}

async function main() {
  const turnos = readJson("./imports/turnos_precios_import.json");
  const prestaciones = readJson("./imports/laboral_prestaciones_noviembre_2025.json");

  console.log(`[Seed] Turnos items: ${turnos.length}`);
  console.log(`[Seed] Laboral prestaciones items: ${prestaciones.length}`);

  const r1 = await upsertTurnosPrecios(turnos);
  const r2 = await upsertLaboralPrecios(prestaciones);

  console.log("[TurnosPrecio]", r1);
  console.log("[LaboralPrecio]", r2);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
