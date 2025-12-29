/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, ChevronDown, ChevronUp } from 'lucide-react';

// ==================== TYPES ====================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showStackTrace: boolean;
}

// ==================== ERROR BOUNDARY CLASS ====================

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStackTrace: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showStackTrace: false
    });
  };

  toggleStackTrace = (): void => {
    this.setState(prev => ({ showStackTrace: !prev.showStackTrace }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[200px] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-red-500/10 border border-red-500/30 rounded-xl p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Something went wrong</h3>
                <p className="text-sm text-gray-400">An unexpected error occurred</p>
              </div>
            </div>

            {/* Error Message */}
            <div className="bg-black/30 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-mono text-sm">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            {/* Stack Trace (collapsible) */}
            {this.props.showDetails && this.state.errorInfo && (
              <div className="mb-4">
                <button
                  onClick={this.toggleStackTrace}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {this.state.showStackTrace ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  {this.state.showStackTrace ? 'Hide' : 'Show'} technical details
                </button>
                
                {this.state.showStackTrace && (
                  <pre className="mt-2 bg-black/30 rounded-lg p-4 text-xs text-gray-400 overflow-auto max-h-48 font-mono">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={this.resetError}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ==================== ERROR FALLBACK COMPONENTS ====================

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
  compact?: boolean;
}

export function ErrorFallback({
  error,
  resetError,
  title = 'Something went wrong',
  description = 'An unexpected error occurred',
  compact = false
}: ErrorFallbackProps): JSX.Element {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-red-300 truncate">{error?.message || description}</p>
        </div>
        {resetError && (
          <button
            onClick={resetError}
            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-red-400" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
        <Bug className="w-8 h-8 text-red-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 mb-4 max-w-md">
        {error?.message || description}
      </p>
      {resetError && (
        <button
          onClick={resetError}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );
}

// ==================== CONNECTION ERROR COMPONENT ====================

interface ConnectionErrorProps {
  onRetry?: () => void;
  message?: string;
}

export function ConnectionError({
  onRetry,
  message = 'Unable to connect to the server'
}: ConnectionErrorProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-yellow-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
      <p className="text-gray-400 mb-4 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      )}
    </div>
  );
}

// ==================== EMPTY STATE COMPONENT ====================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-gray-400 mb-4 max-w-md">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
