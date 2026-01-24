import React, { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle, Clock, CalendarDays, TrendingUp } from 'lucide-react';
import { customersApi, loansApi, repaymentsApi } from '@/api/client';
import { formatDateDMY } from '@/utils/date';
import { DataModal } from './DataModal';

function StatCard({ title, value, icon: Icon, iconBgColor, iconColor, onClick }) {
  return (
    <div 
      className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${iconBgColor} p-3 rounded-lg`}>
          <Icon className={`h-6 w-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalLoans: 0,
    reports: 'Click here',
    dueTodayCount: 0,
    totalDisbursed: 0,
  });
  
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    data: [],
    columns: [],
    searchKey: ''
  });
  
  const [allData, setAllData] = useState({
    customers: [],
    loans: [],
    repayments: [],
    dueToday: [],
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Build time ranges for "today" in UTC window
      const today = new Date();
      const yyyy = today.getUTCFullYear();
      const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(today.getUTCDate()).padStart(2, '0');
      const yyyymm = `${yyyy}-${mm}`;
      const startIso = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
      const endIso = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`).toISOString();

      const [customers, loans, repayments, duesTodayActual, repsForMonth, repsUpToSelected] = await Promise.all([
        customersApi.list(),
        loansApi.list(),
        repaymentsApi.list(),
        repaymentsApi.listByRange(startIso, endIso),
        // month window
        repaymentsApi.listByRange(
          new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString(),
          new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()
        ),
        // everything up to end of current month (for missed count)
        repaymentsApi.listByRange(
          new Date('1970-01-01T00:00:00.000Z').toISOString(),
          new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()
        ),
      ]);

      // Synthesize virtual dues similar to RepaymentForm
      const unpaidToday = (duesTodayActual || []).filter(d => Number(d.isPaid) === 0);

      const paidSumByLoanForMonth = new Map();
      (repsForMonth || []).forEach(r => {
        if (r.loanId == null) return;
        const key = String(r.loanId);
        paidSumByLoanForMonth.set(key, (paidSumByLoanForMonth.get(key) || 0) + (Number(r.paidAmount) || 0));
      });

      const paidMonthsByLoan = new Map();
      const totalPaidByLoan = new Map();
      (repsUpToSelected || []).forEach(r => {
        if (r.loanId == null) return;
        const d = new Date(r.dueDate);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const set = paidMonthsByLoan.get(String(r.loanId)) || new Set();
        set.add(key);
        paidMonthsByLoan.set(String(r.loanId), set);
        totalPaidByLoan.set(String(r.loanId), (totalPaidByLoan.get(String(r.loanId)) || 0) + (Number(r.paidAmount) || 0));
      });

      const day = today.getUTCDate();
      const virtualRows = (loans || [])
        .filter(l => l.dueDay != null && Number(l.dueDay) === day)
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
          const dueDateIso = startIso;
          const baseEmi = (l.emiAmount != null && l.emiAmount !== '') ? Number(l.emiAmount) : (l.amount && l.tenure ? Number(l.amount) / Number(l.tenure || 1) : null);
          let missed = 0;
          try {
            if (baseEmi != null && isFinite(baseEmi) && l.loanDate) {
              const paidSet = paidMonthsByLoan.get(String(l.id)) || new Set();
              const due = new Date(dueDateIso);
              const loanStart = new Date(l.loanDate);
              const firstDueYear = loanStart.getUTCFullYear() + Math.floor((loanStart.getUTCMonth() + 1) / 12);
              const firstDueMonth = (loanStart.getUTCMonth() + 1) % 12;
              const fromYear = firstDueYear;
              const fromMonth = firstDueMonth;
              const toYear = due.getUTCFullYear();
              const toMonth = due.getUTCMonth();
              const diff = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
              if (diff > 0) {
                for (let i = 0; i < diff; i++) {
                  const y = fromYear + Math.floor((fromMonth + i) / 12);
                  const m = (fromMonth + i) % 12;
                  const key = `${y}-${String(m + 1).padStart(2, '0')}`;
                  if (!paidSet.has(key)) missed++;
                }
              }
            }
          } catch {}
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

      const dueToday = [
        ...(virtualRows || []),
        ...unpaidToday,
      ];

      // Total disbursed = sum of loan amounts
      const totalDisbursed = (loans || []).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

      setAllData({ customers, loans, repayments, dueToday });

      setStats({
        totalCustomers: customers.length,
        totalLoans: loans.length,
        reports: 'Click here',
        dueTodayCount: dueToday.length,
        totalDisbursed,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const showCustomerDetails = () => {
    setModal({
      isOpen: true,
      title: 'All Customers',
      data: allData.customers,
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name' },
        { key: 'phone', header: 'Phone' },
        { key: 'address', header: 'Address' },
        { key: 'createdAt', header: 'Join Date', format: (date) => formatDateDMY(date) }
      ],
      searchKey: 'name'
    });
  };

  const showLoanDetails = (status = null) => {
    const filteredLoans = status 
      ? allData.loans.filter(loan => loan.status === status)
      : allData.loans;

    setModal({
      isOpen: true,
      title: status ? `${status.charAt(0).toUpperCase() + status.slice(1)} Loans` : 'All Loans',
      data: filteredLoans,
      columns: [
        { key: 'customerId', header: 'Customer ID' },
        { key: 'customerName', header: 'Customer' },
        { key: 'vehicleNumber', header: 'Vehicle' },
        { key: 'amount', header: 'Amount', format: (amt) => `₹${Number(amt).toLocaleString()}` },
        { key: 'hoa', header: 'HOA' },
        { key: 'loanDate', header: 'Due Date', format: (date) => formatDateDMY(date) }
      ],
      searchKey: 'customerName'
    });
  };

  const showDisbursedDetails = () => {
    const disbursedLoans = allData.loans.filter(loan => loan.status === 'approved');
    
    setModal({
      isOpen: true,
      title: 'Disbursed Loans',
      data: disbursedLoans,
      columns: [
        { key: 'id', header: 'Loan ID' },
        { key: 'customerName', header: 'Customer' },
        { key: 'amount', header: 'Amount', format: (amt) => `₹${Number(amt).toLocaleString()}` },
       // { key: 'disbursementDate', header: 'Disbursed On', format: (date) => date ? formatDateDMY(date) : 'N/A' },
        { key: 'repaymentTerm', header: 'Term' }
      ],
      searchKey: 'customerName'
    });
  };

  const showTotalDisbursedDetails = () => {
    // Show loans: Customer details and Loan Date
    setModal({
      isOpen: true,
      title: 'Total Disbursed - Loans',
      data: allData.loans,
      columns: [
        { key: 'customerId', header: 'Customer ID' },
        { key: 'customerName', header: 'Customer' },
        { key: 'vehicleNumber', header: 'Vehicle' },
        { key: 'amount', header: 'Amount', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'loanDate', header: 'Loan Date', format: (date) => date ? formatDateDMY(date) : '—' },
      ],
      searchKey: 'customerName'
    });
  };

  const showDueTodayDetails = () => {
    // Build a map for customerId -> autoNumber and also vehicleNumber -> autoNumber as fallback
    const autoIdByCustomerId = new Map();
    const autoIdByVehicle = new Map();
    (allData.customers || []).forEach(c => {
      if (c.id != null) autoIdByCustomerId.set(c.id, c.autoNumber || '');
      if (c.vehicleNumber) autoIdByVehicle.set(String(c.vehicleNumber).toUpperCase(), c.autoNumber || '');
    });

    const rows = (allData.dueToday || []).map(r => {
      const veh = String(r.vehicleNumber || '').toUpperCase();
      const autoNumber = (r.customerId != null && autoIdByCustomerId.get(r.customerId)) || autoIdByVehicle.get(veh) || '';
      return { ...r, autoNumber };
    });

    setModal({
      isOpen: true,
      title: 'Due Today',
      data: rows,
      columns: [
        { key: 'autoNumber', header: 'Customer ID' },
        { key: 'customerName', header: 'Customer' },
        { key: 'vehicleNumber', header: 'Vehicle' },
        { key: 'dueDate', header: 'Due Date', format: (date) => formatDateDMY(date) },
        { key: 'dueAmount', header: 'Due Amount', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'paidAmount', header: 'Paid', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'paymentDate', header: 'Paid On', format: (date) => date ? formatDateDMY(date) : 'Pending' },
      ],
      searchKey: 'customerName'
    });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">DEEPAK BANK</h1>
        <p className="text-gray-500 mt-1">Welcome back! Here's your loan management overview.</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          icon={Users}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
          onClick={showCustomerDetails}
        />
        <StatCard
          title="Total Loans"
          value={stats.totalLoans}
          icon={FileText}
          iconBgColor="bg-purple-100"
          iconColor="text-purple-600"
          onClick={() => showLoanDetails()}
        />
        <StatCard
          title="Reports"
          value={stats.reports}
          icon={CheckCircle}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          onClick={() => window.location.href = '/reports'}
        />
        <StatCard
          title="Due Today"
          value={stats.dueTodayCount}
          icon={CalendarDays}
          iconBgColor="bg-indigo-100"
          iconColor="text-indigo-600"
          onClick={showDueTodayDetails}
        />
        <StatCard
          title="Total Disbursed"
          value={`₹${stats.totalDisbursed.toLocaleString()}`}
          icon={TrendingUp}
          iconBgColor="bg-teal-100"
          iconColor="text-teal-600"
          onClick={showTotalDisbursedDetails}
        />
      </div>

      {/* Data Modal */}
      <DataModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        data={modal.data}
        columns={modal.columns}
        searchKey={modal.searchKey}
      />
    </div>
  );
}