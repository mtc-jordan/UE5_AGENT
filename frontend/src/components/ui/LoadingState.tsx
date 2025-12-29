/**
 * Loading State Component
 * Combines loading states, error handling, and empty states
 */

import React, { ReactNode } from 'react';
import { Loader2, AlertTriangle, RefreshCw, Inbox } from 'lucide-react';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonStats, SkeletonGrid } from './Skeleton';

// ==================== TYPES ====================

type LoadingVariant = 'spinner' | 'skeleton' | 'card' | 'table' | 'stats' | 'grid' | 'custom';

interface LoadingStateProps {
  isLoading: boolean;
  error?: Error | string | null;
  isEmpty?: boolean;
  children: ReactNode;
  
  // Loading options
  loadingVariant?: LoadingVariant;
  loadingText?: string;
  customLoader?: ReactNode;
  skeletonCount?: number;
  
  // Error options
  onRetry?: () => void;
  errorTitle?: string;
  
  // Empty options
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  
  // Styling
  className?: string;
  minHeight?: string;
}

// ==================== LOADING STATE COMPONENT ====================

export function LoadingState({
  isLoading,
  error,
  isEmpty = false,
  children,
  loadingVariant = 'spinner',
  loadingText = 'Loading...',
  customLoader,
  skeletonCount = 3,
  onRetry,
  errorTitle = 'Something went wrong',
  emptyIcon,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyAction,
  className = '',
  minHeight = 'min-h-[200px]'
}: LoadingStateProps): JSX.Element {
  // Error state
  if (error) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    return (
      <div className={`flex items-center justify-center ${minHeight} ${className}`}>
        <div className="text-center p-6 max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{errorTitle}</h3>
          <p className="text-gray-400 mb-4">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`${minHeight} ${className}`}>
        {renderLoader(loadingVariant, loadingText, customLoader, skeletonCount)}
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className={`flex items-center justify-center ${minHeight} ${className}`}>
        <div className="text-center p-6 max-w-md">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            {emptyIcon || <Inbox className="w-8 h-8 text-gray-500" />}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{emptyTitle}</h3>
          {emptyDescription && (
            <p className="text-gray-400 mb-4">{emptyDescription}</p>
          )}
          {emptyAction && (
            <button
              onClick={emptyAction.onClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
            >
              {emptyAction.label}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Content
  return <>{children}</>;
}

// ==================== LOADER RENDERER ====================

function renderLoader(
  variant: LoadingVariant,
  text: string,
  customLoader?: ReactNode,
  count: number = 3
): JSX.Element {
  switch (variant) {
    case 'skeleton':
      return (
        <div className="space-y-4 p-4">
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      );
      
    case 'card':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
      
    case 'table':
      return <SkeletonTable rows={count} className="m-4" />;
      
    case 'stats':
      return <SkeletonStats count={count} className="p-4" />;
      
    case 'grid':
      return <SkeletonGrid items={count} className="p-4" />;
      
    case 'custom':
      return <>{customLoader}</>;
      
    case 'spinner':
    default:
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[200px]">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
          <p className="text-gray-400 text-sm">{text}</p>
        </div>
      );
  }
}

// ==================== INLINE LOADING ====================

interface InlineLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InlineLoading({
  text = 'Loading...',
  size = 'md',
  className = ''
}: InlineLoadingProps): JSX.Element {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} text-purple-400 animate-spin`} />
      {text && <span className="text-gray-400 text-sm">{text}</span>}
    </div>
  );
}

// ==================== BUTTON LOADING ====================

interface ButtonLoadingProps {
  isLoading: boolean;
  children: ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}

export function ButtonLoading({
  isLoading,
  children,
  loadingText = 'Loading...',
  className = '',
  disabled,
  onClick
}: ButtonLoadingProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`inline-flex items-center justify-center gap-2 ${className} ${
        isLoading || disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ==================== OVERLAY LOADING ====================

interface OverlayLoadingProps {
  isLoading: boolean;
  text?: string;
  blur?: boolean;
  children: ReactNode;
  className?: string;
}

export function OverlayLoading({
  isLoading,
  text = 'Loading...',
  blur = true,
  children,
  className = ''
}: OverlayLoadingProps): JSX.Element {
  return (
    <div className={`relative ${className}`}>
      {children}
      
      {isLoading && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl z-10 ${
            blur ? 'backdrop-blur-sm' : ''
          }`}
        >
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
            <p className="text-white text-sm">{text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== PROGRESS LOADING ====================

interface ProgressLoadingProps {
  progress: number;
  text?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressLoading({
  progress,
  text = 'Loading...',
  showPercentage = true,
  className = ''
}: ProgressLoadingProps): JSX.Element {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="w-full max-w-xs mb-3">
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">{text}</span>
        {showPercentage && (
          <span className="text-white font-medium">{Math.round(clampedProgress)}%</span>
        )}
      </div>
    </div>
  );
}

// ==================== PULSE DOT LOADING ====================

interface PulseDotsProps {
  className?: string;
}

export function PulseDots({ className = '' }: PulseDotsProps): JSX.Element {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

export default LoadingState;
