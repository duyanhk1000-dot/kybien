import { XiangqiRuleVerifier } from '../../src/utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_verification_report.json'), 'utf8'));

console.log('Total puzzles in report:', report.length);
for (const p of report) {
  const fen = p.fen.includes(' ') ? p.fen : `${p.fen} w - - 0 1`;
  const parsed = XiangqiRuleVerifier.parseFen(fen);
  console.log(`[Tier ${p.tier}] #${p.id} ${p.name}: FEN parsed valid? ${!!parsed}`);
}
