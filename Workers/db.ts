/**
 * db.ts — Prisma Client Singleton
 *
 * In development, Next.js hot-reloads modules on every file save. Without
 * this singleton pattern, each hot-reload would create a NEW PrismaClient
 * instance and open a fresh connection pool — quickly exhausting the
 * PostgreSQL connection limit.
 *
 * Solution: attach the client to the Node.js `global` object in development
 * so it survives hot-reloads. In production, a simple module-level instance
 * is fine because the process never hot-reloads.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Extend the global type to avoid TypeScript errors
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  var __pgPool: Pool | undefined;
}

const pool = global.__pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL || '' });
export async function closeSubscriptionDatabaseForTests(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}

const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']  // Verbose logging in dev
        : ['error'],                   // Errors only in production
  });

// Attach to global in development to survive hot-reloads
if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
  global.__pgPool = pool;
}

export default prisma;
