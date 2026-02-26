"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new client_1.PrismaClient();
async function main() {
    const email = 'admin@taller.local';
    const plain = 'admin1234';
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
        console.log(`[seed] Admin ya existe: ${email}`);
        return;
    }
    const passwordHash = await bcrypt.hash(plain, 10);
    await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: client_1.UserRole.ADMIN,
            isActive: true,
        },
    });
    console.log(`[seed] Admin creado: ${email} / ${plain}`);
}
main()
    .catch((e) => {
    console.error('[seed] error:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
