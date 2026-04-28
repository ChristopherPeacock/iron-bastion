import express from 'express';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(join(__dirname)));

const SAVE_FILE = join(__dirname, 'savegame.json');

app.get('/api/save', (req, res) => {
  if (existsSync(SAVE_FILE)) {
    try { res.json(JSON.parse(readFileSync(SAVE_FILE, 'utf8'))); return; } catch {}
  }
  res.json(null);
});

app.post('/api/save', (req, res) => {
  writeFileSync(SAVE_FILE, JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

app.delete('/api/save', (req, res) => {
  if (existsSync(SAVE_FILE)) unlinkSync(SAVE_FILE);
  res.json({ ok: true });
});

app.listen(3000, () => {
  console.log('\n  Iron Bastion running at http://localhost:3000\n');
});
