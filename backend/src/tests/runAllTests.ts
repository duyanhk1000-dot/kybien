import { runSecurityRegressionTests } from './securityRegression.test.js';
import { runP1IntegrityTests } from './p1Integrity.test.js';
import { runSanitizeAuditTests } from './auditSanitize.test.js';
import { runVariantEngineTests } from './variantEngine.test.js';
import { runAuthSessionTests } from './authSession.test.js';
import { runEloRatingTests } from './eloRating.test.js';
import { runExpLevelTests } from './expLevel.test.js';
import { runLeaderboardStatsTests } from './leaderboardStats.test.js';
import { runV2IndependentAuditTests } from './v2IndependentAudit.test.js';
import { runEloChangeSystemTests } from './eloChangeSystem.test.js';
import { runPveExpSystemTests } from './pveExpSystem.test.js';
import { runOnlineTrackerTests } from './onlineTracker.test.js';
import { runSeoSlugTests } from './seoSlug.test.js';
import { runXiangqiChessRulesTests } from './xiangqiChessRules.test.js';
import { runPuzzleMilestone1Tests } from './puzzleMilestone1.test.js';
import { runConcurrencyAndRewardIsolationTests } from './concurrencyAndRewardIsolation.test.js';
import { runE2EHttpMilestone1Tests } from './e2eHttpMilestone1.test.js';
import { runDailyPuzzleAndBlogTests } from './dailyPuzzleAndBlog.test.js';

async function run() {
  try {
    await runSecurityRegressionTests();
    await runP1IntegrityTests();
    await runSanitizeAuditTests();
    await runVariantEngineTests();
    await runAuthSessionTests();
    await runEloRatingTests();
    await runExpLevelTests();
    await runLeaderboardStatsTests();
    await runV2IndependentAuditTests();
    await runEloChangeSystemTests();
    await runPveExpSystemTests();
    await runOnlineTrackerTests();
    await runSeoSlugTests();
    await runXiangqiChessRulesTests();
    await runPuzzleMilestone1Tests();
    await runConcurrencyAndRewardIsolationTests();
    await runE2EHttpMilestone1Tests();
    await runDailyPuzzleAndBlogTests();
    await (await import('./ugcPuzzleCreator.test.js')).runUgcPuzzleCreatorTests();
    console.log('\n==================================================');
    console.log('🏆 ALL KYBIEN SYSTEM TESTS (SECURITY, CHESS RULES, 30 FIXTURES, EXP ATOMICITY, CONCURRENCY ISOLATION, E2E HTTP API, LEADERBOARD, V2 AUDIT, SEO SLUG, PUZZLE MILESTONE 1, DAILY PUZZLES & BLOG AUTOMATION, UGC CREATOR & VERIFICATION) PASSED 100%!');
    console.log('==================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ REGRESSION TEST FAILED:', err);
    process.exit(1);
  }
}

run();
