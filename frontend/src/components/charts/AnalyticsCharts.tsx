import React, { useMemo } from 'react';

// Types
interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

interface ChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  animate?: boolean;
}

// Utility functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Line Chart Component
export function LineChart({
  data,
  height = 200,
  color = '#3B82F6',
  showGrid = true,
  showLabels = true,
  animate = true
}: ChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;
    
    const padding = 40;
    const chartWidth = 100; // percentage
    const chartHeight = height - padding * 2;
    
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = ((maxValue - d.value) / range) * chartHeight + padding;
      return { x, y, ...d };
    });
    
    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');
    
    const areaD = `${pathD} L ${100} ${chartHeight + padding} L 0 ${chartHeight + padding} Z`;
    
    return { points, pathD, areaD, maxValue, minValue };
  }, [data, height]);

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Grid lines */}
        {showGrid && (
          <g className="text-gray-700">
            {[0, 25, 50, 75, 100].map(y => (
              <line
                key={y}
                x1="0"
                y1={`${y}%`}
                x2="100"
                y2={`${y}%`}
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            ))}
          </g>
        )}
        
        {/* Area fill */}
        <path
          d={chartData.areaD}
          fill={`url(#gradient-${color.replace('#', '')})`}
          opacity="0.3"
        />
        
        {/* Line */}
        <path
          d={chartData.pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={animate ? 'animate-draw' : ''}
        />
        
        {/* Data points */}
        {chartData.points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={color}
            className="opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
          />
        ))}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient
            id={`gradient-${color.replace('#', '')}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Y-axis labels */}
      {showLabels && (
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
          <span>{formatNumber(chartData.maxValue)}</span>
          <span>{formatNumber(chartData.minValue)}</span>
        </div>
      )}
    </div>
  );
}

// Bar Chart Component
export function BarChart({
  data,
  height = 200,
  color = '#3B82F6',
  showGrid = true,
  showLabels = true
}: ChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const values = data.map(d => d.value);
    const maxValue = Math.max(...values, 1);
    
    return { maxValue, data };
  }, [data]);

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        No data available
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <div className="flex items-end justify-between h-full gap-1 px-1">
        {chartData.data.map((d, i) => {
          const barHeight = (d.value / chartData.maxValue) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center group"
            >
              <div
                className="w-full rounded-t transition-all duration-300 hover:opacity-80 relative"
                style={{
                  height: `${Math.max(barHeight, 2)}%`,
                  backgroundColor: color
                }}
              >
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {d.label || formatDate(d.date)}: {formatNumber(d.value)}
                </div>
              </div>
              {showLabels && i % Math.ceil(data.length / 7) === 0 && (
                <span className="text-xs text-gray-500 mt-1 truncate w-full text-center">
                  {formatDate(d.date)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Y-axis labels */}
      {showGrid && (
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8 pointer-events-none">
          <span>{formatNumber(chartData.maxValue)}</span>
          <span>0</span>
        </div>
      )}
    </div>
  );
}

// Donut Chart Component
export function DonutChart({
  data,
  size = 200,
  thickness = 30,
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
}: {
  data: { label: string; value: number }[];
  size?: number;
  thickness?: number;
  colors?: string[];
}) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    const total = data.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return null;
    
    let currentAngle = -90;
    const segments = data.map((d, i) => {
      const percentage = d.value / total;
      const angle = percentage * 360;
      const startAngle = currentAngle;
      currentAngle += angle;
      
      return {
        ...d,
        percentage,
        startAngle,
        endAngle: currentAngle,
        color: colors[i % colors.length]
      };
    });
    
    return { segments, total };
  }, [data, colors]);

  if (!chartData) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-gray-500">No data</span>
      </div>
    );
  }

  const radius = size / 2;
  const innerRadius = radius - thickness;

  const getArcPath = (startAngle: number, endAngle: number, r: number) => {
    const start = polarToCartesian(radius, radius, r, endAngle);
    const end = polarToCartesian(radius, radius, r, startAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {chartData.segments.map((segment, i) => (
          <path
            key={i}
            d={getArcPath(segment.startAngle, segment.endAngle, radius - thickness / 2)}
            fill="none"
            stroke={segment.color}
            strokeWidth={thickness}
            className="transition-all duration-300 hover:opacity-80"
          />
        ))}
      </svg>
      
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{formatNumber(chartData.total)}</p>
          <p className="text-sm text-gray-400">Total</p>
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute -right-32 top-1/2 -translate-y-1/2 space-y-2">
        {chartData.segments.map((segment, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-sm text-gray-400">
              {segment.label} ({(segment.percentage * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Sparkline Component (mini inline chart)
export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = '#3B82F6',
  showDot = true
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDot?: boolean;
}) {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  const lastPoint = data[data.length - 1];
  const lastX = width;
  const lastY = height - ((lastPoint - min) / range) * height;

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDot && (
        <circle
          cx={lastX}
          cy={lastY}
          r="3"
          fill={color}
        />
      )}
    </svg>
  );
}

// Progress Bar Component
export function ProgressBar({
  value,
  max = 100,
  color = '#3B82F6',
  showLabel = true,
  height = 8
}: {
  value: number;
  max?: number;
  color?: string;
  showLabel?: boolean;
  height?: number;
}) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="w-full">
      <div
        className="w-full bg-gray-700 rounded-full overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>{formatNumber(value)}</span>
          <span>{percentage.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// Metric Card with Trend
export function MetricCard({
  title,
  value,
  trend,
  trendData,
  icon: Icon,
  color = 'blue'
}: {
  title: string;
  value: string | number;
  trend?: number;
  trendData?: number[];
  icon?: React.ElementType;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) {
  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    purple: 'bg-purple-600',
    orange: 'bg-orange-600',
    red: 'bg-red-600'
  };
  
  const colorHex = {
    blue: '#3B82F6',
    green: '#10B981',
    purple: '#8B5CF6',
    orange: '#F59E0B',
    red: '#EF4444'
  };

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trend !== undefined && (
            <p className={`text-sm mt-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {Icon && (
            <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
          )}
          {trendData && (
            <Sparkline data={trendData} color={colorHex[color]} width={60} height={24} />
          )}
        </div>
      </div>
    </div>
  );
}

export default {
  LineChart,
  BarChart,
  DonutChart,
  Sparkline,
  ProgressBar,
  MetricCard
};
