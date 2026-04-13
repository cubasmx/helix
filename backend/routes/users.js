const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
    // GET /users — list all (for assignment dropdowns)
    router.get('/', auth, async (req, res) => {
        try {
            const [rows] = await pool.query(
                'SELECT id, name, email, role, avatar_color FROM users ORDER BY name'
            );
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /users — create (admin only)
    router.post('/', auth, adminOnly, async (req, res) => {
        const { name, email, password, role = 'member', avatar_color = '#6366f1' } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
        try {
            const hash = await bcrypt.hash(password, 10);
            const [result] = await pool.query(
                'INSERT INTO users (name, email, password_hash, role, avatar_color) VALUES (?, ?, ?, ?, ?)',
                [name, email.toLowerCase(), hash, role, avatar_color]
            );
            res.status(201).json({ id: result.insertId, name, email, role, avatar_color });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El email ya existe' });
            res.status(500).json({ error: e.message });
        }
    });

    // PUT /users/:id — update (admin only)
    router.put('/:id', auth, adminOnly, async (req, res) => {
        const { id } = req.params;
        const { name, email, role, avatar_color, password } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
            const u = rows[0];
            const hash = password ? await bcrypt.hash(password, 10) : u.password_hash;
            await pool.query(
                'UPDATE users SET name=?, email=?, role=?, avatar_color=?, password_hash=? WHERE id=?',
                [name ?? u.name, email?.toLowerCase() ?? u.email, role ?? u.role, avatar_color ?? u.avatar_color, hash, id]
            );
            res.json({ message: 'Usuario actualizado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /users/:id (admin only, can't delete yourself)
    router.delete('/:id', auth, adminOnly, async (req, res) => {
        const { id } = req.params;
        if (parseInt(id) === req.user.id)
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        try {
            await pool.query('DELETE FROM users WHERE id = ?', [id]);
            res.json({ message: 'Usuario eliminado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
