import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    })
  }

  async createUser(params: { email: string; password: string; role?: UserRole; isActive?: boolean }) {
    const passwordHash = await bcrypt.hash(params.password, 10)
    return this.prisma.user.create({
      data: {
        email: params.email.trim().toLowerCase(),
        passwordHash,
        role: params.role ?? UserRole.MECANICO,
        isActive: params.isActive ?? true,
      },
    })
  }

  // ✅ lo que devolvemos al frontend (sin hash)
  toSafeUser(u: any) {
    if (!u) return null
    const { passwordHash, ...rest } = u
    return rest
  }
}
