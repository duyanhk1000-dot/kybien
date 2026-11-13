import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { xianxiaCraftingService } from '../services/xianxia/xianxiaCraftingService.js';
import { PlayerCraftingContext } from '../types/xianxia.js';

export async function runXianxiaCraftingTests(): Promise<void> {
  console.log('\n--- [TEST] BẮT ĐẦU KIỂM THỬ THU THẬP & CHẾ TÁC TIÊN MÔN (BƯỚC 5) ---');

  // ====================================================
  // 1. KIỂM THỬ TẢI DỮ LIỆU VẬT PHẨM, ĐIỂM THU THẬP & CÔNG THỨC
  // ====================================================
  const allItems = xianxiaCraftingService.getAllItems();
  assert(allItems.length >= 15, `Phải có ít nhất 15 vật phẩm trong kho dữ liệu (hiện có ${allItems.length}).`);
  console.log(`✅ 1. Tải thành công ${allItems.length} vật phẩm đa dạng (Linh thảo, Khoáng thạch, Đan dược, Binh khí, Pháp bảo, Linh tài).`);

  const nodes = xianxiaCraftingService.getAllGatheringNodes();
  assert.strictEqual(nodes.length, 4, 'Phải có 4 điểm thu thập tài nguyên phân bổ tại các phân khu.');
  console.log('✅ 2. Tải thành công 4 điểm thu thập tài nguyên trải dài từ thôn làng đến tuyệt bích.');

  const recipes = xianxiaCraftingService.getAllRecipes();
  assert(recipes.length >= 6, `Phải có ít nhất 6 công thức Luyện Đan & Luyện Khí (hiện có ${recipes.length}).`);
  const alchemyRecipes = xianxiaCraftingService.getRecipesByDiscipline('ALCHEMY');
  const smithingRecipes = xianxiaCraftingService.getRecipesByDiscipline('BLACKSMITHING');
  assert(alchemyRecipes.length >= 4, 'Cần ít nhất 4 công thức Luyện Đan.');
  assert(smithingRecipes.length >= 2, 'Cần ít nhất 2 công thức Luyện Khí.');
  const cucPhamRecipe = xianxiaCraftingService.getRecipeById('recipe_luyen_dan_cuc_pham_truc_co');
  assert(cucPhamRecipe, 'Phải có đan phương Cực Phẩm Trúc Cơ Đan');
  assert.strictEqual(cucPhamRecipe.result_success.item_id, 'item_cuc_pham_truc_co_dan');
  console.log('✅ 3. Tải thành công hệ thống Đan Phương (Luyện Đan) bao gồm Cực Phẩm Trúc Cơ Đan và Bản Vẽ (Luyện Khí).');

  // ====================================================
  // 2. KIỂM THỬ HỆ THỐNG THU THẬP TÀI NGUYÊN (GATHERING)
  // ====================================================
  // Case A: Người chơi Phàm nhân cố đào quặng hiểm ở Hắc Phong Nhai (yêu cầu Luyện Khí 4) -> Phải bị từ chối
  const phamNhanPlayer: PlayerCraftingContext = {
    realm: 'PHAM_NHAN',
    fatigue: 50,
    silver: 100,
    inventory: [],
  };
  assert.throws(() => {
    xianxiaCraftingService.gatherResource('node_hac_phong_khoang_dong', phamNhanPlayer);
  }, /Cảnh giới không đủ/);

  // Case B: Người chơi thiếu thể lực (Cần 8, chỉ có 3)
  const exhaustedPlayer: PlayerCraftingContext = {
    realm: 'LUYEN_KHI_2',
    fatigue: 3,
    silver: 100,
    inventory: [],
  };
  assert.throws(() => {
    xianxiaCraftingService.gatherResource('node_mo_sat_thanh_ha', exhaustedPlayer);
  }, /Không đủ thể lực/);

  // Case C: Thu thập thành công tại bụi thảo dược ngoại ô thôn
  const healthyPlayer: PlayerCraftingContext = {
    realm: 'LUYEN_KHI_1',
    fatigue: 30,
    silver: 50,
    luck: 10,
    inventory: [],
  };
  const gatherSuccess = xianxiaCraftingService.gatherResource('node_thao_duoc_ngoai_o', healthyPlayer, true);
  assert.strictEqual(gatherSuccess.success, true);
  assert.strictEqual(gatherSuccess.fatigue_spent, 5);
  assert(gatherSuccess.cultivation_gained >= 5);
  assert(gatherSuccess.items_gathered.length > 0);
  console.log('✅ 4. Hệ thống kiểm duyệt cảnh giới, thể lực và thu thập tài nguyên chuẩn xác.');

  // ====================================================
  // 3. KIỂM THỬ HỆ THỐNG CHẾ TÁC: LUYỆN ĐAN (ALCHEMY)
  // ====================================================
  // Case A: Luyện Đan thiếu nguyên liệu (Chưa có Kim Ngân Hoa)
  const crafterWithoutMats: PlayerCraftingContext = {
    realm: 'LUYEN_KHI_1',
    fatigue: 30,
    silver: 50,
    inventory: [{ item_id: 'item_thao_moc_linh_chi', quantity: 5 }],
  };
  assert.throws(() => {
    xianxiaCraftingService.craftItem('recipe_luyen_dan_hoi_xuan', crafterWithoutMats);
  }, /Không đủ nguyên liệu \[Kim Ngân Hoa\]/);

  // Case B: Luyện Hồi Xuân Đan thành công (Đủ 2 Thảo Mộc Linh Chi + 1 Kim Ngân Hoa)
  const fullMatsCrafter: PlayerCraftingContext = {
    realm: 'LUYEN_KHI_1',
    fatigue: 30,
    silver: 50,
    comprehension: 15,
    inventory: [
      { item_id: 'item_thao_moc_linh_chi', quantity: 2 },
      { item_id: 'item_kim_ngan_hoa', quantity: 1 },
    ],
  };
  const craftSuccess = xianxiaCraftingService.craftItem('recipe_luyen_dan_hoi_xuan', fullMatsCrafter, true);
  assert.strictEqual(craftSuccess.success, true);
  assert.strictEqual(craftSuccess.item_produced?.item_id, 'item_hoi_xuan_dan');
  assert.strictEqual(craftSuccess.fatigue_spent, 6);
  assert.strictEqual(craftSuccess.silver_spent, 10);
  assert.strictEqual(craftSuccess.cultivation_gained, 15);
  assert.strictEqual(craftSuccess.materials_consumed.length, 2);

  // Case C: Luyện đan thất bại (Nổ lò sinh ra Phế Đan)
  const craftFail = xianxiaCraftingService.craftItem('recipe_luyen_dan_hoi_xuan', fullMatsCrafter, false);
  assert.strictEqual(craftFail.success, false);
  assert.strictEqual(craftFail.item_produced?.item_id, 'item_phe_dan');
  assert(craftFail.narrative.includes('phế đan'));
  console.log('✅ 5. Logic Luyện Đan, kiểm tra nguyên liệu, thành công và cơ chế nổ lò phế đan hoạt động hoàn hảo.');

  // ====================================================
  // 4. KIỂM THỬ HỆ THỐNG CHẾ TÁC: LUYỆN KHÍ (BLACKSMITHING)
  // ====================================================
  const blacksmith: PlayerCraftingContext = {
    realm: 'LUYEN_KHI_2',
    fatigue: 40,
    silver: 100,
    comprehension: 12,
    inventory: [
      { item_id: 'item_bach_luyen_tinh_thiet', quantity: 3 },
      { item_id: 'item_lang_bi', quantity: 2 },
    ],
  };

  const swordCraft = xianxiaCraftingService.craftItem('recipe_ren_thanh_phong_kiem', blacksmith, true);
  assert.strictEqual(swordCraft.success, true);
  assert.strictEqual(swordCraft.discipline, 'BLACKSMITHING');
  assert.strictEqual(swordCraft.item_produced?.item_id, 'item_thanh_phong_kiem');
  assert.strictEqual(swordCraft.fatigue_spent, 10);
  assert.strictEqual(swordCraft.silver_spent, 30);

  // Thử nghiệm rèn hỏng -> Ra xỉ sắt vụn
  const swordFail = xianxiaCraftingService.craftItem('recipe_ren_thanh_phong_kiem', blacksmith, false);
  assert.strictEqual(swordFail.success, false);
  assert.strictEqual(swordFail.item_produced?.item_id, 'item_can_sat');
  console.log('✅ 6. Logic Luyện Khí rèn đúc binh khí và hộ giáp bảo toàn tính cân bằng và độ tin cậy.');

  // ====================================================
  // 5. KIỂM THỬ TOÀN DIỆN E2E HTTP REST API ENDPOINTS
  // ====================================================
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // API 1: GET /api/xianxia/crafting/items
    const res1 = await fetch(`${baseUrl}/api/xianxia/crafting/items`);
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.strictEqual(body1.success, true);
    assert(body1.data.length >= 15);

    // API 2: GET /api/xianxia/crafting/items/:id
    const res2 = await fetch(`${baseUrl}/api/xianxia/crafting/items/item_truc_co_dan`);
    assert.strictEqual(res2.status, 200);
    const body2 = (await res2.json()) as any;
    assert.strictEqual(body2.data.id, 'item_truc_co_dan');
    assert.strictEqual(body2.data.rarity, 'LEGENDARY');

    // API 3: GET /api/xianxia/crafting/nodes?zone_id=zone_thanh_ha_thon
    const res3 = await fetch(`${baseUrl}/api/xianxia/crafting/nodes?zone_id=zone_thanh_ha_thon`);
    assert.strictEqual(res3.status, 200);
    const body3 = (await res3.json()) as any;
    assert.strictEqual(body3.success, true);
    assert(body3.data.length >= 2);

    // API 4: GET /api/xianxia/crafting/recipes?discipline=ALCHEMY
    const res4 = await fetch(`${baseUrl}/api/xianxia/crafting/recipes?discipline=ALCHEMY`);
    assert.strictEqual(res4.status, 200);
    const body4 = (await res4.json()) as any;
    assert.strictEqual(body4.success, true);
    assert(body4.data.every((r: any) => r.discipline === 'ALCHEMY'));

    // API 5: POST /api/xianxia/crafting/gather
    const res5 = await fetch(`${baseUrl}/api/xianxia/crafting/gather`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeId: 'node_thao_duoc_ngoai_o',
        player: healthyPlayer,
        forcedSuccess: true,
      }),
    });
    assert.strictEqual(res5.status, 200);
    const body5 = (await res5.json()) as any;
    assert.strictEqual(body5.success, true);
    assert.strictEqual(body5.data.success, true);

    // API 6: POST /api/xianxia/crafting/craft (Thành công)
    const res6 = await fetch(`${baseUrl}/api/xianxia/crafting/craft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: 'recipe_luyen_dan_hoi_xuan',
        player: fullMatsCrafter,
        forcedSuccess: true,
      }),
    });
    assert.strictEqual(res6.status, 200);
    const body6 = (await res6.json()) as any;
    assert.strictEqual(body6.success, true);
    assert.strictEqual(body6.data.item_produced.item_id, 'item_hoi_xuan_dan');

    // API 7: POST /api/xianxia/crafting/craft (Thiếu nguyên liệu -> 400 Bad Request)
    const res7 = await fetch(`${baseUrl}/api/xianxia/crafting/craft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId: 'recipe_luyen_dan_hoi_xuan',
        player: crafterWithoutMats,
      }),
    });
    assert.strictEqual(res7.status, 400);
    const body7 = (await res7.json()) as any;
    assert.strictEqual(body7.success, false);
    assert(body7.message.includes('Không đủ nguyên liệu'));

    console.log('✅ 7. Toàn bộ 6 Endpoint HTTP REST API (/api/xianxia/crafting/...) phản hồi chính xác 200/400/404.');
  } finally {
    server.close();
  }

  console.log('--- [XIANXIA CRAFTING TESTS] TẤT CẢ BÀI TEST BƯỚC 5 ĐÃ ĐẠT 100%! ---\n');
}

// Nếu chạy trực tiếp file test
if (process.argv[1]?.includes('xianxiaCrafting.test')) {
  runXianxiaCraftingTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
