import { z } from 'zod';

// Base validation schemas
export const workEntryValidation = {
  // Start time validation - must be valid ISO datetime string
  startTime: z
    .string()
    .refine(
      (datetime) => {
        const parsed = new Date(datetime);
        return !isNaN(parsed.getTime()) && datetime === parsed.toISOString();
      },
      {
        message: 'Start time must be a valid ISO datetime string',
      }
    )
    .refine(
      (datetime) => {
        const parsed = new Date(datetime);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        return parsed <= now && parsed >= oneYearAgo;
      },
      {
        message: 'Start time cannot be in the future or more than 1 year ago',
      }
    ),

  // End time validation - must be valid ISO datetime string
  endTime: z
    .string()
    .refine(
      (datetime) => {
        const parsed = new Date(datetime);
        return !isNaN(parsed.getTime()) && datetime === parsed.toISOString();
      },
      {
        message: 'End time must be a valid ISO datetime string',
      }
    )
    .refine(
      (datetime) => {
        const parsed = new Date(datetime);
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        return parsed <= now && parsed >= oneYearAgo;
      },
      {
        message: 'End time cannot be in the future or more than 1 year ago',
      }
    ),

  // Description validation
  description: z
    .string()
    .min(1, { message: 'Description is required' })
    .max(500, { message: 'Description cannot exceed 500 characters' })
    .trim(),

  // ID validation for params
  id: z
    .string()
    .min(1, { message: 'ID is required' })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid ID format' }),
};

// Create work entry schema
export const createWorkEntrySchema = z
  .object({
    startTime: workEntryValidation.startTime,
    endTime: workEntryValidation.endTime,
    description: workEntryValidation.description,
  })
  .refine(
    (data) => {
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      return startTime < endTime;
    },
    {
      message: 'Start time must be before end time',
    }
  )
  .refine(
    (data) => {
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      return durationHours <= 24;
    },
    {
      message: 'Work entry duration cannot exceed 24 hours',
    }
  )
  .refine(
    (data) => {
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      return durationMinutes >= 15; // Minimum 15 minutes
    },
    {
      message: 'Work entry duration must be at least 15 minutes',
    }
  );

// Update work entry schema (all fields optional)
export const updateWorkEntrySchema = z
  .object({
    startTime: workEntryValidation.startTime.optional(),
    endTime: workEntryValidation.endTime.optional(),
    description: workEntryValidation.description.optional(),
  })
  .refine(
    (data) => {
      // At least one field must be provided for update
      return Object.keys(data).length > 0;
    },
    {
      message: 'At least one field must be provided for update',
    }
  )
  .refine(
    (data) => {
      // If both start and end times are provided, validate their relationship
      if (data.startTime && data.endTime) {
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        return startTime < endTime;
      }
      return true;
    },
    {
      message: 'Start time must be before end time',
    }
  )
  .refine(
    (data) => {
      // If both start and end times are provided, validate duration
      if (data.startTime && data.endTime) {
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        return durationHours <= 24;
      }
      return true;
    },
    {
      message: 'Work entry duration cannot exceed 24 hours',
    }
  )
  .refine(
    (data) => {
      // If both start and end times are provided, validate minimum duration
      if (data.startTime && data.endTime) {
        const startTime = new Date(data.startTime);
        const endTime = new Date(data.endTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = durationMs / (1000 * 60);
        return durationMinutes >= 15; // Minimum 15 minutes
      }
      return true;
    },
    {
      message: 'Work entry duration must be at least 15 minutes',
    }
  );

// Work entry params schema
export const workEntryParamsSchema = z.object({
  id: workEntryValidation.id,
});

// Work entry filters/query schema
export const workEntryFiltersSchema = z
  .object({
    startDate: z
      .string()
      .optional()
      .refine(
        (date) => {
          if (!date) return true;
          const parsed = new Date(date);
          return !isNaN(parsed.getTime()) && date === parsed.toISOString().split('T')[0];
        },
        {
          message: 'Start date must be a valid ISO date string (YYYY-MM-DD)',
        }
      ),

    endDate: z
      .string()
      .optional()
      .refine(
        (date) => {
          if (!date) return true;
          const parsed = new Date(date);
          return !isNaN(parsed.getTime()) && date === parsed.toISOString().split('T')[0];
        },
        {
          message: 'End date must be a valid ISO date string (YYYY-MM-DD)',
        }
      ),

    sortBy: z
      .enum(['startTime', 'endTime', 'duration', 'createdAt'])
      .optional()
      .default('startTime'),

    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),

    page: z.coerce
      .number()
      .int()
      .min(1, { message: 'Page must be at least 1' })
      .optional()
      .default(1),

    limit: z.coerce
      .number()
      .int()
      .min(1, { message: 'Limit must be at least 1' })
      .max(100, { message: 'Limit cannot exceed 100' })
      .optional()
      .default(20),
  })
  .refine(
    (data) => {
      // If both dates provided, startDate must be before or equal to endDate
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) <= new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'Start date must be before or equal to end date',
    }
  );

// Export types from validation schemas
export type CreateWorkEntryRequest = z.infer<typeof createWorkEntrySchema>;
export type UpdateWorkEntryRequest = z.infer<typeof updateWorkEntrySchema>;
export type WorkEntryParams = z.infer<typeof workEntryParamsSchema>;
export type WorkEntryFilters = z.infer<typeof workEntryFiltersSchema>;
