import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';

export const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
export const S3_BUCKET = process.env.S3_BUCKET;

if (!S3_BUCKET) {
  console.warn('S3_BUCKET env var is not set. Uploads and S3 data operations will fail.');
}

export const s3 = new S3Client({ region: AWS_REGION });

export async function putBase64Object(key, base64Data, contentType = 'application/octet-stream') {
  const buffer = Buffer.from(String(base64Data).replace(/^data:[^;]+;base64,/, ''), 'base64');
  const cmd = new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType });
  await s3.send(cmd);
  return { bucket: S3_BUCKET, key };
}

export async function getSignedUrl(key, expiresInSeconds = 3600) {
  const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
  return presign(s3, cmd, { expiresIn: expiresInSeconds });
}
