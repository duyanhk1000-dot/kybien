/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG — PHÂN HỆ TỔ ĐỘI & BÍ CẢNH REALTIME (M4.3.3D)
 * Module: Socket.IO Client + Party System UI + Realtime Co-op Dungeon UI
 * Thiết kế: Server-Authoritative, Optimistic Concurrency Control, Reconnect & Resilience
 */

(function () {
  'use strict';

  // TỪ ĐIỂN ÁNH XẠ MÃ LỖI BACKEND SANG TIẾNG VIỆT DỄ HIỂU
  const XIANXIA_ERROR_MESSAGES = {
    'AUTHENTICATION_ERROR': 'Linh phù xác thực (JWT) đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.',
    'AUTH_TOKEN_MISSING': 'Chưa tìm thấy linh phù đăng nhập. Xin hãy đăng nhập tài khoản Tiên Lộ.',
    'AUTH_INVALID_TOKEN': 'Linh phù đăng nhập không hợp lệ hoặc đã quá hạn.',
    'PARTY_NOT_FOUND': 'Không tìm thấy thông tin tổ đội trong thiên địa.',
    'PARTY_ALREADY_IN_PARTY': 'Đạo hữu hiện đang ở trong một tổ đội khác. Xin rời đội hiện tại trước.',
    'PARTY_FULL': 'Tổ đội đã đủ 4 vị đạo hữu, không thể dung nạp thêm.',
    'PARTY_FORBIDDEN': 'Đạo hữu không có quyền hạn đối với tổ đội này.',
    'PARTY_NOT_LEADER': 'Chỉ có Đội Trưởng mới có quyền hiệu lệnh (mời, kích, giải tán hoặc mở phó bản).',
    'PARTY_MEMBER_NOT_ENOUGH_FATIGUE': 'Có thành viên trong đội không đủ 15 Thể Lực để cùng tiến nhập bí cảnh.',
    'PARTY_MEMBERS_NOT_READY': 'Tất cả thành viên trong đội phải ở trạng thái "ĐÃ SẴN SÀNG" trước khi mở bí cảnh.',
    'PARTY_NOT_IN_PARTY': 'Đạo hữu chưa gia nhập tổ đội nào.',
    'PARTY_IN_DUNGEON': 'Tổ đội đang kịch chiến trong bí cảnh, không thể thực hiện thao tác này.',
    'PARTY_INVITE_NOT_FOUND': 'Không tìm thấy lời mời tổ đội hoặc lời mời đã bị hủy.',
    'PARTY_INVITE_EXPIRED': 'Lời mời gia nhập tổ đội đã quá thời hạn (2 phút).',
    'PARTY_INVITE_ALREADY_MEMBER': 'Đạo hữu được mời đã là thành viên của tổ đội.',
    'DUNGEON_NOT_FOUND': 'Không tìm thấy bí cảnh tương ứng.',
    'DUNGEON_FORBIDDEN': 'Đạo hữu không thuộc danh sách thành viên của phiên bí cảnh này.',
    'DUNGEON_VERSION_MISMATCH': 'Phiên bản chiến đấu đã thay đổi do đồng đội vừa xuất chiêu. Đang tự động tái đồng bộ...',
    'DUNGEON_COMBAT_COOLDOWN': 'Chiêu thức đang trong thời gian hồi (500ms). Xin hãy tĩnh tâm một thoáng.',
    'DUNGEON_RATE_LIMITED': 'Thao tác thần thức quá nhanh, vui lòng chờ giây lát.',
    'DUNGEON_ALREADY_EXPIRED': 'Phiên bí cảnh đã hết thời hạn 15 phút.',
    'DUNGEON_NOT_COMPLETED': 'Bí cảnh chưa hoàn tất hoặc đã thất bại, không thể nhận thưởng.',
    'DUNGEON_ALREADY_CLAIMED': 'Đạo hữu đã nhận phần thưởng cho bí cảnh này rồi (Bảo vệ Idempotency).',
    'DUNGEON_NOT_IN_PROGRESS': 'Bí cảnh không còn trong trạng thái chiến đấu.',
  };

  function translateError(code, fallback) {
    if (!code) return fallback || 'Có lỗi xảy ra.';
    if (XIANXIA_ERROR_MESSAGES[code]) return XIANXIA_ERROR_MESSAGES[code];
    for (const [key, msg] of Object.entries(XIANXIA_ERROR_MESSAGES)) {
      if (String(code).includes(key)) return msg;
    }
    return fallback || String(code);
  }

  // MỞ RỘNG TIENLOENGINE VỚI CÁC PHƯƠNG THỨC M4.3.3D
  if (typeof TienLoEngine !== 'undefined') {

    // ====================================================
    // 1. GATE D1 — KHỞI TẠO SOCKET CLIENT & LIFECYCLE
    // ====================================================

    /**
     * Khởi tạo kết nối Socket.IO tới namespace `/xianxia-dungeon`
     */
    TienLoEngine.prototype.initDungeonSocket = function () {
      if (typeof io === 'undefined') {
        console.warn('[Bí Cảnh Realtime] Thư viện Socket.IO client chưa sẵn sàng.');
        this.updateDungeonConnectionStatus('offline', 'Chưa có Socket.IO');
        return;
      }

      const token = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('tienlo_token') || localStorage.getItem('tienlo_jwt_token') || localStorage.getItem('kybien_jwt_token') || localStorage.getItem('token'))
        : null;

      if (!token) {
        this.updateDungeonConnectionStatus('offline', 'Chưa đăng nhập');
        return;
      }

      this.dungeonConnecting = true;
      this.updateDungeonConnectionStatus('connecting', 'Đang kết nối thần thức bí cảnh...');

      try {
        // Dọn dẹp socket cũ nếu có
        if (this.dungeonSocket) {
          this.dungeonSocket.removeAllListeners();
          this.dungeonSocket.disconnect();
          this.dungeonSocket = null;
        }

        const socketUrl = window.location.origin;
        this.dungeonSocket = io(`${socketUrl}/xianxia-dungeon`, {
          auth: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 15,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        // 1.1 Vòng đời kết nối cơ bản
        this.dungeonSocket.on('connect', () => {
          this.dungeonConnected = true;
          this.dungeonConnecting = false;
          this.updateDungeonConnectionStatus('online', 'Thần Thức Đồng Bộ');
          console.log('[Bí Cảnh Realtime] Đã kết nối namespace /xianxia-dungeon thành công.');

          // Nếu đang có tổ đội, tự động join room
          if (this.myPartyData?.party?.id) {
            this.dungeonSocket.emit('party:join', { partyId: this.myPartyData.party.id });
          }

          // Nếu đang có phiên phó bản hoạt động, tự động gửi reconnect
          if (this.activeDungeonRun?.id) {
            this.reconnectDungeonRun(this.activeDungeonRun.id);
          }
        });

        this.dungeonSocket.on('disconnect', (reason) => {
          this.dungeonConnected = false;
          this.dungeonConnecting = false;
          this.updateDungeonConnectionStatus('offline', 'Mất kết nối');
          console.warn('[Bí Cảnh Realtime] Ngắt kết nối socket:', reason);
        });

        this.dungeonSocket.on('connect_error', (err) => {
          this.dungeonConnected = false;
          this.dungeonConnecting = false;
          const msg = err?.message || 'Lỗi kết nối';
          const isAuth = msg.includes('AUTHENTICATION') || msg.includes('AUTH_');
          this.updateDungeonConnectionStatus('offline', isAuth ? 'Linh phù hết hạn' : 'Lỗi kết nối');
          console.error('[Bí Cảnh Realtime] Lỗi handshake:', msg);
        });

        // 1.2 Sự kiện Realtime Tổ Đội (Party Events)
        this.dungeonSocket.on('party:joined', (data) => {
          if (data && data.party) {
            this.myPartyData = { hasParty: true, party: data.party };
            this.renderPartyUI();
          }
        });

        this.dungeonSocket.on('party:member_joined', (data) => {
          const m = data?.member;
          const name = m?.name || m?.character?.name || 'Một vị đạo hữu';
          this.notify(`[Tổ Đội] ${name} đã gia nhập tổ đội!`, 'success');
          this.fetchMyParty();
        });

        this.dungeonSocket.on('party:member_left', (data) => {
          this.notify(`[Tổ Đội] Một thành viên đã rời khỏi tổ đội.`, 'info');
          this.fetchMyParty();
        });

        this.dungeonSocket.on('party:member_kicked', (data) => {
          this.notify(`[Tổ Đội] Thành viên đã bị trục xuất khỏi tổ đội.`, 'warning');
          this.fetchMyParty();
        });

        this.dungeonSocket.on('party:kicked', (data) => {
          alert('Đạo hữu đã bị Đội Trưởng trục xuất khỏi tổ đội.');
          this.myPartyData = { hasParty: false };
          this.renderPartyUI();
        });

        this.dungeonSocket.on('party:disbanded', (data) => {
          alert('Tổ đội đã bị giải tán bởi Đội Trưởng.');
          this.myPartyData = { hasParty: false };
          this.renderPartyUI();
        });

        this.dungeonSocket.on('party:ready_changed', (data) => {
          if (this.myPartyData?.party?.members) {
            const mem = this.myPartyData.party.members.find(m => m.character_id === data.characterId);
            if (mem) mem.is_ready = data.isReady;
            this.renderPartyUI();
          }
        });

        this.dungeonSocket.on('party:dungeon_started', (data) => {
          this.notify('⚔️ Đội trưởng đã mở bí cảnh! Toàn đội cùng tiến nhập...', 'success');
          if (data?.runId) {
            this.openDungeonCombat(data.runId);
          }
        });

        this.dungeonSocket.on('party:error', (err) => {
          const msg = translateError(err?.code, err?.message);
          this.notify(`[Lỗi Tổ Đội] ${msg}`, 'warning');
        });

        // 1.3 Sự kiện Realtime Phó Bản (Dungeon Events)
        this.dungeonSocket.on('dungeon:snapshot', (snapshot) => {
          if (!snapshot) return;
          this.applyAuthoritativeSnapshot(snapshot);
        });

        this.dungeonSocket.on('dungeon:turn_resolved', (turnData) => {
          if (!turnData) return;
          this.applyTurnResolution(turnData);
        });

        this.dungeonSocket.on('dungeon:wave_updated', (data) => {
          this.notify(`🐉 Đợt ${data.currentWave}/${data.totalWaves} yêu thú xuất hiện! Hãy cẩn trọng!`, 'warning');
          if (this.activeDungeonRun) {
            this.activeDungeonRun.currentWave = data.currentWave;
            this.activeDungeonRun.totalWaves = data.totalWaves;
            if (this.activeDungeonRun.combatState && data.monsters) {
              this.activeDungeonRun.combatState.monsters = data.monsters;
            }
            this.renderDungeonCombatUI();
          }
        });

        this.dungeonSocket.on('dungeon:completed', (data) => {
          this.notify('🏆 Bí Cảnh Toàn Thắng! Toàn bộ yêu thú đã bị trảm sát!', 'success');
          if (this.activeDungeonRun) {
            this.activeDungeonRun.status = 'COMPLETED';
            this.renderDungeonCombatUI();
          }
        });

        this.dungeonSocket.on('dungeon:failed', (data) => {
          this.notify('💀 Toàn đội đã tử trận! Bí cảnh thất bại.', 'error');
          if (this.activeDungeonRun) {
            this.activeDungeonRun.status = 'FAILED';
            this.renderDungeonCombatUI();
          }
        });

        this.dungeonSocket.on('dungeon:expired', (data) => {
          this.notify('⌛ Phiên bí cảnh đã hết hạn (15 phút).', 'warning');
          if (this.activeDungeonRun) {
            this.activeDungeonRun.status = 'EXPIRED';
            this.renderDungeonCombatUI();
          }
        });

        this.dungeonSocket.on('dungeon:member_connected', (data) => {
          this.appendDungeonCombatLog(`[Đồng Đội] Đạo hữu ${data.name || 'đồng đội'} đã kết nối thần thức.`, 'system');
        });

        this.dungeonSocket.on('dungeon:member_disconnected', (data) => {
          this.appendDungeonCombatLog(`[Đồng Đội] Đạo hữu ${data.name || 'đồng đội'} tạm thời gián đoạn thần thức.`, 'warning');
        });

        this.dungeonSocket.on('dungeon:reward_claimed', (data) => {
          this.dungeonClaimedRewards = true;
          this.notify('🎁 Đã nhận thưởng bí cảnh thành công!', 'success');
          this.showRewardBreakdownModal(data);
          this.renderDungeonCombatUI();
          // Cập nhật lại số dư bạc / tu vi của nhân vật
          this.syncRemoteCharacterIfLoggedIn();
        });

        this.dungeonSocket.on('dungeon:error', (err) => {
          const code = err?.code;
          if (code === 'DUNGEON_VERSION_MISMATCH') {
            this.notify('⚡ Phiên bản chiến đấu đã thay đổi, đang tự động đồng bộ...', 'info');
            if (this.activeDungeonRun?.id) {
              this.reconnectDungeonRun(this.activeDungeonRun.id);
            }
          } else {
            const msg = translateError(code, err?.message);
            this.notify(`[Bí Cảnh] ${msg}`, 'warning');
          }
        });

      } catch (e) {
        console.error('[Bí Cảnh Realtime] Khởi tạo socket thất bại:', e);
      }
    };

    /**
     * Cập nhật trạng thái kết nối trên giao diện
     */
    TienLoEngine.prototype.updateDungeonConnectionStatus = function (status, text) {
      const dot = document.getElementById('dungeon-socket-status-dot');
      const label = document.getElementById('dungeon-socket-status-text');
      if (dot) {
        dot.className = `chat-status-dot status-${status}`;
      }
      if (label) {
        label.textContent = text || (status === 'online' ? 'Đã kết nối' : 'Mất kết nối');
      }
    };

    // ====================================================
    // 2. GATE D2 — QUẢN LÝ TỔ ĐỘI (PARTY UI)
    // ====================================================

    /**
     * Mở Modal Quản Lý Tổ Đội & Bí Cảnh
     */
    TienLoEngine.prototype.openPartyModal = async function () {
      this.partyModalOpen = true;
      const modal = document.getElementById('party-modal');
      if (modal) modal.style.display = 'flex';

      // Đảm bảo kết nối socket đã sẵn sàng
      if (!this.dungeonSocket || !this.dungeonConnected) {
        this.initDungeonSocket();
      }

      await this.fetchMyParty();
      await this.fetchPartyInvites();

      if (this.partyActiveTab === 'dungeons') {
        await this.fetchDungeonsList();
      }

      this.renderPartyUI();
    };

    /**
     * Đóng Modal Quản Lý Tổ Đội
     */
    TienLoEngine.prototype.closePartyModal = function () {
      this.partyModalOpen = false;
      const modal = document.getElementById('party-modal');
      if (modal) modal.style.display = 'none';
    };

    /**
     * Chuyển Tab trong Modal Tổ Đội
     */
    TienLoEngine.prototype.setPartyTab = async function (tab) {
      this.partyActiveTab = tab;
      if (tab === 'dungeons') {
        await this.fetchDungeonsList();
      } else if (tab === 'invites') {
        await this.fetchPartyInvites();
      } else {
        await this.fetchMyParty();
      }
      this.renderPartyUI();
    };

    /**
     * Lấy thông tin tổ đội hiện tại của bản thân
     */
    TienLoEngine.prototype.fetchMyParty = async function () {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/me`, {
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.myPartyData = json.data;
          // Nếu có tổ đội và socket đã kết nối, join room
          if (this.myPartyData.hasParty && this.myPartyData.party?.id && this.dungeonSocket && this.dungeonConnected) {
            this.dungeonSocket.emit('party:join', { partyId: this.myPartyData.party.id });
          }
        } else {
          this.myPartyData = { hasParty: false };
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin tổ đội:', err);
        this.myPartyData = { hasParty: false };
      }
    };

    /**
     * Lấy danh sách lời mời đang chờ
     */
    TienLoEngine.prototype.fetchPartyInvites = async function () {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/invites`, {
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.partyInvites = json.data;
          const badge = document.getElementById('party-invites-badge');
          if (badge) {
            badge.textContent = this.partyInvites.length;
            badge.style.display = this.partyInvites.length > 0 ? 'inline-block' : 'none';
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải lời mời tổ đội:', err);
      }
    };

    /**
     * Gửi yêu cầu Thành Lập Tổ Đội Mới
     */
    TienLoEngine.prototype.createPartySubmit = async function () {
      const nameInput = document.getElementById('party-create-name-input');
      const name = nameInput ? nameInput.value.trim() : `Đoàn Tu Tiên ${this.player.name}`;
      if (!name) {
        alert('Vui lòng nhập danh hiệu / tên tổ đội.');
        return;
      }

      this.partySubmitting = true;
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ name }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Không thể thành lập tổ đội.'));
        }

        this.notify('✨ Đã thành lập tổ đội thành công!', 'success');
        await this.fetchMyParty();
        this.renderPartyUI();
      } catch (err) {
        alert(err.message || 'Lỗi thành lập tổ đội.');
      } finally {
        this.partySubmitting = false;
      }
    };

    /**
     * Đổi trạng thái Sẵn Sàng (Toggle Ready)
     */
    TienLoEngine.prototype.togglePartyReadySubmit = async function () {
      if (!this.myPartyData?.party?.members) return;
      const myCharId = this.player.id;
      const myMem = this.myPartyData.party.members.find(m => m.character_id === myCharId);
      const nextReady = myMem ? !myMem.is_ready : true;

      // Ưu tiên phát qua WebSocket nếu online
      if (this.dungeonSocket && this.dungeonConnected) {
        this.dungeonSocket.emit('party:ready', { isReady: nextReady }, (res) => {
          if (res && !res.success) {
            this.notify(`[Lỗi Sẵn Sàng] ${translateError(res.error?.code, res.error?.message)}`, 'warning');
          }
        });
      } else {
        // Fallback REST API
        try {
          const res = await fetch(`${this.apiBase}/api/xianxia/party/ready`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ isReady: nextReady }),
          });
          const json = await res.json();
          if (!json.success) throw new Error(translateError(json.error));
        } catch (e) {
          this.notify(e.message, 'warning');
        }
      }

      if (myMem) myMem.is_ready = nextReady;
      this.renderPartyUI();
    };

    /**
     * Mời Đạo Hữu Vào Tổ Đội
     */
    TienLoEngine.prototype.inviteMemberPrompt = async function () {
      const targetIdStr = prompt('Nhập ID nhân vật của đạo hữu muốn mời (Ví dụ: 2, 5, 12...):');
      if (!targetIdStr) return;
      const inviteeCharacterId = parseInt(targetIdStr.trim(), 10);
      if (isNaN(inviteeCharacterId) || inviteeCharacterId <= 0) {
        alert('ID nhân vật không hợp lệ.');
        return;
      }

      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/invite`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ inviteeCharacterId }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Không thể gửi lời mời.'));
        }
        this.notify('✉️ Đã gửi lời mời đạo hữu vào tổ đội (Hạn 2 phút).', 'success');
      } catch (err) {
        alert(err.message || 'Lỗi gửi lời mời.');
      }
    };

    /**
     * Trả lời Lời Mời Gia Nhập Tổ Đội (Chấp nhận / Từ chối)
     */
    TienLoEngine.prototype.respondPartyInviteSubmit = async function (inviteId, accept) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/invites/${inviteId}/respond`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ action: accept ? 'ACCEPT' : 'REJECT' }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Lỗi xử lý lời mời.'));
        }

        if (accept) {
          this.notify('✨ Đã gia nhập tổ đội thành công!', 'success');
          this.partyActiveTab = 'my_party';
          await this.fetchMyParty();
        } else {
          this.notify('Đã từ chối lời mời.', 'info');
        }

        await this.fetchPartyInvites();
        this.renderPartyUI();
      } catch (err) {
        alert(err.message || 'Lỗi xử lý lời mời.');
      }
    };

    /**
     * Rời Khỏi Tổ Đội
     */
    TienLoEngine.prototype.leavePartySubmit = async function () {
      if (!confirm('Đạo hữu có chắc chắn muốn rời khỏi tổ đội?')) return;

      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/leave`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Lỗi rời tổ đội.'));
        }

        this.notify('Đã rời khỏi tổ đội.', 'info');
        this.myPartyData = { hasParty: false };
        this.renderPartyUI();
      } catch (err) {
        alert(err.message || 'Không thể rời tổ đội.');
      }
    };

    /**
     * Trục Xuất Thành Viên (Leader Only)
     */
    TienLoEngine.prototype.kickPartyMemberSubmit = async function (targetCharacterId, targetName) {
      if (!confirm(`Trục xuất đạo hữu "${targetName}" khỏi tổ đội?`)) return;

      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/kick`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ targetCharacterId }),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Không thể trục xuất thành viên.'));
        }

        this.notify(`Đã trục xuất đạo hữu ${targetName}.`, 'warning');
        await this.fetchMyParty();
        this.renderPartyUI();
      } catch (err) {
        alert(err.message || 'Không thể trục xuất thành viên.');
      }
    };

    /**
     * Giải Tán Tổ Đội (Leader Only)
     */
    TienLoEngine.prototype.disbandPartySubmit = async function () {
      if (!confirm('Hành động này sẽ GIẢI TÁN TỔ ĐỘI và buộc tất cả thành viên rời đội. Đạo hữu chắc chắn chứ?')) return;

      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/party/disband`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Không thể giải tán tổ đội.'));
        }

        this.notify('Tổ đội đã được giải tán thành công.', 'info');
        this.myPartyData = { hasParty: false };
        this.renderPartyUI();
      } catch (err) {
        alert(err.message || 'Không thể giải tán tổ đội.');
      }
    };

    /**
     * Vẽ Giao Diện Modal Tổ Đội
     */
    TienLoEngine.prototype.renderPartyUI = function () {
      const container = document.getElementById('party-modal-body');
      if (!container) return;

      // Cập nhật tab active button
      ['my_party', 'dungeons', 'invites'].forEach(t => {
        const btn = document.getElementById(`party-tab-${t}`);
        if (btn) btn.classList.toggle('active', this.partyActiveTab === t);
      });

      if (this.partyActiveTab === 'dungeons') {
        this.renderDungeonsTab(container);
      } else if (this.partyActiveTab === 'invites') {
        this.renderInvitesTab(container);
      } else {
        this.renderMyPartyTab(container);
      }
    };

    /**
     * Vẽ Tab "Tổ Đội Của Ta"
     */
    TienLoEngine.prototype.renderMyPartyTab = function (container) {
      const pData = this.myPartyData;
      if (!pData || !pData.hasParty || !pData.party) {
        // Giao diện khi chưa có tổ đội
        container.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: rgba(18, 24, 38, 0.7); border: 1px dashed var(--border-medium); border-radius: var(--radius-md); padding: 24px; text-align: center;">
              <div style="font-size: 2.5rem; margin-bottom: 8px;">👥</div>
              <h4 style="font-family: var(--font-serif); color: #fef08a; font-size: 1.15rem; margin-bottom: 6px;">
                Đạo Hữu Chưa Thuộc Tổ Đội Nào
              </h4>
              <p style="font-size: 0.8rem; color: var(--color-text-muted); max-width: 480px; margin: 0 auto 16px;">
                Đồng hành cùng tiên hữu khai sơn lập phái, tương trợ săn yêu thú trong bí cảnh. Hãy tự lập tổ đội hoặc kiểm tra danh sách lời mời đang chờ.
              </p>
              
              <div style="display: flex; justify-content: center; gap: 10px; max-width: 400px; margin: 0 auto;">
                <input 
                  type="text" 
                  id="party-create-name-input" 
                  class="chat-text-input" 
                  placeholder="Tên tổ đội (VD: Bắc Đẩu Kiếm Đoàn)..." 
                  value="Tổ Đội ${this.player.name}"
                  style="border-radius: var(--radius-sm);"
                />
                <button 
                  class="btn-primary-glow" 
                  style="padding: 8px 16px; white-space: nowrap; font-size: 0.85rem;" 
                  onclick="window.engine.createPartySubmit()"
                >
                  ✨ Lập Đội
                </button>
              </div>
            </div>

            <!-- Khối Lời Mời Nhỏ -->
            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.85rem; font-weight: 600; color: #a7f3d0;">✉️ Lời Mời Gia Nhập Đang Chờ (${this.partyInvites.length})</span>
                <button class="btn-wuxia-link" style="font-size: 0.72rem;" onclick="window.engine.fetchPartyInvites(); window.engine.renderPartyUI();">🔄 Làm mới</button>
              </div>
              ${this.renderInvitesListHtml()}
            </div>
          </div>
        `;
        return;
      }

      // Giao diện khi ĐÃ CÓ tổ đội
      const party = pData.party;
      const isLeader = party.leader_id === this.player.id || (party.leader && party.leader.id === this.player.id);
      const members = Array.isArray(party.members) ? party.members : [];
      const allReady = members.length > 0 && members.every(m => m.is_ready);

      let statusBadge = '<span class="char-realm-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4);">ĐANG TẬP HỢP</span>';
      if (party.status === 'IN_DUNGEON') {
        statusBadge = '<span class="char-realm-badge" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4);">ĐANG Ở BÍ CẢNH</span>';
      } else if (allReady && members.length > 0) {
        statusBadge = '<span class="char-realm-badge" style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.4);">SẴN SÀNG CHIẾN ĐẤU</span>';
      }

      // Tạo 4 ô thành viên
      let slotsHtml = '';
      for (let i = 0; i < 4; i++) {
        const m = members[i];
        if (m) {
          const char = m.character || m;
          const isMe = char.id === this.player.id;
          const isSlotLeader = char.id === party.leader_id;
          slotsHtml += `
            <div style="background: rgba(18, 22, 32, 0.85); border: 1px solid ${m.is_ready ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.1)'}; border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px; position: relative;">
              <div style="display: flex; gap: 10px; align-items: center;">
                <div style="width: 40px; height: 40px; border-radius: var(--radius-sm); background: rgba(0,0,0,0.4); border: 1px solid var(--border-medium); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
                  ${isSlotLeader ? '👑' : '🧙'}
                </div>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 700; font-size: 0.88rem; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${char.name} ${isMe ? '<span style="color: #6ee7b7; font-size: 0.72rem;">(Ta)</span>' : ''}
                  </div>
                  <div style="font-size: 0.72rem; color: var(--color-text-dim);">
                    Cấp ${char.level || 1} • ${this.getRealmName(char.realm)}
                  </div>
                </div>
              </div>

              <!-- Ready Indicator -->
              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
                <span style="font-size: 0.72rem; font-weight: 600; color: ${m.is_ready ? '#34d399' : '#fbbf24'};">
                  ${m.is_ready ? '✔ ĐÃ SẴN SÀNG' : '⏳ CHƯA SẴN SÀNG'}
                </span>

                ${isLeader && !isSlotLeader ? `
                  <button class="btn-wuxia-link" style="color: #f87171; border-color: rgba(239,68,68,0.3); padding: 2px 6px; font-size: 0.68rem;" onclick="window.engine.kickPartyMemberSubmit(${char.id}, '${char.name}')">
                    Trục Xuất ✕
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        } else {
          // Ô trống
          slotsHtml += `
            <div style="background: rgba(18, 22, 32, 0.4); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100px; gap: 6px; color: var(--color-text-dim);">
              <span style="font-size: 1.5rem; opacity: 0.4;">+</span>
              <span style="font-size: 0.75rem;">Vị Trí Còn Trống</span>
              ${isLeader ? `
                <button class="btn-wuxia-link" style="padding: 3px 8px; font-size: 0.7rem;" onclick="window.engine.inviteMemberPrompt()">
                  Mời Đạo Hữu
                </button>
              ` : ''}
            </div>
          `;
        }
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Header Tổ Đội -->
          <div style="background: rgba(18, 24, 38, 0.9); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="font-family: var(--font-serif); font-size: 1.15rem; color: #fef08a; margin: 0;">${party.name}</h3>
                <span style="font-size: 0.75rem; color: var(--color-text-dim);">#${party.id}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 3px;">
                Đội Trưởng: <strong style="color: #fbbf24;">${party.leader?.name || 'Đội Trưởng'}</strong>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Lưới 4 Vị Trí Thành Viên -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px;">
            ${slotsHtml}
          </div>

          <!-- Thanh Điều Khiển & Thao Tác -->
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 8px;">
              <!-- Nút Đổi Sẵn Sàng -->
              <button 
                class="btn-primary-glow" 
                style="padding: 7px 16px; font-size: 0.82rem;" 
                onclick="window.engine.togglePartyReadySubmit()"
              >
                ⚡ Sẵn Sàng / Hủy Sẵn Sàng
              </button>

              ${isLeader ? `
                <button class="btn-wuxia-link" style="padding: 7px 12px; font-size: 0.8rem;" onclick="window.engine.inviteMemberPrompt()">
                  ✉️ Mời Đạo Hữu
                </button>
              ` : ''}
            </div>

            <div style="display: flex; gap: 8px;">
              ${isLeader ? `
                <button 
                  class="btn-primary-glow" 
                  style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(245, 158, 11, 0.4)); border-color: rgba(245, 158, 11, 0.5); color: #fef08a; padding: 7px 16px; font-size: 0.82rem;"
                  onclick="window.engine.setPartyTab('dungeons')"
                >
                  🏰 Vào Bí Cảnh →
                </button>
                <button class="btn-reincarnate" style="padding: 7px 12px; font-size: 0.78rem;" onclick="window.engine.disbandPartySubmit()">
                  Giải Tán
                </button>
              ` : `
                <button class="btn-reincarnate" style="padding: 7px 12px; font-size: 0.78rem;" onclick="window.engine.leavePartySubmit()">
                  Rời Đội
                </button>
              `}
            </div>
          </div>
        </div>
      `;
    };

    /**
     * Danh sách HTML Lời Mời
     */
    TienLoEngine.prototype.renderInvitesListHtml = function () {
      if (!this.partyInvites || this.partyInvites.length === 0) {
        return '<div style="color: var(--color-text-dim); font-size: 0.78rem; font-style: italic;">Không có lời mời nào đang chờ.</div>';
      }

      return `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${this.partyInvites.map(inv => `
            <div style="background: rgba(18, 24, 38, 0.8); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #fff; font-size: 0.82rem;">${inv.party?.name || 'Tổ Đội Bí Cảnh'}</strong>
                <div style="font-size: 0.72rem; color: var(--color-text-dim);">
                  Từ: ${inv.inviter?.name || 'Đội Trưởng'} • Hạn: 2 phút
                </div>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn-primary-glow" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.engine.respondPartyInviteSubmit(${inv.id}, true)">
                  Chấp Nhận
                </button>
                <button class="btn-wuxia-link" style="padding: 4px 10px; font-size: 0.75rem; color: #f87171;" onclick="window.engine.respondPartyInviteSubmit(${inv.id}, false)">
                  Từ Chối
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    /**
     * Vẽ Tab "Lời Mời Đang Chờ"
     */
    TienLoEngine.prototype.renderInvitesTab = function (container) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h4 style="font-family: var(--font-serif); color: #fef08a; font-size: 1.05rem; margin: 0;">
              ✉️ Danh Sách Thư Mời Đồng Hành
            </h4>
            <button class="btn-wuxia-link" style="font-size: 0.75rem;" onclick="window.engine.fetchPartyInvites(); window.engine.renderPartyUI();">
              🔄 Tải Lại
            </button>
          </div>
          ${this.renderInvitesListHtml()}
        </div>
      `;
    };

    // ====================================================
    // 3. GATE D3 — DANH SÁCH BÍ CẢNH & CHIẾN ĐẤU REALTIME
    // ====================================================

    /**
     * Tải danh sách phó bản khả dụng từ REST API
     */
    TienLoEngine.prototype.fetchDungeonsList = async function () {
      this.dungeonLoading = true;
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/dungeons`, {
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          this.dungeonsList = json.data;
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách bí cảnh:', err);
      } finally {
        this.dungeonLoading = false;
      }
    };

    /**
     * Vẽ Tab "Danh Sách Bí Cảnh"
     */
    TienLoEngine.prototype.renderDungeonsTab = function (container) {
      const hasParty = this.myPartyData?.hasParty;
      const isLeader = hasParty && (this.myPartyData.party.leader_id === this.player.id || this.myPartyData.party.leader?.id === this.player.id);
      const members = hasParty && Array.isArray(this.myPartyData.party.members) ? this.myPartyData.party.members : [];
      const allReady = members.length > 0 && members.every(m => m.is_ready);

      if (this.dungeonsList.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--color-text-dim); padding: 40px;">
            ${this.dungeonLoading ? 'Đang dò tìm luồng linh khí bí cảnh...' : 'Hiện chưa phát hiện bí cảnh khả dụng.'}
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <div style="font-size: 0.8rem; color: var(--color-text-muted);">
            Thảo phạt bí cảnh cổ đại cùng tổ đội. Mỗi thành viên cần tiêu hao <strong style="color: var(--amber-400);">15 Thể Lực</strong> và ở trạng thái <strong style="color: #34d399;">SẴN SÀNG</strong>.
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${this.dungeonsList.map(d => {
              const canEnter = hasParty && isLeader && allReady && !this.dungeonSubmitting;
              let enterBtnText = '⚔️ Mở Bí Cảnh (-15 Thể Lực)';
              if (!hasParty) enterBtnText = 'Cần Có Tổ Đội';
              else if (!isLeader) enterBtnText = 'Chờ Đội Trưởng Mở';
              else if (!allReady) enterBtnText = 'Chờ Toàn Đội Sẵn Sàng';

              return `
                <div style="background: rgba(18, 24, 38, 0.85); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.4rem;">🐺</span>
                        <h4 style="font-family: var(--font-serif); font-size: 1.1rem; color: #fef08a; margin: 0;">${d.name}</h4>
                      </div>
                      <p style="font-size: 0.78rem; color: var(--color-text-muted); margin: 6px 0 0;">
                        ${d.description || 'Bí cảnh cổ động nguy hiểm trùng trùng, yêu lang hội tụ.'}
                      </p>
                    </div>

                    <div style="text-align: right; font-size: 0.75rem; color: var(--color-text-dim);">
                      <div>Đợt sóng: <strong style="color: #fff;">${d.waves_count || 3} Wave</strong></div>
                      <div>Thể lực: <strong style="color: var(--amber-400);">${d.fatigue_cost || 15}</strong></div>
                    </div>
                  </div>

                  <!-- Phần Thưởng Ước Tính -->
                  <div style="background: rgba(0,0,0,0.3); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
                    <span style="color: #6ee7b7;">🎁 Phần Thưởng Toàn Thắng:</span>
                    <span style="color: #cbd5e1;">EXP, Tu Vi, Bạc, Yêu Đan, Nanh Sói Ngàn Năm, Linh Thảo</span>
                  </div>

                  <!-- Nút Tham Gia -->
                  <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 4px;">
                    <button 
                      class="btn-primary-glow" 
                      style="padding: 8px 20px; font-size: 0.85rem; ${!canEnter ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                      ${!canEnter ? 'disabled' : ''}
                      onclick="window.engine.enterDungeonSubmit('${d.id}')"
                    >
                      ${enterBtnText}
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    };

    /**
     * Tiến Nhập Bí Cảnh (Leader Only)
     */
    TienLoEngine.prototype.enterDungeonSubmit = async function (dungeonId) {
      if (!confirm('Tiến nhập bí cảnh? Toàn thể đạo hữu trong tổ đội sẽ bị khấu trừ 15 Thể Lực.')) return;

      this.dungeonSubmitting = true;
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/dungeons/${dungeonId}/enter`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (!json.success) {
          throw new Error(translateError(json.error, 'Không thể mở phó bản.'));
        }

        const run = json.data;
        this.notify('⚔️ Khởi động bí cảnh thành công! Đang tiến nhập...', 'success');
        this.closePartyModal();
        this.openDungeonCombat(run.id);
      } catch (err) {
        alert(err.message || 'Lỗi tiến nhập phó bản.');
      } finally {
        this.dungeonSubmitting = false;
      }
    };

    /**
     * Mở Màn Hình Chiến Đấu Bí Cảnh Realtime
     */
    TienLoEngine.prototype.openDungeonCombat = async function (runId) {
      this.activeDungeonRunId = runId;
      this.dungeonClaimedRewards = false;

      const screen = document.getElementById('dungeon-combat-screen');
      if (screen) screen.style.display = 'flex';

      // Gia nhập socket room
      if (this.dungeonSocket && this.dungeonConnected) {
        this.dungeonSocket.emit('dungeon:join', { runId });
      }

      // Lấy Authoritative Snapshot ban đầu qua REST API
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/dungeons/run/${runId}`, {
          headers: this.getAuthHeaders(),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.applyAuthoritativeSnapshot(json.data);
        }
      } catch (e) {
        console.error('Lỗi khi lấy snapshot phó bản ban đầu:', e);
      }

      this.renderDungeonCombatUI();
    };

    /**
     * Đóng Màn Hình Chiến Đấu Bí Cảnh
     */
    TienLoEngine.prototype.closeDungeonCombat = function () {
      const screen = document.getElementById('dungeon-combat-screen');
      if (screen) screen.style.display = 'none';

      // Rời socket room
      if (this.activeDungeonRunId && this.dungeonSocket && this.dungeonConnected) {
        this.dungeonSocket.emit('dungeon:leave', { runId: this.activeDungeonRunId });
      }
    };

    /**
     * Đồng bộ Authoritative Snapshot từ Server
     */
    TienLoEngine.prototype.applyAuthoritativeSnapshot = function (snapshot) {
      if (!snapshot) return;

      // Kiểm tra tính thứ tự của Version để tránh bị sự kiện cũ ghi đè
      const newVer = snapshot.version || 0;
      if (newVer < (this.dungeonLastReceivedVersion || 0) && snapshot.status === 'IN_PROGRESS') {
        console.warn(`[Snapshot] Bỏ qua snapshot cũ v${newVer} do client đã ở v${this.dungeonLastReceivedVersion}`);
        return;
      }

      this.activeDungeonRun = snapshot;
      this.dungeonLastReceivedVersion = newVer;
      this.renderDungeonCombatUI();
    };

    /**
     * Cập nhật Hiệp Đấu Sau Khi Server Commit Transaction
     */
    TienLoEngine.prototype.applyTurnResolution = function (turnData) {
      if (!this.activeDungeonRun) return;

      const newVer = turnData.version || 0;
      if (newVer <= (this.dungeonLastReceivedVersion || 0)) {
        return;
      }

      this.activeDungeonRun.version = newVer;
      this.activeDungeonRun.turnsCount = turnData.turnsCount;
      this.activeDungeonRun.currentWave = turnData.currentWave;
      this.activeDungeonRun.totalWaves = turnData.totalWaves;
      this.activeDungeonRun.status = turnData.status;

      if (turnData.combatState) {
        this.activeDungeonRun.combatState = turnData.combatState;
      }
      if (turnData.combatLog) {
        this.activeDungeonRun.combatLog = turnData.combatLog;
      }

      this.dungeonLastReceivedVersion = newVer;
      this.renderDungeonCombatUI();
    };

    /**
     * Thực thi Hiệp Đấu Server-Authoritative (Xuất Chiêu)
     */
    TienLoEngine.prototype.executeDungeonCombatStep = async function () {
      if (!this.activeDungeonRun || this.activeDungeonRun.status !== 'IN_PROGRESS') {
        return;
      }

      // Rate limit 500ms phía Client
      const now = Date.now();
      if (now < (this.dungeonCombatCooldownUntil || 0)) {
        this.notify('Chiêu thức đang trong thời gian hồi...', 'info');
        return;
      }
      this.dungeonCombatCooldownUntil = now + 500;

      const runId = this.activeDungeonRun.id;
      const expectedVersion = this.activeDungeonRun.version;

      // Khóa nút tạm thời
      const btn = document.getElementById('btn-dungeon-combat-strike');
      if (btn) btn.disabled = true;

      if (this.dungeonSocket && this.dungeonConnected) {
        this.dungeonSocket.emit('dungeon:combat_step', { runId, expectedVersion }, (res) => {
          if (btn) btn.disabled = false;
          if (res && !res.success) {
            const err = res.error;
            if (err?.code === 'DUNGEON_VERSION_MISMATCH') {
              this.reconnectDungeonRun(runId);
            }
          }
        });
      } else {
        // Fallback REST API
        try {
          const res = await fetch(`${this.apiBase}/api/xianxia/dungeons/run/${runId}/combat-step`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify({ expectedVersion }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            this.applyAuthoritativeSnapshot(json.data);
          } else if (res.status === 409) {
            this.reconnectDungeonRun(runId);
          }
        } catch (e) {
          console.error('Lỗi khi gửi combat step qua REST:', e);
        } finally {
          if (btn) btn.disabled = false;
        }
      }
    };

    /**
     * Nhận Thưởng Bí Cảnh Toàn Thắng (Bảo vệ Kép Idempotency)
     */
    TienLoEngine.prototype.claimDungeonRewardSubmit = async function () {
      if (!this.activeDungeonRun || this.activeDungeonRun.status !== 'COMPLETED') {
        alert('Chưa hoàn tất bí cảnh, không thể nhận thưởng.');
        return;
      }

      if (this.dungeonClaimedRewards) {
        alert('Đạo hữu đã nhận thưởng bí cảnh này rồi.');
        return;
      }

      const runId = this.activeDungeonRun.id;
      const idempotencyKey = `dungeon_claim_${runId}_${this.player.id || 1}_${Date.now()}`;

      this.dungeonSubmitting = true;
      const btn = document.getElementById('btn-claim-dungeon-reward');
      if (btn) btn.disabled = true;

      if (this.dungeonSocket && this.dungeonConnected) {
        this.dungeonSocket.emit('dungeon:claim_reward', { runId, idempotencyKey }, (res) => {
          this.dungeonSubmitting = false;
          if (res && res.success) {
            this.dungeonClaimedRewards = true;
            this.showRewardBreakdownModal(res.data);
            this.renderDungeonCombatUI();
            this.syncRemoteCharacterIfLoggedIn();
          } else {
            if (btn) btn.disabled = false;
            alert(translateError(res?.error?.code, 'Không thể nhận thưởng.'));
          }
        });
      } else {
        // Fallback REST API
        try {
          const res = await fetch(`${this.apiBase}/api/xianxia/dungeons/run/${runId}/claim-reward`, {
            method: 'POST',
            headers: {
              ...this.getAuthHeaders(),
              'x-idempotency-key': idempotencyKey,
            },
          });
          const json = await res.json();
          if (json.success && json.data) {
            this.dungeonClaimedRewards = true;
            this.showRewardBreakdownModal(json.data);
            this.renderDungeonCombatUI();
            this.syncRemoteCharacterIfLoggedIn();
          } else {
            throw new Error(translateError(json.error));
          }
        } catch (err) {
          if (btn) btn.disabled = false;
          alert(err.message || 'Lỗi nhận thưởng.');
        } finally {
          this.dungeonSubmitting = false;
        }
      }
    };

    /**
     * Vẽ Giao Diện Chiến Đấu Phó Bản Realtime
     */
    TienLoEngine.prototype.renderDungeonCombatUI = function () {
      const container = document.getElementById('dungeon-combat-body');
      if (!container || !this.activeDungeonRun) return;

      const run = this.activeDungeonRun;
      const combatState = run.combatState || {};
      const monsters = Array.isArray(combatState.monsters) ? combatState.monsters : [];
      const currentMonster = monsters[0] || null;
      const members = Array.isArray(run.members) ? run.members : (combatState.players || []);

      // 1. Quái vật / Boss ở vị trí trung tâm
      let monsterHtml = '';
      if (currentMonster) {
        const hp = Math.max(0, currentMonster.current_hp ?? currentMonster.hp ?? 0);
        const maxHp = currentMonster.max_hp ?? currentMonster.maxHp ?? 100;
        const hpPct = Math.min(100, Math.floor((hp / maxHp) * 100));
        const isBoss = currentMonster.is_boss || run.currentWave === run.totalWaves;

        monsterHtml = `
          <div style="background: rgba(18, 22, 32, 0.85); border: 1px solid ${isBoss ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.3)'}; border-radius: var(--radius-md); padding: 18px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div style="width: 80px; height: 80px; border-radius: var(--radius-md); background: rgba(0,0,0,0.5); border: 2px solid ${isBoss ? '#ef4444' : '#f59e0b'}; display: flex; align-items: center; justify-content: center; font-size: 2.8rem; box-shadow: 0 0 18px ${isBoss ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.2)'};">
              ${isBoss ? '🐺' : '🐾'}
            </div>
            
            <div style="font-family: var(--font-serif); font-size: 1.15rem; font-weight: 700; color: ${isBoss ? '#fca5a5' : '#fef08a'};">
              ${currentMonster.name} ${isBoss ? '<span style="color: #ef4444; font-size: 0.75rem;">[BOSS]</span>' : ''}
            </div>

            <!-- Thanh HP Yêu Thú -->
            <div style="width: 100%; max-width: 380px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #cbd5e1; margin-bottom: 3px;">
                <span>Khí Huyết Yêu Ma</span>
                <span>${hp} / ${maxHp} (${hpPct}%)</span>
              </div>
              <div style="height: 10px; background: rgba(0,0,0,0.5); border-radius: 999px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                <div style="width: ${hpPct}%; height: 100%; background: linear-gradient(90deg, #ef4444, #f97316); transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>
        `;
      } else {
        monsterHtml = `
          <div style="background: rgba(18, 22, 32, 0.6); border-radius: var(--radius-md); padding: 24px; text-align: center; color: #6ee7b7;">
            🎉 Yêu thú đợt này đã bị quét sạch! Đang chờ lượt tiếp theo...
          </div>
        `;
      }

      // 2. Danh sách đồng đội tham chiến
      let membersHtml = members.map(m => {
        const char = m.character || m;
        const hp = Math.max(0, m.current_hp ?? m.hp ?? char.health ?? 0);
        const maxHp = m.max_hp ?? m.maxHp ?? char.max_health ?? 100;
        const hpPct = Math.min(100, Math.floor((hp / maxHp) * 100));
        const isMe = char.id === this.player.id;

        return `
          <div style="background: rgba(18, 24, 38, 0.85); border: 1px solid ${isMe ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: var(--radius-sm); padding: 10px 14px; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
              <strong style="color: ${isMe ? '#a7f3d0' : '#fff'};">${char.name} ${isMe ? '(Ta)' : ''}</strong>
              <span style="font-size: 0.72rem; color: ${m.is_alive !== false ? '#34d399' : '#ef4444'};">
                ${m.is_alive !== false ? 'Chiến Đấu' : 'Tử Trận'}
              </span>
            </div>
            <div style="height: 6px; background: rgba(0,0,0,0.5); border-radius: 999px; overflow: hidden;">
              <div style="width: ${hpPct}%; height: 100%; background: ${hpPct > 30 ? '#10b981' : '#ef4444'}; transition: width 0.3s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.68rem; color: var(--color-text-dim);">
              <span>HP: ${hp}/${maxHp}</span>
              <span>Sát thương: ${m.damage_dealt || 0}</span>
            </div>
          </div>
        `;
      }).join('');

      // 3. Khung Nhật Ký Chiến Báo Realtime
      const logs = Array.isArray(run.combatLog) ? run.combatLog : [];
      let logsHtml = logs.slice(-15).map(log => {
        const text = typeof log === 'string' ? log : (log.message || log.text || JSON.stringify(log));
        let color = '#cbd5e1';
        if (text.includes('sát thương') || text.includes('trảm')) color = '#a7f3d0';
        else if (text.includes('phản kích') || text.includes('tổn thất') || text.includes('trọng thương')) color = '#fca5a5';
        else if (text.includes('Wave') || text.includes('Đợt')) color = '#fef08a';
        return `<div style="font-size: 0.75rem; color: ${color}; line-height: 1.4; padding: 2px 0;">${text}</div>`;
      }).join('');

      // 4. Khối Kết Quả / Nhận Thưởng khi kết thúc
      let resultOverlay = '';
      if (run.status === 'COMPLETED') {
        resultOverlay = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.5); border-radius: var(--radius-md); padding: 18px; text-align: center; margin-bottom: 12px;">
            <div style="font-size: 2rem;">🏆</div>
            <h3 style="font-family: var(--font-serif); color: #fef08a; font-size: 1.25rem; margin: 4px 0;">BÍ CẢNH TOÀN THẮNG!</h3>
            <p style="font-size: 0.8rem; color: #a7f3d0; margin-bottom: 12px;">
              Toàn bộ yêu lang trong U Minh Cổ Động đã bị trảm trừ! Tổng hiệp đấu: ${run.turnsCount || run.turns_count || 1}.
            </p>
            <button 
              id="btn-claim-dungeon-reward" 
              class="btn-primary-glow" 
              style="padding: 9px 24px; font-size: 0.9rem;"
              ${this.dungeonClaimedRewards ? 'disabled style="opacity: 0.5;"' : ''}
              onclick="window.engine.claimDungeonRewardSubmit()"
            >
              ${this.dungeonClaimedRewards ? '✔ Đã Nhận Thưởng' : '🎁 Nhận Thưởng Bí Cảnh'}
            </button>
          </div>
        `;
      } else if (run.status === 'FAILED') {
        resultOverlay = `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.5); border-radius: var(--radius-md); padding: 16px; text-align: center; margin-bottom: 12px;">
            <div style="font-size: 2rem;">💀</div>
            <h3 style="font-family: var(--font-serif); color: #fca5a5; font-size: 1.15rem; margin: 4px 0;">BÍ CẢNH THẤT BẠI!</h3>
            <p style="font-size: 0.8rem; color: #f87171;">Toàn bộ đạo hữu đã trọng thương kiệt sức. Hãy tu luyện nâng cao cảnh giới và thử lại sau.</p>
          </div>
        `;
      }

      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          <!-- HUD Header -->
          <div style="background: rgba(18, 24, 38, 0.9); border: 1px solid var(--border-medium); border-radius: var(--radius-md); padding: 10px 16px; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.2rem;">🏰</span>
              <div>
                <strong style="color: #fef08a; font-size: 0.95rem;">U Minh Cổ Động</strong>
                <div style="font-size: 0.72rem; color: var(--color-text-dim);">
                  Đợt: <strong style="color: #6ee7b7;">${run.currentWave || 1}/${run.totalWaves || 3}</strong> • Phiên bản: #v${run.version || 1}
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 0.75rem;">
                <span class="chat-status-dot ${this.dungeonConnected ? 'status-online' : 'status-offline'}"></span>
                <span style="color: var(--color-text-muted);">${this.dungeonConnected ? 'Realtime' : 'Mất kết nối'}</span>
              </div>
              <button class="btn-wuxia-link" style="padding: 4px 8px; font-size: 0.75rem;" onclick="window.engine.reconnectDungeonRun('${run.id}')">
                🔄 Đồng Bộ
              </button>
            </div>
          </div>

          ${resultOverlay}

          <!-- Khu Vực Trung Tâm Quái Vật -->
          ${monsterHtml}

          <!-- Đội Hình Đồng Đội -->
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
            ${membersHtml}
          </div>

          <!-- Khung Chiến Báo Realtime -->
          <div style="background: rgba(11, 14, 20, 0.9); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px 14px; max-height: 140px; overflow-y: auto;">
            <div style="font-size: 0.7rem; color: var(--color-text-dim); margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 2px;">
              📜 NHẬT KÝ CHIẾN BÁO PHÓ BẢN
            </div>
            ${logsHtml.length > 0 ? logsHtml : '<div style="color: var(--color-text-dim); font-size: 0.75rem; font-style: italic;">Chưa có diễn biến chiến đấu mới...</div>'}
          </div>

          <!-- Thanh Thao Tác Chiến Đấu -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
            <button class="btn-wuxia-link" style="padding: 8px 16px; font-size: 0.8rem;" onclick="window.engine.closeDungeonCombat()">
              ← Rời Phòng
            </button>

            ${run.status === 'IN_PROGRESS' ? `
              <button 
                id="btn-dungeon-combat-strike" 
                class="btn-primary-glow" 
                style="padding: 8px 24px; font-size: 0.9rem;" 
                onclick="window.engine.executeDungeonCombatStep()"
              >
                ⚔️ Xuất Chiêu Trảm Yêu
              </button>
            ` : ''}
          </div>
        </div>
      `;
    };

    /**
     * Thêm dòng log vào nhật ký chiến đấu
     */
    TienLoEngine.prototype.appendDungeonCombatLog = function (msg, type) {
      if (this.activeDungeonRun) {
        if (!Array.isArray(this.activeDungeonRun.combatLog)) {
          this.activeDungeonRun.combatLog = [];
        }
        this.activeDungeonRun.combatLog.push(msg);
        this.renderDungeonCombatUI();
      }
    };

    /**
     * Hiển thị Modal Chi Tiết Phần Thưởng Nhận Được
     */
    TienLoEngine.prototype.showRewardBreakdownModal = function (rewardData) {
      const exp = rewardData.exp_reward || rewardData.exp || 0;
      const cult = rewardData.cultivation_reward || rewardData.cultivation || 0;
      const silver = rewardData.silver_reward || rewardData.silver || 0;
      let itemsStr = rewardData.items_reward || rewardData.items || '';
      if (typeof itemsStr === 'object') itemsStr = JSON.stringify(itemsStr);

      alert(`🎁 THU HOẠCH BÍ CẢNH:\n\n• Tu Vi: +${cult}\n• Kinh Nghiệm: +${exp} EXP\n• Bạc: +${silver} 🪙\n• Vật phẩm: ${itemsStr || 'Linh Thảo, Yêu Đan'}`);
    };

    // ====================================================
    // 4. GATE D4 — RECONNECT & RESILIENCE
    // ====================================================

    /**
     * Đồng bộ kết nối lại phiên phó bản (dungeon:reconnect)
     */
    TienLoEngine.prototype.reconnectDungeonRun = async function (runId) {
      if (!runId) return;

      this.notify('🔄 Đang đồng bộ lại trạng thái bí cảnh...', 'info');

      if (this.dungeonSocket && this.dungeonConnected) {
        this.dungeonSocket.emit('dungeon:reconnect', { runId }, (res) => {
          if (res && res.success && res.data) {
            this.applyAuthoritativeSnapshot(res.data);
            this.notify('✔ Đã phục hồi thần thức đồng bộ thành công!', 'success');
          }
        });
      } else {
        // Fallback REST API
        try {
          const res = await fetch(`${this.apiBase}/api/xianxia/dungeons/run/${runId}/reconnect`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
          });
          const json = await res.json();
          if (json.success && json.data) {
            this.applyAuthoritativeSnapshot(json.data);
            this.notify('✔ Đã phục hồi trạng thái bí cảnh qua máy chủ!', 'success');
          }
        } catch (e) {
          console.error('Lỗi khi reconnect:', e);
        }
      }
    };

  }
})();
