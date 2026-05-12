"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCleanupJob = startCleanupJob;
const database_1 = require("../config/database");
// Elimina códigos expirados o ya usados cada 60 segundos
function startCleanupJob() {
    const run = async () => {
        try {
            const result = await database_1.db.query(`DELETE FROM invite_codes WHERE expires_at <= NOW() OR used = TRUE`);
            if (result.rowCount && result.rowCount > 0) {
                console.log(`[cleanup] ${result.rowCount} código(s) eliminados`);
            }
        }
        catch (err) {
            console.error('[cleanup] Error:', err);
        }
    };
    run();
    setInterval(run, 60 * 1000);
}
