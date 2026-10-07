/**
 * Kỳ Biến Platform Client Script (kybien-client.js)
 * Dành riêng cho kybien.blogspot.com
 */

(function () {
  const SERVER_URL = 'http://localhost:4000'; // Hoặc https://kybien-backend.onrender.com

  // FR-06: Silent Wake-up ngầm khi DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Kỷ Biến Client] Kích hoạt Silent Wake-up tới Server Render...');
    fetch(`${SERVER_URL}/ping`, { mode: 'no-cors' }).catch(() => {});

    // Khởi tạo Widget Header Profile
    initHeaderProfileWidget();
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

  // Window global viewer controller cho các bài đăng Blogger
  window.KybienViewer = {
    currentStep: 0,
    moves: [],
    init: function () {
      const viewerElem = document.getElementById('kybien-board-viewer');
      if (!viewerElem) return;
      try {
        this.moves = JSON.parse(viewerElem.getAttribute('data-moves') || '[]');
        console.log('[Kỳ Biến Replay Viewer] Đã tải ván cờ với', this.moves.length, 'nước đi.');
      } catch (e) {
        console.error(e);
      }
    },
    nextMove: function () {
      if (this.currentStep < this.moves.length) {
        this.currentStep++;
        console.log('Xem nước:', this.currentStep, this.moves[this.currentStep - 1]);
      }
    },
    prevMove: function () {
      if (this.currentStep > 0) {
        this.currentStep--;
        console.log('Xem nước:', this.currentStep);
      }
    },
    firstMove: function () {
      this.currentStep = 0;
    },
    lastMove: function () {
      this.currentStep = this.moves.length;
    },
  };

  document.addEventListener('DOMContentLoaded', () => window.KybienViewer.init());
})();
