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
exports.HistorialService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const moviles_service_1 = require("../moviles/moviles.service");
function normPatente(x) {
    const s = String(x ?? '').trim();
    return s.length ? s.toUpperCase() : '';
}
function asPrioridad(x) {
    const v = String(x ?? 'baja').toLowerCase().trim();
    if (v === 'urgente' || v === 'alta' || v === 'baja')
        return v;
    return 'baja';
}
let HistorialService = class HistorialService {
    constructor(prisma, moviles) {
        this.prisma = prisma;
        this.moviles = moviles;
    }
    // ✅ resumen por patente como el sistema viejo
    async listResumen(movilIdRaw) {
        let movilDbId = null;
        // Si viene movilId=10, lo convertimos al id real (cuid) usando ensureMovil
        if (movilIdRaw && movilIdRaw.trim()) {
            const m = await this.moviles.ensureMovil(movilIdRaw);
            movilDbId = m.id;
        }
        // 1) Traemos todas las combinaciones (patente, movilId, prioridad) con counts
        //    y la última fecha por esa combinación.
        const rows = await this.prisma.historialDiaRow.groupBy({
            by: ['patente', 'movilId', 'prioridad'],
            where: {
                ...(movilDbId ? { movilId: movilDbId } : {}),
                patente: { not: null },
                fechaISO: { not: '' },
            },
            _count: { _all: true },
            _max: { fechaISO: true },
        });
        const map = new Map();
        for (const r of rows) {
            const patente = normPatente(r.patente);
            if (!patente)
                continue;
            const mId = String(r.movilId);
            const pr = asPrioridad(r.prioridad);
            const count = Number(r._count?._all ?? 0);
            const maxFecha = String(r._max?.fechaISO ?? '');
            const key = `${patente}__${mId}`;
            const cur = map.get(key) ??
                {
                    patente,
                    movilDbId: mId,
                    veces: 0,
                    ultima_fecha: '',
                    pr_baja: 0,
                    pr_alta: 0,
                    pr_urgente: 0,
                };
            cur.veces += count;
            // fechaISO "YYYY-MM-DD" => comparación lexicográfica sirve
            if (maxFecha && (!cur.ultima_fecha || maxFecha > cur.ultima_fecha)) {
                cur.ultima_fecha = maxFecha;
            }
            if (pr === 'baja')
                cur.pr_baja += count;
            if (pr === 'alta')
                cur.pr_alta += count;
            if (pr === 'urgente')
                cur.pr_urgente += count;
            map.set(key, cur);
        }
        const resumen = Array.from(map.values());
        // 3) Resolver "movil_id" real (numero) desde Movil
        const movilIds = Array.from(new Set(resumen.map((x) => x.movilDbId)));
        const moviles = await this.prisma.movil.findMany({
            where: { id: { in: movilIds } },
            select: { id: true, numero: true },
        });
        const numById = new Map(moviles.map((m) => [m.id, m.numero ?? null]));
        // 4) Shape final (como el viejo)
        const out = resumen
            .map((x) => ({
            patente: x.patente,
            movil_id: numById.get(x.movilDbId) ?? null, // ✅ número real
            veces: x.veces,
            ultima_fecha: x.ultima_fecha || null,
            pr_baja: x.pr_baja,
            pr_alta: x.pr_alta,
            pr_urgente: x.pr_urgente,
        }))
            .sort((a, b) => {
            // orden: última fecha desc, luego veces desc
            const fa = String(a.ultima_fecha ?? '');
            const fb = String(b.ultima_fecha ?? '');
            if (fa !== fb)
                return fb.localeCompare(fa);
            return Number(b.veces) - Number(a.veces);
        });
        return out;
    }
};
exports.HistorialService = HistorialService;
exports.HistorialService = HistorialService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        moviles_service_1.MovilesService])
], HistorialService);
