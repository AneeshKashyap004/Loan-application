import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { db, init, migrate, generateCustomerAutoNumber } from './db.js';

const app = express();
const PORT = process.env.PORT || 8787;

init();
migrate();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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
  const { name, phone, dealer, loanAmount, documentVerified, vehicleNumber, customerType } = req.body || {};
  if (!name || !phone || loanAmount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const autoNumber = (req.body && req.body.autoNumber) ? String(req.body.autoNumber) : generateCustomerAutoNumber();
  const stmt = db.prepare(`INSERT INTO customers (autoNumber, name, phone, dealer, loanAmount, vehicleNumber, customerType, documentVerified, createdAt)
    VALUES (@autoNumber, @name, @phone, @dealer, @loanAmount, @vehicleNumber, @customerType, @documentVerified, @createdAt)`);
  const info = stmt.run({
    autoNumber,
    name,
    phone,
    dealer: dealer ?? '',
    loanAmount: Number(loanAmount),
    vehicleNumber: vehicleNumber ?? null,
    customerType: customerType ?? null,
    documentVerified: documentVerified ? 1 : 0,
    createdAt: nowIso(),
  });
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Loans (Disbursements included)
app.get('/api/loans', (req, res) => {
  const rows = db.prepare('SELECT * FROM loanApplications ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/loans/customer/:customerId', (req, res) => {
  const rows = db.prepare('SELECT * FROM loanApplications WHERE customerId = ? ORDER BY id DESC').all(req.params.customerId);
  res.json(rows);
});

app.get('/api/loans/range', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
  const rows = db.prepare('SELECT * FROM loanApplications WHERE loanDate BETWEEN ? AND ? ORDER BY loanDate DESC').all(start, end);
  res.json(rows);
});

app.post('/api/loans', (req, res) => {
  const { vehicleNumber, customerId, customerName, customerPhone, dealer, amount, tenure, loanDate, hoa, paymentMode, remarks, status } = req.body || {};
  if (!vehicleNumber || amount == null || tenure == null || !loanDate || !paymentMode) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const stmt = db.prepare(`INSERT INTO loanApplications (
    vehicleNumber, customerId, customerName, customerPhone, dealer, amount, tenure, loanDate, hoa, paymentMode, remarks, status, createdAt
  ) VALUES (@vehicleNumber, @customerId, @customerName, @customerPhone, @dealer, @amount, @tenure, @loanDate, @hoa, @paymentMode, @remarks, @status, @createdAt)`);
  const info = stmt.run({
    vehicleNumber, customerId: customerId || null, customerName: customerName || null, customerPhone: customerPhone || null, dealer: dealer ?? '',
    amount: Number(amount), tenure: Number(tenure), loanDate,
    hoa: hoa || null, paymentMode, remarks: remarks || null,
    status: status || null, createdAt: nowIso()
  });
  const row = db.prepare('SELECT * FROM loanApplications WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Repayments
app.get('/api/repayments', (req, res) => {
  const rows = db.prepare('SELECT * FROM repayments ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/repayments/customer/:customerId', (req, res) => {
  const rows = db.prepare('SELECT * FROM repayments WHERE customerId = ? ORDER BY id DESC').all(req.params.customerId);
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
  const { vehicleNumber, customerId, customerName, contact, loanId, dueDate, dueAmount, fine = 0, paidAmount = 0, pendingAmount = 0, remarks } = req.body || {};
  if (!vehicleNumber || !customerName || !contact || !dueDate || dueAmount == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const isPaid = Number(pendingAmount) === 0 ? 1 : 0;
  const stmt = db.prepare(`INSERT INTO repayments (
    vehicleNumber, customerId, customerName, contact, loanId, dueDate, dueAmount, fine, paidAmount, pendingAmount, isPaid, remarks, createdAt
  ) VALUES (@vehicleNumber, @customerId, @customerName, @contact, @loanId, @dueDate, @dueAmount, @fine, @paidAmount, @pendingAmount, @isPaid, @remarks, @createdAt)`);
  const info = stmt.run({
    vehicleNumber, customerId: customerId || null, customerName, contact, loanId: loanId || null, dueDate,
    dueAmount: Number(dueAmount), fine: Number(fine), paidAmount: Number(paidAmount),
    pendingAmount: Number(pendingAmount), isPaid, remarks: remarks || null, createdAt: nowIso()
  });
  const row = db.prepare('SELECT * FROM repayments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// Update repayment (e.g., change due date)
app.put('/api/repayments/:id', (req, res) => {
  const id = Number(req.params.id);
  const allowed = ['vehicleNumber','customerId','customerName','contact','loanId','dueDate','dueAmount','fine','paidAmount','pendingAmount','isPaid','remarks'];
  const payload = req.body || {};
  const keys = Object.keys(payload).filter(k => allowed.includes(k));
  if (keys.length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const sets = keys.map(k => `${k} = @${k}`).join(', ');
  // If pendingAmount provided, recompute isPaid unless explicitly provided
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

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
