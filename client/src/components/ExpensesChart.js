import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import './ExpensesChart.css';

function ExpensesChart({ transactions, period, onDateRangeChange }) {
  const [chartType, setChartType] = useState('area'); // 'area' or 'line'
  const [grouping, setGrouping] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Calculate date range helper
  const calculateDateRange = (period) => {
    const endDate = new Date().toISOString().split('T')[0];
    let startDate;
    
    switch (period) {
      case 'last-7-days':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last-30-days':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last-60-days':
        startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last-90-days':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    return { startDate, endDate };
  };

  // Initialize date range from period
  useEffect(() => {
    const { startDate: calculatedStart, endDate: calculatedEnd } = calculateDateRange(period);
    setStartDate(calculatedStart);
    setEndDate(calculatedEnd);
  }, [period]);

  // Process transactions to aggregate expenses by date
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Filter only expenses (positive amounts are expenses in Plaid)
    let expenses = transactions.filter(t => t.amount > 0);

    // Apply date range filter if custom dates are set
    if (startDate && endDate) {
      expenses = expenses.filter(t => {
        const transactionDate = t.date;
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Group by date/week/month based on grouping option
    const grouped = {};
    
    expenses.forEach(transaction => {
      let key;
      const date = new Date(transaction.date);
      
      if (grouping === 'daily') {
        key = transaction.date;
      } else if (grouping === 'weekly') {
        // Get the start of the week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (grouping === 'monthly') {
        // Get the start of the month
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      }
      
      if (!grouped[key]) {
        grouped[key] = 0;
      }
      grouped[key] += transaction.amount;
    });

    // Convert to array and sort by date
    const data = Object.keys(grouped)
      .map(key => ({
        date: key,
        expenses: grouped[key],
        formattedDate: formatDateForGrouping(key, grouping)
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    return data;
  }, [transactions, startDate, endDate, grouping]);

  const totalExpenses = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.expenses, 0);
  }, [chartData]);

  const averageDailyExpenses = useMemo(() => {
    if (chartData.length === 0) return 0;
    return totalExpenses / chartData.length;
  }, [chartData, totalExpenses]);

  // Custom tooltip formatter
  const formatTooltipValue = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Format date for display based on grouping
  function formatDateForGrouping(dateString, groupingType) {
    const date = new Date(dateString);
    
    if (groupingType === 'daily') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (groupingType === 'weekly') {
      const weekEnd = new Date(date);
      weekEnd.setDate(date.getDate() + 6);
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else if (groupingType === 'monthly') {
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const handleStartDateChange = (e) => {
    setStartDate(e.target.value);
    if (onDateRangeChange) {
      onDateRangeChange({ startDate: e.target.value, endDate });
    }
  };

  const handleEndDateChange = (e) => {
    setEndDate(e.target.value);
    if (onDateRangeChange) {
      onDateRangeChange({ startDate, endDate: e.target.value });
    }
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="expenses-chart-widget">
        <div className="no-data-message">
          No transaction data available for this period
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="expenses-chart-widget">
        <div className="no-data-message">
          No expenses found for this period
        </div>
      </div>
    );
  }

  const ChartComponent = chartType === 'area' ? AreaChart : LineChart;
  const DataComponent = chartType === 'area' ? Area : Line;

  return (
    <div className="expenses-chart-widget">
      <div className="chart-header">
        <div className="chart-stats">
          <div className="stat-item">
            <span className="stat-label">Total Expenses</span>
            <span className="stat-value">{formatTooltipValue(totalExpenses)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{grouping === 'daily' ? 'Daily' : grouping === 'weekly' ? 'Weekly' : 'Monthly'} Average</span>
            <span className="stat-value">{formatTooltipValue(averageDailyExpenses)}</span>
          </div>
        </div>
        <div className="chart-controls">
          <div className="control-group">
            <label htmlFor="chart-start-date">Start Date:</label>
            <input
              id="chart-start-date"
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="date-input"
            />
          </div>
          <div className="control-group">
            <label htmlFor="chart-end-date">End Date:</label>
            <input
              id="chart-end-date"
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="date-input"
            />
          </div>
          <div className="control-group">
            <label htmlFor="chart-grouping">Group By:</label>
            <select
              id="chart-grouping"
              value={grouping}
              onChange={(e) => setGrouping(e.target.value)}
              className="chart-select"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="control-group">
            <label htmlFor="chart-type">Chart Type:</label>
            <select
              id="chart-type"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              className="chart-select"
            >
              <option value="area">Area</option>
              <option value="line">Line</option>
            </select>
          </div>
        </div>
      </div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={300}>
          <ChartComponent data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            {chartType === 'area' && (
              <defs>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                </linearGradient>
              </defs>
            )}
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="formattedDate" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px'
              }}
              labelStyle={{ color: '#374151', fontWeight: 600, marginBottom: '4px' }}
              formatter={(value) => formatTooltipValue(value)}
            />
            {chartType === 'area' ? (
              <Area
                type="linear"
                dataKey="expenses"
                stroke="#dc2626"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorExpenses)"
              />
            ) : (
              <Line
                type="linear"
                dataKey="expenses"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ fill: '#dc2626', r: 3 }}
                activeDot={{ r: 5 }}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

ExpensesChart.propTypes = {
  transactions: PropTypes.arrayOf(PropTypes.shape({
    date: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
  })),
  period: PropTypes.string,
  onDateRangeChange: PropTypes.func,
};

export default ExpensesChart;

