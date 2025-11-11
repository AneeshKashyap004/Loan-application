import React, { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle, Clock, CalendarDays, TrendingUp } from 'lucide-react';
import { customersApi, loansApi, repaymentsApi } from '@/api/client';
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
    reports: 0,
    pendingLoans: 0,
    dueTodayCount: 0,
    totalCollected: 0,
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
      const [customers, loans, repayments, dueToday] = await Promise.all([
        customersApi.list(),
        loansApi.list(),
        repaymentsApi.list(),
        repaymentsApi.dueToday(),
      ]);
      
      const pendingLoans = loans.filter(l => l.status === 'pending').length;
      
      const totalCollected = repayments.reduce((sum, r) => {
        const due = Number(r.dueAmount) || 0;
        const fine = Number(r.fine) || 0;
        const pending = Number(r.pendingAmount) || 0;
        const paid = Number(r.paidAmount) || 0;
        const derived = Math.max(0, (due + fine) - pending);
        return sum + (derived || paid);
      }, 0);

      setAllData({ customers, loans, repayments, dueToday });
      
      setStats({
        totalCustomers: customers.length,
        totalLoans: loans.length,
        reports: 0,
        pendingLoans,
        dueTodayCount: dueToday.length,
        totalCollected,
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
        { key: 'createdAt', header: 'Join Date', format: (date) => new Date(date).toLocaleDateString() }
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
        { key: 'id', header: 'Loan ID' },
        { key: 'customerName', header: 'Customer' },
        { key: 'amount', header: 'Amount', format: (amt) => `₹${Number(amt).toLocaleString()}` },
        { key: 'interestRate', header: 'Interest %' },
        { key: 'status', header: 'Status' },
        { key: 'createdAt', header: 'Date', format: (date) => new Date(date).toLocaleDateString() }
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
        { key: 'disbursementDate', header: 'Disbursed On', format: (date) => date ? new Date(date).toLocaleDateString() : 'N/A' },
        { key: 'repaymentTerm', header: 'Term' }
      ],
      searchKey: 'customerName'
    });
  };

  const showCollectedDetails = () => {
    setModal({
      isOpen: true,
      title: 'All Collections',
      data: allData.repayments,
      columns: [
        { key: 'id', header: 'Receipt #' },
        { key: 'customerName', header: 'Customer' },
        { key: 'dueDate', header: 'Due Date', format: (date) => new Date(date).toLocaleDateString() },
        { key: 'dueAmount', header: 'Due', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'fine', header: 'Fine', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'paidAmount', header: 'Paid', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'paymentDate', header: 'Paid On', format: (date) => date ? new Date(date).toLocaleDateString() : 'Pending' }
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
        { key: 'dueDate', header: 'Due Date', format: (date) => new Date(date).toLocaleDateString() },
        { key: 'dueAmount', header: 'Due Amount', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'paidAmount', header: 'Paid', format: (amt) => `₹${Number(amt || 0).toLocaleString()}` },
        { key: 'paymentDate', header: 'Paid On', format: (date) => date ? new Date(date).toLocaleDateString() : 'Pending' },
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
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
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
          title="Pending Loans"
          value={stats.pendingLoans}
          icon={Clock}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
          onClick={() => showLoanDetails('pending')}
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
          title="Total Collected"
          value={`₹${stats.totalCollected.toLocaleString()}`}
          icon={TrendingUp}
          iconBgColor="bg-teal-100"
          iconColor="text-teal-600"
          onClick={showCollectedDetails}
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