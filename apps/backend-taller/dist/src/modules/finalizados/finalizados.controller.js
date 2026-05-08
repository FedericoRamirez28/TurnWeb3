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
exports.FinalizadosController = void 0;
const common_1 = require("@nestjs/common");
const finalizados_service_1 = require("./finalizados.service");
let FinalizadosController = class FinalizadosController {
    constructor(svc) {
        this.svc = svc;
    }
    // ✅ GET /finalizados?movilId=10
    async list(movilId) {
        try {
            const data = await this.svc.list(movilId ? String(movilId) : null);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    // ✅ POST /finalizados { arreglos: [...], movilId }
    async finalizar(body) {
        try {
            const data = await this.svc.finalizar(String(body?.movilId || ''), body?.arreglos || []);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
};
exports.FinalizadosController = FinalizadosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('movilId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], FinalizadosController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FinalizadosController.prototype, "finalizar", null);
exports.FinalizadosController = FinalizadosController = __decorate([
    (0, common_1.Controller)('finalizados'),
    __metadata("design:paramtypes", [finalizados_service_1.FinalizadosService])
], FinalizadosController);
