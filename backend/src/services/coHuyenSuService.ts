import { prisma } from '../utils/prisma.js';

// ==========================================
// CẤU HÌNH TƯỚNG & PHẨM CẤP CỜ HUYỀN SỬ
// ==========================================

export interface HeroConfig {
  id: string;
  name: string;
  cost: number;
  shardPrice: number; // Giá 1 mảnh bằng Hưng Bảo
  shardsForStar1: number; // Số mảnh cần để ghép 1 thẻ 1 sao
}

export const CHS_HEROES: Record<string, HeroConfig> = {
  // 1 Vàng: 4 HB / mảnh, 20 mảnh ➔ 1 thẻ ★1 (Tổng 80 HB)
  chudongtu: { id: 'chudongtu', name: 'Chử Đồng Tử', cost: 1, shardPrice: 4, shardsForStar1: 20 },
  caolo: { id: 'caolo', name: 'Cao Lỗ', cost: 1, shardPrice: 4, shardsForStar1: 20 },
  maithucloan: { id: 'maithucloan', name: 'Mai Thúc Loan', cost: 1, shardPrice: 4, shardsForStar1: 20 },
  yetkieu: { id: 'yetkieu', name: 'Yết Kiêu', cost: 1, shardPrice: 4, shardsForStar1: 20 },
  lelai: { id: 'lelai', name: 'Lê Lai', cost: 1, shardPrice: 4, shardsForStar1: 20 },
  nguyenxi: { id: 'nguyenxi', name: 'Nguyễn Xí', cost: 1, shardPrice: 4, shardsForStar1: 20 },
  datuong: { id: 'datuong', name: 'Dã Tượng', cost: 1, shardPrice: 4, shardsForStar1: 20 },

  // 2 Vàng: 8 HB / mảnh, 25 mảnh ➔ 1 thẻ ★1 (Tổng 200 HB)
  tiendung: { id: 'tiendung', name: 'Tiên Dung', cost: 2, shardPrice: 8, shardsForStar1: 25 },
  lyongtrong: { id: 'lyongtrong', name: 'Lý Ông Trọng', cost: 2, shardPrice: 8, shardsForStar1: 25 },
  trungnhi: { id: 'trungnhi', name: 'Trưng Nhị', cost: 2, shardPrice: 8, shardsForStar1: 25 },
  phunghung: { id: 'phunghung', name: 'Phùng Hưng', cost: 2, shardPrice: 8, shardsForStar1: 25 },
  tranquoctoan: { id: 'tranquoctoan', name: 'Trần Quốc Toản', cost: 2, shardPrice: 8, shardsForStar1: 25 },
  phamngulao: { id: 'phamngulao', name: 'Phạm Ngũ Lão', cost: 2, shardPrice: 8, shardsForStar1: 25 },

  // 3 Vàng: 15 HB / mảnh, 30 mảnh ➔ 1 thẻ ★1 (Tổng 450 HB)
  batrieu: { id: 'batrieu', name: 'Bà Triệu', cost: 3, shardPrice: 15, shardsForStar1: 30 },
  thuytinh: { id: 'thuytinh', name: 'Thủy Tinh', cost: 3, shardPrice: 15, shardsForStar1: 30 },
  kimquy: { id: 'kimquy', name: 'Kim Quy', cost: 3, shardPrice: 15, shardsForStar1: 30 },
  lythuongkiet: { id: 'lythuongkiet', name: 'Lý Thường Kiệt', cost: 3, shardPrice: 15, shardsForStar1: 30 },

  // 4 Vàng: 30 HB / mảnh, 40 mảnh ➔ 1 thẻ ★1 (Tổng 1.200 HB)
  anduongvuong: { id: 'anduongvuong', name: 'An Dương Vương', cost: 4, shardPrice: 30, shardsForStar1: 40 },
  leloi: { id: 'leloi', name: 'Lê Lợi', cost: 4, shardPrice: 30, shardsForStar1: 40 },
  nguyentrai: { id: 'nguyentrai', name: 'Nguyễn Trãi', cost: 4, shardPrice: 30, shardsForStar1: 40 },
  buithixuan: { id: 'buithixuan', name: 'Bùi Thị Xuân', cost: 4, shardPrice: 30, shardsForStar1: 40 },
  tranquangdieu: { id: 'tranquangdieu', name: 'Trần Quang Diệu', cost: 4, shardPrice: 30, shardsForStar1: 40 },
  tranhungdao: { id: 'tranhungdao', name: 'Trần Hưng Đạo', cost: 4, shardPrice: 30, shardsForStar1: 40 },

  // 5 Vàng: 60 HB / mảnh, 50 mảnh ➔ 1 thẻ ★1 (Tổng 3.000 HB)
  thanhgiong: { id: 'thanhgiong', name: 'Thánh Gióng', cost: 5, shardPrice: 60, shardsForStar1: 50 },
  sontinh: { id: 'sontinh', name: 'Sơn Tinh', cost: 5, shardPrice: 60, shardsForStar1: 50 },
  aucơ: { id: 'aucơ', name: 'Âu Cơ', cost: 5, shardPrice: 60, shardsForStar1: 50 },
  auco: { id: 'auco', name: 'Âu Cơ', cost: 5, shardPrice: 60, shardsForStar1: 50 },
  laclongquan: { id: 'laclongquan', name: 'Lạc Long Quân', cost: 5, shardPrice: 60, shardsForStar1: 50 },
  ngoquyen: { id: 'ngoquyen', name: 'Ngô Quyền', cost: 5, shardPrice: 60, shardsForStar1: 50 },
  nguyenhue: { id: 'nguyenhue', name: 'Nguyễn Huệ', cost: 5, shardPrice: 60, shardsForStar1: 50 },
};

// Chi phí Quân Lương theo Sao
export const RATION_POINTS: Record<number, number> = {
  1: 3, // Thẻ 1 sao: 3 điểm
  2: 5, // Thẻ 2 sao: 5 điểm
  3: 7, // Thẻ 3 sao: 7 điểm
};

export const MAX_RATION_POINTS = 10; // Tổng quân lương tối đa = 10

// Thưởng Danh Vọng (trước là Hưng Bảo) theo thứ hạng
export const RANK_REWARDS: Record<number, { hb: number; elo: number }> = {
  1: { hb: 50, elo: 35 },
  2: { hb: 35, elo: 25 },
  3: { hb: 25, elo: 15 },
  4: { hb: 15, elo: 5 },
  5: { hb: 10, elo: -5 },
  6: { hb: 8, elo: -15 },
  7: { hb: 6, elo: -25 },
  8: { hb: 4, elo: -35 },
};

// ==========================================
// BỘ NHỚ TẠM (IN-MEMORY FALLBACK CHO LOCAL/DEMO)
// ==========================================
interface UserMemoryData {
  hungBao: number;
  shards: Record<string, number>;
  cards: Array<{ id: string; heroId: string; star: number; isEquipped: boolean }>;
  deck: Array<{ heroId: string; star: number }>;
  dailyPurchases: Record<string, Record<number, number>>; // dateKey -> { slotIndex: count }
}

const memoryStore: Record<number, UserMemoryData> = {};

function getMemoryUser(userId: number): UserMemoryData {
  if (!memoryStore[userId]) {
    memoryStore[userId] = {
      hungBao: 120, // Khởi đầu tặng 120 Hưng Bảo trải nghiệm
      shards: { caolo: 10, chudongtu: 6 },
      cards: [
        { id: 'init-card-1', heroId: 'caolo', star: 1, isEquipped: true }
      ],
      deck: [{ heroId: 'caolo', star: 1 }],
      dailyPurchases: {},
    };
  }
  return memoryStore[userId];
}

function getTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ==========================================
// LOGIC CHIÊU HIỀN CÁC (8 Ô XOAY TUA)
// ==========================================

export interface ShopSlot {
  slotIndex: number;
  heroId: string;
  name: string;
  cost: number;
  priceHb: number;
  rotationDays: number;
  maxPerDay: number;
  remainingToday: number;
}

// Danh sách nhóm tướng xoay tua
const POOL_1_2 = ['chudongtu', 'caolo', 'maithucloan', 'yetkieu', 'lelai', 'nguyenxi', 'datuong', 'tiendung', 'lyongtrong', 'trungnhi', 'phunghung', 'tranquoctoan', 'phamngulao'];
const POOL_3_4 = ['batrieu', 'thuytinh', 'kimquy', 'lythuongkiet', 'anduongvuong', 'leloi', 'nguyentrai', 'buithixuan', 'tranquangdieu', 'tranhungdao'];
const POOL_5 = ['thanhgiong', 'sontinh', 'laclongquan', 'auco', 'ngoquyen', 'nguyenhue'];

export function generateShopSlots(userId: number): ShopSlot[] {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(dayOfYear / 7);
  const fiveDayPeriod = Math.floor(dayOfYear / 5);

  const u = getMemoryUser(userId);
  const todayKey = getTodayKey();
  const userPurchases = u.dailyPurchases[todayKey] || {};

  const slots: ShopSlot[] = [];

  // Ô 1 - Ô 4: Tướng 1-2 đồng (xoay tua 1 ngày 1 lần theo dayOfYear)
  for (let i = 0; i < 4; i++) {
    const heroId = POOL_1_2[(dayOfYear + i * 3) % POOL_1_2.length];
    const cfg = CHS_HEROES[heroId];
    const bought = userPurchases[i + 1] || 0;
    slots.push({
      slotIndex: i + 1,
      heroId,
      name: cfg.name,
      cost: cfg.cost,
      priceHb: cfg.shardPrice,
      rotationDays: 1,
      maxPerDay: 3,
      remainingToday: Math.max(0, 3 - bought),
    });
  }

  // Ô 5 - Ô 7: Tướng 3-4 đồng (xoay tua 5 ngày 1 lần theo fiveDayPeriod)
  for (let i = 0; i < 3; i++) {
    const heroId = POOL_3_4[(fiveDayPeriod + i * 2) % POOL_3_4.length];
    const cfg = CHS_HEROES[heroId];
    const bought = userPurchases[i + 5] || 0;
    slots.push({
      slotIndex: i + 5,
      heroId,
      name: cfg.name,
      cost: cfg.cost,
      priceHb: cfg.shardPrice,
      rotationDays: 5,
      maxPerDay: 3,
      remainingToday: Math.max(0, 3 - bought),
    });
  }

  // Ô 8: Tướng 5 đồng (xoay tua 7 ngày 1 lần theo weekNumber)
  const hero5Id = POOL_5[weekNumber % POOL_5.length];
  const cfg5 = CHS_HEROES[hero5Id];
  const bought8 = userPurchases[8] || 0;
  slots.push({
    slotIndex: 8,
    heroId: hero5Id,
    name: cfg5.name,
    cost: cfg5.cost,
    priceHb: cfg5.shardPrice,
    rotationDays: 7,
    maxPerDay: 3,
    remainingToday: Math.max(0, 3 - bought8),
  });

  return slots;
}

// ==========================================
// CÁC HÀM XỬ LÝ KINH TẾ & THẺ TƯỚNG
// ==========================================

export const coHuyenSuService = {
  // Lấy dữ liệu tổng quan người chơi (Hưng Bảo, Mảnh, Thẻ, Deck)
  async getUserOverview(userId: number) {
    try {
      const eco = await prisma.chsEconomy.findUnique({ where: { user_id: userId } });
      const shards = await prisma.chsHeroShard.findMany({ where: { user_id: userId } });
      const cards = await prisma.chsHeroCard.findMany({ where: { user_id: userId }, orderBy: [{ star: 'desc' }, { created_at: 'asc' }] });
      const deck = await prisma.chsDeck.findUnique({ where: { user_id: userId } });

      return {
        hungBao: eco ? eco.hung_bao : 100,
        shards: shards.reduce((acc, s) => ({ ...acc, [s.hero_id]: s.quantity }), {}),
        cards: cards.map(c => ({ id: c.id, heroId: c.hero_id, star: c.star, isEquipped: c.is_equipped })),
        deck: deck ? [deck.card_1_id, deck.card_2_id, deck.card_3_id].filter(Boolean) : [],
        shop: generateShopSlots(userId),
      };
    } catch {
      // Fallback in-memory
      const u = getMemoryUser(userId);
      return {
        hungBao: u.hungBao,
        shards: u.shards,
        cards: u.cards,
        deck: u.deck,
        shop: generateShopSlots(userId),
      };
    }
  },

  // Mua mảnh tướng trong Chiêu Hiền Các
  async buyShard(userId: number, slotIndex: number, amount: number = 1) {
    if (amount <= 0 || amount > 3) throw new Error('Số lượng mua không hợp lệ (1 - 3 mảnh)');

    const slots = generateShopSlots(userId);
    const slot = slots.find(s => s.slotIndex === slotIndex);
    if (!slot) throw new Error('Ô hàng không tồn tại');
    if (slot.remainingToday < amount) throw new Error(`Hôm nay bạn chỉ còn mua được tối đa ${slot.remainingToday} mảnh cho vị tướng này`);

    const totalCost = slot.priceHb * amount;

    try {
      let eco = await prisma.chsEconomy.findUnique({ where: { user_id: userId } });
      if (!eco || eco.hung_bao < totalCost) throw new Error(`Không đủ Hưng Bảo (Cần ${totalCost} HB, bạn có ${eco?.hung_bao || 0} HB)`);

      const todayKey = getTodayKey();
      await prisma.$transaction([
        prisma.chsEconomy.update({ where: { user_id: userId }, data: { hung_bao: { decrement: totalCost } } }),
        prisma.chsHeroShard.upsert({
          where: { user_id_hero_id: { user_id: userId, hero_id: slot.heroId } },
          create: { user_id: userId, hero_id: slot.heroId, quantity: amount },
          update: { quantity: { increment: amount } },
        }),
        prisma.chsDailyPurchase.upsert({
          where: { user_id_slot_index_date_key: { user_id: userId, slot_index: slotIndex, date_key: todayKey } },
          create: { user_id: userId, slot_index: slotIndex, date_key: todayKey, bought_count: amount },
          update: { bought_count: { increment: amount } },
        }),
      ]);

      return this.getUserOverview(userId);
    } catch {
      // Memory fallback
      const u = getMemoryUser(userId);
      if (u.hungBao < totalCost) throw new Error(`Không đủ Hưng Bảo (Cần ${totalCost} HB, hiện có ${u.hungBao} HB)`);
      u.hungBao -= totalCost;
      u.shards[slot.heroId] = (u.shards[slot.heroId] || 0) + amount;
      const todayKey = getTodayKey();
      if (!u.dailyPurchases[todayKey]) u.dailyPurchases[todayKey] = {};
      u.dailyPurchases[todayKey][slotIndex] = (u.dailyPurchases[todayKey][slotIndex] || 0) + amount;

      return this.getUserOverview(userId);
    }
  },

  // Ghép Mảnh ➔ Thẻ Tướng 1 Sao (★1)
  async fuseShardsToCard(userId: number, heroId: string) {
    const cfg = CHS_HEROES[heroId];
    if (!cfg) throw new Error('Tướng không hợp lệ');

    const u = getMemoryUser(userId);
    const shardsHave = u.shards[heroId] || 0;
    if (shardsHave < cfg.shardsForStar1) {
      throw new Error(`Cần đủ ${cfg.shardsForStar1} mảnh để ghép thẻ ★1 (Bạn đang có ${shardsHave} mảnh)`);
    }

    try {
      await prisma.$transaction([
        prisma.chsHeroShard.update({
          where: { user_id_hero_id: { user_id: userId, hero_id: heroId } },
          data: { quantity: { decrement: cfg.shardsForStar1 } },
        }),
        prisma.chsHeroCard.create({
          data: { user_id: userId, hero_id: heroId, star: 1 },
        }),
      ]);
    } catch {
      u.shards[heroId] -= cfg.shardsForStar1;
      u.cards.push({
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        heroId,
        star: 1,
        isEquipped: false,
      });
    }

    return this.getUserOverview(userId);
  },

  // Hợp 3 Thẻ Sao Thấp ➔ 1 Thẻ Sao Cao (3 thẻ ★1 ➔ 1 thẻ ★2, 3 thẻ ★2 ➔ 1 thẻ ★3)
  async mergeCards(userId: number, heroId: string, currentStar: number) {
    if (currentStar !== 1 && currentStar !== 2) throw new Error('Chỉ có thể hợp từ 1★ lên 2★ hoặc từ 2★ lên 3★');

    const u = getMemoryUser(userId);
    const matchingCards = u.cards.filter(c => c.heroId === heroId && c.star === currentStar && !c.isEquipped);
    if (matchingCards.length < 3) {
      throw new Error(`Cần tối thiểu 3 thẻ ${currentStar}★ chưa trang bị để hợp lên ${currentStar + 1}★ (Bạn có ${matchingCards.length} thẻ)`);
    }

    try {
      const toDeleteIds = matchingCards.slice(0, 3).map(c => c.id);
      await prisma.$transaction([
        prisma.chsHeroCard.deleteMany({ where: { id: { in: toDeleteIds } } }),
        prisma.chsHeroCard.create({ data: { user_id: userId, hero_id: heroId, star: currentStar + 1 } }),
      ]);
    } catch {
      const toDelete = new Set(matchingCards.slice(0, 3).map(c => c.id));
      u.cards = u.cards.filter(c => !toDelete.has(c.id));
      u.cards.push({
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        heroId,
        star: currentStar + 1,
        isEquipped: false,
      });
    }

    return this.getUserOverview(userId);
  },

  // Cập nhật Quân Lương & Bộ Thẻ Xuất Trận (Deck Loadout)
  async updateDeck(userId: number, selectedCards: Array<{ heroId: string; star: number }>) {
    // Tính tổng điểm quân lương
    let totalRation = 0;
    for (const card of selectedCards) {
      const pts = RATION_POINTS[card.star] || 3;
      totalRation += pts;
    }

    if (totalRation > MAX_RATION_POINTS) {
      throw new Error(`Vượt quá Quân Lương cho phép! Tổng điểm là ${totalRation}/${MAX_RATION_POINTS}. Hãy chọn lại.`);
    }

    const u = getMemoryUser(userId);
    u.deck = selectedCards;
    // Cập nhật trạng thái isEquipped
    u.cards.forEach(c => {
      c.isEquipped = selectedCards.some(sc => sc.heroId === c.heroId && sc.star === c.star);
    });

    return {
      success: true,
      usedRation: totalRation,
      maxRation: MAX_RATION_POINTS,
      deck: u.deck,
    };
  },

  // Thưởng Hưng Bảo sau trận đấu theo Thứ hạng (Rank 1 -> 8)
  async awardMatchRewards(userId: number, rankPlace: number) {
    const reward = RANK_REWARDS[rankPlace] || { hb: 3, elo: -35 };
    const u = getMemoryUser(userId);
    u.hungBao += reward.hb;

    try {
      await prisma.chsEconomy.upsert({
        where: { user_id: userId },
        create: { user_id: userId, hung_bao: reward.hb },
        update: { hung_bao: { increment: reward.hb } },
      });
    } catch {
      // Handled in memory
    }

    return {
      rankPlace,
      rewardHb: reward.hb,
      rewardDv: reward.hb,
      eloChange: reward.elo,
      currentHungBao: u.hungBao,
      currentDanhVong: u.hungBao,
    };
  },
};
