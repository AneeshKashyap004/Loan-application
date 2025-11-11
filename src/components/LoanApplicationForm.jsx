import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { loansApi, customersApi } from '@/api/client';
import { CustomerSearch } from './CustomerSearch';
import { format } from 'date-fns';

export function LoanApplicationForm() {
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    vehicleNumber: '',
    dealer: '',
    amount: '',
    tenure: '',
    loanDate: format(new Date(), 'yyyy-MM-dd'),
    dueDay: '',
    hoa: '',
    paymentMode: 'Cash',
    remarks: '',
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerIdInput, setCustomerIdInput] = useState('');

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customerId: customer.autoNumber,
      customerName: customer.name,
      customerPhone: customer.phone,
      dealer: customer.dealer,
      vehicleNumber: prev.vehicleNumber || customer.vehicleNumber || '',
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCustomerIdFetch = async () => {
    const id = customerIdInput.trim();
    if (!id) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const customer = await customersApi.getById(id);
      handleCustomerSelect(customer);
    } catch (err) {
      console.error('Customer lookup failed', err);
      setMessage({ type: 'error', text: 'Customer not found for the given ID' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Validation (dealer is optional)
      if (!formData.vehicleNumber || !formData.amount || !formData.tenure || !formData.loanDate || !formData.dueDay) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      const dueDayNum = Number(formData.dueDay);
      if (isNaN(dueDayNum) || dueDayNum < 1 || dueDayNum > 31) {
        setMessage({ type: 'error', text: 'Please enter a valid EMI Due Day between 1 and 31' });
        setLoading(false);
        return;
      }

      // Save to server (SQLite)
      await loansApi.create({
        vehicleNumber: formData.vehicleNumber,
        customerId: formData.customerId,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        dealer: formData.dealer,
        amount: parseFloat(formData.amount),
        tenure: parseInt(formData.tenure),
        loanDate: new Date(formData.loanDate).toISOString(),
        dueDay: dueDayNum,
        hoa: formData.hoa,
        paymentMode: formData.paymentMode,
        remarks: formData.remarks,
      });

      setMessage({ type: 'success', text: 'Loan application added successfully!' });
      
      // Reset form
      setSelectedCustomer(null);
      setFormData({
        customerId: '',
        customerName: '',
        customerPhone: '',
        vehicleNumber: '',
        dealer: '',
        amount: '',
        tenure: '',
        loanDate: format(new Date(), 'yyyy-MM-dd'),
        dueDay: '',
        hoa: '',
        paymentMode: 'Cash',
        remarks: '',
      });
    } catch (error) {
      console.error('Error saving loan application:', error);
      setMessage({ type: 'error', text: 'Failed to save loan application. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Loans</h1>
        <p className="text-gray-500 mt-1">Record new loan application details</p>
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

          {/* Customer Search / ID */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Customer (by ID/Name/Phone) *
            </label>
            <CustomerSearch onSelect={handleCustomerSelect} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder="Or enter Customer ID (e.g., CUST00001 or EMIKA01AB1234)"
                  value={customerIdInput}
                  onChange={(e) => setCustomerIdInput(e.target.value)}
                />
              </div>
              <div>
                <Button type="button" onClick={handleCustomerIdFetch} disabled={loading} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800">
                  Fetch by ID
                </Button>
              </div>
            </div>
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">Selected: {selectedCustomer.name}</div>
                  <div className="text-gray-600">ID: {selectedCustomer.autoNumber} • Phone: {selectedCustomer.phone}</div>
                </div>
              </div>
            )}

            {selectedCustomer && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Customer ID</label>
                  <Input value={selectedCustomer.autoNumber || ''} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <Input value={selectedCustomer.phone || ''} readOnly className="bg-gray-50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dealer</label>
                  <Input value={formData.dealer || ''} readOnly className="bg-gray-50" />
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
                Loan Date *
              </label>
              <Input
                name="loanDate"
                type="date"
                value={formData.loanDate}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                EMI Due Day (1-31) *
              </label>
              <Input
                name="dueDay"
                type="number"
                min="1"
                max="31"
                value={formData.dueDay}
                onChange={handleChange}
                placeholder="e.g., 5"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HOA
              </label>
              <Input
                name="hoa"
                value={formData.hoa}
                onChange={handleChange}
                placeholder="Enter HOA details"
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
                <option value="Cheque">Cheque</option>
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
            {loading ? 'Saving...' : 'Add Loan Application'}
          </Button>
        </form>
      </div>
    </div>
  );
}
