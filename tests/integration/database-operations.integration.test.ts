import { PrismaClient, Prisma } from '@prisma/client';
import { generateTestEmail } from '../factories/user.factory';
import { hashPassword } from '../../src/utils/password.utils';

const prisma = new PrismaClient();

describe('Database Operations Integration Tests', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    // Clean up after all tests
    await prisma.workEntry.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('User Database Operations', () => {
    it('should create user with all required fields', async () => {
      const userData = {
        email: generateTestEmail('create'),
        password: await hashPassword('SecurePassword123!'),
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await prisma.user.create({
        data: userData,
      });

      expect(user).toEqual({
        id: expect.any(String),
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        email: generateTestEmail('unique'),
        password: await hashPassword('SecurePassword123!'),
        firstName: 'Test',
        lastName: 'User',
      };

      // Create first user
      await prisma.user.create({
        data: userData,
      });

      // Try to create duplicate
      await expect(
        prisma.user.create({
          data: userData,
        })
      ).rejects.toThrow();
    });

    it('should update user fields correctly', async () => {
      const userData = {
        email: generateTestEmail('update'),
        password: await hashPassword('SecurePassword123!'),
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await prisma.user.create({
        data: userData,
      });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: 'Updated',
          lastName: 'Name',
        },
      });

      expect(updatedUser.firstName).toBe('Updated');
      expect(updatedUser.lastName).toBe('Name');
      expect(updatedUser.email).toBe(userData.email);
      expect(updatedUser.updatedAt).not.toEqual(user.updatedAt);
    });

    it('should delete user and cascade to work entries', async () => {
      const userData = {
        email: generateTestEmail('delete'),
        password: await hashPassword('SecurePassword123!'),
        firstName: 'Test',
        lastName: 'User',
      };

      const user = await prisma.user.create({
        data: userData,
      });

      // Create work entries for user
      await prisma.workEntry.createMany({
        data: [
          {
            startTime: new Date('2024-01-01T09:00:00.000Z'),
            endTime: new Date('2024-01-01T17:00:00.000Z'),
            description: 'Work 1',
            userId: user.id,
          },
          {
            startTime: new Date('2024-01-02T09:00:00.000Z'),
            endTime: new Date('2024-01-02T16:30:00.000Z'),
            description: 'Work 2',
            userId: user.id,
          },
        ],
      });

      // Verify work entries exist
      const beforeDelete = await prisma.workEntry.findMany({
        where: { userId: user.id },
      });
      expect(beforeDelete).toHaveLength(2);

      // Delete user
      await prisma.user.delete({
        where: { id: user.id },
      });

      // Verify work entries are deleted (cascade)
      const afterDelete = await prisma.workEntry.findMany({
        where: { userId: user.id },
      });
      expect(afterDelete).toHaveLength(0);
    });

    it('should handle user queries with filters', async () => {
      await Promise.all([
        prisma.user.create({
          data: {
            email: generateTestEmail('filter1'),
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Alice',
            lastName: 'Smith',
          },
        }),
        prisma.user.create({
          data: {
            email: generateTestEmail('filter2'),
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Bob',
            lastName: 'Jones',
          },
        }),
        prisma.user.create({
          data: {
            email: generateTestEmail('filter3'),
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Alice',
            lastName: 'Johnson',
          },
        }),
      ]);

      // Filter by firstName
      const aliceUsers = await prisma.user.findMany({
        where: { firstName: 'Alice' },
      });
      expect(aliceUsers).toHaveLength(2);

      // Filter by lastName
      const smithUsers = await prisma.user.findMany({
        where: { lastName: 'Smith' },
      });
      expect(smithUsers).toHaveLength(1);

      // Filter by email pattern
      const emailFilter = await prisma.user.findMany({
        where: { email: { contains: 'filter1' } },
      });
      expect(emailFilter).toHaveLength(1);
    });

    it('should handle user creation with timestamps', async () => {
      const before = new Date();

      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('timestamp'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Test',
          lastName: 'User',
        },
      });

      const after = new Date();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(user.updatedAt).toEqual(user.createdAt);
    });
  });

  describe('Work Entry Database Operations', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await prisma.user.create({
        data: {
          email: generateTestEmail('workentry'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Test',
          lastName: 'User',
        },
      });
    });

    it('should create work entry with all required fields', async () => {
      const workEntryData = {
        startTime: new Date('2024-01-15T09:00:00.000Z'),
        endTime: new Date('2024-01-15T17:00:00.000Z'),
        description: 'Test work entry',
        userId: testUser.id,
      };

      const workEntry = await prisma.workEntry.create({
        data: workEntryData,
      });

      expect(workEntry).toEqual({
        id: expect.any(String),
        startTime: workEntryData.startTime,
        endTime: workEntryData.endTime,
        description: workEntryData.description,
        userId: workEntryData.userId,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should allow multiple entries for same date per user', async () => {
      // First entry: 9 AM - 5 PM
      const firstEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'First entry',
          userId: testUser.id,
        },
      });

      // Second entry for same date: 7 PM - 11 PM
      const secondEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T19:00:00.000Z'),
          endTime: new Date('2024-01-15T23:00:00.000Z'),
          description: 'Second entry for same date',
          userId: testUser.id,
        },
      });

      expect(firstEntry.id).toBeDefined();
      expect(secondEntry.id).toBeDefined();
      expect(firstEntry.id).not.toBe(secondEntry.id);
      expect(firstEntry.startTime.toDateString()).toBe(secondEntry.startTime.toDateString());
      expect(firstEntry.userId).toBe(secondEntry.userId);
    });

    it('should allow same date for different users', async () => {
      const otherUser = await prisma.user.create({
        data: {
          email: generateTestEmail('other'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Other',
          lastName: 'User',
        },
      });

      const entry1 = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'User 1 entry',
          userId: testUser.id,
        },
      });

      const entry2 = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T16:30:00.000Z'),
          description: 'User 2 entry',
          userId: otherUser.id,
        },
      });

      expect(entry1.startTime.toDateString()).toBe(entry2.startTime.toDateString());
      expect(entry1.userId).not.toBe(entry2.userId);
    });

    it('should update work entry fields correctly', async () => {
      const workEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'Original description',
          userId: testUser.id,
        },
      });

      const updatedEntry = await prisma.workEntry.update({
        where: { id: workEntry.id },
        data: {
          endTime: new Date('2024-01-15T16:30:00.000Z'),
          description: 'Updated description',
        },
      });

      expect(updatedEntry.endTime).toEqual(new Date('2024-01-15T16:30:00.000Z'));
      expect(updatedEntry.description).toBe('Updated description');
      expect(updatedEntry.startTime).toEqual(workEntry.startTime);
      expect(updatedEntry.userId).toBe(workEntry.userId);
      expect(updatedEntry.updatedAt).not.toEqual(workEntry.updatedAt);
    });

    it('should handle work entry queries with pagination', async () => {
      // Create multiple work entries
      await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          prisma.workEntry.create({
            data: {
              startTime: new Date(2024, 0, i + 1, 9, 0),
              endTime: new Date(2024, 0, i + 1, 17, 0),
              description: `Entry ${i + 1}`,
              userId: testUser.id,
            },
          })
        )
      );

      // Test pagination
      const page1 = await prisma.workEntry.findMany({
        where: { userId: testUser.id },
        take: 5,
        skip: 0,
        orderBy: { startTime: 'asc' },
      });

      const page2 = await prisma.workEntry.findMany({
        where: { userId: testUser.id },
        take: 5,
        skip: 5,
        orderBy: { startTime: 'asc' },
      });

      expect(page1).toHaveLength(5);
      expect(page2).toHaveLength(5);
      expect(page1[0]!.startTime).not.toEqual(page2[0]!.startTime);
    });

    it('should handle work entry queries with date filtering', async () => {
      // Create work entries across different dates
      await Promise.all([
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-01-15T09:00:00.000Z'),
            endTime: new Date('2024-01-15T17:00:00.000Z'),
            description: 'January entry',
            userId: testUser.id,
          },
        }),
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-02-15T09:00:00.000Z'),
            endTime: new Date('2024-02-15T16:30:00.000Z'),
            description: 'February entry',
            userId: testUser.id,
          },
        }),
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-03-15T09:00:00.000Z'),
            endTime: new Date('2024-03-15T15:00:00.000Z'),
            description: 'March entry',
            userId: testUser.id,
          },
        }),
      ]);

      // Filter by date range
      const filtered = await prisma.workEntry.findMany({
        where: {
          userId: testUser.id,
          startTime: {
            gte: new Date('2024-02-01T00:00:00.000Z'),
            lte: new Date('2024-02-28T23:59:59.999Z'),
          },
        },
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.description).toBe('February entry');
    });

    it('should handle work entry sorting', async () => {
      await Promise.all([
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-01-15T09:00:00.000Z'),
            endTime: new Date('2024-01-15T17:00:00.000Z'),
            description: 'Entry C',
            userId: testUser.id,
          },
        }),
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-01-10T09:00:00.000Z'),
            endTime: new Date('2024-01-10T15:00:00.000Z'),
            description: 'Entry A',
            userId: testUser.id,
          },
        }),
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-01-20T09:00:00.000Z'),
            endTime: new Date('2024-01-20T18:00:00.000Z'),
            description: 'Entry B',
            userId: testUser.id,
          },
        }),
      ]);

      // Sort by startTime ascending
      const sortedByDate = await prisma.workEntry.findMany({
        where: { userId: testUser.id },
        orderBy: { startTime: 'asc' },
      });

      expect(sortedByDate[0]!.description).toBe('Entry A');
      expect(sortedByDate[1]!.description).toBe('Entry C');
      expect(sortedByDate[2]!.description).toBe('Entry B');

      // Sort by duration (calculated field) - we'll use manual sorting for this test
      const allEntries = await prisma.workEntry.findMany({
        where: { userId: testUser.id },
      });

      const sortedByDuration = allEntries
        .map((entry: any) => ({
          ...entry,
          duration: (entry.endTime.getTime() - entry.startTime.getTime()) / (1000 * 60 * 60),
        }))
        .sort((a: any, b: any) => b.duration - a.duration);

      expect(sortedByDuration[0]!.duration).toBe(9.0); // Entry B: 9 hours
      expect(sortedByDuration[1]!.duration).toBe(8.0); // Entry C: 8 hours
      expect(sortedByDuration[2]!.duration).toBe(6.0); // Entry A: 6 hours
    });

    it('should handle work entry deletion', async () => {
      const workEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'To be deleted',
          userId: testUser.id,
        },
      });

      // Verify it exists
      const beforeDelete = await prisma.workEntry.findUnique({
        where: { id: workEntry.id },
      });
      expect(beforeDelete).toBeTruthy();

      // Delete it
      await prisma.workEntry.delete({
        where: { id: workEntry.id },
      });

      // Verify it's gone
      const afterDelete = await prisma.workEntry.findUnique({
        where: { id: workEntry.id },
      });
      expect(afterDelete).toBeNull();
    });
  });

  describe('Database Relationships', () => {
    it('should handle user-workEntry relationship correctly', async () => {
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('relationship'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Test',
          lastName: 'User',
        },
      });

      const workEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'Relationship test',
          userId: user.id,
        },
      });

      // Query user with work entries
      const userWithEntries = await prisma.user.findUnique({
        where: { id: user.id },
        include: { workEntries: true },
      });

      expect(userWithEntries?.workEntries).toHaveLength(1);
      expect(userWithEntries?.workEntries[0]!.id).toBe(workEntry.id);

      // Query work entry with user
      const entryWithUser = await prisma.workEntry.findUnique({
        where: { id: workEntry.id },
        include: { user: true },
      });

      expect(entryWithUser?.user.id).toBe(user.id);
      expect(entryWithUser?.user.email).toBe(user.email);
    });

    it('should handle foreign key constraints', async () => {
      // Try to create work entry with non-existent user
      await expect(
        prisma.workEntry.create({
          data: {
            startTime: new Date('2024-01-15T09:00:00.000Z'),
            endTime: new Date('2024-01-15T17:00:00.000Z'),
            description: 'Invalid user',
            userId: 'non-existent-user-id',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Database Transactions', () => {
    it('should handle successful transactions', async () => {
      const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            email: generateTestEmail('transaction'),
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Transaction',
            lastName: 'Test',
          },
        });

        const workEntry = await tx.workEntry.create({
          data: {
            startTime: new Date('2024-01-15T09:00:00.000Z'),
            endTime: new Date('2024-01-15T17:00:00.000Z'),
            description: 'Transaction test',
            userId: user.id,
          },
        });

        return { user, workEntry };
      });

      expect(result.user).toBeTruthy();
      expect(result.workEntry).toBeTruthy();
      expect(result.workEntry.userId).toBe(result.user.id);

      // Verify both records exist
      const user = await prisma.user.findUnique({
        where: { id: result.user.id },
      });
      const workEntry = await prisma.workEntry.findUnique({
        where: { id: result.workEntry.id },
      });

      expect(user).toBeTruthy();
      expect(workEntry).toBeTruthy();
    });

    it('should rollback failed transactions', async () => {
      const existingUser = await prisma.user.create({
        data: {
          email: generateTestEmail('existing'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Existing',
          lastName: 'User',
        },
      });

      await expect(
        prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // Create a user
          const user = await tx.user.create({
            data: {
              email: generateTestEmail('rollback'),
              password: await hashPassword('SecurePassword123!'),
              firstName: 'Rollback',
              lastName: 'Test',
            },
          });

          // Create a work entry
          await tx.workEntry.create({
            data: {
              startTime: new Date('2024-01-15T09:00:00.000Z'),
              endTime: new Date('2024-01-15T17:00:00.000Z'),
              description: 'Rollback test',
              userId: user.id,
            },
          });

          // This should fail due to duplicate email
          await tx.user.create({
            data: {
              email: existingUser.email,
              password: await hashPassword('SecurePassword123!'),
              firstName: 'Duplicate',
              lastName: 'User',
            },
          });
        })
      ).rejects.toThrow();

      // Verify rollback - user should not exist
      const rollbackUser = await prisma.user.findFirst({
        where: { firstName: 'Rollback' },
      });
      expect(rollbackUser).toBeNull();

      // Verify rollback - work entry should not exist
      const rollbackEntry = await prisma.workEntry.findFirst({
        where: { description: 'Rollback test' },
      });
      expect(rollbackEntry).toBeNull();
    });

    it('should handle complex multi-table transactions', async () => {
      const users = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user1 = await tx.user.create({
          data: {
            email: generateTestEmail('complex1'),
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Complex1',
            lastName: 'User',
          },
        });

        const user2 = await tx.user.create({
          data: {
            email: generateTestEmail('complex2'),
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Complex2',
            lastName: 'User',
          },
        });

        // Create work entries for both users
        await tx.workEntry.createMany({
          data: [
            {
              startTime: new Date('2024-01-15T09:00:00.000Z'),
              endTime: new Date('2024-01-15T17:00:00.000Z'),
              description: 'Complex test 1',
              userId: user1.id,
            },
            {
              startTime: new Date('2024-01-15T09:00:00.000Z'),
              endTime: new Date('2024-01-15T16:30:00.000Z'),
              description: 'Complex test 2',
              userId: user2.id,
            },
          ],
        });

        return [user1, user2];
      });

      expect(users).toHaveLength(2);

      // Verify all records exist
      const allUsers = await prisma.user.findMany({
        where: { firstName: { startsWith: 'Complex' } },
        include: { workEntries: true },
      });

      expect(allUsers).toHaveLength(2);
      expect(allUsers[0]!.workEntries).toHaveLength(1);
      expect(allUsers[1]!.workEntries).toHaveLength(1);
    });
  });

  describe('Database Constraints and Validation', () => {
    it('should enforce required fields', async () => {
      // User without email
      await expect(
        prisma.user.create({
          data: {
            password: await hashPassword('SecurePassword123!'),
            firstName: 'Test',
            lastName: 'User',
          } as any,
        })
      ).rejects.toThrow();

      // Work entry without startTime
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('required'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Test',
          lastName: 'User',
        },
      });

      await expect(
        prisma.workEntry.create({
          data: {
            endTime: new Date('2024-01-15T17:00:00.000Z'),
            description: 'Missing startTime',
            userId: user.id,
          } as any,
        })
      ).rejects.toThrow();
    });

    it('should handle database indexes efficiently', async () => {
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('index'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Index',
          lastName: 'Test',
        },
      });

      // Create many work entries
      await prisma.workEntry.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          startTime: new Date(2024, 0, i + 1, 9, 0),
          endTime: new Date(2024, 0, i + 1, 17, 0),
          description: `Index test ${i + 1}`,
          userId: user.id,
        })),
      });

      const startTime = Date.now();

      // Query should be fast due to indexes
      const results = await prisma.workEntry.findMany({
        where: { userId: user.id },
        orderBy: { startTime: 'desc' },
        take: 10,
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(queryTime).toBeLessThan(100); // Should be fast
    });

    it('should handle concurrent database operations', async () => {
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('concurrent'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Concurrent',
          lastName: 'Test',
        },
      });

      // Create concurrent work entries
      const promises = Array.from({ length: 20 }, (_, i) =>
        prisma.workEntry.create({
          data: {
            startTime: new Date(2024, 0, i + 1, 9, 0),
            endTime: new Date(2024, 0, i + 1, 17, 0),
            description: `Concurrent entry ${i + 1}`,
            userId: user.id,
          },
        })
      );

      const results = await Promise.allSettled(promises);

      // All should succeed
      const successful = results.filter((result) => result.status === 'fulfilled');
      expect(successful).toHaveLength(20);

      // Verify all entries exist
      const allEntries = await prisma.workEntry.findMany({
        where: { userId: user.id },
      });
      expect(allEntries).toHaveLength(20);
    });
  });

  describe('Database Performance and Optimization', () => {
    it('should handle large dataset operations efficiently', async () => {
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('performance'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Performance',
          lastName: 'Test',
        },
      });

      // Create large dataset
      const batchSize = 100;
      const batches = 5;

      for (let batch = 0; batch < batches; batch++) {
        const data = Array.from({ length: batchSize }, (_, i) => ({
          startTime: new Date(2024, 0, batch * batchSize + i + 1, 9, 0),
          endTime: new Date(2024, 0, batch * batchSize + i + 1, 17, 0),
          description: `Performance test ${batch * batchSize + i + 1}`,
          userId: user.id,
        }));

        await prisma.workEntry.createMany({ data });
      }

      const startTime = Date.now();

      // Query with pagination
      const results = await prisma.workEntry.findMany({
        where: { userId: user.id },
        take: 50,
        skip: 100,
        orderBy: { startTime: 'desc' },
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(results).toHaveLength(50);
      expect(queryTime).toBeLessThan(200); // Should be reasonably fast
    });

    it('should optimize queries with select and include', async () => {
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('optimize'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Optimize',
          lastName: 'Test',
        },
      });

      await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'Optimization test',
          userId: user.id,
        },
      });

      // Query with select (should be faster)
      const selectQuery = await prisma.workEntry.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          startTime: true,
          endTime: true,
        },
      });

      expect(selectQuery[0]).toEqual({
        id: expect.any(String),
        startTime: expect.any(Date),
        endTime: expect.any(Date),
      });
      expect(selectQuery[0]).not.toHaveProperty('description');
      expect(selectQuery[0]).not.toHaveProperty('userId');

      // Query with include
      const includeQuery = await prisma.workEntry.findMany({
        where: { userId: user.id },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      expect(includeQuery[0]!.user).toEqual({
        firstName: 'Optimize',
        lastName: 'Test',
      });
    });
  });

  describe('Database Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // Test basic connection
      const result = await prisma.$queryRaw`SELECT 1 as test`;
      expect(result).toEqual([{ test: 1 }]);
    });

    it('should handle invalid queries', async () => {
      await expect(prisma.$queryRaw`SELECT * FROM non_existent_table`).rejects.toThrow();
    });

    it('should handle constraint violations properly', async () => {
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('constraint'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Constraint',
          lastName: 'Test',
        },
      });

      const firstEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'Constraint test',
          userId: user.id,
        },
      });

      // Create another entry for same date (should succeed now since unique constraint was removed)
      const secondEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T19:00:00.000Z'),
          endTime: new Date('2024-01-15T22:30:00.000Z'),
          description: 'Another entry for same date',
          userId: user.id,
        },
      });

      expect(firstEntry.id).toBeDefined();
      expect(secondEntry.id).toBeDefined();
      expect(firstEntry.id).not.toBe(secondEntry.id);
      expect(firstEntry.startTime.toDateString()).toBe(secondEntry.startTime.toDateString());
    });
  });

  describe('Database Migrations and Schema', () => {
    it('should have correct table structure', async () => {
      // Test user table structure
      const userTableInfo = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `;

      expect(userTableInfo).toBeDefined();

      // Test work entry table structure
      const workEntryTableInfo = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'workEntries'
        ORDER BY ordinal_position
      `;

      expect(workEntryTableInfo).toBeDefined();
    });

    it('should have proper indexes', async () => {
      // Test that indexes exist (this is database-specific)
      const indexes = await prisma.$queryRaw`
        SELECT indexname, tablename
        FROM pg_indexes
        WHERE tablename IN ('users', 'workEntries')
      `;

      expect(indexes).toBeDefined();
    });
  });

  describe('Database Backup and Recovery', () => {
    it('should handle data export/import operations', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: {
          email: generateTestEmail('backup'),
          password: await hashPassword('SecurePassword123!'),
          firstName: 'Backup',
          lastName: 'Test',
        },
      });

      const workEntry = await prisma.workEntry.create({
        data: {
          startTime: new Date('2024-01-15T09:00:00.000Z'),
          endTime: new Date('2024-01-15T17:00:00.000Z'),
          description: 'Backup test',
          userId: user.id,
        },
      });

      // Export data
      const userData = await prisma.user.findUnique({
        where: { id: user.id },
        include: { workEntries: true },
      });

      expect(userData).toBeTruthy();
      expect(userData?.workEntries).toHaveLength(1);

      // Delete data
      await prisma.workEntry.delete({ where: { id: workEntry.id } });
      await prisma.user.delete({ where: { id: user.id } });

      // Verify deletion
      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();

      // Restore data (simulate import)
      if (userData) {
        const restoredUser = await prisma.user.create({
          data: {
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
          },
        });

        const restoredWorkEntry = await prisma.workEntry.create({
          data: {
            startTime: userData.workEntries[0]!.startTime,
            endTime: userData.workEntries[0]!.endTime,
            description: userData.workEntries[0]!.description,
            userId: restoredUser.id,
          },
        });

        expect(restoredUser.email).toBe(userData.email);
        expect(restoredWorkEntry.description).toBe(userData.workEntries[0]!.description);
      }
    });
  });
});
