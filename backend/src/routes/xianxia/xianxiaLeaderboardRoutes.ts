import { Router } from 'express';
import { optionalAuthenticateToken } from '../../middlewares/authMiddleware.js';
import { getLeaderboard } from '../../controllers/xianxia/xianxiaLeaderboardController.js';

const router = Router();

// Endpoint công khai xem Bảng Xếp Hạng Thiên Kiêu (hỗ trợ JWT tùy chọn để xác định myRank)
router.get('/', optionalAuthenticateToken, getLeaderboard);

export default router;
