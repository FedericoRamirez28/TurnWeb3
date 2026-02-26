"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const users_module_1 = require("./modules/users/users.module");
const auth_module_1 = require("./modules/auth/auth.module");
const jwt_or_public_guard_1 = require("./modules/auth/jwt-or-public.guard");
const moviles_module_1 = require("./modules/moviles/moviles.module");
const arreglos_module_1 = require("./modules/arreglos/arreglos.module");
const finalizados_module_1 = require("./modules/finalizados/finalizados.module");
const historial_dia_module_1 = require("./modules/historial-dia/historial-dia.module");
const calendario_module_1 = require("./modules/calendario/calendario.module");
const historial_module_1 = require("./modules/historial/historial.module");
const parte_diario_module_1 = require("./modules/parte-diario/parte-diario.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            auth_module_1.AuthModule,
            moviles_module_1.MovilesModule,
            arreglos_module_1.ArreglosModule,
            finalizados_module_1.FinalizadosModule,
            historial_dia_module_1.HistorialDiaModule,
            historial_module_1.HistorialModule,
            calendario_module_1.CalendarioModule,
            parte_diario_module_1.ParteDiarioModule,
        ],
        providers: [{ provide: core_1.APP_GUARD, useClass: jwt_or_public_guard_1.JwtOrPublicGuard }],
    })
], AppModule);
