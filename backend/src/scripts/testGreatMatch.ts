import { analyzeMatchWithGemini } from '../services/aiService.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';

const sample52Moves = [
  "9,1-7,2", "2,1-2,4", "9,7-7,6", "0,1-2,2", "7,1-7,4", "0,7-2,6", "9,8-9,7", "0,8-0,7",
  "9,7-4,7", "0,7-4,7", "7,7-7,4", "2,7-2,4", "9,0-8,0", "0,0-1,0", "8,0-8,4", "1,0-1,4",
  "8,4-3,4", "1,4-6,4", "3,4-3,0", "6,4-6,0", "7,2-5,3", "2,2-4,3", "5,3-3,4", "4,3-6,2",
  "3,4-2,6", "6,2-4,3", "2,6-0,7", "4,3-3,5", "0,7-2,6", "3,5-5,6", "2,6-4,7", "5,6-7,7",
  "4,7-6,8", "7,7-9,8", "6,8-8,7", "9,8-9,7", "8,7-7,5", "9,7-7,7", "7,5-5,4", "7,7-5,7",
  "5,4-3,3", "5,7-3,7", "3,3-1,2", "3,7-1,7", "1,2-0,4", "1,7-0,7", "0,4-2,5", "0,7-2,7",
  "2,5-0,4", "2,7-0,7", "0,4-1,2", "0,7-1,7"
];

async function runTestMatch() {
  console.log('--- KHỞI TẠO TRẬN ĐẤU MẪU 52 NƯỚC: kimlong (Đỏ) vs Asus (Đen) ---');
  console.log(`Số nước đi: ${sample52Moves.length} nước.`);

  const winner = 'kimlong';
  const loser = 'Asus';
  const resultReason = 'Chiếu Bí';

  console.log('[1/2] Đang gửi dữ liệu tới Gemini AI để biên soạn bài viết Sa Trường Kiếm Hiệp...');
  const aiResult = await analyzeMatchWithGemini(sample52Moves, winner, loser, resultReason);

  if (!aiResult) {
    console.log('⚠️ Cảnh báo: Chưa cấu hình GEMINI_API_KEY trong file .env hoặc Render.');
    console.log('Giả lập bài viết mẫu thành công:');
    console.log({
      keyMoves: ["9,1-7,2: Mã Đỏ xuất trận chiếm cứ điểm", "8,4-3,4: Chiến xa Đỏ càn quét trung lộ", "0,4-1,2: Đòn đại pháo chốt hạ sát cục"],
      tacticalAnalysis: "Chủ tướng kimlong chủ động điều kỵ binh và chiến xa áp đảo cánh phải, buộc Asus vào thế chống đỡ bị động.",
      saTruongCommentary: "Trận đại chiến giữa kimlong và Asus nổ ra tàn khốc trên sa trường. Tiếng trống trận rền vang, kỵ binh kimlong cuồn cuộn lao lên..."
    });
    return;
  }

  console.log('✅ Gemini AI đã sinh bài thành công!');
  console.log('--- NỘI DUNG BÀI VIẾT TỪ AI ---');
  console.log(JSON.stringify(aiResult, null, 2));

  console.log('[2/2] Đang xuất bản bài viết lên Blogger API v3 (kybien.blogspot.com)...');
  const matchId = `match_test_${Date.now()}`;
  const postId = await publishMatchToBlogger(matchId, 'kimlong', 'Asus', sample52Moves, aiResult);

  if (postId) {
    console.log(`🎉 ĐÃ XUẤT BẢN THÀNH CÔNG BÀI ĐĂNG TRÊN BLOGGER! Post ID: ${postId}`);
  } else {
    console.log('⚠️ Cảnh báo: Thiếu Blogger OAuth Credentials trong .env (BLOGGER_BLOG_ID, BLOGGER_CLIENT_ID, v.v.).');
  }
}

runTestMatch().catch(console.error);
