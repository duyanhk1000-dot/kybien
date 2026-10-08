import { config } from '../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIAnalysisResult {
  keyMoves: string[];
  tacticalAnalysis: string;
  blunders: string[];
  saTruongCommentary: string;
}

function formatMovesForAI(moves: string[]): string {
  const pieceNames: Record<string, string> = {
    k: 'Tướng', a: 'Sĩ', b: 'Tượng', n: 'Mã', r: 'Xe', c: 'Pháo', p: 'Tốt/Binh'
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

  let plyCount = 0;
  const formatted: string[] = [];

  for (const mStr of moves) {
    if (!mStr) continue;
    if (mStr.startsWith('CARD:')) {
      const parts = mStr.replace('CARD:', '').split('->');
      const spellId = parts[0];
      const pos = parts[1] || '';
      const spellName = spellNames[spellId] || spellId;
      formatted.push(`✨ [KÍCH HOẠT BÍ PHÁP]: Thi triển ${spellName} tại tọa độ (${pos})`);
      continue;
    }

    if (mStr.startsWith('FLIP:')) {
      const parts = mStr.replace('FLIP:', '').split('->');
      const pos = parts[0];
      const realType = parts[1];
      const pieceName = pieceNames[realType] || realType;
      formatted.push(`🕵️ [LẬT QUÂN ÚP]: Lật ngửa quân Úp tại (${pos}) cởi bỏ ngụy trang, lộ diện thân phận đại tướng ${pieceName}!`);
      continue;
    }

    plyCount++;
    const sideStr = (plyCount % 2 !== 0) ? '🔴 Đỏ' : '⚫ Đen';
    const parts = mStr.split('-');
    if (parts.length === 2) {
      formatted.push(`Nước ${plyCount} (${sideStr}): Di chuyển từ (${parts[0]}) đến (${parts[1]})`);
    } else {
      formatted.push(`Nước ${plyCount} (${sideStr}): ${mStr}`);
    }
  }

  return formatted.join('\n');
}

export async function analyzeMatchWithGemini(
  pgnMoves: string[],
  winnerName: string,
  loserName: string,
  resultType: string,
  variant: string = 'kb'
): Promise<AIAnalysisResult | null> {
  if (!config.geminiApiKey) {
    console.warn('[AI Service] Cảnh báo: GEMINI_API_KEY chưa được cấu hình.');
    return null;
  }

  const variantDesc = variant === 'kb' ? 'Cờ Bí Pháp Kiếm Hiệp (Có 16 Bí Pháp Kỳ Mưu)' :
                      variant === 't' ? 'Cờ Úp Truyền Thống' :
                      variant === 'g' ? 'Cờ Úp Gián Điệp' : 'Cờ Tướng Tiêu Chuẩn';

  const formattedLog = formatMovesForAI(pgnMoves);

  const prompt = `
Bạn là một bình luận viên chiến trận kiêm văn sĩ kiếm hiệp cho Nền tảng Cờ Tướng Kỳ Biến (kybien.blogspot.com), chuyên biến các ván cờ tướng thành những trận đại chiến đẫm lửa giữa hai đạo quân.

DỮ LIỆU TRẬN ĐẤU:
- Phe Đỏ (Chủ tướng): ${winnerName}
- Phe Đen (Chủ tướng): ${loserName}
- Thể loại cờ: ${variantDesc}
- Kết quả trận đấu: ${resultType}
- Nhật ký chi tiết nước đi, lật quân úp & thi triển Bí Pháp:
${formattedLog}

Hãy dựa chính xác vào nhật ký diễn biến trên để phân tích và viết bài tường thuật trận đấu khoảng 300–400 chữ, theo phong cách kiếm hiệp – chiến trường cổ đại – hùng tráng – tàn khốc.

1. QUY TẮC BẮT BUỘC VỀ NGOẶC VUÔNG [ ] CHO TÊN CHỦ SOÁI:
- BẮT BUỘC TẤT CẢ tên / danh xưng của hai Chủ tướng (${winnerName} và ${loserName}) trong MỌI NƠI của bài viết (từ "keyMoves", "tacticalAnalysis", "blunders", cho đến "saTruongCommentary") PHẢI ĐƯỢC ĐẶT TRONG NGOẶC VUÔNG [ ]!
- Ví dụ đúng: "${winnerName} chủ động điều kỵ binh...", "Nước 12: Pháo Đỏ của ${winnerName} nổ sấm thiêu rụi quân Đen của ${loserName}...".
- TUYỆT ĐỐI KHÔNG tự ý bỏ ngoặc vuông [ ], KHÔNG dùng các từ chung chung như "Bạn", "Người chơi", "Máy", "Đối thủ". Tất cả đều phải ghi đúng định danh [Tên Chủ Soái].

2. NGUYÊN TẮC BÁM SÁT NƯỚC CỜ, LẬT QUÂN ÚP & BÍ PHÁP:
- Xử lý từng nước đi, lượt lật quân và thi triển Bí Pháp theo đúng thứ tự. 
- Pháo → đại pháo, hỏa lực; Xe → chiến xa, thiết kỵ; Mã → kỵ binh; Tượng → tượng binh; Sĩ → cận vệ; Tốt/Binh → bộ binh tiên phong.
- NẾU LÀ LẬT QUÂN ÚP (🕵️ [LẬT QUÂN ÚP]): BẮT BUỘC tả sự bất ngờ: "Chiến binh cởi bỏ lớp ngụy trang, lộ diện thân phận đại tướng [Pháo/Xe/Mã...] làm xoay chuyển cục diện!".
- NẾU LÀ THI TRIỂN BÍ PHÁP (✨ [KÍCH HOẠT BÍ PHÁP]): BẮT BUỘC miêu tả uy lực huyền ảo cuồn cuộn của Bí Pháp do Chủ tướng thi triển.
- Nước ăn quân là cuộc giao chiến tiêu diệt đối phương; nước KHÔNG ăn quân tuyệt đối không tự ý viết có quân bị chết hay bị tiêu diệt.

3. QUY TẮC VIẾT "keyMoves" (NƯỚC CỜ BƯỚC NGOẶT):
- BẮT BUỘC mô tả nước cờ bằng VĂN DIỄN GIẢI TIẾNG VIỆT RÕ RÀNG kèm tên Chủ tướng trong ngoặc vuông [ ] (Ví dụ: "Nước 12: Đại pháo Đỏ của ${winnerName} nổ sấm Bích Lịch Hỏa thiêu rụi kỵ binh Đen của ${loserName}").
- TUYỆT ĐỐI KHÔNG xuất ra mã ký hiệu tọa độ dạng "0,7-4,7" hay "7,1-7,4" trong keyMoves!

4. PHẢI BÁM SÁT DIỄN BIẾN, KHÔNG NHẢY CÓC:
Các nước đi tạo thành chuỗi diễn biến liên tục: Khai chiến → điều quân → thăm dò → giằng co → lật quân / thi triển bí pháp → tập kích → phản kích → cao trào → đòn quyết định → kết thúc.

5. PHONG CÁCH VĂN:
Hùng tráng, tàn khốc, dồn dập, có sát khí, chất cổ trang, đấu trí chiến thuật.

6. CAO TRÀO VÀ KẾT THÚC:
20–25% cuối bài phải là cao trào. BẮT BUỘC tuyên bố rõ ${winnerName} giành chiến thắng rực rỡ và ${loserName} chịu thất bại ở cuối bài như một đoạn sử thi hùng tráng.

Trả về đúng định dạng JSON có cấu trúc sau:
{
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
