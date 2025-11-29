import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';

const storageDir = process.env.STORAGE_DIR || '/data';
const caDir = path.join(storageDir, 'ca');
const caKeyPath = path.join(caDir, 'ca.key.pem');
const caCertPath = path.join(caDir, 'ca.cert.pem');

function ensureCaDir() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  if (!fs.existsSync(caDir)) {
    fs.mkdirSync(caDir, { recursive: true });
  }
}

function runOpenSSL(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: '/bin/sh' }, (error, stdout, stderr) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('OpenSSL error:', stderr || error.message);
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

export function registerCaRoutes(app, authMiddleware) {
  app.get('/api/ca/settings', authMiddleware, (req, res) => {
    db.get('SELECT * FROM ca_settings WHERE id = 1', (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to load CA settings' });
      }
      const exists = fs.existsSync(caKeyPath) && fs.existsSync(caCertPath);
      const settings = row || {};
      return res.json({
        settings: {
          common_name: settings.common_name || '',
          organization: settings.organization || '',
          organizational_unit: settings.organizational_unit || '',
          country: settings.country || '',
          state: settings.state || '',
          locality: settings.locality || '',
          key_type: settings.key_type || 'RSA',
          key_size: settings.key_size || 2048,
          initialized: exists && settings.initialized === 1,
        },
      });
    });
  });

  app.post('/api/ca/settings', authMiddleware, (req, res) => {
    const {
      common_name,
      organization,
      organizational_unit,
      country,
      state,
      locality,
      key_type = 'RSA',
      key_size = 2048,
    } = req.body || {};

    db.run(
      `INSERT INTO ca_settings (id, common_name, organization, organizational_unit, country, state, locality, key_type, key_size, initialized, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         common_name=excluded.common_name,
         organization=excluded.organization,
         organizational_unit=excluded.organizational_unit,
         country=excluded.country,
         state=excluded.state,
         locality=excluded.locality,
         key_type=excluded.key_type,
         key_size=excluded.key_size,
         updated_at=datetime('now')`,
      [
        common_name || '',
        organization || '',
        organizational_unit || '',
        country || '',
        state || '',
        locality || '',
        key_type || 'RSA',
        Number(key_size) || 2048,
      ],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to save CA settings' });
        }
        return res.json({ ok: true });
      },
    );
  });

  app.post('/api/ca/init', authMiddleware, (req, res) => {
    ensureCaDir();

    db.get('SELECT * FROM ca_settings WHERE id = 1', async (err, settings) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to load CA settings' });
      }
      if (!settings || !settings.common_name) {
        return res.status(400).json({ error: 'CA settings must be saved with at least a Common Name before initialization' });
      }

      const keySize = settings.key_size || 2048;

      const subjectParts = [];
      if (settings.country) subjectParts.push(`/C=${settings.country}`);
      if (settings.state) subjectParts.push(`/ST=${settings.state}`);
      if (settings.locality) subjectParts.push(`/L=${settings.locality}`);
      if (settings.organization) subjectParts.push(`/O=${settings.organization}`);
      if (settings.organizational_unit) subjectParts.push(`/OU=${settings.organizational_unit}`);
      subjectParts.push(`/CN=${settings.common_name}`);
      const subject = subjectParts.join('');

      try {
        await runOpenSSL(`openssl genrsa -out ${caKeyPath} ${keySize}`);

        const days = 3650;
        await runOpenSSL(
          `openssl req -x509 -new -nodes -key ${caKeyPath} -sha256 -days ${days} -out ${caCertPath} -subj "${subject}"`,
        );

        db.run('UPDATE ca_settings SET initialized = 1, updated_at = datetime(\'now\') WHERE id = 1');

        return res.json({ ok: true, key_path: caKeyPath, cert_path: caCertPath });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to initialize CA', details: e.message });
      }
    });
  });
}
