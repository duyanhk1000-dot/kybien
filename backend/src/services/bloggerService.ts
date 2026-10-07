import { config } from '../config/index.js';
import { AIAnalysisResult } from './aiService.js';

export async function publishMatchToBlogger(
  matchId: string,
  playerWhiteName: string,
  playerBlackName: string,
  pgnMoves: string[],
  aiResult: AIAnalysisResult,
  variantName: string = 'Cờ Tướng Kỳ Biến'
): Promise<string | null> {
  const { blogId, clientId, clientSecret, refreshToken } = config.blogger;

  if (!blogId || !clientId || !clientSecret || !refreshToken) {
    console.warn('[Blogger Service] Cảnh báo: Thiếu thông tin OAuth2 Blogger API v3 Credentials.');
    return null;
  }

  try {
    // 1. Refresh Access Token từ Google OAuth2
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error('[Blogger OAuth Error]', tokenData);
      return null;
    }

    const accessToken = tokenData.access_token;

    // 2. Build HTML Content chuẩn 2 Cột: Bàn cờ Cố định (Trái) & Ký sự Sa trường cuộn trượt (Phải)
    const postTitle = `[${variantName}] ${playerWhiteName} vs ${playerBlackName} - Trận Huyết Chiến Sa Trường`;

    const htmlContent = `
<script src="https://cdn.jsdelivr.net/gh/duyanhk1000-dot/kybien@main/frontend/kybien-client.js?v=2.4.0"></script>
<div class="kybien-match-post" data-match-id="${matchId}">
  <!-- Đoạn tóm tắt sạch sẽ dành cho Thẻ Trang chủ -->
  <p class="kybien-post-summary-text" style="font-weight: 600; color: #e5b36a; font-size: 1.05em; line-height: 1.6; margin-bottom: 20px; background: rgba(229,179,106,0.08); padding: 12px 15px; border-radius: 8px; border-left: 4px solid #f1c40f;">
    🎯 <strong>Tóm tắt trận đấu:</strong> ${aiResult.tacticalAnalysis}
  </p>

  <!-- Khung Bố cục 2 Cột -->
  <div class="kybien-post-layout" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;">
    
    <!-- CỘT BÊN TRÁI: BÀN CỜ CỐ ĐỊNH (STICKY BOARD) -->
    <div class="sticky-board-col" style="flex: 1 1 480px; max-width: 520px; position: sticky; top: 20px; background: linear-gradient(145deg, #271a10, #180f08); padding: 18px; border-radius: 14px; border: 2px solid #5a3d22; box-shadow: 0 10px 30px rgba(0,0,0,0.6); text-align: center;">
      <h3 style="color: #f1c40f; font-family: 'Noto Serif TC', serif; margin-bottom: 12px; font-size: 1.2rem; letter-spacing: 1px;">⚔️ BÀN CỜ TƯƠNG TÁC XEM LẠI</h3>
      
      <div id="kybien-board-viewer" class="kybien-viewer-container" data-moves='${JSON.stringify(pgnMoves)}'>
        <div id="chess-board-canvas" style="width: 100%; max-width: 500px; height: 520px; margin: 0 auto; background: #f0d9b5; border-radius: 8px;"></div>
        
        <div class="viewer-controls" style="text-align: center; margin-top: 14px; display: flex; justify-content: center; gap: 8px;">
          <button class="btn-first" onclick="window.KybienViewer.firstMove()" style="background: #4a3320; color: #fff; border: 1px solid #5a3d22; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">⏪ Đầu</button>
          <button class="btn-prev" onclick="window.KybienViewer.prevMove()" style="background: #8b0000; color: #fff; border: 1px solid #a83a1f; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">◀ Lùi</button>
          <button class="btn-next" onclick="window.KybienViewer.nextMove()" style="background: #8b0000; color: #fff; border: 1px solid #a83a1f; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">Tiến ▶</button>
          <button class="btn-last" onclick="window.KybienViewer.lastMove()" style="background: #4a3320; color: #fff; border: 1px solid #5a3d22; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">Cuối ⏩</button>
        </div>
      </div>
    </div>

    <!-- CỘT BÊN PHẢI: BÀI VIẾT KÝ SỰ SA TRƯỜNG CUỘN TRUỢT (SCROLLABLE) -->
    <div class="scrollable-story-col" style="flex: 1 1 420px; background: linear-gradient(145deg, #22150c, #140b05); border: 1px solid #5a3d22; border-radius: 14px; padding: 24px; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
      
      <!-- Phân tích nước cờ then chốt -->
      <section class="tactical-analysis" style="margin-bottom: 24px; border-bottom: 1px solid #3d2817; padding-bottom: 18px;">
        <h2 style="color: #f1c40f; font-family: 'Noto Serif TC', serif; font-size: 1.35rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">🎯 Nước Cờ Bước Ngoặt</h2>
        <ul style="padding-left: 20px; color: #e8dcc6; line-height: 1.7; font-size: 0.98rem;">
          ${aiResult.keyMoves.map((m) => `<li style="margin-bottom: 6px;"><strong>${m}</strong></li>`).join('')}
        </ul>
      </section>

      <!-- Ký sự Sa trường Kiếm hiệp -->
      <article class="sa-truong-article" style="line-height: 1.85; font-size: 1.05rem; color: #e8dcc6; font-family: 'Noto Serif TC', serif;">
        <h2 style="color: #f1c40f; font-size: 1.35rem; margin-bottom: 15px; border-left: 4px solid #8b0000; padding-left: 12px; display: flex; align-items: center; gap: 8px;">⚔️ Tường Thuật Sa Trường Kiếm Hiệp</h2>
        <div class="content" style="text-align: justify;">${aiResult.saTruongCommentary.replace(/\n/g, '<br/>')}</div>
      </article>

    </div>

  </div>
</div>
`;

    // 3. Gọi Blogger API v3 POST bài viết trực tiếp (không để dạng nháp)
    const blogUrl = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts/`;
    const postResponse = await fetch(blogUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kind: 'blogger#post',
        title: postTitle,
        content: htmlContent,
        isDraft: false,
        labels: ['Phân Tích Cờ', 'Đại Chiến Kỳ Biển', variantName],
      }),
    });

    const postData = await postResponse.json();
    if (postData.id) {
      console.log(`[Blogger Published] Bài viết mới đã xuất bản thành công! ID: ${postData.id}`);
      return postData.id;
    } else {
      console.error('[Blogger API Post Error]', postData);
      return null;
    }
  } catch (error) {
    console.error('[Blogger Publish Error]', error);
    return null;
  }
}
