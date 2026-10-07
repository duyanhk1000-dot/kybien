import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { matchmakingManager } from '../services/matchmakingService.js';

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

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[Socket Connected] User ${user.username} (ID: ${user.userId})`);

    // 1. Tham gia Hàng đợi ghép phòng
    socket.on('join_matchmaking', (data: { elo?: number; level?: number }) => {
      const elo = data?.elo || 1200;
      const level = data?.level || 1;

      const result = matchmakingManager.addToQueue({
        socketId: socket.id,
        userId: user.userId,
        username: user.username,
        elo,
        level,
        joinedAt: Date.now(),
      });

      if (result.matched && result.room) {
        const room = result.room;

        // Cho 2 người chơi join socket room
        const socketWhite = io.sockets.sockets.get(room.playerWhite.socketId);
        const socketBlack = io.sockets.sockets.get(room.playerBlack.socketId);

        if (socketWhite) socketWhite.join(room.roomId);
        if (socketBlack) socketBlack.join(room.roomId);

        // Phát sự kiện tìm thấy trận cho 2 bên
        io.to(room.roomId).emit('match_found', {
          roomId: room.roomId,
          fen: room.fen,
          turn: room.turn,
          playerWhite: {
            userId: room.playerWhite.userId,
            username: room.playerWhite.username,
            elo: room.playerWhite.elo,
            level: room.playerWhite.level,
          },
          playerBlack: {
            userId: room.playerBlack.userId,
            username: room.playerBlack.username,
            elo: room.playerBlack.elo,
            level: room.playerBlack.level,
          },
        });
      } else {
        socket.emit('matchmaking_queued', { message: 'Đang tìm kiếm đối thủ phù hợp...' });
      }
    });

    // 2. Hủy tìm trận
    socket.on('cancel_matchmaking', () => {
      matchmakingManager.removeFromQueue(user.userId);
      socket.emit('matchmaking_cancelled', { message: 'Đã hủy tìm kiếm trận.' });
    });

    // 3. Thực hiện nước đi Cờ Tướng (Move Event)
    socket.on('make_move', async (data: { roomId: string; move: { from: string; to: string }; nextFen: string }) => {
      const { roomId, move, nextFen } = data;
      const room = matchmakingManager.getRoom(roomId);

      if (!room || room.status !== 'PLAYING') {
        socket.emit('game_error', { message: 'Phòng đấu không tồn tại hoặc đã kết thúc.' });
        return;
      }

      // Kiểm tra lượt đi đúng người chơi
      const isRedPlayer = socket.id === room.playerWhite.socketId;
      const isBlackPlayer = socket.id === room.playerBlack.socketId;

      if ((room.turn === 'RED' && !isRedPlayer) || (room.turn === 'BLACK' && !isBlackPlayer)) {
        socket.emit('game_error', { message: 'Chưa đến lượt đi của bạn.' });
        return;
      }

      // Cập nhật FEN & Nước cờ
      const moveNotation = `${move.from}-${move.to}`;
      room.moves.push(moveNotation);
      room.fen = nextFen;
      room.turn = room.turn === 'RED' ? 'BLACK' : 'RED';

      // Phát nước đi cho đối thủ trong phòng
      io.to(roomId).emit('move_made', {
        move: data.move,
        nextFen: room.fen,
        turn: room.turn,
        movesHistory: room.moves,
      });
    });

    // 4. Kết thúc ván cờ (Báo Chiếu bí / Đầu hàng / Hòa)
    socket.on('game_over', async (data: { roomId: string; winnerId: number | null; reason: string }) => {
      const { roomId, winnerId, reason } = data;
      const finished = await matchmakingManager.finishGame(roomId, winnerId, reason);

      if (finished) {
        io.to(roomId).emit('game_ended', {
          winnerId,
          reason,
          stats: finished.stats,
        });
      }
    });

    // 5. Ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`[Socket Disconnected] User ${user.username}`);
      matchmakingManager.removeFromQueue(user.userId);
    });
  });
}
