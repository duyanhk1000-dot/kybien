import { config } from '../config/index.js';
import { AIAnalysisResult } from './aiService.js';
import { escapeHtmlText, escapeHtmlAttr, escapeJsonAttr } from '../utils/sanitize.js';

// In-memory set to prevent duplicate Blogger publishing
const publishedMatchIds: Set<string> = new Set();

export async function publishMatchToBlogger(
  matchId: string,
  playerWhiteName: string,
  playerBlackName: string,
  pgnMoves: string[],
  aiResult: AIAnalysisResult,
  variantName: string = 'Cờ Bí Pháp',
  variantCode: string = 'kb',
  variantIcon: string = '✨',
  variantLabel: string = '✨ Cờ Bí Pháp'
): Promise<string | null> {
  const { blogId, clientId, clientSecret, refreshToken } = config.blogger;

  if (!blogId || !clientId || !clientSecret || !refreshToken) {
    console.warn('[Blogger Service] Cảnh báo: Thiếu thông tin OAuth2 Blogger API v3 Credentials.');
    return null;
  }

  if (publishedMatchIds.has(matchId)) {
    console.warn(`[Blogger Service] Trận đấu ${matchId} đã được xuất bản trước đó, bỏ qua đăng trùng.`);
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
    if (!tokenData || !tokenData.access_token) {
      // Safe error log: DO NOT print tokenData containing potential secrets
      console.error('[Blogger OAuth Error] Không thể lấy Access Token từ Google OAuth2:', tokenData?.error || 'Unknown token error');
      return null;
    }

    const accessToken = tokenData.access_token;

    // Sanitize all dynamic string variables for safe HTML text & attributes
    const safeWhiteName = escapeHtmlText(playerWhiteName);
    const safeBlackName = escapeHtmlText(playerBlackName);
    const whiteTitle = safeWhiteName.startsWith('[') ? safeWhiteName : `[${safeWhiteName}]`;
    const blackTitle = safeBlackName.startsWith('[') ? safeBlackName : `[${safeBlackName}]`;

    const safeVariantName = escapeHtmlText(variantName);
    const safeVariantCode = escapeHtmlAttr(variantCode);
    const safeVariantIcon = escapeHtmlText(variantIcon);
    const safeVariantLabel = escapeHtmlText(variantLabel);
    const safeMatchId = escapeHtmlAttr(matchId);
    const safePgnMovesAttr = escapeJsonAttr(pgnMoves);

    // Danh sách phụ đề trận đấu hùng tráng dự phòng nếu AI không trả về
    const EPIC_MATCH_TITLES = [
      'Đại Chiến Càn Khôn Đổi Chủ',
      'Cuộc Phản Kích Xuyên Vân Tiễn',
      'Trận Tuyệt Mệnh Phá Vòng Vây',
      'Bão Lửa Thiêu Rụi Trung Quân',
      'Quyết Chiến Sa Trường Kỳ Mưu',
      'Đại Pháo Nổ Sấm Đoạt Thần Kỳ',
      'Thiết Kỵ Càn Quét Tướng Cung',
      'Trận Phá Lãng Bộ Trảm Tướng',
      'Song Long Xuất Hải Phá Cung Cấm',
      'Huyết Chiến Sa Trường Kiếm Hiệp',
      'Tuyệt Mệnh Cổ Kéo Kẻ Thù Trị Tội',
      'Càn Khôn Di Vị Xoay Chuyển Cục Diện'
    ];

    const rawMatchPhrase = (aiResult.matchTitlePhrase && aiResult.matchTitlePhrase.trim().length >= 3 && !aiResult.matchTitlePhrase.includes('Trận Huyết Chiến Sa Trường'))
      ? aiResult.matchTitlePhrase.trim()
      : EPIC_MATCH_TITLES[Math.floor(Math.random() * EPIC_MATCH_TITLES.length)];

    const safeMatchPhrase = escapeHtmlText(rawMatchPhrase);
    const postTitle = `[${safeVariantName}] ${whiteTitle} vs ${blackTitle} (${pgnMoves.length} nước) - ${safeMatchPhrase}`;

    const safeTacticalAnalysis = escapeHtmlText(aiResult.tacticalAnalysis || '');
    const safeKeyMoves = Array.isArray(aiResult.keyMoves)
      ? aiResult.keyMoves.map((m) => escapeHtmlText(String(m)))
      : [];
    const safeSaTruongCommentary = escapeHtmlText(aiResult.saTruongCommentary || '').replace(/\n/g, '<br/>');

    const htmlContent = `
<div class="kybien-match-post" data-match-id="${safeMatchId}">
  <!-- Khai báo Thẻ Chế độ chơi chuẩn có Icon -->
  <div class="kybien-variant-header-badge" style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
    <span style="background: linear-gradient(135deg, #8b0000, #4a0000); color: #fff; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.88rem; border: 1px solid #a83a1f; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
      ⚔️ ${safeMatchPhrase}
    </span>
    <span style="background: linear-gradient(135deg, #3a2416, #22150c); color: #f1c40f; padding: 6px 14px; border-radius: 20px; font-weight: bold; font-size: 0.88rem; border: 1px solid #5a3d22; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">
      ${safeVariantIcon} ${safeVariantName}
    </span>
  </div>

  <!-- Đoạn tóm tắt sạch sẽ dành cho Thẻ Trang chủ & SEO Snippet -->
  <p class="kybien-post-summary-text" style="font-weight: 600; color: #e5b36a; font-size: 1.05em; line-height: 1.6; margin-bottom: 20px; background: rgba(229,179,106,0.08); padding: 14px 18px; border-radius: 8px; border-left: 4px solid #f1c40f;">
    🎯 <strong>Tóm tắt ván cờ:</strong> ${safeTacticalAnalysis}
  </p>

  <!-- Khung Bố cục 2 Cột -->
  <div class="kybien-post-layout" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;">
    
    <!-- DOM ORDER #1: BÀI VIẾT KÝ SỰ SA TRƯỜNG -->
    <div class="scrollable-story-col" style="flex: 1 1 420px; order: 2; background: linear-gradient(145deg, #22150c, #140b05); border: 1px solid #5a3d22; border-radius: 14px; padding: 24px; box-shadow: 0 6px 20px rgba(0,0,0,0.5);">
      
      <!-- Phân tích nước cờ then chốt -->
      <section class="tactical-analysis" style="margin-bottom: 24px; border-bottom: 1px solid #3d2817; padding-bottom: 18px;">
        <h2 style="color: #f1c40f; font-family: 'Noto Serif TC', serif; font-size: 1.35rem; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">🎯 Nước Cờ Bước Ngoặt</h2>
        <ul style="padding-left: 20px; color: #e8dcc6; line-height: 1.7; font-size: 0.98rem;">
          ${safeKeyMoves.map((m) => `<li style="margin-bottom: 6px;"><strong>${m}</strong></li>`).join('')}
        </ul>
      </section>

      <!-- Ký sự Sa trường Kiếm hiệp -->
      <article class="sa-truong-article" style="line-height: 1.85; font-size: 1.05rem; color: #e8dcc6; font-family: 'Noto Serif TC', serif;">
        <h2 style="color: #f1c40f; font-size: 1.35rem; margin-bottom: 15px; border-left: 4px solid #8b0000; padding-left: 12px; display: flex; align-items: center; gap: 8px;">⚔️ Tường Thuật Sa Trường Kiếm Hiệp</h2>
        <div class="content" style="text-align: justify;">${safeSaTruongCommentary}</div>
      </article>

    </div>

    <!-- DOM ORDER #2: BÀN CỜ CỐ ĐỊNH -->
    <div class="sticky-board-col" style="flex: 1 1 480px; max-width: 520px; order: 1; position: sticky; top: 20px; background: linear-gradient(145deg, #271a10, #180f08); padding: 18px; border-radius: 14px; border: 2px solid #5a3d22; box-shadow: 0 10px 30px rgba(0,0,0,0.6); text-align: center;">
      <h3 style="color: #f1c40f; font-family: 'Noto Serif TC', serif; margin-bottom: 12px; font-size: 1.2rem; letter-spacing: 1px;">⚔️ BÀN CỜ TƯƠNG TÁC XEM LẠI (${safeVariantName})</h3>
      
      <div id="kybien-board-viewer" class="kybien-viewer-container" data-variant="${safeVariantCode}" data-moves='${safePgnMovesAttr}'>
        <div id="chess-board-canvas" style="width: 100%; max-width: 500px; height: 520px; margin: 0 auto; background: #f0d9b5; border-radius: 8px;"></div>
        
        <div class="viewer-controls" style="text-align: center; margin-top: 14px; display: flex; justify-content: center; gap: 8px;">
          <button class="btn-first" onclick="window.KybienViewer.firstMove()" style="background: #4a3320; color: #fff; border: 1px solid #5a3d22; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">⏪ Đầu</button>
          <button class="btn-prev" onclick="window.KybienViewer.prevMove()" style="background: #8b0000; color: #fff; border: 1px solid #a83a1f; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">◀ Lùi</button>
          <button class="btn-next" onclick="window.KybienViewer.nextMove()" style="background: #8b0000; color: #fff; border: 1px solid #a83a1f; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">Tiến ▶</button>
          <button class="btn-last" onclick="window.KybienViewer.lastMove()" style="background: #4a3320; color: #fff; border: 1px solid #5a3d22; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem;">Cuối ⏩</button>
        </div>

        <div id="kybien-step-info" style="text-align:center; margin-top:12px; font-weight:bold; color:#f1c40f; font-size:0.95rem; font-family:sans-serif; background:rgba(0,0,0,0.5); padding:8px 12px; border-radius:6px; border:1px solid #5a3d22; min-height:42px; display:flex; align-items:center; justify-content:center;">🔴 Nước 0 / ${pgnMoves.length}: Khai cuộc ván đấu</div>
      </div>
    </div>

  </div>
</div>
`;

    const cleanSearchDescription = (safeTacticalAnalysis || '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 190);

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
        searchDescription: cleanSearchDescription,
        isDraft: false,
        labels: ['Trận Hay', 'Phân Tích Cờ', safeVariantLabel],
      }),
    });

    const postData = await postResponse.json();
    if (postData && postData.id) {
      console.log(`[Blogger Published] Bài viết mới đã xuất bản thành công! ID: ${postData.id}`);
      publishedMatchIds.add(matchId);
      return postData.id;
    } else {
      // Safe error log: DO NOT leak token or request secrets
      console.error('[Blogger API Post Error] Từ chối tạo bài viết Blogger:', postData?.error?.message || 'Unknown Blogger API Error');
      return null;
    }
  } catch (error) {
    console.error('[Blogger Publish Error] Lỗi kết nối khi gọi Blogger API.');
    return null;
  }
}
