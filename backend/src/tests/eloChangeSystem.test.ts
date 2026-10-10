import assert from 'assert';
import { calculateEloChange } from '../services/levelService.js';

export async function runEloChangeSystemTests(): Promise<void> {
  console.log('🧪 RUNNING ELO RATING CHANGE SYSTEM (PVE, MOVES, K-FACTORS, FLOOR LIMIT) TEST SUITE...\n');

  // ===================================================
  // TEST 1: PvE Mode (Vs Bot) -> No ELO Change
  // ===================================================
  console.log('-> Test 1: PvE Mode (isPvP = false)...');
  const resPvE = calculateEloChange(
    { currentElo: 1200, totalGames: 10 },
    { currentElo: 1200, totalGames: 10 },
    'WIN_A',
    50,
    false // PvE
  );

  assert.strictEqual(resPvE.isValid, false, 'PvE match must return isValid = false');
  assert.strictEqual(resPvE.deltaA, 0, 'PvE Player A delta must be 0');
  assert.strictEqual(resPvE.deltaB, 0, 'PvE Player B delta must be 0');
  assert.strictEqual(resPvE.newEloA, 1200, 'PvE Player A ELO remains unchanged');
  console.log('✅ Test 1 Passed!');

  // ===================================================
  // TEST 2: Under 20 Moves Check (Anti-Farming / Anti-Arrangement)
  // ===================================================
  console.log('\n-> Test 2: Match under 20 moves (totalMoves = 15)...');
  const resShortMoves = calculateEloChange(
    { currentElo: 1200, totalGames: 10 },
    { currentElo: 1200, totalGames: 10 },
    'WIN_A',
    15, // < 20 moves
    true
  );

  assert.strictEqual(resShortMoves.isValid, false, 'Match under 20 moves must return isValid = false');
  assert.strictEqual(resShortMoves.deltaA, 0, 'Short match Player A delta must be 0');
  assert.strictEqual(resShortMoves.deltaB, 0, 'Short match Player B delta must be 0');
  console.log('✅ Test 2 Passed!');

  // ===================================================
  // TEST 3: K-Factor Selection (32 for <30 games, 20 for <1800 ELO, 10 for >=1800 ELO)
  // ===================================================
  console.log('\n-> Test 3: K-Factor Selection Rules...');

  // A: <30 games (K=32), B: <30 games (K=32), Equal 1200 ELO
  // Expected delta: 32 * (1 - 0.5) = +16
  const resK32 = calculateEloChange(
    { currentElo: 1200, totalGames: 10 },
    { currentElo: 1200, totalGames: 10 },
    'WIN_A',
    25,
    true
  );
  assert.strictEqual(resK32.deltaA, 16, 'Provisional player (<30 games) uses K=32 (+16 for equal ELO win)');
  assert.strictEqual(resK32.deltaB, -16, 'Provisional player (<30 games) uses K=32 (-16 for equal ELO loss)');

  // A: >=30 games & ELO 1500 (K=20), B: >=30 games & ELO 1500 (K=20)
  // Expected delta: 20 * (1 - 0.5) = +10
  const resK20 = calculateEloChange(
    { currentElo: 1500, totalGames: 40 },
    { currentElo: 1500, totalGames: 40 },
    'WIN_A',
    25,
    true
  );
  assert.strictEqual(resK20.deltaA, 10, 'Mid-tier player (>=30 games, <1800 ELO) uses K=20 (+10 for equal ELO win)');
  assert.strictEqual(resK20.deltaB, -10, 'Mid-tier player (>=30 games, <1800 ELO) uses K=20 (-10 for equal ELO loss)');

  // A: >=30 games & ELO 1900 (K=10), B: >=30 games & ELO 1900 (K=10)
  // Expected delta: 10 * (1 - 0.5) = +5
  const resK10 = calculateEloChange(
    { currentElo: 1900, totalGames: 50 },
    { currentElo: 1900, totalGames: 50 },
    'WIN_A',
    25,
    true
  );
  assert.strictEqual(resK10.deltaA, 5, 'High-tier player (>=30 games, >=1800 ELO) uses K=10 (+5 for equal ELO win)');
  assert.strictEqual(resK10.deltaB, -5, 'High-tier player (>=30 games, >=1800 ELO) uses K=10 (-5 for equal ELO loss)');
  console.log('✅ Test 3 Passed!');

  // ===================================================
  // TEST 4: Asymmetric K-Factors (Player A K=32, Player B K=10)
  // ===================================================
  console.log('\n-> Test 4: Independent Asymmetric K-Factors...');
  const resAsym = calculateEloChange(
    { currentElo: 1800, totalGames: 5 },  // totalGames < 30 => K=32
    { currentElo: 1800, totalGames: 50 }, // totalGames >= 30, ELO >= 1800 => K=10
    'WIN_A',
    30,
    true
  );
  assert.strictEqual(resAsym.deltaA, 16, 'Player A gets +16 (K=32)');
  assert.strictEqual(resAsym.deltaB, -5, 'Player B loses -5 (K=10)');
  console.log('✅ Test 4 Passed!');

  // ===================================================
  // TEST 5: ELO Floor Limit Clamp at 500
  // ===================================================
  console.log('\n-> Test 5: ELO Floor Limit Clamp at 500...');
  const resFloor = calculateEloChange(
    { currentElo: 520, totalGames: 5 }, // K=32, loss delta -16 => uncapped 504
    { currentElo: 505, totalGames: 5 }, // K=32, loss delta -16 => uncapped 489 => clamped 500
    'WIN_A',
    30,
    true
  );

  assert.strictEqual(resFloor.deltaB, -5, 'Player B delta is -5 (clamped from -16 because floor is 500)');
  assert.strictEqual(resFloor.newEloB, 500, 'Player B final ELO must be clamped at 500');
  console.log('✅ Test 5 Passed!');

  console.log('\n==================================================');
  console.log('🎉 ALL ELO CHANGE SYSTEM TESTS PASSED 100%!');
  console.log('==================================================\n');
}
