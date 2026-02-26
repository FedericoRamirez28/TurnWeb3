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
exports.MovilesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
/* ================= Utils ================= */
function n(x) {
    const v = Number(x);
    return Number.isFinite(v) ? v : 0;
}
function isISODateDay(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function normPrio(p) {
    const x = String(p ?? '').trim().toLowerCase();
    if (x === 'urgente')
        return 'urgente';
    if (x === 'alta')
        return 'alta';
    return 'baja';
}
function rank(p) {
    return p === 'urgente' ? 3 : p === 'alta' ? 2 : 1;
}
function isoFromDate(d) {
    return d.toISOString().slice(0, 10);
}
function dayBoundsUTC(iso) {
    const start = new Date(`${iso}T00:00:00.000Z`);
    const end = new Date(`${iso}T23:59:59.999Z`);
    return { start, end };
}
function arr(x) {
    return Array.isArray(x) ? x : [];
}
function str(x) {
    const s = String(x ?? '').trim();
    return s.length ? s : null;
}
let MovilesService = class MovilesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureMovil(movilId) {
        const asNum = Number(movilId);
        // Si viene "10" lo tratamos como numero
        if (Number.isFinite(asNum) && String(asNum) === String(movilId)) {
            const found = await this.prisma.movil.findFirst({ where: { numero: asNum } });
            if (found)
                return found;
            return this.prisma.movil.create({ data: { numero: asNum } });
        }
        // Si viene un cuid string
        const found = await this.prisma.movil.findUnique({ where: { id: movilId } });
        if (found)
            return found;
        return this.prisma.movil.create({ data: { id: movilId } });
    }
    /* ===========================
       Info / Parte diario / VTV
       =========================== */
    async getInfo(movilId) {
        const m = await this.ensureMovil(movilId);
        return { patente_fija: m.patenteFija ?? null };
    }
    async getUltimoParte(movilId) {
        const m = await this.ensureMovil(movilId);
        const row = await this.prisma.parteDiario.findFirst({
            where: { movilId: m.id },
            orderBy: { createdAt: 'desc' },
        });
        return row
            ? { chofer: row.chofer ?? null, km_inicio: row.kmInicio ?? null, km_fin: row.kmFin ?? null }
            : null;
    }
    async createParteDiario(movilId, dto) {
        const m = await this.ensureMovil(movilId);
        const kmInicio = dto.km_inicio == null ? null : Math.max(0, Math.trunc(n(dto.km_inicio)));
        const kmFin = dto.km_fin == null ? null : Math.max(0, Math.trunc(n(dto.km_fin)));
        const fecha = dto.fechaISO && isISODateDay(dto.fechaISO)
            ? new Date(`${dto.fechaISO}T12:00:00.000Z`) // mediodía para evitar corrimientos
            : new Date();
        const row = await this.prisma.parteDiario.create({
            data: {
                movilId: m.id,
                fecha,
                chofer: dto.chofer ?? null,
                kmInicio,
                kmFin,
            },
        });
        return {
            id: row.id,
            chofer: row.chofer ?? null,
            km_inicio: row.kmInicio ?? null,
            km_fin: row.kmFin ?? null,
            fechaISO: isoFromDate(row.fecha),
            createdAt: row.createdAt.toISOString(),
        };
    }
    async getKmAcumulado(movilId) {
        const m = await this.ensureMovil(movilId);
        const parts = await this.prisma.parteDiario.findMany({
            where: { movilId: m.id },
            orderBy: { createdAt: 'asc' },
            select: { kmInicio: true, kmFin: true },
        });
        let acum = 0;
        for (const p of parts) {
            const a = n(p.kmInicio);
            const b = n(p.kmFin);
            const delta = Math.max(0, b - a);
            acum += delta;
        }
        return { kmAcum: acum };
    }
    async getVtv(movilId) {
        const m = await this.ensureMovil(movilId);
        return { fecha: m.vtvFecha ? isoFromDate(m.vtvFecha) : null };
    }
    async putVtv(movilId, fechaISO) {
        const m = await this.ensureMovil(movilId);
        const v = fechaISO ? new Date(`${fechaISO}T00:00:00.000Z`) : null;
        await this.prisma.movil.update({ where: { id: m.id }, data: { vtvFecha: v } });
        return { ok: true };
    }
    /* ===========================
       Maps para HomeScreen
       =========================== */
    // map (numero) -> patenteFija
    async getInfoMap() {
        const rows = await this.prisma.movil.findMany({
            select: { id: true, numero: true, patenteFija: true },
        });
        const map = {};
        for (const r of rows) {
            const key = r.numero != null ? String(r.numero) : String(r.id);
            map[key] = String(r.patenteFija || '').toUpperCase();
        }
        return map;
    }
    // map (numero) -> prioridad máxima mirando Arreglo (activos)
    async getPrioridadesMap() {
        const rows = await this.prisma.arreglo.findMany({
            select: {
                prioridad: true,
                movil: { select: { numero: true, id: true } },
            },
        });
        const best = {};
        for (const r of rows) {
            const key = r.movil?.numero != null ? String(r.movil.numero) : String(r.movil?.id || '');
            if (!key)
                continue;
            const pr = normPrio(r.prioridad);
            const prev = best[key];
            if (!prev || rank(pr) > rank(prev))
                best[key] = pr;
        }
        return best;
    }
    /* ===========================
       ✅ CALENDARIO PERSISTENTE
       Fuente: HistorialDiaRow (NO Arreglo)
       =========================== */
    async getCalendarioEventos(movilId, range) {
        const m = await this.ensureMovil(movilId);
        const fromISO = range.from && isISODateDay(range.from) ? range.from : null;
        const toISO = range.to && isISODateDay(range.to) ? range.to : null;
        // fallback: mes actual si no viene bien
        const now = new Date();
        const fallbackFrom = isoFromDate(new Date(now.getFullYear(), now.getMonth(), 1));
        const fallbackTo = isoFromDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        const f = fromISO || fallbackFrom;
        const t = toISO || fallbackTo;
        const rows = await this.prisma.historialDiaRow.findMany({
            where: { movilId: m.id, fechaISO: { gte: f, lte: t } },
            select: { fechaISO: true, prioridad: true },
            orderBy: { fechaISO: 'asc' },
        });
        // agrupamos por día y elegimos prioridad máxima
        const byDay = new Map();
        for (const r of rows) {
            const day = r.fechaISO;
            const pr = normPrio(r.prioridad);
            const prev = byDay.get(day);
            if (!prev || rank(pr) > rank(prev))
                byDay.set(day, pr);
        }
        return Array.from(byDay.entries()).map(([fecha, prioridad]) => ({ fecha, prioridad }));
    }
    async getCalendarioDiaDetalle(movilId, fechaISO) {
        if (!fechaISO || !isISODateDay(fechaISO))
            throw new Error('Fecha inválida (YYYY-MM-DD)');
        const m = await this.ensureMovil(movilId);
        const { start, end } = dayBoundsUTC(fechaISO);
        // ✅ Arreglos del día (PERSISTENTES) desde HistorialDiaRow
        const hist = await this.prisma.historialDiaRow.findMany({
            where: { movilId: m.id, fechaISO },
            select: {
                id: true,
                arregloId: true,
                fechaISO: true,
                patente: true,
                motivo: true,
                anotaciones: true,
                prioridad: true,
                createdAt: true,
                payload: true, // ✅ requiere payload Json? en schema
            },
            orderBy: { createdAt: 'asc' },
        });
        // Partes del día (igual que antes)
        const partes = await this.prisma.parteDiario.findMany({
            where: {
                movilId: m.id,
                OR: [{ fecha: { gte: start, lte: end } }, { createdAt: { gte: start, lte: end } }],
            },
            select: {
                id: true,
                fecha: true,
                chofer: true,
                kmInicio: true,
                kmFin: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        let prioridadMax = 'baja';
        for (const h of hist) {
            const pr = normPrio(h.prioridad);
            if (rank(pr) > rank(prioridadMax))
                prioridadMax = pr;
        }
        return {
            fecha: fechaISO,
            prioridadMax,
            arreglos: hist.map((h) => {
                const p = h.payload ?? {};
                const tareas = arr(p?.tareas).map((t, i) => ({
                    id: String(t?.id ?? `${h.id}_t${i}`),
                    texto: String(t?.texto ?? t?.text ?? '').trim(),
                    completa: !!(t?.completa ?? t?.done ?? false),
                    orden: Number.isFinite(Number(t?.orden)) ? Number(t.orden) : i,
                }));
                return {
                    id: String(h.arregloId || h.id),
                    patenteSnap: str(h.patente),
                    fechaISO: h.fechaISO ?? null,
                    motivo: str(h.motivo),
                    anotaciones: str(h.anotaciones),
                    prioridad: normPrio(h.prioridad),
                    createdAt: (h.createdAt ?? new Date()).toISOString(),
                    tareas,
                };
            }),
            partes: partes.map((p) => ({
                id: p.id,
                fechaISO: p.fecha ? isoFromDate(p.fecha) : fechaISO,
                chofer: p.chofer ?? null,
                km_inicio: p.kmInicio ?? null,
                km_fin: p.kmFin ?? null,
                createdAt: (p.createdAt ?? new Date()).toISOString(),
            })),
        };
    }
};
exports.MovilesService = MovilesService;
exports.MovilesService = MovilesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MovilesService);
