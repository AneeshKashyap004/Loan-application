import React, { useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Download, Search } from 'lucide-react';
import { customersApi, loansApi, repaymentsApi } from '@/api/client';
import { exportLoanApplicationsToCSV, exportRepaymentsToCSV } from '@/utils/csvExport';

export function Reports() {
  const [customerIdInput, setCustomerIdInput] = useState('');
  const [customer, setCustomer] = useState(null);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleFetch = async () => {
    const id = customerIdInput.trim();
    if (!id) {
      setMessage({ type: 'error', text: 'Enter a Customer ID' });
      return;
    }
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const cust = await customersApi.getById(id);
      setCustomer(cust);
      const resolvedId = cust?.autoNumber || id;
      let [custLoans, custReps] = await Promise.all([
        loansApi.listByCustomer(resolvedId),
        repaymentsApi.listByCustomer(resolvedId),
      ]);

      // Fallback: derive vehicle number and search by vehicle if id linkage is missing in old records
      if ((custLoans?.length || 0) === 0) {
        const vehCandidate = (cust?.vehicleNumber || id.replace(/^(EMI|INP)/i, '')).toUpperCase();
        const allLoans = await loansApi.list();
        custLoans = (allLoans || []).filter(l => String(l.vehicleNumber || '').toUpperCase() === vehCandidate);
      }
      if ((custReps?.length || 0) === 0) {
        const vehCandidate = (cust?.vehicleNumber || id.replace(/^(EMI|INP)/i, '')).toUpperCase();
        const start = new Date('1970-01-01T00:00:00.000Z').toISOString();
        const end = new Date('2100-01-01T00:00:00.000Z').toISOString();
        const allReps = await repaymentsApi.listByRange(start, end);
        custReps = (allReps || []).filter(r => String(r.vehicleNumber || '').toUpperCase() === vehCandidate);
      }

      setLoans(custLoans || []);
      setRepayments(custReps || []);
      if ((custLoans?.length || 0) === 0 && (custReps?.length || 0) === 0) {
        setMessage({ type: 'info', text: 'No data found for this customer.' });
      }
    } catch (e) {
      setCustomer(null);
      setLoans([]);
      setRepayments([]);
      setMessage({ type: 'error', text: 'Customer not found or failed to load data.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = () => {
    exportLoanApplicationsToCSV(loans);
    exportRepaymentsToCSV(repayments);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customer Report</h1>
        <p className="text-gray-500 mt-1">Enter Customer ID (EMI/INP + Vehicle No. or CUST ID) to view and download their report</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer ID</label>
            <Input
              type="text"
              value={customerIdInput}
              onChange={(e) => setCustomerIdInput(e.target.value)}
              placeholder="e.g. EMIKA01AB1234 or CUST00012"
            />
          </div>
          <div>
            <Button onClick={handleFetch} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
              <Search className="mr-2 h-4 w-4" />
              {loading ? 'Loading...' : 'Load Report'}
            </Button>
          </div>
        </div>

        {message.text && (
          <div className={`text-sm ${message.type === 'error' ? 'text-red-600' : message.type === 'info' ? 'text-gray-600' : 'text-green-600'}`}>
            {message.text}
          </div>
        )}
      </div>

      {customer && (
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Customer</div>
              <div className="text-lg font-semibold">{customer.name} <span className="text-gray-500 font-normal">({customer.autoNumber})</span></div>
              <div className="text-sm text-gray-600">{customer.phone}{customer.dealer ? ` · Dealer: ${customer.dealer}` : ''}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportLoanApplicationsToCSV(loans)}>
                <Download className="mr-2 h-4 w-4" /> Loans CSV
              </Button>
              <Button variant="outline" onClick={() => exportRepaymentsToCSV(repayments)}>
                <Download className="mr-2 h-4 w-4" /> Repayments CSV
              </Button>
              <Button onClick={handleDownloadAll} className="bg-blue-600 hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" /> Download Both
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-md font-semibold mb-3">Loans</h3>
              <div className="overflow-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Vehicle</th>
                      <th className="px-3 py-2 text-left">Amount</th>
                      <th className="px-3 py-2 text-left">Tenure</th>
                      <th className="px-3 py-2 text-left">Loan Date</th>
                      <th className="px-3 py-2 text-left">HOA</th>
                      <th className="px-3 py-2 text-left">EMI Due Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loans.map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="px-3 py-2">{l.vehicleNumber}</td>
                        <td className="px-3 py-2">{l.amount}</td>
                        <td className="px-3 py-2">{l.tenure}</td>
                        <td className="px-3 py-2">{l.loanDate?.slice(0,10)}</td>
                        <td className="px-3 py-2">{l.hoa || '-'}</td>
                        <td className="px-3 py-2">{l.dueDay ?? '-'}</td>
                      </tr>
                    ))}
                    {loans.length === 0 && (
                      <tr><td className="px-3 py-3 text-gray-500" colSpan={5}>No loans</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold mb-3">Repayments</h3>
              <div className="overflow-auto border rounded">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Due Date</th>
                      <th className="px-3 py-2 text-left">Due</th>
                      <th className="px-3 py-2 text-left">Fine</th>
                      <th className="px-3 py-2 text-left">Paid</th>
                      <th className="px-3 py-2 text-left">Pending</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repayments.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="px-3 py-2">{r.dueDate?.slice(0,10)}</td>
                        <td className="px-3 py-2">{r.dueAmount}</td>
                        <td className="px-3 py-2">{r.fine}</td>
                        <td className="px-3 py-2">{r.paidAmount}</td>
                        <td className="px-3 py-2">{r.pendingAmount}</td>
                        <td className="px-3 py-2">{r.isPaid ? 'Paid' : 'Unpaid'}</td>
                      </tr>
                    ))}
                    {repayments.length === 0 && (
                      <tr><td className="px-3 py-3 text-gray-500" colSpan={6}>No repayments</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
