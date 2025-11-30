import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { plaidAPI, transactionAPI, insightsAPI } from '../services/api';
import ExpensesChart from './ExpensesChart';
import './FinancialOverview.css';

function FinancialOverview({ refreshKey = 0 }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bankConnections, setBankConnections] = useState([]);
  const [transactionsPeriod, setTransactionsPeriod] = useState('last-30-days');
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [chartTransactions, setChartTransactions] = useState([]);
  const [chartTransactionsLoading, setChartTransactionsLoading] = useState(false);
  const [insight, setInsight] = useState(null);
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightError, setInsightError] = useState('');
  const [syncingTransactions, setSyncingTransactions] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [insightSuccess, setInsightSuccess] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [refreshKey]);

  useEffect(() => {
    setCurrentPage(1);
    fetchTransactions(transactionsPeriod, 1);
    fetchChartTransactions(transactionsPeriod);
  }, [transactionsPeriod, refreshKey]);

  useEffect(() => {
    fetchInsight();
  }, [refreshKey]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      const response = await plaidAPI.getAccounts();
      setAccounts(response.data.accounts || []);
      setBankConnections(response.data.bankConnections || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // Only set error for actual errors (not 404 or empty responses)
      // If it's a 404 or the user simply has no accounts, that's fine
      if (error.response?.status !== 404 && error.response?.status !== 401) {
        setError('Failed to load account information');
      } else {
        // User has no accounts yet - this is normal, not an error
        setAccounts([]);
        setBankConnections([]);
      }
    } finally {
      setLoading(false);
    }
  };


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
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    return { startDate, endDate };
  };

  const fetchTransactions = async (period, page = 1) => {
    try {
      setTransactionsLoading(true);
      
      const { startDate, endDate } = calculateDateRange(period);

      // Fetch 20 transactions per page
      const limit = 20;
      const skip = (page - 1) * limit;

      // Use cached transactions API
      const response = await transactionAPI.getCachedTransactions({
        startDate,
        endDate,
        limit,
        skip
      });

      if (response.data.success) {
        const data = response.data.data;
        setTransactions(data.transactions || []);
        setTotalTransactions(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(page);
      } else {
        console.error('Failed to fetch cached transactions:', response.data.message);
        setTransactions([]);
        setTotalTransactions(0);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
      setTotalTransactions(0);
      setTotalPages(1);
      setCurrentPage(1);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchChartTransactions = async (period) => {
    try {
      setChartTransactionsLoading(true);
      
      const { startDate, endDate } = calculateDateRange(period);

      // Fetch all transactions for the chart (no pagination)
      const response = await transactionAPI.getCachedTransactions({
        startDate,
        endDate,
        limit: 1000, // Get up to 1000 transactions for the chart
        skip: 0
      });

      if (response.data.success) {
        const data = response.data.data;
        setChartTransactions(data.transactions || []);
      } else {
        console.error('Failed to fetch chart transactions:', response.data.message);
        setChartTransactions([]);
      }
    } catch (error) {
      console.error('Error fetching chart transactions:', error);
      setChartTransactions([]);
    } finally {
      setChartTransactionsLoading(false);
    }
  };

  const fetchInsight = async () => {
    try {
      setInsightLoading(true);
      setInsightError('');
      const response = await insightsAPI.getLatestInsight();
      if (response.data?.success) {
        setInsight(response.data.data);
      } else if (response.data?.data) {
        setInsight(response.data.data);
      } else {
        setInsight(null);
        setInsightError('Unable to load AI insights at this time.');
      }
    } catch (err) {
      console.error('Error fetching AI insights:', err);
      setInsight(null);
      setInsightError('Unable to load AI insights at this time.');
    } finally {
      setInsightLoading(false);
    }
  };

  const handleTransactionsPeriodChange = (value) => {
    setTransactionsPeriod(value);
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    fetchTransactions(transactionsPeriod, newPage);
  };

  const handleSyncTransactions = async () => {
    try {
      setSyncingTransactions(true);
      setSyncError('');
      
      console.log('[INFO] Syncing transactions...');
      
      // Start both the API call and a minimum delay timer
      const syncPromise = transactionAPI.triggerManualSync();
      const delayPromise = new Promise(resolve => setTimeout(resolve, 5000));
      
      // Wait for both to complete
      const [response] = await Promise.all([syncPromise, delayPromise]);
      
      if (response.data.success) {
        console.log('[INFO] Transaction sync completed successfully');
        
        // Refresh transactions and accounts
        await Promise.all([
          fetchTransactions(transactionsPeriod, 1),
          fetchChartTransactions(transactionsPeriod),
          fetchAccounts()
        ]);
        
        // Show success popup
        setSyncSuccess(true);
        setTimeout(() => {
          setSyncSuccess(false);
        }, 3000);
      } else {
        throw new Error(response.data.message || 'Failed to sync transactions');
      }
    } catch (error) {
      console.error('Error syncing transactions:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to sync transactions';
      setSyncError(errorMessage);
    } finally {
      setSyncingTransactions(false);
    }
  };

  const handleGenerateInsights = async () => {
    try {
      setGeneratingInsights(true);
      setSyncError('');
      
      console.log('[INFO] Generating AI insights...');
      const response = await insightsAPI.generateInsights();
      
      if (response.data.success) {
        console.log('[INFO] AI insights generated successfully');
        
        // Refresh insights
        await fetchInsight();
        
        // Show success popup
        setInsightSuccess(true);
        setTimeout(() => {
          setInsightSuccess(false);
        }, 3000);
      } else {
        throw new Error(response.data.message || 'Failed to generate insights');
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to generate AI insights';
      setSyncError(errorMessage);
    } finally {
      setGeneratingInsights(false);
    }
  };

  const getTotalBalance = () => {
    if (!accounts || !Array.isArray(accounts)) return 0;
    return accounts.reduce((total, account) => total + (account.balance?.current || 0), 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatMetricValue = (metric) => {
    if (!metric) return '—';
    if (metric.displayValue) return metric.displayValue;
    if (typeof metric.value === 'number') {
      return formatCurrency(metric.value);
    }
    return '—';
  };

  const formatGeneratedTime = (timestamp) => {
    if (!timestamp) return null;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  if (loading) {
    return (
      <div className="financial-overview">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your financial overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="financial-overview">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchAccounts} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="financial-overview">
      <div className="overview-header">
        <h2>Financial Overview</h2>
        <p>Your complete financial picture at a glance</p>
      </div>

      {(syncingTransactions || generatingInsights || syncSuccess || insightSuccess) && (
        <div className="popup-container">
          {syncingTransactions && (
            <div className="sync-loading-popup">
              <div className="sync-popup-content">
                <div className="popup-spinner"></div>
                <div className="popup-text">
                  <h4>Syncing Transactions</h4>
                  <p>Fetching transactions from your bank accounts...</p>
                </div>
              </div>
            </div>
          )}

          {generatingInsights && (
            <div className="sync-loading-popup">
              <div className="sync-popup-content">
                <div className="popup-spinner"></div>
                <div className="popup-text">
                  <h4>Generating Insights</h4>
                  <p>Analyzing your financial data with AI...</p>
                </div>
              </div>
            </div>
          )}

          {syncSuccess && (
            <div className="sync-success-popup">
              <div className="sync-popup-content success">
                <div className="popup-success-icon">✓</div>
                <div className="popup-text">
                  <h4>Transactions Synced</h4>
                  <p>Your transactions have been updated successfully!</p>
                </div>
              </div>
            </div>
          )}

          {insightSuccess && (
            <div className="sync-success-popup">
              <div className="sync-popup-content success">
                <div className="popup-success-icon">✓</div>
                <div className="popup-text">
                  <h4>Insights Generated</h4>
                  <p>AI insights have been generated successfully!</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {syncError && (
        <div className="error-message" style={{ 
          padding: '12px', 
          margin: '16px 0', 
          backgroundColor: '#fee', 
          border: '1px solid #fcc',
          borderRadius: '8px',
          color: '#c33'
        }}>
          {syncError}
        </div>
      )}

      {/* Connected Banks Section */}
      <div className="connected-banks-section">
        <div className="connected-banks-header">
          <h3>Connected Banks</h3>
        </div>
        <div className="connected-banks-list">
          {bankConnections.map((bank, index) => (
            <div key={index} className="bank-card">
              <div className="bank-info">
                <h4>{bank.institutionName}</h4>
              </div>
              <div className="bank-status">
                <span>Connected</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="balance-summary">
        <div className="total-balance">
          <h3>Total Balance</h3>
          <div className={`balance-amount ${getTotalBalance() > 0 ? 'positive' : getTotalBalance() < 0 ? 'negative' : 'zero'}`}>
            {getTotalBalance() > 0 ? '+' : getTotalBalance() < 0 ? '' : ''}{formatCurrency(getTotalBalance())}
          </div>
        </div>
        <div className="balance-breakdown">
          <div className="balance-item">
            <span className="balance-label">Available</span>
            <span className="balance-value">
              {formatCurrency(accounts && Array.isArray(accounts) ? accounts.reduce((total, account) => 
                total + (account.balance?.available || 0), 0) : 0)}
            </span>
          </div>
          <div className="balance-item">
            <span className="balance-label">Accounts</span>
            <span className="balance-value">{accounts ? accounts.length : 0}</span>
          </div>
        </div>
      </div>

      <div className="accounts-transactions-section">
        <div className="analytics-grid">
          {/* View Accounts Widget */}
          <div className="analytics-widget accounts-widget">
            <div className="widget-header">
              <div className="widget-info">
                <div className="widget-title">
                  <h4>Accounts</h4>
                  <p>Review your connected accounts</p>
                </div>
              </div>
            </div>
            <div className="widget-content">
              {loading ? (
                <div className="transactions-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading accounts...</span>
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="transactions-table-container">
                  <div className="transactions-info">
                    <span>Showing {accounts.length} accounts</span>
                  </div>
                  <div className="transactions-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Account Name</th>
                          <th>Account Number</th>
                          <th>Type</th>
                          <th>Balance</th>
                          <th>Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map((account) => (
                          <tr key={account.accountId}>
                            <td className="transaction-date">{account.name}</td>
                            <td className="transaction-description">•••• {account.mask}</td>
                            <td className="transaction-category">
                              {account.subtype.charAt(0).toUpperCase() + account.subtype.slice(1)}
                            </td>
                            <td className={`transaction-amount ${account.balance.current >= 0 ? 'income' : 'expense'}`}>
                              {formatCurrency(account.balance.current || 0)}
                            </td>
                            <td className={`transaction-amount ${account.balance.available >= 0 ? 'income' : 'expense'}`}>
                              {formatCurrency(account.balance.available || 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="no-data-message">
                  No accounts found
                </div>
              )}
            </div>
          </div>

          {/* View Transactions Widget */}
          <div className="analytics-widget transactions-widget">
            <div className="widget-header">
              <div className="widget-info">
                <div className="widget-title">
                  <h4>Transactions</h4>
                  <p>Review your recent financial activity</p>
                </div>
              </div>
              <div className="widget-actions">
                <button 
                  className="widget-action-btn" 
                  onClick={handleSyncTransactions}
                  disabled={syncingTransactions}
                >
                  {syncingTransactions ? (
                    <>
                      <span className="btn-spinner"></span>
                      Syncing...
                    </>
                  ) : (
                    'Sync Transactions'
                  )}
                </button>
                <select 
                  value={transactionsPeriod} 
                  onChange={(e) => handleTransactionsPeriodChange(e.target.value)}
                  className="period-dropdown"
                >
                  <option value="last-7-days">Last 7 days</option>
                  <option value="last-30-days">Last 30 days</option>
                  <option value="last-60-days">Last 60 days</option>
                </select>
              </div>
            </div>
            <div className="widget-content">
              {transactionsLoading ? (
                <div className="transactions-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading transactions...</span>
                </div>
              ) : transactions.length > 0 ? (
                <div className="transactions-table-container">
                  <div className="transactions-info">
                    <span>Showing {transactions.length} transactions out of {totalTransactions} transactions</span>
                  </div>
                  <div className="transactions-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Category</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((transaction) => (
                          <tr key={transaction.transaction_id}>
                            <td className="transaction-date">
                              {new Date(transaction.date).toLocaleDateString()}
                            </td>
                            <td className="transaction-description">
                              <div className="transaction-name">{transaction.name}</div>
                              {transaction.merchant_name && (
                                <div className="transaction-merchant">{transaction.merchant_name}</div>
                              )}
                            </td>
                            <td className="transaction-category">
                              {transaction.category && transaction.category.join(' > ')}
                            </td>
                            <td className={`transaction-amount ${transaction.amount > 0 ? 'expense' : 'income'}`}>
                              {transaction.amount > 0 ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="transactions-pagination">
                      <button 
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || transactionsLoading}
                        className="pagination-btn"
                      >
                        Previous
                      </button>
                      <span className="pagination-info">
                        {currentPage}/{totalPages}
                      </span>
                      <button 
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || transactionsLoading}
                        className="pagination-btn"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="no-data-message">
                  No transactions found for this period
                </div>
              )}
            </div>
          </div>

          {/* Expenses Chart Widget */}
          <div className="analytics-widget expenses-chart-widget">
            <div className="widget-header">
              <div className="widget-info">
                <div className="widget-title">
                  <h4>Expenses Over Time</h4>
                  <p>Track your spending trends</p>
                </div>
              </div>
            </div>
            <div className="widget-content">
              {chartTransactionsLoading ? (
                <div className="transactions-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading chart data...</span>
                </div>
              ) : (
                <ExpensesChart transactions={chartTransactions} period={transactionsPeriod} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="ai-analytics-section">
        <div className="ai-analytics-header">
          <div className="ai-analytics-title">
            <h3>AI Analytics and Insights</h3>
            <p>Personalized guidance generated from your synced data</p>
          </div>
          <div className="ai-analytics-actions">
            <div className="ai-analytics-actions-group">
              <button 
                className="generate-insights-btn" 
                onClick={handleGenerateInsights}
                disabled={generatingInsights}
              >
                {generatingInsights ? (
                  <>
                    <span className="btn-spinner"></span>
                    Generating...
                  </>
                ) : (
                  'Generate Insights'
                )}
              </button>
              {insightLoading && (
                <span className="ai-analytics-status-inline">Updating insights…</span>
              )}
              {!insightLoading && insight?.generatedAt && (
                <span className="ai-analytics-status-inline">Last updated {formatGeneratedTime(insight.generatedAt)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="ai-insight-card">
          {insightLoading ? (
            <div className="insight-loading">
              <div className="loading-spinner"></div>
              <span>Compiling your latest insights…</span>
            </div>
          ) : insightError ? (
            <div className="insight-error">
              <p>{insightError}</p>
              <button className="retry-btn" onClick={fetchInsight}>
                Try Again
              </button>
            </div>
          ) : !insight ? (
            <div className="no-data-message">
              <p>No financial data available for analysis. Connect your accounts to get personalized AI insights and recommendations.</p>
            </div>
          ) : (
            <div className="insight-content">
              <div className="insight-summary">
                <h4>{insight.summary?.headline}</h4>
                <p>{insight.summary?.narrative}</p>
              </div>

              {Array.isArray(insight.keyMetrics) && insight.keyMetrics.length > 0 && (
                <div className="insight-metrics">
                  {insight.keyMetrics.map((metric, index) => (
                    <div key={`${metric.label}-${index}`} className="insight-metric">
                      <span className="metric-label">{metric.label}</span>
                      <span className="metric-value">{formatMetricValue(metric)}</span>
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(insight.highlights) && insight.highlights.length > 0 && (
                <div className="insight-highlights">
                  <h5>Highlights</h5>
                  <ul>
                    {insight.highlights.map((item, index) => (
                      <li key={`highlight-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {Array.isArray(insight.recommendations) && insight.recommendations.length > 0 && (
                <div className="insight-recommendations">
                  <h5>Recommendations</h5>
                  <div className="recommendation-list">
                    {insight.recommendations.map((rec, index) => (
                      <div key={`rec-${index}`} className="recommendation-item">
                        <div className="recommendation-title">{rec.title}</div>
                        <div className="recommendation-detail">{rec.detail}</div>
                        <div className="recommendation-meta">
                          {rec.impact && <span className="badge">Impact: {rec.impact}</span>}
                          {rec.action && <span className="badge">Action: {rec.action}</span>}
                          {rec.category && <span className="badge muted">{rec.category}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Array.isArray(insight.alerts) && insight.alerts.length > 0 && (
                <div className="insight-alerts">
                  <h5>Alerts</h5>
                  <ul>
                    {insight.alerts.map((alert, index) => (
                      <li key={`alert-${index}`}>{alert}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(insight.context?.periodDays || insight.context?.transactionCount >= 0) && (
                <div className="insight-footer">
                  {insight.context?.periodDays && (
                    <span>Analysis window: last {insight.context.periodDays} days</span>
                  )}
                  {insight.context?.transactionCount >= 0 && (
                    <span>
                      Transactions analyzed: {insight.context.transactionCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

FinancialOverview.propTypes = {
  refreshKey: PropTypes.number,
};

export default FinancialOverview;
