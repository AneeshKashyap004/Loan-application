import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { loansApi } from '@/api/client';
import { CustomerSearch } from './CustomerSearch';
import { format } from 'date-fns';

export function Disbursements() {
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    vehicleNumber: '',
    dealer: '',
    amount: '',
    tenure: '',
    disbursementDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMode: 'Cash',
    remarks: '',
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      dealer: customer.dealer,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (!formData.vehicleNumber || !formData.customerName || !formData.amount || !formData.tenure || !formData.disbursementDate) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      await loansApi.create({
        vehicleNumber: formData.vehicleNumber,
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        dealer: formData.dealer,
        amount: parseFloat(formData.amount),
        tenure: parseInt(formData.tenure),
        loanDate: new Date(formData.disbursementDate).toISOString(),
        paymentMode: formData.paymentMode,
        remarks: formData.remarks,
        status: 'disbursed',
      });

      setMessage({ type: 'success', text: 'Disbursement recorded successfully!' });
      
      setSelectedCustomer(null);
      setFormData({
        customerId: '',
        customerName: '',
        customerPhone: '',
        vehicleNumber: '',
        dealer: '',
        amount: '',
        tenure: '',
        disbursementDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMode: 'Cash',
        remarks: '',
      });
    } catch (error) {
      console.error('Error saving disbursement:', error);
      setMessage({ type: 'error', text: 'Failed to save disbursement. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Disbursements</h1>
        <p className="text-gray-500 mt-1">Record loan disbursement details</p>
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

          {/* Customer Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Customer *
            </label>
            <CustomerSearch onSelect={handleCustomerSelect} />
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">Selected: {selectedCustomer.name}</div>
                  <div className="text-gray-600">ID: {selectedCustomer.autoNumber} • Phone: {selectedCustomer.phone}</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Number *
              </label>
              <Input
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={handleChange}
                placeholder="Enter vehicle number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Name *
              </label>
              <Input
                name="customerName"
                value={formData.customerName}
                onChange={handleChange}
                placeholder="Enter customer name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dealer
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
                name="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                placeholder="Enter amount"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tenure (Months) *
              </label>
              <Input
                name="tenure"
                type="number"
                value={formData.tenure}
                onChange={handleChange}
                placeholder="Enter tenure"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Disbursement Date *
              </label>
              <Input
                name="disbursementDate"
                type="date"
                value={formData.disbursementDate}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Mode *
              </label>
              <select
                name="paymentMode"
                value={formData.paymentMode}
                onChange={handleChange}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks
            </label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              placeholder="Enter any remarks"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Saving...' : 'Record Disbursement'}
          </Button>
        </form>
      </div>
    </div>
  );
}
