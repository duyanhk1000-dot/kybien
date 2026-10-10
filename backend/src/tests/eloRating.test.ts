import assert from 'assert';
import {
  calculatePostMatchStats,
  getEloTitle,
  getExpTitle,
  getPlayerTitles,
  getRankTitle,
} from '../services/levelService.js';

export async function runEloRatingTests(): Promise<void> {
  console.log('🧪 RUNNING ELO RATING & RANK TITLE TEST SUITE...\n');

  // ===================================================
  // TEST 1: Equal Elo Win with K=32 (provisional matches < 30)
  // ===================================================
  console.log('-> Test 1: Equal Elo Win with K=32 (provisional matches < 30)...');
  const res1 = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1, matchesPlayed: 0 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 0 },
  });

  assert.strictEqual(res1.white.elo, 1216, 'White should gain +16 ELO with K=32 when equal ratings');
  assert.strictEqual(res1.black.elo, 1184, 'Black should lose -16 ELO with K=32 when equal ratings');
  assert.strictEqual(res1.white.eloDelta + res1.black.eloDelta, 0, 'Rating changes must be zero-sum symmetric');
  console.log('✅ Test 1 Passed!');

  // ===================================================
  // TEST 2: Equal Elo Win with K=20 (established player < 1800 ELO)
  // ===================================================
  console.log('\n-> Test 2: Equal Elo Win with K=20 (established matches >= 30, ELO < 1800)...');
  const res2 = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
  });

  assert.strictEqual(res2.white.elo, 1210, 'White should gain +10 ELO with K=20 when equal ratings');
  assert.strictEqual(res2.black.elo, 1190, 'Black should lose -10 ELO with K=20 when equal ratings');
  console.log('✅ Test 2 Passed!');

  // ===================================================
  // TEST 3: Strong vs Weak Player (1600 vs 1200, K=20)
  // ===================================================
  console.log('\n-> Test 3: Strong vs Weak Player...');
  const res3Win = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 1600, exp: 0n, level: 1, matchesPlayed: 40 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
  });

  assert.strictEqual(res3Win.white.eloDelta, 2, 'Strong player winning against weak player gets small gain (+2)');
  assert.strictEqual(res3Win.black.eloDelta, -2, 'Weak player losing against strong player loses small rating (-2)');

  const res3Upset = calculatePostMatchStats({
    winnerId: 2,
    isDraw: false,
    playerWhite: { id: 1, elo: 1600, exp: 0n, level: 1, matchesPlayed: 40 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 40 },
  });

  assert.strictEqual(res3Upset.black.eloDelta, 18, 'Weak player upsetting strong player gets large gain (+18)');
  assert.strictEqual(res3Upset.white.eloDelta, -18, 'Strong player losing to weak player gets large drop (-18)');
  console.log('✅ Test 3 Passed!');

  // ===================================================
  // TEST 4: Draw between Higher and Lower Rated Players
  // ===================================================
  console.log('\n-> Test 4: Draw rating adjustments...');
  const res4Draw = calculatePostMatchStats({
    winnerId: null,
    isDraw: true,
    playerWhite: { id: 1, elo: 1400, exp: 0n, level: 1, matchesPlayed: 20 },
    playerBlack: { id: 2, elo: 1200, exp: 0n, level: 1, matchesPlayed: 20 },
  });

  assert.strictEqual(res4Draw.white.eloDelta < 0, true, 'Higher rated player drawing loses small ELO');
  assert.strictEqual(res4Draw.black.eloDelta > 0, true, 'Lower rated player drawing gains small ELO');
  console.log('✅ Test 4 Passed!');

  // ===================================================
  // TEST 5: Minimum ELO Floor Clamp (500)
  // ===================================================
  console.log('\n-> Test 5: Minimum ELO Floor Clamp at 500...');
  const res5 = calculatePostMatchStats({
    winnerId: 1,
    isDraw: false,
    playerWhite: { id: 1, elo: 505, exp: 0n, level: 1, matchesPlayed: 0 },
    playerBlack: { id: 2, elo: 505, exp: 0n, level: 1, matchesPlayed: 0 },
  });

  assert.strictEqual(res5.black.elo, 500, 'Black ELO must not drop below 500');
  console.log('✅ Test 5 Passed!');

  // ===================================================
  // TEST 6: Wuxia Elo Title Boundaries
  // ===================================================
  console.log('\n-> Test 6: Wuxia Elo Title Boundaries...');
  assert.strictEqual(getEloTitle(800), 'Kỳ Đồng', 'ELO < 1000 => Kỳ Đồng');
  assert.strictEqual(getEloTitle(1000), 'Kỳ Đồ', '1000 <= ELO <= 1199 => Kỳ Đồ');
  assert.strictEqual(getEloTitle(1199), 'Kỳ Đồ', '1199 => Kỳ Đồ');
  assert.strictEqual(getEloTitle(1200), 'Kỳ Hiệp', '1200 <= ELO <= 1399 => Kỳ Hiệp');
  assert.strictEqual(getEloTitle(1400), 'Kỳ Tướng', '1400 <= ELO <= 1599 => Kỳ Tướng');
  assert.strictEqual(getEloTitle(1600), 'Kỳ Vương', '1600 <= ELO <= 1799 => Kỳ Vương');
  assert.strictEqual(getEloTitle(1800), 'Kỳ Tông', '1800 <= ELO <= 1999 => Kỳ Tông');
  assert.strictEqual(getEloTitle(2000), 'Kỳ Thánh', '2000 <= ELO <= 2199 => Kỳ Thánh');
  assert.strictEqual(getEloTitle(2200), 'Kỳ Thần', 'ELO >= 2200 => Kỳ Thần');
  assert.strictEqual(getEloTitle(2500), 'Kỳ Thần', 'ELO 2500 => Kỳ Thần');
  console.log('✅ Test 6 Passed!');

  // ===================================================
  // TEST 7: Wuxia EXP Level Title Boundaries
  // ===================================================
  console.log('\n-> Test 7: Wuxia EXP Level Title Boundaries...');
  assert.strictEqual(getExpTitle(1), 'Khởi Khai', 'Lv 1-15 => Khởi Khai');
  assert.strictEqual(getExpTitle(15), 'Khởi Khai', 'Lv 15 => Khởi Khai');
  assert.strictEqual(getExpTitle(16), 'Đắc Thức', 'Lv 16-30 => Đắc Thức');
  assert.strictEqual(getExpTitle(30), 'Đắc Thức', 'Lv 30 => Đắc Thức');
  assert.strictEqual(getExpTitle(31), 'Tri Ý', 'Lv 31-50 => Tri Ý');
  assert.strictEqual(getExpTitle(50), 'Tri Ý', 'Lv 50 => Tri Ý');
  assert.strictEqual(getExpTitle(51), 'Thông Biến', 'Lv 51-70 => Thông Biến');
  assert.strictEqual(getExpTitle(70), 'Thông Biến', 'Lv 70 => Thông Biến');
  assert.strictEqual(getExpTitle(71), 'Thần Cơ', 'Lv 71-85 => Thần Cơ');
  assert.strictEqual(getExpTitle(85), 'Thần Cơ', 'Lv 85 => Thần Cơ');
  assert.strictEqual(getExpTitle(86), 'Hóa Cảnh', 'Lv 86-99 => Hóa Cảnh');
  assert.strictEqual(getExpTitle(99), 'Hóa Cảnh', 'Lv 99 => Hóa Cảnh');
  assert.strictEqual(getExpTitle(100), 'Quy Chân', 'Lv 100 => Quy Chân');
  assert.strictEqual(getExpTitle(150), 'Quy Chân', 'Lv >= 100 => Quy Chân');
  console.log('✅ Test 7 Passed!');

  // ===================================================
  // TEST 8: Combined Format [expTitle] eloTitle
  // ===================================================
  console.log('\n-> Test 8: Combined Format [expTitle] eloTitle...');
  const t1 = getPlayerTitles(35, 1250);
  assert.strictEqual(t1.expTitle, 'Tri Ý');
  assert.strictEqual(t1.eloTitle, 'Kỳ Hiệp');
  assert.strictEqual(t1.fullTitle, '[Tri Ý] Kỳ Hiệp');

  const t2 = getPlayerTitles(100, 2300);
  assert.strictEqual(t2.expTitle, 'Quy Chân');
  assert.strictEqual(t2.eloTitle, 'Kỳ Thần');
  assert.strictEqual(t2.fullTitle, '[Quy Chân] Kỳ Thần');
  console.log('✅ Test 8 Passed!');

  console.log('\n==================================================');
  console.log('🎉 ALL ELO RATING & WUXIA TITLE TESTS PASSED!');
  console.log('==================================================\n');
}
