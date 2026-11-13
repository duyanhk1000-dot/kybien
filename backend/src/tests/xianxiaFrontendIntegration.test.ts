import assert from 'assert';
import http from 'http';
import app from '../app.js';

export async function runXianxiaFrontendIntegrationTests(): Promise<void> {
  console.log('\n--- [TEST] BẮT ĐẦU KIỂM THỬ TÍCH HỢP GIAO DIỆN FRONTEND TIÊN LỘ (BƯỚC 6) ---');

  const server = http.createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Kiểm tra tải trang chính tien-lo.html
    const htmlRes = await fetch(`${baseUrl}/tien-lo.html`);
    assert.strictEqual(htmlRes.status, 200, 'Endpoint /tien-lo.html phải trả về 200 OK.');
    const htmlText = await htmlRes.text();
    assert(htmlText.includes('TIÊN LỘ: VẠN GIỚI TRANH PHONG'), 'Phải có tiêu đề TIÊN LỘ: VẠN GIỚI TRANH PHONG.');
    assert(htmlText.includes('tienlo-engine.js'), 'Phải nạp file script tienlo-engine.js.');
    assert(htmlText.includes('Khí Huyết (HP)'), 'Phải có thanh hiển thị Khí Huyết.');
    assert(htmlText.includes('Thể Lực'), 'Phải có thanh hiển thị Thể Lực.');
    assert(htmlText.includes('Tu Vi Đột Phá'), 'Phải có thanh hiển thị Tu Vi.');
    assert(htmlText.includes('Túi Trữ Vật'), 'Phải có khung Túi Trữ Vật.');
    assert(htmlText.includes('dot-pulse'), 'Phải có animation 3 chấm nhịp thở (dot-pulse).');
    assert(htmlText.includes('quest-tracker-hud'), 'Phải có thanh theo dõi nhiệm vụ nổi bật (quest-tracker-hud).');
    assert(htmlText.includes('data-tab="quests"'), 'Phải có tab Nhiệm Vụ Tu Chân (data-tab="quests").');
    assert(htmlText.includes('battle-history-modal'), 'Phải có modal lịch sử chiến báo (battle-history-modal).');
    assert(htmlText.includes('Chiến Báo'), 'Phải có nút mở Chiến Báo trên thanh điều hướng.');
    console.log('✅ 1. Tải thành công giao diện web /tien-lo.html với đầy đủ hiệu ứng narrative streaming, 3 chấm ngọc bích, Bảng Nhiệm Vụ và Modal Chiến Báo.');

    // 2. Kiểm tra tải client engine script tienlo-engine.js
    const scriptRes = await fetch(`${baseUrl}/tienlo-engine.js`);
    assert.strictEqual(scriptRes.status, 200, 'Endpoint /tienlo-engine.js phải trả về 200 OK.');
    const scriptText = await scriptRes.text();
    assert(scriptText.includes('class TienLoEngine'), 'Phải định nghĩa lớp TienLoEngine.');
    assert(scriptText.includes('streamNarrativeLines'), 'Phải có phương thức streamNarrativeLines hiện chữ dần.');
    assert(scriptText.includes('skipStream'), 'Phải có phương thức skipStream bỏ qua hiệu ứng.');
    assert(scriptText.includes('fetchQuests'), 'Phải có phương thức fetchQuests nạp nhiệm vụ.');
    assert(scriptText.includes('renderQuestBoard'), 'Phải có phương thức renderQuestBoard hiển thị bảng nhiệm vụ.');
    assert(scriptText.includes('acceptQuest'), 'Phải có phương thức acceptQuest nhận nhiệm vụ.');
    assert(scriptText.includes('turnInQuest'), 'Phải có phương thức turnInQuest nộp nhiệm vụ và nhận thưởng.');
    assert(scriptText.includes('openQuizModal'), 'Phải có phương thức openQuizModal mở trắc nghiệm khảo nghiệm.');
    assert(scriptText.includes('openChoiceModal'), 'Phải có phương thức openChoiceModal mở quyết định đạo tâm.');
    assert(scriptText.includes('askNpcService'), 'Phải có phương thức tương tác hội thoại NPC.');
    assert(scriptText.includes('exploreCurrentZone'), 'Phải có phương thức exploreCurrentZone.');
    assert(scriptText.includes('craftRecipe'), 'Phải có phương thức craftRecipe.');
    assert(scriptText.includes('gatherAtNode'), 'Phải có phương thức gatherAtNode.');
    assert(scriptText.includes('huntMonster'), 'Phải có phương thức huntMonster.');
    assert(scriptText.includes('openBattleHistoryModal'), 'Phải có phương thức openBattleHistoryModal.');
    assert(scriptText.includes('closeBattleHistoryModal'), 'Phải có phương thức closeBattleHistoryModal.');
    assert(scriptText.includes('startServerBattle'), 'Phải có phương thức startServerBattle.');
    assert(scriptText.includes('endServerBattle'), 'Phải có phương thức endServerBattle.');
    console.log('✅ 2. Tải thành công tệp kịch bản điều hành /tienlo-engine.js với bộ điều khiển chữ hiện dần, đối thoại và hệ thống nhiệm vụ sinh động, kết nối chiến báo máy chủ.');

    // 3. Kiểm tra liên kết từ trang chủ index.html sang tien-lo.html
    const indexRes = await fetch(`${baseUrl}/index.html`);
    assert.strictEqual(indexRes.status, 200);
    const indexText = await indexRes.text();
    assert(indexText.includes('tien-lo.html'), 'Trang chủ index.html phải chứa liên kết đến tien-lo.html.');
    console.log('✅ 3. Trang chủ Kỳ Biến đã tích hợp lối vào nhanh sang phân hệ Tiên Lộ Tu Tiên.');
  } finally {
    server.close();
  }

  console.log('--- [XIANXIA FRONTEND TESTS] TẤT CẢ BÀI TEST BƯỚC 6 ĐÃ ĐẠT 100%! ---\n');
}

// Nếu chạy trực tiếp file test
if (process.argv[1]?.includes('xianxiaFrontendIntegration.test')) {
  runXianxiaFrontendIntegrationTests()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ TEST FAILED:', err);
      process.exit(1);
    });
}
