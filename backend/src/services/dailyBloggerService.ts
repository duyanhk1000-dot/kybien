import { config } from '../config/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { escapeHtmlText, escapeHtmlAttr } from '../utils/sanitize.js';

export interface DailyPuzzleItem {
  id: number;
  tier: 'EASY' | 'MEDIUM' | 'HARD';
  title: string;
  fen: string;
  expReward: number;
}

export interface DailyBlogResult {
  published: boolean;
  simulated: boolean;
  postId?: string;
  postUrl?: string;
  title: string;
  htmlContent: string;
  error?: string;
}

export class DailyBloggerService {
  /**
   * Tạo nội dung bài viết kiếm hiệp bằng Gemini AI hoặc Template cao cấp dự phòng
   */
  static async generateArticleContent(
    dateStr: string,
    puzzles: DailyPuzzleItem[]
  ): Promise<{ title: string; htmlContent: string }> {
    const easy = puzzles.find(p => p.tier === 'EASY') || puzzles[0];
    const med = puzzles.find(p => p.tier === 'MEDIUM') || puzzles[1] || puzzles[0];
    const hard = puzzles.find(p => p.tier === 'HARD') || puzzles[2] || puzzles[0];

    const safeDate = escapeHtmlText(dateStr);
    const safeEasyTitle = escapeHtmlText(easy?.title || 'Khởi Khí Phá Cung');
    const safeMedTitle = escapeHtmlText(med?.title || 'Hãm Trận Đoạt Soái');
    const safeHardTitle = escapeHtmlText(hard?.title || 'Tuyệt Mệnh Thần Cơ');

    let aiIntro = '';
    let aiCommentary = '';

    if (config.geminiApiKey) {
      try {
        const genAI = new GoogleGenerativeAI(config.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Bạn là Bình luận viên kỳ nghệ kiếm hiệp lừng danh của sa trường "Kỳ Biến".
Hãy viết bài giới thiệu và khiêu khích các kỳ thủ tham gia giải "Tam Đại Kỳ Trận Hôm Nay" (Ngày ${dateStr}) gồm 3 thế cờ:
1. Dễ: "${easy?.title}" (Sát cục cơ bản, khởi động).
2. Vừa: "${med?.title}" (Cạm bẫy đối phương chực chờ phản kích).
3. Khó: "${hard?.title}" (Sát cục giang hồ hiểm độc, 99% chào thua).

Yêu cầu văn phong:
- Đậm chất tiểu thuyết kiếm hiệp (Kim Dung, Cổ Long), hào hùng, bí hiểm, có tính khiêu khích thách thức người chơi.
- Khuyên người chơi quan sát kỹ các ngòi pháo, chân mã, lộ mặt tướng.
- Trả về JSON theo định dạng duy nhất:
{
  "catchyHeadline": "chuỗi tiêu đề ngắn giật gân",
  "intro": "đoạn văn mở đầu lôi cuốn (2-3 câu)",
  "commentary": "lời bình từng ải và lời thách đấu giang hồ (4-5 câu)"
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          aiIntro = escapeHtmlText(parsed.intro || '');
          aiCommentary = escapeHtmlText(parsed.commentary || '');
        }
      } catch (err: any) {
        console.warn('[DailyBloggerService] Gemini AI warning:', err?.message || err);
      }
    }

    if (!aiIntro) {
      aiIntro = `Giang hồ dậy sóng, anh hùng bốn phương tề tựu tại sa trường Kỳ Biến! Hôm nay (${safeDate}), Thần Cơ Doanh hạ lệnh khai mở Tam Đại Kỳ Trận độc hiểm chưa từng thấy. Từ ải Nhập Môn sơ cấp đến Cực Phẩm Tuyệt Sát Giang Hồ, liệu kỳ lực của chư vị hiệp khách có đủ phá giải trọn vẹn để đoạt lấy vinh quang?`;
    }

    if (!aiCommentary) {
      aiCommentary = `Tại ải Dễ "${safeEasyTitle}", chớ khinh địch mà sập bẫy thí quân đoạt mạng. Đến ải Vừa "${safeMedTitle}", từng bước chân Mã ngòi Pháo đều ẩn chứa sát cơ nghịch chuyển càn khôn. Và đỉnh cao tuyệt bích "${safeHardTitle}" — nơi 99% kỳ thủ phải ôm hận quy hàng nếu chỉ sơ sẩy một nước!`;
    }

    const title = `[Kỳ Biến - Thế Cờ Hôm Nay] Tam Đại Kỳ Trận (${safeDate}): "${safeEasyTitle}" ➔ "${safeHardTitle}" - Đại Hiệp Nào Dám Phá Thế?`;

    const htmlContent = `
<div class="kybien-daily-puzzle-post" style="font-family: 'Be Vietnam Pro', -apple-system, sans-serif; color: #2c1a0e; line-height: 1.7; max-width: 820px; margin: 0 auto;">
  <style>
    .kdp-card { background: #fffaf0; border: 1px solid #d4a373; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.06); }
    .kdp-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.85rem; margin-bottom: 8px; }
    .kdp-badge-easy { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
    .kdp-badge-med { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
    .kdp-badge-hard { background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
    .kdp-cta-btn { display: block; text-align: center; background: linear-gradient(135deg, #8b0000, #4a0000); color: #ffffff !important; font-weight: bold; font-size: 1.15rem; padding: 16px 24px; border-radius: 30px; text-decoration: none; box-shadow: 0 6px 20px rgba(139,0,0,0.4); transition: transform 0.2s ease; margin: 26px 0; }
    .kdp-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(139,0,0,0.5); }
  </style>

  <!-- Banner Tiêu Đề Bài Viết -->
  <div style="background: linear-gradient(135deg, #2b170c, #160a04); border-radius: 14px; padding: 24px; color: #f1c40f; text-align: center; margin-bottom: 24px; border: 2px solid #8b5a2b;">
    <h2 style="font-size: 1.6rem; margin: 0 0 10px 0; font-family: serif;">⚔️ TAM ĐẠI KỲ TRẬN HÔM NAY - ${safeDate} ⚔️</h2>
    <p style="color: #e8dcc6; margin: 0; font-size: 0.98rem;">Khởi Khí Phá Cung • Trảm Tướng Đoạt Soái • Tuyệt Sát Giang Hồ</p>
  </div>

  <!-- Đoạn Tóm Tắt & Khiêu Khích Đầu Bài -->
  <div style="background: rgba(229,179,106,0.12); border-left: 5px solid #d4af37; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
    <p style="font-size: 1.05rem; font-weight: 500; margin: 0; color: #4a2810;">
      🎯 <strong>Lời Dẫn Sa Trường:</strong> ${aiIntro}
    </p>
  </div>

  <p style="font-size: 1rem; color: #3a2212; margin-bottom: 22px;">
    ${aiCommentary}
  </p>

  <!-- 3 THẺ THẾ CỜ HÔM NAY -->
  <div class="kdp-card" style="border-left: 5px solid #2e7d32;">
    <span class="kdp-badge kdp-badge-easy">🟢 ẢI 1: KHỞI KHÍ (DỄ) • +2 EXP</span>
    <h3 style="margin: 6px 0 10px 0; color: #1b5e20;">${safeEasyTitle}</h3>
    <p style="font-size: 0.92rem; color: #555; margin: 0;">Sát cục tốc chiến từ 1-2 nước. Dành cho hiệp khách khởi động gân cốt, tìm kiếm nước đi khai thông bế tắc.</p>
  </div>

  <div class="kdp-card" style="border-left: 5px solid #f57f17;">
    <span class="kdp-badge kdp-badge-med">🟡 ẢI 2: TRẢM TƯỚNG (VỪA) • +5 EXP</span>
    <h3 style="margin: 6px 0 10px 0; color: #b78103;">${safeMedTitle}</h3>
    <p style="font-size: 0.92rem; color: #555; margin: 0;">Cạm bẫy trùng phùng. Một nước đi sơ sẩy sẽ tạo cơ hội cho đối phương đâm Xe phản kích sát tử!</p>
  </div>

  <div class="kdp-card" style="border-left: 5px solid #c62828;">
    <span class="kdp-badge kdp-badge-hard">🔴 ẢI 3: TUYỆT THẾ GIANG HỒ (KHÓ) • +10 EXP</span>
    <h3 style="margin: 6px 0 10px 0; color: #b71c1c;">${safeHardTitle}</h3>
    <p style="font-size: 0.92rem; color: #555; margin: 0;">Tuyệt tác tàn cuộc giang hồ độc hiểm. Phải tính toán sâu xa nhiều nước biến mới mong phá vòng vây.</p>
  </div>

  <!-- PHẦN THƯỞNG DAILY CLEAR -->
  <div style="background: #fff3e0; border: 1px dashed #e65100; border-radius: 10px; padding: 14px 18px; margin: 20px 0; text-align: center;">
    🎁 <strong>ĐẶC QUYỀN HÀNG NGÀY:</strong> Giải trọn vẹn cả 3 thế cờ hôm nay để nhận thêm <strong>+15 EXP Chiến Công</strong> và tích lũy chuỗi <strong>Daily Streak</strong> thăng cấp Hiệp Khách!
  </div>

  <!-- NÚT KÊU GỌI HÀNH ĐỘNG (CTA) -->
  <a href="https://kybien.blogspot.com/p/co-the.html?daily=${encodeURIComponent(dateStr)}" class="kdp-cta-btn">
    ⚔️ VÀO PHÁ TAM ĐẠI KỲ TRẬN NGAY BÂY GIỜ ➔
  </a>

  <div style="text-align: center; font-size: 0.85rem; color: #777;">
    Nền tảng Cờ Tướng &amp; Kỳ Biến Võ Học • Hệ thống thẩm định nước đi và trí tuệ nhân tạo phản công độc quyền.
  </div>
</div>
`;

    return { title, htmlContent };
  }

  /**
   * Đăng bài viết lên Blogger qua Google OAuth2 API
   */
  static async publishToBlogger(dateStr: string, puzzles: DailyPuzzleItem[]): Promise<DailyBlogResult> {
    const { title, htmlContent } = await this.generateArticleContent(dateStr, puzzles);
    const { blogId, clientId, clientSecret, refreshToken } = config.blogger;

    // Kiểm tra cấu hình Blogger API
    if (!blogId || !clientId || !clientSecret || !refreshToken) {
      console.log(`[DailyBloggerService] Chế độ mô phỏng / Chưa cấu hình Blogger Credentials. Bài viết "${title}" đã được sinh thành công.`);
      return {
        published: false,
        simulated: true,
        title,
        htmlContent,
      };
    }

    try {
      // 1. Refresh Access Token từ Google OAuth2
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData || !tokenData.access_token) {
        console.error('[DailyBloggerService] Không thể refresh token OAuth2 Blogger:', tokenData?.error || 'Unknown error');
        return {
          published: false,
          simulated: true,
          title,
          htmlContent,
          error: 'Lỗi xác thực OAuth2 Blogger',
        };
      }

      // 2. Gọi Blogger API v3 để đăng bài
      const postRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kind: 'blogger#post',
          title,
          content: htmlContent,
          labels: ['Thế Cờ Hôm Nay', 'Cờ Thế', 'Sát Cục', 'Kỳ Biến', 'Tam Đại Kỳ Trận'],
        }),
      });

      const postData = await postRes.json();
      if (postRes.ok && postData.id) {
        console.log(`✅ [DailyBloggerService] Đăng bài thành công lên Blogger! ID: ${postData.id}, URL: ${postData.url}`);
        return {
          published: true,
          simulated: false,
          postId: postData.id,
          postUrl: postData.url,
          title,
          htmlContent,
        };
      } else {
        console.error('[DailyBloggerService] Blogger API error:', postData);
        return {
          published: false,
          simulated: true,
          title,
          htmlContent,
          error: postData?.error?.message || 'Blogger API trả về lỗi',
        };
      }
    } catch (err: any) {
      console.error('[DailyBloggerService] Ngoại lệ khi đăng bài lên Blogger:', err?.message || err);
      return {
        published: false,
        simulated: true,
        title,
        htmlContent,
        error: err?.message || String(err),
      };
    }
  }
}
