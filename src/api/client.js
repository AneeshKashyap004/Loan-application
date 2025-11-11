const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Customers
export const customersApi = {
  list: () => request('/customers'),
  create: (data) => request('/customers', { method: 'POST', body: JSON.stringify(data) }),
  search: (query) => request(`/customers/search?q=${encodeURIComponent(query)}`),
  getById: (id) => request(`/customers/${id}`),
};

// Loans
export const loansApi = {
  list: () => request('/loans'),
  listByRange: (start, end) => request(`/loans/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  listByCustomer: (customerId) => request(`/loans/customer/${customerId}`),
  create: (data) => request('/loans', { method: 'POST', body: JSON.stringify(data) }),
};

// Repayments
export const repaymentsApi = {
  list: () => request('/repayments'),
  dueToday: () => request('/repayments/due-today'),
  overdue: () => request('/repayments/overdue'),
  listByRange: (start, end) => request(`/repayments/range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  listByCustomer: (customerId) => request(`/repayments/customer/${customerId}`),
  create: (data) => request('/repayments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/repayments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
