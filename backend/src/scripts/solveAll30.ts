import { XiangqiRuleVerifier, BoardPos } from '../utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

export interface SolvedMoveNode {
  move: string;
  isWin?: boolean;
  replies?: {
    replyMove: string;
    nextMove?: SolvedMoveNode;
  }[];
}

/**
 * Tìm kiếm nước đi chiến thắng cho Đỏ (Red forced win / checkmate solver)
 * maxDepth: số nửa nước (ply), ví dụ maxDepth=3 là: Đỏ đi -> Đen đi -> Đỏ chiếu bí.
 */
function solveForcedMate(
  board: (string | null)[][],
  turn: 'RED' | 'BLACK',
  ply: number,
  maxPly: number
): { won: boolean; moveUci?: string; replies?: { reply: string; counter?: any }[] } {
  if (turn === 'RED') {
    // Nếu Đen đã bị chiếu bí từ trước
    if (XiangqiRuleVerifier.isCheckmate(board, 'BLACK')) {
      return { won: true };
    }
    if (ply >= maxPly) {
      return { won: false };
    }

    // Đỏ đi: Tìm nước đi buộc thắng
    const redMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'RED');

    // Ưu tiên các nước chiếu tướng
    const checkingMoves = redMoves.filter(m => {
      const b2 = XiangqiRuleVerifier.applyMove(board, m.from, m.to);
      return XiangqiRuleVerifier.isKingInCheck(b2, 'BLACK');
    });

    // Thử các nước chiếu trước, sau đó các nước khác nếu ít quân
    const candidates = checkingMoves.length > 0 ? checkingMoves : redMoves;

    for (const m of candidates) {
      const b2 = XiangqiRuleVerifier.applyMove(board, m.from, m.to);

      // Nếu nước này chiếu bí Đen ngay lập tức
      if (XiangqiRuleVerifier.isCheckmate(b2, 'BLACK')) {
        return { won: true, moveUci: m.uci };
      }

      // Nếu chưa chiếu bí, Đen phải đáp trả ở ply tiếp theo
      if (ply + 1 < maxPly) {
        const blackResponse = solveForcedMate(b2, 'BLACK', ply + 1, maxPly);
        if (blackResponse.won) {
          return {
            won: true,
            moveUci: m.uci,
            replies: blackResponse.replies
          };
        }
      }
    }
    return { won: false };
  } else {
    // Đen đi: Để Đỏ thắng cưỡng bức, MỌI nước đi hợp lệ của Đen đều phải dẫn đến Đỏ thắng!
    if (XiangqiRuleVerifier.isCheckmate(board, 'BLACK')) {
      return { won: true };
    }

    const blackMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'BLACK');
    if (blackMoves.length === 0) {
      return { won: true }; // Đen hết nước đi -> Đỏ thắng
    }

    const repliesList: { reply: string; counter?: any }[] = [];

    for (const bm of blackMoves) {
      const b2 = XiangqiRuleVerifier.applyMove(board, bm.from, bm.to);

      // Nếu sau nước đi của Đen, Tướng Đỏ bị chiếu hoặc Đen phản công thắng -> Đỏ thất bại
      if (XiangqiRuleVerifier.isCheckmate(b2, 'RED')) {
        return { won: false };
      }

      const redReply = solveForcedMate(b2, 'RED', ply + 1, maxPly);
      if (!redReply.won) {
        // Đen tìm được 1 nước thoát hiểm -> Nhánh này Đỏ không thắng cưỡng bức
        return { won: false };
      }

      repliesList.push({
        reply: bm.uci,
        counter: redReply.moveUci
      });
    }

    return { won: true, replies: repliesList };
  }
}

async function runSolver() {
  console.log('🤖 [SOLVER] BẮT ĐẦU GIẢI CƯỠNG BỨC SÁT CỤC CHO 30 FIXTURE...\n');

  const jsonPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_tier1_easy.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const results: any[] = [];

  for (let i = 1; i <= 30; i++) {
    const rawFen = rawData[i.toString()];
    if (!rawFen) continue;

    const board = XiangqiRuleVerifier.parseFen(rawFen);

    // Thử giải từ 1 nước (ply 1), 3 nước (ply 3), đến 5 nước (ply 5)
    let solved = false;
    let solutionData: any = null;
    let depthUsed = 0;

    for (const maxPly of [1, 3, 5]) {
      const sol = solveForcedMate(board, 'RED', 0, maxPly);
      if (sol.won && sol.moveUci) {
        solved = true;
        solutionData = sol;
        depthUsed = maxPly;
        break;
      }
    }

    if (solved) {
      console.log(`✅ Ải #${i.toString().padStart(2, '0')}: GIẢI THÀNH CÔNG (Độ sâu ${depthUsed} ply) -> Nước 1: ${solutionData.moveUci}`);
      if (solutionData.replies) {
        console.log(`   Đáp trả của Đen: ${JSON.stringify(solutionData.replies)}`);
      }
      results.push({
        index: i,
        fen: rawFen,
        status: 'VERIFIED',
        depth: depthUsed,
        move1: solutionData.moveUci,
        replies: solutionData.replies || null
      });
    } else {
      console.log(`⚠️ Ải #${i.toString().padStart(2, '0')}: KHÔNG TÌM THẤY SÁT CỤC CƯỠNG BỨC <= 5 ply -> Đánh dấu BLOCKED`);
      results.push({
        index: i,
        fen: rawFen,
        status: 'BLOCKED',
        reason: 'Không có lời giải sát cục cưỡng bức đã xác minh trong giới hạn 5 ply'
      });
    }
  }

  fs.writeFileSync('solved_fixtures_30.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n📄 Đã lưu kết quả solver vào solved_fixtures_30.json');
}

runSolver().catch(console.error);
