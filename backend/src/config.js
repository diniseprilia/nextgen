import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

let resolvedMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!resolvedMongoUri && process.env.MONGODB_HOST) {
  const host = process.env.MONGODB_HOST;
  const port = process.env.MONGODB_PORT || 27017;
  const db = process.env.MONGODB_DATABASE || 'nextgen';
  const user = process.env.MONGODB_USERNAME || process.env.MONGODB_USER;
  const pass = process.env.MONGODB_PASSWORD;
  if (user && pass) {
    resolvedMongoUri = `mongodb://${user}:${pass}@${host}:${port}/${db}`;
  } else {
    resolvedMongoUri = `mongodb://${host}:${port}/${db}`;
  }
}

resolvedMongoUri = resolvedMongoUri || 'mongodb://localhost:27017/nextgen';

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: resolvedMongoUri,
  auth0Domain: (process.env.AUTH0_DOMAIN || '').trim(),
  auth0ClientId: (process.env.AUTH0_CLIENT_ID || '').trim(),
  auth0ClientSecret: (process.env.AUTH0_CLIENT_SECRET || '').trim(),
  auth0CallbackUrl: (process.env.AUTH0_CALLBACK_URL || '').trim(),
  auth0GoogleConnection: (process.env.AUTH0_GOOGLE_CONNECTION || 'google-oauth2').trim(),
  sessionSecret: process.env.SESSION_SECRET || 'nextgen-dev-session-secret-change-me',
  allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN || 'ninjavan.co',
  emailAllowlist: (process.env.EMAIL_ALLOWLIST || 'diniseprilia@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || 'diniseprilia@gmail.com',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  confluence: {
    baseUrl: (process.env.CONFLUENCE_BASE_URL || '').trim().replace(/\/$/, ''),
    email: (process.env.CONFLUENCE_EMAIL || '').trim(),
    apiToken: (process.env.CONFLUENCE_API_TOKEN || '').trim(),
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: Number(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'nextgen-materials',
  },
};
