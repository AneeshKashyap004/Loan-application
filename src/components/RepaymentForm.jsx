import React, { useState, useEffect } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { repaymentsApi, loansApi, customersApi } from '@/api/client';
import { CustomerSearch } from './CustomerSearch';
import { format } from 'date-fns';
import { formatDateDMY } from '@/utils/date';

export function RepaymentForm() {
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    customerName: '',
    contact: '',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueAmount: '',
    fine: '0',
    paidAmount: '0',
    pendingAmount: '',
    remarks: '',
  });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerLoans, setCustomerLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [isLoanClosed, setIsLoanClosed] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState(null);
  const [dueToday, setDueToday] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Calculate pending amount automatically
  useEffect(() => {
    const due = parseFloat(formData.dueAmount) || 0;
    const fine = parseFloat(formData.fine) || 0;
    const paid = parseFloat(formData.paidAmount) || 0;
    const pending = (due + fine - paid).toFixed(2);
    
    setFormData(prev => ({
      ...prev,
      pendingAmount: pending
    }));
  }, [formData.dueAmount, formData.fine, formData.paidAmount]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    const loadDueAndCustomers = async () => {
      try {
        const [custs, dues] = await Promise.all([
          customersApi.list(),
          repaymentsApi.dueToday(),
        ]);
        setCustomers(custs);
        setDueToday(dues);
      } catch (e) {
        console.error('Failed to load due today/customers', e);
      }
    };
    loadDueAndCustomers();
  }, []);

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomer(customer);
    setFormData(prev => ({
      ...prev,
      customerName: customer.name,
      contact: customer.phone,
    }));
    try {
      const key = customer.autoNumber || customer.id;
      const loans = await loansApi.listByCustomer(key);
      setCustomerLoans(loans);
    } catch (err) {
      console.error('Failed to load customer loans', err);
      setCustomerLoans([]);
    }
  };

  

  const handleLoanSelect = async (e) => {
    const loanId = e.target.value;
    setSelectedLoanId(loanId);
    const loan = customerLoans.find(l => String(l.id) === String(loanId));
    if (loan) {
      setIsLoanClosed(String(loan.status || '').toLowerCase() === 'closed');
      setFormData(prev => ({
        ...prev,
        vehicleNumber: loan.vehicleNumber || prev.vehicleNumber,
        dueAmount: prev.dueAmount || (
          loan.emiAmount != null && loan.emiAmount !== ''
            ? String(loan.emiAmount)
            : (loan.amount ? String(loan.amount) : '')
        ),
      }));

      // Compute remaining amount = loan.amount - sum(paidAmount for this loan)
      try {
        if (selectedCustomer && loan.amount != null) {
          const reps = await repaymentsApi.listByCustomer(selectedCustomer.autoNumber || selectedCustomer.id);
          const totalPaid = (reps || []).filter(r => String(r.loanId || '') === String(loan.id))
            .reduce((s, r) => s + (Number(r.paidAmount) || 0), 0);
          const remaining = Math.max(0, Number(loan.amount) - totalPaid);
          setRemainingAmount(remaining);
          if (remaining <= 0) setIsLoanClosed(true);
        } else {
          setRemainingAmount(null);
        }
      } catch (err) {
        setRemainingAmount(null);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isLoanClosed) {
        setMessage({ type: 'error', text: 'Selected loan is already repaid/closed.' });
        setLoading(false);
        return;
      }
      // Validation
      if (!formData.vehicleNumber || !formData.customerName || !formData.contact || !formData.dueDate || !formData.dueAmount) {
        setMessage({ type: 'error', text: 'Please fill in all required fields' });
        setLoading(false);
        return;
      }

      // Phone validation
      if (!/^\d{10}$/.test(formData.contact)) {
        setMessage({ type: 'error', text: 'Please enter a valid 10-digit contact number' });
        setLoading(false);
        return;
      }

      // If user just hit Repay, assume full payment when paidAmount not provided
      let paidAmountNum = parseFloat(formData.paidAmount || '0') || 0;
      const dueNum = parseFloat(formData.dueAmount || '0') || 0;
      const fineNum = parseFloat(formData.fine || '0') || 0;
      let pendingNum = parseFloat(formData.pendingAmount || '0') || (dueNum + fineNum - paidAmountNum);
      if (!formData.paidAmount || Number(formData.paidAmount) === 0) {
        paidAmountNum = dueNum + fineNum;
        pendingNum = 0;
      }

      // Save to server (SQLite)
      await repaymentsApi.create({
        vehicleNumber: formData.vehicleNumber,
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerName: formData.customerName,
        contact: formData.contact,
        loanId: selectedLoanId || null,
        dueDate: new Date(formData.dueDate).toISOString(),
        dueAmount: dueNum,
        fine: fineNum,
        paidAmount: paidAmountNum,
        pendingAmount: pendingNum,
        remarks: formData.remarks,
      });

      setMessage({ type: 'success', text: 'Repayment record added successfully!' });
      
      // Reset form
      setFormData({
        vehicleNumber: '',
        customerName: '',
        contact: '',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        dueAmount: '',
        fine: '0',
        paidAmount: '0',
        pendingAmount: '',
        remarks: '',
      });
      setRemainingAmount(null);
    } catch (error) {
      console.error('Error saving repayment:', error);
      setMessage({ type: 'error', text: 'Failed to save repayment. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Repayments</h1>
        <p className="text-gray-500 mt-1">Record repayment information and due dates</p>
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
            {selectedCustomer && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm">
                  <div className="font-semibold text-gray-900">Selected: {selectedCustomer.name}</div>
                  <div className="text-gray-600">ID: {selectedCustomer.autoNumber} • Phone: {selectedCustomer.phone}</div>
                </div>
              </div>
            )}
          </div>

          {/* Loan selector for selected customer */}
          {selectedCustomer && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Loan (auto-fills vehicle and due)
              </label>
              <select
                value={selectedLoanId}
                onChange={handleLoanSelect}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">-- Choose a loan --</option>
                {customerLoans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.loanCode || (l.vehicleNumber || 'Vehicle')} • ₹{l.amount} • {l.status || 'N/A'} • {formatDateDMY(l.loanDate)}
                  </option>
                ))}
              </select>
              {isLoanClosed && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                  Already repaid: This loan is marked as Closed. Further repayments are disabled.
                </div>
              )}
              {remainingAmount != null && !isLoanClosed && (
                <div className="mt-2 text-sm text-gray-700">Remaining Amount: ₹{Number(remainingAmount).toLocaleString()}</div>
              )}
            </div>
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
                Contact Number *
              </label>
              <Input
                name="contact"
                type="tel"
                value={formData.contact}
                onChange={handleChange}
                placeholder="10-digit number"
                maxLength="10"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date *
              </label>
              <Input
                name="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Amount *
              </label>
              <Input
                name="dueAmount"
                type="number"
                step="0.01"
                value={formData.dueAmount}
                onChange={handleChange}
                placeholder="Enter due amount"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fine
              </label>
              <Input
                name="fine"
                type="number"
                step="0.01"
                value={formData.fine}
                onChange={handleChange}
                placeholder="Enter fine amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paid Amount
              </label>
              <Input
                name="paidAmount"
                type="number"
                step="0.01"
                value={formData.paidAmount}
                onChange={handleChange}
                placeholder="Enter paid amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pending Amount
              </label>
              <Input
                name="pendingAmount"
                type="number"
                step="0.01"
                value={formData.pendingAmount}
                readOnly
                className="bg-gray-50"
              />
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
              placeholder="Enter any remarks or notes"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Document upload moved to Loans form */}

          <Button type="submit" disabled={loading || isLoanClosed} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Processing...' : 'Repay'}
          </Button>
        </form>
      </div>

      {/* Due Today List */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Today's Dues</h2>
          <button onClick={async () => {
            try {
              const [custs, dues] = await Promise.all([
                customersApi.list(),
                repaymentsApi.dueToday(),
              ]);
              setCustomers(custs);
              setDueToday(dues);
            } catch (e) { console.error(e); }
          }} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-2 pr-4">Customer ID</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Vehicle</th>
                <th className="py-2 pr-4">Due Amount</th>
                <th className="py-2 pr-4">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {dueToday.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-4 text-gray-500">No dues today.</td>
                </tr>
              ) : (
                dueToday.map((r) => {
                  const cust = customers.find(c => c.id === r.customerId) || customers.find(c => (c.vehicleNumber || '').toUpperCase() === String(r.vehicleNumber || '').toUpperCase());
                  const autoId = cust?.autoNumber || '';
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pr-4 font-medium">{autoId}</td>
                      <td className="py-2 pr-4">{r.customerName}</td>
                      <td className="py-2 pr-4">{r.vehicleNumber}</td>
                      <td className="py-2 pr-4">₹{Number(r.dueAmount || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4">{formatDateDMY(r.dueDate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
