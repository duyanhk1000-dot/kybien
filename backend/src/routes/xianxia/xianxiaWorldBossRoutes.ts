import { Router } from 'express';
import { authenticateToken } from '../../middlewares/authMiddleware.js';
import {
  getCurrentWorldBoss,
  spawnWorldBoss,
  attackWorldBoss,
  getWorldBossLeaderboard,
  claimWorldBossReward,
} from '../../controllers/xianxia/xianxiaWorldBossController.js';

const router = Router();

// 1. Xem thông tin boss hiện tại & bảng xếp hạng sát thương
router.get('/current', getCurrentWorldBoss);
router.get('/:bossInstanceId/leaderboard', getWorldBossLeaderboard);
router.get('/leaderboard/:bossInstanceId', getWorldBossLeaderboard);

// 2. Thao tác chiến đấu và nhận thưởng bắt buộc xác thực JWT
router.post('/spawn', authenticateToken, spawnWorldBoss);
router.post('/attack', authenticateToken, attackWorldBoss);
router.post('/claim-reward', authenticateToken, claimWorldBossReward);

export default router;
