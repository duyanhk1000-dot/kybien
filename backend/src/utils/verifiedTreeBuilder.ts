import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import { SolutionTree, SolutionNode, ComputerReplyNode } from '../services/puzzleEngine.js';

/**
 * Xây dựng danh sách các node đáp trả của Đen và phản công đệ quy của Đỏ cho mọi độ sâu (depth 3, 5, 7)
 */
function buildReplyNodes(
  boardAfterRed: (string | null)[][],
  replies: any[],
  orderIndex: number
): ComputerReplyNode[] {
  const replyNodes: ComputerReplyNode[] = [];

  for (const rep of replies) {
    const pRep = XiangqiRuleVerifier.uciToPos(rep.reply)!;
    const boardAfterBlack = XiangqiRuleVerifier.applyMove(boardAfterRed, pRep.from, pRep.to);
    const replyFen = XiangqiRuleVerifier.boardToFen(boardAfterBlack, 'RED');

    const nextMoves: SolutionNode[] = [];
    if (rep.counter) {
      const pCounter = XiangqiRuleVerifier.uciToPos(rep.counter)!;
      const boardAfterCounter = XiangqiRuleVerifier.applyMove(boardAfterBlack, pCounter.from, pCounter.to);

      if (rep.sub && rep.sub.length > 0) {
        // Vẫn còn các nhánh đáp trả tiếp theo của Đen (Depth 5 hoặc 7)
        nextMoves.push({
          move: rep.counter,
          is_correct: true,
          replies: buildReplyNodes(boardAfterCounter, rep.sub, orderIndex),
        });
      } else {
        // Node lá: Nước kết liễu chiến thắng (Chiếu Bí / Hết nước đi)
        nextMoves.push({
          move: rep.counter,
          is_correct: true,
          is_win: true,
          win_comment: `Diệu thủ hoàn tất sát cục! Đại hiệp phá giải thành công Ải #${orderIndex}!`,
        });
      }
    }

    replyNodes.push({
      reply_move: rep.reply,
      reply_fen: replyFen,
      next_moves: nextMoves,
    });
  }

  return replyNodes;
}

/**
 * Xây dựng SolutionTree hoàn chỉnh cho một thế cờ từ dữ liệu verified trees
 */
export function buildVerifiedSolutionTree(orderIndex: number, rawFen: string, treeData: any): SolutionTree {
  const rootFen = rawFen.includes(' ') ? rawFen : `${rawFen} w - - 0 1`;
  const board = XiangqiRuleVerifier.parseFen(rootFen);

  // Tạo bẫy trừng phạt nếu người chơi không đi nước giải
  const legalMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'RED');
  const blunder = legalMoves.find(m => m.uci !== treeData.move);
  const traps: any[] = [];
  if (blunder) {
    traps.push({
      wrong_move: blunder.uci,
      punish_move: null,
      defeat_reason: 'Nước đi không phải sát thủ quyết định. Đại hiệp đã thất thủ!'
    });
  }

  // 1. Nếu là puzzle chiếu bí ngay nước 1 (như #3 hoặc #4)
  if (!treeData.replies || treeData.replies.length === 0) {
    return {
      root_fen: rootFen,
      branches: [
        {
          move: treeData.move,
          is_correct: true,
          is_win: true,
          win_comment: `Sát cục thần tốc! Tuyệt kỹ phá thế tại Ải #${orderIndex} thành công!`
        }
      ],
      traps
    };
  }

  // 2. Nếu là puzzle có nước đáp trả của máy (Depth 3, 5, 7)
  const p1 = XiangqiRuleVerifier.uciToPos(treeData.move)!;
  const b1 = XiangqiRuleVerifier.applyMove(board, p1.from, p1.to);
  const replyNodes = buildReplyNodes(b1, treeData.replies, orderIndex);

  return {
    root_fen: rootFen,
    branches: [
      {
        move: treeData.move,
        is_correct: true,
        replies: replyNodes
      }
    ],
    traps
  };
}
