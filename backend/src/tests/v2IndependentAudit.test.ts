import assert from 'assert';
import {
  calculatePostMatchStats,
  calculateExpForNextLevel,
  calculateLevelFromExp,
  getRankTitle,
} from '../services/levelService.js';

export async function runV2IndependentAuditTests(): Promise<void> {
  console.log('🧪 RUNNING INDEPENDENT AUDIT V2 MATHEMATICAL & DATA INTEGRITY TESTS...\n');

  // =========================================================================
  // SECTION 1: ELO MATHEMATICAL VERIFICATION (CASES A - F)
  // =========================================================================
  console.log('-> 1. ELO Mathematical Verification (Cases A through F)...');

  // Case A: Equal rating 1200 vs 1200, both K=32 (totalGames < 30), White wins
  // Expected Score E_W = 0.5, E_B = 0.5. Deltas: +16 / -16.
  const caseA = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1, matchesPlayed: 0 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 0 },
  });
  assert.strictEqual(caseA.white.eloDelta, 16, 'Case A White delta must be +16 (K=32 for totalGames < 30)');
  assert.strictEqual(caseA.black.eloDelta, -16, 'Case A Black delta must be -16 (K=32 for totalGames < 30)');
  assert.strictEqual(caseA.white.elo, 1216, 'Case A White final ELO must be 1216');
  assert.strictEqual(caseA.black.elo, 1184, 'Case A Black final ELO must be 1184');

  // Case B: Equal rating 1200 vs 1200, both K=20 (totalGames >= 30, ELO < 1800), White wins
  // Expected Score E_W = 0.5, E_B = 0.5. Deltas: +10 / -10.
  const caseB = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
  });
  assert.strictEqual(caseB.white.eloDelta, 10, 'Case B White delta must be +10 (K=20 for totalGames >= 30, ELO < 1800)');
  assert.strictEqual(caseB.black.eloDelta, -10, 'Case B Black delta must be -10 (K=20 for totalGames >= 30, ELO < 1800)');
  assert.strictEqual(caseB.white.elo, 1210, 'Case B White final ELO must be 1210');
  assert.strictEqual(caseB.black.elo, 1190, 'Case B Black final ELO must be 1190');

  // Case C: Rating 1200 beats rating 1600, both K=20 (White=1200, Black=1600)
  // E_W = 1 / (1 + 10^1) = 1/11 ~ 0.090909. Raw delta: 20 * (1 - 1/11) = 200/11 = 18.18 -> +18.
  const caseC = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
    playerBlack: { id: 2, elo: 1600, exp: 0n, level: 1, matchesPlayed: 40 },
  });
  assert.strictEqual(caseC.white.eloDelta, 18, 'Case C White delta must be +18');
  assert.strictEqual(caseC.black.eloDelta, -18, 'Case C Black delta must be -18');
  assert.strictEqual(caseC.white.elo, 1218, 'Case C White final ELO must be 1218');
  assert.strictEqual(caseC.black.elo, 1582, 'Case C Black final ELO must be 1582');

  // Case D: Rating 1400 vs 1200, both K=20, Draw (White=1400, Black=1200)
  // E_W = 1 / (1 + 10^-0.5) ~ 0.759747. Raw delta W: 20 * (0.5 - 0.759747) = -5.19 -> -5.
  // Raw delta B: 20 * (0.5 - 0.240253) = +5.19 -> +5.
  const caseD = calculatePostMatchStats({
    winnerId: null,
    isDraw: true,
    playerWhite: { id: 1, elo: 1400, exp: 0n, level: 1, matchesPlayed: 40 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
  });
  assert.strictEqual(caseD.white.eloDelta, -5, 'Case D White delta must be -5');
  assert.strictEqual(caseD.black.eloDelta, 5, 'Case D Black delta must be +5');
  assert.strictEqual(caseD.white.elo, 1395, 'Case D White final ELO must be 1395');
  assert.strictEqual(caseD.black.elo, 1205, 'Case D Black final ELO must be 1205');

  // Case E: Asymmetric K-factors (White K=32 [totalGames < 30], Black K=10 [totalGames >= 30, ELO >= 1800], equal 1800 ratings, White wins)
  // White delta: 32 * 0.5 = +16. Black delta: 10 * -0.5 = -5. Combined = +11.
  const caseE = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1800, exp: 0n, level: 1, matchesPlayed: 5 },
    playerBlack: { id: 2, elo: 1800, exp: 0n, level: 1, matchesPlayed: 40 },
  });
  assert.strictEqual(caseE.white.eloDelta, 16, 'Case E White delta must be +16 (K=32)');
  assert.strictEqual(caseE.black.eloDelta, -5, 'Case E Black delta must be -5 (K=10)');
  assert.strictEqual(caseE.white.eloDelta + caseE.black.eloDelta, 11, 'Case E net rating change is +11 (due to asymmetric K-factors)');

  // Case F: Minimum ELO Floor Clamp at 500 (Black elo=505, K=32, loses to equal 505)
  // Uncapped loss: 505 - 16 = 489. Clamped: 500.
  const caseF = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 505, exp: 0n, level: 1, matchesPlayed: 0 },
    playerBlack: { id: 2, elo: 505, exp: 0n, level: 1, matchesPlayed: 0 },
  });
  assert.strictEqual(caseF.black.elo, 500, 'Case F Black ELO must be clamped at 500');
  assert.strictEqual(caseF.black.eloDelta, -5, 'Case F actual Black delta is -5 (clamped from -16)');
  console.log('✅ Section 1 ELO Mathematical Cases A-F Verified 100%!');

  // =========================================================================
  // SECTION 2: EXP-TO-LEVEL CURVE & BOUNDARY VERIFICATION
  // =========================================================================
  console.log('\n-> 2. EXP-to-Level Curve & Boundary Verification...');

  // Minimum Cumulative EXP Thresholds for Levels 1 through 10:
  // Formula: EXP_Required(n) = 100 + (n - 1) * 35
  const expectedThresholds = [
    { level: 1, reqExp: 0n },      // Base
    { level: 2, reqExp: 100n },    // 100
    { level: 3, reqExp: 235n },    // 100 + 135 = 235
    { level: 4, reqExp: 405n },    // 235 + 170 = 405
    { level: 5, reqExp: 610n },    // 405 + 205 = 610
    { level: 6, reqExp: 850n },    // 610 + 240 = 850
    { level: 7, reqExp: 1125n },   // 850 + 275 = 1125
    { level: 8, reqExp: 1435n },   // 1125 + 310 = 1435
    { level: 9, reqExp: 1780n },   // 1435 + 345 = 1780
    { level: 10, reqExp: 2160n },  // 1780 + 380 = 2160
  ];

  for (let i = 1; i < expectedThresholds.length; i++) {
    const t = expectedThresholds[i];
    const prevThreshold = expectedThresholds[i - 1];

    // Check one EXP below threshold
    if (t.reqExp > 0n) {
      const belowLevel = calculateLevelFromExp(t.reqExp - 1n, 1);
      assert.strictEqual(
        belowLevel,
        t.level - 1,
        `EXP ${t.reqExp - 1n} must result in Level ${t.level - 1}`
      );
    }

    // Check exactly at threshold
    const exactLevel = calculateLevelFromExp(t.reqExp, 1);
    assert.strictEqual(
      exactLevel,
      t.level,
      `EXP ${t.reqExp} must result in Level ${t.level}`
    );

    // Check one EXP above threshold
    const aboveLevel = calculateLevelFromExp(t.reqExp + 1n, 1);
    assert.strictEqual(
      aboveLevel,
      t.level,
      `EXP ${t.reqExp + 1n} must result in Level ${t.level}`
    );
  }

  // Verify 1000 EXP specifically yields Level 6 (850 <= 1000 < 1125)
  assert.strictEqual(calculateLevelFromExp(1000n, 1), 6, '1000 EXP must yield Level 6 (850 <= 1000 < 1125)');

  // Verify Multi-Level Advancement in a single reward
  // User at Level 1 receiving 2000 EXP jumps to Level 9 (1780 <= 2000 < 2160)
  assert.strictEqual(calculateLevelFromExp(2000n, 1), 9, 'Multi-level jump: 2000 EXP from Level 1 must reach Level 9');

  console.log('✅ Section 2 EXP-to-Level Curve & Boundaries Verified 100%!');

  // =========================================================================
  // SECTION 3: MATCH REWARD & PVP CONSISTENCY
  // =========================================================================
  console.log('\n-> 3. Match Reward & PvP Consistency Verification...');

  const pvpWin = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1 },
  });
  assert.strictEqual(pvpWin.white.expDelta, 50, 'PvP Winner gets +50 EXP');
  assert.strictEqual(pvpWin.black.expDelta, 20, 'PvP Loser gets +20 EXP');

  const pvpDraw = calculatePostMatchStats({
    winnerId: null,
    isDraw: true,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1 },
  });
  assert.strictEqual(pvpDraw.white.expDelta, 30, 'PvP Draw White gets +30 EXP');
  assert.strictEqual(pvpDraw.black.expDelta, 30, 'PvP Draw Black gets +30 EXP');

  console.log('✅ Section 3 Match Reward & PvP Consistency Verified 100%!');

  console.log('\n=========================================================================');
  console.log('🎉 ALL INDEPENDENT AUDIT V2 MATHEMATICAL & DATA INTEGRITY TESTS PASSED!');
  console.log('=========================================================================\n');
}
