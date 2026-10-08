import { Router } from 'express';
import { register, login, getProfile, getLeaderboard } from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getProfile);
router.get('/leaderboard', getLeaderboard);

export default router;
