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
exports.ParteDiarioController = void 0;
const common_1 = require("@nestjs/common");
const parte_diario_service_1 = require("./parte-diario.service");
const create_parte_diario_dto_1 = require("./dto/create-parte-diario.dto");
const public_decorator_1 = require("../auth/public.decorator");
let ParteDiarioController = class ParteDiarioController {
    constructor(service) {
        this.service = service;
    }
    // ✅ público para chofer
    async crear(movilId, dto) {
        const created = await this.service.crear(movilId, dto);
        return { ok: true, data: { id: created.id, createdAt: created.createdAt } };
    }
    // ✅ lo usa ArreglosScreen
    async ultimo(movilId) {
        const data = await this.service.ultimo(movilId);
        return { ok: true, data };
    }
    // (opcional) por día: útil si querés anexarlo a calendario
    async porDia(movilId, fecha) {
        const data = await this.service.porDia(movilId, fecha);
        return { ok: true, data };
    }
};
exports.ParteDiarioController = ParteDiarioController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)(':movilId/parte-diario'),
    __param(0, (0, common_1.Param)('movilId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_parte_diario_dto_1.CreateParteDiarioDto]),
    __metadata("design:returntype", Promise)
], ParteDiarioController.prototype, "crear", null);
__decorate([
    (0, common_1.Get)(':movilId/parte-diario/ultimo'),
    __param(0, (0, common_1.Param)('movilId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ParteDiarioController.prototype, "ultimo", null);
__decorate([
    (0, common_1.Get)(':movilId/parte-diario/dia'),
    __param(0, (0, common_1.Param)('movilId')),
    __param(1, (0, common_1.Query)('fecha')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ParteDiarioController.prototype, "porDia", null);
exports.ParteDiarioController = ParteDiarioController = __decorate([
    (0, common_1.Controller)('moviles'),
    __metadata("design:paramtypes", [parte_diario_service_1.ParteDiarioService])
], ParteDiarioController);
