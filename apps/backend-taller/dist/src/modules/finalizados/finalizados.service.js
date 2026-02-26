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
exports.FinalizadosService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const moviles_service_1 = require("../moviles/moviles.service");
function arr(x) {
    return Array.isArray(x) ? x : [];
}
function str(x) {
    const s = String(x ?? '').trim();
    return s.length ? s : '';
}
function toNumOrNull(x) {
    if (x === null || x === undefined)
        return null;
    const s = String(x).trim();
    if (!s)
        return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}
let FinalizadosService = class FinalizadosService {
    constructor(prisma, moviles) {
        this.prisma = prisma;
        this.moviles = moviles;
    }
    async list(movilIdRaw) {
        let movilId = null;
        if (movilIdRaw && movilIdRaw.trim()) {
            const m = await this.moviles.ensureMovil(movilIdRaw);
            movilId = m.id;
        }
        const rows = await this.prisma.finalizadoItem.findMany({
            where: movilId ? { movilId } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                movil: { select: { numero: true } },
            },
        });
        return rows.map((r) => {
            const p = r.payload ?? {};
            const tareas = arr(p?.tareas);
            const numeroReal = toNumOrNull(r.movil?.numero);
            return {
                id: r.id,
                movilNumero: numeroReal,
                movil_id: numeroReal, // compat frontend actual
                patente: str(p?.patente ?? p?.patenteSnap ?? p?.patente_fija ?? p?.patenteFija),
                fecha: str(p?.fecha ?? p?.fechaISO ?? p?.fecha_iso),
                anotaciones: str(p?.anotaciones),
                prioridad: (p?.prioridad ?? null),
                tareas: tareas.map((t) => ({
                    texto: str(t?.texto ?? t?.text),
                    completa: !!(t?.completa ?? t?.done ?? false),
                })),
                createdAt: r.createdAt,
            };
        });
    }
    async finalizar(movilIdRaw, arreglosPayload) {
        const m = await this.moviles.ensureMovil(movilIdRaw);
        const payloads = (arreglosPayload || []).filter(Boolean);
        // 1) guardo snapshots
        await this.prisma.finalizadoItem.createMany({
            data: payloads.map((p) => ({
                movilId: m.id,
                payload: p,
            })),
        });
        // 2) ✅ NO borro: ARCHIVO (para que el calendario mantenga el dot)
        const ids = payloads
            .map((p) => p?.id)
            .filter((x) => typeof x === 'string' && x.length > 0);
        if (ids.length) {
            await this.prisma.arreglo.updateMany({
                where: { id: { in: ids } },
                data: { archived: true, archivedAt: new Date() },
            });
        }
        return { ok: true };
    }
};
exports.FinalizadosService = FinalizadosService;
exports.FinalizadosService = FinalizadosService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        moviles_service_1.MovilesService])
], FinalizadosService);
