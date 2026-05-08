"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArreglosModule = void 0;
const common_1 = require("@nestjs/common");
const arreglos_controller_1 = require("./arreglos.controller");
const arreglos_service_1 = require("./arreglos.service");
const moviles_service_1 = require("../moviles/moviles.service");
let ArreglosModule = class ArreglosModule {
};
exports.ArreglosModule = ArreglosModule;
exports.ArreglosModule = ArreglosModule = __decorate([
    (0, common_1.Module)({
        controllers: [arreglos_controller_1.ArreglosController],
        providers: [arreglos_service_1.ArreglosService, moviles_service_1.MovilesService],
    })
], ArreglosModule);
