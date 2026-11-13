import { Request, Response } from 'express';
import { xianxiaWorldBossService } from '../../services/xianxia/xianxiaWorldBossService.js';
import { prisma } from '../../utils/prisma.js';

export async function getCurrentWorldBoss(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    let characterId: number | undefined;
    if (userId) {
      const char = await prisma.xianxiaCharacter.findUnique({
        where: { user_id: userId },
        select: { id: true },
      });
      characterId = char?.id;
    }

    const data = await xianxiaWorldBossService.getCurrentBoss(characterId);
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'WORLDBOSS_ERROR',
        message: err.message || 'Lỗi lấy thông tin Boss Thế Giới.',
      },
    });
  }
}

export async function spawnWorldBoss(req: Request, res: Response) {
  try {
    const { name, level, maxHp, durationMinutes } = req.body || {};
    const boss = await xianxiaWorldBossService.spawnWorldBoss({
      name,
      level: level ? parseInt(level, 10) : undefined,
      maxHp: maxHp ? parseInt(maxHp, 10) : undefined,
      durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: boss,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'WORLDBOSS_SPAWN_ERROR',
        message: err.message || 'Lỗi triệu hoán Boss Thế Giới.',
      },
    });
  }
}

export async function attackWorldBoss(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const { bossInstanceId } = req.body || {};

    if (!bossInstanceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Thiếu bossInstanceId.',
        },
      });
    }

    const result = await xianxiaWorldBossService.attackWorldBoss(userId, bossInstanceId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'WORLDBOSS_ATTACK_ERROR',
        message: err.message || 'Lỗi tấn công Boss Thế Giới.',
      },
    });
  }
}

export async function getWorldBossLeaderboard(req: Request, res: Response) {
  try {
    const { bossInstanceId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

    if (!bossInstanceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Thiếu bossInstanceId.',
        },
      });
    }

    const bossId = Array.isArray(bossInstanceId) ? bossInstanceId[0] : (bossInstanceId as string);
    const leaderboard = await xianxiaWorldBossService.getLeaderboard(bossId, limit);
    return res.status(200).json({
      success: true,
      data: leaderboard,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'WORLDBOSS_LEADERBOARD_ERROR',
        message: err.message || 'Lỗi lấy bảng xếp hạng sát thương.',
      },
    });
  }
}

export async function claimWorldBossReward(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    const { bossInstanceId } = req.body || {};
    const rawKey = req.headers['x-idempotency-key'];
    const idempotencyKey = (Array.isArray(rawKey) ? rawKey[0] : (rawKey as string)) || req.body?.idempotencyKey;

    if (!bossInstanceId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Thiếu bossInstanceId.',
        },
      });
    }

    const result = await xianxiaWorldBossService.claimReward(userId, bossInstanceId, idempotencyKey);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: {
        code: err.code || 'WORLDBOSS_CLAIM_ERROR',
        message: err.message || 'Lỗi nhận thưởng Boss Thế Giới.',
      },
    });
  }
}
