import assert from 'assert';
import { prisma } from '../utils/prisma.js';
import { PuzzleService } from '../services/puzzleService.js';
import { PuzzleTier, PuzzlePlayMode, PuzzleSessionType } from '@prisma/client';

export async function runPuzzleMilestone1Tests(): Promise<void> {
  console.log('🧪 RUNNING PUZZLE MILESTONE 1 VERIFICATION SUITE...\n');

  // Đảm bảo test user 9999 tồn tại
  let testUser = await prisma.user.upsert({
    where: { id: 9999 },
    update: {},
    create: {
      id: 9999,
      username: 'Tester9999',
      email: 'tester9999@test.com',
      password_hash: 'mockhash123',
      elo: 1200,
      exp: 0n,
      level: 1,
    },
  });

  const testUserId = testUser.id;

  // Dọn dẹp reward log & progress cũ của user 9999 để test có tính lặp lại (reproducible)
  await prisma.puzzleRewardLog.deleteMany({ where: { user_id: testUserId } });
  await prisma.userPuzzleProgress.deleteMany({ where: { user_id: testUserId } });
  await prisma.puzzleSession.deleteMany({ where: { user_id: testUserId } });

  // Reset EXP user 9999 về 0
  await prisma.user.update({
    where: { id: testUserId },
    data: { exp: 0n, level: 1 },
  });

  // =========================================================================
  // TEST 1: Danh sách thế cờ & Bảo mật (Không lộ Solution Tree)
  // =========================================================================
  console.log('-> Test 1: Puzzle Catalog Query & Security (Zero Solution Tree Leaks)...');
  const catalog = await PuzzleService.getPuzzles({
    tier: PuzzleTier.EASY,
    page: 1,
    limit: 30,
    userId: testUserId,
  });

  assert.ok(catalog.total >= 30, `Tổng số thế cờ phải >= 30 (hiện tại: ${catalog.total})`);
  assert.strictEqual(catalog.puzzles.length, 30, 'Phải tải đủ 30 thế cờ cho trang 1');

  for (const p of catalog.puzzles) {
    assert.ok(p.id, 'Thế cờ phải có id');
    assert.ok(p.title, 'Thế cờ phải có title');
    assert.ok(p.fen, 'Thế cờ phải có fen');
    assert.strictEqual(p.tier, PuzzleTier.EASY, 'Tier phải là EASY');
    assert.strictEqual((p as any).solution_tree, undefined, 'BẢO MẬT: solution_tree tuyệt đối không được trả về client!');
  }
  console.log('✅ Test 1 Passed: Danh sách 30 thế cờ chuẩn xác, bảo mật F12 hoàn hảo!');

  // =========================================================================
  // TEST 2: Lấy chi tiết 1 thế cờ theo ID
  // =========================================================================
  console.log('-> Test 2: Single Puzzle Detail by ID...');
  const puzzle5 = catalog.puzzles.find((p) => p.order_index === 5) || catalog.puzzles[4];
  const puzzleDetail = await PuzzleService.getPuzzleById(puzzle5.id, testUserId);

  assert.ok(puzzleDetail, 'Phải tìm thấy chi tiết thế cờ');
  assert.strictEqual(puzzleDetail.id, puzzle5.id);
  assert.strictEqual(puzzleDetail.is_solved, false, 'User mới chưa giải, is_solved phải là false');
  assert.strictEqual((puzzleDetail as any).solution_tree, undefined, 'BẢO MẬT: solution_tree không được trả về trong detail!');
  console.log('✅ Test 2 Passed: Chi tiết thế cờ lấy thành công!');

  // =========================================================================
  // TEST 3: Khởi tạo phiên giải thế cờ (Session State Machine) & Giới hạn 15 phút
  // =========================================================================
  console.log('-> Test 3: Session State Machine Startup & 15m Expiration...');
  const session5 = await PuzzleService.startSession({
    puzzleId: puzzle5.id,
    userId: testUserId,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  assert.ok(session5.sessionId, 'Phải sinh ra sessionId UUID');
  assert.strictEqual(session5.puzzleId, puzzle5.id);
  assert.strictEqual(session5.initialFen, puzzle5.fen);
  assert.strictEqual(session5.mode, PuzzlePlayMode.TRADITIONAL);
  assert.strictEqual(session5.timeLimitSec, 900);

  // Kiểm tra trong database
  const dbSession = await prisma.puzzleSession.findUnique({
    where: { id: session5.sessionId },
  });
  assert.ok(dbSession, 'Session phải được lưu trong PostgreSQL');
  assert.strictEqual(dbSession.status, 'ACTIVE');
  assert.ok(dbSession.expires_at.getTime() > Date.now() + 14 * 60 * 1000, 'Hạn giờ phải ~15 phút');
  console.log('✅ Test 3 Passed: Khởi tạo phiên giải thành công và lưu trong DB!');

  // =========================================================================
  // TEST 4: Thẩm định nước đi đúng - Máy phản ứng đáp trả (CONTINUE)
  // Thế cờ #5 (Song Mã Ẩm Tuyền): Mã c6 nhảy b8 (c6b8), Máy dùng Tướng d9 xuống d8 (d9d8)
  // =========================================================================
  console.log('-> Test 4: Move Verification - Step 1 CONTINUE (Puzzle #5: Player c6b8 -> Computer d9d8)...');
  const step1 = await PuzzleService.submitMove({
    sessionId: session5.sessionId,
    moveUci: 'c6b8',
    userId: testUserId,
  });

  assert.strictEqual(step1.status, 'CONTINUE', 'Trạng thái phải là CONTINUE');
  assert.strictEqual(step1.playerMove, 'c6b8');
  assert.strictEqual(step1.computerReply, 'd9d8', 'Máy phải đáp trả bằng d9d8');
  assert.ok(step1.currentFen, 'Server phải trả về currentFen mới');

  // Kiểm tra cập nhật lịch sử nước đi trong DB session
  const updatedDbSession = await prisma.puzzleSession.findUnique({
    where: { id: session5.sessionId },
  });
  const hist = JSON.parse(updatedDbSession?.move_history || '[]');
  assert.deepStrictEqual(hist, ['c6b8', 'd9d8'], 'move_history trong DB phải ghi nhận cả nước người chơi và máy');
  console.log('✅ Test 4 Passed: Nước đi 1 thẩm định thành công, máy đáp trả d9d8!');

  // =========================================================================
  // TEST 5: Nước đi sát cục chiến thắng (VICTORY) & Nhận thưởng EXP nguyên tử
  // Thế cờ #5: Mã c5 nhảy b7 (c5b7) sát cục!
  // =========================================================================
  console.log('-> Test 5: Winning Move VICTORY & Atomic EXP Reward Transaction...');
  const step2 = await PuzzleService.submitMove({
    sessionId: session5.sessionId,
    moveUci: 'c5b7',
    userId: testUserId,
  });

  assert.strictEqual(step2.status, 'VICTORY', 'Trạng thái phải là VICTORY');
  assert.strictEqual(step2.isFirstClear, true, 'Lần đầu phá giải, isFirstClear phải là true');
  assert.strictEqual(step2.expGained, 2, 'Tier EASY thưởng 2 EXP');
  assert.strictEqual(step2.newTotalExp, '2', 'Tổng EXP mới phải là 2');

  // Kiểm tra session DB thành WON
  const wonSession = await prisma.puzzleSession.findUnique({
    where: { id: session5.sessionId },
  });
  assert.strictEqual(wonSession?.status, 'WON');

  // Kiểm tra bản ghi UserPuzzleProgress
  const progress = await prisma.userPuzzleProgress.findUnique({
    where: {
      user_id_puzzle_id_mode: {
        user_id: testUserId,
        puzzle_id: puzzle5.id,
        mode: PuzzlePlayMode.TRADITIONAL,
      },
    },
  });
  assert.ok(progress, 'Phải có bản ghi UserPuzzleProgress');
  assert.strictEqual(progress.is_solved, true);

  // Kiểm tra bản ghi PuzzleRewardLog
  const rewardLog = await prisma.puzzleRewardLog.findUnique({
    where: { reward_key: `FIRST_CLEAR:${testUserId}:${puzzle5.id}:TRADITIONAL` },
  });
  assert.ok(rewardLog, 'Phải có bản ghi PuzzleRewardLog');
  assert.strictEqual(rewardLog.exp_amount, 2);

  // Kiểm tra User EXP trong database
  const userAfterWin = await prisma.user.findUnique({ where: { id: testUserId } });
  assert.strictEqual(userAfterWin?.exp, 2n, 'User EXP trong DB phải là 2n');
  console.log('✅ Test 5 Passed: Chiến thắng và cộng thưởng EXP nguyên tử chuẩn xác!');

  // =========================================================================
  // TEST 6: Chống Buff Bẩn / Idempotency Check (Giải lại cùng thế cờ không cộng thêm EXP)
  // =========================================================================
  console.log('-> Test 6: Anti-Farming & Idempotency Check (Re-clearing awards 0 EXP)...');
  const session5Replay = await PuzzleService.startSession({
    puzzleId: puzzle5.id,
    userId: testUserId,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  // Đi lại nước 1
  await PuzzleService.submitMove({
    sessionId: session5Replay.sessionId,
    moveUci: 'c6b8',
    userId: testUserId,
  });

  // Đi lại nước 2 sát cục
  const step2Again = await PuzzleService.submitMove({
    sessionId: session5Replay.sessionId,
    moveUci: 'c5b7',
    userId: testUserId,
  });

  assert.strictEqual(step2Again.status, 'VICTORY');
  assert.strictEqual(step2Again.isFirstClear, false, 'Giải lại lần 2, isFirstClear phải là false');
  assert.strictEqual(step2Again.expGained, 0, 'Giải lại không được cộng EXP (expGained = 0)');

  // Kiểm tra EXP của user vẫn giữ nguyên 2n (không bị buff bẩn)
  const userAfterReplay = await prisma.user.findUnique({ where: { id: testUserId } });
  assert.strictEqual(userAfterReplay?.exp, 2n, 'User EXP vẫn phải là 2n, chống buff bẩn 100%!');
  console.log('✅ Test 6 Passed: Cơ chế chống buff bẩn / cộng trùng EXP hoạt động tuyệt đối!');

  // =========================================================================
  // TEST 7: Kiểm chứng độc lập Thế cờ #3 (Sát cục 1 nước đã xác minh f3f9)
  // =========================================================================
  console.log('-> Test 7: Puzzle #3 Verification (f3f9 Instant Checkmate)...');
  const puzzle3 = catalog.puzzles.find((p) => p.order_index === 3) || catalog.puzzles[2];
  const session3 = await PuzzleService.startSession({
    puzzleId: puzzle3.id,
    userId: testUserId,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  const p3Result = await PuzzleService.submitMove({
    sessionId: session3.sessionId,
    moveUci: 'f3f9',
    userId: testUserId,
  });

  assert.strictEqual(p3Result.status, 'VICTORY', 'Nước f3f9 là sát cục 1 nước trực tiếp!');
  assert.strictEqual(p3Result.isFirstClear, true);
  assert.strictEqual(p3Result.expGained, 2);
  console.log('✅ Test 7 Passed: Thế cờ #3 phá giải sát cục trực tiếp thành công 100%!');

  // =========================================================================
  // TEST 8: Nước đi sai lầm (Blunder) dẫn đến Bại trận (DEFEAT)
  // =========================================================================
  console.log('-> Test 8: Legal Blunder Move leads to DEFEAT...');
  const session3Blunder = await PuzzleService.startSession({
    puzzleId: puzzle3.id,
    userId: testUserId,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  // f3e3 là nước đi hợp lệ của Xe (đi ngang trên hàng 3), nhưng sai chiến thuật (Blunder)
  const blunderResult = await PuzzleService.submitMove({
    sessionId: session3Blunder.sessionId,
    moveUci: 'f3e3',
    userId: testUserId,
  });

  assert.strictEqual(blunderResult.status, 'DEFEAT', 'Nước sai chiến thuật phải trả về DEFEAT');
  assert.ok(blunderResult.defeatReason, 'Phải có giải thích nguyên do bại trận');

  // Kiểm tra session DB
  const defeatedSession = await prisma.puzzleSession.findUnique({
    where: { id: session3Blunder.sessionId },
  });
  assert.strictEqual(defeatedSession?.status, 'DEFEATED');
  console.log('✅ Test 8 Passed: Bại trận khi đi nước sai chiến thuật hoạt động chuẩn xác!');

  // =========================================================================
  // TEST 9: Từ chối nước đi vi phạm luật cờ tướng (Illegal Move Rejection)
  // =========================================================================
  console.log('-> Test 9: Rejection of illegal moves under Xiangqi rules...');
  const sessionLegalCheck = await PuzzleService.startSession({
    puzzleId: puzzle3.id,
    userId: testUserId,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  let illegalErrorCaught = false;
  try {
    // f3f1 là nước Xe nhảy xuyên qua Sĩ f2 -> Vi phạm luật Xe bị cản
    await PuzzleService.submitMove({
      sessionId: sessionLegalCheck.sessionId,
      moveUci: 'f3f1',
      userId: testUserId,
    });
  } catch (err: any) {
    illegalErrorCaught = true;
    assert.ok(err.message.includes('không hợp lệ') || err.message.includes('phạm luật'), 'Lỗi phải nêu rõ vi phạm luật cờ');
  }
  assert.strictEqual(illegalErrorCaught, true, 'Server phải chặn nước đi vi phạm luật cờ!');

  // Session vẫn phải giữ nguyên ACTIVE để người chơi đi lại nước hợp lệ
  const activeSessionCheck = await prisma.puzzleSession.findUnique({
    where: { id: sessionLegalCheck.sessionId },
  });
  assert.strictEqual(activeSessionCheck?.status, 'ACTIVE', 'Nước đi phạm luật không được làm hỏng session!');
  console.log('✅ Test 9 Passed: Chặn đứng nước đi phạm luật, bảo toàn trạng thái session!');

  // =========================================================================
  // TEST 10: Hai request nhận thưởng đồng thời (Race-Condition / Concurrency Test)
  // =========================================================================
  console.log('-> Test 10: Concurrent Reward Claim Protection (Race-Condition test)...');
  const puzzle4 = catalog.puzzles.find((p) => p.order_index === 4) || catalog.puzzles[3];
  const sessionConcurrent = await PuzzleService.startSession({
    puzzleId: puzzle4.id,
    userId: testUserId,
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  const userExpBefore = (await prisma.user.findUnique({ where: { id: testUserId } }))?.exp || 0n;

  // Gửi 2 request kết thúc ván đấu cùng một lúc (Promise.all)
  const [res1, res2] = await Promise.allSettled([
    PuzzleService.submitMove({ sessionId: sessionConcurrent.sessionId, moveUci: 'b9d8', userId: testUserId }),
    PuzzleService.submitMove({ sessionId: sessionConcurrent.sessionId, moveUci: 'b9d8', userId: testUserId }),
  ]);

  // Ít nhất 1 request thành công, request thứ hai có thể thành công với exp=0 hoặc bị chặn do session đã kết thúc
  const userExpAfter = (await prisma.user.findUnique({ where: { id: testUserId } }))?.exp || 0n;
  const expDiff = Number(userExpAfter - userExpBefore);

  assert.strictEqual(expDiff, 2, 'Dù gửi đồng thời, EXP chỉ được cộng DUY NHẤT 1 lần (+2 EXP), không bao giờ bị nhân đôi!');
  console.log('✅ Test 10 Passed: Khóa giao dịch nguyên tử bảo vệ tuyệt đối trước Race-Condition!');

  // =========================================================================
  // TEST 11: Bảo vệ quyền sở hữu session (Wrong Owner Protection)
  // =========================================================================
  console.log('-> Test 11: Session Ownership Isolation (Wrong User Rejection)...');
  const sessionOtherUser = await PuzzleService.startSession({
    puzzleId: puzzle5.id,
    userId: testUserId, // session của user 9999
    mode: PuzzlePlayMode.TRADITIONAL,
    sessionType: PuzzleSessionType.RANKED,
  });

  let wrongUserError = false;
  try {
    await PuzzleService.submitMove({
      sessionId: sessionOtherUser.sessionId,
      moveUci: 'c6b8',
      userId: 8888, // user 8888 cố tình can thiệp vào session của user 9999
    });
  } catch (err: any) {
    wrongUserError = true;
    assert.ok(err.message.includes('không có quyền'), 'Phải từ chối vì không đúng chủ sở hữu');
  }
  assert.strictEqual(wrongUserError, true, 'Server phải chặn truy cập session chéo!');
  console.log('✅ Test 11 Passed: Quyền sở hữu phiên giải cờ được cô lập an toàn!');

  // =========================================================================
  // TEST 12: Phiên hết hạn (Expired Session Rejection)
  // =========================================================================
  console.log('-> Test 12: Expired Session Handling...');
  const expiredSession = await prisma.puzzleSession.create({
    data: {
      puzzle_id: puzzle5.id,
      user_id: testUserId,
      mode: PuzzlePlayMode.TRADITIONAL,
      session_type: PuzzleSessionType.RANKED,
      current_fen: puzzle5.fen,
      move_history: JSON.stringify([]),
      status: 'ACTIVE',
      expires_at: new Date(Date.now() - 1000), // Đã hết hạn 1 giây trước
    },
  });

  let expiredErrorCaught = false;
  try {
    await PuzzleService.submitMove({
      sessionId: expiredSession.id,
      moveUci: 'c6b8',
      userId: testUserId,
    });
  } catch (err: any) {
    expiredErrorCaught = true;
    assert.ok(err.message.includes('hết hạn'), 'Thông báo lỗi phải đề cập hết hạn');
  }
  assert.strictEqual(expiredErrorCaught, true, 'Server phải chặn nước đi khi session đã hết hạn!');
  console.log('✅ Test 12 Passed: Chặn phiên hết hạn hoàn hảo!');

  console.log('\n==================================================');
  console.log('🎉 ALL 12 PUZZLE MILESTONE 1 TESTS PASSED 100%!');
  console.log('==================================================\n');
}

// Cho phép chạy độc lập: npx tsx src/tests/puzzleMilestone1.test.ts
if (process.argv[1]?.includes('puzzleMilestone1.test')) {
  runPuzzleMilestone1Tests().catch((err) => {
    console.error('❌ PUZZLE MILESTONE 1 TEST FAILED:', err);
    process.exit(1);
  });
}
