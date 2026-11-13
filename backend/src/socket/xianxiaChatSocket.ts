import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { xianxiaChatService, ChatMessage, CharacterChatProfile } from '../services/xianxia/xianxiaChatService.js';

let chatNamespaceInstance: any = null;

export function notifyGuildDisbanded(guildId: number): void {
  if (chatNamespaceInstance) {
    const room = `xianxia:guild:${guildId}`;
    chatNamespaceInstance.to(room).emit('guild_disbanded', { guildId });
    chatNamespaceInstance.in(room).socketsLeave(room);
  }
}

export function notifyMemberKicked(guildId: number, characterId: number): void {
  if (chatNamespaceInstance) {
    chatNamespaceInstance.emit('member_kicked', { guildId, characterId });
    const sockets = chatNamespaceInstance.sockets;
    if (sockets) {
      for (const [_, s] of sockets) {
        if (s.data?.profile?.characterId === characterId) {
          s.leave(`xianxia:guild:${guildId}`);
          if (s.data?.profile) {
            s.data.profile.guildId = null;
            s.data.profile.guildName = null;
          }
          s.emit('guild_changed', {
            success: true,
            guildId: null,
            guildName: null,
            guildMessages: [],
          });
        }
      }
    }
  }
}

export function setupXianxiaChatSocket(io: Server): void {
  // Khởi tạo namespace chuyên biệt /xianxia-chat để cô lập hoàn toàn với cờ Kỳ Biến
  const chatNamespace = io.of('/xianxia-chat');
  chatNamespaceInstance = chatNamespace;

  // Middleware bảo mật: Bắt buộc xác thực danh tính JWT ở cấp kết nối Socket
  chatNamespace.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token || typeof token !== 'string') {
        return next(new Error('AUTHENTICATION_ERROR: Đạo hữu chưa cung cấp linh phù xác thực (Thiếu Token).'));
      }

      const payload = verifyToken(token);
      if (!payload || !payload.userId) {
        return next(new Error('AUTHENTICATION_ERROR: Linh phù xác thực đã hết hạn hoặc không hợp lệ.'));
      }

      // Xác minh nhân vật tu tiên tương ứng trong cơ sở dữ liệu
      const profile = await xianxiaChatService.getCharacterChatProfile(payload.userId);
      if (!profile) {
        return next(new Error('CHARACTER_NOT_FOUND: Chưa tìm thấy nhân vật tu tiên tương ứng với tài khoản này.'));
      }

      // Lưu trữ thông tin xác thực đáng tin cậy vào socket session
      socket.data.rawToken = token;
      socket.data.user = payload;
      socket.data.profile = profile;
      next();
    } catch (err: any) {
      console.error('[XianxiaChatSocket] Lỗi trong auth middleware:', err?.message || err);
      next(new Error('INTERNAL_ERROR: Lỗi xác thực máy chủ.'));
    }
  });

  // Helper kiểm tra token còn hiệu lực trong suốt vòng đời kết nối socket (Chống kết nối bất tử sau khi hết hạn JWT)
  function isSessionStillValid(socket: Socket): boolean {
    const rawToken = socket.data.rawToken;
    if (!rawToken || typeof rawToken !== 'string') return false;
    const currentPayload = verifyToken(rawToken);
    return !!(currentPayload && currentPayload.userId && currentPayload.userId === socket.data.user?.userId);
  }

  chatNamespace.on('connection', async (socket: Socket) => {
    const profile: CharacterChatProfile = socket.data.profile;

    // 1. Tự động gia nhập Room Thế Giới
    const WORLD_ROOM = 'xianxia:channel:world';
    socket.join(WORLD_ROOM);

    // 2. Tự động gia nhập Room Khu Vực theo current_zone của nhân vật
    const ZONE_ROOM = `xianxia:zone:${profile.currentZone}`;
    socket.join(ZONE_ROOM);

    // 3. Tự động gia nhập Room Tông Môn nếu nhân vật đã thuộc Tông Môn
    if (profile.guildId) {
      socket.join(`xianxia:guild:${profile.guildId}`);
    }

    // 4. Tải tin nhắn ban đầu để phục hồi lịch sử cho người chơi
    try {
      const [worldHistory, zoneHistory, guildHistory] = await Promise.all([
        xianxiaChatService.getRecentMessages('WORLD'),
        xianxiaChatService.getRecentMessages('ZONE', profile.currentZone),
        profile.guildId ? xianxiaChatService.getRecentMessages('GUILD', undefined, 30, profile.guildId) : Promise.resolve([]),
      ]);

      socket.emit('chat_init', {
        success: true,
        profile: {
          characterId: profile.characterId,
          name: profile.name,
          realm: profile.realm,
          currentZone: profile.currentZone,
          guildId: profile.guildId || null,
          guildName: profile.guildName || null,
        },
        worldMessages: worldHistory,
        zoneMessages: zoneHistory,
        guildMessages: guildHistory,
      });
    } catch (err: any) {
      console.warn('[XianxiaChatSocket] Lỗi nạp lịch sử chat ban đầu:', err?.message || err);
    }

    // 5. Lắng nghe sự kiện gửi tin nhắn: send_message
    socket.on('send_message', async (data: { channel: 'WORLD' | 'ZONE' | 'GUILD'; content: string }, ack?: (res: any) => void) => {
      try {
        // Kiểm tra token có còn hiệu lực không (Bảo vệ thời gian thực chống JWT expired)
        if (!isSessionStillValid(socket)) {
          const authExpiredRes = {
            success: false,
            code: 'AUTHENTICATION_EXPIRED',
            message: 'Linh phù xác thực đã hết hạn, xin đăng nhập lại.',
          };
          socket.emit('chat_error', authExpiredRes);
          if (ack) ack(authExpiredRes);
          socket.disconnect(true);
          return;
        }

        if (!data || typeof data !== 'object') {
          const errRes = { success: false, code: 'CHAT_INVALID_PAYLOAD', message: 'Dữ liệu gửi tin không hợp lệ.' };
          socket.emit('chat_error', errRes);
          if (ack) ack(errRes);
          return;
        }

        const channel = data.channel;
        const rawContent = data.content;

        // Lưu tin nhắn và kiểm tra bảo mật (Rate limit, Chặn lặp, Độ dài, Phân vùng, Tông môn)
        const newMsg: ChatMessage = await xianxiaChatService.sendMessage(profile.userId, channel, rawContent);

        // Phát sóng tin nhắn tới đúng room tương ứng
        if (channel === 'WORLD') {
          chatNamespace.to(WORLD_ROOM).emit('new_message', newMsg);
        } else if (channel === 'ZONE') {
          // Bắt buộc phát sóng vào đúng room khu vực của nhân vật
          chatNamespace.to(`xianxia:zone:${profile.currentZone}`).emit('new_message', newMsg);
        } else if (channel === 'GUILD' && newMsg.guildId) {
          // Phát sóng vào room Tông Môn của nhân vật
          chatNamespace.to(`xianxia:guild:${newMsg.guildId}`).emit('new_message', newMsg);
        }

        if (ack) {
          ack({ success: true, message: newMsg });
        }
      } catch (err: any) {
        const fullMsg = err?.message || 'Lỗi gửi tin nhắn.';
        if (fullMsg.includes('CHAT_NO_GUILD') && profile.guildId) {
          socket.leave(`xianxia:guild:${profile.guildId}`);
          profile.guildId = null;
          profile.guildName = null;
          if (socket.data.profile) {
            socket.data.profile.guildId = null;
            socket.data.profile.guildName = null;
          }
        }

        const separatorIdx = fullMsg.indexOf(':');
        const code = separatorIdx !== -1 ? fullMsg.substring(0, separatorIdx).trim() : 'CHAT_ERROR';
        const cleanMsg = separatorIdx !== -1 ? fullMsg.substring(separatorIdx + 1).trim() : fullMsg;

        const errorPayload = { success: false, code, message: cleanMsg };
        socket.emit('chat_error', errorPayload);
        if (ack) ack(errorPayload);
      }
    });

    // 6. Lắng nghe sự kiện đồng bộ lại vị trí phân khu (khi nhân vật chuyển map/zone)
    socket.on('sync_zone', async (ack?: (res: any) => void) => {
      try {
        if (!isSessionStillValid(socket)) {
          socket.emit('chat_error', { success: false, code: 'AUTHENTICATION_EXPIRED', message: 'Linh phù xác thực đã hết hạn.' });
          socket.disconnect(true);
          return;
        }

        const freshProfile = await xianxiaChatService.getCharacterChatProfile(profile.userId);
        if (freshProfile && freshProfile.currentZone !== profile.currentZone) {
          const oldZoneRoom = `xianxia:zone:${profile.currentZone}`;
          const newZoneRoom = `xianxia:zone:${freshProfile.currentZone}`;

          socket.leave(oldZoneRoom);
          socket.join(newZoneRoom);
          profile.currentZone = freshProfile.currentZone;
          socket.data.profile = freshProfile;

          // Lấy lịch sử khu vực mới
          const newZoneHistory = await xianxiaChatService.getRecentMessages('ZONE', freshProfile.currentZone);

          socket.emit('zone_changed', {
            success: true,
            currentZone: freshProfile.currentZone,
            zoneMessages: newZoneHistory,
          });

          if (ack) ack({ success: true, currentZone: freshProfile.currentZone });
        } else {
          if (ack) ack({ success: true, currentZone: profile.currentZone });
        }
      } catch (err: any) {
        if (ack) ack({ success: false, message: err?.message || 'Lỗi đồng bộ khu vực.' });
      }
    });

    // 7. Lắng nghe sự kiện đồng bộ Tông Môn (khi gia nhập, rời bỏ, hoặc giải tán Tông Môn)
    socket.on('sync_guild', async (ack?: (res: any) => void) => {
      try {
        if (!isSessionStillValid(socket)) {
          socket.emit('chat_error', { success: false, code: 'AUTHENTICATION_EXPIRED', message: 'Linh phù xác thực đã hết hạn.' });
          socket.disconnect(true);
          return;
        }

        const freshProfile = await xianxiaChatService.getCharacterChatProfile(profile.userId);
        const oldGuildId = profile.guildId;
        const newGuildId = freshProfile?.guildId ?? null;

        if (oldGuildId !== newGuildId) {
          if (oldGuildId) {
            socket.leave(`xianxia:guild:${oldGuildId}`);
          }
          if (newGuildId) {
            socket.join(`xianxia:guild:${newGuildId}`);
          }

          profile.guildId = newGuildId;
          profile.guildName = freshProfile?.guildName ?? null;
          socket.data.profile = freshProfile;

          // Lấy tin nhắn Tông môn mới nếu có
          const newGuildHistory = newGuildId
            ? await xianxiaChatService.getRecentMessages('GUILD', undefined, 30, newGuildId)
            : [];

          socket.emit('guild_changed', {
            success: true,
            guildId: newGuildId,
            guildName: profile.guildName,
            guildMessages: newGuildHistory,
          });

          if (ack) ack({ success: true, guildId: newGuildId, guildName: profile.guildName });
        } else {
          if (ack) ack({ success: true, guildId: profile.guildId, guildName: profile.guildName });
        }
      } catch (err: any) {
        if (ack) ack({ success: false, message: err?.message || 'Lỗi đồng bộ Tông môn.' });
      }
    });

    // 8. Lắng nghe yêu cầu lấy thêm lịch sử tin nhắn
    socket.on('get_history', async (data: { channel: 'WORLD' | 'ZONE' | 'GUILD'; limit?: number }, callback?: (res: any) => void) => {
      try {
        if (!isSessionStillValid(socket)) {
          const res = { success: false, error: 'AUTHENTICATION_EXPIRED: Linh phù xác thực đã hết hạn.' };
          if (callback) callback(res);
          socket.disconnect(true);
          return;
        }

        const channel = data?.channel || 'WORLD';
        const zoneId = channel === 'ZONE' ? profile.currentZone : undefined;
        const guildId = channel === 'GUILD' ? (profile.guildId ?? undefined) : undefined;
        const messages = await xianxiaChatService.getRecentMessages(channel, zoneId, data?.limit || 30, guildId);
        const res = { success: true, channel, messages };
        if (callback) callback(res);
        else socket.emit('chat_history', res);
      } catch (err: any) {
        const res = { success: false, error: err?.message || 'Lỗi nạp lịch sử tin nhắn.' };
        if (callback) callback(res);
      }
    });
  });
}
