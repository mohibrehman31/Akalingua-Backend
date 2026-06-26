import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import db from './config/database';
import redis from './config/redis';

// Route imports (we'll create these next)
import authRoutes from './modules/auth/auth.routes';
import studentRoutes from './modules/students/students.routes';
import jobPostRoutes from './modules/jobposts/jobposts.routes';
import tutorRoutes from './modules/tutors/tutors.routes';
import leadRoutes from './modules/leads/leads.routes';
import quoteRoutes from './modules/quotes/quotes.routes';
import paymentRoutes from './modules/payments/payments.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import adminRoutes from './modules/admin/admin.routes';
import revealRoutes from './modules/reveal/reveal.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://akalingua.com', 'https://www.akalingua.com']
    : ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));

// Stripe webhooks need raw body — MUST be before express.json()
app.use('/api/v1/payments/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
}));

// Health check — no auth, no rate limit
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/job-posts', jobPostRoutes);
app.use('/api/v1/tutors', tutorRoutes);
app.use('/api/v1/leads', leadRoutes);
app.use('/api/v1/quotes', quoteRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reveal', revealRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler. Express 5 forwards rejected async handlers here.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`${req.method} ${req.url}`, err);
  const status = err.status || 500;
  // Don't leak internal error text on 500s; only surface messages we set deliberately.
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

// Start server
async function start() {
  try {
    await db.raw('SELECT 1');
    console.log('PostgreSQL connected');
    await redis.connect();
    app.listen(PORT, () => {
      console.log(`Akalingua API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();