import { XiangqiRuleVerifier } from '../utils/xiangqiRuleVerifier.js';
import fs from 'fs';
import path from 'path';

interface FixtureAuditResult {
  index: number;
  fen: string;
  initialRedInCheck: boolean;
  initialBlackInCheck: boolean;
  redLegalMovesCount: number;
  status: 'VERIFIED' | 'BLOCKED' | 'NEED_SOLUTION';
  details: string;
  testMoves?: {
    move: string;
    valid: boolean;
    reason?: string;
    givesCheck?: boolean;
    isCheckmate?: boolean;
    replyMove?: string;
    replyValid?: boolean;
    replyReason?: string;
  };
}

async function audit() {
  console.log('🔍 [AUDIT] BẮT ĐẦU KIỂM CHỨNG TOÀN DIỆN 30 FIXTURE CỜ THẾ BẰNG XIANGQI RULE VERIFIER...\n');

  const jsonPath = path.join(process.cwd(), '..', 'data', 'puzzles', 'puzzles_tier1_easy.json');
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const results: FixtureAuditResult[] = [];

  // =========================================================================
  // 1. KIỂM TRA ĐẶC BIỆT: FIXTURE #3
  // =========================================================================
  console.log('------------------------------------------------------------');
  console.log('📌 [P0 AUDIT] THẾ CỜ #3: FEN = 3akab2/9/4c1N1n/9/9/9/5R3/1r2BA3/4Apr2/4K1B2 w - - 0 1');
  const fen3 = rawData['3'];
  const board3 = XiangqiRuleVerifier.parseFen(fen3);

  const p_f3f9 = XiangqiRuleVerifier.uciToPos('f3f9')!;
  const legal_f3f9 = XiangqiRuleVerifier.isLegalMove(board3, p_f3f9.from, p_f3f9.to, 'RED');
  console.log(`- Nước 1 của Đỏ f3f9 (Xe ăn Sĩ): Hợp lệ = ${legal_f3f9.valid} (${legal_f3f9.reason || 'OK'})`);

  const boardAfter_f3f9 = XiangqiRuleVerifier.applyMove(board3, p_f3f9.from, p_f3f9.to);
  const blackInCheckAfter_f3f9 = XiangqiRuleVerifier.isKingInCheck(boardAfter_f3f9, 'BLACK');
  const blackCheckmateAfter_f3f9 = XiangqiRuleVerifier.isCheckmate(boardAfter_f3f9, 'BLACK');
  const blackLegalReplies = XiangqiRuleVerifier.getAllLegalMoves(boardAfter_f3f9, 'BLACK');

  console.log(`- Sau f3f9, Tướng Đen bị chiếu: ${blackInCheckAfter_f3f9}`);
  console.log(`- Sau f3f9, Số nước đi hợp lệ của Đen: ${blackLegalReplies.length}`);
  console.log(`- Danh sách nước đi hợp lệ của Đen: [${blackLegalReplies.map(m => m.uci).join(', ')}]`);
  console.log(`- Sau f3f9, Đen có bị Chiếu Bí (Checkmate) ngay không: ${blackCheckmateAfter_f3f9}`);

  // Kiểm tra nước d9f9 của Đen
  const p_d9f9 = XiangqiRuleVerifier.uciToPos('d9f9')!;
  const legal_d9f9 = XiangqiRuleVerifier.isLegalMove(boardAfter_f3f9, p_d9f9.from, p_d9f9.to, 'BLACK');
  console.log(`- Nước đáp trả d9f9 của Đen (Sĩ ăn Xe): Hợp lệ = ${legal_d9f9.valid} (Lý do: ${legal_d9f9.reason || 'OK'})`);

  if (!legal_d9f9.valid) {
    console.log('🚨 PHÁT HIỆN LỖI P0: Nước d9f9 hoàn toàn KHÔNG HỢP LỆ vì Sĩ không thể đi ngang!');
  }

  // =========================================================================
  // 2. KIỂM TRA TẤT CẢ 30 FIXTURE
  // =========================================================================
  console.log('\n------------------------------------------------------------');
  console.log('📌 [AUDIT HỆ THỐNG] QUÉT TẤT CẢ 30 FIXTURE TIER 1...');

  for (let i = 1; i <= 30; i++) {
    const rawFen = rawData[i.toString()];
    if (!rawFen) {
      results.push({
        index: i,
        fen: '',
        initialRedInCheck: false,
        initialBlackInCheck: false,
        redLegalMovesCount: 0,
        status: 'BLOCKED',
        details: 'Không tìm thấy dữ liệu FEN trong file nguồn.'
      });
      continue;
    }

    const board = XiangqiRuleVerifier.parseFen(rawFen);
    const redInCheck = XiangqiRuleVerifier.isKingInCheck(board, 'RED');
    const blackInCheck = XiangqiRuleVerifier.isKingInCheck(board, 'BLACK');
    const redLegalMoves = XiangqiRuleVerifier.getAllLegalMoves(board, 'RED');

    // Thử tìm các nước chiếu tướng hợp lệ của Đỏ
    const checkingMoves = redLegalMoves.filter(m => {
      const b2 = XiangqiRuleVerifier.applyMove(board, m.from, m.to);
      return XiangqiRuleVerifier.isKingInCheck(b2, 'BLACK');
    });

    // Thử tìm các nước sát cục (mate in 1)
    const mateIn1Moves = redLegalMoves.filter(m => {
      const b2 = XiangqiRuleVerifier.applyMove(board, m.from, m.to);
      return XiangqiRuleVerifier.isCheckmate(b2, 'BLACK');
    });

    let status: 'VERIFIED' | 'BLOCKED' | 'NEED_SOLUTION' = 'NEED_SOLUTION';
    let details = '';

    if (redInCheck) {
      status = 'BLOCKED';
      details = 'Tướng Đỏ đang bị chiếu ngay khi khởi đầu thế cờ (Vi phạm quy ước thế cờ người chơi đi trước).';
    } else if (redLegalMoves.length === 0) {
      status = 'BLOCKED';
      details = 'Đỏ không có nước đi hợp lệ nào (Bị chiếu bí hoặc bế tắc).';
    } else if (mateIn1Moves.length > 0) {
      status = 'VERIFIED';
      details = `Sát cục 1 nước đã xác minh: [${mateIn1Moves.map(m => m.uci).join(', ')}]`;
    } else if (checkingMoves.length > 0) {
      details = `Có ${checkingMoves.length} nước chiếu tướng: [${checkingMoves.map(m => m.uci).join(', ')}]`;
    } else {
      details = `Có ${redLegalMoves.length} nước đi thường, không có nước chiếu trực tiếp.`;
    }

    results.push({
      index: i,
      fen: rawFen,
      initialRedInCheck: redInCheck,
      initialBlackInCheck: blackInCheck,
      redLegalMovesCount: redLegalMoves.length,
      status,
      details
    });

    console.log(`Ải #${i.toString().padStart(2, '0')}: [${status.padEnd(13, ' ')}] RedMoves=${redLegalMoves.length}, CheckingMoves=${checkingMoves.length}, MateMoves=${mateIn1Moves.length} -> ${details}`);
  }

  // Ghi kết quả audit ra file JSON tạm để phân tích
  fs.writeFileSync('audit_fixtures_30.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\n✅ [AUDIT HOÀN TẤT] Đã xuất kết quả kiểm chứng vào audit_fixtures_30.json');
}

audit().catch(console.error);
