/**
 * Skeleton Loading Components
 * Provides visual placeholders while content is loading
 */

import React from 'react';

// ==================== BASE SKELETON ====================

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className = '', animate = true }: SkeletonProps): JSX.Element {
  return (
    <div
      className={`bg-white/5 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    />
  );
}

// ==================== SKELETON TEXT ====================

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 3,
  className = '',
  lastLineWidth = '60%'
}: SkeletonTextProps): JSX.Element {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: i === lines - 1 ? lastLineWidth : '100%' } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

// ==================== SKELETON AVATAR ====================

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  return <Skeleton className={`rounded-full ${sizeClasses[size]} ${className}`} />;
}

// ==================== SKELETON BUTTON ====================

interface SkeletonButtonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SkeletonButton({ size = 'md', className = '' }: SkeletonButtonProps): JSX.Element {
  const sizeClasses = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32'
  };

  return <Skeleton className={`rounded-lg ${sizeClasses[size]} ${className}`} />;
}

// ==================== SKELETON CARD ====================

interface SkeletonCardProps {
  className?: string;
  showImage?: boolean;
  showAvatar?: boolean;
  lines?: number;
}

export function SkeletonCard({
  className = '',
  showImage = false,
  showAvatar = false,
  lines = 2
}: SkeletonCardProps): JSX.Element {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl p-4 ${className}`}>
      {showImage && <Skeleton className="h-40 w-full rounded-lg mb-4" />}
      
      <div className="flex items-start gap-3">
        {showAvatar && <SkeletonAvatar />}
        
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <SkeletonText lines={lines} />
        </div>
      </div>
    </div>
  );
}

// ==================== SKELETON LIST ITEM ====================

interface SkeletonListItemProps {
  showAvatar?: boolean;
  showAction?: boolean;
  className?: string;
}

export function SkeletonListItem({
  showAvatar = true,
  showAction = false,
  className = ''
}: SkeletonListItemProps): JSX.Element {
  return (
    <div className={`flex items-center gap-3 p-3 ${className}`}>
      {showAvatar && <SkeletonAvatar size="sm" />}
      
      <div className="flex-1">
        <Skeleton className="h-4 w-1/3 mb-1" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      
      {showAction && <SkeletonButton size="sm" />}
    </div>
  );
}

// ==================== SKELETON TABLE ====================

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
  className = ''
}: SkeletonTableProps): JSX.Element {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-white/10 bg-white/5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex gap-4 p-4 border-b border-white/5 last:border-b-0"
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              className="h-4 flex-1"
              style={{ width: colIndex === 0 ? '40%' : '100%' } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ==================== SKELETON CHART ====================

interface SkeletonChartProps {
  type?: 'bar' | 'line' | 'pie';
  className?: string;
}

export function SkeletonChart({ type = 'bar', className = '' }: SkeletonChartProps): JSX.Element {
  if (type === 'pie') {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Skeleton className="w-48 h-48 rounded-full" />
      </div>
    );
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-end gap-2 h-48">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t"
            style={{ height: `${Math.random() * 60 + 40}%` } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8" />
        ))}
      </div>
    </div>
  );
}

// ==================== SKELETON STATS ====================

interface SkeletonStatsProps {
  count?: number;
  className?: string;
}

export function SkeletonStats({ count = 4, className = '' }: SkeletonStatsProps): JSX.Element {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
          <Skeleton className="h-3 w-1/2 mb-2" />
          <Skeleton className="h-8 w-3/4 mb-1" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ==================== SKELETON PANEL ====================

interface SkeletonPanelProps {
  title?: boolean;
  actions?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function SkeletonPanel({
  title = true,
  actions = false,
  children,
  className = ''
}: SkeletonPanelProps): JSX.Element {
  return (
    <div className={`bg-white/5 border border-white/10 rounded-xl ${className}`}>
      {/* Header */}
      {(title || actions) && (
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {title && <Skeleton className="h-6 w-40" />}
          {actions && (
            <div className="flex gap-2">
              <SkeletonButton size="sm" />
              <SkeletonButton size="sm" />
            </div>
          )}
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {children || <SkeletonText lines={4} />}
      </div>
    </div>
  );
}

// ==================== SKELETON FORM ====================

interface SkeletonFormProps {
  fields?: number;
  className?: string;
}

export function SkeletonForm({ fields = 4, className = '' }: SkeletonFormProps): JSX.Element {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <SkeletonButton size="lg" />
        <SkeletonButton size="lg" />
      </div>
    </div>
  );
}

// ==================== SKELETON GRID ====================

interface SkeletonGridProps {
  items?: number;
  columns?: number;
  itemHeight?: string;
  className?: string;
}

export function SkeletonGrid({
  items = 6,
  columns = 3,
  itemHeight = 'h-48',
  className = ''
}: SkeletonGridProps): JSX.Element {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className={`rounded-xl ${itemHeight}`} />
      ))}
    </div>
  );
}

// ==================== UE5 SPECIFIC SKELETONS ====================

export function SkeletonConnectionStatus(): JSX.Element {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-16 h-16 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <SkeletonButton />
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-3">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChatMessage(): JSX.Element {
  return (
    <div className="flex gap-3 p-4">
      <SkeletonAvatar size="sm" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

export function SkeletonToolCard(): JSX.Element {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <SkeletonText lines={2} />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonScenePreview(): JSX.Element {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <Skeleton className="h-64 w-full" />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
