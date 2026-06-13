const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

async function uploadFile(key, buffer, contentType) {
  await client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

async function deleteFile(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

async function getPresignedUrl(key, expiresIn = 3600) {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn });
}

module.exports = { uploadFile, deleteFile, getPresignedUrl };
