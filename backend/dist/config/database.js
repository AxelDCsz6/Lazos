"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = exports.db = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.db = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
exports.db.on('error', err => {
    console.error('Error en pool PostgreSQL:', err);
});
// Forzar timezone CDMX en cada conexión del pool.
// Esto hace que CURRENT_DATE y NOW() operen en hora de Ciudad de México
// en todas las queries sin excepción.
exports.db.on('connect', client => {
    client.query("SET TIME ZONE 'America/Mexico_City'")
        .catch(err => console.error('[db] Error setting timezone:', err));
});
const connectDB = async () => {
    const client = await exports.db.connect();
    console.warn('✅ Conectado a PostgreSQL');
    client.release();
};
exports.connectDB = connectDB;
