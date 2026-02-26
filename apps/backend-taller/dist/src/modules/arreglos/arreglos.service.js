"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArreglosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const moviles_service_1 = require("../moviles/moviles.service");
let ArreglosService = class ArreglosService {
    constructor(prisma, moviles) {
        this.prisma = prisma;
        this.moviles = moviles;
    }
    // ✅ SOLO ACTIVOS (archived=false) para Kanban/Inbox
    async listByMovil(movilIdRaw) {
        const m = await this.moviles.ensureMovil(movilIdRaw);
        return this.prisma.arreglo.findMany({
            where: { movilId: m.id, archived: false },
            orderBy: { createdAt: 'desc' },
            include: { tareas: { orderBy: { orden: 'asc' } } },
        });
    }
    async create(dto) {
        const m = await this.moviles.ensureMovil(dto.movilId);
        const tareas = (dto.tareas || []).map((t, i) => ({
            texto: String(t.texto || '').trim(),
            completa: !!t.completa,
            orden: Number.isFinite(Number(t.orden)) ? Number(t.orden) : i,
        }));
        const row = await this.prisma.arreglo.create({
            data: {
                movilId: m.id,
                patenteSnap: dto.patente?.toUpperCase?.() ?? null,
                fechaISO: dto.fechaISO ?? null,
                motivo: dto.motivo ?? null,
                anotaciones: dto.anotaciones ?? null,
                prioridad: dto.prioridad ?? 'baja',
                archived: false,
                archivedAt: null,
                tareas: { create: tareas },
            },
            include: { tareas: { orderBy: { orden: 'asc' } } },
        });
        return {
            id: row.id,
            movilId: m.id,
            patente: row.patenteSnap,
            fecha: row.fechaISO,
            motivo: row.motivo,
            anotaciones: row.anotaciones,
            prioridad: row.prioridad,
            tareas: row.tareas.map((t) => ({
                id: t.id,
                texto: t.texto,
                completa: t.completa,
                orden: t.orden,
            })),
            createdAt: row.createdAt,
        };
    }
    async update(id, dto) {
        const exists = await this.prisma.arreglo.findUnique({ where: { id } });
        if (!exists)
            throw new common_1.NotFoundException('Arreglo no encontrado');
        if (dto.tareas) {
            await this.prisma.tarea.deleteMany({ where: { arregloId: id } });
            const tareas = dto.tareas.map((t, i) => ({
                arregloId: id,
                texto: String(t.texto || '').trim(),
                completa: !!t.completa,
                orden: Number.isFinite(Number(t.orden)) ? Number(t.orden) : i,
            }));
            if (tareas.length)
                await this.prisma.tarea.createMany({ data: tareas });
        }
        const row = await this.prisma.arreglo.update({
            where: { id },
            data: {
                patenteSnap: dto.patente?.toUpperCase?.() ?? undefined,
                fechaISO: dto.fechaISO ?? undefined,
                motivo: dto.motivo ?? undefined,
                anotaciones: dto.anotaciones ?? undefined,
                prioridad: dto.prioridad ?? undefined,
            },
            include: { tareas: { orderBy: { orden: 'asc' } } },
        });
        return {
            id: row.id,
            movilId: row.movilId,
            patente: row.patenteSnap,
            fecha: row.fechaISO,
            motivo: row.motivo,
            anotaciones: row.anotaciones,
            prioridad: row.prioridad,
            tareas: row.tareas.map((t) => ({
                id: t.id,
                texto: t.texto,
                completa: t.completa,
                orden: t.orden,
            })),
            createdAt: row.createdAt,
        };
    }
    async remove(id) {
        await this.prisma.arreglo.delete({ where: { id } });
        return { ok: true };
    }
};
exports.ArreglosService = ArreglosService;
exports.ArreglosService = ArreglosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        moviles_service_1.MovilesService])
], ArreglosService);
