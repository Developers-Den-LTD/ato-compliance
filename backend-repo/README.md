# ATO Compliance Backend

Backend API for the ATO Compliance Agent application.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Drizzle ORM
- **Authentication**: JWT (access + refresh tokens)

## Project Structure

```
ato-compliance-backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── types/           # TypeScript types
│   ├── utils/           # Utility functions
│   ├── schema.ts        # Database schema (Drizzle)
│   ├── db.ts            # Database connection
│   └── main.ts          # Application entry point
├── dist/                # Build output
├── drizzle/             # Database migrations
├── .env                 # Environment variables
├── tsconfig.json        # TypeScript configuration
├── drizzle.config.ts    # Drizzle ORM configuration
└── docker-compose.yml   # PostgreSQL setup
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for PostgreSQL)
- npm or pnpm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your configuration:
   ```env
   DATABASE_URL=postgresql://ato_user:ato_password@localhost:5432/ato_compliance
   JWT_ACCESS_SECRET=your-secret-key
   JWT_REFRESH_SECRET=your-refresh-secret
   PORT=3000
   ```

4. Start PostgreSQL:
   ```bash
   npm run db:start
   ```

5. Push database schema:
   ```bash
   npm run db:push
   ```

### Development

Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Building for Production

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Systems
- `GET /api/systems` - List all systems
- `POST /api/systems` - Create new system
- `GET /api/systems/:id` - Get system by ID
- `PUT /api/systems/:id` - Update system
- `DELETE /api/systems/:id` - Delete system
- `GET /api/systems/:id/metrics` - Get system metrics
- `GET /api/systems/:id/readiness` - Get system readiness

### Controls
- `GET /api/controls` - List all controls
- `GET /api/controls/families` - Get control families
- `GET /api/controls/:id` - Get control by ID
- `GET /api/systems/:systemId/controls` - Get system controls
- `PUT /api/systems/:systemId/controls/:controlId` - Update system control
- `POST /api/systems/:systemId/controls/bulk-assign` - Bulk assign controls
- `DELETE /api/systems/:systemId/controls/:controlId` - Remove system control

### Users (Admin only)
- `GET /api/users` - List all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `DELETE /api/users/:id` - Delete user

### Health Check
- `GET /health` - API health status

## Database Commands

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes (development)
npm run db:push

# Open Drizzle Studio (database GUI)
npm run db:studio

# Start PostgreSQL
npm run db:start

# Stop PostgreSQL
npm run db:stop
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ato_user:ato_password@localhost:5432/ato_compliance` |
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `JWT_ACCESS_SECRET` | JWT access token secret | Required |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Required |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

## CORS Configuration

The backend allows requests from:
- `http://localhost:5173` (development)
- `process.env.FRONTEND_URL` (production)

Update `.env` to add your frontend URL:
```env
FRONTEND_URL=https://your-frontend-domain.com
```

## Docker Deployment

Build and run with Docker:

```bash
docker build -t ato-backend .
docker run -p 3000:3000 --env-file .env ato-backend
```

Or use Docker Compose (includes PostgreSQL):

```bash
docker-compose up -d
```

## Testing

The API can be tested using:
- Postman/Insomnia
- curl
- Frontend application

Example curl request:
```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

## Features

- ✅ JWT Authentication with refresh tokens
- ✅ Role-based access control (admin/user)
- ✅ NIST 800-53 control library
- ✅ STIG/JSIG compliance tracking
- ✅ System management
- ✅ Control implementation tracking
- ✅ RESTful API design
- ✅ TypeScript for type safety
- ✅ Drizzle ORM for database operations
- ✅ CORS enabled for frontend integration

## License

Private - All rights reserved
