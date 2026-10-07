import { Server, Socket } from 'socket.io';

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
      // CỜ ÚP GIÁN ĐIỆP: Trộn lẫn 15 quân Đỏ và 15 quân Đen vào cùng 1 pool ngẫu nhiên
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
      // CỜ ÚP TRUYỀN THỐNG
      return {
        red: shuffle(piecesList.slice().map(t => ({ t, col: 'r' }))),
        black: shuffle(piecesList.slice().map(t => ({ t, col: 'b' }))),
      };
    }
  }

  public addToQueue(player: PlayerInQueue): { matched: boolean; room?: GameRoom } {
    this.queue = this.queue.filter((p) => p.socketId !== player.socketId);

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
        roomCode: `MATCH-${Math.floor(1000 + Math.random() * 9000)}`,
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

  public joinRoomByCode(roomCode: string, player: PlayerInQueue): { success: boolean; room?: GameRoom; error?: string } {
    const roomId = this.privateCodeToRoomId.get(roomCode);
    if (!roomId) {
      return { success: false, error: 'Mã phòng không tồn tại hoặc đã hết hạn.' };
    }

    const room = this.activeRooms.get(roomId);
    if (!room) {
      return { success: false, error: 'Phòng không còn hoạt động.' };
    }

    if (room.status !== 'WAITING') {
      return { success: false, error: 'Phòng đã đầy hoặc đang diễn ra trận đấu.' };
    }

    if (room.playerWhite.socketId === player.socketId) {
      return { success: false, error: 'Bạn đã ở trong phòng này rồi.' };
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

  public removeFromQueue(socketId: string): void {
    this.queue = this.queue.filter((p) => p.socketId !== socketId);
  }

  public getRoom(roomId: string): GameRoom | undefined {
    return this.activeRooms.get(roomId);
  }

  public removeRoom(roomId: string): void {
    const room = this.activeRooms.get(roomId);
    if (room && room.roomCode) {
      this.privateCodeToRoomId.delete(room.roomCode);
    }
    this.activeRooms.delete(roomId);
  }
}

export const matchmakingService = new MatchmakingManager();
