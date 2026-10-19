import assert from 'assert';
import { prisma } from '../utils/prisma.js';
import { UgcPuzzleService } from '../services/ugcPuzzleService.js';
import { PuzzleStatus, PuzzleTier } from '@prisma/client';

export async function runUgcPuzzleCreatorTests(): Promise<void> {
  console.log('🧪 RUNNING UGC PUZZLE CREATOR & VERIFICATION TEST SUITE...\n');

  // Test 1: Thẩm định FEN bàn cờ bày thế
  console.log('-> Test 1: Validating FEN setups (Invalid vs Valid)...');
  // Thiếu tướng đỏ
  const noRedKing = UgcPuzzleService.validateFenSetup('3ak4/9/9/9/9/9/9/9/9/9');
  assert.strictEqual(noRedKing.valid, false, 'Phải từ chối thế cờ thiếu Tướng Đỏ');

  // Tướng đỏ ngoài cung
  const redKingOutside = UgcPuzzleService.validateFenSetup('3ak4/9/9/9/9/9/9/9/9/K8');
  assert.strictEqual(redKingOutside.valid, false, 'Phải từ chối thế cờ Tướng Đỏ ngoài cung cấm');

  // Hai tướng lộ mặt nhìn nhau
  const flyingGeneral = UgcPuzzleService.validateFenSetup('4k4/9/9/9/9/9/9/9/9/4K4');
  assert.strictEqual(flyingGeneral.valid, false, 'Phải từ chối thế cờ hai tướng lộ mặt');

  // Thế cờ chuẩn hợp lệ (Đơn Xe Đoạt Mệnh - Sát cục 1 nước)
  // Đỏ: Tướng e0 (cột 4), Xe f3 (cột 5). Đen: Tướng d9 (cột 3)
  const validFen = '3k5/9/9/9/9/9/5R3/9/9/4K4';
  const validSetup = UgcPuzzleService.validateFenSetup(validFen);
  assert.strictEqual(validSetup.valid, true, `FEN hợp lệ phải pass (Lỗi nếu có: ${validSetup.error})`);
  console.log('✅ Test 1 Passed: Thẩm định FEN bàn cờ bày thế chuẩn xác 100%!\n');

  // Test 2: Tạo bản thảo thế cờ (DRAFT)
  console.log('-> Test 2: Creating DRAFT UGC Puzzle with Constraints...');
  const draftResult = await UgcPuzzleService.createDraft({
    title: 'Tuyệt Kỹ Sát Cục Thí Xe',
    fen: validFen,
    description: 'Thách đấu sát cục đoạt soái trong 1 nước duy nhất',
    constraints: {
      max_moves: 1,
      forbidden_pieces: [],
    },
    userId: 9999,
  });

  assert.ok(draftResult.puzzleId, 'Phải trả về ID thế cờ');
  assert.strictEqual(draftResult.status, PuzzleStatus.DRAFT, 'Trạng thái ban đầu phải là DRAFT');
  const draftId = draftResult.puzzleId;
  console.log(`   Đã tạo thế cờ DRAFT #${draftId}: "${draftResult.title}"`);
  console.log('✅ Test 2 Passed: Bản thảo thế cờ DRAFT được lưu thành công!\n');

  // Test 2b: Chặn người dùng ẩn danh (Chưa đăng nhập) tạo bản thảo thế cờ
  console.log('-> Test 2b: Blocking anonymous users from creating drafts...');
  await assert.rejects(
    async () => {
      await UgcPuzzleService.createDraft({
        title: 'Thế cờ của người ẩn danh',
        fen: validFen,
        userId: undefined,
      });
    },
    /Vui lòng đăng nhập tài khoản Kỳ Biến để sáng lập thế cờ!/i,
    'Phải từ chối người dùng ẩn danh tạo thế cờ'
  );
  console.log('✅ Test 2b Passed: Chặn đứng người dùng ẩn danh tạo thế cờ thành công!\n');

  // Test 3: Ngăn chặn xuất bản khi chưa tự giải thắng (Proof of Solution Enforcement)
  console.log('-> Test 3: Enforcing Proof-of-Solution (Cannot publish unverified draft)...');
  await assert.rejects(
    async () => {
      await UgcPuzzleService.publishPuzzle(draftId, 9999);
    },
    /Chỉ có thể xuất bản thế cờ đã tự kiểm chứng thành công/i,
    'Phải chặn xuất bản nếu chưa qua kiểm chứng'
  );
  console.log('✅ Test 3 Passed: Cơ chế Proof-of-Solution chặn đứng việc xuất bản cờ chưa kiểm chứng!\n');

  // Test 4: Ràng buộc Cấm Quân (Forbidden Pieces Enforcement)
  console.log('-> Test 4: Testing Forbidden Pieces Constraints...');
  const forbiddenDraft = await UgcPuzzleService.createDraft({
    title: 'Thế Cờ Cấm Dùng Xe',
    fen: validFen,
    constraints: {
      max_moves: 2,
      forbidden_pieces: ['R'], // Cấm dùng Xe (Rook)
    },
    userId: 9999,
  });

  const forbidSession = await UgcPuzzleService.startVerificationSession(forbiddenDraft.puzzleId, 9999);
  await assert.rejects(
    async () => {
      // Cố tình đi quân Xe f3f9
      await UgcPuzzleService.submitVerifyMove(forbidSession.sessionId, 'f3f9', 9999);
    },
    /Vi phạm điều kiện thách đấu: Cấm sử dụng quân Xe/i,
    'Phải chặn nước đi sử dụng quân Xe'
  );
  console.log('✅ Test 4 Passed: Ràng buộc cấm quân cờ hoạt động tuyệt đối!\n');

  // Test 5: Tự kiểm chứng thành công -> Nâng cấp lên VERIFIED
  console.log('-> Test 5: Author Verification Run (Solving puzzle moves it to VERIFIED)...');
  const verifySession = await UgcPuzzleService.startVerificationSession(draftId, 9999);

  // Đi nước sát cục f3d3 (Xe bình lộ 4 đâm chiếu bí dọc cột d)
  const verifyResult = await UgcPuzzleService.submitVerifyMove(verifySession.sessionId, 'f3d3', 9999);
  assert.strictEqual(verifyResult.status, 'VICTORY', 'Nước sát cục phải trả về VICTORY');
  assert.strictEqual(verifyResult.isVerified, true, 'isVerified phải là true');

  // Kiểm tra trạng thái trong DB đã chuyển sang VERIFIED
  const puzzleInDb = await prisma.puzzle.findUnique({ where: { id: draftId } });
  assert.strictEqual(puzzleInDb?.status, PuzzleStatus.VERIFIED, 'Trạng thái trong DB phải là VERIFIED');
  console.log('   Thế cờ đã vượt qua thẩm định và chuyển trạng thái sang VERIFIED!');
  console.log('✅ Test 5 Passed: Tự kiểm chứng thành công mở khóa trạng thái VERIFIED!\n');

  // Test 6: Xuất bản thế cờ đã VERIFIED lên PUBLISHED
  console.log('-> Test 6: Publishing Verified Puzzle to Giang Hồ Kỳ Trận (PUBLISHED)...');
  const publishResult = await UgcPuzzleService.publishPuzzle(draftId, 9999);
  assert.strictEqual(publishResult.success, true);
  assert.strictEqual(publishResult.status, PuzzleStatus.PUBLISHED);

  const publishedInDb = await prisma.puzzle.findUnique({ where: { id: draftId } });
  assert.strictEqual(publishedInDb?.status, PuzzleStatus.PUBLISHED, 'Trạng thái phải là PUBLISHED');
  console.log('✅ Test 6 Passed: Xuất bản thế cờ lên cộng đồng thành công 100%!\n');

  // Test 7: Upvote thế cờ
  console.log('-> Test 7: Upvoting Community Puzzle...');
  const voteResult = await UgcPuzzleService.upvotePuzzle(draftId);
  assert.strictEqual(voteResult.upvoteCount, 1, 'Lượt vote phải tăng lên 1');
  console.log('✅ Test 7 Passed: Bấm thích thế cờ hoạt động hoàn hảo!\n');

  // Dọn dẹp test puzzles đã tạo
  await prisma.puzzleSession.deleteMany({ where: { puzzle_id: { in: [draftId, forbiddenDraft.puzzleId] } } });
  await prisma.puzzle.deleteMany({ where: { id: { in: [draftId, forbiddenDraft.puzzleId] } } });

  console.log('==================================================');
  console.log('🎉 ALL UGC PUZZLE CREATOR & VERIFICATION TESTS PASSED 100%!');
  console.log('==================================================\n');
}

if (process.argv[1]?.includes('ugcPuzzleCreator')) {
  runUgcPuzzleCreatorTests()
    .catch((e) => {
      console.error('❌ Lỗi:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
