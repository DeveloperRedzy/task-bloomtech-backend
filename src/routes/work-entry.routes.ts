import { Router } from 'express';
import { workEntryController } from '../controllers/work-entry.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All work entry routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/work-entries
 * @desc    Get all work entries for authenticated user with filtering and pagination
 * @access  Private
 * @query   startDate, endDate, sortBy, sortOrder, page, limit
 */
router.get('/', (workEntryController.getWorkEntries as any).bind(workEntryController));

/**
 * @route   GET /api/work-entries/stats
 * @desc    Get work entry statistics for authenticated user
 * @access  Private
 * @query   startDate, endDate (optional)
 */
router.get('/stats', (workEntryController.getWorkEntryStats as any).bind(workEntryController));

/**
 * @route   POST /api/work-entries
 * @desc    Create a new work entry
 * @access  Private
 * @body    { date: string, hours: number, description: string }
 */
router.post('/', (workEntryController.createWorkEntry as any).bind(workEntryController));

/**
 * @route   GET /api/work-entries/:id
 * @desc    Get a specific work entry by ID
 * @access  Private
 * @params  id (work entry ID)
 */
router.get('/:id', (workEntryController.getWorkEntryById as any).bind(workEntryController));

/**
 * @route   PUT /api/work-entries/:id
 * @desc    Update a specific work entry
 * @access  Private
 * @params  id (work entry ID)
 * @body    { date?: string, hours?: number, description?: string }
 */
router.put('/:id', (workEntryController.updateWorkEntry as any).bind(workEntryController));

/**
 * @route   DELETE /api/work-entries/:id
 * @desc    Delete a specific work entry
 * @access  Private
 * @params  id (work entry ID)
 */
router.delete('/:id', (workEntryController.deleteWorkEntry as any).bind(workEntryController));

export default router;
