import { config } from '../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIAnalysisResult {
  keyMoves: string[];
  tacticalAnalysis: string;
  blunders: string[];
  saTruongCommentary: string;
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

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const variantDesc = variant === 'kb' ? 'Cờ Tướng Kỳ Biến (Có 16 Bí Pháp Kỳ Mưu)' :
                        variant === 't' ? 'Cờ Úp Truyền Thống' :
                        variant === 'g' ? 'Cờ Úp Gián Điệp' : 'Cờ Tướng Tiêu Chuẩn';

    const prompt = `
Bạn là một bình luận viên chiến trận kiêm văn sĩ kiếm hiệp cho Nền tảng Cờ Tướng Kỳ Biến (kybien.blogspot.com), chuyên biến các ván cờ tướng thành những trận đại chiến đẫm lửa giữa hai đạo quân.

DỮ LIỆU TRẬN ĐẤU:
- Phe Đỏ (Chủ tướng): ${winnerName}
- Phe Đen (Chủ tướng): ${loserName}
- Thể loại cờ: ${variantDesc}
- Kết quả trận đấu: ${resultType}
- Danh sách nước đi (chuỗi tọa độ from-to & sự kiện bí pháp/lật quân): ${JSON.stringify(pgnMoves)}

Hãy dựa chính xác vào danh sách nước đi để phân tích và viết bài tường thuật trận đấu khoảng 300–400 chữ, theo phong cách kiếm hiệp – chiến trường cổ đại – hùng tráng – tàn khốc.

1. NGUYÊN TẮC BÁM SÁT NƯỚC CỜ & BÍ PHÁP:
- Xử lý từng nước đi theo đúng thứ tự. 
- Pháo → đại pháo, hỏa lực; Xe → chiến xa, thiết kỵ; Mã → kỵ binh; Tượng → tượng binh; Sĩ → cận vệ; Tốt/Binh → bộ binh tiên phong.
- Nếu là Cờ Úp: Nước lật ngửa quân cờ được tả là "Chiến binh cởi bỏ lớp ngụy trang, lộ diện thân phận đại tướng".
- Nếu là Cờ Kỳ Biến thi triển Bí Pháp: 
  + Bích Lịch Hỏa → Sấm nổ trời xanh, mưa lửa thiên lôi thiêu rụi và làm choáng váng 4 ô kề bên.
  + Tuyệt Mệnh Cổ → Gài vòng cổ độc, dũng sĩ bị ăn liền kéo theo quân đối phương đồng thọ thương tử.
  + Càn Khôn Di Vị → Phép hoán đổi vị trí chủ tướng trong cung cấm.
- Nước ăn quân là cuộc giao chiến tiêu diệt đối phương; nước KHÔNG ăn quân tuyệt đối không tự ý viết có quân bị chết hay bị tiêu diệt.

2. PHẢI BÁM SÁT DIỄN BIẾN, KHÔNG NHẢY CÓC:
Các nước đi tạo thành chuỗi diễn biến liên tục: Khai chiến → điều quân → thăm dò → giằng co → tập kích → phản kích → thế áp đảo → cao trào → đòn quyết định → kết thúc.

3. HAI NGƯỜI CHƠI LÀ HAI CHỦ TƯỚNG:
Đưa tên hai chủ tướng (${winnerName} và ${loserName}) vào câu chuyện một cách tự nhiên.

4. PHONG CÁCH VĂN:
Hùng tráng, tàn khốc, dồn dập, có sát khí, chất cổ trang, đấu trí chiến thuật. Sử dụng hình ảnh tiếng trống trận, vó ngựa, chiến xa, đại pháo, bụi đất, khói lửa, huyết chiến,... Văn phong mạnh, chắc, có nhịp.

5. CAO TRÀO VÀ KẾT THÚC:
20–25% cuối bài phải là cao trào. BẮT BUỘC tuyên bố rõ người thắng và người bại ở cuối bài như một đoạn sử thi hùng tráng.

6. TUYỆT ĐỐI KHÔNG:
Không liệt kê lại nước cờ, không giải thích ký hiệu, không dùng thuật ngữ cờ hiện đại, không bịa thêm quân bị chết khi không ăn quân.

Trả về đúng định dạng JSON có cấu trúc sau:
{
  "keyMoves": ["Danh sách 3-5 nước đi then chốt tạo bước ngoặt"],
  "tacticalAnalysis": "Tóm tắt ngắn gọn 2-3 câu về mưu đồ chiến thuật & ý đồ điều quân",
  "blunders": ["Danh sách sơ hở đáng chú ý nếu có"],
  "saTruongCommentary": "Bài tường thuật sa trường kiếm hiệp dồn dập 300-400 chữ chuẩn xác theo các quy tắc trên."
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const parsedData: AIAnalysisResult = JSON.parse(responseText);
    return parsedData;
  } catch (error) {
    console.error('[AI Service Error]', error);
    return null;
  }
}
