import { PuzzleEngine } from '../services/puzzleEngine.js';

const fen = '3akab2/9/4c1N1n/9/9/9/5R3/1r2BA3/4Apr2/4K1B2 w - - 0 1';
const board = PuzzleEngine.fenToBoard(fen);

console.log('=== BOARD GRID FOR PUZZLE #3 ===');
console.log('    a b c d e f g h i');
for (let r = 0; r < 10; r++) {
  const rank = 9 - r;
  const line = board[r].map(c => c || '.').join(' ');
  console.log(`${r} (${rank}): ${line}`);
}

console.log('\n=== PIECE LIST ===');
for (let r = 0; r < 10; r++) {
  for (let c = 0; c < 9; c++) {
    const p = board[r][c];
    if (p) {
      const file = String.fromCharCode('a'.charCodeAt(0) + c);
      const rank = 9 - r;
      const isRed = p === p.toUpperCase();
      console.log(`${isRed ? 'RED  ' : 'BLACK'} ${p} at ${file}${rank} (matrix row=${r}, col=${c})`);
    }
  }
}
