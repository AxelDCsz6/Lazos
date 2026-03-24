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

// Forzar timezone CDMX en cada conexión del pool.
// Esto hace que CURRENT_DATE y NOW() operen en hora de Ciudad de México
// en todas las queries sin excepción.
db.on('connect', client => {
  client.query("SET TIME ZONE 'America/Mexico_City'")
    .catch(err => console.error('[db] Error setting timezone:', err));
});

export const connectDB = async (): Promise<void> => {
  const client = await db.connect();
  console.warn('✅ Conectado a PostgreSQL');
  client.release();
};
