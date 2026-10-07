import { Router } from 'express';
import { createGreatMatchPost } from '../controllers/matchController.js';

const router = Router();

// Endpoint tự động dùng AI sinh bài viết và tạo bài blog Blogger cho trận đấu > 50 nước
router.post('/great-match', createGreatMatchPost);

export default router;
