import { XiangqiRuleVerifier } from '../../src/utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_verification_report.json'), 'utf8'));

for (const p of report.filter((x: any) => x.tier >= 2)) {
  const fen = p.fen.includes(' ') ? p.fen : `${p.fen} w - - 0 1`;
  const board = XiangqiRuleVerifier.parseFen(fen);
  const legalMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'RED');
  console.log(`\n--- Tier ${p.tier} #${p.id}: ${p.name} ---`);
  console.log('Win line description:', p.win_line);
  const checkMoves = [];
  for (const m of legalMoves) {
    const nextBoard = board.map(r => [...r]);
    nextBoard[m.to.r][m.to.c] = nextBoard[m.from.r][m.from.c];
    nextBoard[m.from.r][m.from.c] = null;
    const checksBlack = XiangqiRuleVerifier.isKingInCheck(nextBoard, 'BLACK');
    const matesBlack = XiangqiRuleVerifier.isCheckmate(nextBoard, 'BLACK');
    if (checksBlack) {
      checkMoves.push(`${m.uci}${matesBlack ? ' (CHECKMATE!)' : ' (Check)'}`);
    }
  }
  console.log('Checking moves for RED:', checkMoves.join(', '));
}
