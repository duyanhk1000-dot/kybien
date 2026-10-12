import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { analyzeMatchWithGemini } from '../services/aiService.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';
import { matchmakingManager } from '../services/matchmakingService.js';
import { prisma } from '../utils/prisma.js';
import { calculateMatchExp, calculateLevelFromExp, getPlayerTitles } from '../services/levelService.js';

// In-memory rate limiting and deduplication storage
const userPostTimestamps: Map<number, number[]> = new Map();
const postedMatchHashes: Set<string> = new Set();

export async function createGreatMatchPost(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Yêu cầu xác thực tài khoản.' });
      return;
    }

    // Rate Limiter: Max 3 posts per 60 minutes per user
    const now = Date.now();
    const userTimestamps = userPostTimestamps.get(userId) || [];
    const validTimestamps = userTimestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (validTimestamps.length >= 3) {
      res.status(429).json({
        success: false,
        message: 'Bạn đã đạt giới hạn tạo bài viết Trận Hay (tối đa 3 bài/giờ). Vui lòng thử lại sau.',
      });
      return;
    }

    const { playerWhite, playerBlack, moves, winnerName, loserName, resultReason, variant } = req.body;

    if (!moves || !Array.isArray(moves)) {
      res.status(400).json({ success: false, message: 'Thiếu hoặc sai cấu trúc danh sách nước đi PGN.' });
      return;
    }

    // Validate plies strictly from server-side array length for SEO:
    // PvP Online >= 90 nước, Chơi với Bot >= 120 nước.
    const totalPlies = moves.length;
    const isBotMatch = (playerWhite && (String(playerWhite).toLowerCase().includes('máy') || String(playerWhite).toLowerCase().includes('bot'))) ||
                       (playerBlack && (String(playerBlack).toLowerCase().includes('máy') || String(playerBlack).toLowerCase().includes('bot')));
    const minPlies = isBotMatch ? 120 : 90;

    if (totalPlies < minPlies) {
      res.status(400).json({
        success: false,
        message: `Trận đấu chưa đủ số nước đi yêu cầu để đăng bài đẩy SEO (${isBotMatch ? 'Đấu với Bot >= 120 nước' : 'PvP Online >= 90 nước'}).`,
      });
      return;
    }

    if (totalPlies > 500) {
      res.status(400).json({
        success: false,
        message: 'Số nước đi vượt quá giới hạn cho phép (tối đa 500 nước).',
      });
      return;
    }

    // Deduplication check
    const movesSummary = moves.slice(0, 15).join(';') + `_${totalPlies}_${userId}`;
    if (postedMatchHashes.has(movesSummary)) {
      res.status(409).json({
        success: false,
        message: 'Ván đấu này đã được tạo bài đăng trước đó. Vui lòng không gửi trùng lặp.',
      });
      return;
    }

    // Sanitize string entries in moves array
    const sanitizedMoves = moves.map((m) => String(m).slice(0, 50));

    // Helper format commander titles safely
    const formatCommanderTitle = (name: string, defaultRole: string = 'Chiến Tướng'): string => {
      if (!name) return `[${defaultRole}.Vô Danh]`;
      let cleaned = String(name).trim().slice(0, 50);
      if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
        cleaned = cleaned.slice(1, -1).trim();
      }
      if (cleaned === 'Bạn' || cleaned === 'Đỏ (Bạn)' || cleaned === 'Đỏ') {
        cleaned = `${defaultRole}.Vô Danh`;
      }
      if (cleaned === 'Máy' || cleaned.startsWith('Máy:')) {
        cleaned = cleaned.replace(/^Máy:\s*/, '');
      }
      cleaned = cleaned.replace(/\s*\(\d+\)$/, '').trim();

      if (!cleaned.includes('.') && !cleaned.includes('Máy') && cleaned !== 'Hòa' && cleaned !== 'Địa Ngục Vương') {
        cleaned = `${defaultRole}.${cleaned}`;
      }
      return `[${cleaned}]`;
    };

    const whiteName = formatCommanderTitle(playerWhite || 'Đỏ', 'Chiến Tướng');
    const blackName = formatCommanderTitle(playerBlack || 'Đen', 'Chiến Tướng');
    const winner = winnerName === 'Hòa' ? 'Hòa' : formatCommanderTitle(winnerName || 'Kỳ Thủ', 'Chiến Tướng');
    const loser = loserName === 'Hòa' ? 'Hòa' : formatCommanderTitle(loserName || 'Đối Thủ', 'Chiến Tướng');

    const variantCode = String(variant || 'kb').toLowerCase().slice(0, 5);
    let variantName = 'Cờ Bí Pháp';
    let variantIcon = '✨';
    let variantLabel = '✨ Cờ Bí Pháp';

    if (variantCode === 'n') {
      variantName = 'Cờ Truyền Thống';
      variantIcon = '🏯';
      variantLabel = '🏯 Cờ Truyền Thống';
    } else if (variantCode === 't') {
      variantName = 'Cờ Úp Truyền Thống';
      variantIcon = '🎴';
      variantLabel = '🎴 Cờ Úp Truyền Thống';
    } else if (variantCode === 'g') {
      variantName = 'Cờ Úp Gián Điệp';
      variantIcon = '🕵️';
      variantLabel = '🕵️ Cờ Úp Gián Điệp';
    }

    console.log(`[Great Match AI Engine] Phân tích ván đấu (${variantName}) ${totalPlies} nước giữa ${whiteName} và ${blackName}...`);

    const aiResult = await analyzeMatchWithGemini(sanitizedMoves, whiteName, blackName, winner, loser, String(resultReason || 'Chiếu Bí').slice(0, 50), variantCode);

    if (!aiResult) {
      res.status(500).json({
        success: false,
        message: 'Không thể khởi tạo bài phân tích AI cho ván cờ này.',
      });
      return;
    }

    const matchId = `match_${Date.now()}`;
    const postId = await publishMatchToBlogger(
      matchId,
      whiteName,
      blackName,
      sanitizedMoves,
      aiResult,
      variantName,
      variantCode,
      variantIcon,
      variantLabel
    );

    // Record successful post for rate limiting and deduplication
    validTimestamps.push(now);
    userPostTimestamps.set(userId, validTimestamps);
    postedMatchHashes.add(movesSummary);

    res.json({
      success: true,
      matchId,
      postId,
      plies: totalPlies,
      variant: variantCode,
      variantName,
      aiAnalysis: aiResult,
      message: `Đã tự động dùng AI sinh bài viết và đăng bài Trận Hay (${variantName}) thành công!`,
    });
  } catch (error) {
    console.error('[Create Great Match Post Error]', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo bài viết Trận Hay.',
    });
  }
}

export function getPublicRooms(req: AuthenticatedRequest, res: Response): void {
  try {
    const rooms = matchmakingManager.getPublicWaitingRooms();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy danh sách phòng công khai.' });
  }
}

// Rate limiting & Idempotency cho PvE finish
const userPveTimestamps: Map<number, number> = new Map();
const processedPveMatches: Map<string, any> = new Map();

interface DailyPveTracker {
  date: string;
  exp: number;
}
const userDailyPveMap: Map<number, DailyPveTracker> = new Map();

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getUserDailyPveExp(userId: number): number {
  const today = getTodayIsoDate();
  const tracker = userDailyPveMap.get(userId);
  if (!tracker || tracker.date !== today) {
    return 0;
  }
  return tracker.exp;
}

export function recordUserDailyPveExp(userId: number, addedExp: number): number {
  const today = getTodayIsoDate();
  const tracker = userDailyPveMap.get(userId);
  const currentExp = (!tracker || tracker.date !== today) ? 0 : tracker.exp;
  const newExp = currentExp + addedExp;
  userDailyPveMap.set(userId, { date: today, exp: newExp });
  return newExp;
}

export function resetPveTrackingForTest(): void {
  userPveTimestamps.clear();
  userDailyPveMap.clear();
  processedPveMatches.clear();
}

export async function finishPveMatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Yêu cầu xác thực tài khoản.' });
      return;
    }

    const { matchId, result, totalMoves, aiDifficulty, moves, variant, reason, isTestMode } = req.body;
    const outcome: 'WIN' | 'DRAW' | 'LOSS' = (result === 'WIN' || result === 'DRAW') ? result : 'LOSS';
    const difficulty: 'EASY' | 'NORMAL' | 'HARD' = (aiDifficulty === 'EASY' || aiDifficulty === 'HARD') ? aiDifficulty : 'NORMAL';

    // 1. Phân biệt và trích xuất số nước cờ thực tế (Actual moves)
    let actualMovesCount = 0;
    if (Array.isArray(moves)) {
      actualMovesCount = moves.filter(
        (m: any) => typeof m === 'string' && /^\d+,\d+-\d+,\d+$/.test(m)
      ).length;
    } else {
      actualMovesCount = Math.max(0, Math.floor(Number(totalMoves) || 0));
    }

    // 2. Kiểm tra Idempotency chống cộng trùng (Duplicate submission / Network retry)
    const movesSignature = Array.isArray(moves) ? moves.slice(0, 10).join(';') : '';
    const dedupeKey = matchId
      ? `${userId}_${matchId}`
      : `${userId}_${actualMovesCount}_${variant || 'kb'}_${movesSignature}`;

    if (processedPveMatches.has(dedupeKey)) {
      const cached = processedPveMatches.get(dedupeKey);
      res.json({
        ...cached,
        duplicate: true,
        message: 'Kết quả ván đấu đã được ghi nhận trước đó.',
      });
      return;
    }

    // 3. Rate limiting (5 giây giữa các trận PvE mới)
    const now = Date.now();
    const lastPveTime = userPveTimestamps.get(userId) || 0;
    if (now - lastPveTime < 5000) {
      res.status(429).json({ success: false, message: 'Thao tác quá nhanh. Vui lòng thử lại sau vài giây.' });
      return;
    }

    let user: any = null;
    try {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } catch (dbErr) {
      user = { id: userId, username: req.user?.username || 'TestUser', exp: 0n, level: 1, elo: 1200, matches_played: 0, matches_won: 0 };
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng trong hệ thống.' });
      return;
    }

    // 3.5. Chế độ thử nghiệm: Dùng miễn phí tất cả Bí Pháp - KHÔNG cộng EXP và ELO trong tất cả các chế độ chơi
    if (isTestMode === true) {
      const titles = getPlayerTitles(user.level, user.elo);
      const responsePayload = {
        success: true,
        earnedExp: 0,
        baseExp: 0,
        greatGameBonus: 0,
        isTestMode: true,
        totalMoves: actualMovesCount,
        leveledUp: false,
        newLevel: user.level,
        currentExp: Number(user.exp),
        rankTitle: titles.fullTitle,
        canWriteBlog: false,
        dailyPveExp: getUserDailyPveExp(userId),
        message: 'Chế độ thử nghiệm (dùng miễn phí Bí Pháp): Không tính cộng EXP và ELO.',
      };
      processedPveMatches.set(dedupeKey, responsePayload);
      res.json(responsePayload);
      return;
    }

    // 4. Chống cày ảo: Ván dưới 20 nước đi thực tế không được tính nhận EXP
    if (actualMovesCount < 20) {
      const responsePayload = {
        success: true,
        earnedExp: 0,
        baseExp: 0,
        greatGameBonus: 0,
        totalMoves: actualMovesCount,
        leveledUp: false,
        newLevel: user.level,
        currentExp: Number(user.exp),
        message: 'Ván đấu dưới 20 nước đi thực tế không được tính nhận EXP.',
      };
      processedPveMatches.set(dedupeKey, responsePayload);
      res.json(responsePayload);
      return;
    }

    // 5. Tính EXP nhận được theo levelService có tính Daily Cap (tối đa 300 EXP/ngày)
    const currentDailyExp = getUserDailyPveExp(userId);
    const expResult = calculateMatchExp({
      mode: 'PVE',
      result: outcome,
      totalMoves: actualMovesCount,
      aiDifficulty: difficulty,
      currentDailyPveExp: currentDailyExp,
    });

    const earnedExp = expResult.totalEarnedExp;
    const isWin = outcome === 'WIN';

    // 6. Tính toán level mới từ tổng exp lũy kế
    const newTotalExp = user.exp + BigInt(earnedExp);
    const newLevel = calculateLevelFromExp(newTotalExp, user.level);
    const leveledUp = newLevel > user.level;

    // Ghi nhận daily tracker và timestamp
    recordUserDailyPveExp(userId, earnedExp);
    userPveTimestamps.set(userId, now);

    // 7. Cập nhật vào Cơ sở dữ liệu
    let updatedUser: any = user;
    try {
      updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          exp: newTotalExp,
          level: newLevel,
          matches_played: { increment: 1 },
          matches_won: isWin ? { increment: 1 } : undefined,
        },
      });
    } catch (dbErr) {
      updatedUser = {
        ...user,
        exp: newTotalExp,
        level: newLevel,
        matches_played: (user.matches_played || 0) + 1,
        matches_won: (user.matches_won || 0) + (isWin ? 1 : 0),
      };
    }

    const titles = getPlayerTitles(newLevel, updatedUser.elo);

    // 8. Nếu ván hay > 120 nước thực tế: tự động kích hoạt AI viết bài Blogspot
    if (expResult.canWriteBlog && actualMovesCount >= 120 && Array.isArray(moves)) {
      const sanitizedMoves = moves.map((m: any) => String(m).slice(0, 50));
      const vCode = String(variant || 'kb').toLowerCase().slice(0, 5);
      const vName = vCode === 'n' ? 'Cờ Truyền Thống' : vCode === 't' ? 'Cờ Úp Truyền Thống' : vCode === 'g' ? 'Cờ Úp Gián Điệp' : 'Cờ Bí Pháp';
      const whiteName = `[Kỳ Thủ.${user.username}]`;
      const botName = difficulty === 'HARD' ? 'Địa Ngục Vương' : difficulty === 'NORMAL' ? 'Pháo Đầu' : 'Tay Mơ';
      const blackName = `[Máy.${botName}]`;
      const winnerName = isWin ? whiteName : (outcome === 'DRAW' ? 'Hòa' : blackName);
      const loserName = isWin ? blackName : (outcome === 'DRAW' ? 'Hòa' : whiteName);

      analyzeMatchWithGemini(sanitizedMoves, whiteName, blackName, winnerName, loserName, String(reason || 'Chiếu Bí').slice(0, 50), vCode)
        .then(aiResult => {
          if (aiResult) {
            publishMatchToBlogger(`match_pve_${Date.now()}`, whiteName, blackName, sanitizedMoves, aiResult, vName, vCode);
          }
        })
        .catch(err => console.error('[PvE Auto-Blog Error]', err));
    }

    const responsePayload = {
      success: true,
      earnedExp,
      baseExp: expResult.baseExp,
      greatGameBonus: expResult.greatGameBonus,
      newTotalExp: Number(newTotalExp),
      newLevel,
      leveledUp,
      rankTitle: titles.fullTitle,
      canWriteBlog: expResult.canWriteBlog,
      totalMoves: actualMovesCount,
      dailyPveExp: expResult.newDailyPveExp,
      dailyPveCapRemaining: Math.max(0, 300 - expResult.newDailyPveExp),
      message: earnedExp > 0
        ? `Hoàn thành trận đấu máy (${difficulty})! Nhận được ${earnedExp} EXP.`
        : 'Bạn đã đạt giới hạn tối đa 300 EXP/ngày từ chế độ đấu máy.',
    };

    processedPveMatches.set(dedupeKey, responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error('[Finish PvE Match Error]', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu kết quả trận đấu máy.' });
  }
}
