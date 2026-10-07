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

    // Tự động khởi tạo Replay Viewer
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
      if (!viewerElem) {
        // Thử lại nếu DOM bài viết chưa sẵn sàng
        setTimeout(() => {
          if (document.getElementById('kybien-board-viewer') && !window.KybienViewer.canvas) {
            window.KybienViewer.init();
          }
        }, 500);
        return;
      }

      try {
        this.moves = JSON.parse(viewerElem.getAttribute('data-moves') || '[]');
        console.log('[Kỳ Biến Replay Viewer] Đã tải ván cờ với', this.moves.length, 'nước đi.');
        
        const canvasContainer = document.getElementById('chess-board-canvas');
        if (canvasContainer) {
          canvasContainer.innerHTML = '<canvas id="kybien-replay-canvas" width="500" height="550" style="width:100%; height:100%; max-width:500px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.5);"></canvas><div id="kybien-step-info" style="text-align:center; margin-top:10px; font-weight:bold; color:#f1c40f; font-size:0.95rem; font-family:sans-serif; background:rgba(0,0,0,0.4); padding:6px 12px; border-radius:6px; border:1px solid #5a3d22;">Nước: 0 / ' + this.moves.length + '</div>';
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
      let movedPiece = null;
      let capturedPiece = null;

      for (let i = 0; i < step && i < this.moves.length; i++) {
        const mStr = this.moves[i];
        if (!mStr) continue;
        const parts = mStr.split('-');
        if (parts.length === 2) {
          const from = parts[0].split(',').map(Number);
          const to = parts[1].split(',').map(Number);
          if (from.length === 2 && to.length === 2 && !isNaN(from[0]) && !isNaN(to[0])) {
            const p = board[from[0]][from[1]];
            capturedPiece = board[to[0]][to[1]];
            board[from[0]][from[1]] = null;
            board[to[0]][to[1]] = p;
            movedPiece = p;
            lastMove = { from, to, piece: p, captured: capturedPiece };
          }
        }
      }
      return { board, lastMove };
    },

    render: function () {
      if (!this.ctx || !this.canvas) return;
      const ctx = this.ctx;
      const W = this.canvas.width;
      const H = this.canvas.height;
      const OX = 45, OY = 45, CS = 51;

      const { board, lastMove } = this.computeBoardAtStep(this.currentStep);

      // Background
      ctx.fillStyle = '#f0d9b5';
      ctx.fillRect(0, 0, W, H);

      // Border frame
      ctx.strokeStyle = '#5a3d22';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, W - 20, H - 20);

      // Grid lines
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#5a3d22';

      // Horizontal lines
      for (let r = 0; r < 10; r++) {
        ctx.beginPath();
        ctx.moveTo(OX, OY + r * CS);
        ctx.lineTo(OX + 8 * CS, OY + r * CS);
        ctx.stroke();
      }

      // Vertical lines
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

      // River side lines
      ctx.beginPath();
      ctx.moveTo(OX, OY + 4 * CS);
      ctx.lineTo(OX, OY + 5 * CS);
      ctx.moveTo(OX + 8 * CS, OY + 4 * CS);
      ctx.lineTo(OX + 8 * CS, OY + 5 * CS);
      ctx.stroke();

      // River text
      ctx.fillStyle = '#8b4513';
      ctx.font = 'bold 22px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('楚 河', OX + 2 * CS, OY + 4.5 * CS);
      ctx.fillText('漢 界', OX + 6 * CS, OY + 4.5 * CS);

      // Palaces (Cung Tướng)
      ctx.beginPath();
      ctx.moveTo(OX + 3 * CS, OY); ctx.lineTo(OX + 5 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 5 * CS, OY); ctx.lineTo(OX + 3 * CS, OY + 2 * CS);
      ctx.moveTo(OX + 3 * CS, OY + 7 * CS); ctx.lineTo(OX + 5 * CS, OY + 9 * CS);
      ctx.moveTo(OX + 5 * CS, OY + 7 * CS); ctx.lineTo(OX + 3 * CS, OY + 9 * CS);
      ctx.stroke();

      // Highlight Last Move
      if (lastMove) {
        ctx.fillStyle = 'rgba(241, 196, 15, 0.45)';
        ctx.fillRect(OX + lastMove.from[1] * CS - 20, OY + lastMove.from[0] * CS - 20, 40, 40);
        ctx.fillStyle = 'rgba(46, 204, 113, 0.55)';
        ctx.fillRect(OX + lastMove.to[1] * CS - 20, OY + lastMove.to[0] * CS - 20, 40, 40);
      }

      // Draw Pieces
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const p = board[r][c];
          if (!p) continue;
          const x = OX + c * CS;
          const y = OY + r * CS;
          const rad = 20;

          // Circle background
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fillStyle = '#fffdfa';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = p.col === 'r' ? '#c62828' : '#222';
          ctx.stroke();

          // Inner ring
          ctx.beginPath();
          ctx.arc(x, y, rad - 3, 0, Math.PI * 2);
          ctx.lineWidth = 1;
          ctx.stroke();

          // Piece Label
          const char = (this.pieceNames[p.t] && this.pieceNames[p.t][p.col]) || p.t;
          ctx.fillStyle = p.col === 'r' ? '#c62828' : '#222';
          ctx.font = 'bold 20px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(char, x, y + 1);
        }
      }

      // Step Info Update & Tóm tắt nước đi
      const stepInfo = document.getElementById('kybien-step-info');
      if (stepInfo) {
        if (this.currentStep === 0) {
          stepInfo.innerHTML = `🔴 <strong>Nước 0 / ${this.moves.length}</strong>: Khai cuộc trận đấu`;
        } else if (lastMove && lastMove.piece) {
          const sideText = lastMove.piece.col === 'r' ? '🔴 Phe Đỏ' : '⚫ Phe Đen';
          const pName = (this.pieceNames[lastMove.piece.t] && this.pieceNames[lastMove.piece.t][lastMove.piece.col]) || lastMove.piece.t;
          const actionText = lastMove.captured ? ` ⚔️ ăn quân ${this.pieceNames[lastMove.captured.t]?.[lastMove.captured.col] || lastMove.captured.t}` : ' di chuyển';
          stepInfo.innerHTML = `<strong>Nước ${this.currentStep} / ${this.moves.length}</strong>: ${sideText} - ${pName} (${lastMove.from[0]},${lastMove.from[1]}) ➔ (${lastMove.to[0]},${lastMove.to[1]})${actionText}`;
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

  document.addEventListener('DOMContentLoaded', () => window.KybienViewer.init());
  // Backup poll cho Blogger
  window.addEventListener('load', () => window.KybienViewer.init());
})();
