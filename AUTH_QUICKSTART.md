# Authentication Quick Start Guide

## 🚀 Getting Started

### 1. Start the Backend

```bash
# Make sure PostgreSQL is running
docker-compose up -d

# Start the backend server
pnpm dev
```

The backend will start on `http://localhost:3000`

### 2. Start the Frontend

```bash
# In a new terminal
cd packages/frontend
pnpm dev
```

The frontend will start on `http://localhost:5173`

### 3. Create Your First User

1. Open your browser to `http://localhost:5173`
2. You'll be redirected to the login page
3. Click "Create one" to go to the registration page
4. Enter a username (min 3 characters) and password (min 6 characters)
5. Click "Create Account"
6. You'll be automatically logged in and redirected to the dashboard

### 4. Test the Authentication

**Login Flow:**
- Navigate to `http://localhost:5173/login`
- Enter your credentials
- Click "Sign In"
- You'll be redirected to the dashboard

**Logout Flow:**
- Click the "Logout" button in the sidebar
- You'll be redirected to the login page
- Your session will be cleared

**Protected Routes:**
- Try accessing `http://localhost:5173/systems` without logging in
- You'll be automatically redirected to the login page
- After logging in, you can access all protected routes

## 🔐 API Testing with cURL

### Register a New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }' \
  -c cookies.txt -v
```

**Expected Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "username": "testuser"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "testpass123"
  }' \
  -c cookies.txt -v
```

### Get Current User (Protected Route)

```bash
# Replace <ACCESS_TOKEN> with the token from login/register response
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -b cookies.txt
```

**Expected Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "username": "testuser"
  }
}
```

### Refresh Access Token

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt
```

### Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

## 🧪 Testing in Browser Console

Open the browser console on `http://localhost:5173` and try:

```javascript
// Register a new user
const registerResponse = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    username: 'consoleuser',
    password: 'password123'
  })
});
const registerData = await registerResponse.json();
console.log('Registered:', registerData);

// Login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    username: 'consoleuser',
    password: 'password123'
  })
});
const loginData = await loginResponse.json();
console.log('Logged in:', loginData);

// Get current user
const meResponse = await fetch('http://localhost:3000/api/auth/me', {
  headers: { 'Authorization': `Bearer ${loginData.accessToken}` },
  credentials: 'include'
});
const meData = await meResponse.json();
console.log('Current user:', meData);

// Logout
const logoutResponse = await fetch('http://localhost:3000/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
});
console.log('Logged out:', await logoutResponse.json());
```

## 📝 Frontend Usage Examples

### Using the Auth Context

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return (
    <div>
      <p>Welcome, {user.username}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Making Authenticated API Calls

```typescript
import { authApi } from '@/lib/authApi';

async function fetchUserData() {
  try {
    // This automatically includes the access token and handles refresh
    const response = await authApi.authenticatedFetch(
      'http://localhost:3000/api/some-protected-endpoint'
    );
    
    if (!response.ok) {
      throw new Error('Request failed');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    throw error;
  }
}
```

## 🔍 Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access login page at `/login`
- [ ] Can access register page at `/register`
- [ ] Can create a new user
- [ ] Can login with created user
- [ ] Redirected to dashboard after login
- [ ] Can see username in header
- [ ] Can access protected routes (systems, controls, etc.)
- [ ] Can logout successfully
- [ ] Redirected to login after logout
- [ ] Cannot access protected routes after logout
- [ ] Can login again with same credentials

## 🐛 Common Issues

### Issue: "Failed to fetch" errors

**Cause:** Backend not running or CORS issue

**Solution:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# If not running, start it
pnpm dev
```

### Issue: "Invalid credentials" on login

**Cause:** User doesn't exist or wrong password

**Solution:**
- Register a new user first
- Make sure you're using the correct username/password
- Check backend logs for errors

### Issue: Redirected to login immediately after logging in

**Cause:** Token not being stored or sent correctly

**Solution:**
- Check browser console for errors
- Verify cookies are enabled
- Check that `credentials: 'include'` is in fetch requests

### Issue: "Token expired" errors

**Cause:** Access token expired (normal after 15 minutes)

**Solution:**
- This should be handled automatically by the frontend
- If not working, check that refresh token cookie exists
- Try logging out and logging in again

## 📊 Database Verification

Check if users are being created in the database:

```bash
# Connect to PostgreSQL
docker exec -it ato-compliance-db psql -U ato_user -d ato_compliance

# List users
SELECT id, username FROM users;

# Exit
\q
```

## 🎯 Next Steps

1. **Customize the UI:** Modify login/register pages to match your branding
2. **Add More Fields:** Extend user model with email, name, etc.
3. **Implement Password Reset:** Add forgot password functionality
4. **Add Rate Limiting:** Protect against brute force attacks
5. **Enable MFA:** Add two-factor authentication
6. **Audit Logging:** Track authentication events

## 📚 Additional Resources

- [Full Authentication Documentation](./AUTHENTICATION.md)
- [Backend API Reference](./AUTHENTICATION.md#api-endpoints)
- [Security Best Practices](./AUTHENTICATION.md#security-best-practices)

---

**Need Help?** Check the troubleshooting section in [AUTHENTICATION.md](./AUTHENTICATION.md#troubleshooting)
