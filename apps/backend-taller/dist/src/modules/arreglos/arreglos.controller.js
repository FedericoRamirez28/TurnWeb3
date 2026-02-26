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
exports.ArreglosController = void 0;
// src/modules/arreglos/arreglos.controller.ts
const common_1 = require("@nestjs/common");
const arreglos_service_1 = require("./arreglos.service");
const arreglos_dto_1 = require("./dto/arreglos.dto");
let ArreglosController = class ArreglosController {
    constructor(svc) {
        this.svc = svc;
    }
    async list(movilId) {
        try {
            if (!movilId)
                return { ok: true, data: [] };
            const data = await this.svc.listByMovil(String(movilId));
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async create(dto) {
        try {
            const data = await this.svc.create(dto);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async update(id, dto) {
        try {
            const data = await this.svc.update(id, dto);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
    async remove(id) {
        try {
            const data = await this.svc.remove(id);
            return { ok: true, data };
        }
        catch (e) {
            return { ok: false, error: e?.message || 'Error' };
        }
    }
};
exports.ArreglosController = ArreglosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('movilId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ArreglosController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [arreglos_dto_1.CreateArregloDto]),
    __metadata("design:returntype", Promise)
], ArreglosController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, arreglos_dto_1.UpdateArregloDto]),
    __metadata("design:returntype", Promise)
], ArreglosController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ArreglosController.prototype, "remove", null);
exports.ArreglosController = ArreglosController = __decorate([
    (0, common_1.Controller)('arreglos'),
    __metadata("design:paramtypes", [arreglos_service_1.ArreglosService])
], ArreglosController);
