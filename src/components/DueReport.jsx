import React, { useEffect, useMemo, useState } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { customersApi, repaymentsApi, loansApi } from '@/api/client';
import { format } from 'date-fns';

export function DueReport() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editing, setEditing] = useState({}); // id -> ISO date string

  const autoNumberByCustomerId = useMemo(() => {
    const map = new Map();
    (customers || []).forEach(c => {
      if (c.id != null) map.set(c.id, c.autoNumber || '');
    });
    return map;
  }, [customers]);

  const autoNumberByVehicle = useMemo(() => {
    const map = new Map();
    (customers || []).forEach(c => {
      if (c.vehicleNumber) map.set(String(c.vehicleNumber).toUpperCase(), c.autoNumber || '');
    });
    return map;
  }, [customers]);

  const load = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const start = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
      const end = new Date(`${selectedDate}T23:59:59.999Z`).toISOString();
      const sel = new Date(selectedDate);
      const monthStart = new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString();
      const monthEnd = new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString();
      const [custs, repsForDay, repsForMonth, loans] = await Promise.all([
        customersApi.list(),
        repaymentsApi.listByRange(start, end),
        repaymentsApi.listByRange(monthStart, monthEnd),
        loansApi.list(),
      ]);
      setCustomers(custs);
      // Normalize repayments rows, add autoNumber
      const withId = (repsForDay || []).map(r => {
        const veh = String(r.vehicleNumber || '').toUpperCase();
        const autoNumber = (r.customerId != null && autoNumberByCustomerId.get(r.customerId)) || autoNumberByVehicle.get(veh) || '';
        return { ...r, autoNumber, _source: 'repayment' };
      });

      // Build a set of loanId for this month already represented by repayments
      const yyyymm = `${sel.getUTCFullYear()}-${String(sel.getUTCMonth()+1).padStart(2,'0')}`;
      const paidLoanKeys = new Set(
        (repsForMonth || [])
          .filter(r => r.loanId != null)
          .map(r => `${r.loanId}:${yyyymm}`)
      );

      // From loans, add "virtual" dues where dueDay matches the selected day and not yet in paidLoanKeys
      const day = sel.getUTCDate();
      const loanDueRows = (loans || [])
        .filter(l => l.dueDay != null && Number(l.dueDay) === day)
        .filter(l => !paidLoanKeys.has(`${l.id}:${yyyymm}`))
        .map(l => {
          const veh = String(l.vehicleNumber || '').toUpperCase();
          const autoNumber = (l.customerId != null && autoNumberByCustomerId.get(l.customerId)) || autoNumberByVehicle.get(veh) || '';
          const emi = (l.emiAmount != null && l.emiAmount !== '')
            ? Number(l.emiAmount)
            : (l.amount && l.tenure ? Number(l.amount) / Number(l.tenure || 1) : null);
          const dueDate = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
          return {
            id: `loan-${l.id}-${yyyymm}`,
            loanId: l.id,
            customerId: l.customerId ?? null,
            autoNumber,
            customerName: l.customerName || '',
            customerPhone: l.customerPhone || '',
            vehicleNumber: l.vehicleNumber || '',
            dueDate,
            dueAmount: emi != null && isFinite(emi) ? Math.round(emi) : null,
            fine: 0,
            paidAmount: 0,
            paymentDate: null,
            _source: 'loan'
          };
        });

      const merged = [...loanDueRows, ...withId];
      setRows(merged);
    } catch (e) {
      console.error('Failed to load due report', e);
      setMessage({ type: 'error', text: 'Failed to load due report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleDateChangeInline = (id, value) => {
    setEditing(prev => ({ ...prev, [id]: value }));
  };

  const saveDueDate = async (row) => {
    const newDateStr = editing[row.id];
    if (!newDateStr) return;
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const iso = new Date(`${newDateStr}T00:00:00.000Z`).toISOString();
      if (row._source === 'loan') {
        // Create a repayment entry on the new date for this loan's EMI
        await repaymentsApi.create({
          vehicleNumber: row.vehicleNumber,
          customerId: row.customerId ?? row.autoNumber ?? null,
          customerName: row.customerName || '',
          contact: row.customerPhone || '',
          loanId: row.loanId,
          dueDate: iso,
          dueAmount: Number(row.dueAmount || 0),
          fine: 0,
          paidAmount: 0,
          pendingAmount: Number(row.dueAmount || 0),
          remarks: 'Adjusted due date',
        });
        // Remove the original virtual row from current date view immediately
        setRows(prev => prev.filter(r => r.id !== row.id));
      } else {
        await repaymentsApi.update(row.id, { dueDate: iso });
      }
      setMessage({ type: 'success', text: 'Due date updated successfully' });
      setEditing(prev => ({ ...prev, [row.id]: undefined }));
    } catch (e) {
      console.error('Failed to update due date', e);
      setMessage({ type: 'error', text: 'Failed to update due date. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Due Report</h1>
        <p className="text-gray-500 mt-1">View and adjust due dates. Changes move the EMI to the new day.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-4 flex items-end gap-4">
        <div className="flex-1 max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </div>
        <Button onClick={load} className="bg-blue-600 hover:bg-blue-700" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {message.text && (
        <div className={`p-3 rounded border text-sm ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.autoNumber || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.customerName || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.vehicleNumber || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{Number(r.dueAmount || 0).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <Input
                    type="date"
                    value={editing[r.id] ?? format(new Date(r.dueDate), 'yyyy-MM-dd')}
                    onChange={(e) => handleDateChangeInline(r.id, e.target.value)}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <Button onClick={() => saveDueDate(r)} disabled={loading || !editing[r.id]} className="bg-blue-600 hover:bg-blue-700">
                    Save
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-500">No dues found for this date.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
