import { Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { calculatePostMatchStats } from './levelService.js';

const prisma = new PrismaClient();

export interface PlayerInQueue {
  socketId: string;
  userId: number;
  username: string;
  elo: number;
  level: number;
  joinedAt: number;
}

export interface GameRoom {
  roomId: string;
  playerWhite: { socketId: string; userId: number; username: string; elo: number; level: number; exp: bigint };
  playerBlack: { socketId: string; userId: number; username: string; elo: number; level: number; exp: bigint };
  fen: string; // Position state in FEN
  moves: string[]; // List of moves (PGN string format)
  turn: 'RED' | 'BLACK'; // RED = White side in standard Xiangqi notation
  status: 'PLAYING' | 'FINISHED';
  winnerId?: number | null;
  resultReason?: string;
  createdAt: number;
}

class MatchmakingManager {
  private queue: PlayerInQueue[] = [];
  private activeRooms: Map<string, GameRoom> = new Map();

  // Initial Xiangqi standard board FEN
  public INITIAL_XIANGQI_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

  public addToQueue(player: PlayerInQueue): { matched: boolean; room?: GameRoom } {
    // Remove duplicate entry if exists
    this.removeFromQueue(player.userId);

    // Try finding opponent with +/- 100 Elo or +/- 2 Level (FR-04)
    const now = Date.now();
    const opponentIndex = this.queue.findIndex((p) => {
      const waitTimeSec = (now - p.joinedAt) / 1000;
      const allowedEloDiff = 100 + Math.floor(waitTimeSec) * 10; // Expand over time if waiting
      const eloDiff = Math.abs(p.elo - player.elo);
      const levelDiff = Math.abs(p.level - player.level);
      return eloDiff <= allowedEloDiff || levelDiff <= 2;
    });

    if (opponentIndex !== -1) {
      const opponent = this.queue.splice(opponentIndex, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Randomize Red (White) / Black assigned side
      const isPlayerRed = Math.random() > 0.5;
      const redPlayer = isPlayerRed ? player : opponent;
      const blackPlayer = isPlayerRed ? opponent : player;

      const newRoom: GameRoom = {
        roomId,
        playerWhite: {
          socketId: redPlayer.socketId,
          userId: redPlayer.userId,
          username: redPlayer.username,
          elo: redPlayer.elo,
          level: redPlayer.level,
          exp: 0n,
        },
        playerBlack: {
          socketId: blackPlayer.socketId,
          userId: blackPlayer.userId,
          username: blackPlayer.username,
          elo: blackPlayer.elo,
          level: blackPlayer.level,
          exp: 0n,
        },
        fen: this.INITIAL_XIANGQI_FEN,
        moves: [],
        turn: 'RED',
        status: 'PLAYING',
        createdAt: Date.now(),
      };

      this.activeRooms.set(roomId, newRoom);
      return { matched: true, room: newRoom };
    }

    // No match found immediately, add to queue
    this.queue.push(player);
    return { matched: false };
  }

  public removeFromQueue(userId: number): void {
    this.queue = this.queue.filter((p) => p.userId !== userId);
  }

  public getRoom(roomId: string): GameRoom | undefined {
    return this.activeRooms.get(roomId);
  }

  public async finishGame(
    roomId: string,
    winnerId: number | null,
    reason: string
  ): Promise<{ room: GameRoom; stats: ReturnType<typeof calculatePostMatchStats> } | null> {
    const room = this.activeRooms.get(roomId);
    if (!room || room.status === 'FINISHED') return null;

    room.status = 'FINISHED';
    room.winnerId = winnerId;
    room.resultReason = reason;

    // Fetch full user records from DB for DB update
    let whiteUser = await prisma.user.findUnique({ where: { id: room.playerWhite.userId } });
    let blackUser = await prisma.user.findUnique({ where: { id: room.playerBlack.userId } });

    if (!whiteUser) {
      whiteUser = {
        id: room.playerWhite.userId,
        username: room.playerWhite.username,
        email: '',
        password_hash: '',
        elo: room.playerWhite.elo,
        exp: 0n,
        level: room.playerWhite.level,
        matches_played: 0,
        matches_won: 0,
        created_at: new Date(),
      };
    }

    if (!blackUser) {
      blackUser = {
        id: room.playerBlack.userId,
        username: room.playerBlack.username,
        email: '',
        password_hash: '',
        elo: room.playerBlack.elo,
        exp: 0n,
        level: room.playerBlack.level,
        matches_played: 0,
        matches_won: 0,
        created_at: new Date(),
      };
    }

    const isDraw = winnerId === null;
    const stats = calculatePostMatchStats({
      winnerId,
      isDraw,
      playerWhite: {
        id: whiteUser.id,
        elo: whiteUser.elo,
        exp: whiteUser.exp,
        level: whiteUser.level,
      },
      playerBlack: {
        id: blackUser.id,
        elo: blackUser.elo,
        exp: blackUser.exp,
        level: blackUser.level,
      },
    });

    const isWhiteWinner = winnerId === whiteUser.id;
    const isBlackWinner = winnerId === blackUser.id;

    // Update DB Users in background if connected
    try {
      await prisma.user.update({
        where: { id: whiteUser.id },
        data: {
          elo: stats.white.elo,
          exp: stats.white.exp,
          level: stats.white.level,
          matches_played: { increment: 1 },
          matches_won: isWhiteWinner ? { increment: 1 } : undefined,
        },
      });

      await prisma.user.update({
        where: { id: blackUser.id },
        data: {
          elo: stats.black.elo,
          exp: stats.black.exp,
          level: stats.black.level,
          matches_played: { increment: 1 },
          matches_won: isBlackWinner ? { increment: 1 } : undefined,
        },
      });

      const resultString = isDraw
        ? 'DRAW'
        : isWhiteWinner
        ? 'WHITE_WIN'
        : 'BLACK_WIN';

      const isFeatured = room.moves.length >= 30; // Basic check, full check in Pha 2

      await prisma.match.create({
        data: {
          player_white_id: whiteUser.id,
          player_black_id: blackUser.id,
          pgn_moves: JSON.stringify(room.moves),
          result: resultString,
          is_featured: isFeatured,
        },
      });
    } catch (err) {
      console.warn('Cảnh báo: Không thể lưu ván cờ vào DB (Môi trường local/chưa kết nối DB):', err);
    }

    return { room, stats };
  }
}

export const matchmakingManager = new MatchmakingManager();
