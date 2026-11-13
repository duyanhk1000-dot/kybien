import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/authMiddleware.js';
import { xianxiaDungeonService } from '../../services/xianxia/xianxiaDungeonService.js';

function parseErrorStatus(errMessage: string): number {
  if (errMessage.includes('NOT_FOUND')) return 404;
  if (errMessage.includes('FORBIDDEN') || errMessage.includes('UNAUTHORIZED') || errMessage.includes('NOT_LEADER')) return 403;
  if (errMessage.includes('VERSION_MISMATCH') || errMessage.includes('OUTDATED')) return 409;
  if (
    errMessage.includes('INVALID') ||
    errMessage.includes('ALREADY') ||
    errMessage.includes('EXPIRED') ||
    errMessage.includes('CANNOT') ||
    errMessage.includes('NOT_READY') ||
    errMessage.includes('INSUFFICIENT_FATIGUE') ||
    errMessage.includes('REALM_TOO_LOW') ||
    errMessage.includes('NOT_IN_PROGRESS') ||
    errMessage.includes('NOT_COMPLETED') ||
    errMessage.includes('NOT_IN_PARTY')
  ) {
    return 400;
  }
  return 400;
}

/**
 * GET /api/xianxia/dungeons
 * Lấy danh sách phó bản khả dụng
 */
export async function getDungeonList(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const list = xianxiaDungeonService.getDungeonList();
    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi khi tải danh sách phó bản.',
    });
  }
}

/**
 * POST /api/xianxia/dungeons/:id/enter
 * Vào phó bản (Chỉ đội trưởng)
 */
export async function enterDungeon(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const dungeonId = String(req.params.id);
    const rawIdempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

    const run = await xianxiaDungeonService.enterDungeon(userId, dungeonId, rawIdempotencyKey);
    res.status(201).json({
      success: true,
      data: run,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi tiến nhập phó bản.',
    });
  }
}

/**
 * GET /api/xianxia/dungeons/run/:runId
 * Lấy trạng thái phiên phó bản
 */
export async function getDungeonRun(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const runId = String(req.params.runId);
    const run = await xianxiaDungeonService.getDungeonRunById(runId, userId);
    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi lấy thông tin phó bản.',
    });
  }
}

/**
 * POST /api/xianxia/dungeons/run/:runId/combat-step
 * Thực thi 1 hiệp đấu (Server-authoritative)
 */
export async function executeCombatStep(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const runId = String(req.params.runId);
    const expectedVersion = req.body?.version !== undefined ? parseInt(String(req.body.version), 10) : undefined;

    const updatedRun = await xianxiaDungeonService.executeCombatStep(userId, runId, expectedVersion);
    res.status(200).json({
      success: true,
      data: updatedRun,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi thực thi hiệp đấu.',
    });
  }
}

/**
 * POST /api/xianxia/dungeons/run/:runId/claim-reward
 * Nhận thưởng phó bản khi chiến thắng
 */
export async function claimReward(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const runId = String(req.params.runId);
    const rawIdempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

    const rewardResult = await xianxiaDungeonService.claimReward(userId, runId, rawIdempotencyKey);
    res.status(200).json({
      success: true,
      data: rewardResult,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi nhận thưởng phó bản.',
    });
  }
}

/**
 * POST /api/xianxia/dungeons/run/:runId/reconnect
 * Đồng bộ trạng thái khi kết nối lại
 */
export async function reconnect(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Yêu cầu đăng nhập.' });
      return;
    }

    const runId = String(req.params.runId);
    const run = await xianxiaDungeonService.reconnect(userId, runId);
    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (err: any) {
    const status = parseErrorStatus(err.message || '');
    res.status(status).json({
      success: false,
      error: err.message || 'Lỗi khi kết nối lại phó bản.',
    });
  }
}
