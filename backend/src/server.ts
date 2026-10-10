import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { config } from './config/index.js';
import { setupGameSocket } from './socket/gameSocket.js';

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

// Setup Game WebSocket Event Handlers
setupGameSocket(io);

server.listen(config.port, () => {
  console.log(`===================================================`);
  console.log(`🚀 KỲ BIỂN CHESS BACKEND IS RUNNING`);
  console.log(`📡 PORT: ${config.port}`);
  console.log(`🌍 ENV:  ${config.nodeEnv}`);
  console.log(`🔔 WAKE-UP ENDPOINT: http://localhost:${config.port}/ping`);
  console.log(`===================================================`);
});
