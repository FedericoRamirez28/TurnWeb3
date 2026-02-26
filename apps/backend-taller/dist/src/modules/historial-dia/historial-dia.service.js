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
exports.HistorialDiaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const moviles_service_1 = require("../moviles/moviles.service");
function isISODateDay(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function nowHHMM() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}
function normStr(v) {
    const s = String(v ?? '').trim();
    return s.length ? s : null;
}
let HistorialDiaService = class HistorialDiaService {
    constructor(prisma, moviles) {
        this.prisma = prisma;
        this.moviles = moviles;
    }
    // ✅ GLOBAL: todos los móviles por fecha
    async listAll(fechaISO) {
        const rows = await this.prisma.historialDiaRow.findMany({
            where: { fechaISO },
            orderBy: [{ horaEntrada: 'asc' }, { createdAt: 'asc' }],
            include: { movil: { select: { numero: true } } },
        });
        return rows.map((r) => ({
            id: r.id,
            movil_numero: r.movil?.numero ?? null,
            hora_entrada: r.horaEntrada,
            hora_salida: r.horaSalida,
            salida_indefinida: r.salidaIndefinida,
            patente: r.patente,
            motivo: r.motivo,
            prioridad: r.prioridad,
            anotaciones: r.anotaciones,
        }));
    }
    // ✅ POR MÓVIL
    async listByMovil(movilIdRaw, fechaISO) {
        const m = await this.moviles.ensureMovil(movilIdRaw);
        const rows = await this.prisma.historialDiaRow.findMany({
            where: { movilId: m.id, fechaISO },
            orderBy: [{ horaEntrada: 'asc' }, { createdAt: 'asc' }],
        });
        return rows.map((r) => ({
            id: r.id,
            movil_numero: m.numero ?? null,
            hora_entrada: r.horaEntrada,
            hora_salida: r.horaSalida,
            salida_indefinida: r.salidaIndefinida,
            patente: r.patente,
            motivo: r.motivo,
            prioridad: r.prioridad,
            anotaciones: r.anotaciones,
        }));
    }
    // ✅ lo que usa KanbanBoard cuando pasa a Done (o vuelve de Done)
    async updateByArregloId(arregloId, patch) {
        const arreglo = await this.prisma.arreglo.findUnique({
            where: { id: arregloId },
            include: { movil: true },
        });
        if (!arreglo)
            throw new common_1.NotFoundException('Arreglo no encontrado');
        const movilId = arreglo.movilId;
        const fechaISO = isISODateDay(String(arreglo.fechaISO || '')) ? arreglo.fechaISO : todayISO();
        await this.prisma.historialDiaRow.upsert({
            where: { arregloId },
            create: {
                movilId,
                arregloId,
                fechaISO,
                horaEntrada: nowHHMM(),
                horaSalida: patch.salidaIndefinida ? null : patch.horaSalida,
                salidaIndefinida: patch.salidaIndefinida,
                patente: normStr(arreglo.patenteSnap),
                motivo: normStr(arreglo.motivo),
                prioridad: arreglo.prioridad ?? 'baja',
                anotaciones: normStr(arreglo.anotaciones),
            },
            update: {
                horaSalida: patch.salidaIndefinida ? null : patch.horaSalida,
                salidaIndefinida: patch.salidaIndefinida,
                fechaISO,
                patente: normStr(arreglo.patenteSnap),
                motivo: normStr(arreglo.motivo),
                prioridad: arreglo.prioridad ?? 'baja',
                anotaciones: normStr(arreglo.anotaciones),
            },
        });
        return { ok: true };
    }
};
exports.HistorialDiaService = HistorialDiaService;
exports.HistorialDiaService = HistorialDiaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        moviles_service_1.MovilesService])
], HistorialDiaService);
