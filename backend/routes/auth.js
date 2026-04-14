const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { auth, JWT_SECRET } = require('../middleware/auth');

module.exports = (pool) => {
    // POST /auth/login
    router.post('/login', async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
        try {
            const [rows] = await pool.query(`
                SELECT u.*, d.name AS department_name, d.color AS department_color
                FROM users u
                LEFT JOIN departments d ON u.department_id = d.id
                WHERE u.email = ?
            `, [email.toLowerCase()]);
            if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });
            const user = rows[0];
            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });
            const payload = {
                id:               user.id,
                name:             user.name,
                email:            user.email,
                role:             user.role,
                avatar_color:     user.avatar_color,
                department_id:    user.department_id,
                department_name:  user.department_name,
                department_color: user.department_color,
                preferred_theme:  user.preferred_theme || 'dark',
            };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, user: payload });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // GET /auth/me
    router.get('/me', auth, (req, res) => res.json(req.user));

    return router;
};
