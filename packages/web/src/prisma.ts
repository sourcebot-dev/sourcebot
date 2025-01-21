import 'server-only';
import { PrismaClient } from "@sourcebot/db";

// @see: https://authjs.dev/getting-started/adapters/prisma
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || new PrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma