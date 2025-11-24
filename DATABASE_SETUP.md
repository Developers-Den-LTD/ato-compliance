# Database Setup Guide

## Prerequisites
- Docker and Docker Compose installed
- pnpm installed

## Quick Start

### 1. Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This will:
- Start PostgreSQL 16 on port 5432
- Create database: `ato_compliance`
- Create user: `ato_user` with password: `ato_password`
- Initialize with required extensions

### 2. Verify Database is Running

```bash
docker-compose ps
```

You should see the `ato-compliance-db` container running.

### 3. Generate Database Migrations

```bash
cd apps/backend
pnpm db:generate
```

This creates migration files based on your schema.

### 4. Push Schema to Database

```bash
pnpm db:push
```

This applies the schema directly to the database (good for development).

OR run migrations:

```bash
pnpm db:migrate
```

### 5. Start the Backend

```bash
cd ../..
pnpm run backend:dev
```

The backend will connect to PostgreSQL and show:
- ✅ Database connection successful
- ✅ Database ready

### 6. Access Database

**Using Docker exec:**
```bash
docker exec -it ato-compliance-db psql -U ato_user -d ato_compliance
```

**Using Drizzle Studio (GUI):**
```bash
cd apps/backend
pnpm db:studio
```

Then open http://localhost:4983

## Database Commands

### Stop Database
```bash
docker-compose down
```

### Stop and Remove Data
```bash
docker-compose down -v
```

### View Logs
```bash
docker-compose logs -f postgres
```

### Restart Database
```bash
docker-compose restart
```

## Connection Details

- **Host:** localhost
- **Port:** 5432
- **Database:** ato_compliance
- **User:** ato_user
- **Password:** ato_password
- **Connection String:** `postgresql://ato_user:ato_password@localhost:5432/ato_compliance`

## Troubleshooting

### Port 5432 already in use
If you have PostgreSQL already running locally:
```bash
# Stop local PostgreSQL (Windows)
net stop postgresql-x64-16

# Or change the port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead
```

### Connection refused
Make sure Docker is running and the container is up:
```bash
docker-compose ps
docker-compose logs postgres
```

### Reset Database
```bash
docker-compose down -v
docker-compose up -d
cd apps/backend
pnpm db:push
```
