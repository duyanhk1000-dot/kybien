import { config } from '../config/index.js';

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
  resultType: string
): Promise<AIAnalysisResult | null> {
  if (!config.geminiApiKey) {
    console.warn('[AI Service] Cảnh báo: GEMINI_API_KEY chưa được cấu hình.');
    return null;
  }

  try {
    // Dynamic import Google Gen AI SDK
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const prompt = `
Bạn là một Đại kỳ sĩ và cũng là một Nhà bình luận chiến trận hào hùng cho Nền tảng Cờ Tướng Kỳ Biến (kybien.blogspot.com).
Hãy phân tích ván đấu Cờ Tướng dưới đây và viết bình văn sa trường:

Thông tin ván cờ:
- Người chiến thắng: ${winnerName}
- Đối thủ: ${loserName}
- Kết quả: ${resultType}
- Danh sách các nước đi (Nước đi dạng PGN/Ký hiệu): ${JSON.stringify(pgnMoves)}

Yêu cầu trả về đúng định dạng JSON có cấu trúc sau:
{
  "keyMoves": ["Danh sách các nước đi then chốt"],
  "tacticalAnalysis": "Phân tích chi tiết về lý do điều quân, mưu đồ chiến thuật và biến thể cờ hay",
  "blunders": ["Danh sách sai lầm đáng chú ý nếu có"],
  "saTruongCommentary": "Bài viết tường thuật ván cờ theo phong cách sa trường, binh pháp, cuồn cuộn khí thế như một trận đại chiến giữa hai đạo quân."
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    const parsedData: AIAnalysisResult = JSON.parse(responseText);
    return parsedData;
  } catch (error) {
    console.error('[AI Service Error]', error);
    return null;
  }
}
