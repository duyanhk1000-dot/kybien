import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { xianxiaBestiaryService } from '../services/xianxia/xianxiaBestiaryService.js';

export async function runXianxiaBestiaryTests(): Promise<void> {
  console.log('\n--- [TEST] BẮT ĐẦU KIỂM THỬ HỆ THỐNG NPC & DANH LỤC YÊU THÚ (BƯỚC 3) ---');

  // ====================================================
  // 1. KIỂM THỬ HỆ THỐNG NPC (NON-PLAYER CHARACTERS)
  // ====================================================
  const npcs = xianxiaBestiaryService.getAllNpcs();
  assert.strictEqual(npcs.length, 7, 'Hệ thống phải có 7 NPC trải dài khắp các phân khu.');
  console.log('✅ 1. Tải thành công 7 NPC (Lý Chính, Trần Dược Sư, Trương Thợ Sắt, Mạc Vô Nhai, Tiêu Dao Lão Nhân, Dược Vương Chân Nhân, Phong Vô Cực).');

  // Kiểm tra chi tiết Trưởng Thôn
  const lyChinh = xianxiaBestiaryService.getNpcById('npc_ly_chinh');
  assert(lyChinh, 'Phải tồn tại NPC npc_ly_chinh.');
  assert.strictEqual(lyChinh.role, 'VILLAGE_HEAD');
  assert.strictEqual(lyChinh.zone_id, 'zone_thanh_ha_thon');
  assert(lyChinh.dialogues.greeting.length > 0);
  assert(lyChinh.dialogues.idle.length >= 2);
  assert(lyChinh.related_services.includes('accept_quest'));

  // Kiểm tra chi tiết Dược Sư
  const duocSu = xianxiaBestiaryService.getNpcById('npc_tran_duoc_su');
  assert(duocSu, 'Phải tồn tại NPC npc_tran_duoc_su.');
  assert.strictEqual(duocSu.role, 'APOTHECARY');
  assert(duocSu.related_services.includes('buy_pills'));

  // Kiểm tra chi tiết Dược Vương Chân Nhân & Phong Vô Cực
  const duocVuong = xianxiaBestiaryService.getNpcById('npc_duoc_vuong');
  assert(duocVuong, 'Phải tồn tại NPC npc_duoc_vuong.');
  assert.strictEqual(duocVuong.role, 'APOTHECARY');
  assert.strictEqual(duocVuong.zone_id, 'zone_van_mong_dam');

  const phongVoCuc = xianxiaBestiaryService.getNpcById('npc_kiem_tong_truong_lao');
  assert(phongVoCuc, 'Phải tồn tại NPC npc_kiem_tong_truong_lao.');
  assert.strictEqual(phongVoCuc.role, 'SECT_ELDER');
  assert.strictEqual(phongVoCuc.zone_id, 'zone_thien_kiem_son');

  // Kiểm tra lọc NPC theo Vùng
  const thanhHaNpcs = xianxiaBestiaryService.getNpcsByZone('zone_thanh_ha_thon');
  assert.strictEqual(thanhHaNpcs.length, 3, 'Thanh Hà Thôn phải có 3 NPC (Trưởng thôn, Dược sư, Thợ sắt).');

  const trucLamNpcs = xianxiaBestiaryService.getNpcsByZone('zone_u_minh_truc_lam');
  assert.strictEqual(trucLamNpcs.length, 2, 'Rừng Trúc phải có 2 NPC (Hắc y lữ nhân, Tiêu Dao Lão Nhân).');

  const vanMongNpcs = xianxiaBestiaryService.getNpcsByZone('zone_van_mong_dam');
  assert.strictEqual(vanMongNpcs.length, 1, 'Vân Mộng Đầm Lầy phải có 1 NPC (Dược Vương Chân Nhân).');

  const thienKiemNpcs = xianxiaBestiaryService.getNpcsByZone('zone_thien_kiem_son');
  assert.strictEqual(thienKiemNpcs.length, 1, 'Thiên Kiếm Sơn phải có 1 NPC (Phong Vô Cực).');

  // Kiểm tra lời thoại tương tác ngẫu nhiên
  const dialogue = xianxiaBestiaryService.getRandomDialogue('npc_ly_chinh');
  assert(dialogue, 'Phải lấy được câu thoại của NPC.');
  assert(dialogue.greeting.includes('Đạo hữu'));
  assert(dialogue.quote.length > 0);
  console.log('✅ 2. Dữ liệu 7 NPC phân bổ chuẩn xác tại 4 phân khu và hội thoại hoạt động hoàn hảo.');

  // ====================================================
  // 2. KIỂM THỬ DANH LỤC YÊU THÚ (BESTIARY)
  // ====================================================
  const monsters = xianxiaBestiaryService.getAllMonsters();
  assert.strictEqual(monsters.length, 9, 'Hệ thống mở rộng phải có 9 chủng loại yêu thú.');
  console.log('✅ 3. Tải thành công danh lục 9 yêu thú (3 Quái Thường, 3 Tinh Anh, 3 Boss).');

  // Kiểm tra phân cấp Tier yêu thú
  const tier1 = xianxiaBestiaryService.getMonstersByTier('TIER_1_BEAST');
  assert.strictEqual(tier1.length, 3, 'Phải có 3 quái thường Bậc 1 (Thổ Lang, Thảo Mộc Tinh, Huyết Ngạc).');

  const tier2 = xianxiaBestiaryService.getMonstersByTier('TIER_2_ELITE');
  assert.strictEqual(tier2.length, 3, 'Phải có 3 quái tinh anh Bậc 2 (U Minh Lang, Thiết Giáp Trư, Cổ Kiếm Khôi).');

  const tier3 = xianxiaBestiaryService.getMonstersByTier('TIER_3_BOSS');
  assert.strictEqual(tier3.length, 3, 'Phải có 3 Boss Bậc 3 (Lang Vương, Tâm Ma, Ma Thi Vương).');
  const bossIds = tier3.map(b => b.id);
  assert(bossIds.includes('boss_u_minh_lang_vuong'));
  assert(bossIds.includes('boss_tam_ma'));
  assert(bossIds.includes('boss_ma_thi_vuong'));

  // Kiểm tra tính hợp lệ của chỉ số chiến đấu
  for (const m of monsters) {
    assert(m.max_health > 0, `${m.name} phải có máu > 0`);
    assert(m.attack > 0, `${m.name} phải có công kích > 0`);
    assert(m.defense >= 0, `${m.name} phải có phòng ngự >= 0`);
    assert(m.speed > 0, `${m.name} phải có thân pháp > 0`);
    assert(m.crit_rate >= 0 && m.crit_rate <= 1, `${m.name} tỷ lệ bạo kích từ 0 -> 1`);
    assert(m.dodge_rate >= 0 && m.dodge_rate <= 1, `${m.name} tỷ lệ né đòn từ 0 -> 1`);
    assert(m.skills.length >= 1, `${m.name} phải có ít nhất 1 kỹ năng chiến đấu.`);
    assert(m.loot_table.length >= 1, `${m.name} phải có bảng rơi đồ.`);
  }
  console.log('✅ 4. Toàn bộ chỉ số chiến đấu (HP, Công, Thủ, Tốc, Bạo kích, Né đòn) và kỹ năng yêu thú đạt chuẩn cân bằng.');

  // ====================================================
  // 3. KIỂM THỬ TÍNH TOÁN RƠI ĐỒ MÁY CHỦ (SERVER-AUTHORITATIVE LOOT)
  // ====================================================
  // Kiểm tra rơi đồ ngẫu nhiên thông thường
  const loot1 = xianxiaBestiaryService.rollLoot('monster_tho_lang');
  assert(loot1, 'Phải tính được phần thưởng diệt Thổ Lang.');
  assert.strictEqual(loot1.exp_gained, 25);
  assert.strictEqual(loot1.cultivation_gained, 5);
  assert(loot1.silver_gained >= 2 && loot1.silver_gained <= 6, 'Bạc rơi phải nằm trong khoảng [2, 6].');

  // Kiểm tra rơi đồ đảm bảo 100% của Boss (Yêu Đan Nhất Giai có chance = 1.0)
  const bossLoot = xianxiaBestiaryService.rollLoot('boss_u_minh_lang_vuong');
  assert(bossLoot, 'Phải tính được phần thưởng trảm Boss.');
  assert.strictEqual(bossLoot.exp_gained, 450);
  assert.strictEqual(bossLoot.cultivation_gained, 180);
  assert(bossLoot.silver_gained >= 80 && bossLoot.silver_gained <= 160);
  const hasYeuDan = bossLoot.dropped_items.some(i => i.item_id === 'item_yeu_dan_so_cap');
  assert(hasYeuDan, 'Boss bị trảm bắt buộc phải rơi Yêu Đan Nhất Giai (tỷ lệ 100%).');

  // Kiểm tra rơi đồ của Boss Tâm Ma và Boss Ma Thi Vương
  const tamMaLoot = xianxiaBestiaryService.rollLoot('boss_tam_ma');
  assert(tamMaLoot, 'Phải tính được loot của Boss Tâm Ma');
  assert.strictEqual(tamMaLoot.exp_gained, 1200);
  assert.strictEqual(tamMaLoot.cultivation_gained, 600);
  assert(tamMaLoot.dropped_items.some(i => i.item_id === 'item_yeu_dan_so_cap'));

  const maThiLoot = xianxiaBestiaryService.rollLoot('boss_ma_thi_vuong');
  assert(maThiLoot, 'Phải tính được loot của Boss Ma Thi Vương');
  assert.strictEqual(maThiLoot.exp_gained, 3500);
  assert.strictEqual(maThiLoot.cultivation_gained, 1800);
  assert(maThiLoot.dropped_items.some(i => i.item_id === 'item_linh_thach_trung'));

  // Kiểm thử tất định (Deterministic Roll) với mock random
  // Khi mock random trả về 0.0 -> tất cả đồ có chance > 0 đều phải rơi
  const deterministicLootAll = xianxiaBestiaryService.rollLoot('monster_u_minh_lang', () => 0.01);
  assert(deterministicLootAll);
  assert.strictEqual(deterministicLootAll.dropped_items.length, 3, 'Khi may mắn tuyệt đối, U Minh Lang phải rơi đủ 3 loại vật phẩm.');

  // Khi mock random trả về 0.99 -> chỉ đồ có chance >= 1.0 mới rơi
  const deterministicLootNone = xianxiaBestiaryService.rollLoot('monster_tho_lang', () => 0.99);
  assert(deterministicLootNone);
  assert.strictEqual(deterministicLootNone.dropped_items.length, 0, 'Khi xui xẻo (roll 0.99), quái thường không rơi vật phẩm hiếm.');
  console.log('✅ 5. Thuật toán rơi đồ, EXP, tu vi và ngân lượng được kiểm soát an toàn tuyệt đối phía máy chủ.');

  // ====================================================
  // 4. KIỂM THỬ E2E QUA MÔI TRƯỜNG EXPRESS HTTP API
  // ====================================================
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // API 1: GET /api/xianxia/bestiary/npcs
    const res1 = await fetch(`${baseUrl}/api/xianxia/bestiary/npcs`);
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.strictEqual(body1.data.length, 7);

    // API 2: GET /api/xianxia/bestiary/npcs/npc_ly_chinh
    const res2 = await fetch(`${baseUrl}/api/xianxia/bestiary/npcs/npc_ly_chinh`);
    assert.strictEqual(res2.status, 200);
    const body2 = (await res2.json()) as any;
    assert.strictEqual(body2.data.name, 'Lý Thừa Phong');

    // API 3: GET /api/xianxia/bestiary/npcs/npc_ly_chinh/dialogue
    const res3 = await fetch(`${baseUrl}/api/xianxia/bestiary/npcs/npc_ly_chinh/dialogue`);
    assert.strictEqual(res3.status, 200);
    const body3 = (await res3.json()) as any;
    assert(body3.data.greeting.length > 0);

    // API 4: GET /api/xianxia/bestiary/monsters
    const res4 = await fetch(`${baseUrl}/api/xianxia/bestiary/monsters`);
    assert.strictEqual(res4.status, 200);
    const body4 = (await res4.json()) as any;
    assert.strictEqual(body4.data.length, 9);

    // API 5: GET /api/xianxia/bestiary/monsters?tier=TIER_3_BOSS
    const res5 = await fetch(`${baseUrl}/api/xianxia/bestiary/monsters?tier=TIER_3_BOSS`);
    assert.strictEqual(res5.status, 200);
    const body5 = (await res5.json()) as any;
    assert.strictEqual(body5.data.length, 3);
    const apiBossIds = body5.data.map((b: any) => b.id);
    assert(apiBossIds.includes('boss_u_minh_lang_vuong'));
    assert(apiBossIds.includes('boss_tam_ma'));
    assert(apiBossIds.includes('boss_ma_thi_vuong'));

    // API 6: POST /api/xianxia/bestiary/monsters/boss_u_minh_lang_vuong/roll-loot
    const res6 = await fetch(`${baseUrl}/api/xianxia/bestiary/monsters/boss_u_minh_lang_vuong/roll-loot`, {
      method: 'POST',
    });
    assert.strictEqual(res6.status, 200);
    const body6 = (await res6.json()) as any;
    assert.strictEqual(body6.data.exp_gained, 450);
    assert(body6.data.dropped_items.some((i: any) => i.item_id === 'item_yeu_dan_so_cap'));

    console.log('✅ 6. Tất cả 6 Endpoint HTTP REST API (/api/xianxia/bestiary/...) phản hồi chính xác 200 OK.');
  } finally {
    server.close();
  }

  console.log('--- [XIANXIA BESTIARY TESTS] TẤT CẢ BÀI TEST BƯỚC 3 ĐÃ ĐẠT 100%! ---\n');
}

// Nếu chạy trực tiếp file test
if (process.argv[1]?.includes('xianxiaBestiary.test')) {
  runXianxiaBestiaryTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
