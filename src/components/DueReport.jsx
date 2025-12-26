import React, { useEffect, useMemo, useState } from 'react';
import { Input } from './ui/Input';
import { DateInputDMY } from './ui/DateInputDMY';
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
      const [custs, repsForDay, repsForMonth, loans, repsUpToSelected] = await Promise.all([
        customersApi.list(),
        repaymentsApi.listByRange(start, end),
        repaymentsApi.listByRange(monthStart, monthEnd),
        loansApi.list(),
        repaymentsApi.listByRange(new Date('1970-01-01T00:00:00.000Z').toISOString(), monthEnd),
      ]);
      setCustomers(custs);
      // Normalize repayments rows, add autoNumber
      const withId = (repsForDay || []).map(r => {
        const veh = String(r.vehicleNumber || '').toUpperCase();
        const autoNumber = (r.customerId != null && autoNumberByCustomerId.get(r.customerId)) || autoNumberByVehicle.get(veh) || '';
        return { ...r, autoNumber, _source: 'repayment' };
      });

      // Build a map of loanId -> total paidAmount in this month; consider month covered if sum >= base EMI
      const yyyymm = `${sel.getUTCFullYear()}-${String(sel.getUTCMonth()+1).padStart(2,'0')}`;
      const paidSumByLoanForMonth = new Map();
      (repsForMonth || []).forEach(r => {
        if (r.loanId == null) return;
        const key = String(r.loanId);
        paidSumByLoanForMonth.set(key, (paidSumByLoanForMonth.get(key) || 0) + (Number(r.paidAmount) || 0));
      });

      // From loans, add "virtual" dues where dueDay matches the selected day and not yet in paidLoanKeys
      const day = sel.getUTCDate();
      // Build a map of loanId -> Set of paid months (YYYY-MM) up to selected month end
      const paidMonthsByLoan = new Map();
      // Build a map of loanId -> total paid up to selected month end
      const totalPaidByLoan = new Map();
      (repsUpToSelected || []).forEach(r => {
        if (r.loanId == null) return;
        const d = new Date(r.dueDate);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
        const set = paidMonthsByLoan.get(String(r.loanId)) || new Set();
        set.add(key);
        paidMonthsByLoan.set(String(r.loanId), set);
        totalPaidByLoan.set(String(r.loanId), (totalPaidByLoan.get(String(r.loanId)) || 0) + (Number(r.paidAmount) || 0));
      });

      function monthsBetweenInclusiveUTC(fromIso, toIso) {
        const a = new Date(fromIso);
        const b = new Date(toIso);
        const ay = a.getUTCFullYear();
        const am = a.getUTCMonth();
        const by = b.getUTCFullYear();
        const bm = b.getUTCMonth();
        return (by - ay) * 12 + (bm - am) + 1;
      }

      const loanDueRows = (loans || [])
        .filter(l => l.dueDay != null && Number(l.dueDay) === day)
        // Exclude loans that are closed or fully settled up to this month end
        .filter(l => {
          if (String(l.status || '').toLowerCase() === 'closed') return false;
          const totalPaid = totalPaidByLoan.get(String(l.id)) || 0;
          if (l.amount != null) {
            const amt = Number(l.amount);
            if (Number(totalPaid) >= amt - 1 /* tolerance */) return false;
          }
          // Also exclude if tenure months already covered
          try {
            if (l.tenure != null && l.loanDate) {
              const due = new Date(monthEnd);
              const loanStart = new Date(l.loanDate);
              const firstDueYear = loanStart.getUTCFullYear() + Math.floor((loanStart.getUTCMonth()+1)/12);
              const firstDueMonth = (loanStart.getUTCMonth()+1) % 12;
              const fromYear = firstDueYear;
              const fromMonth = firstDueMonth;
              const toYear = due.getUTCFullYear();
              const toMonth = due.getUTCMonth();
              const diff = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
              const paidSet = paidMonthsByLoan.get(String(l.id)) || new Set();
              if (paidSet.size >= Number(l.tenure)) return false;
              if (diff > Number(l.tenure)) {
                // Past tenure end, treat as completed
                return false;
              }
            }
          } catch {}
          return true;
        })
        .filter(l => {
          const baseEmi = (l.emiAmount != null && l.emiAmount !== '')
            ? Number(l.emiAmount)
            : (l.amount && l.tenure ? Number(l.amount) / Number(l.tenure || 1) : null);
          const sumPaid = paidSumByLoanForMonth.get(String(l.id)) || 0;
          return !(baseEmi != null && isFinite(baseEmi) && sumPaid >= baseEmi);
        })
        .map(l => {
          const veh = String(l.vehicleNumber || '').toUpperCase();
          const autoNumber = (l.customerId != null && autoNumberByCustomerId.get(l.customerId)) || autoNumberByVehicle.get(veh) || '';
          const emi = (l.emiAmount != null && l.emiAmount !== '')
            ? Number(l.emiAmount)
            : (l.amount && l.tenure ? Number(l.amount) / Number(l.tenure || 1) : null);
          const dueDate = new Date(`${selectedDate}T00:00:00.000Z`).toISOString();
          // Calculate unpaid months starting from the month AFTER loanDate
          let multiplier = 0;
          try {
            if (emi != null && isFinite(emi) && l.loanDate) {
              const paidSet = paidMonthsByLoan.get(String(l.id)) || new Set();
              const due = new Date(dueDate);
              const loanStart = new Date(l.loanDate);
              const firstDueYear = loanStart.getUTCFullYear() + Math.floor((loanStart.getUTCMonth()+1)/12);
              const firstDueMonth = (loanStart.getUTCMonth()+1) % 12;
              const fromYear = firstDueYear;
              const fromMonth = firstDueMonth;
              const toYear = due.getUTCFullYear();
              const toMonth = due.getUTCMonth();
              const diff = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
              let missed = 0;
              if (diff > 0) {
                for (let i = 0; i < diff; i++) {
                  const y = fromYear + Math.floor((fromMonth + i) / 12);
                  const m = (fromMonth + i) % 12;
                  const key = `${y}-${String(m+1).padStart(2,'0')}`;
                  if (!paidSet.has(key)) missed++;
                }
              }
              multiplier = missed;
            }
          } catch {}
          if (multiplier <= 0) return null; // no EMI due yet in this month
          return {
            id: `loan-${l.id}-${yyyymm}`,
            loanId: l.id,
            customerId: l.customerId ?? null,
            autoNumber,
            customerName: l.customerName || '',
            customerPhone: l.customerPhone || '',
            vehicleNumber: l.vehicleNumber || '',
            dueDate,
            dueAmount: emi != null && isFinite(emi) ? Math.round(emi * Math.max(1, multiplier)) : null,
            baseEmi: emi != null && isFinite(emi) ? Math.round(emi) : null,
            carryoverMultiplier: Math.max(1, multiplier),
            fine: 0,
            paidAmount: 0,
            paymentDate: null,
            _source: 'loan'
          };
        })
        .filter(Boolean);

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
          <DateInputDMY name="selectedDate" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
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
          <thead className="bg-blue-50/70 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Customer ID</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Vehicle</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Due Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Carryover</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 odd:bg-white even:bg-gray-50/60">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.autoNumber || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.customerName || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.vehicleNumber || ''}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{Number(r.dueAmount || 0).toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {r._source === 'loan' && r.baseEmi != null && r.carryoverMultiplier != null
                    ? `${r.carryoverMultiplier}× of ₹${Number(r.baseEmi).toLocaleString()}`
                    : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <DateInputDMY
                    name={`due-${r.id}`}
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
