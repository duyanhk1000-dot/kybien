import assert from 'assert';
import { xianxiaQuestService, isRealmTierSatisfied } from '../services/xianxia/xianxiaQuestService.js';
import { xianxiaBestiaryService } from '../services/xianxia/xianxiaBestiaryService.js';
import { PlayerInventorySlot } from '../types/xianxia.js';

export async function runXianxiaQuestTests() {
  console.log('\n--- 📜 KIỂM THỬ HỆ THỐNG NHIỆM VỤ TU TIÊN (XIANXIA QUEST SYSTEM - M1.2) ---');

  // Nạp lại dữ liệu quests.json mới nhất
  xianxiaQuestService.loadData();

  const testUser = 'tester_dao_huu_001';
  xianxiaQuestService.resetPlayerProgress(testUser);

  // 1. Kiểm tra tải dữ liệu nhiệm vụ mẫu
  const allQuests = xianxiaQuestService.getAllQuests();
  assert.strictEqual(allQuests.length, 11, `Phải có đúng 11 nhiệm vụ (8 chính tuyến + 3 thỉnh cầu) (có ${allQuests.length})`);
  console.log(`✅ [1/11] Tải thành công chính xác ${allQuests.length} nhiệm vụ từ quests.json.`);

  // 2. Kiểm tra phân loại đầy đủ 8 Chính Tuyến và 3 Thỉnh Cầu Tinh Tuyển
  const mainQuests = allQuests.filter(q => q.category === 'CHINH_TUYEN');
  const sideQuests = allQuests.filter(q => q.category === 'THINH_CAU' || q.type === 'SIDE_QUEST');
  assert.strictEqual(mainQuests.length, 8, 'Phải có đúng 8 nhiệm vụ chính tuyến');
  assert.strictEqual(sideQuests.length, 3, 'Phải có đúng 3 nhiệm vụ thỉnh cầu');
  console.log('✅ [2/11] Phân bổ chính xác 8 nhiệm vụ Chính Tuyến và 3 nhiệm vụ Thỉnh Cầu tinh tuyển.');

  // 3. Kiểm tra tính năng lọc danh mục getQuestsByCategory
  const catAll = xianxiaQuestService.getQuestsByCategory(testUser, 'ALL', { realm: 'PHAM_NHAN', level: 1 });
  const catMain = xianxiaQuestService.getQuestsByCategory(testUser, 'MAIN_STORY', { realm: 'PHAM_NHAN', level: 1 });
  const catSide = xianxiaQuestService.getQuestsByCategory(testUser, 'SIDE_QUEST', { realm: 'PHAM_NHAN', level: 1 });

  assert.strictEqual(catAll.length, 11, 'Lọc ALL phải trả về 11 nhiệm vụ');
  assert.strictEqual(catMain.length, 8, 'Lọc MAIN_STORY phải trả về 8 nhiệm vụ');
  assert.strictEqual(catSide.length, 3, 'Lọc SIDE_QUEST phải trả về 3 nhiệm vụ');
  console.log('✅ [3/11] Phương thức getQuestsByCategory hoạt động hoàn hảo cho ALL, MAIN_STORY, SIDE_QUEST.');

  // 4. Kiểm tra sức mạnh quái vật Chính Tuyến
  const thoLang = xianxiaBestiaryService.getMonsterById('monster_tho_lang');
  const uMinhLang = xianxiaBestiaryService.getMonsterById('monster_u_minh_lang');
  const bossLangVuong = xianxiaBestiaryService.getMonsterById('boss_u_minh_lang_vuong');

  assert.ok(thoLang && uMinhLang && bossLangVuong, 'Các quái vật chính tuyến phải tồn tại trong bestiary');
  assert.ok(uMinhLang.attack >= 35 && uMinhLang.defense >= 15, 'U Minh Lang phải có ATK >= 35, DEF >= 15');
  assert.ok(bossLangVuong.attack >= 60 && bossLangVuong.max_health >= 600, 'Lang Vương phải là Boss cực mạnh');
  console.log('✅ [4/11] Xác minh độ khó quái Chính Tuyến: U Minh Lang và Boss Lang Vương có chỉ số áp đảo.');

  // 5. Kiểm tra điều kiện mở khóa & Chặn cấp độ (Gating)
  const initialQuests = xianxiaQuestService.getQuestsForPlayer(testUser, {
    realm: 'PHAM_NHAN',
    level: 1,
  });
  const main1 = initialQuests.find(q => q.id === 'main_01_khoi_dau_tien_duyen');
  const main2 = initialQuests.find(q => q.id === 'main_02_bong_ma_u_minh');
  const main3 = initialQuests.find(q => q.id === 'main_03_tram_diet_lang_vuong');
  const main4 = initialQuests.find(q => q.id === 'main_04_tham_nhap_van_mong');
  const main5 = initialQuests.find(q => q.id === 'main_05_truc_co_xung_quan');
  const main6 = initialQuests.find(q => q.id === 'main_06_tien_mon_khao_hach');
  const main7 = initialQuests.find(q => q.id === 'main_07_tran_ap_co_ma');
  const main8 = initialQuests.find(q => q.id === 'main_08_truc_co_dinh_phong');

  assert.strictEqual(main1?.status, 'AVAILABLE', 'Chính tuyến 1 phải AVAILABLE lúc đầu');
  assert.strictEqual(main2?.status, 'LOCKED', 'Chính tuyến 2 phải LOCKED khi chưa làm Chính tuyến 1');
  assert.strictEqual(main3?.status, 'LOCKED', 'Chính tuyến 3 phải LOCKED');
  assert.strictEqual(main4?.status, 'LOCKED', 'Chính tuyến 4 phải LOCKED');
  assert.strictEqual(main5?.status, 'LOCKED', 'Chính tuyến 5 phải LOCKED');
  assert.strictEqual(main6?.status, 'LOCKED', 'Chính tuyến 6 phải LOCKED');
  assert.strictEqual(main7?.status, 'LOCKED', 'Chính tuyến 7 phải LOCKED');
  assert.strictEqual(main8?.status, 'LOCKED', 'Chính tuyến 8 phải LOCKED');

  const rejectMain2 = xianxiaQuestService.acceptQuest(testUser, 'main_02_bong_ma_u_minh', {
    realm: 'PHAM_NHAN',
    level: 1,
  });
  assert.strictEqual(rejectMain2.success, false, 'Không thể nhận Main 2 khi chưa đạt Luyện Khí 1 và chưa xong Main 1');
  console.log('✅ [5/11] Hệ thống khóa cấp độ và nhiệm vụ tiền đề hoạt động chính xác.');

  // 6. Luồng hoàn thành Chính Tuyến 1 -> Mở khóa Chính Tuyến 2
  const acceptMain1 = xianxiaQuestService.acceptQuest(testUser, 'main_01_khoi_dau_tien_duyen', {
    realm: 'PHAM_NHAN',
    level: 1,
  });
  assert.strictEqual(acceptMain1.success, true);
  assert.ok(acceptMain1.narrative_lines && acceptMain1.narrative_lines.length > 0, 'Phải có lời thoại typewriter');

  // Tiêu diệt 1 Thổ Lang
  xianxiaQuestService.recordMonsterKill(testUser, 'monster_tho_lang', 1);
  const progMain1 = xianxiaQuestService.getPlayerQuestProgress(testUser, 'main_01_khoi_dau_tien_duyen');
  assert.strictEqual(progMain1?.status, 'READY_TO_TURN_IN', 'Đã hạ 1 Thổ Lang, sẵn sàng trả nhiệm vụ');

  const turninMain1 = xianxiaQuestService.turnInQuest(testUser, 'main_01_khoi_dau_tien_duyen', []);
  assert.strictEqual(turninMain1.success, true);
  assert.strictEqual(turninMain1.rewards_claimed?.exp, 100);
  assert.strictEqual(turninMain1.rewards_claimed?.title, 'Sơ Nhập Tiên Đồ');

  // Nâng cảnh giới Luyện Khí 1 -> Main 2 mở khóa
  const questsAfterMain1 = xianxiaQuestService.getQuestsForPlayer(testUser, {
    realm: 'LUYEN_KHI_1',
    level: 2,
  });
  const main2Available = questsAfterMain1.find(q => q.id === 'main_02_bong_ma_u_minh');
  assert.strictEqual(main2Available?.status, 'AVAILABLE', 'Main 2 đã mở khóa sau khi xong Main 1 và lên Luyện Khí 1');
  console.log('✅ [6/8] Hoàn thành Chính Tuyến 1, nhận danh hiệu và mở khóa Chính Tuyến 2 thành công.');

  // 7. Kiểm thử các nhiệm vụ phụ tinh tuyển:
  // 7a. Đàm đạo quy luật (side_02_dam_dao_quy_luat) - TALK_NPC
  xianxiaQuestService.acceptQuest(testUser, 'side_02_dam_dao_quy_luat', { realm: 'PHAM_NHAN', level: 1 });
  const talkRes = xianxiaQuestService.interactObjective(testUser, 'side_02_dam_dao_quy_luat', 'TALK_NPC', 'npc_tieu_dao_tu');
  assert.strictEqual(talkRes.success, true);
  assert.strictEqual(talkRes.progress?.status, 'READY_TO_TURN_IN');
  const turninTalk = xianxiaQuestService.turnInQuest(testUser, 'side_02_dam_dao_quy_luat', []);
  assert.strictEqual(turninTalk.rewards_claimed?.cultivation, 80, 'Nhận 80 Tu Vi từ đàm đạo');

  // 7b. Trảm sài lang cửa thôn (side_01_tram_yeu_thanh_ha) - KILL_MONSTER (3 Thổ Lang)
  xianxiaQuestService.acceptQuest(testUser, 'side_01_tram_yeu_thanh_ha', { realm: 'PHAM_NHAN', level: 1 });
  xianxiaQuestService.recordMonsterKill(testUser, 'monster_tho_lang', 3);
  const turninKill = xianxiaQuestService.turnInQuest(testUser, 'side_01_tram_yeu_thanh_ha', []);
  assert.strictEqual(turninKill.success, true);
  assert.strictEqual(turninKill.rewards_claimed?.exp, 100);

  // 7c. Trắc nghiệm khảo nghiệm (side_03_khao_nghiem_duoc_ly) - ANSWER_QUIZ
  xianxiaQuestService.acceptQuest(testUser, 'side_03_khao_nghiem_duoc_ly', { realm: 'PHAM_NHAN', level: 1 });
  const wrongQuiz = xianxiaQuestService.submitQuiz(testUser, 'side_03_khao_nghiem_duoc_ly', 'obj_side_03_quiz', 0);
  assert.strictEqual(wrongQuiz.success, false, 'Đáp án sai phải bị từ chối');
  const rightQuiz = xianxiaQuestService.submitQuiz(testUser, 'side_03_khao_nghiem_duoc_ly', 'obj_side_03_quiz', 1);
  assert.strictEqual(rightQuiz.success, true, 'Đáp án đúng phải được chấp nhận');
  assert.strictEqual(xianxiaQuestService.turnInQuest(testUser, 'side_03_khao_nghiem_duoc_ly', []).success, true);
  console.log('✅ [7/9] Các nhiệm vụ phụ tinh tuyển (Trảm Yêu, Đàm Đạo, Khảo Nghiệm Dược Lý) hoạt động chính xác.');

  // 8. Hoàn thành Main 2 và Main 3
  xianxiaQuestService.acceptQuest(testUser, 'main_02_bong_ma_u_minh', { realm: 'LUYEN_KHI_1', level: 2 });
  xianxiaQuestService.recordMonsterKill(testUser, 'monster_u_minh_lang', 1);
  const turninMain2 = xianxiaQuestService.turnInQuest(testUser, 'main_02_bong_ma_u_minh', []);
  assert.strictEqual(turninMain2.success, true);

  xianxiaQuestService.acceptQuest(testUser, 'main_03_tram_diet_lang_vuong', { realm: 'LUYEN_KHI_2', level: 4 });
  xianxiaQuestService.recordMonsterKill(testUser, 'boss_u_minh_lang_vuong', 1);
  const turninMain3 = xianxiaQuestService.turnInQuest(testUser, 'main_03_tram_diet_lang_vuong', []);
  assert.strictEqual(turninMain3.success, true);
  assert.strictEqual(turninMain3.rewards_claimed?.items?.[0].item_id, 'item_truc_co_dan');
  assert.strictEqual(turninMain3.rewards_claimed?.title, 'Trảm Yêu Đại Tông Sư');
  console.log('✅ [8/9] Chuỗi Chính Tuyến Luyện Khí sơ giai hạ gục Boss Lang Vương hoàn tất mỹ mãn.');

  // 9. Tiến trình Bước M2.2: Hoàn thành Chính Tuyến 4 (Vân Mộng) và Chính Tuyến 5 (Trúc Cơ Xung Quan)
  // 9a. Chính Tuyến 4: Mở khóa khi đạt Luyện Khí Tầng 4, cấp 6 và xong Main 3
  const questsAfterMain3 = xianxiaQuestService.getQuestsForPlayer(testUser, { realm: 'LUYEN_KHI_4', level: 6 });
  const main4Avail = questsAfterMain3.find(q => q.id === 'main_04_tham_nhap_van_mong');
  assert.strictEqual(main4Avail?.status, 'AVAILABLE', 'Chính Tuyến 4 phải AVAILABLE khi xong Main 3 và đạt Luyện Khí 4');

  const acceptMain4 = xianxiaQuestService.acceptQuest(testUser, 'main_04_tham_nhap_van_mong', { realm: 'LUYEN_KHI_4', level: 6 });
  assert.strictEqual(acceptMain4.success, true);

  // Thực hiện mục tiêu 1: Đàm đạo với Trần Dược Sư tại Dược Vương Cốc
  const talkAlchemistRes = xianxiaQuestService.interactObjective(testUser, 'main_04_tham_nhap_van_mong', 'TALK_NPC', 'npc_tran_duoc_su');
  assert.strictEqual(talkAlchemistRes.success, true);

  // Thực hiện mục tiêu 2: Trảm Hắc Phong Điêu
  xianxiaQuestService.recordMonsterKill(testUser, 'monster_hac_phong_dieu', 1);
  const progMain4 = xianxiaQuestService.getPlayerQuestProgress(testUser, 'main_04_tham_nhap_van_mong');
  assert.strictEqual(progMain4?.status, 'READY_TO_TURN_IN', 'Main 4 đã xong cả 2 mục tiêu, sẵn sàng bàn giao');

  const turninMain4 = xianxiaQuestService.turnInQuest(testUser, 'main_04_tham_nhap_van_mong', []);
  assert.strictEqual(turninMain4.success, true);
  assert.strictEqual(turninMain4.rewards_claimed?.exp, 1200);
  assert.strictEqual(turninMain4.rewards_claimed?.title, 'Vân Mộng Hành Giả');
  assert.strictEqual(turninMain4.rewards_claimed?.items?.[0].item_id, 'item_huyen_am_thao');

  // 9b. Chính Tuyến 5: Mở khóa khi đạt Luyện Khí Tầng 7, cấp 9 và xong Main 4
  const questsAfterMain4 = xianxiaQuestService.getQuestsForPlayer(testUser, { realm: 'LUYEN_KHI_7', level: 9 });
  const main5Avail = questsAfterMain4.find(q => q.id === 'main_05_truc_co_xung_quan');
  assert.strictEqual(main5Avail?.status, 'AVAILABLE', 'Chính Tuyến 5 phải AVAILABLE khi xong Main 4 và đạt Luyện Khí 7');

  const acceptMain5 = xianxiaQuestService.acceptQuest(testUser, 'main_05_truc_co_xung_quan', { realm: 'LUYEN_KHI_7', level: 9 });
  assert.strictEqual(acceptMain5.success, true);

  // Mục tiêu 1: Đàm đạo với Tiêu Dao Lão Nhân
  const talkHermitRes = xianxiaQuestService.interactObjective(testUser, 'main_05_truc_co_xung_quan', 'TALK_NPC', 'npc_tieu_dao_tu');
  assert.strictEqual(talkHermitRes.success, true);

  // Mục tiêu 2: Trảm Boss U Minh Lang Vương trong cổ động
  xianxiaQuestService.recordMonsterKill(testUser, 'boss_u_minh_lang_vuong', 1);
  const progMain5 = xianxiaQuestService.getPlayerQuestProgress(testUser, 'main_05_truc_co_xung_quan');
  assert.strictEqual(progMain5?.status, 'READY_TO_TURN_IN', 'Main 5 đã xong cả 2 mục tiêu xung quan, sẵn sàng bàn giao');

  const turninMain5 = xianxiaQuestService.turnInQuest(testUser, 'main_05_truc_co_xung_quan', []);
  assert.strictEqual(turninMain5.success, true);
  assert.strictEqual(turninMain5.rewards_claimed?.exp, 2500);
  assert.strictEqual(turninMain5.rewards_claimed?.cultivation, 1500);
  assert.strictEqual(turninMain5.rewards_claimed?.title, 'Trúc Cơ Chân Nhân');
  assert.ok(turninMain5.rewards_claimed?.items?.some(it => it.item_id === 'item_truc_co_dan'));
  assert.ok(turninMain5.rewards_claimed?.items?.some(it => it.item_id === 'item_thanh_tam_boi'));
  console.log('✅ [9/10] Chuỗi Chính Tuyến M2.2 (Chương 4 & Chương 5) hoàn thành mỹ mãn: Đột phá Trúc Cơ thành công!');

  // 10. Tiến trình Bước M2.3: Hoàn thành Chính Tuyến 6 (Thiên Kiếm Khảo Hạch) và Chính Tuyến 7 (Trấn Áp Cổ Ma)
  // 10a. Chính Tuyến 6: Mở khóa khi đạt Trúc Cơ Sơ Kỳ, cấp 12 và xong Main 5
  const questsAfterMain5 = xianxiaQuestService.getQuestsForPlayer(testUser, { realm: 'TRUC_CO_SO_KY', level: 12 });
  const main6Avail = questsAfterMain5.find(q => q.id === 'main_06_tien_mon_khao_hach');
  assert.strictEqual(main6Avail?.status, 'AVAILABLE', 'Chính Tuyến 6 phải AVAILABLE khi xong Main 5 và đạt Trúc Cơ Sơ Kỳ');

  const acceptMain6 = xianxiaQuestService.acceptQuest(testUser, 'main_06_tien_mon_khao_hach', { realm: 'TRUC_CO_SO_KY', level: 12 });
  assert.strictEqual(acceptMain6.success, true);

  // Mục tiêu 1: Đàm đạo với Mạc Vô Nhai tại Thiên Kiếm Sơn
  const talkSwordElderRes = xianxiaQuestService.interactObjective(testUser, 'main_06_tien_mon_khao_hach', 'TALK_NPC', 'npc_hac_y_lu_nhan');
  assert.strictEqual(talkSwordElderRes.success, true);

  // Mục tiêu 2: Trảm 2 Hắc Phong Điêu chứng minh kiếm ý
  xianxiaQuestService.recordMonsterKill(testUser, 'monster_hac_phong_dieu', 2);
  const progMain6 = xianxiaQuestService.getPlayerQuestProgress(testUser, 'main_06_tien_mon_khao_hach');
  assert.strictEqual(progMain6?.status, 'READY_TO_TURN_IN', 'Main 6 đã xong cả 2 mục tiêu khảo hạch kiếm tông, sẵn sàng bàn giao');

  const turninMain6 = xianxiaQuestService.turnInQuest(testUser, 'main_06_tien_mon_khao_hach', []);
  assert.strictEqual(turninMain6.success, true);
  assert.strictEqual(turninMain6.rewards_claimed?.exp, 4500);
  assert.strictEqual(turninMain6.rewards_claimed?.title, 'Thiên Kiếm Đệ Tử');
  assert.ok(turninMain6.rewards_claimed?.items?.some(it => it.item_id === 'item_bach_luyen_tinh_thiet'));

  // 10b. Chính Tuyến 7: Mở khóa khi đạt Trúc Cơ Trung Kỳ, cấp 16 và xong Main 6
  const questsAfterMain6 = xianxiaQuestService.getQuestsForPlayer(testUser, { realm: 'TRUC_CO_TRUNG_KY', level: 16 });
  const main7Avail = questsAfterMain6.find(q => q.id === 'main_07_tran_ap_co_ma');
  assert.strictEqual(main7Avail?.status, 'AVAILABLE', 'Chính Tuyến 7 phải AVAILABLE khi xong Main 6 và đạt Trúc Cơ Trung Kỳ');

  const acceptMain7 = xianxiaQuestService.acceptQuest(testUser, 'main_07_tran_ap_co_ma', { realm: 'TRUC_CO_TRUNG_KY', level: 16 });
  assert.strictEqual(acceptMain7.success, true);

  // Mục tiêu 1: Thỉnh giáo Tiêu Dao Lão Nhân bí quyết càn khôn phong ma
  const consultSealRes = xianxiaQuestService.interactObjective(testUser, 'main_07_tran_ap_co_ma', 'TALK_NPC', 'npc_tieu_dao_tu');
  assert.strictEqual(consultSealRes.success, true);

  // Mục tiêu 2: Trảm Boss U Minh Lang Vương trong cổ ma động
  xianxiaQuestService.recordMonsterKill(testUser, 'boss_u_minh_lang_vuong', 1);
  const progMain7 = xianxiaQuestService.getPlayerQuestProgress(testUser, 'main_07_tran_ap_co_ma');
  assert.strictEqual(progMain7?.status, 'READY_TO_TURN_IN', 'Main 7 đã xong cả 2 mục tiêu trấn ma, sẵn sàng bàn giao');

  const turninMain7 = xianxiaQuestService.turnInQuest(testUser, 'main_07_tran_ap_co_ma', []);
  assert.strictEqual(turninMain7.success, true);
  assert.strictEqual(turninMain7.rewards_claimed?.exp, 8000);
  assert.strictEqual(turninMain7.rewards_claimed?.cultivation, 6000);
  assert.strictEqual(turninMain7.rewards_claimed?.title, 'Trấn Ma Kiếm Quân');
  assert.ok(turninMain7.rewards_claimed?.items?.some(it => it.item_id === 'item_truc_co_dan'));
  console.log('✅ [10/11] Chuỗi Chính Tuyến M2.3 (Chương 6 & Chương 7) hoàn thành mỹ mãn: Trấn áp Cổ Ma, bước vào Trúc Cơ Hậu Kỳ!');

  // 11. Tiến trình Bước M2.4: Hoàn thành Chính Tuyến 8 (Càn Khôn Đạo Vận - Trúc Cơ Đỉnh Phong)
  // Mở khóa khi đạt Trúc Cơ Hậu Kỳ, cấp 20 và xong Main 7
  const questsAfterMain7 = xianxiaQuestService.getQuestsForPlayer(testUser, { realm: 'TRUC_CO_HAU_KY', level: 20 });
  const main8Avail = questsAfterMain7.find(q => q.id === 'main_08_truc_co_dinh_phong');
  assert.strictEqual(main8Avail?.status, 'AVAILABLE', 'Chính Tuyến 8 phải AVAILABLE khi xong Main 7 và đạt Trúc Cơ Hậu Kỳ');

  const acceptMain8 = xianxiaQuestService.acceptQuest(testUser, 'main_08_truc_co_dinh_phong', { realm: 'TRUC_CO_HAU_KY', level: 20 });
  assert.strictEqual(acceptMain8.success, true);

  // Mục tiêu 1: Tiếp nhận Càn Khôn Khẩu Quyết từ Tiêu Dao Lão Nhân
  const talkEnlightenRes = xianxiaQuestService.interactObjective(testUser, 'main_08_truc_co_dinh_phong', 'TALK_NPC', 'npc_tieu_dao_tu');
  assert.strictEqual(talkEnlightenRes.success, true);

  // Mục tiêu 2: Trảm Boss U Minh Lang Vương trong lôi kiếp
  xianxiaQuestService.recordMonsterKill(testUser, 'boss_u_minh_lang_vuong', 1);
  const progMain8 = xianxiaQuestService.getPlayerQuestProgress(testUser, 'main_08_truc_co_dinh_phong');
  assert.strictEqual(progMain8?.status, 'READY_TO_TURN_IN', 'Main 8 đã xong cả 2 mục tiêu lôi kiếp, sẵn sàng bàn giao');

  const turninMain8 = xianxiaQuestService.turnInQuest(testUser, 'main_08_truc_co_dinh_phong', []);
  assert.strictEqual(turninMain8.success, true);
  assert.strictEqual(turninMain8.rewards_claimed?.exp, 15000);
  assert.strictEqual(turninMain8.rewards_claimed?.cultivation, 12000);
  assert.strictEqual(turninMain8.rewards_claimed?.silver, 3000);
  assert.strictEqual(turninMain8.rewards_claimed?.title, 'Đạo Cơ Vô Khuyết');
  assert.ok(turninMain8.rewards_claimed?.items?.some(it => it.item_id === 'item_truc_co_dan' && it.quantity === 3));
  assert.ok(turninMain8.rewards_claimed?.items?.some(it => it.item_id === 'item_thanh_tam_boi'));
  console.log('✅ [11/11] Chuỗi Chính Tuyến M2.4 (Chương 8) hoàn thành mỹ mãn: ĐẠT TỚI TRÚC CƠ ĐỈNH PHONG (ĐẠO CƠ VÔ KHUYẾT)!');

  console.log('🎉 TOÀN BỘ 11 MỤC KIỂM THỬ HỆ THỐNG NHIỆM VỤ ĐÃ ĐẠT 100%!\n');
}

// Nếu chạy trực tiếp file test
if (process.argv[1]?.includes('xianxiaQuest.test')) {
  runXianxiaQuestTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
