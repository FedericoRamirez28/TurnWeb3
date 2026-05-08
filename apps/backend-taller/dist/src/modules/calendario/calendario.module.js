"use strict";
// apps/backend-taller/src/modules/calendario/calendario.module.ts
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalendarioModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const moviles_service_1 = require("../moviles/moviles.service");
const calendario_controller_1 = require("./calendario.controller");
const calendario_service_1 = require("./calendario.service");
let CalendarioModule = class CalendarioModule {
};
exports.CalendarioModule = CalendarioModule;
exports.CalendarioModule = CalendarioModule = __decorate([
    (0, common_1.Module)({
        controllers: [calendario_controller_1.CalendarioController],
        providers: [calendario_service_1.CalendarioService, prisma_service_1.PrismaService, moviles_service_1.MovilesService],
        exports: [calendario_service_1.CalendarioService],
    })
], CalendarioModule);
