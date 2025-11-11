import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'loan.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);

// Initialize tables
export function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      autoNumber TEXT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      dealer TEXT NOT NULL,
      loanAmount REAL NOT NULL,
      vehicleNumber TEXT,
      customerType TEXT,
      documentVerified INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS loanApplications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicleNumber TEXT NOT NULL,
      customerId INTEGER,
      customerName TEXT,
      customerPhone TEXT,
      dealer TEXT NOT NULL,
      amount REAL NOT NULL,
      tenure INTEGER NOT NULL,
      loanDate TEXT NOT NULL,
      hoa TEXT,
      paymentMode TEXT NOT NULL,
      remarks TEXT,
      status TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repayments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicleNumber TEXT NOT NULL,
      customerId INTEGER,
      customerName TEXT NOT NULL,
      contact TEXT NOT NULL,
      loanId INTEGER,
      dueDate TEXT NOT NULL,
      dueAmount REAL NOT NULL,
      fine REAL DEFAULT 0,
      paidAmount REAL DEFAULT 0,
      pendingAmount REAL DEFAULT 0,
      isPaid INTEGER DEFAULT 0,
      remarks TEXT,
      createdAt TEXT NOT NULL
    );
  `);
}

// Simple migrations to add missing columns if DB already existed
export function migrate() {
  function hasColumn(table, col) {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all();
    return rows.some(r => r.name === col);
  }

  // loanApplications
  if (!hasColumn('loanApplications', 'customerId')) {
    db.exec('ALTER TABLE loanApplications ADD COLUMN customerId INTEGER');
  }
  if (!hasColumn('loanApplications', 'customerName')) {
    db.exec('ALTER TABLE loanApplications ADD COLUMN customerName TEXT');
  }
  if (!hasColumn('loanApplications', 'customerPhone')) {
    db.exec('ALTER TABLE loanApplications ADD COLUMN customerPhone TEXT');
  }

  // repayments
  if (!hasColumn('repayments', 'customerId')) {
    db.exec('ALTER TABLE repayments ADD COLUMN customerId INTEGER');
  }
  if (!hasColumn('repayments', 'loanId')) {
    db.exec('ALTER TABLE repayments ADD COLUMN loanId INTEGER');
  }

  // customers new fields
  if (!hasColumn('customers', 'vehicleNumber')) {
    db.exec('ALTER TABLE customers ADD COLUMN vehicleNumber TEXT');
  }
  if (!hasColumn('customers', 'customerType')) {
    db.exec('ALTER TABLE customers ADD COLUMN customerType TEXT');
  }
}

export function generateCustomerAutoNumber() {
  const row = db.prepare('SELECT autoNumber FROM customers ORDER BY id DESC LIMIT 1').get();
  const prev = row?.autoNumber || 'CUST00000';
  const n = parseInt(prev.replace(/\D/g, '')) + 1;
  return `CUST${String(n).padStart(5, '0')}`;
}
