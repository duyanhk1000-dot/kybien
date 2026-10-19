import { Router } from 'express';
import { PuzzleController } from '../controllers/puzzleController.js';
import { authenticateToken, optionalAuthenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// GET /api/puzzles/daily - Lấy 3 thế cờ hàng ngày (Dễ - Vừa - Khó) hôm nay
router.get('/daily', optionalAuthenticateToken, PuzzleController.getDailyPuzzles);

// GET /api/puzzles/daily/:date - Lấy 3 thế cờ hàng ngày theo ngày cụ thể (YYYY-MM-DD)
router.get('/daily/:date', optionalAuthenticateToken, PuzzleController.getDailyPuzzlesByDate);

// POST /api/puzzles/daily/publish - Kích hoạt đăng 3 thế cờ hàng ngày và tự động viết bài Blog
router.post('/daily/publish', optionalAuthenticateToken, PuzzleController.publishDaily);

// --- UGC PUZZLE CREATOR & VERIFICATION ROUTES (Yêu cầu đăng nhập tài khoản Kỳ Biến) ---
// POST /api/puzzles/ugc/create-draft - Tạo bản thảo thế cờ
router.post('/ugc/create-draft', authenticateToken, PuzzleController.createUgcDraft);

// POST /api/puzzles/ugc/:id/start-verify - Bắt đầu thử nghiệm tự kiểm chứng thế cờ
router.post('/ugc/:id/start-verify', authenticateToken, PuzzleController.startUgcVerification);

// POST /api/puzzles/ugc/session/:sessionId/verify-move - Thẩm định nước đi trong quá trình tự kiểm chứng
router.post('/ugc/session/:sessionId/verify-move', authenticateToken, PuzzleController.submitUgcVerifyMove);

// POST /api/puzzles/ugc/:id/publish - Xuất bản thế cờ đã kiểm chứng lên cộng đồng
router.post('/ugc/:id/publish', authenticateToken, PuzzleController.publishUgcPuzzle);

// POST /api/puzzles/ugc/:id/vote - Thả tim / Upvote thế cờ cộng đồng
router.post('/ugc/:id/vote', optionalAuthenticateToken, PuzzleController.upvoteUgcPuzzle);

// GET /api/puzzles - Lấy danh sách thế cờ (có phân trang, tier, trạng thái is_solved)
router.get('/', optionalAuthenticateToken, PuzzleController.getPuzzles);

// GET /api/puzzles/:id - Lấy thông tin thế cờ theo ID
router.get('/:id', optionalAuthenticateToken, PuzzleController.getPuzzleById);

// POST /api/puzzles/:id/start-session - Bắt đầu một phiên giải thế cờ (Session State Machine)
router.post('/:id/start-session', optionalAuthenticateToken, PuzzleController.startSession);

// POST /api/puzzles/session/:sessionId/move - Thẩm định nước đi người chơi gửi lên
router.post('/session/:sessionId/move', optionalAuthenticateToken, PuzzleController.submitMove);

export default router;
