import { Request, Response } from 'express';
import { analyzeMatchWithGemini } from '../services/aiService.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';

export async function createGreatMatchPost(req: Request, res: Response): Promise<void> {
  try {
    const { playerWhite, playerBlack, moves, winnerName, loserName, resultReason, plies, variant } = req.body;

    const totalPlies = plies || (moves ? moves.length : 0);
    if (totalPlies < 50) {
      res.status(400).json({
        success: false,
        message: 'Trận đấu chưa đủ 50 nước đi để được xét làm Trận Hay (>50 nước).',
      });
      return;
    }

    if (!moves || !Array.isArray(moves) || moves.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Thiếu lịch sử nước đi PGN của ván đấu.',
      });
      return;
    }

    const whiteName = playerWhite || 'Đỏ';
    const blackName = playerBlack || 'Đen';
    const winner = winnerName || 'Kỳ Thủ';
    const loser = loserName || 'Đối Thủ';

    // Map mã Thể loại cờ (variantCode) -> Tên thể loại tiếng Việt & Label chuẩn có Icon
    const variantCode = (variant || 'kb').toLowerCase();
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
    } else if (variantCode === 'kb' || variantCode === 'b' || variantCode === 'k') {
      variantName = 'Cờ Bí Pháp';
      variantIcon = '✨';
      variantLabel = '✨ Cờ Bí Pháp';
    }

    console.log(`[Great Match AI Engine] Phân tích ván đấu (${variantName}) ${totalPlies} nước giữa ${whiteName} và ${blackName}...`);

    // 1. Phân tích bài viết Sa Trường bằng Gemini AI với đúng Thể loại cờ
    const aiResult = await analyzeMatchWithGemini(moves, winner, loser, resultReason || 'Chiếu Bí', variantCode);

    if (!aiResult) {
      res.status(500).json({
        success: false,
        message: 'Không thể khởi tạo bài phân tích AI cho ván cờ này.',
      });
      return;
    }

    // 2. Xuất bản bài đăng lên Blogger API v3 với đúng nhãn & thông số thể loại cờ
    const matchId = `match_${Date.now()}`;
    const postId = await publishMatchToBlogger(
      matchId,
      whiteName,
      blackName,
      moves,
      aiResult,
      variantName,
      variantCode,
      variantIcon,
      variantLabel
    );

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
