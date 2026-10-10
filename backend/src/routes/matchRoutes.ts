import { Router } from 'express';
import { createGreatMatchPost, getPublicRooms } from '../controllers/matchController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Endpoint tự động dùng AI sinh bài viết và tạo bài blog Blogger cho trận đấu > 50 nước (Yêu cầu xác thực JWT)
router.post('/great-match', authenticateToken, createGreatMatchPost);

// Endpoint công khai lấy danh sách các phòng chờ trực tiếp
router.get('/public-rooms', getPublicRooms);

export default router;
