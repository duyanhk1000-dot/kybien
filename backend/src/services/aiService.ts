import { config } from '../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { escapeHtmlText } from '../utils/sanitize.js';

export interface AIAnalysisResult {
  keyMoves: string[];
  tacticalAnalysis: string;
  blunders: string[];
  saTruongCommentary: string;
  matchTitlePhrase?: string;
}

function formatMovesForAI(moves: string[], redName: string = '🔴 Đỏ', blackName: string = '⚫ Đen', variant: string = 'kb'): string {
  const pieceNames: Record<string, string> = {
    k: 'Tướng', a: 'Sĩ', b: 'Tượng', n: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt'
  };
  const spellNames: Record<string, string> = {
    ROOK_1: 'Thiểm Điện Trảm (Xe tiến thẳng 1-2 ô)',
    ROOK_2: 'Phá Lãng Bộ (Xe bẻ góc 90 độ)',
    CANNON_1: 'Xuyên Vân Tiễn (Pháo bắn qua 2 ngòi)',
    CANNON_2: 'Bích Lịch Hỏa (Bão lửa thiêu rụi & choáng 4 ô kề)',
    KNIGHT_1: 'Đạp Vân Tiêu (Mã khinh công qua cản chân)',
    KNIGHT_2: 'Tuyệt Mệnh Cổ (Mã dán vòng độc kéo kẻ thù đồng thọ tử)',
    ELEPHANT_1: 'Minh Kính Thuật (Tượng bay qua mắt cản)',
    ELEPHANT_2: 'Ngự Ba Viễn Chinh (Tượng vượt sông sang đất địch)',
    ADVISOR_1: 'Xuất Trần Hộ Pháp (Sĩ ra khỏi cung qua sông)',
    ADVISOR_2: 'Song Long Xuất Hải (Sĩ bão bùng đi 2 nước liên tiếp)',
    PAWN_1: 'Tật Phong Binh (Tốt phi thân đi 2 nước liên tiếp)',
    PAWN_2: 'Hồi Phong Binh (Tốt đi lùi & ăn lùi)',
    KING_1: 'Thân Chinh Xuất Giá (Tướng ra khỏi cung cấm)',
    KING_2: 'Cấp Cứu Cần Vương (Triệu hồi Sĩ về hộ giá)',
    KING_3: 'Kim Cang Bất Hoại (Tướng miễn chiếu 1 hướng 3 lượt)',
    KING_4: 'Càn Khôn Di Vị (Hoán vị Tướng với quân hộ vệ trong cung)'
  };

  const board: Array<Array<{ t: string; col: 'r' | 'b'; hd: boolean } | null>> = Array(10).fill(null).map(() => Array(9).fill(null));
  if (variant === 'n' || variant === 'kb') {
    const bk = ['r','n','b','a','k','a','b','n','r'];
    for (let c = 0; c < 9; c++) {
      board[0][c] = { t: bk[c], col: 'b', hd: false };
      board[9][c] = { t: bk[c], col: 'r', hd: false };
    }
    board[2][1] = { t: 'c', col: 'b', hd: false }; board[2][7] = { t: 'c', col: 'b', hd: false };
    board[7][1] = { t: 'c', col: 'r', hd: false }; board[7][7] = { t: 'c', col: 'r', hd: false };
    for (let c = 0; c < 9; c += 2) {
      board[3][c] = { t: 'p', col: 'b', hd: false };
      board[6][c] = { t: 'p', col: 'r', hd: false };
    }
  } else {
    board[0][4] = { t: 'k', col: 'b', hd: false };
    board[9][4] = { t: 'k', col: 'r', hd: false };
    const upPositions = [
      [0,0],[0,1],[0,2],[0,3],[0,5],[0,6],[0,7],[0,8],
      [2,1],[2,7],[3,0],[3,2],[3,4],[3,6],[3,8],
      [9,0],[9,1],[9,2],[9,3],[9,5],[9,6],[9,7],[9,8],
      [7,1],[7,7],[6,0],[6,2],[6,4],[6,6],[6,8]
    ];
    upPositions.forEach(([r, c]) => {
      const col = r < 5 ? 'b' : 'r';
      board[r][c] = { t: '?', col, hd: true };
    });
  }

  let plyCount = 0;
  const formatted: string[] = [];

  for (const mStr of moves) {
    if (!mStr || typeof mStr !== 'string') continue;

    const currentSide = (plyCount % 2 === 0) ? 'r' : 'b';
    const sideLabel = currentSide === 'r' ? '🔴 Đỏ' : '⚫ Đen';
    const currentCommander = currentSide === 'r' ? redName : blackName;

    if (mStr.startsWith('CARD:')) {
      const parts = mStr.replace('CARD:', '').split('->');
      const spellId = parts[0];
      const pos = parts[1] || '';
      const spellName = spellNames[spellId] || spellId;
      let targetPieceName = '';
      if (pos.includes(',')) {
        const [tr, tc] = pos.split(',').map(Number);
        const targetObj = board[tr] ? board[tr][tc] : null;
        if (targetObj) {
          targetPieceName = ` lên [${pieceNames[targetObj.t] || 'Quân cờ'} ${targetObj.col === 'r' ? 'Đỏ' : 'Đen'}]`;
        }
      }
      formatted.push(`✨ [KÍCH HOẠT BÍ PHÁP] (${sideLabel} - ${currentCommander}): Thi triển ${spellName}${targetPieceName} tại tọa độ (${pos}).`);
      continue;
    }

    if (mStr.startsWith('FLIP:')) {
      const parts = mStr.replace('FLIP:', '').split('->');
      if (parts.length === 2) {
        const [fr, fc] = parts[0].split(',').map(Number);
        const realType = parts[1];
        if (board[fr] && board[fr][fc]) {
          board[fr][fc].hd = false;
          board[fr][fc].t = realType;
          const pieceOwner = board[fr][fc].col === 'r' ? '🔴 Đỏ' : '⚫ Đen';
          const pName = pieceNames[realType] || realType;
          formatted.push(`🕵️ [LẬT QUÂN ÚP] (${sideLabel} - ${currentCommander}): Lật ngửa quân Úp tại (${fr},${fc}) -> Lộ diện đại tướng [${pName} ${pieceOwner}]!`);
        }
      }
      continue;
    }

    if (mStr.startsWith('POISON_KILL:')) {
      const posStr = mStr.replace('POISON_KILL:', '');
      const [pr, pc] = posStr.split(',').map(Number);
      if (board[pr] && board[pr][pc]) {
        const victim = board[pr][pc]!;
        board[pr][pc] = null;
        const vOwner = victim.col === 'r' ? '🔴 Đỏ' : '⚫ Đen';
        const vName = victim.hd ? 'Quân Úp' : (pieceNames[victim.t] || victim.t);
        formatted.push(`☠️ [KÍCH ĐỘC BÙNG PHÁP]: [${vName} ${vOwner}] dính độc Tuyệt Mệnh Cổ phát tác, lập tức đồng thọ tử bị loại khỏi bàn cờ!`);
      }
      continue;
    }

    const parts = mStr.split('-');
    if (parts.length === 2) {
      const from = parts[0].split(',').map(Number);
      const to = parts[1].split(',').map(Number);
      if (from.length === 2 && to.length === 2 && !isNaN(from[0]) && !isNaN(from[1]) && !isNaN(to[0]) && !isNaN(to[1])) {
        plyCount++;
        const p = board[from[0]][from[1]];
        const cap = board[to[0]][to[1]];
        board[from[0]][from[1]] = null;
        board[to[0]][to[1]] = p;

        if (p && p.hd) p.hd = false;

        const moveSideStr = (plyCount % 2 !== 0) ? '🔴 Đỏ' : '⚫ Đen';
        const moveCommander = (plyCount % 2 !== 0) ? redName : blackName;
        const pName = p ? (p.hd ? 'Quân Úp' : (pieceNames[p.t] || p.t)) : 'Quân cờ';
        const capName = cap ? (cap.hd ? 'Quân Úp' : (pieceNames[cap.t] || cap.t)) : null;
        const capOwnerStr = cap ? (cap.col === 'r' ? 'Đỏ' : 'Đen') : '';

        if (cap) {
          formatted.push(`Nước ${plyCount} (${moveSideStr} - ${moveCommander}): [${pName} ${moveSideStr}] từ (${from[0]},${from[1]}) tiến đến (${to[0]},${to[1]}) ăn [${capName} ${capOwnerStr}]!`);
        } else {
          formatted.push(`Nước ${plyCount} (${moveSideStr} - ${moveCommander}): [${pName} ${moveSideStr}] di chuyển từ (${from[0]},${from[1]}) đến (${to[0]},${to[1]}).`);
        }
      }
    }
  }

  return formatted.join('\n');
}

export async function analyzeMatchWithGemini(
  pgnMoves: string[],
  playerRedName: string,
  playerBlackName: string,
  winnerName: string,
  loserName: string,
  resultType: string,
  variant: string = 'kb'
): Promise<AIAnalysisResult | null> {
  if (!config.geminiApiKey) {
    console.warn('[AI Service] Cảnh báo: GEMINI_API_KEY chưa được cấu hình.');
    return null;
  }

  if (!pgnMoves || !Array.isArray(pgnMoves) || pgnMoves.length === 0) {
    console.warn('[AI Service Warning] Danh sách nước đi rỗng hoặc không hợp lệ.');
    return null;
  }

  const sanitizedRed = escapeHtmlText(playerRedName || '🔴 Đỏ');
  const sanitizedBlack = escapeHtmlText(playerBlackName || '⚫ Đen');
  const sanitizedWinner = escapeHtmlText(winnerName || 'Hòa');
  const sanitizedLoser = escapeHtmlText(loserName || 'Hòa');
  const sanitizedReason = escapeHtmlText(resultType || 'Chiếu Bí');

  const variantDesc = variant === 'kb' ? 'Cờ Bí Pháp Kiếm Hiệp (Có 16 Bí Pháp Kỳ Mưu)' :
                      variant === 't' ? 'Cờ Úp Truyền Thống' :
                      variant === 'g' ? 'Cờ Úp Gián Điệp' : 'Cờ Tướng Tiêu Chuẩn';

  const formattedLog = formatMovesForAI(pgnMoves, sanitizedRed, sanitizedBlack, variant);

  const prompt = `
Bạn là một bình luận viên chiến trận kiêm văn sĩ kiếm hiệp cho Nền tảng Cờ Tướng Kỳ Biến (kybien.blogspot.com), chuyên biến các ván cờ tướng thành những trận đại chiến đẫm lửa giữa hai đạo quân.

DỮ LIỆU TRẬN ĐẤU:
- Phe Đỏ (Chủ tướng): ${sanitizedRed}
- Phe Đen (Chủ tướng): ${sanitizedBlack}
- Kết quả trận đấu: Bên Thắng là ${sanitizedWinner}, Bên Thua là ${sanitizedLoser} (Lý do: ${sanitizedReason})
- Thể loại cờ: ${variantDesc}
- Nhật ký chi tiết nước đi, lật quân úp & thi triển Bí Pháp:
${formattedLog}

Hãy dựa chính xác vào nhật ký diễn biến trên để phân tích và viết bài tường thuật trận đấu khoảng 300–400 chữ, theo phong cách kiếm hiệp – chiến trường cổ đại – hùng tráng – tàn khốc.

1. QUY TẮC BẮT BUỘC VỀ NGOẶC VUÔNG [ ] CHO TÊN CHỦ SOÁI:
- BẮT BUỘC TẤT CẢ tên / danh xưng của hai Chủ tướng (${sanitizedRed} và ${sanitizedBlack}) trong MỌI NƠI của bài viết (từ "keyMoves", "tacticalAnalysis", "blunders", cho đến "saTruongCommentary") PHẢI ĐƯỢC ĐẶT TRONG NGOẶC VUÔNG [ ]!
- Ví dụ đúng: "${sanitizedRed} chủ động điều kỵ binh...", "Nước 12: Pháo Đỏ của ${sanitizedRed} nổ sấm thiêu rụi quân Đen của ${sanitizedBlack}...".
- TUYỆT ĐỐI KHÔNG tự ý bỏ ngoặc vuông [ ], KHÔNG dùng các từ chung chung như "Bạn", "Người chơi", "Máy", "Đối thủ". Tất cả đều phải ghi đúng định danh [Tên Chủ Soái].

2. NGUYÊN TẮC BÁM SÁT NƯỚC CỜ, LẬT QUÂN ÚP & BÍ PHÁP:
- Xử lý từng nước đi, lượt lật quân và thi triển Bí Pháp theo đúng thứ tự. 
- Pháo → đại pháo, hỏa lực; Xe → chiến xa, thiết kỵ; Mã → kỵ binh; Tượng → tượng binh; Sĩ → cận vệ; Tốt/Binh → bộ binh tiên phong.
- NẾU LÀ LẬT QUÂN ÚP (🕵️ [LẬT QUÂN ÚP]): BẮT BUỘC tả sự bất ngờ: "Chiến binh cởi bỏ lớp ngụy trang, lộ diện thân phận đại tướng [Pháo/Xe/Mã...] làm xoay chuyển cục diện!".
- NẾU LÀ THI TRIỂN BÍ PHÁP (✨ [KÍCH HOẠT BÍ PHÁP]): BẮT BUỘC miêu tả uy lực huyền ảo cuồn cuộn của Bí Pháp do Chủ tướng thi triển.
- Nước ăn quân là cuộc giao chiến tiêu diệt đối phương; nước KHÔNG ăn quân tuyệt đối không tự ý viết có quân bị chết hay bị tiêu diệt.

3. QUY TẮC VIẾT "keyMoves" (NƯỚC CỜ BƯỚC NGOẶT):
- BẮT BUỘC mô tả nước cờ bằng VĂN DIỄN GIẢI TIẾNG VIỆT RÕ RÀNG kèm tên Chủ tướng trong ngoặc vuông [ ] (Ví dụ: "Nước 12: Đại pháo Đỏ của ${sanitizedRed} nổ sấm Bích Lịch Hỏa thiêu rụi kỵ binh Đen của ${sanitizedBlack}").
- TUYỆT ĐỐI KHÔNG xuất ra mã ký hiệu tọa độ dạng "0,7-4,7" hay "7,1-7,4" trong keyMoves!

4. PHẢI BÁM SÁT DIỄN BIẾN, KHÔNG NHẢY CÓC:
Các nước đi tạo thành chuỗi diễn biến liên tục: Khai chiến → điều quân → thăm dò → giằng co → lật quân / thi triển bí pháp → tập kích → phản kích → cao trào → đòn quyết định → kết thúc.

5. PHONG CÁCH VĂN:
Hùng tráng, tàn khốc, dồn dập, có sát khí, chất cổ trang, đấu trí chiến thuật.

6. CAO TRÀO VÀ KẾT THÚC:
20–25% cuối bài phải là cao trào. BẮT BUỘC tuyên bố rõ kết quả trận đấu (${sanitizedWinner} thắng và ${sanitizedLoser} thua, hoặc trận hòa) ở cuối bài như một đoạn sử thi hùng tráng.

7. TIÊU ĐỀ PHỤ THẦN THÁI DÀNH CHO TRẬN ĐẤU ("matchTitlePhrase"):
- BẮT BUỘC sáng tạo 1 cụm danh xưng/tiêu đề phụ ngắn gọn từ 3 đến 6 từ đặc tả thần thái & diễn biến then chốt của trận đấu.
- Ví dụ: "Đại Chiến Càn Khôn Đổi Chủ", "Cuộc Phản Kích Xuyên Vân Tiễn", "Trận Tuyệt Mệnh Phá Vòng Vây", "Bão Lửa Thiêu Rụi Trung Quân", "Đại Pháo Đoạt Thần Kỳ", "Thiết Kỵ Càn Quét Tướng Cung", "Phá Lãng Bộ Trảm Tướng".
- TUYỆT ĐỐI KHÔNG tự ý lặp lại cụm cố định "Trận Huyết Chiến Sa Trường" cho mọi trận đấu!

Trả về đúng định dạng JSON có cấu trúc sau:
{
  "matchTitlePhrase": "Cụm danh xưng hùng tráng 3-6 từ đặc tả riêng cho trận đấu này",
  "keyMoves": ["Danh sách 3-5 nước cờ bước ngoặt bằng văn diễn giải tiếng Việt rõ ràng, KHÔNG dùng tọa độ ký hiệu"],
  "tacticalAnalysis": "Tóm tắt ngắn gọn 2-3 câu về mưu đồ chiến thuật & ý đồ điều quân",
  "blunders": ["Danh sách sơ hở đáng chú ý nếu có"],
  "saTruongCommentary": "Bài tường thuật sa trường kiếm hiệp dồn dập 300-400 chữ chuẩn xác theo các quy tắc trên."
}
`;

  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      let cleanText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      const match = cleanText.match(/\{[\s\S]*\}/);
      if (match) {
        cleanText = match[0];
      }

      const parsedData: AIAnalysisResult = JSON.parse(cleanText);
      console.log(`[AI Service] Sinh bài viết Gemini thành công với model: ${modelName}`);
      return parsedData;
    } catch (error) {
      console.warn(`[AI Service Warning] Thử model ${modelName} thất bại:`, (error as Error)?.message || error);
    }
  }

  console.error('[AI Service Error] Tất cả các model Gemini đều thất bại.');
  return null;
}
