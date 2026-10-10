import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'default_secret_key_kybien';

const unsafeSecrets = [
  'default_secret_key_kybien',
  'kybien_super_secret_jwt_key_2026',
  'secret',
  '123456',
  'jwt_secret',
  'change_me',
];

if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || unsafeSecrets.includes(jwtSecret.toLowerCase())) {
    throw new Error(
      'CRITICAL SECURITY ERROR: JWT_SECRET must be set to a secure, non-default string in production environment.'
    );
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  jwtSecret,
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
