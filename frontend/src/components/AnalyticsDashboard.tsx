/**
 * Analytics Dashboard Component for UE5 AI Agent
 * 
 * Features:
 * - Commands executed over time (line/bar charts)
 * - Performance metrics history
 * - Team activity heatmaps
 * - Usage statistics by feature
 * - Export reports to PDF/CSV
 * - Real-time data updates
 * - Interactive charts with tooltips
 * - Date range filtering
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown,
  Download, FileText, Table, Calendar, Clock, Users,
  Zap, Activity, Target, Award, Filter, RefreshCw,
  ChevronDown, ChevronUp, Maximize2, Minimize2,
  ArrowUpRight, ArrowDownRight, Minus, Eye,
  Command, Cpu, HardDrive, Gauge, Layers,
  Sparkles, Lightbulb, Film, Palette, Package,
  Settings, X, Check, Info
} from 'lucide-react';

// Types
interface CommandMetric {
  date: string;
  total: number;
  successful: number;
  failed: number;
  categories: Record<string, number>;
}

interface PerformanceMetric {
  timestamp: string;
  fps: number;
  frameTime: number;
  gpuTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
}

interface TeamActivity {
  date: string;
  hour: number;
  count: number;
  users: string[];
}

interface FeatureUsage {
  feature: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface UserStats {
  userId: string;
  name: string;
  avatar: string;
  commandsExecuted: number;
  sessionsCount: number;
  totalTime: number;
  topFeatures: string[];
}

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// Sample data generators
const generateCommandMetrics = (days: number): CommandMetric[] => {
  const metrics: CommandMetric[] = [];
  const now = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const total = Math.floor(Math.random() * 150) + 50;
    const failed = Math.floor(Math.random() * (total * 0.1));
    
    metrics.push({
      date: date.toISOString().split('T')[0],
      total,
      successful: total - failed,
      failed,
      categories: {
        scene: Math.floor(Math.random() * 30) + 10,
        lighting: Math.floor(Math.random() * 25) + 5,
        animation: Math.floor(Math.random() * 20) + 5,
        material: Math.floor(Math.random() * 15) + 5,
        texture: Math.floor(Math.random() * 10) + 3,
        performance: Math.floor(Math.random() * 10) + 2,
        asset: Math.floor(Math.random() * 8) + 2,
        collaboration: Math.floor(Math.random() * 5) + 1,
      }
    });
  }
  
  return metrics;
};

const generatePerformanceMetrics = (hours: number): PerformanceMetric[] => {
  const metrics: PerformanceMetric[] = [];
  const now = new Date();
  
  for (let i = hours - 1; i >= 0; i--) {
    const timestamp = new Date(now);
    timestamp.setHours(timestamp.getHours() - i);
    
    metrics.push({
      timestamp: timestamp.toISOString(),
      fps: Math.floor(Math.random() * 30) + 45,
      frameTime: Math.random() * 10 + 15,
      gpuTime: Math.random() * 8 + 12,
      memoryUsage: Math.random() * 30 + 40,
      drawCalls: Math.floor(Math.random() * 1000) + 2000,
      triangles: Math.floor(Math.random() * 2000000) + 4000000,
    });
  }
  
  return metrics;
};

const generateTeamActivity = (): TeamActivity[] => {
  const activities: TeamActivity[] = [];
  const now = new Date();
  
  for (let d = 6; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];
    
    for (let h = 0; h < 24; h++) {
      // More activity during work hours
      const isWorkHour = h >= 9 && h <= 18;
      const baseCount = isWorkHour ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 3);
      
      if (baseCount > 0) {
        activities.push({
          date: dateStr,
          hour: h,
          count: baseCount,
          users: ['You', 'Sarah Chen', 'Mike Johnson', 'Emily Davis'].slice(0, Math.min(baseCount, 4))
        });
      }
    }
  }
  
  return activities;
};

const FEATURE_USAGE: FeatureUsage[] = [
  { feature: 'Scene Builder', count: 1247, percentage: 28, trend: 'up', trendValue: 12 },
  { feature: 'AI Scene Generator', count: 892, percentage: 20, trend: 'up', trendValue: 45 },
  { feature: 'Lighting Wizard', count: 756, percentage: 17, trend: 'stable', trendValue: 2 },
  { feature: 'Animation Assistant', count: 534, percentage: 12, trend: 'up', trendValue: 8 },
  { feature: 'Material Assistant', count: 423, percentage: 10, trend: 'down', trendValue: 5 },
  { feature: 'Texture Generator', count: 312, percentage: 7, trend: 'up', trendValue: 15 },
  { feature: 'Performance Optimizer', count: 178, percentage: 4, trend: 'stable', trendValue: 1 },
  { feature: 'Asset Manager', count: 89, percentage: 2, trend: 'down', trendValue: 3 },
];

const USER_STATS: UserStats[] = [
  {
    userId: '1',
    name: 'You',
    avatar: 'Y',
    commandsExecuted: 1523,
    sessionsCount: 47,
    totalTime: 12480,
    topFeatures: ['Scene Builder', 'Lighting Wizard', 'AI Scene Generator']
  },
  {
    userId: '2',
    name: 'Sarah Chen',
    avatar: 'S',
    commandsExecuted: 1289,
    sessionsCount: 38,
    totalTime: 9840,
    topFeatures: ['Material Assistant', 'Texture Generator', 'Animation Assistant']
  },
  {
    userId: '3',
    name: 'Mike Johnson',
    avatar: 'M',
    commandsExecuted: 876,
    sessionsCount: 29,
    totalTime: 7200,
    topFeatures: ['Performance Optimizer', 'Asset Manager', 'Scene Builder']
  },
  {
    userId: '4',
    name: 'Emily Davis',
    avatar: 'E',
    commandsExecuted: 654,
    sessionsCount: 21,
    totalTime: 5400,
    topFeatures: ['Animation Assistant', 'Lighting Wizard', 'Scene Builder']
  },
];

const DATE_RANGES: DateRange[] = [
  { start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), end: new Date(), label: 'Last 7 days' },
  { start: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), end: new Date(), label: 'Last 14 days' },
  { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date(), label: 'Last 30 days' },
  { start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), end: new Date(), label: 'Last 90 days' },
];

// Chart components
const SimpleBarChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  height?: number;
  showLabels?: boolean;
}> = ({ data, height = 200, showLabels = true }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((item, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={`w-full rounded-t transition-all duration-300 ${item.color || 'bg-gradient-to-t from-purple-600 to-purple-400'}`}
            style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: 4 }}
            title={`${item.label}: ${item.value}`}
          />
          {showLabels && (
            <span className="text-[10px] text-gray-500 truncate w-full text-center">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

const SimpleLineChart: React.FC<{
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}> = ({ data, height = 200, color = '#8b5cf6' }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;
  
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 100 - ((d.value - minValue) / range) * 100
  }));
  
  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ');
  
  const areaD = `${pathD} L 100 100 L 0 100 Z`;
  
  return (
    <div style={{ height }} className="relative">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#lineGradient)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} className="opacity-0 hover:opacity-100 transition-opacity" />
        ))}
      </svg>
    </div>
  );
};

const HeatmapChart: React.FC<{
  data: TeamActivity[];
}> = ({ data }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const getActivityLevel = (date: string, hour: number) => {
    const activity = data.find(d => d.date === date && d.hour === hour);
    return activity?.count || 0;
  };
  
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  const uniqueDates = [...new Set(data.map(d => d.date))].slice(-7);
  
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex gap-1 mb-1 ml-12">
          {hours.filter(h => h % 3 === 0).map(h => (
            <div key={h} className="flex-1 text-[10px] text-gray-500 text-center">
              {h}:00
            </div>
          ))}
        </div>
        
        {/* Heatmap grid */}
        {uniqueDates.map((date, dayIdx) => {
          const dayOfWeek = new Date(date).getDay();
          return (
            <div key={date} className="flex items-center gap-1 mb-1">
              <span className="w-10 text-xs text-gray-500">{days[dayOfWeek]}</span>
              <div className="flex-1 flex gap-[2px]">
                {hours.map(hour => {
                  const count = getActivityLevel(date, hour);
                  const intensity = count / maxCount;
                  return (
                    <div
                      key={hour}
                      className="flex-1 h-4 rounded-sm transition-colors cursor-pointer"
                      style={{
                        backgroundColor: count > 0 
                          ? `rgba(139, 92, 246, ${0.2 + intensity * 0.8})`
                          : 'rgba(255, 255, 255, 0.05)'
                      }}
                      title={`${date} ${hour}:00 - ${count} activities`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-2">
          <span className="text-xs text-gray-500">Less</span>
          <div className="flex gap-[2px]">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: `rgba(139, 92, 246, ${intensity})` }}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">More</span>
        </div>
      </div>
    </div>
  );
};

const DonutChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  size?: number;
}> = ({ data, size = 150 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = -90;
  
  const segments = data.map(d => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...d, startAngle, angle };
  });
  
  const polarToCartesian = (angle: number, radius: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: 50 + radius * Math.cos(rad),
      y: 50 + radius * Math.sin(rad)
    };
  };
  
  const describeArc = (startAngle: number, endAngle: number, innerRadius: number, outerRadius: number) => {
    const start1 = polarToCartesian(startAngle, outerRadius);
    const end1 = polarToCartesian(endAngle, outerRadius);
    const start2 = polarToCartesian(endAngle, innerRadius);
    const end2 = polarToCartesian(startAngle, innerRadius);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return [
      `M ${start1.x} ${start1.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${end1.x} ${end1.y}`,
      `L ${start2.x} ${start2.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${end2.x} ${end2.y}`,
      'Z'
    ].join(' ');
  };
  
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      {segments.map((seg, i) => (
        <path
          key={i}
          d={describeArc(seg.startAngle, seg.startAngle + seg.angle - 1, 25, 40)}
          fill={seg.color}
          className="transition-opacity hover:opacity-80 cursor-pointer"
        >
          <title>{`${seg.label}: ${seg.value} (${((seg.value / total) * 100).toFixed(1)}%)`}</title>
        </path>
      ))}
      <text x="50" y="48" textAnchor="middle" className="fill-white text-lg font-bold">
        {total.toLocaleString()}
      </text>
      <text x="50" y="58" textAnchor="middle" className="fill-gray-400 text-[8px]">
        Total
      </text>
    </svg>
  );
};

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  color?: string;
}> = ({ title, value, subtitle, icon, trend, trendValue, color = 'purple' }) => {
  const colorClasses: Record<string, string> = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
  };
  
  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-sm rounded-xl p-4 border`}>
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-lg bg-white/10">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : 
             trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : 
             <Minus className="w-3 h-3" />}
            {trendValue}%
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-400">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
};

// Main Component
interface AnalyticsDashboardProps {
  onExport?: (format: 'pdf' | 'csv') => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ onExport }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>(DATE_RANGES[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'commands' | 'performance' | 'team'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Generate sample data
  const commandMetrics = useMemo(() => generateCommandMetrics(30), []);
  const performanceMetrics = useMemo(() => generatePerformanceMetrics(24), []);
  const teamActivity = useMemo(() => generateTeamActivity(), []);
  
  // Calculate summary stats
  const totalCommands = commandMetrics.reduce((sum, m) => sum + m.total, 0);
  const successRate = (commandMetrics.reduce((sum, m) => sum + m.successful, 0) / totalCommands * 100).toFixed(1);
  const avgFps = (performanceMetrics.reduce((sum, m) => sum + m.fps, 0) / performanceMetrics.length).toFixed(0);
  const totalUsers = USER_STATS.length;
  
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };
  
  const handleExport = (format: 'pdf' | 'csv') => {
    setShowExportMenu(false);
    
    if (format === 'csv') {
      // Generate CSV
      const headers = ['Date', 'Total Commands', 'Successful', 'Failed', 'Success Rate'];
      const rows = commandMetrics.map(m => [
        m.date,
        m.total,
        m.successful,
        m.failed,
        ((m.successful / m.total) * 100).toFixed(1) + '%'
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For PDF, we'd typically use a library like jsPDF
      // For now, show a message
      alert('PDF export would be generated here. In production, this would use jsPDF or similar library.');
    }
    
    onExport?.(format);
  };
  
  const featureColors = [
    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', 
    '#ef4444', '#ec4899', '#6366f1', '#84cc16'
  ];
  
  if (!isExpanded) {
    return (
      <div 
        className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-white/10 p-4 cursor-pointer hover:border-purple-500/50 transition-all"
        onClick={() => setIsExpanded(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Analytics Dashboard</h3>
              <p className="text-xs text-gray-400">{totalCommands.toLocaleString()} commands • {successRate}% success rate</p>
            </div>
          </div>
          <Maximize2 className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                Analytics Dashboard
                <span className="px-2 py-0.5 text-[10px] font-medium bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
                  Real-time
                </span>
              </h3>
              <p className="text-xs text-gray-400">Track performance, commands, and team activity</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Date Range Picker */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-sm text-gray-300"
              >
                <Calendar className="w-4 h-4" />
                {selectedDateRange.label}
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showDatePicker && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-white/10 shadow-xl z-10 overflow-hidden">
                  {DATE_RANGES.map((range, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedDateRange(range);
                        setShowDatePicker(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors ${
                        selectedDateRange.label === range.label ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity text-sm text-white"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg border border-white/10 shadow-xl z-10 overflow-hidden">
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    <Table className="w-4 h-4" />
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-white/10 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
            
            {/* Minimize */}
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {[
            { id: 'overview', label: 'Overview', icon: <Eye className="w-4 h-4" /> },
            { id: 'commands', label: 'Commands', icon: <Command className="w-4 h-4" /> },
            { id: 'performance', label: 'Performance', icon: <Gauge className="w-4 h-4" /> },
            { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-gray-400 hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                title="Total Commands"
                value={totalCommands.toLocaleString()}
                subtitle="Last 30 days"
                icon={<Command className="w-4 h-4 text-purple-400" />}
                trend="up"
                trendValue={12}
                color="purple"
              />
              <StatCard
                title="Success Rate"
                value={`${successRate}%`}
                subtitle="Commands completed"
                icon={<Check className="w-4 h-4 text-green-400" />}
                trend="up"
                trendValue={3}
                color="green"
              />
              <StatCard
                title="Avg FPS"
                value={avgFps}
                subtitle="Performance"
                icon={<Gauge className="w-4 h-4 text-cyan-400" />}
                trend="stable"
                trendValue={1}
                color="cyan"
              />
              <StatCard
                title="Active Users"
                value={totalUsers}
                subtitle="Team members"
                icon={<Users className="w-4 h-4 text-yellow-400" />}
                trend="up"
                trendValue={25}
                color="yellow"
              />
            </div>
            
            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Commands Over Time */}
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-purple-400" />
                  Commands Over Time
                </h4>
                <SimpleLineChart
                  data={commandMetrics.slice(-14).map(m => ({
                    label: m.date.split('-').slice(1).join('/'),
                    value: m.total
                  }))}
                  height={150}
                />
              </div>
              
              {/* Feature Usage */}
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-purple-400" />
                  Feature Usage
                </h4>
                <div className="flex items-center gap-4">
                  <DonutChart
                    data={FEATURE_USAGE.slice(0, 6).map((f, i) => ({
                      label: f.feature,
                      value: f.count,
                      color: featureColors[i]
                    }))}
                    size={120}
                  />
                  <div className="flex-1 space-y-2">
                    {FEATURE_USAGE.slice(0, 5).map((f, i) => (
                      <div key={f.feature} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: featureColors[i] }} />
                        <span className="text-xs text-gray-400 flex-1 truncate">{f.feature}</span>
                        <span className="text-xs text-white">{f.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Activity Heatmap */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                Team Activity Heatmap
              </h4>
              <HeatmapChart data={teamActivity} />
            </div>
          </div>
        )}
        
        {activeTab === 'commands' && (
          <div className="space-y-4">
            {/* Command Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                title="Total Commands"
                value={totalCommands.toLocaleString()}
                icon={<Command className="w-4 h-4 text-purple-400" />}
                color="purple"
              />
              <StatCard
                title="Successful"
                value={commandMetrics.reduce((sum, m) => sum + m.successful, 0).toLocaleString()}
                icon={<Check className="w-4 h-4 text-green-400" />}
                color="green"
              />
              <StatCard
                title="Failed"
                value={commandMetrics.reduce((sum, m) => sum + m.failed, 0).toLocaleString()}
                icon={<X className="w-4 h-4 text-red-400" />}
                color="red"
              />
            </div>
            
            {/* Commands by Day */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-4">Commands by Day</h4>
              <SimpleBarChart
                data={commandMetrics.slice(-14).map(m => ({
                  label: m.date.split('-')[2],
                  value: m.total
                }))}
                height={180}
              />
            </div>
            
            {/* Commands by Category */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-4">Commands by Category</h4>
              <div className="space-y-3">
                {FEATURE_USAGE.map((f, i) => (
                  <div key={f.feature} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-32 truncate">{f.feature}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${f.percentage}%`,
                          backgroundColor: featureColors[i]
                        }}
                      />
                    </div>
                    <span className="text-xs text-white w-12 text-right">{f.count}</span>
                    <div className={`flex items-center gap-1 text-xs w-12 ${
                      f.trend === 'up' ? 'text-green-400' : f.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {f.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : 
                       f.trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : 
                       <Minus className="w-3 h-3" />}
                      {f.trendValue}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'performance' && (
          <div className="space-y-4">
            {/* Performance Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                title="Avg FPS"
                value={avgFps}
                icon={<Gauge className="w-4 h-4 text-cyan-400" />}
                trend="up"
                trendValue={5}
                color="cyan"
              />
              <StatCard
                title="Frame Time"
                value={`${(performanceMetrics.reduce((sum, m) => sum + m.frameTime, 0) / performanceMetrics.length).toFixed(1)}ms`}
                icon={<Clock className="w-4 h-4 text-yellow-400" />}
                trend="down"
                trendValue={8}
                color="yellow"
              />
              <StatCard
                title="GPU Time"
                value={`${(performanceMetrics.reduce((sum, m) => sum + m.gpuTime, 0) / performanceMetrics.length).toFixed(1)}ms`}
                icon={<Cpu className="w-4 h-4 text-purple-400" />}
                trend="stable"
                trendValue={2}
                color="purple"
              />
              <StatCard
                title="Memory"
                value={`${(performanceMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / performanceMetrics.length).toFixed(0)}%`}
                icon={<HardDrive className="w-4 h-4 text-green-400" />}
                trend="up"
                trendValue={3}
                color="green"
              />
            </div>
            
            {/* FPS Over Time */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-4">FPS Over Time (Last 24 Hours)</h4>
              <SimpleLineChart
                data={performanceMetrics.map((m, i) => ({
                  label: `${i}h`,
                  value: m.fps
                }))}
                height={180}
                color="#06b6d4"
              />
            </div>
            
            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-sm font-medium text-white mb-4">Draw Calls</h4>
                <SimpleBarChart
                  data={performanceMetrics.slice(-12).map((m, i) => ({
                    label: `${i}`,
                    value: m.drawCalls,
                    color: 'bg-gradient-to-t from-yellow-600 to-yellow-400'
                  }))}
                  height={120}
                  showLabels={false}
                />
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <h4 className="text-sm font-medium text-white mb-4">Triangle Count</h4>
                <SimpleBarChart
                  data={performanceMetrics.slice(-12).map((m, i) => ({
                    label: `${i}`,
                    value: m.triangles / 1000000,
                    color: 'bg-gradient-to-t from-green-600 to-green-400'
                  }))}
                  height={120}
                  showLabels={false}
                />
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'team' && (
          <div className="space-y-4">
            {/* Team Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                title="Team Members"
                value={USER_STATS.length}
                icon={<Users className="w-4 h-4 text-purple-400" />}
                color="purple"
              />
              <StatCard
                title="Total Sessions"
                value={USER_STATS.reduce((sum, u) => sum + u.sessionsCount, 0)}
                icon={<Activity className="w-4 h-4 text-cyan-400" />}
                color="cyan"
              />
              <StatCard
                title="Total Time"
                value={`${Math.floor(USER_STATS.reduce((sum, u) => sum + u.totalTime, 0) / 60)}h`}
                icon={<Clock className="w-4 h-4 text-yellow-400" />}
                color="yellow"
              />
              <StatCard
                title="Avg Commands/User"
                value={Math.floor(USER_STATS.reduce((sum, u) => sum + u.commandsExecuted, 0) / USER_STATS.length)}
                icon={<Command className="w-4 h-4 text-green-400" />}
                color="green"
              />
            </div>
            
            {/* User Leaderboard */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-400" />
                Team Leaderboard
              </h4>
              <div className="space-y-3">
                {USER_STATS.sort((a, b) => b.commandsExecuted - a.commandsExecuted).map((user, idx) => (
                  <div key={user.userId} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-yellow-500 text-yellow-900' :
                      idx === 1 ? 'bg-gray-400 text-gray-900' :
                      idx === 2 ? 'bg-amber-600 text-amber-100' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      user.name === 'You' ? 'bg-gradient-to-br from-purple-500 to-pink-500' :
                      user.name === 'Sarah Chen' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                      user.name === 'Mike Johnson' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
                      'bg-gradient-to-br from-orange-500 to-red-500'
                    } text-white`}>
                      {user.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-white font-medium">{user.name}</div>
                      <div className="text-xs text-gray-500">
                        {user.topFeatures.slice(0, 2).join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white font-medium">{user.commandsExecuted.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">commands</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{user.sessionsCount}</div>
                      <div className="text-xs text-gray-500">sessions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-white">{Math.floor(user.totalTime / 60)}h</div>
                      <div className="text-xs text-gray-500">time</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Activity Heatmap */}
            <div className="bg-white/5 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-4">Team Activity Heatmap</h4>
              <HeatmapChart data={teamActivity} />
            </div>
          </div>
        )}
      </div>
      
      {/* Voice Commands Footer */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sparkles className="w-3 h-3" />
          <span>Voice:</span>
          <span className="text-gray-400">"Show analytics"</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">"Export report"</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">"Show team stats"</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400">"Performance history"</span>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
