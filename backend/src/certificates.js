import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './db.js';

const storageDir = process.env.STORAGE_DIR || '/data';
const caDir = path.join(storageDir, 'ca');
const certsDir = path.join(storageDir, 'certs');
const caKeyPath = path.join(caDir, 'ca.key.pem');
const caCertPath = path.join(caDir, 'ca.cert.pem');

function ensureCertsDir() {
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
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

function generateSerialNumber() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

// Parse certificate details using OpenSSL
async function parseCertificate(certPem) {
  const tmpPath = path.join(storageDir, `tmp_${Date.now()}.pem`);
  fs.writeFileSync(tmpPath, certPem);

  try {
    const subject = await runOpenSSL(`openssl x509 -in "${tmpPath}" -noout -subject -nameopt RFC2253`);
    const issuer = await runOpenSSL(`openssl x509 -in "${tmpPath}" -noout -issuer -nameopt RFC2253`);
    const serial = await runOpenSSL(`openssl x509 -in "${tmpPath}" -noout -serial`);
    const dates = await runOpenSSL(`openssl x509 -in "${tmpPath}" -noout -dates`);

    // Parse dates
    const notBeforeMatch = dates.match(/notBefore=(.+)/);
    const notAfterMatch = dates.match(/notAfter=(.+)/);

    // Extract CN from subject
    const cnMatch = subject.match(/CN=([^,]+)/);
    const commonName = cnMatch ? cnMatch[1] : 'Unknown';

    fs.unlinkSync(tmpPath);

    return {
      common_name: commonName,
      subject: subject.replace('subject=', '').trim(),
      issuer: issuer.replace('issuer=', '').trim(),
      serial_number: serial.replace('serial=', '').trim(),
      not_before: notBeforeMatch ? notBeforeMatch[1].trim() : null,
      not_after: notAfterMatch ? notAfterMatch[1].trim() : null,
    };
  } catch (e) {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    throw e;
  }
}

// Preset configurations for signing
const PRESETS = {
  server_tls: {
    keyUsage: 'critical,digitalSignature,keyEncipherment',
    extKeyUsage: 'serverAuth',
    basicConstraints: 'critical,CA:FALSE',
  },
  client_tls: {
    keyUsage: 'critical,digitalSignature',
    extKeyUsage: 'clientAuth',
    basicConstraints: 'critical,CA:FALSE',
  },
  code_signing: {
    keyUsage: 'critical,digitalSignature',
    extKeyUsage: 'codeSigning',
    basicConstraints: 'critical,CA:FALSE',
  },
};

function buildExtConfig(preset, san) {
  const presetConfig = PRESETS[preset] || PRESETS.server_tls;
  let config = `basicConstraints = ${presetConfig.basicConstraints}
keyUsage = ${presetConfig.keyUsage}
extendedKeyUsage = ${presetConfig.extKeyUsage}
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
`;

  if (san && san.trim()) {
    const sanEntries = san.split(',').map((s) => s.trim()).filter(Boolean);
    if (sanEntries.length > 0) {
      const sanParts = [];
      for (const entry of sanEntries) {
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(entry) || entry.includes(':')) {
          sanParts.push(`IP:${entry}`);
        } else if (entry.includes('@')) {
          sanParts.push(`email:${entry}`);
        } else {
          sanParts.push(`DNS:${entry}`);
        }
      }
      config += `subjectAltName = ${sanParts.join(',')}\n`;
    }
  }

  return config;
}

export function registerCertRoutes(app, authMiddleware) {
  // List all certificates
  app.get('/api/certificates', authMiddleware, (req, res) => {
    db.all(
      `SELECT id, csr_id, common_name, serial_number, issuer, subject, not_before, not_after, source, created_at
       FROM certificates ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch certificates' });
        }
        return res.json({ certificates: rows || [] });
      }
    );
  });

  // Get single certificate details
  app.get('/api/certificates/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get(
      `SELECT id, csr_id, common_name, serial_number, issuer, subject, not_before, not_after, cert_pem, source, created_at
       FROM certificates WHERE id = ?`,
      [id],
      (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to fetch certificate' });
        }
        if (!row) {
          return res.status(404).json({ error: 'Certificate not found' });
        }
        return res.json({ certificate: row });
      }
    );
  });

  // Import an existing certificate
  app.post('/api/certificates/import', authMiddleware, async (req, res) => {
    const { cert_pem, key_pem, chain_pem } = req.body || {};

    if (!cert_pem) {
      return res.status(400).json({ error: 'Certificate PEM is required' });
    }

    try {
      const certInfo = await parseCertificate(cert_pem);

      db.run(
        `INSERT INTO certificates (common_name, serial_number, issuer, subject, not_before, not_after, cert_pem, key_pem, chain_pem, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported')`,
        [
          certInfo.common_name,
          certInfo.serial_number,
          certInfo.issuer,
          certInfo.subject,
          certInfo.not_before,
          certInfo.not_after,
          cert_pem,
          key_pem || null,
          chain_pem || null,
        ],
        function (err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to import certificate', details: err.message });
          }
          return res.json({
            ok: true,
            id: this.lastID,
            certificate: {
              id: this.lastID,
              ...certInfo,
              source: 'imported',
            },
          });
        }
      );
    } catch (e) {
      return res.status(400).json({ error: 'Invalid certificate PEM', details: e.message });
    }
  });

  // Sign a CSR with the CA
  app.post('/api/certificates/sign/:csrId', authMiddleware, async (req, res) => {
    const { csrId } = req.params;
    const { days = 365 } = req.body || {};

    // Check if CA is initialized
    if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
      return res.status(400).json({ error: 'CA is not initialized. Please initialize the CA first.' });
    }

    // Get the CSR
    db.get('SELECT * FROM csr_requests WHERE id = ?', [csrId], async (err, csr) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch CSR' });
      }
      if (!csr) {
        return res.status(404).json({ error: 'CSR not found' });
      }
      if (csr.status === 'signed') {
        return res.status(400).json({ error: 'CSR has already been signed' });
      }

      ensureCertsDir();

      const timestamp = Date.now();
      const serialNumber = generateSerialNumber();
      const csrPath = path.join(certsDir, `${timestamp}.csr.pem`);
      const certPath = path.join(certsDir, `${timestamp}.cert.pem`);
      const extPath = path.join(certsDir, `${timestamp}.ext`);

      try {
        // Write CSR to temp file
        fs.writeFileSync(csrPath, csr.csr_pem);

        // Build extension config
        const extConfig = buildExtConfig(csr.preset, csr.san);
        fs.writeFileSync(extPath, extConfig);

        // Sign the CSR
        await runOpenSSL(
          `openssl x509 -req -in "${csrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" -set_serial 0x${serialNumber} -days ${days} -sha256 -out "${certPath}" -extfile "${extPath}"`
        );

        // Read the signed certificate
        const certPem = fs.readFileSync(certPath, 'utf8');
        const caCertPem = fs.readFileSync(caCertPath, 'utf8');

        // Parse certificate info
        const certInfo = await parseCertificate(certPem);

        // Clean up temp files
        [csrPath, extPath].forEach((p) => {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        // Store certificate in database
        db.run(
          `INSERT INTO certificates (csr_id, common_name, serial_number, issuer, subject, not_before, not_after, cert_pem, key_pem, chain_pem, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'signed')`,
          [
            csrId,
            certInfo.common_name,
            certInfo.serial_number,
            certInfo.issuer,
            certInfo.subject,
            certInfo.not_before,
            certInfo.not_after,
            certPem,
            csr.key_pem,
            caCertPem,
          ],
          function (insertErr) {
            if (insertErr) {
              return res.status(500).json({ error: 'Failed to save certificate', details: insertErr.message });
            }

            // Update CSR status
            db.run(
              "UPDATE csr_requests SET status = 'signed', updated_at = datetime('now') WHERE id = ?",
              [csrId]
            );

            return res.json({
              ok: true,
              id: this.lastID,
              certificate: {
                id: this.lastID,
                csr_id: csrId,
                ...certInfo,
                cert_pem: certPem,
                source: 'signed',
              },
            });
          }
        );
      } catch (e) {
        // Clean up on error
        [csrPath, certPath, extPath].forEach((p) => {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        });
        return res.status(500).json({ error: 'Failed to sign CSR', details: e.message });
      }
    });
  });

  // Download certificate PEM
  app.get('/api/certificates/:id/download/cert', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get('SELECT common_name, cert_pem FROM certificates WHERE id = ?', [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.cert.pem`;
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(row.cert_pem);
    });
  });

  // Download private key PEM
  app.get('/api/certificates/:id/download/key', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get('SELECT common_name, key_pem FROM certificates WHERE id = ?', [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      if (!row.key_pem) {
        return res.status(404).json({ error: 'Private key not available for this certificate' });
      }
      const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.key.pem`;
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(row.key_pem);
    });
  });

  // Download certificate chain PEM
  app.get('/api/certificates/:id/download/chain', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get('SELECT common_name, chain_pem FROM certificates WHERE id = ?', [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      if (!row.chain_pem) {
        return res.status(404).json({ error: 'Certificate chain not available' });
      }
      const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.chain.pem`;
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(row.chain_pem);
    });
  });

  // Download full chain (cert + CA)
  app.get('/api/certificates/:id/download/fullchain', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.get('SELECT common_name, cert_pem, chain_pem FROM certificates WHERE id = ?', [id], (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      const fullchain = row.cert_pem + (row.chain_pem ? '\n' + row.chain_pem : '');
      const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.fullchain.pem`;
      res.setHeader('Content-Type', 'application/x-pem-file');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(fullchain);
    });
  });

  // Export as PKCS#12
  app.post('/api/certificates/:id/export/pkcs12', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body || {};

    if (!password) {
      return res.status(400).json({ error: 'Password is required for PKCS#12 export' });
    }

    db.get('SELECT common_name, cert_pem, key_pem, chain_pem FROM certificates WHERE id = ?', [id], async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      if (!row.key_pem) {
        return res.status(400).json({ error: 'Private key not available for PKCS#12 export' });
      }

      ensureCertsDir();

      const timestamp = Date.now();
      const certPath = path.join(certsDir, `${timestamp}.cert.pem`);
      const keyPath = path.join(certsDir, `${timestamp}.key.pem`);
      const chainPath = path.join(certsDir, `${timestamp}.chain.pem`);
      const p12Path = path.join(certsDir, `${timestamp}.p12`);

      try {
        fs.writeFileSync(certPath, row.cert_pem);
        fs.writeFileSync(keyPath, row.key_pem);

        let chainArg = '';
        if (row.chain_pem) {
          fs.writeFileSync(chainPath, row.chain_pem);
          chainArg = `-certfile "${chainPath}"`;
        }

        // Create PKCS#12 file
        await runOpenSSL(
          `openssl pkcs12 -export -out "${p12Path}" -inkey "${keyPath}" -in "${certPath}" ${chainArg} -passout pass:"${password.replace(/"/g, '\\"')}"`
        );

        const p12Data = fs.readFileSync(p12Path);

        // Clean up
        [certPath, keyPath, chainPath, p12Path].forEach((p) => {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        const filename = `${row.common_name.replace(/[^a-zA-Z0-9.-]/g, '_')}.p12`;
        res.setHeader('Content-Type', 'application/x-pkcs12');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.send(p12Data);
      } catch (e) {
        // Clean up on error
        [certPath, keyPath, chainPath, p12Path].forEach((p) => {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        });
        return res.status(500).json({ error: 'Failed to create PKCS#12', details: e.message });
      }
    });
  });

  // Delete certificate
  app.delete('/api/certificates/:id', authMiddleware, (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM certificates WHERE id = ?', [id], function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete certificate' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Certificate not found' });
      }
      return res.json({ ok: true });
    });
  });

  // Download CA certificate (public, no auth required for chain building)
  app.get('/api/ca/cert', (req, res) => {
    if (!fs.existsSync(caCertPath)) {
      return res.status(404).json({ error: 'CA certificate not found. Initialize the CA first.' });
    }
    const caCert = fs.readFileSync(caCertPath, 'utf8');
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="ca.cert.pem"');
    return res.send(caCert);
  });
}
