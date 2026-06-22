import { v4 as uuidv4 } from 'uuid';
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from 'path';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
});


export async function generatePresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: 3600, // 1 giờ
  });
}

export async function uploadFileToS3(fileBuffer, originalName, mimeType) {
  const ext = path.extname(originalName) || '';
  const storedFilename = `chat/${Date.now()}-${uuidv4()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: storedFilename,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  // Build public URL
  const regionStr = process.env.S3_REGION && process.env.S3_REGION !== 'us-east-1' ? `-${process.env.S3_REGION}` : '';
  const endpointHost = process.env.S3_ENDPOINT 
    ? process.env.S3_ENDPOINT.replace(/^https?:\/\//, '') 
    : `s3${regionStr}.amazonaws.com`;
  
  const url = `https://${process.env.S3_BUCKET}.${endpointHost}/${storedFilename}`;

  return {
    url,
    storedFilename,
  };
}

export const generateRoomCode = () => {
  // Format: abc-xyz-def
  const uuidPart = uuidv4().split('-')[0];
  const part1 = Math.random().toString(36).substring(2, 5);
  const part2 = Math.random().toString(36).substring(2, 5);
  const part3 = Math.random().toString(36).substring(2, 5);
  return `${part1}-${part2}-${part3}-${uuidPart.substring(0, 3)}`;
};

export const generateSocketEventName = (namespace, action) => {
  return `${namespace}:${action}`;
};

export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  return Math.floor((endTime - startTime) / 1000); // in seconds
};

export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours}h ${minutes}m ${secs}s`;
};

export default {
  generateRoomCode,
  generateSocketEventName,
  calculateDuration,
  formatDuration,
  generatePresignedUrl,
  uploadFileToS3
};
