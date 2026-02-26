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
exports.ParteDiarioService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
function isDigits(s) {
    return /^[0-9]+$/.test(String(s || '').trim());
}
let ParteDiarioService = class ParteDiarioService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    checkKey(dto) {
        const configured = String(process.env.PARTE_DIARIO_KEY || '').trim();
        if (!configured)
            return;
        const got = String(dto.pd_key || '').trim();
        if (!got || got !== configured)
            throw new common_1.UnauthorizedException('pd_key inválida');
    }
    /** Acepta "10" (numero) o "cuid" (id) y devuelve el Movil real */
    async resolveMovil(param) {
        const raw = String(param || '').trim();
        if (!raw)
            throw new common_1.NotFoundException('Móvil inválido');
        let movil = isDigits(raw)
            ? await this.prisma.movil.findUnique({ where: { numero: Number(raw) } })
            : await this.prisma.movil.findUnique({ where: { id: raw } });
        if (!movil)
            throw new common_1.NotFoundException('Móvil no encontrado');
        return movil;
    }
    async crear(movilParam, dto) {
        this.checkKey(dto);
        const movil = await this.resolveMovil(movilParam);
        // fecha del parte (día). Guardamos DateTime a partir del YYYY-MM-DD
        const fechaISO = (dto.fecha || todayISO()).slice(0, 10);
        const fecha = new Date(`${fechaISO}T00:00:00.000Z`);
        const patente = String(dto.patente || '').trim().toUpperCase();
        const chofer = String(dto.chofer || '').trim();
        const kmInicio = Number(dto.km_inicio);
        const kmFin = Number(dto.km_fin);
        if (!patente || !chofer || !Number.isFinite(kmInicio) || !Number.isFinite(kmFin)) {
            // validación extra, por si llegan strings raras
            throw new Error('Datos inválidos');
        }
        const created = await this.prisma.parteDiario.create({
            data: {
                movilId: movil.id,
                fecha,
                patente,
                chofer,
                kmInicio: Math.trunc(kmInicio),
                kmFin: Math.trunc(kmFin),
                observaciones: dto.observaciones ? String(dto.observaciones).trim() : null,
            },
            select: { id: true, createdAt: true },
        });
        return created;
    }
    async ultimo(movilParam) {
        const movil = await this.resolveMovil(movilParam);
        const row = await this.prisma.parteDiario.findFirst({
            where: { movilId: movil.id },
            orderBy: [{ createdAt: 'desc' }],
            select: {
                fecha: true,
                patente: true,
                chofer: true,
                kmInicio: true,
                kmFin: true,
                observaciones: true,
                createdAt: true,
            },
        });
        if (!row)
            return null;
        // ✅ shape compatible con tu ArreglosScreen
        return {
            fechaISO: row.fecha.toISOString().slice(0, 10),
            patente: row.patente ?? null,
            chofer: row.chofer ?? null,
            km_inicio: row.kmInicio ?? null,
            km_fin: row.kmFin ?? null,
            observaciones: row.observaciones ?? null,
            createdAt: row.createdAt.toISOString(),
        };
    }
    /** (Opcional) listar partes del día para calendario */
    async porDia(movilParam, fechaISO) {
        const movil = await this.resolveMovil(movilParam);
        const iso = String(fechaISO || '').slice(0, 10);
        const d0 = new Date(`${iso}T00:00:00.000Z`);
        const d1 = new Date(`${iso}T23:59:59.999Z`);
        const rows = await this.prisma.parteDiario.findMany({
            where: { movilId: movil.id, fecha: { gte: d0, lte: d1 } },
            orderBy: [{ createdAt: 'desc' }],
            select: {
                id: true,
                fecha: true,
                chofer: true,
                kmInicio: true,
                kmFin: true,
                createdAt: true,
            },
        });
        return rows.map((p) => ({
            id: p.id,
            fechaISO: p.fecha.toISOString().slice(0, 10),
            chofer: p.chofer ?? null,
            km_inicio: p.kmInicio ?? null,
            km_fin: p.kmFin ?? null,
            createdAt: p.createdAt.toISOString(),
        }));
    }
};
exports.ParteDiarioService = ParteDiarioService;
exports.ParteDiarioService = ParteDiarioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ParteDiarioService);
