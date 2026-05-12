"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPLOADS_ROOT = exports.uploadMessageMedia = void 0;
exports.isImageMime = isImageMime;
exports.isVideoMime = isVideoMime;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
// Carpeta raíz de uploads, resuelta desde process.cwd() (raíz del backend).
const UPLOADS_ROOT = path_1.default.resolve(process.cwd(), 'uploads');
exports.UPLOADS_ROOT = UPLOADS_ROOT;
// Crear la carpeta si no existe (en arranque).
if (!fs_1.default.existsSync(UPLOADS_ROOT)) {
    fs_1.default.mkdirSync(UPLOADS_ROOT, { recursive: true });
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
function isImageMime(mime) {
    return ALLOWED_IMAGE_MIMES.has(mime);
}
function isVideoMime(mime) {
    return ALLOWED_VIDEO_MIMES.has(mime);
}
function mimeToExt(mime) {
    switch (mime) {
        case 'image/jpeg': return 'jpg';
        case 'image/png': return 'png';
        case 'image/webp': return 'webp';
        case 'video/mp4': return 'mp4';
        case 'video/quicktime': return 'mov';
        default: return 'bin';
    }
}
const storage = multer_1.default.diskStorage({
    destination: (req, _file, cb) => {
        const lazoId = req.params.id;
        if (!lazoId) {
            return cb(new Error('lazoId requerido'), '');
        }
        const dir = path_1.default.join(UPLOADS_ROOT, lazoId);
        fs_1.default.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = mimeToExt(file.mimetype);
        cb(null, `${(0, uuid_1.v4)()}.${ext}`);
    },
});
function fileFilter(_req, file, cb) {
    if (isImageMime(file.mimetype) || isVideoMime(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
}
// 50 MB para video, validamos por mime que sea video; multer aplica el límite global.
exports.uploadMessageMedia = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');
