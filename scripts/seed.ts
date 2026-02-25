/**
 * Database seed script — populates all three databases with sample data.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Prerequisites:
 *   - PostgreSQL running with users_db, products_db, orders_db created
 *   - Prisma clients generated for all services
 */

import { PrismaClient as UserPrismaClient } from '../services/user-service/node_modules/@prisma/client';
import { PrismaClient as ProductPrismaClient } from '../services/product-service/node_modules/@prisma/client';

// Use direct connection strings (same as docker-compose.dev.yml)
const userDb = new UserPrismaClient({
  datasources: { db: { url: process.env.USER_DB_URL || 'postgresql://postgres:postgres@localhost:5432/users_db' } },
});

const productDb = new ProductPrismaClient({
  datasources: { db: { url: process.env.PRODUCT_DB_URL || 'postgresql://postgres:postgres@localhost:5432/products_db' } },
});

async function seedUsers() {
  console.log('Seeding users...');

  const bcrypt = await import('bcrypt');

  const users = [
    { email: 'admin@example.com', password: 'admin123', name: 'Admin User', role: 'ADMIN' as const },
    { email: 'john@example.com', password: 'password123', name: 'John Doe', role: 'USER' as const },
    { email: 'jane@example.com', password: 'password123', name: 'Jane Smith', role: 'USER' as const },
    { email: 'bob@example.com', password: 'password123', name: 'Bob Wilson', role: 'USER' as const },
    { email: 'alice@example.com', password: 'password123', name: 'Alice Brown', role: 'USER' as const },
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await userDb.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        password: hashedPassword,
        name: user.name,
        role: user.role,
      },
    });
  }

  console.log(`  Created ${users.length} users`);
}

async function seedProducts() {
  console.log('Seeding products...');

  const products = [
    { name: 'Wireless Headphones', description: 'Premium noise-cancelling wireless headphones', price: 299.99, stock: 50 },
    { name: 'Mechanical Keyboard', description: 'Cherry MX Blue switches, RGB backlit', price: 149.99, stock: 100 },
    { name: 'USB-C Hub', description: '7-in-1 USB-C hub with HDMI, SD card reader', price: 49.99, stock: 200 },
    { name: '4K Monitor', description: '27-inch 4K IPS monitor, 60Hz', price: 499.99, stock: 25 },
    { name: 'Webcam HD', description: '1080p webcam with built-in microphone', price: 79.99, stock: 150 },
    { name: 'Standing Desk', description: 'Electric standing desk, 48x30 inch', price: 599.99, stock: 15 },
    { name: 'Ergonomic Mouse', description: 'Vertical ergonomic wireless mouse', price: 59.99, stock: 75 },
    { name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand', price: 39.99, stock: 120 },
    { name: 'Cable Management Kit', description: 'Under-desk cable management tray', price: 24.99, stock: 300 },
    { name: 'Desk Lamp', description: 'LED desk lamp with adjustable color temperature', price: 44.99, stock: 80 },
  ];

  for (const product of products) {
    await productDb.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
      },
    });
  }

  console.log(`  Created ${products.length} products`);
}

async function main() {
  console.log('=== Database Seed Script ===\n');

  try {
    await seedUsers();
    await seedProducts();

    console.log('\nSeed completed successfully!');
    console.log('\nTest credentials:');
    console.log('  Admin: admin@example.com / admin123');
    console.log('  User:  john@example.com / password123');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await userDb.$disconnect();
    await productDb.$disconnect();
  }
}

main();
