import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'loan.db');
if (fs.existsSync(dbPath)) {
  fs.rmSync(dbPath);
}

const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
if (fs.existsSync(uploadsDir)) {
  for (const name of fs.readdirSync(uploadsDir)) {
    const p = path.join(uploadsDir, name);
    try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

console.log('Database and uploads cleared.');
