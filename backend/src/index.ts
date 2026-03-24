import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import lazosRoutes from './routes/lazosRoutes';
import { startCleanupJob } from './jobs/cleanupCodes';
import { startStreakJob } from './jobs/streakJob';
import { startDailyReminderJob } from './jobs/dailyReminderJob';
import { connectDB } from './config/database';
import authRoutes from './routes/authRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Rutas ────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/lazos', lazosRoutes);
// Sprint 2: app.use('/api/lazos', lazosRoutes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// ─── Arrancar ─────────────────────────────────────────────────
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.warn(`🚀 Backend corriendo en http://localhost:${PORT}`);
      startCleanupJob();
      startStreakJob();
      startDailyReminderJob();
    });
  })
  .catch(err => {
    console.error('Error conectando a la base de datos:', err);
    process.exit(1);
  });

export default app;
