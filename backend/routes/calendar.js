const router = require('express').Router();

module.exports = (pool) => {
    // GET /calendar/events?month=4&year=2026
    router.get('/events', async (req, res) => {
        const { month, year } = req.query;
        try {
            let query = `
                SELECT e.*, u.name AS assignee_name, u.avatar_color AS assignee_color
                FROM calendar_events e
                LEFT JOIN users u ON e.assignee_id = u.id
            `;
            const params = [];
            if (month && year) {
                query += ' WHERE MONTH(e.start_datetime) = ? AND YEAR(e.start_datetime) = ?';
                params.push(parseInt(month), parseInt(year));
            }
            query += ' ORDER BY e.start_datetime';
            const [rows] = await pool.query(query, params);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /calendar/events
    router.post('/events', async (req, res) => {
        const { title, description = '', start_datetime, end_datetime, color = '#6366f1', assignee_id = null, priority = 'media' } = req.body;
        if (!title || !start_datetime) return res.status(400).json({ error: 'Título y fecha de inicio requeridos' });
        try {
            const [result] = await pool.query(
                'INSERT INTO calendar_events (title, description, start_datetime, end_datetime, color, assignee_id, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [title, description, start_datetime, end_datetime || start_datetime, color, assignee_id, priority]
            );
            res.status(201).json({ id: result.insertId, title, description, start_datetime, end_datetime, color, assignee_id, priority });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PUT /calendar/events/:id
    router.put('/events/:id', async (req, res) => {
        const { id } = req.params;
        const { title, description, start_datetime, end_datetime, color, assignee_id, priority } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM calendar_events WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Evento no encontrado' });
            const ev = rows[0];
            await pool.query(
                'UPDATE calendar_events SET title=?, description=?, start_datetime=?, end_datetime=?, color=?, assignee_id=?, priority=? WHERE id=?',
                [
                    title ?? ev.title,
                    description ?? ev.description,
                    start_datetime ?? ev.start_datetime,
                    end_datetime ?? ev.end_datetime,
                    color ?? ev.color,
                    assignee_id !== undefined ? assignee_id : ev.assignee_id,
                    priority ?? ev.priority,
                    id
                ]
            );
            res.json({ message: 'Evento actualizado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /calendar/events/:id
    router.delete('/events/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM calendar_events WHERE id = ?', [id]);
            res.json({ message: 'Evento eliminado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
