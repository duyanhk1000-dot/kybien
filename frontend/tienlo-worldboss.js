/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — PHÂN HỆ TOÀN DÂN TRẢM MA (WORLD BOSS) (M4.4B)
 * Module: Socket.IO Client + Realtime Boss Arena UI + Responsive Mobile Optimization
 * Thiết kế: Server-Authoritative Damage, Anti-Spam Cooldown, Optimistic UI & Reconnect
 */

(function () {
  'use strict';

  // TỪ ĐIỂN MÃ LỖI TOÀN DÂN TRẢM MA
  const WORLDBOSS_ERROR_MESSAGES = {
    'WORLDBOSS_NOT_FOUND': 'Hiện không có Ma Long nào xuất hiện trong càn khôn.',
    'WORLDBOSS_NOT_ACTIVE': 'Ma Long hiện không ở trong trạng thái chiến đấu.',
    'WORLDBOSS_ALREADY_DEFEATED': 'Ma Long đã bị các vị tu sĩ trảm sát thành công!',
    'WORLDBOSS_EXPIRED': 'Thời gian phong ma đã kết thúc, Ma Long đã trốn vào hư không.',
    'WORLDBOSS_ATTACK_COOLDOWN': 'Chiêu thức đang hồi (400ms). Xin hãy tĩnh tâm một thoáng.',
    'WORLDBOSS_REWARD_ALREADY_CLAIMED': 'Đạo hữu đã nhận phần thưởng cho lần trảm ma này rồi (Bảo vệ Idempotency).',
    'WORLDBOSS_NO_REWARD': 'Đạo hữu chưa tham gia gây sát thương cho Ma Long lần này.',
    'WORLDBOSS_CHARACTER_NOT_FOUND': 'Chưa tìm thấy căn cơ nhân vật của đạo hữu.',
    'WORLDBOSS_INVALID_INSTANCE': 'Mã phiên Ma Long không hợp lệ.',
    'AUTHENTICATION_ERROR': 'Linh phù xác thực (JWT) đã hết hạn. Vui lòng đăng nhập lại.',
  };

  function translateWbError(code, fallback) {
    if (!code) return fallback || 'Có lỗi xảy ra.';
    if (WORLDBOSS_ERROR_MESSAGES[code]) return WORLDBOSS_ERROR_MESSAGES[code];
    for (const [key, msg] of Object.entries(WORLDBOSS_ERROR_MESSAGES)) {
      if (String(code).includes(key)) return msg;
    }
    return fallback || String(code);
  }

  // ĐỐI TƯỢNG QUẢN LÝ TOÀN DÂN TRẢM MA (WORLD BOSS CLIENT)
  class XianxiaWorldBossClient {
    constructor() {
      this.apiBase = window.location.origin;
      this.socket = null;
      this.connected = false;
      this.connecting = false;

      // Trạng thái Boss hiện tại
      this.boss = null;
      this.leaderboard = [];
      this.killer = null;
      this.myDamage = 0;
      this.myRank = null;
      this.hasClaimed = false;

      // Nhật ký chiến đấu realtime (Combat Feed)
      this.combatLogs = [];
      this.maxLogs = 40;

      // Trạng thái ra chiêu
      this.isCooldown = false;
      this.cooldownUntil = 0;
      this.cooldownTimer = null;
      this.autoAttack = false;
      this.autoAttackTimer = null;

      // Modal state
      this.modalOpen = false;
      this.countdownTimer = null;
    }

    /**
     * Lấy token xác thực từ LocalStorage
     */
    getToken() {
      return typeof localStorage !== 'undefined'
        ? (localStorage.getItem('kybien_jwt_token') || localStorage.getItem('kybien_token') || localStorage.getItem('token'))
        : null;
    }

    getAuthHeaders() {
      const token = this.getToken();
      return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      };
    }

    /**
     * Khởi tạo kết nối Socket.IO tới namespace `/xianxia-worldboss`
     */
    initSocket() {
      if (typeof io === 'undefined') {
        console.warn('[WorldBoss] Thư viện Socket.IO client chưa sẵn sàng.');
        return;
      }

      const token = this.getToken();
      if (!token) return;

      if (this.socket && this.connected) return;

      this.connecting = true;
      try {
        if (this.socket) {
          this.socket.removeAllListeners();
          this.socket.disconnect();
          this.socket = null;
        }

        const socketUrl = window.location.origin;
        this.socket = io(`${socketUrl}/xianxia-worldboss`, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 20,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
          this.connected = true;
          this.connecting = false;
          console.log('[WorldBoss] Đã kết nối Socket.IO /xianxia-worldboss thành công.');
          this.updateConnectionBadge(true);

          if (this.boss && this.boss.id) {
            this.socket.emit('worldboss:join', { bossInstanceId: this.boss.id });
          }
        });

        this.socket.on('disconnect', () => {
          this.connected = false;
          this.updateConnectionBadge(false);
          console.log('[WorldBoss] Mất kết nối Socket.IO /xianxia-worldboss.');
        });

        // 1. Nhận Snapshot ban đầu hoặc cập nhật toàn diện
        this.socket.on('worldboss:snapshot', (snapshot) => {
          if (!snapshot || !snapshot.boss) return;
          this.applySnapshot(snapshot);
        });

        // 2. Nhận cập nhật máu và sát thương realtime từ các người chơi
        this.socket.on('worldboss:hp_updated', (data) => {
          this.handleHpUpdated(data);
        });

        // 3. Boss bị trảm sát
        this.socket.on('worldboss:defeated', (data) => {
          this.handleBossDefeated(data);
        });

        // 4. Lỗi từ server
        this.socket.on('worldboss:error', (err) => {
          const msg = translateWbError(err.code || err.message, err.message);
          this.showToast(msg, 'error');
        });

      } catch (err) {
        console.error('[WorldBoss] Lỗi khi tạo kết nối socket:', err);
      }
    }

    updateConnectionBadge(online) {
      const dot = document.getElementById('wb-connection-dot');
      const text = document.getElementById('wb-connection-text');
      if (dot) {
        dot.className = online ? 'chat-status-dot status-online' : 'chat-status-dot status-offline';
      }
      if (text) {
        text.innerText = online ? 'Thần thức liên thông' : 'Mất liên lạc';
        text.style.color = online ? '#34d399' : '#f87171';
      }
    }

    /**
     * Mở giao diện Toàn Dân Trảm Ma
     */
    async openModal() {
      const modal = document.getElementById('worldboss-modal');
      if (!modal) return;
      modal.style.display = 'flex';
      this.modalOpen = true;

      // Nạp dữ liệu mới nhất từ backend
      await this.fetchCurrentBoss();

      // Kết nối socket nếu chưa kết nối
      this.initSocket();

      // Khởi động đếm ngược
      this.startCountdown();
    }

    /**
     * Đóng giao diện
     */
    closeModal() {
      const modal = document.getElementById('worldboss-modal');
      if (modal) modal.style.display = 'none';
      this.modalOpen = false;

      // Dừng auto attack nếu đang bật
      this.stopAutoAttack();

      // Dừng đếm ngược
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
    }

    /**
     * Lấy dữ liệu phiên Boss hiện tại qua REST API
     */
    async fetchCurrentBoss() {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/world-boss/current`, {
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.applySnapshot(json.data);
        } else {
          this.renderNoBossState();
        }
      } catch (e) {
        console.error('[WorldBoss] Lỗi khi lấy phiên Boss:', e);
        this.renderNoBossState();
      }
    }

    /**
     * Cập nhật dữ liệu từ snapshot máy chủ
     */
    applySnapshot(data) {
      this.boss = data.boss;
      this.leaderboard = data.topDamage || [];
      this.killer = data.killer || null;
      this.myDamage = data.myDamage || 0;
      this.myRank = data.myRank || null;

      if (this.boss && this.socket && this.connected) {
        this.socket.emit('worldboss:join', { bossInstanceId: this.boss.id });
      }

      this.renderUI();
    }

    /**
     * Xử lý sự kiện máu cập nhật realtime
     */
    handleHpUpdated(data) {
      if (!this.boss || this.boss.id !== data.bossInstanceId) return;

      const prevHp = this.boss.current_hp ?? this.boss.currentHp;
      this.boss.currentHp = data.currentHp;
      this.boss.current_hp = data.currentHp;
      this.boss.status = data.status;

      // Cập nhật thanh máu và số
      this.renderHpBar(true);

      const dmg = data.damageDealt ?? data.damage ?? 0;

      // Thêm log chiến đấu
      const logItem = {
        time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
        name: data.attackerName || 'Tu sĩ bí ẩn',
        realm: data.attackerRealm || 'Phàm Nhân',
        damage: dmg,
        isCritical: !!data.isCritical,
      };
      this.appendCombatLog(logItem);

      // Hiệu ứng chữ sát thương bay lên trên đầu Ma Long
      this.spawnFloatingDamage(dmg, data.isCritical, data.attackerName);

      // Rung chấn Ma Long
      this.shakeBossAvatar();

      // Nếu chính là người chơi hiện tại vừa đánh
      const currentToken = this.getToken();
      if (data.characterId && window.engine && window.engine.player && window.engine.player.id === data.characterId) {
        this.myDamage = (this.myDamage || 0) + dmg;
        this.renderMyContribution();
      }

      // Tự động kiểm tra nếu Boss tử trận
      if (data.status === 'DEFEATED') {
        this.handleBossDefeated({
          bossInstanceId: data.bossInstanceId,
          killerId: data.killerId ?? data.killerCharacterId ?? data.characterId,
          killerName: data.killerName ?? data.attackerName,
        });
      }
    }

    /**
     * Xử lý khi Boss bị trảm sát
     */
    handleBossDefeated(data) {
      if (this.boss) {
        this.boss.status = 'DEFEATED';
        this.boss.currentHp = 0;
      }
      this.killer = {
        characterId: data.killerId ?? data.killerCharacterId,
        name: data.killerName,
      };

      this.stopAutoAttack();
      this.renderUI();
      this.showToast(`🎉 XÍCH DIỄM MA LONG ĐÃ BỊ TRẢM SÁT bởi ${data.killerName || 'Đại Năng'}!`, 'success');

      // Tự động làm mới BXH sau 1.5s
      setTimeout(() => this.fetchLeaderboard(), 1500);
    }

    /**
     * Lấy riêng bảng xếp hạng từ backend
     */
    async fetchLeaderboard() {
      if (!this.boss || !this.boss.id) return;
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/world-boss/leaderboard/${this.boss.id}`, {
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.leaderboard = json.data.leaderboard || [];
          this.killer = json.data.killer || this.killer;
          this.renderLeaderboard();
        }
      } catch (e) {
        console.error('[WorldBoss] Lỗi khi nạp BXH:', e);
      }
    }

    /**
     * Thực hiện đòn tấn công Boss Thế Giới
     */
    async attack() {
      if (!this.boss || this.boss.status !== 'ACTIVE') {
        this.showToast('Ma Long hiện không ở trong trạng thái chiến đấu.', 'info');
        return;
      }

      const now = Date.now();
      if (now < this.cooldownUntil) {
        // Đang trong thời gian cooldown
        return;
      }

      // Kích hoạt Cooldown 400ms trên client (Rate-limit protector)
      this.setCooldown(450);

      // Ưu tiên gửi qua Socket.IO nếu có kết nối
      if (this.socket && this.connected) {
        this.socket.emit('worldboss:attack', { bossInstanceId: this.boss.id });
        return;
      }

      // Fallback gửi qua HTTP REST API nếu socket mất kết nối
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/world-boss/attack`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ bossInstanceId: this.boss.id }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.handleHpUpdated({
            bossInstanceId: this.boss.id,
            damage: json.data.damage,
            isCritical: json.data.isCritical,
            currentHp: json.data.currentHp,
            status: json.data.status,
            attackerName: json.data.characterName,
            characterId: json.data.characterId,
          });
        } else {
          const msg = translateWbError(json.error?.code || json.error, 'Không thể xuất chiêu.');
          this.showToast(msg, 'error');
        }
      } catch (e) {
        console.error('[WorldBoss] Lỗi khi tấn công qua HTTP:', e);
      }
    }

    /**
     * Bật/Tắt tự động xuất chiêu
     */
    toggleAutoAttack() {
      if (this.autoAttack) {
        this.stopAutoAttack();
      } else {
        this.startAutoAttack();
      }
    }

    startAutoAttack() {
      if (!this.boss || this.boss.status !== 'ACTIVE') {
        this.showToast('Không thể kích hoạt tự động: Ma Long chưa thức tỉnh hoặc đã bị trảm.', 'info');
        return;
      }

      this.autoAttack = true;
      const btn = document.getElementById('wb-btn-auto');
      if (btn) {
        btn.innerHTML = '⚡ Dừng Tự Động';
        btn.classList.add('active');
        btn.style.background = 'rgba(239, 68, 68, 0.3)';
        btn.style.borderColor = '#ef4444';
      }

      // Vòng lặp xuất chiêu tự động mỗi 480ms (an toàn hơn 400ms)
      this.autoAttackTimer = setInterval(() => {
        if (!this.modalOpen || !this.boss || this.boss.status !== 'ACTIVE') {
          this.stopAutoAttack();
          return;
        }
        this.attack();
      }, 480);

      this.attack(); // Bắn phát đầu tiên ngay lập tức
      this.showToast('Đã kích hoạt thần thức tự động liên tục xuất chiêu!', 'info');
    }

    stopAutoAttack() {
      this.autoAttack = false;
      if (this.autoAttackTimer) {
        clearInterval(this.autoAttackTimer);
        this.autoAttackTimer = null;
      }
      const btn = document.getElementById('wb-btn-auto');
      if (btn) {
        btn.innerHTML = '⚡ Tự Động Xuất Chiêu';
        btn.classList.remove('active');
        btn.style.background = 'rgba(245, 158, 11, 0.15)';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
      }
    }

    /**
     * Đặt hiệu ứng Cooldown cho nút xuất chiêu
     */
    setCooldown(ms) {
      this.isCooldown = true;
      this.cooldownUntil = Date.now() + ms;

      const btn = document.getElementById('wb-btn-attack');
      if (btn) {
        btn.disabled = true;
        btn.classList.add('cooling-down');
      }

      if (this.cooldownTimer) clearTimeout(this.cooldownTimer);
      this.cooldownTimer = setTimeout(() => {
        this.isCooldown = false;
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('cooling-down');
        }
      }, ms);
    }

    /**
     * Nhận phần thưởng sau khi Ma Long bị trảm sát
     */
    async claimReward() {
      if (!this.boss || this.boss.status !== 'DEFEATED') {
        this.showToast('Chỉ có thể nhận thưởng khi Ma Long đã bị trảm sát!', 'error');
        return;
      }

      const claimBtn = document.getElementById('wb-btn-claim');
      if (claimBtn) {
        claimBtn.disabled = true;
        claimBtn.innerText = 'Đang lĩnh thưởng...';
      }

      const idempotencyKey = `wb_claim_${this.boss.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/world-boss/claim-reward`, {
          method: 'POST',
          headers: {
            ...this.getAuthHeaders(),
            'x-idempotency-key': idempotencyKey,
          },
          body: JSON.stringify({
            bossInstanceId: this.boss.id,
            idempotencyKey,
          }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.hasClaimed = true;
          this.renderClaimedModal(json.data);
          // Cập nhật lại tài nguyên nhân vật nếu có engine
          if (window.engine && typeof window.engine.fetchCharacterState === 'function') {
            window.engine.fetchCharacterState();
          }
        } else {
          const msg = translateWbError(json.error?.code || json.error, 'Không thể nhận thưởng.');
          this.showToast(msg, 'error');
          if (claimBtn) {
            claimBtn.disabled = false;
            claimBtn.innerText = '🎁 Nhận Thưởng Trảm Ma';
          }
        }
      } catch (e) {
        console.error('[WorldBoss] Lỗi khi nhận thưởng:', e);
        this.showToast('Mất kết nối máy chủ khi nhận thưởng.', 'error');
        if (claimBtn) {
          claimBtn.disabled = false;
          claimBtn.innerText = '🎁 Nhận Thưởng Trảm Ma';
        }
      }
    }

    /**
     * Hiển thị bảng vinh danh nhận thưởng
     */
    renderClaimedModal(data) {
      const claimResult = document.getElementById('wb-claim-result');
      if (!claimResult) return;

      const isLastHit = data.isKiller || data.isLastHit;
      const rankText = data.rank ? `Hạng ${data.rank}` : 'Khuyến khích';
      const lastHitBadge = isLastHit ? '<span class="wb-killer-pill">👑 Đòn Kết Liễu (+50% Bonus)</span>' : '';
      const exp = data.expReward ?? data.exp ?? 0;
      const silver = data.silverReward ?? data.silver ?? 0;
      const itemsList = data.itemsReward || data.items || [];

      let itemsHtml = '';
      if (Array.isArray(itemsList)) {
        itemsHtml = itemsList.map(it => `<span class="wb-reward-item-tag">🎁 ${it.name} x${it.quantity}</span>`).join(' ');
      }

      claimResult.innerHTML = `
        <div class="wb-claim-success-card">
          <div style="font-size: 1.1rem; font-weight: 700; color: #fbbf24;">🎉 LĨNH THƯỞNG THÀNH CÔNG!</div>
          <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;">Thành tích: <strong style="color: #38bdf8;">${rankText}</strong> ${lastHitBadge}</div>
          <div class="wb-reward-grid" style="margin-top: 10px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <div class="wb-reward-box"><span>✨ Kinh Nghiệm:</span> <strong style="color: #6ee7b7;">+${exp.toLocaleString()} EXP</strong></div>
            <div class="wb-reward-box"><span>🪙 Bạc:</span> <strong style="color: #fde047;">+${silver.toLocaleString()} Bạc</strong></div>
          </div>
          <div style="margin-top: 10px;">${itemsHtml}</div>
        </div>
      `;
      claimResult.style.display = 'block';

      const claimBtn = document.getElementById('wb-btn-claim');
      if (claimBtn) {
        claimBtn.style.display = 'none';
      }
    }

    /**
     * Quản lý đếm ngược thời gian kết thúc
     */
    startCountdown() {
      if (this.countdownTimer) clearInterval(this.countdownTimer);

      const update = () => {
        const timerEl = document.getElementById('wb-countdown');
        if (!timerEl || !this.boss) return;

        if (this.boss.status === 'DEFEATED') {
          timerEl.innerHTML = '<span style="color: #6ee7b7;">Đã Trảm Sát</span>';
          return;
        }

        const end = new Date(this.boss.endTime).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((end - now) / 1000));

        if (diff <= 0) {
          timerEl.innerHTML = '<span style="color: #f87171;">Hết Giờ</span>';
          if (this.boss.status === 'ACTIVE') {
            this.boss.status = 'EXPIRED';
            this.renderUI();
          }
          return;
        }

        const m = Math.floor(diff / 60);
        const s = diff % 60;
        timerEl.innerHTML = `Còn: <strong>${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}</strong>`;
      };

      update();
      this.countdownTimer = setInterval(update, 1000);
    }

    // ====================================================
    // RENDER FUNCTIONS (GIAO DIỆN & HIỆU ỨNG THỊ GIÁC)
    // ====================================================

    renderUI() {
      if (!this.boss) {
        this.renderNoBossState();
        return;
      }

      // 1. Tiêu đề và thông tin Ma Long
      const nameEl = document.getElementById('wb-boss-name');
      const levelEl = document.getElementById('wb-boss-level');
      const statusPill = document.getElementById('wb-status-pill');

      if (nameEl) nameEl.innerText = this.boss.name || 'Xích Diễm Ma Long';
      if (levelEl) levelEl.innerText = `Cấp ${this.boss.level || 50} • Hệ Hỏa`;

      if (statusPill) {
        if (this.boss.status === 'ACTIVE') {
          statusPill.innerText = '🔥 ĐANG KỊCH CHIẾN';
          statusPill.className = 'wb-status-pill status-active';
        } else if (this.boss.status === 'DEFEATED') {
          statusPill.innerText = '👑 ĐÃ TRẢM SÁT';
          statusPill.className = 'wb-status-pill status-defeated';
        } else {
          statusPill.innerText = '⏳ HẾT THỜI GIAN';
          statusPill.className = 'wb-status-pill status-expired';
        }
      }

      // 2. Thanh máu
      this.renderHpBar(false);

      // 3. Nút hành động
      const btnAttack = document.getElementById('wb-btn-attack');
      const btnAuto = document.getElementById('wb-btn-auto');
      const defeatSection = document.getElementById('wb-defeat-section');

      if (this.boss.status === 'ACTIVE') {
        if (btnAttack) {
          btnAttack.style.display = 'inline-flex';
          btnAttack.disabled = this.isCooldown;
        }
        if (btnAuto) btnAuto.style.display = 'inline-flex';
        if (defeatSection) defeatSection.style.display = 'none';
      } else {
        if (btnAttack) btnAttack.style.display = 'none';
        if (btnAuto) btnAuto.style.display = 'none';
        if (defeatSection) {
          defeatSection.style.display = 'block';
          this.renderDefeatSection();
        }
      }

      // 4. Bảng xếp hạng Top 10
      this.renderLeaderboard();

      // 5. Đóng góp của bản thân
      this.renderMyContribution();
    }

    renderHpBar(animate) {
      if (!this.boss) return;

      const currentHp = Math.max(0, this.boss.current_hp ?? this.boss.currentHp ?? 0);
      const maxHp = Math.max(1, this.boss.max_hp ?? this.boss.maxHp ?? 10000000);
      const percent = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));

      const fill = document.getElementById('wb-hp-fill');
      const text = document.getElementById('wb-hp-text');
      const pct = document.getElementById('wb-hp-pct');

      if (fill) {
        fill.style.width = `${percent.toFixed(2)}%`;
      }
      if (text) {
        text.innerText = `${currentHp.toLocaleString()} / ${maxHp.toLocaleString()}`;
      }
      if (pct) {
        pct.innerText = `${percent.toFixed(1)}%`;
      }
    }

    renderDefeatSection() {
      const killerNameEl = document.getElementById('wb-killer-name');
      const claimBtn = document.getElementById('wb-btn-claim');

      if (killerNameEl) {
        killerNameEl.innerText = this.killer ? this.killer.name : (this.boss?.killerId ? `Tu sĩ #${this.boss.killerId}` : 'Đại Năng Ẩn Danh');
      }

      if (claimBtn) {
        if (this.hasClaimed) {
          claimBtn.style.display = 'none';
        } else {
          claimBtn.style.display = 'inline-flex';
          claimBtn.disabled = false;
          claimBtn.innerText = '🎁 Nhận Thưởng Trảm Ma';
        }
      }
    }

    renderLeaderboard() {
      const tbody = document.getElementById('wb-leaderboard-body');
      if (!tbody) return;

      if (!this.leaderboard || this.leaderboard.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Chưa có tu sĩ nào gây sát thương.</td></tr>';
        return;
      }

      const totalBossMaxHp = this.boss?.maxHp || 10000000;

      tbody.innerHTML = this.leaderboard.map((item, idx) => {
        let rankBadge = `${item.rank || idx + 1}`;
        if (item.rank === 1) rankBadge = '🥇';
        else if (item.rank === 2) rankBadge = '🥈';
        else if (item.rank === 3) rankBadge = '🥉';

        const pct = item.totalDamage && totalBossMaxHp
          ? ((item.totalDamage / totalBossMaxHp) * 100).toFixed(1)
          : '0.0';

        const isMe = window.engine && window.engine.player && window.engine.player.id === item.characterId;

        return `
          <tr class="${isMe ? 'wb-my-row' : ''}">
            <td style="text-align: center; font-weight: 700;">${rankBadge}</td>
            <td>
              <span class="wb-player-realm-tag">${item.realm || 'Phàm'}</span>
              <strong style="color: ${isMe ? '#fef08a' : '#f1f5f9'};">${item.name}</strong>
              ${isMe ? ' <span style="font-size: 0.68rem; color: #38bdf8;">(Bạn)</span>' : ''}
            </td>
            <td style="text-align: right; color: #fde047; font-weight: 700;">${item.totalDamage?.toLocaleString()}</td>
            <td style="text-align: right; color: #94a3b8; font-size: 0.75rem;">${pct}%</td>
          </tr>
        `;
      }).join('');
    }

    renderMyContribution() {
      const myDmgEl = document.getElementById('wb-my-damage');
      const myRankEl = document.getElementById('wb-my-rank');
      if (myDmgEl) myDmgEl.innerText = (this.myDamage || 0).toLocaleString();
      if (myRankEl) {
        myRankEl.innerText = this.myRank ? `#${this.myRank}` : 'Chưa xếp hạng';
      }
    }

    appendCombatLog(log) {
      this.combatLogs.unshift(log);
      if (this.combatLogs.length > this.maxLogs) this.combatLogs.pop();

      const logBox = document.getElementById('wb-combat-feed');
      if (!logBox) return;

      const critTag = log.isCritical ? '<span class="wb-crit-tag">💥 BẠO KÍCH</span>' : '';
      const row = document.createElement('div');
      row.className = 'wb-log-row';
      row.innerHTML = `
        <span class="wb-log-time">${log.time}</span>
        <span class="wb-log-player">${log.name}</span>
        <span class="wb-log-action">xuất chiêu gây</span>
        <strong class="wb-log-dmg">${log.damage?.toLocaleString()}</strong> ${critTag}
      `;

      logBox.insertBefore(row, logBox.firstChild);
      while (logBox.children.length > this.maxLogs) {
        logBox.removeChild(logBox.lastChild);
      }
    }

    spawnFloatingDamage(damage, isCritical, senderName) {
      const container = document.getElementById('wb-floating-container');
      if (!container) return;

      const floatEl = document.createElement('div');
      floatEl.className = isCritical ? 'wb-float-damage crit' : 'wb-float-damage';
      floatEl.innerText = `${isCritical ? '⚡ BẠO KÍCH! ' : ''}-${damage?.toLocaleString()}`;

      // Vị trí ngẫu nhiên quanh ngực Ma Long
      const randX = Math.floor(Math.random() * 120) - 60;
      const randY = Math.floor(Math.random() * 40) - 20;
      floatEl.style.transform = `translate(${randX}px, ${randY}px)`;

      container.appendChild(floatEl);

      setTimeout(() => {
        if (floatEl.parentNode === container) {
          container.removeChild(floatEl);
        }
      }, 950);
    }

    shakeBossAvatar() {
      const avatar = document.getElementById('wb-boss-avatar');
      if (!avatar) return;
      avatar.classList.add('wb-shaking');
      setTimeout(() => avatar.classList.remove('wb-shaking'), 250);
    }

    renderNoBossState() {
      const body = document.getElementById('wb-modal-body');
      if (body) {
        body.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: #94a3b8;">
            <div style="font-size: 3rem; margin-bottom: 12px;">🐉</div>
            <h3 style="color: #fef08a; font-family: var(--font-serif); font-size: 1.3rem;">MA LONG HIỆN CHƯA THỨC TỈNH</h3>
            <p style="margin-top: 8px; font-size: 0.88rem; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.6;">
              Thiên địa an bình, cấm địa tạm yên. Xin đạo hữu hãy chuyên tâm tu luyện hoặc thám hiểm bí cảnh, chờ đợi dị tượng phong ma tái xuất!
            </p>
            <button class="btn-wuxia-link" style="margin-top: 18px;" onclick="window.worldboss.closeModal()">Đóng Bảng Thần Thức ✕</button>
          </div>
        `;
      }
    }

    showToast(message, type) {
      if (window.engine && typeof window.engine.notify === 'function') {
        window.engine.notify(message, type || 'info');
      } else {
        console.log(`[WorldBoss Toast] [${type}] ${message}`);
      }
    }
  }

  // Khởi tạo đối tượng toàn cục
  const wbClient = new XianxiaWorldBossClient();
  window.worldboss = wbClient;

  // Tích hợp phương thức vào TienLoEngine nếu có
  if (typeof TienLoEngine !== 'undefined') {
    TienLoEngine.prototype.openWorldBossModal = function () {
      wbClient.openModal();
    };
  }

  // Tự động kiểm tra Boss khi tải trang
  document.addEventListener('DOMContentLoaded', () => {
    // Có thể pre-fetch nhẹ
  });

})();
