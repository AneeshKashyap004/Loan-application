import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { db, init, migrate } from './db.js';

const app = express();
const PORT = process.env.PORT || 8787;

init();
migrate();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve uploaded files
const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); }
app.use('/uploads', express.static(uploadsDir));

// Helpers
function nowIso() { return new Date().toISOString(); }

// Customers
app.get('/api/customers', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/customers/search', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const query = `%${q}%`;
  const rows = db.prepare(`
    SELECT * FROM customers 
    WHERE autoNumber LIKE ? OR name LIKE ? OR phone LIKE ?
    ORDER BY id DESC LIMIT 10
  `).all(query, query, query);
  res.json(rows);
});

app.get('/api/customers/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ? OR autoNumber = ?').get(req.params.id, req.params.id);
  if (!row) return res.status(404).json({ error: 'Customer not found' });
  res.json(row);
});

app.post('/api/customers', (req, res) => {
  const { name, phone, dealer, loanAmount, documentVerified, vehicleNumber } = req.body || {};
  if (!name || !phone || loanAmount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const autoNumber = (req.body && req.body.autoNumber) ? String(req.body.autoNumber) : null;
  const stmt = db.prepare(`INSERT INTO customers (autoNumber, name, phone, dealer, loanAmount, vehicleNumber, customerType, documentVerified, createdAt)
    VALUES (@autoNumber, @name, @phone, @dealer, @loanAmount, @vehicleNumber, @customerType, @documentVerified, @createdAt)`);
  const info = stmt.run({
    autoNumber,
    name,
    phone,
    dealer: dealer ?? '',
    loanAmount: Number(loanAmount),
    vehicleNumber: vehicleNumber ?? null,
    customerType: null,
    documentVerified: documentVerified ? 1 : 0,
    createdAt: nowIso(),
  });
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Loans
app.get('/api/loans', (req, res) => {
  const rows = db.prepare('SELECT * FROM loanApplications ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/loans/customer/:customerId', (req, res) => {
  const key = req.params.customerId;
  const cust = db.prepare('SELECT * FROM customers WHERE id = ? OR autoNumber = ?').get(key, key);
  if (!cust) {
    const rows = db.prepare('SELECT * FROM loanApplications WHERE customerId = ? ORDER BY id DESC').all(key);
    return res.json(rows);
  }
  const rows = db.prepare(
    'SELECT * FROM loanApplications WHERE customerId IN (?, ?) OR vehicleNumber = ? ORDER BY id DESC'
  ).all(cust.autoNumber, String(cust.id), cust.vehicleNumber || '');
  res.json(rows);
});

app.get('/api/loans/range', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
  const rows = db.prepare('SELECT * FROM loanApplications WHERE loanDate BETWEEN ? AND ? ORDER BY loanDate DESC').all(start, end);
  res.json(rows);
});

app.post('/api/loans', (req, res) => {
  const { vehicleNumber, customerId, customerName, customerPhone, dealer, amount, emiAmount, tenure, loanDate, dueDay, hoa, paymentMode, remarks, status, alternateContacts, docs, loanType } = req.body || {};
  if (!vehicleNumber || amount == null || tenure == null || !loanDate || !paymentMode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const normalizedVeh = String(vehicleNumber).replace(/\s+/g, '').toUpperCase();
  const prefix = String(loanType || 'EMI').toUpperCase() === 'INT' ? 'INT' : 'EMI';
  const loanCode = `${prefix}${normalizedVeh}`;
  const stmt = db.prepare(`INSERT INTO loanApplications (
    vehicleNumber, customerId, customerName, customerPhone, dealer, amount, emiAmount, tenure, loanDate, dueDay, hoa, loanCode, paymentMode, remarks, alternateContacts, status, createdAt
  ) VALUES (@vehicleNumber, @customerId, @customerName, @customerPhone, @dealer, @amount, @emiAmount, @tenure, @loanDate, @dueDay, @hoa, @loanCode, @paymentMode, @remarks, @alternateContacts, @status, @createdAt)`);
  const info = stmt.run({
    vehicleNumber, customerId: customerId || null, customerName: customerName || null, customerPhone: customerPhone || null, dealer: dealer ?? '',
    amount: Number(amount), emiAmount: (emiAmount == null ? null : Number(emiAmount)), tenure: Number(tenure), loanDate, dueDay: (dueDay == null ? null : Number(dueDay)),
    hoa: hoa || null, loanCode, paymentMode, remarks: remarks || null, alternateContacts: alternateContacts || null,
    status: status || null, createdAt: nowIso()
  });
  const row = db.prepare('SELECT * FROM loanApplications WHERE id = ?').get(info.lastInsertRowid);
  // Update customers.docs if docs provided
  if (docs) {
    try {
      const payload = { docs: String(docs), key: String(customerId || ''), veh: String(vehicleNumber || '') };
      const byIdOrAuto = db.prepare('UPDATE customers SET docs = @docs WHERE id = @key OR autoNumber = @key').run(payload);
      if ((byIdOrAuto?.changes || 0) === 0 && payload.veh) {
        db.prepare('UPDATE customers SET docs = @docs WHERE UPPER(REPLACE(vehicleNumber, " ", "")) = UPPER(REPLACE(@veh, " ", ""))').run(payload);
      }
    } catch {}
  }
  res.status(201).json(row);
});

// Repayments
app.get('/api/repayments', (req, res) => {
  const rows = db.prepare('SELECT * FROM repayments ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/repayments/customer/:customerId', (req, res) => {
  const key = req.params.customerId;
  const cust = db.prepare('SELECT * FROM customers WHERE id = ? OR autoNumber = ?').get(key, key);
  if (!cust) {
    const rows = db.prepare('SELECT * FROM repayments WHERE customerId = ? ORDER BY id DESC').all(key);
    return res.json(rows);
  }
  const rows = db.prepare(
    'SELECT * FROM repayments WHERE customerId IN (?, ?) OR vehicleNumber = ? ORDER BY id DESC'
  ).all(cust.autoNumber, String(cust.id), cust.vehicleNumber || '');
  res.json(rows);
});

app.get('/api/repayments/due-today', (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = today.toISOString();
  const end = new Date(today.getTime() + 24*60*60*1000).toISOString();
  const rows = db.prepare('SELECT * FROM repayments WHERE dueDate >= ? AND dueDate < ? AND isPaid = 0 ORDER BY dueDate ASC').all(start, end);
  res.json(rows);
});

app.get('/api/repayments/overdue', (req, res) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const start = today.toISOString();
  const rows = db.prepare('SELECT * FROM repayments WHERE dueDate < ? AND isPaid = 0 ORDER BY dueDate ASC').all(start);
  res.json(rows);
});

app.get('/api/repayments/range', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
  const rows = db.prepare('SELECT * FROM repayments WHERE dueDate BETWEEN ? AND ? ORDER BY dueDate DESC').all(start, end);
  res.json(rows);
});

app.post('/api/repayments', (req, res) => {
  const { vehicleNumber, customerId, customerName, contact, loanId, dueDate, dueAmount, fine = 0, paidAmount = 0, pendingAmount = 0, remarks, docUrl } = req.body || {};
  if (!vehicleNumber || !customerName || !contact || !dueDate || dueAmount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const isPaid = Number(pendingAmount) === 0 ? 1 : 0;
  const stmt = db.prepare(`INSERT INTO repayments (
    vehicleNumber, customerId, customerName, contact, loanId, dueDate, dueAmount, fine, paidAmount, pendingAmount, isPaid, docUrl, remarks, createdAt
  ) VALUES (@vehicleNumber, @customerId, @customerName, @contact, @loanId, @dueDate, @dueAmount, @fine, @paidAmount, @pendingAmount, @isPaid, @docUrl, @remarks, @createdAt)`);
  const info = stmt.run({
    vehicleNumber, customerId: customerId || null, customerName, contact, loanId: loanId || null, dueDate,
    dueAmount: Number(dueAmount), fine: Number(fine), paidAmount: Number(paidAmount),
    pendingAmount: Number(pendingAmount), isPaid, docUrl: docUrl || null, remarks: remarks || null, createdAt: nowIso()
  });
  const row = db.prepare('SELECT * FROM repayments WHERE id = ?').get(info.lastInsertRowid);
  // Auto-close loan when total repayments reach/exceed loan amount
  if (loanId) {
    try {
      const totals = db.prepare('SELECT SUM(paidAmount) as totalPaid FROM repayments WHERE loanId = ?').get(loanId);
      const loan = db.prepare('SELECT amount, status FROM loanApplications WHERE id = ?').get(loanId);
      if (loan && Number(totals?.totalPaid || 0) >= Number(loan.amount)) {
        db.prepare('UPDATE loanApplications SET status = ? WHERE id = ?').run('Closed', loanId);
      }
    } catch {}
  }
  res.status(201).json(row);
});

// Update repayment
app.put('/api/repayments/:id', (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['vehicleNumber','customerId','customerName','contact','loanId','dueDate','dueAmount','fine','paidAmount','pendingAmount','isPaid','remarks'];
  const payload = req.body || {};
  const keys = Object.keys(payload).filter(k => allowed.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const sets = keys.map(k => `${k} = @${k}`).join(', ');
  if (payload.pendingAmount != null && payload.isPaid == null) {
    payload.isPaid = Number(payload.pendingAmount) === 0 ? 1 : 0;
    keys.push('isPaid');
  }
  const stmt = db.prepare(`UPDATE repayments SET ${sets} WHERE id = @id`);
  const info = stmt.run({ id, ...payload });
  if (info.changes === 0) return res.status(404).json({ error: 'Repayment not found' });
  const row = db.prepare('SELECT * FROM repayments WHERE id = ?').get(id);
  res.json(row);
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Base64 upload endpoint
app.post('/api/uploads', (req, res) => {
  const { filename, data } = req.body || {};
  if (!filename || !data) return res.status(400).json({ error: 'filename and data (base64) required' });
  try {
    const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const base64 = String(data).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const dest = path.join(uploadsDir, `${Date.now()}_${safeName}`);
    fs.writeFileSync(dest, buffer);
    const urlPath = `/uploads/${path.basename(dest)}`;
    res.json({ url: urlPath });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
