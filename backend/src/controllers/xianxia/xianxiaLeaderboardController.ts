import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaLeaderboardService } from '../../services/xianxia/xianxiaLeaderboardService.js';

/**
 * Controller xử lý yêu cầu truy vấn Bảng Xếp Hạng Tiên Lộ (M4.1)
 * Endpoint: GET /api/xianxia/leaderboard hoặc /api/xianxia/gameplay/leaderboard
 */
export async function getLeaderboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const page = req.query.page as string | undefined;
    const limit = req.query.limit as string | undefined;
    const fresh = req.query.fresh === 'true';
    const userId = req.user?.userId;

    const result = await xianxiaLeaderboardService.getLeaderboard({
      page,
      limit,
      userId,
      fresh,
    });

    res.status(200).json(result);
  } catch (err: any) {
    console.error('[XianxiaLeaderboardController] Lỗi khi truy vấn bảng xếp hạng:', err);
    res.status(500).json({
      success: false,
      error: 'Không thể truy vấn bảng xếp hạng thiên kiêu vào lúc này.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}
