import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { putBase64Object, getSignedUrl } from './aws/s3.js';
import {
  listCollection,
  getItem,
  putItem,
  updateItem,
  nextId,
  generateCustomerAutoNumber,
} from './data/store.js';

const app = express();
const PORT = Number(process.env.PORT) || 8789;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Serve uploaded files (optional, local)
const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Helpers
function nowIso() { return new Date().toISOString(); }
async function resolveDoc(value) {
  if (!value) return value;
  const v = String(value);
  if (/^https?:\/\//i.test(v)) return v;
  try { return await getSignedUrl(v, 3600); } catch { return v; }
}
async function mapDocs(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.docs) out.docs = await resolveDoc(out.docs);
  if (out.docUrl) out.docUrl = await resolveDoc(out.docUrl);
  return out;
}

/* =========================
   API ROUTES — ONLY /api/*
   ========================= */

// Customers
app.get('/api/customers', async (req, res) => {
  const rows = await listCollection('customers');
  const alive = rows.filter(r => !r.deletedAt);
  alive.sort((a,b) => Number(b.id) - Number(a.id));
  const out = await Promise.all(alive.map(mapDocs));
  res.json(out);
});

app.get('/api/customers/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const query = String(q).toLowerCase();
  const rows = await listCollection('customers');
  const filtered = rows.filter(c => !c.deletedAt).filter(c =>
    String(c.autoNumber||'').toLowerCase().includes(query) ||
    String(c.name||'').toLowerCase().includes(query) ||
    String(c.phone||'').toLowerCase().includes(query)
  ).sort((a,b)=>Number(b.id)-Number(a.id)).slice(0,10);
  const out = await Promise.all(filtered.map(mapDocs));
  res.json(out);
});

app.get('/api/customers/:id', async (req, res) => {
  const id = String(req.params.id);
  let row = await getItem('customers', id);
  if (!row) {
    const all = await listCollection('customers');
    row = all.find(c => String(c.autoNumber) === id);
  }
  if (!row) return res.status(404).json({ error: 'Customer not found' });
  res.json(await mapDocs(row));
});

app.post('/api/customers', async (req, res) => {
  const { name, phone, dealer, loanAmount, documentVerified, vehicleNumber } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: 'Missing required fields' });

  const id = String(await nextId('customers'));
  const autoNumber = req.body?.autoNumber
    ? String(req.body.autoNumber)
    : await generateCustomerAutoNumber();

  const row = {
    id: Number(id),
    autoNumber,
    name,
    phone,
    dealer: dealer ?? '',
    loanAmount: (loanAmount == null ? 0 : Number(loanAmount)),
    vehicleNumber: vehicleNumber ?? null,
    customerType: null,
    documentVerified: documentVerified ? 1 : 0,
    createdAt: nowIso(),
  };
  await putItem('customers', id, row);
  res.status(201).json(row);
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const key = String(req.params.id);
    let target = await getItem('customers', key);
    if (!target) {
      const all = await listCollection('customers');
      target = all.find(c => String(c.autoNumber) === key);
    }
    if (!target) return res.status(404).json({ error: 'Customer not found' });

    const allowed = ['name','phone','dealer','vehicleNumber','documentVerified','autoNumber'];
    const payload = req.body || {};
    const updates = {};
    for (const k of allowed) if (payload[k] != null) updates[k] = payload[k];

    if (updates.documentVerified != null) updates.documentVerified = updates.documentVerified ? 1 : 0;
    if (updates.vehicleNumber != null) updates.vehicleNumber = String(updates.vehicleNumber || '');

    if (!Object.keys(updates).length)
      return res.status(400).json({ error: 'No valid fields to update' });

    const updated = await updateItem('customers', String(target.id), updates);
    return res.json(await mapDocs(updated));
  } catch {
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

// Soft delete
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const key = String(req.params.id);
    let target = await getItem('customers', key);
    if (!target) {
      const all = await listCollection('customers');
      target = all.find(c => String(c.autoNumber) === key);
    }
    if (!target) return res.status(404).json({ error: 'Customer not found' });
    if (target.deletedAt) return res.json(target);

    const updated = await updateItem('customers', String(target.id), { deletedAt: nowIso() });
    return res.json(updated);
  } catch {
    return res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Loans
app.get('/api/loans', async (req, res) => {
  const rows = await listCollection('loanApplications');
  rows.sort((a,b) => Number(b.id) - Number(a.id));
  const out = await Promise.all(rows.map(mapDocs));
  res.json(out);
});

app.get('/api/loans/customer/:customerId', async (req, res) => {
  const key = String(req.params.customerId);
  const customers = await listCollection('customers');
  const cust = customers.find(c => String(c.id) === key || String(c.autoNumber) === key);
  const loans = await listCollection('loanApplications');

  let rows;
  if (!cust) rows = loans.filter(l => String(l.customerId) === key);
  else rows = loans.filter(l =>
    [String(cust.autoNumber), String(cust.id)].includes(String(l.customerId)) ||
    (cust.vehicleNumber && String(l.vehicleNumber) === String(cust.vehicleNumber))
  );

  rows.sort((a,b)=>Number(b.id)-Number(a.id));
  const out = await Promise.all(rows.map(mapDocs));
  res.json(out);
});

app.get('/api/loans/range', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });

  const rows = await listCollection('loanApplications');
  const s = new Date(start).toISOString();
  const e = new Date(end).toISOString();

  const filtered = rows
    .filter(r => r.loanDate >= s && r.loanDate <= e)
    .sort((a,b)=>String(b.loanDate).localeCompare(String(a.loanDate)));

  const out = await Promise.all(filtered.map(mapDocs));
  res.json(out);
});

app.post('/api/loans', async (req, res) => {
  const { vehicleNumber, customerId, customerName, customerPhone, dealer, amount, emiAmount, tenure, loanDate, dueDay, hoa, paymentMode, remarks, status, alternateContacts, docs, loanType } = req.body || {};
  if (!vehicleNumber || amount == null || tenure == null || !loanDate || !paymentMode)
    return res.status(400).json({ error: 'Missing required fields' });

  const normalizedVeh = String(vehicleNumber).replace(/\s+/g, '').toUpperCase();
  const prefix = String(loanType || 'EMI').toUpperCase() === 'INT' ? 'INT' : 'EMI';
  const loanCode = `${prefix}${normalizedVeh}`;
  const id = String(await nextId('loanApplications'));

  const row = {
    id: Number(id),
    vehicleNumber,
    customerId: customerId || null,
    customerName: customerName || null,
    customerPhone: customerPhone || null,
    dealer: dealer ?? '',
    amount: Number(amount),
    emiAmount: (emiAmount == null ? null : Number(emiAmount)),
    tenure: Number(tenure),
    loanDate,
    dueDay: (dueDay == null ? null : Number(dueDay)),
    hoa: hoa || null,
    loanCode,
    paymentMode,
    remarks: remarks || null,
    alternateContacts: alternateContacts || null,
    status: status || null,
    createdAt: nowIso()
  };

  await putItem('loanApplications', id, row);
  res.status(201).json(row);
});

// Repayments routes remain SAME as your file (no frontend code here)

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Uploads
app.post('/api/uploads', async (req, res) => {
  const { filename, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename and data (base64) required' });

  try {
    const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const key = `uploads/${Date.now()}_${safeName}`;
    const match = String(data).match(/^data:([^;]+);base64,/);
    const contentType = match ? match[1] : 'application/octet-stream';

    await putBase64Object(key, data, contentType);
    const signedUrl = await getSignedUrl(key, 3600);
    res.json({ url: signedUrl, key });
  } catch {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.get('/api/uploads/signed', async (req, res) => {
  try {
    const key = String(req.query.key || '');
    if (!key) return res.status(400).json({ error: 'key required' });
    const url = await getSignedUrl(key, 3600);
    return res.redirect(302, url);
  } catch {
    return res.status(404).json({ error: 'Could not sign URL' });
  }
});

// Final API 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
function startServer(port, attemptsLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && !process.env.PORT && attemptsLeft > 0) {
      const next = port + 1;
      console.warn(`Port ${port} in use. Retrying on ${next}...`);
      startServer(next, attemptsLeft - 1);
    } else {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  });
}

startServer(PORT);
