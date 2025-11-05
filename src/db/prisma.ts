import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; __PRISMA_MOCK__?: any };

const injected = (globalForPrisma as any).__PRISMA_MOCK__ as PrismaClient | undefined;

export const prisma =
  injected ??
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

if (!injected && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
