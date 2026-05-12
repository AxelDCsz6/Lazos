import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

// Carpeta raíz de uploads, resuelta desde process.cwd() (raíz del backend).
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

// Crear la carpeta si no existe (en arranque).
if (!fs.existsSync(UPLOADS_ROOT)) {
  fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
}

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
]);

export function isImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIMES.has(mime);
}

export function isVideoMime(mime: string): boolean {
  return ALLOWED_VIDEO_MIMES.has(mime);
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg';
    case 'image/png':  return 'png';
    case 'image/webp': return 'webp';
    case 'video/mp4':  return 'mp4';
    case 'video/quicktime': return 'mov';
    default: return 'bin';
  }
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const lazoId = req.params.id;
    if (!lazoId) { return cb(new Error('lazoId requerido'), ''); }
    const dir = path.join(UPLOADS_ROOT, lazoId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = mimeToExt(file.mimetype);
    cb(null, `${uuidv4()}.${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  if (isImageMime(file.mimetype) || isVideoMime(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
  }
}

// 50 MB para video, validamos por mime que sea video; multer aplica el límite global.
export const uploadMessageMedia = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');

export { UPLOADS_ROOT };
