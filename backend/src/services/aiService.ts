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
      model: 'gemini-1.5-flash',
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
- Danh sách nước đi: ${JSON.stringify(pgnMoves)}

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

2. QUY TẮC VIẾT "keyMoves" (NƯỚC CỜ BƯỚC NGOẶT):
- BẮT BUỘC mô tả nước cờ bằng VĂN DIỄN GIẢI TIẾNG VIỆT RÕ RÀNG (Ví dụ: "Nước 12: Đại pháo Đỏ nổ lan thiêu rụi phòng tuyến kỵ binh Đen", "Nước 28: Kỵ binh Đen đột kích chém hạ Chiến xa Đỏ").
- TUYỆT ĐỐI KHÔNG xuất ra mã ký hiệu tọa độ dạng "0,7-4,7" hay "7,1-7,4" trong keyMoves!

3. PHẢI BÁM SÁT DIỄN BIẾN, KHÔNG NHẢY CÓC:
Các nước đi tạo thành chuỗi diễn biến liên tục: Khai chiến → điều quân → thăm dò → giằng co → tập kích → phản kích → thế áp đảo → cao trào → đòn quyết định → kết thúc.

4. HAI NGƯỜI CHƠI LÀ HAI CHỦ TƯỚNG:
Đưa tên hai chủ tướng (${winnerName} và ${loserName}) vào câu chuyện một cách tự nhiên.

5. PHONG CÁCH VĂN:
Hùng tráng, tàn khốc, dồn dập, có sát khí, chất cổ trang, đấu trí chiến thuật.

6. CAO TRÀO VÀ KẾT THÚC:
20–25% cuối bài phải là cao trào. BẮT BUỘC tuyên bố rõ người thắng và người bại ở cuối bài như một đoạn sử thi hùng tráng.

Trả về đúng định dạng JSON có cấu trúc sau:
{
  "keyMoves": ["Danh sách 3-5 nước cờ bước ngoặt bằng văn diễn giải tiếng Việt rõ ràng, KHÔNG dùng tọa độ ký hiệu"],
  "tacticalAnalysis": "Tóm tắt ngắn gọn 2-3 câu về mưu đồ chiến thuật & ý đồ điều quân",
  "blunders": ["Danh sách sơ hở đáng chú ý nếu có"],
  "saTruongCommentary": "Bài tường thuật sa trường kiếm hiệp dồn dập 300-400 chữ chuẩn xác theo các quy tắc trên."
}
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const cleanText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const parsedData: AIAnalysisResult = JSON.parse(cleanText);
    return parsedData;
  } catch (error) {
    console.error('[AI Service Error Details]', error);
    return null;
  }
}
