import { APP_NAME } from '@ato-compliance/shared';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import path from 'path';
//import { APP_NAME, APP_VERSION } from './schema';
import { testConnection } from './db';
import routes from './routes';


const APP_NAME = 'Ato Compliance';
const APP_VERSION = '1.0.0';
dotenv.config();

const PORT = process.env.PORT || 3000;

// Allowed origins for CORS (local + production)
const allowedOrigins = [
  'http://localhost:5173',            // local dev
  process.env.FRONTEND_URL || ''     // production URL
];

const app = express();

// CORS handler
app.use(
  cors({
    origin: allowedOrigins,
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
    message: 'Hello from the backend!',
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

app.listen(PORT, () => {
  console.log(`🚀 ${APP_NAME} Backend running on http://localhost:${PORT}`);
});
