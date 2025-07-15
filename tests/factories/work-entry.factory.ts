import type { WorkEntry } from '../../src/types/work-entry.types';

/**
 * Work Entry Test Data Factory
 * Generates realistic test data for WorkEntry entities
 */

export interface CreateWorkEntryData {
  startTime?: Date;
  endTime?: Date;
  description?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkEntryFactoryOptions {
  override?: Partial<CreateWorkEntryData>;
  userId?: string;
}

/**
 * Generate a Date object for testing
 */
export function generateTestDate(daysOffset = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date;
}

/**
 * Generate a date string in YYYY-MM-DD format
 */
export function generateTestDateString(daysOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0] as string;
}

/**
 * Generate realistic start and end times for a work entry
 */
export function generateWorkTimestamps(
  daysOffset = 0,
  hoursWorked = 8
): { startTime: Date; endTime: Date } {
  const baseDate = generateTestDate(daysOffset);

  // Set start time to 9:00 AM
  const startTime = new Date(baseDate);
  startTime.setHours(9, 0, 0, 0);

  // Set end time based on hours worked
  const endTime = new Date(startTime);
  endTime.setHours(startTime.getHours() + hoursWorked);

  return { startTime, endTime };
}

/**
 * Generate realistic work entry data
 */
export function generateWorkEntryData(
  options: WorkEntryFactoryOptions = {}
): Required<CreateWorkEntryData> {
  const { override = {}, userId = 'test-user-id' } = options;

  const timestamps = generateWorkTimestamps(0, 8);

  const defaults = {
    startTime: timestamps.startTime,
    endTime: timestamps.endTime,
    description: 'Working on development tasks',
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    ...defaults,
    ...override,
  };
}

/**
 * Create a work entry for testing
 */
export function createWorkEntryFactory(
  options: WorkEntryFactoryOptions = {}
): Omit<WorkEntry, 'id'> {
  const data = generateWorkEntryData(options);

  return {
    userId: data.userId,
    startTime: data.startTime,
    endTime: data.endTime,
    description: data.description,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// Standard work entry templates for different scenarios
export const WorkEntryTemplates = {
  /**
   * Standard 8-hour work entry
   */
  standard: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(0, 8);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description: 'Standard 8-hour work day',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Short work entry (2 hours)
   */
  short: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(0, 2);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description: 'Short work session',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Long work entry (12 hours)
   */
  long: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(0, 12);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description: 'Long work session',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry for yesterday
   */
  yesterday: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(-1, 8);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description: 'Yesterday work entry',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry for last week
   */
  lastWeek: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(-7, 8);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description: 'Last week work entry',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry with custom description
   */
  withDescription: (
    description: string,
    userId = 'test-user-id'
  ): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(0, 8);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry for specific date
   */
  forDate: (
    date: Date,
    hoursWorked = 8,
    userId = 'test-user-id'
  ): Required<CreateWorkEntryData> => {
    const startTime = new Date(date);
    startTime.setHours(9, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + hoursWorked);

    return {
      startTime,
      endTime,
      description: `Work entry for ${date.toDateString()}`,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry with specific time range
   */
  withTimeRange: (
    startTime: Date,
    endTime: Date,
    userId = 'test-user-id'
  ): Required<CreateWorkEntryData> => {
    return {
      startTime,
      endTime,
      description: 'Work entry with custom time range',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};

/**
 * Create a batch of work entries for testing
 */
export function createWorkEntryBatch(
  count: number,
  options: WorkEntryFactoryOptions = {}
): Omit<WorkEntry, 'id'>[] {
  const entries: Omit<WorkEntry, 'id'>[] = [];

  for (let i = 0; i < count; i++) {
    const timestamps = generateWorkTimestamps(-i, 8); // Different days

    const entryOptions = {
      ...options,
      override: {
        ...options.override,
        startTime: timestamps.startTime,
        endTime: timestamps.endTime,
        description: `Work entry ${i + 1}`,
      },
    };

    entries.push(createWorkEntryFactory(entryOptions));
  }

  return entries;
}

/**
 * Invalid work entry data for testing validation
 */
export const InvalidWorkEntries = {
  /**
   * Work entry with end time before start time
   */
  invalidTimeRange: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const startTime = new Date();
    startTime.setHours(17, 0, 0, 0);

    const endTime = new Date();
    endTime.setHours(9, 0, 0, 0); // End before start

    return {
      startTime,
      endTime,
      description: 'Invalid time range test',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry with excessive duration (over 24 hours)
   */
  excessiveDuration: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const startTime = new Date();
    startTime.setHours(9, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 25); // 25 hours

    return {
      startTime,
      endTime,
      description: 'Excessive duration test',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry with too short duration (under 15 minutes)
   */
  tooShort: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const startTime = new Date();
    startTime.setHours(9, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(startTime.getMinutes() + 10); // 10 minutes

    return {
      startTime,
      endTime,
      description: 'Too short duration test',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry with empty description
   */
  emptyDescription: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const timestamps = generateWorkTimestamps(0, 8);
    return {
      startTime: timestamps.startTime,
      endTime: timestamps.endTime,
      description: '',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Work entry with future start time
   */
  futureTime: (userId = 'test-user-id'): Required<CreateWorkEntryData> => {
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1); // Tomorrow
    startTime.setHours(9, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 8);

    return {
      startTime,
      endTime,
      description: 'Future time test',
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};

/**
 * Helper functions for work entry testing
 */
export const WorkEntryTestHelpers = {
  /**
   * Generate a date range for testing (returns date strings for API compatibility)
   */
  generateDateRange: (
    startDaysAgo: number,
    endDaysAgo: number
  ): { startDate: string; endDate: string } => ({
    startDate: generateTestDateString(-startDaysAgo),
    endDate: generateTestDateString(-endDaysAgo),
  }),

  /**
   * Calculate expected total hours for work entries
   */
  calculateTotalHours: (workEntries: Omit<WorkEntry, 'id'>[]): number => {
    return workEntries.reduce((total, entry) => {
      const durationMs = entry.endTime.getTime() - entry.startTime.getTime();
      const duration = durationMs / (1000 * 60 * 60); // Convert to hours
      return total + duration;
    }, 0);
  },

  /**
   * Convert Date to datetime string for API compatibility
   */
  dateToString: (date: Date): string => {
    return date.toISOString();
  },

  /**
   * Sort work entries for testing sort logic
   */
  sortEntries: (
    workEntries: Omit<WorkEntry, 'id'>[],
    sortBy: 'startTime' | 'endTime' | 'duration' | 'createdAt',
    order: 'asc' | 'desc' = 'desc'
  ): Omit<WorkEntry, 'id'>[] => {
    const sorted = [...workEntries].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'startTime':
          comparison = a.startTime.getTime() - b.startTime.getTime();
          break;
        case 'endTime':
          comparison = a.endTime.getTime() - b.endTime.getTime();
          break;
        case 'duration':
          const durationA = a.endTime.getTime() - a.startTime.getTime();
          const durationB = b.endTime.getTime() - b.startTime.getTime();
          comparison = durationA - durationB;
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      return order === 'asc' ? comparison : -comparison;
    });

    return sorted;
  },
};
