import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCompanyDto, UpdateCompanyDto } from './dto';

function normalizeText(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async list(params: { q?: string; filter?: 'actives' | 'inactive' | 'all' }) {
    const q = (params.q || '').trim();
    const filter = params.filter ?? 'actives';

    const where: Prisma.LaboralCompanyWhereInput = {};

    if (filter === 'actives') where.isActive = true;
    if (filter === 'inactive') where.isActive = false;

    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { cuit: { contains: q, mode: 'insensitive' } },
        { nroSocio: { contains: q, mode: 'insensitive' } },
        { contacto: { contains: q, mode: 'insensitive' } },
        { domicilio: { contains: q, mode: 'insensitive' } },
        { telefono: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
      void normalizeText(q);
    }

    return this.prisma.laboralCompany.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { nombre: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(dto: CreateCompanyDto, createdByUserId?: string) {
    const nombre = (dto.nombre || '').trim();
    if (!nombre) throw new BadRequestException('Empresa requerida');

    return this.prisma.laboralCompany.create({
      data: {
        nombre,
        nroSocio: (dto.nroSocio ?? '').trim() || null,
        cuit: (dto.cuit ?? '').trim() || null,
        contacto: (dto.contacto ?? '').trim() || null,
        telefono: (dto.telefono ?? '').trim() || null,
        email: (dto.email ?? '').trim() || null,
        domicilio: (dto.domicilio ?? '').trim() || null,
        notas: (dto.notas ?? '').trim() || null,
        createdByUserId: createdByUserId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const exists = await this.prisma.laboralCompany.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Empresa no encontrada');

    const data: Prisma.LaboralCompanyUpdateInput = {
      ...(dto.nombre !== undefined ? { nombre: dto.nombre.trim() } : {}),
      ...(dto.nroSocio !== undefined
        ? { nroSocio: dto.nroSocio.trim() || null }
        : {}),
      ...(dto.cuit !== undefined ? { cuit: dto.cuit.trim() || null } : {}),
      ...(dto.contacto !== undefined
        ? { contacto: dto.contacto.trim() || null }
        : {}),
      ...(dto.telefono !== undefined
        ? { telefono: dto.telefono.trim() || null }
        : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
      ...(dto.domicilio !== undefined
        ? { domicilio: dto.domicilio.trim() || null }
        : {}),
      ...(dto.notas !== undefined ? { notas: dto.notas.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    return this.prisma.laboralCompany.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.laboralCompany.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Empresa no encontrada');

    await this.prisma.laboralCompany.delete({ where: { id } });
    return { ok: true };
  }

  // ✅ padrón de empleados por empresa
  async padron(companyId: string) {
    const company = await this.prisma.laboralCompany.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    // Traemos empleados + su último turno (si tiene)
    const employees = await this.prisma.laboralEmployee.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ nombre: 'asc' }],
      select: {
        dni: true,
        nombre: true,
        nroAfiliado: true,
        puesto: true,
        turnos: {
          orderBy: [{ fechaTurnoISO: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          select: { fechaTurnoISO: true },
        },
      },
    });

    return employees.map((e) => ({
      dni: e.dni,
      nombre: e.nombre,
      nroAfiliado: e.nroAfiliado ?? '',
      puesto: e.puesto ?? '',
      lastTurnoISO: e.turnos[0]?.fechaTurnoISO ?? '',
    }));
  }

  // ✅ NUEVO: eliminar empleado del padrón (soft delete)
  async removeFromPadron(companyId: string, dni: string) {
    const company = await this.prisma.laboralCompany.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const dniClean = (dni || '').trim();
    if (!dniClean) throw new BadRequestException('DNI requerido');

    // Soft delete para no romper relaciones con turnos
    const updated = await this.prisma.laboralEmployee.updateMany({
      where: { companyId, dni: dniClean, isActive: true },
      data: { isActive: false },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Empleado no encontrado en el padrón');
    }

    return { ok: true };
  }
}
