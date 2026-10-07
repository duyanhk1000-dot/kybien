import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { matchmakingManager } from '../services/matchmakingService.js';
import { analyzeMatchWithGemini } from '../services/aiService.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';

export function setupGameSocket(io: Server): void {
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Yêu cầu Token xác thực Socket.'));
    }

    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Token Socket không hợp lệ hoặc đã hết hạn.'));
    }

    socket.data.user = payload;
    next();
  });

  const broadcastPublicRooms = () => {
    const rooms = matchmakingManager.getPublicWaitingRooms();
    io.emit('public_rooms_list', rooms);
  };

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    // Send public waiting rooms list immediately on connection
    socket.emit('public_rooms_list', matchmakingManager.getPublicWaitingRooms());

    // Request public rooms list
    socket.on('get_public_rooms', () => {
      socket.emit('public_rooms_list', matchmakingManager.getPublicWaitingRooms());
    });

    // 1. Ghép trận tự động (Lọc theo Thể loại cờ variant)
    socket.on('join_matchmaking', (data: { variant?: string; elo?: number; level?: number }) => {
      const elo = data?.elo || 1200;
      const level = data?.level || 1;
      const variant = data?.variant || 'n';

      const result = matchmakingManager.addToQueue({
        socketId: socket.id,
        userId: user.userId,
        username: user.username,
        elo,
        level,
        variant,
        joinedAt: Date.now(),
      });

      if (result.matched && result.room && result.room.playerBlack) {
        const room = result.room;
        const playerBlack = result.room.playerBlack;

        const socketWhite = io.sockets.sockets.get(room.playerWhite.socketId);
        const socketBlack = io.sockets.sockets.get(playerBlack.socketId);

        if (socketWhite) socketWhite.join(room.roomId);
        if (socketBlack) socketBlack.join(room.roomId);

        io.to(room.roomId).emit('match_found', {
          roomId: room.roomId,
          variant: room.variant,
          initialPieces: room.initialPieces,
          fen: room.fen,
          turn: room.turn,
          playerWhite: {
            socketId: room.playerWhite.socketId,
            userId: room.playerWhite.userId,
            username: room.playerWhite.username,
            elo: room.playerWhite.elo,
            level: room.playerWhite.level,
          },
          playerBlack: {
            socketId: playerBlack.socketId,
            userId: playerBlack.userId,
            username: playerBlack.username,
            elo: playerBlack.elo,
            level: playerBlack.level,
          },
        });
      } else {
        socket.emit('matchmaking_queued', { message: 'Đang tìm kiếm đối thủ phù hợp thể loại cờ đã chọn...' });
      }
    });

    // 2. Tạo phòng theo mã (Công khai / Riêng tư + Variant)
    socket.on('create_room', (data: { isPrivate?: boolean; variant?: string; elo?: number; level?: number }) => {
      const isPrivate = !!data?.isPrivate;
      const variant = data?.variant || 'n';
      const elo = data?.elo || 1200;
      const level = data?.level || 1;

      const { roomCode, room } = matchmakingManager.createRoom({
        socketId: socket.id,
        userId: user.userId,
        username: user.username,
        elo,
        level,
        variant,
        joinedAt: Date.now(),
      }, isPrivate, variant);

      socket.join(room.roomId);

      socket.emit('room_created', {
        roomCode,
        isPrivate,
        variant,
        message: `Đã tạo ${isPrivate ? 'phòng riêng' : 'phòng chờ công khai'} thành công! Mã: ${roomCode}`,
      });

      if (!isPrivate) {
        broadcastPublicRooms();
      }
    });

    // 3. Tham gia phòng theo mã (Đồng bộ variant từ phòng chủ)
    socket.on('join_room_by_code', (data: { roomCode: string; elo?: number; level?: number }) => {
      const elo = data?.elo || 1200;
      const level = data?.level || 1;

      const result = matchmakingManager.joinRoomByCode(data.roomCode, {
        socketId: socket.id,
        userId: user.userId,
        username: user.username,
        elo,
        level,
        variant: '',
        joinedAt: Date.now(),
      });

      if (!result.success || !result.room || !result.room.playerBlack) {
        socket.emit('game_error', { message: result.error || 'Không thể tham gia phòng này.' });
        return;
      }

      const room = result.room;
      const playerBlack = result.room.playerBlack;
      const socketWhite = io.sockets.sockets.get(room.playerWhite.socketId);
      const socketBlack = io.sockets.sockets.get(playerBlack.socketId);

      if (socketWhite) socketWhite.join(room.roomId);
      if (socketBlack) socketBlack.join(room.roomId);

      io.to(room.roomId).emit('match_found', {
        roomId: room.roomId,
        roomCode: room.roomCode,
        variant: room.variant,
        initialPieces: room.initialPieces,
        fen: room.fen,
        turn: room.turn,
        playerWhite: {
          socketId: room.playerWhite.socketId,
          userId: room.playerWhite.userId,
          username: room.playerWhite.username,
          elo: room.playerWhite.elo,
          level: room.playerWhite.level,
        },
        playerBlack: {
          socketId: playerBlack.socketId,
          userId: playerBlack.userId,
          username: playerBlack.username,
          elo: playerBlack.elo,
          level: playerBlack.level,
        },
      });

      broadcastPublicRooms();
    });

    // 4. Hủy tìm trận
    socket.on('cancel_matchmaking', () => {
      matchmakingManager.removeFromQueue(user.userId);
      socket.emit('matchmaking_cancelled', { message: 'Đã hủy tìm kiếm trận.' });
    });

    // 5. Nước đi cờ
    socket.on('make_move', async (data: { roomId: string; move: { from: string; to: string }; nextFen: string }) => {
      const { roomId, move, nextFen } = data;
      const room = matchmakingManager.getRoom(roomId);

      if (!room || room.status !== 'PLAYING' || !room.playerBlack) {
        socket.emit('game_error', { message: 'Phòng đấu không tồn tại hoặc đã kết thúc.' });
        return;
      }

      const isRedPlayer = socket.id === room.playerWhite.socketId;
      const isBlackPlayer = socket.id === room.playerBlack.socketId;

      if ((room.turn === 'RED' && !isRedPlayer) || (room.turn === 'BLACK' && !isBlackPlayer)) {
        socket.emit('game_error', { message: 'Chưa đến lượt đi của bạn.' });
        return;
      }

      const moveNotation = `${move.from}-${move.to}`;
      room.moves.push(moveNotation);
      room.fen = nextFen;
      room.turn = room.turn === 'RED' ? 'BLACK' : 'RED';

      io.to(roomId).emit('move_made', {
        move: data.move,
        nextFen: room.fen,
        turn: room.turn,
        movesHistory: room.moves,
      });
    });

    // 6. Kết thúc ván cờ
    socket.on('game_over', async (data: { roomId: string; winnerId: number | null; reason: string }) => {
      const { roomId, winnerId, reason } = data;
      const room = matchmakingManager.getRoom(roomId);

      if (room && room.moves && room.moves.length >= 50) {
        const whiteName = room.playerWhite.username || 'Đỏ';
        const blackName = room.playerBlack?.username || 'Đen';
        let winnerName = 'Hòa';
        let loserName = 'Hòa';

        if (winnerId === room.playerWhite.userId) {
          winnerName = whiteName;
          loserName = blackName;
        } else if (room.playerBlack && winnerId === room.playerBlack.userId) {
          winnerName = blackName;
          loserName = whiteName;
        }

        // Tự động kích hoạt AI sinh bài viết Sa Trường & Đăng bài Blogger cho Trận Hay (>50 nước)
        analyzeMatchWithGemini(room.moves, winnerName, loserName, reason || 'Chiếu Bí')
          .then((aiResult) => {
            if (aiResult) {
              return publishMatchToBlogger(`match_${Date.now()}`, whiteName, blackName, room.moves, aiResult);
            }
          })
          .catch((err) => console.error('[Socket AI Blog Post Error]', err));
      }

      const finished = await matchmakingManager.finishGame(roomId, winnerId, reason);

      if (finished) {
        io.to(roomId).emit('game_ended', {
          winnerId,
          reason,
          stats: finished.stats,
        });
      }
    });

    socket.on('disconnect', () => {
      const { updatedPublicList } = matchmakingManager.handleSocketDisconnect(socket.id);
      if (updatedPublicList) {
        broadcastPublicRooms();
      }
    });
  });
}
