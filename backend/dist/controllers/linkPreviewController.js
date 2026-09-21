"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLinkPreview = getLinkPreview;
const node_html_parser_1 = require("node-html-parser");
const database_1 = require("../config/database");
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 1024 * 1024; // 1MB
const CACHE_TTL_DAYS = 7;
const BOT_UA = 'facebookexternalhit/1.1'; // desbloquea OG tags de TikTok/Instagram
// ─── Anti-SSRF: rechazar localhost / IPs privadas ──────────────
function isPrivateHost(hostname) {
    const h = hostname.toLowerCase();
    if (!h) {
        return true;
    }
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) {
        return true;
    }
    // IPv6 literales: conservador, se bloquean todos
    if (h.includes(':')) {
        return true;
    }
    const parts = h.split('.');
    if (parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p))) {
        const [a, b] = parts.map(Number);
        if (a === 0 || a === 10 || a === 127) {
            return true;
        }
        if (a === 172 && b >= 16 && b <= 31) {
            return true;
        }
        if (a === 192 && b === 168) {
            return true;
        }
        if (a === 169 && b === 254) {
            return true;
        }
    }
    return false;
}
// ─── Embeds internos (TikTok / YouTube) ────────────────────────
function extractEmbed(resolvedUrl) {
    try {
        const u = new URL(resolvedUrl);
        const host = u.hostname.replace(/^www\./, '');
        if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
            const m = u.pathname.match(/\/video\/(\d+)/) || u.pathname.match(/^\/(?:v|embed)\/(\d+)/);
            if (m) {
                return { provider: 'tiktok', videoId: m[1] };
            }
        }
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            const v = u.searchParams.get('v');
            if (v) {
                return { provider: 'youtube', videoId: v };
            }
            const m = u.pathname.match(/^\/embed\/([\w-]+)/);
            if (m) {
                return { provider: 'youtube', videoId: m[1] };
            }
        }
        if (host === 'youtu.be') {
            const m = u.pathname.match(/^\/([\w-]+)/);
            if (m) {
                return { provider: 'youtube', videoId: m[1] };
            }
        }
    }
    catch { /* URL inválida → sin embed */ }
    return null;
}
// ─── Parsear OpenGraph del HTML ────────────────────────────────
function parseOgTags(html) {
    const root = (0, node_html_parser_1.parse)(html);
    const metas = root.querySelectorAll('meta');
    const getOg = (prop) => {
        for (const m of metas) {
            const key = (m.getAttribute('property') ?? m.getAttribute('name') ?? '').toLowerCase();
            if (key === prop) {
                const content = m.getAttribute('content');
                if (content && content.trim()) {
                    return content.trim();
                }
            }
        }
        return null;
    };
    let title = getOg('og:title');
    if (!title) {
        const t = root.querySelector('title');
        title = t?.text?.trim() || null;
    }
    return {
        title,
        description: getOg('og:description'),
        imageUrl: getOg('og:image'),
        siteName: getOg('og:site_name'),
    };
}
// ─── GET /api/lazos/:id/link-preview?url=... ───────────────────
async function getLinkPreview(req, res) {
    try {
        const userId = req.userId;
        const lazoId = req.params.id;
        const rawUrl = req.query.url ?? '';
        if (!userId) {
            res.status(401).json({ message: 'No autorizado' });
            return;
        }
        // Verificar membresía del lazo
        const membership = await database_1.db.query(`SELECT 1 FROM lazos WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`, [lazoId, userId]);
        if (membership.rows.length === 0) {
            res.status(403).json({ message: 'No tienes acceso a este lazo' });
            return;
        }
        // Validar URL: solo http(s), no localhost/IPs privadas
        let parsed;
        try {
            parsed = new URL(rawUrl);
        }
        catch {
            res.status(400).json({ message: 'URL inválida' });
            return;
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            res.status(400).json({ message: 'Solo se permiten URLs http(s)' });
            return;
        }
        if (isPrivateHost(parsed.hostname)) {
            res.status(400).json({ message: 'URL no permitida' });
            return;
        }
        // Cache hit (< 7 días) → responder sin scrapear
        const cache = await database_1.db.query(`SELECT * FROM link_previews
       WHERE url = $1 AND fetched_at > NOW() - ($2 || ' days')::interval`, [rawUrl, String(CACHE_TTL_DAYS)]);
        if (cache.rows.length > 0) {
            const row = cache.rows[0];
            res.json({
                found: true,
                title: row.title,
                description: row.description,
                imageUrl: row.image_url,
                siteName: row.site_name,
                resolvedUrl: row.resolved_url ?? rawUrl,
                embed: row.resolved_url ? extractEmbed(row.resolved_url) : null,
            });
            return;
        }
        // Scrapear con timeout, siguiendo redirects (links cortos vm.tiktok.com)
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        let html;
        let resolvedUrl = rawUrl;
        try {
            const response = await fetch(rawUrl, {
                redirect: 'follow',
                signal: controller.signal,
                headers: { 'User-Agent': BOT_UA, Accept: 'text/html' },
            });
            resolvedUrl = response.url || rawUrl;
            if (!response.ok) {
                res.json({ found: false });
                return;
            }
            html = await response.text();
        }
        catch {
            res.json({ found: false });
            return;
        }
        finally {
            clearTimeout(timer);
        }
        if (html.length > MAX_HTML_BYTES) {
            html = html.slice(0, MAX_HTML_BYTES);
        }
        const og = parseOgTags(html);
        if (!og.title && !og.imageUrl) {
            // Nada útil que guardar: responder sin cachear para reintentar después
            res.json({ found: false });
            return;
        }
        // Persistir en cache (upsert)
        await database_1.db.query(`INSERT INTO link_previews (url, title, description, image_url, site_name, resolved_url, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (url) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         image_url = EXCLUDED.image_url,
         site_name = EXCLUDED.site_name,
         resolved_url = EXCLUDED.resolved_url,
         fetched_at = NOW()`, [rawUrl, og.title, og.description, og.imageUrl, og.siteName, resolvedUrl]);
        res.json({
            found: true,
            title: og.title,
            description: og.description,
            imageUrl: og.imageUrl,
            siteName: og.siteName,
            resolvedUrl,
            embed: extractEmbed(resolvedUrl),
        });
    }
    catch (err) {
        console.error('[lazos/link-preview]', err);
        res.status(500).json({ message: 'Error obteniendo preview' });
    }
}
