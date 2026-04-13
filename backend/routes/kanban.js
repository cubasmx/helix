const router = require('express').Router();
const { auth } = require('../middleware/auth');

module.exports = (pool) => {
    // GET /kanban/columns — columns with their cards
    router.get('/columns', auth, async (req, res) => {
        try {
            const [columns] = await pool.query('SELECT * FROM kanban_columns ORDER BY position');
            const [cards] = await pool.query(`
                SELECT k.*, u.name AS assignee_name, u.avatar_color AS assignee_color
                FROM kanban_cards k
                LEFT JOIN users u ON k.assignee_id = u.id
                ORDER BY k.position
            `);
            const result = columns.map(col => ({
                ...col,
                cards: cards.filter(c => c.column_id === col.id)
            }));
            res.json(result);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /kanban/columns
    router.post('/columns', auth, async (req, res) => {
        const { name, color = '#6366f1' } = req.body;
        try {
            const [[{ maxPos }]] = await pool.query(
                'SELECT COALESCE(MAX(position), -1) AS maxPos FROM kanban_columns'
            );
            const [result] = await pool.query(
                'INSERT INTO kanban_columns (name, color, position) VALUES (?, ?, ?)',
                [name, color, maxPos + 1]
            );
            res.status(201).json({ id: result.insertId, name, color, position: maxPos + 1, cards: [] });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PUT /kanban/columns/:id
    router.put('/columns/:id', auth, async (req, res) => {
        const { id } = req.params;
        const { name, color } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM kanban_columns WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Columna no encontrada' });
            const col = rows[0];
            await pool.query('UPDATE kanban_columns SET name=?, color=? WHERE id=?',
                [name ?? col.name, color ?? col.color, id]);
            res.json({ message: 'Columna actualizada' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PUT /kanban/columns-reorder
    router.put('/columns-reorder', auth, async (req, res) => {
        const { order } = req.body; // array of column IDs in new order
        try {
            for (let i = 0; i < order.length; i++) {
                await pool.query('UPDATE kanban_columns SET position=? WHERE id=?', [i, order[i]]);
            }
            res.json({ message: 'Columnas reordenadas' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /kanban/columns/:id
    router.delete('/columns/:id', auth, async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM kanban_columns WHERE id = ?', [id]);
            res.json({ message: 'Columna eliminada' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /kanban/cards
    router.post('/cards', auth, async (req, res) => {
        const { column_id, title, description = '', color = '#6366f1', assignee_id = null, due_date = null } = req.body;
        try {
            const [[{ maxPos }]] = await pool.query(
                'SELECT COALESCE(MAX(position), -1) AS maxPos FROM kanban_cards WHERE column_id = ?',
                [column_id]
            );
            const [result] = await pool.query(
                'INSERT INTO kanban_cards (column_id, title, description, color, assignee_id, position, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [column_id, title, description, color, assignee_id, maxPos + 1, due_date]
            );
            const [[card]] = await pool.query(`
                SELECT k.*, u.name AS assignee_name, u.avatar_color AS assignee_color
                FROM kanban_cards k LEFT JOIN users u ON k.assignee_id = u.id
                WHERE k.id = ?
            `, [result.insertId]);
            res.status(201).json(card);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PUT /kanban/cards/:id
    router.put('/cards/:id', auth, async (req, res) => {
        const { id } = req.params;
        const { title, description, color, assignee_id, due_date } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM kanban_cards WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Tarjeta no encontrada' });
            const c = rows[0];
            await pool.query(
                'UPDATE kanban_cards SET title=?, description=?, color=?, assignee_id=?, due_date=? WHERE id=?',
                [
                    title ?? c.title,
                    description ?? c.description,
                    color ?? c.color,
                    assignee_id !== undefined ? assignee_id : c.assignee_id,
                    due_date !== undefined ? due_date : c.due_date,
                    id
                ]
            );
            res.json({ message: 'Tarjeta actualizada' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PUT /kanban/cards/:id/move
    router.put('/cards/:id/move', auth, async (req, res) => {
        const { id } = req.params;
        const { column_id, position } = req.body;
        try {
            await pool.query('UPDATE kanban_cards SET column_id=?, position=? WHERE id=?',
                [column_id, position, id]);
            res.json({ message: 'Tarjeta movida' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /kanban/cards/:id
    router.delete('/cards/:id', auth, async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM kanban_cards WHERE id = ?', [id]);
            res.json({ message: 'Tarjeta eliminada' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
