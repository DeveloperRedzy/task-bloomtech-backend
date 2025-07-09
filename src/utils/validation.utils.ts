import { z } from 'zod';

// Password validation schema with strong requirements
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character');

// Email validation schema
export const emailSchema = z
  .string()
  .email('Please provide a valid email address')
  .max(255, 'Email must not exceed 255 characters')
  .toLowerCase()
  .trim();

// Name validation schema
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(50, 'Name must not exceed 50 characters')
  .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
  .trim();

// User registration validation
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
});

// User login validation
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Refresh token validation
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Password reset validation
export const passwordResetSchema = z.object({
  email: emailSchema,
});

// Password reset confirmation validation
export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

// Change password validation
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// Update user profile validation
export const updateUserSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
  })
  .refine((data) => data.firstName || data.lastName, {
    message: 'At least one field must be provided',
  });

// Generic validation helper
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => err.message).join(', ');
      throw new Error(`Validation failed: ${errorMessages}`);
    }
    throw error;
  }
}

// Safe validation helper that returns result with error info
export function safeValidateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => err.message);
      return { success: false, errors };
    }
    return { success: false, errors: ['Unknown validation error'] };
  }
}
