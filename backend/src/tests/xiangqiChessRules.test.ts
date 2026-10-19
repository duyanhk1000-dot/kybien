import assert from 'assert';
import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

export async function runXiangqiChessRulesTests(): Promise<void> {
  console.log('🧪 RUNNING XIANGQI CHESS RULES & FIXTURE VERIFICATION TEST SUITE...\n');

  // =========================================================================
  // TEST 1: Nước đi không hợp lệ theo quy tắc di chuyển từng quân
  // =========================================================================
  console.log('-> Test 1: Invalid piece movement patterns (Sĩ, Tướng, Mã, Tượng)...');

  // Kiểm tra trường hợp P0 của thế #3: Sĩ d9 đi ngang sang f9
  const fen3 = '3akab2/9/4c1N1n/9/9/9/5R3/1r2BA3/4Apr2/4K1B2 w - - 0 1';
  const board3 = XiangqiRuleVerifier.parseFen(fen3);

  // 1. Tại thế cờ gốc: d9f9 đi vào ô quân phe mình (quân Sĩ a tại f9)
  const p_d9 = { r: 0, c: 3 };
  const p_f9 = { r: 0, c: 5 };
  const check_root_d9f9 = XiangqiRuleVerifier.isLegalMove(board3, p_d9, p_f9, 'BLACK');
  assert.strictEqual(check_root_d9f9.valid, false, 'Sĩ d9 ăn quân cùng phe f9 phải bị từ chối');
  assert.strictEqual(check_root_d9f9.reason, 'Không thể ăn quân cùng phe');

  // 2. Sau khi Đỏ đi f3f9 (Xe ăn Sĩ f9, chiếu Tướng): Sĩ đen d9 cố tình đi ngang ăn Xe f9
  const p_f3 = { r: 6, c: 5 };
  const b3AfterF3f9 = XiangqiRuleVerifier.applyMove(board3, p_f3, p_f9);
  const check_d9f9 = XiangqiRuleVerifier.isLegalMove(b3AfterF3f9, p_d9, p_f9, 'BLACK');
  assert.strictEqual(check_d9f9.valid, false, 'Sĩ đi ngang (d9f9) tuyệt đối phải bị từ chối');
  assert.ok(check_d9f9.reason?.includes('Sĩ chỉ được đi chéo 1 ô trong Cung'), 'Lý do phải ghi rõ quy tắc di chuyển của Sĩ');

  // Sĩ đỏ cố tình đi ra khỏi Cung (e1 sang e3)
  const p_e1 = { r: 8, c: 4 };
  const p_e3 = { r: 6, c: 4 };
  const check_advisor_out = XiangqiRuleVerifier.isLegalMove(board3, p_e1, p_e3, 'RED');
  assert.strictEqual(check_advisor_out.valid, false, 'Sĩ ra khỏi Cung phải bị từ chối');

  // Tượng đỏ cố tình qua sông (e2 sang e6)
  const p_e2 = { r: 7, c: 4 };
  const p_e6 = { r: 3, c: 4 };
  const check_elephant_river = XiangqiRuleVerifier.isLegalMove(board3, p_e2, p_e6, 'RED');
  assert.strictEqual(check_elephant_river.valid, false, 'Tượng qua sông phải bị từ chối');

  // Tướng cố tình đi chéo
  const p_e0 = { r: 9, c: 4 };
  const p_f1 = { r: 8, c: 5 };
  const check_king_diagonal = XiangqiRuleVerifier.isLegalMove(board3, p_e0, p_f1, 'RED');
  assert.strictEqual(check_king_diagonal.valid, false, 'Tướng đi chéo phải bị từ chối');

  console.log('✅ Test 1 Passed: Toàn bộ quy tắc di chuyển từng quân cờ được xác minh chuẩn xác!');

  // =========================================================================
  // TEST 2: Kiểm tra cản chân Mã, cản mắt Tượng, Xe/Pháo bị chắn
  // =========================================================================
  console.log('-> Test 2: Obstructions (Chân Mã, Mắt Tượng, Ngòi Pháo)...');

  // Bàn cờ giả lập có Mã bị cản chân
  // Mã đỏ tại e4 (r=5, c=4), quân cản tại e5 (r=4, c=4). Mã muốn nhảy lên d6 (r=3, c=3) -> dr=-2, dc=-1, chân là (r=4, c=4)
  const blockedFen = '4k4/9/9/4p4/4N4/9/9/9/9/4K4 w - - 0 1';
  const blockedBoard = XiangqiRuleVerifier.parseFen(blockedFen);

  const mFrom = { r: 4, c: 4 }; // e5 trong FEN này (r=4, c=4)
  const mTo = { r: 2, c: 3 };   // d7
  const check_blocked_horse = XiangqiRuleVerifier.isLegalMove(blockedBoard, mFrom, mTo, 'RED');
  assert.strictEqual(check_blocked_horse.valid, false);
  assert.ok(check_blocked_horse.reason?.includes('Chân mã bị cản'));

  // Cản mắt Tượng: Tượng tại c0 (r=9, c=2), Mắt tại d1 (r=8, c=3) có quân cản p, Đích tại e2 (r=7, c=4)
  const elephantBlockedFen = '4k4/9/9/9/9/9/9/9/3p5/2B1K4 w - - 0 1';
  const eleBoard = XiangqiRuleVerifier.parseFen(elephantBlockedFen);
  const eleFrom = { r: 9, c: 2 };
  const eleTo = { r: 7, c: 4 };
  const check_blocked_elephant = XiangqiRuleVerifier.isLegalMove(eleBoard, eleFrom, eleTo, 'RED');
  assert.strictEqual(check_blocked_elephant.valid, false);
  assert.ok(check_blocked_elephant.reason?.includes('Mắt tượng bị cản'));

  // Quy tắc di chuyển của Tốt (Pawn): Chưa qua sông vs Đã qua sông
  const pawnFen = '4k4/9/9/2P6/9/9/2P6/9/4A4/4K4 w - - 0 1';
  const pawnBoard = XiangqiRuleVerifier.parseFen(pawnFen);
  // Tốt 1 tại c3 (r=6, c=2) - Chưa qua sông:
  // - Đi tiến c4 (r=5, c=2): Hợp lệ
  const pAdvance = XiangqiRuleVerifier.isLegalMove(pawnBoard, { r: 6, c: 2 }, { r: 5, c: 2 }, 'RED');
  assert.strictEqual(pAdvance.valid, true, 'Tốt tiến 1 ô hợp lệ');
  // - Đi ngang d3 (r=6, c=3): Bị từ chối vì chưa qua sông
  const pSideIllegal = XiangqiRuleVerifier.isLegalMove(pawnBoard, { r: 6, c: 2 }, { r: 6, c: 3 }, 'RED');
  assert.strictEqual(pSideIllegal.valid, false, 'Tốt chưa qua sông không được đi ngang');
  // - Đi lùi c2 (r=7, c=2): Bị từ chối
  const pBackIllegal = XiangqiRuleVerifier.isLegalMove(pawnBoard, { r: 6, c: 2 }, { r: 7, c: 2 }, 'RED');
  assert.strictEqual(pBackIllegal.valid, false, 'Tốt tuyệt đối không được đi lùi');

  // Tốt 2 tại c6 (r=3, c=2) - Đã qua sông:
  // - Đi ngang d6 (r=3, c=3): Hợp lệ
  const pSideLegal = XiangqiRuleVerifier.isLegalMove(pawnBoard, { r: 3, c: 2 }, { r: 3, c: 3 }, 'RED');
  assert.strictEqual(pSideLegal.valid, true, 'Tốt qua sông được phép đi ngang 1 ô');

  // Pháo không ngòi cố ăn quân
  const cannonNoScreenFen = '4k4/9/9/9/4r4/4C4/9/9/9/4K4 w - - 0 1';
  const cBoard = XiangqiRuleVerifier.parseFen(cannonNoScreenFen);
  const cFrom = { r: 5, c: 4 }; // C
  const cTo = { r: 4, c: 4 };   // r
  const check_cannon_no_screen = XiangqiRuleVerifier.isLegalMove(cBoard, cFrom, cTo, 'RED');
  assert.strictEqual(check_cannon_no_screen.valid, false);
  assert.ok(check_cannon_no_screen.reason?.includes('Pháo ăn quân phải có đúng 1 quân làm ngòi'));

  // Pháo có đúng 1 ngòi ăn quân -> Hợp lệ
  const cannonWithScreenFen = '4k4/9/3p5/9/3r5/9/3C5/9/4A4/4K4 w - - 0 1'; // C tại r=6, c=3, r tại r=4, c=3 (ngòi), p tại r=2, c=3 (mục tiêu)
  const cScreenBoard = XiangqiRuleVerifier.parseFen(cannonWithScreenFen);
  const check_cannon_valid = XiangqiRuleVerifier.isLegalMove(cScreenBoard, { r: 6, c: 3 }, { r: 2, c: 3 }, 'RED');
  assert.strictEqual(check_cannon_valid.valid, true, `Pháo có đúng 1 ngòi ăn quân hợp lệ. Lỗi nếu có: ${check_cannon_valid.reason}`);

  console.log('✅ Test 2 Passed: Cản chân Mã, mắt Tượng, ngòi Pháo và luật Tốt được xử lý chuẩn 100%!');

  // =========================================================================
  // TEST 3: Sai lượt (Turn enforcement)
  // =========================================================================
  console.log('-> Test 3: Turn enforcement (Đang lượt Đỏ, cố đi quân Đen)...');
  const check_wrong_turn = XiangqiRuleVerifier.isLegalMove(board3, { r: 7, c: 1 }, { r: 7, c: 2 }, 'RED');
  assert.strictEqual(check_wrong_turn.valid, false);
  assert.ok(check_wrong_turn.reason?.includes('Không phải quân của phe đi'));
  console.log('✅ Test 3 Passed: Kiểm soát lượt đi chuẩn xác!');

  // =========================================================================
  // TEST 4: Nước đi khiến Tướng bị chiếu & Lộ Mặt Tướng (Flying General)
  // =========================================================================
  console.log('-> Test 4: King safety & Flying General rule...');

  // Hai tướng đối mặt trên cột e không có quân chắn
  const flyingFen = '4k4/9/9/9/9/9/9/9/9/4K4 w - - 0 1';
  const fBoard = XiangqiRuleVerifier.parseFen(flyingFen);
  assert.strictEqual(XiangqiRuleVerifier.isFlyingGeneral(fBoard), true, 'Lộ mặt tướng phải trả về true');

  // Nước đi rút quân làm lộ mặt tướng
  const pinFen = '4k4/9/9/9/4R4/9/9/9/9/4K4 w - - 0 1';
  const pinBoard = XiangqiRuleVerifier.parseFen(pinFen);
  // Xe đỏ tại e5 cố tình đi sang f5 -> làm cột e thông suốt -> Lộ mặt tướng
  const check_reveal_king = XiangqiRuleVerifier.isLegalMove(pinBoard, { r: 4, c: 4 }, { r: 4, c: 5 }, 'RED');
  assert.strictEqual(check_reveal_king.valid, false);
  assert.ok(check_reveal_king.reason?.includes('Tướng phe mình bị chiếu'));
  console.log('✅ Test 4 Passed: Lộ mặt tướng và an toàn Tướng được bảo vệ tuyệt đối!');

  // =========================================================================
  // TEST 5: Nhận diện Chiếu Bí (Checkmate Detection) độc lập
  // =========================================================================
  console.log('-> Test 5: Independent Checkmate Detection...');

  // Thế cờ #3 sau khi Đỏ đi f3f9: Xe đỏ ăn Sĩ f9
  const p1 = XiangqiRuleVerifier.uciToPos('f3f9')!;
  const boardAfterF3f9 = XiangqiRuleVerifier.applyMove(board3, p1.from, p1.to);

  const isCheck = XiangqiRuleVerifier.isKingInCheck(boardAfterF3f9, 'BLACK');
  const isMate = XiangqiRuleVerifier.isCheckmate(boardAfterF3f9, 'BLACK');
  const blackMoves = XiangqiRuleVerifier.getAllLegalMoves(boardAfterF3f9, 'BLACK');

  assert.strictEqual(isCheck, true, 'Sau f3f9, Tướng Đen phải bị chiếu');
  assert.strictEqual(blackMoves.length, 0, 'Đen phải có đúng 0 nước đi hợp lệ');
  assert.strictEqual(isMate, true, 'Engine luật phải xác nhận Đen bị Chiếu Bí (Checkmate)!');

  // Trường hợp Vây Khốn (Stalemate - Hết nước đi nhưng không bị chiếu):
  // Tướng Đen tại d9 (r=0, c=3).
  // Các ô thoát: e9 (r=0, c=4) bị Mã Đỏ tại f7 (r=2, c=5) khống chế; d8 (r=1, c=3) bị Mã Đỏ tại c6 (r=3, c=2) khống chế.
  // Ô d9 không bị bất kỳ quân nào chiếu.
  const stalemateFen = '3k5/9/5N3/2N6/9/9/9/9/9/4K4 b - - 0 1';
  const smBoard = XiangqiRuleVerifier.parseFen(stalemateFen);
  const smCheck = XiangqiRuleVerifier.isKingInCheck(smBoard, 'BLACK');
  const smMoves = XiangqiRuleVerifier.getAllLegalMoves(smBoard, 'BLACK');
  assert.strictEqual(smCheck, false, 'Tướng Đen không bị chiếu trực tiếp');
  assert.strictEqual(smMoves.length, 0, 'Đen bị vây khốn tuyệt đối, có đúng 0 nước đi hợp lệ');
  // Trong luật Cờ Tướng, bên bị vây khốn hết nước đi bị xử THUA (Stalemate is a loss for the stalemated player)
  const isStalemateLost = XiangqiRuleVerifier.isCheckmate(smBoard, 'BLACK') || smMoves.length === 0;
  assert.strictEqual(isStalemateLost, true, 'Luật Cờ Tướng quy định bên hết nước đi bị xử thua!');

  // Kiểm tra chuyển đổi tọa độ UCCI & Parse FEN roundtrip
  const uci1 = 'a0a1';
  const pos1 = XiangqiRuleVerifier.uciToPos(uci1);
  assert.ok(pos1);
  assert.strictEqual(XiangqiRuleVerifier.posToUci(pos1.from, pos1.to), uci1);
  assert.strictEqual(XiangqiRuleVerifier.uciToPos('z9a0'), null, 'Tọa độ ngoài biên phải trả về null');
  assert.strictEqual(XiangqiRuleVerifier.uciToPos('a10b2'), null, 'Cú pháp sai phải trả về null');

  console.log('✅ Test 5 Passed: Nhận diện chiếu bí, vây khốn (Stalemate) và chuyển đổi UCCI hoạt động hoàn hảo!');

  // =========================================================================
  // TEST 6: Xác minh độc lập toàn bộ 30 Fixture & DAG Solution Trees
  // =========================================================================
  console.log('-> Test 6: Verifying all 30 Fixtures against international Xiangqi rules...');

  const treesPath = path.join(process.cwd(), 'all_verified_trees.json');
  assert.ok(fs.existsSync(treesPath), 'Phải tồn tại file all_verified_trees.json');
  const treesData = JSON.parse(fs.readFileSync(treesPath, 'utf8'));

  const jsonPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_tier1_easy.json');
  const rawPuzzles = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  let verifiedCount = 0;

  for (let i = 1; i <= 30; i++) {
    const rawFen = rawPuzzles[i.toString()];
    assert.ok(rawFen, `Ải #${i} phải có FEN`);

    const tree = treesData[i.toString()];
    assert.ok(tree, `Ải #${i} phải có dữ liệu cây lời giải`);
    assert.notStrictEqual(tree.status, 'BLOCKED', `Ải #${i} không được ở trạng thái BLOCKED`);

    const board = XiangqiRuleVerifier.parseFen(rawFen);

    // Xác minh nước đi 1 của Đỏ
    const pRed1 = XiangqiRuleVerifier.uciToPos(tree.move);
    assert.ok(pRed1, `Ải #${i}: Tọa độ nước 1 UCCI (${tree.move}) phải hợp lệ`);

    const redCheck = XiangqiRuleVerifier.isLegalMove(board, pRed1.from, pRed1.to, 'RED');
    assert.strictEqual(redCheck.valid, true, `Ải #${i}: Nước đi 1 của Đỏ (${tree.move}) phải hợp lệ theo luật cờ. Lỗi: ${redCheck.reason}`);

    const bAfterRed1 = XiangqiRuleVerifier.applyMove(board, pRed1.from, pRed1.to);

    function verifyTreeBranch(currentBoard: (string | null)[][], replies: any[], puzzleIdx: number) {
      for (const rep of replies) {
        // 1. Black move
        const pBlack = XiangqiRuleVerifier.uciToPos(rep.reply);
        assert.ok(pBlack, `Ải #${puzzleIdx}: Nước đáp trả của Đen (${rep.reply}) phải có tọa độ hợp lệ`);
        const blackCheck = XiangqiRuleVerifier.isLegalMove(currentBoard, pBlack.from, pBlack.to, 'BLACK');
        assert.strictEqual(blackCheck.valid, true, `Ải #${puzzleIdx}: Nước đáp trả của Đen (${rep.reply}) phải hợp lệ. Lỗi: ${blackCheck.reason}`);

        const bAfterBlack = XiangqiRuleVerifier.applyMove(currentBoard, pBlack.from, pBlack.to);

        // 2. Red counter move
        assert.ok(rep.counter, `Ải #${puzzleIdx}: Nước phản công của Đỏ phải tồn tại`);
        const pRedCounter = XiangqiRuleVerifier.uciToPos(rep.counter);
        assert.ok(pRedCounter, `Ải #${puzzleIdx}: Nước phản công (${rep.counter}) phải có tọa độ hợp lệ`);
        const counterCheck = XiangqiRuleVerifier.isLegalMove(bAfterBlack, pRedCounter.from, pRedCounter.to, 'RED');
        assert.strictEqual(counterCheck.valid, true, `Ải #${puzzleIdx}: Nước phản công (${rep.counter}) phải hợp lệ. Lỗi: ${counterCheck.reason}`);

        const bAfterRedCounter = XiangqiRuleVerifier.applyMove(bAfterBlack, pRedCounter.from, pRedCounter.to);

        if (rep.sub && rep.sub.length > 0) {
          verifyTreeBranch(bAfterRedCounter, rep.sub, puzzleIdx);
        } else {
          // Leaf node: Phải là Chiếu Bí hoặc hết nước đi
          const isMate = XiangqiRuleVerifier.isCheckmate(bAfterRedCounter, 'BLACK') || XiangqiRuleVerifier.getAllLegalMoves(bAfterRedCounter, 'BLACK').length === 0;
          assert.strictEqual(isMate, true, `Ải #${puzzleIdx}: Nước kết thúc (${rep.counter}) phải dẫn đến Chiếu Bí hoặc Đen hết nước đi!`);
        }
      }
    }

    if (tree.replies && tree.replies.length > 0) {
      verifyTreeBranch(bAfterRed1, tree.replies, i);
    } else {
      // Chiếu bí ngay nước 1 hoặc Zugzwang
      const mateOrStalemate = XiangqiRuleVerifier.isCheckmate(bAfterRed1, 'BLACK') || XiangqiRuleVerifier.getAllLegalMoves(bAfterRed1, 'BLACK').length === 0;
      assert.strictEqual(mateOrStalemate, true, `Ải #${i}: Sau nước 1 ${tree.move}, Đen phải bị Chiếu Bí hoặc hết nước đi!`);
    }

    verifiedCount++;
  }

  assert.strictEqual(verifiedCount, 30, 'Cả 30 ải thế cờ phải được xác minh độc lập theo luật cờ!');
  console.log(`✅ Test 6 Passed: 30/30 thế cờ cùng mọi nhánh DAG đã được Engine Cờ Tướng chứng minh tính hợp lệ 100%!`);

  console.log('\n==================================================');
  console.log('🏆 ALL XIANGQI CHESS RULES & FIXTURE TESTS PASSED 100%!');
  console.log('==================================================\n');
}

// Cho phép chạy độc lập: npx tsx src/tests/xiangqiChessRules.test.ts
if (process.argv[1]?.includes('xiangqiChessRules.test')) {
  runXiangqiChessRulesTests().catch((err) => {
    console.error('❌ XIANGQI CHESS RULES TEST FAILED:', err);
    process.exit(1);
  });
}
