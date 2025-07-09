# BloomTech Working Hours Tracker - Backend API

A production-ready REST API for tracking working hours with user authentication, built with Node.js, Express, TypeScript, and PostgreSQL.

## 🚀 Project Overview

This application provides a secure backend API for managing personal working hours entries. Users can register, authenticate, and manage their work logs with features including:

- **User Authentication**: Secure JWT-based registration and login
- **Work Entry Management**: Create, read, update, and delete work entries
- **Advanced Filtering**: Filter entries by date ranges
- **Pagination**: Efficient pagination for large datasets
- **Data Validation**: Comprehensive input validation and sanitization
- **Security**: Production-ready security measures

## 🛠 Technology Stack

### Core Technologies

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5.x

### Development & Production

- **Testing**: Jest + Supertest
- **Validation**: Zod for runtime type checking
- **Authentication**: JSON Web Tokens (JWT)
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston
- **Environment**: Docker support

### Why These Technologies?

1. **TypeScript**: Provides type safety, better IDE support, and reduces runtime errors
2. **Prisma**: Modern ORM with excellent TypeScript integration and migration management
3. **PostgreSQL**: Robust, ACID-compliant database perfect for production applications
4. **JWT**: Stateless authentication suitable for scalable applications
5. **Zod**: Runtime validation that ensures data integrity at API boundaries

## 📁 Project Structure

```
task-bloomtech-backend/
├── src/
│   ├── controllers/           # Route handlers and business logic
│   │   ├── auth.controller.ts
│   │   └── workEntries.controller.ts
│   ├── middleware/            # Express middleware functions
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── security.middleware.ts
│   ├── services/              # Business logic and database operations
│   │   ├── auth.service.ts
│   │   ├── workEntries.service.ts
│   │   └── database.service.ts
│   ├── routes/                # API route definitions
│   │   ├── auth.routes.ts
│   │   ├── workEntries.routes.ts
│   │   └── index.ts
│   ├── types/                 # TypeScript type definitions
│   │   ├── auth.types.ts
│   │   ├── workEntry.types.ts
│   │   └── api.types.ts
│   ├── utils/                 # Utility functions
│   │   ├── jwt.utils.ts
│   │   ├── password.utils.ts
│   │   ├── validation.utils.ts
│   │   └── logger.utils.ts
│   ├── config/                # Configuration files
│   │   ├── database.config.ts
│   │   └── app.config.ts
│   ├── app.ts                 # Express app configuration
│   └── server.ts              # Application entry point
├── prisma/                    # Database schema and migrations
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/                     # Test files
│   ├── unit/
│   ├── integration/
│   └── setup/
├── docker/                    # Docker configuration
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/                      # Additional documentation
│   └── API.md
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env.example
├── .gitignore
└── README.md
```

## 🗄 Database Schema

### User Table

```sql
User {
  id          String   @id @default(cuid())
  email       String   @unique
  password    String   -- Hashed with bcrypt
  firstName   String
  lastName    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  workEntries WorkEntry[]
}
```

### WorkEntry Table

```sql
WorkEntry {
  id          String   @id @default(cuid())
  userId      String
  date        DateTime
  hours       Float
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## 🔐 API Endpoints

### Authentication

```
POST   /api/auth/register    # User registration
POST   /api/auth/login       # User login
POST   /api/auth/refresh     # Refresh JWT token
GET    /api/auth/profile     # Get user profile
```

### Work Entries

```
GET    /api/work-entries                    # Get paginated work entries
POST   /api/work-entries                    # Create new work entry
GET    /api/work-entries/:id                # Get specific work entry
PUT    /api/work-entries/:id                # Update work entry
DELETE /api/work-entries/:id                # Delete work entry
```

### Query Parameters for GET /api/work-entries

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)
- `startDate`: Filter from date (ISO 8601)
- `endDate`: Filter to date (ISO 8601)
- `sortBy`: Sort field (date, hours, createdAt)
- `sortOrder`: Sort direction (asc, desc)

## 🚦 Getting Started

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 15.x or higher
- npm or yarn package manager

### Installation

1. **Clone and setup the project**

```bash
cd task-bloomtech-backend
npm install
```

2. **Environment Configuration**

```bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
```

3. **Database Setup**

```bash
# Start PostgreSQL (if using Docker)
docker run --name postgres-dev -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:15

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

4. **Start Development Server**

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/worktracker"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-refresh-secret"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

## 🧪 Testing Strategy

### Test Types

1. **Unit Tests**: Individual functions and utilities
2. **Integration Tests**: API endpoints with database
3. **End-to-End Tests**: Complete user workflows

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage for utilities and services
- **Integration Tests**: All API endpoints
- **Database Tests**: All CRUD operations

## 🔒 Security Features

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication with access/refresh token pattern
- **Password Security**: Bcrypt hashing with configurable rounds
- **Role-based Access**: Users can only access their own data

### API Security

- **Rate Limiting**: Configurable request limits per IP
- **CORS**: Cross-origin resource sharing protection
- **Helmet**: Security headers for common vulnerabilities
- **Input Validation**: Zod schemas for all input validation
- **SQL Injection Prevention**: Prisma ORM parameterized queries

### Data Protection

- **Environment Variables**: Sensitive data in environment variables
- **Password Policy**: Minimum length and complexity requirements
- **Data Sanitization**: XSS protection through input sanitization

## ⚡ Performance Considerations

### Database Optimization

- **Indexing**: Strategic indexes on frequently queried fields
- **Pagination**: Cursor-based pagination for large datasets
- **Connection Pooling**: Prisma connection pooling
- **Query Optimization**: Efficient Prisma queries with select/include

### API Performance

- **Response Compression**: Gzip compression for responses
- **Caching Headers**: Appropriate cache headers for static content
- **Request Validation**: Early request validation to reduce processing
- **Error Handling**: Efficient error responses

## 🐳 Docker Support

### Development

```bash
docker-compose up -d
```

### Production

```bash
docker build -t worktracker-api .
docker run -p 3000:3000 --env-file .env worktracker-api
```

## 🚀 Deployment

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL/TLS certificates configured
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented
- [ ] CI/CD pipeline configured

### Recommended Hosting

- **Application**: Railway, Render, or AWS ECS
- **Database**: AWS RDS, Google Cloud SQL, or Railway PostgreSQL
- **Monitoring**: Sentry for error tracking

## 📊 Monitoring & Logging

### Logging Strategy

- **Request Logging**: All API requests with timing
- **Error Logging**: Detailed error information with stack traces
- **Database Logging**: Query performance monitoring
- **Security Logging**: Authentication attempts and failures

### Health Checks

```
GET /health              # Basic health check
GET /health/detailed     # Detailed system status
```

## 🤝 Contributing

### Development Workflow

1. Create feature branch from `main`
2. Write tests for new functionality
3. Implement feature with TypeScript
4. Ensure all tests pass
5. Update documentation if needed
6. Submit pull request

### Code Standards

- **ESLint**: Airbnb TypeScript configuration
- **Prettier**: Automatic code formatting
- **Husky**: Pre-commit hooks for quality checks
- **Conventional Commits**: Standardized commit messages

## 📚 Additional Resources

- [API Documentation](./docs/API.md)
- [Database Schema](./prisma/schema.prisma)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Security Policy](./SECURITY.md)

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

**Built with ❤️ for BloomTech Technical Assessment**
