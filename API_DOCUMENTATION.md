# BloomTech Work Tracker API Documentation

## 📋 Overview

The BloomTech Work Tracker API is a RESTful backend service for managing work time entries. It provides secure user authentication and full CRUD operations for tracking daily work hours.

**Base URL**: `http://localhost:3000`  
**API Version**: `v1`  
**API Prefix**: `/api`

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. All work entry endpoints require authentication.

### Authentication Flow

1. **Register** a new user account
2. **Login** to receive access and refresh tokens
3. Include the **access token** in the `Authorization` header for protected routes
4. **Refresh** the token when it expires

### Token Format

```http
Authorization: Bearer <your-access-token>
```

---

## 🚀 API Endpoints

### Authentication Endpoints

#### 1. Register User

```http
POST /api/auth/register
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Password Requirements:**

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Response (201):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "clm123abc456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2025-01-08T12:00:00.000Z",
      "updatedAt": "2025-01-08T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "24h"
    }
  }
}
```

#### 2. Login User

```http
POST /api/auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "clm123abc456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2025-01-08T12:00:00.000Z",
      "updatedAt": "2025-01-08T12:00:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "24h"
    }
  }
}
```

#### 3. Refresh Token

```http
POST /api/auth/refresh
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  }
}
```

#### 4. Get User Profile

```http
GET /api/auth/profile
Authorization: Bearer <access-token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "clm123abc456",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "createdAt": "2025-01-08T12:00:00.000Z",
    "updatedAt": "2025-01-08T12:00:00.000Z"
  }
}
```

---

### Work Entry Endpoints

> **Note**: All work entry endpoints require authentication via `Authorization: Bearer <token>` header.

#### 1. Get All Work Entries

```http
GET /api/work-entries
Authorization: Bearer <access-token>
```

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `startDate` (optional): Filter entries from date (YYYY-MM-DD format)
- `endDate` (optional): Filter entries to date (YYYY-MM-DD format)
- `sortBy` (optional): Sort field (`startTime`, `endTime`, `duration`, `createdAt`) (default: `startTime`)
- `sortOrder` (optional): Sort order (`asc`, `desc`) (default: `desc`)

**Example Request:**

```http
GET /api/work-entries?page=1&limit=10&startDate=2025-01-01&endDate=2025-01-31&sortBy=startTime&sortOrder=desc
```

**Response (200):**

```json
{
  "success": true,
  "message": "Work entries retrieved successfully",
  "data": [
    {
      "id": "clm456def789",
      "startTime": "2025-01-08T09:00:00.000Z",
      "endTime": "2025-01-08T17:00:00.000Z",
      "duration": 8.0,
      "description": "Working on API development",
      "createdAt": "2025-01-08T12:00:00.000Z",
      "updatedAt": "2025-01-08T12:00:00.000Z"
    },
    {
      "id": "clm789ghi012",
      "startTime": "2025-01-07T09:30:00.000Z",
      "endTime": "2025-01-07T17:00:00.000Z",
      "duration": 7.5,
      "description": "Frontend integration work",
      "createdAt": "2025-01-07T12:00:00.000Z",
      "updatedAt": "2025-01-07T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### 2. Create Work Entry

```http
POST /api/work-entries
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "startTime": "2025-01-08T09:00:00.000Z",
  "endTime": "2025-01-08T17:00:00.000Z",
  "description": "Working on frontend integration"
}
```

**Validation Rules:**

- `startTime`: Required, ISO datetime format (YYYY-MM-DDTHH:mm:ss.sssZ), cannot be future date or older than 1 year
- `endTime`: Required, ISO datetime format (YYYY-MM-DDTHH:mm:ss.sssZ), cannot be future date or older than 1 year, must be after startTime
- `duration`: Automatically calculated from startTime and endTime, must be between 15 minutes and 24 hours
- `description`: Required, 1-500 characters

**Response (201):**

```json
{
  "success": true,
  "message": "Work entry created successfully",
  "data": {
    "id": "clm456def789",
    "startTime": "2025-01-08T09:00:00.000Z",
    "endTime": "2025-01-08T17:00:00.000Z",
    "duration": 8.0,
    "description": "Working on frontend integration",
    "createdAt": "2025-01-08T12:00:00.000Z",
    "updatedAt": "2025-01-08T12:00:00.000Z"
  }
}
```

#### 3. Get Single Work Entry

```http
GET /api/work-entries/:id
Authorization: Bearer <access-token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Work entry retrieved successfully",
  "data": {
    "id": "clm456def789",
    "startTime": "2025-01-08T09:00:00.000Z",
    "endTime": "2025-01-08T17:00:00.000Z",
    "duration": 8.0,
    "description": "Working on frontend integration",
    "createdAt": "2025-01-08T12:00:00.000Z",
    "updatedAt": "2025-01-08T12:00:00.000Z"
  }
}
```

#### 4. Update Work Entry

```http
PUT /api/work-entries/:id
Authorization: Bearer <access-token>
Content-Type: application/json
```

**Request Body (all fields optional):**

```json
{
  "startTime": "2025-01-08T09:00:00.000Z",
  "endTime": "2025-01-08T16:30:00.000Z",
  "description": "Updated: Working on frontend integration and testing"
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Work entry updated successfully",
  "data": {
    "id": "clm456def789",
    "startTime": "2025-01-08T09:00:00.000Z",
    "endTime": "2025-01-08T16:30:00.000Z",
    "duration": 7.5,
    "description": "Updated: Working on frontend integration and testing",
    "createdAt": "2025-01-08T12:00:00.000Z",
    "updatedAt": "2025-01-08T14:30:00.000Z"
  }
}
```

#### 5. Delete Work Entry

```http
DELETE /api/work-entries/:id
Authorization: Bearer <access-token>
```

**Response (200):**

```json
{
  "success": true,
  "message": "Work entry deleted successfully"
}
```

#### 6. Get Work Entry Statistics

```http
GET /api/work-entries/stats
Authorization: Bearer <access-token>
```

**Query Parameters (optional):**

- `startDate`: Start date for statistics (YYYY-MM-DD)
- `endDate`: End date for statistics (YYYY-MM-DD)

**Example:**

```http
GET /api/work-entries/stats?startDate=2025-01-01&endDate=2025-01-31
```

**Response (200):**

```json
{
  "success": true,
  "message": "Work entry statistics retrieved successfully",
  "data": {
    "totalHours": 156.5,
    "averageHours": 7.8,
    "totalEntries": 20
  }
}
```

---

## 🚨 Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "details": ["Detailed error messages"]
}
```

### Common HTTP Status Codes

| Status Code | Description           | Example                       |
| ----------- | --------------------- | ----------------------------- |
| `200`       | Success               | Data retrieved successfully   |
| `201`       | Created               | Resource created successfully |
| `400`       | Bad Request           | Invalid input data            |
| `401`       | Unauthorized          | Missing or invalid token      |
| `403`       | Forbidden             | Access denied                 |
| `404`       | Not Found             | Resource not found            |
| `409`       | Conflict              | Duplicate entry (same date)   |
| `422`       | Validation Error      | Input validation failed       |
| `429`       | Too Many Requests     | Rate limit exceeded           |
| `500`       | Internal Server Error | Server error                  |

### Authentication Errors

```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Access token is missing",
  "code": "TOKEN_MISSING"
}
```

```json
{
  "success": false,
  "error": "Authentication failed",
  "message": "Token has expired",
  "code": "TOKEN_EXPIRED"
}
```

### Validation Errors

```json
{
  "success": false,
  "message": "Invalid input data",
  "errors": [
    {
      "code": "invalid_type",
      "expected": "number",
      "received": "string",
      "path": ["hours"],
      "message": "Hours must be a positive number"
    }
  ]
}
```

### Business Logic Errors

```json
{
  "success": false,
  "message": "A work entry already exists for this date. Please update the existing entry instead."
}
```

---

## 📊 Data Models

### User Model

```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
```

### Work Entry Model

```typescript
interface WorkEntry {
  id: string;
  startTime: string; // ISO datetime (YYYY-MM-DDTHH:mm:ss.sssZ)
  endTime: string; // ISO datetime (YYYY-MM-DDTHH:mm:ss.sssZ)
  duration: number; // Calculated duration in hours (rounded to 2 decimal places)
  description: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}
```

### Pagination Model

```typescript
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

---

## 💻 Frontend Integration Examples

### JavaScript/TypeScript Examples

#### 1. Authentication Service

```javascript
class AuthService {
  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('accessToken');
  }

  async register(userData) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();
    if (data.success) {
      this.setTokens(data.data.tokens);
    }
    return data;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (data.success) {
      this.setTokens(data.data.tokens);
    }
    return data;
  }

  setTokens(tokens) {
    this.token = tokens.accessToken;
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }
}
```

#### 2. Work Entry Service

```javascript
class WorkEntryService {
  constructor(authService, baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
    this.auth = authService;
  }

  async getWorkEntries(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseUrl}/work-entries?${params}`, {
      headers: this.auth.getAuthHeaders(),
    });
    return response.json();
  }

  async createWorkEntry(entryData) {
    const response = await fetch(`${this.baseUrl}/work-entries`, {
      method: 'POST',
      headers: this.auth.getAuthHeaders(),
      body: JSON.stringify(entryData),
    });
    return response.json();
  }

  async updateWorkEntry(id, entryData) {
    const response = await fetch(`${this.baseUrl}/work-entries/${id}`, {
      method: 'PUT',
      headers: this.auth.getAuthHeaders(),
      body: JSON.stringify(entryData),
    });
    return response.json();
  }

  async deleteWorkEntry(id) {
    const response = await fetch(`${this.baseUrl}/work-entries/${id}`, {
      method: 'DELETE',
      headers: this.auth.getAuthHeaders(),
    });
    return response.json();
  }

  async getStats(startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const response = await fetch(`${this.baseUrl}/work-entries/stats?${params}`, {
      headers: this.auth.getAuthHeaders(),
    });
    return response.json();
  }
}
```

#### 3. Usage Example

```javascript
// Initialize services
const authService = new AuthService();
const workEntryService = new WorkEntryService(authService);

// Login
const loginResult = await authService.login('user@example.com', 'password');
if (loginResult.success) {
  console.log('Logged in successfully');
}

// Create work entry
const newEntry = await workEntryService.createWorkEntry({
  date: '2025-01-08',
  hours: 8.0,
  description: 'Frontend development work',
});

// Get work entries with pagination
const entries = await workEntryService.getWorkEntries({
  page: 1,
  limit: 10,
  sortBy: 'startTime',
  sortOrder: 'desc',
});
```

---

## 🔧 Development Notes

### Rate Limiting

- The API implements rate limiting to prevent abuse
- Default limit: 100 requests per 15 minutes per IP
- Rate limit headers are included in responses

### CORS Configuration

- CORS is configured to allow frontend applications
- Development: Allows all origins
- Production: Configure specific allowed origins

### Data Validation

- All inputs are validated using Zod schemas
- Business rules are enforced (e.g., quarter-hour increments)
- Comprehensive error messages guide proper usage

### Security Features

- JWT tokens with secure configuration
- Password hashing with bcrypt
- SQL injection prevention via Prisma ORM
- XSS protection through input sanitization

---

## 🚀 Getting Started Checklist

1. **Authentication Flow**
   - [ ] Implement user registration
   - [ ] Implement user login
   - [ ] Store and manage JWT tokens
   - [ ] Handle token refresh
   - [ ] Implement logout (clear tokens)

2. **Work Entry Management**
   - [ ] Create work entry form with validation
   - [ ] Display work entries list with pagination
   - [ ] Implement edit/update functionality
   - [ ] Add delete confirmation
   - [ ] Show work entry statistics

3. **Error Handling**
   - [ ] Handle authentication errors
   - [ ] Display validation errors
   - [ ] Handle network errors
   - [ ] Show user-friendly error messages

4. **User Experience**
   - [ ] Loading states for API calls
   - [ ] Success/error notifications
   - [ ] Form validation feedback
   - [ ] Responsive design for mobile

---

For questions or issues, please contact the backend development team.

**API Status**: ✅ Ready for Integration  
**Last Updated**: January 8, 2025
