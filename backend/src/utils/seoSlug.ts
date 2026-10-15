/**
 * Tiện ích Chuẩn hóa và Sinh Slug URL Chuẩn SEO cho Kỳ Biến Platform
 * - Loại bỏ dấu tiếng Việt (đặc biệt xử lý triệt để 'đ', 'Đ' -> 'd', 'D')
 * - Loại bỏ emoji, ký tự đặc biệt, dấu câu, thẻ HTML
 * - Tối ưu độ dài (30 - 48 ký tự, 4 - 6 từ), ngắt theo từ an toàn
 * - Phục vụ chiến thuật "Tạo bài 2 thì" của Blogger API để sinh permalink đẹp 100% tự động
 */

/**
 * Chuyển chuỗi tiếng Việt có dấu thành không dấu chuẩn ASCII.
 * Chuyển đổi 'đ', 'Đ' trước khi phân rã Unicode NFD.
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u02C6\u0306\u031B]/g, '');
}

/**
 * Làm sạch tên người chơi hoặc tên AI cho slug:
 * - Loại bỏ các dấu ngoặc vuông `[...]`
 * - Nếu có tiền tố vai trò như "Chiến Tướng.Duy", chỉ lấy tên cốt lõi "Duy"
 * - Khử dấu tiếng Việt, loại bỏ ký tự không thuộc [a-z0-9]
 */
export function cleanPlayerNameForSlug(name: string): string {
  if (!name) return 'ky thu';
  let cleaned = String(name).replace(/^\[+|\]+$/g, '').trim();
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.');
    cleaned = parts[parts.length - 1];
  }
  cleaned = removeVietnameseTones(cleaned).toLowerCase();
  cleaned = cleaned.replace(/[^a-z0-9]+/g, ' ').trim();
  return cleaned || 'ky thu';
}

/**
 * Chuẩn hóa tên thể loại cờ thành từ khóa ngắn gọn:
 * - 'kb' -> 'co bi phap'
 * - 't' -> 'co up'
 * - 'g' -> 'co up gian diep'
 * - 'n' -> 'co tuong'
 */
export function cleanVariantForSlug(variantCode?: string, variantName?: string): string {
  const code = (variantCode || '').toLowerCase().trim();
  if (code === 'kb') return 'co bi phap';
  if (code === 't') return 'co up';
  if (code === 'g') return 'co up gian diep';
  if (code === 'n') return 'co tuong';

  if (variantName) {
    const v = removeVietnameseTones(variantName).toLowerCase();
    if (v.includes('gian diep')) return 'co up gian diep';
    if (v.includes('up')) return 'co up';
    if (v.includes('bi phap')) return 'co bi phap';
    if (v.includes('truyen thong') || v.includes('tuong')) return 'co tuong';
  }

  return 'co bi phap';
}

/**
 * Danh sách từ dừng (Stop-words) tiếng Việt ít giá trị tìm kiếm
 */
const STOP_WORDS = new Set([
  'nhung', 'cac', 'cua', 'va', 'mot', 'trong', 'tai', 'o', 'cho', 'la', 'voi', 'duoc', 'bi'
]);

export function filterStopWords(words: string[]): string[] {
  return words.filter((w) => !STOP_WORDS.has(w) && w.length > 0);
}

export interface SeoSlugParams {
  variantCode?: string;
  variantName?: string;
  playerWhite?: string;
  playerBlack?: string;
  matchPhrase?: string;
  maxChars?: number;
}

/**
 * Xây dựng chuỗi tiêu đề dùng để tạo slug Blogger (Title Slug).
 * Cấu trúc ưu tiên: [the-loai-co] [nguoi-choi-1] vs [nguoi-choi-2] [tu-khoa-the-co]
 * Giới hạn độ dài an toàn tối đa 48 ký tự và chỉ ngắt tại ranh giới từ.
 */
export function buildSeoSlugTitle(params: SeoSlugParams): string {
  const maxChars = params.maxChars || 48;
  const variantSlug = cleanVariantForSlug(params.variantCode, params.variantName);
  const whiteSlug = cleanPlayerNameForSlug(params.playerWhite || 'Do');
  const blackSlug = cleanPlayerNameForSlug(params.playerBlack || 'Den');

  const coreParts: string[] = [];

  // 1. Thể loại cờ
  coreParts.push(...variantSlug.split(/\s+/).filter(Boolean));

  // 2. Bên Trắng (Đỏ)
  coreParts.push(...whiteSlug.split(/\s+/).filter(Boolean));

  // 3. Từ khóa đối đầu
  coreParts.push('vs');

  // 4. Bên Đen
  coreParts.push(...blackSlug.split(/\s+/).filter(Boolean));

  // 5. Thêm từ khóa thế cờ / phụ đề trận đấu nếu còn chỗ
  if (params.matchPhrase) {
    const cleanPhrase = removeVietnameseTones(params.matchPhrase)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    const phraseWords = filterStopWords(cleanPhrase.split(/\s+/)).filter(
      (w) => w !== 'tran' && w !== 'dai' && w !== 'chien' && w !== 'cuoc'
    );

    for (const w of phraseWords) {
      const prospective = [...coreParts, w].join(' ');
      if (prospective.length <= maxChars) {
        coreParts.push(w);
      } else {
        break;
      }
    }
  }

  let slug = coreParts.join(' ');

  // Cắt an toàn theo ranh giới từ nếu vượt quá maxChars
  if (slug.length > maxChars) {
    const trimmed = slug.slice(0, maxChars);
    const lastSpace = trimmed.lastIndexOf(' ');
    slug = lastSpace > 0 ? trimmed.slice(0, lastSpace) : trimmed;
  }

  return slug.trim();
}

/**
 * Hàm dự phòng tạo slug từ một tiêu đề văn bản bất kỳ
 */
export function generateSeoSlugFromText(text: string, maxChars: number = 48): string {
  if (!text) return 'bai-viet';
  let cleaned = removeVietnameseTones(text).toLowerCase();
  cleaned = cleaned.replace(/\(\s*\d+\s*nuoc\s*\)/gi, '');
  cleaned = cleaned.replace(/[^a-z0-9]+/g, ' ').trim();

  const words = filterStopWords(cleaned.split(/\s+/));
  const result: string[] = [];
  let currentLen = 0;

  for (const w of words) {
    const nextLen = result.length === 0 ? w.length : currentLen + 1 + w.length;
    if (nextLen <= maxChars) {
      result.push(w);
      currentLen = nextLen;
    } else {
      break;
    }
  }

  return result.join(' ') || 'bai-viet';
}

/**
 * Danh sách slug nhãn (Labels) chuẩn hóa cho bài viết xuất bản lên Blogger.
 * Bắt buộc tuân thủ:
 * - Slug chữ thường không dấu, phân cách bằng dấu gạch ngang '-', tuyệt đối không chứa khoảng trắng rác hay chữ có dấu.
 * - Bài viết luôn có:
 *   1. 'tran-hay': Nhãn phân loại chiến tích sa trường
 *   2. 'phan-tich-co': Nhãn thư viện phân tích ván đấu
 *   3. Nhãn biến thể cờ tương ứng: 'co-bi-phap' | 'co-up' | 'co-up-gian-diep' | 'co-truyen-thong'
 */
export function getStandardPostLabels(variantCode?: string): string[] {
  const code = (variantCode || '').toLowerCase().trim();
  let variantLabelSlug = 'co-bi-phap';
  if (code === 't') variantLabelSlug = 'co-up';
  else if (code === 'g') variantLabelSlug = 'co-up-gian-diep';
  else if (code === 'n') variantLabelSlug = 'co-truyen-thong';

  return ['tran-hay', 'phan-tich-co', variantLabelSlug];
}

/**
 * Bảng ánh xạ 16 Bí Pháp Võ Học sang slug neo (Anchor Hash) của trang Cẩm Nang (/p/cam-nang.html#...)
 */
export const BI_PHAP_ANCHORS: Record<string, string> = {
  'Thiểm Điện Trảm': 'thiem-dien-tram',
  'Phá Lãng Bộ': 'pha-lang-bo',
  'Xuyên Vân Tiễn': 'xuyen-van-tien',
  'Bích Lịch Hỏa': 'bich-lich-hoa',
  'Đạp Vân Tiêu': 'dap-van-tieu',
  'Tuyệt Mệnh Cổ': 'tuyet-menh-co',
  'Minh Kính Thuật': 'minh-kinh-thuat',
  'Ngự Ba Viễn Chinh': 'ngu-ba-vien-chinh',
  'Xuất Trần Hộ Pháp': 'xuat-tran-ho-phap',
  'Song Long Xuất Hải': 'song-long-xuat-hai',
  'Tật Phong Binh': 'tat-phong-binh',
  'Hồi Phong Binh': 'hoi-phong-binh',
  'Thân Chinh Xuất Giá': 'than-chinh-xuat-gia',
  'Cấp Cứu Cần Vương': 'cap-cuu-can-vuong',
  'Kim Cang Bất Hoại': 'kim-cang-bat-hoai',
  'Càn Khôn Di Vị': 'can-khon-di-vi',
};

/**
 * Tự động gắn link ngữ cảnh (Contextual Links) trỏ về Cẩm Nang khi bài viết nhắc đến các bí pháp độc quyền.
 * - Gắn link cho lần xuất hiện đầu tiên của từng bí pháp (tránh nhồi nhét link / anchor stuffing).
 * - Tuyệt đối không thay thế nếu từ khóa đã nằm trong thẻ HTML hoặc thẻ liên kết <a>.
 */
export function injectBiPhapLinks(htmlText: string): string {
  if (!htmlText) return '';

  const names = Object.keys(BI_PHAP_ANCHORS);
  names.sort((a, b) => b.length - a.length);

  const linked = new Set<string>();
  const tokens = htmlText.split(/(<[^>]+>)/g);
  let insideAnchor = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.startsWith('<')) {
      if (/^<a\b/i.test(token)) insideAnchor = true;
      else if (/^<\/a>/i.test(token)) insideAnchor = false;
      continue;
    }

    if (insideAnchor) continue;

    let modifiedToken = token;
    for (const name of names) {
      if (linked.has(name)) continue;
      const idx = modifiedToken.indexOf(name);
      if (idx !== -1) {
        const slug = BI_PHAP_ANCHORS[name];
        const linkTag = `<a href="/p/cam-nang.html#${slug}" style="color: #f1c40f; font-weight: bold; text-decoration: underline; text-underline-offset: 3px;" title="Xem luận giải bí pháp ${name} trong Cẩm Nang Võ Học">${name}</a>`;
        modifiedToken =
          modifiedToken.slice(0, idx) +
          linkTag +
          modifiedToken.slice(idx + name.length);
        linked.add(name);
      }
    }
    tokens[i] = modifiedToken;
  }

  return tokens.join('');
}

