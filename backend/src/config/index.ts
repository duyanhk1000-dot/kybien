import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'default_secret_key_kybien',
  clientOrigin: process.env.CLIENT_ORIGIN
    ? process.env.CLIENT_ORIGIN.split(',').map((item) => item.trim())
    : ['*'],
  databaseUrl: process.env.DATABASE_URL,
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  blogger: {
    blogId: process.env.BLOGGER_BLOG_ID || '',
    clientId: process.env.BLOGGER_CLIENT_ID || '',
    clientSecret: process.env.BLOGGER_CLIENT_SECRET || '',
    refreshToken: process.env.BLOGGER_REFRESH_TOKEN || '',
  },
};
