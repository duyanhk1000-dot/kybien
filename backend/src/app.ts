import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from './config/index.js';
import authRoutes from './routes/authRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import xianxiaWorldRoutes from './routes/xianxia/xianxiaWorldRoutes.js';
import xianxiaBestiaryRoutes from './routes/xianxia/xianxiaBestiaryRoutes.js';
import { xianxiaEventsRouter } from './routes/xianxia/xianxiaEventsRoutes.js';
import { xianxiaCraftingRouter } from './routes/xianxia/xianxiaCraftingRoutes.js';
import { xianxiaQuestRouter } from './routes/xianxia/xianxiaQuestRoutes.js';
import { xianxiaAgencyRouter } from './routes/xianxia/xianxiaAgencyRoutes.js';
import xianxiaGameplayRoutes from './routes/xianxia/xianxiaGameplayRoutes.js';
import xianxiaLeaderboardRoutes from './routes/xianxia/xianxiaLeaderboardRoutes.js';
import xianxiaChatRoutes from './routes/xianxia/xianxiaChatRoutes.js';
import xianxiaGuildRoutes from './routes/xianxia/xianxiaGuildRoutes.js';
import xianxiaPartyRoutes from './routes/xianxia/xianxiaPartyRoutes.js';
import xianxiaDungeonRoutes from './routes/xianxia/xianxiaDungeonRoutes.js';
import xianxiaWorldBossRoutes from './routes/xianxia/xianxiaWorldBossRoutes.js';
import { xianxiaChatService } from './services/xianxia/xianxiaChatService.js';
import { onlineTracker } from './services/onlineTracker.js';
import { prisma } from './utils/prisma.js';

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
      if (config.nodeEnv === 'development') {
        return callback(null, true);
      }
      return callback(new Error('CORS Not Allowed'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const frontendPath = [
  path.resolve(__dirname, '../../frontend'),
  path.resolve(__dirname, '../frontend'),
  path.resolve(process.cwd(), 'frontend'),
  path.resolve(process.cwd(), '../frontend'),
].find((p) => fs.existsSync(p)) || path.resolve(process.cwd(), 'frontend');

app.use(express.static(frontendPath));

// Cơ chế Supabase Database Keep-Alive (Chống ngủ đông 7 ngày)
let lastDbKeepAliveTime = 0;
const DB_KEEP_ALIVE_COOLDOWN_MS = 30 * 60 * 1000; // Cooldown 30 phút giữa các lần ping DB

export async function triggerDatabaseKeepAlive(): Promise<boolean> {
  const now = Date.now();
  if (now - lastDbKeepAliveTime < DB_KEEP_ALIVE_COOLDOWN_MS) {
    return false;
  }
  try {
    lastDbKeepAliveTime = now;
    await prisma.$queryRawUnsafe('SELECT 1;');
    console.log(`[Supabase Keep-Alive] Gõ cửa cơ sở dữ liệu thành công (${new Date().toISOString()})`);
    return true;
  } catch (err: any) {
    console.warn('[Supabase Keep-Alive] Cảnh báo ping DB:', err?.message || err);
    return false;
  }
}

// Tự động chạy định kỳ mỗi 6 tiếng (4 lần/ngày) để đảm bảo không bao giờ chạm ngưỡng 7 ngày
setInterval(() => {
  triggerDatabaseKeepAlive().catch(() => {});
}, 6 * 60 * 60 * 1000).unref();

// Định kỳ mỗi 12 tiếng dọn dẹp các tin nhắn chat cũ hơn 7 ngày (M4.3.1 Chat Retention Policy)
setInterval(() => {
  xianxiaChatService.purgeOldMessages(7).catch((err) => {
    console.warn('[Chat Data Purge] Cảnh báo lỗi dọn dẹp tin nhắn cũ:', err?.message || err);
  });
}, 12 * 60 * 60 * 1000).unref();

// FR-06: Silent Wake-up Endpoint & UptimeRobot Ping Endpoint
app.get('/ping', (req: Request, res: Response) => {
  // Tiện tay đánh thức Supabase nếu đã quá 30 phút kể từ lần ping trước
  triggerDatabaseKeepAlive().catch(() => {});

  res.status(200).json({
    status: 'online',
    service: 'Ky Bien Chess Platform Backend',
    database: 'supabase-connected',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  triggerDatabaseKeepAlive().catch(() => {});
  res.status(200).json({ status: 'ok' });
});

// Thống kê số lượng Kỳ thủ và Lữ khách trực tuyến (Real-time Online Stats)
app.get('/api/stats/online', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: onlineTracker.getStats(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/xianxia/world', xianxiaWorldRoutes);
app.use('/api/xianxia/bestiary', xianxiaBestiaryRoutes);
app.use('/api/xianxia/events', xianxiaEventsRouter);
app.use('/api/xianxia/crafting', xianxiaCraftingRouter);
app.use('/api/xianxia/quests', xianxiaQuestRouter);
app.use('/api/xianxia/agency', xianxiaAgencyRouter);
app.use('/api/xianxia/gameplay', xianxiaGameplayRoutes);
app.use('/api/xianxia/leaderboard', xianxiaLeaderboardRoutes);
app.use('/api/xianxia/chat', xianxiaChatRoutes);
app.use('/api/xianxia/guilds', xianxiaGuildRoutes);
app.use('/api/xianxia/party', xianxiaPartyRoutes);
app.use('/api/xianxia/dungeons', xianxiaDungeonRoutes);
app.use('/api/xianxia/world-boss', xianxiaWorldBossRoutes);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[Global Error]', err);
  const status = err.message === 'CORS Not Allowed' ? 403 : 500;
  res.status(status).json({ error: err.message || 'Đã xảy ra lỗi hệ thống nội bộ.' });
});

export default app;
