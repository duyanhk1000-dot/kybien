import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getProfile, getLeaderboard } from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Chống brute-force đăng nhập/đăng ký: tối đa 5 lần / phút / IP.
// Trước đây POST /login không giới hạn số lần thử nên dò mật khẩu tự do.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Bạn đăng nhập/đăng ký quá nhiều lần, vui lòng thử lại sau 1 phút.' });
  },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', authenticateToken, getProfile);
router.get('/leaderboard', getLeaderboard);

export default router;
