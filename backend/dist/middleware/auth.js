"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Token requerido' });
        return;
    }
    const token = header.split(' ')[1];
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'dev_secret');
        req.userId = payload.userId;
        next();
    }
    catch {
        res.status(401).json({ message: 'Token inválido o expirado' });
    }
}
