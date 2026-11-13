import assert from 'assert';
import http from 'http';
import app from '../app.js';
import { xianxiaWorldService, REALM_HIERARCHY } from '../services/xianxia/xianxiaWorldService.js';
import { RealmTier } from '../types/xianxia.js';

export async function runXianxiaWorldTests(): Promise<void> {
  console.log('\n--- [TEST] BẮT ĐẦU KIỂM THỬ PHÂN HỆ THẾ GIỚI TU TIÊN (BƯỚC 1 & BƯỚC 2) ---');

  // 1. Kiểm tra tải dữ liệu phân khu (Zones)
  const zones = xianxiaWorldService.getAllZones();
  assert.strictEqual(zones.length, 5, 'Thế giới mở rộng phải có đúng 5 phân khu chính.');
  console.log('✅ 1. Tải thành công 5 phân khu cốt lõi (Thanh Hà Thôn, U Minh Trúc Lâm, Hắc Phong Nhai, Vân Mộng Đầm Lầy, Thiên Kiếm Sơn).');

  // Kiểm tra chi tiết từng phân khu
  const thanhHaThon = xianxiaWorldService.getZoneById('zone_thanh_ha_thon');
  assert(thanhHaThon, 'Phải tồn tại phân khu zone_thanh_ha_thon.');
  assert.strictEqual(thanhHaThon.type, 'TOWN');
  assert.strictEqual(thanhHaThon.min_realm, 'PHAM_NHAN');
  assert.strictEqual(thanhHaThon.fatigue_cost_roam, 3);
  assert.strictEqual(thanhHaThon.travel_fatigue_base, 5);

  const trucLam = xianxiaWorldService.getZoneById('zone_u_minh_truc_lam');
  assert(trucLam, 'Phải tồn tại phân khu zone_u_minh_truc_lam.');
  assert.strictEqual(trucLam.type, 'WILDERNESS');
  assert.strictEqual(trucLam.min_realm, 'LUYEN_KHI_1');
  assert.strictEqual(trucLam.fatigue_cost_roam, 5);
  assert.strictEqual(trucLam.travel_fatigue_base, 10);

  const hacPhongNhai = xianxiaWorldService.getZoneById('zone_hac_phong_nhai');
  assert(hacPhongNhai, 'Phải tồn tại phân khu zone_hac_phong_nhai.');
  assert.strictEqual(hacPhongNhai.type, 'DANGER_ZONE');
  assert.strictEqual(hacPhongNhai.min_realm, 'LUYEN_KHI_3');
  assert.strictEqual(hacPhongNhai.fatigue_cost_roam, 8);
  assert.strictEqual(hacPhongNhai.travel_fatigue_base, 15);

  const vanMongDam = xianxiaWorldService.getZoneById('zone_van_mong_dam');
  assert(vanMongDam, 'Phải tồn tại phân khu zone_van_mong_dam.');
  assert.strictEqual(vanMongDam.type, 'WILDERNESS');
  assert.strictEqual(vanMongDam.min_realm, 'LUYEN_KHI_5');
  assert.strictEqual(vanMongDam.fatigue_cost_roam, 10);
  assert.strictEqual(vanMongDam.travel_fatigue_base, 18);

  const thienKiemSon = xianxiaWorldService.getZoneById('zone_thien_kiem_son');
  assert(thienKiemSon, 'Phải tồn tại phân khu zone_thien_kiem_son.');
  assert.strictEqual(thienKiemSon.type, 'SECT_EXTERIOR');
  assert.strictEqual(thienKiemSon.min_realm, 'TRUC_CO_SO_KY');
  assert.strictEqual(thienKiemSon.fatigue_cost_roam, 12);
  assert.strictEqual(thienKiemSon.travel_fatigue_base, 25);
  console.log('✅ 2. Thuộc tính, loại phân khu, chi phí thể lực và cảnh giới tối thiểu hoàn toàn chính xác.');

  // 2. Kiểm tra tính liên kết lộ trình (Connected Zones)
  assert(thanhHaThon.connected_zones.includes('zone_u_minh_truc_lam'));
  assert(trucLam.connected_zones.includes('zone_thanh_ha_thon'));
  assert(trucLam.connected_zones.includes('zone_hac_phong_nhai'));
  assert(hacPhongNhai.connected_zones.includes('zone_u_minh_truc_lam'));
  assert(hacPhongNhai.connected_zones.includes('zone_van_mong_dam'));
  assert(vanMongDam.connected_zones.includes('zone_hac_phong_nhai'));
  assert(vanMongDam.connected_zones.includes('zone_thien_kiem_son'));
  assert(thienKiemSon.connected_zones.includes('zone_van_mong_dam'));
  assert(!thanhHaThon.connected_zones.includes('zone_hac_phong_nhai'), 'Thanh Hà Thôn không được nối thẳng Hắc Phong Nhai.');
  console.log('✅ 3. Mạng lưới liên kết lộ trình giữa các phân khu chuẩn xác theo cấu trúc không gian.');

  // 3. Kiểm tra Địa điểm chức năng & Dịch vụ (Places & Services)
  assert.strictEqual(thanhHaThon.places.length, 5, 'Thanh Hà Thôn phải có đủ 5 địa điểm chức năng.');
  assert.strictEqual(trucLam.places.length, 2, 'Rừng Trúc U Minh phải có đủ 2 địa điểm.');
  assert.strictEqual(hacPhongNhai.places.length, 1, 'Hắc Phong Nhai phải có 1 cổ động.');
  assert.strictEqual(vanMongDam.places.length, 2, 'Vân Mộng Đầm Lầy phải có 2 địa điểm.');
  assert.strictEqual(thienKiemSon.places.length, 2, 'Thiên Kiếm Sơn phải có 2 địa điểm.');

  // Kiểm tra Động Phủ Tạm Cư
  const dongPhu = xianxiaWorldService.getPlaceById('place_dong_phu_tam_cu');
  assert(dongPhu, 'Phải tìm thấy địa điểm Động Phủ Tạm Cư.');
  assert.strictEqual(dongPhu.kind, 'CULTIVATION_CAVE');
  const serviceKeys = dongPhu.services.map(s => s.key);
  assert(serviceKeys.includes('meditate'), 'Động phủ phải có dịch vụ tĩnh tọa tu luyện.');
  assert(serviceKeys.includes('offline_cultivate'), 'Động phủ phải có dịch vụ bế quan offline.');
  assert(serviceKeys.includes('rest'), 'Động phủ phải có dịch vụ nghỉ ngơi hồi phục.');

  // Kiểm tra Thảo Dược Đường
  const duocDuong = xianxiaWorldService.getPlaceById('place_thao_duoc_duong');
  assert(duocDuong, 'Phải tìm thấy Thảo Dược Đường.');
  assert.strictEqual(duocDuong.kind, 'APOTHECARY');
  assert(duocDuong.services.some(s => s.key === 'buy_pills'));
  assert(duocDuong.services.some(s => s.key === 'sell_herbs'));

  // Kiểm tra Lò Rèn
  const loRen = xianxiaWorldService.getPlaceById('place_thiet_te_phuong');
  assert(loRen, 'Phải tìm thấy Thiết Tế Phường.');
  assert.strictEqual(loRen.kind, 'FORGE');
  assert(loRen.services.some(s => s.key === 'forge_weapon'));
  assert(loRen.services.some(s => s.key === 'temper'));

  // Kiểm tra Bảng Nhiệm Vụ
  const bangNv = xianxiaWorldService.getPlaceById('place_nhiem_vu_duong');
  assert(bangNv, 'Phải tìm thấy Bảng Nhiệm Vụ.');
  assert.strictEqual(bangNv.kind, 'MISSION_BOARD');
  assert(bangNv.services.some(s => s.key === 'accept_quest'));

  // Kiểm tra Kho Phường
  const khoPhuong = xianxiaWorldService.getPlaceById('place_kho_phuong');
  assert(khoPhuong, 'Phải tìm thấy Kho Phường.');
  assert.strictEqual(khoPhuong.kind, 'STORAGE');
  assert(khoPhuong.services.some(s => s.key === 'stash_items'));

  // Kiểm tra Dược Vương Cốc (Vân Mộng Đầm Lầy)
  const duocVuongCoc = xianxiaWorldService.getPlaceById('place_duoc_vuong_coc');
  assert(duocVuongCoc, 'Phải tìm thấy Dược Vương Cốc.');
  assert.strictEqual(duocVuongCoc.kind, 'APOTHECARY');
  assert(duocVuongCoc.services.some(s => s.key === 'alchemy_furnace'));

  // Kiểm tra Đầm U Minh (Vân Mộng Đầm Lầy)
  const uMinhDam = xianxiaWorldService.getPlaceById('place_u_minh_dam');
  assert(uMinhDam, 'Phải tìm thấy Đầm U Minh.');
  assert.strictEqual(uMinhDam.kind, 'MYSTIC_CAVE');
  assert(uMinhDam.services.some(s => s.key === 'hunt_swamp_beast'));

  // Kiểm tra Kiếm Tông Đại Điện (Thiên Kiếm Sơn)
  const kiemTongDien = xianxiaWorldService.getPlaceById('place_kiem_tong_dien');
  assert(kiemTongDien, 'Phải tìm thấy Kiếm Tông Đại Điện.');
  assert.strictEqual(kiemTongDien.kind, 'MISSION_BOARD');
  assert(kiemTongDien.services.some(s => s.key === 'sword_sect_trials'));

  // Kiểm tra Cổ Ma Động Phủ (Thiên Kiếm Sơn)
  const coMaDong = xianxiaWorldService.getPlaceById('place_co_ma_dong');
  assert(coMaDong, 'Phải tìm thấy Cổ Ma Động Phủ.');
  assert.strictEqual(coMaDong.kind, 'MYSTIC_CAVE');
  assert(coMaDong.services.some(s => s.key === 'challenge_ancient_demon'));
  console.log('✅ 4. Toàn bộ 12 Địa điểm chức năng và các dịch vụ tương tác đã sẵn sàng.');

  // 4. Kiểm tra Logic Cảnh giới (Realm Hierarchy Comparison)
  assert(REALM_HIERARCHY['PHAM_NHAN'] < REALM_HIERARCHY['LUYEN_KHI_1']);
  assert(REALM_HIERARCHY['LUYEN_KHI_1'] < REALM_HIERARCHY['LUYEN_KHI_3']);
  assert(REALM_HIERARCHY['LUYEN_KHI_9'] < REALM_HIERARCHY['TRUC_CO_SO_KY']);
  assert(REALM_HIERARCHY['TRUC_CO_SO_KY'] < REALM_HIERARCHY['TRUC_CO_TRUNG_KY']);
  assert(REALM_HIERARCHY['TRUC_CO_TRUNG_KY'] < REALM_HIERARCHY['TRUC_CO_HAU_KY']);
  assert(REALM_HIERARCHY['TRUC_CO_HAU_KY'] < REALM_HIERARCHY['TRUC_CO_DINH_PHONG']);
  assert(REALM_HIERARCHY['TRUC_CO_DINH_PHONG'] < REALM_HIERARCHY['KIM_DAN_SO_KY']);

  assert(xianxiaWorldService.compareRealms('LUYEN_KHI_3', 'LUYEN_KHI_1') > 0);
  assert(xianxiaWorldService.compareRealms('LUYEN_KHI_1', 'LUYEN_KHI_1') === 0);
  assert(xianxiaWorldService.compareRealms('PHAM_NHAN', 'LUYEN_KHI_1') < 0);
  assert(xianxiaWorldService.compareRealms('TRUC_CO_DINH_PHONG', 'TRUC_CO_SO_KY') > 0);
  assert(xianxiaWorldService.compareRealms('TRUC_CO_HAU_KY', 'TRUC_CO_DINH_PHONG') < 0);
  console.log('✅ 5. Logic phân cấp và so sánh Cảnh giới hoạt động chính xác.');

  // 5. Kiểm tra Xác thực Di chuyển (Travel Validation & Fatigue System)
  const travel1 = xianxiaWorldService.validateTravel('zone_thanh_ha_thon', 'zone_u_minh_truc_lam', 'PHAM_NHAN');
  assert.strictEqual(travel1.valid, false, 'Phàm nhân không được phép tự ý vào Rừng Trúc.');
  assert(travel1.reason?.includes('Cảnh giới của bạn chưa đủ'));

  const travel2 = xianxiaWorldService.validateTravel('zone_thanh_ha_thon', 'zone_u_minh_truc_lam', 'LUYEN_KHI_1');
  assert.strictEqual(travel2.valid, true, 'Luyện Khí Tầng 1 phải được vào Rừng Trúc.');
  assert.strictEqual(travel2.fatigueCost, 10);
  assert.strictEqual(travel2.fromZone?.id, 'zone_thanh_ha_thon');
  assert.strictEqual(travel2.toZone?.id, 'zone_u_minh_truc_lam');

  const travel3 = xianxiaWorldService.validateTravel('zone_u_minh_truc_lam', 'zone_hac_phong_nhai', 'LUYEN_KHI_1');
  assert.strictEqual(travel3.valid, false);
  assert(travel3.reason?.includes('LUYEN_KHI_3'));

  const travel4 = xianxiaWorldService.validateTravel('zone_u_minh_truc_lam', 'zone_hac_phong_nhai', 'LUYEN_KHI_4');
  assert.strictEqual(travel4.valid, true);
  assert.strictEqual(travel4.fatigueCost, 15);

  const travel5 = xianxiaWorldService.validateTravel('zone_thanh_ha_thon', 'zone_hac_phong_nhai', 'LUYEN_KHI_9');
  assert.strictEqual(travel5.valid, false);
  assert(travel5.reason?.includes('Không có lộ trình trực tiếp'));

  const travel6 = xianxiaWorldService.validateTravel('zone_thanh_ha_thon', 'zone_khong_ton_tai', 'LUYEN_KHI_1');
  assert.strictEqual(travel6.valid, false);
  assert(travel6.reason?.includes('không tồn tại'));

  // Kiểm tra di chuyển sang Vân Mộng Đầm Lầy (yêu cầu Luyện Khí Tầng 5)
  const travel7 = xianxiaWorldService.validateTravel('zone_hac_phong_nhai', 'zone_van_mong_dam', 'LUYEN_KHI_4');
  assert.strictEqual(travel7.valid, false);
  assert(travel7.reason?.includes('LUYEN_KHI_5'));

  const travel8 = xianxiaWorldService.validateTravel('zone_hac_phong_nhai', 'zone_van_mong_dam', 'LUYEN_KHI_5');
  assert.strictEqual(travel8.valid, true);
  assert.strictEqual(travel8.fatigueCost, 18);

  // Kiểm tra di chuyển sang Thiên Kiếm Sơn (yêu cầu Trúc Cơ Sơ Kỳ)
  const travel9 = xianxiaWorldService.validateTravel('zone_van_mong_dam', 'zone_thien_kiem_son', 'LUYEN_KHI_9');
  assert.strictEqual(travel9.valid, false);
  assert(travel9.reason?.includes('TRUC_CO_SO_KY'));

  const travel10 = xianxiaWorldService.validateTravel('zone_van_mong_dam', 'zone_thien_kiem_son', 'TRUC_CO_SO_KY');
  assert.strictEqual(travel10.valid, true);
  assert.strictEqual(travel10.fatigueCost, 25);

  console.log('✅ 6. Bộ quy tắc kiểm tra di chuyển liên vùng, ranh giới an toàn và chi phí thể lực đạt chuẩn 100%.');

  // 6. Kiểm tra Mạng lưới lộ trình (Travel Network Graph)
  const network = xianxiaWorldService.getTravelNetwork();
  assert(network.length >= 8, 'Mạng lưới lộ trình mở rộng phải có ít nhất 8 đường liên kết 2 chiều.');
  console.log(`✅ 7. Mạng lưới lộ trình liên vùng sinh ra ${network.length} tuyến đường hợp lệ.`);

  // 7. KIỂM THỬ E2E QUA MÔI TRƯỜNG EXPRESS HTTP API
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // API 1: GET /api/xianxia/world/zones
    const res1 = await fetch(`${baseUrl}/api/xianxia/world/zones`);
    assert.strictEqual(res1.status, 200);
    const body1 = (await res1.json()) as any;
    assert.strictEqual(body1.success, true);
    assert.strictEqual(body1.data.length, 5);

    // API 2: GET /api/xianxia/world/zones/zone_thanh_ha_thon
    const res2 = await fetch(`${baseUrl}/api/xianxia/world/zones/zone_thanh_ha_thon`);
    assert.strictEqual(res2.status, 200);
    const body2 = (await res2.json()) as any;
    assert.strictEqual(body2.data.name, 'Thanh Hà Thôn');
    assert.strictEqual(body2.data.places.length, 5);

    // API 3: GET /api/xianxia/world/places/place_thao_duoc_duong
    const res3 = await fetch(`${baseUrl}/api/xianxia/world/places/place_thao_duoc_duong`);
    assert.strictEqual(res3.status, 200);
    const body3 = (await res3.json()) as any;
    assert.strictEqual(body3.data.kind, 'APOTHECARY');

    // API 4: GET /api/xianxia/world/routes
    const res4 = await fetch(`${baseUrl}/api/xianxia/world/routes`);
    assert.strictEqual(res4.status, 200);
    const body4 = (await res4.json()) as any;
    assert(body4.data.length >= 4);

    // API 5: POST /api/xianxia/world/travel/validate (Hợp lệ)
    const res5 = await fetch(`${baseUrl}/api/xianxia/world/travel/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromZoneId: 'zone_thanh_ha_thon',
        toZoneId: 'zone_u_minh_truc_lam',
        playerRealm: 'LUYEN_KHI_1',
      }),
    });
    assert.strictEqual(res5.status, 200);
    const body5 = (await res5.json()) as any;
    assert.strictEqual(body5.data.valid, true);
    assert.strictEqual(body5.data.fatigueCost, 10);

    // API 6: POST /api/xianxia/world/travel/validate (Chưa đủ cảnh giới)
    const res6 = await fetch(`${baseUrl}/api/xianxia/world/travel/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromZoneId: 'zone_thanh_ha_thon',
        toZoneId: 'zone_u_minh_truc_lam',
        playerRealm: 'PHAM_NHAN',
      }),
    });
    assert.strictEqual(res6.status, 200);
    const body6 = (await res6.json()) as any;
    assert.strictEqual(body6.data.valid, false);

    console.log('✅ 8. Tất cả 6 Endpoint HTTP REST API (/api/xianxia/world/...) phản hồi chính xác 200 OK và kiểm duyệt dữ liệu hợp lệ.');
  } finally {
    server.close();
  }

  console.log('--- [XIANXIA WORLD TESTS] TẤT CẢ BÀI TEST BƯỚC 1 & BƯỚC 2 ĐÃ ĐẠT 100%! ---\n');
}

// Nếu chạy trực tiếp file test
if (process.argv[1]?.includes('xianxiaWorld.test')) {
  runXianxiaWorldTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
