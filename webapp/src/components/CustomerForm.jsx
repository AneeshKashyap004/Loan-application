import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { customerService } from '@/db/database';

export function CustomerForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    dealer: '',
    loanAmount: '',
    documentVerified: false,
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

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
      // Validation
      if (!formData.name || !formData.phone || !formData.dealer || !formData.loanAmount) {
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

      // Save to database
      const id = await customerService.add({
        name: formData.name,
        phone: formData.phone,
        dealer: formData.dealer,
        loanAmount: parseFloat(formData.loanAmount),
        documentVerified: formData.documentVerified,
      });

      setMessage({ type: 'success', text: `Customer added successfully! Auto Number will be assigned.` });
      
      // Reset form
      setFormData({
        name: '',
        phone: '',
        dealer: '',
        loanAmount: '',
        documentVerified: false,
      });
    } catch (error) {
      console.error('Error saving customer:', error);
      setMessage({ type: 'error', text: 'Failed to save customer. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500 mt-1">Add new customer information to the system</p>
      </div>

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
                Loan Amount *
              </label>
              <Input
                name="loanAmount"
                type="number"
                step="0.01"
                value={formData.loanAmount}
                onChange={handleChange}
                placeholder="Enter loan amount"
                required
              />
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
    </div>
  );
}
