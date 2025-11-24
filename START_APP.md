# 🚀 ATO Compliance Agent - Startup Guide

Complete guide to run your full application stack.

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Docker Desktop running
- ✅ Node.js and pnpm installed
- ✅ All dependencies installed (`pnpm install`)

---

## 🎯 Quick Start (ONE Command!)

### Start Everything at Once:

```bash
pnpm dev
```

**That's it!** This single command will:
1. ✅ Start PostgreSQL in Docker
2. ✅ Wait 5 seconds for database to be ready
3. ✅ Start Backend (Express API on port 3000)
4. ✅ Start Frontend (React on port 5173)

**You should see:**
- Blue text: Backend logs
- Green text: Frontend logs
- Both services running in one terminal!

**Access the app:**
Open http://localhost:5173 in your browser

**To stop everything:**
Press `Ctrl+C` once, then run:
```bash
pnpm stop
```

---

## 🎯 Alternative: Manual Start (3 Steps)

If you prefer to run services separately:

### Step 1: Start Database
```bash
docker-compose up -d
```

### Step 2: Start Backend (Terminal 1)
```bash
pnpm run backend:dev
```

### Step 3: Start Frontend (Terminal 2)
```bash
pnpm run frontend:dev
```

---

## 🎨 Your Running Stack

| Service    | URL                        | Status |
|------------|----------------------------|--------|
| Frontend   | http://localhost:5173      | ✅     |
| Backend    | http://localhost:3000      | ✅     |
| Database   | localhost:5432             | ✅     |
| DB Studio  | http://localhost:4983      | 🔧     |

---

## 🛠️ Useful Commands

### Database Management

**View database in GUI:**
```bash
cd apps/backend
pnpm db:studio
```
Opens Drizzle Studio at http://localhost:4983

**Connect to database directly:**
```bash
docker exec -it ato-compliance-db psql -U ato_user -d ato_compliance
```

**View database logs:**
```bash
docker-compose logs -f postgres
```

**Reset database (⚠️ deletes all data):**
```bash
docker-compose down -v
docker-compose up -d
cd apps/backend
pnpm db:push
```

---

### Development Commands

**Run all tests:**
```bash
pnpm test
```

**Build everything:**
```bash
pnpm build
```

**Lint code:**
```bash
pnpm lint
```

**Format code:**
```bash
pnpm format
```

---

## 🔄 Restart Everything

If something goes wrong, restart in this order:

### 1. Stop Everything
```bash
# Stop frontend (Ctrl+C in frontend terminal)
# Stop backend (Ctrl+C in backend terminal)
docker-compose down
```

### 2. Start Fresh
```bash
# Start database
docker-compose up -d

# Wait 5 seconds for database to be ready
timeout /t 5

# Start backend (in one terminal)
pnpm run backend:dev

# Start frontend (in another terminal)
pnpm run frontend:dev
```

---

## 🐛 Troubleshooting

### Database won't start
```bash
# Check if port 5432 is already in use
netstat -ano | findstr :5432

# If PostgreSQL is running locally, stop it:
net stop postgresql-x64-16

# Or change port in docker-compose.yml to 5433
```

### Backend can't connect to database
```bash
# Check database is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify connection string in apps/backend/.env
DATABASE_URL=postgresql://ato_user:ato_password@localhost:5432/ato_compliance
```

### Frontend shows blank page
```bash
# Check browser console for errors
# Clear browser cache (Ctrl+Shift+R)
# Check if backend is running
# Verify mock API is enabled (check console for green message)
```

### Port already in use
```bash
# Frontend (5173)
netstat -ano | findstr :5173
# Kill the process using the PID shown

# Backend (3000)
netstat -ano | findstr :3000
# Kill the process using the PID shown
```

---

## 📦 Project Structure

```
ato-compliance/
├── apps/
│   └── backend/          # Express API (Port 3000)
│       ├── src/
│       │   ├── main.ts   # Entry point
│       │   └── db.ts     # Database connection
│       └── .env          # Database credentials
├── packages/
│   ├── frontend/         # React App (Port 5173)
│   │   └── src/
│   │       ├── App.tsx
│   │       └── lib/mockApi.ts  # Mock API
│   └── shared/           # Shared types & schema
│       └── src/
│           └── schema.ts # Database schema
├── docker-compose.yml    # PostgreSQL config
└── package.json          # Root scripts
```

---

## 🎓 Development Workflow

### Daily Development

1. **Morning startup:**
   ```bash
   docker-compose up -d
   pnpm run backend:dev    # Terminal 1
   pnpm run frontend:dev   # Terminal 2
   ```

2. **Make changes:**
   - Edit files in `packages/frontend/src` or `apps/backend/src`
   - Changes auto-reload (hot-reload enabled)

3. **End of day:**
   ```bash
   # Ctrl+C in both terminals
   docker-compose down
   ```

### Adding New Features

1. **Update database schema:**
   ```bash
   # Edit packages/shared/src/schema.ts
   pnpm --filter @ato-compliance/shared build
   cd apps/backend
   pnpm db:push
   ```

2. **Add backend endpoint:**
   ```bash
   # Edit apps/backend/src/main.ts
   # Backend auto-reloads
   ```

3. **Update frontend:**
   ```bash
   # Edit packages/frontend/src/
   # Frontend auto-reloads
   ```

---

## 🔐 Login Credentials

The app uses **mock authentication** in development:

- **Username:** Any username (e.g., `admin`)
- **Password:** Any password (e.g., `admin123`)
- **Auto-login:** Enabled in development mode

All credentials are accepted by the mock API!

---

## 📚 Additional Resources

- **Database Schema:** `packages/shared/src/schema.ts`
- **API Endpoints:** `apps/backend/src/main.ts`
- **Mock API:** `packages/frontend/src/lib/mockApi.ts`
- **Database Setup:** `DATABASE_SETUP.md`

---

## ✅ Success Checklist

Before you start coding, verify:

- [ ] Docker Desktop is running
- [ ] `docker-compose ps` shows database as healthy
- [ ] Backend shows "✅ Database ready"
- [ ] Frontend opens at http://localhost:5173
- [ ] You can login with any credentials
- [ ] Browser console shows "[Mock API] Enabled"

---

## 🎉 You're Ready!

Your ATO Compliance Agent is now running with:
- ✅ PostgreSQL database with 32 tables
- ✅ Express backend with database connection
- ✅ React frontend with mock API
- ✅ Hot-reload enabled for fast development

**Happy coding! 🚀**
