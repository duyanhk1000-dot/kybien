import { Request, Response } from 'express';
import { analyzeMatchWithGemini } from '../services/aiService.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';

export async function createGreatMatchPost(req: Request, res: Response): Promise<void> {
  try {
    const { playerWhite, playerBlack, moves, winnerName, loserName, resultReason, plies } = req.body;

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

    console.log(`[Great Match AI Engine] Đang phân tích ván đấu ${totalPlies} nước đi giữa ${whiteName} và ${blackName}...`);

    // 1. Phân tích bài viết Sa Trường bằng Gemini AI
    const aiResult = await analyzeMatchWithGemini(moves, winner, loser, resultReason || 'Chiếu Bí');

    if (!aiResult) {
      res.status(500).json({
        success: false,
        message: 'Không thể khởi tạo bài phân tích AI cho ván cờ này.',
      });
      return;
    }

    // 2. Xuất bản bài đăng lên Blogger API v3
    const matchId = `match_${Date.now()}`;
    const postId = await publishMatchToBlogger(matchId, whiteName, blackName, moves, aiResult);

    res.json({
      success: true,
      matchId,
      postId,
      plies: totalPlies,
      aiAnalysis: aiResult,
      message: 'Đã tự động dùng AI sinh bài viết Sa Trường và tạo bài đăng Trận Hay thành công!',
    });
  } catch (error) {
    console.error('[Create Great Match Post Error]', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tạo bài viết Trận Hay.',
    });
  }
}
