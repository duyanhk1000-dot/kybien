import assert from 'assert';
import {
  calculateExpForNextLevel,
  calculateLevelFromExp,
  calculatePostMatchStats,
  calculateMatchExp,
} from '../services/levelService.js';

export async function runExpLevelTests(): Promise<void> {
  console.log('🧪 RUNNING EXP & LEVEL PROGRESSION TEST SUITE...\n');

  // ===================================================
  // TEST 1: EXP Calculations (PvP Win +60, Draw +30, Loss +20)
  // ===================================================
  console.log('-> Test 1: Match outcome EXP rewards...');
  const winStats = calculatePostMatchStats({
    winnerId: 10,
    isDraw: false,
    playerWhite: { id: 10, elo: 1200, exp: 0n, level: 1 },
    playerBlack: { id: 20, elo: 1200, exp: 0n, level: 1 },
  });

  assert.strictEqual(winStats.white.expDelta, 60, 'Winner gets +60 EXP');
  assert.strictEqual(winStats.black.expDelta, 20, 'Loser gets +20 EXP');

  const drawStats = calculatePostMatchStats({
    winnerId: null,
    isDraw: true,
    playerWhite: { id: 10, elo: 1200, exp: 0n, level: 1 },
    playerBlack: { id: 20, elo: 1200, exp: 0n, level: 1 },
  });

  assert.strictEqual(drawStats.white.expDelta, 30, 'White draw gets +30 EXP');
  assert.strictEqual(drawStats.black.expDelta, 30, 'Black draw gets +30 EXP');
  console.log('✅ Test 1 Passed!');

  // ===================================================
  // TEST 2: Level Threshold Formula (100 + (n-1)*35)
  // ===================================================
  console.log('\n-> Test 2: Level threshold formula calculation...');
  assert.strictEqual(calculateExpForNextLevel(1), 100n, 'Level 1 required EXP = 100 + 0*35 = 100');
  assert.strictEqual(calculateExpForNextLevel(2), 135n, 'Level 2 required EXP = 100 + 1*35 = 135');
  assert.strictEqual(calculateExpForNextLevel(3), 170n, 'Level 3 required EXP = 100 + 2*35 = 170');
  assert.strictEqual(calculateExpForNextLevel(4), 205n, 'Level 4 required EXP = 100 + 3*35 = 205');
  console.log('✅ Test 2 Passed!');

  // ===================================================
  // TEST 3: Level Advancement from Cumulative EXP
  // ===================================================
  console.log('\n-> Test 3: Level progression from accumulated EXP...');
  assert.strictEqual(calculateLevelFromExp(50n, 1), 1, '50 EXP is below Level 1 requirement (100)');
  assert.strictEqual(calculateLevelFromExp(100n, 1), 2, '100 EXP reaches Level 2 (100 EXP required)');
  assert.strictEqual(calculateLevelFromExp(234n, 1), 2, '234 EXP is still Level 2 (100 + 135 = 235 needed for Lv 3)');
  assert.strictEqual(calculateLevelFromExp(235n, 1), 3, '235 EXP advances to Level 3');
  assert.strictEqual(calculateLevelFromExp(610n, 1), 5, '610 EXP advances to Level 5 (100+135+170+205=610)');
  console.log('✅ Test 3 Passed!');

  // ===================================================
  // TEST 4: PvE Match EXP Calculations & Bonuses
  // ===================================================
  console.log('\n-> Test 4: PvE match outcome EXP rewards & great match bonuses...');
  // Anti-abuse: < 20 moves gives 0 EXP
  const shortGame = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 15, aiDifficulty: 'HARD' });
  assert.strictEqual(shortGame.totalEarnedExp, 0, 'Moves < 20 yields 0 EXP');

  // Hard AI: Win = 30, Draw = 15, Loss = 7
  const hardWin = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 50, aiDifficulty: 'HARD' });
  assert.strictEqual(hardWin.baseExp, 30, 'PvE Hard Win base EXP = 30');
  assert.strictEqual(hardWin.totalEarnedExp, 30, 'PvE Hard Win total EXP = 30');

  const hardDraw = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 50, aiDifficulty: 'HARD' });
  assert.strictEqual(hardDraw.baseExp, 15, 'PvE Hard Draw base EXP = 15');

  const hardLoss = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 50, aiDifficulty: 'HARD' });
  assert.strictEqual(hardLoss.baseExp, 7, 'PvE Hard Loss base EXP = 7');

  // Normal AI: Win = 20, Draw = 10, Loss = 5
  const normWin = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 40, aiDifficulty: 'NORMAL' });
  assert.strictEqual(normWin.baseExp, 20, 'PvE Normal Win base EXP = 20');

  const normDraw = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 40, aiDifficulty: 'NORMAL' });
  assert.strictEqual(normDraw.baseExp, 10, 'PvE Normal Draw base EXP = 10');

  const normLoss = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 40, aiDifficulty: 'NORMAL' });
  assert.strictEqual(normLoss.baseExp, 5, 'PvE Normal Loss base EXP = 5');

  // Easy AI: Win = 10, Draw = 5, Loss = 2
  const easyWin = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 30, aiDifficulty: 'EASY' });
  assert.strictEqual(easyWin.baseExp, 10, 'PvE Easy Win base EXP = 10');

  const easyDraw = calculateMatchExp({ mode: 'PVE', result: 'DRAW', totalMoves: 30, aiDifficulty: 'EASY' });
  assert.strictEqual(easyDraw.baseExp, 5, 'PvE Easy Draw base EXP = 5');

  const easyLoss = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 30, aiDifficulty: 'EASY' });
  assert.strictEqual(easyLoss.baseExp, 2, 'PvE Easy Loss base EXP = 2');

  // Great Game PvE (> 120 moves): Win bonus = +15, Loss/Draw bonus = +5
  const hardGreatWin = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 125, aiDifficulty: 'HARD' });
  assert.strictEqual(hardGreatWin.baseExp, 30, 'Base EXP is 30');
  assert.strictEqual(hardGreatWin.greatGameBonus, 15, 'Bonus EXP for > 120 moves win is 15');
  assert.strictEqual(hardGreatWin.totalEarnedExp, 45, 'Total EXP is 30 + 15 = 45');
  assert.strictEqual(hardGreatWin.canWriteBlog, true, 'Great match can write blog');

  const normGreatLoss = calculateMatchExp({ mode: 'PVE', result: 'LOSS', totalMoves: 130, aiDifficulty: 'NORMAL' });
  assert.strictEqual(normGreatLoss.baseExp, 5, 'Normal loss base EXP is 5');
  assert.strictEqual(normGreatLoss.greatGameBonus, 5, 'Bonus EXP for > 120 moves loss is 5');
  assert.strictEqual(normGreatLoss.totalEarnedExp, 10, 'Total EXP is 5 + 5 = 10');
  assert.strictEqual(normGreatLoss.canWriteBlog, true, 'Great match can write blog');

  // Daily PvE Cap: 300 EXP max
  const capTest = calculateMatchExp({ mode: 'PVE', result: 'WIN', totalMoves: 50, aiDifficulty: 'HARD', currentDailyPveExp: 290 });
  assert.strictEqual(capTest.totalEarnedExp, 10, 'Remaining cap is 10, so earned EXP is capped at 10');
  assert.strictEqual(capTest.newDailyPveExp, 300, 'New daily PvE EXP reaches 300');
  console.log('✅ Test 4 Passed!');

  console.log('\n==================================================');
  console.log('🎉 ALL EXP & LEVEL PROGRESSION TESTS PASSED!');
  console.log('==================================================\n');
}
