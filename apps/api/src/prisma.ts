import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getPrisma() {
  prisma ??= new PrismaClient();
  return prisma;
}
