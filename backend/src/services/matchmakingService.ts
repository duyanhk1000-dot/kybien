import { Server, Socket } from 'socket.io';
import { XiangqiEngine } from './xiangqiEngine.js';
import { prisma } from '../utils/prisma.js';
import { calculatePostMatchStats } from './levelService.js';

export interface PlayerInQueue {
  socketId: string;
  userId: number;
  username: string;
  elo: number;
  level: number;
  variant?: string; // 'kb' | 'n' | 't' | 'g'
  joinedAt: number;
}

export interface GameRoom {
  roomId: string;
  roomCode: string;
  variant: string; // 'kb' | 'n' | 't' | 'g'
  initialPieces?: { red: any[]; black: any[] };
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
  engine?: XiangqiEngine;
}

class MatchmakingManager {
  private queue: PlayerInQueue[] = [];
  private activeRooms: Map<string, GameRoom> = new Map();
  private privateCodeToRoomId: Map<string, string> = new Map();

  public INITIAL_XIANGQI_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';

  private generateInitialPieces(variant: string): { red: any[]; black: any[] } | undefined {
    if (variant !== 't' && variant !== 'g') return undefined;
    const piecesList = ['r','r','n','n','b','b','a','a','c','c','p','p','p','p','p'];
    const shuffle = (a: any[]) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    if (variant === 'g') {
      const combinedPool = [
        ...piecesList.map(t => ({ t, col: 'r' })),
        ...piecesList.map(t => ({ t, col: 'b' }))
      ];
      shuffle(combinedPool);
      return {
        red: combinedPool.slice(0, 15),
        black: combinedPool.slice(15, 30),
      };
    } else {
      return {
        red: shuffle(piecesList.slice().map(t => ({ t, col: 'r' }))),
        black: shuffle(piecesList.slice().map(t => ({ t, col: 'b' }))),
      };
    }
  }

  public addToQueue(player: PlayerInQueue): { matched: boolean; room?: GameRoom; error?: string } {
    // Check if player is already in an active match
    const activeRoom = this.getUserActiveRoom(player.userId);
    if (activeRoom && activeRoom.status === 'PLAYING') {
      return { matched: false, error: 'Bạn đang ở trong một trận đấu chưa kết thúc.' };
    }

    // Clean up any existing queue entries for this user / socket
    this.removeFromQueue(player.userId);
    this.removeFromQueue(player.socketId);

    const opponentIndex = this.queue.findIndex(
      (p) => p.userId !== player.userId && p.socketId !== player.socketId && (p.variant || 'n') === (player.variant || 'n')
    );

    if (opponentIndex !== -1) {
      const opponent = this.queue.splice(opponentIndex, 1)[0];
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const isPlayerRed = Math.random() > 0.5;
      const redPlayer = isPlayerRed ? player : opponent;
      const blackPlayer = isPlayerRed ? opponent : player;
      const variant = player.variant || 'n';

      const initialPieces = this.generateInitialPieces(variant);
      const engine = new XiangqiEngine(this.INITIAL_XIANGQI_FEN, variant, initialPieces);

      const newRoom: GameRoom = {
        roomId,
        roomCode: `MATCH-${Math.floor(1000 + Math.random() * 9000)}`,
        variant,
        initialPieces,
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
        fen: engine.getFen(),
        moves: [],
        turn: 'RED',
        status: 'PLAYING',
        createdAt: Date.now(),
        engine,
      };

      this.activeRooms.set(roomId, newRoom);
      return { matched: true, room: newRoom };
    }

    this.queue.push(player);
    return { matched: false };
  }

  public cancelAllWaitingRoomsOfUser(userId: number, exceptRoomId?: string): void {
    const toDelete: string[] = [];
    this.activeRooms.forEach((room, roomId) => {
      if (roomId !== exceptRoomId && room.status === 'WAITING' && room.playerWhite.userId === userId) {
        toDelete.push(roomId);
      }
    });
    toDelete.forEach((id) => this.removeRoom(id));
  }

  public getUserActiveRoom(userId: number): GameRoom | null {
    for (const [, room] of this.activeRooms.entries()) {
      if (room.status !== 'FINISHED' && (room.playerWhite.userId === userId || room.playerBlack?.userId === userId)) {
        return room;
      }
    }
    return null;
  }

  public createRoom(player: PlayerInQueue, isPrivate: boolean, variant: string = 'n'): { roomCode: string; room: GameRoom } {
    const existingActive = this.getUserActiveRoom(player.userId);
    if (existingActive && existingActive.status === 'PLAYING') {
      throw new Error('Bạn đang ở trong một trận đấu chưa kết thúc.');
    }

    this.cancelAllWaitingRoomsOfUser(player.userId);

    let roomCode = '';
    let roomId = '';
    do {
      const codeNumber = Math.floor(1000 + Math.random() * 9000);
      roomCode = `KB-${codeNumber}`;
      roomId = `room_${isPrivate ? 'priv' : 'pub'}_${Date.now()}_${roomCode}`;
    } while (this.privateCodeToRoomId.has(roomCode));

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

  public joinRoomByCode(roomCode: string, player: PlayerInQueue): { success: boolean; room?: GameRoom; error?: string } {
    const existingActive = this.getUserActiveRoom(player.userId);
    if (existingActive && existingActive.status === 'PLAYING') {
      return { success: false, error: 'Bạn đang ở trong một trận đấu chưa kết thúc.' };
    }

    const roomId = this.privateCodeToRoomId.get(roomCode);
    if (!roomId) {
      return { success: false, error: 'Mã phòng không tồn tại hoặc đã bị hủy.' };
    }

    const room = this.activeRooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Phòng không còn hoạt động.' };
    }

    if (room.status !== 'WAITING') {
      return { success: false, error: 'Phòng đã đầy hoặc đang diễn ra trận đấu.' };
    }

    if (room.playerWhite.userId === player.userId) {
      return { success: false, error: 'Bạn là chủ phòng của trận đấu này.' };
    }

    this.cancelAllWaitingRoomsOfUser(player.userId);
    this.cancelAllWaitingRoomsOfUser(room.playerWhite.userId, roomId);

    room.playerBlack = {
      socketId: player.socketId,
      userId: player.userId,
      username: player.username,
      elo: player.elo,
      level: player.level,
      exp: 0n,
    };
    room.status = 'PLAYING';
    room.engine = new XiangqiEngine(this.INITIAL_XIANGQI_FEN, room.variant, room.initialPieces);
    room.fen = room.engine.getFen();

    return { success: true, room };
  }

  private pendingRoomDeletions: Map<string, NodeJS.Timeout> = new Map();

  public getPublicWaitingRooms(): Array<{ roomCode: string; hostName: string; hostElo: number; variant: string }> {
    const list: Array<{ roomCode: string; hostName: string; hostElo: number; variant: string }> = [];
    this.activeRooms.forEach((room) => {
      if (room.status === 'WAITING' && !room.isPrivate) {
        list.push({
          roomCode: room.roomCode,
          hostName: room.playerWhite.username,
          hostElo: room.playerWhite.elo,
          variant: room.variant || 'n',
        });
      }
    });
    return list;
  }

  public removeFromQueue(identifier: string | number): void {
    this.queue = this.queue.filter(
      (p) => p.socketId !== String(identifier) && p.userId !== Number(identifier)
    );
  }

  public getRoom(roomId: string): GameRoom | undefined {
    return this.activeRooms.get(roomId);
  }

  public removeRoom(roomId: string): void {
    const room = this.activeRooms.get(roomId);
    if (room && room.roomCode) {
      this.privateCodeToRoomId.delete(room.roomCode);
    }
    const pendingTimer = this.pendingRoomDeletions.get(roomId);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingRoomDeletions.delete(roomId);
    }
    this.activeRooms.delete(roomId);
  }

  public async finishGame(roomId: string, winnerId: number | null, reason: string): Promise<{ stats: any } | null> {
    const room = this.activeRooms.get(roomId);
    if (!room || room.status === 'FINISHED') return null;

    room.status = 'FINISHED';
    room.winnerId = winnerId;
    room.resultReason = reason;

    let postMatchStats: any = null;

    if (room.playerBlack) {
      try {
        const whiteUser = await prisma.user.findUnique({ where: { id: room.playerWhite.userId } });
        const blackUser = await prisma.user.findUnique({ where: { id: room.playerBlack.userId } });

        if (whiteUser && blackUser) {
          const calculated = calculatePostMatchStats({
            winnerId,
            isDraw: winnerId === null,
            totalMoves: room.moves.length,
            isPvP: true,
            playerWhite: {
              id: whiteUser.id,
              elo: whiteUser.elo,
              exp: whiteUser.exp,
              level: whiteUser.level,
              matchesPlayed: whiteUser.matches_played,
            },
            playerBlack: {
              id: blackUser.id,
              elo: blackUser.elo,
              exp: blackUser.exp,
              level: blackUser.level,
              matchesPlayed: blackUser.matches_played,
            },
          });

          const isWhiteWin = winnerId === whiteUser.id;
          const isBlackWin = winnerId === blackUser.id;
          const matchResultStr = isWhiteWin ? 'WHITE_WIN' : isBlackWin ? 'BLACK_WIN' : 'DRAW';

          await prisma.$transaction([
            prisma.match.create({
              data: {
                player_white_id: whiteUser.id,
                player_black_id: blackUser.id,
                pgn_moves: JSON.stringify(room.moves),
                result: matchResultStr,
              },
            }),
            prisma.user.update({
              where: { id: whiteUser.id },
              data: {
                elo: calculated.white.elo,
                exp: calculated.white.exp,
                level: calculated.white.level,
                matches_played: { increment: 1 },
                matches_won: isWhiteWin ? { increment: 1 } : undefined,
              },
            }),
            prisma.user.update({
              where: { id: blackUser.id },
              data: {
                elo: calculated.black.elo,
                exp: calculated.black.exp,
                level: calculated.black.level,
                matches_played: { increment: 1 },
                matches_won: isBlackWin ? { increment: 1 } : undefined,
              },
            }),
          ]);

          postMatchStats = {
            winnerId,
            reason,
            white: {
              userId: whiteUser.id,
              newElo: calculated.white.elo,
              eloDelta: calculated.white.eloDelta,
              newExp: Number(calculated.white.exp),
              expDelta: calculated.white.expDelta,
              newLevel: calculated.white.level,
            },
            black: {
              userId: blackUser.id,
              newElo: calculated.black.elo,
              eloDelta: calculated.black.eloDelta,
              newExp: Number(calculated.black.exp),
              expDelta: calculated.black.expDelta,
              newLevel: calculated.black.level,
            },
          };
        }
      } catch (err) {
        console.error('[MatchmakingManager] Lỗi khi lưu kết quả trận đấu:', err);
      }
    }

    this.removeRoom(roomId);
    return { stats: postMatchStats || { winnerId, reason } };
  }

  public tryReconnectWaitingRoom(userId: number, newSocketId: string): GameRoom | null {
    for (const [roomId, room] of this.activeRooms.entries()) {
      if (room.status === 'WAITING' && room.playerWhite.userId === userId) {
        const pendingTimer = this.pendingRoomDeletions.get(roomId);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          this.pendingRoomDeletions.delete(roomId);
        }
        room.playerWhite.socketId = newSocketId;
        return room;
      }
    }
    return null;
  }

  public handleSocketDisconnect(socketId: string, broadcastFn?: () => void): { updatedPublicList: boolean } {
    this.removeFromQueue(socketId);
    let updatedPublicList = false;

    this.activeRooms.forEach((room, roomId) => {
      if (room.playerWhite.socketId === socketId || room.playerBlack?.socketId === socketId) {
        if (room.status === 'WAITING') {
          if (!this.pendingRoomDeletions.has(roomId)) {
            const timer = setTimeout(() => {
              this.removeRoom(roomId);
              this.pendingRoomDeletions.delete(roomId);
              if (broadcastFn) broadcastFn();
            }, 20000);
            this.pendingRoomDeletions.set(roomId, timer);
          }
        }
      }
    });

    return { updatedPublicList };
  }
}

export const matchmakingManager = new MatchmakingManager();
export const matchmakingService = matchmakingManager;
