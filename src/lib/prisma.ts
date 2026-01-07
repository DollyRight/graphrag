import { PrismaClient } from '@/generated/prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

// 缓存实例，防止 Next.js 开发环境下创建过多连接
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 创建适配器逻辑
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter, // Prisma 7 必须传入适配器才能连接本地数据库
    log: ['query'],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;