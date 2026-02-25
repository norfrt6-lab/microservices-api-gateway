import { PrismaClient, Prisma } from '@prisma/client';
import { CreateProductInput, UpdateProductInput } from '../schemas/product.schema';

const prisma = new PrismaClient();

export async function createProduct(data: CreateProductInput) {
  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: new Prisma.Decimal(data.price),
      stock: data.stock,
    },
  });
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({
    where: { id, isDeleted: false },
  });

  if (!product) throw new Error('Product not found');
  return product;
}

export async function listProducts(page: number, limit: number, search?: string) {
  const skip = (page - 1) * limit;
  const where: Prisma.ProductWhereInput = {
    isDeleted: false,
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where }),
  ]);

  return { products, total, page, limit };
}

export async function updateProduct(id: string, data: UpdateProductInput, expectedVersion: number) {
  // Optimistic locking: only update if version matches
  const result = await prisma.product.updateMany({
    where: { id, version: expectedVersion, isDeleted: false },
    data: {
      ...data,
      ...(data.price !== undefined ? { price: new Prisma.Decimal(data.price) } : {}),
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    // Check if product exists to give better error
    const exists = await prisma.product.findFirst({ where: { id, isDeleted: false } });
    if (!exists) throw new Error('Product not found');
    throw new Error('Version conflict — product was modified by another request');
  }

  return getProductById(id);
}

export async function deleteProduct(id: string) {
  // Soft delete
  const result = await prisma.product.updateMany({
    where: { id, isDeleted: false },
    data: { isDeleted: true },
  });

  if (result.count === 0) throw new Error('Product not found');
}

export async function checkStock(productId: string, quantity: number): Promise<boolean> {
  const product = await prisma.product.findFirst({
    where: { id: productId, isDeleted: false },
  });
  if (!product) return false;
  return product.stock >= quantity;
}

export async function reserveStock(productId: string, quantity: number): Promise<boolean> {
  // Atomic decrement with check
  const result = await prisma.product.updateMany({
    where: { id: productId, isDeleted: false, stock: { gte: quantity } },
    data: { stock: { decrement: quantity }, version: { increment: 1 } },
  });
  return result.count > 0;
}

export async function releaseStock(productId: string, quantity: number): Promise<void> {
  await prisma.product.updateMany({
    where: { id: productId, isDeleted: false },
    data: { stock: { increment: quantity }, version: { increment: 1 } },
  });
}

export { prisma };
