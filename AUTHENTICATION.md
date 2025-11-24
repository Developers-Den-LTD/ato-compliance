# Authentication System Documentation

## Overview

The ATO Compliance Agent uses a JWT-based authentication system with access and refresh tokens for secure user authentication.

## Architecture

### Backend Structure

```
apps/backend/src/
├── config/
│   └── auth.config.ts          # Authentication configuration
├── controllers/
│   └── auth.controller.ts      # Request handlers
├── middleware/
│   └── auth.middleware.ts      # Authentication middleware
├── routes/
│   ├── auth.routes.ts          # Auth endpoints
│   └── index.ts                # Route aggregator
├── services/
│   └── auth.service.ts         # Business logic
├── types/
│   └── auth.types.ts           # TypeScript types
└── utils/
    └── jwt.utils.ts            # JWT utilities
```

### Frontend Structure

```
packages/frontend/src/
├── contexts/
│   └── AuthContext.tsx         # React context for auth state
├── lib/
│   └── authApi.ts              # API client for auth
├── pages/
│   ├── login.tsx               # Login page
│   └── register.tsx            # Register page
└── components/
    └── ProtectedRoute.tsx      # Route protection component
```

## Features

### ✅ Implemented

1. **User Registration**
   - Username validation (min 3 characters)
   - Password validation (min 6 characters)
   - Password hashing with bcrypt (10 salt rounds)
   - Duplicate username prevention

2. **User Login**
   - Credential validation
   - Secure password comparison
   - JWT token generation

3. **Token Management**
   - Access tokens (15 minutes expiry)
   - Refresh tokens (7 days expiry)
   - HTTP-only cookies for refresh tokens
   - Automatic token refresh on expiry

4. **Protected Routes**
   - Middleware for route protection
   - Automatic redirect to login
   - Token verification

5. **Session Management**
   - Persistent sessions via refresh tokens
   - Secure logout (clears tokens)
   - Auto-login on page refresh

## API Endpoints

### Public Endpoints

#### POST `/api/auth/register`
Register a new user.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "username": "string"
  },
  "accessToken": "string"
}
```

**Errors:**
- `400` - Validation error
- `409` - Username already exists

---

#### POST `/api/auth/login`
Login with credentials.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "username": "string"
  },
  "accessToken": "string"
}
```

**Errors:**
- `400` - Missing credentials
- `401` - Invalid credentials

---

#### POST `/api/auth/refresh`
Refresh access token using refresh token cookie.

**Response:**
```json
{
  "accessToken": "string",
  "user": {
    "id": "string",
    "username": "string"
  }
}
```

**Errors:**
- `401` - Invalid or expired refresh token

---

#### POST `/api/auth/logout`
Logout and clear refresh token.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

---

### Protected Endpoints

#### GET `/api/auth/me`
Get current user information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "username": "string"
  }
}
```

**Errors:**
- `401` - Not authenticated or invalid token

## Security Best Practices

### ✅ Implemented

1. **Password Security**
   - Bcrypt hashing with 10 salt rounds
   - Never store plain text passwords
   - Minimum password length enforcement

2. **Token Security**
   - Short-lived access tokens (15 minutes)
   - Long-lived refresh tokens (7 days)
   - HTTP-only cookies for refresh tokens
   - Separate secrets for access and refresh tokens

3. **Cookie Security**
   - HTTP-only flag (prevents XSS)
   - Secure flag in production (HTTPS only)
   - SameSite=strict (prevents CSRF)
   - 7-day expiry

4. **API Security**
   - CORS configured for frontend origin
   - Credentials included in requests
   - Token verification on protected routes

5. **Error Handling**
   - Generic error messages (no user enumeration)
   - Proper HTTP status codes
   - Logging for debugging

## Environment Variables

Add these to `apps/backend/.env`:

```env
# JWT Configuration
JWT_ACCESS_SECRET=your-super-secret-access-token-key-change-in-production-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-change-in-production-min-32-chars

# Node Environment
NODE_ENV=development
```

**⚠️ Important:** Change these secrets in production! Use strong, random strings (32+ characters).

## Usage Examples

### Frontend - Login

```typescript
import { useAuth } from '@/contexts/AuthContext';

function LoginComponent() {
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      await login({ username: 'user', password: 'pass' });
      // User is now logged in
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
}
```

### Frontend - Protected Route

```typescript
import { useAuth } from '@/contexts/AuthContext';

function ProtectedPage() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return <div>Welcome {user.username}!</div>;
}
```

### Frontend - Authenticated API Call

```typescript
import { authApi } from '@/lib/authApi';

async function fetchProtectedData() {
  const response = await authApi.authenticatedFetch('/api/protected-endpoint');
  const data = await response.json();
  return data;
}
```

### Backend - Protect Route

```typescript
import { authenticate } from '../middleware/auth.middleware';

router.get('/protected', authenticate, (req: AuthRequest, res) => {
  // req.user contains { userId, username }
  res.json({ message: `Hello ${req.user.username}` });
});
```

## Token Flow

### Initial Login
```
1. User submits credentials
2. Backend validates credentials
3. Backend generates access + refresh tokens
4. Refresh token sent as HTTP-only cookie
5. Access token sent in response body
6. Frontend stores access token in memory/localStorage
7. Frontend includes access token in Authorization header
```

### Token Refresh
```
1. Access token expires (15 minutes)
2. API request returns 401
3. Frontend automatically calls /auth/refresh
4. Backend validates refresh token from cookie
5. Backend generates new access token
6. Frontend retries original request with new token
```

### Logout
```
1. User clicks logout
2. Frontend calls /auth/logout
3. Backend clears refresh token cookie
4. Frontend clears access token
5. User redirected to login page
```

## Testing

### Manual Testing

1. **Register a new user:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' \
  -c cookies.txt
```

2. **Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' \
  -c cookies.txt
```

3. **Access protected route:**
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <access_token>" \
  -b cookies.txt
```

4. **Refresh token:**
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -b cookies.txt
```

5. **Logout:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

## Future Enhancements

### Recommended Additions

1. **Email Verification**
   - Add email field to user model
   - Send verification emails
   - Verify email before allowing login

2. **Password Reset**
   - Forgot password flow
   - Email reset links
   - Temporary reset tokens

3. **Multi-Factor Authentication (MFA)**
   - TOTP support
   - SMS verification
   - Backup codes

4. **Rate Limiting**
   - Prevent brute force attacks
   - Limit login attempts
   - IP-based throttling

5. **Session Management**
   - Track active sessions
   - Revoke specific sessions
   - Device management

6. **OAuth Integration**
   - Google login
   - GitHub login
   - Microsoft login

7. **Audit Logging**
   - Log all auth events
   - Track login history
   - Security alerts

8. **Password Policies**
   - Complexity requirements
   - Password history
   - Expiration policies

## Troubleshooting

### Common Issues

**Issue:** "Invalid credentials" on login
- **Solution:** Verify username and password are correct
- Check database for user existence
- Ensure password was hashed during registration

**Issue:** "Token expired" errors
- **Solution:** This is normal after 15 minutes
- Frontend should automatically refresh
- Check refresh token cookie is being sent

**Issue:** CORS errors
- **Solution:** Verify CORS origin in backend matches frontend URL
- Ensure credentials: 'include' in fetch requests
- Check browser console for specific CORS error

**Issue:** Refresh token not working
- **Solution:** Check cookie settings (httpOnly, secure, sameSite)
- Verify refresh token secret is correct
- Ensure cookies are being sent with requests

## Security Checklist

- [x] Passwords hashed with bcrypt
- [x] JWT tokens with expiry
- [x] HTTP-only cookies for refresh tokens
- [x] CORS configured properly
- [x] Environment variables for secrets
- [x] Input validation
- [x] Error handling without information leakage
- [ ] Rate limiting (TODO)
- [ ] HTTPS in production (TODO)
- [ ] Security headers (TODO)
- [ ] Audit logging (TODO)

## Production Deployment

### Before Deploying

1. **Generate Strong Secrets:**
```bash
# Generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. **Update Environment Variables:**
```env
NODE_ENV=production
JWT_ACCESS_SECRET=<generated-secret-1>
JWT_REFRESH_SECRET=<generated-secret-2>
```

3. **Enable HTTPS:**
- Cookies will only be sent over HTTPS in production
- Update CORS origin to production domain

4. **Database Security:**
- Use strong database passwords
- Restrict database access
- Enable SSL connections

5. **Monitoring:**
- Set up error logging
- Monitor failed login attempts
- Track token refresh rates

---

**Last Updated:** November 24, 2025
**Version:** 1.0.0
