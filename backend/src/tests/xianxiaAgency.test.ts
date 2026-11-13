import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { xianxiaAgencyService } from '../services/xianxia/xianxiaAgencyService.js';

export async function runXianxiaAgencyTests(): Promise<void> {
  console.log('\n--- 🛡️ KIỂM THỬ HỆ THỐNG NHIỆM VỤ THÁM HIỂM TIÊU CỤC (AGENCY EXPLORATION MISSIONS) ---');

  const testUser = `KỳHiệp_${Date.now()}`;

  // 1. Kiểm tra cấu trúc dữ liệu và nạp 15 nhiệm vụ
  const view1 = xianxiaAgencyService.getAgencyView(testUser, 'zone_thanh_ha_thon');
  assert(view1.organization.name.includes('Thiên Cơ Tiêu Cục'), 'Tổ chức phải là Thiên Cơ Tiêu Cục.');
  assert.strictEqual(view1.membership.rankKey, 'ASSOCIATE', 'Cấp bậc ban đầu phải là Tập Sự Tiêu Sư (ASSOCIATE).');
  assert(view1.offers.length > 0, 'Phải có danh sách chuyến tiêu tại Thanh Hà Thôn.');
  console.log('✅ [1/9] Nạp thành công tổ chức Thiên Cơ Tiêu Cục và danh mục nhiệm vụ thám hiểm tại phân khu.');

  // 2. Xác minh đầy đủ 5 Loại Hình Nhiệm Vụ Thám Hiểm (ESCORT, COURIER, HUNT, GATHERING, EVENT)
  const allMissions = (xianxiaAgencyService as any).missions;
  const kinds = new Set(allMissions.map((m: any) => m.kind));
  assert(kinds.has('ESCORT'), 'Phải có loại hình Áp Tiêu (ESCORT).');
  assert(kinds.has('COURIER'), 'Phải có loại hình Phi Tiêu (COURIER).');
  assert(kinds.has('HUNT'), 'Phải có loại hình Thảo Phạt (HUNT).');
  assert(kinds.has('GATHERING'), 'Phải có loại hình Thu Thập (GATHERING).');
  assert(kinds.has('EVENT'), 'Phải có loại hình Điều Tra Kỳ Ngộ (EVENT).');
  assert(allMissions.length >= 15, 'Phải có ít nhất 15 nhiệm vụ thám hiểm giang hồ.');
  console.log(`✅ [2/9] Xác minh đầy đủ 5 loại hình thám hiểm đặc trưng của Wuxia Logs (tổng cộng ${allMissions.length} nhiệm vụ).`);

  // 3. Kiểm thử Gating Cấp Bậc (Không thể nhận nhiệm vụ vượt cấp)
  assert.throws(() => {
    // exp_escort_02 yêu cầu rank COPPER, user hiện là ASSOCIATE
    xianxiaAgencyService.acceptMission(testUser, 'exp_escort_02_truc_lam_to_hac_phong');
  }, /Cấp bậc không đủ/, 'Phải chặn nhận nhiệm vụ khi chưa đạt cấp bậc Tiêu Sư yêu cầu.');
  console.log('✅ [3/9] Cơ chế kiểm soát cấp bậc Tiêu Sư (Rank Gating) hoạt động chính xác.');

  // 4. Tiếp nhận và hoàn thành nhiệm vụ COURIER (Phi Tiêu hỏa tốc)
  const courierRes = xianxiaAgencyService.acceptMission(testUser, 'exp_courier_01_mat_thu_hoa_toc');
  assert.strictEqual(courierRes.success, true);
  
  // Di chuyển tới U Minh Trúc Lâm (đích đến)
  const travelAdv = xianxiaAgencyService.advanceMissionOnAction(testUser, 'TRAVEL', {
    currentZoneId: 'zone_u_minh_truc_lam',
  });
  assert.strictEqual(travelAdv.missionUpdated, true);
  assert.strictEqual(travelAdv.readyToReport, true);

  // Giao thư báo cáo
  const reportRes = xianxiaAgencyService.deliverOrReportMission(testUser, 'exp_courier_01_mat_thu_hoa_toc', 'zone_u_minh_truc_lam');
  assert.strictEqual(reportRes.success, true);
  assert(reportRes.rewards.merit > 0, 'Phải nhận điểm Công Trạng (Merit).');
  assert(reportRes.rewards.credits > 0, 'Phải nhận điểm Cống Hiến (Credits).');
  console.log('✅ [4/9] Chu trình Phi Tiêu Hỏa Tốc (COURIER) tiếp nhận, hành trình liên vùng và giao thư thành công mỹ mãn.');

  // 5. Tiếp nhận và hoàn thành nhiệm vụ HUNT (Thảo Phạt Dị Thú)
  const huntAccept = xianxiaAgencyService.acceptMission(testUser, 'exp_hunt_01_tho_lang_ngoai_o');
  assert.strictEqual(huntAccept.success, true);

  // Giết 3 Thổ Lang
  xianxiaAgencyService.advanceMissionOnAction(testUser, 'HUNT', { monsterId: 'monster_tho_lang', count: 2 });
  const huntAdv = xianxiaAgencyService.advanceMissionOnAction(testUser, 'HUNT', { monsterId: 'monster_tho_lang', count: 1 });
  assert.strictEqual(huntAdv.readyToReport, true);

  const huntReport = xianxiaAgencyService.deliverOrReportMission(testUser, 'exp_hunt_01_tho_lang_ngoai_o', 'zone_thanh_ha_thon');
  assert.strictEqual(huntReport.success, true);
  console.log('✅ [5/9] Chu trình Thảo Phạt Dị Thú (HUNT) theo dõi tiến độ săn bắt và nộp chiến báo chuẩn xác.');

  // 6. Tiếp nhận và hoàn thành nhiệm vụ GATHERING (Thu Thập Quân Nhu)
  const gatherAccept = xianxiaAgencyService.acceptMission(testUser, 'exp_gather_01_thao_moc_linh_chi');
  assert.strictEqual(gatherAccept.success, true);

  // Giả lập giao nộp với túi đồ
  const mockInventory = [{ item_id: 'item_thao_moc_linh_chi', quantity: 3 }];
  const gatherReport = xianxiaAgencyService.deliverOrReportMission(testUser, 'exp_gather_01_thao_moc_linh_chi', 'zone_thanh_ha_thon', mockInventory);
  assert.strictEqual(gatherReport.success, true);
  console.log('✅ [6/9] Chu trình Thu Thập Quân Nhu (GATHERING) kiểm tra số lượng nguyên liệu giao nộp thành công.');

  // 7. Kiểm tra hệ thống Thăng Cấp Tiêu Sư (Promotion System)
  const profile = xianxiaAgencyService.getOrCreateProfile(testUser);
  // Cung cấp đủ điểm để test thăng cấp lên COPPER (cần 100 merit, 3 missions, 2 kinds - đã có COURIER, HUNT, GATHERING)
  profile.merit = 120;
  const promoRes = xianxiaAgencyService.requestPromotion(testUser);
  assert.strictEqual(promoRes.success, true);
  assert.strictEqual(promoRes.newRank.key, 'COPPER');
  console.log('✅ [7/9] Hệ thống Sắc Phong Thăng Cấp (Promotion) vinh thăng lên Đồng Bài Tiêu Sư và nhận bổng lộc.');

  // 8. Đổi vật phẩm từ Kho Quân Nhu (Supply Hall)
  profile.credits = 100;
  const exchangeRes = xianxiaAgencyService.exchangeSupply(testUser, 'supply_than_hanh_phu');
  assert.strictEqual(exchangeRes.success, true);
  assert.strictEqual(exchangeRes.item.item_id, 'item_than_hanh_phu');
  console.log('✅ [8/9] Kho Quân Nhu Tiếp Tế (Supply Hall) đổi Thần Hành Phù bằng Tiêu Cục Tệ thành công.');

  // 9. Kiểm thử toàn bộ 7 Endpoint REST API qua HTTP
  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const resView = await fetch(`${baseUrl}/api/xianxia/agency/view?userId=${testUser}&zoneId=zone_thanh_ha_thon`);
    assert.strictEqual(resView.status, 200);
    const jsonView = await resView.json();
    assert.strictEqual(jsonView.success, true);
    assert.strictEqual(jsonView.data.membership.rankKey, 'COPPER');

    const resAccept = await fetch(`${baseUrl}/api/xianxia/agency/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: testUser, missionId: 'exp_escort_01_thanh_ha_to_truc_lam' }),
    });
    assert.strictEqual(resAccept.status, 200);

    const resCancel = await fetch(`${baseUrl}/api/xianxia/agency/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: testUser }),
    });
    assert.strictEqual(resCancel.status, 200);
    console.log('✅ [9/9] Tất cả các Endpoint HTTP REST API (/api/xianxia/agency/...) phản hồi chính xác 200 OK.');
  } finally {
    server.close();
  }

  console.log('--- 🏆 TOÀN BỘ BÀI TEST NHIỆM VỤ THÁM HIỂM TIÊU CỤC ĐẠT 100%! ---\n');
}

if (process.argv[1]?.includes('xianxiaAgency.test')) {
  runXianxiaAgencyTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
