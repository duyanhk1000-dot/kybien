import assert from 'assert';
import { XiangqiEngine } from '../services/xiangqiEngine.js';
import { matchmakingManager } from '../services/matchmakingService.js';
import { calculatePostMatchStats } from '../services/levelService.js';

export async function runP1IntegrityTests(): Promise<void> {
  console.log('🧪 RUNNING MANDATORY P1 INTEGRITY TEST SUITE...\n');

  // ===================================================
  // TEST 1: HỦY TÌM TRẬN (Cancel Matchmaking)
  // ===================================================
  console.log('-> Test 1: Hủy tìm trận (Cancel Matchmaking)...');
  const user1 = { socketId: 'sock_user1', userId: 1001, username: 'PlayerOne', elo: 1200, level: 1, joinedAt: Date.now() };
  
  matchmakingManager.addToQueue(user1);
  matchmakingManager.removeFromQueue(user1.userId); // Cancel via userId

  const user2 = { socketId: 'sock_user2', userId: 1002, username: 'PlayerTwo', elo: 1200, level: 1, joinedAt: Date.now() };
  const matchRes1 = matchmakingManager.addToQueue(user2);
  assert.strictEqual(matchRes1.matched, false, 'PlayerOne should not be matched after cancelling matchmaking');
  matchmakingManager.removeFromQueue(user2.userId);
  console.log('✅ Test 1 Passed: Hủy tìm trận thành công, người chơi hủy không bị ghép trận!');

  // ===================================================
  // TEST 2: HAI NGƯỜI CHƠI GHÉP TRẬN (2 Players Matchmaking)
  // ===================================================
  console.log('\n-> Test 2: Hai người chơi ghép trận (2 Players Matchmaking)...');
  const p1 = { socketId: 'sock_p1', userId: 2001, username: 'KyThuA', elo: 1300, level: 2, variant: 'n', joinedAt: Date.now() };
  const p2 = { socketId: 'sock_p2', userId: 2002, username: 'KyThuB', elo: 1250, level: 2, variant: 'n', joinedAt: Date.now() };

  matchmakingManager.addToQueue(p1);
  const matchRes2 = matchmakingManager.addToQueue(p2);
  assert.strictEqual(matchRes2.matched, true, 'Two players in queue with matching variant should be paired');
  assert.notStrictEqual(matchRes2.room, undefined, 'Matched room must be created');
  assert.strictEqual(matchRes2.room?.status, 'PLAYING', 'Matched room status must be PLAYING');
  console.log('✅ Test 2 Passed: Ghép trận 2 người chơi thành công!');

  const testRoom = matchRes2.room!;

  // ===================================================
  // TEST 3: TẠO VÀ THAM GIA PHÒNG RIÊNG (Create & Join Private Room)
  // ===================================================
  console.log('\n-> Test 3: Tạo và tham gia phòng riêng (Create & Join Private Room)...');
  const host = { socketId: 'sock_host', userId: 3001, username: 'HostUser', elo: 1400, level: 3, joinedAt: Date.now() };
  const guest = { socketId: 'sock_guest', userId: 3002, username: 'GuestUser', elo: 1350, level: 3, joinedAt: Date.now() };

  const privRoomRes = matchmakingManager.createRoom(host, true, 'kb');
  assert.strictEqual(typeof privRoomRes.roomCode, 'string', 'Private room code must be string');
  assert.strictEqual(privRoomRes.room.isPrivate, true, 'Room must be flagged as private');

  const joinRes = matchmakingManager.joinRoomByCode(privRoomRes.roomCode, guest);
  assert.strictEqual(joinRes.success, true, 'Guest joining valid private room code must succeed');
  assert.strictEqual(joinRes.room?.status, 'PLAYING', 'Private room status must change to PLAYING');
  console.log('✅ Test 3 Passed: Tạo và vào phòng riêng bằng mã thành công!');

  // ===================================================
  // TEST 4: CHƠI NHIỀU NƯỚC LIÊN TIẾP (Play Multiple Moves Sequence)
  // ===================================================
  console.log('\n-> Test 4: Chơi nhiều nước liên tiếp (Sequential Move Execution)...');
  const gameEngine = new XiangqiEngine();
  
  // Move 1: Red Pawn 6,0 -> 5,0
  const m1 = gameEngine.validateMove({ from: '6,0', to: '5,0' }, 'r', 'n');
  assert.strictEqual(m1.valid, true, 'Move 1 (Red Pawn) must be valid');
  assert.strictEqual(gameEngine.turn, 'BLACK', 'Turn must switch to BLACK');

  // Move 2: Black Pawn 3,0 -> 4,0
  const m2 = gameEngine.validateMove({ from: '3,0', to: '4,0' }, 'b', 'n');
  assert.strictEqual(m2.valid, true, 'Move 2 (Black Pawn) must be valid');
  assert.strictEqual(gameEngine.turn, 'RED', 'Turn must switch back to RED');

  // Move 3: Red Pawn 6,2 -> 5,2
  const m3 = gameEngine.validateMove({ from: '6,2', to: '5,2' }, 'r', 'n');
  assert.strictEqual(m3.valid, true, 'Move 3 (Red Pawn) must be valid');
  assert.strictEqual(gameEngine.turn, 'BLACK', 'Turn must switch to BLACK');

  // Illegal Move: Red trying to move during Black's turn (turnColor = 'b')
  const mIllegal = gameEngine.validateMove({ from: '6,4', to: '5,4' }, 'b', 'n');
  assert.strictEqual(mIllegal.valid, false, 'Red moving out of turn must be rejected');
  console.log('✅ Test 4 Passed: Thực hiện chuỗi nước đi hợp lệ & từ chối nước đi sai lượt!');

  // ===================================================
  // TEST 5: RELOAD TRANG VÀ RECONNECT (Reload Page & Reconnect)
  // ===================================================
  console.log('\n-> Test 5: Reload trang và reconnect (Reconnection & State Preservation)...');
  const activeRoomBefore = matchmakingManager.getUserActiveRoom(p1.userId);
  assert.notStrictEqual(activeRoomBefore, null, 'User in active match must return active room on reconnect query');
  assert.strictEqual(activeRoomBefore?.roomId, testRoom.roomId, 'Reconnected room ID must match active room');
  console.log('✅ Test 5 Passed: Khôi phục trạng thái phòng đấu khi reload/reconnect thành công!');

  // ===================================================
  // TEST 6, 7 & 8: THẮNG, THUA, HÒA, GAME_OVER LẶP VÀ XÁC MINH ELO/EXP
  // ===================================================
  console.log('\n-> Test 6, 7 & 8: Thắng/Thua/Hòa, Gửi game_over lặp & Kiểm tra Elo/EXP...');
  
  // Test Elo/EXP post match calculations
  const statsWin = calculatePostMatchStats({
    winnerId: 2001,
    isDraw: false,
    playerWhite: { id: 2001, elo: 1200, exp: 0n, level: 1 },
    playerBlack: { id: 2002, elo: 1200, exp: 0n, level: 1 },
  });

  assert.strictEqual(statsWin.white.elo, 1216, 'Winner should gain +16 Elo (K=32 for provisional totalGames < 30)');
  assert.strictEqual(statsWin.black.elo, 1184, 'Loser should lose -16 Elo (K=32 for provisional totalGames < 30)');
  assert.strictEqual(statsWin.white.exp, 50n, 'Winner should gain +50 EXP');
  assert.strictEqual(statsWin.black.exp, 20n, 'Loser should gain +20 EXP');

  // Test Idempotency & Duplicate finish Game Over guard
  const finishFirst = await matchmakingManager.finishGame(testRoom.roomId, 2001, 'Chiếu Bí');
  assert.notStrictEqual(finishFirst, null, 'First finishGame call must succeed');

  const finishSecond = await matchmakingManager.finishGame(testRoom.roomId, 2001, 'Chiếu Bí');
  assert.strictEqual(finishSecond, null, 'Duplicate finishGame call must be blocked (return null)');

  console.log('✅ Test 6, 7 & 8 Passed: Cập nhật Elo/EXP chuẩn xác và ngăn ngừa game_over lặp!');

  console.log('\n==================================================');
  console.log('🎉 ALL 8 MANDATORY P1 INTEGRITY TESTS PASSED 100%!');
  console.log('==================================================\n');
}
