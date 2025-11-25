import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import { APP_NAME, APP_VERSION } from '@ato-compliance/shared';
import { testConnection } from './db';
import routes from './routes';

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
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
