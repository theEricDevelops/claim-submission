import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from '@/lib/generated/prisma'

const prisma = new PrismaClient({
   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 })