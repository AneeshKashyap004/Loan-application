import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui/Input';
import { customersApi } from '@/api/client';

export function CustomerSearch({ onSelect, value = '' }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchCustomers = async () => {
      if (query.length < 2) {
        setResults([]);
        setShowDropdown(false);
        return;
      }

      setLoading(true);
      try {
        const customers = await customersApi.search(query);
        setResults(customers);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchCustomers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (customer) => {
    setQuery(`${customer.autoNumber} - ${customer.name}`);
    setShowDropdown(false);
    onSelect(customer);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by Customer ID, Name, or Phone..."
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-3 text-sm text-gray-400">Searching...</div>
      )}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => handleSelect(customer)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-900">{customer.name}</div>
                  <div className="text-sm text-gray-600">
                    ID: {customer.autoNumber} • Phone: {customer.phone}
                  </div>
                  <div className="text-xs text-gray-500">Dealer: {customer.dealer}</div>
                </div>
                <div className="text-sm font-medium text-blue-600">
                  ₹{customer.loanAmount}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {showDropdown && results.length === 0 && query.length >= 2 && !loading && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
          No customers found
        </div>
      )}
    </div>
  );
}
