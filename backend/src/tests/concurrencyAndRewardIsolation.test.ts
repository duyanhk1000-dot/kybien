import assert from 'assert';
import { prisma } from '../utils/prisma.js';
import { PuzzleService } from '../services/puzzleService.js';
import { PuzzlePlayMode, PuzzleSessionType } from '@prisma/client';

export async function runConcurrencyAndRewardIsolationTests(): Promise<void> {
  console.log('🧪 RUNNING CONCURRENCY & REWARD ISOLATION INTEGRATION TEST SUITE (REAL POSTGRESQL)...\n');

  // Đảm bảo 2 user thử nghiệm tồn tại: 9998 và 9999
  const user1Id = 9999;
  const user2Id = 9998;

  await prisma.user.upsert({
    where: { id: user1Id },
    update: { exp: 0n, level: 1 },
    create: { id: user1Id, username: 'Tester9999', email: 'tester9999@test.com', password_hash: 'hash', exp: 0n, level: 1, elo: 1200 },
  });

  await prisma.user.upsert({
    where: { id: user2Id },
    update: { exp: 0n, level: 1 },
    create: { id: user2Id, username: 'Tester9998', email: 'tester9998@test.com', password_hash: 'hash', exp: 0n, level: 1, elo: 1200 },
  });

  // Dọn dẹp dữ liệu cũ của cả 2 user để đảm bảo tính lặp lại
  await prisma.puzzleRewardLog.deleteMany({ where: { user_id: { in: [user1Id, user2Id] } } });
  await prisma.userPuzzleProgress.deleteMany({ where: { user_id: { in: [user1Id, user2Id] } } });
  await prisma.puzzleSession.deleteMany({ where: { user_id: { in: [user1Id, user2Id] } } });

  // Reset EXP về 0
  await prisma.user.update({ where: { id: user1Id }, data: { exp: 0n, level: 1 } });
  await prisma.user.update({ where: { id: user2Id }, data: { exp: 0n, level: 1 } });

  // Lấy Thế cờ #1 (Thế cờ 1 nước Red a7c8 -> Đen Zugzwang)
  const puzzle1 = await prisma.puzzle.findFirst({ where: { order_index: 1 } });
  assert.ok(puzzle1, 'Thế cờ #1 phải tồn tại trong Database');

  // =========================================================================
  // PHẦN A: 10 REQUEST ĐỒNG THỜI CHO CÙNG 1 USER, CÙNG ẢI (CONCURRENCY RACE-CONDITION)
  // =========================================================================
  console.log('-> Scenario A: 10 concurrent requests from User 9999 for Puzzle #1...');

  const sessionU1 = await PuzzleService.startSession({
    puzzleId: puzzle1.id,
    userId: user1Id,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  const expBeforeU1 = (await prisma.user.findUnique({ where: { id: user1Id } }))?.exp || 0n;
  assert.strictEqual(expBeforeU1, 0n, 'EXP ban đầu của User 9999 phải là 0');

  // Bắn 10 request submitMove đồng thời (Promise.all)
  const concurrentPromises = Array(10).fill(null).map(() =>
    PuzzleService.submitMove({
      sessionId: sessionU1.sessionId,
      moveUci: 'a7c8',
      userId: user1Id,
    })
  );

  const results = await Promise.allSettled(concurrentPromises);

  // Đếm kết quả thành công và thất bại
  const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
  const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

  console.log(`   - Kết quả 10 request đồng thời: ${fulfilled.length} fulfilled, ${rejected.length} rejected`);

  // Kiểm tra số dư EXP sau 10 request
  const expAfterU1 = (await prisma.user.findUnique({ where: { id: user1Id } }))?.exp || 0n;
  console.log(`   - EXP trước: ${expBeforeU1}, EXP sau: ${expAfterU1}`);
  assert.strictEqual(expAfterU1, 2n, 'Dù bắn 10 request đồng thời, EXP chỉ được cộng đúng 1 lần duy nhất (+2 EXP), không bao giờ bị nhân đôi!');

  // Kiểm tra số bản ghi trong bảng puzzle_reward_logs
  const rewardLogsU1 = await prisma.puzzleRewardLog.findMany({
    where: { user_id: user1Id, puzzle_id: puzzle1.id },
  });
  assert.strictEqual(rewardLogsU1.length, 1, 'Bảng puzzle_reward_logs chỉ được ghi đúng 1 bản ghi duy nhất!');
  assert.strictEqual(rewardLogsU1[0].reward_key, `FIRST_CLEAR:${user1Id}:${puzzle1.id}:TRADITIONAL`);
  console.log('✅ Scenario A Passed: Khóa giao dịch nguyên tử bảo vệ tuyệt đối trước 10 request đồng thời!');

  // =========================================================================
  // PHẦN B: HAI NGƯỜI DÙNG KHÁC NHAU GIẢI CÙNG 1 THẾ CỜ (REWARD ISOLATION TEST)
  // =========================================================================
  console.log('\n-> Scenario B: User 9998 solves the SAME Puzzle #1 (Testing broad UNIQUE key bug)...');

  const expBeforeU2 = (await prisma.user.findUnique({ where: { id: user2Id } }))?.exp || 0n;
  assert.strictEqual(expBeforeU2, 0n, 'EXP ban đầu của User 9998 phải là 0');

  const sessionU2 = await PuzzleService.startSession({
    puzzleId: puzzle1.id,
    userId: user2Id,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  const resU2 = await PuzzleService.submitMove({
    sessionId: sessionU2.sessionId,
    moveUci: 'a7c8',
    userId: user2Id,
  });

  assert.strictEqual(resU2.status, 'VICTORY', 'User 9998 phải giải thắng thế cờ');
  assert.strictEqual(resU2.isFirstClear, true, 'User 9998 phải nhận được thưởng First Clear riêng biệt!');
  assert.strictEqual(resU2.expGained, 2, 'User 9998 phải được cộng 2 EXP');

  const expAfterU2 = (await prisma.user.findUnique({ where: { id: user2Id } }))?.exp || 0n;
  assert.strictEqual(expAfterU2, 2n, 'EXP của User 9998 phải tăng lên 2');

  // Kiểm tra bảng puzzle_reward_logs có 2 bản ghi riêng biệt cho 2 user
  const totalLogsPuzzle1 = await prisma.puzzleRewardLog.findMany({
    where: { puzzle_id: puzzle1.id },
  });
  assert.strictEqual(totalLogsPuzzle1.length, 2, 'Cả 2 user phải có bản ghi reward_log riêng biệt');
  const user1Log = totalLogsPuzzle1.find(l => l.user_id === user1Id);
  const user2Log = totalLogsPuzzle1.find(l => l.user_id === user2Id);
  assert.ok(user1Log, 'User 9999 phải có log');
  assert.ok(user2Log, 'User 9998 phải có log');
  assert.strictEqual(user1Log.reward_key, `FIRST_CLEAR:${user1Id}:${puzzle1.id}:TRADITIONAL`);
  assert.strictEqual(user2Log.reward_key, `FIRST_CLEAR:${user2Id}:${puzzle1.id}:TRADITIONAL`);
  console.log('✅ Scenario B Passed: Khóa UNIQUE chuẩn xác, phân biệt độc lập từng người chơi!');

  // =========================================================================
  // PHẦN C: CHƠI LẠI (RE-SOLVING) KHÔNG ĐƯỢC CỘNG THÊM EXP
  // =========================================================================
  console.log('\n-> Scenario C: User 9998 clears Puzzle #1 a second time (Anti-farming test)...');

  const sessionU2Second = await PuzzleService.startSession({
    puzzleId: puzzle1.id,
    userId: user2Id,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  const resU2Second = await PuzzleService.submitMove({
    sessionId: sessionU2Second.sessionId,
    moveUci: 'a7c8',
    userId: user2Id,
  });

  assert.strictEqual(resU2Second.status, 'VICTORY', 'Giải lần 2 vẫn thắng');
  assert.strictEqual(resU2Second.isFirstClear, false, 'Giải lần 2 không phải First Clear');
  assert.strictEqual(resU2Second.expGained, 0, 'Giải lần 2 được 0 EXP');

  const expFinalU2 = (await prisma.user.findUnique({ where: { id: user2Id } }))?.exp || 0n;
  assert.strictEqual(expFinalU2, 2n, 'EXP của User 9998 không đổi (vẫn là 2 EXP)');
  console.log('✅ Scenario C Passed: Cơ chế chống cày trùng EXP hoạt động tuyệt đối!');

  // =========================================================================
  // PHẦN D: KIỂM TOÁN TÍNH NGUYÊN TỬ CỦA TRANSACTION (ROLLBACK INTEGRITY)
  // =========================================================================
  console.log('\n-> Scenario D: Atomic Transaction Rollback Integrity...');

  const initialUser1 = await prisma.user.findUnique({ where: { id: user1Id } });
  const initialLogCount = await prisma.puzzleRewardLog.count();

  // Thử nghiệm transaction thất bại giữa chừng
  let txFailedAsExpected = false;
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Tạo bản ghi reward log với puzzle1.id hợp lệ
      await tx.puzzleRewardLog.create({
        data: {
          user_id: user1Id,
          puzzle_id: puzzle1.id,
          mode: PuzzlePlayMode.TRADITIONAL,
          reward_key: `MOCK_ROLLBACK_TEST:${user1Id}`,
          exp_amount: 100,
        },
      });

      // 2. Cố tình ném lỗi nghiêm trọng trước khi cập nhật user EXP
      throw new Error('SIMULATED_TRANSACTION_FAILURE_MIDWAY');
    });
  } catch (err: any) {
    if (err.message === 'SIMULATED_TRANSACTION_FAILURE_MIDWAY') {
      txFailedAsExpected = true;
    }
  }

  assert.strictEqual(txFailedAsExpected, true, 'Lỗi mô phỏng phải bị bắt');

  // Xác minh tính nguyên tử: KHÔNG có bản ghi nào bị rò rỉ vào database
  const finalLogCount = await prisma.puzzleRewardLog.count();
  const finalUser1 = await prisma.user.findUnique({ where: { id: user1Id } });

  assert.strictEqual(finalLogCount, initialLogCount, 'Toàn bộ transaction phải bị rollback, không ghi nhận reward log!');
  assert.strictEqual(finalUser1?.exp, initialUser1?.exp, 'EXP của người dùng không bị thay đổi khi transaction thất bại!');
  console.log('✅ Scenario D Passed: Tính nguyên tử của PostgreSQL transaction hoạt động hoàn hảo 100%!');

  console.log('\n=========================================================================');
  console.log('🎉 ALL CONCURRENCY & REWARD ISOLATION INTEGRATION TESTS PASSED 100%!');
  console.log('=========================================================================\n');
}

// Chạy trực tiếp
if (process.argv[1]?.includes('concurrencyAndRewardIsolation.test')) {
  runConcurrencyAndRewardIsolationTests().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  });
}
