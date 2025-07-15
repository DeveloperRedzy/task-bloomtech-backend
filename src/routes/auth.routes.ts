import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import {
  authenticate,
  authRateLimit,
  authSecurityHeaders,
  logAuthEvent,
} from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware.js';
import {
  createUserSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateUserSchema,
} from '../utils/validation.utils';

const router = Router();

// Apply security headers to all auth routes
router.use(authSecurityHeaders);

// Apply rate limiting to all auth routes
router.use(authRateLimit);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  logAuthEvent('REGISTRATION_ATTEMPT'),
  validateRequest(createUserSchema),
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get tokens
 * @access  Public
 */
router.post(
  '/login',
  logAuthEvent('LOGIN_ATTEMPT'),
  validateRequest(loginSchema),
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post(
  '/refresh',
  logAuthEvent('TOKEN_REFRESH_ATTEMPT'),
  validateRequest(refreshTokenSchema),
  authController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', authenticate, logAuthEvent('LOGOUT'), authController.logout);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticate, authController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authenticate,
  validateRequest(updateUserSchema),
  logAuthEvent('PROFILE_UPDATE'),
  authController.updateProfile
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  logAuthEvent('PASSWORD_CHANGE'),
  authController.changePassword
);

/**
 * @route   DELETE /api/auth/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/account',
  authenticate,
  logAuthEvent('ACCOUNT_DELETION'),
  authController.deleteAccount
);

/**
 * @route   GET /api/auth/health
 * @desc    Health check for authentication service
 * @access  Public
 */
router.get('/health', authController.healthCheck);

export default router;
