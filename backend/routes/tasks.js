const router = require('express').Router();
const { auth } = require('../middleware/auth');

module.exports = (pool) => {
    function normalizeColor(color, fallback = '#4f46e5') {
        const safe = typeof color === 'string' ? color.trim() : '';
        return /^#[0-9a-fA-F]{6}$/.test(safe) ? safe.toLowerCase() : fallback;
    }

    function parseWeek(value, fallback) {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 53) return fallback;
        return n;
    }

    function parseDuration(value, fallback) {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 53) return fallback;
        return n;
    }

    // GET /tasks
    router.get('/', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM tasks ORDER BY start');
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /tasks
    router.post('/', async (req, res) => {
        const { name, start, duration, color = '#4f46e5', source_card_id = null } = req.body;
        const safeName = typeof name === 'string' ? name.trim() : '';
        const safeStart = parseWeek(start, null);
        const safeDuration = parseDuration(duration, null);
        const safeColor = normalizeColor(color);
        const safeSourceCardId = source_card_id == null ? null : Number(source_card_id);
        if (!safeName) return res.status(400).json({ error: 'Nombre requerido' });
        if (safeStart == null) return res.status(400).json({ error: 'Semana de inicio inválida (1-53)' });
        if (safeDuration == null) return res.status(400).json({ error: 'Duración inválida (1-53)' });
        if (safeSourceCardId !== null && !Number.isInteger(safeSourceCardId)) {
            return res.status(400).json({ error: 'source_card_id inválido' });
        }
        try {
            const [result] = await pool.query(
                'INSERT INTO tasks (name, start, duration, color, source_card_id) VALUES (?, ?, ?, ?, ?)',
                [safeName, safeStart, safeDuration, safeColor, safeSourceCardId]
            );
            res.status(201).json({
                id: result.insertId,
                name: safeName,
                start: safeStart,
                duration: safeDuration,
                color: safeColor,
                source_card_id: safeSourceCardId
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PUT /tasks/:id
    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        const { name, start, duration, color } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Tarea no encontrada' });
            const t = rows[0];
            const safeName = name == null ? t.name : String(name).trim();
            const safeStart = start == null ? t.start : parseWeek(start, null);
            const safeDuration = duration == null ? t.duration : parseDuration(duration, null);
            const safeColor = color == null ? t.color : normalizeColor(color, t.color);
            if (!safeName) return res.status(400).json({ error: 'Nombre requerido' });
            if (safeStart == null) return res.status(400).json({ error: 'Semana de inicio inválida (1-53)' });
            if (safeDuration == null) return res.status(400).json({ error: 'Duración inválida (1-53)' });
            await pool.query(
                'UPDATE tasks SET name=?, start=?, duration=?, color=? WHERE id=?',
                [safeName, safeStart, safeDuration, safeColor, id]
            );
            res.json({ id: Number(id), name: safeName, start: safeStart, duration: safeDuration, color: safeColor });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /tasks/:id
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
            res.json({ message: 'Tarea eliminada' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
