import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Users,
  DollarSign,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Activity,
  Database,
  Download,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  PieChart
} from 'lucide-react';

// Types
interface OverviewKPIs {
  users: {
    total: number;
    active: number;
    new_today: number;
    new_this_month: number;
    active_rate: number;
  };
  subscriptions: {
    active: number;
    conversion_rate: number;
  };
  revenue: {
    this_month: number;
    last_month: number;
    growth_percent: number;
    mrr: number;
  };
  engagement: {
    total_chats: number;
    chats_today: number;
    total_messages: number;
    messages_today: number;
    avg_messages_per_chat: number;
  };
  teams: {
    total: number;
  };
}

interface ChartData {
  date: string;
  count?: number;
  amount?: number;
}

// API Functions
const API_BASE = '/api';

async function fetchOverview(): Promise<OverviewKPIs> {
  const res = await fetch(`${API_BASE}/analytics/overview`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Failed to fetch overview');
  return res.json();
}

async function fetchUserAnalytics(days: number) {
  const res = await fetch(`${API_BASE}/analytics/users?days=${days}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Failed to fetch user analytics');
  return res.json();
}

async function fetchRevenueAnalytics(days: number) {
  const res = await fetch(`${API_BASE}/analytics/revenue?days=${days}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Failed to fetch revenue analytics');
  return res.json();
}

async function fetchEngagementAnalytics(days: number) {
  const res = await fetch(`${API_BASE}/analytics/engagement?days=${days}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });
  if (!res.ok) throw new Error('Failed to fetch engagement analytics');
  return res.json();
}

// Components
function KPICard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  color,
  subValue
}: {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: string;
  subValue?: string;
}) {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-gray-400 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      {subValue && <p className="text-gray-500 text-sm mt-1">{subValue}</p>}
      {changeLabel && <p className="text-gray-500 text-xs mt-2">{changeLabel}</p>}
    </div>
  );
}

function MiniChart({ data, type = 'bar' }: { data: ChartData[]; type?: 'bar' | 'line' }) {
  if (!data || data.length === 0) {
    return <div className="h-20 flex items-center justify-center text-gray-500">No data</div>;
  }
  
  const values = data.map(d => d.count ?? d.amount ?? 0);
  const max = Math.max(...values, 1);
  
  return (
    <div className="h-20 flex items-end gap-1">
      {data.slice(-14).map((d, i) => {
        const value = d.count ?? d.amount ?? 0;
        const height = (value / max) * 100;
        return (
          <div
            key={i}
            className="flex-1 bg-blue-500 rounded-t opacity-70 hover:opacity-100 transition-opacity"
            style={{ height: `${Math.max(height, 2)}%` }}
            title={`${d.date}: ${value}`}
          />
        );
      })}
    </div>
  );
}

function DataTable({
  title,
  headers,
  rows,
  emptyMessage = 'No data available'
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  emptyMessage?: string;
}) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-750">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-8 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-750">
                  {row.map((cell, j) => (
                    <td key={j} className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function AdminDashboard() {
  const [overview, setOverview] = useState<OverviewKPIs | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<any>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<any>(null);
  const [engagementAnalytics, setEngagementAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'revenue' | 'engagement'>('overview');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, userData, revenueData, engagementData] = await Promise.all([
        fetchOverview(),
        fetchUserAnalytics(dateRange),
        fetchRevenueAnalytics(dateRange),
        fetchEngagementAnalytics(dateRange)
      ]);
      setOverview(overviewData);
      setUserAnalytics(userData);
      setRevenueAnalytics(revenueData);
      setEngagementAnalytics(engagementData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">Monitor your platform's performance</p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['overview', 'users', 'revenue', 'engagement'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KPICard
              title="Total Users"
              value={formatNumber(overview.users.total)}
              change={overview.users.active_rate}
              changeLabel={`${overview.users.new_today} new today`}
              icon={Users}
              color="bg-blue-600"
              subValue={`${overview.users.active} active`}
            />
            <KPICard
              title="Monthly Revenue"
              value={formatCurrency(overview.revenue.this_month)}
              change={overview.revenue.growth_percent}
              changeLabel="vs last month"
              icon={DollarSign}
              color="bg-green-600"
              subValue={`MRR: ${formatCurrency(overview.revenue.mrr)}`}
            />
            <KPICard
              title="Active Subscriptions"
              value={formatNumber(overview.subscriptions.active)}
              change={overview.subscriptions.conversion_rate}
              changeLabel="conversion rate"
              icon={Target}
              color="bg-purple-600"
            />
            <KPICard
              title="Total Messages"
              value={formatNumber(overview.engagement.total_messages)}
              icon={MessageSquare}
              color="bg-orange-600"
              subValue={`${overview.engagement.messages_today} today`}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">User Signups</h3>
              <MiniChart data={userAnalytics?.daily_signups || []} />
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Daily Revenue</h3>
              <MiniChart data={revenueAnalytics?.daily_revenue || []} />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Chats</p>
              <p className="text-xl font-bold text-white">{formatNumber(overview.engagement.total_chats)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Total Teams</p>
              <p className="text-xl font-bold text-white">{formatNumber(overview.teams.total)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">Avg Messages/Chat</p>
              <p className="text-xl font-bold text-white">{overview.engagement.avg_messages_per_chat}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <p className="text-gray-400 text-sm">New This Month</p>
              <p className="text-xl font-bold text-white">{formatNumber(overview.users.new_this_month)}</p>
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && userAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPICard
              title="Retention Rate"
              value={`${userAnalytics.retention_rate}%`}
              icon={Activity}
              color="bg-blue-600"
            />
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 md:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4">Daily Signups</h3>
              <MiniChart data={userAnalytics.daily_signups} />
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Users by Tier</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(userAnalytics.users_by_tier || {}).map(([tier, count]) => (
                <div key={tier} className="text-center p-4 bg-gray-750 rounded-lg">
                  <p className="text-gray-400 text-sm capitalize">{tier}</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(count as number)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && revenueAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <KPICard
              title="ARPU"
              value={formatCurrency(revenueAnalytics.arpu)}
              icon={DollarSign}
              color="bg-green-600"
            />
            <KPICard
              title="LTV"
              value={formatCurrency(revenueAnalytics.ltv)}
              icon={TrendingUp}
              color="bg-blue-600"
            />
            <KPICard
              title="Success Rate"
              value={`${revenueAnalytics.payment_stats?.success_rate || 0}%`}
              icon={Target}
              color="bg-purple-600"
            />
            <KPICard
              title="Failed Payments"
              value={revenueAnalytics.payment_stats?.failed?.count || 0}
              icon={TrendingDown}
              color="bg-red-600"
            />
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend</h3>
            <MiniChart data={revenueAnalytics.daily_revenue} />
          </div>

          <DataTable
            title="MRR Trend"
            headers={['Date', 'MRR']}
            rows={(revenueAnalytics.mrr_trend || []).map((d: any) => [
              d.date,
              formatCurrency(d.mrr)
            ])}
          />
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === 'engagement' && engagementAnalytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KPICard
              title="Avg Messages/Day"
              value={engagementAnalytics.chat_activity?.avg_messages_per_day || 0}
              icon={MessageSquare}
              color="bg-orange-600"
            />
            <KPICard
              title="Plugin Executions"
              value={formatNumber(engagementAnalytics.feature_usage?.plugin_executions || 0)}
              icon={Zap}
              color="bg-purple-600"
            />
            <KPICard
              title="Model Comparisons"
              value={formatNumber(engagementAnalytics.feature_usage?.model_comparisons || 0)}
              icon={BarChart3}
              color="bg-blue-600"
            />
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Daily Active Users</h3>
            <MiniChart data={engagementAnalytics.daily_active_users} />
          </div>

          <DataTable
            title="Top Users by Activity"
            headers={['Username', 'Email', 'Messages']}
            rows={(engagementAnalytics.top_users || []).map((u: any) => [
              u.username,
              u.email,
              formatNumber(u.message_count)
            ])}
          />
        </div>
      )}
    </div>
  );
}
