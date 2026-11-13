import { Server, Socket, Namespace } from 'socket.io';
import { verifyToken, TokenPayload } from '../utils/jwt.js';
import { prisma } from '../utils/prisma.js';
import { xianxiaPartyService } from '../services/xianxia/xianxiaPartyService.js';
import { xianxiaDungeonService } from '../services/xianxia/xianxiaDungeonService.js';

let dungeonNamespaceInstance: Namespace | null = null;

// Quản lý các socket kết nối đồng thời theo userId (Hỗ trợ multi-tab, chống race condition offline)
const userSocketsMap = new Map<number, Set<string>>();

// Rate limit theo từng socket (Cooldown combat-step và join/reconnect)
interface SocketRateLimit {
  lastCombatStepTime: number;
  joinCount: number;
  joinWindowStart: number;
}
const socketRateLimits = new Map<string, SocketRateLimit>();

function getRateLimit(socketId: string): SocketRateLimit {
  let rl = socketRateLimits.get(socketId);
  if (!rl) {
    rl = { lastCombatStepTime: 0, joinCount: 0, joinWindowStart: Date.now() };
    socketRateLimits.set(socketId, rl);
  }
  return rl;
}

// ==========================================
// THÔNG BÁO TỪ SERVICE LAYER (CROSS-SERVICE REALTIME HOOKS)
// ==========================================

export function notifyPartyMemberJoined(partyId: number, member: any): void {
  if (dungeonNamespaceInstance) {
    dungeonNamespaceInstance.to(`party:${partyId}`).emit('party:member_joined', { partyId, member });
  }
}

export function notifyPartyMemberLeft(partyId: number, characterId: number): void {
  if (dungeonNamespaceInstance) {
    dungeonNamespaceInstance.to(`party:${partyId}`).emit('party:member_left', { partyId, characterId });
  }
}

export function notifyPartyMemberKicked(partyId: number, characterId: number): void {
  if (dungeonNamespaceInstance) {
    const room = `party:${partyId}`;
    dungeonNamespaceInstance.to(room).emit('party:member_kicked', { partyId, characterId });
    // Buộc socket của nhân vật bị trục xuất rời khỏi party room
    const sockets = dungeonNamespaceInstance.sockets;
    if (sockets) {
      for (const [_, s] of sockets) {
        if (s.data?.characterId === characterId) {
          s.leave(room);
          s.emit('party:kicked', { partyId, message: 'Đạo hữu đã bị Đội Trưởng trục xuất khỏi tổ đội.' });
        }
      }
    }
  }
}

export function notifyPartyDisbanded(partyId: number): void {
  if (dungeonNamespaceInstance) {
    const room = `party:${partyId}`;
    dungeonNamespaceInstance.to(room).emit('party:disbanded', { partyId, message: 'Tổ đội đã bị giải tán.' });
    dungeonNamespaceInstance.in(room).socketsLeave(room);
  }
}

export function notifyPartyReadyState(partyId: number, characterId: number, isReady: boolean): void {
  if (dungeonNamespaceInstance) {
    dungeonNamespaceInstance.to(`party:${partyId}`).emit('party:ready_changed', { partyId, characterId, isReady });
  }
}

export function notifyPartyDungeonStarted(partyId: number, runId: string): void {
  if (dungeonNamespaceInstance) {
    dungeonNamespaceInstance.to(`party:${partyId}`).emit('party:dungeon_started', { partyId, runId });
  }
}

// ==========================================
// KHỞI TẠO VÀ CẤU HÌNH SOCKET.IO NAMESPACE
// ==========================================

export function setupXianxiaDungeonSocket(io: Server): Namespace {
  const dungeonNamespace = io.of('/xianxia-dungeon');
  dungeonNamespaceInstance = dungeonNamespace;

  // Đăng ký cross-service realtime hooks sau khi commit transaction
  xianxiaPartyService.setEventHooks({
    onMemberJoined: notifyPartyMemberJoined,
    onMemberLeft: notifyPartyMemberLeft,
    onMemberKicked: notifyPartyMemberKicked,
    onPartyDisbanded: notifyPartyDisbanded,
    onReadyState: notifyPartyReadyState,
  });

  xianxiaDungeonService.setEventHooks({
    onDungeonStarted: notifyPartyDungeonStarted,
  });

  // -------------------------------------------------------------
  // 1. MIDDLEWARE XÁC THỰC DANH TÍNH JWT VÀ PROFILE NHÂN VẬT
  // -------------------------------------------------------------
  dungeonNamespace.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (socket.handshake.query?.token as string);

      if (!token || typeof token !== 'string') {
        return next(new Error('AUTHENTICATION_ERROR: Thiếu linh phù xác thực (JWT Token).'));
      }

      const payload = verifyToken(token);
      if (!payload || !payload.userId) {
        return next(new Error('AUTHENTICATION_ERROR: Linh phù xác thực đã hết hạn hoặc không hợp lệ.'));
      }

      // Xác minh nhân vật tu tiên tương ứng trong cơ sở dữ liệu
      const char = await prisma.xianxiaCharacter.findUnique({
        where: { user_id: payload.userId },
      });

      if (!char) {
        return next(new Error('CHARACTER_NOT_FOUND: Chưa tìm thấy nhân vật tu tiên tương ứng với tài khoản này.'));
      }

      // Lưu trữ thông tin định danh đáng tin cậy vào socket.data
      socket.data.userId = payload.userId;
      socket.data.characterId = char.id;
      socket.data.characterName = char.name;
      socket.data.authenticatedAt = Date.now();

      return next();
    } catch (err: any) {
      return next(new Error(`AUTHENTICATION_ERROR: ${err.message || 'Lỗi xác thực hệ thống.'}`));
    }
  });

  // -------------------------------------------------------------
  // 2. CONNECTION LIFECYCLE & EVENT HANDLERS
  // -------------------------------------------------------------
  dungeonNamespace.on('connection', (socket: Socket) => {
    const userId: number = socket.data.userId;
    const characterId: number = socket.data.characterId;
    const characterName: string = socket.data.characterName;

    // Theo dõi socket của người dùng
    let userSockets = userSocketsMap.get(userId);
    if (!userSockets) {
      userSockets = new Set<string>();
      userSocketsMap.set(userId, userSockets);
    }
    userSockets.add(socket.id);

    // ==========================================
    // A. SỰ KIỆN TỔ ĐỘI (PARTY REALTIME EVENTS)
    // ==========================================

    // A1: Tham gia room tổ đội (party:join)
    socket.on('party:join', async (data: { partyId?: number }, callback?: (res: any) => void) => {
      try {
        const partyId = Number(data?.partyId);
        if (!partyId || partyId <= 0) {
          const errRes = { code: 'PARTY_INVALID_ID', message: 'Mã tổ đội không hợp lệ.', status: 400 };
          socket.emit('party:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // Xác minh nhân vật có thuộc tổ đội này không
        const membership = await prisma.xianxiaPartyMember.findUnique({
          where: { character_id: characterId },
        });

        if (!membership || membership.party_id !== partyId) {
          const errRes = { code: 'PARTY_FORBIDDEN', message: 'Đạo hữu không thuộc tổ đội này.', status: 403 };
          socket.emit('party:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        const room = `party:${partyId}`;
        socket.join(room);

        const partyDetail = await xianxiaPartyService.getPartyDetailById(partyId);
        const resData = { success: true, party: partyDetail };
        socket.emit('party:joined', resData);
        if (callback) callback(resData);
      } catch (err: any) {
        const errRes = { code: 'PARTY_JOIN_ERROR', message: err.message || 'Lỗi tham gia room tổ đội.', status: 500 };
        socket.emit('party:error', errRes);
        if (callback) callback({ success: false, error: errRes });
      }
    });

    // A2: Rời room tổ đội (party:leave_room)
    socket.on('party:leave_room', (data: { partyId?: number }) => {
      const partyId = Number(data?.partyId);
      if (partyId > 0) {
        socket.leave(`party:${partyId}`);
        socket.emit('party:left_room', { partyId });
      }
    });

    // A3: Thay đổi trạng thái sẵn sàng qua socket (party:ready)
    socket.on('party:ready', async (data: { isReady?: boolean }, callback?: (res: any) => void) => {
      try {
        const membership = await prisma.xianxiaPartyMember.findUnique({
          where: { character_id: characterId },
        });

        if (!membership) {
          const errRes = { code: 'PARTY_NOT_IN_PARTY', message: 'Đạo hữu chưa tham gia tổ đội.', status: 400 };
          socket.emit('party:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        const result = await xianxiaPartyService.setReadyState(userId, data?.isReady);
        notifyPartyReadyState(membership.party_id, characterId, result.isReady);

        if (callback) callback({ success: true, isReady: result.isReady });
      } catch (err: any) {
        const errRes = { code: 'PARTY_READY_ERROR', message: err.message, status: 400 };
        socket.emit('party:error', errRes);
        if (callback) callback({ success: false, error: errRes });
      }
    });

    // ==========================================
    // B. SỰ KIỆN PHÓ BẢN (DUNGEON REALTIME EVENTS)
    // ==========================================

    // B1: Tham gia room phó bản (dungeon:join)
    socket.on('dungeon:join', async (data: { runId?: string }, callback?: (res: any) => void) => {
      try {
        const runId = String(data?.runId || '').trim();
        if (!runId) {
          const errRes = { code: 'DUNGEON_INVALID_RUN_ID', message: 'Thiếu mã phiên phó bản.', status: 400 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // Rate limit chống spam join
        const rl = getRateLimit(socket.id);
        const now = Date.now();
        if (now - rl.joinWindowStart > 5000) {
          rl.joinCount = 0;
          rl.joinWindowStart = now;
        }
        rl.joinCount++;
        if (rl.joinCount > 5) {
          const errRes = { code: 'DUNGEON_RATE_LIMITED', message: 'Thao tác quá nhanh, vui lòng đợi giây lát.', status: 429 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // 1. Xác minh phiên phó bản tồn tại trong DB
        const run = await prisma.xianxiaDungeonRun.findUnique({
          where: { id: runId },
        });

        if (!run) {
          const errRes = { code: 'DUNGEON_NOT_FOUND', message: 'Không tìm thấy phiên phó bản.', status: 404 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // 2. Xác minh nhân vật thuộc danh sách thành viên của phiên
        const member = await prisma.xianxiaDungeonMember.findUnique({
          where: {
            dungeon_run_id_character_id: {
              dungeon_run_id: run.id,
              character_id: characterId,
            },
          },
        });

        if (!member) {
          const errRes = { code: 'DUNGEON_FORBIDDEN', message: 'Đạo hữu không thuộc phiên phó bản này.', status: 403 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // 3. Gia nhập room Socket
        const room = `dungeon:${runId}`;
        socket.join(room);

        // Đánh dấu online
        await prisma.xianxiaDungeonMember.update({
          where: { id: member.id },
          data: { is_connected: true, last_seen_at: new Date() },
        });

        // 4. Lấy authoritative snapshot
        const snapshot = await xianxiaDungeonService.getDungeonRunById(runId, userId);

        const joinedRes = { success: true, runId, characterId };
        socket.emit('dungeon:joined', joinedRes);
        socket.emit('dungeon:snapshot', snapshot);

        // Broadcast thành viên kết nối cho cả room
        socket.to(room).emit('dungeon:member_connected', { characterId, name: characterName });

        if (callback) callback({ success: true, data: snapshot });
      } catch (err: any) {
        const errRes = { code: 'DUNGEON_JOIN_ERROR', message: err.message || 'Lỗi tham gia phó bản.', status: 500 };
        socket.emit('dungeon:error', errRes);
        if (callback) callback({ success: false, error: errRes });
      }
    });

    // B2: Rời room phó bản (dungeon:leave - chỉ rời socket room, không hủy run)
    socket.on('dungeon:leave', (data: { runId?: string }, callback?: (res: any) => void) => {
      const runId = String(data?.runId || '').trim();
      if (runId) {
        socket.leave(`dungeon:${runId}`);
        socket.emit('dungeon:left', { runId });
        if (callback) callback({ success: true, runId });
      }
    });

    // B3: Thực thi hiệp đấu server-authoritative (dungeon:combat_step)
    socket.on('dungeon:combat_step', async (data: { runId?: string; expectedVersion?: number }, callback?: (res: any) => void) => {
      try {
        const runId = String(data?.runId || '').trim();
        const expectedVersion = data?.expectedVersion !== undefined ? Number(data.expectedVersion) : undefined;

        if (!runId) {
          const errRes = { code: 'DUNGEON_INVALID_RUN_ID', message: 'Thiếu mã phiên phó bản.', status: 400 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // Rate limit: tối thiểu 400ms giữa các hiệp đấu trên cùng 1 socket
        const rl = getRateLimit(socket.id);
        const now = Date.now();
        if (now - rl.lastCombatStepTime < 400) {
          const errRes = { code: 'DUNGEON_RATE_LIMITED', message: 'Chiêu thức đang hồi, xin hãy đợi một thoáng.', status: 429 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }
        rl.lastCombatStepTime = now;

        // Gọi Server-Authoritative Core Engine (Prisma Transaction with Row Lock & Optimistic Versioning)
        const updatedRun = await xianxiaDungeonService.executeCombatStep(userId, runId, expectedVersion);

        const room = `dungeon:${runId}`;

        // Broadcast diễn biến hiệp đấu cho toàn thể thành viên trong room
        dungeonNamespace.to(room).emit('dungeon:turn_resolved', {
          runId: updatedRun.id,
          version: updatedRun.version,
          turnsCount: updatedRun.turnsCount,
          currentWave: updatedRun.currentWave,
          totalWaves: updatedRun.totalWaves,
          status: updatedRun.status,
          combatState: updatedRun.combatState,
          combatLog: updatedRun.combatLog,
        });

        // Nếu chuyển sang đợt mới
        if (updatedRun.combatState?.currentWave && updatedRun.turnsCount > 1) {
          dungeonNamespace.to(room).emit('dungeon:wave_updated', {
            runId: updatedRun.id,
            currentWave: updatedRun.currentWave,
            totalWaves: updatedRun.totalWaves,
            monsters: updatedRun.combatState.monsters,
          });
        }

        // Nếu phó bản đã hoàn tất
        if (updatedRun.status === 'COMPLETED') {
          dungeonNamespace.to(room).emit('dungeon:completed', {
            runId: updatedRun.id,
            completedAt: updatedRun.completedAt,
            message: 'Yêu thú đã bị tiêu diệt! Toàn đội mở quyền nhận thưởng.',
          });
        } else if (updatedRun.status === 'FAILED') {
          dungeonNamespace.to(room).emit('dungeon:failed', {
            runId: updatedRun.id,
            message: 'Toàn đội đã tử trận! Phó bản thất bại.',
          });
        } else if (updatedRun.status === 'EXPIRED') {
          dungeonNamespace.to(room).emit('dungeon:expired', {
            runId: updatedRun.id,
            message: 'Phiên phó bản đã hết thời hạn 15 phút.',
          });
        }

        if (callback) callback({ success: true, data: updatedRun });
      } catch (err: any) {
        const errMsg = err?.message || '';
        let code = 'DUNGEON_COMBAT_ERROR';
        let status = 400;

        if (errMsg.includes('VERSION_MISMATCH') || errMsg.includes('OUTDATED')) {
          code = 'DUNGEON_VERSION_MISMATCH';
          status = 409;
        } else if (errMsg.includes('FORBIDDEN') || errMsg.includes('UNAUTHORIZED')) {
          code = 'DUNGEON_FORBIDDEN';
          status = 403;
        } else if (errMsg.includes('NOT_FOUND')) {
          code = 'DUNGEON_RUN_NOT_FOUND';
          status = 404;
        } else if (errMsg.includes('EXPIRED')) {
          code = 'DUNGEON_ALREADY_EXPIRED';
          status = 400;
        } else if (errMsg.includes('NOT_IN_PROGRESS')) {
          code = 'DUNGEON_NOT_IN_PROGRESS';
          status = 400;
        }

        const errPayload = { code, message: errMsg, status };
        socket.emit('dungeon:error', errPayload);
        if (callback) callback({ success: false, error: errPayload });
      }
    });

    // B4: Đồng bộ trạng thái và kết nối lại (dungeon:reconnect)
    socket.on('dungeon:reconnect', async (data: { runId?: string }, callback?: (res: any) => void) => {
      try {
        const runId = String(data?.runId || '').trim();
        if (!runId) {
          const errRes = { code: 'DUNGEON_INVALID_RUN_ID', message: 'Thiếu mã phiên phó bản.', status: 400 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        const runDetail = await xianxiaDungeonService.reconnect(userId, runId);
        const room = `dungeon:${runId}`;
        socket.join(room);

        // Trả snapshot độc quyền cho người reconnect
        socket.emit('dungeon:snapshot', runDetail);

        // Thông báo cho đồng đội trong room
        socket.to(room).emit('dungeon:member_connected', { characterId, name: characterName });

        if (callback) callback({ success: true, data: runDetail });
      } catch (err: any) {
        const errMsg = err?.message || '';
        let code = 'DUNGEON_RECONNECT_ERROR';
        let status = 400;
        if (errMsg.includes('FORBIDDEN')) {
          code = 'DUNGEON_FORBIDDEN';
          status = 403;
        } else if (errMsg.includes('NOT_FOUND')) {
          code = 'DUNGEON_RUN_NOT_FOUND';
          status = 404;
        } else if (errMsg.includes('EXPIRED')) {
          code = 'DUNGEON_EXPIRED';
          status = 400;
        }

        const errPayload = { code, message: errMsg, status };
        socket.emit('dungeon:error', errPayload);
        if (callback) callback({ success: false, error: errPayload });
      }
    });

    // B5: Nhận thưởng cá nhân qua socket (dungeon:claim_reward)
    socket.on('dungeon:claim_reward', async (data: { runId?: string; idempotencyKey?: string }, callback?: (res: any) => void) => {
      try {
        const runId = String(data?.runId || '').trim();
        const idempotencyKey = data?.idempotencyKey;

        if (!runId) {
          const errRes = { code: 'DUNGEON_INVALID_RUN_ID', message: 'Thiếu mã phiên phó bản.', status: 400 };
          socket.emit('dungeon:error', errRes);
          if (callback) callback({ success: false, error: errRes });
          return;
        }

        // Gọi service nhận thưởng authoritative
        const rewardResult = await xianxiaDungeonService.claimReward(userId, runId, idempotencyKey);

        // CHỈ gửi phần thưởng cho người nhận (Sender-only Privacy)
        socket.emit('dungeon:reward_claimed', {
          runId,
          ...rewardResult,
        });

        if (callback) callback({ success: true, data: rewardResult });
      } catch (err: any) {
        const errMsg = err?.message || '';
        let code = 'DUNGEON_CLAIM_ERROR';
        let status = 400;
        if (errMsg.includes('FORBIDDEN')) {
          code = 'DUNGEON_FORBIDDEN';
          status = 403;
        } else if (errMsg.includes('NOT_COMPLETED')) {
          code = 'DUNGEON_NOT_COMPLETED';
          status = 400;
        }

        const errPayload = { code, message: errMsg, status };
        socket.emit('dungeon:error', errPayload);
        if (callback) callback({ success: false, error: errPayload });
      }
    });

    // -------------------------------------------------------------
    // 3. DISCONNECT HANDLING
    // -------------------------------------------------------------
    socket.on('disconnect', async () => {
      socketRateLimits.delete(socket.id);

      // Cập nhật danh sách active sockets của user
      const currentSockets = userSocketsMap.get(userId);
      if (currentSockets) {
        currentSockets.delete(socket.id);
        if (currentSockets.size === 0) {
          userSocketsMap.delete(userId);

          // Cập nhật trạng thái mất kết nối trong DB cho các dungeon run mà character đang tham gia
          try {
            const activeMembers = await prisma.xianxiaDungeonMember.findMany({
              where: {
                character_id: characterId,
                dungeon_run: {
                  status: 'IN_PROGRESS',
                },
              },
            });

            for (const mem of activeMembers) {
              await prisma.xianxiaDungeonMember.update({
                where: { id: mem.id },
                data: { is_connected: false, last_seen_at: new Date() },
              });

              dungeonNamespace.to(`dungeon:${mem.dungeon_run_id}`).emit('dungeon:member_disconnected', {
                characterId,
                name: characterName,
              });
            }
          } catch (err: any) {
            // Không làm sập process khi disconnect
          }
        }
      }
    });
  });

  return dungeonNamespace;
}

export function closeXianxiaDungeonSocket(): void {
  if (dungeonNamespaceInstance) {
    const sockets = dungeonNamespaceInstance.sockets;
    if (sockets) {
      for (const [_, s] of sockets) {
        s.disconnect(true);
      }
    }
    dungeonNamespaceInstance = null;
  }
  userSocketsMap.clear();
  socketRateLimits.clear();
}
