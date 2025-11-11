import React, { useEffect, useState } from 'react';
import { formatDateDMY } from '@/utils/date';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { customersApi } from '@/api/client';

export function CustomerForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    dealer: '',
    documentVerified: false,
    vehicleNumber: '',
    customerType: 'EMI',
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const loadCustomers = async () => {
    try {
      const rows = await customersApi.list();
      setCustomers(rows);
    } catch (e) {
      console.error('Failed to load customers', e);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validation (dealer and loan amount are optional)
      if (!formData.name || !formData.phone || !formData.vehicleNumber) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      // Phone validation
      if (!/^\d{10}$/.test(formData.phone)) {
        setMessage({ type: 'error', text: 'Please enter a valid 10-digit phone number' });
        setLoading(false);
        return;
      }

      // Build Customer ID as EMI/INP + Vehicle Number
      const prefix = (formData.customerType || 'EMI').toUpperCase();
      const normalizedVeh = String(formData.vehicleNumber).replace(/\s+/g, '').toUpperCase();
      const autoNumber = `${prefix}${normalizedVeh}`;

      // Save to server (SQLite)
      const created = await customersApi.create({
        name: formData.name,
        phone: formData.phone,
        dealer: formData.dealer,
        loanAmount: 0,
        documentVerified: formData.documentVerified,
        vehicleNumber: normalizedVeh,
        customerType: prefix,
        autoNumber,
      });

      setMessage({ type: 'success', text: `Customer added successfully! Auto Number: ${created.autoNumber}` });
      await loadCustomers();
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        dealer: '',
        documentVerified: false,
        vehicleNumber: '',
        customerType: 'EMI',
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error saving customer:', error);
      setMessage({ type: 'error', text: 'Failed to save customer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage and view customers. Click Add Customer to create a new one.</p>
        </div>
        <div className="pt-1">
          {showForm ? (
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowForm(true)}>Add Customer</Button>
          )}
        </div>
      </div>

      {showForm && (
      <div className="bg-white rounded-lg shadow-sm border p-6 max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {message.text && (
            <Alert variant={message.type === 'success' ? 'success' : 'destructive'}>
              {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{message.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <Input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter customer name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <Input
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                placeholder="10-digit phone number"
                maxLength="10"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dealer Name *
              </label>
              <Input
                name="dealer"
                value={formData.dealer}
                onChange={handleChange}
                placeholder="Enter dealer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Number *
              </label>
              <Input
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={handleChange}
                placeholder="e.g., KA01AB1234"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Type *
              </label>
              <div className="flex items-center gap-6 py-2">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="customerType"
                    value="EMI"
                    checked={formData.customerType === 'EMI'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300"
                  />
                  <span>EMI</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="customerType"
                    value="INP"
                    checked={formData.customerType === 'INP'}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 border-gray-300"
                  />
                  <span>INP</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="documentVerified"
              name="documentVerified"
              type="checkbox"
              checked={formData.documentVerified}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="documentVerified" className="text-sm font-medium text-gray-700 cursor-pointer">
              Documents Verified
            </label>
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Saving...' : 'Add Customer'}
          </Button>
        </form>
      </div>
      )}

      {/* Existing Customers */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Existing Customers</h2>
          <button onClick={loadCustomers} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4">Customer ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Phone</th>
                <th className="py-2 pr-4">Dealer</th>
                <th className="py-2 pr-4">Loan Amount</th>
                <th className="py-2 pr-4">Docs</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-4 text-gray-500">No customers found.</td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr key={c.id} className="border-t">
                    <td className="py-2 pr-4 font-medium">{c.autoNumber}</td>
                    <td className="py-2 pr-4">{c.name}</td>
                    <td className="py-2 pr-4">{c.phone}</td>
                    <td className="py-2 pr-4">{c.dealer}</td>
                    <td className="py-2 pr-4">₹{c.loanAmount}</td>
                    <td className="py-2 pr-4">{c.documentVerified ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">{formatDateDMY(c.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
