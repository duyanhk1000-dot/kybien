// @ts-nocheck
import { Server, Socket } from 'socket.io';
import { coHuyenSuService } from '../services/coHuyenSuService.js';
import {
  newGame, newPlayer, startRound, makeMatches, simMatch, applyRound,
  buyUnit, sellUnit, moveUnit, buyXp, reroll, incomeOf,
  traitCounts, tierOf, activeBonds, boardList, boardCount, poolCount,
  HERO, TR, CS, BONDS, XPN, botPrep, mkUnitObj, addUnit, poolTake
} from '../engine/coHuyenSuEngine.js';

// ========================================================
// SERVER-AUTHORITATIVE PVP ROOM & MATCHMAKING MANAGER
// ========================================================

export interface QueuedPlayer {
  socketId: string;
  userId: number;
  name: string;
  avatar: string;
  deck: Array<{ heroId: string; star: number }>;
  queuedAt: number;
}

export interface PvPRoom {
  id: string;
  G: any; // Game state instance from coHuyenSuEngine
  realPlayerSockets: Map<string, any>; // socketId -> PlayerState in G
  socketToPlayerIndex: Map<string, number>;
  round: number;
  phase: 'prep' | 'battle';
  timer: number;
  timerInterval?: NodeJS.Timeout;
  createdAt: number;
}

const queue: QueuedPlayer[] = [];
const rooms = new Map<string, PvPRoom>();
const socketToRoomId = new Map<string, string>();

const QUEUE_TIMEOUT_MS = 40000; // 40 giây timeout để tự động thêm Bot

const BOT_NAMES = [
  'Đinh Tiên Hoàng', 'Trần Thủ Độ', 'Lê Thánh Tông', 'Lý Thái Tổ',
  'Hoàng Diệu', 'Nguyễn Tri Phương', 'Lý Thường Kiệt', 'Bùi Thị Xuân',
  'Nguyễn Chích', 'Phan Đình Phùng', 'Trần Khánh Dư', 'Võ Nguyên Giáp'
];
const BOT_AVATARS = ['🐲', '🦅', '🐅', '🐘', '🐎', '⚔️', '🏹', '🛡️'];

// ==========================================
// BẢO VỆ CHỐNG GIAN LẬN: VALIDATE QUÂN LƯƠNG
// ==========================================
function validateAndSanitizeDeck(rawDeck: any): Array<{ heroId: string; star: number }> {
  if (!Array.isArray(rawDeck)) return [{ heroId: 'caolo', star: 1 }];

  const sanitized: Array<{ heroId: string; star: number }> = [];
  let totalPts = 0;
  const ptsMap: Record<number, number> = { 1: 3, 2: 5, 3: 7 };

  for (const item of rawDeck) {
    if (!item || typeof item.heroId !== 'string' || !HERO[item.heroId]) continue;
    const star = Math.min(3, Math.max(1, Math.floor(Number(item.star) || 1)));
    const cost = ptsMap[star] || 3;

    if (totalPts + cost <= 10) {
      totalPts += cost;
      sanitized.push({ heroId: item.heroId, star });
    }
  }

  return sanitized.length > 0 ? sanitized : [{ heroId: 'caolo', star: 1 }];
}

function sanitizeString(str: any, maxLen: number, fallback: string): string {
  if (typeof str !== 'string') return fallback;
  const clean = str.replace(/[<>\\"'`]/g, '').trim();
  return clean.slice(0, maxLen) || fallback;
}

// ==========================================
// TẠO PHÒNG ĐẤU 8 NGƯỜI CHƠI (SERVER-AUTHORITATIVE)
// ==========================================
function createPvPRoom(io: Server, realPlayers: QueuedPlayer[], botsNeeded: number) {
  const roomId = `room-chs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. Khởi tạo đối tượng Game Authoritative
  const G = newGame({ diff: 1 });
  G.players = []; // Reset players để nạp đúng 8 slot

  const realPlayerSockets = new Map<string, any>();
  const socketToPlayerIndex = new Map<string, number>();

  let playerIdx = 0;

  // 2. Nạp người chơi thật vào G
  for (const qp of realPlayers) {
    const p = newPlayer(qp.name, true, playerIdx, qp.avatar);
    p.socketId = qp.socketId;
    p.userId = qp.userId;
    p.deck = qp.deck || [{ heroId: 'caolo', star: 1 }];
    p.reinforcementsDeployed = false;
    p.isBot = false;

    G.players.push(p);
    realPlayerSockets.set(qp.socketId, p);
    socketToPlayerIndex.set(qp.socketId, playerIdx);
    socketToRoomId.set(qp.socketId, roomId);

    const sock = io.sockets.sockets.get(qp.socketId);
    if (sock) sock.join(roomId);

    playerIdx++;
  }

  // 3. Nạp Bot vào các slot còn lại cho đủ 8 người
  const shuffledBotNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
  for (let b = 0; b < botsNeeded; b++) {
    const botName = `${shuffledBotNames[b % shuffledBotNames.length]} (Bot)`;
    const botAv = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)];
    const bp = newPlayer(botName, false, playerIdx, botAv);
    bp.isBot = true;
    bp.deck = [{ heroId: 'caolo', star: Math.random() > 0.5 ? 2 : 1 }];
    bp.reinforcementsDeployed = false;

    G.players.push(bp);
    playerIdx++;
  }

  // Khởi tạo tướng khởi đầu ngẫu nhiên cho tất cả các slot trong G
  for (const p of G.players) {
    p.board.fill(null);
    p.bench.fill(null);
    const h1Pool = ['caolo', 'chudongtu', 'maithucloan', 'yetkieu', 'lelai', 'nguyenxi'];
    const h1 = h1Pool[Math.floor(Math.random() * h1Pool.length)];
    if (addUnit(p, mkUnitObj(h1, 1))) {
      poolTake(G, h1);
    }
  }

  const room: PvPRoom = {
    id: roomId,
    G,
    realPlayerSockets,
    socketToPlayerIndex,
    round: 1,
    phase: 'prep',
    timer: 35,
    createdAt: Date.now(),
  };

  rooms.set(roomId, room);
  console.log(`[CHS Server-Auth] Tạo phòng ${roomId} thành công với ${realPlayers.length} người thật và ${botsNeeded} Bot!`);

  // Báo cho client: Đã ghép trận thành công!
  io.to(roomId).emit('chs:match_found', {
    roomId,
    round: 1,
    players: G.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      avatar: p.av,
      hp: p.hp,
      alive: p.alive,
      isBot: !!p.isBot,
    })),
  });

  // Bắt đầu vòng 1 (Server chạy startRound)
  startServerRound(io, room);
}

// ==========================================
// VÒNG CHUẨN BỊ TRÊN SERVER (AUTHORITATIVE)
// ==========================================
function startServerRound(io: Server, room: PvPRoom) {
  const G = room.G;
  room.phase = 'prep';
  room.timer = room.round === 1 ? 38 : 30;

  // Server chạy startRound: cấp vàng, kinh nghiệm, roll shop cho từng người
  startRound(G);
  room.round = G.round;

  const isPve = room.round <= 3 || room.round === 8 || room.round === 15 || room.round === 22;
  const isReinforcementsRound = room.round === 4;

  // Gửi thông báo bắt đầu vòng
  io.to(room.id).emit('chs:round_start', {
    round: room.round,
    phase: 'prep',
    timer: room.timer,
    isPve,
    isReinforcementsRound,
  });

  // Gửi dữ liệu đồng bộ riêng cho từng người chơi thật
  for (const [sockId, player] of room.realPlayerSockets.entries()) {
    const sock = io.sockets.sockets.get(sockId);
    if (sock) {
      sendAuthoritativePlayerSync(sock, G, player);
    }
  }

  // Đồng bộ danh sách 8 người chơi (HP, Level, Streaks)
  broadcastPlayersSummary(io, room);

  // Bộ đếm thời gian chuẩn bị
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = setInterval(() => {
    room.timer--;

    if (room.timer <= 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      startServerCombatPhase(io, room);
    } else {
      io.to(room.id).emit('chs:timer_tick', { timer: room.timer, phase: room.phase });
    }
  }, 1000);
}

// ==========================================
// GIAO TRANH MÔ PHỎNG TRÊN SERVER (ANTI-CHEAT COMBAT)
// ==========================================
function startServerCombatPhase(io: Server, room: PvPRoom) {
  const G = room.G;
  room.phase = 'battle';
  room.timer = 25; // Thời gian phát lại giao tranh

  // 1. Tự động điều viện binh cho các người chơi quên bấm ở vòng 4+
  if (room.round >= 4) {
    for (const p of G.players) {
      if (p.deck && !p.reinforcementsDeployed) {
        deployPlayerReinforcements(G, p);
      }
    }
  }

  // 2. Chạy botPrep cho toàn bộ các Bot còn sống
  for (const p of G.players) {
    if (p.isBot && p.alive) {
      botPrep(G, p);
    }
  }

  // 3. Ghép cặp giao tranh (Matches)
  G.matches = makeMatches(G);

  // 4. Server chạy mô phỏng giao tranh (simMatch) cho từng cặp đấu
  const matchResults: Map<any, any> = new Map();
  for (const m of G.matches) {
    simMatch(G, m, true);
    matchResults.set(m.a, m);
    if (m.b) matchResults.set(m.b, m);
  }

  // 5. Gửi sự kiện chiến đấu và chuỗi animation (B.ev) tới từng người chơi
  for (const [sockId, player] of room.realPlayerSockets.entries()) {
    const sock = io.sockets.sockets.get(sockId);
    if (!sock) continue;

    const m = matchResults.get(player);
    if (!m) continue;

    const isSideA = m.a === player;
    const opponent = isSideA ? m.b : m.a;
    const res = m.res || {};
    const won = isSideA ? res.win0 : !res.win0;

    sock.emit('chs:combat_start', {
      round: room.round,
      isPve: !!m.pve,
      opponent: opponent ? {
        id: opponent.id,
        name: opponent.name,
        avatar: opponent.av,
        board: opponent.board,
      } : null,
      events: (res.B && res.B.ev) ? res.B.ev : [],
      won,
      surviving: res.surv || 0,
    });
  }

  // 6. Sau khi phát lại giao tranh xong (18 giây), Server áp dụng kết quả
  setTimeout(() => {
    applyRound(G);

    // Kiểm tra những người chơi bị loại
    for (const p of G.players) {
      if (!p.alive && p.place && !p.rewardGiven) {
        p.rewardGiven = true;
        handlePlayerElimination(io, room, p);
      }
    }

    // Đồng bộ lại HP & trạng thái sống còn của 8 người
    broadcastPlayersSummary(io, room);

    // Kiểm tra điều kiện kết thúc trận đấu
    const alivePlayers = G.players.filter((p: any) => p.alive);
    if (alivePlayers.length <= 1 || G.over) {
      const winner = alivePlayers[0] || G.winner;
      handleMatchEnded(io, room, winner);
    } else {
      startServerRound(io, room);
    }
  }, 18000);
}

// ==========================================
// ĐỒNG BỘ DỮ LIỆU AUTHORITATIVE CHO TỪNG CLIENT
// ==========================================
function sendAuthoritativePlayerSync(socket: Socket, G: any, player: any) {
  const activeHeroes = player.board.filter(Boolean);
  socket.emit('chs:sync_player_state', {
    gold: player.gold,
    lvl: player.lvl,
    xp: player.xp,
    hp: player.hp,
    streak: player.streak,
    lastWin: player.lastWin,
    board: player.board,
    bench: player.bench,
    shop: player.shop,
    synergies: traitCounts(activeHeroes),
    bonds: activeBonds(activeHeroes),
    boardCount: activeHeroes.length,
    maxBoardUnits: player.lvl,
    income: incomeOf(player, G.round),
    round: G.round,
  });
}

function broadcastPlayersSummary(io: Server, room: PvPRoom) {
  io.to(room.id).emit('chs:players_sync', {
    players: room.G.players.map((p: any) => ({
      id: p.id,
      name: p.name,
      avatar: p.av,
      hp: p.hp,
      alive: p.alive,
      lvl: p.lvl,
      streak: p.streak,
      rankPlace: p.place,
    })),
  });
}

// ==========================================
// ĐIỀU VIỆN BINH QUÂN LƯƠNG TRÊN SERVER
// ==========================================
function deployPlayerReinforcements(G: any, player: any): boolean {
  if (player.reinforcementsDeployed) return false;
  player.reinforcementsDeployed = true;

  const deck = player.deck || [];
  let placed = false;

  for (const card of deck) {
    const emptyBenchIdx = player.bench.findIndex((x: any) => x === null);
    if (emptyBenchIdx >= 0) {
      player.bench[emptyBenchIdx] = mkUnitObj(card.heroId, card.star);
      placed = true;
    }
  }

  return placed;
}

// ==========================================
// XỬ LÝ LOẠI NGƯỜI CHƠI & TRAO THƯỞNG
// ==========================================
async function handlePlayerElimination(io: Server, room: PvPRoom, player: any) {
  const place = player.place || 8;
  let rewardInfo = { rewardHb: 3, eloChange: -35 };

  if (!player.isBot && player.userId) {
    try {
      rewardInfo = await coHuyenSuService.awardMatchRewards(player.userId, place);
    } catch (e) {
      console.error(`[CHS Server] Lỗi trao thưởng cho user ${player.userId}:`, e);
    }

    const sock = io.sockets.sockets.get(player.socketId);
    if (sock) {
      sock.emit('chs:eliminated', {
        rankPlace: place,
        rewardHb: rewardInfo.rewardHb,
        rewardDv: (rewardInfo as any).rewardDv || rewardInfo.rewardHb,
        eloChange: rewardInfo.eloChange,
      });
    }
  }

  console.log(`[CHS Server] Người chơi ${player.name} bị loại ở Hạng ${place}! Thưởng: ${rewardInfo.rewardHb} HB.`);
}

async function handleMatchEnded(io: Server, room: PvPRoom, winner?: any) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  if (winner) {
    winner.place = 1;
    if (!winner.isBot && winner.userId) {
      try {
        const rew = await coHuyenSuService.awardMatchRewards(winner.userId, 1);
        const sock = io.sockets.sockets.get(winner.socketId);
        if (sock) {
          sock.emit('chs:match_victory', {
            rankPlace: 1,
            rewardHb: rew.rewardHb,
            rewardDv: (rew as any).rewardDv || rew.rewardHb,
            eloChange: rew.eloChange,
          });
        }
      } catch (e) {
        console.error(`[CHS Server] Lỗi trao thưởng quán quân:`, e);
      }
    }
  }

  io.to(room.id).emit('chs:match_ended', {
    winner: winner ? { name: winner.name, avatar: winner.av } : null,
    scoreboard: room.G.players.map((p: any) => ({
      name: p.name,
      rankPlace: p.place || 1,
      isBot: !!p.isBot,
    })).sort((a: any, b: any) => a.rankPlace - b.rankPlace),
  });

  for (const [sockId] of room.realPlayerSockets.entries()) {
    socketToRoomId.delete(sockId);
  }
  rooms.delete(room.id);
  console.log(`[CHS Server] Kết thúc phòng ${room.id}!`);
}

// ==========================================
// KHỞI ĐỘNG CÁC SỰ KIỆN SOCKET
// ==========================================
export function setupCoHuyenSuSocket(io: Server): void {
  // Bộ đếm Matchmaking hàng giây
  setInterval(() => {
    if (queue.length === 0) return;

    const now = Date.now();
    // 1. Nếu đủ 8 người thật ➔ Ghép ngay
    if (queue.length >= 8) {
      const matchGroup = queue.splice(0, 8);
      createPvPRoom(io, matchGroup, 0);
      return;
    }

    // 2. Nếu có người chờ quá 40s (QUEUE_TIMEOUT_MS) ➔ Tự động bù Bot
    const oldest = queue[0];
    if (now - oldest.queuedAt >= QUEUE_TIMEOUT_MS) {
      const matchGroup = queue.splice(0, Math.min(8, queue.length));
      const botsNeeded = 8 - matchGroup.length;
      createPvPRoom(io, matchGroup, botsNeeded);
    }
  }, 1000);

  io.on('connection', (socket: Socket) => {
    // 1. Vào hàng chờ PvP
    socket.on('chs:join_queue', (data: any) => {
      try {
        const existingIdx = queue.findIndex(q => q.socketId === socket.id);
        if (existingIdx >= 0) queue.splice(existingIdx, 1);

        const userId = Number(data?.userId) || (socket.data?.user?.id) || Math.floor(1000 + Math.random() * 9000);
        const name = sanitizeString(data?.name || socket.data?.user?.username, 20, `Kỳ Thủ #${userId}`);
        const avatar = sanitizeString(data?.avatar, 4, '🐲');

        // CHỐNG HACK: Xác thực Quân Lương tối đa 10 điểm
        const deck = validateAndSanitizeDeck(data?.deck);

        queue.push({
          socketId: socket.id,
          userId,
          name,
          avatar,
          deck,
          queuedAt: Date.now(),
        });

        socket.emit('chs:queue_joined', {
          timeoutSeconds: 40,
          currentInQueue: queue.length,
        });

        console.log(`[CHS Queue] ${name} vào hàng chờ. Deck: ${deck.length} tướng. Tổng: ${queue.length}/8.`);
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:join_queue:', err);
      }
    });

    // 2. Hủy tìm trận
    socket.on('chs:cancel_queue', () => {
      const idx = queue.findIndex(q => q.socketId === socket.id);
      if (idx >= 0) {
        queue.splice(idx, 1);
        socket.emit('chs:queue_cancelled');
      }
    });

    // 3. Mua tướng từ cửa hàng (SERVER THỰC THI & CHỐNG HACK TIỀN / OVERFLOW)
    socket.on('chs:buy_unit', (data: any) => {
      try {
        if (!data || typeof data.slotIndex !== 'number' || data.slotIndex < 0 || data.slotIndex >= 5) {
          return socket.emit('chs:toast', { message: 'Yêu cầu không hợp lệ!' });
        }

        const roomId = socketToRoomId.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'prep') return;

        const player = room.realPlayerSockets.get(socket.id);
        if (!player || !player.alive) return;

        const success = buyUnit(room.G, player, data.slotIndex);
        if (success) {
          sendAuthoritativePlayerSync(socket, room.G, player);
        } else {
          socket.emit('chs:toast', { message: 'Không đủ vàng hoặc hàng chờ đã đầy!' });
        }
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:buy_unit:', err);
      }
    });

    // 4. Bán tướng (SERVER TÍNH TIỀN & TRẢ VÀO KHO POOL)
    socket.on('chs:sell_unit', (data: any) => {
      try {
        if (!data || (data.kind !== 'board' && data.kind !== 'bench')) return;
        const maxIdx = data.kind === 'board' ? 32 : 8;
        if (typeof data.index !== 'number' || data.index < 0 || data.index >= maxIdx) return;

        const roomId = socketToRoomId.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'prep') return;

        const player = room.realPlayerSockets.get(socket.id);
        if (!player || !player.alive) return;

        const earnedGold = sellUnit(room.G, player, data.kind, data.index);
        if (earnedGold > 0) {
          sendAuthoritativePlayerSync(socket, room.G, player);
        }
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:sell_unit:', err);
      }
    });

    // 5. Di chuyển / xếp cờ (SERVER KIỂM TRA SỐ LƯỢNG TƯỚNG TỐI ĐA = LEVEL)
    socket.on('chs:move_unit', (data: any) => {
      try {
        if (!data || !data.from || !data.to) return;
        if (data.from.kind !== 'board' && data.from.kind !== 'bench') return;
        if (data.to.kind !== 'board' && data.to.kind !== 'bench') return;

        const maxFrom = data.from.kind === 'board' ? 32 : 8;
        const maxTo = data.to.kind === 'board' ? 32 : 8;
        if (typeof data.from.index !== 'number' || typeof data.to.index !== 'number') return;
        if (data.from.index < 0 || data.from.index >= maxFrom || data.to.index < 0 || data.to.index >= maxTo) return;

        const roomId = socketToRoomId.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'prep') return;

        const player = room.realPlayerSockets.get(socket.id);
        if (!player || !player.alive) return;

        // Nếu kéo từ bench lên board: kiểm tra giới hạn cấp độ
        if (data.from.kind === 'bench' && data.to.kind === 'board') {
          const destUnit = player.board[data.to.index];
          const currentBoardUnits = boardCount(player);
          if (!destUnit && currentBoardUnits >= player.lvl) {
            socket.emit('chs:toast', { message: `Cấp độ ${player.lvl} chỉ được đặt tối đa ${player.lvl} tướng trên bàn!` });
            sendAuthoritativePlayerSync(socket, room.G, player);
            return;
          }
        }

        moveUnit(player, data.from, data.to);
        sendAuthoritativePlayerSync(socket, room.G, player);
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:move_unit:', err);
      }
    });

    // 6. Mua kinh nghiệm (SERVER TRỪ 4 VÀNG & CỘNG 4 XP)
    socket.on('chs:buy_xp', () => {
      try {
        const roomId = socketToRoomId.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'prep') return;

        const player = room.realPlayerSockets.get(socket.id);
        if (!player || !player.alive) return;

        const success = buyXp(player);
        if (success) {
          sendAuthoritativePlayerSync(socket, room.G, player);
        } else {
          socket.emit('chs:toast', { message: 'Không đủ 4 vàng hoặc đã đạt cấp tối đa!' });
        }
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:buy_xp:', err);
      }
    });

    // 7. Làm mới cửa hàng (SERVER TRỪ 2 VÀNG & ROLL THEO TỈ LỆ LEVEL CỦA SERVER)
    socket.on('chs:reroll_shop', () => {
      try {
        const roomId = socketToRoomId.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room || room.phase !== 'prep') return;

        const player = room.realPlayerSockets.get(socket.id);
        if (!player || !player.alive) return;

        const success = reroll(room.G, player);
        if (success) {
          sendAuthoritativePlayerSync(socket, room.G, player);
        } else {
          socket.emit('chs:toast', { message: 'Không đủ 2 vàng để làm mới cửa hàng!' });
        }
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:reroll_shop:', err);
      }
    });

    // 8. Điều tướng Viện Binh tại Vòng 4+
    socket.on('chs:deploy_reinforcements', () => {
      try {
        const roomId = socketToRoomId.get(socket.id);
        if (!roomId) return;
        const room = rooms.get(roomId);
        if (!room) return;

        const player = room.realPlayerSockets.get(socket.id);
        if (!player || !player.alive) return;

        if (room.round < 4) {
          socket.emit('chs:toast', { message: 'Viện binh đang hành quân! Tối thiểu Vòng 4 mới đến nơi.' });
          return;
        }

        if (player.reinforcementsDeployed) {
          socket.emit('chs:toast', { message: 'Bạn đã điều viện binh trong trận này rồi!' });
          return;
        }

        deployPlayerReinforcements(room.G, player);
        sendAuthoritativePlayerSync(socket, room.G, player);

        io.to(room.id).emit('chs:room_event', {
          message: `${player.name} đã triệu hồi Viện Binh xuất trận!`,
        });
      } catch (err) {
        console.error('[CHS Socket] Lỗi chs:deploy_reinforcements:', err);
      }
    });

    // 9. Ngắt kết nối
    socket.on('disconnect', () => {
      try {
        const qIdx = queue.findIndex(q => q.socketId === socket.id);
        if (qIdx >= 0) queue.splice(qIdx, 1);

        const roomId = socketToRoomId.get(socket.id);
        if (roomId) {
          const room = rooms.get(roomId);
          if (room) {
            const player = room.realPlayerSockets.get(socket.id);
            if (player && player.alive) {
              player.hp = 0;
              player.alive = false;
            }
          }
          socketToRoomId.delete(socket.id);
        }
      } catch (err) {
        console.error('[CHS Socket] Lỗi disconnect:', err);
      }
    });
  });
}
