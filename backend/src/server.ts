import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { config } from './config/index.js';
import { setupGameSocket } from './socket/gameSocket.js';
import { setupXianxiaChatSocket } from './socket/xianxiaChatSocket.js';
import { setupXianxiaDungeonSocket } from './socket/xianxiaDungeonSocket.js';
import { setupXianxiaWorldBossSocket } from './socket/xianxiaWorldBossSocket.js';

const server = http.createServer(app);

// Initialize Socket.io with configured CORS origins
const socketOrigins = config.clientOrigin.includes('*')
  ? '*'
  : config.clientOrigin;

const io = new Server(server, {
  cors: {
    origin: socketOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Setup Game WebSocket Event Handlers (Kỳ Biến)
setupGameSocket(io);

// Setup Xianxia Realtime Chat Event Handlers (M4.3.1 Tiên Lộ)
setupXianxiaChatSocket(io);

// Setup Xianxia Realtime Co-op Dungeon & Party (M4.3.3C Tiên Lộ)
setupXianxiaDungeonSocket(io);

// Setup Xianxia Realtime World Boss (M4.4A Tiên Lộ)
setupXianxiaWorldBossSocket(io);

server.listen(config.port, () => {
  console.log(`===================================================`);
  console.log(`🚀 KỲ BIỂN CHESS BACKEND IS RUNNING`);
  console.log(`📡 PORT: ${config.port}`);
  console.log(`🌍 ENV:  ${config.nodeEnv}`);
  console.log(`🔔 WAKE-UP ENDPOINT: http://localhost:${config.port}/ping`);
  console.log(`===================================================`);
});
