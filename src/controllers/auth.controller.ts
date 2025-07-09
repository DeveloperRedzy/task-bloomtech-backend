import type { Request, Response } from 'express';
import { AuthService, AuthError } from '../services/auth.service';
import {
  validateSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../utils/validation.utils';

/**
 * Handle user registration
 */
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const authResponse = await AuthService.register(req.body);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: authResponse,
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

    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}

/**
 * Handle user login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const authResponse = await AuthService.login(req.body);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: authResponse,
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
 * Change user password
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

    const validatedData = validateSchema(changePasswordSchema, req.body);

    await AuthService.changePassword(
      req.userId,
      validatedData.currentPassword,
      validatedData.newPassword
    );

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
