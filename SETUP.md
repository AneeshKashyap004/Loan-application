# Setup Instructions

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn

## Installation Steps

1. **Navigate to the webapp directory:**
   ```bash
   cd webapp
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   The app will be available at `http://localhost:5173` (or the port shown in your terminal)

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
npm run preview
```

## Features Overview

### 1. Dashboard
- View statistics (total customers, loans, repayments)
- Due date notifications for today's repayments
- Overdue payment alerts
- Quick navigation to all modules

### 2. Customer Management
- Add customer details
- Auto-generated customer ID
- Document verification tracking
- Phone validation

### 3. Loan Applications
- Track vehicle loans
- Record dealer information
- Payment mode tracking (Cash/Bank Transfer/Cheque)
- Date picker for loan dates

### 4. Repayment Management
- Track due dates
- Automatic pending amount calculation
- Fine tracking
- Payment status tracking

### 5. Due Date Notifications
- Automatic alerts for today's due dates
- Overdue payment warnings
- Customer contact information displayed

### 6. Reports & CSV Export
- Export customers data
- Export loan applications
- Export repayments
- Filter by date range (daily, weekly, monthly, yearly)
- Quick date range presets

## Database

The application uses **IndexedDB** (via Dexie.js) for local storage. All data is stored in your browser:
- No server required
- Data persists across sessions
- Privacy-focused (data never leaves your device)

## Browser Compatibility

Works on all modern browsers that support:
- IndexedDB
- ES6+
- CSS Grid/Flexbox

Recommended browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Port already in use
If port 5173 is already in use, Vite will automatically use the next available port.

### Database errors
Clear your browser's IndexedDB if you encounter data issues:
1. Open DevTools (F12)
2. Go to Application/Storage tab
3. Find IndexedDB > LoanManagementDB
4. Delete the database

### Dependencies not installing
Try deleting `node_modules` and `package-lock.json`, then run `npm install` again.

## Technology Stack

- **React 18** - UI library
- **Vite** - Build tool & dev server
- **React Router** - Navigation
- **TailwindCSS** - Styling
- **Dexie.js** - IndexedDB wrapper
- **date-fns** - Date utilities
- **Lucide React** - Icons

## Project Structure

```
webapp/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── Dashboard.jsx    # Main dashboard
│   │   ├── CustomerForm.jsx
│   │   ├── LoanApplicationForm.jsx
│   │   ├── RepaymentForm.jsx
│   │   └── Reports.jsx
│   ├── db/
│   │   └── database.js      # IndexedDB setup
│   ├── utils/
│   │   ├── csvExport.js     # CSV export utilities
│   │   └── cn.js            # Tailwind utilities
│   ├── App.jsx              # Main app component
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles
├── public/
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Support

For issues or questions, check the browser console for error messages.
