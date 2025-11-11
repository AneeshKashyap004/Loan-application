# LoanFlow - Loan Management System

A professional React-based web application for managing loans, customers, disbursements, and repayments with local database storage.

## Features

- ✅ Customer Management (Name, ID, Phone, Dealer, Loan Amount, Document Verification)
- ✅ Loan Application Tracking (Vehicle, Dealer, Amount, Tenure, Payment Mode)
- ✅ Disbursement Recording & Management
- ✅ Repayment Tracking (Due Dates, Amounts, Fines, Pending Amounts)
- ✅ Advanced Reports with Filters (Disbursement & Demand Reports)
- ✅ CSV Export with Date Filtering
- ✅ Local Database Storage (IndexedDB)
- ✅ Professional Sidebar Navigation
- ✅ Modern Clean UI with TailwindCSS

## Tech Stack

- **React 18** - UI Framework
- **Vite** - Build Tool
- **TailwindCSS** - Styling
- **Dexie.js** - IndexedDB Wrapper
- **Lucide React** - Icons
- **React Router** - Navigation
- **date-fns** - Date Utilities

## Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

1. **Dashboard**: Access all modules from the main dashboard
2. **Customers**: Add and manage customer information
3. **Loan Applications**: Track all loan applications
4. **Repayments**: Manage repayments and due dates
5. **Reports**: Export data in CSV format with date filters

## Database

The application uses IndexedDB for local storage, ensuring all data is stored on your device without requiring a server.

## Notifications

Due date notifications are automatically shown on the dashboard for repayments due today or overdue.
