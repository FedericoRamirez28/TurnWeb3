"use strict";
// apps/backend-taller/src/modules/calendario/calendario.controller.ts
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
exports.CalendarioController = void 0;
const common_1 = require("@nestjs/common");
const calendario_service_1 = require("./calendario.service");
let CalendarioController = class CalendarioController {
    constructor(svc) {
        this.svc = svc;
    }
    async calendario(id, from, to) {
        try {
            const data = await this.svc.getCalendario(id, { from, to });
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    // ✅ NUEVO: detalle del día (para modal lectura)
    async detalleDia(id, fecha) {
        try {
            const data = await this.svc.getDetalleDia(id, fecha);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
};
exports.CalendarioController = CalendarioController;
__decorate([
    (0, common_1.Get)(':id/calendario'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CalendarioController.prototype, "calendario", null);
__decorate([
    (0, common_1.Get)(':id/calendario/dia'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('fecha')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CalendarioController.prototype, "detalleDia", null);
exports.CalendarioController = CalendarioController = __decorate([
    (0, common_1.Controller)('moviles'),
    __metadata("design:paramtypes", [calendario_service_1.CalendarioService])
], CalendarioController);
