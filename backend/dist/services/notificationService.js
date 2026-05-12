"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyNewMessage = notifyNewMessage;
exports.notifyWatering = notifyWatering;
exports.notifyLazoCreated = notifyLazoCreated;
exports.notifyLazoDeleted = notifyLazoDeleted;
exports.sendDailyWateringReminders = sendDailyWateringReminders;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
// ─── Inicializar Firebase Admin (una sola vez) ─────────────────
let initialized = false;
function initFirebase() {
    if (initialized) {
        return;
    }
    try {
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
            || './firebase-service-account.json';
        // Resolve relative to the backend root (process.cwd()) not this file's dir
        const resolvedPath = path_1.default.isAbsolute(serviceAccountPath)
            ? serviceAccountPath
            : path_1.default.resolve(process.cwd(), serviceAccountPath);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const serviceAccount = require(resolvedPath);
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
        });
        initialized = true;
        console.log('[notifications] Firebase Admin inicializado');
    }
    catch (err) {
        console.error('[notifications] Error inicializando Firebase Admin:', err);
    }
}
// ─── Envío genérico ────────────────────────────────────────────
async function sendToToken(token, title, body, data) {
    initFirebase();
    if (!initialized) {
        console.error('[notifications] Firebase Admin no inicializado, descarto envío');
        return;
    }
    try {
        const messageId = await firebase_admin_1.default.messaging().send({
            token,
            notification: { title, body },
            data,
            android: {
                notification: {
                    channelId: 'lazos_default',
                    priority: 'high',
                },
            },
        });
        console.log(`[notifications] enviada (${messageId}) → ${token.slice(0, 12)}…  "${title}"`);
    }
    catch (err) {
        const code = err.code;
        if (code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token') {
            console.warn(`[notifications] Token caducado, limpiando: ${token.slice(0, 12)}…`);
            await database_1.db.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1', [token]);
        }
        else {
            console.error('[notifications] sendToToken error:', err);
        }
    }
}
// ─── Notificar nuevo mensaje ───────────────────────────────────
async function notifyNewMessage(lazoId, senderId, messagePreview) {
    try {
        // Obtener el FCM token del compañero
        const result = await database_1.db.query(`SELECT u.fcm_token, sender.username as sender_username
       FROM lazos l
       JOIN users u ON u.id = CASE WHEN l.user1_id = $2 THEN l.user2_id ELSE l.user1_id END
       JOIN users sender ON sender.id = $2
       WHERE l.id = $1 AND l.is_active = TRUE`, [lazoId, senderId]);
        if (result.rows.length === 0 || !result.rows[0].fcm_token) {
            return;
        }
        const { fcm_token, sender_username } = result.rows[0];
        const preview = messagePreview.length > 60
            ? messagePreview.slice(0, 60) + '…'
            : messagePreview;
        await sendToToken(fcm_token, sender_username, preview, { type: 'message', lazoId });
    }
    catch (err) {
        console.error('[notifications] notifyNewMessage error:', err);
    }
}
// ─── Notificar riego mutuo ─────────────────────────────────────
async function notifyWatering(lazoId, wateredByUserId, justStreaked) {
    try {
        const result = await database_1.db.query(`SELECT u.fcm_token, sender.username as sender_username
       FROM lazos l
       JOIN users u ON u.id = CASE WHEN l.user1_id = $2 THEN l.user2_id ELSE l.user1_id END
       JOIN users sender ON sender.id = $2
       WHERE l.id = $1 AND l.is_active = TRUE`, [lazoId, wateredByUserId]);
        if (result.rows.length === 0 || !result.rows[0].fcm_token) {
            return;
        }
        const { fcm_token, sender_username } = result.rows[0];
        const title = justStreaked ? '🌱 ¡Racha aumentada!' : `${sender_username} regó la planta`;
        const body = justStreaked
            ? `${sender_username} también regó. ¡Su lazo sigue creciendo!`
            : 'Riega tú también para mantener la racha viva.';
        await sendToToken(fcm_token, title, body, { type: 'watering', lazoId });
    }
    catch (err) {
        console.error('[notifications] notifyWatering error:', err);
    }
}
// ─── Notificar creación de lazo (al invitador) ────────────────
async function notifyLazoCreated(inviterUserId, joinerUsername, lazoId) {
    try {
        const result = await database_1.db.query('SELECT fcm_token FROM users WHERE id = $1', [inviterUserId]);
        if (result.rows.length === 0 || !result.rows[0].fcm_token) {
            return;
        }
        await sendToToken(result.rows[0].fcm_token, '¡Nuevo lazo!', `${joinerUsername} se unió a tu lazo`, { type: 'lazo_created', lazoId });
    }
    catch (err) {
        console.error('[notifications] notifyLazoCreated error:', err);
    }
}
// ─── Notificar eliminación de lazo (al partner) ───────────────
async function notifyLazoDeleted(partnerUserId, deleterUsername, lazoId) {
    try {
        const result = await database_1.db.query('SELECT fcm_token FROM users WHERE id = $1', [partnerUserId]);
        if (result.rows.length === 0 || !result.rows[0].fcm_token) {
            return;
        }
        await sendToToken(result.rows[0].fcm_token, 'Lazo eliminado', `${deleterUsername} eliminó su lazo contigo`, { type: 'lazo_deleted', lazoId, deleterUsername });
    }
    catch (err) {
        console.error('[notifications] notifyLazoDeleted error:', err);
    }
}
// ─── Recordatorios diarios ─────────────────────────────────────
async function sendDailyWateringReminders() {
    try {
        // Usuarios que AÚN no han regado hoy en lazos activos no muertos
        const result = await database_1.db.query(`SELECT DISTINCT u.fcm_token
       FROM lazos l
       JOIN users u ON (u.id = l.user1_id OR u.id = l.user2_id)
       WHERE l.is_active = TRUE
         AND l.plant_phase != 'dead'
         AND u.fcm_token IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM daily_watering dw
           WHERE dw.lazo_id = l.id AND dw.user_id = u.id AND dw.watered_on = CURRENT_DATE
         )`);
        console.log(`[notifications] Enviando ${result.rows.length} recordatorios de riego`);
        for (const row of result.rows) {
            await sendToToken(row.fcm_token, '🌿 ¡No olvides regar!', 'Tu planta necesita agua hoy para mantener la racha.', { type: 'reminder' });
        }
    }
    catch (err) {
        console.error('[notifications] sendDailyWateringReminders error:', err);
    }
}
