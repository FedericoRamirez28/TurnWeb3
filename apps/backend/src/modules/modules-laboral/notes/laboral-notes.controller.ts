// apps/backend/src/modules/laboral/notes/laboral-notes.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtCookieAuthGuard } from '../../auth/jwt-cookie.guard';
import { LaboralNotesService } from './laboral-notes.service';
import { CreateLaboralNoteDto, UpdateLaboralNoteDto } from './dto';

type AuthedReq = Request & { user?: unknown };

type NoteColor = 'mint' | 'sky' | 'lilac' | 'peach' | 'lemon' | 'stone';

type NoteRow = {
  id: string;
  text: string;
  color: NoteColor;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Contrato mínimo del service para que ESLint/TS no lo trate como "error typed".
 * (Esto evita que "rows" sea tipo error/any)
 */
type NotesServiceContract = {
  list: (userId: string) => Promise<unknown>;
  create: (dto: CreateLaboralNoteDto, userId: string) => Promise<unknown>;
  update: (
    id: string,
    dto: UpdateLaboralNoteDto,
    userId: string,
  ) => Promise<unknown>;
  remove: (id: string, userId: string) => Promise<unknown>;
};

function getUserIdOrThrow(req: AuthedReq): string {
  const u = req.user;
  if (!u || typeof u !== 'object')
    throw new UnauthorizedException('No autenticado');
  const sub = (u as Record<string, unknown>)['sub'];
  if (typeof sub !== 'string' || !sub.trim()) {
    throw new UnauthorizedException('Token inválido (sub faltante)');
  }
  return sub;
}

function isDate(v: unknown): v is Date {
  return v instanceof Date && !Number.isNaN(v.getTime());
}

function normalizeNoteRow(x: unknown): NoteRow | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;

  const id = o.id;
  const text = o.text;
  const color = o.color;
  const createdAt = o.createdAt;
  const updatedAt = o.updatedAt;

  if (typeof id !== 'string') return null;
  if (typeof text !== 'string') return null;

  // color lo dejamos en whitelist; si viene algo raro, lo bajamos a "mint"
  const allowed: NoteColor[] = [
    'mint',
    'sky',
    'lilac',
    'peach',
    'lemon',
    'stone',
  ];
  const safeColor: NoteColor =
    typeof color === 'string' && (allowed as string[]).includes(color)
      ? (color as NoteColor)
      : 'mint';

  if (!isDate(createdAt)) return null;
  if (!isDate(updatedAt)) return null;

  return { id, text, color: safeColor, createdAt, updatedAt };
}

@Controller('laboral/notes')
@UseGuards(JwtCookieAuthGuard)
export class LaboralNotesController {
  constructor(private service: LaboralNotesService) {}

  private svc(): NotesServiceContract {
    // casteamos una sola vez a contrato mínimo (sin any)
    return this.service as unknown as NotesServiceContract;
  }

  @Get()
  async list(@Req() req: AuthedReq) {
    const userId = getUserIdOrThrow(req);

    const raw = await this.svc().list(userId);
    const arr = Array.isArray(raw) ? raw : (raw as { items?: unknown }).items;
    const rowsUnknown = Array.isArray(arr) ? arr : [];

    const items = rowsUnknown
      .map((n) => normalizeNoteRow(n))
      .filter((n): n is NoteRow => Boolean(n))
      .map((n) => ({
        id: n.id,
        text: n.text,
        color: n.color,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      }));

    return { items };
  }

  @Post()
  async create(@Req() req: AuthedReq, @Body() dto: CreateLaboralNoteDto) {
    const userId = getUserIdOrThrow(req);

    const raw = await this.svc().create(dto, userId);
    const row = normalizeNoteRow((raw as { item?: unknown }).item ?? raw);
    if (!row) {
      // si el service devuelve otra forma, preferimos fallar explícito
      throw new Error('Respuesta inválida del servicio (create)');
    }

    return {
      item: {
        id: row.id,
        text: row.text,
        color: row.color,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() dto: UpdateLaboralNoteDto,
  ) {
    const userId = getUserIdOrThrow(req);

    const raw = await this.svc().update(id, dto, userId);
    const row = normalizeNoteRow((raw as { item?: unknown }).item ?? raw);
    if (!row) {
      throw new Error('Respuesta inválida del servicio (update)');
    }

    return {
      item: {
        id: row.id,
        text: row.text,
        color: row.color,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    };
  }

  @Delete(':id')
  async remove(@Req() req: AuthedReq, @Param('id') id: string) {
    const userId = getUserIdOrThrow(req);
    return this.svc().remove(id, userId);
  }
}
