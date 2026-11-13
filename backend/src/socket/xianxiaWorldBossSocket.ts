/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — REALTIME SOCKET.IO CHO TOÀN DÂN TRẢM MA (WORLD BOSS)
 * Namespace: `/xianxia-worldboss`
 * Kiến trúc: Server-Authoritative, JWT Handshake, Room Broadcast & Rate Limited
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../utils/prisma.js';
import { xianxiaWorldBossService } from '../services/xianxia/xianxiaWorldBossService.js';

interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
  characterId?: number;
  characterName?: string;
  characterRealm?: string;
}

let worldBossNamespace: any = null;

export function setupXianxiaWorldBossSocket(io: SocketIOServer) {
  const nsp = io.of('/xianxia-worldboss');
  worldBossNamespace = nsp;

  // 1. JWT Authentication Handshake Middleware
  nsp.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('AUTHENTICATION_ERROR: Linh phù xác thực JWT bị thiếu.'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      socket.userId = decoded.userId;
      socket.username = decoded.username;

      // Nạp thông tin nhân vật tu tiên
      const char = await prisma.xianxiaCharacter.findUnique({
        where: { user_id: decoded.userId },
        select: { id: true, name: true, realm: true },
      });

      if (!char) {
        return next(new Error('CHARACTER_NOT_FOUND: Chưa khởi tạo nhân vật tu tiên.'));
      }

      socket.characterId = char.id;
      socket.characterName = char.name;
      socket.characterRealm = char.realm;

      next();
    } catch (err: any) {
      next(new Error(`AUTHENTICATION_ERROR: ${err.message || 'Linh phù không hợp lệ.'}`));
    }
  });

  // 2. Kết nối & Quản lý Sự kiện
  nsp.on('connection', (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const charId = socket.characterId!;

    // 2.1 Tham gia phòng Boss Thế Giới
    socket.on('worldboss:join', async (payload: { bossInstanceId: string }, callback?: Function) => {
      try {
        const { bossInstanceId } = payload || {};
        if (!bossInstanceId) {
          if (callback) callback({ success: false, error: { code: 'INVALID_PARAMETERS', message: 'Thiếu bossInstanceId.' } });
          return;
        }

        const roomName = `worldboss:${bossInstanceId}`;
        socket.join(roomName);

        // Lấy snapshot hiện tại
        const [bossData, leaderboard] = await Promise.all([
          xianxiaWorldBossService.getCurrentBoss(charId),
          xianxiaWorldBossService.getLeaderboard(bossInstanceId, 10),
        ]);

        const snapshot = {
          boss: bossData.boss,
          personalProgress: bossData.personalProgress,
          leaderboard,
        };

        socket.emit('worldboss:snapshot', snapshot);
        if (callback) callback({ success: true, data: snapshot });
      } catch (err: any) {
        if (callback) {
          callback({
            success: false,
            error: { code: err.code || 'WORLDBOSS_JOIN_ERROR', message: err.message },
          });
        }
      }
    });

    // 2.2 Rời phòng Boss Thế Giới
    socket.on('worldboss:leave', (payload: { bossInstanceId: string }) => {
      const { bossInstanceId } = payload || {};
      if (bossInstanceId) {
        socket.leave(`worldboss:${bossInstanceId}`);
      }
    });

    // 2.3 Tấn công Boss Thế Giới (Server-Authoritative Realtime)
    socket.on('worldboss:attack', async (payload: { bossInstanceId: string }, callback?: Function) => {
      try {
        const { bossInstanceId } = payload || {};
        if (!bossInstanceId) {
          if (callback) callback({ success: false, error: { code: 'INVALID_PARAMETERS', message: 'Thiếu bossInstanceId.' } });
          return;
        }

        const result = await xianxiaWorldBossService.attackWorldBoss(userId, bossInstanceId);

        // Trả kết quả cá nhân cho người tấn công
        if (callback) callback({ success: true, data: result });

        const roomName = `worldboss:${bossInstanceId}`;

        // Broadcast cập nhật máu cho toàn phòng
        nsp.to(roomName).emit('worldboss:hp_updated', {
          bossInstanceId,
          currentHp: result.currentHp,
          maxHp: result.maxHp,
          status: result.status,
          attackerName: socket.characterName,
          characterId: charId,
          damage: result.damageDealt,
          damageDealt: result.damageDealt,
          isCritical: result.isCritical,
        });

        // Nếu là đòn kết liễu
        if (result.isKiller) {
          nsp.to(roomName).emit('worldboss:defeated', {
            bossInstanceId,
            killerId: charId,
            killerCharacterId: charId,
            killerName: socket.characterName,
          });
        }
      } catch (err: any) {
        if (callback) {
          callback({
            success: false,
            error: { code: err.code || 'WORLDBOSS_ATTACK_ERROR', message: err.message, status: err.status || 500 },
          });
        }
      }
    });

    // 2.4 Lấy Bảng Xếp Hạng thời gian thực
    socket.on('worldboss:get_leaderboard', async (payload: { bossInstanceId: string }, callback?: Function) => {
      try {
        const { bossInstanceId } = payload || {};
        const leaderboard = await xianxiaWorldBossService.getLeaderboard(bossInstanceId, 10);
        if (callback) callback({ success: true, data: leaderboard });
      } catch (err: any) {
        if (callback) callback({ success: false, error: { code: 'WORLDBOSS_LEADERBOARD_ERROR', message: err.message } });
      }
    });

    // 2.5 Nhận Thưởng Riêng Tư (Sender-Only Privacy & Idempotency)
    socket.on('worldboss:claim_reward', async (payload: { bossInstanceId: string; idempotencyKey?: string }, callback?: Function) => {
      try {
        const { bossInstanceId, idempotencyKey } = payload || {};
        const result = await xianxiaWorldBossService.claimReward(userId, bossInstanceId, idempotencyKey);

        // Chỉ gửi về cho socket của chính người nhận thưởng (Không broadcast sang người khác)
        if (callback) callback({ success: true, data: result });
        socket.emit('worldboss:reward_claimed', result);
      } catch (err: any) {
        if (callback) {
          callback({
            success: false,
            error: { code: err.code || 'WORLDBOSS_CLAIM_ERROR', message: err.message, status: err.status || 500 },
          });
        }
      }
    });
  });

  return nsp;
}

export function closeXianxiaWorldBossSocket() {
  if (worldBossNamespace) {
    worldBossNamespace.removeAllListeners();
  }
}
