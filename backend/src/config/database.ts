import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

db.on('error', err => {
  console.error('Error en pool PostgreSQL:', err);
});

export const connectDB = async (): Promise<void> => {
  const client = await db.connect();
  console.warn('✅ Conectado a PostgreSQL');
  client.release();
};
