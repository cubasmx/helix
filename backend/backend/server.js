const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const port = 3000;

// Enable CORS so the frontend can access the API
app.use(cors());
app.use(express.json());

// Database connection parameters
// Using the host IP and the exposed MySQL port
const dbParams = {
    host: '10.10.2.63',
    port: 3307,
    user: 'root',
    password: 'admin_pass_123'
};

let pool;

async function initDB() {
    try {
        console.log("Connecting to MySQL...");
        // Connect without database selected to create it if necessary
        const connection = await mysql.createConnection(dbParams);
        await connection.query("CREATE DATABASE IF NOT EXISTS gantt_db;");
        await connection.end();

        // Now create a connection pool connected to the new database
        pool = mysql.createPool({ ...dbParams, database: 'gantt_db' });

        // Create tasks table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                start INT NOT NULL,
                duration INT NOT NULL,
                color VARCHAR(50) DEFAULT '#4f46e5'
            )
        `;
        await pool.query(createTableQuery);
        console.log("Database and tasks table initialized successfully");
    } catch (error) {
        console.error("Database initialization failed:", error);
    }
}

// Get all tasks
app.get('/tasks', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM tasks');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create task
app.post('/tasks', async (req, res) => {
    const { name, start, duration, color } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO tasks (name, start, duration, color) VALUES (?, ?, ?, ?)',
            [name, start, duration, color || '#4f46e5']
        );
        res.status(201).json({ id: result.insertId, name, start, duration, color });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete task
app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM tasks WHERE id = ?', [id]);
        res.json({ message: 'Task deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update task completely or partially (e.g. for color change)
app.put('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    const { name, start, duration, color } = req.body;
    try {
        // Find existing task to allow partial updates
        const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        const task = rows[0];
        const newName = name !== undefined ? name : task.name;
        const newStart = start !== undefined ? start : task.start;
        const newDuration = duration !== undefined ? duration : task.duration;
        const newColor = color !== undefined ? color : task.color;

        await pool.query(
            'UPDATE tasks SET name = ?, start = ?, duration = ?, color = ? WHERE id = ?',
            [newName, newStart, newDuration, newColor, id]
        );
        res.json({ message: 'Task updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, async () => {
    await initDB();
    console.log(`Gantt backend listening at http://localhost:${port}`);
});
