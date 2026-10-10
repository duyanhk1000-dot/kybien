import assert from 'assert';
import { XiangqiEngine } from '../services/xiangqiEngine.js';

export async function runVariantEngineTests(): Promise<void> {
  console.log('🧪 RUNNING VARIANT ENGINE & EXTENDED REGRESSION TESTS...\n');

  // 1. Variant 'n' (Standard Xiangqi)
  console.log('-> Testing Variant n (Standard Xiangqi)...');
  const engineN = new XiangqiEngine(undefined, 'n');
  assert.strictEqual(engineN.turn, 'RED');

  // Legal Red Pawn move (6,0 -> 5,0)
  const resN1 = engineN.validateMove({ from: '6,0', to: '5,0' }, 'r', 'n');
  assert.strictEqual(resN1.valid, true);
  assert.strictEqual(engineN.turn, 'BLACK');

  // Illegal Elephant crossing river in variant 'n'
  const engineN2 = new XiangqiEngine(undefined, 'n');
  // Elephant at (9,2) trying to move to (3,2)? (9,2 -> 7,4 -> 5,2 -> 3,4 across river)
  engineN2.board[7][4] = null; // Clear eye
  const resCrossRiver = engineN2.validateMove({ from: '9,2', to: '4,4' }, 'r', 'n');
  assert.strictEqual(resCrossRiver.valid, false, 'Elephant crossing river in variant n must be invalid');

  // 2. Variant 'kb' (Cờ Kỳ Biến)
  console.log('-> Testing Variant kb (Cờ Kỳ Biến)...');
  const engineKB = new XiangqiEngine(undefined, 'kb');
  // CARD action should be valid
  const resCard = engineKB.validateMove({ from: 'CARD:CANNON_2->2,1', to: '' }, 'r', 'kb');
  assert.strictEqual(resCard.valid, true);

  // 3. Variant 't' (Cờ Úp Truyền Thống)
  console.log('-> Testing Variant t (Cờ Úp)...');
  const engineT = new XiangqiEngine(undefined, 't');
  // FLIP action on face-down piece at 6,0
  const resFlip = engineT.validateMove({ from: 'FLIP:6,0->c', to: '' }, 'r', 't');
  assert.strictEqual(resFlip.valid, true);
  assert.strictEqual(engineT.board[6][0]?.isFaceDown, false);

  // 4. Variant 'g' (Cờ Úp Gián Điệp)
  console.log('-> Testing Variant g (Cờ Úp Gián Điệp)...');
  const piecesList = ['r','r','n','n','b','b','a','a','c','c','p','p','p','p','p'];
  const redPieces = piecesList.map((t, i) => i === 0 ? { t, col: 'b' } : { t, col: 'r' });
  const blackPieces = piecesList.map((t) => ({ t, col: 'b' }));
  const initialPiecesG = { red: redPieces, black: blackPieces };

  const engineG = new XiangqiEngine(undefined, 'g', initialPiecesG);
  assert.strictEqual(engineG.board[9][0]?.realColor, 'b', 'Spy piece should preserve real color in variant g');

  // 5. Security & Invalid Payload Tests
  console.log('-> Testing Malformed Payloads & Invalid Inputs...');
  const engineErr = new XiangqiEngine();
  const resMalformed = engineErr.validateMove({ from: 'invalid_coord', to: 'xyz' }, 'r', 'n');
  assert.strictEqual(resMalformed.valid, false);

  const resWrongTurn = engineErr.validateMove({ from: '6,0', to: '5,0' }, 'b', 'n'); // Black trying to move Red piece
  assert.strictEqual(resWrongTurn.valid, false, 'Wrong turn color must be rejected');

  console.log('✅ All Variant Engine & Extended Tests Passed Successfully!');
}
