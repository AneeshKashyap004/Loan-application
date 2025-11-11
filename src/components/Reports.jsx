import React, { useState, useEffect } from 'react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Download } from 'lucide-react';
import { customersApi, loansApi, repaymentsApi } from '@/api/client';
import { 
  exportCustomersToCSV, 
  exportLoanApplicationsToCSV, 
  exportRepaymentsToCSV
} from '@/utils/csvExport';
import { format } from 'date-fns';

export function Reports() {
  const [activeTab, setActiveTab] = useState('disbursement');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    customerName: '',
  });

  const [data, setData] = useState({
    customers: [],
    loanApplications: [],
    repayments: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const customers = await customersApi.list();
      const loanApplications = await loansApi.list();
      const repayments = await repaymentsApi.list();
      setData({ customers, loanApplications, repayments });
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleGenerateReport = async () => {
    const start = filters.startDate ? new Date(filters.startDate).toISOString() : null;
    const end = filters.endDate ? new Date(filters.endDate).toISOString() : null;

    try {
      let loans = data.loanApplications;
      let reps = data.repayments;

      if (start && end) {
        loans = await loansApi.listByRange(start, end);
        reps = await repaymentsApi.listByRange(start, end);
      }

      if (activeTab === 'disbursement') {
        exportLoanApplicationsToCSV(loans, start, end);
      } else {
        exportRepaymentsToCSV(reps, start, end);
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate disbursement and demand reports</p>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-8">
          <button
            onClick={() => setActiveTab('disbursement')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'disbursement'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Disbursement Report
          </button>
          <button
            onClick={() => setActiveTab('demand')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'demand'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Demand Report
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {activeTab === 'disbursement' ? 'Disbursement' : 'Demand'} Report Filters
          </h3>
          <p className="text-sm text-gray-500">
            Filter {activeTab === 'disbursement' ? 'disbursements' : 'demands'} by date range and customer
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <Input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              placeholder="dd-mm-yyyy"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <Input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              placeholder="dd-mm-yyyy"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name
            </label>
            <Input
              type="text"
              name="customerName"
              value={filters.customerName}
              onChange={handleFilterChange}
              placeholder="Search by customer"
            />
          </div>
        </div>

        <Button onClick={handleGenerateReport} className="bg-blue-600 hover:bg-blue-700">
          <Download className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>
    </div>
  );
}
