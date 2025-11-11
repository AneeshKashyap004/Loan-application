import Dexie from 'dexie';

export const db = new Dexie('LoanManagementDB');

db.version(1).stores({
  customers: '++id, autoNumber, name, phone, dealer, loanAmount, documentVerified, createdAt',
  loanApplications: '++id, vehicleNumber, dealer, amount, tenure, loanDate, hoa, paymentMode, remarks, createdAt',
  repayments: '++id, vehicleNumber, customerName, contact, dueDate, dueAmount, fine, paidAmount, pendingAmount, remarks, createdAt, isPaid'
});

// Helper function to generate auto number for customers
export async function generateAutoNumber() {
  const customers = await db.customers.toArray();
  const maxNumber = customers.reduce((max, customer) => {
    const num = parseInt(customer.autoNumber?.replace(/\D/g, '') || '0');
    return num > max ? num : max;
  }, 0);
  return `CUST${String(maxNumber + 1).padStart(5, '0')}`;
}

// Customer CRUD operations
export const customerService = {
  async add(customer) {
    const autoNumber = await generateAutoNumber();
    return await db.customers.add({
      ...customer,
      autoNumber,
      createdAt: new Date().toISOString()
    });
  },
  
  async getAll() {
    return await db.customers.toArray();
  },
  
  async getById(id) {
    return await db.customers.get(id);
  },
  
  async update(id, customer) {
    return await db.customers.update(id, customer);
  },
  
  async delete(id) {
    return await db.customers.delete(id);
  }
};

// Loan Application CRUD operations
export const loanApplicationService = {
  async add(loanApplication) {
    return await db.loanApplications.add({
      ...loanApplication,
      createdAt: new Date().toISOString()
    });
  },
  
  async getAll() {
    return await db.loanApplications.toArray();
  },
  
  async getById(id) {
    return await db.loanApplications.get(id);
  },
  
  async update(id, loanApplication) {
    return await db.loanApplications.update(id, loanApplication);
  },
  
  async delete(id) {
    return await db.loanApplications.delete(id);
  },
  
  async getByDateRange(startDate, endDate) {
    return await db.loanApplications
      .where('loanDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }
};

// Repayment CRUD operations
export const repaymentService = {
  async add(repayment) {
    return await db.repayments.add({
      ...repayment,
      isPaid: parseFloat(repayment.pendingAmount) === 0,
      createdAt: new Date().toISOString()
    });
  },
  
  async getAll() {
    return await db.repayments.toArray();
  },
  
  async getById(id) {
    return await db.repayments.get(id);
  },
  
  async update(id, repayment) {
    return await db.repayments.update(id, {
      ...repayment,
      isPaid: parseFloat(repayment.pendingAmount) === 0
    });
  },
  
  async delete(id) {
    return await db.repayments.delete(id);
  },
  
  async getDueToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return await db.repayments
      .where('dueDate')
      .between(today.toISOString(), tomorrow.toISOString(), true, false)
      .and(item => !item.isPaid)
      .toArray();
  },
  
  async getOverdue() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return await db.repayments
      .where('dueDate')
      .below(today.toISOString())
      .and(item => !item.isPaid)
      .toArray();
  },
  
  async getByDateRange(startDate, endDate) {
    return await db.repayments
      .where('dueDate')
      .between(startDate, endDate, true, true)
      .toArray();
  }
};

export default db;
