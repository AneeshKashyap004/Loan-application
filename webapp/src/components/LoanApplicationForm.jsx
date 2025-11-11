import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { loanApplicationService } from '@/db/database';
import { format } from 'date-fns';

export function LoanApplicationForm() {
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    dealer: '',
    amount: '',
    tenure: '',
    loanDate: format(new Date(), 'yyyy-MM-dd'),
    hoa: '',
    paymentMode: 'Cash',
    remarks: '',
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

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
      // Validation
      if (!formData.vehicleNumber || !formData.dealer || !formData.amount || !formData.tenure || !formData.loanDate) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      // Save to database
      await loanApplicationService.add({
        vehicleNumber: formData.vehicleNumber,
        dealer: formData.dealer,
        amount: parseFloat(formData.amount),
        tenure: parseInt(formData.tenure),
        loanDate: new Date(formData.loanDate).toISOString(),
        hoa: formData.hoa,
        paymentMode: formData.paymentMode,
        remarks: formData.remarks,
      });

      setMessage({ type: 'success', text: 'Loan application added successfully!' });
      
      // Reset form
      setFormData({
        vehicleNumber: '',
        dealer: '',
        amount: '',
        tenure: '',
        loanDate: format(new Date(), 'yyyy-MM-dd'),
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
                Dealer *
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
