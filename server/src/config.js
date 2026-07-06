import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nextgen',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  sessionSecret: process.env.SESSION_SECRET || 'nextgen-dev-session-secret-change-me',
  allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN || 'ninjavan.co',
  emailAllowlist: (process.env.EMAIL_ALLOWLIST || 'diniseprilia@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || 'diniseprilia@gmail.com',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'nextgen-materials',
  },
};
