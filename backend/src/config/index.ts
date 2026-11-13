import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const MIN_JWT_SECRET_LENGTH = 32;

/**
 * ⚠️ JWT_SECRET BẮT BUỘC ở production — không còn fallback tự sinh.
 *
 * Trước đây code tự sinh secret từ DATABASE_URL (ai biết DATABASE_URL đều
 * tính lại được secret rồi tự ký JWT giả mạo bất kỳ user nào) và có secret
 * mặc định công khai 'default_secret_key_kybien' trong repo.
 *
 * Bây giờ: ở production, thiếu JWT_SECRET, ngắn hơn 32 ký tự, hoặc nằm trong
 * danh sách yếu → server THROW NGAY lúc khởi động (fail fast, chủ ý, không
 * phải lỗi deploy). Hãy set JWT_SECRET (chuỗi ngẫu nhiên ≥ 32 ký tự, ví dụ
 * chạy `openssl rand -hex 32`) trong Render → Environment rồi deploy lại.
 * Ở development vẫn cho dùng secret mặc định nhưng log cảnh báo lớn.
 */
function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  const unsafeSecrets = [
    'default_secret_key_kybien',
    'kybien_super_secret_jwt_key_2026',
    'secret',
    '123456',
    'jwt_secret',
    'change_me',
  ];

  const isUsable =
    !!envSecret &&
    envSecret.length >= MIN_JWT_SECRET_LENGTH &&
    !unsafeSecrets.includes(envSecret.toLowerCase());

  if (isUsable) {
    return envSecret as string;
  }

  if (nodeEnv === 'production') {
    throw new Error(
      'JWT_SECRET chưa được cấu hình hoặc quá yếu. Server từ chối khởi động để tránh bị giả mạo token. ' +
        'Hãy set JWT_SECRET (chuỗi ngẫu nhiên ít nhất 32 ký tự, ví dụ chạy `openssl rand -hex 32`) ' +
        'trong Render → Environment, rồi deploy lại.'
    );
  }

  console.warn('⚠️⚠️⚠️ CẢNH BÁO BẢO MẬT: JWT_SECRET chưa được cấu hình hoặc quá yếu — đang dùng secret mặc định CHỈ DÀNH CHO DEV. TUYỆT ĐỐI không dùng cấu hình này ở production.');
  return 'default_secret_key_kybien';
}

const jwtSecret = resolveJwtSecret();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  jwtSecret,
  // Email quản trị, phân tách dấu phẩy — dùng cho middleware requireAdmin.
  // Ví dụ: ADMIN_EMAILS=admin@kybien.com,mod@kybien.com
  // So sánh không phân biệt hoa/thường. Chưa set = mọi endpoint admin đều khóa.
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  clientOrigin: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((item) => item.trim())
    : ['https://kybien.blogspot.com', 'http://localhost:3000', 'http://localhost:4000'],
  databaseUrl: process.env.DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  blogger: {
    blogId: process.env.BLOGGER_BLOG_ID || '',
    clientId: process.env.BLOGGER_CLIENT_ID || '',
    clientSecret: process.env.BLOGGER_CLIENT_SECRET || '',
    refreshToken: process.env.BLOGGER_REFRESH_TOKEN || '',
  },
};
