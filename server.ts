import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize SQLite Database
const db = new Database('database.sqlite', { verbose: console.log });

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    role TEXT CHECK(role IN ('USER', 'THERAPIST', 'ADMIN')) DEFAULT 'USER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS therapists (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE,
    specialization TEXT,
    experience_years INTEGER,
    hourly_rate REAL,
    verified BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS availability_slots (
    id TEXT PRIMARY KEY,
    therapist_id TEXT,
    date TEXT,
    start_time TEXT,
    end_time TEXT,
    is_booked BOOLEAN DEFAULT 0,
    FOREIGN KEY(therapist_id) REFERENCES therapists(id)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    therapist_id TEXT,
    slot_id TEXT,
    status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'CANCELLED')) DEFAULT 'PENDING',
    payment_status TEXT CHECK(payment_status IN ('PENDING', 'SUCCESS', 'FAILED')) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(therapist_id) REFERENCES therapists(id),
    FOREIGN KEY(slot_id) REFERENCES availability_slots(id)
  );

  CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    summary TEXT,
    risk_level TEXT CHECK(risk_level IN ('LOW', 'MODERATE', 'HIGH', 'EMERGENCY')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Insert mock data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)');
  insertUser.run('u1', 'John Doe', 'john@example.com', 'USER');
  insertUser.run('t1', 'Dr. Sarah Smith', 'sarah@example.com', 'THERAPIST');
  insertUser.run('a1', 'Admin User', 'admin@example.com', 'ADMIN');

  const insertTherapist = db.prepare('INSERT INTO therapists (id, user_id, specialization, experience_years, hourly_rate, verified) VALUES (?, ?, ?, ?, ?, ?)');
  insertTherapist.run('th1', 't1', 'Clinical Psychology', 10, 150.0, 1);

  const insertSlot = db.prepare('INSERT INTO availability_slots (id, therapist_id, date, start_time, end_time) VALUES (?, ?, ?, ?, ?)');
  insertSlot.run('s1', 'th1', '2026-03-01', '10:00', '11:00');
  insertSlot.run('s2', 'th1', '2026-03-01', '11:00', '12:00');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Users
  app.get('/api/users/:id', (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (user) res.json(user);
    else res.status(404).json({ error: 'User not found' });
  });

  // Therapists
  app.get('/api/therapists', (req, res) => {
    const therapists = db.prepare(`
      SELECT t.*, u.name, u.email 
      FROM therapists t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.verified = 1
    `).all();
    res.json(therapists);
  });

  // Slots
  app.get('/api/therapists/:id/slots', (req, res) => {
    const slots = db.prepare('SELECT * FROM availability_slots WHERE therapist_id = ? AND is_booked = 0').all(req.params.id);
    res.json(slots);
  });

  // Bookings
  app.post('/api/bookings', (req, res) => {
    const { user_id, therapist_id, slot_id } = req.body;
    const id = 'b' + Date.now();

    try {
      db.transaction(() => {
        const slot = db.prepare('SELECT is_booked FROM availability_slots WHERE id = ?').get(slot_id) as any;
        if (slot.is_booked) throw new Error('Slot already booked');

        db.prepare('UPDATE availability_slots SET is_booked = 1 WHERE id = ?').run(slot_id);
        db.prepare('INSERT INTO bookings (id, user_id, therapist_id, slot_id, status) VALUES (?, ?, ?, ?, ?)')
          .run(id, user_id, therapist_id, slot_id, 'CONFIRMED');
      })();
      res.json({ id, status: 'CONFIRMED' });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // AI Sessions
  app.post('/api/ai-sessions', (req, res) => {
    const { user_id, summary, risk_level } = req.body;
    const id = 'ai' + Date.now();
    db.prepare('INSERT INTO ai_chat_sessions (id, user_id, summary, risk_level) VALUES (?, ?, ?, ?)')
      .run(id, user_id, summary, risk_level);
    res.json({ id });
  });

  // Chatbot Integration
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }

      const systemPrompt = `You are a helpful, empathetic, and professional mental health support assistant for "MindTriage". 
Your goal is to provide supportive, helpful responses, check in on user well-being, and clarify what kind of help they might need.
Do NOT attempt to diagnose or treat medical conditions. Encourage users to speak to a licensed therapist on the platform for clinical help.
Keep your responses concise, readable, and highly empathetic.`;

      const nvidiaMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : m.role || 'user',
          content: m.text
        }))
      ];

      if (!process.env.NVIDIA_API_KEY) {
        throw new Error("NVIDIA_API_KEY is not set in the environment variables.");
      }

      const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-70b-instruct',
          messages: nvidiaMessages,
          temperature: 0.7,
          top_p: 1,
          max_tokens: 1024,
          stream: false
        })
      });

      if (!nvidiaRes.ok) {
        throw new Error(`NVIDIA API error: ${nvidiaRes.status} ${nvidiaRes.statusText}`);
      }

      const data = await nvidiaRes.json() as any;
      const responseText = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that.";
      
      const lastUserText = messages[messages.length - 1]?.text?.toLowerCase() || "";
      const isUrgent = lastUserText.match(/\b(suicide|kill|die|harm|emergency|urgent|panic)\b/);

      res.json({ 
        text: responseText, 
        sentiment: isUrgent ? "URGENT" : "NORMAL" 
      });
    } catch (e: any) {
      console.error("Chat API Error:", e);
      res.status(500).json({ error: e.message || 'Failed to process chat' });
    }
  });

  // Predictions
  app.post('/api/predict', (req, res) => {
    import('child_process').then(cp => {
      // Use the python executable from the virtual environment if it exists, otherwise fallback to python3
      const isWin = process.platform === "win32";
      const pythonExe = process.env.NODE_ENV === 'production' ? 'python3' : (isWin ? '.\\venv\\Scripts\\python.exe' : './venv/bin/python');

      const scriptPath = path.join(__dirname, 'api', 'predict.py');
      const inputData = JSON.stringify(req.body);

      // Escape single quotes in JSON string to avoid shell injection
      const escapedInput = inputData.replace(/'/g, "'\\''");

      const cmd = `${pythonExe} ${scriptPath} '${escapedInput}'`;

      cp.exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Prediction error: ${error.message}`);
          return res.status(500).json({ error: 'Failed to run prediction model', details: error.message });
        }
        if (stderr) {
          console.warn(`Prediction stderr: ${stderr}`);
        }

        try {
          // Find the JSON block from output (in case pandas outputs some warning)
          const outputLines = stdout.trim().split('\n');
          const jsonLine = outputLines[outputLines.length - 1]; // We expect the last line to be the JSON prediction
          const result = JSON.parse(jsonLine);

          if (result.error) {
            return res.status(400).json({ error: result.error });
          }

          res.json(result);
        } catch (e) {
          console.error(`Parse output error: ${e.message}`, stdout);
          res.status(500).json({ error: 'Failed to parse prediction result' });
        }
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
