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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovilesController = void 0;
const common_1 = require("@nestjs/common");
const moviles_service_1 = require("./moviles.service");
let MovilesController = class MovilesController {
    constructor(svc) {
        this.svc = svc;
    }
    async infoMap() {
        try {
            const data = await this.svc.getInfoMap();
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async prioridadesMap() {
        try {
            const data = await this.svc.getPrioridadesMap();
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async info(id) {
        try {
            const data = await this.svc.getInfo(id);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async ultimoParte(id) {
        try {
            const data = await this.svc.getUltimoParte(id);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async crearParte(id, body) {
        try {
            const data = await this.svc.createParteDiario(id, body || {});
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async kmAcum(id) {
        try {
            const data = await this.svc.getKmAcumulado(id);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async getVtv(id) {
        try {
            const data = await this.svc.getVtv(id);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async putVtv(id, body) {
        try {
            const data = await this.svc.putVtv(id, body?.fecha ?? null);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    /* ===========================
       ✅ CALENDARIO (PERSISTENTE)
       =========================== */
    // GET /moviles/:id/calendario?from=YYYY-MM-DD&to=YYYY-MM-DD
    async calendario(id, from, to) {
        try {
            const data = await this.svc.getCalendarioEventos(id, { from, to });
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    // GET /moviles/:id/calendario/dia?fecha=YYYY-MM-DD
    async calendarioDia(id, fecha) {
        try {
            const data = await this.svc.getCalendarioDiaDetalle(id, fecha);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
};
exports.MovilesController = MovilesController;
__decorate([
    (0, common_1.Get)('info-map'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "infoMap", null);
__decorate([
    (0, common_1.Get)('prioridades-map'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "prioridadesMap", null);
__decorate([
    (0, common_1.Get)(':id/info'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "info", null);
__decorate([
    (0, common_1.Get)(':id/parte-diario/ultimo'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "ultimoParte", null);
__decorate([
    (0, common_1.Post)(':id/parte-diario'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "crearParte", null);
__decorate([
    (0, common_1.Get)(':id/km-acumulado'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "kmAcum", null);
__decorate([
    (0, common_1.Get)(':id/vtv'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "getVtv", null);
__decorate([
    (0, common_1.Put)(':id/vtv'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "putVtv", null);
__decorate([
    (0, common_1.Get)(':id/calendario'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "calendario", null);
__decorate([
    (0, common_1.Get)(':id/calendario/dia'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('fecha')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MovilesController.prototype, "calendarioDia", null);
exports.MovilesController = MovilesController = __decorate([
    (0, common_1.Controller)('moviles'),
    __metadata("design:paramtypes", [moviles_service_1.MovilesService])
], MovilesController);
