import { Router } from 'express';
import { authenticateToken } from '../../middlewares/authMiddleware.js';
import {
  getDungeonList,
  enterDungeon,
  getDungeonRun,
  executeCombatStep,
  claimReward,
  reconnect,
} from '../../controllers/xianxia/xianxiaDungeonController.js';

const router = Router();

// Bắt buộc xác thực danh tính JWT cho toàn bộ thao tác phó bản
router.use(authenticateToken);

// 1. Danh sách phó bản khả dụng
router.get('/', getDungeonList);

// 2. Tiến nhập phó bản (Leader-only)
router.post('/:id/enter', enterDungeon);

// 3. Trạng thái chi tiết phiên phó bản
router.get('/run/:runId', getDungeonRun);

// 4. Thực thi hiệp đấu server-authoritative
router.post('/run/:runId/combat-step', executeCombatStep);

// 5. Nhận thưởng khi hoàn thành phó bản
router.post('/run/:runId/claim-reward', claimReward);

// 6. Đồng bộ kết nối lại
router.post('/run/:runId/reconnect', reconnect);

export default router;
