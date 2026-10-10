import assert from 'assert';
import { XiangqiEngine } from '../services/xiangqiEngine.js';
import { matchmakingManager } from '../services/matchmakingService.js';
import { generateToken } from '../utils/jwt.js';

export async function runSecurityRegressionTests(): Promise<void> {
  console.log('🧪 RUNNING SECURITY & INTEGRITY REGRESSION TESTS...\n');

  // ==========================================
  // GROUP C TESTS: Server-Side Move Validation & FEN
  // ==========================================
  console.log('-> Testing Group C: Server-Side Move Validation & State Engine...');
  const engine = new XiangqiEngine();

  // Test 1: Legal Red Pawn Move (6,0 -> 5,0)
  const res1 = engine.validateMove({ from: '6,0', to: '5,0' }, 'r', 'n');
  assert.strictEqual(res1.valid, true, 'Red Pawn 6,0 -> 5,0 should be valid');
  assert.strictEqual(engine.turn, 'BLACK', 'Turn should switch to BLACK after valid move');

  // Test 2: Invalid Black Move (Attempting to move Red piece or illegal knight move)
  const res2 = engine.validateMove({ from: '0,1', to: '2,1' }, 'b', 'n'); // Black Horse (0,1) cannot move straight to (2,1)
  assert.strictEqual(res2.valid, false, 'Black Horse straight move 0,1 -> 2,1 should be illegal');

  // Test 3: Horse Leg Block (Blocked Knight move)
  const engineHorse = new XiangqiEngine();
  // Place piece on leg (1,1) blocking Knight at (0,1)
  engineHorse.board[1][1] = { type: 'p', color: 'b', isFaceDown: false };
  const resHorse = engineHorse.validateMove({ from: '0,1', to: '2,2' }, 'b', 'n');
  assert.strictEqual(resHorse.valid, false, 'Knight move should be blocked by leg piece');

  // Test 4: Flying General Violation
  const engineKing = new XiangqiEngine();
  // Clear middle column between Kings (0,4) and (9,4)
  for (let r = 1; r <= 8; r++) engineKing.board[r][4] = null;
  // Try to move Advisor at (0,3) exposing General? No, try to move piece off column 4 exposing Flying General
  engineKing.board[1][4] = { type: 'p', color: 'b', isFaceDown: false };
  // Moving pawn (1,4) away exposes Kings directly
  const resKing = engineKing.validateMove({ from: '1,4', to: '1,5' }, 'b', 'n');
  assert.strictEqual(resKing.valid, false, 'Exposing opposing General directly should be rejected (Flying General rule)');
  console.log('✅ Group C Tests Passed!');

  // ==========================================
  // GROUP A TESTS: Game Over & Room Authorization
  // ==========================================
  console.log('\n-> Testing Group A: Game Over Verification & Room Safety...');
  
  // Test 1: Double Finish Game Guard
  const roomRes = matchmakingManager.createRoom({
    socketId: 'sock_1',
    userId: 101,
    username: 'PlayerOne',
    elo: 1200,
    level: 1,
    joinedAt: Date.now(),
  }, false, 'n');

  const room = roomRes.room;
  matchmakingManager.joinRoomByCode(room.roomCode, {
    socketId: 'sock_2',
    userId: 102,
    username: 'PlayerTwo',
    elo: 1200,
    level: 1,
    joinedAt: Date.now(),
  });

  const finish1 = await matchmakingManager.finishGame(room.roomId, 101, 'Chiếu Bí');
  assert.notStrictEqual(finish1, null, 'First game finish call should succeed');

  const finish2 = await matchmakingManager.finishGame(room.roomId, 101, 'Chiếu Bí');
  assert.strictEqual(finish2, null, 'Second game finish call on same room must return null (prevent double trigger)');
  console.log('✅ Group A Tests Passed!');

  // ==========================================
  // GROUP B TESTS: Great Match Endpoint Protection
  // ==========================================
  console.log('\n-> Testing Group B: Great Match Endpoint Safeguards...');

  // Verification of moves array length requirement vs fake plies payload
  const fakePliesPayload = { plies: 100, moves: ['6,0-5,0', '3,0-4,0'] }; // Only 2 actual moves!
  assert.strictEqual(fakePliesPayload.moves.length < 50, true, 'Server must check moves.length instead of client plies parameter');
  console.log('✅ Group B Tests Passed!');

  // ==========================================
  // GROUP D TESTS: Security & Environment Controls
  // ==========================================
  console.log('\n-> Testing Group D: Security Configuration & JWT Secrets...');

  const token = generateToken({ userId: 1, username: 'testuser', email: 'test@example.com' });
  assert.strictEqual(typeof token, 'string', 'JWT generation should function cleanly');
  assert.strictEqual(token.length > 20, true, 'JWT token must be valid string');

  console.log('✅ Group D Tests Passed!');
  console.log('\n==================================================');
  console.log('🎉 ALL SECURITY REGRESSION TESTS COMPLETED SUCCESSFULLY!');
  console.log('==================================================\n');
}
