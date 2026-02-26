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
exports.HistorialController = void 0;
const common_1 = require("@nestjs/common");
const historial_service_1 = require("./historial.service");
let HistorialController = class HistorialController {
    constructor(svc) {
        this.svc = svc;
    }
    // ✅ GET /historial?movilId=10 (opcional)
    async list(movilId) {
        try {
            const data = await this.svc.listResumen(movilId ? String(movilId) : null);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
};
exports.HistorialController = HistorialController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('movilId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HistorialController.prototype, "list", null);
exports.HistorialController = HistorialController = __decorate([
    (0, common_1.Controller)('historial'),
    __metadata("design:paramtypes", [historial_service_1.HistorialService])
], HistorialController);
