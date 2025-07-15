import { Response } from 'express';
import { workEntryService } from '../services/work-entry.service';
import { AuthenticatedRequest } from '../types/auth.types';

// Extended request type with proper Express Request properties
interface WorkEntryRequest extends AuthenticatedRequest {
  query: any;
  params: any;
  body: any;
}
import {
  createWorkEntrySchema,
  updateWorkEntrySchema,
  workEntryParamsSchema,
  workEntryFiltersSchema,
} from '../utils/work-entry-validation.utils';

export class WorkEntryController {
  /**
   * GET /api/work-entries
   * Get all work entries for the authenticated user with filtering and pagination
   */
  async getWorkEntries(req: WorkEntryRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // Validate and parse query parameters
      const filters = workEntryFiltersSchema.parse(req.query);

      const result = await workEntryService.getWorkEntries(userId, filters);

      res.status(200).json({
        success: true,
        message: 'Work entries retrieved successfully',
        ...result,
      });
    } catch (error: any) {
      console.error('Get work entries error:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve work entries',
      });
    }
  }

  /**
   * POST /api/work-entries
   * Create a new work entry for the authenticated user
   */
  async createWorkEntry(req: WorkEntryRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // Validate request body
      const validatedData = createWorkEntrySchema.parse(req.body);

      const workEntry = await workEntryService.createWorkEntry(userId, validatedData);

      res.status(201).json({
        success: true,
        message: 'Work entry created successfully',
        data: workEntry,
      });
    } catch (error: any) {
      console.error('Create work entry error:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Invalid input data',
          errors: error.errors,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create work entry',
      });
    }
  }

  /**
   * GET /api/work-entries/:id
   * Get a specific work entry by ID
   */
  async getWorkEntryById(req: WorkEntryRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // Validate params
      const { id } = workEntryParamsSchema.parse(req.params);

      const workEntry = await workEntryService.getWorkEntryById(userId, id);

      res.status(200).json({
        success: true,
        message: 'Work entry retrieved successfully',
        data: workEntry,
      });
    } catch (error: any) {
      console.error('Get work entry error:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Invalid work entry ID',
          errors: error.errors,
        });
        return;
      }

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: 'Work entry not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve work entry',
      });
    }
  }

  /**
   * PUT /api/work-entries/:id
   * Update a specific work entry
   */
  async updateWorkEntry(req: WorkEntryRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // Validate params and body
      const { id } = workEntryParamsSchema.parse(req.params);
      const validatedData = updateWorkEntrySchema.parse(req.body);

      const workEntry = await workEntryService.updateWorkEntry(userId, id, validatedData);

      res.status(200).json({
        success: true,
        message: 'Work entry updated successfully',
        data: workEntry,
      });
    } catch (error: any) {
      console.error('Update work entry error:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Invalid input data',
          errors: error.errors,
        });
        return;
      }

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: 'Work entry not found',
        });
        return;
      }

      if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update work entry',
      });
    }
  }

  /**
   * DELETE /api/work-entries/:id
   * Delete a specific work entry
   */
  async deleteWorkEntry(req: WorkEntryRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // Validate params
      const { id } = workEntryParamsSchema.parse(req.params);

      await workEntryService.deleteWorkEntry(userId, id);

      res.status(200).json({
        success: true,
        message: 'Work entry deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete work entry error:', error);

      if (error.name === 'ZodError') {
        res.status(400).json({
          success: false,
          message: 'Invalid work entry ID',
          errors: error.errors,
        });
        return;
      }

      if (error.message.includes('not found') || error.message.includes('access denied')) {
        res.status(404).json({
          success: false,
          message: 'Work entry not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete work entry',
      });
    }
  }

  /**
   * GET /api/work-entries/stats
   * Get work entry statistics for the authenticated user
   */
  async getWorkEntryStats(req: WorkEntryRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      // Optional date filters
      const { startDate, endDate } = req.query;

      const stats = await workEntryService.getWorkEntryStats(
        userId,
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        message: 'Work entry statistics retrieved successfully',
        data: stats,
      });
    } catch (error: any) {
      console.error('Get work entry stats error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve work entry statistics',
      });
    }
  }
}

export const workEntryController = new WorkEntryController();
