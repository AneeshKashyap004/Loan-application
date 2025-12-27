import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { CustomerForm } from './components/CustomerForm';
import { LoanApplicationForm } from './components/LoanApplicationForm';
import { RepaymentForm } from './components/RepaymentForm';
import { Reports } from './components/Reports';
import { DueReport } from './components/DueReport';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  CreditCard, 
  TrendingUp, 
  BarChart3,
  LogOut,
  CalendarDays
} from 'lucide-react';
import { cn } from './utils/cn';

function Sidebar() {
  const navItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Loans', path: '/loans', icon: FileText },
    { name: 'Due Report', path: '/due-report', icon: CalendarDays },
    { name: 'Repayments', path: '/repayments', icon: TrendingUp },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
  ];

  return (
    <div className="w-64 bg-white border-r min-h-screen flex flex-col">
      {/* Logo / Brand */}
      <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-blue-500">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
            <LayoutDashboard className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Deepak Bank</h1>
            <p className="text-xs text-blue-100">Loan Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center space-x-3 px-4 py-3 rounded-lg transition-all',
                      isActive
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-blue-600 font-semibold">A</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">admin</p>
            <p className="text-xs text-gray-500">admin@admin.com</p>
          </div>
        </div>
        <button className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 text-sm w-full px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-white via-blue-50 to-white">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 border-b">
          <div className="px-8 py-4">
            <h2 className="text-lg font-semibold text-gray-800">Deepak Bank LoanPortal</h2>
          </div>
        </div>
        {/* Page container */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomerForm />} />
          <Route path="/loans" element={<LoanApplicationForm />} />
          <Route path="/due-report" element={<DueReport />} />
          <Route path="/repayments" element={<RepaymentForm />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
