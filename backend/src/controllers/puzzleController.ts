import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { PuzzleService } from '../services/puzzleService.js';
import { PuzzlePlayMode, PuzzleSessionType, PuzzleTier } from '@prisma/client';

export class PuzzleController {
  /**
   * GET /api/puzzles
   * Lấy danh sách thế cờ (hỗ trợ phân trang, lọc theo tier)
   */
  static async getPuzzles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tierParam = req.query.tier as string | undefined;
      const tier = tierParam && Object.values(PuzzleTier).includes(tierParam as PuzzleTier)
        ? (tierParam as PuzzleTier)
        : undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const userId = req.user?.userId;

      const result = await PuzzleService.getPuzzles({
        tier,
        page,
        limit,
        userId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.getPuzzles] Lỗi:', err);
      res.status(500).json({ error: err.message || 'Lỗi lấy danh sách thế cờ.' });
    }
  }

  /**
   * GET /api/puzzles/:id
   * Lấy chi tiết thế cờ (FEN khởi đầu, không có đáp án)
   */
  static async getPuzzleById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const puzzleId = parseInt(String(req.params.id), 10);
      if (isNaN(puzzleId)) {
        res.status(400).json({ error: 'Mã thế cờ (ID) không hợp lệ.' });
        return;
      }

      const userId = req.user?.userId;
      const puzzle = await PuzzleService.getPuzzleById(puzzleId, userId);

      if (!puzzle) {
        res.status(404).json({ error: 'Thế cờ không tồn tại hoặc đã bị ẩn.' });
        return;
      }

      res.status(200).json({
        success: true,
        data: puzzle,
      });
    } catch (err: any) {
      console.error('[PuzzleController.getPuzzleById] Lỗi:', err);
      res.status(500).json({ error: err.message || 'Lỗi lấy chi tiết thế cờ.' });
    }
  }

  /**
   * POST /api/puzzles/:id/start-session
   * Khởi tạo phiên giải thế cờ (Session State Machine)
   */
  static async startSession(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const puzzleId = parseInt(String(req.params.id), 10);
      if (isNaN(puzzleId)) {
        res.status(400).json({ error: 'Mã thế cờ (ID) không hợp lệ.' });
        return;
      }

      const { mode, sessionType } = req.body || {};
      const validMode = mode && Object.values(PuzzlePlayMode).includes(mode)
        ? (mode as PuzzlePlayMode)
        : PuzzlePlayMode.TRADITIONAL;
      const validSessionType = sessionType && Object.values(PuzzleSessionType).includes(sessionType)
        ? (sessionType as PuzzleSessionType)
        : PuzzleSessionType.RANKED;

      const session = await PuzzleService.startSession({
        puzzleId,
        userId: req.user?.userId,
        mode: validMode,
        sessionType: validSessionType,
      });

      res.status(201).json({
        success: true,
        data: session,
      });
    } catch (err: any) {
      console.error('[PuzzleController.startSession] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Không thể khởi tạo phiên giải thế cờ.' });
    }
  }

  /**
   * POST /api/puzzles/session/:sessionId/move
   * Thẩm định nước đi người chơi gửi lên Server
   */
  static async submitMove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = String(req.params.sessionId);
      const { moveUci } = req.body || {};

      if (!sessionId) {
        res.status(400).json({ error: 'Thiếu sessionId.' });
        return;
      }

      if (!moveUci || typeof moveUci !== 'string') {
        res.status(400).json({ error: 'Nước đi (moveUci) không hợp lệ hoặc bị thiếu.' });
        return;
      }

      const result = await PuzzleService.submitMove({
        sessionId,
        moveUci: moveUci.trim().toLowerCase(),
        userId: req.user?.userId,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.submitMove] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Lỗi thẩm định nước đi.' });
    }
  }

  /**
   * GET /api/puzzles/daily
   * Lấy 3 thế cờ hàng ngày (Dễ - Vừa - Khó) hôm nay
   */
  static async getDailyPuzzles(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dateStr = req.query.date as string | undefined;
      const userId = req.user?.userId;
      const { DailyPuzzleService } = await import('../services/dailyPuzzleService.js');
      const result = await DailyPuzzleService.getDailyPuzzles(dateStr, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.getDailyPuzzles] Lỗi:', err);
      res.status(500).json({ error: err.message || 'Lỗi lấy 3 thế cờ hàng ngày.' });
    }
  }

  /**
   * GET /api/puzzles/daily/:date
   * Lấy 3 thế cờ hàng ngày theo ngày cụ thể (YYYY-MM-DD)
   */
  static async getDailyPuzzlesByDate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dateStr = String(req.params.date);
      const userId = req.user?.userId;
      const { DailyPuzzleService } = await import('../services/dailyPuzzleService.js');
      const result = await DailyPuzzleService.getDailyPuzzles(dateStr, userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.getDailyPuzzlesByDate] Lỗi:', err);
      res.status(500).json({ error: err.message || 'Lỗi lấy thế cờ hàng ngày theo ngày.' });
    }
  }

  /**
   * POST /api/puzzles/daily/publish
   * Kích hoạt đăng 3 thế cờ hàng ngày kèm xuất bản bài viết Blog sang Blogger
   */
  static async publishDaily(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const dateStr = req.body?.date as string | undefined;
      const { DailyPuzzleService } = await import('../services/dailyPuzzleService.js');
      const result = await DailyPuzzleService.publishDailyPuzzlesAndBlog(dateStr);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.publishDaily] Lỗi:', err);
      res.status(500).json({ error: err.message || 'Lỗi xuất bản thế cờ và bài viết hàng ngày.' });
    }
  }

  /**
   * POST /api/puzzles/ugc/create-draft
   * Tạo bản thảo thế cờ mới (DRAFT)
   */
  static async createUgcDraft(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, fen, description, constraints } = req.body;
      const { UgcPuzzleService } = await import('../services/ugcPuzzleService.js');
      const result = await UgcPuzzleService.createDraft({
        title,
        fen,
        description,
        constraints,
        userId: req.user?.userId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.createUgcDraft] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Lỗi tạo bản thảo thế cờ.' });
    }
  }

  /**
   * POST /api/puzzles/ugc/:id/start-verify
   * Khởi tạo phiên tự kiểm chứng cho tác giả
   */
  static async startUgcVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const puzzleId = parseInt(String(req.params.id), 10);
      if (isNaN(puzzleId)) {
        res.status(400).json({ error: 'Mã thế cờ không hợp lệ' });
        return;
      }

      const { UgcPuzzleService } = await import('../services/ugcPuzzleService.js');
      const result = await UgcPuzzleService.startVerificationSession(puzzleId, req.user?.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.startUgcVerification] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Lỗi khởi tạo phiên kiểm chứng.' });
    }
  }

  /**
   * POST /api/puzzles/ugc/session/:sessionId/verify-move
   * Thẩm định nước đi trong quá trình tác giả tự kiểm chứng
   */
  static async submitUgcVerifyMove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const sessionId = String(req.params.sessionId);
      const moveUci = String(req.body.moveUci || '');

      if (!moveUci) {
        res.status(400).json({ error: 'Nước đi không hợp lệ hoặc bị thiếu' });
        return;
      }

      const { UgcPuzzleService } = await import('../services/ugcPuzzleService.js');
      const result = await UgcPuzzleService.submitVerifyMove(sessionId, moveUci.trim().toLowerCase(), req.user?.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.submitUgcVerifyMove] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Lỗi thẩm định nước đi kiểm chứng.' });
    }
  }

  /**
   * POST /api/puzzles/ugc/:id/publish
   * Xuất bản thế cờ đã xác minh lên cộng đồng
   */
  static async publishUgcPuzzle(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const puzzleId = parseInt(String(req.params.id), 10);
      if (isNaN(puzzleId)) {
        res.status(400).json({ error: 'Mã thế cờ không hợp lệ' });
        return;
      }

      const { UgcPuzzleService } = await import('../services/ugcPuzzleService.js');
      const result = await UgcPuzzleService.publishPuzzle(puzzleId, req.user?.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.publishUgcPuzzle] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Lỗi xuất bản thế cờ.' });
    }
  }

  /**
   * POST /api/puzzles/ugc/:id/vote
   * Thả tim / Upvote thế cờ cộng đồng
   */
  static async upvoteUgcPuzzle(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const puzzleId = parseInt(String(req.params.id), 10);
      if (isNaN(puzzleId)) {
        res.status(400).json({ error: 'Mã thế cờ không hợp lệ' });
        return;
      }

      const { UgcPuzzleService } = await import('../services/ugcPuzzleService.js');
      const result = await UgcPuzzleService.upvotePuzzle(puzzleId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      console.error('[PuzzleController.upvoteUgcPuzzle] Lỗi:', err);
      res.status(400).json({ error: err.message || 'Lỗi bình chọn thế cờ.' });
    }
  }
}
