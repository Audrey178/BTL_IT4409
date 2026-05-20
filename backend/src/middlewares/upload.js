import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { HTTP_STATUS } from '../utils/constants.js';

const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const recordingDir = path.join(uploadRoot, 'recordings');
const thumbnailDir = path.join(uploadRoot, 'thumbnails');

for (const dir of [recordingDir, thumbnailDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const extensionFromMime = (mimeType) => {
  const map = {
    'video/webm': '.webm',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-matroska': '.mkv',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[mimeType] || '';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'thumbnail' ? thumbnailDir : recordingDir);
  },
  filename: (req, file, cb) => {
    const ext = extensionFromMime(file.mimetype) || path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'video' && file.mimetype.startsWith('video/')) {
    return cb(null, true);
  }

  if (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/')) {
    return cb(null, true);
  }

  const error = new Error('Only video uploads and image thumbnails are allowed');
  error.statusCode = HTTP_STATUS.BAD_REQUEST;
  return cb(error);
};

export const uploadRecording = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_RECORDING_FILE_SIZE || 524288000),
    files: 2,
  },
}).fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

export const buildUploadUrl = (req, file) => {
  if (!file) return null;
  const relativePath = path.relative(uploadRoot, file.path).replace(/\\/g, '/');
  return `${req.protocol}://${req.get('host')}/uploads/${relativePath}`;
};
