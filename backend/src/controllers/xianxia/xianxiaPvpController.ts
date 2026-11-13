import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaPvpService } from '../../services/xianxia/xianxiaPvpService.js';

/**
 * Lấy danh sách đối thủ phù hợp trên lôi đài
 * GET /api/xianxia/gameplay/pvp/opponents
 */
export async function getOpponents(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để truy cập Đấu Trường.' });
      return;
    }

    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string, 10) || 8));
    const opponents = await xianxiaPvpService.getOpponents(userId, limit);

    res.status(200).json({
      success: true,
      data: opponents,
    });
  } catch (err: any) {
    console.error('[PvpController] Lỗi khi lấy danh sách đối thủ:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Không thể lấy danh sách đối thủ lôi đài.',
    });
  }
}

/**
 * Khiêu chiến đối thủ trên lôi đài (PvP Challenge)
 * POST /api/xianxia/gameplay/pvp/challenge
 */
export async function challenge(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để khiêu chiến.' });
      return;
    }

    const defenderId = parseInt(req.body.defenderId, 10);
    if (!defenderId || isNaN(defenderId) || defenderId <= 0) {
      res.status(400).json({
        success: false,
        error: 'Vui lòng chỉ định mã đối thủ hợp lệ (defenderId là số nguyên dương).',
      });
      return;
    }

    const rawIdempotencyKey =
      (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    let idempotencyKey: string | undefined = undefined;
    if (rawIdempotencyKey !== undefined && rawIdempotencyKey !== null) {
      if (typeof rawIdempotencyKey !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Mã Idempotency key không hợp lệ (phải là chuỗi).',
        });
        return;
      }
      const trimmed = rawIdempotencyKey.trim();
      if (trimmed.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Mã Idempotency key không được để trống khi đã gửi.',
        });
        return;
      }
      if (trimmed.length > 64) {
        res.status(400).json({
          success: false,
          error: 'Mã Idempotency key quá dài (tối đa 64 ký tự).',
        });
        return;
      }
      if (!/^[\w\-.:]+$/.test(trimmed)) {
        res.status(400).json({
          success: false,
          error: 'Mã Idempotency key chứa ký tự không hợp lệ (chỉ chấp nhận chữ cái, số, _, -, ., :).',
        });
        return;
      }
      idempotencyKey = trimmed;
    }

    const result = await xianxiaPvpService.challengeOpponent(
      userId,
      defenderId,
      idempotencyKey
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[PvpController] Lỗi khi khiêu chiến lôi đài:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Khiêu chiến lôi đài thất bại.',
    });
  }
}

/**
 * Xem lịch sử các trận đấu PvP gần đây
 * GET /api/xianxia/gameplay/pvp/history
 */
export async function getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để xem lịch sử đấu trường.' });
      return;
    }

    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string, 10) || 15));
    const history = await xianxiaPvpService.getPvpHistory(userId, limit);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    console.error('[PvpController] Lỗi khi lấy lịch sử đấu trường:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Không thể lấy lịch sử đấu trường.',
    });
  }
}

/**
 * Xem chi tiết 1 trận đấu PvP (bao gồm diễn biến hiệp đấu)
 * GET /api/xianxia/gameplay/pvp/match/:id
 */
export async function getMatchDetail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const matchId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!matchId) {
      res.status(400).json({ error: 'Mã trận đấu không hợp lệ.' });
      return;
    }

    const detail = await xianxiaPvpService.getPvpMatch(userId, matchId);

    res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (err: any) {
    console.error('[PvpController] Lỗi khi xem chi tiết trận đấu:', err);
    const msg: string = err.message || '';
    if (msg.includes('không tồn tại') || msg.includes('Không tìm thấy')) {
      res.status(404).json({
        success: false,
        error: msg,
      });
    } else if (msg.includes('thẩm quyền')) {
      res.status(403).json({
        success: false,
        error: msg,
      });
    } else {
      res.status(400).json({
        success: false,
        error: msg || 'Không thể xem chiến báo trận đấu này.',
      });
    }
  }
}

/**
 * Bảng xếp hạng Điểm Danh Vọng lôi đài
 * GET /api/xianxia/gameplay/pvp/leaderboard
 */
export async function getPvpLeaderboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string, 10) || 20));

    const { entries, myRank } = await xianxiaPvpService.getPvpLeaderboard(limit, userId);

    res.status(200).json({
      success: true,
      data: entries,
      myRank,
    });
  } catch (err: any) {
    console.error('[PvpController] Lỗi khi lấy BXH Danh Vọng:', err);
    res.status(400).json({
      success: false,
      error: err.message || 'Không thể lấy Bảng Xếp Hạng Danh Vọng.',
    });
  }
}
