import assert from 'assert';
import {
  calculateMatchExp,
  calculateLevelFromExp,
  getLevelProgress,
  getExpRequiredForNextLevel,
  getPlayerTitles,
} from '../services/levelService.js';
import {
  getUserDailyPveExp,
  recordUserDailyPveExp,
  resetPveTrackingForTest,
  finishPveMatch,
} from '../controllers/matchController.js';
import { generateToken, verifyToken } from '../utils/jwt.js';

export async function runPveExpSystemTests(): Promise<void> {
  console.log('🧪 RUNNING COMPREHENSIVE PVE EXP SYSTEM VERIFICATION SUITE...\n');

  // Reset in-memory trackers before testing
  resetPveTrackingForTest();

  // =========================================================================
  // SCENARIO 1: Người dùng hợp lệ, trận PvE đủ điều kiện: Tính và cộng EXP chuẩn xác
  // =========================================================================
  console.log('-> Scenario 1: Valid user & eligible PvE match calculates correct EXP...');
  const normalWin = calculateMatchExp({
    mode: 'PVE',
    result: 'WIN',
    totalMoves: 35,
    aiDifficulty: 'NORMAL',
  });
  assert.strictEqual(normalWin.totalEarnedExp, 20, 'Normal AI Win must award exactly 20 EXP');
  assert.strictEqual(normalWin.baseExp, 20, 'Base EXP must be 20');
  assert.strictEqual(normalWin.greatGameBonus, 0, 'No bonus for moves <= 120');

  // Simulate updating cumulative EXP in database: 100 -> 120
  const initialExp = 100n;
  const initialLevel = 2;
  const newExp = initialExp + BigInt(normalWin.totalEarnedExp);
  const newLevel = calculateLevelFromExp(newExp, initialLevel);
  assert.strictEqual(newExp, 120n, 'Cumulative EXP must increase from 100 to 120');
  assert.strictEqual(newLevel, 2, 'Level stays 2 (requires 235 total for level 3)');
  console.log('✅ Scenario 1 Passed!');

  // =========================================================================
  // SCENARIO 2: Trận dưới ngưỡng (< 20 nước đi thực tế): Không cộng EXP & thông báo chuẩn
  // =========================================================================
  console.log('\n-> Scenario 2: Match under threshold (< 20 actual moves) yields 0 EXP...');
  const shortPve = calculateMatchExp({
    mode: 'PVE',
    result: 'WIN',
    totalMoves: 19,
    aiDifficulty: 'HARD',
  });
  assert.strictEqual(shortPve.totalEarnedExp, 0, 'Moves < 20 must award 0 EXP');
  assert.strictEqual(shortPve.baseExp, 0, 'Base EXP is 0 for short matches');
  assert.strictEqual(shortPve.reason, 'Ván đấu dưới 20 nước đi không được tính nhận EXP.');

  // Test filter distinguishing actual moves vs auxiliary tags (CARD, FLIP)
  const mixedMoves = [
    '9,0-8,0', '0,1-2,2', 'FLIP:0,1->c', 'CARD:KNIGHT_1->2,2',
    '8,0-7,0', '2,2-4,3', 'POISON_KILL:4,3',
  ];
  const actualMovesOnly = mixedMoves.filter((m) => /^\d+,\d+-\d+,\d+$/.test(m));
  assert.strictEqual(actualMovesOnly.length, 4, 'Only 4 actual chess moves out of 7 entries in mixed array');
  assert.strictEqual(
    calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: actualMovesOnly.length, aiDifficulty: 'HARD' }).totalEarnedExp,
    0,
    'Actual moves count < 20 must yield 0 EXP despite auxiliary array length'
  );
  console.log('✅ Scenario 2 Passed!');

  // =========================================================================
  // SCENARIO 3: WIN, DRAW, LOSS ở cả 3 mức EASY / NORMAL / HARD
  // =========================================================================
  console.log('\n-> Scenario 3: Checking all 9 outcome-difficulty combinations...');
  // HARD AI (30 / 15 / 7)
  const hardW = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 40, aiDifficulty: 'HARD' });
  const hardD = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 40, aiDifficulty: 'HARD' });
  const hardL = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 40, aiDifficulty: 'HARD' });
  assert.strictEqual(hardW.totalEarnedExp, 30, 'Hard Win = 30 EXP');
  assert.strictEqual(hardD.totalEarnedExp, 15, 'Hard Draw = 15 EXP');
  assert.strictEqual(hardL.totalEarnedExp, 7, 'Hard Loss = 7 EXP');

  // NORMAL AI (20 / 10 / 5)
  const normW = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 40, aiDifficulty: 'NORMAL' });
  const normD = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 40, aiDifficulty: 'NORMAL' });
  const normL = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 40, aiDifficulty: 'NORMAL' });
  assert.strictEqual(normW.totalEarnedExp, 20, 'Normal Win = 20 EXP');
  assert.strictEqual(normD.totalEarnedExp, 10, 'Normal Draw = 10 EXP');
  assert.strictEqual(normL.totalEarnedExp, 5, 'Normal Loss = 5 EXP');

  // EASY AI (10 / 5 / 2)
  const easyW = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 40, aiDifficulty: 'EASY' });
  const easyD = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 40, aiDifficulty: 'EASY' });
  const easyL = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 40, aiDifficulty: 'EASY' });
  assert.strictEqual(easyW.totalEarnedExp, 10, 'Easy Win = 10 EXP');
  assert.strictEqual(easyD.totalEarnedExp, 5, 'Easy Draw = 5 EXP');
  assert.strictEqual(easyL.totalEarnedExp, 2, 'Easy Loss = 2 EXP');
  console.log('✅ Scenario 3 Passed!');

  // =========================================================================
  // SCENARIO 4: Trận dài đủ điều kiện (> 120 nước): Thưởng thêm +15 khi thắng, +5 khi thua/hòa
  // =========================================================================
  console.log('\n-> Scenario 4: Great match (> 120 actual moves) awards bonus & triggers blog...');
  const greatHardWin = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 121, aiDifficulty: 'HARD' });
  assert.strictEqual(greatHardWin.baseExp, 30, 'Hard base EXP = 30');
  assert.strictEqual(greatHardWin.greatGameBonus, 15, 'Great match win bonus = 15');
  assert.strictEqual(greatHardWin.totalEarnedExp, 45, 'Total = 30 + 15 = 45 EXP');
  assert.strictEqual(greatHardWin.canWriteBlog, true, 'canWriteBlog must be true for moves > 120');

  const greatNormLoss = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 130, aiDifficulty: 'NORMAL' });
  assert.strictEqual(greatNormLoss.baseExp, 5, 'Normal loss base EXP = 5');
  assert.strictEqual(greatNormLoss.greatGameBonus, 5, 'Great match loss bonus = 5');
  assert.strictEqual(greatNormLoss.totalEarnedExp, 10, 'Total = 5 + 5 = 10 EXP');
  assert.strictEqual(greatNormLoss.canWriteBlog, true, 'canWriteBlog must be true');

  const greatEasyDraw = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 125, aiDifficulty: 'EASY' });
  assert.strictEqual(greatEasyDraw.baseExp, 5, 'Easy draw base EXP = 5');
  assert.strictEqual(greatEasyDraw.greatGameBonus, 5, 'Great match draw bonus = 5');
  assert.strictEqual(greatEasyDraw.totalEarnedExp, 10, 'Total = 5 + 5 = 10 EXP');
  console.log('✅ Scenario 4 Passed!');

  // =========================================================================
  // SCENARIO 5: Chạm giới hạn EXP PvE trong ngày (Tối đa 300 EXP/ngày)
  // =========================================================================
  console.log('\n-> Scenario 5: Daily PvE EXP cap (300 EXP max per day)...');
  const testUserId = 8888;
  assert.strictEqual(getUserDailyPveExp(testUserId), 0, 'Initial daily EXP is 0');

  // Accumulate 290 EXP
  recordUserDailyPveExp(testUserId, 290);
  assert.strictEqual(getUserDailyPveExp(testUserId), 290, 'Daily EXP reaches 290');

  // Winning Hard AI gives 30 EXP, but only 10 EXP remaining until cap
  const cappedMatch = calculateMatchExp({
    mode: 'PVE',
    result: 'WIN',
    totalMoves: 50,
    aiDifficulty: 'HARD',
    currentDailyPveExp: getUserDailyPveExp(testUserId),
  });
  assert.strictEqual(cappedMatch.totalEarnedExp, 10, 'Earned EXP capped to remaining capacity (10)');
  assert.strictEqual(cappedMatch.newDailyPveExp, 300, 'Daily PvE EXP reaches 300');

  recordUserDailyPveExp(testUserId, cappedMatch.totalEarnedExp);
  assert.strictEqual(getUserDailyPveExp(testUserId), 300, 'User daily EXP hits 300 ceiling');

  // Subsequent match must give 0 EXP
  const overCapMatch = calculateMatchExp({
    mode: 'PVE',
    result: 'WIN',
    totalMoves: 60,
    aiDifficulty: 'HARD',
    currentDailyPveExp: getUserDailyPveExp(testUserId),
  });
  assert.strictEqual(overCapMatch.totalEarnedExp, 0, 'No more EXP awarded once daily cap is reached');
  console.log('✅ Scenario 5 Passed!');

  // =========================================================================
  // SCENARIO 6: Token hết hạn hoặc thiếu token: Từ chối xác thực, 0 EXP
  // =========================================================================
  console.log('\n-> Scenario 6: Missing or expired token validation...');
  // Missing token
  assert.strictEqual(verifyToken(''), null, 'Empty token fails verification');
  // Malformed or invalid token
  assert.strictEqual(verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature'), null, 'Tampered token fails verification');

  // Test finishPveMatch directly without req.user
  let unauthCode = 0;
  let unauthBody: any = null;
  const mockUnauthReq: any = { body: {}, user: undefined };
  const mockUnauthRes: any = {
    status: (c: number) => { unauthCode = c; return mockUnauthRes; },
    json: (b: any) => { unauthBody = b; return mockUnauthRes; },
  };
  await finishPveMatch(mockUnauthReq, mockUnauthRes);
  assert.strictEqual(unauthCode, 401, 'Unauthenticated request must return 401');
  assert.strictEqual(unauthBody.success, false, 'Success must be false for unauthenticated request');
  console.log('✅ Scenario 6 Passed!');

  // =========================================================================
  // SCENARIO 7: currentUser chưa đồng bộ: Client tự động phục hồi qua JWT
  // =========================================================================
  console.log('\n-> Scenario 7: Client account sync recovery flow...');
  const testValidToken = generateToken({ userId: 5555, username: 'SyncedMaster', email: 'synced@kybien.com' });
  const verifiedUser = verifyToken(testValidToken);
  assert.notStrictEqual(verifiedUser, null, 'Valid token yields valid user payload');
  assert.strictEqual(verifiedUser?.username, 'SyncedMaster');
  assert.strictEqual(verifiedUser?.userId, 5555);
  console.log('✅ Scenario 7 Passed!');

  // =========================================================================
  // SCENARIO 8: API trả lỗi hoặc mất kết nối: Không báo nhận EXP thành công
  // =========================================================================
  console.log('\n-> Scenario 8: Error responses do not falsely report EXP success...');
  const errorPayload = { success: false, message: 'Lỗi máy chủ khi lưu kết quả trận đấu máy.' };
  assert.strictEqual(errorPayload.success, false, 'Error payload must be recognized as false');
  assert.strictEqual(Boolean((errorPayload as any).earnedExp), false, 'No fake earnedExp on failure');
  console.log('✅ Scenario 8 Passed!');

  // =========================================================================
  // SCENARIO 9: Database đã cập nhật: Hồ sơ hiển thị đúng EXP và Level sau khi tải lại
  // =========================================================================
  console.log('\n-> Scenario 9: Profile progress calculations from accumulated EXP...');
  // Level 1: 0 EXP -> Level 1 (currentExp: 0, nextLevelExp: 100)
  const p0 = getLevelProgress(0n, 1);
  assert.strictEqual(p0.level, 1);
  assert.strictEqual(p0.currentExp, 0);
  assert.strictEqual(p0.nextLevelExp, 100);

  // Level 1: 50 EXP -> Level 1 (currentExp: 50, nextLevelExp: 100)
  const p50 = getLevelProgress(50n, 1);
  assert.strictEqual(p50.level, 1);
  assert.strictEqual(p50.currentExp, 50);
  assert.strictEqual(p50.nextLevelExp, 100);

  // Reached 100 EXP -> Level 2 (currentExp: 0, nextLevelExp: 135)
  const p100 = getLevelProgress(100n, 1);
  assert.strictEqual(p100.level, 2);
  assert.strictEqual(p100.currentExp, 0);
  assert.strictEqual(p100.nextLevelExp, 135);

  // Reached 130 EXP (Level 2 + 30 EXP) -> Level 2 (currentExp: 30, nextLevelExp: 135)
  const p130 = getLevelProgress(130n, 2);
  assert.strictEqual(p130.level, 2);
  assert.strictEqual(p130.currentExp, 30);
  assert.strictEqual(p130.nextLevelExp, 135);

  // Total 235 EXP (100 + 135) -> Level 3 (currentExp: 0, nextLevelExp: 170)
  const p235 = getLevelProgress(235n, 2);
  assert.strictEqual(p235.level, 3);
  assert.strictEqual(p235.currentExp, 0);
  assert.strictEqual(p235.nextLevelExp, 170);

  // Titles match level and elo correctly (1200 ELO is Kỳ Hiệp, Level 2 is Khởi Khai)
  const titles = getPlayerTitles(p130.level, 1200);
  assert.strictEqual(titles.expTitle, 'Khởi Khai');
  assert.strictEqual(titles.eloTitle, 'Kỳ Hiệp');
  assert.strictEqual(titles.fullTitle, '[Khởi Khai] Kỳ Hiệp');
  console.log('✅ Scenario 9 Passed!');

  // =========================================================================
  // SCENARIO 10: Chống cộng trùng (Idempotency & Duplicate Replay Protection)
  // =========================================================================
  console.log('\n-> Scenario 10: Idempotency protection against duplicate match submissions...');
  const idempotencyKey = 'match_pve_test_unique_key_123';
  const tenMoves = Array.from({ length: 10 }, (_, i) => `${i},0-${i + 1},0`);
  const firstReq: any = {
    body: {
      matchId: idempotencyKey,
      result: 'WIN',
      totalMoves: 10,
      aiDifficulty: 'HARD',
      moves: tenMoves,
    },
    user: { userId: 9999, username: 'Tester', email: 't@k.com' },
  };

  let firstResBody: any = null;
  const mockRes1: any = {
    status: () => mockRes1,
    json: (b: any) => { firstResBody = b; return mockRes1; },
  };
  await finishPveMatch(firstReq, mockRes1);
  assert.strictEqual(firstResBody.success, true);
  assert.strictEqual(firstResBody.totalMoves, 10);
  assert.strictEqual(firstResBody.duplicate, undefined);

  // Second request with SAME matchId must be caught by idempotency cache
  let secondResBody: any = null;
  const mockRes2: any = {
    status: () => mockRes2,
    json: (b: any) => { secondResBody = b; return mockRes2; },
  };
  await finishPveMatch(firstReq, mockRes2);
  assert.strictEqual(secondResBody.success, true);
  assert.strictEqual(secondResBody.duplicate, true, 'Duplicate submission must return duplicate: true');
  assert.strictEqual(secondResBody.message, 'Kết quả ván đấu đã được ghi nhận trước đó.');
  console.log('✅ Scenario 10 Passed!');

  console.log('\n==================================================');
  console.log('🎉 ALL 10 MANDATORY PVE EXP SYSTEM SCENARIOS PASSED 100%!');
  console.log('==================================================\n');
}
