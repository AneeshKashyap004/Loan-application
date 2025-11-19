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
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Serve uploaded files
const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }
app.use('/uploads', express.static(uploadsDir));

// Helpers
function nowIso() { return new Date().toISOString(); }
async function resolveDoc(value) {
  if (!value) return value;
  const v = String(value);
  if (/^https?:\/\//i.test(v)) return v; // already a URL (maybe signed)
  // treat as S3 key
  try { return await getSignedUrl(v, 3600); } catch { return v; }
}
async function mapDocs(row) {
  if (!row) return row;
  const out = { ...row };
  if (out.docs) out.docs = await resolveDoc(out.docs);
  if (out.docUrl) out.docUrl = await resolveDoc(out.docUrl);
  return out;
}

// Customers
app.get('/api/customers', async (req, res) => {
  const rows = await listCollection('customers');
  rows.sort((a,b) => Number(b.id) - Number(a.id));
  const out = await Promise.all(rows.map(mapDocs));
  res.json(out);
});

app.get('/api/customers/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const query = String(q).toLowerCase();
  const rows = await listCollection('customers');
  const filtered = rows.filter(c =>
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
  const autoNumber = req.body?.autoNumber ? String(req.body.autoNumber) : await generateCustomerAutoNumber();
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
  else rows = loans.filter(l => [String(cust.autoNumber), String(cust.id)].includes(String(l.customerId)) || (cust.vehicleNumber && String(l.vehicleNumber) === String(cust.vehicleNumber)));
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
  const filtered = rows.filter(r => r.loanDate >= s && r.loanDate <= e).sort((a,b)=>String(b.loanDate).localeCompare(String(a.loanDate)));
  const out = await Promise.all(filtered.map(mapDocs));
  res.json(out);
});

app.post('/api/loans', async (req, res) => {
  const { vehicleNumber, customerId, customerName, customerPhone, dealer, amount, emiAmount, tenure, loanDate, dueDay, hoa, paymentMode, remarks, status, alternateContacts, docs, loanType } = req.body || {};
  if (!vehicleNumber || amount == null || tenure == null || !loanDate || !paymentMode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const normalizedVeh = String(vehicleNumber).replace(/\s+/g, '').toUpperCase();
  const prefix = String(loanType || 'EMI').toUpperCase() === 'INT' ? 'INT' : 'EMI';
  const loanCode = `${prefix}${normalizedVeh}`;
  const id = String(await nextId('loanApplications'));
  const row = {
    id: Number(id), vehicleNumber, customerId: customerId || null, customerName: customerName || null, customerPhone: customerPhone || null,
    dealer: dealer ?? '', amount: Number(amount), emiAmount: (emiAmount == null ? null : Number(emiAmount)), tenure: Number(tenure), loanDate,
    dueDay: (dueDay == null ? null : Number(dueDay)), hoa: hoa || null, loanCode, paymentMode, remarks: remarks || null, alternateContacts: alternateContacts || null,
    status: status || null, createdAt: nowIso()
  };
  await putItem('loanApplications', id, row);
  // Update customers.docs if docs provided
  if (docs) {
    try {
      const customers = await listCollection('customers');
      const cust = customers.find(c => String(c.id) === String(customerId) || String(c.autoNumber) === String(customerId) || (c.vehicleNumber && String(c.vehicleNumber).replace(/\s+/g,'').toUpperCase() === normalizedVeh));
      if (cust) {
        await updateItem('customers', String(cust.id), { docs: String(docs) });
      }
    } catch {}
  }
  res.status(201).json(row);
});

// Repayments
app.get('/api/repayments', async (req, res) => {
  const rows = await listCollection('repayments');
  rows.sort((a,b)=>Number(b.id)-Number(a.id));
  const out = await Promise.all(rows.map(mapDocs));
  res.json(out);
});

app.get('/api/repayments/customer/:customerId', async (req, res) => {
  const key = String(req.params.customerId);
  const customers = await listCollection('customers');
  const cust = customers.find(c => String(c.id) === key || String(c.autoNumber) === key);
  const reps = await listCollection('repayments');
  let rows;
  if (!cust) rows = reps.filter(r => String(r.customerId) === key);
  else rows = reps.filter(r => [String(cust.autoNumber), String(cust.id)].includes(String(r.customerId)) || (cust.vehicleNumber && String(r.vehicleNumber) === String(cust.vehicleNumber)));
  rows.sort((a,b)=>Number(b.id)-Number(a.id));
  res.json(rows);
});

app.get('/api/repayments/due-today', async (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = today.toISOString();
  const end = new Date(today.getTime() + 24*60*60*1000).toISOString();
  const rows = await listCollection('repayments');
  const filtered = rows.filter(r => r.dueDate >= start && r.dueDate < end && Number(r.isPaid) === 0).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const out = await Promise.all(filtered.map(mapDocs));
  res.json(out);
});

app.get('/api/repayments/overdue', async (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = today.toISOString();
  const rows = await listCollection('repayments');
  const filtered = rows.filter(r => r.dueDate < start && Number(r.isPaid) === 0).sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const out = await Promise.all(filtered.map(mapDocs));
  res.json(out);
});

app.get('/api/repayments/range', async (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
  const rows = await listCollection('repayments');
  const s = new Date(start).toISOString();
  const e = new Date(end).toISOString();
  const filtered = rows.filter(r => r.dueDate >= s && r.dueDate <= e).sort((a,b)=>String(b.dueDate).localeCompare(String(a.dueDate)));
  const out = await Promise.all(filtered.map(mapDocs));
  res.json(out);
});

app.post('/api/repayments', async (req, res) => {
  const { vehicleNumber, customerId, customerName, contact, loanId, dueDate, dueAmount, fine = 0, paidAmount = 0, pendingAmount = 0, remarks, docUrl } = req.body || {};
  if (!vehicleNumber || !customerName || !contact || !dueDate || dueAmount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const isPaid = Number(pendingAmount) === 0 ? 1 : 0;
  const id = String(await nextId('repayments'));
  const row = {
    id: Number(id), vehicleNumber, customerId: customerId || null, customerName, contact, loanId: loanId || null, dueDate,
    dueAmount: Number(dueAmount), fine: Number(fine), paidAmount: Number(paidAmount), pendingAmount: Number(pendingAmount), isPaid,
    docUrl: docUrl || null, remarks: remarks || null, createdAt: nowIso()
  };
  await putItem('repayments', id, row);
  // Auto-close loan
  if (loanId) {
    try {
      const reps = await listCollection('repayments');
      const totals = reps.filter(r => String(r.loanId) === String(loanId)).reduce((a,b)=>a+Number(b.paidAmount||0),0);
      const loan = await getItem('loanApplications', String(loanId));
      if (loan && Number(totals) >= Number(loan.amount)) {
        await updateItem('loanApplications', String(loanId), { status: 'Closed' });
      }
    } catch {}
  }
  res.status(201).json(row);
});

// Update repayment
app.put('/api/repayments/:id', async (req, res) => {
  const id = String(req.params.id);
  const allowed = ['vehicleNumber','customerId','customerName','contact','loanId','dueDate','dueAmount','fine','paidAmount','pendingAmount','isPaid','remarks'];
  const payload = req.body || {};
  const keys = Object.keys(payload).filter(k => allowed.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  if (payload.pendingAmount != null && payload.isPaid == null) {
    payload.isPaid = Number(payload.pendingAmount) === 0 ? 1 : 0;
  }
  const updated = await updateItem('repayments', id, payload);
  if (!updated) return res.status(404).json({ error: 'Repayment not found' });
  res.json(updated);
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Base64 upload endpoint
app.post('/api/uploads', async (req, res) => {
  const { filename, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename and data (base64) required' });
  try {
    const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const ts = Date.now();
    const key = `uploads/${ts}_${safeName}`;
    const match = String(data).match(/^data:([^;]+);base64,/);
    const contentType = match ? match[1] : 'application/octet-stream';
    await putBase64Object(key, data, contentType);
    const signedUrl = await getSignedUrl(key, 3600);
    res.json({ url: signedUrl, key });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// Redirect to a fresh signed URL for a stored S3 key
app.get('/api/uploads/signed', async (req, res) => {
  try {
    const key = String(req.query.key || '');
    if (!key) return res.status(400).json({ error: 'key required' });
    const url = await getSignedUrl(key, 3600);
    // Redirect so that <a href> works seamlessly
    return res.redirect(302, url);
  } catch (e) {
    return res.status(404).json({ error: 'Could not sign URL' });
  }
});

// Serve frontend build (Vite) if present
const moduleDir = path.dirname(new URL(import.meta.url).pathname);
const distCandidates = [
  path.resolve(process.cwd(), 'dist'),
  path.resolve(moduleDir, '..', 'dist'), // if running from server/
];
const clientDir = distCandidates.find(p => fs.existsSync(p));
if (clientDir) {
  console.log('Serving static from', clientDir);
  // Serve hashed assets with long cache
  app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }));
  // Root and other static files
  app.get('/', (req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  app.use(express.static(clientDir));
  // SPA fallback for HTML navigations only
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    const hasExt = /\.[a-zA-Z0-9]+$/.test(req.path);
    if (wantsHtml && !hasExt) {
      return res.sendFile(path.join(clientDir, 'index.html'));
    }
    return res.status(404).end();
  });
} else {
  console.warn('dist/ not found—UI will not be served');
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
