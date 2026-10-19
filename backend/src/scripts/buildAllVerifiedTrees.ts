import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

interface SearchResult {
  won: boolean;
  move?: string;
  isMate?: boolean;
  replies?: {
    reply: string;
    counter?: string;
    sub?: any;
  }[];
}

function solveCheckLines(
  board: (string | null)[][],
  turn: 'RED' | 'BLACK',
  ply: number,
  maxPly: number
): SearchResult {
  if (turn === 'RED') {
    if (XiangqiRuleVerifier.isCheckmate(board, 'BLACK')) {
      return { won: true, isMate: true };
    }
    if (ply >= maxPly) return { won: false };

    const redMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'RED');
    const checks = redMoves.filter(m => {
      const b2 = XiangqiRuleVerifier.applyMove(board, m.from, m.to);
      return XiangqiRuleVerifier.isKingInCheck(b2, 'BLACK');
    });

    const candidates = checks.length > 0 ? checks : redMoves;

    for (const m of candidates) {
      const b2 = XiangqiRuleVerifier.applyMove(board, m.from, m.to);
      if (XiangqiRuleVerifier.isCheckmate(b2, 'BLACK')) {
        return { won: true, move: m.uci, isMate: true };
      }

      if (ply + 1 < maxPly) {
        const res = solveCheckLines(b2, 'BLACK', ply + 1, maxPly);
        if (res.won) {
          return { won: true, move: m.uci, replies: res.replies };
        }
      }
    }
    return { won: false };
  } else {
    if (XiangqiRuleVerifier.isCheckmate(board, 'BLACK')) {
      return { won: true, isMate: true };
    }

    const blackMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'BLACK');
    if (blackMoves.length === 0) {
      return { won: true, isMate: true };
    }

    const replies: { reply: string; counter?: string; sub?: any }[] = [];

    for (const bm of blackMoves) {
      const b2 = XiangqiRuleVerifier.applyMove(board, bm.from, bm.to);
      if (XiangqiRuleVerifier.isCheckmate(b2, 'RED')) {
        return { won: false };
      }

      const res = solveCheckLines(b2, 'RED', ply + 1, maxPly);
      if (!res.won) {
        return { won: false };
      }

      replies.push({
        reply: bm.uci,
        counter: res.move,
        sub: res.replies
      });
    }

    return { won: true, replies };
  }
}

async function main() {
  console.log('🌳 [TREE BUILDER] TÍNH TOÁN CÂY LỜI GIẢI ĐƯỢC XÁC MINH 100% CHO 30 FIXTURE...\n');

  const jsonPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_tier1_easy.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const results: Record<number, any> = {};

  for (let i = 1; i <= 30; i++) {
    const rawFen = rawData[i.toString()];
    if (!rawFen) continue;

    const board = XiangqiRuleVerifier.parseFen(rawFen);
    let found: { depth: number; res: SearchResult } | null = null;

    for (const depth of [1, 3, 5, 7]) {
      const res = solveCheckLines(board, 'RED', 0, depth);
      if (res.won && res.move) {
        found = { depth, res };
        break;
      }
    }

    if (found) {
      results[i] = {
        index: i,
        depth: found.depth,
        move: found.res.move,
        isMate: !!found.res.isMate,
        replies: found.res.replies || []
      };
      console.log(`Ải #${i.toString().padStart(2, '0')}: Depth=${found.depth}, Move=${found.res.move}, isMate=${found.res.isMate}, Replies=${found.res.replies?.length || 0}`);
    } else {
      results[i] = {
        index: i,
        status: 'BLOCKED',
        reason: 'Không tìm thấy lời giải sát cục cưỡng bức <= 7 plies'
      };
      console.log(`Ải #${i.toString().padStart(2, '0')}: [BLOCKED] Không có lời giải xác minh`);
    }
  }

  const outPath = path.join(process.cwd(), 'all_verified_trees.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n💾 Đã lưu toàn bộ cây lời giải vào ${outPath}`);
}

main().catch(console.error);
