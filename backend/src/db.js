import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'certui.db');

sqlite3.verbose();

export const db = new sqlite3.Database(dbPath);

export function initDb() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ca_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      common_name TEXT,
      organization TEXT,
      organizational_unit TEXT,
      country TEXT,
      state TEXT,
      locality TEXT,
      key_type TEXT,
      key_size INTEGER,
      initialized INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS csr_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preset TEXT NOT NULL,
      common_name TEXT NOT NULL,
      organization TEXT,
      organizational_unit TEXT,
      country TEXT,
      state TEXT,
      locality TEXT,
      email TEXT,
      san TEXT,
      key_type TEXT DEFAULT 'RSA',
      key_size INTEGER DEFAULT 2048,
      csr_pem TEXT,
      key_pem TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      csr_id INTEGER,
      common_name TEXT NOT NULL,
      serial_number TEXT,
      issuer TEXT,
      subject TEXT,
      not_before TEXT,
      not_after TEXT,
      cert_pem TEXT NOT NULL,
      key_pem TEXT,
      chain_pem TEXT,
      source TEXT DEFAULT 'signed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (csr_id) REFERENCES csr_requests(id)
    )`);
  });
}
