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
exports.HistorialDiaController = void 0;
const common_1 = require("@nestjs/common");
const historial_dia_service_1 = require("./historial-dia.service");
let HistorialDiaController = class HistorialDiaController {
    constructor(svc) {
        this.svc = svc;
    }
    /**
     * ✅ /historial-dia?fecha=YYYY-MM-DD&movilId=10
     * ✅ /historial-dia?fecha=YYYY-MM-DD&movil_id=10
     * ✅ /historial-dia?fecha=YYYY-MM-DD        -> GLOBAL (todos)
     */
    async list(fecha, movilIdA, movilIdB) {
        try {
            const f = String(fecha || '').trim();
            const movilRaw = String(movilIdA || movilIdB || '').trim();
            if (!f)
                return { ok: true, data: [] };
            const data = movilRaw
                ? await this.svc.listByMovil(movilRaw, f)
                : await this.svc.listAll(f);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    // ✅ lo usa KanbanBoard
    async updateByArregloId(body) {
        try {
            const arregloId = String(body?.arreglo_id || '').trim();
            if (!arregloId)
                return { ok: false, error: 'Falta arreglo_id' };
            const salidaIndefinida = !!body?.salida_indefinida;
            const horaSalida = salidaIndefinida ? null : (body?.hora_salida ?? null);
            const data = await this.svc.updateByArregloId(arregloId, {
                horaSalida,
                salidaIndefinida,
            });
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
};
exports.HistorialDiaController = HistorialDiaController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('fecha')),
    __param(1, (0, common_1.Query)('movilId')),
    __param(2, (0, common_1.Query)('movil_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], HistorialDiaController.prototype, "list", null);
__decorate([
    (0, common_1.Put)('update-by-arreglo-id'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], HistorialDiaController.prototype, "updateByArregloId", null);
exports.HistorialDiaController = HistorialDiaController = __decorate([
    (0, common_1.Controller)('historial-dia'),
    __metadata("design:paramtypes", [historial_dia_service_1.HistorialDiaService])
], HistorialDiaController);
