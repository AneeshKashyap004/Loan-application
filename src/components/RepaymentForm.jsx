import React, { useState, useEffect } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Alert, AlertDescription, AlertTitle } from './ui/Alert';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { repaymentsApi, loansApi, customersApi } from '@/api/client';
import { CustomerSearch } from './CustomerSearch';
import { format } from 'date-fns';
import { formatDateDMY } from '@/utils/date';
import { DateInputDMY } from './ui/DateInputDMY';

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
  const [countNextMonth, setCountNextMonth] = useState(false);
  const [remainingAmount, setRemainingAmount] = useState(null);
  const [dueToday, setDueToday] = useState([]);
  const [duesMode, setDuesMode] = useState('dueDay');
  const [customers, setCustomers] = useState([]);
  const [promisedEditing, setPromisedEditing] = useState({});
  const [promisedSaving, setPromisedSaving] = useState({});
  const [remarkSaving, setRemarkSaving] = useState({});
  const [duesDate, setDuesDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [remarkDraft, setRemarkDraft] = useState({});
  
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
        const start = new Date(`${duesDate}T00:00:00.000Z`).toISOString();
        const end = new Date(`${duesDate}T23:59:59.999Z`).toISOString();
        const sel = new Date(duesDate);
        const yyyymm = `${sel.getUTCFullYear()}-${String(sel.getUTCMonth()+1).padStart(2,'0')}`;
        const [custs, dues, loans, repsForMonth, repsUpToSelected] = await Promise.all([
          customersApi.list(),
          repaymentsApi.listByRange(start, end),
          loansApi.list(),
          repaymentsApi.listByRange(new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString(), new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()),
          repaymentsApi.listByRange(new Date('1970-01-01T00:00:00.000Z').toISOString(), new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()),
        ]);
        setCustomers(custs);
        const unpaid = (dues || []).filter(d => Number(d.isPaid) === 0);
        // Build a map of loanId -> total paidAmount in this month
        const paidSumByLoanForMonth = new Map();
        const anyRepLoanIdsForMonth = new Set();
        (repsForMonth || []).forEach(r => {
          if (r.loanId == null) return;
          const key = String(r.loanId);
          anyRepLoanIdsForMonth.add(key);
          paidSumByLoanForMonth.set(key, (paidSumByLoanForMonth.get(key) || 0) + (Number(r.paidAmount) || 0));
        });
        const day = sel.getUTCDate();
        // Build paid months map up to selected month end
        const paidMonthsByLoan = new Map();
        // Build total paid up to selected month end
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
      setCountNextMonth(false);

        function monthsBetweenInclusiveUTC(fromIso, toIso) {
          const a = new Date(fromIso);
          const b = new Date(toIso);
          return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
        }

        const virtualRows = (loans || [])
          .filter(l => l.dueDay != null && Number(l.dueDay) === day)
          // If any repayment record exists in this month for the loan, do not generate a virtual row
          .filter(l => !anyRepLoanIdsForMonth.has(String(l.id)))
          // Exclude loans that are closed or fully settled up to this month end
          .filter(l => {
            if (String(l.status || '').toLowerCase() === 'closed') return false;
            const totalPaid = totalPaidByLoan.get(String(l.id)) || 0;
            if (l.amount != null && Number(totalPaid) >= Number(l.amount)) return false;
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
            const dueDateIso = new Date(`${duesDate}T00:00:00.000Z`).toISOString();
            const baseEmi = (l.emiAmount != null && l.emiAmount !== '') ? Number(l.emiAmount) : (l.amount && l.tenure ? Number(l.amount) / Number(l.tenure || 1) : null);
            let missed = 0;
            try {
              if (baseEmi != null && isFinite(baseEmi) && l.loanDate) {
                const paidSet = paidMonthsByLoan.get(String(l.id)) || new Set();
                const due = new Date(dueDateIso);
                const loanStart = new Date(l.loanDate);
                const firstDueYear = loanStart.getUTCFullYear() + Math.floor((loanStart.getUTCMonth()+1)/12);
                const firstDueMonth = (loanStart.getUTCMonth()+1) % 12;
                const fromYear = firstDueYear;
                const fromMonth = firstDueMonth;
                const toYear = due.getUTCFullYear();
                const toMonth = due.getUTCMonth();
                const diff = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
                if (diff > 0) {
                  for (let i = 0; i < diff; i++) {
                    const y = fromYear + Math.floor((fromMonth + i) / 12);
                    const m = (fromMonth + i) % 12;
                    const key = `${y}-${String(m+1).padStart(2,'0')}`;
                    if (!paidSet.has(key)) missed++;
                  }
                }
              }
            } catch {}
            if (missed <= 0) return null;
            return {
              id: `loan-${l.id}-${yyyymm}`,
              loanId: l.id,
              customerId: l.customerId ?? null,
              customerName: l.customerName || '',
              vehicleNumber: l.vehicleNumber || '',
              dueDate: dueDateIso,
              dueAmount: baseEmi != null && isFinite(baseEmi) ? Math.round(baseEmi * Math.max(1, missed)) : null,
              fine: 0,
              paidAmount: 0,
              isPaid: 0,
              remarks: '',
            };
          })
          .filter(Boolean);
        const combined = duesMode === 'actual' ? unpaid : ([...(virtualRows || []), ...unpaid]);
        const pick = new Map();
        for (const r of combined) {
          const key = `${String(r.loanId ?? '')}|${r.dueDate}`;
          const isActual = !String(r.id).startsWith('loan-');
          const prev = pick.get(key);
          if (!prev) pick.set(key, r);
          else {
            const prevIsActual = !String(prev.id).startsWith('loan-');
            if (isActual && !prevIsActual) pick.set(key, r);
          }
        }
        setDueToday(Array.from(pick.values()));
      } catch (e) {
        console.error('Failed to load dues/customers', e);
      }
    };
    loadDueAndCustomers();
  }, [duesDate, duesMode]);

  const reloadDueToday = async () => {
    try {
      const start = new Date(`${duesDate}T00:00:00.000Z`).toISOString();
      const end = new Date(`${duesDate}T23:59:59.999Z`).toISOString();
      const sel = new Date(duesDate);
      const yyyymm = `${sel.getUTCFullYear()}-${String(sel.getUTCMonth()+1).padStart(2,'0')}`;
      const [custs, dues, loans, repsForMonth, repsUpToSelected] = await Promise.all([
        customersApi.list(),
        repaymentsApi.listByRange(start, end),
        loansApi.list(),
        repaymentsApi.listByRange(new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString(), new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()),
        repaymentsApi.listByRange(new Date('1970-01-01T00:00:00.000Z').toISOString(), new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()),
      ]);
      setCustomers(custs);
      const unpaid = (dues || []).filter(d => Number(d.isPaid) === 0);
      // Build a map of loanId -> total paidAmount in this month
      const paidSumByLoanForMonth = new Map();
      const anyRepLoanIdsForMonth = new Set();
      (repsForMonth || []).forEach(r => {
        if (r.loanId == null) return;
        const key = String(r.loanId);
        anyRepLoanIdsForMonth.add(key);
        paidSumByLoanForMonth.set(key, (paidSumByLoanForMonth.get(key) || 0) + (Number(r.paidAmount) || 0));
      });
      const day = sel.getUTCDate();
      // Build paid months map up to selected month end
      const paidMonthsByLoan = new Map();
      // Build total paid up to selected month end
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
        return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()) + 1;
      }

      const virtualRows = (loans || [])
        .filter(l => l.dueDay != null && Number(l.dueDay) === day)
        // If any repayment record exists in this month for the loan, do not generate a virtual row
        .filter(l => !anyRepLoanIdsForMonth.has(String(l.id)))
        // Exclude loans that are closed or fully settled up to this month end
        .filter(l => {
          if (String(l.status || '').toLowerCase() === 'closed') return false;
          const totalPaid = totalPaidByLoan.get(String(l.id)) || 0;
          if (l.amount != null && Number(totalPaid) >= Number(l.amount)) return false;
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
          const dueDateIso = new Date(`${duesDate}T00:00:00.000Z`).toISOString();
          const baseEmi = (l.emiAmount != null && l.emiAmount !== '') ? Number(l.emiAmount) : (l.amount && l.tenure ? Number(l.amount) / Number(l.tenure || 1) : null);
          let missed = 0;
          try {
            if (baseEmi != null && isFinite(baseEmi) && l.loanDate) {
              const paidSet = paidMonthsByLoan.get(String(l.id)) || new Set();
              const due = new Date(dueDateIso);
              const loanStart = new Date(l.loanDate);
              const firstDueYear = loanStart.getUTCFullYear() + Math.floor((loanStart.getUTCMonth()+1)/12);
              const firstDueMonth = (loanStart.getUTCMonth()+1) % 12;
              const fromYear = firstDueYear;
              const fromMonth = firstDueMonth;
              const toYear = due.getUTCFullYear();
              const toMonth = due.getUTCMonth();
              const diff = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
              if (diff > 0) {
                for (let i = 0; i < diff; i++) {
                  const y = fromYear + Math.floor((fromMonth + i) / 12);
                  const m = (fromMonth + i) % 12;
                  const key = `${y}-${String(m+1).padStart(2,'0')}`;
                  if (!paidSet.has(key)) missed++;
                }
              }
            }
          } catch {}
          if (missed <= 0) return null;
          return {
            id: `loan-${l.id}-${yyyymm}`,
            loanId: l.id,
            customerId: l.customerId ?? null,
            customerName: l.customerName || '',
            vehicleNumber: l.vehicleNumber || '',
            dueDate: dueDateIso,
            dueAmount: baseEmi != null && isFinite(baseEmi) ? Math.round(baseEmi * Math.max(1, missed)) : null,
            fine: 0,
            paidAmount: 0,
            isPaid: 0,
            remarks: '',
          };
        })
        .filter(Boolean);
      const combined = duesMode === 'actual' ? unpaid : ([...(virtualRows || []), ...unpaid]);
      const pick = new Map();
      for (const r of combined) {
        const key = `${String(r.loanId ?? '')}|${r.dueDate}`;
        const isActual = !String(r.id).startsWith('loan-');
        const prev = pick.get(key);
        if (!prev) pick.set(key, r);
        else {
          const prevIsActual = !String(prev.id).startsWith('loan-');
          if (isActual && !prevIsActual) pick.set(key, r);
        }
      }
      setDueToday(Array.from(pick.values()));
    } catch (e) { console.error(e); }
  };

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
          if (remaining <= 0) {
            setIsLoanClosed(true);
            setFormData(prev => ({ ...prev, dueAmount: '0' }));
          }
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
        setMessage({ type: 'success', text: 'All amount cleared for this loan.' });
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

      // If user wants to count this payment toward next month, set dueDate to next month's due day
      let dueDateToSend = new Date(formData.dueDate);
      if (countNextMonth && selectedLoanId) {
        const loan = (customerLoans || []).find(l => String(l.id) === String(selectedLoanId));
        if (loan && loan.dueDay != null) {
          const d = new Date(formData.dueDate);
          const y = d.getUTCFullYear();
          const m = d.getUTCMonth();
          const next = new Date(Date.UTC(y, m + 1, Math.min(Number(loan.dueDay) || 1, 28), 0, 0, 0));
          dueDateToSend = next;
        }
      }

      // Save to server (SQLite)
      await repaymentsApi.create({
        vehicleNumber: formData.vehicleNumber,
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerName: formData.customerName,
        contact: formData.contact,
        loanId: selectedLoanId || null,
        dueDate: dueDateToSend.toISOString(),
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
              <DateInputDMY name="dueDate" value={formData.dueDate} onChange={handleChange} />
            </div>

            {/* Early payment handling: count toward next month's EMI */}
            {selectedLoanId && (
              <div className="flex items-center gap-2 pt-7">
                <input
                  id="countNextMonth"
                  type="checkbox"
                  checked={countNextMonth}
                  onChange={(e) => setCountNextMonth(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="countNextMonth" className="text-sm text-gray-700 cursor-pointer">
                  Count this payment toward next month's EMI
                </label>
              </div>
            )}

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
          <div className="flex items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dues Date</label>
              <DateInputDMY name="duesDate" value={duesDate} onChange={(e) => setDuesDate(e.target.value)} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 pb-1">Dues</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">View</label>
              <select
                value={duesMode}
                onChange={(e) => setDuesMode(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="dueDay">Due by dueDay</option>
                <option value="actual">Actual repayment entries only</option>
              </select>
            </div>
            <button onClick={() => {
              try {
                const headers = ['Customer ID','Customer','Vehicle','Due Amount','Due Date','Remark'];
                const rows = dueToday.map(r => {
                  const cust = customers.find(c => c.id === r.customerId) || customers.find(c => (c.vehicleNumber || '').toUpperCase() === String(r.vehicleNumber || '').toUpperCase());
                  const autoId = cust?.autoNumber || '';
                  return [
                    autoId,
                    r.customerName || '',
                    r.vehicleNumber || '',
                    String(r.dueAmount ?? ''),
                    formatDateDMY(r.dueDate),
                    r.remarks || ''
                  ];
                });
                const csv = [headers.join(','), ...rows.map(cols => cols.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dues_${duesDate}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { console.error('CSV export failed', e); }
            }} className="text-sm text-blue-600 hover:underline">Download CSV</button>
            <button onClick={reloadDueToday} className="text-sm text-blue-600 hover:underline">Refresh</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50/70">
              <tr className="text-left text-blue-700">
                <th className="py-2 pr-4">Customer ID</th>
                <th className="py-2 pr-4">Customer</th>
                <th className="py-2 pr-4">Vehicle</th>
                <th className="py-2 pr-4">Due Amount</th>
                <th className="py-2 pr-4">Due Date</th>
                <th className="py-2 pr-4">Remark</th>
                <th className="py-2 pr-4">Promised Date</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dueToday.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-4 text-gray-500">No dues for selected date.</td>
                </tr>
              ) : (
                dueToday.map((r) => {
                  const cust = customers.find(c => c.id === r.customerId) || customers.find(c => (c.vehicleNumber || '').toUpperCase() === String(r.vehicleNumber || '').toUpperCase());
                  const autoId = cust?.autoNumber || '';
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50/60">
                      <td className="py-2 pr-4 font-medium">{autoId}</td>
                      <td className="py-2 pr-4">{r.customerName}</td>
                      <td className="py-2 pr-4">{r.vehicleNumber}</td>
                      <td className="py-2 pr-4">₹{Number(r.dueAmount || 0).toLocaleString()}</td>
                      <td className="py-2 pr-4">{formatDateDMY(r.dueDate)}</td>
                      <td className="py-2 pr-4">
                        <Input
                          value={remarkDraft[r.id] ?? (r.remarks || '')}
                          onChange={(e) => setRemarkDraft(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Add remark"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        {promisedEditing[r.id] != null ? (
                          <div>
                            <DateInputDMY
                              name={`promised-${r.id}`}
                              value={promisedEditing[r.id] ?? format(new Date(r.dueDate), 'yyyy-MM-dd')}
                              onChange={(e) => setPromisedEditing(prev => ({ ...prev, [r.id]: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <Button variant="outline" onClick={() => setPromisedEditing(prev => ({ ...prev, [r.id]: format(new Date(r.dueDate), 'yyyy-MM-dd') }))}>Promised Date</Button>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {promisedEditing[r.id] != null ? (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                const newDateStr = promisedEditing[r.id];
                                if (!newDateStr) return;
                                setPromisedSaving(prev => ({ ...prev, [r.id]: true }));
                                try {
                                  const iso = new Date(`${newDateStr}T00:00:00.000Z`).toISOString();
                                  const isVirtual = String(r.id).startsWith('loan-');
                                  const rem = remarkDraft[r.id];

                                  if (isVirtual) {
                                    const dueAmt = Number(r.dueAmount || 0) || 0;

                                    // 🔥 check if repayment already exists for this loan in that month
                                    const d = new Date(iso);
                                    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
                                    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));

                                    const existing = await repaymentsApi.listByRange(
                                      monthStart.toISOString(),
                                      monthEnd.toISOString()
                                    );

                                    const sameLoan = (existing || []).find(x =>
                                      String(x.loanId) === String(r.loanId)
                                    );

                                    if (sameLoan) {
                                      // ✅ update instead of duplicate create
                                      await repaymentsApi.update(sameLoan.id, {
                                        dueDate: iso,
                                        remarks: rem != null ? rem : sameLoan.remarks
                                      });
                                    } else {
                                      // ✅ create only first time
                                      await repaymentsApi.create({
                                        vehicleNumber: r.vehicleNumber || '',
                                        customerId: r.customerId ?? null,
                                        customerName: r.customerName || '',
                                        contact: '',
                                        loanId: r.loanId ?? null,
                                        dueDate: iso,
                                        dueAmount: dueAmt,
                                        fine: Number(r.fine || 0),
                                        paidAmount: 0,
                                        pendingAmount: dueAmt,
                                        isPaid: 0,
                                        remarks: rem != null ? rem : (r.remarks || ''),
                                      });
                                    }
                                  } else {
                                    const payload = { dueDate: iso };
                                    if (rem != null) payload.remarks = rem;
                                    await repaymentsApi.update(r.id, payload);
                                  }

                                  setPromisedEditing(prev => ({ ...prev, [r.id]: undefined }));
                                  await reloadDueToday();
                                } catch (e) {
                                  console.error('Failed to save promised date', e);
                                } finally {
                                  setPromisedSaving(prev => ({ ...prev, [r.id]: false }));
                                }
                              }}
                              disabled={!!promisedSaving[r.id]}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {promisedSaving[r.id] ? 'Saving...' : 'Save'}
                            </Button>
                            <Button variant="outline" onClick={() => setPromisedEditing(prev => ({ ...prev, [r.id]: undefined }))}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={async () => {
                                // Allow saving just the remark without changing date
                                try {
                                  setRemarkSaving(prev => ({ ...prev, [r.id]: true }));
                                  const rem = remarkDraft[r.id];
                                  if (rem == null || rem === r.remarks) return;

                                  const isVirtual = String(r.id).startsWith('loan-');

                                  if (isVirtual) {
                                    const dueAmt = Number(r.dueAmount || 0) || 0;

                                    const d = new Date(r.dueDate);
                                    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
                                    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));

                                    const existing = await repaymentsApi.listByRange(
                                      monthStart.toISOString(),
                                      monthEnd.toISOString()
                                    );

                                    const sameLoan = (existing || []).find(x =>
                                      String(x.loanId) === String(r.loanId)
                                    );

                                    if (sameLoan) {
                                      await repaymentsApi.update(sameLoan.id, { remarks: rem });
                                    } else {
                                      await repaymentsApi.create({
                                        vehicleNumber: r.vehicleNumber || '',
                                        customerId: r.customerId ?? null,
                                        customerName: r.customerName || '',
                                        contact: '',
                                        loanId: r.loanId ?? null,
                                        dueDate: r.dueDate,
                                        dueAmount: dueAmt,
                                        fine: Number(r.fine || 0),
                                        paidAmount: 0,
                                        pendingAmount: dueAmt,
                                        isPaid: 0,
                                        remarks: rem,
                                      });
                                    }
                                  } else {
                                    await repaymentsApi.update(r.id, { remarks: rem });
                                  }

                                  await reloadDueToday();
                                } catch (e) { console.error('Failed to save remark', e); }
                                finally { setRemarkSaving(prev => ({ ...prev, [r.id]: false })); }
                              }}
                              variant="outline"
                              disabled={!!remarkSaving[r.id]}
                            >Save Remark</Button>
                          </div>
                        )}
                      </td>
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
