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
    for (const k of allowed) {
      if (payload[k] != null) updates[k] = payload[k];
    }
    if (updates.documentVerified != null) {
      updates.documentVerified = updates.documentVerified ? 1 : 0;
    }
    if (updates.vehicleNumber != null) {
      updates.vehicleNumber = String(updates.vehicleNumber || '');
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    const updated = await updateItem('customers', String(target.id), updates);
    return res.json(await mapDocs(updated));
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update customer' });
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
  const { vehicleNumber, customerId, customerName, contact, loanId, dueDate, dueAmount, fine = 0, paidAmount = 0, pendingAmount = null, remarks, docUrl } = req.body || {};
  if (!vehicleNumber || !customerName || !contact || !dueDate) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Carryforward logic when loanId present: compute base EMI and missed months up to dueDate
  let computedDueAmount = (dueAmount == null ? 0 : Number(dueAmount));
  let carryMultiplier = 1;
  try {
    if (loanId) {
      const loan = await getItem('loanApplications', String(loanId));
      if (loan) {
        const baseEmi = (loan.emiAmount != null && loan.emiAmount !== '')
          ? Number(loan.emiAmount)
          : (loan.amount && loan.tenure ? Number(loan.amount) / Number(loan.tenure || 1) : null);
        if (baseEmi != null && isFinite(baseEmi) && loan.loanDate && dueDate) {
          const due = new Date(dueDate);
          // Build set of paid months up to due month inclusive
          const reps = await listCollection('repayments');
          const paidSet = new Set(
            reps.filter(r => String(r.loanId) === String(loanId)).map(r => {
              const d = new Date(r.dueDate);
              return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
            })
          );
          const loanStart = new Date(loan.loanDate);
          // First EMI is due in the month AFTER loan date
          const firstDueYear = loanStart.getUTCFullYear() + Math.floor((loanStart.getUTCMonth()+1)/12);
          const firstDueMonth = (loanStart.getUTCMonth()+1) % 12; // 0-11
          const fromYear = firstDueYear;
          const fromMonth = firstDueMonth;
          const toYear = due.getUTCFullYear();
          const toMonth = due.getUTCMonth();
          const diff = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
          let missed = 0;
          if (diff > 0) {
            for (let i = 0; i < diff; i++) {
              const y = fromYear + Math.floor((fromMonth + i) / 12);
              const m = (fromMonth + i) % 12;
              const key = `${y}-${String(m+1).padStart(2,'0')}`;
              if (!paidSet.has(key)) missed++;
            }
          }
          carryMultiplier = Math.max(1, missed);
          computedDueAmount = Math.round(baseEmi * carryMultiplier);
        }
      }
    }
  } catch {}

  // Determine pending if not provided
  const fineNum = Number(fine) || 0;
  const paidNum = Number(paidAmount) || 0;
  const pendingComputed = computedDueAmount + fineNum - paidNum;
  const pendingFinal = (pendingAmount == null ? pendingComputed : Number(pendingAmount));
  const isPaid = Number(pendingFinal) === 0 ? 1 : 0;
  const id = String(await nextId('repayments'));
  const row = {
    id: Number(id), vehicleNumber, customerId: customerId || null, customerName, contact, loanId: loanId || null, dueDate,
    dueAmount: Number(computedDueAmount), fine: Number(fineNum), paidAmount: Number(paidNum), pendingAmount: Number(pendingFinal), isPaid,
    docUrl: docUrl || null,
    remarks: (() => {
      const base = remarks || '';
      if (loanId && carryMultiplier > 1) {
        const tag = '(past emi included)';
        return base && String(base).trim() ? `${base} ${tag}` : tag;
      }
      return base || null;
    })(),
    createdAt: nowIso()
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
  // Append remarks with timestamp if provided, instead of overwriting
  if (payload.remarks != null) {
    try {
      const existing = await getItem('repayments', id);
      const ts = new Date().toISOString();
      const newLine = `[${ts}] ${String(payload.remarks)}`;
      if (existing && existing.remarks && String(existing.remarks).trim() && String(existing.remarks) !== String(payload.remarks)) {
        payload.remarks = String(existing.remarks).trim() + '\n' + newLine;
      } else {
        payload.remarks = newLine;
      }
    } catch {}
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

// Start server with basic port fallback if default port is busy.
// If PORT env is explicitly set, we do not fallback and surface the error.
function startServer(port, attemptsLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
  server.on('error', (err) => {
    // Only attempt fallback when using the default port (i.e., no explicit PORT env)
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
