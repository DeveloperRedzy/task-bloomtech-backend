import { prisma } from '../config/database.config';
import { hashPassword, verifyPassword } from '../utils/password.utils';
import { generateTokenPair, verifyRefreshToken } from '../utils/jwt.utils';
import { validateSchema, createUserSchema, loginSchema } from '../utils/validation.utils';
import type {
  User,
  CreateUserRequest,
  LoginRequest,
  AuthResponse,
  AuthTokens,
} from '../types/auth.types';

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(userData: CreateUserRequest): Promise<AuthResponse> {
    try {
      // Validate input data
      const validatedData = validateSchema(createUserSchema, userData);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (existingUser) {
        throw new AuthError('A user with this email already exists', 'USER_ALREADY_EXISTS', 409);
      }

      // Hash password
      const hashedPassword = await hashPassword(validatedData.password);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Generate tokens
      const tokens = generateTokenPair(newUser.id, newUser.email);

      return {
        user: newUser,
        tokens,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      // Handle Prisma unique constraint errors
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new AuthError('A user with this email already exists', 'USER_ALREADY_EXISTS', 409);
      }

      throw new AuthError('Failed to register user', 'REGISTRATION_FAILED', 500);
    }
  }

  /**
   * Authenticate user login
   */
  static async login(loginData: LoginRequest): Promise<AuthResponse> {
    try {
      // Validate input data
      const validatedData = validateSchema(loginSchema, loginData);

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      if (!user) {
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
      }

      // Verify password
      const isPasswordValid = await verifyPassword(validatedData.password, user.password);

      if (!isPasswordValid) {
        throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
      }

      // Generate tokens
      const tokens = generateTokenPair(user.id, user.email);

      // Return user data without password
      const userWithoutPassword = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      return {
        user: userWithoutPassword,
        tokens,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError('Failed to authenticate user', 'LOGIN_FAILED', 500);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Find user to ensure they still exist
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
        },
      });

      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND', 401);
      }

      // Generate new token pair
      return generateTokenPair(user.id, user.email);
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      throw new AuthError('Failed to fetch user', 'USER_FETCH_FAILED', 500);
    }
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return user;
    } catch (error) {
      throw new AuthError('Failed to fetch user', 'USER_FETCH_FAILED', 500);
    }
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(
    userId: string,
    updateData: { firstName?: string; lastName?: string }
  ): Promise<User> {
    try {
      // Remove undefined fields
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([, value]) => value !== undefined)
      );

      if (Object.keys(cleanData).length === 0) {
        throw new AuthError('No valid fields provided for update', 'NO_UPDATE_DATA', 400);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: cleanData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return updatedUser;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      // Handle user not found
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
      }

      throw new AuthError('Failed to update user profile', 'UPDATE_FAILED', 500);
    }
  }

  /**
   * Change user password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
      }

      // Verify current password
      const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);

      if (!isCurrentPasswordValid) {
        throw new AuthError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD', 400);
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword },
      });
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError('Failed to change password', 'PASSWORD_CHANGE_FAILED', 500);
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(userId: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      // Handle user not found
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
      }

      throw new AuthError('Failed to delete account', 'DELETE_FAILED', 500);
    }
  }
}
