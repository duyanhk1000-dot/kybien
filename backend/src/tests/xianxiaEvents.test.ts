import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { xianxiaEventsService } from '../services/xianxia/xianxiaEventsService.js';
import { PlayerExplorationStats } from '../types/xianxia.js';

export async function runXianxiaEventsTests(): Promise<void> {
  console.log('\n--- [TEST] BẮT ĐẦU KIỂM THỬ MA TRẬN KỲ NGỘ & THÁM HIỂM (BƯỚC 4) ---');

  // ====================================================
  // 1. KIỂM THỬ TẢI DỮ LIỆU SỰ KIỆN KỲ NGỘ
  // ====================================================
  const allEvents = xianxiaEventsService.getAllEvents();
  assert(allEvents.length >= 6, `Cần ít nhất 6 sự kiện kỳ ngộ trong ma trận (hiện có ${allEvents.length}).`);
  console.log(`✅ 1. Tải thành công ${allEvents.length} sự kiện kỳ ngộ phong phú đa dạng.`);

  // Kiểm tra tính toàn vẹn cấu trúc của từng sự kiện
  for (const ev of allEvents) {
    assert(ev.id && ev.title && ev.description, `Sự kiện ${ev.id} thiếu tiêu đề hoặc mô tả.`);
    assert(['FORTUNE', 'MISFORTUNE', 'MORAL_DILEMMA', 'MYSTERY'].includes(ev.type));
    assert(['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'].includes(ev.rarity));
    assert(ev.weight > 0, `Trọng số sự kiện ${ev.id} phải lớn hơn 0.`);
    assert(ev.choices.length >= 2, `Sự kiện ${ev.id} phải có ít nhất 2 nhánh lựa chọn.`);

    for (const ch of ev.choices) {
      assert(ch.id && ch.text && ch.outcome_success, `Lựa chọn ${ch.id} của sự kiện ${ev.id} không hợp lệ.`);
    }
  }
  console.log('✅ 2. Toàn bộ cấu trúc sự kiện, nhánh lựa chọn và kết quả đáp ứng chuẩn ma trận kỳ ngộ.');

  // ====================================================
  // 2. KIỂM THỬ LỌC SỰ KIỆN THEO PHÂN KHU (ZONE FILTERING)
  // ====================================================
  const thanhHaEvents = xianxiaEventsService.getEventsByZone('zone_thanh_ha_thon');
  assert(thanhHaEvents.some(e => e.id === 'event_dong_phu_tan_tu'), 'Thanh Hà Thôn phải có sự kiện Động Phủ Tán Tu.');
  assert(thanhHaEvents.some(e => e.zone_id === 'ALL'), 'Thanh Hà Thôn phải có sự kiện Quỷ Thị (zone_id: ALL).');

  const trucLamEvents = xianxiaEventsService.getEventsByZone('zone_u_minh_truc_lam');
  assert(trucLamEvents.some(e => e.id === 'event_tan_tu_trong_thuong'), 'Trúc Lâm phải có sự kiện Tán Tu Nguy Kịch.');
  assert(trucLamEvents.some(e => e.id === 'event_kiem_y_co_tung'), 'Trúc Lâm phải có sự kiện Kiếm Ngân Cổ Tùng.');

  const hacPhongEvents = xianxiaEventsService.getEventsByZone('zone_hac_phong_nhai');
  assert(hacPhongEvents.some(e => e.id === 'event_huyen_am_thao_vuc_tham'), 'Hắc Phong Nhai phải có Huyền Âm Thảo.');
  assert(hacPhongEvents.some(e => e.id === 'event_huyet_lang_phuc_kich'), 'Hắc Phong Nhai phải có Huyết Lang Phục Kích.');
  console.log('✅ 3. Bộ lọc phân khu phân bổ sự kiện chính xác theo bối cảnh địa lý và sự kiện toàn cục.');

  // ====================================================
  // 3. KIỂM THỬ ĐIỀU KIỆN LỰA CHỌN (REQUIREMENTS CHECK)
  // ====================================================
  const eventVucTham = xianxiaEventsService.getEventById('event_huyen_am_thao_vuc_tham')!;
  const choiceHaiThuoc = eventVucTham.choices.find(c => c.id === 'choice_than_phap_hai_thuoc')!;

  // Người chơi cảnh giới thấp (Luyện Khí 1 < Luyện Khí 3)
  const lowRealmPlayer: PlayerExplorationStats = {
    realm: 'LUYEN_KHI_1',
    health: 100,
    max_health: 100,
    fatigue: 50,
    max_fatigue: 100,
    physique: 10,
    comprehension: 10,
    luck: 15,
    karma: 0,
    silver: 50,
  };
  const checkLowRealm = xianxiaEventsService.checkChoiceAvailability(choiceHaiThuoc, lowRealmPlayer);
  assert.strictEqual(checkLowRealm.canChoose, false, 'Người chơi Luyện Khí 1 không được phép chọn hái thuốc vực thẳm.');
  assert(checkLowRealm.reason?.includes('Cảnh giới chưa đủ'));

  // Người chơi thiếu thể lực
  const tiredPlayer: PlayerExplorationStats = {
    ...lowRealmPlayer,
    realm: 'LUYEN_KHI_3',
    fatigue: 5, // Cần 12
  };
  const checkTired = xianxiaEventsService.checkChoiceAvailability(choiceHaiThuoc, tiredPlayer);
  assert.strictEqual(checkTired.canChoose, false, 'Người chơi không đủ thể lực phải bị từ chối.');
  assert(checkTired.reason?.includes('Không đủ thể lực'));

  // Người chơi đủ điều kiện
  const qualifiedPlayer: PlayerExplorationStats = {
    ...lowRealmPlayer,
    realm: 'LUYEN_KHI_3',
    fatigue: 20,
    luck: 12,
  };
  const checkQualified = xianxiaEventsService.checkChoiceAvailability(choiceHaiThuoc, qualifiedPlayer);
  assert.strictEqual(checkQualified.canChoose, true, 'Người chơi đủ điều kiện phải được chọn.');
  console.log('✅ 4. Hệ thống kiểm tra điều kiện lựa chọn (Cảnh giới, Thể lực, Ngân lượng) chặt chẽ và an toàn.');

  // ====================================================
  // 4. KIỂM THỬ GIẢI QUYẾT LỰA CHỌN & KIỂM TRA CHỈ SỐ (STAT CHECKS)
  // ====================================================
  // Case A: Động Phủ Tán Tu - Phá Trận (Kiểm tra Ngộ tính >= 12)
  const highCompPlayer: PlayerExplorationStats = {
    realm: 'LUYEN_KHI_2',
    health: 100,
    max_health: 100,
    fatigue: 40,
    max_fatigue: 100,
    physique: 10,
    comprehension: 15, // Đạt chuẩn (>= 12)
    luck: 10,
    karma: 0,
    silver: 100,
  };
  const resultPass = xianxiaEventsService.resolveChoice('event_dong_phu_tan_tu', 'choice_pha_tran', highCompPlayer);
  assert.strictEqual(resultPass.success, true);
  assert.strictEqual(resultPass.stat_check?.passed, true);
  assert.strictEqual(resultPass.effects.exp_gained, 40);
  assert.strictEqual(resultPass.effects.cultivation_gained, 60);
  assert.strictEqual(resultPass.effects.silver_change, 50);
  assert.strictEqual(resultPass.effects.items_gained[0].item_id, 'item_tan_thien_bi_kip');

  // Case B: Ngộ tính kém (Comprehension: 8 < 12) -> Thất bại, trúng phản phệ
  const lowCompPlayer: PlayerExplorationStats = {
    ...highCompPlayer,
    comprehension: 8,
  };
  const resultFail = xianxiaEventsService.resolveChoice('event_dong_phu_tan_tu', 'choice_pha_tran', lowCompPlayer);
  assert.strictEqual(resultFail.success, false);
  assert.strictEqual(resultFail.stat_check?.passed, false);
  assert.strictEqual(resultFail.effects.health_change, -25);
  assert.strictEqual(resultFail.effects.items_gained.length, 0);

  // Case C: Lựa chọn Đạo Đức (Moral Dilemma)
  // Cứu người
  const goodPlayer: PlayerExplorationStats = {
    ...highCompPlayer,
    silver: 20,
    fatigue: 10,
  };
  const resultRescue = xianxiaEventsService.resolveChoice('event_tan_tu_trong_thuong', 'choice_cuu_nguoi', goodPlayer);
  assert.strictEqual(resultRescue.success, true);
  assert.strictEqual(resultRescue.effects.karma_change, 20);
  assert.strictEqual(resultRescue.effects.silver_change, -15);
  assert.strictEqual(resultRescue.effects.items_gained[0].item_id, 'item_truc_gian_bi_truyen');

  // Giết người đoạt bảo (Cướp đoạt túi trữ vật)
  const resultLoot = xianxiaEventsService.resolveChoice('event_tan_tu_trong_thuong', 'choice_giet_nguoi_doat_bao', goodPlayer);
  assert.strictEqual(resultLoot.success, true);
  assert.strictEqual(resultLoot.effects.karma_change, -35);
  assert.strictEqual(resultLoot.effects.silver_change, 120);

  // Case D: Chống gian lận (Người chơi không đủ tiền nhưng cố tình gọi lựa chọn tốn tiền)
  const poorPlayer: PlayerExplorationStats = {
    ...highCompPlayer,
    silver: 5, // Cần 40 bạc
  };
  assert.throws(() => {
    xianxiaEventsService.resolveChoice('event_quy_thi_cho_den', 'choice_mua_khi_van_hop', poorPlayer);
  }, /Không đủ điều kiện để chọn phương án này/);

  console.log('✅ 5. Logic Stat Check, phân nhánh nhân quả Đạo Tâm và cơ chế chống gian lận hoạt động hoàn hảo.');

  // ====================================================
  // 5. KIỂM THỬ THÁM HIỂM NGẪU NHIÊN (TRIGGER EXPLORATION)
  // ====================================================
  const exploreResult = xianxiaEventsService.triggerExploration('zone_hac_phong_nhai', qualifiedPlayer);
  assert(exploreResult.event);
  assert(exploreResult.available_choices.length >= 2);
  assert(typeof exploreResult.available_choices[0].can_choose === 'boolean');
  console.log('✅ 6. Thuật toán thám hiểm ngẫu nhiên có trọng số và ánh xạ cờ khả dụng chính xác.');

  // ====================================================
  // 6. KIỂM THỬ TOÀN DIỆN E2E HTTP REST API ENDPOINTS
  // ====================================================
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // API 1: GET /api/xianxia/events
    const res1 = await fetch(`${baseUrl}/api/xianxia/events`);
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.strictEqual(body1.success, true);
    assert(body1.data.length >= 6);

    // API 2: GET /api/xianxia/events/zone/zone_u_minh_truc_lam
    const res2 = await fetch(`${baseUrl}/api/xianxia/events/zone/zone_u_minh_truc_lam`);
    assert.strictEqual(res2.status, 200);
    const body2 = (await res2.json()) as any;
    assert.strictEqual(body2.success, true);
    assert.strictEqual(body2.zone_id, 'zone_u_minh_truc_lam');
    assert(body2.data.some((e: any) => e.id === 'event_tan_tu_trong_thuong'));

    // API 3: GET /api/xianxia/events/:id
    const res3 = await fetch(`${baseUrl}/api/xianxia/events/event_dong_phu_tan_tu`);
    assert.strictEqual(res3.status, 200);
    const body3 = (await res3.json()) as any;
    assert.strictEqual(body3.data.id, 'event_dong_phu_tan_tu');

    // API 3b: GET /api/xianxia/events/non_existent
    const res3b = await fetch(`${baseUrl}/api/xianxia/events/event_fake_999`);
    assert.strictEqual(res3b.status, 404);

    // API 4: POST /api/xianxia/events/explore
    const res4 = await fetch(`${baseUrl}/api/xianxia/events/explore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneId: 'zone_thanh_ha_thon',
        playerStats: highCompPlayer,
      }),
    });
    assert.strictEqual(res4.status, 200);
    const body4 = (await res4.json()) as any;
    assert.strictEqual(body4.success, true);
    assert(body4.data.event);
    assert(body4.data.available_choices.length > 0);

    // API 5: POST /api/xianxia/events/resolve (Hợp lệ)
    const res5 = await fetch(`${baseUrl}/api/xianxia/events/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'event_dong_phu_tan_tu',
        choiceId: 'choice_pha_tran',
        playerStats: highCompPlayer,
      }),
    });
    assert.strictEqual(res5.status, 200);
    const body5 = (await res5.json()) as any;
    assert.strictEqual(body5.success, true);
    assert.strictEqual(body5.data.success, true);
    assert.strictEqual(body5.data.effects.exp_gained, 40);

    // API 6: POST /api/xianxia/events/resolve (Từ chối gian lận/thiếu bạc)
    const res6 = await fetch(`${baseUrl}/api/xianxia/events/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: 'event_quy_thi_cho_den',
        choiceId: 'choice_mua_khi_van_hop',
        playerStats: poorPlayer,
      }),
    });
    assert.strictEqual(res6.status, 400);
    const body6 = (await res6.json()) as any;
    assert.strictEqual(body6.success, false);
    assert(body6.message.includes('Không đủ'));

    console.log('✅ 7. Toàn bộ 5 Endpoint HTTP REST API (/api/xianxia/events/...) hoạt động chuẩn xác 200/400/404.');
  } finally {
    server.close();
  }

  console.log('--- [XIANXIA EVENTS TESTS] TẤT CẢ BÀI TEST BƯỚC 4 ĐÃ ĐẠT 100%! ---\n');
}

// Nếu chạy trực tiếp file test
if (process.argv[1]?.includes('xianxiaEvents.test')) {
  runXianxiaEventsTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
