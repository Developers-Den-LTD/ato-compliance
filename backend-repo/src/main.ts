import * as dotenv from 'dotenv';

// Load environment variables FIRST before any other imports
// dotenv.config() looks for .env in process.cwd() by default
const result = dotenv.config();

console.log('CWD:', process.cwd());
console.log('Dotenv result:', result.error ? `Error: ${result.error}` : `Loaded ${Object.keys(result.parsed || {}).length} vars`);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { testConnection } from './db';
import routes from './routes';

const APP_NAME = 'Ato Compliance';
const APP_VERSION = '1.0.1';

const PORT = process.env.PORT || 3000;



// Allowed origins for CORS
const allowedOrigins = [
  'http://localhost:5173',                                      // local dev
  'https://ato-compliance-frontend-kd6j.vercel.app',          // production frontend
  process.env.FRONTEND_URL || ''                               // custom frontend URL
].filter(Boolean); // Remove empty strings

console.log('🌐 CORS allowed origins:', allowedOrigins);

const app = express();

// CORS handler
app.use(
  cors({
    origin: (origin, callback) => {
      console.log('📨 Request from:', origin);
      
      // Allow requests with no origin
      if (!origin) {
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        console.log('✅ Allowed');
        callback(null, true);
      } else {
        console.log('❌ BLOCKED');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get('/health', async (_req, res) => {
  const dbConnected = await testConnection();
  res.json({ 
    status: 'healthy',
    app: APP_NAME,
    version: APP_VERSION,
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString() 
  });
});

// Mount API routes
app.use('/api', routes);

// Legacy endpoint (keep for backward compatibility)
app.get('/api/message', (_req, res) => {
  res.json({ 
    message: 'Hello from the backend! Backend is running.',
    timestamp: new Date().toISOString(),
    success: true
  });
});

// Test database connection on startup
testConnection().then((connected) => {
  if (connected) {
    console.log('✅ Database ready');
  } else {
    console.warn('⚠️  Database not available - some features may not work');
  }
});

// Only start server if not in test environment or Vercel
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 ${APP_NAME} Backend running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
// Using module.exports for CommonJS compatibility
module.exports = app;
module.exports.app = app; // Also export as named export for testing
