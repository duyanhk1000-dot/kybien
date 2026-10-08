import { config } from '../config/index.js';
import { AIAnalysisResult } from './aiService.js';

export async function publishMatchToBlogger(
  matchId: string,
  playerWhiteName: string,
  playerBlackName: string,
  pgnMoves: string[],
  aiResult: AIAnalysisResult,
  variantName: string = 'Cờ Tướng Kỳ Biến',
  variantCode: string = 'kb'
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

    // 2. Build HTML Content chuẩn 2 Cột với Script Bàn cờ nhúng trực tiếp (Self-contained 100%)
    const postTitle = `[${variantName}] ${playerWhiteName} vs ${playerBlackName} - Trận Huyết Chiến Sa Trường`;

    const htmlContent = `
<div class="kybien-match-post" data-match-id="${matchId}">
  <!-- Đoạn tóm tắt sạch sẽ dành cho Thẻ Trang chủ -->
  <p class="kybien-post-summary-text" style="font-weight: 600; color: #e5b36a; font-size: 1.05em; line-height: 1.6; margin-bottom: 20px; background: rgba(229,179,106,0.08); padding: 12px 15px; border-radius: 8px; border-left: 4px solid #f1c40f;">
    🎯 <strong>Tóm tắt trận đấu:</strong> ${aiResult.tacticalAnalysis}
  </p>

  <!-- Khung Bố cục 2 Cột -->
  <div class="kybien-post-layout" style="display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start;">
    
    <!-- CỘT BÊN TRÁI: BÀN CỜ CỐ ĐỊNH (STICKY BOARD) -->
    <div class="sticky-board-col" style="flex: 1 1 480px; max-width: 520px; position: sticky; top: 20px; background: linear-gradient(145deg, #271a10, #180f08); padding: 18px; border-radius: 14px; border: 2px solid #5a3d22; box-shadow: 0 10px 30px rgba(0,0,0,0.6); text-align: center;">
      <h3 style="color: #f1c40f; font-family: 'Noto Serif TC', serif; margin-bottom: 12px; font-size: 1.2rem; letter-spacing: 1px;">⚔️ BÀN CỜ TƯƠNG TÁC XEM LẠI (${variantName})</h3>
      
      <div id="kybien-board-viewer" class="kybien-viewer-container" data-variant="${variantCode}" data-moves='${JSON.stringify(pgnMoves)}'>
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

<!-- SCRIPT BÀN CỜ NHÚNG TRỰC TIẾP (SELF-CONTAINED ENGINE) -->
<script>
(function() {
  window.KybienViewer = {
    currentStep: 0,
    moves: [],
    variant: '${variantCode}',
    canvas: null,
    ctx: null,
    pieceNames: {
      k: { r: '帥', b: '將' },
      a: { r: '仕', b: '士' },
      b: { r: '相', b: '象' },
      n: { r: '馬', b: '馬' },
      r: { r: '車', b: '車' },
      c: { r: '砲', b: '砲' },
      p: { r: '兵', b: '卒' }
    },
    spellIcons: {
      CANNON_2: { icon: '🔥', name: 'Bích Lịch Hỏa', color: '#ff4757' },
      KNIGHT_2: { icon: '☠️', name: 'Tuyệt Mệnh Cổ', color: '#a55eea' },
      KING_4: { icon: '🌀', name: 'Càn Khôn Di Vị', color: '#f1c40f' },
      ROOK_1: { icon: '⚡', name: 'Bão Thần', color: '#2ecc71' }
    },
    init: function() {
      var viewerElem = document.getElementById('kybien-board-viewer');
      if (!viewerElem) return;
      try {
        this.variant = viewerElem.getAttribute('data-variant') || '${variantCode}';
        var rawMoves = viewerElem.getAttribute('data-moves');
        if (rawMoves) this.moves = JSON.parse(rawMoves);
        var container = document.getElementById('chess-board-canvas');
        if (container) {
          container.innerHTML = '<canvas id="kybien-replay-canvas" width="500" height="550" style="width:100%; max-width:500px; height:auto; background:#f0d9b5; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.5); display:block; margin:0 auto;"></canvas>';
          this.canvas = document.getElementById('kybien-replay-canvas');
          if (this.canvas) this.ctx = this.canvas.getContext('2d');
        }
        var stepInfo = document.getElementById('kybien-step-info');
        if (!stepInfo && viewerElem) {
          stepInfo = document.createElement('div');
          stepInfo.id = 'kybien-step-info';
          stepInfo.style.cssText = 'text-align:center; margin-top:12px; font-weight:bold; color:#f1c40f; font-size:0.95rem; font-family:sans-serif; background:rgba(0,0,0,0.5); padding:8px 12px; border-radius:6px; border:1px solid #5a3d22; min-height:42px; display:flex; align-items:center; justify-content:center;';
          viewerElem.appendChild(stepInfo);
        }
        this.render();
      } catch (e) { console.error(e); }
    },
    getInitialBoard: function() {
      var board = Array(10).fill(null).map(function() { return Array(9).fill(null); });
      if (this.variant === 'n' || this.variant === 'kb') {
        var bk = ['r','n','b','a','k','a','b','n','r'];
        for (var c = 0; c < 9; c++) {
          board[0][c] = { t: bk[c], col: 'b', hd: false };
          board[9][c] = { t: bk[c], col: 'r', hd: false };
        }
        board[2][1] = { t: 'c', col: 'b', hd: false }; board[2][7] = { t: 'c', col: 'b', hd: false };
        board[7][1] = { t: 'c', col: 'r', hd: false }; board[7][7] = { t: 'c', col: 'r', hd: false };
        for (var c = 0; c < 9; c += 2) {
          board[3][c] = { t: 'p', col: 'b', hd: false };
          board[6][c] = { t: 'p', col: 'r', hd: false };
        }
      } else {
        board[0][4] = { t: 'k', col: 'b', hd: false };
        board[9][4] = { t: 'k', col: 'r', hd: false };
        var upPositions = [
          [0,0],[0,1],[0,2],[0,3],[0,5],[0,6],[0,7],[0,8],
          [2,1],[2,7],[3,0],[3,2],[3,4],[3,6],[3,8],
          [9,0],[9,1],[9,2],[9,3],[9,5],[9,6],[9,7],[9,8],
          [7,1],[7,7],[6,0],[6,2],[6,4],[6,6],[6,8]
        ];
        upPositions.forEach(function(pos) {
          var r = pos[0], c = pos[1];
          var col = r < 5 ? 'b' : 'r';
          board[r][c] = { t: '?', col: col, hd: true };
        });
      }
      return board;
    },
    computeBoardAtStep: function(step) {
      var board = this.getInitialBoard();
      var lastMove = null;
      var moveNote = '';

      for (var i = 0; i < step && i < this.moves.length; i++) {
        var mStr = this.moves[i];
        if (!mStr) continue;

        if (mStr.startsWith('CARD:')) {
          var spellId = mStr.replace('CARD:', '').split('->')[0];
          var spellInfo = this.spellIcons[spellId] || { icon: '✨', name: spellId, color: '#f1c40f' };
          moveNote = '✨ Thi triển Bí Pháp [' + spellInfo.name + ']!';
          continue;
        }

        if (mStr.startsWith('FLIP:')) {
          var flipParts = mStr.replace('FLIP:', '').split('->');
          if (flipParts.length === 2) {
            var fPos = flipParts[0].split(',').map(Number);
            var realType = flipParts[1];
            if (board[fPos[0]] && board[fPos[0]][fPos[1]]) {
              board[fPos[0]][fPos[1]].hd = false;
              board[fPos[0]][fPos[1]].t = realType;
              var sStr = board[fPos[0]][fPos[1]].col === 'r' ? '🔴 Đỏ' : '⚫ Đen';
              var rName = this.pieceNames[realType]?.[board[fPos[0]][fPos[1]].col] || realType;
              moveNote = '🕵️ ' + sStr + ' Lật ngửa quân Úp thành ' + rName + '!';
            }
          }
          continue;
        }

        var parts = mStr.split('-');
        if (parts.length === 2) {
          var from = parts[0].split(',').map(Number);
          var to = parts[1].split(',').map(Number);
          if (from.length === 2 && to.length === 2 && !isNaN(from[0]) && !isNaN(to[0])) {
            var p = board[from[0]][from[1]];
            var cap = board[to[0]][to[1]];
            board[from[0]][from[1]] = null;
            board[to[0]][to[1]] = p;
            if (p) {
              if (p.hd) p.hd = false;
              var sideStr = p.col === 'r' ? '🔴 Đỏ' : '⚫ Đen';
              var pName = p.hd ? 'Quân Úp' : ((this.pieceNames[p.t] && this.pieceNames[p.t][p.col]) || p.t);
              var capStr = cap ? (' ⚔️ ăn quân ' + (cap.hd ? 'Úp' : (this.pieceNames[cap.t]?.[cap.col] || cap.t))) : ' di chuyển';
              moveNote = sideStr + ': ' + pName + ' (' + from[0] + ',' + from[1] + ') ➔ (' + to[0] + ',' + to[1] + ')' + capStr;
            }
            lastMove = { from: from, to: to, piece: p, captured: cap, note: moveNote };
          }
        }
      }
      return { board: board, lastMove: lastMove, note: moveNote };
    },
    render: function() {
      if (!this.ctx || !this.canvas) return;
      var ctx = this.ctx;
      var W = 500, H = 550;
      this.canvas.width = W;
      this.canvas.height = H;
      var OX = 45, OY = 45, CS = 51;

      var res = this.computeBoardAtStep(this.currentStep);
      var board = res.board;
      var lastMove = res.lastMove;
      var note = res.note;

      ctx.fillStyle = '#f0d9b5';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, W - 20, H - 20);

      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#5a3d22';
      for (var r = 0; r < 10; r++) {
        ctx.beginPath(); ctx.moveTo(OX, OY + r * CS); ctx.lineTo(OX + 8 * CS, OY + r * CS); ctx.stroke();
      }
      for (var c = 0; c < 9; c++) {
        ctx.beginPath(); ctx.moveTo(OX + c * CS, OY); ctx.lineTo(OX + c * CS, OY + 4 * CS); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(OX + c * CS, OY + 5 * CS); ctx.lineTo(OX + c * CS, OY + 9 * CS); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(OX, OY + 4 * CS); ctx.lineTo(OX, OY + 5 * CS); ctx.moveTo(OX + 8 * CS, OY + 4 * CS); ctx.lineTo(OX + 8 * CS, OY + 5 * CS); ctx.stroke();
      ctx.fillStyle = '#8b4513'; ctx.font = 'bold 22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('楚 河', OX + 2 * CS, OY + 4.5 * CS); ctx.fillText('漢 界', OX + 6 * CS, OY + 4.5 * CS);

      ctx.beginPath();
      ctx.moveTo(OX + 3 * CS, OY); ctx.lineTo(OX + 5 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 5 * CS, OY); ctx.lineTo(OX + 3 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 3 * CS, OY + 7 * CS); ctx.lineTo(OX + 5 * CS, OY + 9 * CS);
      ctx.moveTo(OX + 5 * CS, OY + 7 * CS); ctx.lineTo(OX + 3 * CS, OY + 9 * CS); ctx.stroke();

      if (lastMove) {
        ctx.fillStyle = 'rgba(241, 196, 15, 0.45)';
        ctx.fillRect(OX + lastMove.from[1] * CS - 20, OY + lastMove.from[0] * CS - 20, 40, 40);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.55)';
        ctx.fillRect(OX + lastMove.to[1] * CS - 20, OY + lastMove.to[0] * CS - 20, 40, 40);
      }

      for (var r = 0; r < 10; r++) {
        for (var c = 0; c < 9; c++) {
          var p = board[r][c];
          if (!p) continue;
          var x = OX + c * CS, y = OY + r * CS, rad = 20;

          if (p.hd) {
            ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = '#3a2416'; ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = '#d4af37'; ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, rad - 4, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = '#8b5a2b'; ctx.stroke();
            ctx.fillStyle = '#d4af37'; ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🎴', x, y + 1);
          } else {
            ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = '#fffdfa'; ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = p.col === 'r' ? '#c62828' : '#222222'; ctx.stroke();
            ctx.beginPath(); ctx.arc(x, y, rad - 3, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke();
            var char = (this.pieceNames[p.t] && this.pieceNames[p.t][p.col]) || p.t;
            ctx.fillStyle = p.col === 'r' ? '#c62828' : '#222222';
            ctx.font = 'bold 20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(char, x, y + 1);
          }
        }
      }

      var stepInfo = document.getElementById('kybien-step-info');
      if (stepInfo) {
        if (this.currentStep === 0) {
          stepInfo.innerHTML = '🔴 <strong>Nước 0 / ' + this.moves.length + '</strong>: Khai cuộc ván đấu';
        } else {
          stepInfo.innerHTML = '<strong>Nước ' + this.currentStep + ' / ' + this.moves.length + '</strong>: ' + (note || 'Di chuyển quân');
        }
      }
    },
    nextMove: function() { if (this.currentStep < this.moves.length) { this.currentStep++; this.render(); } },
    prevMove: function() { if (this.currentStep > 0) { this.currentStep--; this.render(); } },
    firstMove: function() { this.currentStep = 0; this.render(); },
    lastMove: function() { this.currentStep = this.moves.length; this.render(); }
  };

  setTimeout(function() { window.KybienViewer.init(); }, 100);
  setTimeout(function() { window.KybienViewer.init(); }, 500);
  setTimeout(function() { window.KybienViewer.init(); }, 1200);
})();
</script>
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
