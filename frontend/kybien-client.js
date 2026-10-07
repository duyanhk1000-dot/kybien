/**
 * Kỳ Biến Platform Client Script (kybien-client.js)
 * Dành riêng cho kybien.blogspot.com & Replay Viewer
 */

(function () {
  // Production Backend URL trên Render
  const SERVER_URL = 'https://kybien-backend.onrender.com';

  // FR-06: Silent Wake-up ngầm khi DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Kỷ Biến Client] Kích hoạt Silent Wake-up tới Server Render...');
    fetch(`${SERVER_URL}/ping`, { mode: 'no-cors' }).catch(() => {});

    // Khởi tạo Widget Header Profile
    initHeaderProfileWidget();

    // Khởi tạo Replay Viewer
    window.KybienViewer.init();
  });

  // FR-02: Header Profile Widget (Hiển thị User, Exp bar, Elo)
  async function initHeaderProfileWidget() {
    const token = localStorage.getItem('kybien_jwt_token');
    const container = document.getElementById('kybien-header-profile');
    if (!container) return;

    if (!token) {
      container.innerHTML = `
        <div class="kybien-auth-buttons">
          <a href="/p/arena.html" class="btn-login">Đăng Nhập / Đăng Ký</a>
        </div>
      `;
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        localStorage.removeItem('kybien_jwt_token');
        return initHeaderProfileWidget();
      }

      const user = await res.json();
      const expPercent = Math.min(100, Math.floor((user.exp / user.nextLevelExp) * 100));

      container.innerHTML = `
        <div class="kybien-user-card" style="display: flex; align-items: center; gap: 10px; font-family: sans-serif;">
          <div class="avatar" style="width: 40px; height: 40px; border-radius: 50%; background: #8b0000; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold;">
            ${user.username[0].toUpperCase()}
          </div>
          <div class="user-info">
            <div style="font-weight: bold;">${user.username} <span style="font-size: 0.8em; color: #e67e22;">(Lv.${user.level})</span></div>
            <div style="font-size: 0.85em; color: #555;">Elo: <strong>${user.elo}</strong></div>
            <div class="progress-bar-bg" style="width: 120px; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; margin-top: 3px;">
              <div class="progress-bar-fill" style="width: ${expPercent}%; height: 100%; background: #2ecc71;"></div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      console.error('[Kỳ Biến Profile Widget Error]', e);
    }
  }

  // Window global viewer controller cho các bài đăng Blogger (Interactive Xiangqi Board)
  window.KybienViewer = {
    currentStep: 0,
    moves: [],
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

    init: function () {
      const viewerElem = document.getElementById('kybien-board-viewer');
      if (!viewerElem) return;

      try {
        const rawMoves = viewerElem.getAttribute('data-moves');
        if (rawMoves) {
          this.moves = JSON.parse(rawMoves);
        }
        console.log('[Kỳ Biến Replay Viewer] Đã tải ván cờ với', this.moves.length, 'nước đi.');
        
        const canvasContainer = document.getElementById('chess-board-canvas');
        if (canvasContainer) {
          canvasContainer.innerHTML = `
            <canvas id="kybien-replay-canvas" width="500" height="550" style="width:100%; max-width:500px; height:auto; background:#f0d9b5; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.5); display:block; margin:0 auto;"></canvas>
            <div id="kybien-step-info" style="text-align:center; margin-top:10px; font-weight:bold; color:#f1c40f; font-size:0.95rem; font-family:sans-serif; background:rgba(0,0,0,0.5); padding:8px 12px; border-radius:6px; border:1px solid #5a3d22; min-height:40px; display:flex; align-items:center; justify-content:center;">
              🔴 Nước 0 / ${this.moves.length}: Khai cuộc ván đấu
            </div>
          `;
          this.canvas = document.getElementById('kybien-replay-canvas');
          if (this.canvas) this.ctx = this.canvas.getContext('2d');
        }
        this.render();
      } catch (e) {
        console.error('[Kỳ Biến Viewer Error]', e);
      }
    },

    getInitialBoard: function() {
      const board = Array(10).fill(null).map(() => Array(9).fill(null));
      const bk = ['r','n','b','a','k','a','b','n','r'];
      for (let c = 0; c < 9; c++) {
        board[0][c] = { t: bk[c], col: 'b' };
        board[9][c] = { t: bk[c], col: 'r' };
      }
      board[2][1] = { t: 'c', col: 'b' }; board[2][7] = { t: 'c', col: 'b' };
      board[7][1] = { t: 'c', col: 'r' }; board[7][7] = { t: 'c', col: 'r' };
      for (let c = 0; c < 9; c += 2) {
        board[3][c] = { t: 'p', col: 'b' };
        board[6][c] = { t: 'p', col: 'r' };
      }
      return board;
    },

    computeBoardAtStep: function(step) {
      const board = this.getInitialBoard();
      let lastMove = null;
      let moveNote = '';

      for (let i = 0; i < step && i < this.moves.length; i++) {
        const mStr = this.moves[i];
        if (!mStr) continue;

        // Xử lý sự kiện Bí Pháp (CARD:...)
        if (mStr.startsWith('CARD:')) {
          const spellName = mStr.replace('CARD:', '');
          moveNote = `Thi triển Bí Pháp [${spellName}]`;
          continue;
        }

        // Xử lý sự kiện Lật Quân Cờ Úp (FLIP:...)
        if (mStr.startsWith('FLIP:')) {
          moveNote = `Lật ngửa quân Cờ Úp`;
          continue;
        }

        // Xử lý Nước đi tọa độ chuẩn (r1,c1-r2,c2)
        const parts = mStr.split('-');
        if (parts.length === 2) {
          const from = parts[0].split(',').map(Number);
          const to = parts[1].split(',').map(Number);
          if (from.length === 2 && to.length === 2 && !isNaN(from[0]) && !isNaN(from[1]) && !isNaN(to[0]) && !isNaN(to[1])) {
            const p = board[from[0]][from[1]];
            const cap = board[to[0]][to[1]];
            board[from[0]][from[1]] = null;
            board[to[0]][to[1]] = p;

            if (p) {
              const sideStr = p.col === 'r' ? '🔴 Đỏ' : '⚫ Đen';
              const pName = (this.pieceNames[p.t] && this.pieceNames[p.t][p.col]) || p.t;
              const capStr = cap ? ` ⚔️ ăn quân ${this.pieceNames[cap.t]?.[cap.col] || cap.t}` : ' di chuyển';
              moveNote = `${sideStr}: ${pName} (${from[0]},${from[1]}) ➔ (${to[0]},${to[1]})${capStr}`;
            }

            lastMove = { from, to, piece: p, captured: cap, note: moveNote };
          }
        }
      }
      return { board, lastMove, note: moveNote };
    },

    render: function () {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const W = 500;
      const H = 550;
      this.canvas.width = W;
      this.canvas.height = H;

      const OX = 45, OY = 45, CS = 51;

      const { board, lastMove, note } = this.computeBoardAtStep(this.currentStep);

      // 1. Nền bàn cờ màu gỗ ấm
      ctx.fillStyle = '#f0d9b5';
      ctx.fillRect(0, 0, W, H);

      // 2. Đường viền khung ngoài
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, W - 20, H - 20);

      // 3. Kẻ lưới bàn cờ (Grid lines)
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#5a3d22';

      // Ngang (10 hàng)
      for (let r = 0; r < 10; r++) {
        ctx.beginPath();
        ctx.moveTo(OX, OY + r * CS);
        ctx.lineTo(OX + 8 * CS, OY + r * CS);
        ctx.stroke();
      }

      // Dọc (9 cột)
      for (let c = 0; c < 9; c++) {
        ctx.beginPath();
        ctx.moveTo(OX + c * CS, OY);
        ctx.lineTo(OX + c * CS, OY + 4 * CS);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(OX + c * CS, OY + 5 * CS);
        ctx.lineTo(OX + c * CS, OY + 9 * CS);
        ctx.stroke();
      }

      // Đường biên Sông
      ctx.beginPath();
      ctx.moveTo(OX, OY + 4 * CS); ctx.lineTo(OX, OY + 5 * CS);
      ctx.moveTo(OX + 8 * CS, OY + 4 * CS); ctx.lineTo(OX + 8 * CS, OY + 5 * CS);
      ctx.stroke();

      // Chữ Sông (楚 河 - 漢 界)
      ctx.fillStyle = '#8b4513';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('楚 河', OX + 2 * CS, OY + 4.5 * CS);
      ctx.fillText('漢 界', OX + 6 * CS, OY + 4.5 * CS);

      // Cung Tướng (Palaces)
      ctx.beginPath();
      ctx.moveTo(OX + 3 * CS, OY); ctx.lineTo(OX + 5 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 5 * CS, OY); ctx.lineTo(OX + 3 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 3 * CS, OY + 7 * CS); ctx.lineTo(OX + 5 * CS, OY + 9 * CS);
      ctx.moveTo(OX + 5 * CS, OY + 7 * CS); ctx.lineTo(OX + 3 * CS, OY + 9 * CS);
      ctx.stroke();

      // Highlight Nước đi vừa đi
      if (lastMove) {
        ctx.fillStyle = 'rgba(241, 196, 15, 0.45)';
        ctx.fillRect(OX + lastMove.from[1] * CS - 20, OY + lastMove.from[0] * CS - 20, 40, 40);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.55)';
        ctx.fillRect(OX + lastMove.to[1] * CS - 20, OY + lastMove.to[0] * CS - 20, 40, 40);
      }

      // 4. Vẽ Quân Cờ (Pieces)
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const p = board[r][c];
          if (!p) continue;
          const x = OX + c * CS;
          const y = OY + r * CS;
          const rad = 20;

          // Nền hình tròn quân cờ
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fillStyle = '#fffdfa';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = p.col === 'r' ? '#c62828' : '#222222';
          ctx.stroke();

          // Vòng chỉ trong
          ctx.beginPath();
          ctx.arc(x, y, rad - 3, 0, Math.PI * 2);
          ctx.lineWidth = 1;
          ctx.stroke();

          // Chữ Quân Cờ
          const char = (this.pieceNames[p.t] && this.pieceNames[p.t][p.col]) || p.t;
          ctx.fillStyle = p.col === 'r' ? '#c62828' : '#222222';
          ctx.font = 'bold 20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(char, x, y + 1);
        }
      }

      // 5. Cập nhật Thanh Tóm tắt Nước đi bên dưới
      const stepInfo = document.getElementById('kybien-step-info');
      if (stepInfo) {
        if (this.currentStep === 0) {
          stepInfo.innerHTML = `🔴 <strong>Nước 0 / ${this.moves.length}</strong>: Khai cuộc trận đấu`;
        } else {
          stepInfo.innerHTML = `<strong>Nước ${this.currentStep} / ${this.moves.length}</strong>: ${note || 'Di chuyển quân'}`;
        }
      }
    },

    nextMove: function () {
      if (this.currentStep < this.moves.length) {
        this.currentStep++;
        this.render();
      }
    },
    prevMove: function () {
      if (this.currentStep > 0) {
        this.currentStep--;
        this.render();
      }
    },
    firstMove: function () {
      this.currentStep = 0;
      this.render();
    },
    lastMove: function () {
      this.currentStep = this.moves.length;
      this.render();
    },
  };

  // Tự động khởi tạo ngay khi tải xong
  window.addEventListener('load', () => window.KybienViewer.init());
  setTimeout(() => window.KybienViewer.init(), 800);
})();
