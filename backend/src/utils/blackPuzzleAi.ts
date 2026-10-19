import { XiangqiRuleVerifier, BoardPos } from './xiangqiRuleVerifier.js';

export interface AiMoveResult {
  uci: string;
  from: BoardPos;
  to: BoardPos;
  isCheckmate: boolean;
  isCheck: boolean;
}

const PIECE_VALUES: Record<string, number> = {
  R: 900, r: 900,
  C: 450, c: 450,
  N: 400, n: 400,
  P: 150, p: 150,
  A: 200, a: 200,
  B: 200, b: 200,
  K: 10000, k: 10000,
};

export class BlackPuzzleAi {
  /**
   * Chọn nước đi đáp trả tối ưu nhất cho phe Đen khi người chơi đi lệch kịch bản thế cờ.
   * Ưu tiên:
   * 1. Nước chiếu bí Tướng Đỏ ngay lập tức (Checkmate).
   * 2. Nước chiếu Tướng Đỏ (Check).
   * 3. Nước ăn quân giá trị cao nhất của Đỏ.
   * 4. Nước đi ép sát Tướng Đỏ hoặc củng cố phòng thủ.
   */
  static selectBestMove(board: (string | null)[][]): AiMoveResult | null {
    const legalMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'BLACK');
    if (legalMoves.length === 0) return null;

    let bestMove = legalMoves[0];
    let bestScore = -Infinity;
    let bestIsMate = false;
    let bestIsCheck = false;

    for (const m of legalMoves) {
      // Giả lập nước đi
      const nextBoard = board.map(r => [...r]);
      const captured = nextBoard[m.to.r][m.to.c];
      nextBoard[m.to.r][m.to.c] = nextBoard[m.from.r][m.from.c];
      nextBoard[m.from.r][m.from.c] = null;

      let score = 0;

      // 1. Kiểm tra Chiếu Bí Đỏ
      const isMate = XiangqiRuleVerifier.isCheckmate(nextBoard, 'RED');
      if (isMate) {
        return {
          uci: m.uci,
          from: m.from,
          to: m.to,
          isCheckmate: true,
          isCheck: true,
        };
      }

      // 2. Kiểm tra Chiếu Tướng Đỏ
      const isCheck = XiangqiRuleVerifier.isKingInCheck(nextBoard, 'RED');
      if (isCheck) {
        score += 5000;
      }

      // 3. Ăn quân Đỏ
      if (captured && XiangqiRuleVerifier.isRed(captured)) {
        score += (PIECE_VALUES[captured] || 100) * 10;
      }

      // 4. Tiến quân xuống phía Tướng Đỏ (r tăng dần về 9)
      const movingPiece = board[m.from.r][m.from.c];
      if (movingPiece === 'r' || movingPiece === 'p' || movingPiece === 'c') {
        score += (m.to.r - m.from.r) * 15;
      }

      // 5. Nếu Tướng Đen đang bị chiếu, ưu tiên nước chạy Tướng an toàn hoặc cản
      const kingPos = XiangqiRuleVerifier.findKing(board, 'BLACK');
      if (kingPos && m.from.r === kingPos.r && m.from.c === kingPos.c) {
        score += 200; // Thoát Tướng
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = m;
        bestIsMate = isMate;
        bestIsCheck = isCheck;
      }
    }

    return {
      uci: bestMove.uci,
      from: bestMove.from,
      to: bestMove.to,
      isCheckmate: bestIsMate,
      isCheck: bestIsCheck,
    };
  }
}
