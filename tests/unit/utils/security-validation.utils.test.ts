import {
  secureEmailSchema,
  strongPasswordSchema,
  secureNameSchema,
  secureDescriptionSchema,
  secureStartTimeSchema,
  secureEndTimeSchema,
  secureDateSchema,
  enhancedCreateUserSchema,
  enhancedLoginSchema,
  enhancedCreateWorkEntrySchema,
  enhancedUpdateWorkEntrySchema,
  enhancedWorkEntryFiltersSchema,
  secureIdSchema,
  passwordChangeSchema,
  secureFileUploadSchema,
  validateWithSecurity,
} from '../../../src/utils/security-validation.utils';

describe('Security Validation Utils', () => {
  describe('secureEmailSchema', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@sub.domain.com',
        'user@example.co.uk',
        'user123@example.com',
        'user_name@example.com',
        'user-name@example.com',
      ];

      validEmails.forEach((email) => {
        const result = secureEmailSchema.safeParse(email);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe(email.toLowerCase());
        }
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test..test@example.com',
        'test@.com',
        'test@example.',
        'test@example.c',
        'test@example.toolongextension',
        'test@example.com.',
        'test@example..com',
        'test space@example.com',
        'test@example .com',
        'test<script>@example.com',
        'test@example.com<script>',
        'test@javascript:alert(1)',
      ];

      invalidEmails.forEach((email) => {
        const result = secureEmailSchema.safeParse(email);
        expect(result.success).toBe(false);
      });
    });

    it('should reject emails that are too short or too long', () => {
      const tooShort = 'a@b';
      const tooLong = 'a'.repeat(250) + '@example.com';

      expect(secureEmailSchema.safeParse(tooShort).success).toBe(false);
      expect(secureEmailSchema.safeParse(tooLong).success).toBe(false);
    });

    it('should normalize email to lowercase', () => {
      const email = 'TEST@EXAMPLE.COM';
      const result = secureEmailSchema.safeParse(email);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });
  });

  describe('strongPasswordSchema', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'ValidPassword19!',
        'AnotherStrong27@',
        'Complex91$Password',
        'Secure82#Pass',
        'MyP@ssw0rd91Test',
      ];

      strongPasswords.forEach((password) => {
        const result = strongPasswordSchema.safeParse(password);
        expect(result.success).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'weak',
        'password123',
        'PASSWORD123',
        'Password123', // Missing special character
        'password123!', // Missing uppercase
        'PASSWORD123!', // Missing lowercase
        'Password!', // Missing number
        'Passsssword123!', // Repeated characters
        'Password123abc!', // Sequential characters
        'Password123!admin', // Contains weak pattern
        'P@ssw0rd123', // Contains weak pattern
        'Qwerty123!', // Keyboard pattern
        'A'.repeat(7) + '1!', // Too short
        'A'.repeat(130) + '1!', // Too long
      ];

      weakPasswords.forEach((password) => {
        const result = strongPasswordSchema.safeParse(password);
        expect(result.success).toBe(false);
      });
    });

    it('should require minimum length of 12 characters', () => {
      const shortPassword = 'Short1!';
      const result = strongPasswordSchema.safeParse(shortPassword);

      expect(result.success).toBe(false);
    });

    it('should require all character types', () => {
      const missingLower = 'PASSWORD123!';
      const missingUpper = 'password123!';
      const missingNumber = 'Password!';
      const missingSpecial = 'Password123';

      expect(strongPasswordSchema.safeParse(missingLower).success).toBe(false);
      expect(strongPasswordSchema.safeParse(missingUpper).success).toBe(false);
      expect(strongPasswordSchema.safeParse(missingNumber).success).toBe(false);
      expect(strongPasswordSchema.safeParse(missingSpecial).success).toBe(false);
    });
  });

  describe('secureNameSchema', () => {
    it('should validate correct names', () => {
      const validNames = [
        'John',
        'Jane',
        'Mary-Jane',
        "O'Connor",
        'Dr. Smith',
        'Jean-Pierre',
        'José',
        'María',
      ];

      validNames.forEach((name) => {
        const result = secureNameSchema.safeParse(name);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid names', () => {
      const invalidNames = [
        '',
        'A',
        'Name123',
        'Name!',
        'Name@Domain',
        'Name<script>',
        'Name&lt;script&gt;',
        'A'.repeat(51), // Too long
        'javascript:alert(1)',
        'Name\nWithNewline',
        'Name\tWithTab',
      ];

      invalidNames.forEach((name) => {
        const result = secureNameSchema.safeParse(name);
        expect(result.success).toBe(false);
      });
    });

    it('should normalize whitespace in names', () => {
      const name = '  John   Doe  ';
      const result = secureNameSchema.safeParse(name);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('John Doe');
      }
    });
  });

  describe('secureDescriptionSchema', () => {
    it('should validate correct descriptions', () => {
      const validDescriptions = [
        'Working on project features',
        'Debugging application issues',
        'Code review and testing',
        'Meeting with client about requirements',
        'Documentation update for API endpoints',
      ];

      validDescriptions.forEach((description) => {
        const result = secureDescriptionSchema.safeParse(description);
        expect(result.success).toBe(true);
      });
    });

    it('should reject dangerous content', () => {
      const dangerousDescriptions = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        'SELECT * FROM users',
        'DROP TABLE users',
        'INSERT INTO users VALUES',
        'UPDATE users SET',
        'DELETE FROM users',
        'UNION SELECT password FROM users',
        'OR 1=1--',
        'vbscript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
      ];

      dangerousDescriptions.forEach((description) => {
        const result = secureDescriptionSchema.safeParse(description);
        expect(result.success).toBe(false);
      });
    });

    it('should reject empty or too long descriptions', () => {
      const empty = '';
      const tooLong = 'A'.repeat(1001);

      expect(secureDescriptionSchema.safeParse(empty).success).toBe(false);
      expect(secureDescriptionSchema.safeParse(tooLong).success).toBe(false);
    });

    it('should normalize whitespace in descriptions', () => {
      const description = '  Working   on   project  ';
      const result = secureDescriptionSchema.safeParse(description);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Working on project');
      }
    });
  });

  describe('secureStartTimeSchema', () => {
    it('should validate correct start times', () => {
      const validTimes = [
        '2024-01-15T09:00:00.000Z',
        '2024-01-15T14:30:00.000Z',
        '2024-01-15T08:00:00.000Z',
        '2024-01-15T17:00:00.000Z',
      ];

      validTimes.forEach((time) => {
        const result = secureStartTimeSchema.safeParse(time);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid start times', () => {
      const invalidTimes = [
        'invalid-time',
        '2024-01-15T25:00:00.000Z', // Invalid hour
        '2024-01-15T09:60:00.000Z', // Invalid minute
        '2024-01-15', // Not ISO format
        '2024-01-15T09:00:00', // Missing timezone
      ];

      invalidTimes.forEach((time) => {
        const result = secureStartTimeSchema.safeParse(time);
        expect(result.success).toBe(false);
      });
    });

    it('should reject future start times', () => {
      const futureTime = new Date();
      futureTime.setDate(futureTime.getDate() + 1);

      const result = secureStartTimeSchema.safeParse(futureTime.toISOString());
      expect(result.success).toBe(false);
    });

    it('should reject very old start times', () => {
      const oldTime = new Date();
      oldTime.setFullYear(oldTime.getFullYear() - 2);

      const result = secureStartTimeSchema.safeParse(oldTime.toISOString());
      expect(result.success).toBe(false);
    });
  });

  describe('secureEndTimeSchema', () => {
    it('should validate correct end times', () => {
      const validTimes = [
        '2024-01-15T17:00:00.000Z',
        '2024-01-15T18:30:00.000Z',
        '2024-01-15T16:00:00.000Z',
        '2024-01-15T19:00:00.000Z',
      ];

      validTimes.forEach((time) => {
        const result = secureEndTimeSchema.safeParse(time);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid end times', () => {
      const invalidTimes = [
        'invalid-time',
        '2024-01-15T25:00:00.000Z', // Invalid hour
        '2024-01-15T09:60:00.000Z', // Invalid minute
        '2024-01-15', // Not ISO format
        '2024-01-15T17:00:00', // Missing timezone
      ];

      invalidTimes.forEach((time) => {
        const result = secureEndTimeSchema.safeParse(time);
        expect(result.success).toBe(false);
      });
    });

    it('should reject future end times', () => {
      const futureTime = new Date();
      futureTime.setDate(futureTime.getDate() + 1);

      const result = secureEndTimeSchema.safeParse(futureTime.toISOString());
      expect(result.success).toBe(false);
    });

    it('should reject very old end times', () => {
      const oldTime = new Date();
      oldTime.setFullYear(oldTime.getFullYear() - 2);

      const result = secureEndTimeSchema.safeParse(oldTime.toISOString());
      expect(result.success).toBe(false);
    });
  });

  describe('secureDateSchema', () => {
    it('should validate correct date formats', () => {
      const validDates = [
        '2024-01-01',
        '2024-06-15',
        '2024-12-31',
        '2023-02-28',
        '2024-02-29', // Leap year
      ];

      validDates.forEach((date) => {
        const result = secureDateSchema.safeParse(date);
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid date formats', () => {
      const invalidDates = [
        '2024/01/01',
        '01-01-2024',
        '2024-1-1',
        '2024-13-01',
        '2024-01-32',
        '2024-02-30',
        '2023-02-29', // Not a leap year
        'not-a-date',
        '2024-01-01T00:00:00',
        '2024-01-01 12:00:00',
        '',
        '2024-01-',
        '2024--01',
      ];

      invalidDates.forEach((date) => {
        const result = secureDateSchema.safeParse(date);
        expect(result.success).toBe(false);
      });
    });

    it('should reject dates outside reasonable range', () => {
      const tooOld = '2020-01-01';
      const tooFuture = '2030-01-01';

      expect(secureDateSchema.safeParse(tooOld).success).toBe(false);
      expect(secureDateSchema.safeParse(tooFuture).success).toBe(false);
    });
  });

  describe('enhancedCreateUserSchema', () => {
    it('should validate correct user registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'ValidPassword19!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = enhancedCreateUserSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.firstName).toBe('John');
        expect(result.data.lastName).toBe('Doe');
      }
    });

    it('should reject invalid user registration data', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: 'Name123',
        lastName: '',
      };

      const result = enhancedCreateUserSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should handle missing fields', () => {
      const incompleteData = {
        email: 'test@example.com',
        password: 'ValidPassword19!',
        // Missing firstName and lastName
      };

      const result = enhancedCreateUserSchema.safeParse(incompleteData);

      expect(result.success).toBe(false);
    });
  });

  describe('enhancedLoginSchema', () => {
    it('should validate correct login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'ValidPassword19!',
      };

      const result = enhancedLoginSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
        expect(result.data.password).toBe('ValidPassword19!');
      }
    });

    it('should reject invalid login data', () => {
      const invalidData = {
        email: 'invalid-email',
        password: '',
      };

      const result = enhancedLoginSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });

  describe('enhancedCreateWorkEntrySchema', () => {
    it('should validate correct work entry data', () => {
      const validData = {
        date: '2024-01-15',
        hours: 8,
        description: 'Working on project features',
      };

      const result = enhancedCreateWorkEntrySchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should reject invalid work entry data', () => {
      const invalidData = {
        date: '2024/01/15',
        hours: 25,
        description: '<script>alert("xss")</script>',
      };

      const result = enhancedCreateWorkEntrySchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });

  describe('enhancedUpdateWorkEntrySchema', () => {
    it('should validate correct update data', () => {
      const validData = {
        hours: 6,
        description: 'Updated work description',
      };

      const result = enhancedUpdateWorkEntrySchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const partialData = {
        hours: 4,
      };

      const result = enhancedUpdateWorkEntrySchema.safeParse(partialData);

      expect(result.success).toBe(true);
    });

    it('should reject empty update object', () => {
      const emptyData = {};

      const result = enhancedUpdateWorkEntrySchema.safeParse(emptyData);

      expect(result.success).toBe(false);
    });
  });

  describe('enhancedWorkEntryFiltersSchema', () => {
    it('should validate correct filters', () => {
      const validFilters = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        sortBy: 'date',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      };

      const result = enhancedWorkEntryFiltersSchema.safeParse(validFilters);

      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const minimalFilters = {};

      const result = enhancedWorkEntryFiltersSchema.safeParse(minimalFilters);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe('date');
        expect(result.data.sortOrder).toBe('desc');
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should reject invalid date ranges', () => {
      const invalidFilters = {
        startDate: '2024-01-31',
        endDate: '2024-01-01',
      };

      const result = enhancedWorkEntryFiltersSchema.safeParse(invalidFilters);

      expect(result.success).toBe(false);
    });
  });

  describe('passwordChangeSchema', () => {
    it('should validate correct password change data', () => {
      const validData = {
        currentPassword: 'CurrentPassword19!',
        newPassword: 'NewPassword19!',
      };

      const result = passwordChangeSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should reject same passwords', () => {
      const samePassword = 'SamePassword19!';
      const invalidData = {
        currentPassword: samePassword,
        newPassword: samePassword,
      };

      const result = passwordChangeSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should reject weak new passwords', () => {
      const invalidData = {
        currentPassword: 'CurrentPassword19!',
        newPassword: 'weak',
      };

      const result = passwordChangeSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });

  describe('secureFileUploadSchema', () => {
    it('should validate correct file upload data', () => {
      const validData = {
        filename: 'document.pdf',
        size: 1024 * 1024, // 1MB
        mimeType: 'application/pdf',
      };

      const result = secureFileUploadSchema.safeParse(validData);

      expect(result.success).toBe(true);
    });

    it('should reject invalid file types', () => {
      const invalidData = {
        filename: 'malware.exe',
        size: 1024,
        mimeType: 'application/x-executable',
      };

      const result = secureFileUploadSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should reject files that are too large', () => {
      const invalidData = {
        filename: 'large.pdf',
        size: 50 * 1024 * 1024, // 50MB
        mimeType: 'application/pdf',
      };

      const result = secureFileUploadSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });
  });

  describe('validateWithSecurity', () => {
    it('should return success for valid data', () => {
      const validData = 'test@example.com';

      const result = validateWithSecurity(secureEmailSchema, validData, 'test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should return errors for invalid data', () => {
      const invalidData = 'invalid-email';

      const result = validateWithSecurity(secureEmailSchema, invalidData, 'test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('email');
      }
    });

    it('should handle nested object validation', () => {
      const validData = {
        email: 'test@example.com',
        password: 'ValidPassword19!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = validateWithSecurity(enhancedCreateUserSchema, validData, 'registration');

      expect(result.success).toBe(true);
    });

    it('should provide detailed error messages for complex validation', () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        firstName: 'Name123',
        lastName: '',
      };

      const result = validateWithSecurity(enhancedCreateUserSchema, invalidData, 'registration');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.errors.some((error) => error.includes('email'))).toBe(true);
        expect(result.errors.some((error) => error.includes('password'))).toBe(true);
        expect(result.errors.some((error) => error.includes('firstName'))).toBe(true);
        expect(result.errors.some((error) => error.includes('lastName'))).toBe(true);
      }
    });

    it('should handle unexpected errors gracefully', () => {
      const circularObj: any = {};
      circularObj.self = circularObj;

      const result = validateWithSecurity(secureEmailSchema, circularObj, 'test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toEqual(['Validation failed']);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete user registration flow', () => {
      const userData = {
        email: 'NEWUSER@EXAMPLE.COM',
        password: 'SecurePassword91!',
        firstName: '  Jane  ',
        lastName: 'Smith',
      };

      const result = validateWithSecurity(enhancedCreateUserSchema, userData, 'registration');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('newuser@example.com');
        expect(result.data.firstName).toBe('Jane');
        expect(result.data.lastName).toBe('Smith');
      }
    });

    it('should validate complete work entry creation flow', () => {
      const workData = {
        date: '2024-01-15',
        hours: 8,
        description: '  Working on   security   validation  ',
      };

      const result = validateWithSecurity(enhancedCreateWorkEntrySchema, workData, 'work-entry');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBe('Working on security validation');
      }
    });

    it('should handle complex security validation scenarios', () => {
      const maliciousData = {
        email: 'test@example.com',
        password: 'ValidPassword19!',
        firstName: 'John<script>alert("xss")</script>',
        lastName: 'Doe',
      };

      const result = validateWithSecurity(enhancedCreateUserSchema, maliciousData, 'registration');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((error) => error.includes('firstName'))).toBe(true);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle null and undefined inputs', () => {
      const result1 = validateWithSecurity(secureEmailSchema, null, 'test');
      const result2 = validateWithSecurity(secureEmailSchema, undefined, 'test');

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
    });

    it('should handle various data types', () => {
      const invalidInputs = [123, true, [], {}, () => {}, Symbol('test')];

      invalidInputs.forEach((input) => {
        const result = validateWithSecurity(secureEmailSchema, input, 'test');
        expect(result.success).toBe(false);
      });
    });

    it('should provide meaningful error messages', () => {
      const result = validateWithSecurity(secureEmailSchema, 'invalid-email', 'test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]).toContain('email');
      }
    });
  });
});
