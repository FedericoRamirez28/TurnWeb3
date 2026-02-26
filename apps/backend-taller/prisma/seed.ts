import { PrismaClient, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@taller.local'
  const plain = 'admin1234'

  const exists = await prisma.user.findUnique({ where: { email } })
  if (exists) {
    console.log(`[seed] Admin ya existe: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(plain, 10)

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
  })

  console.log(`[seed] Admin creado: ${email} / ${plain}`)
}

main()
  .catch((e) => {
    console.error('[seed] error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
