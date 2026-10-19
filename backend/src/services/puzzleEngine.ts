import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import { BlackPuzzleAi } from '../utils/blackPuzzleAi.js';

export interface MoveStep {
  fromFile: number; // 0..8 (a..i)
  fromRank: number; // 0..9
  toFile: number;
  toRank: number;
  uci: string; // e.g. "f3f9"
}

export interface ComputerReplyNode {
  reply_move: string;
  reply_fen: string;
  next_moves?: SolutionNode[];
}

export interface SolutionNode {
  move: string; // UCCI, e.g. "f3f9"
  is_correct: boolean;
  is_win?: boolean;
  win_comment?: string;
  replies?: ComputerReplyNode[];
}

export interface SolutionTrap {
  wrong_move: string;
  punish_move?: string;
  defeat_reason?: string;
}

export interface SolutionTree {
  root_fen: string;
  branches: SolutionNode[];
  traps?: SolutionTrap[];
}

export interface MoveEvaluationResult {
  status: 'CONTINUE' | 'VICTORY' | 'DEFEAT' | 'INVALID_MOVE';
  playerMove: string;
  computerReply?: string | null;
  punishMove?: string | null;
  nextFen?: string;
  isWin?: boolean;
  defeatReason?: string;
  winComment?: string;
}

export class PuzzleEngine {
  /**
   * Chuyển đổi ký tự cột UCCI (a..i) sang index 0..8
   */
  static fileToIndex(fileChar: string): number {
    return fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
  }

  /**
   * Chuyển đổi index 0..8 sang ký tự cột UCCI (a..i)
   */
  static indexToFile(fileIndex: number): string {
    return String.fromCharCode('a'.charCodeAt(0) + fileIndex);
  }

  /**
   * Phân tích chuỗi UCCI (ví dụ "f3f9") thành MoveStep
   */
  static parseUcci(uci: string): MoveStep | null {
    if (!uci || uci.length !== 4) return null;
    const fromFile = this.fileToIndex(uci[0]);
    const fromRank = parseInt(uci[1], 10);
    const toFile = this.fileToIndex(uci[2]);
    const toRank = parseInt(uci[3], 10);

    if (
      fromFile < 0 || fromFile > 8 ||
      fromRank < 0 || fromRank > 9 ||
      toFile < 0 || toFile > 8 ||
      toRank < 0 || toRank > 9
    ) {
      return null;
    }

    return { fromFile, fromRank, toFile, toRank, uci };
  }

  /**
   * Chuyển FEN thành ma trận 10 hàng x 9 cột
   * Hàng 0 trong ma trận = Rank 9 (Hàng đáy Đen)
   * Hàng 9 trong ma trận = Rank 0 (Hàng đáy Đỏ)
   */
  static fenToBoard(fen: string): string[][] {
    const rows = fen.trim().split(' ')[0].split('/');
    const board: string[][] = [];

    for (let r = 0; r < 10; r++) {
      const row: string[] = [];
      const fenRow = rows[r] || '9';
      for (let i = 0; i < fenRow.length; i++) {
        const ch = fenRow[i];
        if (ch >= '1' && ch <= '9') {
          const empties = parseInt(ch, 10);
          for (let e = 0; e < empties; e++) row.push('.');
        } else {
          row.push(ch);
        }
      }
      board.push(row);
    }
    return board;
  }

  /**
   * Chuyển ma trận 10 hàng x 9 cột thành chuỗi FEN
   */
  static boardToFen(board: string[][], activeColor: 'w' | 'b' = 'w', halfMove: number = 0, fullMove: number = 1): string {
    const rowStrings: string[] = [];

    for (let r = 0; r < 10; r++) {
      let emptyCount = 0;
      let rowStr = '';
      for (let c = 0; c < 9; c++) {
        const piece = board[r][c];
        if (piece === '.') {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount.toString();
            emptyCount = 0;
          }
          rowStr += piece;
        }
      }
      if (emptyCount > 0) {
        rowStr += emptyCount.toString();
      }
      rowStrings.push(rowStr);
    }

    return `${rowStrings.join('/')} ${activeColor} - - ${halfMove} ${fullMove}`;
  }

  /**
   * Lấy quân cờ tại tọa độ UCCI (ví dụ file: 5 ('f'), rank: 3)
   */
  static getPieceAt(board: string[][], file: number, rank: number): string {
    const row = 9 - rank;
    const col = file;
    if (row < 0 || row > 9 || col < 0 || col > 8) return '.';
    return board[row][col];
  }

  /**
   * Thực thi một nước đi trên FEN và trả về FEN mới
   */
  static applyMove(fen: string, uci: string, nextTurnColor?: 'w' | 'b'): { newFen: string; captured: string } | null {
    const step = this.parseUcci(uci);
    if (!step) return null;

    const board = this.fenToBoard(fen);
    const fromRow = 9 - step.fromRank;
    const fromCol = step.fromFile;
    const toRow = 9 - step.toRank;
    const toCol = step.toFile;

    const piece = board[fromRow][fromCol];
    if (piece === '.') return null;

    const captured = board[toRow][toCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = '.';

    // Xác định lượt đi kế tiếp
    const currentTurn = fen.split(' ')[1] || 'w';
    const nextTurn = nextTurnColor || (currentTurn === 'w' ? 'b' : 'w');

    const newFen = this.boardToFen(board, nextTurn);
    return { newFen, captured };
  }

  /**
   * Thẩm định nước đi dựa trên Cây Lời Giải (Solution Tree) và luật cờ tướng quốc tế
   * Duyệt cây nước đi để tìm nhánh tương ứng với lịch sử và nước đi của người chơi
   */
  static evaluateSolutionStep(
    solutionTree: SolutionTree,
    moveHistory: string[], // Danh sách các nước đi đã chơi trong session
    playerMoveUci: string,
    currentFen?: string // FEN hiện tại của bàn cờ
  ): MoveEvaluationResult {
    const cleanPlayerMove = playerMoveUci.trim().toLowerCase();

    // 1. Kiểm tra cú pháp UCCI hợp lệ
    const uciPos = XiangqiRuleVerifier.uciToPos(cleanPlayerMove);
    if (!uciPos) {
      return {
        status: 'INVALID_MOVE',
        playerMove: cleanPlayerMove,
        defeatReason: 'Định dạng nước đi UCCI không đúng (ví dụ: a0a1, f3f9).'
      };
    }

    // 2. Kiểm tra luật cờ tướng quốc tế (nếu có currentFen)
    if (currentFen) {
      const board = XiangqiRuleVerifier.parseFen(currentFen);
      const legalCheck = XiangqiRuleVerifier.isLegalMove(board, uciPos.from, uciPos.to, 'RED');
      if (!legalCheck.valid) {
        return {
          status: 'INVALID_MOVE',
          playerMove: cleanPlayerMove,
          defeatReason: legalCheck.reason || 'Nước đi phạm luật cờ tướng.'
        };
      }
    }

    // 2. Tìm nhánh hiện tại trong cây lời giải (Solution DAG)
    let currentLevelNodes: SolutionNode[] = solutionTree.branches || [];

    for (let i = 0; i < moveHistory.length; i += 2) {
      const pastPlayerMove = moveHistory[i].toLowerCase();
      const pastCompReply = moveHistory[i + 1] ? moveHistory[i + 1].toLowerCase() : null;

      const matchedNode = currentLevelNodes.find(n => {
        const m = n?.move || (n as any)?.player_move;
        return m && m.toLowerCase() === pastPlayerMove;
      });
      if (!matchedNode || !matchedNode.replies) {
        break;
      }

      if (pastCompReply) {
        const matchedReply = matchedNode.replies.find(r => r?.reply_move && r.reply_move.toLowerCase() === pastCompReply);
        if (matchedReply && matchedReply.next_moves) {
          currentLevelNodes = matchedReply.next_moves;
        } else {
          break;
        }
      }
    }

    // 3. Khớp nước đi của người chơi với các lựa chọn hợp lệ ở node hiện tại
    const matchedCandidate = currentLevelNodes.find(n => {
      const m = n?.move || (n as any)?.player_move;
      return m && m.toLowerCase() === cleanPlayerMove && (n.is_correct !== false);
    });

    if (matchedCandidate) {
      // TRƯỜNG HỢP 1: Sát cục chiến thắng (Node kết thúc hoặc có cờ is_win / is_mate)
      if (matchedCandidate.is_win || (matchedCandidate as any).is_mate || !matchedCandidate.replies || matchedCandidate.replies.length === 0) {
        return {
          status: 'VICTORY',
          playerMove: cleanPlayerMove,
          computerReply: null,
          isWin: true,
          winComment: matchedCandidate.win_comment || 'Sát cục tuyệt diệu! Chúc mừng Đại hiệp đã phá giải kỳ trận!',
        };
      }

      // TRƯỜNG HỢP 2: Nước đi đúng, máy đáp trả
      const replyObj = matchedCandidate.replies[0];
      return {
        status: 'CONTINUE',
        playerMove: cleanPlayerMove,
        computerReply: replyObj.reply_move,
        nextFen: replyObj.reply_fen,
      };
    }

    // 4. TRƯỜNG HỢP 3: Nước đi không nằm trong cây lời giải đúng ➔ Bại trận có đòn phản sát trực quan
    // Nếu ở nước mở màn (moveHistory rỗng), kiểm tra xem có bẫy định sẵn không
    if (moveHistory.length === 0 && solutionTree.traps && solutionTree.traps.length > 0) {
      const trap = solutionTree.traps.find(t => t?.wrong_move && t.wrong_move.toLowerCase() === cleanPlayerMove);
      if (trap) {
        return {
          status: 'DEFEAT',
          playerMove: cleanPlayerMove,
          computerReply: trap.punish_move || null,
          punishMove: trap.punish_move || null,
          defeatReason: trap.defeat_reason || 'Đại hiệp đã sa vào bẫy cờ giang hồ. Bại trận!',
        };
      }
    }

    // Tự động tìm nước phản sát thông minh của Đen để người chơi nhìn thấy rõ vì sao thua
    if (currentFen) {
      const uciStep = XiangqiRuleVerifier.uciToPos(cleanPlayerMove);
      if (uciStep) {
        const board = XiangqiRuleVerifier.parseFen(currentFen);
        const boardAfterPlayer = board.map(r => [...r]);
        boardAfterPlayer[uciStep.to.r][uciStep.to.c] = boardAfterPlayer[uciStep.from.r][uciStep.from.c];
        boardAfterPlayer[uciStep.from.r][uciStep.from.c] = null;

        // Nếu Đỏ vô tình chiếu bí Đen ngoài kịch bản
        if (XiangqiRuleVerifier.isCheckmate(boardAfterPlayer, 'BLACK')) {
          return {
            status: 'VICTORY',
            playerMove: cleanPlayerMove,
            isWin: true,
            winComment: 'Sát cục tuyệt diệu! Chúc mừng Đại hiệp đã phá giải kỳ trận!',
          };
        }

        const blackReply = BlackPuzzleAi.selectBestMove(boardAfterPlayer);
        if (blackReply) {
          const boardAfterBlack = boardAfterPlayer.map(r => [...r]);
          boardAfterBlack[blackReply.to.r][blackReply.to.c] = boardAfterBlack[blackReply.from.r][blackReply.from.c];
          boardAfterBlack[blackReply.from.r][blackReply.from.c] = null;
          const nextFen = XiangqiRuleVerifier.boardToFen(boardAfterBlack, 'RED');

          // Kiểm tra xem Đen có chiếu bí được Đỏ hay không
          const isRedMated = blackReply.isCheckmate || XiangqiRuleVerifier.isCheckmate(boardAfterBlack, 'RED');

          if (isRedMated) {
            return {
              status: 'DEFEAT',
              playerMove: cleanPlayerMove,
              computerReply: blackReply.uci,
              punishMove: blackReply.uci,
              defeatReason: `Đối phương tung đòn phản sát (${blackReply.uci}) chiếu bí Tướng Đỏ! Đại hiệp thất thủ.`,
              nextFen,
            };
          }

          // NẾU ĐEN CHƯA CHIẾU BÍ ĐƯỢC ĐỎ -> TIẾP TỤC CHO ĐỎ ĐÁNH TIẾP (CONTINUE)!
          return {
            status: 'CONTINUE',
            playerMove: cleanPlayerMove,
            computerReply: blackReply.uci,
            nextFen,
          };
        } else {
          // Đen không còn nước đi hợp lệ nào (Vây khốn / Stalemate) -> Đỏ thắng!
          return {
            status: 'VICTORY',
            playerMove: cleanPlayerMove,
            isWin: true,
            winComment: 'Vây khốn cửu cung! Đối phương hết nước đi, Đại hiệp đại thắng!',
          };
        }
      }
    }

    return {
      status: 'DEFEAT',
      playerMove: cleanPlayerMove,
      defeatReason: 'Nước đi không phải diệu thủ phá thế. Đối phương phản công chiếu bí. Bại trận!',
    };
  }
}
