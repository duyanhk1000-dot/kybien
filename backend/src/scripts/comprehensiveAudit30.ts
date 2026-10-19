import { prisma } from '../utils/prisma.js';
import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

interface AuditRow {
  puzzle_id: number;
  title: string;
  first_move: string;
  fen_valid: boolean;
  first_move_valid: boolean;
  all_moves_legal: boolean;
  all_branches_verified: boolean;
  checkmate_verified: boolean;
  source_vs_database_match: boolean;
  status: 'VERIFIED' | 'FAILED' | 'BLOCKED';
  failure_reason: string;
}

async function runComprehensiveAudit() {
  console.log('🔬 STARTING COMPREHENSIVE 30-PUZZLE SENIOR QA AUDIT...\n');

  // 1. Đọc dữ liệu nguồn
  const jsonPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_tier1_easy.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Source JSON not found at ${jsonPath}`);
  }
  const rawSource = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // 2. Đọc dữ liệu từ Database PostgreSQL
  const dbPuzzles = await prisma.puzzle.findMany({
    orderBy: { id: 'asc' },
  });

  if (dbPuzzles.length === 0) {
    throw new Error('Database puzzles table is empty!');
  }

  const results: AuditRow[] = [];

  for (let id = 1; id <= 30; id++) {
    const dbPz = dbPuzzles.find(p => p.id === id);
    const sourceFenRaw = rawSource[id.toString()];

    if (!dbPz) {
      results.push({
        puzzle_id: id,
        title: 'N/A',
        first_move: 'N/A',
        fen_valid: false,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: false,
        status: 'FAILED',
        failure_reason: 'Không tìm thấy bản ghi trong Database',
      });
      continue;
    }

    const dbFen = dbPz.fen.trim();
    const sourceFen = sourceFenRaw ? sourceFenRaw.trim() : '';

    // So sánh FEN source và FEN DB (chuẩn hóa bỏ phần turn nếu có)
    const dbFenBase = dbFen.split(' ')[0];
    const sourceFenBase = sourceFen.split(' ')[0];
    const sourceMatch = dbFenBase === sourceFenBase;

    // A. Thẩm định FEN
    let fenValid = false;
    let board: (string | null)[][] = [];
    try {
      board = XiangqiRuleVerifier.parseFen(dbFen);
      const redKing = XiangqiRuleVerifier.findKing(board, 'RED');
      const blackKing = XiangqiRuleVerifier.findKing(board, 'BLACK');

      if (redKing && blackKing &&
          XiangqiRuleVerifier.isPalace(redKing.r, redKing.c, 'RED') &&
          XiangqiRuleVerifier.isPalace(blackKing.r, blackKing.c, 'BLACK')) {
        fenValid = true;
      }
    } catch {
      fenValid = false;
    }

    if (!fenValid) {
      results.push({
        puzzle_id: id,
        title: dbPz.title,
        first_move: 'N/A',
        fen_valid: false,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: sourceMatch,
        status: 'FAILED',
        failure_reason: 'FEN không hợp lệ hoặc thiếu Tướng trong Cung',
      });
      continue;
    }

    // B. Parse Solution Tree từ DB
    let solutionTree: any = null;
    try {
      solutionTree = JSON.parse(dbPz.solution_tree);
    } catch {
      results.push({
        puzzle_id: id,
        title: dbPz.title,
        first_move: 'N/A',
        fen_valid: true,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: sourceMatch,
        status: 'FAILED',
        failure_reason: 'Solution tree không phải JSON hợp lệ',
      });
      continue;
    }

    // C. Thẩm định nước đi đầu tiên
    const branches = solutionTree.branches || [];
    if (branches.length === 0 || !branches[0].move) {
      results.push({
        puzzle_id: id,
        title: dbPz.title,
        first_move: 'NONE',
        fen_valid: true,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: sourceMatch,
        status: 'FAILED',
        failure_reason: 'Không có nhánh nước đi đầu tiên trong solution tree',
      });
      continue;
    }

    const firstMoveUci = branches[0].move;
    const pFirst = XiangqiRuleVerifier.uciToPos(firstMoveUci);
    if (!pFirst) {
      results.push({
        puzzle_id: id,
        title: dbPz.title,
        first_move: firstMoveUci,
        fen_valid: true,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: sourceMatch,
        status: 'FAILED',
        failure_reason: `Nước đi đầu tiên ${firstMoveUci} có tọa độ UCCI sai cú pháp`,
      });
      continue;
    }

    // Kiểm tra quân thực tế tại ô xuất phát
    const pieceAtFrom = board[pFirst.from.r][pFirst.from.c];
    if (!pieceAtFrom || !XiangqiRuleVerifier.isRed(pieceAtFrom)) {
      results.push({
        puzzle_id: id,
        title: dbPz.title,
        first_move: firstMoveUci,
        fen_valid: true,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: sourceMatch,
        status: 'FAILED',
        failure_reason: `Ô xuất phát ${firstMoveUci.slice(0, 2)} không có quân Đỏ hợp lệ (tìm thấy: ${pieceAtFrom || 'TRỐNG'})`,
      });
      continue;
    }

    const firstMoveCheck = XiangqiRuleVerifier.isLegalMove(board, pFirst.from, pFirst.to, 'RED');
    if (!firstMoveCheck.valid) {
      results.push({
        puzzle_id: id,
        title: dbPz.title,
        first_move: firstMoveUci,
        fen_valid: true,
        first_move_valid: false,
        all_moves_legal: false,
        all_branches_verified: false,
        checkmate_verified: false,
        source_vs_database_match: sourceMatch,
        status: 'FAILED',
        failure_reason: `Nước đi 1 (${firstMoveUci} - ${pieceAtFrom}) phạm luật: ${firstMoveCheck.reason}`,
      });
      continue;
    }

    // D. Duyệt đệ quy toàn bộ các nhánh trong DAG (all_moves_legal, all_branches_verified, checkmate_verified)
    let allMovesLegal = true;
    let allBranchesVerified = true;
    let checkmateVerified = true;
    let branchFailure = '';

    function verifySubBranch(
      currentBoard: (string | null)[][],
      redMoveUci: string,
      replies: any[] | undefined,
      isWin: boolean | undefined
    ) {
      // 1. Thực hiện nước đi của Đỏ
      const pRed = XiangqiRuleVerifier.uciToPos(redMoveUci)!;
      const redMoveLegality = XiangqiRuleVerifier.isLegalMove(currentBoard, pRed.from, pRed.to, 'RED');
      if (!redMoveLegality.valid) {
        allMovesLegal = false;
        branchFailure = `Nước đi Đỏ ${redMoveUci} không hợp lệ: ${redMoveLegality.reason}`;
        return;
      }

      const boardAfterRed = XiangqiRuleVerifier.applyMove(currentBoard, pRed.from, pRed.to);

      if (isWin || !replies || replies.length === 0) {
        // Nút lá (Chiếu Bí hoặc Hết nước đi)
        const isMate = XiangqiRuleVerifier.isCheckmate(boardAfterRed, 'BLACK');
        const legalBlackMoves = XiangqiRuleVerifier.getAllLegalMoves(boardAfterRed, 'BLACK');
        if (!isMate && legalBlackMoves.length > 0) {
          checkmateVerified = false;
          branchFailure = `Sau nước ${redMoveUci}, Đen vẫn còn ${legalBlackMoves.length} nước đi hợp lệ (chưa bị chiếu bí)`;
        }
        return;
      }

      // Có các nhánh đáp trả của Đen
      for (const rep of replies) {
        const blackUci = rep.reply_move || rep.reply;
        if (!blackUci) {
          allBranchesVerified = false;
          branchFailure = 'Nhánh phản hồi của Đen thiếu thuộc tính nước đi';
          return;
        }

        const pBlack = XiangqiRuleVerifier.uciToPos(blackUci);
        if (!pBlack) {
          allBranchesVerified = false;
          branchFailure = `Nước đáp trả của Đen ${blackUci} sai cú pháp tọa độ`;
          return;
        }

        const blackCheck = XiangqiRuleVerifier.isLegalMove(boardAfterRed, pBlack.from, pBlack.to, 'BLACK');
        if (!blackCheck.valid) {
          allMovesLegal = false;
          branchFailure = `Nước đáp trả của Đen ${blackUci} phạm luật cờ tướng: ${blackCheck.reason}`;
          return;
        }

        const boardAfterBlack = XiangqiRuleVerifier.applyMove(boardAfterRed, pBlack.from, pBlack.to);

        // Nước phản công tiếp theo của Đỏ
        const nextMoves = rep.next_moves || (rep.counter ? [{ move: rep.counter, is_win: !rep.sub || rep.sub.length === 0, replies: rep.sub }] : []);
        if (!nextMoves || nextMoves.length === 0) {
          allBranchesVerified = false;
          branchFailure = `Sau nước ${blackUci} của Đen, Đỏ không có nước phản công trong solution tree`;
          return;
        }

        for (const nm of nextMoves) {
          verifySubBranch(boardAfterBlack, nm.move, nm.replies, nm.is_win);
          if (branchFailure) return;
        }
      }
    }

    try {
      verifySubBranch(board, firstMoveUci, branches[0].replies, branches[0].is_win);
    } catch (err: any) {
      allMovesLegal = false;
      branchFailure = `Lỗi ngoại lệ khi duyệt cây: ${err.message}`;
    }

    const isVerified = fenValid && firstMoveCheck.valid && allMovesLegal && allBranchesVerified && checkmateVerified && sourceMatch;

    results.push({
      puzzle_id: id,
      title: dbPz.title,
      first_move: firstMoveUci,
      fen_valid: fenValid,
      first_move_valid: firstMoveCheck.valid,
      all_moves_legal: allMovesLegal,
      all_branches_verified: allBranchesVerified,
      checkmate_verified: checkmateVerified,
      source_vs_database_match: sourceMatch,
      status: isVerified ? 'VERIFIED' : 'FAILED',
      failure_reason: branchFailure || (sourceMatch ? 'NONE' : 'FEN source khác FEN database'),
    });
  }

  // Xuất bảng Markdown kết quả
  console.log('| puzzle_id | title | first_move | fen_valid | first_move_valid | all_moves_legal | all_branches_verified | checkmate_verified | source_vs_database_match | status | failure_reason |');
  console.log('|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|');

  for (const r of results) {
    console.log(`| ${r.puzzle_id} | ${r.title} | \`${r.first_move}\` | ${r.fen_valid ? 'PASS' : 'FAIL'} | ${r.first_move_valid ? 'PASS' : 'FAIL'} | ${r.all_moves_legal ? 'PASS' : 'FAIL'} | ${r.all_branches_verified ? 'PASS' : 'FAIL'} | ${r.checkmate_verified ? 'PASS' : 'FAIL'} | ${r.source_vs_database_match ? 'MATCH' : 'MISMATCH'} | **${r.status}** | ${r.failure_reason} |`);
  }

  const verifiedCount = results.filter(r => r.status === 'VERIFIED').length;
  console.log(`\n📊 AUDIT SUMMARY: ${verifiedCount}/30 Puzzles VERIFIED.`);

  fs.writeFileSync(
    path.join(process.cwd(), 'audit_30_results.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  process.exit(verifiedCount === 30 ? 0 : 1);
}

runComprehensiveAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
