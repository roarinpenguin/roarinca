import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';

const storageDir = process.env.STORAGE_DIR || '/data';
const csrDir = path.join(storageDir, 'csr');

function ensureCsrDir() {
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  if (!fs.existsSync(csrDir)) {
    fs.mkdirSync(csrDir, { recursive: true });
  }
}

function runOpenSSL(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: '/bin/sh' }, (error, stdout, stderr) => {
      if (error) {
        console.error('OpenSSL error:', stderr || error.message);
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// Preset configurations for different certificate types
const PRESETS = {
  server_tls: {
    keyUsage: 'critical,digitalSignature,keyEncipherment',
    extKeyUsage: 'serverAuth',
    basicConstraints: 'CA:FALSE',
  },
  client_tls: {
    keyUsage: 'critical,digitalSignature',
    extKeyUsage: 'clientAuth',
    basicConstraints: 'CA:FALSE',
  },
  code_signing: {
    keyUsage: 'critical,digitalSignature',
    extKeyUsage: 'codeSigning',
    basicConstraints: 'CA:FALSE',
  },
};

function buildSubject(data) {
  const parts = [];
  if (data.country) parts.push(`/C=${data.country}`);
  if (data.state) parts.push(`/ST=${data.state}`);
  if (data.locality) parts.push(`/L=${data.locality}`);
  if (data.organization) parts.push(`/O=${data.organization}`);
  if (data.organizational_unit) parts.push(`/OU=${data.organizational_unit}`);
  if (data.common_name) parts.push(`/CN=${data.common_name}`);
  if (data.email) parts.push(`/emailAddress=${data.email}`);
  return parts.join('');
}

function buildSanConfig(san, preset) {
  const presetConfig = PRESETS[preset] || PRESETS.server_tls;
  let config = `[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = placeholder

[v3_req]
basicConstraints = ${presetConfig.basicConstraints}
keyUsage = ${presetConfig.keyUsage}
extendedKeyUsage = ${presetConfig.extKeyUsage}
`;

  if (san && san.trim()) {
    const sanEntries = san.split(',').map((s) => s.trim()).filter(Boolean);
    if (sanEntries.length > 0) {
      config += 'subjectAltName = @alt_names\n\n[alt_names]\n';
      let dnsCount = 1;
      let ipCount = 1;
      let emailCount = 1;

      for (let entry of sanEntries) {
        // Handle explicit prefixes (DNS:, IP:, email: or DNS=, IP=, email=) - strip them and use the specified type
        const lowerEntry = entry.toLowerCase();
        
        if (lowerEntry.startsWith('dns:') || lowerEntry.startsWith('dns=')) {
          const value = entry.substring(4).trim();
          if (value) {
            config += `DNS.${dnsCount} = ${value}\n`;
            dnsCount++;
          }
        } else if (lowerEntry.startsWith('ip:') || lowerEntry.startsWith('ip=')) {
          const value = entry.substring(3).trim();
          if (value) {
            config += `IP.${ipCount} = ${value}\n`;
            ipCount++;
          }
        } else if (lowerEntry.startsWith('email:') || lowerEntry.startsWith('email=')) {
          const value = entry.substring(6).trim();
          if (value) {
            config += `email.${emailCount} = ${value}\n`;
            emailCount++;
          }
        }
        // Auto-detect type if no prefix
        else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(entry)) {
          // IPv4 address
          config += `IP.${ipCount} = ${entry}\n`;
          ipCount++;
        } else if (/^[0-9a-fA-F:]+$/.test(entry) && entry.includes(':')) {
          // IPv6 address
          config += `IP.${ipCount} = ${entry}\n`;
          ipCount++;
        } else if (entry.includes('@')) {
          config += `email.${emailCount} = ${entry}\n`;
          emailCount++;
        } else {
          // Default to DNS
          config += `DNS.${dnsCount} = ${entry}\n`;
          dnsCount++;
        }
      }
    }
  }

  return config;
}

export function registerCsrRoutes(app, authMiddleware) {
  // Create a new CSR
  app.post('/api/csr', authMiddleware, async (req, res) => {
    ensureCsrDir();

    const {
      preset = 'server_tls',
      common_name,
      organization,
      organizational_unit,
      country,
      state,
      locality,
      email,
      san,
      key_type = 'RSA',
      key_size = 2048,
    } = req.body || {};

    if (!common_name) {
      return res.status(400).json({ error: 'Common Name is required' });
    }

    if (!PRESETS[preset]) {
      return res.status(400).json({ error: 'Invalid preset. Use server_tls, client_tls, or code_signing' });
    }

    const timestamp = Date.now();
    const keyPath = path.join(csrDir, `${timestamp}.key.pem`);
    const csrPath = path.join(csrDir, `${timestamp}.csr.pem`);
    const configPath = path.join(csrDir, `${timestamp}.cnf`);

    try {
      // Build subject
      const subject = buildSubject({
        common_name,
        organization,
        organizational_unit,
        country,
        state,
        locality,
        email,
      });

      // Generate OpenSSL config for extensions
      const config = buildSanConfig(san, preset);
      fs.writeFileSync(configPath, config);

      // Generate private key
      await runOpenSSL(`openssl genrsa -out "${keyPath}" ${key_size}`);

      // Generate CSR with extensions
      await runOpenSSL(
        `openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "${subject}" -config "${configPath}" -reqexts v3_req`
      );

      // Read generated files
      const csrPem = fs.readFileSync(csrPath, 'utf8');
      const keyPem = fs.readFileSync(keyPath, 'utf8');

      // Clean up temp files
      fs.unlinkSync(configPath);

      // Store in database
      db.run(
        `INSERT INTO csr_requests (preset, common_name, organization, organizational_unit, country, state, locality, email, san, key_type, key_size, csr_pem, key_pem, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          preset,
          common_name,
          organization || '',
          organizational_unit || '',
          country || '',
          state || '',
          locality || '',
          email || '',
          san || '',
          key_type,
          key_size,
          csrPem,
          keyPem,
        ],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to save CSR', details: err.message });
          }
          return res.json({
            ok: true,
            id: this.lastID,
            csr_pem: csrPem,
          });
        }
      );
    } catch (e) {
      // Clean up on error
      [keyPath, csrPath, configPath].forEach((p) => {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      });
      return res.status(500).json({ error: 'Failed to generate CSR', details: e.message });
    }
  });

  // List all CSRs
  app.get('/api/csr', authMiddleware, (req, res) => {
    db.all(
      `SELECT id, preset, common_name, organization, organizational_unit, country, state, locality, email, san, key_type, key_size, status, created_at
       FROM csr_requests ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch CSRs' });
        }
        return res.json({ csrs: rows || [] });
      }
    );
  });

  // Get single CSR details
  app.get('/api/csr/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get(
      `SELECT id, preset, common_name, organization, organizational_unit, country, state, locality, email, san, key_type, key_size, csr_pem, status, created_at
       FROM csr_requests WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch CSR' });
        }
        if (!row) {
          return res.status(404).json({ error: 'CSR not found' });
        }
        return res.json({ csr: row });
      }
    );
  });

  // Download CSR PEM
  app.get('/api/csr/:id/download/csr', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get('SELECT common_name, csr_pem FROM csr_requests WHERE id = ?', [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'CSR not found' });
      }
      const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.csr.pem`;
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(row.csr_pem);
    });
  });

  // Download private key PEM
  app.get('/api/csr/:id/download/key', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get('SELECT common_name, key_pem FROM csr_requests WHERE id = ?', [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'CSR not found' });
      }
      const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.key.pem`;
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(row.key_pem);
    });
  });

  // Delete CSR
  app.delete('/api/csr/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM csr_requests WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete CSR' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'CSR not found' });
      }
      return res.json({ ok: true });
    });
  });
}
