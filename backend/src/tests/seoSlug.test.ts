import assert from 'assert';
import {
  removeVietnameseTones,
  cleanPlayerNameForSlug,
  cleanVariantForSlug,
  buildSeoSlugTitle,
  generateSeoSlugFromText,
  getStandardPostLabels,
} from '../utils/seoSlug.js';
import { publishMatchToBlogger } from '../services/bloggerService.js';
import { config } from '../config/index.js';

export async function runSeoSlugTests(): Promise<void> {
  console.log('🧪 RUNNING BLOGGER SEO SLUG & TWO-STEP TITLE SWITCH TESTS...\n');

  // Test 1: Khử dấu tiếng Việt và đặc biệt xử lý triệt để chữ đ/Đ
  console.log('-> Test 1: Khử dấu tiếng Việt (Xử lý chữ đ/Đ)...');
  const textWithD = 'Đại Chiến Sa Trường Máy Địa Ngục';
  const cleanD = removeVietnameseTones(textWithD);
  assert.strictEqual(cleanD, 'Dai Chien Sa Truong May Dia Nguc');
  assert.strictEqual(removeVietnameseTones('đệ nhất kỳ đạo'), 'de nhat ky dao');
  assert.strictEqual(removeVietnameseTones('ĐIỆN TOÁN ĐÁM MÂY'), 'DIEN TOAN DAM MAY');
  console.log('✅ Test 1 Passed: Khử dấu và chữ đ/Đ hoạt động chuẩn xác 100%!');

  // Test 2: Làm sạch tên người chơi (cleanPlayerNameForSlug)
  console.log('-> Test 2: Chuẩn hóa tên kỳ thủ cho Slug...');
  assert.strictEqual(cleanPlayerNameForSlug('[Chiến Tướng.duyanhk1000]'), 'duyanhk1000');
  assert.strictEqual(cleanPlayerNameForSlug('[Kỳ Thủ Duy]'), 'ky thu duy');
  assert.strictEqual(cleanPlayerNameForSlug('Máy Địa Ngục'), 'may dia nguc');
  assert.strictEqual(cleanPlayerNameForSlug('[Chiến Tướng.Địa Ngục Vương]'), 'dia nguc vuong');
  assert.strictEqual(cleanPlayerNameForSlug('Chiến Tướng.Máy'), 'may');
  assert.strictEqual(cleanPlayerNameForSlug(''), 'ky thu');
  console.log('✅ Test 2 Passed: Tên người chơi và máy AI được bóc tách sạch sẽ!');

  // Test 3: Chuẩn hóa thể loại cờ (cleanVariantForSlug)
  console.log('-> Test 3: Chuẩn hóa thể loại cờ...');
  assert.strictEqual(cleanVariantForSlug('kb', 'Cờ Bí Pháp'), 'co bi phap');
  assert.strictEqual(cleanVariantForSlug('t', 'Cờ Úp'), 'co up');
  assert.strictEqual(cleanVariantForSlug('g', 'Cờ Úp Gián Điệp'), 'co up gian diep');
  assert.strictEqual(cleanVariantForSlug('n', 'Cờ Truyền Thống'), 'co tuong');
  console.log('✅ Test 3 Passed: Thể loại cờ được gán từ khóa ngắn gọn!');

  // Test 4: Khắc phục trường hợp thực tế người dùng báo lỗi
  // "https://kybien.blogspot.com/2026/10/co-bi-phap-ky-thuduy-vs-mayia-nguc.html"
  console.log('-> Test 4: Kiểm tra trực tiếp ván cờ Kỳ Thủ Duy vs Máy Địa Ngục...');
  const realSlug = buildSeoSlugTitle({
    variantCode: 'kb',
    variantName: 'Cờ Bí Pháp',
    playerWhite: 'Kỳ Thủ Duy',
    playerBlack: 'Máy Địa Ngục',
    matchPhrase: 'Đại Chiến Càn Khôn Đổi Chủ',
    maxChars: 48,
  });

  // Xác minh không còn dính chữ 'thuduy' và không còn mất chữ 'đ' ('mayia-nguc')
  assert.ok(realSlug.includes('ky thu duy'), 'Slug phải chứa "ky thu duy" tách rời rõ ràng');
  assert.ok(realSlug.includes('may dia nguc'), 'Slug phải chứa "may dia nguc" với đầy đủ chữ "d"');
  assert.strictEqual(realSlug.includes('ia-nguc'), false, 'Slug tuyệt đối không được mất chữ d');
  assert.strictEqual(realSlug.includes('thuduy'), false, 'Slug tuyệt đối không được dính chữ');
  assert.ok(realSlug.length <= 48, `Độ dài slug (${realSlug.length}) phải <= 48 ký tự`);
  console.log(`✅ Test 4 Passed: Slug tạo ra là "${realSlug}" (độ dài: ${realSlug.length} ký tự)!`);

  // Test 5: Cắt chữ an toàn (Safe word truncation)
  console.log('-> Test 5: Cắt chữ an toàn theo ranh giới từ khi tiêu đề quá dài...');
  const longSlug = buildSeoSlugTitle({
    variantCode: 'kb',
    variantName: 'Cờ Bí Pháp',
    playerWhite: 'Chien Tuong Nguyen Van A Vo Dich Thien Ha',
    playerBlack: 'Dai Cao Thu Tran Van B Tuyet Dinh Kungfu',
    matchPhrase: 'Bao Lua Thieu Rui Trung Quan Sa Truong Kiem Hiep',
    maxChars: 45,
  });
  assert.ok(longSlug.length <= 45, `Độ dài longSlug (${longSlug.length}) phải <= 45 ký tự`);
  // Không được kết thúc lửng lơ ở giữa từ (chữ cái cuối cùng của từ phải hoàn chỉnh)
  assert.strictEqual(longSlug.endsWith(' '), false);
  console.log(`✅ Test 5 Passed: Slug dài được cắt an toàn thành "${longSlug}"!`);

  // Test 6: Hàm dự phòng generateSeoSlugFromText
  console.log('-> Test 6: Kiểm tra hàm dự phòng generateSeoSlugFromText...');
  const fromText = generateSeoSlugFromText('[Cờ Bí Pháp] [Kỳ Thủ Duy] vs [Máy Địa Ngục] (125 nước) - Đại Chiến Sa Trường');
  assert.ok(fromText.includes('ky thu duy'));
  assert.ok(fromText.includes('may dia nguc'));
  assert.strictEqual(fromText.includes('125'), false, 'Loại bỏ số nước đi khỏi slug');
  assert.ok(fromText.length <= 48);
  console.log(`✅ Test 6 Passed: generateSeoSlugFromText tạo ra "${fromText}"!`);

  // Test 7: Kiểm tra luồng gọi API Blogger "Tạo bài 2 thì" (Mock Fetch Flow)
  console.log('-> Test 7: Giả lập quy trình Two-step Title Switch (POST slugTitle -> PATCH postTitle)...');
  
  // Lưu trữ credentials và fetch gốc
  const originalConfig = { ...config.blogger };
  const originalFetch = global.fetch;

  config.blogger.blogId = 'mock_blog_123';
  config.blogger.clientId = 'mock_client_id';
  config.blogger.clientSecret = 'mock_client_secret';
  config.blogger.refreshToken = 'mock_refresh_token';

  const fetchCalls: { url: string; method: string; body?: any }[] = [];

  global.fetch = async (url: any, options: any = {}) => {
    const urlStr = String(url);
    const method = options.method || 'GET';
    let body: any = undefined;
    if (options.body) {
      try {
        body = JSON.parse(options.body);
      } catch {
        body = String(options.body);
      }
    }
    fetchCalls.push({ url: urlStr, method, body });

    // 1. OAuth token endpoint
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'mock_access_token_xyz' }),
      } as any;
    }

    // 2. Blogger posts insert endpoint
    if (urlStr.includes('/posts/') && method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          id: 'post_99999',
          url: `https://kybien.blogspot.com/2026/10/${body.title.replace(/\s+/g, '-')}.html`,
          title: body.title,
        }),
      } as any;
    }

    // 3. Blogger post patch endpoint
    if (urlStr.includes('/posts/post_99999') && method === 'PATCH') {
      return {
        ok: true,
        json: async () => ({
          id: 'post_99999',
          title: body.title, // Tiêu đề sau khi cập nhật
          url: 'https://kybien.blogspot.com/2026/10/co-bi-phap-ky-thu-duy-vs-may-dia-nguc.html', // URL vẫn giữ nguyên không đổi!
        }),
      } as any;
    }

    return { ok: false, json: async () => ({ error: 'Not found' }) } as any;
  };

  try {
    const mockAiResult = {
      keyMoves: ['Nước 1: Khởi trận', 'Nước 2: Sát cục'],
      tacticalAnalysis: 'Phân tích chiến thuật sắc bén',
      blunders: [],
      saTruongCommentary: 'Trận đại chiến nổ ra cuồn cuộn...',
      matchTitlePhrase: 'Đại Chiến Càn Khôn Đổi Chủ',
    };

    const postId = await publishMatchToBlogger(
      'mock_match_seo_1',
      'Kỳ Thủ Duy',
      'Máy Địa Ngục',
      ['1,1-2,2', '3,3-4,4'],
      mockAiResult,
      'Cờ Bí Pháp',
      'kb',
      '✨',
      '✨ Cờ Bí Pháp'
    );

    assert.strictEqual(postId, 'post_99999', 'Hàm phải trả về post ID hợp lệ');

    // Kiểm tra chính xác 3 cuộc gọi fetch: OAuth -> POST (Insert) -> PATCH (Update)
    assert.strictEqual(fetchCalls.length, 3, 'Phải thực hiện đúng 3 cuộc gọi API');

    // Cuộc gọi 1: OAuth token
    assert.strictEqual(fetchCalls[0].url.includes('oauth2.googleapis.com/token'), true);

    // Cuộc gọi 2: POST posts.insert với Title Slug không dấu sạch
    assert.strictEqual(fetchCalls[1].method, 'POST');
    assert.strictEqual(fetchCalls[1].body.title.includes('Kỳ'), false, 'Lần 1 gửi Title không dấu');
    assert.strictEqual(fetchCalls[1].body.title.includes('Địa'), false, 'Lần 1 gửi Title không dấu');
    assert.ok(fetchCalls[1].body.title.includes('ky thu duy vs may dia nguc'), 'Lần 1 gửi Title Slug chuẩn');
    // Kiểm tra nhãn tạo bài phải chuẩn slug không dấu
    assert.deepStrictEqual(
      fetchCalls[1].body.labels,
      ['tran-hay', 'phan-tich-co', 'co-bi-phap'],
      'Nhãn Blogger phải là mảng slug sạch không dấu'
    );

    // Cuộc gọi 3: PATCH posts.patch với Title tiếng Việt đầy đủ gốc
    assert.strictEqual(fetchCalls[2].method, 'PATCH');
    assert.strictEqual(fetchCalls[2].url.includes('/posts/post_99999'), true);
    assert.strictEqual(fetchCalls[2].body.title.includes('Kỳ Thủ Duy'), true, 'Lần 2 khôi phục tiêu đề gốc có dấu');
    assert.strictEqual(fetchCalls[2].body.title.includes('Máy Địa Ngục'), true, 'Lần 2 khôi phục tiêu đề gốc có dấu');

    console.log('✅ Test 7 Passed: Quy trình "Tạo bài 2 thì" (POST slug -> PATCH display title) hoàn hảo 100%!');
  } finally {
    // Phục hồi môi trường
    config.blogger = originalConfig;
    global.fetch = originalFetch;
  }

  // Test 8: Kiểm tra tính chuẩn hóa nghiêm ngặt của getStandardPostLabels cho mọi biến thể
  console.log('-> Test 8: Kiểm tra quy chuẩn slug nhãn bài viết (getStandardPostLabels)...');
  const testCases: Array<{ variant?: string; expected: string[] }> = [
    { variant: 'kb', expected: ['tran-hay', 'phan-tich-co', 'co-bi-phap'] },
    { variant: 't', expected: ['tran-hay', 'phan-tich-co', 'co-up'] },
    { variant: 'g', expected: ['tran-hay', 'phan-tich-co', 'co-up-gian-diep'] },
    { variant: 'n', expected: ['tran-hay', 'phan-tich-co', 'co-truyen-thong'] },
    { variant: 'KB', expected: ['tran-hay', 'phan-tich-co', 'co-bi-phap'] },
    { variant: 'T', expected: ['tran-hay', 'phan-tich-co', 'co-up'] },
    { variant: '', expected: ['tran-hay', 'phan-tich-co', 'co-bi-phap'] },
    { variant: undefined, expected: ['tran-hay', 'phan-tich-co', 'co-bi-phap'] },
  ];

  for (const tc of testCases) {
    const labels = getStandardPostLabels(tc.variant);
    assert.deepStrictEqual(labels, tc.expected, `Labels cho variant ${tc.variant} không đúng chuẩn`);
    for (const label of labels) {
      assert.ok(/^[a-z0-9\-]+$/.test(label), `Label "${label}" phải chỉ chứa ký tự thường không dấu và gạch ngang, không có dấu cách`);
      assert.strictEqual(label.includes(' '), false, `Label "${label}" không được chứa khoảng trắng`);
    }
  }
  console.log('✅ Test 8 Passed: Toàn bộ nhãn bài viết đảm bảo 100% slug sạch, không dấu, không khoảng cách rác!');

  console.log('\n==================================================');
  console.log('🎉 ALL BLOGGER SEO SLUG & TITLE SWITCH TESTS PASSED 100%!');
  console.log('==================================================\n');
}
