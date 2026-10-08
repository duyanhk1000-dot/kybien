import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import authRoutes from './routes/authRoutes.js';
import matchRoutes from './routes/matchRoutes.js';

const app = express();

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or UptimeRobot/no-cors pings)
      if (!origin) return callback(null, true);
      if (config.clientOrigin.includes('*') || config.clientOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for initial dev & Blogspot cross-domain
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FR-06: Silent Wake-up Endpoint & UptimeRobot Ping Endpoint
app.get('/ping', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    service: 'Ky Bien Chess Platform Backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/match', matchRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Global Error]', err);
  res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống nội bộ.' });
});

export default app;
