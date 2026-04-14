const router = require('express').Router();
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
    // GET /departments — public (needed for selects)
    router.get('/', async (req, res) => {
        try {
            const [rows] = await pool.query('SELECT * FROM departments ORDER BY name');
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /departments — admin only
    router.post('/', auth, adminOnly, async (req, res) => {
        const { name, color = '#6366f1' } = req.body;
        if (!name) return res.status(400).json({ error: 'Nombre requerido' });
        try {
            const [result] = await pool.query(
                'INSERT INTO departments (name, color) VALUES (?, ?)',
                [name, color]
            );
            res.status(201).json({ id: result.insertId, name, color });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Departamento ya existe' });
            res.status(500).json({ error: e.message });
        }
    });

    // PUT /departments/:id — admin only
    router.put('/:id', auth, adminOnly, async (req, res) => {
        const { id } = req.params;
        const { name, color } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
            const d = rows[0];
            await pool.query(
                'UPDATE departments SET name=?, color=? WHERE id=?',
                [name ?? d.name, color ?? d.color, id]
            );
            res.json({ message: 'Actualizado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /departments/:id — admin only
    router.delete('/:id', auth, adminOnly, async (req, res) => {
        const { id } = req.params;
        try {
            // Unlink users from this department before deleting
            await pool.query('UPDATE users SET department_id = NULL WHERE department_id = ?', [id]);
            await pool.query('DELETE FROM departments WHERE id = ?', [id]);
            res.json({ message: 'Departamento eliminado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
