/**
 * Service tính toán Exp, Level và Elo theo SRS FR-03 & Kiếm Hiệp Kỳ Đạo Title System & ELO Rating Change System & EXP Level Progression System
 */

export interface PlayerStatsInput {
  id: number;
  elo: number;
  exp: bigint;
  level: number;
  matchesPlayed?: number;
}

export interface MatchResultData {
  winnerId?: number | null; // null if draw
  isDraw: boolean;
  playerWhite: PlayerStatsInput;
  playerBlack: PlayerStatsInput;
  totalMoves?: number;
  isPvP?: boolean;
}

export interface PlayerTitles {
  expTitle: string;
  eloTitle: string;
  fullTitle: string;
}

export interface PlayerEloData {
  currentElo: number;
  totalGames: number;
}

export type MatchOutcome = 'WIN_A' | 'WIN_B' | 'DRAW';

export interface EloChangeResult {
  isValid: boolean;
  deltaA: number;
  deltaB: number;
  newEloA: number;
  newEloB: number;
  reason?: string;
}

export interface CalculateMatchExpParams {
  mode: 'PVP' | 'PVE';
  result: 'WIN' | 'DRAW' | 'LOSS';
  totalMoves: number;
  aiDifficulty?: 'EASY' | 'NORMAL' | 'HARD';
  winStreak?: number;
  currentDailyPveExp?: number;
}

export interface CalculateMatchExpResult {
  baseExp: number;
  greatGameBonus: number;
  totalEarnedExp: number;
  newDailyPveExp: number;
  canWriteBlog: boolean;
  reason?: string;
}

export interface LevelUpResult {
  newLevel: number;
  newCurrentExp: number;
  leveledUp: boolean;
  levelsGained: number;
}

/**
 * 1. Bảng Xếp Hạng Thực Chiến (Elo Title)
 * Danh hiệu tính theo điểm Elo (phản ánh trình độ thực chiến qua ván đấu)
 */
export function getEloTitle(elo: number): string {
  if (elo < 1000) return 'Kỳ Đồng';
  if (elo <= 1199) return 'Kỳ Đồ';
  if (elo <= 1399) return 'Kỳ Hiệp';
  if (elo <= 1599) return 'Kỳ Tướng';
  if (elo <= 1799) return 'Kỳ Vương';
  if (elo <= 1999) return 'Kỳ Tông';
  if (elo <= 2199) return 'Kỳ Thánh';
  return 'Kỳ Thần';
}

/**
 * 2. Bảng Cảnh Giới Tu Vi / Kỳ Ý (EXP Level Title)
 * Danh hiệu tính theo cấp độ Level (phản ánh thâm niên, độ tích lũy)
 */
export function getExpTitle(level: number): string {
  const lvl = Math.max(1, Math.floor(level));
  if (lvl <= 15) return 'Khởi Khai';
  if (lvl <= 30) return 'Đắc Thức';
  if (lvl <= 50) return 'Tri Ý';
  if (lvl <= 70) return 'Thông Biến';
  if (lvl <= 85) return 'Thần Cơ';
  if (lvl <= 99) return 'Hóa Cảnh';
  return 'Quy Chân';
}

/**
 * Ghép cấu trúc danh hiệu: [Cảnh giới EXP] + [Danh hiệu Elo] -> "[expTitle] eloTitle"
 */
export function getPlayerTitles(level: number, elo: number): PlayerTitles {
  const expTitle = getExpTitle(level);
  const eloTitle = getEloTitle(elo);
  const fullTitle = `[${expTitle}] ${eloTitle}`;
  return { expTitle, eloTitle, fullTitle };
}

export function getRankTitle(elo: number, level: number = 1): string {
  return getPlayerTitles(level, elo).fullTitle;
}

/**
 * Công thức tính lượng EXP cần để thăng từ cấp currentLevel n lên cấp n + 1:
 * EXP_Required(n) = 100 + (n - 1) * 35
 */
export function getExpRequiredForNextLevel(currentLevel: number): number {
  const level = Math.max(1, Math.floor(currentLevel));
  if (level >= 100) return 0; // Max cap 100
  return 100 + (level - 1) * 35;
}

export function calculateExpForNextLevel(level: number): bigint {
  return BigInt(getExpRequiredForNextLevel(level));
}

/**
 * Hàm cộng EXP và xử lý thăng cấp (hỗ trợ nhảy nhiều cấp và chặn trần Lv 100)
 */
export function addExpAndCheckLevelUp(
  player: { level: number; currentExp: number },
  addedExp: number
): LevelUpResult {
  let level = Math.min(100, Math.max(1, Math.floor(player.level)));
  let exp = Math.max(0, Math.floor(player.currentExp)) + Math.max(0, Math.floor(addedExp));
  const startLevel = level;

  if (level >= 100) {
    return {
      newLevel: 100,
      newCurrentExp: 0,
      leveledUp: false,
      levelsGained: 0,
    };
  }

  while (level < 100) {
    const reqExp = getExpRequiredForNextLevel(level);
    if (exp >= reqExp) {
      exp -= reqExp;
      level++;
    } else {
      break;
    }
  }

  if (level >= 100) {
    level = 100;
    exp = 0;
  }

  return {
    newLevel: level,
    newCurrentExp: exp,
    leveledUp: level > startLevel,
    levelsGained: level - startLevel,
  };
}

export function calculateLevelFromExp(exp: bigint, currentLevel: number): number {
  let level = Math.max(1, currentLevel);
  let totalExp = Number(exp);
  let accumulatedReq = 0;
  while (level < 100) {
    const req = getExpRequiredForNextLevel(level);
    if (totalExp >= accumulatedReq + req) {
      accumulatedReq += req;
      level++;
    } else {
      break;
    }
  }
  return Math.min(100, level);
}

/**
 * Cơ chế tính nhận EXP sau ván đấu (Match Rewards & Anti-Abuse)
 */
export function calculateMatchExp(params: CalculateMatchExpParams): CalculateMatchExpResult {
  const {
    mode,
    result,
    totalMoves,
    aiDifficulty = 'NORMAL',
    winStreak = 0,
    currentDailyPveExp = 0,
  } = params;

  // 1. Chống cày ảo (Anti-abuse): Ván đấu phải từ 20 nước trở lên mới được tính nhận EXP
  if (totalMoves < 20) {
    return {
      baseExp: 0,
      greatGameBonus: 0,
      totalEarnedExp: 0,
      newDailyPveExp: currentDailyPveExp,
      canWriteBlog: false,
      reason: 'Ván đấu dưới 20 nước đi không được tính nhận EXP.',
    };
  }

  let baseExp = 0;
  let greatGameBonus = 0;
  let canWriteBlog = false;

  if (mode === 'PVP') {
    // PvP: Thắng +50, Hòa +30, Thua +20
    if (result === 'WIN') {
      baseExp = 50;
      if (winStreak >= 3) {
        baseExp += 20; // Thưởng chuỗi thắng >= 3 ván: +20 EXP
      }
    } else if (result === 'DRAW') {
      baseExp = 30;
    } else {
      baseExp = 20;
    }

    // PvP Ván hay: > 70 nước (Thắng +35 EXP, Thua/Hòa +15 EXP)
    if (totalMoves > 70) {
      canWriteBlog = true;
      greatGameBonus = result === 'WIN' ? 35 : 15;
    }
  } else {
    // PvE (Đánh máy) theo cấp độ AI:
    // Dễ (EASY): Thắng +20 | Hòa +10 | Thua +5
    // Trung bình (NORMAL): Thắng +40 | Hòa +20 | Thua +10
    // Khó (HARD): Thắng +60 | Hòa +30 | Thua +15
    if (aiDifficulty === 'EASY') {
      baseExp = result === 'WIN' ? 20 : result === 'DRAW' ? 10 : 5;
    } else if (aiDifficulty === 'HARD') {
      baseExp = result === 'WIN' ? 60 : result === 'DRAW' ? 30 : 15;
    } else {
      baseExp = result === 'WIN' ? 40 : result === 'DRAW' ? 20 : 10;
    }

    // PvE Ván hay: > 120 nước (Thắng máy +15 EXP, Thua/Hòa máy +5 EXP)
    if (totalMoves > 120) {
      canWriteBlog = true;
      greatGameBonus = result === 'WIN' ? 15 : 5;
    }
  }

  const rawTotalEarnedExp = baseExp + greatGameBonus;
  let totalEarnedExp = rawTotalEarnedExp;
  let newDailyPveExp = currentDailyPveExp;

  // Giới hạn ngày PvE Cap: Tối đa 300 EXP/ngày từ chế độ PvE
  if (mode === 'PVE') {
    const PVE_DAILY_CAP = 300;
    const remainingCap = Math.max(0, PVE_DAILY_CAP - currentDailyPveExp);
    totalEarnedExp = Math.min(rawTotalEarnedExp, remainingCap);
    newDailyPveExp = currentDailyPveExp + totalEarnedExp;
  }

  return {
    baseExp,
    greatGameBonus,
    totalEarnedExp,
    newDailyPveExp,
    canWriteBlog,
  };
}

/**
 * Kiểm tra giới hạn tạo bài viết Blog: Tối đa 5 bài viết / ngày / người chơi
 */
export function canCreateBlogToday(userDailyBlogCount: number): boolean {
  return userDailyBlogCount < 5;
}

/**
 * Thuật toán tính toán biến động điểm ELO (Rating Change System)
 */
export function calculateEloChange(
  playerA: PlayerEloData,
  playerB: PlayerEloData,
  result: MatchOutcome,
  totalMoves: number,
  isPvP: boolean = true
): EloChangeResult {
  // 1. Chế độ PvE (Đánh với máy): KHÔNG áp dụng tính Elo
  if (!isPvP) {
    return {
      isValid: false,
      deltaA: 0,
      deltaB: 0,
      newEloA: playerA.currentElo,
      newEloB: playerB.currentElo,
      reason: 'Chế độ chơi với máy (PvE) không áp dụng biến động điểm Elo.',
    };
  }

  // 2. Ván đấu hợp lệ: Chỉ tính Elo nếu ván đấu từ 20 nước đi trở lên (chống dàn xếp / buff bẩn)
  if (totalMoves < 20) {
    return {
      isValid: false,
      deltaA: 0,
      deltaB: 0,
      newEloA: playerA.currentElo,
      newEloB: playerB.currentElo,
      reason: 'Ván đấu chưa đủ 20 nước đi tối thiểu để xét biến động Elo.',
    };
  }

  // 3. Quy định hệ số K-factor độc lập cho từng người chơi:
  // - Tân thủ (tổng ván PvP < 30): K = 32
  // - Mức trung / sơ cấp (Elo < 1800 - Dưới Kỳ Tông): K = 20
  // - Mức cao thủ (Elo >= 1800 - Từ Kỳ Tông đến Kỳ Thần): K = 10
  const getKFactor = (player: PlayerEloData): number => {
    if (player.totalGames < 30) return 32;
    if (player.currentElo < 1800) return 20;
    return 10;
  };

  const kA = getKFactor(playerA);
  const kB = getKFactor(playerB);

  // 4. Xác suất kỳ vọng
  const expectedA = 1 / (1 + Math.pow(10, (playerB.currentElo - playerA.currentElo) / 400));
  const expectedB = 1 - expectedA;

  // 5. Điểm thực tế (S)
  let sA = 0.5;
  let sB = 0.5;
  if (result === 'WIN_A') {
    sA = 1.0;
    sB = 0.0;
  } else if (result === 'WIN_B') {
    sA = 0.0;
    sB = 1.0;
  }

  // 6. Tính delta làm tròn số nguyên Math.round
  const deltaARaw = Math.round(kA * (sA - expectedA));
  const deltaBRaw = Math.round(kB * (sB - expectedB));

  // 7. Chặn sàn Elo tối thiểu = 500
  const newEloA = Math.max(500, playerA.currentElo + deltaARaw);
  const newEloB = Math.max(500, playerB.currentElo + deltaBRaw);

  const deltaA = newEloA - playerA.currentElo;
  const deltaB = newEloB - playerB.currentElo;

  return {
    isValid: true,
    deltaA,
    deltaB,
    newEloA,
    newEloB,
  };
}

export function calculatePostMatchStats(data: MatchResultData) {
  const { winnerId, isDraw, playerWhite, playerBlack } = data;
  const totalMoves = data.totalMoves ?? 20;
  const isPvP = data.isPvP ?? true;

  const matchOutcome: MatchOutcome = isDraw
    ? 'DRAW'
    : winnerId === playerWhite.id
    ? 'WIN_A'
    : 'WIN_B';

  const eloResult = calculateEloChange(
    { currentElo: playerWhite.elo, totalGames: playerWhite.matchesPlayed ?? 0 },
    { currentElo: playerBlack.elo, totalGames: playerBlack.matchesPlayed ?? 0 },
    matchOutcome,
    totalMoves,
    isPvP
  );

  const newWhiteElo = eloResult.newEloA;
  const newBlackElo = eloResult.newEloB;
  const whiteEloDelta = eloResult.deltaA;
  const blackEloDelta = eloResult.deltaB;

  const whiteExpRes = calculateMatchExp({
    mode: isPvP ? 'PVP' : 'PVE',
    result: isDraw ? 'DRAW' : winnerId === playerWhite.id ? 'WIN' : 'LOSS',
    totalMoves,
  });

  const blackExpRes = calculateMatchExp({
    mode: isPvP ? 'PVP' : 'PVE',
    result: isDraw ? 'DRAW' : winnerId === playerBlack.id ? 'WIN' : 'LOSS',
    totalMoves,
  });

  const whiteExpDelta = BigInt(whiteExpRes.totalEarnedExp);
  const blackExpDelta = BigInt(blackExpRes.totalEarnedExp);

  const newWhiteExp = playerWhite.exp + whiteExpDelta;
  const newBlackExp = playerBlack.exp + blackExpDelta;

  const newWhiteLevel = calculateLevelFromExp(newWhiteExp, playerWhite.level);
  const newBlackLevel = calculateLevelFromExp(newBlackExp, playerBlack.level);

  const whiteTitles = getPlayerTitles(newWhiteLevel, newWhiteElo);
  const blackTitles = getPlayerTitles(newBlackLevel, newBlackElo);

  return {
    white: {
      elo: newWhiteElo,
      exp: newWhiteExp,
      level: newWhiteLevel,
      eloDelta: whiteEloDelta,
      expDelta: Number(whiteExpDelta),
      expTitle: whiteTitles.expTitle,
      eloTitle: whiteTitles.eloTitle,
      rankTitle: whiteTitles.fullTitle,
      canWriteBlog: whiteExpRes.canWriteBlog,
    },
    black: {
      elo: newBlackElo,
      exp: newBlackExp,
      level: newBlackLevel,
      eloDelta: blackEloDelta,
      expDelta: Number(blackExpDelta),
      expTitle: blackTitles.expTitle,
      eloTitle: blackTitles.eloTitle,
      rankTitle: blackTitles.fullTitle,
      canWriteBlog: blackExpRes.canWriteBlog,
    },
  };
}
