/**
 * Enhanced UI Components for UE5 Connection Hub
 * 
 * Modern UI/UX patterns including:
 * - Glassmorphism with depth layers
 * - Smooth micro-interactions
 * - Contextual animations
 * - Accessible design patterns
 * - Responsive layouts
 */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { ChevronDown, ChevronRight, Check, Copy, X, Loader2 } from 'lucide-react';

// ==================== ANIMATED BACKGROUNDS ====================

export const AnimatedGradientOrbs = ({ colors = ['blue', 'purple', 'cyan'] }: { colors?: string[] }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/20',
    purple: 'bg-purple-500/20',
    cyan: 'bg-cyan-500/20',
    green: 'bg-green-500/20',
    amber: 'bg-amber-500/20',
    pink: 'bg-pink-500/20',
    violet: 'bg-violet-500/20',
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className={`absolute -top-40 -right-40 w-80 h-80 ${colorMap[colors[0]] || colorMap.blue} rounded-full blur-3xl animate-float`} />
      <div className={`absolute -bottom-40 -left-40 w-80 h-80 ${colorMap[colors[1]] || colorMap.purple} rounded-full blur-3xl animate-float-delayed`} />
      {colors[2] && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 ${colorMap[colors[2]] || colorMap.cyan} rounded-full blur-3xl animate-pulse-slow`} />
      )}
    </div>
  );
};

export const ParticleField = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(20)].map((_, i) => (
      <div
        key={i}
        className="absolute w-1 h-1 bg-white/20 rounded-full animate-float-particle"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${5 + Math.random() * 10}s`,
        }}
      />
    ))}
  </div>
);

// ==================== GLASS CARDS ====================

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  glowColor?: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan' | 'pink' | 'violet';
  depth?: 1 | 2 | 3;
  onClick?: () => void;
  selected?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = false,
  glowColor = 'blue',
  depth = 1,
  onClick,
  selected = false,
}) => {
  const glowColors = {
    blue: 'shadow-blue-500/20 hover:shadow-blue-500/30',
    green: 'shadow-green-500/20 hover:shadow-green-500/30',
    purple: 'shadow-purple-500/20 hover:shadow-purple-500/30',
    amber: 'shadow-amber-500/20 hover:shadow-amber-500/30',
    red: 'shadow-red-500/20 hover:shadow-red-500/30',
    cyan: 'shadow-cyan-500/20 hover:shadow-cyan-500/30',
    pink: 'shadow-pink-500/20 hover:shadow-pink-500/30',
    violet: 'shadow-violet-500/20 hover:shadow-violet-500/30',
  };

  const depthStyles = {
    1: 'bg-white/5 border-white/10',
    2: 'bg-white/8 border-white/15',
    3: 'bg-white/10 border-white/20',
  };

  const selectedBorder = {
    blue: 'border-blue-500/50',
    green: 'border-green-500/50',
    purple: 'border-purple-500/50',
    amber: 'border-amber-500/50',
    red: 'border-red-500/50',
    cyan: 'border-cyan-500/50',
    pink: 'border-pink-500/50',
    violet: 'border-violet-500/50',
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative backdrop-blur-xl ${depthStyles[depth]} border rounded-2xl
        ${hover ? 'hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer' : ''}
        ${glow ? `shadow-2xl ${glowColors[glowColor]}` : ''}
        ${selected ? selectedBorder[glowColor] : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

// ==================== STATUS INDICATORS ====================

interface StatusOrbProps {
  status: 'connected' | 'disconnected' | 'warning' | 'loading';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  pulse?: boolean;
  label?: string;
}

export const StatusOrb: React.FC<StatusOrbProps> = ({
  status,
  size = 'md',
  pulse = true,
  label,
}) => {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const statusColors = {
    connected: 'bg-green-500',
    disconnected: 'bg-gray-500',
    warning: 'bg-amber-500',
    loading: 'bg-blue-500',
  };

  const glowColors = {
    connected: 'bg-green-400',
    disconnected: 'bg-gray-400',
    warning: 'bg-amber-400',
    loading: 'bg-blue-400',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className={`${sizeClasses[size]} rounded-full ${statusColors[status]} ${status === 'loading' ? 'animate-pulse' : ''}`}>
          {pulse && status === 'connected' && (
            <>
              <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full ${statusColors[status]} animate-ping opacity-75`} />
              <div className={`absolute inset-0 ${sizeClasses[size]} rounded-full ${glowColors[status]} blur-sm`} />
            </>
          )}
        </div>
      </div>
      {label && (
        <span className={`text-sm ${status === 'connected' ? 'text-green-400' : status === 'warning' ? 'text-amber-400' : 'text-gray-400'}`}>
          {label}
        </span>
      )}
    </div>
  );
};

// ==================== CONNECTION VISUALIZATION ====================

interface ConnectionNodeProps {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  connected: boolean;
  gradient: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ConnectionNode: React.FC<ConnectionNodeProps> = ({
  icon: Icon,
  label,
  sublabel,
  connected,
  gradient,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-14 h-14',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center group">
      <div
        className={`
          ${sizeClasses[size]} rounded-2xl flex flex-col items-center justify-center
          transform hover:scale-105 transition-all duration-300
          ${connected 
            ? `bg-gradient-to-br ${gradient} shadow-lg` 
            : 'bg-gray-700/50 border border-gray-600'
          }
        `}
        style={connected ? { boxShadow: `0 10px 40px -10px ${gradient.includes('green') ? 'rgba(34, 197, 94, 0.3)' : gradient.includes('purple') ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}` } : {}}
      >
        <Icon className={`${iconSizes[size]} text-white ${!connected ? 'opacity-50' : ''}`} />
      </div>
      <span className={`font-medium mt-2 ${connected ? 'text-white' : 'text-gray-500'}`}>{label}</span>
      {sublabel && (
        <span className="text-xs text-gray-400">{sublabel}</span>
      )}
    </div>
  );
};

interface ConnectionLineProps {
  active: boolean;
  label?: string;
  direction?: 'horizontal' | 'vertical';
  animated?: boolean;
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({
  active,
  label,
  direction = 'horizontal',
  animated = true,
}) => {
  const isHorizontal = direction === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center mx-2`}>
      <div
        className={`
          relative overflow-hidden rounded-full
          ${isHorizontal ? 'h-1.5 w-16 md:w-24' : 'w-1.5 h-16 md:h-24'}
          ${active ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30' : 'bg-gray-700'}
        `}
      >
        {active && (
          <div className={`absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-400 ${animated ? 'animate-flow' : ''}`}>
            {animated && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            )}
          </div>
        )}
      </div>
      {label && (
        <span className={`text-xs mt-1 ${active ? 'text-green-400' : 'text-gray-500'}`}>
          {label}
        </span>
      )}
    </div>
  );
};

// ==================== STAT CARDS ====================

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  gradient: string;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  subtext,
  gradient,
  trend,
  onClick,
}) => (
  <GlassCard className="p-5 group" hover onClick={onClick}>
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-gray-400 text-sm mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          {trend && (
            <span className={`text-xs font-medium ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          )}
        </div>
        {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
      </div>
      <div
        className={`
          w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} 
          flex items-center justify-center 
          transform group-hover:scale-110 group-hover:rotate-3 
          transition-all duration-300 shadow-lg
        `}
        style={{ boxShadow: `0 8px 24px -8px ${gradient.includes('blue') ? 'rgba(59, 130, 246, 0.4)' : gradient.includes('green') ? 'rgba(34, 197, 94, 0.4)' : gradient.includes('purple') ? 'rgba(168, 85, 247, 0.4)' : 'rgba(251, 191, 36, 0.4)'}` }}
      >
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </GlassCard>
);

// ==================== TABS ====================

interface Tab {
  id: string;
  label: string;
  icon: React.ElementType;
  gradient: string;
  badge?: number | string;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'pills' | 'underline' | 'cards';
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'pills',
}) => {
  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative p-4 rounded-xl transition-all duration-300 group
                ${isActive 
                  ? `bg-gradient-to-br ${tab.gradient} shadow-lg` 
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20'
                }
              `}
              style={isActive ? { boxShadow: `0 10px 30px -10px ${tab.gradient.includes('blue') ? 'rgba(59, 130, 246, 0.5)' : tab.gradient.includes('purple') ? 'rgba(168, 85, 247, 0.5)' : 'rgba(34, 197, 94, 0.5)'}` } : {}}
            >
              <div className="flex flex-col items-center gap-2">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} transition-colors`} />
                <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} transition-colors`}>
                  {tab.label}
                </span>
              </div>
              {tab.badge !== undefined && (
                <span className={`
                  absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 
                  text-[10px] font-bold rounded-full flex items-center justify-center
                  ${isActive ? 'bg-white text-gray-900' : 'bg-red-500 text-white'}
                `}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex ${variant === 'pills' ? 'gap-2 flex-wrap' : 'border-b border-white/10'}`}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-2 px-4 py-2.5 transition-all duration-300
              ${variant === 'pills' 
                ? `rounded-xl ${isActive ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg` : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`
                : `${isActive ? 'text-white border-b-2 border-white' : 'text-gray-400 hover:text-white'}`
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`
                min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full 
                flex items-center justify-center
                ${isActive ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}
              `}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ==================== COLLAPSIBLE SECTION ====================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
  gradient?: string;
  actions?: ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
  gradient = 'from-blue-500 to-cyan-500',
  actions,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <GlassCard className="overflow-hidden" hover={false}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-white">{title}</span>
            {badge !== undefined && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-white/10 rounded-full text-gray-300">{badge}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        style={{
          maxHeight: isOpen ? contentRef.current?.scrollHeight ? `${contentRef.current.scrollHeight + 100}px` : '2000px' : '0px',
        }}
      >
        <div className="p-4 pt-0 border-t border-white/5">{children}</div>
      </div>
    </GlassCard>
  );
};

// ==================== CODE BLOCK ====================

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'bash',
  showLineNumbers = false,
  maxHeight = '400px',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div className="relative group rounded-xl overflow-hidden">
      <div className="absolute top-3 left-4 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-gray-500 font-mono ml-2">{language}</span>
      </div>
      <pre
        className="bg-gray-950/90 backdrop-blur border border-gray-800 rounded-xl p-4 pt-10 overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ maxHeight }}
      >
        <code className="text-sm text-gray-300 font-mono">
          {showLineNumbers ? (
            <table className="w-full">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="pr-4 text-gray-600 select-none text-right w-8">{i + 1}</td>
                    <td className="whitespace-pre-wrap">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="whitespace-pre-wrap">{code}</span>
          )}
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className={`
          absolute top-3 right-3 p-2 rounded-lg transition-all duration-200
          ${copied 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-gray-800/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-700 hover:text-white'
          }
        `}
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
};

// ==================== STEP INDICATOR ====================

interface StepProps {
  number: number;
  title: string;
  children: ReactNode;
  isLast?: boolean;
  status?: 'pending' | 'active' | 'completed';
}

export const Step: React.FC<StepProps> = ({
  number,
  title,
  children,
  isLast = false,
  status = 'pending',
}) => {
  const statusStyles = {
    pending: 'bg-gray-700 text-gray-400',
    active: 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25 animate-pulse',
    completed: 'bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25',
  };

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${statusStyles[status]}`}>
          {status === 'completed' ? <Check className="w-5 h-5" /> : number}
        </div>
        {!isLast && (
          <div className={`w-0.5 h-full mt-2 transition-colors duration-300 ${status === 'completed' ? 'bg-gradient-to-b from-green-500 to-green-500/20' : 'bg-gradient-to-b from-gray-600 to-transparent'}`} />
        )}
      </div>
      <div className="flex-1 pb-8">
        <h4 className={`font-semibold mb-2 transition-colors ${status === 'active' ? 'text-blue-400' : status === 'completed' ? 'text-green-400' : 'text-white'}`}>
          {title}
        </h4>
        <div className="text-gray-400 text-sm space-y-3">{children}</div>
      </div>
    </div>
  );
};

// ==================== SEARCH INPUT ====================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  loading?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search...',
  onClear,
  loading = false,
}) => (
  <div className="relative group">
    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
      {loading ? (
        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
      ) : (
        <svg className="w-5 h-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )}
    </div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-10 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:bg-white/10 focus:outline-none transition-all duration-200"
    />
    {value && onClear && (
      <button
        onClick={onClear}
        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

// ==================== TOOLTIP ====================

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute ${positionClasses[position]} z-50 px-3 py-2 text-sm text-white bg-gray-900 border border-gray-700 rounded-lg shadow-xl whitespace-nowrap animate-fade-in`}>
          {content}
          <div className={`absolute w-2 h-2 bg-gray-900 border-gray-700 transform rotate-45 ${
            position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -mt-1 border-r border-b' :
            position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l border-t' :
            position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r' :
            'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l'
          }`} />
        </div>
      )}
    </div>
  );
};

// ==================== BADGE ====================

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
}) => {
  const variantStyles = {
    default: 'bg-gray-700 text-gray-300',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${pulse ? 'animate-pulse' : ''}`}>
      {children}
    </span>
  );
};

// ==================== EMPTY STATE ====================

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    gradient?: string;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
      <Icon className="w-10 h-10 text-gray-500" />
    </div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 max-w-md mb-6">{description}</p>
    {action && (
      <button
        onClick={action.onClick}
        className={`px-6 py-3 rounded-xl font-medium text-white bg-gradient-to-r ${action.gradient || 'from-blue-500 to-cyan-500'} hover:opacity-90 transition-opacity shadow-lg`}
      >
        {action.label}
      </button>
    )}
  </div>
);

export default {
  AnimatedGradientOrbs,
  ParticleField,
  GlassCard,
  StatusOrb,
  ConnectionNode,
  ConnectionLine,
  StatCard,
  TabNavigation,
  CollapsibleSection,
  CodeBlock,
  Step,
  SearchInput,
  Tooltip,
  Badge,
  EmptyState,
};
