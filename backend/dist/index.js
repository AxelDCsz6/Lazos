"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const lazosRoutes_1 = __importDefault(require("./routes/lazosRoutes"));
const cleanupCodes_1 = require("./jobs/cleanupCodes");
const streakJob_1 = require("./jobs/streakJob");
const dailyReminderJob_1 = require("./jobs/dailyReminderJob");
const database_1 = require("./config/database");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const upload_1 = require("./middleware/upload");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// ─── Middleware ───────────────────────────────────────────────
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ─── Media estático ───────────────────────────────────────────
// Sirve los archivos subidos por mensajes. URLs llevan UUID no adivinable
// como medida básica de privacidad para MVP. TODO: añadir middleware que
// verifique membresía al lazo antes de servir el archivo.
app.use('/media', express_1.default.static(upload_1.UPLOADS_ROOT, {
    maxAge: '7d',
    fallthrough: false,
}));
// ─── Rutas ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes_1.default);
app.use('/api/lazos', lazosRoutes_1.default);
// Sprint 2: app.use('/api/lazos', lazosRoutes);
// ─── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ message: 'Ruta no encontrada' });
});
// ─── Arrancar ─────────────────────────────────────────────────
(0, database_1.connectDB)()
    .then(() => {
    app.listen(PORT, () => {
        console.warn(`🚀 Backend corriendo en http://localhost:${PORT}`);
        (0, cleanupCodes_1.startCleanupJob)();
        (0, streakJob_1.startStreakJob)();
        (0, dailyReminderJob_1.startDailyReminderJob)();
    });
})
    .catch(err => {
    console.error('Error conectando a la base de datos:', err);
    process.exit(1);
});
exports.default = app;
