import { prisma } from '../utils/prisma.js';
import { XiangqiRuleVerifier, Side, BoardPos } from '../utils/xiangqiRuleVerifier.js';
import { BlackPuzzleAi } from '../utils/blackPuzzleAi.js';
import { PuzzleStatus, PuzzleTier } from '@prisma/client';

export interface ChallengeConstraints {
  max_moves?: number; // Số nước tối đa bên Đỏ được đi (ví dụ: 3 nước)
  forbidden_pieces?: string[]; // Quân cấm di chuyển: 'R' (Xe), 'C' (Pháo), 'N' (Mã)...
  time_limit_sec?: number;
  description?: string;
}

export interface CreateUgcDraftInput {
  title: string;
  fen: string;
  description?: string;
  constraints?: ChallengeConstraints;
  userId?: number;
}

export class UgcPuzzleService {
  /**
   * Thẩm định FEN bàn cờ khi người chơi tự bày thế
   */
  static validateFenSetup(fen: string): { valid: boolean; error?: string } {
    if (!fen || typeof fen !== 'string') {
      return { valid: false, error: 'Chuỗi FEN không hợp lệ' };
    }

    const normalizedFen = fen.includes(' ') ? fen : `${fen} w - - 0 1`;
    let board: (string | null)[][];
    try {
      board = XiangqiRuleVerifier.parseFen(normalizedFen);
    } catch (e: any) {
      return { valid: false, error: 'Không thể phân tích thế trận cờ: định dạng FEN lỗi' };
    }

    // 1. Kiểm tra Tướng Đỏ và Tướng Đen
    const redKing = XiangqiRuleVerifier.findKing(board, 'RED');
    const blackKing = XiangqiRuleVerifier.findKing(board, 'BLACK');

    if (!redKing) {
      return { valid: false, error: 'Thế cờ bắt buộc phải có Soái (Tướng Đỏ)' };
    }
    if (!blackKing) {
      return { valid: false, error: 'Thế cờ bắt buộc phải có Tướng (Tướng Đen)' };
    }

    // Tướng phải nằm trong Cung
    if (!XiangqiRuleVerifier.isPalace(redKing.r, redKing.c, 'RED')) {
      return { valid: false, error: 'Tướng Đỏ phải nằm trong cung cấm (hàng 8-10, cột d-f)' };
    }
    if (!XiangqiRuleVerifier.isPalace(blackKing.r, blackKing.c, 'BLACK')) {
      return { valid: false, error: 'Tướng Đen phải nằm trong cung cấm (hàng 1-3, cột d-f)' };
    }

    // 2. Kiểm tra luật Lộ mặt tướng (Flying General) ban đầu
    if (XiangqiRuleVerifier.isFlyingGeneral(board)) {
      return { valid: false, error: 'Hai Tướng đang đối mặt trực tiếp trên cùng một cột (Lộ mặt tướng phạm quy)' };
    }

    // 3. Đếm số lượng quân mỗi bên (không được vượt quá số quân cờ tướng chuẩn)
    const counts: Record<string, number> = {};
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 9; c++) {
        const p = board[r][c];
        if (p) {
          counts[p] = (counts[p] || 0) + 1;

          // Kiểm tra vị trí Sĩ và Tượng không được vi phạm biên giới
          if (p === 'A' && !XiangqiRuleVerifier.isPalace(r, c, 'RED')) {
            return { valid: false, error: 'Sĩ Đỏ không được ra khỏi Cung' };
          }
          if (p === 'a' && !XiangqiRuleVerifier.isPalace(r, c, 'BLACK')) {
            return { valid: false, error: 'Sĩ Đen không được ra khỏi Cung' };
          }
          if (p === 'B' && r < 5) {
            return { valid: false, error: 'Tượng Đỏ không được vượt sông sang đất địch' };
          }
          if (p === 'b' && r > 4) {
            return { valid: false, error: 'Tượng Đen không được qua sông' };
          }
        }
      }
    }

    if ((counts['K'] || 0) !== 1) return { valid: false, error: 'Chỉ được phép có đúng 1 Tướng Đỏ' };
    if ((counts['k'] || 0) !== 1) return { valid: false, error: 'Chỉ được phép có đúng 1 Tướng Đen' };
    if ((counts['R'] || 0) > 2) return { valid: false, error: 'Bên Đỏ không được có quá 2 Xe' };
    if ((counts['r'] || 0) > 2) return { valid: false, error: 'Bên Đen không được có quá 2 Xe' };
    if ((counts['C'] || 0) > 2) return { valid: false, error: 'Bên Đỏ không được có quá 2 Pháo' };
    if ((counts['c'] || 0) > 2) return { valid: false, error: 'Bên Đen không được có quá 2 Pháo' };
    if ((counts['N'] || 0) > 2) return { valid: false, error: 'Bên Đỏ không được có quá 2 Mã' };
    if ((counts['n'] || 0) > 2) return { valid: false, error: 'Bên Đen không được có quá 2 Mã' };
    if ((counts['P'] || 0) > 5) return { valid: false, error: 'Bên Đỏ không được có quá 5 Binh' };
    if ((counts['p'] || 0) > 5) return { valid: false, error: 'Bên Đen không được có quá 5 Tốt' };

    // 4. Ban đầu Tướng Đỏ không được đang bị chiếu (hoặc nước đi đầu phải giải chiếu)
    // Tướng Đen cũng không được đang bị chiếu khi chưa đi
    if (XiangqiRuleVerifier.isKingInCheck(board, 'BLACK')) {
      return { valid: false, error: 'Bàn cờ ban đầu Tướng Đen đang bị chiếu sẵn. Hãy điều chỉnh vị trí quân' };
    }

    return { valid: true };
  }

  /**
   * Tạo bản thảo thế cờ mới (DRAFT)
   */
  static async createDraft(input: CreateUgcDraftInput) {
    if (!input.userId) {
      throw new Error('Vui lòng đăng nhập tài khoản Kỳ Biến để sáng lập thế cờ!');
    }

    if (!input.title || input.title.trim().length < 3) {
      throw new Error('Tiêu đề thế cờ phải có ít nhất 3 ký tự');
    }

    const validation = this.validateFenSetup(input.fen);
    if (!validation.valid) {
      throw new Error(validation.error || 'Thế cờ vi phạm quy tắc bàn cờ');
    }

    const normalizedFen = input.fen.includes(' ') ? input.fen : `${input.fen} w - - 0 1`;

    const constraints = input.constraints || {};
    if (constraints.max_moves && (constraints.max_moves < 1 || constraints.max_moves > 20)) {
      throw new Error('Số nước tối đa phải nằm trong khoảng 1 đến 20 nước');
    }

    const initialTree = {
      root_fen: normalizedFen,
      branches: [],
    };

    const puzzle = await prisma.puzzle.create({
      data: {
        tier: PuzzleTier.UGC,
        title: input.title.trim(),
        fen: normalizedFen,
        description: input.description?.trim() || null,
        constraints: JSON.stringify(constraints),
        solution_tree: JSON.stringify(initialTree),
        status: PuzzleStatus.DRAFT,
        creator_id: input.userId || null,
      },
    });

    return {
      success: true,
      puzzleId: puzzle.id,
      title: puzzle.title,
      status: puzzle.status,
      fen: puzzle.fen,
      constraints,
    };
  }

  /**
   * Bắt đầu phiên "Tự Thử Nghiệm & Xác Minh" cho tác giả (Author Verification Session)
   */
  static async startVerificationSession(puzzleId: number, userId?: number) {
    if (!userId) {
      throw new Error('Vui lòng đăng nhập tài khoản Kỳ Biến để tự thử nghiệm thế cờ!');
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
    });

    if (!puzzle) {
      throw new Error('Không tìm thấy thế cờ');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const session = await prisma.puzzleSession.create({
      data: {
        puzzle_id: puzzle.id,
        user_id: userId || null,
        session_type: 'PRACTICE',
        current_fen: puzzle.fen,
        move_history: '[]',
        status: 'ACTIVE',
        expires_at: expiresAt,
      },
    });

    let constraints: ChallengeConstraints = {};
    try {
      if (puzzle.constraints) constraints = JSON.parse(puzzle.constraints);
    } catch (e) {}

    return {
      sessionId: session.id,
      puzzleId: puzzle.id,
      fen: puzzle.fen,
      title: puzzle.title,
      constraints,
      expiresAt,
    };
  }

  /**
   * Thẩm định nước đi trong chế độ Tự Kiểm Chứng của Tác Giả (Enforcing Constraints & Checkmate)
   */
  static async submitVerifyMove(sessionId: string, moveUci: string, userId?: number) {
    const session = await prisma.puzzleSession.findUnique({
      where: { id: sessionId },
      include: { puzzle: true },
    });

    if (!session) {
      throw new Error('Phiên giải không tồn tại');
    }

    if (session.status !== 'ACTIVE') {
      throw new Error(`Phiên giải này đã kết thúc với trạng thái: ${session.status}`);
    }

    const puzzle = session.puzzle;
    let constraints: ChallengeConstraints = {};
    try {
      if (puzzle.constraints) constraints = JSON.parse(puzzle.constraints);
    } catch (e) {}

    const moveHistory: string[] = JSON.parse(session.move_history || '[]');
    const board = XiangqiRuleVerifier.parseFen(session.current_fen);

    // 1. Kiểm tra tính hợp lệ của nước đi
    const uciPos = XiangqiRuleVerifier.uciToPos(moveUci);
    if (!uciPos) {
      throw new Error('Tọa độ nước đi không đúng định dạng UCCI');
    }

    const piece = board[uciPos.from.r][uciPos.from.c];
    if (!piece) {
      throw new Error('Không có quân cờ ở ô xuất phát');
    }

    // 2. Ràng buộc: Kiểm tra quân cấm di chuyển (Forbidden Pieces)
    if (constraints.forbidden_pieces && constraints.forbidden_pieces.length > 0) {
      const pieceUpper = piece.toUpperCase();
      if (constraints.forbidden_pieces.includes(pieceUpper)) {
        const pieceNames: Record<string, string> = {
          R: 'Xe', C: 'Pháo', N: 'Mã', P: 'Binh', A: 'Sĩ', B: 'Tượng', K: 'Tướng',
        };
        throw new Error(`Vi phạm điều kiện thách đấu: Cấm sử dụng quân ${pieceNames[pieceUpper] || pieceUpper}!`);
      }
    }

    // 3. Kiểm tra luật cờ hợp lệ
    const legalCheck = XiangqiRuleVerifier.isLegalMove(board, uciPos.from, uciPos.to, 'RED');
    if (!legalCheck.valid) {
      throw new Error(`Nước đi phạm luật: ${legalCheck.reason}`);
    }

    // Thực hiện nước đi của Đỏ
    const boardAfterPlayer = board.map(r => [...r]);
    boardAfterPlayer[uciPos.to.r][uciPos.to.c] = piece;
    boardAfterPlayer[uciPos.from.r][uciPos.from.c] = null;

    const redMoveCount = Math.floor(moveHistory.length / 2) + 1;

    // 4. Kiểm tra xem nước này có Chiếu Bí Đen không (VICTORY)
    const isPlayerCheckmate = XiangqiRuleVerifier.isCheckmate(boardAfterPlayer, 'BLACK');

    if (isPlayerCheckmate) {
      // ĐỎ CHIẾU BÍ ĐEN THÀNH CÔNG!
      const finalHistory = [...moveHistory, moveUci];

      // Lưu lại chuỗi nước đi xác minh và chuyển trạng thái thế cờ sang VERIFIED!
      // Xây dựng cây lời giải chuẩn SolutionTree từ chuỗi nước đi xác minh finalHistory:
      let currentMoves: any[] = [
        {
          move: finalHistory[finalHistory.length - 1],
          is_correct: true,
          is_win: true,
          win_comment: 'Sát cục tuyệt diệu! Phá trận giang hồ thành công!',
          replies: [],
        },
      ];

      for (let i = finalHistory.length - 3; i >= 0; i -= 2) {
        const redMove = finalHistory[i];
        const blackReply = finalHistory[i + 1];
        currentMoves = [
          {
            move: redMove,
            is_correct: true,
            is_win: false,
            replies: [
              {
                reply_move: blackReply,
                reply_fen: '',
                next_moves: currentMoves,
              },
            ],
          },
        ];
      }

      const solutionTree = {
        root_fen: puzzle.fen,
        author_solution: finalHistory,
        constraints,
        branches: currentMoves,
      };

      await prisma.$transaction([
        prisma.puzzleSession.update({
          where: { id: session.id },
          data: {
            status: 'WON',
            move_history: JSON.stringify(finalHistory),
          },
        }),
        prisma.puzzle.update({
          where: { id: puzzle.id },
          data: {
            status: PuzzleStatus.VERIFIED,
            solution_tree: JSON.stringify(solutionTree),
          },
        }),
      ]);

      return {
        status: 'VICTORY',
        isVerified: true,
        playerMove: moveUci,
        moveCount: redMoveCount,
        message: '🎉 TỰ KIỂM CHỨNG THÀNH CÔNG! Bạn đã chứng minh thế cờ có lời giải hợp lệ theo đúng điều kiện thách đấu. Nút [CÔNG KHAI LÊN GIANG HỒ] đã sẵn sàng!',
      };
    }

    // 5. Ràng buộc: Kiểm tra số nước tối đa (Max Moves)
    if (constraints.max_moves && redMoveCount >= constraints.max_moves) {
      // Đã chạm giới hạn số nước mà vẫn chưa chiếu bí được Đen -> Bại trận do hết nước quy định
      await prisma.puzzleSession.update({
        where: { id: session.id },
        data: { status: 'DEFEATED' },
      });

      return {
        status: 'DEFEAT',
        playerMove: moveUci,
        defeatReason: `Hết số nước quy định! Bạn đặt điều kiện thắng trong ${constraints.max_moves} nước nhưng sau ${redMoveCount} nước vẫn chưa sát cục được đối phương.`,
      };
    }

    // 6. Đen đáp trả bằng AI thông minh
    const blackReply = BlackPuzzleAi.selectBestMove(boardAfterPlayer);
    if (!blackReply) {
      // Đen hết nước đi hợp lệ (Stalemate / Vây khốn) -> Đỏ Thắng!
      const finalHistory = [...moveHistory, moveUci];
      await prisma.puzzle.update({
        where: { id: puzzle.id },
        data: { status: PuzzleStatus.VERIFIED },
      });
      await prisma.puzzleSession.update({
        where: { id: session.id },
        data: { status: 'WON', move_history: JSON.stringify(finalHistory) },
      });

      return {
        status: 'VICTORY',
        isVerified: true,
        playerMove: moveUci,
        message: 'Đen rơi vào thế vây khốn hết nước đi! Thế cờ đã được xác minh thành công!',
      };
    }

    // Thực hiện nước đi của Đen
    const boardAfterBlack = boardAfterPlayer.map(r => [...r]);
    boardAfterBlack[blackReply.to.r][blackReply.to.c] = boardAfterPlayer[blackReply.from.r][blackReply.from.c];
    boardAfterBlack[blackReply.from.r][blackReply.from.c] = null;

    // Kiểm tra xem Đen có Chiếu Bí Đỏ không
    if (blackReply.isCheckmate || XiangqiRuleVerifier.isCheckmate(boardAfterBlack, 'RED')) {
      await prisma.puzzleSession.update({
        where: { id: session.id },
        data: { status: 'DEFEATED' },
      });

      return {
        status: 'DEFEAT',
        playerMove: moveUci,
        punishMove: blackReply.uci,
        defeatReason: 'Đối phương phản công chiếu bí Tướng Đỏ! Thế cờ của bạn để hở sát cơ trí mạng.',
      };
    }

    // Cờ tiếp diễn
    const nextFen = XiangqiRuleVerifier.boardToFen(boardAfterBlack, 'RED');
    const updatedHistory = [...moveHistory, moveUci, blackReply.uci];

    await prisma.puzzleSession.update({
      where: { id: session.id },
      data: {
        current_fen: nextFen,
        move_history: JSON.stringify(updatedHistory),
      },
    });

    return {
      status: 'CONTINUE',
      playerMove: moveUci,
      computerReply: blackReply.uci,
      currentFen: nextFen,
      movesLeft: constraints.max_moves ? constraints.max_moves - redMoveCount : null,
    };
  }

  /**
   * Xuất bản thế cờ đã xác minh lên cộng đồng (PUBLISHED)
   */
  static async publishPuzzle(puzzleId: number, userId?: number) {
    if (!userId) {
      throw new Error('Vui lòng đăng nhập tài khoản Kỳ Biến để xuất bản thế cờ!');
    }

    const puzzle = await prisma.puzzle.findUnique({
      where: { id: puzzleId },
    });

    if (!puzzle) {
      throw new Error('Thế cờ không tồn tại');
    }

    if (puzzle.status !== PuzzleStatus.VERIFIED) {
      throw new Error('Chỉ có thể xuất bản thế cờ đã tự kiểm chứng thành công (VERIFIED). Vui lòng chơi thắng thế cờ trước!');
    }

    if (puzzle.creator_id && userId && puzzle.creator_id !== userId) {
      throw new Error('Bạn không phải tác giả tạo ra thế cờ này');
    }

    const updated = await prisma.puzzle.update({
      where: { id: puzzleId },
      data: {
        status: PuzzleStatus.PUBLISHED,
      },
    });

    return {
      success: true,
      puzzleId: updated.id,
      title: updated.title,
      status: updated.status,
      message: '🎉 Chúc mừng! Thế cờ của bạn đã được chính thức xuất bản lên Giang Hồ Kỳ Trận!',
    };
  }

  /**
   * Bấm thích (Upvote) thế cờ của cộng đồng
   */
  static async upvotePuzzle(puzzleId: number) {
    const puzzle = await prisma.puzzle.update({
      where: { id: puzzleId },
      data: { upvote_count: { increment: 1 } },
      select: { id: true, title: true, upvote_count: true },
    });

    return {
      success: true,
      puzzleId: puzzle.id,
      upvoteCount: puzzle.upvote_count,
    };
  }
}
