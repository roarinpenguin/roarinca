import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { seedAdminUser, registerAuthRoutes, authMiddleware } from './auth.js';
import { registerCaRoutes } from './ca.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: true,
  credentials: true,
}));

initDb();
seedAdminUser();

registerAuthRoutes(app);
registerCaRoutes(app, authMiddleware);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// TODO: implement auth, CA settings, CSR, certificates routes

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
