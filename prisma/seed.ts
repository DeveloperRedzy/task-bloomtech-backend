import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  // Hash password for demo user
  const hashedPassword = await bcrypt.hash('password123', 12);

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@bloomtech.com' },
    update: {},
    create: {
      email: 'demo@bloomtech.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
    },
  });

  console.log('✅ Demo user created:', demoUser.email);

  // Create sample work entries
  await prisma.workEntry.create({
    data: {
      userId: demoUser.id,
      startTime: new Date('2024-01-15T09:00:00.000Z'),
      endTime: new Date('2024-01-15T17:00:00.000Z'),
      description: 'Working on project setup and initial development',
    },
  });

  await prisma.workEntry.create({
    data: {
      userId: demoUser.id,
      startTime: new Date('2024-01-16T10:00:00.000Z'),
      endTime: new Date('2024-01-16T18:30:00.000Z'),
      description: 'API development and testing',
    },
  });

  console.log(`✅ Created 2 sample work entries`);
  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
