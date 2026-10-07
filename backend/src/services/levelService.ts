/**
 * Service tính toán Exp, Level và Elo theo SRS FR-03
 */

export interface MatchResultData {
  winnerId?: number | null; // null if draw
  isDraw: boolean;
  playerWhite: { id: number; elo: number; exp: bigint; level: number };
  playerBlack: { id: number; elo: number; exp: bigint; level: number };
}

export function calculateExpForNextLevel(level: number): bigint {
  // Exp cần lên cấp = 100 * (Level)^1.5
  return BigInt(Math.floor(100 * Math.pow(level, 1.5)));
}

export function calculateLevelFromExp(exp: bigint, currentLevel: number): number {
  let level = currentLevel;
  while (true) {
    const requiredExp = calculateExpForNextLevel(level);
    if (exp >= requiredExp) {
      level++;
    } else {
      break;
    }
  }
  return level;
}

export function calculatePostMatchStats(data: MatchResultData) {
  const { winnerId, isDraw, playerWhite, playerBlack } = data;

  let whiteEloDelta = 0;
  let whiteExpDelta = 0n;
  let blackEloDelta = 0;
  let blackExpDelta = 0n;

  if (isDraw) {
    whiteExpDelta = 25n;
    blackExpDelta = 25n;
    if (playerWhite.elo >= playerBlack.elo) {
      whiteEloDelta = -1;
      blackEloDelta = 1;
    } else {
      whiteEloDelta = 1;
      blackEloDelta = -1;
    }
  } else if (winnerId === playerWhite.id) {
    // White wins
    whiteExpDelta = 50n;
    whiteEloDelta = 15;
    blackExpDelta = 10n;
    blackEloDelta = -12;
  } else {
    // Black wins
    blackExpDelta = 50n;
    blackEloDelta = 15;
    whiteExpDelta = 10n;
    whiteEloDelta = -12;
  }

  const newWhiteExp = playerWhite.exp + whiteExpDelta;
  const newBlackExp = playerBlack.exp + blackExpDelta;

  const newWhiteElo = Math.max(100, playerWhite.elo + whiteEloDelta);
  const newBlackElo = Math.max(100, playerBlack.elo + blackEloDelta);

  const newWhiteLevel = calculateLevelFromExp(newWhiteExp, playerWhite.level);
  const newBlackLevel = calculateLevelFromExp(newBlackExp, playerBlack.level);

  return {
    white: {
      elo: newWhiteElo,
      exp: newWhiteExp,
      level: newWhiteLevel,
      eloDelta: whiteEloDelta,
      expDelta: Number(whiteExpDelta),
    },
    black: {
      elo: newBlackElo,
      exp: newBlackExp,
      level: newBlackLevel,
      eloDelta: blackEloDelta,
      expDelta: Number(blackExpDelta),
    },
  };
}
