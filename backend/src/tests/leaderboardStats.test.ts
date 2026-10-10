import assert from 'assert';
import { getRankTitle } from '../services/levelService.js';
import { escapeHtmlText } from '../utils/sanitize.js';

export async function runLeaderboardStatsTests(): Promise<void> {
  console.log('🧪 RUNNING LEADERBOARD & STATS INTEGRITY TEST SUITE...\n');

  // ===================================================
  // TEST 1: Win Rate Calculation & Zero-Division Safety
  // ===================================================
  console.log('-> Test 1: Win rate calculation & zero division safety...');
  const calcWinRate = (matchesPlayed: number, matchesWon: number): number => {
    return matchesPlayed > 0 ? parseFloat(((matchesWon / matchesPlayed) * 100).toFixed(1)) : 0;
  };

  assert.strictEqual(calcWinRate(0, 0), 0, '0 matches played must return 0% win rate');
  assert.strictEqual(calcWinRate(10, 5), 50.0, '5 wins out of 10 matches = 50.0%');
  assert.strictEqual(calcWinRate(3, 1), 33.3, '1 win out of 3 matches = 33.3%');
  assert.strictEqual(calcWinRate(7, 7), 100.0, '7 wins out of 7 matches = 100.0%');
  console.log('✅ Test 1 Passed!');

  // ===================================================
  // TEST 2: Primary and Secondary Leaderboard Sorting
  // ===================================================
  console.log('\n-> Test 2: Leaderboard tie-breaker sorting simulation...');
  const mockUsers = [
    { id: 1, username: 'PlayerA', elo: 1200, matches_played: 10, matches_won: 5 },
    { id: 2, username: 'PlayerB', elo: 1500, matches_played: 20, matches_won: 15 },
    { id: 3, username: 'PlayerC', elo: 1500, matches_played: 25, matches_won: 18 },
    { id: 4, username: 'PlayerD', elo: 1500, matches_played: 25, matches_won: 18 }, // Tie in Elo & Wins -> sorted by ID
  ];

  const sorted = [...mockUsers].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
    return a.id - b.id;
  });

  assert.strictEqual(sorted[0].id, 3, 'First place should be PlayerC (1500 ELO, 18 wins)');
  assert.strictEqual(sorted[1].id, 4, 'Second place should be PlayerD (1500 ELO, 18 wins, ID 4)');
  assert.strictEqual(sorted[2].id, 2, 'Third place should be PlayerB (1500 ELO, 15 wins)');
  assert.strictEqual(sorted[3].id, 1, 'Fourth place should be PlayerA (1200 ELO)');
  console.log('✅ Test 2 Passed!');

  // ===================================================
  // TEST 3: Rank Titles in Leaderboard Payload
  // ===================================================
  console.log('\n-> Test 3: Leaderboard payload includes correct rank titles...');
  const topPayload = sorted.map((u) => ({
    id: u.id,
    username: u.username,
    elo: u.elo,
    rankTitle: getRankTitle(u.elo),
    winRate: calcWinRate(u.matches_played, u.matches_won),
  }));

  assert.strictEqual(topPayload[0].rankTitle, '[Khởi Khai] Kỳ Tướng', '1500 ELO, Lv 1 is [Khởi Khai] Kỳ Tướng');
  assert.strictEqual(topPayload[3].rankTitle, '[Khởi Khai] Kỳ Hiệp', '1200 ELO, Lv 1 is [Khởi Khai] Kỳ Hiệp');
  console.log('✅ Test 3 Passed!');

  // ===================================================
  // TEST 4: XSS Escaping in Username & Stats Display
  // ===================================================
  console.log('\n-> Test 4: XSS Escaping in Username display...');
  const maliciousUsername = '<script>alert("hack")</script>';
  const sanitized = escapeHtmlText(maliciousUsername);
  assert.strictEqual(
    sanitized.includes('<script>'),
    false,
    'Sanitized username must not contain raw <script> tag'
  );
  console.log('✅ Test 4 Passed!');

  console.log('\n==================================================');
  console.log('🎉 ALL LEADERBOARD & STATS INTEGRITY TESTS PASSED!');
  console.log('==================================================\n');
}
