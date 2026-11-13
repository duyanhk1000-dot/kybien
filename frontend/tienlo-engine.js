/**
 * TIÊN LỘ: VẠN GIỚI TRANH PHONG - ENGINE ĐIỀU HÀNH THẾ GIỚI TU TIÊN (OFFLINE-FIRST HYBRID CLIENT)
 * Phiên bản hoàn chỉnh: 
 * - Bước 0: Vá exploit đả tọa (cooldown 30s, chi phí bạc, bỏ cộng tu vi), đột phá chủ động mở rộng Kim Đan, không ảnh vỡ.
 * - Bước 1: Offline-First Data Loader (chạy độc lập 0ms latency từ ./data/xianxia/, tự động fallback backend API).
 * - Bước 2: Turn-Based Combat (Quái báo trước ý định Intent ATTACK/HEAVY/CHARGE; 4 lựa chọn STRIKE/SKILL/GUARD/FLEE).
 * - Bước 3: Tiến trình nhân vật sâu (Tạo nhân vật Linh Căn & Xuất Thân; +4 Điểm tiềm năng mỗi đột phá; Tu luyện treo máy Idle; 3 ô trang bị Vũ Khí/Pháp Y/Pháp Bảo).
 * - Bước 4: Tiệm Dược & Bách Hóa giao thương mua bán bằng Bạc.
 * - Bước 5: Gộp 4 Tab Cốt Lõi (Hành Động, Nhiệm Vụ, Sinh Hoạt, Nhân Vật) + Widget "Thiên Cơ Chỉ Dẫn".
 */

class TienLoEngine {
  constructor() {
    this.apiBase = window.location.origin;

    // Trạng thái nhân vật
    this.player = this.loadPlayerState();

    // Dữ liệu thế giới nạp bộ nhớ đệm
    this.worldData = {
      zones: [],
      currentZone: null,
      currentPlace: null,
    };
    this.npcs = [];
    this.monsters = [];
    this.events = [];
    this.items = new Map();
    this.recipes = [];
    this.gatheringNodes = [];
    this.quests = [];
    this.agencyData = null;

    // Trạng thái sự kiện kỳ ngộ đang diễn ra
    this.activeEventData = null;

    // Bộ điều khiển hiệu ứng chữ hiện dần (Progressive Narrative Streamer)
    this.streamTimer = null;
    this.pendingLines = [];
    this.onStreamFinishCallback = null;

    // Trạng thái chiến đấu theo lượt (Turn-Based Battle)
    this.battle = null;

    // Trạng thái tạo nhân vật tạm thời
    this.charCreationDraft = {
      dao_lo: 'TIEN_DAO',
      linh_can: 'THIEN_LINH_CAN',
      origin: 'TAN_TU_GIA',
    };

    // Đan dược đang chọn hỗ trợ đột phá
    this.selectedBreakthroughPillId = null;

    // Tab Cửa hàng đang chọn (buy | sell)
    this.shopTab = 'buy';

    // Tab đang chọn (4 Tab cốt lõi: 'action' | 'quest' | 'life' | 'character')
    this.activeMainTab = 'action';
    this.bestiarySelectedZoneId = null;

    // Phân hệ Bảng Xếp Hạng (M4.1 Leaderboard)
    this.leaderboardPage = 1;
    this.leaderboardLimit = 10;
    this.leaderboardData = null;

    // Phân hệ Đấu Trường Thiên Kiêu (M4.2 Asynchronous PvP)
    this.pvpActiveTab = 'opponents';
    this.pvpOpponents = [];
    this.pvpHistory = [];
    this.pvpLeaderboard = [];
    this.pvpLoading = false;

    // Phân hệ Truyền Âm Các (M4.3.1 Realtime Chat Thế Giới & Khu Vực & Tông Môn)
    this.chatSocket = null;
    this.chatConnected = false;
    this.chatConnecting = false;
    this.chatActiveChannel = 'WORLD'; // 'WORLD' | 'ZONE' | 'GUILD'
    this.chatWorldMessages = [];
    this.chatZoneMessages = [];
    this.chatGuildMessages = [];
    this.chatWindowOpen = false;
    this.chatUnreadCount = 0;
    this.chatCooldownUntil = 0;
    this.chatCooldownTimer = null;
    this.playerGuildId = null;
    this.playerGuildName = null;

    // Phân hệ Tông Môn (M4.3.2 Guild / Sect System)
    this.guildModalOpen = false;
    this.myGuildData = null;
    this.guildsList = [];
    this.guildsPage = 1;
    this.guildsLimit = 10;
    this.guildsTotal = 0;
    this.guildsSearch = '';
    this.guildActiveTab = 'my_guild';
    this.guildLoading = false;
    this.guildSubmitting = false;
    this.guildApplications = [];

    // Phân hệ Tổ Đội & Bí Cảnh Realtime (M4.3.3D Co-op System)
    this.dungeonSocket = null;
    this.dungeonConnected = false;
    this.dungeonConnecting = false;
    this.myPartyData = null;
    this.partyInvites = [];
    this.partyModalOpen = false;
    this.partyActiveTab = 'my_party';
    this.dungeonsList = [];
    this.dungeonLoading = false;
    this.dungeonSubmitting = false;
    this.activeDungeonRun = null;
    this.activeDungeonRunId = null;
    this.dungeonClaimedRewards = false;
    this.dungeonCombatCooldownUntil = 0;
    this.dungeonLastReceivedVersion = 0;
  }

  // ====================================================
  // 1. VIỆT HÓA & TIỆN ÍCH DỮ LIỆU TU CHÂN
  // ====================================================
  getRealmName(realm) {
    const realmMap = {
      PHAM_NHAN: 'Phàm Nhân',
      LUYEN_KHI_1: 'Luyện Khí Tầng 1',
      LUYEN_KHI_2: 'Luyện Khí Tầng 2',
      LUYEN_KHI_3: 'Luyện Khí Tầng 3',
      LUYEN_KHI_4: 'Luyện Khí Tầng 4',
      LUYEN_KHI_5: 'Luyện Khí Tầng 5',
      LUYEN_KHI_6: 'Luyện Khí Tầng 6',
      LUYEN_KHI_7: 'Luyện Khí Tầng 7',
      LUYEN_KHI_8: 'Luyện Khí Tầng 8',
      LUYEN_KHI_9: 'Luyện Khí Tầng 9',
      TRUC_CO_SO_KY: 'Trúc Cơ Sơ Kỳ',
      TRUC_CO_TRUNG_KY: 'Trúc Cơ Trung Kỳ',
      TRUC_CO_HAU_KY: 'Trúc Cơ Hậu Kỳ',
      TRUC_CO_DINH_PHONG: 'Trúc Cơ Đỉnh Phong',
      KIM_DAN_SO_KY: 'Kim Đan Sơ Kỳ (Chân Nhân)',
    };
    return realmMap[realm] || realm || 'Phàm Nhân';
  }

  getMissionKindName(kind) {
    const kindMap = {
      ESCORT: 'Áp Tiêu (Hộ Tống)',
      COURIER: 'Phi Tiêu (Hỏa Tốc)',
      HUNT: 'Thảo Phạt Dị Thú',
      GATHERING: 'Quân Nhu Tiếp Tế',
      EVENT: 'Điều Tra Kỳ Ngộ',
    };
    return kindMap[kind] || kind;
  }

  getRankName(rankKey) {
    const rankMap = {
      TAP_DICH: 'Tạp Dịch Tiêu Sinh',
      SO_CAP: 'Sơ Cấp Tiêu Sư',
      TRUNG_CAP: 'Trung Cấp Tiêu Sư',
      CAO_CAP: 'Cao Cấp Tiêu Đầu',
      TONG_TIEU_DAU: 'Tổng Tiêu Đầu Thần Uy',
    };
    return rankMap[rankKey] || rankKey;
  }

  getItemTypeName(type) {
    const typeMap = {
      PILL: 'Đan Dược',
      HERB: 'Linh Thảo',
      ORE: 'Khoáng Thạch',
      EQUIPMENT: 'Trang Bị',
      MATERIAL: 'Tài Nguyên',
      TALISMAN: 'Phù Lục',
      BAG: 'Trữ Vật Đại',
      SPECIAL: 'Kỳ Vật',
      MISC: 'Tạp Vật',
    };
    return typeMap[type] || type || 'Bảo Vật';
  }

  getMonsterTierName(tier) {
    const tierMap = {
      TIER_1_BEAST: 'Dã Thú',
      TIER_2_ELITE: '⭐ Tinh Anh',
      TIER_3_BOSS: '👑 Yêu Vương',
    };
    return tierMap[tier] || tier || 'Dị Thú';
  }

  getLinhCanName(linhCan) {
    const map = {
      THIEN_LINH_CAN: '🌟 Thiên Linh Căn (Thuần Dương)',
      NGU_HANH: '💎 Ngũ Hành Tạp Linh Căn',
      DI_LINH_CAN: '⚡ Dị Linh Căn (Phong Lôi)',
      KIEM_COT: '🗡️ Tiên Thiên Kiếm Cốt',
      CUU_U_MA_CAN: '🩸 Cửu U Ma Linh Căn (Ma Tu)',
      AM_DUONG_HON_THE: '☯️ Âm Dương Hỗn Thể (Tiên Ma Song Tu)',
    };
    return map[linhCan] || 'Ngũ Hành Linh Căn';
  }

  getOriginName(origin) {
    const map = {
      TAN_TU_GIA: '🏰 Tán Tu Thế Gia',
      THAO_DUOC_DONG: '🌿 Dược Đồng Hái Thuốc',
      THO_SAN_RUNG: '🏹 Thợ Săn Rừng Sâu',
      CO_TICH_MON: '📜 Thư Đồng Cố Nhân',
      HUYET_MA_DI_TOC: '💀 Cổ Ma Di Tộc (Ma Tu)',
    };
    return map[origin] || 'Bình Dân Phàm Tục';
  }

  getDaoLoName(daoLo) {
    const map = {
      TIEN_DAO: '🕊️ Tiên Đạo (Chính Phái)',
      MA_DAO: '🩸 Ma Đạo (Ma Tu)',
      TIEU_DAO: '☯️ Tiêu Dao (Tán Tu)',
    };
    return map[daoLo] || '☯️ Tiêu Dao (Tán Tu)';
  }

  // ====================================================
  // 2. QUẢN LÝ TRẠNG THÁI NGƯỜI CHƠI (LOCAL PERSISTENCE)
  // ====================================================
  getDefaultPlayer() {
    return {
      character_created: false,
      name: 'Vô Danh Tu Sĩ',
      title: 'Tán Tu Sơ Nhập Đạo',
      dao_lo: 'TIEN_DAO',
      realm: 'PHAM_NHAN',
      linh_can: 'THIEN_LINH_CAN',
      origin: 'TAN_TU_GIA',
      level: 1,
      exp: 0,
      exp_required: 100,
      health: 120,
      max_health: 120,
      fatigue: 100,
      max_fatigue: 100,
      cultivation: 0,
      cultivation_required: 120,
      stat_points: 0,
      physique: 12,       // Căn cốt / Thể chất
      comprehension: 14,  // Ngộ tính
      luck: 12,           // Khí vận / Cơ duyên
      karma: 0,           // Đạo tâm (-100 Ma đạo -> +100 Tiên đạo)
      silver: 150,        // Bạc
      equipment: {
        weapon: null,     // Slot vũ khí
        armor: null,      // Slot áo giáp
        relic: null,      // Slot pháp bảo / ngọc bội
      },
      idle_cultivation_bank: 0,
      last_idle_tick: Date.now(),
      last_meditate: 0,
      zone_id: 'zone_thanh_ha_thon',
      place_id: 'place_dong_phu_tan_tu',
      inventory: [
        { item_id: 'item_hoi_xuan_dan', quantity: 3 },
        { item_id: 'item_thao_moc_linh_chi', quantity: 5 },
      ],
      quest_progress: {},
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          text: 'Ngươi từ một phàm nhân bình dị bắt đầu bước chân vào con đường tu tiên vấn đạo!',
          type: 'info',
        },
      ],
    };
  }

  calcExpRequired(level) {
    const lvl = Math.max(1, Math.floor(level || 1));
    return Math.floor(50 * Math.pow(lvl, 1.45) + 50 * lvl);
  }

  addExp(amount) {
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return;
    if (!this.player.level) this.player.level = 1;
    if (!this.player.exp_required) this.player.exp_required = this.calcExpRequired(this.player.level);

    // Xử lý khi đạt cấp tối đa 100: không tăng cấp vượt trần, chuyển EXP dư thành Bạc 10:1
    if (this.player.level >= 100) {
      this.player.level = 100;
      this.player.exp = this.player.exp_required;
      const silverBonus = Math.floor(amount / 10);
      if (silverBonus > 0) {
        this.player.silver = (this.player.silver || 0) + silverBonus;
        this.log(`[Đỉnh Phong Chuyển Hóa] Đạt trần Cấp 100, +${amount} EXP chuyển hóa thành +${silverBonus} Bạc!`, 'info');
      }
      this.savePlayerState();
      this.renderPlayerStats();
      return;
    }

    this.player.exp = (this.player.exp || 0) + amount;
    this.log(`Nhận được +${amount} Kinh Nghiệm Thể Phách (EXP).`, 'info');

    let leveledUp = false;
    let levelsGained = 0;

    // Vòng lặp thăng cấp hỗ trợ nhảy nhiều cấp một lần, bảo toàn chính xác EXP dư
    while (this.player.level < 100 && this.player.exp >= this.player.exp_required) {
      this.player.exp -= this.player.exp_required;
      this.player.level += 1;
      levelsGained += 1;
      leveledUp = true;

      // 1. Tăng +4 HP tối đa mỗi cấp
      this.player.max_health = (this.player.max_health || 120) + 4;
      this.player.health = this.player.max_health;

      // 2. Tăng +1 Thể Lực tối đa mỗi 2 cấp
      if (this.player.level % 2 === 0) {
        this.player.max_fatigue = (this.player.max_fatigue || 100) + 1;
      }
      // Hồi đầy Thể Lực khi lên cấp (đã được Chủ Dự Án phê duyệt)
      this.player.fatigue = this.player.max_fatigue;

      // 3. Tăng +1 Điểm Tiềm Năng mỗi 10 cấp
      if (this.player.level % 10 === 0) {
        this.player.stat_points = (this.player.stat_points || 0) + 1;
        this.log(`🌟 [THỂ PHÁCH ĐỘT PHÁ] Đạt Cột Mốc Cấp ${this.player.level}! Thưởng +1 Điểm Tiềm Năng!`, 'success');
      }

      this.player.exp_required = this.calcExpRequired(this.player.level);
      this.log(`✨ [THĂNG CẤP THỂ PHÁCH] Chúc mừng thăng lên Cấp ${this.player.level}! Max HP +4, Thể Lực hồi đầy!`, 'success');
    }

    // Xử lý tràn trần nếu chạm trần Level 100 sau chuỗi level up
    if (this.player.level >= 100) {
      this.player.level = 100;
      if (this.player.exp > 0) {
        const overflow = this.player.exp;
        const silverBonus = Math.floor(overflow / 10);
        if (silverBonus > 0) {
          this.player.silver = (this.player.silver || 0) + silverBonus;
          this.log(`[Đỉnh Phong Chuyển Hóa] Đạt trần Cấp 100, +${overflow} EXP dư chuyển hóa thành +${silverBonus} Bạc!`, 'info');
        }
      }
      this.player.exp = this.player.exp_required;
    }

    if (leveledUp) {
      this.notify(`Chúc mừng thăng cấp lên Cấp ${this.player.level}! (+${levelsGained} Cấp)`, 'success');
    }

    this.savePlayerState();
    this.renderPlayerStats();
    this.updateSmartGuide();
  }

  loadPlayerState() {
    try {
      const saved = localStorage.getItem('tien_lo_player_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        const player = Object.assign(this.getDefaultPlayer(), parsed);
        if (typeof player.level !== 'number' || player.level < 1) player.level = 1;
        if (typeof player.exp !== 'number' || player.exp < 0) player.exp = 0;
        player.exp_required = this.calcExpRequired(player.level);
        if (!player.equipment) player.equipment = { weapon: null, armor: null, relic: null };
        if (typeof player.stat_points !== 'number') player.stat_points = 0;
        if (typeof player.idle_cultivation_bank !== 'number') player.idle_cultivation_bank = 0;
        if (!player.last_idle_tick) player.last_idle_tick = Date.now();
        if (!player.quest_progress) player.quest_progress = {};
        return player;
      }
    } catch (e) {
      console.warn('Lỗi khi đọc trạng thái người chơi từ localStorage:', e);
    }
    return this.getDefaultPlayer();
  }

  savePlayerState() {
    try {
      localStorage.setItem('tien_lo_player_v2', JSON.stringify(this.player));
    } catch (e) {
      console.warn('Lỗi khi lưu người chơi:', e);
    }
  }

  resetPlayer() {
    if (confirm('Bạn có chắc muốn chuyển thế trùng sinh (xóa hết tiến trình và bắt đầu lại từ đầu)?')) {
      localStorage.removeItem('tien_lo_player_v2');
      this.player = this.getDefaultPlayer();
      this.savePlayerState();
      this.openCharacterCreationModal();
      this.renderAll();
      this.notify('Chuyển thế trùng sinh thành công! Bắt đầu lại tiên lộ.', 'info');
    }
  }

  getAuthToken() {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('tienlo_token') || localStorage.getItem('tienlo_jwt_token') || localStorage.getItem('kybien_jwt_token') || localStorage.getItem('token') || null;
  }

  // ====================================================
  // 3. KHỞI TẠO & NẠP DỮ LIỆU OFFLINE-FIRST (0MS LATENCY)
  // ====================================================
  async init() {
    try {
      this.log('Đang kết nối thần thức với Thiên Đạo thế giới Tiên Lộ...', 'info');

      // Tải song song tất cả các dữ liệu từ ./data/xianxia/ với fallback API
      await Promise.all([
        this.fetchWorldData(),
        this.fetchItems(),
        this.fetchRecipes(),
        this.fetchGatheringNodes(),
        this.fetchBestiary(),
        this.fetchQuests(),
        this.fetchAgencyData(),
        this.fetchEvents(),
      ]);

      // Đồng bộ phân khu hiện tại
      this.syncCurrentLocation();

      // Đồng bộ dữ liệu nhân vật từ máy chủ nếu đã đăng nhập Tiên Lộ
      await this.syncRemoteCharacterIfLoggedIn();

      // Kiểm tra tạo nhân vật lần đầu
      if (!this.player.character_created) {
        this.openCharacterCreationModal();
      }

      // Khởi động chu kỳ tu luyện treo máy
      this.startIdleCultivationLoop();

      // Vẽ giao diện
      this.renderAll();

      // Khởi động kết nối Truyền Âm Các (M4.3.1 Chat Realtime)
      this.initChatSocket();

      // Khởi động kết nối Tổ Đội & Bí Cảnh Realtime (M4.3.3D Socket Realtime)
      if (typeof this.initDungeonSocket === 'function') {
        this.initDungeonSocket();
      }

      this.log('Thiên Đạo quy nhất! Chúc Đạo Hữu sớm ngày ngưng kết Kim Đan, chứng đắc trường sinh!', 'success');
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu ban đầu:', err);
      this.notify('Khởi tạo giao diện Tiên Lộ: ' + err.message, 'warning');
      this.renderAll();
    }
  }

  async syncRemoteCharacterIfLoggedIn() {
    const token = this.getAuthToken();
    if (!token) return;
    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/character/me`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.syncWithBackendDetails(json.data);
          this.player.character_created = true;
          this.log('Đồng bộ dữ liệu tiên gia từ máy chủ thành công!', 'info');
        }
      }

      // Đồng bộ tiến độ nhiệm vụ từ máy chủ
      const questRes = await fetch(`${this.apiBase}/api/xianxia/gameplay/quests`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (questRes.ok) {
        const qJson = await questRes.json();
        if (qJson.success && Array.isArray(qJson.data)) {
          for (const q of qJson.data) {
            this.player.quest_progress[q.id] = {
              status: q.status,
              progress: q.current_objectives || {},
            };
          }
          this.renderAll();
        }
      }
    } catch (e) {
      // Offline fallback
    }
  }

  syncWithBackendDetails(details) {
    if (!details?.character) return;
    const c = details.character;
    this.player.id = c.id;
    this.player.user_id = c.user_id;
    this.player.name = c.name;
    this.player.title = c.title;
    this.player.realm = c.realm;
    this.player.linh_can = c.linh_can;
    this.player.origin = c.origin;
    this.player.level = c.level;
    this.player.exp = c.exp;
    this.player.exp_required = c.exp_required || this.calcExpRequired(c.level);
    this.player.health = c.health;
    this.player.max_health = c.max_health;
    this.player.fatigue = c.fatigue;
    this.player.max_fatigue = c.max_fatigue;
    this.player.cultivation = c.cultivation;
    this.player.cultivation_required = c.cultivation_required;
    this.player.stat_points = c.stat_points;
    this.player.physique = c.physique;
    this.player.comprehension = c.comprehension;
    this.player.luck = c.luck;
    this.player.karma = c.karma;
    this.player.silver = c.silver;
    this.player.equipment = {
      weapon: c.equipped_weapon || null,
      armor: c.equipped_armor || null,
      relic: c.equipped_relic || null,
    };
    if (Array.isArray(details.inventory)) {
      this.player.inventory = details.inventory.map(i => ({ item_id: i.item_id, quantity: i.quantity }));
    }
    this.savePlayerState();
    this.renderAll();
  }

  async safeFetchJson(localPath, apiPath) {
    try {
      const res = await fetch(localPath);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : (data.quests || data.events || data.zones || data.data || data);
      }
    } catch (e) {
      // Bỏ qua và thử API fallback
    }

    if (apiPath) {
      try {
        const res = await fetch(`${this.apiBase}${apiPath}`);
        if (res.ok) {
          const json = await res.json();
          return json.success ? json.data : json;
        }
      } catch (e) {
        // Fallback không thành công
      }
    }
    return null;
  }

  async fetchWorldData() {
    const data = await this.safeFetchJson('./data/xianxia/worldData.json', '/api/xianxia/world/zones');
    if (Array.isArray(data)) {
      this.worldData.zones = data;
    }
  }

  async fetchItems() {
    const data = await this.safeFetchJson('./data/xianxia/items.json', '/api/xianxia/crafting/items');
    if (Array.isArray(data)) {
      this.items.clear();
      for (const it of data) {
        this.items.set(it.id, it);
      }
    }
  }

  async fetchRecipes() {
    const data = await this.safeFetchJson('./data/xianxia/recipes.json', '/api/xianxia/crafting/recipes');
    if (Array.isArray(data)) {
      this.recipes = data;
    }
  }

  async fetchGatheringNodes() {
    const data = await this.safeFetchJson('./data/xianxia/gatheringNodes.json', '/api/xianxia/crafting/nodes');
    if (Array.isArray(data)) {
      this.gatheringNodes = data;
    }
  }

  async fetchBestiary() {
    const [npcs, monsters] = await Promise.all([
      this.safeFetchJson('./data/xianxia/npcs.json', '/api/xianxia/bestiary/npcs'),
      this.safeFetchJson('./data/xianxia/monsters.json', '/api/xianxia/bestiary/monsters'),
    ]);
    if (Array.isArray(npcs)) this.npcs = npcs;
    if (Array.isArray(monsters)) this.monsters = monsters;
  }

  async fetchQuests() {
    const data = await this.safeFetchJson('./data/xianxia/quests.json', '/api/xianxia/quests');
    if (Array.isArray(data)) {
      this.quests = data;
    }
  }

  async fetchAgencyData() {
    const data = await this.safeFetchJson('./data/xianxia/agencyMissions.json', '/api/xianxia/agency');
    if (data && typeof data === 'object') {
      this.agencyData = {
        agencyRank: this.agencyData?.agencyRank || 'TAP_DICH',
        reputation: this.agencyData?.reputation || 0,
        availableMissions: data.missions || (Array.isArray(data) ? data : []),
        activeMission: this.agencyData?.activeMission || null,
      };
    }
  }

  async fetchEvents() {
    const data = await this.safeFetchJson('./data/xianxia/events.json', '/api/xianxia/events');
    if (Array.isArray(data)) {
      this.events = data;
    }
  }

  syncCurrentLocation() {
    if (!this.worldData.zones || this.worldData.zones.length === 0) return;
    let zone = this.worldData.zones.find(z => z.id === this.player.zone_id);
    if (!zone) {
      zone = this.worldData.zones[0];
      this.player.zone_id = zone.id;
    }
    this.worldData.currentZone = zone;

    const places = Array.isArray(zone.places) ? zone.places : [];
    let place = places.find(p => p.id === this.player.place_id);
    if (!place && places.length > 0) {
      place = places[0];
      this.player.place_id = place.id;
    }
    this.worldData.currentPlace = place;
  }

  // ====================================================
  // 4. HỆ THỐNG TẠO NHÂN VẬT TIÊN HIỆP (CHARACTER CREATION)
  // ====================================================
  openCharacterCreationModal() {
    const modal = document.getElementById('character-creation-modal');
    if (modal) modal.classList.add('open');
  }

  selectCreationDaoLo(type, el) {
    this.charCreationDraft.dao_lo = type;
    document.querySelectorAll('#create-daolo-group .combatant-card').forEach(c => {
      c.classList.remove('active-choice');
      c.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      c.style.background = 'rgba(255, 255, 255, 0.03)';
    });
    if (el) {
      el.classList.add('active-choice');
      if (type === 'MA_DAO') {
        el.style.borderColor = 'rgba(239, 68, 68, 0.85)';
        el.style.background = 'rgba(239, 68, 68, 0.15)';
      } else if (type === 'TIEN_DAO') {
        el.style.borderColor = 'rgba(16, 185, 129, 0.85)';
        el.style.background = 'rgba(16, 185, 129, 0.15)';
      } else {
        el.style.borderColor = 'rgba(245, 158, 11, 0.85)';
        el.style.background = 'rgba(245, 158, 11, 0.15)';
      }
    }
  }

  selectCreationLinhCan(type, el) {
    this.charCreationDraft.linh_can = type;
    document.querySelectorAll('#create-linhcan-group .combatant-card').forEach(c => {
      c.classList.remove('active-choice');
      c.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      c.style.background = 'rgba(255, 255, 255, 0.03)';
    });
    if (el) {
      el.classList.add('active-choice');
      el.style.borderColor = 'rgba(16, 185, 129, 0.7)';
      el.style.background = 'rgba(16, 185, 129, 0.1)';
    }
  }

  selectCreationOrigin(type, el) {
    this.charCreationDraft.origin = type;
    document.querySelectorAll('#create-origin-group .combatant-card').forEach(c => {
      c.classList.remove('active-choice');
      c.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      c.style.background = 'rgba(255, 255, 255, 0.03)';
    });
    if (el) {
      el.classList.add('active-choice');
      el.style.borderColor = 'rgba(245, 158, 11, 0.7)';
      el.style.background = 'rgba(245, 158, 11, 0.1)';
    }
  }

  confirmCharacterCreation() {
    const inputName = document.getElementById('create-char-name')?.value?.trim();
    const finalName = inputName || 'Tiêu Dao Tu Sĩ';

    this.player.name = finalName;
    this.player.dao_lo = this.charCreationDraft.dao_lo || 'TIEN_DAO';
    this.player.linh_can = this.charCreationDraft.linh_can;
    this.player.origin = this.charCreationDraft.origin;
    this.player.character_created = true;

    // 1. Áp dụng Đạo Lộ Khởi Điểm (Tu Tiên vs Tu Ma)
    if (this.player.dao_lo === 'MA_DAO') {
      this.player.karma = -35;
      this.player.title = 'Cửu U Ma Đồ';
      this.player.physique += 6;
    } else if (this.player.dao_lo === 'TIEN_DAO') {
      this.player.karma = 35;
      this.player.title = 'Tiên Môn Đạo Đồng';
      this.player.luck += 4;
    } else {
      this.player.karma = 0;
      this.player.title = 'Tiêu Dao Tán Tu';
      this.player.comprehension += 5;
    }

    // 2. Áp dụng thuộc tính Linh Căn
    if (this.player.linh_can === 'CUU_U_MA_CAN') {
      this.player.max_health += 45;
      this.player.health += 45;
      this.player.physique += 12;
      this.player.karma -= 15;
    } else if (this.player.linh_can === 'AM_DUONG_HON_THE') {
      this.player.comprehension += 10;
      this.player.luck += 6;
      this.player.max_fatigue += 30;
      this.player.fatigue += 30;
    } else if (this.player.linh_can === 'NGU_HANH') {
      this.player.physique += 8;
      this.player.comprehension += 6;
      this.player.max_fatigue += 25;
      this.player.fatigue += 25;
    } else if (this.player.linh_can === 'DI_LINH_CAN') {
      this.player.max_health += 30;
      this.player.health += 30;
      this.player.comprehension += 8;
    } else if (this.player.linh_can === 'KIEM_COT') {
      this.player.physique += 10;
      this.player.luck += 4;
    } else {
      // THIEN_LINH_CAN
      this.player.luck += 5;
      this.player.comprehension += 6;
    }

    // 3. Áp dụng xuất thân
    if (this.player.origin === 'HUYET_MA_DI_TOC') {
      this.player.silver += 200;
      this.addItemToInventory('item_huyet_ma_dao', 1);
      this.addItemToInventory('item_cuu_u_ma_dan', 3);
      this.player.physique += 6;
    } else if (this.player.origin === 'TAN_TU_GIA') {
      this.player.silver += 150;
      this.addItemToInventory('item_hoi_xuan_dan', 3);
    } else if (this.player.origin === 'THAO_DUOC_DONG') {
      this.addItemToInventory('item_thao_moc_linh_chi', 6);
      this.addItemToInventory('item_kim_ngan_hoa', 4);
    } else if (this.player.origin === 'THO_SAN_RUNG') {
      this.addItemToInventory('item_thanh_phong_kiem', 1);
      this.player.physique += 5;
    } else if (this.player.origin === 'CO_TICH_MON') {
      this.player.comprehension += 8;
      this.player.luck += 4;
    }

    const daoLoMsg = this.player.dao_lo === 'MA_DAO' 
      ? '🩸 [Ma Đạo] Nghịch thiên đoạt mệnh, sát phạt cuồng bạo!' 
      : (this.player.dao_lo === 'TIEN_DAO' ? '🕊️ [Tiên Đạo] Trừ ma vệ đạo, quang minh chính đại!' : '☯️ [Tiêu Dao] Tùy tâm sở dục, thiên địa vi gia!');

    this.log(`[Định Danh Tiên Thể] Đạo hữu [${finalName}] quy y [${this.getDaoLoName(this.player.dao_lo)}], giác ngộ [${this.getLinhCanName(this.player.linh_can)}] và xuất thân [${this.getOriginName(this.player.origin)}]! ${daoLoMsg}`, 'success');

    const modal = document.getElementById('character-creation-modal');
    if (modal) modal.classList.remove('open');

    this.savePlayerState();
    this.renderAll();
    this.notify(`Chào mừng ${finalName} chính thức bước vào con đường ${this.player.dao_lo === 'MA_DAO' ? 'Tu Ma' : 'Tu Tiên'}!`, 'success');
  }

  // ====================================================
  // 5. THIÊN CƠ CHỈ DẪN (SMART ACTION GUIDE BOX)
  // ====================================================
  updateSmartGuide() {
    const guideTextEl = document.getElementById('smart-guide-text');
    const guideBtnEl = document.getElementById('smart-guide-btn');
    if (!guideTextEl || !guideBtnEl) return;

    const p = this.player;

    if (!p.character_created) {
      guideTextEl.textContent = 'Ngươi chưa định hình linh căn và đạo hiệu. Hãy mau chóng tạo nhân vật khởi nguyên!';
      guideBtnEl.textContent = 'Tạo Tiên Thể ➔';
      this.smartGuideAction = () => this.openCharacterCreationModal();
      return;
    }

    if (p.health < p.max_health * 0.3) {
      guideTextEl.textContent = `Khí huyết nguy kịch (${p.health}/${p.max_health})! Hãy đả tọa điều tức hoặc dùng Hồi Xuân Đan để tránh ngã xuống.`;
      guideBtnEl.textContent = 'Đả Tọa Ngay 🧘';
      this.smartGuideAction = () => this.meditateRest();
      return;
    }

    if (p.cultivation >= p.cultivation_required) {
      guideTextEl.textContent = `Tu vi đã đạt viên mãn đỉnh phong (${p.cultivation}/${p.cultivation_required})! Mau chóng Xung Quan Đột Phá cảnh giới!`;
      guideBtnEl.textContent = 'Đột Phá ⚡';
      this.smartGuideAction = () => this.openBreakthroughModal();
      return;
    }

    if (p.stat_points > 0) {
      guideTextEl.textContent = `Ngươi có ${p.stat_points} điểm tiềm năng chưa phân bổ! Hãy vào mục [Nhân Vật] để nâng cao Căn Cốt & Ngộ Tính.`;
      guideBtnEl.textContent = 'Cộng Điểm 🧙';
      this.smartGuideAction = () => this.setTab('character');
      return;
    }

    if (this.trackedQuest) {
      const q = this.trackedQuest;
      const prog = this.player.quest_progress[q.id];
      const isCompleted = prog?.status === 'COMPLETED';

      if (isCompleted) {
        guideTextEl.textContent = `Nhiệm vụ: [${q.title}] đã công đức viên mãn!`;
        guideBtnEl.textContent = 'Mở Nhiệm Vụ 📜';
        this.smartGuideAction = () => this.setTab('quest');
        return;
      }

      // Kiểm tra tiến trình mục tiêu kế tiếp
      let nextUnmetObj = null;
      let allDone = true;
      if (q.objectives && q.objectives.length > 0) {
        for (const obj of q.objectives) {
          const count = prog?.progress?.[obj.id] || 0;
          if (count < (obj.required_count || 1)) {
            allDone = false;
            nextUnmetObj = { ...obj, current: count };
            break;
          }
        }
      }

      if (allDone) {
        guideTextEl.textContent = `✨ [${q.title}]: Đã hoàn tất mục tiêu! Hãy về thôn bàn giao nhận thưởng!`;
        guideBtnEl.textContent = 'Bàn Giao ✔️';
        this.smartGuideAction = () => {
          this.setTab('quest');
          this.completeQuest(q.id);
        };
        return;
      }

      if (nextUnmetObj) {
        guideTextEl.textContent = `🎯 [${q.title}]: ${nextUnmetObj.description} (${nextUnmetObj.current}/${nextUnmetObj.required_count || 1})`;
        if (nextUnmetObj.type === 'KILL_MONSTER') {
          guideBtnEl.textContent = 'Trảm Yêu ⚔️';
          this.smartGuideAction = () => this.huntQuestTarget(q.id, nextUnmetObj.target_id);
        } else if (nextUnmetObj.type === 'TALK_NPC') {
          guideBtnEl.textContent = 'Đàm Đạo 💬';
          this.smartGuideAction = () => this.interactQuestObjective(q.id, nextUnmetObj.id, 'TALK_NPC');
        } else if (nextUnmetObj.type === 'ANSWER_QUIZ') {
          guideBtnEl.textContent = 'Vấn Đạo ❓';
          this.smartGuideAction = () => this.openQuestQuizModal(q.id, nextUnmetObj.id);
        } else {
          guideBtnEl.textContent = 'Thực Hiện ➔';
          this.smartGuideAction = () => this.setTab('quest');
        }
        return;
      }

      guideTextEl.textContent = `Nhiệm vụ: [${q.title}] - ${q.summary}`;
      guideBtnEl.textContent = 'Mở Nhiệm Vụ 📜';
      this.smartGuideAction = () => this.setTab('quest');
      return;
    }

    if (p.fatigue >= 12) {
      guideTextEl.textContent = `Thể lực sung mãn (${p.fatigue}/${p.max_fatigue}). Hãy thám hiểm sơn xuyên, khiêu chiến Dị Thú để thu thập linh thảo và tu vi!`;
      guideBtnEl.textContent = 'Thám Hiểm 🧭';
      this.smartGuideAction = () => this.exploreCurrentZone();
      return;
    }

    guideTextEl.textContent = 'Linh khí an tĩnh. Ngươi có thể đả tọa nghỉ ngơi hoặc đến Tiệm Dược Thảo mua sắm trang bị.';
    guideBtnEl.textContent = 'Đả Tọa 🧘';
    this.smartGuideAction = () => this.meditateRest();
  }

  handleSmartGuideClick() {
    if (typeof this.smartGuideAction === 'function') {
      this.smartGuideAction();
    }
  }

  // ====================================================
  // 6. ĐẢ TỌA ĐIỀU TỨC & XUNG QUAN ĐỘT PHÁ CẢNH GIỚI
  // ====================================================
  meditateRest() {
    const now = Date.now();
    const wait = 30000 - (now - (this.player.last_meditate || 0));
    if (wait > 0) {
      return this.notify(`Linh khí thiên địa chưa tụ, vui lòng đợi ${Math.ceil(wait / 1000)}s!`, 'info');
    }

    const place = this.worldData.currentPlace;
    const isSanctuary = place?.id === 'place_dong_phu_tan_tu';
    const cost = isSanctuary ? 0 : 5; // Khách điếm tốn 5 bạc, Động phủ miễn phí

    if (this.player.silver < cost) {
      return this.notify(`Không đủ ${cost} Bạc để thuê phòng nghỉ trọ đả tọa!`, 'error');
    }

    if (this.player.fatigue >= this.player.max_fatigue && this.player.health >= this.player.max_health) {
      return this.notify('Khí huyết và thể lực đang sung mãn viên mãn, không cần đả tọa!', 'info');
    }

    this.player.silver -= cost;
    this.player.last_meditate = now;
    this.player.fatigue = Math.min(this.player.max_fatigue, this.player.fatigue + 35);
    this.player.health = Math.min(this.player.max_health, this.player.health + 25);

    // TUYỆT ĐỐI BỎ CỘNG TU VI Ở ĐÂY để chặn exploit!
    this.log(
      `Ngươi khoanh chân nhập định, vận chuyển kinh mạch hồi phục 35 Thể Lực, 25 Khí Huyết${cost > 0 ? ` (tiêu hao ${cost} Bạc tiền trọ)` : ' (tại Động Phủ an toàn)'}.`,
      'success'
    );
    this.savePlayerState();
    this.renderPlayerStats();
    this.updateSmartGuide();
    this.notify('Đả tọa hoàn tất, tinh thần phấn chấn!', 'success');
  }

  addCultivation(amount) {
    let finalAmount = amount;
    if (this.player.linh_can === 'THIEN_LINH_CAN') {
      finalAmount = Math.floor(amount * 1.3);
    }
    this.player.cultivation += finalAmount;
    this.log(`Tu vi gia tăng +${finalAmount} điểm (Thiên đạo ban thưởng).`, 'info');

    if (this.player.cultivation >= this.player.cultivation_required) {
      this.notify('Tu vi đã đạt viên mãn đỉnh phong! Hãy vào mục [Nhân Vật] để Xung Quan Đột Phá!', 'success');
    }
    this.savePlayerState();
    this.renderPlayerStats();
    this.updateSmartGuide();
  }

  getBreakthroughInfo() {
    const realmConfigs = {
      PHAM_NHAN: { next: 'LUYEN_KHI_1', title: 'Luyện Khí Tầng 1', req: 180, hp: 140, fat: 110, p: 14, c: 15, baseRate: 90 },
      LUYEN_KHI_1: { next: 'LUYEN_KHI_2', title: 'Luyện Khí Tầng 2', req: 280, hp: 170, fat: 120, p: 16, c: 16, baseRate: 85 },
      LUYEN_KHI_2: { next: 'LUYEN_KHI_3', title: 'Luyện Khí Tầng 3', req: 400, hp: 210, fat: 130, p: 18, c: 18, baseRate: 80 },
      LUYEN_KHI_3: { next: 'LUYEN_KHI_4', title: 'Luyện Khí Tầng 4', req: 550, hp: 260, fat: 140, p: 20, c: 20, baseRate: 75 },
      LUYEN_KHI_4: { next: 'LUYEN_KHI_5', title: 'Luyện Khí Tầng 5', req: 750, hp: 320, fat: 150, p: 22, c: 22, baseRate: 70 },
      LUYEN_KHI_5: { next: 'LUYEN_KHI_6', title: 'Luyện Khí Tầng 6', req: 1000, hp: 390, fat: 160, p: 25, c: 24, baseRate: 68 },
      LUYEN_KHI_6: { next: 'LUYEN_KHI_7', title: 'Luyện Khí Tầng 7', req: 1300, hp: 470, fat: 170, p: 28, c: 26, baseRate: 65 },
      LUYEN_KHI_7: { next: 'LUYEN_KHI_8', title: 'Luyện Khí Tầng 8', req: 1700, hp: 560, fat: 180, p: 32, c: 28, baseRate: 60 },
      LUYEN_KHI_8: { next: 'LUYEN_KHI_9', title: 'Luyện Khí Tầng 9', req: 2200, hp: 680, fat: 200, p: 36, c: 30, baseRate: 55 },
      LUYEN_KHI_9: { next: 'TRUC_CO_SO_KY', title: 'Trúc Cơ Sơ Kỳ (Tiên Nhân)', req: 5500, hp: 1200, fat: 300, p: 50, c: 45, baseRate: 45 },
      TRUC_CO_SO_KY: { next: 'TRUC_CO_TRUNG_KY', title: 'Trúc Cơ Trung Kỳ', req: 9000, hp: 1700, fat: 380, p: 65, c: 55, baseRate: 40 },
      TRUC_CO_TRUNG_KY: { next: 'TRUC_CO_HAU_KY', title: 'Trúc Cơ Hậu Kỳ', req: 15000, hp: 2400, fat: 450, p: 80, c: 68, baseRate: 35 },
      TRUC_CO_HAU_KY: { next: 'TRUC_CO_DINH_PHONG', title: 'Trúc Cơ Đỉnh Phong', req: 22000, hp: 3200, fat: 520, p: 100, c: 80, baseRate: 30 },
      TRUC_CO_DINH_PHONG: { next: 'KIM_DAN_SO_KY', title: 'Kim Đan Sơ Kỳ (Chân Nhân)', req: 32000, hp: 4200, fat: 620, p: 125, c: 98, baseRate: 25 },
    };
    return realmConfigs[this.player.realm] || null;
  }

  openBreakthroughModal() {
    const nextInfo = this.getBreakthroughInfo();
    if (!nextInfo) {
      return this.notify('Đạo hữu đã đạt cảnh giới tối cao trong phiên bản hiện tại (Kim Đan Đỉnh Phong)!', 'info');
    }

    const modal = document.getElementById('breakthrough-modal');
    if (!modal) return;

    document.getElementById('breakthrough-realm-title').textContent = 
      `Từ [${this.getRealmName(this.player.realm)}] Đột Phá Lên [${nextInfo.title}]`;

    let rate = nextInfo.baseRate;
    document.getElementById('breakthrough-chance-text').textContent = `${rate}%`;

    // Render danh sách đan dược hỗ trợ trong túi đồ
    const pillContainer = document.getElementById('breakthrough-pills-list');
    pillContainer.innerHTML = '';

    const supportPills = this.player.inventory.filter(s => {
      const it = this.items.get(s.item_id);
      return it && (it.id === 'item_cuc_pham_truc_co_dan' || it.id === 'item_truc_co_dan' || it.id === 'item_duong_khi_dan');
    });

    if (supportPills.length === 0) {
      pillContainer.innerHTML = `<div style="font-size: 0.75rem; color: #64748b; font-style: italic;">Không có đan dược trợ lực trong túi đồ (Có thể đột phá trần trụi nhưng rủi ro cao).</div>`;
    } else {
      supportPills.forEach(s => {
        const it = this.items.get(s.item_id);
        let bonusRate = 15;
        let protection = false;
        if (it.id === 'item_cuc_pham_truc_co_dan') {
          bonusRate = 55;
          protection = true;
        } else if (it.id === 'item_truc_co_dan') {
          bonusRate = 35;
          protection = true;
        }
        const pillDiv = document.createElement('div');
        pillDiv.className = 'combatant-card';
        pillDiv.style.cursor = 'pointer';
        pillDiv.style.display = 'flex';
        pillDiv.style.justifyContent = 'space-between';
        pillDiv.style.alignItems = 'center';
        pillDiv.innerHTML = `
          <div>
            <strong style="color: #6ee7b7; font-size: 0.82rem;">${it.name} (x${s.quantity})</strong>
            <div style="font-size: 0.7rem; color: #94a3b8;">+${bonusRate}% Tỉ lệ thành công ${protection ? '& Miễn trừ phản phệ' : ''}</div>
          </div>
          <button class="btn-wuxia-link" style="font-size: 0.72rem;" onclick="window.engine.selectBreakthroughPill('${it.id}')">Dùng Đan</button>
        `;
        pillContainer.appendChild(pillDiv);
      });
    }

    modal.classList.add('open');
  }

  selectBreakthroughPill(pillId) {
    this.selectedBreakthroughPillId = pillId;
    const nextInfo = this.getBreakthroughInfo();
    const it = this.items.get(pillId);
    let bonus = 15;
    if (pillId === 'item_cuc_pham_truc_co_dan') bonus = 55;
    else if (pillId === 'item_truc_co_dan') bonus = 35;
    const totalRate = Math.min(99, (nextInfo?.baseRate || 50) + bonus);
    document.getElementById('breakthrough-chance-text').textContent = `${totalRate}% (Đã tăng +${bonus}% nhờ ${it.name})`;
    this.notify(`Đã chuẩn bị phục dụng [${it.name}] để trợ lực xung quan!`, 'success');
  }

  closeBreakthroughModal() {
    this.selectedBreakthroughPillId = null;
    const modal = document.getElementById('breakthrough-modal');
    if (modal) modal.classList.remove('open');
  }

  async executeBreakthrough() {
    const nextInfo = this.getBreakthroughInfo();
    if (!nextInfo) return;

    if (this.player.cultivation < this.player.cultivation_required) {
      return this.notify(`Chưa đủ tu vi để xung quan (${this.player.cultivation}/${this.player.cultivation_required})!`, 'error');
    }

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/character/breakthrough`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ support_pill_id: this.selectedBreakthroughPillId || undefined }),
        });
        const json = await res.json();
        this.closeBreakthroughModal();
        if (json.success && json.data) {
          if (json.data.characterDetails) {
            this.syncWithBackendDetails(json.data.characterDetails);
          }
          if (json.data.success) {
            this.log(json.data.message, 'success');
            this.notify(`Đột phá đại thành! Cảnh giới hiện tại: ${json.data.realm}!`, 'success');
          } else {
            this.log(json.data.message, 'warning');
            this.notify('Xung quan thất bại!', 'warning');
          }
          this.savePlayerState();
          this.renderAll();
          return;
        } else {
          return this.notify(json.error || 'Lỗi khi xung quan đột phá!', 'error');
        }
      } catch (err) {
        console.error('Breakthrough API error, fallback local:', err);
      }
    }

    // Fallback Offline / Khách vãng lai
    let successRate = nextInfo.baseRate;
    let hasProtection = false;

    if (this.selectedBreakthroughPillId) {
      if (this.selectedBreakthroughPillId === 'item_cuc_pham_truc_co_dan') {
        successRate += 55;
        hasProtection = true;
      } else if (this.selectedBreakthroughPillId === 'item_truc_co_dan') {
        successRate += 35;
        hasProtection = true;
      } else if (this.selectedBreakthroughPillId === 'item_duong_khi_dan') {
        successRate += 15;
      }
      this.removeItemFromInventory(this.selectedBreakthroughPillId, 1);
    }

    const roll = Math.random() * 100;
    const isSuccess = roll <= successRate;

    this.closeBreakthroughModal();

    if (isSuccess) {
      this.player.cultivation = Math.max(0, this.player.cultivation - this.player.cultivation_required);
      this.player.realm = nextInfo.next;
      this.player.title = nextInfo.title;
      this.player.cultivation_required = nextInfo.req;
      this.player.max_health = nextInfo.hp;
      this.player.health = nextInfo.hp;
      this.player.max_fatigue = nextInfo.fat;
      this.player.fatigue = nextInfo.fat;
      this.player.stat_points = (this.player.stat_points || 0) + 4;

      this.log(`🌟 [ĐỘT PHÁ THIÊN ĐẠO] Chúc mừng Đạo Hữu đột phá thành công lên [${nextInfo.title}]! Nhận +4 Điểm Tiềm Năng!`, 'success');
      this.notify(`Đột phá đại thành! Chúc mừng đạt cảnh giới ${nextInfo.title}!`, 'success');
    } else {
      const lostCult = Math.floor(this.player.cultivation * 0.3);
      this.player.cultivation = Math.max(0, this.player.cultivation - lostCult);

      if (!hasProtection) {
        const damage = Math.floor(this.player.max_health * 0.25);
        this.player.health = Math.max(1, this.player.health - damage);
        this.log(`💥 [ĐỘT PHÁ THẤT BẠI] Chân khí nghịch chuyển tổn thương kinh mạch (-${lostCult} Tu vi, -${damage} Khí Huyết). Mau chóng điều dưỡng!`, 'warning');
        this.notify('Xung quan thất bại, kinh mạch bị phản phệ!', 'error');
      } else {
        const pillName = this.selectedBreakthroughPillId === 'item_cuc_pham_truc_co_dan' ? 'Cực Phẩm Trúc Cơ Đan' : 'Trúc Cơ Đan';
        this.log(`🛡️ [ĐỘT PHÁ THẤT BẠI] Nhờ có ${pillName} bảo hộ kinh mạch, ngươi chỉ hao hụt -${lostCult} Tu vi mà không bị thương tổn thể xác!`, 'info');
        this.notify(`Xung quan chưa thành nhưng ${pillName} đã cứu mạng bảo toàn kinh mạch!`, 'warning');
      }
    }

    this.savePlayerState();
    this.renderAll();
  }

  // ====================================================
  // 7. PHÂN BỔ ĐIỂM TIỀM NĂNG & TRANG BỊ 3 SLOTS
  // ====================================================
  allocateStatPoint(stat) {
    if ((this.player.stat_points || 0) <= 0) {
      return this.notify('Không có điểm tiềm năng tự do để phân bổ!', 'info');
    }

    const token = this.getAuthToken();
    if (token) {
      fetch(`${this.apiBase}/api/xianxia/gameplay/character/stat-points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ stat })
      }).then(res => res.json()).then(json => {
        if (!json.success) {
          this.notify(json.error || 'Lỗi khi cộng điểm tiềm năng trên máy chủ.', 'error');
        } else {
          this.syncWithBackendDetails(json.data);
          this.log(`Phân bổ +1 ${stat} thành công (Máy chủ xác thực).`, 'success');
          this.notify(`Cộng điểm tiềm năng thành công!`, 'success');
        }
      }).catch(err => {
        this.localAllocateStatPoint(stat);
      });
      return;
    }

    this.localAllocateStatPoint(stat);
  }

  localAllocateStatPoint(stat) {
    if ((this.player.stat_points || 0) <= 0) {
      return this.notify('Không có điểm tiềm năng tự do để phân bổ!', 'info');
    }

    this.player.stat_points--;
    if (stat === 'physique') {
      this.player.physique++;
      this.player.max_health += 10;
      this.player.health = Math.min(this.player.max_health, this.player.health + 10);
      this.log('Phân bổ +1 Căn Cốt (Tăng +10 Khí Huyết tối đa và sát thương vật lý).', 'success');
    } else if (stat === 'comprehension') {
      this.player.comprehension++;
      this.log('Phân bổ +1 Ngộ Tính (Tăng sát thương Thần Thông và tốc độ ngưng tụ tu vi).', 'success');
    } else if (stat === 'luck') {
      this.player.luck++;
      this.log('Phân bổ +1 Khí Vận (Tăng tỉ lệ rơi đồ hiếm và cơ duyên đào tẩu).', 'success');
    }

    this.savePlayerState();
    this.renderPlayerStats();
    this.renderCharacterView();
    this.updateSmartGuide();
  }

  equipItem(itemId) {
    const item = this.items.get(itemId);
    if (!item || item.type !== 'EQUIPMENT') return;

    // Kiểm tra yêu cầu cảnh giới (Realm Requirement)
    if (item.realm_requirement) {
      const REALM_ORDER = [
        'PHAM_NHAN',
        'LUYEN_KHI_1', 'LUYEN_KHI_2', 'LUYEN_KHI_3', 'LUYEN_KHI_4', 'LUYEN_KHI_5',
        'LUYEN_KHI_6', 'LUYEN_KHI_7', 'LUYEN_KHI_8', 'LUYEN_KHI_9',
        'TRUC_CO_SO_KY', 'TRUC_CO_TRUNG_KY', 'TRUC_CO_HAU_KY', 'TRUC_CO_DINH_PHONG', 'KIM_DAN_SO_KY'
      ];
      const currentIdx = REALM_ORDER.indexOf(this.player.realm || 'PHAM_NHAN');
      const reqIdx = REALM_ORDER.indexOf(item.realm_requirement);
      if (currentIdx < reqIdx) {
        return this.notify(`Cảnh giới chưa đủ để trang bị [${item.name}]! Cần tối thiểu [${this.getRealmName(item.realm_requirement)}].`, 'error');
      }
    }

    const token = this.getAuthToken();
    if (token) {
      fetch(`${this.apiBase}/api/xianxia/gameplay/equipment/equip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ item_id: itemId })
      }).then(res => res.json()).then(json => {
        if (!json.success) {
          this.notify(json.error || 'Lỗi khi trang bị trên máy chủ.', 'error');
        } else {
          this.syncWithBackendDetails(json.data?.characterDetails);
          this.log(`Trang bị [${item.name}] thành công (Máy chủ xác thực)!`, 'success');
          this.notify(`Đã trang bị ${item.name}!`, 'success');
        }
      }).catch(err => {
        this.localEquipItem(item);
      });
      return;
    }

    this.localEquipItem(item);
  }

  localEquipItem(item) {
    let slot = 'weapon';
    if (item.id === 'item_thiet_giap_y' || item.id === 'item_thiet_bi_giap') slot = 'armor';
    else if (item.id === 'item_thanh_tam_boi' || item.equipment_stats?.slot === 'relic') slot = 'relic';

    // Tháo trang bị cũ nếu có
    const currentEquipped = this.player.equipment[slot];
    if (currentEquipped) {
      this.addItemToInventory(currentEquipped, 1);
    }

    this.player.equipment[slot] = item.id;
    this.removeItemFromInventory(item.id, 1);

    this.log(`Trang bị [${item.name}] vào vị trí ${slot.toUpperCase()}!`, 'success');
    this.notify(`Đã trang bị ${item.name}!`, 'success');

    this.savePlayerState();
    this.renderAll();
  }

  unequipItem(slot) {
    const equippedId = this.player.equipment[slot];
    if (!equippedId) return;

    const token = this.getAuthToken();
    if (token) {
      fetch(`${this.apiBase}/api/xianxia/gameplay/equipment/unequip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ slot })
      }).then(res => res.json()).then(json => {
        if (!json.success) {
          this.notify(json.error || 'Lỗi khi tháo trang bị trên máy chủ.', 'error');
        } else {
          this.syncWithBackendDetails(json.data?.characterDetails);
          this.log(`Đã tháo trang bị cất vào Túi Trữ Vật (Máy chủ xác thực).`, 'info');
          this.notify(`Đã tháo trang bị!`, 'info');
        }
      }).catch(err => {
        this.localUnequipItem(slot);
      });
      return;
    }

    this.localUnequipItem(slot);
  }

  localUnequipItem(slot) {
    const equippedId = this.player.equipment[slot];
    if (!equippedId) return;

    const item = this.items.get(equippedId);
    this.player.equipment[slot] = null;
    this.addItemToInventory(equippedId, 1);

    this.log(`Đã tháo [${item?.name || equippedId}] cất vào Túi Trữ Vật.`, 'info');
    this.notify(`Đã tháo trang bị!`, 'info');

    this.savePlayerState();
    this.renderAll();
  }

  // ====================================================
  // 8. HỆ THỐNG TU LUYỆN TREO MÁY (IDLE CULTIVATION)
  // ====================================================
  startIdleCultivationLoop() {
    setInterval(() => {
      this.tickIdleCultivation();
    }, 1500);
  }

  tickIdleCultivation() {
    const now = Date.now();
    const last = this.player.last_idle_tick || now;
    const diffSec = Math.min(28800, (now - last) / 1000); // Tối đa 8 giờ

    if (diffSec >= 1.5) {
      let ratePerSec = 0.4 + (this.player.comprehension * 0.04);
      if (this.player.linh_can === 'THIEN_LINH_CAN') ratePerSec *= 1.3;
      const gained = Math.floor(diffSec * ratePerSec);

      if (gained > 0) {
        this.player.idle_cultivation_bank = (this.player.idle_cultivation_bank || 0) + gained;
        this.player.last_idle_tick = now;
        this.savePlayerState();

        const idleDisplay = document.getElementById('idle-cultivation-amount');
        if (idleDisplay) {
          idleDisplay.textContent = `+${this.player.idle_cultivation_bank}`;
        }
      }
    }
  }

  claimIdleCultivation() {
    const bank = this.player.idle_cultivation_bank || 0;
    if (bank <= 0) {
      return this.notify('Chưa tích tụ đủ linh khí để thu hoạch!', 'info');
    }

    this.player.idle_cultivation_bank = 0;
    this.addCultivation(bank);
    this.log(`[Thu Hoạch Nhập Định] Hấp thu toàn bộ ${bank} điểm tu vi tích lũy từ thiên địa!`, 'success');
    this.notify(`Đã thu hoạch thành công +${bank} Tu Vi!`, 'success');
    this.renderCharacterView();
  }

  // ====================================================
  // 9. CHIẾN ĐẤU TỰ ĐỘNG HOÀN TOÀN (FULL AUTO-COMBAT ARENA)
  // ====================================================
  async startBattle(monsterId) {
    const mon = this.monsters.find(m => m.id === monsterId);
    if (!mon) return;

    if (this.player.fatigue < 10) {
      return this.notify('Thể lực quá thấp để giao chiến (cần tối thiểu 10 thể lực)!', 'error');
    }

    const token = this.getAuthToken();
    if (token) {
      const serverOk = await this.startServerBattle(monsterId, token, mon);
      if (serverOk) return;
    }

    this.startLocalBattle(mon);
  }

  startLocalBattle(mon) {
    // Tiêu hao 10 thể lực nhập trận
    this.player.fatigue -= 10;

    const weapon = this.player.equipment?.weapon ? this.items.get(this.player.equipment.weapon) : null;
    const armor = this.player.equipment?.armor ? this.items.get(this.player.equipment.armor) : null;
    const relic = this.player.equipment?.relic ? this.items.get(this.player.equipment.relic) : null;

    const playerSpeed = 10 + (weapon?.equipment_stats?.speed || 0) + (armor?.equipment_stats?.speed || 0);
    const weaponAtk = weapon?.equipment_stats?.attack || 0;
    const armorDef = armor?.equipment_stats?.defense || 0;
    const relicPwr = relic?.equipment_stats?.comprehension || 0;

    this.battle = {
      serverVerified: false,
      monster: JSON.parse(JSON.stringify(mon)),
      monster_hp: mon.max_health,
      monster_max_hp: mon.max_health,
      player_qi: 25,
      player_max_qi: 50 + (relic?.equipment_stats?.max_qi || 0),
      player_speed: playerSpeed,
      weaponAtk,
      armorDef,
      relicPwr,
      turn: 1,
      maxTurns: 30,
      totalDamageDealt: 0,
      guarding: false,
      speedMultiplier: 1,
      playbackTimer: null,
      resolved: false,
      ended: false,
      logs: [`⚔️ Ngươi rút binh khí đối diện với [${mon.name}], kịch chiến bắt đầu!`],
      intent: this.rollMonsterIntent(mon),
    };

    const modal = document.getElementById('battle-modal');
    if (modal) modal.classList.add('open');

    // Nút Bỏ qua bắt đầu ở trạng thái Vô hiệu hóa trong Hiệp 1
    const skipBtn = document.getElementById('btn-skip-battle');
    if (skipBtn) {
      skipBtn.disabled = true;
      skipBtn.style.opacity = '0.45';
      skipBtn.style.cursor = 'not-allowed';
      skipBtn.textContent = '⏭ Đang Kịch Chiến Hiệp 1...';
    }

    this.renderBattleState();
    this.savePlayerState();
    this.renderPlayerStats();

    // Bắt đầu chuỗi tự động đánh
    this.scheduleNextBattleTurn(600);
  }

  async startServerBattle(monsterId, token, mon) {
    try {
      const idempotencyKey = 'battle_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/combat/battle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ monster_id: monsterId, idempotency_key: idempotencyKey })
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        this.notify(json.error || 'Máy chủ báo lỗi khi khiêu chiến.', 'error');
        return false;
      }

      const battleData = json.data;
      const playbackTurns = battleData.playbackTurns || [];

      const weapon = this.player.equipment?.weapon ? this.items.get(this.player.equipment.weapon) : null;
      const armor = this.player.equipment?.armor ? this.items.get(this.player.equipment.armor) : null;
      const relic = this.player.equipment?.relic ? this.items.get(this.player.equipment.relic) : null;

      this.battle = {
        serverVerified: true,
        serverData: battleData,
        playbackTurns: playbackTurns,
        playbackIdx: 0,
        monster: JSON.parse(JSON.stringify(mon)),
        monster_hp: mon.max_health,
        monster_max_hp: mon.max_health,
        player_qi: 25,
        player_max_qi: 50 + (relic?.equipment_stats?.max_qi || 0),
        turn: 1,
        maxTurns: 30,
        totalDamageDealt: 0,
        guarding: false,
        speedMultiplier: 1,
        playbackTimer: null,
        resolved: false,
        ended: false,
        logs: [`⚔️ [Máy Chủ Xác Thực] Ngươi đối diện với [${mon.name}], trận chiến bắt đầu!`],
        intent: playbackTurns[0]?.monsterIntent || this.rollMonsterIntent(mon)
      };

      const modal = document.getElementById('battle-modal');
      if (modal) modal.classList.add('open');

      const skipBtn = document.getElementById('btn-skip-battle');
      if (skipBtn) {
        skipBtn.disabled = true;
        skipBtn.style.opacity = '0.45';
        skipBtn.style.cursor = 'not-allowed';
        skipBtn.textContent = '⏭ Đang Kịch Chiến Hiệp 1...';
      }

      this.player.fatigue = Math.max(0, (this.player.fatigue || 100) - 10);
      this.renderBattleState();
      this.savePlayerState();
      this.renderPlayerStats();

      this.scheduleNextServerBattleTurn(600);
      return true;
    } catch (e) {
      console.warn('Lỗi kết nối máy chủ trận chiến:', e);
      return false;
    }
  }

  scheduleNextServerBattleTurn(delayMs) {
    if (!this.battle || this.battle.ended || this.battle.resolved) return;
    const baseDelay = delayMs || (800 / (this.battle.speedMultiplier || 1));

    if (this.battle.playbackTimer) {
      clearTimeout(this.battle.playbackTimer);
    }

    this.battle.playbackTimer = setTimeout(() => {
      if (!this.battle || this.battle.ended || this.battle.resolved) return;
      this.executeServerBattleTurnLogic();
    }, baseDelay);
  }

  executeServerBattleTurnLogic() {
    if (!this.battle || this.battle.ended || this.battle.resolved) return;
    const b = this.battle;
    const turns = b.playbackTurns || [];

    if (b.playbackIdx >= turns.length) {
      this.endServerBattle(b.serverData);
      return;
    }

    const rec = turns[b.playbackIdx];
    b.turn = rec.turn;
    this.player.health = rec.playerHp;
    b.monster_hp = rec.monsterHp;
    b.player_qi = rec.playerQi;
    if (rec.monsterIntent) b.intent = rec.monsterIntent;

    if (Array.isArray(rec.turnLogs)) {
      for (const line of rec.turnLogs) {
        b.logs.push(line);
      }
    }

    // Hiệp 1 hoàn thành -> Mở khóa nút Bỏ Qua
    if (b.turn >= 1) {
      const skipBtn = document.getElementById('btn-skip-battle');
      if (skipBtn && skipBtn.disabled) {
        skipBtn.disabled = false;
        skipBtn.style.opacity = '1';
        skipBtn.style.cursor = 'pointer';
        skipBtn.textContent = '⏭ Bỏ Qua & Xem Kết QuẢ';
      }
    }

    this.renderBattleState();
    this.renderPlayerStats();

    if (b.playbackIdx >= turns.length - 1) {
      this.endServerBattle(b.serverData);
      return;
    }

    b.playbackIdx++;
    this.scheduleNextServerBattleTurn();
  }

  setBattleSpeed(multiplier) {
    if (!this.battle || this.battle.ended) return;
    this.battle.speedMultiplier = multiplier;

    const btn1x = document.getElementById('btn-speed-1x');
    const btn2x = document.getElementById('btn-speed-2x');
    if (btn1x && btn2x) {
      if (multiplier === 1) {
        btn1x.classList.add('active');
        btn2x.classList.remove('active');
      } else {
        btn2x.classList.add('active');
        btn1x.classList.remove('active');
      }
    }
  }

  skipBattlePlayback() {
    if (!this.battle || this.battle.ended || this.battle.resolved) return;
    if (this.battle.turn < 1) return;

    // Hủy bỏ timer đang chờ
    if (this.battle.playbackTimer) {
      clearTimeout(this.battle.playbackTimer);
      this.battle.playbackTimer = null;
    }

    if (this.battle.serverVerified) {
      const turns = this.battle.playbackTurns || [];
      for (let i = this.battle.playbackIdx + 1; i < turns.length; i++) {
        const t = turns[i];
        if (Array.isArray(t.turnLogs)) {
          for (const l of t.turnLogs) {
            this.battle.logs.push(l);
          }
        }
      }
      const last = turns[turns.length - 1];
      if (last) {
        this.battle.turn = last.turn;
        this.player.health = last.playerHp;
        this.battle.monster_hp = last.monsterHp;
        this.battle.player_qi = last.playerQi;
        if (last.monsterIntent) this.battle.intent = last.monsterIntent;
      }
      this.renderBattleState();
      this.endServerBattle(this.battle.serverData);
      return;
    }

    // Chạy đồng bộ toàn bộ các hiệp còn lại đến khi kết thúc trận đấu
    while (this.battle && !this.battle.ended && !this.battle.resolved) {
      this.executeBattleTurnLogic();
    }
  }

  scheduleNextBattleTurn(delayMs) {
    if (!this.battle || this.battle.ended || this.battle.resolved) return;
    const baseDelay = delayMs || (800 / (this.battle.speedMultiplier || 1));

    if (this.battle.playbackTimer) {
      clearTimeout(this.battle.playbackTimer);
    }

    this.battle.playbackTimer = setTimeout(() => {
      if (!this.battle || this.battle.ended || this.battle.resolved) return;
      this.executeBattleTurnLogic();
      if (!this.battle.ended && !this.battle.resolved) {
        this.scheduleNextBattleTurn();
      }
    }, baseDelay);
  }

  executeBattleTurnLogic() {
    if (!this.battle || this.battle.ended || this.battle.resolved) return;
    const b = this.battle;
    const p = this.player;

    b.guarding = false;

    // 1. Tự động xác định hành động của người chơi
    let playerAction = 'STRIKE';
    if (b.intent.type === 'HEAVY' && b.armorDef > 0) {
      playerAction = 'GUARD';
    } else if (b.player_qi >= 15) {
      playerAction = 'SKILL';
    } else {
      playerAction = 'STRIKE';
    }

    // 2. Quyết định thứ tự xuất chiêu dựa vào Thân pháp (Speed)
    const pFirst = (b.player_speed || 10) >= (b.monster.speed || 8);

    const executePlayerAct = () => {
      if (b.monster_hp <= 0 || b.ended) return;

      if (playerAction === 'SKILL') {
        b.player_qi -= 15;
        let baseSkill = p.comprehension * 2.2 + b.relicPwr * 2;
        if (p.linh_can === 'DI_LINH_CAN') baseSkill *= 1.3;
        const dmg = Math.max(8, Math.floor(baseSkill - b.monster.defense * 0.3));
        b.monster_hp -= dmg;
        b.totalDamageDealt += dmg;
        b.logs.push(`[Hiệp ${b.turn}] ⚡ Ngươi thi triển Thần Thông sấm sét giáng lâm, oanh kích ${dmg} sát thương lên [${b.monster.name}]!`);
      } else if (playerAction === 'GUARD') {
        b.guarding = true;
        b.player_qi = Math.min(b.player_max_qi, b.player_qi + 15);
        const heal = Math.floor(p.max_health * 0.05);
        p.health = Math.min(p.max_health, p.health + heal);
        b.logs.push(`[Hiệp ${b.turn}] 🛡️ Ngươi tiến vào Thế Thủ, hồi +15 Qi & +${heal} Khí Huyết, giảm 70% sát thương nhận vào!`);
      } else {
        // STRIKE
        const baseAtk = p.physique * 1.5 + b.weaponAtk;
        const dmg = Math.max(3, Math.floor(baseAtk - b.monster.defense * 0.8));
        b.monster_hp -= dmg;
        b.totalDamageDealt += dmg;
        b.player_qi = Math.min(b.player_max_qi, b.player_qi + 8);
        b.logs.push(`[Hiệp ${b.turn}] ⚔️ Ngươi vung kiếm trảm kích gây ${dmg} sát thương lên [${b.monster.name}], tích +8 Qi!`);
      }
    };

    const executeMonsterAct = () => {
      if (p.health <= 0 || b.monster_hp <= 0 || b.ended) return;

      if (b.intent.type === 'CHARGE') {
        const mHeal = Math.floor(b.monster_max_hp * 0.1);
        b.monster_hp = Math.min(b.monster_max_hp, b.monster_hp + mHeal);
        b.logs.push(`[Hiệp ${b.turn}] 🌀 [${b.monster.name}] vận khí dưỡng thương, hồi phục +${mHeal} yêu khí!`);
      } else {
        let rawDmg = b.monster.attack * b.intent.mult;
        if (b.guarding) {
          rawDmg *= 0.3; // Giảm 70% sát thương khi có thế thủ
        }
        const actualDmg = Math.max(2, Math.floor(rawDmg - b.armorDef * 0.6));
        p.health = Math.max(0, p.health - actualDmg);
        b.logs.push(`[Hiệp ${b.turn}] 🩸 [${b.monster.name}] tung [${b.intent.title}], gây ${actualDmg} sát thương lên ngươi!`);
      }
    };

    if (pFirst) {
      executePlayerAct();
      if (b.monster_hp <= 0) {
        b.monster_hp = 0;
        b.logs.push(`🎉 [${b.monster.name}] gào thét thảm thiết rồi đổ gục! Ngươi giành thắng lợi vẻ vang!`);
        this.renderBattleState();
        this.endBattle('WIN');
        return;
      }
      executeMonsterAct();
      if (p.health <= 0) {
        p.health = 0;
        b.logs.push('💀 Ngươi trọng thương ngã gục, mất đi ý thức giữa trận chiến...');
        this.renderBattleState();
        this.endBattle('LOSE');
        return;
      }
    } else {
      executeMonsterAct();
      if (p.health <= 0) {
        p.health = 0;
        b.logs.push('💀 Ngươi trọng thương ngã gục, mất đi ý thức giữa trận chiến...');
        this.renderBattleState();
        this.endBattle('LOSE');
        return;
      }
      executePlayerAct();
      if (b.monster_hp <= 0) {
        b.monster_hp = 0;
        b.logs.push(`🎉 [${b.monster.name}] gào thét thảm thiết rồi đổ gục! Ngươi giành thắng lợi vẻ vang!`);
        this.renderBattleState();
        this.endBattle('WIN');
        return;
      }
    }

    // 3. Sau khi Hiệp 1 kết thúc -> Mở khóa nút Bỏ Qua
    if (b.turn >= 1) {
      const skipBtn = document.getElementById('btn-skip-battle');
      if (skipBtn && skipBtn.disabled) {
        skipBtn.disabled = false;
        skipBtn.style.opacity = '1';
        skipBtn.style.cursor = 'pointer';
        skipBtn.textContent = '⏭ Bỏ Qua & Xem Kết Quả';
      }
    }

    // 4. Kiểm tra trần 30 hiệp kịch chiến (Stalemate tie-break & anti-exploit)
    if (b.turn >= b.maxTurns) {
      const pHpPct = p.health / p.max_health;
      const mHpPct = b.monster_hp / b.monster_max_hp;
      const hasMinDamage = b.totalDamageDealt >= (b.monster_max_hp * 0.4);

      if (pHpPct > mHpPct && hasMinDamage) {
        b.logs.push('⚖️ [Hiệp 30] Cả hai bên kiệt sức! Nhờ công phá vượt trội, ngươi chiếm thế thượng phong khiến yêu thú tháo lui!');
        this.renderBattleState();
        this.endBattle('STALEMATE_ADVANTAGE');
      } else {
        b.logs.push('💨 [Hiệp 30] Bất phân thắng bại! Nhận thấy không thể công phá lớp giáp hộ thể yêu thú, ngươi thi triển khinh công rút lui an toàn!');
        this.renderBattleState();
        this.endBattle('STALEMATE_RETREAT');
      }
      return;
    }

    // Chuẩn bị cho hiệp tiếp theo
    b.turn++;
    b.intent = this.rollMonsterIntent(b.monster);
    this.renderBattleState();
    this.savePlayerState();
    this.renderPlayerStats();
  }

  // Wrapper tương thích với các bài test cũ
  async playerBattleAction(action) {
    if (!this.battle || this.battle.ended || this.battle.resolved) return;
    this.executeBattleTurnLogic();
  }

  rollMonsterIntent(mon) {
    const r = Math.random();
    if (r < 0.55) {
      return { type: 'ATTACK', title: 'Trảm Kích Dã Tính', mult: 1.0, icon: '⚔️', hint: 'Quái chuẩn bị tung đòn đánh vật lý thường.' };
    } else if (r < 0.82) {
      return { type: 'HEAVY', title: 'Yêu Kình Nộ Sát', mult: 1.8, icon: '💥', hint: '⚠️ Quái đang súc lực tung ĐÒN NẶNG! Hệ thống sẽ tự động Thế Thủ nếu có giáp.' };
    } else {
      return { type: 'CHARGE', title: 'Hấp Thu Yêu Khí', mult: 0, icon: '🌀', hint: '✨ Quái đang vận khí hộ thể! Cơ hội dồn sát thương.' };
    }
  }

  renderBattleState() {
    if (!this.battle) return;
    const b = this.battle;
    const p = this.player;

    const titleEl = document.getElementById('battle-title');
    if (titleEl) titleEl.textContent = `Chiến Đấu: ${p.name} (Lv${p.level || 1}) vs ${b.monster.name}`;

    const turnBadge = document.getElementById('battle-turn-badge');
    if (turnBadge) turnBadge.textContent = `Hiệp ${b.turn} / ${b.maxTurns}`;

    // Player stats
    const pName = document.getElementById('battle-player-name');
    if (pName) pName.textContent = p.name;
    const pRealm = document.getElementById('battle-player-realm');
    if (pRealm) pRealm.textContent = `${this.getRealmName(p.realm)} • Cấp ${p.level || 1}`;

    const pHpText = document.getElementById('battle-player-hp-text');
    if (pHpText) pHpText.textContent = `${p.health} / ${p.max_health}`;
    const pHpPct = Math.max(0, Math.min(100, (p.health / p.max_health) * 100));
    const pHpBar = document.getElementById('battle-player-hp-bar');
    if (pHpBar) pHpBar.style.width = `${pHpPct}%`;

    const pQiText = document.getElementById('battle-player-qi-text');
    if (pQiText) pQiText.textContent = `${b.player_qi} / ${b.player_max_qi}`;
    const pQiPct = Math.max(0, Math.min(100, (b.player_qi / b.player_max_qi) * 100));
    const pQiBar = document.getElementById('battle-player-qi-bar');
    if (pQiBar) pQiBar.style.width = `${pQiPct}%`;

    // Monster stats
    const mName = document.getElementById('battle-mon-name');
    if (mName) mName.textContent = b.monster.name;
    const mTier = document.getElementById('battle-mon-tier');
    if (mTier) mTier.textContent = this.getMonsterTierName(b.monster.tier);
    const mHpText = document.getElementById('battle-mon-hp-text');
    if (mHpText) mHpText.textContent = `${Math.max(0, b.monster_hp)} / ${b.monster_max_hp}`;
    const mHpPct = Math.max(0, Math.min(100, (b.monster_hp / b.monster_max_hp) * 100));
    const mHpBar = document.getElementById('battle-mon-hp-bar');
    if (mHpBar) mHpBar.style.width = `${mHpPct}%`;

    const mAtk = document.getElementById('battle-mon-atk');
    if (mAtk) mAtk.textContent = b.monster.attack;
    const mDef = document.getElementById('battle-mon-def');
    if (mDef) mDef.textContent = b.monster.defense;
    const monAvatar = document.getElementById('battle-mon-avatar');
    if (monAvatar && b.monster.avatar) monAvatar.src = b.monster.avatar;

    // Monster Intent Box
    const intentBox = document.getElementById('battle-intent-box');
    const intentIcon = document.getElementById('battle-intent-icon');
    const intentTitle = document.getElementById('battle-intent-title');
    const intentDesc = document.getElementById('battle-intent-desc');
    const intentBadge = document.getElementById('battle-intent-badge');

    if (intentBox && b.intent) {
      intentBox.className = 'monster-intent-banner';
      if (b.intent.type === 'HEAVY') intentBox.classList.add('intent-heavy');
      else if (b.intent.type === 'CHARGE') intentBox.classList.add('intent-charge');

      if (intentIcon) intentIcon.textContent = b.intent.icon;
      if (intentTitle) intentTitle.textContent = `Ý Định: ${b.intent.title}`;
      if (intentDesc) intentDesc.textContent = b.intent.hint;
      if (intentBadge) intentBadge.textContent = b.intent.type === 'HEAVY' ? 'NỘ SÁT' : (b.intent.type === 'CHARGE' ? 'VẬN KHÍ' : 'TẤN CÔNG');
    }

    // Combat Log Stream
    const logBox = document.getElementById('battle-log-container');
    if (logBox && Array.isArray(b.logs)) {
      logBox.innerHTML = b.logs.map(l => `<div>• ${l}</div>`).join('');
      logBox.scrollTop = logBox.scrollHeight;
    }
  }

  async endBattle(result) {
    if (!this.battle || this.battle.resolved) return;
    const b = this.battle;
    const mon = b.monster;

    // Đánh dấu đã giải quyết để ngăn chặn nhận thưởng nhiều lần (Idempotency)
    b.resolved = true;
    b.ended = true;

    if (b.playbackTimer) {
      clearTimeout(b.playbackTimer);
      b.playbackTimer = null;
    }

    this.battle = null;

    const modal = document.getElementById('battle-modal');
    if (modal) modal.classList.remove('open');

    if (result === 'WIN') {
      const expGained = mon.exp_reward || 50;
      const cultGained = mon.cultivation_reward || 20;

      // Sửa bug bạc: tính random chính xác trong khoảng [min, max]
      const minSilv = typeof mon.silver_reward_min === 'number' ? mon.silver_reward_min : 10;
      const maxSilv = typeof mon.silver_reward_max === 'number' ? mon.silver_reward_max : 30;
      const silverGained = Math.floor(minSilv + Math.random() * (maxSilv - minSilv + 1));

      this.player.silver = (this.player.silver || 0) + silverGained;
      this.addExp(expGained);
      this.addCultivation(cultGained);

      // Sửa bug rơi đồ: kiểm tra chính xác drop.chance
      const dropped = [];
      if (Array.isArray(mon.loot_table)) {
        for (const drop of mon.loot_table) {
          const chance = typeof drop.chance === 'number' ? drop.chance : (drop.drop_rate || 0.5);
          if (Math.random() <= chance) {
            const minQ = drop.min_quantity || 1;
            const maxQ = drop.max_quantity || 1;
            const qty = Math.floor(minQ + Math.random() * (maxQ - minQ + 1));
            this.addItemToInventory(drop.item_id, qty);
            dropped.push({ ...drop, quantity: qty });
            await this.notifyLootAcquired(drop.item_id, qty);
          }
        }
      }

      await this.notifyMonsterKill(mon.id);
      await this.advanceAgencyMission('HUNT', { monsterId: mon.id, count: 1 });

      this.log(`[Trảm Yêu Đại Thắng] Đánh bại [${mon.name}], nhận +${expGained} EXP, +${cultGained} Tu vi, +${silverGained} Bạc, thu hoạch ${dropped.length} chiến lợi phẩm.`, 'success');
      this.notify(`Đại thắng [${mon.name}]! Thu hoạch ${dropped.length} chiến lợi phẩm.`, 'success');
    } else if (result === 'STALEMATE_ADVANTAGE') {
      // Kết thúc hiệp 30 chiếm thế thượng phong: Nhận 50% EXP và Tu vi an ủi
      const expGained = Math.floor((mon.exp_reward || 50) * 0.5);
      const cultGained = Math.floor((mon.cultivation_reward || 20) * 0.5);

      this.addExp(expGained);
      this.addCultivation(cultGained);

      this.log(`[Đình Chiến Thượng Phong] Kịch chiến 30 hiệp chiếm ưu thế, yêu thú rút lui. Nhận 50% phần thưởng: +${expGained} EXP, +${cultGained} Tu vi.`, 'info');
      this.notify(`Đình chiến 30 hiệp! Chiếm ưu thế nhận 50% EXP & Tu vi.`, 'info');
    } else if (result === 'STALEMATE_RETREAT') {
      // Kết thúc hiệp 30 rút lui an toàn: 0 phần thưởng, không bị phạt HP về 20, không trừ thêm thể lực
      this.log(`[Khinh Công Thoát Thân] Đạo hữu không thể công phá giáp yêu thú, an toàn rút lui khỏi chiến trường.`, 'info');
      this.notify('Bất phân thắng bại sau 30 hiệp! Đã an toàn rút lui.', 'info');
    } else if (result === 'LOSE') {
      // Hình phạt thất bại chuẩn xác: HP về 20, trừ thêm 5 thể lực (tổng mất đúng 15 thể lực), không mất trang bị/vật phẩm
      this.player.health = 20;
      this.player.fatigue = Math.max(0, this.player.fatigue - 5);
      this.player.place_id = 'place_dong_phu_tan_tu';
      this.syncCurrentLocation();

      this.log('Ngươi trọng thương ngã gục, được sơn dân khiêng về Động Phủ Tán Tu điều trị (Khí Huyết còn 20, mất tổng cộng 15 Thể Lực).', 'warning');
      this.notify('Chiến bại trọng thương! Đã đưa về Động Phủ tịnh dưỡng.', 'error');
    }

    this.battle = null;
    this.savePlayerState();
    this.renderAll();
  }

  async endServerBattle(serverData) {
    if (!this.battle || this.battle.resolved) return;
    const b = this.battle;
    const mon = b.monster;

    b.resolved = true;
    b.ended = true;

    if (b.playbackTimer) {
      clearTimeout(b.playbackTimer);
      b.playbackTimer = null;
    }

    const modal = document.getElementById('battle-modal');
    if (modal) modal.classList.remove('open');

    // Đồng bộ thuộc tính nhân vật chính xác từ máy chủ
    if (serverData?.playerStateAfterBattle) {
      const s = serverData.playerStateAfterBattle;
      this.player.level = s.level;
      this.player.exp = s.exp;
      this.player.exp_required = s.exp_required;
      this.player.health = s.health;
      this.player.max_health = s.max_health;
      this.player.fatigue = s.fatigue;
      this.player.max_fatigue = s.max_fatigue;
      this.player.cultivation = s.cultivation;
      this.player.cultivation_required = s.cultivation_required;
      this.player.silver = s.silver;
      this.player.stat_points = s.stat_points;
    }

    const result = serverData?.result;
    const rewards = serverData?.rewards || {};

    if (result === 'WIN') {
      if (Array.isArray(rewards.items)) {
        for (const it of rewards.items) {
          this.addItemToInventory(it.item_id, it.quantity);
          await this.notifyLootAcquired(it.item_id, it.quantity);
        }
      }

      await this.notifyMonsterKill(mon.id);
      await this.advanceAgencyMission('HUNT', { monsterId: mon.id, count: 1 });

      const dropCount = Array.isArray(rewards.items) ? rewards.items.length : 0;
      this.log(`[Trảm Yêu Đại Thắng (Máy Chủ Xác Thực)] Đánh bại [${mon.name}], nhận +${rewards.exp || 0} EXP, +${rewards.cultivation || 0} Tu vi, +${rewards.silver || 0} Bạc, ${dropCount} chiến lợi phẩm.`, 'success');
      this.notify(`Đại thắng [${mon.name}]! (Server Verified)`, 'success');
    } else if (result === 'STALEMATE_ADVANTAGE') {
      this.log(`[Đình Chiến Thượng Phong (Máy Chủ Xác Thực)] Kịch chiến 30 hiệp chiếm ưu thế. Nhận 50% phần thưởng: +${rewards.exp || 0} EXP, +${rewards.cultivation || 0} Tu vi.`, 'info');
      this.notify(`Đình chiến 30 hiệp! Chiếm ưu thế nhận 50% EXP & Tu vi (Server Verified).`, 'info');
    } else if (result === 'STALEMATE_RETREAT') {
      this.log(`[Khinh Công Thoát Thân (Máy Chủ Xác Thực)] Đạo hữu không thể công phá giáp yêu thú, an toàn rút lui khỏi chiến trường.`, 'info');
      this.notify('Bất phân thắng bại sau 30 hiệp! Đã an toàn rút lui.', 'info');
    } else if (result === 'LOSE') {
      this.player.place_id = 'place_dong_phu_tan_tu';
      this.syncCurrentLocation();

      this.log('Ngươi trọng thương ngã gục, được sơn dân khiêng về Động Phủ Tán Tu điều trị (Khí Huyết còn 20, mất tổng cộng 15 Thể Lực) [Server Verified].', 'warning');
      this.notify('Chiến bại trọng thương! Đã đưa về Động Phủ tịnh dưỡng.', 'error');
    }

    this.battle = null;
    this.savePlayerState();
    this.renderAll();
  }

  async openBattleHistoryModal() {
    const modal = document.getElementById('battle-history-modal');
    if (!modal) return;
    modal.classList.add('open');

    const container = document.getElementById('battle-history-list');
    if (!container) return;

    const token = this.getAuthToken();
    if (!token) {
      container.innerHTML = `
        <div style="text-align: center; color: #fca5a5; padding: 24px; font-size: 0.88rem; background: rgba(239, 68, 68, 0.08); border-radius: 8px; border: 1px dashed rgba(239, 68, 68, 0.3);">
          🔒 <strong>Chế Độ Khách Ngao Du</strong><br>
          <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 6px;">
            Đạo hữu đang tu luyện ở chế độ cục bộ. Đăng nhập tài khoản Tiên Lộ để máy chủ lưu trữ vĩnh viễn và đồng bộ toàn bộ lịch sử chiến báo trên hệ thống.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="text-align: center; color: #64748b; padding: 24px; font-size: 0.85rem;">
        ⏳ Đang kết nối máy chủ để tải biên niên sử chiến báo...
      </div>
    `;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/combat/history?limit=25`, {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        container.innerHTML = `<div style="text-align: center; color: #f87171; padding: 20px;">Lỗi tải dữ liệu: ${err.error || res.statusText}</div>`;
        return;
      }

      const json = await res.json();
      const logs = json.data || [];

      if (logs.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: #94a3b8; padding: 30px; font-size: 0.85rem;">
            🌱 Đạo hữu chưa có chiến báo nào được ghi nhận trên máy chủ.<br>
            <span style="font-size: 0.75rem; color: #64748b;">Hãy bước vào Tháp Yêu hoặc Hoang Dã để khởi chiến!</span>
          </div>
        `;
        return;
      }

      container.innerHTML = logs.map(l => {
        let badge = '';
        if (l.result === 'WIN') {
          badge = `<span style="background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">ĐẠI THẮNG</span>`;
        } else if (l.result === 'LOSE') {
          badge = `<span style="background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">CHIẾN BẠI</span>`;
        } else if (l.result === 'STALEMATE_ADVANTAGE') {
          badge = `<span style="background: rgba(245, 158, 11, 0.2); color: #fde047; border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">ĐÌNH CHIẾN (+50%)</span>`;
        } else {
          badge = `<span style="background: rgba(148, 163, 184, 0.2); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem;">RÚT LUI</span>`;
        }

        const monDef = this.monsters.find(m => m.id === l.monster_id);
        const monsterName = monDef?.name || l.monster_id;
        const timeStr = new Date(l.created_at).toLocaleString('vi-VN');

        let rewardStr = '';
        if (l.reward_exp > 0 || l.reward_cultivation > 0 || l.reward_silver > 0) {
          rewardStr = `<div style="font-size: 0.75rem; color: #fbbf24; margin-top: 4px;">
            Thưởng: +${l.reward_exp} EXP | +${l.reward_cultivation} Tu Vi | +${l.reward_silver} 🪙 Bạc
          </div>`;
        }

        let itemStr = '';
        if (Array.isArray(l.reward_items) && l.reward_items.length > 0) {
          const names = l.reward_items.map(it => {
            const def = this.items.get(it.item_id);
            return `${def?.name || it.item_id} (x${it.quantity})`;
          }).join(', ');
          itemStr = `<div style="font-size: 0.72rem; color: #6ee7b7; margin-top: 2px;">🎁 Rơi đồ: ${names}</div>`;
        }

        return `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 10px 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${badge}
                <strong style="color: #f1f5f9; font-size: 0.85rem;">vs ${monsterName}</strong>
              </div>
              <span style="font-size: 0.72rem; color: #94a3b8;">${l.turns} Hiệp • ${timeStr}</span>
            </div>
            ${rewardStr}
            ${itemStr}
          </div>
        `;
      }).join('');
    } catch (e) {
      container.innerHTML = `<div style="text-align: center; color: #f87171; padding: 20px;">Lỗi mạng khi tải chiến báo: ${e.message}</div>`;
    }
  }

  closeBattleHistoryModal() {
    const modal = document.getElementById('battle-history-modal');
    if (modal) modal.classList.remove('open');
  }

  // ====================================================
  // 10. TIỆM BÁCH HÓA & DƯỢC THẢO (SHOP SYSTEM)
  // ====================================================
  openShopModal() {
    const modal = document.getElementById('shop-modal');
    if (!modal) return;
    this.renderShopItems();
    modal.classList.add('open');
  }

  closeShopModal() {
    const modal = document.getElementById('shop-modal');
    if (modal) modal.classList.remove('open');
  }

  setShopTab(tab) {
    this.shopTab = tab;
    document.getElementById('shop-tab-buy').style.background = tab === 'buy' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-subtle)';
    document.getElementById('shop-tab-buy').style.color = tab === 'buy' ? '#6ee7b7' : 'var(--color-text-muted)';
    document.getElementById('shop-tab-sell').style.background = tab === 'sell' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-subtle)';
    document.getElementById('shop-tab-sell').style.color = tab === 'sell' ? '#6ee7b7' : 'var(--color-text-muted)';
    this.renderShopItems();
  }

  renderShopItems() {
    const container = document.getElementById('shop-items-container');
    if (!container) return;
    document.getElementById('shop-player-silver').textContent = this.player.silver;
    container.innerHTML = '';

    if (this.shopTab === 'buy') {
      // Danh sách vật phẩm có thể mua
      const availableItems = [
        'item_hoi_xuan_dan',
        'item_duong_khi_dan',
        'item_truc_co_dan',
        'item_thanh_phong_kiem',
        'item_thiet_giap_y',
        'item_thanh_tam_boi',
        'item_thao_moc_linh_chi',
        'item_kim_ngan_hoa',
        'item_thiet_khoang',
      ];

      availableItems.forEach(id => {
        const it = this.items.get(id);
        if (!it) return;
        const div = document.createElement('div');
        div.className = 'combatant-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${it.icon}" class="item-slot-icon" style="width: 38px; height: 38px;" onerror="this.onerror=null; this.src='/assets/xianxia/items/thao_moc_linh_chi.webp'"/>
            <div>
              <strong style="color: #fff; font-size: 0.85rem;">${it.name}</strong>
              <div style="font-size: 0.72rem; color: #94a3b8;">${it.description}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #fbbf24; font-weight: 700; font-size: 0.85rem;">${it.buy_price || 20} 🪙</span>
            <button class="btn-primary-glow" style="padding: 6px 12px; font-size: 0.75rem;" onclick="window.engine.buyShopItem('${it.id}')">Mua</button>
          </div>
        `;
        container.appendChild(div);
      });
    } else {
      // Tab bán đồ trong túi
      if (this.player.inventory.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #64748b; font-size: 0.8rem; padding: 20px;">Túi trữ vật trống rỗng, không có gì để bán!</div>`;
        return;
      }
      this.player.inventory.forEach(s => {
        const it = this.items.get(s.item_id);
        if (!it) return;
        const sellPrice = it.sell_price || Math.floor((it.buy_price || 10) * 0.5);
        const div = document.createElement('div');
        div.className = 'combatant-card';
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${it.icon}" class="item-slot-icon" style="width: 38px; height: 38px;" onerror="this.onerror=null; this.src='/assets/xianxia/items/thao_moc_linh_chi.webp'"/>
            <div>
              <strong style="color: #fff; font-size: 0.85rem;">${it.name} (x${s.quantity})</strong>
              <div style="font-size: 0.72rem; color: #94a3b8;">${it.description}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #34d399; font-weight: 700; font-size: 0.85rem;">+${sellPrice} 🪙</span>
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.75rem;" onclick="window.engine.sellShopItem('${it.id}')">Bán x1</button>
          </div>
        `;
        container.appendChild(div);
      });
    }
  }

  async buyShopItem(itemId) {
    const it = this.items.get(itemId);
    if (!it) return;
    const price = it.buy_price || 20;

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/shop/buy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ item_id: itemId, quantity: 1 }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.characterDetails) {
            this.syncWithBackendDetails(json.data.characterDetails);
          }
          this.log(`Mua thành công [${it.name}] tiêu hao ${price} Bạc.`, 'success');
          this.notify(`Đã mua ${it.name}!`, 'success');
          this.renderShopItems();
          return;
        } else {
          return this.notify(json.error || `Không đủ bạc để mua ${it.name}!`, 'error');
        }
      } catch (err) {
        console.error('buyShopItem API error, fallback local:', err);
      }
    }

    if (this.player.silver < price) {
      return this.notify(`Không đủ bạc để mua ${it.name} (cần ${price} Bạc)!`, 'error');
    }

    this.player.silver -= price;
    this.addItemToInventory(itemId, 1);
    this.log(`Mua thành công [${it.name}] tiêu hao ${price} Bạc.`, 'success');
    this.notify(`Đã mua ${it.name}!`, 'success');

    this.savePlayerState();
    this.renderPlayerStats();
    this.renderShopItems();
    this.renderInventory();
  }

  async sellShopItem(itemId) {
    const it = this.items.get(itemId);
    if (!it) return;
    const price = it.sell_price || Math.floor((it.buy_price || 10) * 0.5);

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/shop/sell`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ item_id: itemId, quantity: 1 }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.characterDetails) {
            this.syncWithBackendDetails(json.data.characterDetails);
          }
          this.log(`Bán [${it.name}] thu về +${price} Bạc.`, 'info');
          this.notify(`Đã bán ${it.name} nhận +${price} Bạc!`, 'info');
          this.renderShopItems();
          return;
        } else {
          return this.notify(json.error || `Không thể bán ${it.name}!`, 'error');
        }
      } catch (err) {
        console.error('sellShopItem API error, fallback local:', err);
      }
    }

    this.removeItemFromInventory(itemId, 1);
    this.player.silver += price;
    this.log(`Bán [${it.name}] thu về +${price} Bạc.`, 'info');
    this.notify(`Đã bán ${it.name} nhận +${price} Bạc!`, 'info');

    this.savePlayerState();
    this.renderPlayerStats();
    this.renderShopItems();
    this.renderInventory();
  }

  // ====================================================
  // 11. THÁM HIỂM, DI CHUYỂN & KỲ NGỘ
  // ====================================================
  selectZone(zoneId) {
    const zone = this.worldData.zones.find(z => z.id === zoneId);
    if (!zone) return;

    if (this.player.zone_id === zoneId) {
      return this.notify('Ngươi hiện đang ở phân khu này rồi!', 'info');
    }

    const currentZone = this.worldData.currentZone;
    const conn = currentZone?.connections?.find(c => c.target_zone_id === zoneId);
    const fatigueCost = conn?.fatigue_cost || 10;

    if (this.player.fatigue < fatigueCost) {
      return this.notify(`Thể lực không đủ để di chuyển (cần ${fatigueCost} Thể lực)!`, 'error');
    }

    this.travelToZone(zoneId, fatigueCost, zone);
  }

  async travelToZone(targetZoneId, fatigueCost, targetZone) {
    const modal = document.getElementById('travel-journey-modal');
    if (modal) {
      document.getElementById('travel-modal-title').textContent = `Khởi Hành Đi [${targetZone.name}]...`;
      document.getElementById('travel-modal-desc').textContent = targetZone.description || 'Vượt qua sơn xuyên hiểm trở...';
      const progressFill = document.getElementById('travel-modal-progress');
      progressFill.style.width = '0%';
      modal.classList.add('open');
      setTimeout(() => { if (progressFill) progressFill.style.width = '100%'; }, 100);
    }

    await new Promise(r => setTimeout(r, 1200));
    if (modal) modal.classList.remove('open');

    this.player.fatigue = Math.max(0, this.player.fatigue - fatigueCost);
    this.player.zone_id = targetZoneId;
    this.syncCurrentLocation();
    this.savePlayerState();

    this.log(`Ngươi tiêu hao ${fatigueCost} thể lực, thuận lợi đặt chân đến [${targetZone.name}].`, 'info');
    await this.advanceAgencyMission('TRAVEL', { currentZoneId: targetZoneId });

    this.notify(`Đã đến [${targetZone.name}] bình an!`, 'success');
    this.renderAll();
    this.syncChatZone();
  }

  selectPlace(placeId) {
    const place = this.worldData.currentZone?.places?.find(p => p.id === placeId);
    if (!place) return;
    this.player.place_id = placeId;
    this.worldData.currentPlace = place;
    this.savePlayerState();
    this.log(`Ngươi dừng chân tại [${place.name}].`, 'info');
    this.renderAll();
  }

  async exploreCurrentZone() {
    const roamCost = this.worldData.currentZone?.fatigue_cost_roam || 5;
    if (this.player.fatigue < roamCost) {
      return this.notify(`Thể lực quá thấp (${this.player.fatigue}/${roamCost}), hãy đả tọa nghỉ ngơi hoặc dùng Dưỡng Khí Đan!`, 'error');
    }

    this.player.fatigue -= roamCost;

    // Tìm sự kiện tương ứng phân khu hiện tại
    const zoneEvents = this.events.filter(e => !e.zone_id || e.zone_id === this.player.zone_id);
    const selectedEvent = zoneEvents.length > 0 
      ? zoneEvents[Math.floor(Math.random() * zoneEvents.length)]
      : (this.events[0] || null);

    if (selectedEvent) {
      this.activeEventData = { event: selectedEvent };
      this.renderActiveEventModal();
      this.advanceAgencyMission('ROAM');
      this.advanceAgencyMission('EVENT', { eventId: selectedEvent.id });
    } else {
      this.notify('Thám hiểm phân khu một vòng, không gặp bất trắc gì.', 'info');
    }

    this.savePlayerState();
    this.renderPlayerStats();
    this.updateSmartGuide();
  }

  renderActiveEventModal() {
    if (!this.activeEventData?.event) return;
    const ev = this.activeEventData.event;
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    document.getElementById('modal-event-title').textContent = `✨ [KỲ NGỘ] ${ev.title}`;

    const lines = Array.isArray(ev.narrative) ? ev.narrative : [ev.description || 'Ngươi bắt gặp một cơ duyên kỳ lạ...'];
    this.streamNarrativeLines(lines, () => {
      this.renderEventChoices(ev.choices || []);
    });

    modal.classList.add('open');
  }

  streamNarrativeLines(lines, onFinish) {
    this.clearNarrativeStream();
    const container = document.getElementById('modal-event-lines');
    const indicator = document.getElementById('modal-typing-indicator');
    const choicesBox = document.getElementById('modal-event-choices');

    container.innerHTML = '';
    choicesBox.innerHTML = '';
    choicesBox.classList.remove('revealed');
    if (indicator) indicator.style.display = 'flex';

    this.pendingLines = [...lines];
    this.onStreamFinishCallback = onFinish;

    const streamNext = () => {
      if (this.pendingLines.length === 0) {
        if (indicator) indicator.style.display = 'none';
        if (typeof this.onStreamFinishCallback === 'function') {
          this.onStreamFinishCallback();
          this.onStreamFinishCallback = null;
        }
        return;
      }

      const lineText = this.pendingLines.shift();
      const p = document.createElement('p');
      p.className = 'narrative-line';
      p.textContent = lineText;
      container.appendChild(p);

      this.streamTimer = setTimeout(streamNext, 500);
    };

    streamNext();
  }

  skipStream() {
    if (this.streamTimer) {
      clearTimeout(this.streamTimer);
      this.streamTimer = null;
    }
    const container = document.getElementById('modal-event-lines');
    const indicator = document.getElementById('modal-typing-indicator');
    if (indicator) indicator.style.display = 'none';

    while (this.pendingLines.length > 0) {
      const lineText = this.pendingLines.shift();
      const p = document.createElement('p');
      p.className = 'narrative-line';
      p.textContent = lineText;
      container.appendChild(p);
    }

    if (typeof this.onStreamFinishCallback === 'function') {
      this.onStreamFinishCallback();
      this.onStreamFinishCallback = null;
    }
  }

  clearNarrativeStream() {
    if (this.streamTimer) {
      clearTimeout(this.streamTimer);
      this.streamTimer = null;
    }
    this.pendingLines = [];
    this.onStreamFinishCallback = null;
  }

  renderEventChoices(choices) {
    const box = document.getElementById('modal-event-choices');
    box.innerHTML = '';
    if (!choices || choices.length === 0) {
      box.innerHTML = `<button class="btn-primary-glow" onclick="window.engine.closeEventModal()">Tiếp Tục Tiên Lộ</button>`;
      box.classList.add('revealed');
      return;
    }

    choices.forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.innerHTML = `
        <div style="font-weight: 700; color: #fff;">${ch.label}</div>
        <div style="font-size: 0.72rem; color: #94a3b8;">${ch.description || ''}</div>
      `;
      btn.onclick = () => this.resolveActiveEvent(ch.id);
      box.appendChild(btn);
    });

    box.classList.add('revealed');
  }

  resolveActiveEvent(choiceId) {
    if (!this.activeEventData?.event) return;
    const ev = this.activeEventData.event;
    const choice = ev.choices?.find(c => c.id === choiceId);

    // Tính toán kết quả
    const fx = choice?.effects || {
      cultivation_gained: 25,
      silver_change: 20,
      health_change: 0,
      fatigue_change: 0,
      karma_change: 1,
      items_gained: [],
    };

    if (fx.cultivation_gained) this.addCultivation(fx.cultivation_gained);
    if (fx.silver_change) this.player.silver = Math.max(0, this.player.silver + fx.silver_change);
    if (fx.health_change) this.player.health = Math.min(this.player.max_health, Math.max(1, this.player.health + fx.health_change));
    if (fx.karma_change) this.player.karma = Math.min(100, Math.max(-100, this.player.karma + fx.karma_change));

    if (Array.isArray(fx.items_gained)) {
      fx.items_gained.forEach(it => this.addItemToInventory(it.item_id, it.quantity));
    }

    const narrativeResult = choice?.narrative || 'Lựa chọn của ngươi dẫn đến một biến chuyển nhân quả!';
    this.log(`[Kỳ Ngộ] ${narrativeResult}`, 'info');

    // Hiển thị kết quả trong modal
    const container = document.getElementById('modal-event-lines');
    container.innerHTML = `<p class="narrative-line" style="color: #6ee7b7; font-weight: 700;">${narrativeResult}</p>`;
    const choicesBox = document.getElementById('modal-event-choices');
    choicesBox.innerHTML = `<button class="btn-primary-glow" onclick="window.engine.closeEventModal()">Lĩnh Hội Rời Đi</button>`;

    this.savePlayerState();
    this.renderPlayerStats();
  }

  closeEventModal() {
    this.activeEventData = null;
    this.clearNarrativeStream();
    const modal = document.getElementById('event-modal');
    if (modal) modal.classList.remove('open');
    this.renderAll();
  }

  // ====================================================
  // 12. THU THẬP TÀI NGUYÊN & LUYỆN CHẾ (CRAFTING)
  // ====================================================
  async gatherAtNode(nodeId) {
    const node = this.gatheringNodes.find(n => n.id === nodeId);
    if (!node) return;

    if (this.player.fatigue < node.fatigue_cost) {
      return this.notify(`Không đủ thể lực để thu hoạch (cần ${node.fatigue_cost} Thể lực)!`, 'error');
    }

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/life/gather`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ node_id: nodeId }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.characterDetails) {
            this.syncWithBackendDetails(json.data.characterDetails);
          }
          if (json.data.success) {
            this.log(json.data.narrative, 'success');
            this.notify(`Thu hoạch thành công từ ${node.name}!`, 'success');
          } else {
            this.log(json.data.narrative, 'warning');
            this.notify(`Thu hoạch thất bại!`, 'warning');
          }
          this.savePlayerState();
          this.renderAll();
          return;
        } else {
          return this.notify(json.error || 'Lỗi khi thu thập tài nguyên!', 'error');
        }
      } catch (err) {
        console.error('gatherAtNode API error, fallback local:', err);
      }
    }

    this.player.fatigue -= node.fatigue_cost;
    const gainedCult = Math.floor(node.fatigue_cost * 2.5);
    this.addCultivation(gainedCult);

    const dropped = [];
    if (Array.isArray(node.drop_table)) {
      for (const drop of node.drop_table) {
        if (Math.random() <= drop.rate) {
          this.addItemToInventory(drop.item_id, drop.quantity);
          dropped.push(drop);
          await this.notifyLootAcquired(drop.item_id, drop.quantity);
          await this.advanceAgencyMission('GATHER', { itemId: drop.item_id, quantity: drop.quantity });
        }
      }
    }

    this.log(`[Thu Thập] Ngươi hái lượm tại [${node.name}], nhận +${gainedCult} Tu vi và nhặt được ${dropped.length} tài nguyên.`, 'success');
    this.notify(`Thu hoạch thành công từ ${node.name}!`, 'success');

    this.savePlayerState();
    this.renderAll();
  }

  async craftRecipe(recipeId) {
    const rec = this.recipes.find(r => r.id === recipeId);
    if (!rec) return;

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/life/craft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ recipe_id: recipeId }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.characterDetails) {
            this.syncWithBackendDetails(json.data.characterDetails);
          }
          if (json.data.success) {
            this.log(json.data.narrative, 'success');
            this.notify(`Luyện chế thành công!`, 'success');
          } else {
            this.log(json.data.narrative, 'warning');
            this.notify(`Luyện chế thất bại!`, 'warning');
          }
          this.savePlayerState();
          this.renderAll();
          return;
        } else {
          return this.notify(json.error || 'Lỗi khi luyện chế trên máy chủ!', 'error');
        }
      } catch (err) {
        console.error('craftRecipe API error, fallback local:', err);
      }
    }

    // Fallback logic
    for (const ing of rec.ingredients) {
      const slot = this.player.inventory.find(s => s.item_id === ing.item_id);
      if (!slot || slot.quantity < ing.quantity) {
        const itemDef = this.items.get(ing.item_id);
        return this.notify(`Thiếu nguyên liệu: ${itemDef?.name || ing.item_id} (cần ${ing.quantity})!`, 'error');
      }
    }

    for (const ing of rec.ingredients) {
      this.removeItemFromInventory(ing.item_id, ing.quantity);
    }

    let successRate = rec.base_success_rate || 0.8;
    if (this.player.origin === 'THAO_DUOC_DONG' && rec.category === 'ALCHEMY') {
      successRate += 0.2;
    }
    const isSuccess = Math.random() <= successRate;

    if (isSuccess) {
      const out = rec.output;
      this.addItemToInventory(out.item_id, out.quantity);
      this.addCultivation(rec.cultivation_reward || 30);
      const outDef = this.items.get(out.item_id);
      this.log(`[Luyện Chế Thành Công] Đan hương phiêu tán! Ngươi ngưng tụ thành công [${outDef?.name || out.item_id} x${out.quantity}]!`, 'success');
      this.notify(`Luyện chế thành công [${outDef?.name || out.item_id}]!`, 'success');
    } else {
      this.addItemToInventory('item_phe_dan', 1);
      this.log('[Luyện Chế Thất Bại] Dược hỏa mất khống chế, lò luyện bốc khói đen biến thành một viên Phế Đan!', 'warning');
      this.notify('Luyện chế thất bại, đan dược bị khét!', 'warning');
    }

    this.savePlayerState();
    this.renderAll();
  }

  // ====================================================
  // 13. HỆ THỐNG NHIỆM VỤ TU CHÂN & TIÊU CỤC THÁM HIỂM
  // ====================================================
  getQuestStatus(questId) {
    const prog = this.player.quest_progress[questId];
    if (prog?.status) return prog.status;

    const q = this.quests.find(x => x.id === questId);
    if (!q) return 'AVAILABLE';

    // Kiểm tra điều kiện mở khóa nhiệm vụ
    const req = q.requirements || {};
    const pLevel = this.player.level || 1;
    const pRealm = this.player.realm || 'PHAM_NHAN';

    // 1. Kiểm tra Cấp độ
    if (typeof req.min_level === 'number' && pLevel < req.min_level) {
      return 'LOCKED';
    }

    // 2. Kiểm tra Cảnh giới
    if (req.min_realm) {
      const REALM_ORDER = [
        'PHAM_NHAN',
        'LUYEN_KHI_1', 'LUYEN_KHI_2', 'LUYEN_KHI_3', 'LUYEN_KHI_4', 'LUYEN_KHI_5',
        'LUYEN_KHI_6', 'LUYEN_KHI_7', 'LUYEN_KHI_8', 'LUYEN_KHI_9',
        'TRUC_CO_SO_KY', 'TRUC_CO_TRUNG_KY', 'TRUC_CO_HAU_KY', 'TRUC_CO_DINH_PHONG', 'KIM_DAN_SO_KY'
      ];
      const currentIdx = REALM_ORDER.indexOf(pRealm);
      const reqIdx = REALM_ORDER.indexOf(req.min_realm);
      if (currentIdx < reqIdx) {
        return 'LOCKED';
      }
    }

    // 3. Kiểm tra Nhiệm vụ tiền đề
    if (req.prerequisite_quest_id) {
      const prereqProg = this.player.quest_progress[req.prerequisite_quest_id];
      if (!prereqProg || prereqProg.status !== 'COMPLETED') {
        return 'LOCKED';
      }
    }

    return 'AVAILABLE';
  }

  async notifyMonsterKill(monsterId) {
    for (const q of this.quests) {
      const status = this.getQuestStatus(q.id);
      if (status === 'IN_PROGRESS') {
        q.objectives?.forEach(obj => {
          if (obj.type === 'KILL_MONSTER' && obj.target_id === monsterId) {
            const prog = this.player.quest_progress[q.id];
            prog.progress = prog.progress || {};
            prog.progress[obj.id] = (prog.progress[obj.id] || 0) + 1;
            this.log(`[Nhiệm Vụ] [${q.title}] Tiến độ: ${prog.progress[obj.id]}/${obj.required_count}`, 'info');
          }
        });
      }
    }
    this.savePlayerState();
  }

  async notifyLootAcquired(itemId, qty = 1) {
    for (const q of this.quests) {
      const status = this.getQuestStatus(q.id);
      if (status === 'IN_PROGRESS') {
        q.objectives?.forEach(obj => {
          if ((obj.type === 'GATHER_ITEM' || obj.type === 'LOOT_DROP') && obj.target_id === itemId) {
            const prog = this.player.quest_progress[q.id];
            prog.progress = prog.progress || {};
            prog.progress[obj.id] = (prog.progress[obj.id] || 0) + qty;
            this.log(`[Nhiệm Vụ] [${q.title}] Thu thập: ${prog.progress[obj.id]}/${obj.required_count}`, 'info');
          }
        });
      }
    }
    this.savePlayerState();
  }

  async acceptQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (!q) return;

    if (this.getQuestStatus(questId) === 'LOCKED') {
      return this.notify('Chưa đủ điều kiện (Cấp độ/Cảnh giới/Tiền đề) để tiếp nhận nhiệm vụ này!', 'warning');
    }

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/quest/accept`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ quest_id: questId }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          this.player.quest_progress[questId] = {
            status: json.data.progress?.status || 'IN_PROGRESS',
            progress: json.data.progress?.objectives_progress || {},
          };
          this.trackedQuest = q;
          this.log(`[Tiếp Nhận Nhiệm Vụ] Đã nhận: [${q.title}]`, 'success');
          this.notify(`Đã nhận nhiệm vụ: ${q.title}!`, 'success');
          this.savePlayerState();
          this.renderAll();
          return;
        } else {
          return this.notify(json.error || 'Lỗi khi nhận nhiệm vụ trên máy chủ!', 'error');
        }
      } catch (err) {
        console.error('acceptQuest API error, fallback local:', err);
      }
    }

    this.player.quest_progress[questId] = {
      status: 'IN_PROGRESS',
      progress: {},
    };
    this.trackedQuest = q;
    this.log(`[Tiếp Nhận Nhiệm Vụ] Đã nhận: [${q.title}]`, 'success');
    this.notify(`Đã nhận nhiệm vụ: ${q.title}!`, 'success');

    this.savePlayerState();
    this.renderAll();
  }

  async completeQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (!q) return;

    const prog = this.player.quest_progress[questId];
    if (!prog || prog.status !== 'IN_PROGRESS') return;

    const token = this.getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/quest/turnin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify({ quest_id: questId }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.characterDetails) {
            this.syncWithBackendDetails(json.data.characterDetails);
          }
          prog.status = 'COMPLETED';
          this.log(`🎉 [HOÀN TẤT NHIỆM VỤ] [${q.title}]!`, 'success');
          this.notify(`Hoàn tất nhiệm vụ: ${q.title}!`, 'success');
          if (this.trackedQuest?.id === questId) {
            this.trackedQuest = null;
          }
          this.savePlayerState();
          this.renderAll();
          return;
        } else {
          return this.notify(json.error || 'Chưa hoàn tất các yêu cầu của nhiệm vụ!', 'warning');
        }
      } catch (err) {
        console.error('completeQuest API error, fallback local:', err);
      }
    }

    // Kiểm tra hoàn tất điều kiện
    let allDone = true;
    q.objectives?.forEach(obj => {
      const count = prog.progress?.[obj.id] || 0;
      if (count < (obj.required_count || 1)) allDone = false;
    });

    if (!allDone) {
      return this.notify('Chưa hoàn tất các yêu cầu của nhiệm vụ!', 'warning');
    }

    prog.status = 'COMPLETED';

    // Nhận thưởng
    const rew = q.rewards || {};
    if (rew.exp) this.addExp(rew.exp);
    if (rew.cultivation) this.addCultivation(rew.cultivation);
    if (rew.silver) this.player.silver += rew.silver;
    if (Array.isArray(rew.items)) {
      rew.items.forEach(it => this.addItemToInventory(it.item_id, it.quantity));
    }
    if (rew.title) this.player.title = rew.title;

    this.log(`🎉 [HOÀN TẤT NHIỆM VỤ] [${q.title}]! Nhận +${rew.exp || 0} EXP, +${rew.cultivation || 0} Tu vi, +${rew.silver || 0} Bạc.`, 'success');
    this.notify(`Hoàn tất nhiệm vụ: ${q.title}!`, 'success');

    if (this.trackedQuest?.id === questId) {
      this.trackedQuest = null;
    }

    this.savePlayerState();
    this.renderAll();
  }

  async advanceAgencyMission(actionType, payload = {}) {
    if (!this.agencyData?.activeMission) return;
    const m = this.agencyData.activeMission;

    if (actionType === 'TRAVEL' && m.destination_zone_id === payload.currentZoneId) {
      m.progress = 100;
      this.notify(`🎉 Đã áp tiêu an toàn đến ${this.worldData.currentZone?.name}! Hãy bàn giao để nhận thưởng!`, 'success');
    } else if (actionType === 'HUNT' && m.kind === 'HUNT') {
      m.progress = (m.progress || 0) + 50;
    } else if (actionType === 'GATHER' && m.kind === 'GATHERING') {
      m.progress = (m.progress || 0) + 35;
    } else if (actionType === 'ROAM') {
      m.progress = Math.min(100, (m.progress || 0) + 15);
    }
    this.renderAgencyMissionTrackerHud();
  }

  acceptAgencyMission(missionId) {
    const m = this.agencyData?.availableMissions?.find(x => x.id === missionId);
    if (!m) return;
    this.agencyData.activeMission = { ...m, progress: 0 };
    this.log(`[Tiêu Cục Giang Hồ] Đã tiếp nhận chuyến tiêu: [${m.title}]!`, 'success');
    this.notify(`Đã nhận áp tiêu: ${m.title}!`, 'success');
    this.renderAll();
  }

  completeAgencyMission() {
    if (!this.agencyData?.activeMission) return;
    const m = this.agencyData.activeMission;
    this.player.silver += m.reward_silver || 100;
    this.addCultivation(m.reward_cultivation || 50);
    this.agencyData.reputation = (this.agencyData.reputation || 0) + (m.reward_reputation || 20);
    this.agencyData.activeMission = null;

    this.log(`[Bàn Giao Tiêu Cục] Hoàn tất chuyến tiêu [${m.title}]! Nhận Bạc và Danh vọng Tiêu Sư!`, 'success');
    this.notify('Bàn giao tiêu cục đại thành!', 'success');
    this.renderAll();
  }

  openAgencyDrawer() {
    const modal = document.getElementById('agency-drawer-modal');
    if (!modal) return;
    const content = document.getElementById('drawer-mission-content');
    const m = this.agencyData?.activeMission;
    if (!m) {
      content.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">Hiện không có chuyến tiêu nào đang áp tải. Hãy đến Bảng Tiêu Cục tiếp nhận ủy thác!</div>`;
    } else {
      content.innerHTML = `
        <div class="combatant-card">
          <strong style="color: #6ee7b7; font-size: 1rem;">${m.title}</strong>
          <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 4px;">${m.description}</div>
          <div style="font-size: 0.75rem; color: #fbbf24; margin-top: 6px;">Thưởng: ${m.reward_silver} Bạc, ${m.reward_cultivation} Tu vi</div>
          <div class="meter-track" style="margin-top: 8px;">
            <div class="meter-fill" style="width: ${m.progress || 0}%; background: #10b981;"></div>
          </div>
          ${(m.progress >= 100) 
            ? `<button class="btn-primary-glow" style="margin-top: 10px;" onclick="window.engine.completeAgencyMission(); window.engine.closeAgencyDrawer();">Bàn Giao Kiện Hàng 🎁</button>` 
            : `<div style="font-size: 0.72rem; color: #f87171; margin-top: 8px;">Đang áp tải hàng hóa trên lộ trình...</div>`}
        </div>
      `;
    }
    modal.classList.add('open');
  }

  closeAgencyDrawer() {
    const modal = document.getElementById('agency-drawer-modal');
    if (modal) modal.classList.remove('open');
  }

  // ====================================================
  // 14. QUẢN LÝ TÚI ĐỒ & SỬ DỤNG VẬT PHẨM
  // ====================================================
  addItemToInventory(itemId, qty = 1) {
    const slot = this.player.inventory.find(s => s.item_id === itemId);
    if (slot) {
      slot.quantity += qty;
    } else {
      this.player.inventory.push({ item_id: itemId, quantity: qty });
    }
  }

  removeItemFromInventory(itemId, qty = 1) {
    const slotIndex = this.player.inventory.findIndex(s => s.item_id === itemId);
    if (slotIndex >= 0) {
      this.player.inventory[slotIndex].quantity -= qty;
      if (this.player.inventory[slotIndex].quantity <= 0) {
        this.player.inventory.splice(slotIndex, 1);
      }
    }
  }

  useItem(itemId) {
    const def = this.items.get(itemId);
    if (!def) return;

    if (def.type === 'EQUIPMENT') {
      return this.equipItem(itemId);
    }

    if (def.type !== 'PILL') {
      return this.notify('Chỉ đan dược mới có thể trực tiếp phục dụng!', 'info');
    }

    const token = this.getAuthToken();
    if (token) {
      fetch(`${this.apiBase}/api/xianxia/gameplay/equipment/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ item_id: itemId })
      }).then(res => res.json()).then(json => {
        if (!json.success) {
          this.notify(json.error || 'Lỗi khi sử dụng đan dược trên máy chủ.', 'error');
        } else {
          this.syncWithBackendDetails(json.data?.characterDetails);
          this.log(`Phục dụng [${def.name}] thành công (Máy chủ xác thực)!`, 'success');
          this.notify(`Đã phục dụng ${def.name}!`, 'success');
        }
      }).catch(err => {
        this.localUseItem(def, itemId);
      });
      return;
    }

    this.localUseItem(def, itemId);
  }

  localUseItem(def, itemId) {
    if (def.effects?.health_restore) {
      this.player.health = Math.min(this.player.max_health, this.player.health + def.effects.health_restore);
      this.log(`Phục dụng [${def.name}], hồi phục ${def.effects.health_restore} Khí Huyết.`, 'success');
    }

    if (def.effects?.fatigue_restore) {
      this.player.fatigue = Math.min(this.player.max_fatigue, this.player.fatigue + def.effects.fatigue_restore);
      this.log(`Phục dụng [${def.name}], hồi phục ${def.effects.fatigue_restore} Thể Lực.`, 'success');
    }

    if (def.effects?.cultivation_boost) {
      this.addCultivation(def.effects.cultivation_boost);
    }

    this.removeItemFromInventory(itemId, 1);
    this.savePlayerState();
    this.renderPlayerStats();
    this.renderInventory();
  }

  // ====================================================
  // 15. RENDER GIAO DIỆN CỐT LÕI (4 TAB STREAMLINED)
  // ====================================================
  async setTab(tab) {
    // Tự động map các tab cũ sang 4 tab cốt lõi
    const tabMap = {
      explore: 'action',
      map: 'action',
      bestiary: 'action',
      gathering: 'action',
      quests: 'quest',
      agency: 'quest',
      crafting: 'life',
      action: 'action',
      quest: 'quest',
      life: 'life',
      character: 'character',
    };

    const finalTab = tabMap[tab] || 'action';
    this.activeMainTab = finalTab;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === finalTab);
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === finalTab);
    });
    document.querySelectorAll('.bnav-item[data-bnav]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-bnav') === finalTab);
    });

    this.renderMainContent();
  }

  renderAll() {
    this.renderPlayerStats();
    this.renderZoneNavigator();
    this.renderLocationPlaces();
    this.renderMainContent();
    this.renderInventory();
    this.renderChronicleLogs();
    this.renderAgencyMissionTrackerHud();
    this.updateSmartGuide();
  }

  renderPlayerStats() {
    const p = this.player;
    const nameEl = document.getElementById('stat-player-name');
    if (nameEl) nameEl.textContent = p.name;
    const titleEl = document.getElementById('stat-player-title');
    if (titleEl) titleEl.textContent = p.title;
    const realmEl = document.getElementById('stat-player-realm');
    if (realmEl) realmEl.textContent = this.getRealmName(p.realm);

    // Level
    const levelEl = document.getElementById('stat-player-level');
    if (levelEl) levelEl.textContent = `Cấp ${p.level || 1}`;

    // EXP Bar (Kinh Nghiệm Thể Phách)
    const expReq = p.exp_required || this.calcExpRequired(p.level || 1);
    const expCur = p.exp || 0;
    const isMaxLvl = (p.level || 1) >= 100;
    const expPct = isMaxLvl ? 100 : Math.min(100, Math.floor((expCur / expReq) * 100));
    const expText = document.getElementById('stat-exp-text');
    if (expText) {
      expText.textContent = isMaxLvl ? 'MAX (Đỉnh Phong)' : `${expCur} / ${expReq} (${expPct}%)`;
    }
    const expBar = document.getElementById('stat-exp-bar');
    if (expBar) expBar.style.width = `${expPct}%`;

    // HP Bar
    const hpPct = Math.min(100, Math.floor((p.health / p.max_health) * 100));
    const hpText = document.getElementById('stat-hp-text');
    if (hpText) hpText.textContent = `${p.health} / ${p.max_health}`;
    const hpBar = document.getElementById('stat-hp-bar');
    if (hpBar) hpBar.style.width = `${hpPct}%`;

    // Fatigue Bar
    const fatPct = Math.min(100, Math.floor((p.fatigue / p.max_fatigue) * 100));
    const fatText = document.getElementById('stat-fatigue-text');
    if (fatText) fatText.textContent = `${p.fatigue} / ${p.max_fatigue}`;
    const fatBar = document.getElementById('stat-fatigue-bar');
    if (fatBar) fatBar.style.width = `${fatPct}%`;

    // Cultivation Bar
    const cultPct = Math.min(100, Math.floor((p.cultivation / p.cultivation_required) * 100));
    const cultText = document.getElementById('stat-cult-text');
    if (cultText) cultText.textContent = `${p.cultivation} / ${p.cultivation_required} (${cultPct}%)`;
    const cultBar = document.getElementById('stat-cult-bar');
    if (cultBar) {
      cultBar.style.width = `${cultPct}%`;
      if (cultPct >= 100) {
        cultBar.style.boxShadow = '0 0 14px rgba(245, 158, 11, 0.8)';
      } else {
        cultBar.style.boxShadow = 'none';
      }
    }

    // Attributes
    const physEl = document.getElementById('stat-physique');
    if (physEl) physEl.textContent = p.physique;
    const compEl = document.getElementById('stat-comprehension');
    if (compEl) compEl.textContent = p.comprehension;
    const luckEl = document.getElementById('stat-luck');
    if (luckEl) luckEl.textContent = p.luck;
    const silvEl = document.getElementById('stat-silver');
    if (silvEl) silvEl.textContent = p.silver;
    const karmaEl = document.getElementById('stat-karma');
    if (karmaEl) {
      let karmaText = '☯️ Tiêu Dao (0)';
      let karmaColor = '#fbbf24';
      if (p.karma > 0) {
        karmaText = `🕊️ Tiên Đạo (+${p.karma})`;
        karmaColor = '#34d399';
      } else if (p.karma < 0) {
        karmaText = `🩸 Ma Đạo (${p.karma})`;
        karmaColor = '#f87171';
      }
      karmaEl.textContent = karmaText;
      karmaEl.style.color = karmaColor;
      karmaEl.style.fontWeight = '700';
    }
  }

  renderMainContent() {
    switch (this.activeMainTab) {
      case 'action':
        this.renderActionView();
        break;
      case 'quest':
        this.renderQuestView();
        break;
      case 'life':
        this.renderLifeView();
        break;
      case 'character':
        this.renderCharacterView();
        break;
      default:
        this.renderActionView();
    }
  }

  // TAB 1: 🧭 HÀNH ĐỘNG & THÁM HIỂM (Tích hợp Sơn Thủy, Di Chuyển, Thu Thập & Dị Thú)
  renderActionView() {
    const view = document.getElementById('main-tab-view');
    if (!view) return;
    const z = this.worldData.currentZone;
    const p = this.worldData.currentPlace;

    // Lọc dị thú trong khu vực
    const zoneMonsters = this.monsters.filter(m => m.zone_id === z?.id);
    // Lọc bãi thu thập trong khu vực
    const zoneNodes = this.gatheringNodes.filter(n => n.zone_id === z?.id);

    view.innerHTML = `
      <div class="explore-hero">
        <div class="hero-header">
          <h3>🧭 Vấn Đạo Giang Hồ - Thám Hiểm Phân Khu</h3>
          <span class="location-badge">Hiện tại: ${z ? z.name : ''} / ${p ? p.name : ''}</span>
        </div>
        <p class="hero-desc">
          ${z?.description || 'Càn khôn vô tận, tiên lộ mịt mờ. Bước chân ra khỏi động phủ khám phá sơn xuyên để tìm kiếm linh thảo, gặp gỡ tàn tích tiền nhân, kết duyên cùng kỳ hiệp hoặc trảm sát yêu thú hung bạo.'}
        </p>
        <div class="explore-actions">
          <button class="btn-primary-glow" onclick="window.engine.exploreCurrentZone()">
            🧭 Thám Hiểm Ngay (-${z?.fatigue_cost_roam || 5} Thể lực)
          </button>
          <button class="btn-secondary" onclick="window.engine.meditateRest()">
            🧘 Đả Tọa Nhập Định (Hồi phục HP &amp; Thể lực)
          </button>
        </div>
      </div>

      <!-- DỊ THÚ TRONG VÙNG (TURN-BASED COMBAT) -->
      <div style="margin-top: 18px;">
        <h4 style="font-family: var(--font-serif); font-size: 1.05rem; color: #fca5a5; display: flex; align-items: center; gap: 8px;">
          <span>🐉 Dị Thú Lảng Vảng Trong Phân Khu</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 10px;">
          ${zoneMonsters.length === 0 ? '<div style="color: #64748b; font-size: 0.8rem;">Vùng này yên bình, không phát hiện yêu thú hung bạo.</div>' : 
            zoneMonsters.map(m => `
              <div class="combatant-card monster-side">
                <div style="display: flex; gap: 10px; align-items: center;">
                  <img src="${m.avatar}" class="combatant-avatar" onerror="this.onerror=null; this.src='/assets/xianxia/monsters/tho_lang.webp'"/>
                  <div>
                    <strong style="color: #fff; font-size: 0.9rem;">${m.name}</strong>
                    <div style="font-size: 0.72rem; color: #f87171;">${this.getMonsterTierName(m.tier)} • HP: ${m.max_health}</div>
                    <div style="font-size: 0.7rem; color: #94a3b8;">Công: ${m.attack} | Thủ: ${m.defense}</div>
                  </div>
                </div>
                <button class="btn-battle-act btn-battle-strike" style="margin-top: 8px; text-align: center; padding: 6px;" onclick="window.engine.startBattle('${m.id}')">
                  ⚔️ Khiêu Chiến (Chiến Đấu Theo Lượt)
                </button>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- BÃI THU THẬP LINH THẢO / KHOÁNG SẢN -->
      <div style="margin-top: 18px;">
        <h4 style="font-family: var(--font-serif); font-size: 1.05rem; color: #6ee7b7; display: flex; align-items: center; gap: 8px;">
          <span>🌿 Bãi Linh Thảo &amp; Quặng Mỏ Tự Nhiên</span>
        </h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; margin-top: 10px;">
          ${zoneNodes.length === 0 ? '<div style="color: #64748b; font-size: 0.8rem;">Chưa phát hiện linh huyệt tài nguyên nào.</div>' :
            zoneNodes.map(n => `
              <div class="combatant-card" style="border-color: rgba(16, 185, 129, 0.3);">
                <strong style="color: #a7f3d0; font-size: 0.88rem;">${n.name}</strong>
                <div style="font-size: 0.75rem; color: #94a3b8; margin: 4px 0;">${n.description}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                  <span style="font-size: 0.72rem; color: var(--amber-400);">-${n.fatigue_cost} Thể Lực</span>
                  <button class="btn-primary-glow" style="padding: 5px 12px; font-size: 0.75rem;" onclick="window.engine.gatherAtNode('${n.id}')">Hái Lượm</button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `;
  }

  // TAB 2: 📜 NHIỆM VỤ & TIÊU CỤC (Nhiệm Vụ Tu Chân & Bảng Áp Tiêu Giang Hồ)
  setQuestCategory(cat) {
    this.selectedQuestCategory = cat;
    this.renderQuestView();
  }

  setTrackedQuest(questId) {
    const q = this.quests.find(x => x.id === questId);
    if (!q) return;
    this.trackedQuest = q;
    this.renderTrackedQuestHud();
    this.notify(`Đã ghim nhiệm vụ: [${q.title}] lên Thanh Định Hướng!`, 'success');
  }

  interactQuestObjective(questId, objId, actionType) {
    const q = this.quests.find(x => x.id === questId);
    if (!q) return;
    const prog = this.player.quest_progress[questId];
    if (!prog || prog.status !== 'IN_PROGRESS') {
      return this.notify('Nhiệm vụ chưa được tiếp nhận!', 'warning');
    }

    if (!prog.progress) prog.progress = {};
    const obj = q.objectives?.find(o => o.id === objId);
    const req = obj?.required_count || 1;
    prog.progress[objId] = req;

    if (actionType === 'TALK_NPC') {
      this.log(`💬 [Đàm Đạo] Ngươi tiến lại gần ${obj?.target_name || 'NPC'}, lắng nghe chân lý khai sáng đạo tâm!`, 'success');
      this.notify(`Đã đàm đạo cùng ${obj?.target_name || 'NPC'} thành công!`, 'success');
    } else {
      this.notify('Đã hoàn thành mục tiêu nhiệm vụ!', 'success');
    }

    // Kiểm tra tất cả mục tiêu
    const allDone = q.objectives?.every(o => (prog.progress[o.id] || 0) >= (o.required_count || 1));
    if (allDone) {
      this.notify(`✨ Nhiệm vụ [${q.title}] đã hoàn thành tất cả mục tiêu! Hãy bàn giao để nhận thưởng!`, 'success');
    }

    this.savePlayerState();
    this.renderAll();
  }

  openQuestQuizModal(questId, objId) {
    const q = this.quests.find(x => x.id === questId);
    const obj = q?.objectives?.find(o => o.id === objId);
    if (!obj || !obj.quiz_options) return;

    let modal = document.getElementById('quest-quiz-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'quest-quiz-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="wuxia-panel-card" style="max-width: 480px; width: 100%; border: 1px solid var(--gold-400); box-shadow: 0 0 30px rgba(0,0,0,0.9);">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:10px;margin-bottom:14px;">
          <h4 style="margin:0;font-family:var(--font-serif);color:#fef08a;">❓ Khảo Nghiệm Dược Lý &amp; Đan Đạo</h4>
          <button class="btn-wuxia-link" style="font-size:1.1rem;padding:2px 8px;" onclick="document.getElementById('quest-quiz-modal').style.display='none'">✕</button>
        </div>
        <p style="font-size:0.86rem;color:#e2e8f0;line-height:1.6;margin-bottom:16px;">${obj.quiz_question}</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${obj.quiz_options.map((opt, idx) => `
            <button class="wuxia-subtab-btn" style="text-align:left;padding:10px 14px;font-size:0.82rem;" onclick="window.engine.submitQuestQuiz('${questId}', '${objId}', ${idx})">
              ${opt.text}
            </button>
          `).join('')}
        </div>
        <div id="quiz-modal-feedback" style="font-size:0.78rem;text-align:center;min-height:18px;"></div>
      </div>
    `;
    modal.style.display = 'flex';
  }

  submitQuestQuiz(questId, objId, selectedIndex) {
    const q = this.quests.find(x => x.id === questId);
    const obj = q?.objectives?.find(o => o.id === objId);
    if (!obj) return;

    const fb = document.getElementById('quiz-modal-feedback');
    if (selectedIndex === obj.quiz_correct_index) {
      if (fb) {
        fb.innerHTML = '<span style="color:#34d399;font-weight:700;">✨ Chính xác! Trần Dược Sư vuốt râu tán thưởng!</span>';
      }
      setTimeout(() => {
        const modal = document.getElementById('quest-quiz-modal');
        if (modal) modal.style.display = 'none';
        this.interactQuestObjective(questId, objId, 'ANSWER_QUIZ');
      }, 700);
    } else {
      if (fb) {
        fb.innerHTML = '<span style="color:#f87171;">❌ Đáp án chưa đúng! Hãy nhớ lại kiến thức về Trúc Cơ Đan.</span>';
      }
      this.notify('Đáp án chưa chính xác, hãy chọn lại!', 'warning');
    }
  }

  huntQuestTarget(questId, targetId) {
    this.setTrackedQuest(questId);
    this.setTab('action');
    this.notify('Đang tiến về khu vực dã ngoại để săn quái!', 'info');
    if (this.player.fatigue >= 12) {
      this.exploreCurrentZone();
    }
  }

  // TAB 2: 📜 NHIỆM VỤ & TIÊU CỤC (Nhiệm Vụ Tu Chân & Bảng Áp Tiêu Giang Hồ)
  renderQuestView() {
    const view = document.getElementById('main-tab-view');
    if (!view) return;

    if (!this.selectedQuestCategory) {
      this.selectedQuestCategory = 'ALL';
    }

    const currentCat = this.selectedQuestCategory;

    // Lọc danh sách nhiệm vụ
    let filteredQuests = this.quests;
    if (currentCat === 'MAIN_STORY') {
      filteredQuests = this.quests.filter(q => q.type === 'MAIN_STORY' || q.category === 'CHINH_TUYEN');
    } else if (currentCat === 'SIDE_QUEST') {
      filteredQuests = this.quests.filter(q => q.type === 'SIDE_QUEST' || q.category === 'THINH_CAU' || q.category === 'CAY_CUOC');
    }

    const totalCount = this.quests.length;
    const mainCount = this.quests.filter(q => q.type === 'MAIN_STORY' || q.category === 'CHINH_TUYEN').length;
    const sideCount = this.quests.filter(q => q.type === 'SIDE_QUEST' || q.category === 'THINH_CAU' || q.category === 'CAY_CUOC').length;

    view.innerHTML = `
      <!-- TIÊU ĐỀ & THANH ĐIỀU HƯỚNG SUB-TABS -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-bottom: 12px;">
        <h3 style="margin: 0; font-family: var(--font-serif); color: #fef08a; display: flex; align-items: center; gap: 8px;">
          <span>📜</span> Tuyến Nhiệm Vụ Tu Chân
        </h3>
        <button class="btn-primary-glow btn-plaque" style="padding: 6px 14px; font-size: 0.78rem;" onclick="window.engine.openAgencyDrawer()">
          🛡️ Mở Bảng Tiêu Cục
        </button>
      </div>

      <!-- THANH PHÂN LOẠI DANH MỤC (SUB-TABS BAR) -->
      <div class="wuxia-subtab-bar">
        <button class="wuxia-subtab-btn ${currentCat === 'ALL' ? 'active' : ''}" onclick="window.engine.setQuestCategory('ALL')">
          📜 Tất Cả (${totalCount})
        </button>
        <button class="wuxia-subtab-btn ${currentCat === 'MAIN_STORY' ? 'active' : ''}" onclick="window.engine.setQuestCategory('MAIN_STORY')">
          ⚔️ Chính Tuyến (${mainCount})
        </button>
        <button class="wuxia-subtab-btn ${currentCat === 'SIDE_QUEST' ? 'active' : ''}" onclick="window.engine.setQuestCategory('SIDE_QUEST')">
          🌿 Thỉnh Cầu (${sideCount})
        </button>
        <button class="wuxia-subtab-btn ${currentCat === 'AGENCY' ? 'active' : ''}" onclick="window.engine.setQuestCategory('AGENCY')">
          🛡️ Tiêu Cục Tứ Hải
        </button>
      </div>

      <!-- NỘI DUNG HIỂN THỊ THEO TAB ĐƯỢC CHỌN -->
      ${currentCat === 'AGENCY' ? this.renderAgencySubtabView() : `
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${filteredQuests.length === 0 ? `
            <div style="text-align: center; padding: 30px; color: var(--color-text-dim);">
              Chưa có nhiệm vụ nào trong danh mục này.
            </div>
          ` : filteredQuests.map(q => {
            const status = this.getQuestStatus(q.id);
            const isDone = status === 'COMPLETED';
            const isInProg = status === 'IN_PROGRESS';
            const isLocked = status === 'LOCKED';
            const isMain = q.type === 'MAIN_STORY' || q.category === 'CHINH_TUYEN';
            const prog = this.player.quest_progress[q.id] || {};

            // Kiểm tra xem tất cả mục tiêu đã hoàn tất chưa
            let allObjectivesDone = true;
            if (isInProg && q.objectives && q.objectives.length > 0) {
              allObjectivesDone = q.objectives.every(obj => {
                const count = prog.progress?.[obj.id] || 0;
                return count >= (obj.required_count || 1);
              });
            }

            // Điều kiện mở khóa
            let reqItems = [];
            if (q.requirements) {
              if (q.requirements.min_realm) {
                const isRealmMet = this.isRealmSatisfied ? this.isRealmSatisfied(q.requirements.min_realm) : true;
                reqItems.push(`<span style="color: ${isRealmMet ? '#34d399' : '#f87171'}">Cảnh giới: ${this.getRealmName(q.requirements.min_realm)}</span>`);
              }
              if (q.requirements.min_level) {
                const isLvlMet = this.player.level >= q.requirements.min_level;
                reqItems.push(`<span style="color: ${isLvlMet ? '#34d399' : '#f87171'}">Cấp ${q.requirements.min_level}</span>`);
              }
              if (q.requirements.prerequisite_quest_id) {
                const prereqDone = this.player.quest_progress[q.requirements.prerequisite_quest_id]?.status === 'COMPLETED';
                reqItems.push(`<span style="color: ${prereqDone ? '#34d399' : '#f87171'}">Tiền đề: ${q.requirements.prerequisite_quest_id}</span>`);
              }
            }

            // Trạng thái badge
            let statusBadge = '';
            let cardStatusClass = '';
            if (isDone) {
              statusBadge = '<span class="wuxia-badge-status completed">✨ CÔNG ĐỨC VIÊN MÃN</span>';
              cardStatusClass = 'completed';
            } else if (isInProg) {
              if (allObjectivesDone) {
                statusBadge = '<span class="wuxia-badge-status ready">🎯 SẴN SÀNG BÀN GIAO</span>';
                cardStatusClass = 'ready-turnin';
              } else {
                statusBadge = '<span class="wuxia-badge-status in-progress">⚡ ĐANG THỰC HIỆN</span>';
                cardStatusClass = 'in-progress';
              }
            } else if (isLocked) {
              statusBadge = '<span class="wuxia-badge-status locked">🔒 CHƯA MỞ KHÓA</span>';
            } else {
              statusBadge = '<span class="wuxia-badge-status available">📜 CÓ THỂ TIẾP NHẬN</span>';
            }

            return `
              <div class="quest-panel-card ${isMain ? 'main-story' : 'side-quest'} ${cardStatusClass}">
                <!-- HEADER THẺ -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="${isMain ? 'wuxia-badge-main' : 'wuxia-badge-side'}">${isMain ? 'CHÍNH TUYẾN' : 'THỈNH CẦU'}</span>
                      <strong style="font-size: 0.96rem; font-family: var(--font-serif); color: ${isDone ? '#94a3b8' : '#f8fafc'};">${q.title}</strong>
                    </div>
                    <div style="font-size: 0.73rem; color: #fbbf24; margin-top: 4px;">
                      Ủy Thác: <span style="color: #fef08a;">${q.giver_npc_name || 'NPC Tiên Giới'}</span>
                      ${reqItems.length > 0 ? ` • ${reqItems.join(' • ')}` : ''}
                    </div>
                  </div>
                  <div>${statusBadge}</div>
                </div>

                <!-- TÓM TẮT CỐT TRUYỆN -->
                <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin: 10px 0 8px 0;">
                  ${q.summary}
                </div>

                <!-- MỤC TIÊU & THANH TIẾN ĐỘ -->
                ${q.objectives && q.objectives.length > 0 ? `
                  <div style="margin: 8px 0;">
                    ${q.objectives.map(obj => {
                      const count = prog.progress?.[obj.id] || 0;
                      const req = obj.required_count || 1;
                      const pct = Math.min(100, Math.round((count / req) * 100));
                      const isObjDone = count >= req;
                      return `
                        <div class="quest-obj-row">
                          <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                            <span style="color: ${isObjDone ? '#34d399' : '#e2e8f0'};">
                              ${isObjDone ? '✔️' : '🎯'} ${obj.description}
                            </span>
                            <span style="font-weight: 700; color: ${isObjDone ? '#34d399' : '#f59e0b'};">
                              ${count}/${req}
                            </span>
                          </div>
                          <div class="quest-obj-progress-track">
                            <div class="quest-obj-progress-fill ${isObjDone ? 'done' : 'pending'}" style="width: ${pct}%;"></div>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                <!-- PHẦN THƯỞNG -->
                <div style="font-size: 0.74rem; color: #94a3b8; background: rgba(0,0,0,0.2); padding: 6px 10px; border-radius: 4px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                  <span>🎁 <strong>Phần Thưởng:</strong></span>
                  <span style="color: #38bdf8;">+${q.rewards?.exp || 0} EXP</span>
                  <span style="color: #6ee7b7;">+${q.rewards?.cultivation || 0} Tu Vi</span>
                  <span style="color: #fde047;">+${q.rewards?.silver || 0} Bạc</span>
                  ${Array.isArray(q.rewards?.items) ? q.rewards.items.map(it => {
                    const itDef = this.items?.get(it.item_id);
                    return `<span style="color: #f472b6;">+${it.quantity}x ${itDef?.name || it.item_name || it.item_id}</span>`;
                  }).join(' ') : ''}
                  ${q.rewards?.title ? `<span style="color: #c084fc; font-weight: 700;">Danh hiệu: [${q.rewards.title}]</span>` : ''}
                </div>

                <!-- THANH HÀNH ĐỘNG THÔNG MINH -->
                <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    ${isInProg ? `
                      <button class="btn-plaque" style="padding: 5px 10px; font-size: 0.72rem; color: #fbbf24;" onclick="window.engine.setTrackedQuest('${q.id}')">
                        📌 Ghim Tracker
                      </button>
                    ` : ''}
                    ${isInProg && !allObjectivesDone && q.objectives ? q.objectives.map(obj => {
                      if ((prog.progress?.[obj.id] || 0) >= (obj.required_count || 1)) return '';
                      if (obj.type === 'TALK_NPC') {
                        return `<button class="btn-plaque" style="padding: 5px 12px; font-size: 0.74rem;" onclick="window.engine.interactQuestObjective('${q.id}', '${obj.id}', 'TALK_NPC')">💬 Đàm Đạo</button>`;
                      }
                      if (obj.type === 'ANSWER_QUIZ') {
                        return `<button class="btn-plaque" style="padding: 5px 12px; font-size: 0.74rem; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff;" onclick="window.engine.openQuestQuizModal('${q.id}', '${obj.id}')">❓ Khảo Nghiệm</button>`;
                      }
                      if (obj.type === 'KILL_MONSTER') {
                        return `<button class="btn-plaque" style="padding: 5px 12px; font-size: 0.74rem;" onclick="window.engine.huntQuestTarget('${q.id}', '${obj.target_id}')">⚔️ Săn Quái</button>`;
                      }
                      return '';
                    }).join('') : ''}
                  </div>

                  <div>
                    ${isDone ? `
                      <div style="color: #34d399; font-size: 0.76rem; font-weight: 700;">✨ Công đức viên mãn</div>
                    ` : (isInProg ? `
                      <button class="btn-primary-glow btn-plaque" style="padding: 6px 16px; font-size: 0.76rem; ${allObjectivesDone ? 'background: linear-gradient(135deg, #059669, #10b981); color: #fff; font-weight: 700;' : ''}" onclick="window.engine.completeQuest('${q.id}')">
                        ${allObjectivesDone ? 'Bàn Giao Nhiệm Vụ ✔️' : 'Kiểm Tra Bàn Giao 🔍'}
                      </button>
                    ` : (isLocked ? `
                      <button class="btn-wuxia-link" style="padding: 6px 14px; font-size: 0.74rem; opacity: 0.5; cursor: not-allowed;" disabled>
                        🔒 Chưa Đạt Điều Kiện
                      </button>
                    ` : `
                      <button class="btn-primary-glow btn-plaque" style="padding: 6px 16px; font-size: 0.76rem;" onclick="window.engine.acceptQuest('${q.id}')">
                        Tiếp Nhận ➔
                      </button>
                    `))}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  // Render nội dung riêng khi người chơi bấm vào Subtab Tiêu Cục Tứ Hải
  renderAgencySubtabView() {
    const profile = this.agencyData?.userProfile;
    const rank = this.agencyData?.currentRank;
    const active = this.agencyData?.activeMission;

    return `
      <div class="quest-panel-card agency-mission" style="margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span class="wuxia-badge-main" style="background: rgba(245, 158, 11, 0.2); border-color: #f59e0b; color: #fef08a;">TIÊU CỤC TỨ HẢI</span>
            <h4 style="margin: 6px 0 2px 0; font-family: var(--font-serif); color: #fde047;">${rank?.name || 'Tiêu Sư Giang Hồ'}</h4>
            <div style="font-size: 0.75rem; color: #94a3b8;">
              Công Trạng: <strong style="color: #6ee7b7;">${profile?.merit || 0}</strong> • Điểm Tín Dụng: <strong style="color: #38bdf8;">${profile?.credits || 0}</strong>
            </div>
          </div>
          <button class="btn-primary-glow btn-plaque" style="padding: 6px 14px; font-size: 0.75rem;" onclick="window.engine.openAgencyDrawer()">
            Mở Bảng Vận Tiêu 📦
          </button>
        </div>
        <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 10px; line-height: 1.5;">
          ${rank?.perks || 'Nhận ủy thác áp tiêu, chuyển thư mật và săn quái thu thập bạc lộ phí.'}
        </div>
        ${active ? `
          <div style="margin-top: 12px; background: rgba(0,0,0,0.3); border-radius: 4px; padding: 10px; border: 1px solid rgba(245,158,11,0.3);">
            <div style="display: flex; justify-content: space-between; font-size: 0.78rem;">
              <strong style="color: #fef08a;">📦 Ủy thác đang thực hiện: ${active.name || active.missionId}</strong>
              <span class="wuxia-badge-status in-progress">${active.status}</span>
            </div>
          </div>
        ` : `
          <div style="margin-top: 10px; font-size: 0.74rem; color: #94a3b8; font-style: italic;">
            Hiện chưa nhận ủy thác nào. Bấm nút "Mở Bảng Vận Tiêu" để tiếp nhận chuyến tiêu mới!
          </div>
        `}
      </div>
    `;
  }

  // TAB 3: 🌿 SINH HOẠT & TIỆM DƯỢC (Lò Luyện Đan, Lò Rèn & Tiệm Bách Hóa)
  renderLifeView() {
    const view = document.getElementById('main-tab-view');
    if (!view) return;

    view.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-serif); color: #38bdf8;">🔮 Sinh Hoạt Bách Nghệ: Luyện Đan &amp; Đúc Kiếm</h3>
        <button class="btn-primary-glow" style="padding: 6px 14px; font-size: 0.8rem;" onclick="window.engine.openShopModal()">🏪 Tiệm Dược Thảo &amp; Bách Hóa</button>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">
        ${this.recipes.map(r => {
          const out = r.output;
          const outDef = this.items.get(out?.item_id);
          return `
            <div class="combatant-card">
              <strong style="color: #6ee7b7; font-size: 0.92rem;">${r.name}</strong>
              <div style="font-size: 0.75rem; color: #94a3b8; margin: 4px 0;">${r.description}</div>
              <div style="font-size: 0.72rem; color: #fbbf24; margin-bottom: 8px;">
                Nguyên liệu: ${r.ingredients.map(ing => {
                  const it = this.items.get(ing.item_id);
                  const inBag = this.player.inventory.find(s => s.item_id === ing.item_id)?.quantity || 0;
                  const enough = inBag >= ing.quantity;
                  return `<span style="color: ${enough ? '#a7f3d0' : '#f87171'}">${it?.name || ing.item_id} (${inBag}/${ing.quantity})</span>`;
                }).join(', ')}
              </div>
              <button class="btn-primary-glow" style="padding: 6px 12px; font-size: 0.75rem;" onclick="window.engine.craftRecipe('${r.id}')">
                Bắt Đầu Luyện Chế 🔥
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // TAB 4: 🧙 NHÂN VẬT & ĐẠO NGHIỆP (Tiềm Năng, 3 Ô Trang Bị, Tu Vi Treo Máy & Đột Phá)
  renderCharacterView() {
    const view = document.getElementById('main-tab-view');
    if (!view) return;
    const p = this.player;

    const weaponItem = p.equipment?.weapon ? this.items.get(p.equipment.weapon) : null;
    const armorItem = p.equipment?.armor ? this.items.get(p.equipment.armor) : null;
    const relicItem = p.equipment?.relic ? this.items.get(p.equipment.relic) : null;

    view.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px; margin-bottom: 14px;">
        <h3 style="font-family: var(--font-serif); color: #fef08a;">🧙 Đạo Nghiệp Tu Vi &amp; Tiên Thể</h3>
        <button class="btn-primary-glow" style="padding: 6px 14px; font-size: 0.8rem; background: linear-gradient(135deg, #f59e0b, #ef4444);" onclick="window.engine.openBreakthroughModal()">
          ⚡ Xung Quan Đột Phá
        </button>
      </div>

      <!-- THÔNG TIN LINH CĂN & TU LUYỆN TREO MÁY -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div class="combatant-card">
          <span style="font-size: 0.75rem; color: #94a3b8;">Linh Căn &amp; Xuất Thân</span>
          <div style="font-weight: 700; color: #6ee7b7; font-size: 0.9rem; margin-top: 4px;">${this.getLinhCanName(p.linh_can)}</div>
          <div style="font-size: 0.8rem; color: #fbbf24; margin-top: 2px;">${this.getOriginName(p.origin)}</div>
        </div>

        <div class="combatant-card" style="border-color: rgba(56, 189, 248, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: #38bdf8;">Tu Vi Treo Máy Tích Lũy</span>
            <strong style="color: #38bdf8; font-size: 1.1rem;" id="idle-cultivation-amount">+${p.idle_cultivation_bank || 0}</strong>
          </div>
          <button class="btn-primary-glow" style="margin-top: 8px; padding: 6px; font-size: 0.75rem;" onclick="window.engine.claimIdleCultivation()">
            Thu Hoạch Tu Vi Nhập Định 🌟
          </button>
        </div>
      </div>

      <!-- PHÂN BỔ ĐIỂM TIỀM NĂNG -->
      <div style="margin-top: 14px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <strong style="color: #fff; font-size: 0.88rem;">Phân Bổ Điểm Tiềm Năng</strong>
          <span style="color: #fde047; font-weight: 700; font-size: 0.85rem;">Điểm Chưa Dùng: ${p.stat_points || 0}</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div class="stat-dist-row">
            <span>Căn Cốt (Tăng HP &amp; Tấn công vật lý): <b>${p.physique}</b></span>
            ${(p.stat_points > 0) ? `<button class="btn-stat-plus" onclick="window.engine.allocateStatPoint('physique')">+</button>` : ''}
          </div>
          <div class="stat-dist-row">
            <span>Ngộ Tính (Tăng Thần Thông &amp; Tốc độ Tu vi): <b>${p.comprehension}</b></span>
            ${(p.stat_points > 0) ? `<button class="btn-stat-plus" onclick="window.engine.allocateStatPoint('comprehension')">+</button>` : ''}
          </div>
          <div class="stat-dist-row">
            <span>Khí Vận (Tăng Tỉ lệ rơi đồ &amp; Đào tẩu): <b>${p.luck}</b></span>
            ${(p.stat_points > 0) ? `<button class="btn-stat-plus" onclick="window.engine.allocateStatPoint('luck')">+</button>` : ''}
          </div>
        </div>
      </div>

      <!-- 3 Ô TRANG BỊ (VŨ KHÍ, PHÁP Y, PHÁP BẢO) -->
      <div style="margin-top: 14px;">
        <strong style="color: #fff; font-size: 0.88rem;">3 Ô Trang Bị Thần Binh</strong>
        <div class="equip-slots-strip">
          <!-- Vũ khí -->
          <div class="equip-slot-box ${weaponItem ? 'equipped' : ''}">
            <div class="equip-slot-title">⚔️ Vũ Khí</div>
            <div class="equip-slot-name">${weaponItem?.name || 'Chưa Trang Bị'}</div>
            <div style="font-size: 0.7rem; color: #f87171;">${weaponItem ? `+${weaponItem.equipment_stats?.attack || 0} Công` : 'Bàn tay trắng'}</div>
            ${weaponItem ? `<button class="btn-wuxia-link" style="font-size: 0.68rem; padding: 2px 8px;" onclick="window.engine.unequipItem('weapon')">Tháo</button>` : ''}
          </div>

          <!-- Áo giáp -->
          <div class="equip-slot-box ${armorItem ? 'equipped' : ''}">
            <div class="equip-slot-title">🛡️ Pháp Y / Giáp</div>
            <div class="equip-slot-name">${armorItem?.name || 'Chưa Trang Bị'}</div>
            <div style="font-size: 0.7rem; color: #60a5fa;">${armorItem ? `+${armorItem.equipment_stats?.defense || 0} Thủ` : 'Áo vải thô'}</div>
            ${armorItem ? `<button class="btn-wuxia-link" style="font-size: 0.68rem; padding: 2px 8px;" onclick="window.engine.unequipItem('armor')">Tháo</button>` : ''}
          </div>

          <!-- Pháp bảo -->
          <div class="equip-slot-box ${relicItem ? 'equipped' : ''}">
            <div class="equip-slot-title">佩 Pháp Bảo / Linh Châu</div>
            <div class="equip-slot-name">${relicItem?.name || 'Chưa Trang Bị'}</div>
            <div style="font-size: 0.7rem; color: #c084fc;">${relicItem ? `+${relicItem.equipment_stats?.max_qi || 10} Qi` : 'Chưa có bảo vật'}</div>
            ${relicItem ? `<button class="btn-wuxia-link" style="font-size: 0.68rem; padding: 2px 8px;" onclick="window.engine.unequipItem('relic')">Tháo</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ====================================================
  // 16. SIDEBAR: ĐỊA ĐIỂM, TÚI ĐỒ, NHẬT KÝ
  // ====================================================
  renderZoneNavigator() {
    const container = document.getElementById('zone-nav-container');
    if (!container) return;

    const currentZone = this.worldData.currentZone;
    if (!currentZone) {
      container.innerHTML = '';
      return;
    }

    const nameEl = document.getElementById('current-zone-name');
    if (nameEl) nameEl.textContent = currentZone.name;
    const descEl = document.getElementById('current-zone-desc');
    if (descEl) descEl.textContent = currentZone.description;
    const roamCostEl = document.getElementById('current-zone-roam-cost');
    if (roamCostEl) roamCostEl.textContent = `-${currentZone.fatigue_cost_roam || 5} Thể Lực`;

    const connections = currentZone.connections || [];
    if (connections.length === 0) {
      container.innerHTML = `<div style="font-size: 0.75rem; color: var(--color-text-dim); text-align: center; padding: 4px;">Không có lối đi mở rộng.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="font-weight: 700; font-size: 0.8rem; color: var(--color-text-dim); margin: 8px 0 4px 0;">Lối Đi Sang Phân Khu Khác:</div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${connections.map(c => {
          const targetZone = this.worldData.zones.find(z => z.id === c.target_zone_id);
          const targetName = targetZone ? targetZone.name : c.target_zone_id;
          return `
            <button class="btn-travel-map" onclick="window.engine.selectZone('${c.target_zone_id}')">
              🚗 Đến [${targetName}] (-${c.fatigue_cost} Thể Lực)
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  renderLocationPlaces() {
    const list = document.getElementById('location-places-list');
    if (!list) return;
    const places = this.worldData.currentZone?.places || [];
    if (places.length === 0) {
      list.innerHTML = `<div style="font-size: 0.75rem; color: var(--color-text-dim);">Chưa khám phá địa điểm nào.</div>`;
      return;
    }

    list.innerHTML = places.map(p => {
      const isSelected = p.id === this.player.place_id;
      return `
        <div class="combatant-card" style="cursor: pointer; border-color: ${isSelected ? 'rgba(16, 185, 129, 0.6)' : 'var(--border-subtle)'}; background: ${isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent'};" onclick="window.engine.selectPlace('${p.id}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 0.82rem; color: ${isSelected ? '#6ee7b7' : '#fff'};">${p.name}</strong>
            ${isSelected ? '<span style="font-size: 0.7rem; color: #10b981;">Đang ở</span>' : ''}
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">${p.description}</div>
        </div>
      `;
    }).join('');
  }

  renderInventory() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 20; i++) {
      const slotData = this.player.inventory[i];
      const slotEl = document.createElement('div');
      slotEl.className = 'inv-slot';

      if (slotData) {
        const itemDef = this.items.get(slotData.item_id);
        const itemName = itemDef ? itemDef.name : slotData.item_id;
        const iconSrc = itemDef?.icon || '/assets/xianxia/items/thao_moc_linh_chi.webp';
        const rarity = (itemDef?.rarity || 'common').toUpperCase();
        slotEl.classList.add(`rarity-${rarity}`);

        slotEl.innerHTML = `
          <img src="${iconSrc}" class="item-slot-icon" alt="${itemName}" onerror="this.onerror=null; this.src='/assets/xianxia/items/thao_moc_linh_chi.webp'"/>
          <span class="item-slot-qty">${slotData.quantity}</span>
        `;
        slotEl.title = `${itemName} [${rarity}] (x${slotData.quantity}): ${itemDef?.description || ''}`;
        slotEl.setAttribute('tabindex', '0');
        slotEl.setAttribute('role', 'button');
        slotEl.setAttribute('aria-label', `${itemName}, số lượng ${slotData.quantity}`);
        slotEl.onclick = () => this.useItem(slotData.item_id);
        slotEl.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.useItem(slotData.item_id);
          }
        };
      } else {
        slotEl.classList.add('empty');
        slotEl.setAttribute('aria-hidden', 'true');
      }
      fragment.appendChild(slotEl);
    }
    grid.innerHTML = '';
    grid.appendChild(fragment);
  }

  renderChronicleLogs() {
    const box = document.getElementById('chronicle-logs');
    if (!box) return;
    box.innerHTML = this.player.logs.slice(-25).map(l => `
      <div class="log-entry ${l.type || 'info'}">
        <span class="log-time">[${l.time}]</span> ${l.text}
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  }

  renderAgencyMissionTrackerHud() {
    const hud = document.getElementById('agency-mission-tracker-hud');
    if (!hud) return;
    const m = this.agencyData?.activeMission;
    if (!m) {
      hud.style.display = 'none';
      return;
    }
    hud.style.display = 'flex';
    document.getElementById('tracker-agency-title').textContent = m.title;
    document.getElementById('tracker-agency-status').textContent = 
      m.progress >= 100 ? '🎉 ĐÃ ĐẾN ĐÍCH! BÀN GIAO TIÊU CỤC' : `Đang áp tải (${m.progress || 0}%)`;
  }

  log(text, type = 'info') {
    this.player.logs.push({
      time: new Date().toLocaleTimeString(),
      text,
      type,
    });
    this.renderChronicleLogs();
  }

  notify(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '10px 16px';
    notification.style.borderRadius = '8px';
    notification.style.zIndex = '9999';
    notification.style.fontSize = '0.82rem';
    notification.style.fontWeight = '600';
    notification.style.boxShadow = '0 4px 14px rgba(0,0,0,0.5)';
    notification.style.transition = 'all 0.3s ease';

    if (type === 'error') {
      notification.style.background = '#ef4444';
      notification.style.color = '#fff';
    } else if (type === 'success') {
      notification.style.background = '#10b981';
      notification.style.color = '#fff';
    } else if (type === 'warning') {
      notification.style.background = '#f59e0b';
      notification.style.color = '#000';
    } else {
      notification.style.background = '#38bdf8';
      notification.style.color = '#000';
    }

    notification.textContent = msg;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2800);
  }

  // Tương thích ngược với các bài test & giao diện cũ
  huntMonster(monsterId) {
    return this.startBattle(monsterId);
  }

  renderQuestBoard() {
    return this.renderQuestView();
  }

  turnInQuest(questId) {
    return this.completeQuest(questId);
  }

  openQuizModal(questId, objId, questionData) {
    const q = this.quests.find(x => x.id === questId);
    this.log(`[Khảo Nghiệm] Bắt đầu trả lời câu đố của nhiệm vụ [${q?.title || questId}].`, 'info');
    const answer = prompt(questionData?.question || 'Vui lòng nhập câu trả lời:');
    if (answer && answer.trim().length > 0) {
      this.log(`Ngươi đã đưa ra câu trả lời cho khảo nghiệm.`, 'success');
      this.completeQuest(questId);
    }
  }

  openChoiceModal(questId, objId, choiceData) {
    const q = this.quests.find(x => x.id === questId);
    this.log(`[Quyết Định Đạo Tâm] Đưa ra lựa chọn cho nhiệm vụ [${q?.title || questId}].`, 'info');
    this.completeQuest(questId);
  }

  askNpcService(npcId) {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return;
    this.log(`[Hội Thoại] Ngươi đối thoại cùng [${npc.name}]: "${npc.dialogue_greeting || 'Đạo hữu hữu lễ!'}"`, 'info');
    this.notify(`Đã gặp gỡ ${npc.name}!`, 'info');
  }

  // ====================================================
  // PHÂN HỆ BẢNG XẾP HẠNG THIÊN KIÊU (M4.1 LEADERBOARD)
  // ====================================================

  async openLeaderboardModal(page = 1) {
    const modal = document.getElementById('leaderboard-modal');
    if (modal) modal.style.display = 'flex';
    this.leaderboardPage = page;
    await this.fetchAndRenderLeaderboard(page);
  }

  closeLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    if (modal) modal.style.display = 'none';
  }

  async changeLeaderboardPage(delta) {
    if (!this.leaderboardData?.pagination) return;
    const newPage = this.leaderboardPage + delta;
    if (newPage < 1 || newPage > this.leaderboardData.pagination.totalPages) return;
    this.leaderboardPage = newPage;
    await this.fetchAndRenderLeaderboard(newPage);
  }

  async refreshLeaderboard() {
    await this.fetchAndRenderLeaderboard(this.leaderboardPage, true);
  }

  async fetchAndRenderLeaderboard(page = 1, fresh = false) {
    const listEl = document.getElementById('leaderboard-list-container');
    const myRankBanner = document.getElementById('leaderboard-my-rank-banner');
    const pageIndicator = document.getElementById('leaderboard-page-indicator');
    const totalInfo = document.getElementById('leaderboard-total-info');
    const prevBtn = document.getElementById('leaderboard-prev-btn');
    const nextBtn = document.getElementById('leaderboard-next-btn');

    if (listEl) {
      listEl.innerHTML = `
        <div style="text-align: center; color: #fbbf24; padding: 40px; font-family: var(--font-serif);">
          <div style="font-size: 1.6rem; animation: spin 2s linear infinite; display: inline-block;">☯</div>
          <div style="margin-top: 8px;">Đang triệu hoán danh sách thiên kiêu từ càn khôn...</div>
        </div>
      `;
    }

    try {
      const token = this.getAuthToken();
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const url = `${this.apiBase}/api/xianxia/leaderboard?page=${page}&limit=${this.leaderboardLimit}${fresh ? '&fresh=true' : ''}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        throw new Error(`Máy chủ phản hồi mã lỗi HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        throw new Error(json.error || 'Dữ liệu bảng xếp hạng không đúng cấu trúc.');
      }

      this.leaderboardData = json;
      const { data, pagination, myRank } = json;

      // 1. Cập nhật Banner thứ hạng cá nhân
      if (myRankBanner) {
        if (token) {
          if (myRank != null) {
            myRankBanner.innerHTML = `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">🌟</span>
                <div>
                  <div style="font-size: 0.85rem; color: #fff;">Đạo Hữu: <strong style="color: #6ee7b7;">${this.player.name}</strong></div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">${this.getRealmName(this.player.realm)} • Cấp ${this.player.level || 1}</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.7rem; color: #fbbf24;">THỨ HẠNG THIÊN ĐẠO</div>
                <div style="font-family: var(--font-serif); font-size: 1.35rem; font-weight: 700; color: #fef08a;">#${myRank}</div>
              </div>
            `;
          } else {
            myRankBanner.innerHTML = `
              <div style="font-size: 0.8rem; color: #94a3b8;">
                Đạo Hữu: <strong style="color: #fff;">${this.player.name}</strong> • Chưa ghi danh trong cơ sở dữ liệu máy chủ.
              </div>
              <button class="btn-primary-glow" style="padding: 4px 10px; font-size: 0.72rem;" onclick="window.engine.syncRemoteCharacterIfLoggedIn()">Đồng Bộ ⟳</button>
            `;
          }
        } else {
          myRankBanner.innerHTML = `
            <div style="font-size: 0.8rem; color: #cbd5e1;">
              🔒 Đạo hữu đang ngao du vô danh (Chế độ cục bộ). Đăng nhập tài khoản Tiên Lộ để ghi danh trên bảng vàng thiên kiêu!
            </div>
            <span style="font-size: 0.72rem; color: #64748b;">(Chế độ khách xem công khai)</span>
          `;
        }
      }

      // 2. Cập nhật phân trang
      if (pageIndicator) pageIndicator.textContent = `Trang ${pagination.page} / ${pagination.totalPages || 1}`;
      if (totalInfo) totalInfo.textContent = `Tổng số: ${pagination.total} thiên kiêu tu sĩ`;
      if (prevBtn) {
        prevBtn.disabled = !pagination.hasPrev;
        prevBtn.style.opacity = pagination.hasPrev ? '1' : '0.4';
        prevBtn.style.cursor = pagination.hasPrev ? 'pointer' : 'not-allowed';
      }
      if (nextBtn) {
        nextBtn.disabled = !pagination.hasNext;
        nextBtn.style.opacity = pagination.hasNext ? '1' : '0.4';
        nextBtn.style.cursor = pagination.hasNext ? 'pointer' : 'not-allowed';
      }

      // 3. Render danh sách
      if (listEl) {
        if (data.length === 0) {
          listEl.innerHTML = `
            <div style="text-align: center; color: #64748b; padding: 40px; font-size: 0.85rem;">
              Thiên Kiêu Bảng hiện đang trống vắng. Hãy là tu sĩ đầu tiên bước vào tiên lộ!
            </div>
          `;
          return;
        }

        listEl.innerHTML = data.map(item => {
          // Huy hiệu thứ hạng
          let rankBadge = `<span style="font-weight: 700; color: #94a3b8;">#${item.rank}</span>`;
          if (item.rank === 1) {
            rankBadge = `<span style="font-size: 1.1rem; filter: drop-shadow(0 0 6px #f59e0b);" title="Quán Quân Thiên Hạ">🥇</span>`;
          } else if (item.rank === 2) {
            rankBadge = `<span style="font-size: 1.1rem; filter: drop-shadow(0 0 6px #cbd5e1);" title="Á Quân">🥈</span>`;
          } else if (item.rank === 3) {
            rankBadge = `<span style="font-size: 1.1rem; filter: drop-shadow(0 0 6px #b45309);" title="Quý Quân">🥉</span>`;
          }

          // Kiểm tra xem có phải dòng của người chơi hiện tại không
          const isMe = myRank != null && item.rank === myRank;
          const rowBg = isMe
            ? 'background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.45);'
            : 'background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);';

          return `
            <div style="${rowBg} border-radius: var(--radius-sm); padding: 8px 10px; display: grid; grid-template-columns: 50px 1fr 140px 80px 120px; gap: 8px; align-items: center; transition: all 0.2s;">
              <div style="text-align: center;">${rankBadge}</div>
              <div>
                <strong style="color: ${isMe ? '#fbbf24' : '#fff'}; font-size: 0.88rem;">
                  ${item.name} ${isMe ? '<span style="font-size: 0.65rem; color: #6ee7b7; border: 1px solid #10b981; border-radius: 4px; padding: 1px 4px; margin-left: 4px;">Ngươi</span>' : ''}
                </strong>
                <div style="font-size: 0.68rem; color: #64748b;">Tu vi: ${Number(item.cultivation).toLocaleString()} điểm</div>
              </div>
              <div style="text-align: center;">
                <span class="location-badge" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; font-size: 0.72rem;">
                  ${item.realmTitle}
                </span>
              </div>
              <div style="text-align: center; color: #38bdf8; font-size: 0.82rem; font-weight: 700;">
                Cấp ${item.level}
              </div>
              <div style="text-align: right; font-family: var(--font-serif); color: #fde047; font-weight: 700; font-size: 0.88rem;">
                ${Number(item.combatPower).toLocaleString()} <span style="font-size: 0.7rem; color: #fbbf24;">⚡</span>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('[TienLoEngine] Lỗi tải bảng xếp hạng:', err);
      if (listEl) {
        listEl.innerHTML = `
          <div style="text-align: center; color: #f87171; padding: 30px; font-size: 0.85rem;">
            ⚠️ Không thể kết nối với Thiên Đạo bảng xếp hạng.<br>
            <span style="font-size: 0.75rem; color: #94a3b8; margin-top: 6px; display: block;">Chi tiết: ${err.message || 'Lỗi mạng'}</span>
            <button class="btn-wuxia-link" style="margin-top: 10px; padding: 4px 12px; font-size: 0.75rem;" onclick="window.engine.refreshLeaderboard()">Thử lại ⟳</button>
          </div>
        `;
      }
    }
  }

  // ====================================================
  // PHÂN HỆ ĐẤU TRƯỜNG THIÊN KIÊU (M4.2 ASYNC PVP)
  // ====================================================

  openPvpModal() {
    const modal = document.getElementById('pvp-modal');
    if (modal) {
      modal.style.display = 'flex';
      this.updatePvpBanner();
      this.setPvpTab(this.pvpActiveTab || 'opponents');
    }
  }

  closePvpModal() {
    const modal = document.getElementById('pvp-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  updatePvpBanner() {
    const nameEl = document.getElementById('pvp-banner-name');
    const statsEl = document.getElementById('pvp-banner-stats');
    if (nameEl) nameEl.textContent = this.player?.name || 'Tu Sĩ';
    if (statsEl) {
      const rep = this.player?.reputation != null ? this.player.reputation : 100;
      const wins = this.player?.pvp_wins || 0;
      const losses = this.player?.pvp_losses || 0;
      const draws = this.player?.pvp_draws || 0;
      statsEl.textContent = `Danh Vọng: ${rep} • Thắng: ${wins} | Thua: ${losses} | Hòa: ${draws}`;
    }
  }

  setPvpTab(tab) {
    this.pvpActiveTab = tab;
    const tabBtns = {
      opponents: document.getElementById('pvp-tab-opponents'),
      history: document.getElementById('pvp-tab-history'),
      leaderboard: document.getElementById('pvp-tab-leaderboard'),
    };

    Object.keys(tabBtns).forEach((k) => {
      const btn = tabBtns[k];
      if (btn) {
        if (k === tab) {
          btn.style.background = 'rgba(168, 85, 247, 0.25)';
          btn.style.color = '#e9d5ff';
        } else {
          btn.style.background = 'var(--bg-subtle)';
          btn.style.color = 'var(--color-text-muted)';
        }
      }
    });

    if (tab === 'opponents') {
      this.fetchPvpOpponents();
    } else if (tab === 'history') {
      this.fetchPvpHistory();
    } else if (tab === 'leaderboard') {
      this.fetchPvpLeaderboard();
    }
  }

  async fetchPvpOpponents() {
    const container = document.getElementById('pvp-content-container');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; color: #a855f7; padding: 40px; font-size: 0.85rem;">
        ⚡ Đang tìm kiếm các đối thủ xứng tầm trên lôi đài vạn giới...
      </div>
    `;

    try {
      const token = this.getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/pvp/opponents`, { headers });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'Lỗi khi lấy danh sách đối thủ.');
      }

      this.pvpOpponents = json.data || [];
      this.renderPvpOpponents();
    } catch (err) {
      console.error('[TienLoEngine] Lỗi nạp đối thủ PvP:', err);
      container.innerHTML = `
        <div style="text-align: center; color: #f87171; padding: 30px; font-size: 0.85rem;">
          ⚠️ Không thể triệu hoán danh sách đối thủ lôi đài.<br>
          <span style="font-size: 0.75rem; color: #94a3b8; margin-top: 6px; display: block;">${err.message || 'Lỗi kết nối'}</span>
          <button class="btn-wuxia-link" style="margin-top: 10px; padding: 4px 12px; font-size: 0.75rem;" onclick="window.engine.fetchPvpOpponents()">Thử lại ⟳</button>
        </div>
      `;
    }
  }

  renderPvpOpponents() {
    const container = document.getElementById('pvp-content-container');
    if (!container) return;

    if (!this.pvpOpponents || this.pvpOpponents.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 40px; font-size: 0.85rem;">
          Lôi Đài hiện thời chưa có đối thủ phù hợp. Hãy tu luyện thêm và quay lại sau!
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px;">
        ${this.pvpOpponents.map((op) => `
          <div style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: var(--radius-sm); padding: 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="font-weight: 700; color: #f3e8ff; font-size: 0.95rem;">${op.name}</div>
                <span class="location-badge" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; font-size: 0.68rem;">${op.realmTitle}</span>
              </div>
              <div style="display: flex; gap: 8px; font-size: 0.72rem; color: #cbd5e1; margin-top: 4px;">
                <span>Cấp ${op.level}</span>
                <span>•</span>
                <span style="color: #fde047;">⚡ ${Number(op.combatPower).toLocaleString()}</span>
                <span>•</span>
                <span style="color: #c084fc;">Danh Vọng: ${op.reputation}</span>
              </div>
              <div style="font-size: 0.68rem; color: #64748b; margin-top: 4px;">
                Chiến tích: ${op.pvpWins}T / ${op.pvpLosses}B / ${op.pvpDraws}H
              </div>
            </div>

            <button 
              class="btn-wuxia-link" 
              style="width: 100%; padding: 6px 0; background: linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(126, 34, 206, 0.6)); border: 1px solid #c084fc; color: #fff; font-weight: 700; font-size: 0.8rem; cursor: pointer;"
              onclick="window.engine.challengePvpOpponent(${op.id})"
            >
              ⚔️ Khiêu Chiến (10 Thể Lực)
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  async challengePvpOpponent(defenderId) {
    if (this.pvpLoading) return;
    if (this.player && this.player.fatigue < 10) {
      alert('Thể lực của đạo hữu không đủ (cần tối thiểu 10 Thể Lực để lên lôi đài)!');
      return;
    }

    this.pvpLoading = true;
    const container = document.getElementById('pvp-content-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; color: #c084fc; padding: 50px; font-size: 0.9rem;">
          ⚔️ Đang bước lên Lôi Đài Luận Đạo, kết nối thần thức hai bên...
        </div>
      `;
    }

    try {
      const token = this.getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const idempotencyKey = `pvp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/pvp/challenge`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ defenderId, idempotencyKey }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Khiêu chiến thất bại.');
      }

      const matchRes = json.data;

      // Cập nhật lại chỉ số người chơi từ kết quả máy chủ
      if (matchRes.attackerStateAfterBattle && this.player) {
        this.player.fatigue = matchRes.attackerStateAfterBattle.fatigue;
        this.player.reputation = matchRes.attackerStateAfterBattle.reputation;
        this.player.silver = matchRes.attackerStateAfterBattle.silver;
        this.player.pvp_wins = matchRes.attackerStateAfterBattle.pvpWins;
        this.player.pvp_losses = matchRes.attackerStateAfterBattle.pvpLosses;
        this.player.pvp_draws = matchRes.attackerStateAfterBattle.pvpDraws;
        this.savePlayerState();
        this.updatePlayerHUD();
        this.updatePvpBanner();
      }

      // Đóng modal PvP và mở modal chiến đấu phát lại diễn biến
      this.closePvpModal();
      this.renderPvpBattlePlayback(matchRes);
    } catch (err) {
      console.error('[TienLoEngine] Lỗi khiêu chiến PvP:', err);
      alert(`⚠️ ${err.message || 'Không thể khiêu chiến đối thủ.'}`);
      this.fetchPvpOpponents();
    } finally {
      this.pvpLoading = false;
    }
  }

  renderPvpBattlePlayback(matchRes) {
    const battleModal = document.getElementById('battle-modal');
    const logBox = document.getElementById('battle-logs');
    const turnsEl = document.getElementById('battle-turns-count');
    const playerHpBar = document.getElementById('battle-player-hp-bar');
    const monsterHpBar = document.getElementById('battle-monster-hp-bar');
    const monsterNameEl = document.getElementById('battle-monster-name');
    const monsterRealmEl = document.getElementById('battle-monster-realm');

    if (!battleModal || !logBox) {
      alert(`Trận đấu kết thúc: ${matchRes.result === 'ATTACKER_WIN' ? '🏆 ĐẠI THẮNG!' : '💀 CHIẾN BẠI!'}\nDanh vọng: ${matchRes.reputationChange >= 0 ? '+' : ''}${matchRes.reputationChange}\nBạc: +${matchRes.silverReward}`);
      return;
    }

    if (monsterNameEl) monsterNameEl.textContent = `[ĐỐI THỦ] ${matchRes.defender?.name || 'Tu Tiên Giả'}`;
    if (monsterRealmEl) monsterRealmEl.textContent = matchRes.defender?.realmTitle || 'Lôi Đài';

    logBox.innerHTML = '';
    battleModal.style.display = 'flex';

    const turns = matchRes.playbackTurns || [];
    let idx = 0;

    const playNext = () => {
      if (idx >= turns.length) {
        // Kết thúc trình chiếu
        const isWin = matchRes.result === 'ATTACKER_WIN' || matchRes.result === 'DRAW_ADVANTAGE';
        const resultLine = document.createElement('div');
        resultLine.style.cssText = `margin-top: 10px; padding: 10px; border-radius: 6px; font-weight: 700; text-align: center; ${
          isWin ? 'background: rgba(16, 185, 129, 0.2); color: #6ee7b7; border: 1px solid #10b981;' : 'background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid #ef4444;'
        }`;
        resultLine.innerHTML = `
          ${isWin ? '🏆 ĐẠI THẮNG LÔI ĐÀI!' : '💀 CHIẾN BẠI LÔI ĐÀI!'}
          <div style="font-size: 0.8rem; margin-top: 4px; font-weight: 400;">
            Danh Vọng: <strong>${matchRes.reputationChange >= 0 ? '+' : ''}${matchRes.reputationChange}</strong> (Hiện có: ${matchRes.attackerReputationAfter}) • Bạc thưởng: <strong>+${matchRes.silverReward}</strong>
          </div>
          ${matchRes.cappedRewardReason ? `<div style="font-size: 0.72rem; color: #fbbf24; margin-top: 4px;">${matchRes.cappedRewardReason}</div>` : ''}
        `;
        logBox.appendChild(resultLine);
        logBox.scrollTop = logBox.scrollHeight;
        return;
      }

      const t = turns[idx];
      idx++;

      if (turnsEl) turnsEl.textContent = `Hiệp ${t.turn} / ${matchRes.turnsCount}`;
      const pLine = document.createElement('div');
      pLine.style.cssText = 'font-size: 0.78rem; padding: 3px 0; border-bottom: 1px dashed rgba(255,255,255,0.05); color: #e2e8f0;';
      pLine.textContent = t.log;
      logBox.appendChild(pLine);
      logBox.scrollTop = logBox.scrollHeight;

      setTimeout(playNext, 180);
    };

    playNext();
  }

  async fetchPvpHistory() {
    const container = document.getElementById('pvp-content-container');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; color: #94a3b8; padding: 40px; font-size: 0.85rem;">
        Đang nạp lịch sử chiến báo lôi đài...
      </div>
    `;

    try {
      const token = this.getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/pvp/history`, { headers });
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Lỗi khi nạp lịch sử.');
      this.pvpHistory = json.data || [];
      this.renderPvpHistory();
    } catch (err) {
      console.error('[TienLoEngine] Lỗi nạp lịch sử PvP:', err);
      container.innerHTML = `
        <div style="text-align: center; color: #f87171; padding: 30px; font-size: 0.85rem;">
          ⚠️ Không thể lấy lịch sử chiến báo.<br>
          <span style="font-size: 0.75rem; color: #94a3b8; margin-top: 6px; display: block;">${err.message}</span>
        </div>
      `;
    }
  }

  renderPvpHistory() {
    const container = document.getElementById('pvp-content-container');
    if (!container) return;

    if (!this.pvpHistory || this.pvpHistory.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 40px; font-size: 0.85rem;">
          Đạo hữu chưa tham gia trận đấu lôi đài nào. Hãy chọn một đối thủ để giao lưu võ nghệ!
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${this.pvpHistory.map((h) => {
          const isWin = h.isVictory;
          const bg = isWin ? 'background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3);' : 'background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3);';
          const badge = isWin ? '<span style="color: #6ee7b7; font-weight: 700;">🏆 THẮNG</span>' : '<span style="color: #fca5a5; font-weight: 700;">💀 THUA</span>';
          const repText = h.reputationChange !== 0 ? `<span style="color: ${h.reputationChange > 0 ? '#6ee7b7' : '#f87171'}; font-weight: 700;">${h.reputationChange > 0 ? '+' : ''}${h.reputationChange} Danh Vọng</span>` : '';

          return `
            <div style="${bg} border: 1px solid; border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div>${badge}</div>
                <div>
                  <div style="color: #f1f5f9; font-weight: 600;">
                    ${h.role === 'ATTACKER' ? 'Khiêu chiến' : 'Phòng thủ trước'} <strong>${h.opponentName}</strong>
                    <span style="font-size: 0.7rem; color: #94a3b8; margin-left: 4px;">(${h.opponentRealmTitle} - Cấp ${h.opponentLevel})</span>
                  </div>
                  <div style="font-size: 0.68rem; color: #64748b;">
                    ${new Date(h.createdAt).toLocaleString('vi-VN')} • ${h.turnsCount} hiệp kịch chiến
                  </div>
                </div>
              </div>

              <div style="text-align: right; font-size: 0.75rem;">
                <div>${repText}</div>
                ${h.silverReward > 0 ? `<div style="color: #fde047; font-size: 0.7rem;">+${h.silverReward} Bạc</div>` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async fetchPvpLeaderboard() {
    const container = document.getElementById('pvp-content-container');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; color: #fbbf24; padding: 40px; font-size: 0.85rem;">
        🏆 Đang chiêm ngưỡng bảng vàng Danh Vọng Thiên Kiêu...
      </div>
    `;

    try {
      const token = this.getAuthToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${this.apiBase}/api/xianxia/gameplay/pvp/leaderboard`, { headers });
      const json = await res.json();

      if (!json.success) throw new Error(json.error || 'Lỗi nạp bảng danh vọng.');
      this.pvpLeaderboard = json.data || [];
      this.renderPvpLeaderboard(json.myRank);
    } catch (err) {
      console.error('[TienLoEngine] Lỗi BXH Danh Vọng:', err);
      container.innerHTML = `
        <div style="text-align: center; color: #f87171; padding: 30px; font-size: 0.85rem;">
          ⚠️ Không thể nạp Bảng Danh Vọng.<br>
          <span style="font-size: 0.75rem; color: #94a3b8; margin-top: 6px; display: block;">${err.message}</span>
        </div>
      `;
    }
  }

  renderPvpLeaderboard(myRank) {
    const container = document.getElementById('pvp-content-container');
    if (!container) return;

    if (!this.pvpLeaderboard || this.pvpLeaderboard.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #64748b; padding: 40px; font-size: 0.85rem;">
          Bảng Danh Vọng Đấu Trường hiện thời chưa có tu sĩ nào ghi danh.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: grid; grid-template-columns: 50px 1fr 140px 100px 90px; gap: 8px; font-size: 0.72rem; color: #94a3b8; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding: 4px 8px;">
          <span style="text-align: center;">HẠNG</span>
          <span>TU SĨ</span>
          <span style="text-align: center;">CẢNH GIỚI</span>
          <span style="text-align: center;">DANH VỌNG</span>
          <span style="text-align: right;">CHIẾN TÍCH</span>
        </div>
        ${this.pvpLeaderboard.map((item) => {
          let rankBadge = `<span style="font-weight: 700; color: #94a3b8;">#${item.rank}</span>`;
          if (item.rank === 1) rankBadge = '🥇';
          else if (item.rank === 2) rankBadge = '🥈';
          else if (item.rank === 3) rankBadge = '🥉';

          const isMe = myRank != null && item.rank === myRank;
          const bg = isMe
            ? 'background: rgba(168, 85, 247, 0.18); border: 1px solid rgba(168, 85, 247, 0.5);'
            : 'background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);';

          return `
            <div style="${bg} border-radius: var(--radius-sm); padding: 6px 8px; display: grid; grid-template-columns: 50px 1fr 140px 100px 90px; gap: 8px; align-items: center; font-size: 0.78rem;">
              <div style="text-align: center;">${rankBadge}</div>
              <div>
                <strong style="color: ${isMe ? '#c084fc' : '#fff'}; font-size: 0.84rem;">
                  ${item.name} ${isMe ? '<span style="font-size: 0.65rem; color: #6ee7b7; border: 1px solid #10b981; border-radius: 3px; padding: 0 3px;">Ngươi</span>' : ''}
                </strong>
                <div style="font-size: 0.68rem; color: #64748b;">Cấp ${item.level} • ⚡ ${Number(item.combatPower).toLocaleString()}</div>
              </div>
              <div style="text-align: center;">
                <span class="location-badge" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; font-size: 0.68rem;">${item.realmTitle}</span>
              </div>
              <div style="text-align: center; color: #c084fc; font-weight: 700; font-size: 0.85rem;">
                ${Number(item.reputation).toLocaleString()}
              </div>
              <div style="text-align: right; font-size: 0.72rem; color: #94a3b8;">
                ${item.pvpWins}T / ${item.pvpLosses}B
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // ====================================================
  // 14. PHÂN HỆ TRUYỀN ÂM CÁC (M4.3.1 REALTIME CHAT)
  // ====================================================
  getZoneDisplayName(zoneId) {
    if (!zoneId) return 'Khu Vực';
    const zone = this.worldData?.zones?.find(z => z.id === zoneId);
    return zone ? zone.name : 'Khu Vực';
  }

  /**
   * Khởi tạo kết nối Socket.IO tới namespace /xianxia-chat
   */
  initChatSocket() {
    if (typeof io === 'undefined') {
      console.warn('[Truyền Âm Các] Thư viện Socket.IO client chưa sẵn sàng.');
      this.updateChatConnectionStatus('offline', 'Chưa có Socket.IO');
      return;
    }

    const token = this.getAuthToken();
    if (!token) {
      this.updateChatConnectionStatus('offline', 'Chưa đăng nhập');
      return;
    }

    this.chatConnecting = true;
    this.updateChatConnectionStatus('connecting', 'Đang kết nối thần thức...');

    try {
      // Nếu socket đã tồn tại từ phiên trước, dọn dẹp sạch sẽ để tránh nhân bản listener
      if (this.chatSocket) {
        this.chatSocket.removeAllListeners();
        this.chatSocket.disconnect();
        this.chatSocket = null;
      }

      const socketUrl = window.location.origin;
      this.chatSocket = io(`${socketUrl}/xianxia-chat`, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.chatSocket.on('connect', () => {
        this.chatConnected = true;
        this.chatConnecting = false;
        this.updateChatConnectionStatus('online', 'Thần thức quy nhất');
        this.syncChatZoneLabel();
      });

      this.chatSocket.on('disconnect', (reason) => {
        this.chatConnected = false;
        this.chatConnecting = false;
        this.updateChatConnectionStatus('offline', 'Mất kết nối');
      });

      this.chatSocket.on('connect_error', (err) => {
        this.chatConnected = false;
        this.chatConnecting = false;
        const msg = err?.message || 'Lỗi kết nối';
        this.updateChatConnectionStatus('offline', msg.includes('AUTHENTICATION') ? 'Hết hạn phiên đăng nhập' : 'Không thể kết nối');
      });

      this.chatSocket.on('chat_init', (data) => {
        if (data && data.success) {
          this.chatWorldMessages = Array.isArray(data.worldMessages) ? data.worldMessages : [];
          this.chatZoneMessages = Array.isArray(data.zoneMessages) ? data.zoneMessages : [];
          this.chatGuildMessages = Array.isArray(data.guildMessages) ? data.guildMessages : [];

          if (data.profile?.currentZone) {
            this.syncChatZoneLabel(data.profile.currentZone);
          }

          if (data.profile?.guildId) {
            this.playerGuildId = data.profile.guildId;
            this.playerGuildName = data.profile.guildName;
            this.syncGuildChatState(data.profile.guildId, data.profile.guildName);
          } else {
            this.playerGuildId = null;
            this.playerGuildName = null;
            this.syncGuildChatState(null, null);
          }

          if (this.chatWindowOpen) {
            this.renderChatMessages();
            this.scrollChatToBottom();
          }
        }
      });

      this.chatSocket.on('new_message', (msg) => {
        if (!msg) return;
        if (msg.channel === 'WORLD') {
          this.chatWorldMessages.push(msg);
          if (this.chatWorldMessages.length > 50) this.chatWorldMessages.shift();
        } else if (msg.channel === 'ZONE') {
          this.chatZoneMessages.push(msg);
          if (this.chatZoneMessages.length > 50) this.chatZoneMessages.shift();
        } else if (msg.channel === 'GUILD') {
          this.chatGuildMessages.push(msg);
          if (this.chatGuildMessages.length > 50) this.chatGuildMessages.shift();
        }

        if (this.chatWindowOpen && msg.channel === this.chatActiveChannel) {
          this.appendSingleChatMessage(msg);
        } else {
          // Tăng huy hiệu tin nhắn chưa đọc
          this.chatUnreadCount++;
          const badge = document.getElementById('chat-unread-badge');
          if (badge) {
            badge.style.display = 'inline-block';
            badge.textContent = this.chatUnreadCount > 99 ? '99+' : this.chatUnreadCount;
          }
        }
      });

      this.chatSocket.on('zone_changed', (data) => {
        if (data && data.success) {
          this.chatZoneMessages = Array.isArray(data.zoneMessages) ? data.zoneMessages : [];
          this.syncChatZoneLabel(data.currentZone);
          if (this.chatWindowOpen && this.chatActiveChannel === 'ZONE') {
            this.renderChatMessages();
            this.scrollChatToBottom();
          }
        }
      });

      this.chatSocket.on('guild_changed', (data) => {
        if (data && data.success) {
          this.playerGuildId = data.guildId || null;
          this.playerGuildName = data.guildName || null;
          this.chatGuildMessages = Array.isArray(data.guildMessages) ? data.guildMessages : [];
          this.syncGuildChatState(data.guildId, data.guildName);

          if (this.chatActiveChannel === 'GUILD') {
            if (!data.guildId) {
              this.switchChatChannel('WORLD');
            } else if (this.chatWindowOpen) {
              this.renderChatMessages();
              this.scrollChatToBottom();
            }
          }

          if (this.guildModalOpen) {
            this.fetchMyGuild();
          }
        }
      });

      this.chatSocket.on('chat_error', (err) => {
        this.showChatError(err?.message || 'Lỗi truyền âm.');
      });
    } catch (e) {
      console.warn('[Truyền Âm Các] Ngoại lệ khởi tạo socket:', e);
      this.updateChatConnectionStatus('offline', 'Lỗi khởi tạo');
    }
  }

  /**
   * Đồng bộ nút Tab Tông Môn trong Widget Chat
   */
  syncGuildChatState(guildId, guildName) {
    const tabBtn = document.getElementById('chat-tab-guild');
    const tabLabel = document.getElementById('chat-guild-tab-label');
    if (tabBtn) {
      if (guildId) {
        tabBtn.style.display = 'flex';
        if (tabLabel) {
          tabLabel.textContent = `🏯 ${guildName || 'Tông Môn'}`;
        }
      } else {
        tabBtn.style.display = 'none';
      }
    }
  }

  /**
   * Cập nhật chỉ báo trạng thái kết nối trên giao diện
   */
  updateChatConnectionStatus(state, customText) {
    const launcherDot = document.getElementById('chat-launcher-status-dot');
    const headerDot = document.getElementById('chat-header-status-dot');
    const connText = document.getElementById('chat-connection-text');

    const dotClass = state === 'online' ? 'status-online' : state === 'connecting' ? 'status-connecting' : 'status-offline';
    const label = customText || (state === 'online' ? 'Đã kết nối' : state === 'connecting' ? 'Đang kết nối...' : 'Mất kết nối');

    if (launcherDot) launcherDot.className = `chat-status-dot ${dotClass}`;
    if (headerDot) headerDot.className = `chat-status-dot ${dotClass}`;
    if (connText) connText.textContent = label;
  }

  /**
   * Cập nhật nhãn phân khu hiển thị trên Tab Khu Vực
   */
  syncChatZoneLabel(zoneId) {
    const targetZoneId = zoneId || this.player?.current_zone || 'zone_thanh_ha_thon';
    const zoneName = this.getZoneDisplayName(targetZoneId);
    const tabLabel = document.getElementById('chat-zone-tab-label');
    if (tabLabel) {
      tabLabel.textContent = `📍 ${zoneName}`;
    }
  }

  /**
   * Bật / Tắt cửa sổ Chat
   */
  toggleChatWindow() {
    this.chatWindowOpen = !this.chatWindowOpen;
    const windowEl = document.getElementById('chat-window');
    if (!windowEl) return;

    if (this.chatWindowOpen) {
      windowEl.style.display = 'flex';
      // Reset số tin chưa đọc
      this.chatUnreadCount = 0;
      const badge = document.getElementById('chat-unread-badge');
      if (badge) badge.style.display = 'none';

      this.syncChatZoneLabel();
      this.syncGuildChatState(this.playerGuildId, this.playerGuildName);
      this.renderChatMessages();
      this.scrollChatToBottom();
      setTimeout(() => {
        document.getElementById('chat-text-input')?.focus();
      }, 50);
    } else {
      windowEl.style.display = 'none';
    }
  }

  /**
   * Chuyển đổi giữa Kênh Thế Giới, Khu Vực và Tông Môn
   */
  switchChatChannel(channel) {
    if (channel !== 'WORLD' && channel !== 'ZONE' && channel !== 'GUILD') return;
    this.chatActiveChannel = channel;

    const btnWorld = document.getElementById('chat-tab-world');
    const btnZone = document.getElementById('chat-tab-zone');
    const btnGuild = document.getElementById('chat-tab-guild');

    if (btnWorld) btnWorld.classList.toggle('active', channel === 'WORLD');
    if (btnZone) btnZone.classList.toggle('active', channel === 'ZONE');
    if (btnGuild) btnGuild.classList.toggle('active', channel === 'GUILD');

    this.renderChatMessages();
    this.scrollChatToBottom();
    document.getElementById('chat-text-input')?.focus();
  }

  /**
   * Vẽ toàn bộ danh sách tin nhắn hiện có của kênh đang chọn (An toàn chống XSS 100%)
   */
  renderChatMessages() {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;

    box.innerHTML = '';
    let messages = [];
    if (this.chatActiveChannel === 'WORLD') {
      messages = this.chatWorldMessages;
    } else if (this.chatActiveChannel === 'ZONE') {
      messages = this.chatZoneMessages;
    } else if (this.chatActiveChannel === 'GUILD') {
      messages = this.chatGuildMessages;
    }

    if (!messages || messages.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.textAlign = 'center';
      emptyDiv.style.color = '#64748b';
      emptyDiv.style.padding = '30px 10px';
      emptyDiv.style.fontSize = '0.78rem';
      if (this.chatActiveChannel === 'WORLD') {
        emptyDiv.textContent = 'Chưa có truyền âm nào trên toàn cõi. Đạo hữu hãy là người đầu tiên phát thanh!';
      } else if (this.chatActiveChannel === 'ZONE') {
        emptyDiv.textContent = 'Phân khu này tĩnh lặng không một bóng người. Đạo hữu hãy để lại lời truyền âm!';
      } else {
        emptyDiv.textContent = 'Tông môn thanh tịnh chưa có truyền âm nào. Đạo hữu hãy khởi xướng đàm đạo cùng đồng môn!';
      }
      box.appendChild(emptyDiv);
      return;
    }

    for (const msg of messages) {
      box.appendChild(this.createChatMessageElement(msg));
    }
  }

  /**
   * Tạo phần tử DOM cho một tin nhắn chat (Sử dụng textContent an toàn tuyệt đối)
   */
  createChatMessageElement(msg) {
    const item = document.createElement('div');
    item.className = 'chat-msg-item';

    const header = document.createElement('div');
    header.className = 'chat-msg-header';

    // Cảnh giới
    const realmBadge = document.createElement('span');
    realmBadge.className = 'chat-msg-realm';
    realmBadge.textContent = this.getRealmName(msg.senderRealm);
    header.appendChild(realmBadge);

    // Tên người gửi
    const sender = document.createElement('span');
    sender.className = 'chat-msg-sender';
    sender.textContent = msg.senderName;
    header.appendChild(sender);

    // Thời gian
    const timeSpan = document.createElement('span');
    timeSpan.className = 'chat-msg-time';
    try {
      const d = new Date(msg.createdAt);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      timeSpan.textContent = `${hours}:${mins}`;
    } catch {
      timeSpan.textContent = '';
    }
    header.appendChild(timeSpan);

    // Nội dung tin nhắn (Dùng textContent để triệt tiêu 100% XSS)
    const content = document.createElement('div');
    content.className = 'chat-msg-content';
    content.textContent = msg.content;

    item.appendChild(header);
    item.appendChild(content);
    return item;
  }

  /**
   * Thêm một tin nhắn mới vào giao diện mà không cần render lại toàn bộ
   */
  appendSingleChatMessage(msg) {
    const box = document.getElementById('chat-messages-box');
    if (!box) return;

    // Kiểm tra xem người dùng có đang ở cuối danh sách hay không
    const isAtBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 45;

    // Xóa thông báo trống nếu có
    if (box.children.length === 1 && box.children[0].style.textAlign === 'center') {
      box.innerHTML = '';
    }

    box.appendChild(this.createChatMessageElement(msg));

    if (isAtBottom) {
      this.scrollChatToBottom();
    } else {
      // Người dùng đang cuộn lên xem tin cũ -> hiển thị badge nổi
      const badge = document.getElementById('chat-floating-badge');
      if (badge) badge.style.display = 'block';
    }
  }

  /**
   * Cuộn danh sách tin nhắn xuống dưới cùng
   */
  scrollChatToBottom() {
    const box = document.getElementById('chat-messages-box');
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
    const badge = document.getElementById('chat-floating-badge');
    if (badge) badge.style.display = 'none';
  }

  /**
   * Cập nhật bộ đếm ký tự trong ô nhập
   */
  updateChatCharCounter() {
    const input = document.getElementById('chat-text-input');
    const counter = document.getElementById('chat-char-counter');
    if (input && counter) {
      counter.textContent = `${input.value.length}/200`;
    }
  }

  /**
   * Hiển thị thông báo lỗi tạm thời trên thanh chat
   */
  showChatError(errorText) {
    const notice = document.getElementById('chat-error-notice');
    if (notice) {
      notice.textContent = errorText;
      setTimeout(() => {
        if (notice.textContent === errorText) notice.textContent = '';
      }, 4000);
    }
  }

  /**
   * Gửi tin nhắn lên máy chủ
   */
  sendChatMessage() {
    const input = document.getElementById('chat-text-input');
    const sendBtn = document.getElementById('chat-send-btn');
    if (!input) return;

    const rawContent = input.value.trim();
    if (!rawContent) {
      this.showChatError('Xin nhập nội dung truyền âm.');
      return;
    }

    if (!this.chatConnected || !this.chatSocket) {
      this.showChatError('Chưa kết nối thần thức tới máy chủ.');
      return;
    }

    const now = Date.now();
    if (now < this.chatCooldownUntil) {
      const waitSec = Math.ceil((this.chatCooldownUntil - now) / 1000);
      this.showChatError(`Xin đợi ${waitSec}s trước khi gửi tiếp.`);
      return;
    }

    // Đặt cooldown 2 giây trên client
    this.chatCooldownUntil = now + 2000;
    if (sendBtn) {
      sendBtn.disabled = true;
      let remain = 2;
      sendBtn.textContent = `Chờ (${remain}s)`;
      const cdTimer = setInterval(() => {
        remain--;
        if (remain <= 0) {
          clearInterval(cdTimer);
          if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Truyền Âm';
          }
        } else if (sendBtn) {
          sendBtn.textContent = `Chờ (${remain}s)`;
        }
      }, 1000);
    }

    this.chatSocket.emit(
      'send_message',
      {
        channel: this.chatActiveChannel,
        content: rawContent,
      },
      (res) => {
        if (res && !res.success) {
          this.showChatError(res.message || 'Lỗi gửi tin.');
        }
      }
    );

    input.value = '';
    this.updateChatCharCounter();
    input.focus();
  }

  /**
   * Đồng bộ lại phân khu khi nhân vật di chuyển
   */
  syncChatZone() {
    this.syncChatZoneLabel();
    if (this.chatSocket && this.chatConnected) {
      this.chatSocket.emit('sync_zone');
    }
  }

  // ====================================================
  // 15. PHÂN HỆ TÔNG MÔN / BANG HỘI (M4.3.2 GUILD SYSTEM)
  // ====================================================

  /**
   * Lấy Authorization Headers có chứa JWT Token
   */
  getAuthHeaders() {
    const token = this.getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  /**
   * Mở Modal Tông Môn
   */
  async openGuildModal() {
    this.guildModalOpen = true;
    const modal = document.getElementById('guild-modal');
    if (modal) modal.style.display = 'flex';

    await this.fetchMyGuild();
    if (!this.myGuildData?.hasGuild) {
      this.guildActiveTab = 'list';
      await this.fetchGuildsList(1);
    } else {
      this.guildActiveTab = 'members';
    }
    this.renderGuildUI();
  }

  /**
   * Đóng Modal Tông Môn
   */
  closeGuildModal() {
    this.guildModalOpen = false;
    const modal = document.getElementById('guild-modal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Chuyển đổi Sub-tab trong Modal Tông Môn
   */
  setGuildTab(tab) {
    this.guildActiveTab = tab;
    if (tab === 'list') {
      this.fetchGuildsList(this.guildsPage, this.guildsSearch);
    } else if (tab === 'apps' && this.myGuildData?.guild?.id) {
      this.fetchGuildApplications(this.myGuildData.guild.id);
    } else {
      this.renderGuildUI();
    }
  }

  /**
   * Lấy thông tin Tông Môn của bản thân từ máy chủ
   */
  async fetchMyGuild() {
    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/me`, {
        headers: this.getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        this.myGuildData = json.data;
        if (this.myGuildData.hasGuild && this.myGuildData.guild) {
          this.playerGuildId = this.myGuildData.guild.id;
          this.playerGuildName = this.myGuildData.guild.name;
          this.syncGuildChatState(this.myGuildData.guild.id, this.myGuildData.guild.name);
        } else {
          this.playerGuildId = null;
          this.playerGuildName = null;
          this.syncGuildChatState(null, null);
        }
      }
    } catch (err) {
      console.warn('[Tông Môn] Lỗi truy vấn thông tin Tông môn của tôi:', err);
    }
  }

  /**
   * Lấy danh sách Tông Môn trong thiên hạ (tìm kiếm, phân trang)
   */
  async fetchGuildsList(page = 1, search = '') {
    this.guildLoading = true;
    this.guildsPage = page;
    this.guildsSearch = search;
    this.renderGuildUI();

    try {
      let url = `${this.apiBase}/api/xianxia/guilds?page=${page}&limit=${this.guildsLimit}`;
      if (search && search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      const res = await fetch(url, { headers: this.getAuthHeaders() });
      const json = await res.json();
      if (json.success) {
        this.guildsList = json.data.guilds || [];
        this.guildsTotal = json.data.total || 0;
      }
    } catch (err) {
      console.warn('[Tông Môn] Lỗi tải danh sách Tông môn:', err);
    } finally {
      this.guildLoading = false;
      this.renderGuildUI();
    }
  }

  /**
   * Lấy danh sách đơn xin gia nhập đang chờ duyệt
   */
  async fetchGuildApplications(guildId) {
    this.guildLoading = true;
    this.renderGuildUI();

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}/applications`, {
        headers: this.getAuthHeaders(),
      });
      const json = await res.json();
      if (json.success) {
        this.guildApplications = json.data || [];
      }
    } catch (err) {
      console.warn('[Tông Môn] Lỗi lấy đơn bái kiến:', err);
    } finally {
      this.guildLoading = false;
      this.renderGuildUI();
    }
  }

  /**
   * Vẽ toàn bộ giao diện Modal Tông Môn
   */
  renderGuildUI() {
    const container = document.getElementById('guild-modal-body');
    if (!container) return;

    if (!this.myGuildData?.hasGuild) {
      this.renderNonGuildUI(container);
    } else {
      this.renderInGuildUI(container);
    }
  }

  /**
   * Giao diện khi người chơi CHƯA gia nhập Tông Môn
   */
  renderNonGuildUI(container) {
    const isList = this.guildActiveTab !== 'create';

    container.innerHTML = `
      <!-- Sub-Tabs: Danh Sách & Khai Tông -->
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 8px;">
        <button class="btn-wuxia-link ${isList ? 'active' : ''}" style="${isList ? 'background: rgba(16, 185, 129, 0.25); color: #6ee7b7;' : ''}" onclick="window.engine.setGuildTab('list')">
          ⚔️ Danh Sách Tông Môn
        </button>
        <button class="btn-wuxia-link ${!isList ? 'active' : ''}" style="${!isList ? 'background: rgba(245, 158, 11, 0.25); color: #fbbf24;' : ''}" onclick="window.engine.setGuildTab('create')">
          ✨ Khai Tông Lập Phái
        </button>
      </div>

      ${isList ? this.renderGuildsListHTML() : this.renderCreateGuildHTML()}
    `;
  }

  /**
   * HTML Danh Sách Tông Môn
   */
  renderGuildsListHTML() {
    const totalPages = Math.max(1, Math.ceil(this.guildsTotal / this.guildsLimit));

    return `
      <!-- Thanh tìm kiếm -->
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
        <input 
          type="text" 
          id="guild-search-input" 
          class="chat-text-input" 
          placeholder="Nhập tên Tông môn muốn tìm kiếm..." 
          value="${this.guildsSearch || ''}"
          onkeydown="if(event.key === 'Enter') window.engine.fetchGuildsList(1, this.value)"
          style="max-width: 320px;"
        />
        <button class="btn-wuxia-link" onclick="window.engine.fetchGuildsList(1, document.getElementById('guild-search-input')?.value)">
          🔍 Tìm Kiếm
        </button>
        <button class="btn-wuxia-link" onclick="document.getElementById('guild-search-input').value = ''; window.engine.fetchGuildsList(1, '')">
          Tất Cả
        </button>
      </div>

      <!-- Danh sách tông môn -->
      <div style="min-height: 240px; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
        ${this.guildLoading ? `
          <div style="text-align: center; color: #6ee7b7; padding: 40px;">Đang tải danh sách tông môn trong thiên hạ...</div>
        ` : (this.guildsList.length === 0 ? `
          <div style="text-align: center; color: #64748b; padding: 40px;">Thiên hạ chưa có Tông môn nào phù hợp. Đạo hữu hãy là người đầu tiên khai tông lập phái!</div>
        ` : this.guildsList.map(g => `
          <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.22); border-radius: var(--radius-sm); padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 700; color: #f1f5f9; font-size: 0.95rem;">${g.name}</span>
                <span class="location-badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 0.68rem;">Cấp ${g.level}</span>
                <span style="font-size: 0.72rem; color: #6ee7b7;">👑 Chưởng môn: ${g.leaderName} (${this.getRealmName(g.leaderRealm)})</span>
              </div>
              <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${g.description || 'Chưa lập tông chỉ môn phái.'}
              </div>
              <div style="display: flex; gap: 12px; font-size: 0.7rem; color: #64748b; margin-top: 4px;">
                <span>👥 Đệ tử: <strong style="color: #cbd5e1;">${g.memberCount} / ${g.maxMembers}</strong></span>
                <span>🏆 Uy danh: <strong style="color: #fbbf24;">${g.reputation}</strong></span>
              </div>
            </div>

            <div>
              <button 
                class="btn-wuxia-link" 
                style="background: rgba(16, 185, 129, 0.25); border-color: rgba(16, 185, 129, 0.5); color: #6ee7b7; font-weight: 700; padding: 6px 14px;"
                onclick="window.engine.applyToGuildSubmit(${g.id})"
                ${g.memberCount >= g.maxMembers ? 'disabled style="opacity: 0.5;"' : ''}
              >
                ${g.memberCount >= g.maxMembers ? 'Đã Đầy' : 'Bái Kiến ✉️'}
              </button>
            </div>
          </div>
        `).join(''))}
      </div>

      <!-- Phân trang -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.78rem;">
        <span style="color: #64748b;">Tổng số: ${this.guildsTotal} Tông môn</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="btn-wuxia-link" style="padding: 2px 8px;" ${this.guildsPage <= 1 ? 'disabled style="opacity:0.4;"' : ''} onclick="window.engine.fetchGuildsList(${this.guildsPage - 1}, window.engine.guildsSearch)">◀ Trước</button>
          <span style="color: #cbd5e1; font-weight: 700;">${this.guildsPage} / ${totalPages}</span>
          <button class="btn-wuxia-link" style="padding: 2px 8px;" ${this.guildsPage >= totalPages ? 'disabled style="opacity:0.4;"' : ''} onclick="window.engine.fetchGuildsList(${this.guildsPage + 1}, window.engine.guildsSearch)">Sau ▶</button>
        </div>
      </div>
    `;
  }

  /**
   * HTML Khai Tông Lập Phái Form
   */
  renderCreateGuildHTML() {
    return `
      <div style="background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: var(--radius-sm); padding: 16px; display: flex; flex-direction: column; gap: 12px;">
        <div style="font-weight: 700; color: #fbbf24; font-size: 0.95rem;">
          ✨ Khai Tông Lập Phái — Dựng Nghiệp Nghìn Năm
        </div>
        <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5;">
          Muốn khai sơn lập phái, xưng bá một phương, đạo hữu phải có đầy đủ thực lực và ngân lượng chiêu mộ đệ tử:
          <ul style="margin: 6px 0 0 18px; color: #94a3b8;">
            <li>Cảnh giới tối thiểu: <strong style="color: #6ee7b7;">Luyện Khí Tầng 3</strong>.</li>
            <li>Ngân lượng tiêu hao: <strong style="color: #fde047;">500 Bạc</strong> để xây cất sơn môn.</li>
            <li>Sau khi thành lập, đạo hữu sẽ trở thành <strong>Chưởng Môn</strong>, tự động mở kênh truyền âm riêng.</li>
          </ul>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 4px;">
          <label style="font-size: 0.8rem; font-weight: 600; color: #e2e8f0;">Danh Xưng Tông Môn (3 - 30 ký tự):</label>
          <input type="text" id="create-guild-name" class="chat-text-input" placeholder="Ví dụ: Vạn Kiếm Tông, Tiêu Dao Các..." maxlength="30" />
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="font-size: 0.8rem; font-weight: 600; color: #e2e8f0;">Tôn Chỉ Môn Phái / Giới Thiệu (Tối đa 255 ký tự):</label>
          <textarea id="create-guild-desc" class="chat-text-input" style="height: 60px; resize: none;" placeholder="Môn quy nghiêm minh, đồng môn tương trợ, cùng mưu cầu trường sinh..."></textarea>
        </div>

        <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
          <button 
            class="btn-wuxia-link" 
            style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 700; padding: 8px 20px; font-size: 0.85rem;"
            onclick="window.engine.createGuildSubmit()"
            ${this.guildSubmitting ? 'disabled' : ''}
          >
            ${this.guildSubmitting ? 'Đang Khởi Tạo...' : '🏛️ Thành Lập Tông Môn (500 Bạc)'}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Giao diện khi người chơi ĐÃ CÓ Tông Môn
   */
  renderInGuildUI(container) {
    const g = this.myGuildData.guild;
    const myRole = this.myGuildData.myRole;
    const isOfficer = myRole === 'LEADER' || myRole === 'ELDER';
    const isLeader = myRole === 'LEADER';

    const roleName = myRole === 'LEADER' ? '👑 Chưởng Môn' : (myRole === 'ELDER' ? '⚖️ Trưởng Lão' : 'Đệ Tử');
    const roleBadgeColor = myRole === 'LEADER' ? '#f59e0b' : (myRole === 'ELDER' ? '#c084fc' : '#6ee7b7');

    container.innerHTML = `
      <!-- Banner Tông Môn của người chơi -->
      <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(6, 78, 59, 0.25)); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.4rem; font-weight: 900; color: #fff; font-family: var(--font-serif);">${g.name}</span>
            <span class="location-badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-size: 0.72rem;">Cấp ${g.level}</span>
            <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; font-weight: 700; background: rgba(0,0,0,0.3); color: ${roleBadgeColor}; border: 1px solid ${roleBadgeColor};">
              ${roleName}
            </span>
          </div>
          <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 4px;">
            ${g.description || 'Chưa lập tông chỉ môn phái.'}
          </div>
          <div style="display: flex; gap: 14px; font-size: 0.72rem; color: #cbd5e1; margin-top: 6px;">
            <span>👑 Chưởng môn: <strong style="color: #fde047;">${g.leaderName}</strong> (${this.getRealmName(g.leaderRealm)})</span>
            <span>👥 Thành viên: <strong style="color: #6ee7b7;">${g.memberCount} / ${g.maxMembers}</strong></span>
            <span>🏆 Uy danh: <strong style="color: #fbbf24;">${g.reputation}</strong></span>
          </div>
        </div>

        <div style="text-align: right;">
          <button class="btn-wuxia-link" style="padding: 4px 10px; font-size: 0.75rem; background: rgba(16, 185, 129, 0.2); color: #6ee7b7;" onclick="window.engine.fetchMyGuild().then(() => window.engine.renderGuildUI())">
            🔄 Làm Mới
          </button>
        </div>
      </div>

      <!-- Khung Cáo Thị Môn Phái -->
      <div style="background: rgba(0, 0, 0, 0.3); border: 1px dashed rgba(255, 255, 255, 0.15); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <div style="font-size: 0.78rem; color: #e2e8f0; line-height: 1.4;">
          <strong style="color: #fbbf24;">📢 Cáo Thị Môn Phái:</strong> 
          <span>${g.notice || 'Chưa có lời răn mới.'}</span>
        </div>
        ${isOfficer ? `
          <button class="btn-wuxia-link" style="font-size: 0.7rem; padding: 2px 8px; white-space: nowrap;" onclick="window.engine.updateNoticeSubmit(${g.id})">
            Sửa Cáo Thị ✍️
          </button>
        ` : ''}
      </div>

      <!-- Sub-Tabs: Thành Viên | Đơn Bái Kiến (nếu Officer) | Quản Trị / Sự Vụ -->
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 6px;">
        <button class="btn-wuxia-link ${this.guildActiveTab === 'members' ? 'active' : ''}" style="${this.guildActiveTab === 'members' ? 'background: rgba(16, 185, 129, 0.25); color: #6ee7b7;' : ''}" onclick="window.engine.setGuildTab('members')">
          👥 Danh Sách Đệ Tử (${g.memberCount})
        </button>
        ${isOfficer ? `
          <button class="btn-wuxia-link ${this.guildActiveTab === 'apps' ? 'active' : ''}" style="${this.guildActiveTab === 'apps' ? 'background: rgba(245, 158, 11, 0.25); color: #fbbf24;' : ''}" onclick="window.engine.setGuildTab('apps')">
            📜 Đơn Bái Kiến ${this.myGuildData.pendingApplicationsCount > 0 ? `<span style="background: #ef4444; color: #fff; border-radius: 10px; padding: 0 5px; font-size: 0.65rem;">${this.myGuildData.pendingApplicationsCount}</span>` : ''}
          </button>
        ` : ''}
        <button class="btn-wuxia-link ${this.guildActiveTab === 'affairs' ? 'active' : ''}" style="${this.guildActiveTab === 'affairs' ? 'background: rgba(239, 68, 68, 0.2); color: #fca5a5;' : ''}" onclick="window.engine.setGuildTab('affairs')">
          🚪 Tông Môn Sự Vụ
        </button>
      </div>

      <!-- Container nội dung từng Sub-tab -->
      ${this.guildActiveTab === 'apps' && isOfficer ? this.renderApplicationsHTML(g.id) : (this.guildActiveTab === 'affairs' ? this.renderAffairsHTML(g, isLeader) : this.renderMembersListHTML(g, myRole))}
    `;
  }

  /**
   * HTML Danh Sách Thành Viên Tông Môn
   */
  renderMembersListHTML(guild, myRole) {
    const members = this.myGuildData.members || [];
    const isLeader = myRole === 'LEADER';

    return `
      <div style="min-height: 200px; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
        ${members.map(m => {
          const isMe = m.userId === this.player?.user_id || m.name === this.player?.name;
          const roleBadge = m.role === 'LEADER' ? '👑 Chưởng Môn' : (m.role === 'ELDER' ? '⚖️ Trưởng Lão' : 'Đệ Tử');
          const badgeColor = m.role === 'LEADER' ? '#f59e0b' : (m.role === 'ELDER' ? '#c084fc' : '#94a3b8');

          return `
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: ${isMe ? '#6ee7b7' : '#f1f5f9'}; font-size: 0.88rem;">${m.name}</strong>
                  ${isMe ? '<span style="font-size: 0.65rem; color: #6ee7b7; border: 1px solid #10b981; border-radius: 3px; padding: 0 4px;">Bản Thân</span>' : ''}
                  <span style="font-size: 0.7rem; color: ${badgeColor}; font-weight: 700;">${roleBadge}</span>
                </div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
                  ${this.getRealmName(m.realm)} • Cấp ${m.level} • Gia nhập: ${new Date(m.joinedAt).toLocaleDateString()}
                </div>
              </div>

              <!-- Thao tác quản trị của Chưởng Môn -->
              ${isLeader && !isMe ? `
                <div style="display: flex; gap: 6px; align-items: center;">
                  ${m.role === 'MEMBER' ? `
                    <button class="btn-wuxia-link" style="padding: 2px 6px; font-size: 0.7rem; background: rgba(168, 85, 247, 0.15); color: #c084fc;" onclick="window.engine.promoteMemberSubmit(${m.characterId}, '${m.name}')">
                      Thăng Trưởng Lão
                    </button>
                  ` : (m.role === 'ELDER' ? `
                    <button class="btn-wuxia-link" style="padding: 2px 6px; font-size: 0.7rem; background: rgba(245, 158, 11, 0.15); color: #fbbf24;" onclick="window.engine.demoteMemberSubmit(${m.characterId}, '${m.name}')">
                      Bãi Chức
                    </button>
                  ` : '')}

                  <button class="btn-wuxia-link" style="padding: 2px 6px; font-size: 0.7rem; background: rgba(56, 189, 248, 0.15); color: #7dd3fc;" onclick="window.engine.transferLeadershipSubmit(${m.characterId}, '${m.name}')">
                    Truyền Ngôi
                  </button>

                  <button class="btn-wuxia-link" style="padding: 2px 6px; font-size: 0.7rem; background: rgba(239, 68, 68, 0.15); color: #fca5a5;" onclick="window.engine.kickMemberSubmit(${m.characterId}, '${m.name}')">
                    Trục Xuất ✕
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * HTML Danh Sách Đơn Bái Kiến Đang Chờ Duyệt
   */
  renderApplicationsHTML(guildId) {
    return `
      <div style="min-height: 200px; max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
        ${this.guildLoading ? `
          <div style="text-align: center; color: #fbbf24; padding: 40px;">Đang tải danh sách bái thiếp...</div>
        ` : (this.guildApplications.length === 0 ? `
          <div style="text-align: center; color: #64748b; padding: 40px;">Hiện tại không có đơn bái kiến nào đang chờ phê duyệt.</div>
        ` : this.guildApplications.map(app => `
          <div style="background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.22); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="color: #f1f5f9; font-size: 0.88rem;">${app.name}</strong>
                <span class="location-badge" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; font-size: 0.68rem;">${this.getRealmName(app.realm)} (Cấp ${app.level})</span>
              </div>
              <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 4px;">
                Lời nhắn: <span style="font-style: italic; color: #94a3b8;">"${app.message || 'Kính xin gia nhập môn phái!'}"</span>
              </div>
              <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">
                Gửi lúc: ${new Date(app.createdAt).toLocaleString()}
              </div>
            </div>

            <div style="display: flex; gap: 6px;">
              <button class="btn-wuxia-link" style="padding: 4px 10px; background: rgba(16, 185, 129, 0.25); color: #6ee7b7; font-weight: 700;" onclick="window.engine.acceptApplicationSubmit(${guildId}, ${app.id})">
                Tiếp Nhận ✓
              </button>
              <button class="btn-wuxia-link" style="padding: 4px 10px; background: rgba(239, 68, 68, 0.15); color: #fca5a5;" onclick="window.engine.rejectApplicationSubmit(${guildId}, ${app.id})">
                Từ Chối ✕
              </button>
            </div>
          </div>
        `).join(''))}
      </div>
    `;
  }

  /**
   * HTML Tông Môn Sự Vụ (Rời Tông Môn / Giải Tán Tông Môn)
   */
  renderAffairsHTML(guild, isLeader) {
    return `
      <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); padding: 16px; display: flex; flex-direction: column; gap: 14px;">
        <div style="font-weight: 700; color: #fca5a5; font-size: 0.92rem;">
          ⚠️ Tông Môn Sự Vụ & Quyết Định Đại Sự
        </div>

        ${isLeader ? `
          <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5;">
            Đạo hữu hiện là <strong>Chưởng Môn</strong> tối cao của môn phái:
            <ul style="margin: 6px 0 0 18px; color: #94a3b8;">
              <li>Chưởng môn <strong>không thể tự ý rời bỏ</strong> khi môn phái vẫn còn đệ tử. Xin truyền ngôi trước.</li>
              <li>Nếu muốn giải tán môn phái, toàn bộ đệ tử sẽ trở về thân phận Tán Tu, danh xưng Tông môn sẽ bị xóa bỏ vĩnh viễn.</li>
            </ul>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
            <button 
              class="btn-wuxia-link" 
              style="background: rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; font-weight: 700; padding: 8px 18px;"
              onclick="window.engine.disbandGuildSubmit(${guild.id})"
            >
              🔥 Giải Tán Tông Môn
            </button>
          </div>
        ` : `
          <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5;">
            Nếu đạo hữu cảm thấy môn phong không phù hợp, có thể tự nguyện dứt áo ra đi, quy hoàn tự do:
            <ul style="margin: 6px 0 0 18px; color: #94a3b8;">
              <li>Sau khi rời khỏi Tông môn, đạo hữu có thể nộp bái thiếp gia nhập môn phái khác.</li>
              <li>Mọi quyền hạn và chức vị trong môn phái hiện tại sẽ lập tức bị hủy bỏ.</li>
            </ul>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
            <button 
              class="btn-wuxia-link" 
              style="background: rgba(239, 68, 68, 0.25); border-color: rgba(239, 68, 68, 0.5); color: #fca5a5; font-weight: 700; padding: 8px 18px;"
              onclick="window.engine.leaveGuildSubmit(${guild.id})"
            >
              🚶 Rời Khỏi Tông Môn
            </button>
          </div>
        `}
      </div>
    `;
  }

  // ====================================================
  // 15.1. GUILD ACTION HANDLERS
  // ====================================================

  /**
   * Submit Khai Tông Lập Phái
   */
  async createGuildSubmit() {
    const nameInput = document.getElementById('create-guild-name');
    const descInput = document.getElementById('create-guild-desc');
    const name = nameInput?.value?.trim();
    const desc = descInput?.value?.trim();

    if (!name || name.length < 3 || name.length > 30) {
      alert('Tên Tông môn phải từ 3 đến 30 ký tự!');
      return;
    }

    if (this.player && this.player.silver < 500) {
      alert('Ngân lượng không đủ! Cần 500 Bạc để khai tông lập phái.');
      return;
    }

    this.guildSubmitting = true;
    this.renderGuildUI();

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name, description: desc }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi thành lập Tông môn.');
      }

      alert(`Chúc mừng đạo hữu đã khai sáng thành công Tông Môn "${name}"!`);
      if (this.player) {
        this.player.silver = Math.max(0, (this.player.silver || 0) - 500);
        this.savePlayerState();
        this.renderPlayerStats();
      }

      if (this.chatSocket && this.chatConnected) {
        this.chatSocket.emit('sync_guild');
      }

      await this.fetchMyGuild();
      this.guildActiveTab = 'members';
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể lập Tông môn.');
    } finally {
      this.guildSubmitting = false;
      this.renderGuildUI();
    }
  }

  /**
   * Submit Bái Kiến / Xin Gia Nhập Tông Môn
   */
  async applyToGuildSubmit(guildId) {
    const msg = prompt('Xin nhập lời chào bái kiến gửi tới Chưởng môn môn phái (tối đa 200 ký tự):', 'Hâm mộ danh tiếng môn phái đã lâu, kính xin Chưởng môn thâu nhận!');
    if (msg === null) return; // Người dùng ấn Hủy

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}/apply`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ message: msg.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi gửi bái thiếp.');
      }

      alert('Đã gửi bái thiếp gia nhập thành công! Xin kiên nhẫn chờ Chưởng môn hoặc Trưởng lão hồi âm.');
    } catch (err) {
      alert(err.message || 'Không thể gửi bái thiếp.');
    }
  }

  /**
   * Duyệt tiếp nhận đệ tử
   */
  async acceptApplicationSubmit(guildId, appId) {
    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}/applications/${appId}/accept`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi duyệt đơn.');
      }

      alert('Đã thu nhận đệ tử vào Tông môn thành công!');
      await this.fetchMyGuild();
      await this.fetchGuildApplications(guildId);
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể duyệt đơn.');
    }
  }

  /**
   * Từ chối đơn bái kiến
   */
  async rejectApplicationSubmit(guildId, appId) {
    if (!confirm('Đạo hữu có chắc chắn muốn khước từ bái thiếp của vị đồng đạo này?')) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}/applications/${appId}/reject`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi từ chối đơn.');
      }

      await this.fetchGuildApplications(guildId);
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể từ chối đơn.');
    }
  }

  /**
   * Submit Rời Tông Môn
   */
  async leaveGuildSubmit(guildId) {
    if (!confirm('Đạo hữu có thực sự muốn dứt áo rời khỏi Tông môn, trở lại thân phận Tán Tu tự do?')) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}/leave`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi khi rời Tông môn.');
      }

      alert('Đạo hữu đã rời khỏi Tông môn thành công.');
      if (this.chatSocket && this.chatConnected) {
        this.chatSocket.emit('sync_guild');
      }

      await this.fetchMyGuild();
      this.guildActiveTab = 'list';
      await this.fetchGuildsList(1);
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể rời Tông môn.');
    }
  }

  /**
   * Chưởng Môn Trục Xuất Đệ Tử
   */
  async kickMemberSubmit(characterId, charName) {
    if (!confirm(`Đạo hữu có chắc chắn muốn trục xuất "${charName}" ra khỏi sơn môn?`)) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${this.myGuildData.guild.id}/kick`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ characterId }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi trục xuất đệ tử.');
      }

      alert(`Đã trục xuất "${charName}" khỏi môn phái.`);
      await this.fetchMyGuild();
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể trục xuất đệ tử.');
    }
  }

  /**
   * Thăng chức Trưởng Lão
   */
  async promoteMemberSubmit(characterId, charName) {
    if (!confirm(`Bổ nhiệm "${charName}" làm Trưởng Lão Tông môn?`)) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${this.myGuildData.guild.id}/promote`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ characterId }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi bổ nhiệm Trưởng lão.');
      }

      alert(`Đã tấn phong "${charName}" làm Trưởng Lão.`);
      await this.fetchMyGuild();
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể thăng chức.');
    }
  }

  /**
   * Bãi chức Trưởng Lão
   */
  async demoteMemberSubmit(characterId, charName) {
    if (!confirm(`Bãi chức Trưởng Lão của "${charName}", giáng xuống làm Đệ tử thông thường?`)) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${this.myGuildData.guild.id}/demote`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ characterId }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi bãi chức.');
      }

      alert(`Đã bãi chức Trưởng Lão của "${charName}".`);
      await this.fetchMyGuild();
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể bãi chức.');
    }
  }

  /**
   * Truyền Ngôi Chưởng Môn
   */
  async transferLeadershipSubmit(newLeaderCharacterId, charName) {
    if (!confirm(`Đạo hữu có chắc chắn muốn trao Chưởng Môn Tín Vật, truyền ngôi cho "${charName}"? Hành động này không thể hoàn tác!`)) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${this.myGuildData.guild.id}/transfer`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ newLeaderCharacterId }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi truyền ngôi.');
      }

      alert(`Đã truyền ngôi Chưởng Môn cho "${charName}" thành công.`);
      await this.fetchMyGuild();
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể truyền ngôi.');
    }
  }

  /**
   * Sửa Cáo Thị Môn Phái
   */
  async updateNoticeSubmit(guildId) {
    const curNotice = this.myGuildData.guild.notice || '';
    const newNotice = prompt('Sửa đổi cáo thị / lời răn nội bộ Tông môn (tối đa 500 ký tự):', curNotice);
    if (newNotice === null) return;

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}/notice`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ notice: newNotice.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi cập nhật cáo thị.');
      }

      alert('Đã cập nhật cáo thị môn phái thành công.');
      await this.fetchMyGuild();
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể cập nhật cáo thị.');
    }
  }

  /**
   * Giải Tán Tông Môn
   */
  async disbandGuildSubmit(guildId) {
    const confirmName = prompt(`Hành động này sẽ XÓA BỎ VĨNH VIỄN Tông Môn và giải tán toàn bộ đệ tử!\n\nXin gõ đúng tên Tông Môn "${this.myGuildData.guild.name}" để xác nhận:`);
    if (confirmName !== this.myGuildData.guild.name) {
      if (confirmName !== null) alert('Tên xác nhận không trùng khớp. Hủy bỏ giải tán.');
      return;
    }

    try {
      const res = await fetch(`${this.apiBase}/api/xianxia/guilds/${guildId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Lỗi giải tán Tông môn.');
      }

      alert('Tông môn đã được giải tán thành công, quy hoàn tự do.');
      if (this.chatSocket && this.chatConnected) {
        this.chatSocket.emit('sync_guild');
      }

      await this.fetchMyGuild();
      this.guildActiveTab = 'list';
      await this.fetchGuildsList(1);
      this.renderGuildUI();
    } catch (err) {
      alert(err.message || 'Không thể giải tán Tông môn.');
    }
  }
}

// Khởi chạy khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  window.engine = new TienLoEngine();
  window.engine.init();
});
