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

// Rate limiting cho PvE finish: tối đa 1 lần mỗi 10 giây / user
const userPveTimestamps: Map<number, number> = new Map();

export async function finishPveMatch(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Yêu cầu xác thực tài khoản.' });
      return;
    }

    const now = Date.now();
    const lastPveTime = userPveTimestamps.get(userId) || 0;
    if (now - lastPveTime < 10000) {
      res.status(429).json({ success: false, message: 'Thao tác quá nhanh. Vui lòng thử lại sau vài giây.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng trong hệ thống.' });
      return;
    }

    const { result, totalMoves, aiDifficulty, moves, variant, reason } = req.body;
    const movesCount = Number(totalMoves || (Array.isArray(moves) ? moves.length : 0));
    const outcome: 'WIN' | 'DRAW' | 'LOSS' = (result === 'WIN' || result === 'DRAW') ? result : 'LOSS';
    const difficulty: 'EASY' | 'NORMAL' | 'HARD' = (aiDifficulty === 'EASY' || aiDifficulty === 'HARD') ? aiDifficulty : 'NORMAL';

    // 1. Chống cày ảo: Ván dưới 20 nước không được tính nhận EXP
    if (movesCount < 20) {
      res.json({
        success: true,
        earnedExp: 0,
        baseExp: 0,
        greatGameBonus: 0,
        totalMoves: movesCount,
        leveledUp: false,
        newLevel: user.level,
        currentExp: Number(user.exp),
        message: 'Ván đấu dưới 20 nước đi không được tính nhận EXP.',
      });
      return;
    }

    userPveTimestamps.set(userId, now);

    // 2. Tính EXP nhận được theo levelService
    const expResult = calculateMatchExp({
      mode: 'PVE',
      result: outcome,
      totalMoves: movesCount,
      aiDifficulty: difficulty,
    });

    const earnedExp = expResult.totalEarnedExp;
    const isWin = outcome === 'WIN';

    // 3. Tính toán level mới
    const newTotalExp = user.exp + BigInt(earnedExp);
    const newLevel = calculateLevelFromExp(newTotalExp, user.level);
    const leveledUp = newLevel > user.level;

    // 4. Cập nhật vào Cơ sở dữ liệu
    await prisma.user.update({
      where: { id: user.id },
      data: {
        exp: newTotalExp,
        level: newLevel,
        matches_played: { increment: 1 },
        matches_won: isWin ? { increment: 1 } : undefined,
      },
    });

    const titles = getPlayerTitles(newLevel, user.elo);

    // 5. Nếu ván hay > 120 nước: tự động kích hoạt AI viết bài Blogspot
    if (expResult.canWriteBlog && Array.isArray(moves) && moves.length >= 120) {
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

    res.json({
      success: true,
      earnedExp,
      baseExp: expResult.baseExp,
      greatGameBonus: expResult.greatGameBonus,
      newTotalExp: Number(newTotalExp),
      newLevel,
      leveledUp,
      rankTitle: titles.fullTitle,
      canWriteBlog: expResult.canWriteBlog,
      message: `Hoàn thành trận đấu máy (${difficulty})! Nhận được ${earnedExp} EXP.`,
    });
  } catch (error) {
    console.error('[Finish PvE Match Error]', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lưu kết quả trận đấu máy.' });
  }
}
