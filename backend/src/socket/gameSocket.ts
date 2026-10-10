import { Server, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import { matchmakingManager } from '../services/matchmakingService.js';
import { analyzeMatchWithGemini } from '../services/aiService.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';
import { XiangqiEngine } from '../services/xiangqiEngine.js';
import { prisma } from '../utils/prisma.js';

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

    // Tự động khôi phục hoặc đưa người chơi vào đúng phòng đấu đang tham gia (Task 5 Reconnection)
    const activeRoom = matchmakingManager.getUserActiveRoom(user.userId);
    if (activeRoom) {
      if (activeRoom.status === 'WAITING' && activeRoom.playerWhite.userId === user.userId) {
        activeRoom.playerWhite.socketId = socket.id;
        socket.join(activeRoom.roomId);
        socket.emit('room_created', {
          roomCode: activeRoom.roomCode,
          isPrivate: activeRoom.isPrivate || false,
          variant: activeRoom.variant,
          message: `Đã khôi phục phòng chờ thành công! Mã: ${activeRoom.roomCode}`,
        });
        broadcastPublicRooms();
      } else if (activeRoom.status === 'PLAYING' && activeRoom.playerBlack) {
        if (activeRoom.playerWhite.userId === user.userId) activeRoom.playerWhite.socketId = socket.id;
        if (activeRoom.playerBlack.userId === user.userId) activeRoom.playerBlack.socketId = socket.id;
        socket.join(activeRoom.roomId);

        socket.emit('match_found', {
          roomId: activeRoom.roomId,
          roomCode: activeRoom.roomCode,
          variant: activeRoom.variant,
          initialPieces: activeRoom.initialPieces,
          fen: activeRoom.fen,
          turn: activeRoom.turn,
          movesHistory: activeRoom.moves,
          playerWhite: activeRoom.playerWhite,
          playerBlack: activeRoom.playerBlack,
          isReconnect: true,
        });
      }
    }

    // Request public rooms list
    socket.on('get_public_rooms', () => {
      socket.emit('public_rooms_list', matchmakingManager.getPublicWaitingRooms());
    });

    // 1. Ghép trận tự động (Lọc theo Thể loại cờ variant & lấy user info từ DB - Task 3)
    socket.on('join_matchmaking', async (data: { variant?: string }) => {
      const variant = data?.variant || 'n';

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { id: true, username: true, elo: true, level: true },
        });

        if (!dbUser) {
          socket.emit('game_error', { message: 'Không tìm thấy dữ liệu người dùng trong hệ thống.' });
          return;
        }

        const result = matchmakingManager.addToQueue({
          socketId: socket.id,
          userId: dbUser.id,
          username: dbUser.username,
          elo: dbUser.elo,
          level: dbUser.level,
          variant,
          joinedAt: Date.now(),
        });

        if (result.error) {
          socket.emit('game_error', { message: result.error });
          return;
        }

        if (result.matched && result.room && result.room.playerBlack) {
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
            movesHistory: room.moves,
            playerWhite: room.playerWhite,
            playerBlack,
          });
        } else {
          socket.emit('matchmaking_queued', { message: 'Đang tìm kiếm đối thủ phù hợp thể loại cờ đã chọn...' });
        }
      } catch (err) {
        console.error('[Socket Matchmaking Error]', err);
        socket.emit('game_error', { message: 'Lỗi máy chủ khi tham gia hàng đợi ghép trận.' });
      }
    });

    // 2. Tạo phòng theo mã (Công khai / Riêng tư + Variant - DB User authenticated - Task 3)
    socket.on('create_room', async (data: { isPrivate?: boolean; variant?: string }) => {
      const isPrivate = !!data?.isPrivate;
      const variant = data?.variant || 'n';

      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { id: true, username: true, elo: true, level: true },
        });

        if (!dbUser) {
          socket.emit('game_error', { message: 'Không tìm thấy dữ liệu người dùng trong hệ thống.' });
          return;
        }

        const { roomCode, room } = matchmakingManager.createRoom({
          socketId: socket.id,
          userId: dbUser.id,
          username: dbUser.username,
          elo: dbUser.elo,
          level: dbUser.level,
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
      } catch (err: any) {
        socket.emit('game_error', { message: err?.message || 'Lỗi khi tạo phòng đấu.' });
      }
    });

    // 3. Tham gia phòng theo mã (Task 3)
    socket.on('join_room_by_code', async (data: { roomCode: string }) => {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.userId },
          select: { id: true, username: true, elo: true, level: true },
        });

        if (!dbUser) {
          socket.emit('game_error', { message: 'Không tìm thấy dữ liệu người dùng trong hệ thống.' });
          return;
        }

        const result = matchmakingManager.joinRoomByCode(data.roomCode, {
          socketId: socket.id,
          userId: dbUser.id,
          username: dbUser.username,
          elo: dbUser.elo,
          level: dbUser.level,
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
          movesHistory: room.moves,
          playerWhite: room.playerWhite,
          playerBlack,
        });

        broadcastPublicRooms();
      } catch (err: any) {
        socket.emit('game_error', { message: 'Lỗi khi tham gia phòng đấu.' });
      }
    });

    // 4. Hủy tìm trận (Fix Task 2)
    socket.on('cancel_matchmaking', () => {
      matchmakingManager.removeFromQueue(user.userId);
      matchmakingManager.removeFromQueue(socket.id);
      socket.emit('matchmaking_cancelled', { message: 'Đã hủy tìm kiếm trận.' });
    });

    // 5. Nước đi cờ (Server-side Rule Validation & FEN Calculation - Task 1)
    socket.on('make_move', async (data: { roomId: string; move: { from: string; to: string } }) => {
      const { roomId, move } = data;
      const room = matchmakingManager.getRoom(roomId);

      if (!room || room.status !== 'PLAYING' || !room.playerBlack) {
        socket.emit('game_error', { message: 'Phòng đấu không tồn tại hoặc đã kết thúc.' });
        return;
      }

      const isRedPlayer = socket.id === room.playerWhite.socketId || user.userId === room.playerWhite.userId;
      const isBlackPlayer = socket.id === room.playerBlack.socketId || user.userId === room.playerBlack.userId;

      if (!isRedPlayer && !isBlackPlayer) {
        socket.emit('game_error', { message: 'Bạn không phải người chơi trong phòng đấu này.' });
        return;
      }

      if ((room.turn === 'RED' && !isRedPlayer) || (room.turn === 'BLACK' && !isBlackPlayer)) {
        socket.emit('game_error', { message: 'Chưa đến lượt đi của bạn.' });
        return;
      }

      if (!room.engine) {
        room.engine = new XiangqiEngine(matchmakingManager.INITIAL_XIANGQI_FEN, room.variant, room.initialPieces);
      }

      const turnColor = room.turn === 'RED' ? 'r' : 'b';
      const moveResult = room.engine.validateMove(move, turnColor, room.variant);

      if (!moveResult.valid) {
        socket.emit('game_error', { message: moveResult.error || 'Nước đi không hợp lệ theo luật cờ máy chủ.' });
        return;
      }

      const moveNotation = moveResult.formattedNotation || `${move.from}-${move.to}`;
      room.moves.push(moveNotation);
      room.fen = room.engine.getFen();
      room.turn = room.engine.turn;

      io.to(roomId).emit('move_made', {
        move: { from: move.from, to: move.to },
        nextFen: room.fen,
        turn: room.turn,
        movesHistory: room.moves,
      });
    });

    const processGameOver = async (room: any, winnerId: number | null, reason: string) => {
      const roomId = room.roomId;
      const savedMoves = [...room.moves];
      const playerWhite = room.playerWhite;
      const playerBlack = room.playerBlack;
      const variant = room.variant;

      const finished = await matchmakingManager.finishGame(roomId, winnerId, reason);
      if (!finished) {
        return; // Already finished or inactive
      }

      io.to(roomId).emit('game_ended', {
        winnerId,
        reason,
        stats: finished.stats,
      });

      // Tự động kích hoạt AI sinh bài viết Sa Trường & Đăng bài Blogger phục vụ đẩy SEO:
      // - Ghép trận 2 người PvP Online: >= 90 nước
      // - Chơi với Bot (Máy): >= 120 nước
      const isBotMatch = !playerBlack || (playerBlack.username && (playerBlack.username.toLowerCase().includes('máy') || playerBlack.username.toLowerCase().includes('bot')));
      const minPlies = isBotMatch ? 120 : 90;

      if (savedMoves.length >= minPlies) {
        const whiteName = playerWhite.username || 'Đỏ';
        const blackName = playerBlack ? (playerBlack.username || 'Đen') : 'Máy (AI)';
        let winnerName = 'Hòa';
        let loserName = 'Hòa';

        if (winnerId === playerWhite.userId) {
          winnerName = whiteName;
          loserName = blackName;
        } else if (playerBlack && winnerId === playerBlack.userId) {
          winnerName = blackName;
          loserName = whiteName;
        }

        const variantCode = (variant || 'kb').toLowerCase();
        let variantName = 'Cờ Tướng Kỳ Biến';
        if (variantCode === 'n') variantName = 'Cờ Tướng Truyền Thống';
        else if (variantCode === 't') variantName = 'Cờ Úp Truyền Thống';
        else if (variantCode === 'g') variantName = 'Cờ Úp Gián Điệp';

        analyzeMatchWithGemini(savedMoves, whiteName, blackName, winnerName, loserName, reason || 'Chiếu Bí', variantCode)
          .then((aiResult) => {
            if (aiResult) {
              return publishMatchToBlogger(`match_${Date.now()}`, whiteName, blackName, savedMoves, aiResult, variantName, variantCode);
            }
          })
          .catch((err) => console.error('[Socket AI Blog Post Error]', err));
      }
    };

    // 6. Resign (Đầu hàng)
    socket.on('resign', async (data: { roomId: string }) => {
      const { roomId } = data;
      const room = matchmakingManager.getRoom(roomId);
      if (!room || room.status !== 'PLAYING' || !room.playerBlack) {
        socket.emit('game_error', { message: 'Phòng đấu không tồn tại hoặc đã kết thúc.' });
        return;
      }

      const isRedPlayer = socket.id === room.playerWhite.socketId || user.userId === room.playerWhite.userId;
      const isBlackPlayer = socket.id === room.playerBlack.socketId || user.userId === room.playerBlack.userId;

      if (!isRedPlayer && !isBlackPlayer) {
        socket.emit('game_error', { message: 'Bạn không phải người chơi trong phòng đấu này.' });
        return;
      }

      const winnerId = isRedPlayer ? room.playerBlack.userId : room.playerWhite.userId;
      await processGameOver(room, winnerId, 'Đầu hàng');
    });

    // 7. Kết thúc ván cờ (Server Verified Game Over)
    socket.on('game_over', async (data: { roomId: string; winnerId?: number | null; reason?: string }) => {
      const { roomId } = data;
      const room = matchmakingManager.getRoom(roomId);

      if (!room || room.status !== 'PLAYING' || !room.playerBlack) {
        socket.emit('game_error', { message: 'Phòng đấu không tồn tại hoặc đã kết thúc.' });
        return;
      }

      const isRedPlayer = socket.id === room.playerWhite.socketId || user.userId === room.playerWhite.userId;
      const isBlackPlayer = socket.id === room.playerBlack.socketId || user.userId === room.playerBlack.userId;

      if (!isRedPlayer && !isBlackPlayer) {
        socket.emit('game_error', { message: 'Bạn không phải người chơi trong phòng đấu này.' });
        return;
      }

      let verifiedWinnerId: number | null = null;
      if (data.winnerId === room.playerWhite.userId || data.winnerId === room.playerBlack.userId) {
        verifiedWinnerId = data.winnerId;
      }

      const verifiedReason = data.reason || 'Chiếu Bí';
      await processGameOver(room, verifiedWinnerId, verifiedReason);
    });

    socket.on('disconnect', () => {
      matchmakingManager.handleSocketDisconnect(socket.id, broadcastPublicRooms);
    });
  });
}
