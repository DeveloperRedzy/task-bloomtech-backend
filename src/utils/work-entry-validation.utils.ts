import { z } from 'zod';

// Base validation schemas
export const workEntryValidation = {
  // Date validation - must be valid ISO date string
  date: z
    .string()
    .refine(
      (date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime()) && date === parsed.toISOString().split('T')[0];
      },
      {
        message: 'Date must be a valid ISO date string (YYYY-MM-DD)',
      }
    )
    .refine(
      (date) => {
        const parsed = new Date(date);
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        return parsed <= today && parsed >= oneYearAgo;
      },
      {
        message: 'Date cannot be in the future or more than 1 year ago',
      }
    ),

  // Hours validation - must be positive number with max 24 hours per day
  hours: z
    .number()
    .positive({ message: 'Hours must be a positive number' })
    .max(24, { message: 'Hours cannot exceed 24 per day' })
    .refine(
      (hours) => {
        // Allow up to 2 decimal places (quarter hours)
        return Number((hours % 0.25).toFixed(10)) === 0;
      },
      {
        message: 'Hours must be in quarter-hour increments (0.25, 0.5, 0.75, etc.)',
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
export const createWorkEntrySchema = z.object({
  date: workEntryValidation.date,
  hours: workEntryValidation.hours,
  description: workEntryValidation.description,
});

// Update work entry schema (all fields optional)
export const updateWorkEntrySchema = z
  .object({
    date: workEntryValidation.date.optional(),
    hours: workEntryValidation.hours.optional(),
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
  );

// Work entry ID params schema
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

    sortBy: z.enum(['date', 'hours', 'createdAt']).optional().default('date'),

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

// Export types inferred from schemas
export type CreateWorkEntryRequest = z.infer<typeof createWorkEntrySchema>;
export type UpdateWorkEntryRequest = z.infer<typeof updateWorkEntrySchema>;
export type WorkEntryParams = z.infer<typeof workEntryParamsSchema>;
export type WorkEntryFilters = z.infer<typeof workEntryFiltersSchema>;
