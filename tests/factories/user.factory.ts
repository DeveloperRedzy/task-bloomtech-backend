import type { User, UserWithPassword } from '../../src/types/auth.types';
import { hashPassword } from '../../src/utils/password.utils';

/**
 * User Test Data Factory
 * Generates realistic test data for User entities
 */

export interface CreateUserData {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserFactoryOptions {
  withHashedPassword?: boolean;
  override?: Partial<CreateUserData>;
}

/**
 * Generate a unique email for testing
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generate realistic test user data
 */
export function generateUserData(options: UserFactoryOptions = {}): CreateUserData {
  const { override = {} } = options;

  const defaults = {
    email: generateTestEmail(),
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...defaults, ...override };
}

/**
 * Create a complete User object for testing
 */
export async function createUserFactory(
  options: UserFactoryOptions = {}
): Promise<Omit<UserWithPassword, 'id'>> {
  const { withHashedPassword = false, override = {} } = options;
  const userData = generateUserData({ override });

  // Hash password if requested
  const password =
    withHashedPassword && userData.password
      ? await hashPassword(userData.password)
      : userData.password!;

  return {
    email: userData.email!,
    password,
    firstName: userData.firstName!,
    lastName: userData.lastName!,
    createdAt: userData.createdAt!,
    updatedAt: userData.updatedAt!,
  };
}

/**
 * Predefined test user scenarios
 */
export const TestUsers = {
  /**
   * Valid test user with strong password
   */
  validUser: (): CreateUserData => ({
    email: 'valid.user@example.com',
    password: 'SecurePassword123!',
    firstName: 'Valid',
    lastName: 'User',
  }),

  /**
   * Admin-like test user
   */
  adminUser: (): CreateUserData => ({
    email: 'admin@bloomtech.com',
    password: 'AdminSecure456#',
    firstName: 'Admin',
    lastName: 'User',
  }),

  /**
   * User with minimal valid data
   */
  minimalUser: (): CreateUserData => ({
    email: generateTestEmail('minimal'),
    password: 'MinimalPass789$',
    firstName: 'M',
    lastName: 'U',
  }),

  /**
   * User with maximum length data
   */
  maxLengthUser: (): CreateUserData => ({
    email: `${'a'.repeat(240)}@example.com`, // Near email limit
    password: 'A'.repeat(50) + 'secure123!', // Long but valid password
    firstName: 'FirstName'.repeat(6), // ~50 chars
    lastName: 'LastName'.repeat(6), // ~48 chars
  }),

  /**
   * User with special characters in name
   */
  specialCharUser: (): CreateUserData => ({
    email: generateTestEmail('special'),
    password: 'SpecialChars123!',
    firstName: "Mary-Jane O'Connor",
    lastName: 'Smith-Wilson',
  }),

  /**
   * User for security testing
   */
  securityTestUser: (): CreateUserData => ({
    email: generateTestEmail('security'),
    password: 'SecurityTest789&',
    firstName: 'Security',
    lastName: 'Tester',
  }),

  /**
   * User with edge case email formats
   */
  edgeCaseEmailUser: (): CreateUserData => ({
    email: 'edge.case+test@sub.domain.example.com',
    password: 'EdgeCase456!',
    firstName: 'Edge',
    lastName: 'Case',
  }),
};

/**
 * Invalid user data for testing validation
 */
export const InvalidUsers = {
  /**
   * User with invalid email
   */
  invalidEmail: (): CreateUserData => ({
    email: 'not-an-email',
    password: 'ValidPassword123!',
    firstName: 'Invalid',
    lastName: 'Email',
  }),

  /**
   * User with weak password
   */
  weakPassword: (): CreateUserData => ({
    email: generateTestEmail('weak'),
    password: 'weak',
    firstName: 'Weak',
    lastName: 'Password',
  }),

  /**
   * User with password containing common patterns
   */
  commonPatternPassword: (): CreateUserData => ({
    email: generateTestEmail('pattern'),
    password: 'password123',
    firstName: 'Pattern',
    lastName: 'Password',
  }),

  /**
   * User with missing required fields
   */
  missingFields: (): Partial<CreateUserData> => ({
    email: generateTestEmail('missing'),
    // Missing password, firstName, lastName
  }),

  /**
   * User with empty string fields
   */
  emptyFields: (): CreateUserData => ({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  }),

  /**
   * User with XSS attempt in name
   */
  xssAttempt: (): CreateUserData => ({
    email: generateTestEmail('xss'),
    password: 'XssTest123!',
    firstName: '<script>alert("xss")</script>',
    lastName: 'javascript:alert(1)',
  }),

  /**
   * User with SQL injection attempt
   */
  sqlInjectionAttempt: (): CreateUserData => ({
    email: generateTestEmail('sql'),
    password: 'SqlTest123!',
    firstName: "'; DROP TABLE users; --",
    lastName: "1' OR '1'='1",
  }),
};

/**
 * Batch create multiple users for testing
 */
export async function createUserBatch(
  count: number,
  options: UserFactoryOptions = {}
): Promise<Omit<UserWithPassword, 'id'>[]> {
  const users: Omit<UserWithPassword, 'id'>[] = [];

  for (let i = 0; i < count; i++) {
    const userOptions = {
      ...options,
      override: {
        ...options.override,
        email: generateTestEmail(`batch-${i}`),
        firstName: `User${i}`,
        lastName: `Test${i}`,
      },
    };

    const user = await createUserFactory(userOptions);
    users.push(user);
  }

  return users;
}

/**
 * Create users with specific roles/scenarios for testing
 */
export const UserScenarios = {
  /**
   * Create a user with existing data (for conflict testing)
   */
  existingUser: async (): Promise<Omit<UserWithPassword, 'id'>> => {
    return createUserFactory({
      withHashedPassword: true,
      override: {
        email: 'existing.user@example.com',
        password: 'ExistingUser123!',
        firstName: 'Existing',
        lastName: 'User',
      },
    });
  },

  /**
   * Create a locked out user (for security testing)
   */
  lockedOutUser: (): CreateUserData => ({
    email: 'locked.out@example.com',
    password: 'LockedOut123!',
    firstName: 'Locked',
    lastName: 'User',
  }),

  /**
   * Create multiple users for pagination testing
   */
  paginationUsers: async (count = 25): Promise<Omit<UserWithPassword, 'id'>[]> => {
    return createUserBatch(count, {
      withHashedPassword: true,
      override: { password: 'PaginationTest123!' },
    });
  },
};

/**
 * Helper to clean email for consistent testing
 */
export function normalizeTestEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Generate test JWT payload data
 */
export function generateJWTPayload(userId = 'test-user-id', email = 'test@example.com') {
  return {
    userId,
    email: normalizeTestEmail(email),
    type: 'access' as const,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
    aud: 'bloomtech-work-tracker-api',
    iss: 'bloomtech-work-tracker',
  };
}
