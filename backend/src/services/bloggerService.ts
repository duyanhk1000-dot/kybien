import { config } from '../config/index.js';
import { AIAnalysisResult } from './aiService.js';

export async function publishMatchToBlogger(
  matchId: string,
  playerWhiteName: string,
  playerBlackName: string,
  pgnMoves: string[],
  aiResult: AIAnalysisResult
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

    // 2. Build HTML Content cho bài viết chuẩn SEO + Interactive Chess Board Viewer
    const postTitle = `[Đại Chiến Kỳ Biển] ${playerWhiteName} vs ${playerBlackName} - Trận Đấu Kinh Kinh Điển`;

    const htmlContent = `
<div class="kybien-match-post" data-match-id="${matchId}">
  <!-- Khung Bàn cờ Tương tác Interactive Viewer -->
  <div id="kybien-board-viewer" class="kybien-viewer-container" data-moves='${JSON.stringify(pgnMoves)}'>
    <div id="chess-board-canvas" style="width: 100%; max-width: 500px; height: 500px; margin: 0 auto; background: #f0d9b5;"></div>
    <div class="viewer-controls" style="text-align: center; margin-top: 10px;">
      <button class="btn-prev" onclick="KybienViewer.prevMove()">◀ Lùi</button>
      <button class="btn-next" onclick="KybienViewer.nextMove()">Tiến ▶</button>
      <button class="btn-first" onclick="KybienViewer.firstMove()">Về đầu</button>
      <button class="btn-last" onclick="KybienViewer.lastMove()">Về cuối</button>
    </div>
  </div>

  <hr style="margin: 20px 0;" />

  <!-- Lời bình chuyên môn từ AI -->
  <section class="tactical-analysis">
    <h2>🎯 Phân Tích Chuyên Môn & Nước Đi Then Chốt</h2>
    <p>${aiResult.tacticalAnalysis}</p>
    <h3>Nước cờ then chốt:</h3>
    <ul>
      ${aiResult.keyMoves.map((m) => `<li><strong>${m}</strong></li>`).join('')}
    </ul>
  </section>

  <!-- Ký sự Sa trường hào hùng -->
  <article class="sa-truong-article" style="line-height: 1.8; font-size: 1.1em; background: #fdfaf6; padding: 15px; border-left: 4px solid #8b0000;">
    <h2>⚔️ Tường Thuật Sa Trường: Trận Huyết Chiến Binh Pháp</h2>
    <div class="content">${aiResult.saTruongCommentary.replace(/\n/g, '<br/>')}</div>
  </article>
</div>
`;

    // 3. Gọi Blogger API v3 POST bài viết
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
        labels: ['Phân Tích Cờ', 'Đại Chiến Kỳ Biển'],
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
