import assert from 'assert';
import { prisma } from '../utils/prisma.js';
import { DailyPuzzleService } from '../services/dailyPuzzleService.js';
import { DailyBloggerService } from '../services/dailyBloggerService.js';

export async function runDailyPuzzleAndBlogTests(): Promise<void> {
  console.log('🧪 RUNNING DAILY PUZZLE & BLOG AUTOMATION TEST SUITE...\n');

  // Test 1: Lấy 3 thế cờ hàng ngày hôm nay
  console.log('-> Test 1: Fetching today\'s 3 Daily Puzzles (Easy, Medium, Hard)...');
  const todayStr = DailyPuzzleService.getTodayDateStr();
  const daily = await DailyPuzzleService.getDailyPuzzles(todayStr);

  assert.ok(daily, 'Daily summary phải tồn tại');
  assert.strictEqual(daily.date, todayStr, `Ngày phải là ${todayStr}`);
  assert.strictEqual(daily.puzzles.length, 3, 'Phải có đúng 3 thế cờ hàng ngày');

  const tiers = daily.puzzles.map(p => p.tier);
  assert.ok(tiers.includes('EASY'), 'Phải có ải EASY');
  assert.ok(tiers.includes('MEDIUM'), 'Phải có ải MEDIUM');
  assert.ok(tiers.includes('HARD'), 'Phải có ải HARD');

  for (const p of daily.puzzles) {
    assert.ok(p.id, 'Phải có id');
    assert.ok(p.title, 'Phải có tiêu đề');
    assert.ok(p.fen, 'Phải có FEN');
    assert.ok(p.exp_reward > 0, 'Phải có thưởng EXP');
    console.log(`   [${p.tier}] #${p.id} "${p.title}" (+${p.exp_reward} EXP)`);
  }
  console.log('✅ Test 1 Passed: 3 thế cờ hàng ngày (Dễ - Vừa - Khó) được tạo và gán chuẩn xác!\n');

  // Test 2: Sinh bài viết Blog kiếm hiệp khiêu khích
  console.log('-> Test 2: Generating Provocative Wuxia Blog Post for Blogger...');
  const article = await DailyBloggerService.generateArticleContent(todayStr, daily.puzzles.map(p => ({
    id: p.id,
    tier: p.tier as any,
    title: p.title,
    fen: p.fen,
    expReward: p.exp_reward,
  })));

  assert.ok(article.title.includes('Tam Đại Kỳ Trận'), 'Tiêu đề phải chứa Tam Đại Kỳ Trận');
  assert.ok(article.title.includes(todayStr), 'Tiêu đề phải chứa ngày tháng');
  assert.ok(article.htmlContent.includes(daily.puzzles[0].title), 'Nội dung phải chứa tên thế cờ Dễ');
  assert.ok(article.htmlContent.includes(daily.puzzles[1].title), 'Nội dung phải chứa tên thế cờ Vừa');
  assert.ok(article.htmlContent.includes(daily.puzzles[2].title), 'Nội dung phải chứa tên thế cờ Khó');
  assert.ok(article.htmlContent.includes('kdp-cta-btn'), 'Nội dung phải có nút bấm Call to Action vào chơi cờ');
  assert.ok(article.htmlContent.includes('daily='), 'Nút CTA phải chứa deep link daily');

  console.log(`   Tiêu đề Blog: "${article.title}"`);
  console.log(`   Độ dài HTML Blog: ${article.htmlContent.length} ký tự`);
  console.log('✅ Test 2 Passed: Bài viết Blog kiếm hiệp khiêu khích được sinh với đầy đủ thẻ, tiêu đề và link CTA!\n');

  // Test 3: API Thử nghiệm đăng bài Blogger (Chế độ mô phỏng / an toàn)
  console.log('-> Test 3: Testing Daily Blogger Publishing Workflow...');
  const publishResult = await DailyBloggerService.publishToBlogger(todayStr, daily.puzzles.map(p => ({
    id: p.id,
    tier: p.tier as any,
    title: p.title,
    fen: p.fen,
    expReward: p.exp_reward,
  })));

  assert.ok(publishResult.title, 'Kết quả đăng bài phải có tiêu đề');
  assert.ok(publishResult.htmlContent, 'Kết quả đăng bài phải có nội dung HTML');
  if (publishResult.published) {
    console.log(`   [Live Blogger] Bài viết đã đăng thành công lên Blog ID: ${publishResult.postId}, URL: ${publishResult.postUrl}`);
  } else {
    console.log('   [Simulated / Ready] Blogger OAuth chưa kết nối, bài viết đã được tạo sẵn sàng cho Cron Job xuất bản.');
  }
  console.log('✅ Test 3 Passed: Workflow xuất bản bài viết hoạt động trơn tru không lỗi!\n');

  // Test 4: Xác minh Idempotency (Gán ngày nhiều lần không bị duplicate)
  console.log('-> Test 4: Verifying Daily Puzzles Idempotency...');
  const dailyAgain = await DailyPuzzleService.getDailyPuzzles(todayStr);
  assert.strictEqual(dailyAgain.puzzles.length, 3, 'Số lượng thế cờ vẫn phải đúng 3');
  assert.strictEqual(dailyAgain.puzzles[0].id, daily.puzzles[0].id, 'Ải Easy phải giữ nguyên');
  assert.strictEqual(dailyAgain.puzzles[1].id, daily.puzzles[1].id, 'Ải Medium phải giữ nguyên');
  assert.strictEqual(dailyAgain.puzzles[2].id, daily.puzzles[2].id, 'Ải Hard phải giữ nguyên');
  console.log('✅ Test 4 Passed: Tính nhất quán của 3 thế cờ trong ngày được đảm bảo tuyệt đối!\n');

  console.log('==================================================');
  console.log('🎉 ALL DAILY PUZZLE & BLOG AUTOMATION TESTS PASSED 100%!');
  console.log('==================================================\n');
}

if (process.argv[1]?.includes('dailyPuzzleAndBlog')) {
  runDailyPuzzleAndBlogTests()
    .catch((e) => {
      console.error('❌ Lỗi:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
