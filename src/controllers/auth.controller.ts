import type { Request, Response } from 'express';
import { AuthService, AuthError } from '../services/auth.service';
import {
  validateSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../utils/validation.utils';
import {
  enhancedCreateUserSchema,
  enhancedLoginSchema,
  validateWithSecurity,
  passwordChangeSchema,
} from '../utils/security-validation.utils';
import {
  trackFailedAttempt,
  clearFailedAttempts,
  isLockedOut,
} from '../middleware/rate-limit.middleware';

/**
 * Handle user registration with enhanced security validation
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    // Enhanced security validation
    const validationResult = validateWithSecurity(
      enhancedCreateUserSchema,
      req.body,
      'user-registration'
    );

    if (!validationResult.success) {
      // Log suspicious registration attempts
      console.warn('🚨 Invalid Registration Attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        errors: validationResult.errors,
        timestamp: new Date().toISOString(),
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const authResponse = await AuthService.register(validationResult.data);

    // Log successful registration for security monitoring
    console.log('✅ User Registration Success', {
      email: validationResult.data.email,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: authResponse,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Log authentication errors for security monitoring
      console.warn('🔒 Registration Error', {
        code: error.code,
        message: error.message,
        ip: req.ip,
        timestamp: new Date().toISOString(),
      });

      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Handle user login with account lockout protection and enhanced security
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Enhanced security validation
    const validationResult = validateWithSecurity(enhancedLoginSchema, req.body, 'user-login');

    if (!validationResult.success) {
      // Log suspicious login attempts
      console.warn('🚨 Invalid Login Attempt', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        errors: validationResult.errors,
        timestamp: new Date().toISOString(),
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const { email } = validationResult.data;
    const clientIP = req.ip || 'unknown';

    // Check for account lockout (by email)
    if (isLockedOut(email)) {
      console.warn('🔒 Account Lockout - Login Blocked', {
        email,
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to multiple failed attempts',
        code: 'ACCOUNT_LOCKED',
        message: 'Please try again in 30 minutes or contact support',
      });
      return;
    }

    // Check for IP-based lockout (additional protection)
    if (isLockedOut(clientIP)) {
      console.warn('🔒 IP Lockout - Login Blocked', {
        email,
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      res.status(423).json({
        success: false,
        error: 'Too many failed login attempts from this IP address',
        code: 'IP_LOCKED',
        message: 'Please try again in 30 minutes',
      });
      return;
    }

    const authResponse = await AuthService.login(validationResult.data);

    // Clear failed attempts on successful login
    clearFailedAttempts(email);
    clearFailedAttempts(clientIP);

    // Log successful login for security monitoring
    console.log('✅ User Login Success', {
      email,
      ip: clientIP,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: authResponse,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const { email } = req.body;
      const clientIP = req.ip || 'unknown';

      // Track failed authentication attempts for account lockout
      if (error.code === 'INVALID_CREDENTIALS' && email) {
        const emailLockout = trackFailedAttempt(email);
        const ipLockout = trackFailedAttempt(clientIP);

        console.warn('🔒 Failed Login Attempt', {
          email,
          ip: clientIP,
          userAgent: req.get('User-Agent'),
          emailAttemptsLeft: emailLockout.attemptsLeft,
          ipAttemptsLeft: ipLockout.attemptsLeft,
          emailLocked: emailLockout.isLocked,
          ipLocked: ipLockout.isLocked,
          timestamp: new Date().toISOString(),
        });

        // Provide security-conscious error messages
        if (emailLockout.isLocked || ipLockout.isLocked) {
          res.status(423).json({
            success: false,
            error: 'Account locked due to multiple failed attempts',
            code: 'ACCOUNT_LOCKED',
            message: 'Please try again in 30 minutes',
          });
          return;
        }

        // Warn about remaining attempts
        if (emailLockout.attemptsLeft <= 2) {
          res.status(401).json({
            success: false,
            error: 'Invalid credentials',
            code: error.code,
            warning: `${emailLockout.attemptsLeft} attempts remaining before account lockout`,
          });
          return;
        }
      }

      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Handle token refresh
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = validateSchema(refreshTokenSchema, req.body);
    const tokens = await AuthService.refreshToken(validatedData.refreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: { tokens },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const user = await AuthService.getUserById(req.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Update user profile
 */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    const { firstName, lastName } = req.body;
    const updatedUser = await AuthService.updateUserProfile(req.userId, {
      firstName,
      lastName,
    });

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Change user password with enhanced security validation
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Enhanced security validation for password change
    const validationResult = validateWithSecurity(
      passwordChangeSchema,
      req.body,
      'password-change'
    );

    if (!validationResult.success) {
      console.warn('🚨 Invalid Password Change Attempt', {
        userId: req.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        errors: validationResult.errors,
        timestamp: new Date().toISOString(),
      });

      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationResult.errors,
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    await AuthService.changePassword(
      req.userId,
      validationResult.data.currentPassword,
      validationResult.data.newPassword
    );

    // Log successful password change for security monitoring
    console.log('🔐 Password Changed Successfully', {
      userId: req.userId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Delete user account
 */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    if (!req.userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    await AuthService.deleteAccount(req.userId);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
      });
      return;
    }

    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Logout user (currently just a client-side action, but endpoint for completeness)
 */
export async function logout(req: Request, res: Response): Promise<void> {
  // In a stateless JWT system, logout is typically handled client-side
  // by removing the token from storage. This endpoint exists for
  // consistency and potential future blacklisting features.

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

/**
 * Health check for auth service
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    success: true,
    message: 'Authentication service is healthy',
    timestamp: new Date().toISOString(),
  });
}
