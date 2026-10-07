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
  variant: string; // 'kb' | 'n' | 't' | 'g'
  joinedAt: number;
}

export interface GameRoom {
  roomId: string;
  roomCode?: string;
  variant: string; // 'kb' | 'n' | 't' | 'g'
  initialPieces?: { red: string[]; black: string[] };
  playerWhite: { socketId: string; userId: number; username: string; elo: number; level: number; exp: bigint };
  playerBlack?: { socketId: string; userId: number; username: string; elo: number; level: number; exp: bigint };
  fen: string;
  moves: string[];
  turn: 'RED' | 'BLACK';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  isPrivate?: boolean;
  winnerId?: number | null;
  resultReason?: string;
  createdAt: number;
}

class MatchmakingManager {
  private queue: PlayerInQueue[] = [];
  private activeRooms: Map<string, GameRoom> = new Map();
  private privateCodeToRoomId: Map<string, string> = new Map();

  public INITIAL_XIANGQI_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

  private generateInitialPieces(variant: string): { red: string[]; black: string[] } | undefined {
    if (variant !== 't' && variant !== 'g') return undefined;
    const piecesList = ['r','r','n','n','b','b','a','a','c','c','p','p','p','p','p'];
    const shuffle = (a: string[]) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return {
      red: shuffle(piecesList.slice()),
      black: shuffle(piecesList.slice()),
    };
  }

  public addToQueue(player: PlayerInQueue): { matched: boolean; room?: GameRoom } {
    // Remove duplicate entry with exact same socketId
    this.queue = this.queue.filter((p) => p.socketId !== player.socketId);

    // ONLY match opponent who selected the EXACT SAME chess variant!
    const opponentIndex = this.queue.findIndex(
      (p) => p.socketId !== player.socketId && (p.variant || 'n') === (player.variant || 'n')
    );

    if (opponentIndex !== -1) {
      const opponent = this.queue.splice(opponentIndex, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const isPlayerRed = Math.random() > 0.5;
      const redPlayer = isPlayerRed ? player : opponent;
      const blackPlayer = isPlayerRed ? opponent : player;
      const variant = player.variant || 'n';

      const newRoom: GameRoom = {
        roomId,
        variant,
        initialPieces: this.generateInitialPieces(variant),
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

    this.queue.push(player);
    return { matched: false };
  }

  public createRoom(player: PlayerInQueue, isPrivate: boolean, variant: string = 'n'): { roomCode: string; room: GameRoom } {
    const codeNumber = Math.floor(1000 + Math.random() * 9000);
    const roomCode = `KB-${codeNumber}`;
    const roomId = `room_${isPrivate ? 'priv' : 'pub'}_${Date.now()}_${roomCode}`;

    const newRoom: GameRoom = {
      roomId,
      roomCode,
      variant,
      initialPieces: this.generateInitialPieces(variant),
      playerWhite: {
        socketId: player.socketId,
        userId: player.userId,
        username: player.username,
        elo: player.elo,
        level: player.level,
        exp: 0n,
      },
      fen: this.INITIAL_XIANGQI_FEN,
      moves: [],
      turn: 'RED',
      status: 'WAITING',
      isPrivate,
      createdAt: Date.now(),
    };

    this.activeRooms.set(roomId, newRoom);
    this.privateCodeToRoomId.set(roomCode, roomId);
    return { roomCode, room: newRoom };
  }

  public joinRoomByCode(
    roomCode: string,
    player: PlayerInQueue
  ): { success: boolean; error?: string; room?: GameRoom } {
    const formattedCode = roomCode.trim().toUpperCase();
    const roomId = this.privateCodeToRoomId.get(formattedCode);
    if (!roomId) {
      return { success: false, error: 'Mã phòng không tồn tại hoặc đã hết hạn.' };
    }

    const room = this.activeRooms.get(roomId);
    if (!room || room.status !== 'WAITING') {
      return { success: false, error: 'Phòng đấu đã đầy hoặc ván đấu đã kết thúc.' };
    }

    if (room.playerWhite.socketId === player.socketId) {
      return { success: false, error: 'Bạn đang là chủ phòng này, vui lòng chờ đối thủ vào.' };
    }

    room.playerBlack = {
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      elo: player.elo,
      level: player.level,
      exp: 0n,
    };
    room.status = 'PLAYING';

    return { success: true, room };
  }

  public getPublicWaitingRooms(): Array<{ roomCode: string; roomId: string; hostName: string; elo: number; variant: string; createdAt: number }> {
    const list: Array<{ roomCode: string; roomId: string; hostName: string; elo: number; variant: string; createdAt: number }> = [];
    this.activeRooms.forEach((room) => {
      if (room.status === 'WAITING' && !room.isPrivate && room.roomCode) {
        list.push({
          roomCode: room.roomCode,
          roomId: room.roomId,
          hostName: room.playerWhite.username,
          elo: room.playerWhite.elo,
          variant: room.variant || 'n',
          createdAt: room.createdAt,
        });
      }
    });
    return list;
  }

  public handleSocketDisconnect(socketId: string): { updatedPublicList: boolean } {
    this.queue = this.queue.filter((p) => p.socketId !== socketId);

    let listChanged = false;
    this.activeRooms.forEach((room, roomId) => {
      if (room.status === 'WAITING' && room.playerWhite.socketId === socketId) {
        this.activeRooms.delete(roomId);
        if (room.roomCode) {
          this.privateCodeToRoomId.delete(room.roomCode);
        }
        if (!room.isPrivate) {
          listChanged = true;
        }
      }
    });
    return { updatedPublicList: listChanged };
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
    if (!room || room.status === 'FINISHED' || !room.playerBlack) return null;

    room.status = 'FINISHED';
    room.winnerId = winnerId;
    room.resultReason = reason;

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

      const isFeatured = room.moves.length >= 30;

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
      console.warn('Cảnh báo: Không thể lưu ván cờ vào DB:', err);
    }

    return { room, stats };
  }
}

export const matchmakingManager = new MatchmakingManager();
