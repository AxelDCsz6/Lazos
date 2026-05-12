"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleReaction = toggleReaction;
const database_1 = require("../config/database");
// ─── POST /api/lazos/:id/messages/:messageId/react ────────────
// Toggle: si ya existe la reacción la elimina, si no la crea
async function toggleReaction(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            res.status(401).json({ message: 'No autorizado' });
            return;
        }
        const { id: lazoId, messageId } = req.params;
        const { type = 'heart' } = req.body;
        // Verify message belongs to this lazo and user has access
        const msgCheck = await database_1.db.query(`SELECT m.id FROM messages m
       JOIN lazos l ON l.id = m.lazo_id
       WHERE m.id = $1 AND m.lazo_id = $2
         AND (l.user1_id = $3 OR l.user2_id = $3) AND l.is_active = TRUE`, [messageId, lazoId, userId]);
        if (msgCheck.rows.length === 0) {
            res.status(404).json({ message: 'Mensaje no encontrado' });
            return;
        }
        // Check if reaction already exists
        const existing = await database_1.db.query(`SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND type = $3`, [messageId, userId, type]);
        let added;
        if (existing.rows.length > 0) {
            await database_1.db.query(`DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND type = $3`, [messageId, userId, type]);
            added = false;
        }
        else {
            await database_1.db.query(`INSERT INTO reactions (message_id, user_id, type) VALUES ($1, $2, $3)`, [messageId, userId, type]);
            added = true;
        }
        // Return updated reactions for this message
        const reactionsResult = await database_1.db.query(`SELECT user_id AS "userId", type FROM reactions WHERE message_id = $1`, [messageId]);
        res.json({ added, reactions: reactionsResult.rows });
    }
    catch (err) {
        console.error('[reactions/toggle]', err);
        res.status(500).json({ message: 'Error procesando reacción' });
    }
}
