import { PrismaClient } from '@prisma/client';
import {
  WorkEntryResponse,
  WorkEntriesListResponse,
  CreateWorkEntryRequest,
  UpdateWorkEntryRequest,
  WorkEntryFilters,
} from '../types/work-entry.types';

const prisma = new PrismaClient();

export class WorkEntryService {
  /**
   * Convert Prisma WorkEntry to API response format
   */
  private formatWorkEntry(workEntry: any): WorkEntryResponse {
    return {
      id: workEntry.id,
      date: workEntry.date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      hours: workEntry.hours,
      description: workEntry.description,
      createdAt: workEntry.createdAt.toISOString(),
      updatedAt: workEntry.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new work entry for a user
   */
  async createWorkEntry(userId: string, data: CreateWorkEntryRequest): Promise<WorkEntryResponse> {
    try {
      // Check if entry already exists for this date
      const existingEntry = await prisma.workEntry.findUnique({
        where: {
          userId_date: {
            userId,
            date: new Date(data.date),
          },
        },
      });

      if (existingEntry) {
        throw new Error(
          'A work entry already exists for this date. Please update the existing entry instead.'
        );
      }

      const workEntry = await prisma.workEntry.create({
        data: {
          userId,
          date: new Date(data.date),
          hours: data.hours,
          description: data.description.trim(),
        },
      });

      return this.formatWorkEntry(workEntry);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create work entry');
    }
  }

  /**
   * Get all work entries for a user with filtering and pagination
   */
  async getWorkEntries(
    userId: string,
    filters: WorkEntryFilters
  ): Promise<WorkEntriesListResponse> {
    try {
      // Build where clause
      const where: any = {
        userId,
      };

      // Add date filters
      if (filters.startDate || filters.endDate) {
        where.date = {};
        if (filters.startDate) {
          where.date.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.date.lte = new Date(filters.endDate);
        }
      }

      // Build order by clause
      const orderBy: any = {};
      switch (filters.sortBy) {
        case 'hours':
          orderBy.hours = filters.sortOrder;
          break;
        case 'createdAt':
          orderBy.createdAt = filters.sortOrder;
          break;
        default:
          orderBy.date = filters.sortOrder;
      }

      // Calculate pagination
      const skip = (filters.page! - 1) * filters.limit!;

      // Get total count and entries
      const [total, entries] = await Promise.all([
        prisma.workEntry.count({ where }),
        prisma.workEntry.findMany({
          where,
          orderBy,
          skip,
          take: filters.limit,
        }),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(total / filters.limit!);
      const hasNext = filters.page! < totalPages;
      const hasPrev = filters.page! > 1;

      return {
        data: entries.map((entry: any) => this.formatWorkEntry(entry)),
        pagination: {
          page: filters.page!,
          limit: filters.limit!,
          total,
          totalPages,
          hasNext,
          hasPrev,
        },
      };
    } catch (error) {
      throw new Error('Failed to retrieve work entries');
    }
  }

  /**
   * Get a specific work entry by ID (ensuring user ownership)
   */
  async getWorkEntryById(userId: string, entryId: string): Promise<WorkEntryResponse> {
    try {
      const workEntry = await prisma.workEntry.findFirst({
        where: {
          id: entryId,
          userId, // Ensure user can only access their own entries
        },
      });

      if (!workEntry) {
        throw new Error('Work entry not found or access denied');
      }

      return this.formatWorkEntry(workEntry);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to retrieve work entry');
    }
  }

  /**
   * Update a work entry (ensuring user ownership)
   */
  async updateWorkEntry(
    userId: string,
    entryId: string,
    data: UpdateWorkEntryRequest
  ): Promise<WorkEntryResponse> {
    try {
      // First check if the entry exists and belongs to the user
      const existingEntry = await prisma.workEntry.findFirst({
        where: {
          id: entryId,
          userId,
        },
      });

      if (!existingEntry) {
        throw new Error('Work entry not found or access denied');
      }

      // If updating date, check for conflicts with existing entries
      if (data.date && data.date !== existingEntry.date.toISOString().split('T')[0]) {
        const conflictingEntry = await prisma.workEntry.findUnique({
          where: {
            userId_date: {
              userId,
              date: new Date(data.date),
            },
          },
        });

        if (conflictingEntry && conflictingEntry.id !== entryId) {
          throw new Error(
            'A work entry already exists for this date. Please choose a different date.'
          );
        }
      }

      // Build update data
      const updateData: any = {};
      if (data.date) updateData.date = new Date(data.date);
      if (data.hours !== undefined) updateData.hours = data.hours;
      if (data.description !== undefined) updateData.description = data.description.trim();

      const updatedEntry = await prisma.workEntry.update({
        where: { id: entryId },
        data: updateData,
      });

      return this.formatWorkEntry(updatedEntry);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update work entry');
    }
  }

  /**
   * Delete a work entry (ensuring user ownership)
   */
  async deleteWorkEntry(userId: string, entryId: string): Promise<void> {
    try {
      // First check if the entry exists and belongs to the user
      const existingEntry = await prisma.workEntry.findFirst({
        where: {
          id: entryId,
          userId,
        },
      });

      if (!existingEntry) {
        throw new Error('Work entry not found or access denied');
      }

      await prisma.workEntry.delete({
        where: { id: entryId },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete work entry');
    }
  }

  /**
   * Get work entry statistics for a user
   */
  async getWorkEntryStats(userId: string, startDate?: string, endDate?: string) {
    try {
      const where: any = { userId };

      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate);
        if (endDate) where.date.lte = new Date(endDate);
      }

      const stats = await prisma.workEntry.aggregate({
        where,
        _sum: { hours: true },
        _avg: { hours: true },
        _count: { id: true },
      });

      return {
        totalHours: stats._sum.hours || 0,
        averageHours: stats._avg.hours || 0,
        totalEntries: stats._count.id || 0,
      };
    } catch (error) {
      throw new Error('Failed to retrieve work entry statistics');
    }
  }
}

export const workEntryService = new WorkEntryService();
