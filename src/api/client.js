const BASE_URL = import.meta.env.VITE_API_URL || '/api';

export function toAbsoluteFileUrl(urlPath) {
  if (!urlPath) return '';
  try {
    if (/^https?:\/\//i.test(urlPath)) return urlPath;
    // If this looks like an S3 object key we saved (e.g., 'uploads/123_file.pdf'),
    // route through the backend to fetch a fresh signed URL each time.
    if (/^uploads\//i.test(String(urlPath))) {
      const base = new URL(BASE_URL, window.location.origin).toString().replace(/\/$/, '');
      return `${base}/uploads/signed?key=${encodeURIComponent(String(urlPath))}`;
    }
    const origin = (new URL(BASE_URL, window.location.origin)).origin;
    if (String(urlPath).startsWith('/')) return `${origin}${urlPath}`;
    return `${origin}/${urlPath.replace(/^\/?/, '')}`;
  } catch {
    return urlPath;
  }
}

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
  update: (id, data) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/customers/${id}`, { method: 'DELETE' }),
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

// Uploads
export const uploadsApi = {
  upload: (filename, base64Data) => request('/uploads', { method: 'POST', body: JSON.stringify({ filename, data: base64Data }) }),
};

