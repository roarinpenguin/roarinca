import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db, initDb } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_USERNAME = 'ca_admin';
const ADMIN_PASSWORD = process.env.CA_ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  // eslint-disable-next-line no-console
  console.warn('CA_ADMIN_PASSWORD is not set. Set it in docker-compose or environment before running in production.');
}

export function seedAdminUser() {
  initDb();

  if (!ADMIN_PASSWORD) {
    return;
  }

  db.get('SELECT id FROM users WHERE username = ?', [ADMIN_USERNAME], async (err, row) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('Error checking admin user:', err);
      return;
    }

    if (row) {
      return;
    }

    try {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
      db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [ADMIN_USERNAME, hash], (insertErr) => {
        if (insertErr) {
          // eslint-disable-next-line no-console
          console.error('Error creating admin user:', insertErr);
        } else {
          // eslint-disable-next-line no-console
          console.log('Admin user ca_admin created');
        }
      });
    } catch (hashErr) {
      // eslint-disable-next-line no-console
      console.error('Error hashing admin password:', hashErr);
    }
  });
}

export function createToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function authMiddleware(req, res, next) {
  const token = req.cookies && req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function registerAuthRoutes(app) {
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Internal error' });
      }

      if (!row) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const match = await bcrypt.compare(password, row.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = createToken({ id: row.id, username: row.username });

      res
        .cookie('token', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 8 * 60 * 60 * 1000,
        })
        .json({ ok: true, username: row.username });
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token').json({ ok: true });
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ user: { id: req.user.id, username: req.user.username } });
  });
}
