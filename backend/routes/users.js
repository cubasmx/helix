const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { auth, adminOnly } = require('../middleware/auth');

module.exports = (pool) => {
    // GET /users — list all with department info
    router.get('/', async (req, res) => {
        try {
            const [rows] = await pool.query(`
                SELECT u.id, u.name, u.email, u.role, u.avatar_color,
                       u.department_id, u.preferred_theme,
                       d.name AS department_name, d.color AS department_color
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                ORDER BY u.name
            `);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // POST /users — create
    router.post('/', async (req, res) => {
        const { name, email, password, role = 'member', avatar_color = '#6366f1',
                department_id = null, preferred_theme = 'dark' } = req.body;
        if (!name || !email || !password)
            return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
        try {
            const hash = await bcrypt.hash(password, 10);
            const [result] = await pool.query(
                'INSERT INTO users (name, email, password_hash, role, avatar_color, department_id, preferred_theme) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [name, email.toLowerCase(), hash, role, avatar_color, department_id || null, preferred_theme]
            );
            res.status(201).json({ id: result.insertId, name, email, role, avatar_color, department_id, preferred_theme });
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El email ya existe' });
            res.status(500).json({ error: e.message });
        }
    });

    // PUT /users/:id — update full profile
    router.put('/:id', async (req, res) => {
        const { id } = req.params;
        const { name, email, role, avatar_color, password, department_id, preferred_theme } = req.body;
        try {
            const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
            if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
            const u = rows[0];
            const hash = password ? await bcrypt.hash(password, 10) : u.password_hash;
            await pool.query(
                'UPDATE users SET name=?, email=?, role=?, avatar_color=?, password_hash=?, department_id=?, preferred_theme=? WHERE id=?',
                [
                    name ?? u.name,
                    email?.toLowerCase() ?? u.email,
                    role ?? u.role,
                    avatar_color ?? u.avatar_color,
                    hash,
                    department_id !== undefined ? (department_id || null) : u.department_id,
                    preferred_theme ?? u.preferred_theme,
                    id
                ]
            );
            res.json({ message: 'Usuario actualizado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // PATCH /users/:id/theme — lightweight theme save (called on every theme change)
    router.patch('/:id/theme', auth, async (req, res) => {
        const { id } = req.params;
        const { theme } = req.body;
        if (!theme) return res.status(400).json({ error: 'theme requerido' });
        // Only the user themselves or an admin can change their theme
        if (req.user.id != id && req.user.role !== 'admin')
            return res.status(403).json({ error: 'Sin permiso' });
        try {
            await pool.query('UPDATE users SET preferred_theme=? WHERE id=?', [theme, id]);
            res.json({ message: 'Tema guardado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // DELETE /users/:id
    router.delete('/:id', async (req, res) => {
        const { id } = req.params;
        try {
            await pool.query('DELETE FROM users WHERE id = ?', [id]);
            res.json({ message: 'Usuario eliminado' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
};
