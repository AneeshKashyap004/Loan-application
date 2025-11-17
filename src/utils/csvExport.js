import { format } from 'date-fns';

// Convert array of objects to CSV string
function convertToCSV(data, headers) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headerRow = headers.join(',');
  const rows = data.map(item => {
    return headers.map(header => {
      const value = item[header] || '';
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value).replace(/"/g, '""');
      return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
}

// Download CSV file
function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export customers to CSV
export function exportCustomersToCSV(customers, startDate = null, endDate = null) {
  let filteredData = customers;
  
  if (startDate && endDate) {
    filteredData = customers.filter(c => {
      const createdDate = new Date(c.createdAt);
      return createdDate >= new Date(startDate) && createdDate <= new Date(endDate);
    });
  }
  
  const headers = ['autoNumber', 'name', 'phone', 'dealer', 'loanAmount', 'documentVerified', 'createdAt'];
  const csvContent = convertToCSV(filteredData, headers);
  
  const dateRange = startDate && endDate 
    ? `_${format(new Date(startDate), 'dd-MM-yyyy')}_to_${format(new Date(endDate), 'dd-MM-yyyy')}`
    : `_${format(new Date(), 'dd-MM-yyyy')}`;
  
  downloadCSV(csvContent, `customers${dateRange}.csv`);
}

// Export loan applications to CSV
export function exportLoanApplicationsToCSV(loanApplications, startDate = null, endDate = null) {
  let filteredData = loanApplications;
  
  if (startDate && endDate) {
    filteredData = loanApplications.filter(la => {
      const loanDate = new Date(la.loanDate);
      return loanDate >= new Date(startDate) && loanDate <= new Date(endDate);
    });
  }
  
  const headers = ['vehicleNumber', 'dealer', 'amount', 'tenure', 'loanDate', 'hoa', 'paymentMode', 'remarks', 'createdAt'];
  const csvContent = convertToCSV(filteredData, headers);
  
  const dateRange = startDate && endDate 
    ? `_${format(new Date(startDate), 'dd-MM-yyyy')}_to_${format(new Date(endDate), 'dd-MM-yyyy')}`
    : `_${format(new Date(), 'dd-MM-yyyy')}`;
  
  downloadCSV(csvContent, `loan_applications${dateRange}.csv`);
}

// Export repayments to CSV
export function exportRepaymentsToCSV(repayments, startDate = null, endDate = null) {
  let filteredData = repayments;
  
  if (startDate && endDate) {
    filteredData = repayments.filter(r => {
      const dueDate = new Date(r.dueDate);
      return dueDate >= new Date(startDate) && dueDate <= new Date(endDate);
    });
  }
  
  const headers = ['vehicleNumber', 'customerName', 'contact', 'dueDate', 'dueAmount', 'fine', 'paidAmount', 'pendingAmount', 'isPaid', 'remarks', 'createdAt'];
  const csvContent = convertToCSV(filteredData, headers);
  
  const dateRange = startDate && endDate 
    ? `_${format(new Date(startDate), 'dd-MM-yyyy')}_to_${format(new Date(endDate), 'dd-MM-yyyy')}`
    : `_${format(new Date(), 'dd-MM-yyyy')}`;
  
  downloadCSV(csvContent, `repayments${dateRange}.csv`);
}

// Export all data to CSV
export function exportAllDataToCSV(customers, loanApplications, repayments, startDate = null, endDate = null) {
  exportCustomersToCSV(customers, startDate, endDate);
  exportLoanApplicationsToCSV(loanApplications, startDate, endDate);
  exportRepaymentsToCSV(repayments, startDate, endDate);
}
