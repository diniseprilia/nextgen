import * as Minio from 'minio';
import { config } from './config.js';

const { minio: mc } = config;

export const minioClient = new Minio.Client({
  endPoint: mc.endPoint,
  port: mc.port,
  useSSL: mc.useSSL,
  accessKey: mc.accessKey,
  secretKey: mc.secretKey,
});

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(mc.bucket);
  if (!exists) {
    await minioClient.makeBucket(mc.bucket);
    console.log(`MinIO bucket created: ${mc.bucket}`);
  } else {
    console.log(`MinIO bucket ready: ${mc.bucket}`);
  }
}

export function objectKeyFor(materialId, originalName) {
  const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `materials/${materialId}/${safe}`;
}

export async function uploadObject(objectKey, buffer, meta) {
  await minioClient.putObject(mc.bucket, objectKey, buffer, buffer.length, meta);
}

export async function removeObject(objectKey) {
  await minioClient.removeObject(mc.bucket, objectKey);
}

export async function getObjectStream(objectKey) {
  return minioClient.getObject(mc.bucket, objectKey);
}

export async function getObjectBuffer(objectKey) {
  const stream = await getObjectStream(objectKey);
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function getBucket() {
  return mc.bucket;
}
