import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { safeValidateSchema } from '../utils/validation.utils';

/**
 * Middleware to validate request body against a Zod schema
 */
export function validateRequest(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = safeValidateSchema(schema, req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: result.errors,
      });
      return;
    }

    // Replace request body with validated data
    req.body = result.data;
    next();
  };
}

/**
 * Middleware to validate request query parameters against a Zod schema
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = safeValidateSchema(schema, req.query);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Query validation failed',
        code: 'QUERY_VALIDATION_ERROR',
        details: result.errors,
      });
      return;
    }

    // Replace request query with validated data
    req.query = result.data;
    next();
  };
}

/**
 * Middleware to validate request parameters against a Zod schema
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = safeValidateSchema(schema, req.params);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Parameter validation failed',
        code: 'PARAMS_VALIDATION_ERROR',
        details: result.errors,
      });
      return;
    }

    // Replace request params with validated data
    req.params = result.data;
    next();
  };
}
