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
  const workEntries = [
    {
      date: new Date('2023-12-01'),
      hours: 8.0,
      description: 'Worked on user authentication system implementation',
    },
    {
      date: new Date('2023-12-02'),
      hours: 7.5,
      description: 'Developed REST API endpoints for work entries',
    },
    {
      date: new Date('2023-12-03'),
      hours: 6.0,
      description: 'Added input validation and error handling',
    },
    {
      date: new Date('2023-12-04'),
      hours: 8.5,
      description: 'Implemented pagination and filtering features',
    },
    {
      date: new Date('2023-12-05'),
      hours: 7.0,
      description: 'Set up comprehensive testing suite',
    },
    {
      date: new Date('2023-12-06'),
      hours: 5.5,
      description: 'Added security middleware and rate limiting',
    },
    {
      date: new Date('2023-12-07'),
      hours: 8.0,
      description: 'Database optimization and query performance tuning',
    },
    {
      date: new Date('2023-12-08'),
      hours: 6.5,
      description: 'Documentation and API specification updates',
    },
    {
      date: new Date('2023-12-09'),
      hours: 7.5,
      description: 'Code review and refactoring for production readiness',
    },
    {
      date: new Date('2023-12-10'),
      hours: 8.0,
      description: 'Final testing and deployment preparation',
    },
  ];

  for (const entry of workEntries) {
    try {
      await prisma.workEntry.create({
        data: {
          ...entry,
          userId: demoUser.id,
        },
      });
    } catch (error) {
      // Skip if entry already exists (unique constraint)
      console.log(`ℹ️  Work entry for ${entry.date.toISOString().split('T')[0]} already exists`);
    }
  }

  console.log(`✅ Created ${workEntries.length} sample work entries`);
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
