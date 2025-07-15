import { PrismaClient } from '@prisma/client';
import { WorkEntryResponse, WorkEntriesListResponse } from '../types/work-entry.types';
import {
  CreateWorkEntryRequest,
  UpdateWorkEntryRequest,
  WorkEntryFilters,
} from '../utils/work-entry-validation.utils';
import { cacheService } from './cache.service';
import { performanceMonitor } from './performance-monitor.service';

const prisma = new PrismaClient();

// Optimized field selection for work entries
const workEntrySelectFields = {
  id: true,
  startTime: true,
  endTime: true,
  description: true,
  createdAt: true,
  updatedAt: true,
};

export class WorkEntryService {
  /**
   * Convert Prisma WorkEntry to API response format
   */
  private formatWorkEntry(workEntry: any): WorkEntryResponse {
    const startTime = new Date(workEntry.startTime);
    const endTime = new Date(workEntry.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const duration = durationMs / (1000 * 60 * 60); // Convert to hours

    return {
      id: workEntry.id,
      startTime: workEntry.startTime.toISOString(),
      endTime: workEntry.endTime.toISOString(),
      duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
      description: workEntry.description,
      createdAt: workEntry.createdAt.toISOString(),
      updatedAt: workEntry.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new work entry for a user - Optimized with monitoring
   */
  async createWorkEntry(userId: string, data: CreateWorkEntryRequest): Promise<WorkEntryResponse> {
    return performanceMonitor.monitor(
      'createWorkEntry',
      async () => {
        // Create work entry with timestamp fields
        const workEntry = await prisma.workEntry.create({
          data: {
            userId,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
            description: data.description.trim(),
          },
          select: workEntrySelectFields,
        });

        // Invalidate user cache after creating entry
        cacheService.invalidateUserCache(userId);

        return this.formatWorkEntry(workEntry);
      },
      userId,
      { startTime: data.startTime, endTime: data.endTime }
    );
  }

  /**
   * Get all work entries for a user with filtering and pagination - Optimized with caching
   */
  async getWorkEntries(
    userId: string,
    filters: WorkEntryFilters
  ): Promise<WorkEntriesListResponse> {
    return performanceMonitor.monitor(
      'getWorkEntries',
      async () => {
        // Try to get from cache first
        const cacheKey = `workEntries:${userId}:${JSON.stringify(filters)}`;
        const cachedResult = cacheService.get<WorkEntriesListResponse>(cacheKey);
        if (cachedResult) {
          return cachedResult;
        }

        // Build where clause with timestamp filtering
        const where: any = {
          userId,
        };

        // Date filtering based on start/end times
        if (filters.startDate) {
          const startDate = new Date(filters.startDate);
          where.startTime = {
            gte: startDate,
          };
        }

        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          // Add 1 day to include entries that end on the endDate
          endDate.setDate(endDate.getDate() + 1);
          where.endTime = {
            lt: endDate,
          };
        }

        // Build orderBy clause
        let orderBy: any = {};
        if (filters.sortBy === 'duration') {
          // For duration sorting, we need to use raw SQL or sort after fetching
          // For now, we'll sort by startTime and handle duration sorting in memory
          orderBy = { startTime: filters.sortOrder };
        } else {
          orderBy = { [filters.sortBy!]: filters.sortOrder };
        }

        // Calculate pagination
        const skip = (filters.page! - 1) * filters.limit!;

        // Get total count for pagination
        const totalCount = await prisma.workEntry.count({ where });

        // Get work entries with optimized query
        const workEntries = await prisma.workEntry.findMany({
          where,
          select: workEntrySelectFields,
          orderBy,
          skip,
          take: filters.limit,
        });

        // Format responses
        let formattedEntries = workEntries.map((entry: any) => this.formatWorkEntry(entry));

        // Handle duration sorting in memory if needed
        if (filters.sortBy === 'duration') {
          formattedEntries = formattedEntries.sort((a: WorkEntryResponse, b: WorkEntryResponse) => {
            const comparison = a.duration - b.duration;
            return filters.sortOrder === 'asc' ? comparison : -comparison;
          });
        }

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / filters.limit!);
        const hasNext = filters.page! < totalPages;
        const hasPrev = filters.page! > 1;

        const result = {
          data: formattedEntries,
          pagination: {
            page: filters.page!,
            limit: filters.limit!,
            total: totalCount,
            totalPages,
            hasNext,
            hasPrev,
          },
        };

        // Cache the result
        cacheService.set(cacheKey, result, 300); // Cache for 5 minutes

        return result;
      },
      userId,
      filters
    );
  }

  /**
   * Get a specific work entry by ID - Optimized to reduce queries
   */
  async getWorkEntryById(userId: string, entryId: string): Promise<WorkEntryResponse> {
    try {
      const workEntry = await prisma.workEntry.findFirst({
        where: {
          id: entryId,
          userId,
        },
        select: workEntrySelectFields,
      });

      if (!workEntry) {
        throw new Error('Work entry not found or access denied');
      }

      return this.formatWorkEntry(workEntry);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to get work entry');
    }
  }

  /**
   * Update a work entry - Optimized to reduce queries
   */
  async updateWorkEntry(
    userId: string,
    entryId: string,
    data: UpdateWorkEntryRequest
  ): Promise<WorkEntryResponse> {
    try {
      // Optimized: Get existing entry with minimal fields
      const existingEntry = await prisma.workEntry.findFirst({
        where: {
          id: entryId,
          userId,
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
          userId: true,
        },
      });

      if (!existingEntry) {
        throw new Error('Work entry not found or access denied');
      }

      // Build update data
      const updateData: any = {};
      if (data.startTime) updateData.startTime = new Date(data.startTime);
      if (data.endTime) updateData.endTime = new Date(data.endTime);
      if (data.description !== undefined) updateData.description = data.description.trim();

      // Update with field selection
      const updatedEntry = await prisma.workEntry.update({
        where: { id: entryId },
        data: updateData,
        select: workEntrySelectFields,
      });

      // Invalidate user cache after updating entry
      cacheService.invalidateUserCache(userId);

      return this.formatWorkEntry(updatedEntry);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update work entry');
    }
  }

  /**
   * Delete a work entry - Optimized to reduce queries
   */
  async deleteWorkEntry(userId: string, entryId: string): Promise<void> {
    try {
      // Verify ownership before deletion
      const workEntry = await prisma.workEntry.findFirst({
        where: {
          id: entryId,
          userId,
        },
        select: {
          id: true,
        },
      });

      if (!workEntry) {
        throw new Error('Work entry not found or access denied');
      }

      // Delete the entry
      await prisma.workEntry.delete({
        where: { id: entryId },
      });

      // Invalidate user cache after deleting entry
      cacheService.invalidateUserCache(userId);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to delete work entry');
    }
  }

  /**
   * Get work entry statistics with duration calculations
   */
  async getWorkEntryStats(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    totalHours: number;
    averageHours: number;
    totalEntries: number;
  }> {
    try {
      // Build where clause
      const where: any = {
        userId,
      };

      if (startDate) {
        const start = new Date(startDate);
        where.startTime = {
          gte: start,
        };
      }

      if (endDate) {
        const end = new Date(endDate);
        // Add 1 day to include entries that end on the endDate
        end.setDate(end.getDate() + 1);
        where.endTime = {
          lt: end,
        };
      }

      // Get all entries for the period
      const entries = await prisma.workEntry.findMany({
        where,
        select: {
          startTime: true,
          endTime: true,
        },
      });

      // Calculate total hours from timestamps
      const totalHours = entries.reduce((sum: number, entry: any) => {
        const startTime = new Date(entry.startTime);
        const endTime = new Date(entry.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const duration = durationMs / (1000 * 60 * 60); // Convert to hours
        return sum + duration;
      }, 0);

      const totalEntries = entries.length;
      const averageHours = totalEntries > 0 ? totalHours / totalEntries : 0;

      return {
        totalHours: Math.round(totalHours * 100) / 100, // Round to 2 decimal places
        averageHours: Math.round(averageHours * 100) / 100, // Round to 2 decimal places
        totalEntries,
      };
    } catch (error) {
      throw new Error('Failed to get work entry statistics');
    }
  }
}

export const workEntryService = new WorkEntryService();
