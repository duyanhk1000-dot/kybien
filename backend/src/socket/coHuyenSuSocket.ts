import { Server, Socket } from 'socket.io';
import { coHuyenSuService } from '../services/coHuyenSuService.js';

// ==========================================
// THIẾT KẾ MATCHMAKING & PHÒNG ĐẤU 8 NGƯỜI PVP
// ==========================================

export interface QueuedPlayer {
  socketId: string;
  userId: number;
  name: string;
  avatar: string;
  deck: Array<{ heroId: string; star: number }>;
  queuedAt: number;
}

export interface RoomPlayer {
  id: string; // socketId or 'bot-xxx'
  userId: number;
  name: string;
  avatar: string;
  hp: number; // Máu khởi đầu: 100
  alive: boolean;
  isBot: boolean;
  rankPlace?: number;
  deck: Array<{ heroId: string; star: number }>;
  reinforcementsDeployed: boolean;
}

export interface PvPRoom {
  id: string;
  players: RoomPlayer[];
  round: number;
  phase: 'prep' | 'battle';
  timer: number;
  timerInterval?: NodeJS.Timeout;
  createdAt: number;
}

const queue: QueuedPlayer[] = [];
const rooms = new Map<string, PvPRoom>();
const playerToRoom = new Map<string, string>(); // socketId -> roomId

const QUEUE_TIMEOUT_MS = 40000; // 40 giây timeout để tự thêm BOT
const BOT_NAMES = [
  'Đinh Tiên Hoàng', 'Trần Thủ Độ', 'Lê Thánh Tông', 'Lý Thái Tổ',
  'Phan Đình Phùng', 'Hoàng Diệu', 'Võ Nguyên Giáp', 'Nguyễn Tri Phương',
  'Nguyễn Chích', 'Lý Thường Kiệt', 'Bùi Thị Xuân', 'Trần Khánh Dư'
];
const BOT_AVATARS = ['🐲', '🦅', '🐅', '🐘', '🐎', '⚔️', '🏹', '🛡️'];

// ==========================================
// HÀM TẠO BOT TỰ ĐỘNG
// ==========================================
function generateBots(count: number): RoomPlayer[] {
  const bots: RoomPlayer[] = [];
  const shuffledNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
  for (let i = 0; i < count; i++) {
    const name = shuffledNames[i % shuffledNames.length];
    const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
    bots.push({
      id: `bot-${Date.now()}-${i}`,
      userId: -100 - i,
      name: `${name} (Bot)`,
      avatar,
      hp: 100,
      alive: true,
      isBot: true,
      deck: [
        { heroId: 'caolo', star: Math.random() > 0.5 ? 2 : 1 },
      ],
      reinforcementsDeployed: false,
    });
  }
  return bots;
}

// ==========================================
// KHỞI ĐỘNG PHÒNG ĐẤU 8 NGƯỜI CHƠI
// ==========================================
function createPvPRoom(io: Server, realPlayers: QueuedPlayer[], bots: RoomPlayer[]) {
  const roomId = `room-chs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const roomPlayers: RoomPlayer[] = [
    ...realPlayers.map(p => ({
      id: p.socketId,
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      hp: 100,
      alive: true,
      isBot: false,
      deck: p.deck,
      reinforcementsDeployed: false,
    })),
    ...bots,
  ];

  const room: PvPRoom = {
    id: roomId,
    players: roomPlayers,
    round: 1,
    phase: 'prep',
    timer: 35,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);

  // Gán room cho các real players và join socket room
  for (const p of realPlayers) {
    playerToRoom.set(p.socketId, roomId);
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) {
      sock.join(roomId);
    }
  }

  console.log(`[CHS PvP] Tạo phòng ${roomId} thành công với ${realPlayers.length} người thật và ${bots.length} Bot!`);

  // Báo cho client: Đã ghép trận thành công!
  io.to(roomId).emit('chs:match_found', {
    roomId,
    round: 1,
    players: room.players.map(pl => ({
      id: pl.id,
      userId: pl.userId,
      name: pl.name,
      avatar: pl.avatar,
      hp: pl.hp,
      alive: pl.alive,
      isBot: pl.isBot,
    })),
  });

  // Bắt đầu vòng chuẩn bị đầu tiên
  startRound(io, room);
}

// ==========================================
// VÒNG LẶP TRẬN ĐẤU (ROUND LOOP)
// ==========================================
function startRound(io: Server, room: PvPRoom) {
  room.phase = 'prep';
  room.timer = room.round === 1 ? 40 : 30;

  const isPve = room.round <= 3 || room.round === 8 || room.round === 15 || room.round === 22;

  // Nếu đến Vòng 4 (Bắt đầu PvP), kích hoạt sự kiện Viện Binh Hành Quân
  const isReinforcementsRound = room.round === 4;

  io.to(room.id).emit('chs:round_start', {
    round: room.round,
    phase: 'prep',
    timer: room.timer,
    isPve,
    isReinforcementsRound,
  });

  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    room.timer--;

    if (room.timer <= 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      startCombatPhase(io, room);
    } else {
      io.to(room.id).emit('chs:timer_tick', { timer: room.timer, phase: room.phase });
    }
  }, 1000);
}

function startCombatPhase(io: Server, room: PvPRoom) {
  room.phase = 'battle';
  room.timer = 30; // 30s giao tranh tối đa

  // Ghép cặp đối thủ cho các người chơi còn sống
  const alivePlayers = room.players.filter(p => p.alive);
  const shuffled = [...alivePlayers].sort(() => 0.5 - Math.random());
  const pairings: Array<{ player1: string; player2: string }> = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairings.push({ player1: shuffled[i].id, player2: shuffled[i + 1].id });
    } else {
      // Số người lẻ -> đấu với bóng (ghost) của người đầu tiên
      pairings.push({ player1: shuffled[i].id, player2: shuffled[0].id });
    }
  }

  io.to(room.id).emit('chs:combat_start', {
    round: room.round,
    phase: 'battle',
    pairings,
  });

  // Mô phỏng kết quả cho các Bot sau 15 giây giao tranh
  setTimeout(() => {
    for (const p of room.players) {
      if (p.isBot && p.alive) {
        // Bot mất ngẫu nhiên 0 đến 12 máu mỗi vòng
        const dmg = Math.floor(Math.random() * 12);
        p.hp = Math.max(0, p.hp - dmg);
        if (p.hp <= 0 && p.alive) {
          eliminatePlayer(io, room, p);
        }
      }
    }
    // Gửi cập nhật bảng điểm HP của toàn bộ 8 người
    io.to(room.id).emit('chs:players_sync', {
      players: room.players.map(pl => ({
        id: pl.id,
        name: pl.name,
        hp: pl.hp,
        alive: pl.alive,
        rankPlace: pl.rankPlace,
      })),
    });
  }, 15000);

  // Hết giờ giao tranh -> Chuyển sang vòng chuẩn bị tiếp theo
  setTimeout(() => {
    const remaining = room.players.filter(p => p.alive);
    if (remaining.length <= 1) {
      endMatch(io, room, remaining[0]);
    } else {
      room.round++;
      startRound(io, room);
    }
  }, 22000);
}

// ==========================================
// LOẠI NGƯỜI CHƠI & TRAO THƯỞNG
// ==========================================
async function eliminatePlayer(io: Server, room: PvPRoom, player: RoomPlayer) {
  if (!player.alive) return;
  player.alive = false;

  const aliveCount = room.players.filter(p => p.alive).length;
  player.rankPlace = aliveCount + 1; // Hạng 8, 7, ..., 2

  let rewardInfo = { rewardHb: 3, eloChange: -35 };
  if (!player.isBot) {
    try {
      rewardInfo = await coHuyenSuService.awardMatchRewards(player.userId, player.rankPlace);
    } catch (e) {
      console.error(`[CHS PvP] Lỗi trao thưởng cho user ${player.userId}:`, e);
    }

    const sock = io.sockets.sockets.get(player.id);
    if (sock) {
      sock.emit('chs:eliminated', {
        rankPlace: player.rankPlace,
        rewardHb: rewardInfo.rewardHb,
        eloChange: rewardInfo.eloChange,
      });
    }
  }

  console.log(`[CHS PvP] Người chơi ${player.name} bị loại ở Hạng ${player.rankPlace}! Nhận ${rewardInfo.rewardHb} HB.`);
}

async function endMatch(io: Server, room: PvPRoom, winner?: RoomPlayer) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  if (winner) {
    winner.rankPlace = 1;
    if (!winner.isBot) {
      try {
        const rew = await coHuyenSuService.awardMatchRewards(winner.userId, 1);
        const sock = io.sockets.sockets.get(winner.id);
        if (sock) {
          sock.emit('chs:match_victory', {
            rankPlace: 1,
            rewardHb: rew.rewardHb,
            eloChange: rew.eloChange,
          });
        }
      } catch (e) {
        console.error(`[CHS PvP] Lỗi trao giải quán quân:`, e);
      }
    }
  }

  io.to(room.id).emit('chs:match_ended', {
    winner: winner ? { name: winner.name, avatar: winner.avatar } : null,
    scoreboard: room.players.map(p => ({
      name: p.name,
      rankPlace: p.rankPlace || 1,
      isBot: p.isBot,
    })).sort((a, b) => a.rankPlace - b.rankPlace),
  });

  // Dọn dẹp phòng
  for (const p of room.players) {
    playerToRoom.delete(p.id);
  }
  rooms.delete(room.id);
  console.log(`[CHS PvP] Kết thúc trận đấu phòng ${room.id}!`);
}

// ==========================================
// SOCKET.IO EVENT HANDLERS
// ==========================================
export function setupCoHuyenSuSocket(io: Server): void {
  // Bộ đếm Matchmaking hàng giây
  setInterval(() => {
    if (queue.length === 0) return;

    const now = Date.now();
    // 1. Nếu đủ 8 người thật ➔ Ghép ngay
    if (queue.length >= 8) {
      const matchGroup = queue.splice(0, 8);
      createPvPRoom(io, matchGroup, []);
      return;
    }

    // 2. Nếu có người chờ quá 40s (QUEUE_TIMEOUT_MS) ➔ Thêm Bot
    const oldest = queue[0];
    if (now - oldest.queuedAt >= QUEUE_TIMEOUT_MS) {
      const matchGroup = queue.splice(0, Math.min(8, queue.length));
      const botsNeeded = 8 - matchGroup.length;
      const bots = generateBots(botsNeeded);
      createPvPRoom(io, matchGroup, bots);
    }
  }, 1000);

  io.on('connection', (socket: Socket) => {
    // 1. Vào hàng chờ ghép trận 8 người
    socket.on('chs:join_queue', async (data: { userId?: number; name?: string; avatar?: string; deck?: Array<{ heroId: string; star: number }> }) => {
      // Xóa khỏi queue cũ nếu có
      const existingIdx = queue.findIndex(q => q.socketId === socket.id);
      if (existingIdx >= 0) queue.splice(existingIdx, 1);

      const userId = data.userId || (socket.data.user?.id) || Math.floor(1000 + Math.random() * 9000);
      const name = data.name || (socket.data.user?.username) || `Kỳ Thủ #${userId}`;
      const avatar = data.avatar || '🐲';
      const deck = data.deck || [{ heroId: 'caolo', star: 1 }];

      const playerEntry: QueuedPlayer = {
        socketId: socket.id,
        userId,
        name,
        avatar,
        deck,
        queuedAt: Date.now(),
      };

      queue.push(playerEntry);
      socket.emit('chs:queue_joined', {
        queuedAt: playerEntry.queuedAt,
        timeoutSeconds: 40,
        currentInQueue: queue.length,
      });

      console.log(`[CHS PvP] Người chơi ${name} (Socket ${socket.id}) vào hàng chờ. Tổng: ${queue.length}/8.`);
    });

    // 2. Hủy tìm trận
    socket.on('chs:cancel_queue', () => {
      const idx = queue.findIndex(q => q.socketId === socket.id);
      if (idx >= 0) {
        queue.splice(idx, 1);
        socket.emit('chs:queue_cancelled');
        console.log(`[CHS PvP] Socket ${socket.id} đã hủy tìm trận.`);
      }
    });

    // 3. Người chơi bấm nút "ĐIỀU TƯỚNG" (Reinforcements) tại Vòng 4+
    socket.on('chs:deploy_reinforcements', () => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;

      if (room.round < 4) {
        socket.emit('chs:toast', { message: 'Viện binh đang hành quân! Tối thiểu Vòng 4 mới đến nơi.' });
        return;
      }

      if (player.reinforcementsDeployed) {
        socket.emit('chs:toast', { message: 'Bạn đã điều viện binh trong trận này rồi!' });
        return;
      }

      player.reinforcementsDeployed = true;

      // Trả danh sách thẻ tướng mang theo về cho client để xếp vào hàng chờ
      socket.emit('chs:reinforcements_deployed', {
        cards: player.deck,
      });

      // Thông báo cho toàn phòng biết người này đã điều quân
      io.to(room.id).emit('chs:room_event', {
        message: `${player.name} đã triệu hồi Viện Binh xuất trận!`,
      });
    });

    // 4. Client báo cáo kết quả sát thương sau mỗi trận giao tranh
    socket.on('chs:report_round_result', (data: { damageTaken: number }) => {
      const roomId = playerToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || !player.alive) return;

      const dmg = Math.max(0, data.damageTaken || 0);
      player.hp = Math.max(0, player.hp - dmg);

      if (player.hp <= 0) {
        eliminatePlayer(io, room, player);
      }

      // Sync lại danh sách HP cho các người chơi trong phòng
      io.to(room.id).emit('chs:players_sync', {
        players: room.players.map(pl => ({
          id: pl.id,
          name: pl.name,
          hp: pl.hp,
          alive: pl.alive,
          rankPlace: pl.rankPlace,
        })),
      });
    });

    // 5. Ngắt kết nối
    socket.on('disconnect', () => {
      const qIdx = queue.findIndex(q => q.socketId === socket.id);
      if (qIdx >= 0) queue.splice(qIdx, 1);

      const roomId = playerToRoom.get(socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const player = room.players.find(p => p.id === socket.id);
          if (player && player.alive) {
            // Xem như người chơi bỏ trận, trừ hết máu
            player.hp = 0;
            eliminatePlayer(io, room, player);
          }
        }
        playerToRoom.delete(socket.id);
      }
    });
  });
}
