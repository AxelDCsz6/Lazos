import admin from 'firebase-admin';
import { db } from '../config/database';

// ─── Inicializar Firebase Admin (una sola vez) ─────────────────
let initialized = false;

function initFirebase(): void {
  if (initialized) { return; }
  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      || './firebase-service-account.json';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('[notifications] Firebase Admin inicializado');
  } catch (err) {
    console.error('[notifications] Error inicializando Firebase Admin:', err);
  }
}

initFirebase();

// ─── Envío genérico ────────────────────────────────────────────
async function sendToToken(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  if (!initialized) { return; }
  try {
    await admin.messaging().send({
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
  } catch (err: unknown) {
    // Si el token es inválido, lo limpiamos de la BD
    const code = (err as { code?: string }).code;
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') {
      await db.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1', [token]);
    } else {
      console.error('[notifications] sendToToken error:', err);
    }
  }
}

// ─── Notificar nuevo mensaje ───────────────────────────────────
export async function notifyNewMessage(
  lazoId: string,
  senderId: string,
  messagePreview: string,
): Promise<void> {
  try {
    // Obtener el FCM token del compañero
    const result = await db.query(
      `SELECT u.fcm_token, u.username as sender_username
       FROM lazos l
       JOIN users u ON u.id = CASE WHEN l.user1_id = $2 THEN l.user2_id ELSE l.user1_id END
       JOIN users sender ON sender.id = $2
       WHERE l.id = $1 AND l.is_active = TRUE`,
      [lazoId, senderId],
    );

    if (result.rows.length === 0 || !result.rows[0].fcm_token) { return; }

    const { fcm_token, sender_username } = result.rows[0];
    const preview = messagePreview.length > 60
      ? messagePreview.slice(0, 60) + '…'
      : messagePreview;

    await sendToToken(
      fcm_token,
      sender_username,
      preview,
      { type: 'message', lazoId },
    );
  } catch (err) {
    console.error('[notifications] notifyNewMessage error:', err);
  }
}

// ─── Notificar riego mutuo ─────────────────────────────────────
export async function notifyWatering(
  lazoId: string,
  wateredByUserId: string,
  justStreaked: boolean,
): Promise<void> {
  try {
    const result = await db.query(
      `SELECT u.fcm_token, u.username as sender_username
       FROM lazos l
       JOIN users u ON u.id = CASE WHEN l.user1_id = $2 THEN l.user2_id ELSE l.user1_id END
       JOIN users sender ON sender.id = $2
       WHERE l.id = $1 AND l.is_active = TRUE`,
      [lazoId, wateredByUserId],
    );

    if (result.rows.length === 0 || !result.rows[0].fcm_token) { return; }

    const { fcm_token, sender_username } = result.rows[0];
    const title = justStreaked ? '🌱 ¡Racha aumentada!' : `${sender_username} regó la planta`;
    const body = justStreaked
      ? `${sender_username} también regó. ¡Su lazo sigue creciendo!`
      : 'Riega tú también para mantener la racha viva.';

    await sendToToken(fcm_token, title, body, { type: 'watering', lazoId });
  } catch (err) {
    console.error('[notifications] notifyWatering error:', err);
  }
}

// ─── Recordatorios diarios ─────────────────────────────────────
export async function sendDailyWateringReminders(): Promise<void> {
  try {
    // Usuarios que AÚN no han regado hoy en lazos activos no muertos
    const result = await db.query(
      `SELECT DISTINCT u.fcm_token
       FROM lazos l
       JOIN users u ON (u.id = l.user1_id OR u.id = l.user2_id)
       WHERE l.is_active = TRUE
         AND l.plant_phase != 'dead'
         AND u.fcm_token IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM daily_watering dw
           WHERE dw.lazo_id = l.id AND dw.user_id = u.id AND dw.watered_on = CURRENT_DATE
         )`,
    );

    console.log(`[notifications] Enviando ${result.rows.length} recordatorios de riego`);

    for (const row of result.rows) {
      await sendToToken(
        row.fcm_token,
        '🌿 ¡No olvides regar!',
        'Tu planta necesita agua hoy para mantener la racha.',
        { type: 'reminder' },
      );
    }
  } catch (err) {
    console.error('[notifications] sendDailyWateringReminders error:', err);
  }
}
