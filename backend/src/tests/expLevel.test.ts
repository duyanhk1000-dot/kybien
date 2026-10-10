import assert from 'assert';
import {
  calculateExpForNextLevel,
  calculateLevelFromExp,
  calculatePostMatchStats,
} from '../services/levelService.js';

export async function runExpLevelTests(): Promise<void> {
  console.log('🧪 RUNNING EXP & LEVEL PROGRESSION TEST SUITE...\n');

  // ===================================================
  // TEST 1: EXP Calculations (PvP Win +50, Draw +30, Loss +20)
  // ===================================================
  console.log('-> Test 1: Match outcome EXP rewards...');
  const winStats = calculatePostMatchStats({
    winnerId: 10,
    isDraw: false,
    playerWhite: { id: 10, elo: 1200, exp: 0n, level: 1 },
    playerBlack: { id: 20, elo: 1200, exp: 0n, level: 1 },
  });

  assert.strictEqual(winStats.white.expDelta, 50, 'Winner gets +50 EXP');
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

  console.log('\n==================================================');
  console.log('🎉 ALL EXP & LEVEL PROGRESSION TESTS PASSED!');
  console.log('==================================================\n');
}
