import { z } from 'zod';

/**
 * Enhanced Security-Focused Validation Utilities
 * Comprehensive Zod schemas with security validation rules
 */

/**
 * Security-focused string validation
 */
export const secureStringSchema = z
  .string()
  .min(1, 'Value cannot be empty')
  .max(1000, 'Value too long')
  .refine(
    (value) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(value),
    'Script tags are not allowed'
  )
  .refine((value) => !/javascript:/gi.test(value), 'JavaScript protocols are not allowed')
  .refine((value) => !/on\w+\s*=/gi.test(value), 'Event handlers are not allowed')
  .transform((value) => value.trim());

/**
 * Secure email validation with additional checks
 */
export const secureEmailSchema = z
  .string()
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email too long') // RFC 5321 limit
  .email('Invalid email format')
  .refine((email) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [/[<>]/, /javascript:/gi, /data:/gi, /vbscript:/gi, /on\w+=/gi];
    return !suspiciousPatterns.some((pattern) => pattern.test(email));
  }, 'Email contains invalid characters')
  .refine((email) => {
    // Prevent homograph attacks
    const normalizedEmail = email.normalize('NFKC');
    return email === normalizedEmail;
  }, 'Email contains suspicious characters')
  .transform((email) => email.toLowerCase().trim());

/**
 * Strong password validation with comprehensive security requirements
 */
export const strongPasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters long')
  .max(128, 'Password too long')
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine((password) => /\d/.test(password), 'Password must contain at least one number')
  .refine(
    (password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    'Password must contain at least one special character'
  )
  .refine(
    (password) => !/(.)\1{2,}/.test(password),
    'Password cannot contain three or more consecutive identical characters'
  )
  .refine((password) => {
    // Check against common weak patterns
    const weakPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /abc123/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i,
    ];
    return !weakPatterns.some((pattern) => pattern.test(password));
  }, 'Password contains common weak patterns')
  .refine((password) => {
    // Prevent keyboard patterns
    const keyboardPatterns = [/qwertyuiop/i, /asdfghjkl/i, /zxcvbnm/i, /1234567890/];
    return !keyboardPatterns.some((pattern) => pattern.test(password));
  }, 'Password cannot contain keyboard patterns');

/**
 * Secure name validation (for first/last names)
 */
export const secureNameSchema = z
  .string()
  .min(1, 'Name cannot be empty')
  .max(50, 'Name too long')
  .refine(
    (name) => /^[a-zA-Z\s\-'\.]+$/.test(name),
    'Name can only contain letters, spaces, hyphens, apostrophes, and periods'
  )
  .refine((name) => !/<|>|script|javascript|vbscript/gi.test(name), 'Name contains invalid content')
  .transform((name) => name.trim().replace(/\s+/g, ' '));

/**
 * Secure work entry description validation
 */
export const secureDescriptionSchema = z
  .string()
  .min(1, 'Description cannot be empty')
  .max(1000, 'Description too long')
  .refine(
    (desc) => !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(desc),
    'Script tags are not allowed in descriptions'
  )
  .refine(
    (desc) => !/javascript:|data:|vbscript:/gi.test(desc),
    'Suspicious protocols are not allowed'
  )
  .refine((desc) => {
    // Check for potential SQL injection
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(UNION\s+SELECT)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(--|\/\*|\*\/)/,
    ];
    return !sqlPatterns.some((pattern) => pattern.test(desc));
  }, 'Description contains potentially harmful content')
  .transform((desc) => desc.trim().replace(/\s+/g, ' '));

/**
 * Secure start time validation for work entries
 */
export const secureStartTimeSchema = z
  .string()
  .refine((datetime) => {
    const parsed = new Date(datetime);
    return !isNaN(parsed.getTime()) && datetime === parsed.toISOString();
  }, 'Start time must be a valid ISO datetime string')
  .refine((datetime) => {
    const parsed = new Date(datetime);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    return parsed <= now && parsed >= oneYearAgo;
  }, 'Start time cannot be in the future or more than 1 year ago');

/**
 * Secure end time validation for work entries
 */
export const secureEndTimeSchema = z
  .string()
  .refine((datetime) => {
    const parsed = new Date(datetime);
    return !isNaN(parsed.getTime()) && datetime === parsed.toISOString();
  }, 'End time must be a valid ISO datetime string')
  .refine((datetime) => {
    const parsed = new Date(datetime);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    return parsed <= now && parsed >= oneYearAgo;
  }, 'End time cannot be in the future or more than 1 year ago');

/**
 * Secure date validation for filtering
 */
export const secureDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((dateStr) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }, 'Invalid date')
  .refine((dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    return date >= oneYearAgo && date <= oneYearFromNow;
  }, 'Date must be within one year of today');

/**
 * Enhanced authentication schemas with security validation
 */
export const enhancedCreateUserSchema = z.object({
  email: secureEmailSchema,
  password: strongPasswordSchema,
  firstName: secureNameSchema,
  lastName: secureNameSchema,
});

export const enhancedLoginSchema = z.object({
  email: secureEmailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

/**
 * Enhanced work entry schemas with security validation
 */
export const enhancedCreateWorkEntrySchema = z
  .object({
    startTime: secureStartTimeSchema,
    endTime: secureEndTimeSchema,
    description: secureDescriptionSchema,
  })
  .refine((data) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    return startTime < endTime;
  }, 'Start time must be before end time')
  .refine((data) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours <= 24;
  }, 'Work entry duration cannot exceed 24 hours')
  .refine((data) => {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = durationMs / (1000 * 60);
    return durationMinutes >= 15;
  }, 'Work entry duration must be at least 15 minutes');

export const enhancedUpdateWorkEntrySchema = z
  .object({
    startTime: secureStartTimeSchema.optional(),
    endTime: secureEndTimeSchema.optional(),
    description: secureDescriptionSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided for update')
  .refine((data) => {
    if (data.startTime && data.endTime) {
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      return startTime < endTime;
    }
    return true;
  }, 'Start time must be before end time')
  .refine((data) => {
    if (data.startTime && data.endTime) {
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      return durationHours <= 24;
    }
    return true;
  }, 'Work entry duration cannot exceed 24 hours')
  .refine((data) => {
    if (data.startTime && data.endTime) {
      const startTime = new Date(data.startTime);
      const endTime = new Date(data.endTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      return durationMinutes >= 15;
    }
    return true;
  }, 'Work entry duration must be at least 15 minutes');

/**
 * Enhanced filters schema with security validation
 */
export const enhancedWorkEntryFiltersSchema = z
  .object({
    startDate: secureDateSchema.optional(),
    endDate: secureDateSchema.optional(),
    sortBy: z.enum(['startTime', 'endTime', 'duration', 'createdAt']).default('startTime'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  }, 'Start date must be before or equal to end date');

/**
 * Secure ID parameter validation
 */
export const secureIdSchema = z.object({
  id: z
    .string()
    .min(1, 'ID cannot be empty')
    .max(50, 'ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'ID contains invalid characters'),
});

/**
 * Password change schema with enhanced security
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: strongPasswordSchema,
  })
  .refine(
    (data) => data.currentPassword !== data.newPassword,
    'New password must be different from current password'
  );

/**
 * Secure file upload validation (if needed in future)
 */
export const secureFileUploadSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Filename contains invalid characters')
    .refine((filename) => {
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.txt', '.csv'];
      return allowedExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
    }, 'File type not allowed'),
  size: z
    .number()
    .min(1)
    .max(10 * 1024 * 1024), // Max 10MB
  mimeType: z.enum(['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'text/csv']),
});

/**
 * Validation helper function with error standardization
 */
export function validateWithSecurity<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => {
        const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
        return `${path}${err.message}`;
      });

      // Log validation failures for security monitoring
      console.warn('🔒 Validation Failed', {
        context: context || 'unknown',
        errors,
        timestamp: new Date().toISOString(),
      });

      return { success: false, errors };
    }

    // Log unexpected validation errors
    console.error('🚨 Unexpected Validation Error', {
      context: context || 'unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return { success: false, errors: ['Validation failed'] };
  }
}
