# 🚀 Quick Start Guide

## Get Started in 3 Steps

### Step 1: Navigate to the webapp folder
```bash
cd /home/aneesh-kashyap/Documents/Loan-lending/Loan-application/webapp
```

### Step 2: Install dependencies (if not already done)
```bash
npm install
```

### Step 3: Start the development server
```bash
npm run dev
```

## 🌐 Access the Application

The application will be running at:
- **Local:** http://localhost:5173
- **Network:** Check your terminal for the network URL

## 📋 What You Can Do

### On the Dashboard
- View statistics (customers, loans, repayments)
- See due date notifications
- Navigate to all modules

### Add Data
1. **Customers:** Click "Customers" → Fill form → Submit
2. **Loan Applications:** Click "Loan Applications" → Fill form → Submit
3. **Repayments:** Click "Repayments" → Fill form → Submit

### Export Reports
1. Click "Reports" on dashboard
2. Select date range
3. Click export button for desired report
4. CSV file downloads automatically

## 🎯 Key Features

✅ **Due Date Alerts** - Automatic notifications on dashboard
✅ **Auto-Calculations** - Pending amount calculates automatically
✅ **Date Filters** - Export data by date range
✅ **Local Storage** - All data stored in your browser
✅ **No Server Needed** - Works completely offline

## 📱 Browser Compatibility

Works best on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔍 Testing the App

### Test Scenario 1: Add a Customer
1. Go to Customers
2. Name: "John Doe"
3. Phone: "9876543210"
4. Dealer: "ABC Motors"
5. Loan Amount: "500000"
6. Check "Documents Verified"
7. Submit

### Test Scenario 2: Add a Repayment with Due Date Today
1. Go to Repayments
2. Vehicle Number: "KA01AB1234"
3. Customer Name: "John Doe"
4. Contact: "9876543210"
5. **Due Date: Select today's date**
6. Due Amount: "50000"
7. Fine: "0"
8. Paid Amount: "0"
9. Submit
10. **Go to Dashboard - You'll see a "Due Today" notification!**

### Test Scenario 3: Export Reports
1. Go to Reports
2. Click "Last 7 Days"
3. Click "Export CSV" on any report
4. Open the downloaded CSV file

## 💡 Tips

- The dev server auto-reloads when you make changes
- Use Ctrl+C in terminal to stop the server
- Press F12 to open browser DevTools for debugging
- Check browser console for any errors

## 📞 Need Help?

Check these files:
- `SETUP.md` - Detailed setup instructions
- `PROJECT_OVERVIEW.md` - Complete feature documentation
- `README.md` - Project information

---

**Ready to go!** 🎉

Your loan management system is now running and ready to use!
