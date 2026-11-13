const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 1. Tuyến Xác Thực (Authentication)
let authRoutes;
try {
  authRoutes = require('./dist/routes/authRoutes.js').default;
} catch (e) {
  // Không có auth routes
}

// 2. Tuyến Thế Giới & Cơ Bản (M1 & M2)
const xianxiaWorldRoutes = require('./dist/routes/xianxia/xianxiaWorldRoutes.js').default;
const xianxiaBestiaryRoutes = require('./dist/routes/xianxia/xianxiaBestiaryRoutes.js').default;
const { xianxiaEventsRouter } = require('./dist/routes/xianxia/xianxiaEventsRoutes.js');
const { xianxiaCraftingRouter } = require('./dist/routes/xianxia/xianxiaCraftingRoutes.js');
const { xianxiaQuestRouter } = require('./dist/routes/xianxia/xianxiaQuestRoutes.js');
const { xianxiaAgencyRouter } = require('./dist/routes/xianxia/xianxiaAgencyRoutes.js');

// 3. Tuyến Gameplay, Xếp Hạng & Tông Môn (M3 & M4)
const xianxiaGameplayRoutes = require('./dist/routes/xianxia/xianxiaGameplayRoutes.js').default;
const xianxiaLeaderboardRoutes = require('./dist/routes/xianxia/xianxiaLeaderboardRoutes.js').default;
const xianxiaChatRoutes = require('./dist/routes/xianxia/xianxiaChatRoutes.js').default;
const xianxiaGuildRoutes = require('./dist/routes/xianxia/xianxiaGuildRoutes.js').default;
const xianxiaPartyRoutes = require('./dist/routes/xianxia/xianxiaPartyRoutes.js').default;
const xianxiaDungeonRoutes = require('./dist/routes/xianxia/xianxiaDungeonRoutes.js').default;
const xianxiaWorldBossRoutes = require('./dist/routes/xianxia/xianxiaWorldBossRoutes.js').default;

// 4. Socket.IO Realtime Handlers (Chat, Co-op Dungeon & World Boss)
let setupXianxiaChatSocket;
let setupXianxiaDungeonSocket;
let setupXianxiaWorldBossSocket;
try {
  setupXianxiaChatSocket = require('./dist/socket/xianxiaChatSocket.js').setupXianxiaChatSocket;
  setupXianxiaDungeonSocket = require('./dist/socket/xianxiaDungeonSocket.js').setupXianxiaDungeonSocket;
  setupXianxiaWorldBossSocket = require('./dist/socket/xianxiaWorldBossSocket.js').setupXianxiaWorldBossSocket;
} catch (e) {
  console.warn('[Socket Warning] Không thể nạp socket handlers:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Đường dẫn frontend
const frontendPath = fs.existsSync(path.join(__dirname, '..', 'frontend'))
  ? path.join(__dirname, '..', 'frontend')
  : path.join(__dirname, 'frontend');

// Mặc định trỏ trực tiếp về trang game Tiên Lộ Tu Tiên Tu Ma
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'tien-lo.html'));
});

app.use(express.static(frontendPath));

app.get('/ping', (req, res) => {
  res.status(200).json({
    status: 'online',
    game: 'Tiên Lộ: Vạn Giới Tranh Phong',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Đăng ký API Routes
if (authRoutes) {
  app.use('/api/auth', authRoutes);
}
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

// Khởi tạo HTTP Server & Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
});

if (typeof setupXianxiaChatSocket === 'function') {
  setupXianxiaChatSocket(io);
}
if (typeof setupXianxiaDungeonSocket === 'function') {
  setupXianxiaDungeonSocket(io);
}
if (typeof setupXianxiaWorldBossSocket === 'function') {
  setupXianxiaWorldBossSocket(io);
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('===================================================');
    console.log(`🚀 TIÊN LỘ: VẠN GIỚI TRANH PHONG SERVER ĐANG CHẠY`);
    console.log(`📡 URL: http://localhost:${PORT}/tien-lo.html`);
    console.log(`💬 Socket: /xianxia-chat (Chat Realtime)`);
    console.log(`⚔️ Socket: /xianxia-dungeon (Tổ Đội & Bí Cảnh Co-op)`);
    console.log(`🐉 Socket: /xianxia-worldboss (Toàn Dân Trảm Ma)`);
    console.log('===================================================');
  });
}

module.exports = { app, server };
