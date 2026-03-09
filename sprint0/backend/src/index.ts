import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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

// ─── Rutas — se añaden por sprint ─────────────────────────────
// Sprint 1: app.use('/api/auth',  authRoutes);
// Sprint 2: app.use('/api/lazos', lazosRoutes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

// ─── Arrancar ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.warn(`🚀 Backend corriendo en http://localhost:${PORT}`);
});

export default app;
