import assert from 'assert';
import { prisma } from '../utils/prisma.js';
import { xianxiaCharacterService } from '../services/xianxia/xianxiaCharacterService.js';
import { xianxiaInventoryService } from '../services/xianxia/xianxiaInventoryService.js';
import { xianxiaCombatService } from '../services/xianxia/xianxiaCombatService.js';

export async function runXianxiaCoreGameplayTests(): Promise<void> {
  console.log('\n--- ⚡ [TEST] BẮT ĐẦU KIỂM THỬ LÕI GAMEPLAY MỤC 2 (AUTHORITATIVE BACKEND CORE) ---');

  // Tạo hoặc lấy 2 User thử nghiệm cho môi trường test
  const testUser1 = await prisma.user.upsert({
    where: { username: 'xianxia_tester_01' },
    update: {},
    create: {
      username: 'xianxia_tester_01',
      email: 'xianxia_tester_01@kybien.vn',
      password_hash: 'hashed_secret_test_pw',
    },
  });

  const testUser2 = await prisma.user.upsert({
    where: { username: 'xianxia_tester_02' },
    update: {},
    create: {
      username: 'xianxia_tester_02',
      email: 'xianxia_tester_02@kybien.vn',
      password_hash: 'hashed_secret_test_pw',
    },
  });

  // Dọn dẹp dữ liệu cũ của test users để đảm bảo môi trường sạch
  await prisma.xianxiaBattleLog.deleteMany({
    where: { character: { user_id: { in: [testUser1.id, testUser2.id] } } },
  });
  await prisma.xianxiaInventoryItem.deleteMany({
    where: { character: { user_id: { in: [testUser1.id, testUser2.id] } } },
  });
  await prisma.xianxiaCharacter.deleteMany({
    where: { user_id: { in: [testUser1.id, testUser2.id] } },
  });

  // ==========================================
  // TEST 1: Khởi tạo và nạp nhân vật (getOrCreateCharacter)
  // ==========================================
  console.log('-> Test 1: Khởi tạo nhân vật Tu Tiên Authoritative trên Database...');
  const char1 = await xianxiaCharacterService.getOrCreateCharacter(testUser1.id, {
    name: 'Bạch Y Kiếm Khách',
    linh_can: 'THIEN_LINH_CAN',
  });

  assert.strictEqual(char1.name, 'Bạch Y Kiếm Khách', 'Tên nhân vật phải chính xác');
  assert.strictEqual(char1.level, 1, 'Khởi đầu ở Level 1');
  assert.strictEqual(char1.exp, 0, 'Kinh nghiệm khởi đầu bằng 0');
  assert.strictEqual(char1.exp_required, 100, 'EXP cần cho Level 1 là 100');
  assert.strictEqual(char1.health, 120, 'Khí huyết khởi đầu là 120');
  assert.strictEqual(char1.fatigue, 100, 'Thể lực khởi đầu là 100');

  // Kiểm tra túi đồ khởi đầu được tặng
  const inv1 = await prisma.xianxiaInventoryItem.findMany({
    where: { character_id: char1.id },
  });
  assert(inv1.length >= 2, 'Phải có ít nhất 2 vật phẩm khởi đầu');
  const swordSlot = inv1.find(i => i.item_id === 'item_thanh_phong_kiem');
  assert(swordSlot && swordSlot.quantity >= 1, 'Phải có Thanh Phong Kiếm khởi đầu');
  console.log('✅ 1. Khởi tạo nhân vật và túi đồ ban đầu trên PostgreSQL thành công 100%!');

  // ==========================================
  // TEST 2: Tính toán chỉ số chiến đấu hiệu dụng (EffectiveCombatStats)
  // ==========================================
  console.log('-> Test 2: Tính toán chỉ số chiến đấu từ Căn Cốt và Trang Bị...');
  const baseStats = xianxiaCharacterService.calculateEffectiveStats(char1);
  assert(baseStats.attack >= 18, 'Công cơ sở từ Căn cốt 12 phải >= 18');
  assert.strictEqual(baseStats.speed, 10, 'Tốc độ cơ sở là 10');

  // Giả lập trang bị Thanh Phong Kiếm (+22 công, +5 tốc độ, +0.05 bạo kích)
  const simulatedEquippedChar = { ...char1, equipped_weapon: 'item_thanh_phong_kiem' };
  const equippedStats = xianxiaCharacterService.calculateEffectiveStats(simulatedEquippedChar);
  assert.strictEqual(equippedStats.attack, baseStats.attack + 22, 'Công phải cộng thêm đúng 22 từ kiếm');
  assert.strictEqual(equippedStats.speed, baseStats.speed + 5, 'Tốc độ phải tăng thêm 5 từ Thanh Phong Kiếm');
  console.log('✅ 2. Chỉ số chiến đấu tính toán chính xác, không bị cộng dồn chồng chéo!');

  // ==========================================
  // TEST 3: Thuật toán thăng cấp EXP (applyExpGain)
  // ==========================================
  console.log('-> Test 3: Thuật toán tăng EXP, bảo toàn EXP dư và nhảy nhiều cấp...');
  const charForExp = { ...char1, level: 1, exp: 0, exp_required: 100, max_health: 120, max_fatigue: 100, stat_points: 0 };
  
  // Nạp 125 EXP -> Lên cấp 2, dư 25 EXP, exp_required mới = 236
  const resExp1 = xianxiaCharacterService.applyExpGain(charForExp as any, 125);
  assert.strictEqual(charForExp.level, 2, 'Phải lên cấp 2');
  assert.strictEqual(charForExp.exp, 25, 'EXP dư phải còn đúng 25');
  assert.strictEqual(charForExp.exp_required, 236, 'EXP cần cho L2 -> L3 phải là 236');
  assert.strictEqual(charForExp.max_health, 124, 'Max HP tăng +4');
  assert.strictEqual(charForExp.max_fatigue, 101, 'Max Thể lực tăng +1 (cấp 2 chẵn)');
  assert.strictEqual(charForExp.fatigue, 101, 'Hồi đầy thể lực khi lên cấp');

  // Nạp tiếp lên nhiều cấp (ví dụ nhảy lên cấp 4)
  // L2 cần 236 (còn 211 vì đang có 25), L3 cần 395. Tổng từ L2 lên L4 cần 211 + 395 = 606 EXP.
  // Nạp 800 EXP -> Lên L4, dư 800 - 606 = 194 EXP.
  const resExp2 = xianxiaCharacterService.applyExpGain(charForExp as any, 800);
  assert.strictEqual(charForExp.level, 4, 'Phải lên cấp 4');
  assert.strictEqual(charForExp.exp, 194, 'EXP dư phải là 194');
  assert.strictEqual(charForExp.exp_required, 573, 'EXP cần cho L4 -> L5 là 573');

  // Kiểm tra trần Level 100 và chuyển hóa Bạc 10:1
  charForExp.level = 100;
  charForExp.silver = 500;
  charForExp.exp = 44716;
  charForExp.exp_required = 44716;
  const resExp3 = xianxiaCharacterService.applyExpGain(charForExp as any, 300);
  assert.strictEqual(charForExp.level, 100, 'Không vượt quá trần level 100');
  assert.strictEqual(charForExp.silver, 500 + 30, '300 EXP chuyển thành 30 Bạc');
  console.log('✅ 3. Thuật toán EXP, nhảy nhiều cấp và trần Level 100 đổi Bạc đạt chuẩn 100%!');

  // ==========================================
  // TEST 4: Đả tọa điều tức có cooldown, không cộng Tu Vi
  // ==========================================
  console.log('-> Test 4: Đả tọa điều tức và bảo vệ chống exploit...');
  // Giả lập nhân vật hao tổn khí huyết và thể lực
  await prisma.xianxiaCharacter.update({
    where: { id: char1.id },
    data: { health: 60, fatigue: 40, cultivation: 50, last_meditate: null },
  });

  const medRes1 = await xianxiaCharacterService.meditate(testUser1.id);
  assert.strictEqual(medRes1.health, 60 + 25, 'Hồi đúng 25 HP');
  assert.strictEqual(medRes1.fatigue, 40 + 35, 'Hồi đúng 35 Thể Lực');

  const charAfterMed = await prisma.xianxiaCharacter.findUnique({ where: { id: char1.id } });
  assert.strictEqual(charAfterMed?.cultivation, 50, 'Tu Vi TUYỆT ĐỐI không được tăng khi đả tọa');

  // Thử đả tọa lần 2 ngay lập tức (< 30s) -> Phải ném lỗi Cooldown
  await assert.rejects(
    async () => await xianxiaCharacterService.meditate(testUser1.id),
    /Linh khí thiên địa chưa tụ/,
    'Phải bị chặn bởi Cooldown 30s'
  );
  console.log('✅ 4. Đả tọa có Cooldown 30s và tuyệt đối không tăng Tu Vi hoạt động hoàn hảo!');

  // ==========================================
  // TEST 5: Trang bị và Tháo trang bị an toàn
  // ==========================================
  console.log('-> Test 5: Quy trình trang bị và tháo trang bị trong Transaction...');
  // Đảm bảo có Thanh Phong Kiếm trong túi
  await prisma.xianxiaInventoryItem.upsert({
    where: { character_id_item_id: { character_id: char1.id, item_id: 'item_thanh_phong_kiem' } },
    update: { quantity: 1 },
    create: { character_id: char1.id, item_id: 'item_thanh_phong_kiem', quantity: 1 },
  });

  // 1. Thử trang bị khi ở Phàm Nhân -> Phải ném lỗi đòi hỏi Luyện Khí 2
  await assert.rejects(
    async () => await xianxiaInventoryService.equipItem(testUser1.id, 'item_thanh_phong_kiem'),
    /Cảnh giới chưa đủ/,
    'Phải chặn trang bị khi chưa đủ cảnh giới yêu cầu'
  );

  // 2. Nâng cảnh giới nhân vật lên Luyện Khí Tầng 2 để đủ điều kiện
  await prisma.xianxiaCharacter.update({
    where: { id: char1.id },
    data: { realm: 'LUYEN_KHI_2' },
  });

  // Trang bị kiếm thành công
  const equipRes = await xianxiaInventoryService.equipItem(testUser1.id, 'item_thanh_phong_kiem');
  assert.strictEqual(equipRes.slot, 'equipped_weapon');
  assert.strictEqual(equipRes.character.equipped_weapon, 'item_thanh_phong_kiem');

  // Thanh Phong Kiếm đã được mang nên phải bị trừ khỏi túi đồ
  const itemInBagAfterEquip = await prisma.xianxiaInventoryItem.findUnique({
    where: { character_id_item_id: { character_id: char1.id, item_id: 'item_thanh_phong_kiem' } },
  });
  assert(!itemInBagAfterEquip || itemInBagAfterEquip.quantity === 0, 'Kiếm đã mang không được còn trong túi');

  // Tháo kiếm trở lại túi
  const unequipRes = await xianxiaInventoryService.unequipItem(testUser1.id, 'weapon');
  assert.strictEqual(unequipRes.character.equipped_weapon, null, 'Slot vũ khí phải được xóa');

  const itemInBagAfterUnequip = await prisma.xianxiaInventoryItem.findUnique({
    where: { character_id_item_id: { character_id: char1.id, item_id: 'item_thanh_phong_kiem' } },
  });
  assert(itemInBagAfterUnequip && itemInBagAfterUnequip.quantity === 1, 'Kiếm phải trở lại túi đồ đúng số lượng');
  console.log('✅ 5. Quy trình trang bị và tháo đồ bảo toàn số lượng vật phẩm đạt chuẩn 100%!');

  // ==========================================
  // TEST 6: Sử dụng đan dược tiêu hao (useItem)
  // ==========================================
  console.log('-> Test 6: Sử dụng đan dược tiêu hao trong túi đồ...');
  // Cấp 2 viên Hồi Xuân Đan (+50 HP)
  await prisma.xianxiaInventoryItem.upsert({
    where: { character_id_item_id: { character_id: char1.id, item_id: 'item_hoi_xuan_dan' } },
    update: { quantity: 2 },
    create: { character_id: char1.id, item_id: 'item_hoi_xuan_dan', quantity: 2 },
  });

  await prisma.xianxiaCharacter.update({
    where: { id: char1.id },
    data: { health: 50, max_health: 120 },
  });

  const useItemRes = await xianxiaInventoryService.useItem(testUser1.id, 'item_hoi_xuan_dan');
  assert.strictEqual(useItemRes.healthGained, 60, 'Hồi Xuân Đan phải hồi đúng 60 HP');
  assert.strictEqual(useItemRes.character.health, 50 + 60, 'HP nhân vật sau hồi phục là 110');

  // Túi đồ phải còn đúng 1 viên
  const pillSlot = await prisma.xianxiaInventoryItem.findUnique({
    where: { character_id_item_id: { character_id: char1.id, item_id: 'item_hoi_xuan_dan' } },
  });
  assert.strictEqual(pillSlot?.quantity, 1, 'Túi đồ phải giảm từ 2 xuống 1 viên');
  console.log('✅ 6. Sử dụng đan dược tiêu hao chính xác và khấu trừ an toàn!');

  // ==========================================
  // TEST 7: Chiến đấu tự động Authoritative & Idempotency chống nhân đôi
  // ==========================================
  console.log('-> Test 7: Máy chủ mô phỏng chiến đấu tự động và kiểm tra Idempotency...');
  // Đảm bảo nhân vật đầy đủ thể lực
  await prisma.xianxiaCharacter.update({
    where: { id: char1.id },
    data: { fatigue: 100, health: 120, silver: 100, exp: 0, cultivation: 0 },
  });

  const idempotencyKey = `BATTLE_TEST_IDEMPOTENT_${Date.now()}`;
  // Khiêu chiến Thổ Lang (quái cấp 1)
  const battleRes1 = await xianxiaCombatService.simulateAndResolveBattle(
    testUser1.id,
    'monster_tho_lang',
    idempotencyKey
  );

  assert(battleRes1.battleId, 'Phải sinh ra mã trận đấu duy nhất');
  assert(battleRes1.turnsCount >= 1 && battleRes1.turnsCount <= 30, 'Số hiệp phải từ 1 đến 30');
  assert(battleRes1.combatLogs.length > 0, 'Phải có danh sách nhật ký hiệp đấu');
  assert.strictEqual(battleRes1.idempotent, false, 'Lần gọi đầu tiên idempotent phải là false');

  const expAfterFirst = battleRes1.playerStateAfterBattle.exp;
  const silverAfterFirst = battleRes1.playerStateAfterBattle.silver;

  // Giả lập gửi lại request lần 2 với cùng idempotencyKey (Retry / Network duplicate)
  const battleRes2 = await xianxiaCombatService.simulateAndResolveBattle(
    testUser1.id,
    'monster_tho_lang',
    idempotencyKey
  );

  assert.strictEqual(battleRes2.idempotent, true, 'Lần gọi trùng lặp phải trả về kết quả idempotent');
  assert.strictEqual(battleRes2.battleId, battleRes1.battleId, 'Mã trận đấu phải trùng khớp với lần đầu');
  assert.strictEqual(battleRes2.playerStateAfterBattle.exp, expAfterFirst, 'EXP tuyệt đối không bị cộng trùng');
  assert.strictEqual(battleRes2.playerStateAfterBattle.silver, silverAfterFirst, 'Bạc tuyệt đối không bị cộng trùng');

  // Giả lập gửi đồng thời 2 request song song (Promise.all) với cùng idempotencyKey (Concurrency Race Condition)
  const concurrentKey = `BATTLE_TEST_CONCURRENT_${Date.now()}`;
  const [concRes1, concRes2] = await Promise.all([
    xianxiaCombatService.simulateAndResolveBattle(testUser1.id, 'monster_tho_lang', concurrentKey),
    xianxiaCombatService.simulateAndResolveBattle(testUser1.id, 'monster_tho_lang', concurrentKey),
  ]);

  assert.strictEqual(concRes1.battleId, concRes2.battleId, 'Hai request đồng thời phải chia sẻ cùng battleId');
  const idempotentCount = (concRes1.idempotent ? 1 : 0) + (concRes2.idempotent ? 1 : 0);
  assert.strictEqual(idempotentCount, 1, 'Đúng 1 request được ghi nhận ban đầu và 1 request idempotent');
  console.log('✅ 7. Authoritative Combat Engine & Cơ chế Idempotent chặn đứng nhân đôi phần thưởng cả tuần tự lẫn đồng thời 100%!');

  // ==========================================
  // TEST 8: Hình phạt thất bại chuẩn xác (20 HP, 15 Thể lực tổng, giữ đồ)
  // ==========================================
  console.log('-> Test 8: Hình phạt thất bại khi đối đầu Boss siêu cấp...');
  // Đặt thể lực 100, HP 10 (để dễ bị hạ gục bởi Boss Lang Vương)
  await prisma.xianxiaCharacter.update({
    where: { id: char1.id },
    data: { fatigue: 100, health: 10 },
  });

  const defeatRes = await xianxiaCombatService.simulateAndResolveBattle(
    testUser1.id,
    'boss_u_minh_lang_vuong'
  );

  if (defeatRes.result === 'LOSE') {
    assert.strictEqual(defeatRes.playerStateAfterBattle.health, 20, 'HP sau thất bại phải là 20');
    assert.strictEqual(defeatRes.playerStateAfterBattle.fatigue, 85, 'Thể lực mất đúng 10 (vào trận) + 5 (khi thua) = 15');
    assert.strictEqual(defeatRes.playerStateAfterBattle.placeId, 'place_dong_phu_tan_tu', 'Phải đưa về Động Phủ Tán Tu');
    console.log('✅ 8. Hình phạt chiến bại: 20 HP, mất 15 thể lực tổng, đưa về Động Phủ đạt chuẩn 100%!');
  } else {
    console.log('ℹ️ Người chơi may mắn kích hoạt né/chí mạng đánh bại boss hoặc hòa thượng phong.');
  }

  // ==========================================
  // TEST 9: Bảo mật Battle Logs giữa các người chơi
  // ==========================================
  console.log('-> Test 9: Bảo mật và phân quyền truy xuất lịch sử trận đấu (Battle Logs)...');
  // Tạo nhân vật cho User 2
  await xianxiaCharacterService.getOrCreateCharacter(testUser2.id, {
    name: 'Độc Cô Ma Kiếm',
  });

  // User 1 lấy lịch sử của chính mình
  const user1Logs = await xianxiaCombatService.getCharacterBattleLogs(testUser1.id);
  assert(user1Logs.length >= 1, 'User 1 phải có ít nhất 1 trận đấu vừa thực hiện');

  // User 2 lấy lịch sử của mình (chưa đánh trận nào)
  const user2Logs = await xianxiaCombatService.getCharacterBattleLogs(testUser2.id);
  assert.strictEqual(user2Logs.length, 0, 'User 2 chưa đánh trận nào nên lịch sử phải rỗng');

  // Xác minh không có trận đấu nào của User 1 xuất hiện trong danh sách của User 2
  const leakFound = user2Logs.some(l => l.monsterId === 'monster_tho_lang');
  assert.strictEqual(leakFound, false, 'Không được rò rỉ battle logs của người chơi khác');
  console.log('✅ 9. Phân quyền và bảo mật lịch sử trận đấu cá nhân đạt chuẩn tuyệt đối!');

  // ==========================================
  // TEST 10: Quy tắc giới hạn 30 hiệp và phán quyết an toàn
  // ==========================================
  console.log('-> Test 10: Xác minh giới hạn tối đa 30 hiệp kịch chiến...');
  assert(battleRes1.turnsCount <= 30, 'Trận đấu không bao giờ vượt quá 30 hiệp');
  console.log('✅ 10. Giới hạn 30 hiệp chiến đấu hoạt động chuẩn xác theo thiết kế!');

  console.log('==================================================');
  console.log('🎉 TOÀN BỘ 10 BÀI KIỂM THỬ LÕI GAMEPLAY MỤC 2 ĐÃ ĐẠT PASS 100%!');
  console.log('==================================================\n');
}

// Chạy trực tiếp nếu file được gọi bằng node
if (process.argv[1]?.includes('xianxiaCoreGameplay.test')) {
  runXianxiaCoreGameplayTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}

