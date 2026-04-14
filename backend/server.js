require('dotenv').config();
const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dbParams = {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || ''
};

let pool;

async function initDB() {
    console.log('Connecting to MySQL...');
    const connection = await mysql.createConnection(dbParams);
    const dbName = process.env.DB_NAME || 'gantt_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.end();

    pool = mysql.createPool({ ...dbParams, database: dbName });

    // ── Gantt tasks ─────────────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tasks (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            name          VARCHAR(255) NOT NULL,
            start         INT NOT NULL,
            duration      INT NOT NULL,
            color         VARCHAR(50) DEFAULT '#4f46e5',
            source_card_id INT DEFAULT NULL
        )
    `);
    // Migration: add source_card_id if missing
    try { await pool.query('ALTER TABLE tasks ADD COLUMN source_card_id INT DEFAULT NULL'); }
    catch { /* column already exists */ }

    // ── Departments ──────────────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS departments (
            id    INT AUTO_INCREMENT PRIMARY KEY,
            name  VARCHAR(100) UNIQUE NOT NULL,
            color VARCHAR(50) DEFAULT '#6366f1'
        )
    `);
    // Seed default departments
    const [[{ dCount }]] = await pool.query('SELECT COUNT(*) AS dCount FROM departments');
    if (dCount === 0) {
        const depts = [
            ['Sistemas',       '#3ddc84'],
            ['Administración', '#818cf8'],
            ['Ventas',         '#f97316'],
            ['Producción',     '#f59e0b'],
            ['Dirección',      '#06b6d4'],
        ];
        for (const [name, color] of depts)
            await pool.query('INSERT INTO departments (name, color) VALUES (?, ?)', [name, color]);
        console.log('✅ Default departments created');
    }

    // ── Users ────────────────────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            name            VARCHAR(100) NOT NULL,
            email           VARCHAR(150) UNIQUE NOT NULL,
            password_hash   VARCHAR(255) NOT NULL,
            role            ENUM('admin','member') DEFAULT 'member',
            avatar_color    VARCHAR(50) DEFAULT '#6366f1',
            department_id   INT DEFAULT NULL,
            preferred_theme VARCHAR(30) DEFAULT 'dark',
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
        )
    `);
    // Migrations for existing installations
    try { await pool.query("ALTER TABLE users ADD COLUMN department_id INT DEFAULT NULL"); } catch {}
    try { await pool.query("ALTER TABLE users ADD COLUMN preferred_theme VARCHAR(30) DEFAULT 'dark'"); } catch {}
    try {
        // Add FK only if not already present
        await pool.query("ALTER TABLE users ADD CONSTRAINT fk_user_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL");
    } catch {}

    // ── Kanban columns ───────────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kanban_columns (
            id       INT AUTO_INCREMENT PRIMARY KEY,
            name     VARCHAR(100) NOT NULL,
            color    VARCHAR(50) DEFAULT '#6366f1',
            position INT DEFAULT 0
        )
    `);

    // ── Kanban cards ─────────────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS kanban_cards (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            column_id        INT NOT NULL,
            title            VARCHAR(255) NOT NULL,
            description      TEXT,
            color            VARCHAR(50) DEFAULT '#6366f1',
            assignee_id      INT DEFAULT NULL,
            position         INT DEFAULT 0,
            due_date         DATE DEFAULT NULL,
            promoted_task_id INT DEFAULT NULL,
            created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (column_id)   REFERENCES kanban_columns(id) ON DELETE CASCADE,
            FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);

    // ── Calendar events ──────────────────────────────────────────────
    await pool.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            title          VARCHAR(255) NOT NULL,
            description    TEXT,
            start_datetime DATETIME NOT NULL,
            end_datetime   DATETIME,
            color          VARCHAR(50) DEFAULT '#6366f1',
            assignee_id    INT DEFAULT NULL,
            priority       ENUM('baja', 'media', 'alta') DEFAULT 'media',
            created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
        )
    `);
    
    // Migration: add priority if missing
    try { await pool.query("ALTER TABLE calendar_events ADD COLUMN priority ENUM('baja', 'media', 'alta') DEFAULT 'media'"); }
    catch { /* column already exists */ }

    // ── Seed: admin user ─────────────────────────────────────────────
    const [[{ uCount }]] = await pool.query('SELECT COUNT(*) AS uCount FROM users');
    if (uCount === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        const [[sistDept]] = await pool.query("SELECT id FROM departments WHERE name = 'Sistemas' LIMIT 1");
        await pool.query(
            'INSERT INTO users (name, email, password_hash, role, avatar_color, department_id, preferred_theme) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['Admin', 'admin@helix.local', hash, 'admin', '#6366f1', sistDept?.id ?? null, 'dark-emerald']
        );
        console.log('✅ Admin created → admin@helix.local / admin123');
    }

    // ── Seed: default Kanban columns ─────────────────────────────────
    const [[{ cCount }]] = await pool.query('SELECT COUNT(*) AS cCount FROM kanban_columns');
    if (cCount === 0) {
        const defaults = [
            ['Backlog',      '#64748b', 0],
            ['Por hacer',    '#3b82f6', 1],
            ['En progreso',  '#f59e0b', 2],
            ['Hecho',        '#22c55e', 3],
        ];
        for (const [name, color, pos] of defaults) {
            await pool.query('INSERT INTO kanban_columns (name, color, position) VALUES (?, ?, ?)', [name, color, pos]);
        }
        console.log('✅ Default Kanban columns created');
    }

    console.log('✅ Database initialized');
}

async function start() {
    try {
        await initDB();
        app.use('/auth',        require('./routes/auth')(pool));
        app.use('/users',       require('./routes/users')(pool));
        app.use('/departments', require('./routes/departments')(pool));
        app.use('/tasks',       require('./routes/tasks')(pool));
        app.use('/kanban',      require('./routes/kanban')(pool));
        app.use('/calendar',    require('./routes/calendar')(pool));
        app.listen(port, () => console.log(`🚀 Helix backend → http://localhost:${port}`));
    } catch (err) {
        console.error('Startup failed:', err);
        process.exit(1);
    }
}

start();
