import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not defined");
}

function normalizeConnectionString(value: string): string {
  const url = new URL(value);
  const sslMode = url.searchParams.get("sslmode");

  // pg currently treats require/prefer/verify-ca like verify-full, but its next
  // major version will adopt libpq semantics. Make the secure intent explicit
  // now so local development and scheduled workers behave consistently.
  if (sslMode === "require" || sslMode === "prefer" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const adapter = new PrismaPg({
  connectionString: normalizeConnectionString(databaseUrl),
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
