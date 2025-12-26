import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

function normalizeUsername(v: string): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async register(input: {
    username: string;
    password: string;
    displayName?: string;
  }) {
    const username = normalizeUsername(input.username);
    const password = String(input.password ?? '');
    const displayName = String(input.displayName ?? '').trim() || username;

    if (username.length < 3) {
      throw new BadRequestException('Usuario muy corto (mín 3)');
    }

    if (password.length < 4) {
      throw new BadRequestException('Contraseña muy corta (mín 4)');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      return await this.prisma.user.create({
        data: {
          username,
          displayName,
          passwordHash,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          activo: true,
        },
      });
    } catch (e: unknown) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Ese usuario ya existe');
      }
      throw e;
    }
  }

  async validate(usernameRaw: string, passwordRaw: string) {
    const username = normalizeUsername(usernameRaw);
    const password = String(passwordRaw ?? '');

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.activo) {
      throw new BadRequestException('Credenciales inválidas');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Credenciales inválidas');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
  }

  // ===== RECUPERAR CONTRASEÑA =====

  async createPasswordResetToken(usernameRaw: string): Promise<string> {
    const username = normalizeUsername(usernameRaw);
    if (!username) {
      throw new BadRequestException('Usuario requerido');
    }

    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.activo) {
      throw new BadRequestException('No se pudo iniciar el proceso');
    }

    const token =
      randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    return token;
  }

  async resetPasswordWithToken(
    tokenRaw: string,
    newPasswordRaw: string,
  ): Promise<void> {
    const token = String(tokenRaw ?? '').trim();
    const newPassword = String(newPasswordRaw ?? '');

    if (token.length < 10) {
      throw new BadRequestException('Token inválido');
    }

    if (newPassword.length < 4) {
      throw new BadRequestException('Contraseña muy corta (mín 4)');
    }

    const pr = await this.prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!pr || pr.usedAt) {
      throw new BadRequestException('Token inválido o usado');
    }

    if (pr.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token vencido');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: pr.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { token },
        data: { usedAt: new Date() },
      }),
    ]);
  }
}
