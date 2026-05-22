const express = require('express');
const { Pool } = require('pg');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Database ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Generate a random session secret at startup
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const activeSessions = new Map(); // token -> expiry

function createSession() {
  const token = crypto.randomBytes(48).toString('hex');
  // Session lasts 24 hours
  activeSessions.set(token, Date.now() + 24 * 60 * 60 * 1000);
  return token;
}

function isValidSession(token) {
  if (!token || !activeSessions.has(token)) return false;
  if (Date.now() > activeSessions.get(token)) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

// --- Auth middleware ---
function requireAuth(req, res, next) {
  const sessionToken = req.cookies?.session;
  if (isValidSession(sessionToken)) {
    return next();
  }
  // For API routes, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // For page routes, redirect to login
  return res.redirect('/login');
}

// --- Login routes ---
app.get('/login', (req, res) => {
  const sessionToken = req.cookies?.session;
  if (isValidSession(sessionToken)) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { token } = req.body;
  const accessToken = process.env.ACCESS_TOKEN;

  if (!accessToken) {
    return res.status(500).json({ error: 'ACCESS_TOKEN not configured on server' });
  }

  if (token === accessToken) {
    const sessionToken = createSession();
    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    return res.json({ success: true });
  }

  return res.status(403).json({ error: 'Invalid access token' });
});

app.post('/api/logout', (req, res) => {
  const sessionToken = req.cookies?.session;
  if (sessionToken) activeSessions.delete(sessionToken);
  res.clearCookie('session');
  res.json({ success: true });
});

// --- Protected API routes ---
app.get('/api/runs', requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000);
    const level = req.query.level; // optional filter
    const account = req.query.account; // optional filter

    let query = `SELECT id, run_id, timestamp, level, title, platform, username, message, points_data
                 FROM run_logs`;
    const params = [];
    const conditions = [];

    if (level && ['info', 'warn', 'error'].includes(level)) {
      params.push(level);
      conditions.push(`level = $${params.length}`);
    }
    if (account) {
      params.push(account);
      conditions.push(`username = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching runs:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT email, type, updated_at
       FROM sessions
       ORDER BY email, type`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    // Get summary statistics
    const [runsResult, pointsResult, lastRunResult, accountsResult, errorsResult] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT run_id) as total_runs FROM run_logs`),
      pool.query(`SELECT COALESCE(SUM((points_data->>'collectedPoints')::int), 0) as total_points FROM run_logs WHERE points_data IS NOT NULL AND points_data->>'collectedPoints' IS NOT NULL`),
      pool.query(`SELECT MAX(timestamp) as last_run FROM run_logs`),
      pool.query(`SELECT COUNT(DISTINCT email) as active_accounts FROM sessions`),
      pool.query(`SELECT COUNT(*) as error_count FROM run_logs WHERE level = 'error' AND timestamp > NOW() - INTERVAL '24 hours'`),
    ]);

    res.json({
      totalRuns: parseInt(runsResult.rows[0]?.total_runs || 0),
      totalPoints: parseInt(pointsResult.rows[0]?.total_points || 0),
      lastRun: lastRunResult.rows[0]?.last_run || null,
      activeAccounts: parseInt(accountsResult.rows[0]?.active_accounts || 0),
      recentErrors: parseInt(errorsResult.rows[0]?.error_count || 0),
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// --- Serve static files (protected) ---
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use('/style.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.use('/favicon.ico', (req, res) => res.status(204).end());

// Protect all other static assets
app.use(requireAuth, express.static(path.join(__dirname, 'public')));

// --- Start ---
app.listen(PORT, () => {
  console.log(`✨ Rewards Dashboard running on port ${PORT}`);
});
